// Zorq Render deploy tool — ONE command owns the whole Render operation
// (ARCHITECTURE.md §1: deployment/ owns Render service config).
//
//   node deployment/render-deploy.mjs              # sync env -> deploy -> poll -> smoke
//   node deployment/render-deploy.mjs --no-deploy  # sync env + smoke the live service only
//   node deployment/render-deploy.mjs --selftest   # pure-helper assertions, no network
//
// Why a script and not the Render CLI (decision D-9.18): the CLI cannot express this
// service — `services create/update` expose no --dockerfile-path and `blueprints` only
// validates. This drives the same Render REST API the manual deploy used, idempotently.
//
// SECRET POLICY (AGENTS.md §24): the RENDER_API_KEY comes from the environment; env
// values are pushed to Render but NEVER printed — only masked summaries. Values are read
// from the git-ignored `.env` (the deploy contract mirror of `.env.example`).

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const API_BASE = "https://api.render.com/v1";

// The env contract this tool manages. Required keys must exist locally; optional keys are
// synced only when present. APP_BASE_URL and NODE_ENV are always derived, never read.
const REQUIRED_ENV_KEYS = ["QLOO_API_KEY", "DEEPSEEK_API_KEY", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"];
const OPTIONAL_ENV_KEYS = [
  "LLM_BUDGET_USD",
  "MAX_QLOO_CALLS",
  "QLOO_CONCURRENCY",
  "QLOO_CACHE_TTL_SEC",
  "PERSIST_QLOO_DERIVED",
  "VITE_MAPTILER_KEY",
];

const TERMINAL_SUCCESS = new Set(["live"]);
const TERMINAL_FAILURE = new Set(["build_failed", "update_failed", "canceled", "pre_deploy_failed"]);

export function parseDotenv(text) {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function buildEnvList(values, publicUrl) {
  const list = [];
  for (const key of REQUIRED_ENV_KEYS) {
    if (!values[key]) throw new Error(`missing required env key in .env: ${key}`);
    list.push({ key, value: String(values[key]) });
  }
  list.push({ key: "APP_BASE_URL", value: publicUrl });
  list.push({ key: "NODE_ENV", value: "production" });
  for (const key of OPTIONAL_ENV_KEYS) {
    if (values[key] !== undefined && values[key] !== "") {
      list.push({ key, value: String(values[key]) });
    }
  }
  return list;
}

export function classifyDeployStatus(status) {
  if (TERMINAL_SUCCESS.has(status)) return "success";
  if (TERMINAL_FAILURE.has(status)) return "failed";
  return "pending";
}

export function mask(value) {
  const s = String(value ?? "");
  if (s.length <= 4) return "*".repeat(s.length);
  return `${s.slice(0, 3)}…${s.slice(-2)} (len ${s.length})`;
}

export function selectService(services, name) {
  const match = (services || []).find(
    (entry) => entry && entry.service && entry.service.name === name,
  );
  return match ? match.service : null;
}

async function call(apiKey, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function findService(apiKey, name) {
  const services = await call(apiKey, "GET", "/services?limit=100");
  return selectService(services, name);
}

async function syncEnv(apiKey, serviceId, envList) {
  await call(
    apiKey,
    "PUT",
    `/services/${serviceId}/env-vars`,
    envList.map(({ key, value }) => ({ key, value })),
  );
  process.stdout.write(`env: replaced ${envList.length} variables\n`);
  for (const { key, value } of envList) {
    process.stdout.write(`  ${key}=${mask(value)}\n`);
  }
}

async function triggerDeploy(apiKey, serviceId) {
  const res = await call(apiKey, "POST", `/services/${serviceId}/deploys`, {});
  return res.deploy || res;
}

async function pollDeploy(apiKey, serviceId, deployId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    const res = await call(apiKey, "GET", `/services/${serviceId}/deploys/${deployId}`);
    const deploy = res.deploy || res;
    if (deploy.status !== last) {
      last = deploy.status;
      process.stdout.write(`deploy ${deployId}: ${deploy.status}\n`);
    }
    const verdict = classifyDeployStatus(deploy.status);
    if (verdict !== "pending") return { verdict, deploy };
    await sleep(8000);
  }
  return { verdict: "timeout", deploy: { id: deployId, status: last || "unknown" } };
}

async function smoke(url) {
  const base = url.replace(/\/$/, "");
  const healthz = await fetch(`${base}/healthz`, { redirect: "follow" });
  const body = await healthz.text();
  process.stdout.write(`GET /healthz -> ${healthz.status} ${body.slice(0, 200)}\n`);
  if (healthz.status !== 200) return false;
  const root = await fetch(`${base}/`, { redirect: "follow" });
  process.stdout.write(`GET / -> ${root.status}\n`);
  return root.status === 200;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [flag, inline] = token.slice(2).split("=");
    if (inline !== undefined) args[flag] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[flag] = argv[++i];
    else args[flag] = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.selftest) {
    runSelfTest();
    process.stdout.write("selftest: PASS\n");
    return;
  }

  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) throw new Error("RENDER_API_KEY is not set in the environment");

  const envFile = typeof args["env-file"] === "string" ? args["env-file"] : ".env";
  let dotenv = {};
  try {
    dotenv = parseDotenv(readFileSync(envFile, "utf8"));
    process.stdout.write(`env: loaded ${Object.keys(dotenv).length} keys from ${envFile}\n`);
  } catch {
    process.stdout.write(`env: no readable .env at ${envFile} (process env only)\n`);
  }
  const merged = { ...dotenv, ...process.env };

  const serviceName = typeof args.service === "string" ? args.service : "zorq";
  const service = await findService(apiKey, serviceName);
  if (!service) throw new Error(`service not found on Render: ${serviceName}`);
  const serviceId = service.id;
  const url =
    (typeof args.url === "string" && args.url) ||
    (service.serviceDetails && service.serviceDetails.url) ||
    "";
  if (!url) throw new Error("could not resolve the service public URL (pass --url)");
  process.stdout.write(`service: ${serviceName} (${serviceId}) -> ${url}\n`);

  const envList = buildEnvList(merged, url);
  await syncEnv(apiKey, serviceId, envList);

  let ok = true;
  if (!args["no-deploy"]) {
    const deploy = await triggerDeploy(apiKey, serviceId);
    const deployId = deploy.id;
    const commit = deploy.commit && deploy.commit.id ? deploy.commit.id : "?";
    process.stdout.write(`deploy: triggered ${deployId} (commit ${commit})\n`);
    const { verdict, deploy: final } = await pollDeploy(
      apiKey,
      serviceId,
      deployId,
      Number(args.timeout || 900) * 1000,
    );
    process.stdout.write(`deploy: ${verdict} (${final.status})\n`);
    ok = verdict === "success";
  }

  const smokeOk = await smoke(url);
  ok = ok && smokeOk;
  process.stdout.write(ok ? "RESULT: OK\n" : "RESULT: FAILED\n");
  process.exitCode = ok ? 0 : 1;
}

function runSelfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`selftest assertion failed: ${msg}`);
  };

  const dotenv = parseDotenv(
    ["# comment", "QLOO_API_KEY=abc123", 'DEEPSEEK_API_KEY="quoted value"', "", "EMPTY=", " X = y "].join(
      "\n",
    ),
  );
  assert(dotenv.QLOO_API_KEY === "abc123", "plain value parsed");
  assert(dotenv.DEEPSEEK_API_KEY === "quoted value", "quoted value unwrapped");
  assert(dotenv.EMPTY === "", "empty value kept");
  assert(dotenv.X === "y", "whitespace around key trimmed");

  const envList = buildEnvList(
    {
      QLOO_API_KEY: "q",
      DEEPSEEK_API_KEY: "d",
      TURSO_DATABASE_URL: "t",
      TURSO_AUTH_TOKEN: "a",
      LLM_BUDGET_USD: "2.00",
    },
    "https://example.onrender.com",
  );
  const byKey = Object.fromEntries(envList.map((e) => [e.key, e.value]));
  if (byKey.NODE_ENV !== "production") throw new Error("NODE_ENV not forced production");
  if (byKey.APP_BASE_URL !== "https://example.onrender.com") throw new Error("APP_BASE_URL not derived");
  if (byKey.LLM_BUDGET_USD !== "2.00") throw new Error("optional key not carried");
  if ("VITE_MAPTILER_KEY" in byKey) throw new Error("absent optional key was emitted");

  if (classifyDeployStatus("live") !== "success") throw new Error("live classification");
  if (classifyDeployStatus("build_failed") !== "failed") throw new Error("build_failed classification");
  if (classifyDeployStatus("build_in_progress") !== "pending") throw new Error("pending classification");

  if (mask("supersecretvalue").includes("supersecret")) throw new Error("mask leaked a secret");
  if (mask("").length !== 0) throw new Error("empty mask");

  const found = selectService(
    [{ service: { id: "srv-1", name: "zorq" } }, { service: { id: "srv-2", name: "other" } }],
    "zorq",
  );
  if (!found || found.id !== "srv-1") throw new Error("service selection");

  let threw = false;
  try {
    buildEnvList({ QLOO_API_KEY: "q" }, "https://x");
  } catch (err) {
    threw = /DEEPSEEK_API_KEY/.test(err.message);
  }
  if (!threw) throw new Error("missing required key was not reported");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exitCode = 1;
  });
}
