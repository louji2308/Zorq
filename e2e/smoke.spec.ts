import { expect, test } from "@playwright/test";

test("GET /healthz returns 200 with status ok and checks present", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    status: string;
    service: string;
    checks: Record<string, unknown>;
  };
  expect(body.status).toBe("ok");
  expect(body.service).toBe("zorq");
  expect(Object.keys(body.checks).length).toBeGreaterThan(0);
});

test("GET / renders the S0 Brief screen (landing line, presets, steps) and no error markers", async ({
  page
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().startsWith("Failed to load resource")) return;
    consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Zorq" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Design what belongs together on a site." })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Try a site" })).toBeVisible();
  await expect(page.getByText("Crosby Street, SoHo")).toBeVisible();
  await expect(page.getByText("Lower Broadway, Nashville")).toBeVisible();
  await expect(page.getByText("Reading Terminal Market")).toBeVisible();
  await expect(page.getByText("1 Read the culture.")).toBeVisible();

  const rendered = await page.locator("body").innerText();
  expect(rendered).not.toContain("Phase 6 will build this screen");
  expect(rendered).not.toContain("undefined");
  expect(rendered).not.toMatch(/\bError:/);
  expect(rendered).not.toMatch(/\bat\s+\S+\s+\(.*:\d+:\d+\)/);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("POST /api/runs answers 201 with a run or a typed dependency failure envelope", async ({
  request
}) => {
  const response = await request.post("/api/runs", {
    data: {
      location: "Crosby Street, SoHo, Manhattan, New York",
      coordinates: { lat: 40.724, lon: -73.999 },
      radius: 1,
      objective: "Judge-path run creation contract check",
      presetId: "social"
    }
  });

  const status = response.status();
  expect([201, 502, 503]).toContain(status);

  const body = (await response.json()) as {
    run?: { id?: unknown };
    error?: { code?: unknown; message?: unknown; requestId?: unknown };
  };
  if (status === 201) {
    expect(typeof body.run?.id).toBe("string");
  } else {
    expect(body.error?.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(typeof body.error?.message).toBe("string");
    expect(typeof body.error?.requestId).toBe("string");
  }
});

test("unknown client route /run/does-not-exist still serves the SPA (SPA fallback)", async ({
  page
}) => {
  const response = await page.goto("/run/does-not-exist");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Zorq" })).toBeVisible();
  await expect(
    page.getByText("This investigation no longer exists on the server. Start again from the home page.")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new investigation" })).toBeVisible();

  const rendered = await page.locator("body").innerText();
  expect(rendered).not.toContain("Phase 6 will build this screen");
  expect(rendered).not.toContain("Run id:");
  expect(rendered).not.toContain("undefined");
  expect(rendered).not.toContain("Cannot GET");
  expect(rendered).not.toMatch(/\bError:/);
});
