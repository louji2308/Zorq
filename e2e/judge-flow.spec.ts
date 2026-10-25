import { expect, test, type Page } from "@playwright/test";
import {
  JUDGE_ATTACK_ORDER,
  JUDGE_COMPOSE_TITLE,
  JUDGE_INVENTED_CITATION,
  judgeChallengeAndCompose,
  startJudgeFixtureServer,
  type JudgeFixtureServer,
  type JudgeLlmOptions
} from "../tests/support/judgePipeline.js";

interface ErrorGuard {
  consoleErrors: string[];
  pageErrors: string[];
}

function attachErrorGuard(page: Page): ErrorGuard {
  const guard: ErrorGuard = { consoleErrors: [], pageErrors: [] };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().startsWith("Failed to load resource")) return;
    guard.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    guard.pageErrors.push(error.message);
  });
  return guard;
}

async function withFixture(
  run: (server: JudgeFixtureServer) => Promise<void>,
  options: JudgeLlmOptions = {}
): Promise<void> {
  const server = await startJudgeFixtureServer({ nodeEnv: "production", ...options });
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

async function gotoRun(page: Page, server: JudgeFixtureServer): Promise<void> {
  await page.goto(`${server.baseUrl}/run/${server.runId}`);
  await expect(page.getByText("Investigation complete", { exact: true })).toBeVisible();
}

async function openCompositions(page: Page): Promise<void> {
  await expect(page.locator('section[aria-label="Agent Ledger"]')).toBeVisible();
  await expect(page.locator('section[aria-label="Frozen Prior"]')).toBeVisible();
  await page.getByRole("button", { name: "See compositions", exact: true }).click();
  await expect(page.locator('section[aria-label="Compositions"]')).toBeVisible();
}

async function openConnections(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Show the graph", exact: true }).click();
  await expect(page.locator('section[aria-label="Connections"]')).toBeVisible();
}

function expectHonestRenderedText(rendered: string): void {
  expect(rendered).not.toContain("undefined");
  expect(rendered).not.toMatch(/\bError:/);
  expect(rendered).not.toMatch(/\bat\s+\S+\s+\(.*:\d+:\d+\)/);
  expect(rendered).not.toMatch(/\becosystem\b/i);
}

test("S1 ledger and frozen Prior lead to S2 where the dial re-ranks without new measurement", async ({
  page
}) => {
  const guard = attachErrorGuard(page);
  await withFixture(async (server) => {
    await gotoRun(page, server);

    await expect(page.getByText("Williamsburg, Brooklyn, NY")).toBeVisible();
    await expect(page.locator('section[aria-label="Agent Ledger"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "What Zorq is doing" })).toBeVisible();
    await expect(page.locator('section[aria-label="Frozen Prior"]')).toBeVisible();

    await page.getByRole("button", { name: "See compositions", exact: true }).click();
    await expect(page.locator('section[aria-label="Compositions"]')).toBeVisible();
    await expect(page.getByText("The evidence moved 3 of 5 components.")).toBeVisible();
    await expect(page.getByText(/The field holds 50 valid combinations/)).toBeVisible();
    await expect(page.getByRole("article", { name: "Prior composition, before looking" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Composition A, grade B" })).toBeVisible();

    const apiRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/") && !url.includes("/events")) {
        apiRequests.push(url);
      }
    });

    const dial = page.locator("#s2-dial");
    await dial.focus();
    await page.keyboard.press("End");
    await expect(dial).toHaveAttribute("aria-valuetext", "1.00");
    await page.waitForTimeout(400);
    expect(apiRequests).toEqual([]);

    await expect(
      page.getByText("no new measurement happens here", { exact: false })
    ).toBeVisible();

    const rendered = await page.locator("body").innerText();
    expectHonestRenderedText(rendered);

    expect(guard.consoleErrors).toEqual([]);
    expect(guard.pageErrors).toEqual([]);
  });
});

test("S3 pair drawer shows the claim, Qloo pill, ranked shared entities, and lookup links back to the ledger", async ({
  page
}) => {
  const guard = attachErrorGuard(page);
  await withFixture(async (server) => {
    await gotoRun(page, server);
    await openCompositions(page);
    await openConnections(page);

    await page.getByRole("button", { name: "Distance chart", exact: true }).click();
    await expect(page.locator("#s3-pairs-heading")).toHaveText("Every pair, closest first");

    await page.getByRole("button", { name: "Comp court tree ↔ Comp devocion" }).click();
    const drawer = page.locator('aside[aria-label="Evidence"]');
    await expect(drawer).toBeVisible();

    const claim = drawer.locator(".s3-claim");
    await expect(claim).toHaveText(
      "Audiences of Court Tree Roasters and Devoción both over-index on La Colombe, Kim Gordon, Alice Coltrane."
    );

    await expect(drawer.locator(".s3-provenance")).toHaveText("Qloo");

    const tiles = drawer.locator(".s3-tile");
    await expect(tiles).toHaveCount(3);
    const tileNames = await drawer.locator(".s3-tile-name").allInnerTexts();
    expect(tileNames.sort()).toEqual(["Alice Coltrane", "Kim Gordon", "La Colombe"]);
    const tileRanks = await drawer.locator(".s3-tile-rank").allInnerTexts();
    expect(tileRanks).toEqual(["#1", "#2", "#3"]);

    await expect(drawer.locator(".s3-tri-sentence")).toHaveText(
      "Direct check not recorded for this pair."
    );
    await expect(drawer.getByText("How this was computed:", { exact: false })).toBeVisible();
    await expect(drawer.getByText("IDF-weighted taste neighborhoods")).toBeVisible();

    await expect(drawer.getByText("See the lookups", { exact: true })).toBeVisible();
    const lookup = drawer.locator(".s3-link").first();
    await expect(lookup).not.toBeEmpty();
    await lookup.click();
    await expect(page.locator('section[aria-label="Agent Ledger"]')).toBeVisible();

    const rendered = await page.locator("body").innerText();
    expectHonestRenderedText(rendered);

    expect(guard.consoleErrors).toEqual([]);
    expect(guard.pageErrors).toEqual([]);
  });
});

test.describe("narrow viewport", () => {
  test.use({ viewport: { width: 900, height: 800 } });

  test("S3 defaults to the distance chart below 1200px", async ({ page }) => {
    const guard = attachErrorGuard(page);
    await withFixture(async (server) => {
      await gotoRun(page, server);
      await openCompositions(page);
      await openConnections(page);

      await expect(page.locator("#s3-pairs-heading")).toHaveText("Every pair, closest first");
      await expect(page.getByRole("button", { name: "Distance chart" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await expect(page.getByRole("button", { name: "Map of meaning" })).toHaveAttribute(
        "aria-pressed",
        "false"
      );

      const rendered = await page.locator("body").innerText();
      expectHonestRenderedText(rendered);

      expect(guard.consoleErrors).toEqual([]);
      expect(guard.pageErrors).toEqual([]);
    });
  });
});

test("S4 challenge runs five attacks and reports the agent's order without inventing a verdict", async ({
  page
}) => {
  const guard = attachErrorGuard(page);
  await withFixture(
    async (server) => {
      await gotoRun(page, server);
      await page.getByRole("button", { name: "Challenge", exact: true }).click();

      const banner = page.locator(".s4-verdict-word");
      await expect(banner).toHaveText("Can the leader be broken?");
      await expect(page.locator(".s4-attack-list li.s4-attack")).toHaveCount(0);
      await expect(page.locator(".s4-attacks .s4-empty")).toBeVisible();

      await page.getByRole("button", { name: "Challenge the plan", exact: true }).click();
      await expect(page.locator(".s4-verdict-word")).not.toHaveText("Can the leader be broken?");
      await expect(banner).not.toHaveText("Can the leader be broken?");

      const rows = page.locator(".s4-attack-list li.s4-attack");
      await expect(rows).toHaveCount(5);

      const names = await page.locator(".s4-attack-name").allInnerTexts();
      // The panel renders the five attacks in spec order; the agent's own order
      // travels in challengeReport (asserted below) and surfaces as the banner
      // source, not as row order.
      expect(names).toEqual([
        "Remove a member",
        "Substitute a member",
        "Bridge the weakest link",
        "Shift the catchment",
        "Check the rival"
      ]);
      await expect(rows.first()).toHaveClass(/is-(measured|skipped|not-completed)/);
      await expect(page.locator(".s4-banner-meta")).toContainText("chosen by the agent");

      const response = (await fetch(`${server.baseUrl}/api/runs/${server.runId}`)) as Response;
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        run?: { challengeReport?: { attackOrder?: string[]; attackOrderSource?: string } | null };
      };
      expect(body.run?.challengeReport?.attackOrderSource).toBe("llm");
      expect(body.run?.challengeReport?.attackOrder).toEqual([...JUDGE_ATTACK_ORDER]);

      const rendered = await page.locator("body").innerText();
      expectHonestRenderedText(rendered);

      expect(guard.consoleErrors).toEqual([]);
      expect(guard.pageErrors).toEqual([]);
    },
    {
      labelLlmResponses: {
        "challenge.attack_order": [judgeChallengeAndCompose],
        "blueprint:compose": [judgeChallengeAndCompose]
      }
    }
  );
});

test("downstream tabs stay disabled until their required run state exists", async ({ page }) => {
  await withFixture(async (server) => {
    await gotoRun(page, server);

    await expect(page.getByRole("button", { name: "Challenge", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Blueprint", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Blueprint", exact: true })).toHaveAttribute(
      "title",
      "Blueprint appears after the plan has been challenged."
    );

    const rendered = await page.locator("body").innerText();
    expectHonestRenderedText(rendered);
  });
});

test("S1 map canvas fills the visible map panel", async ({ page }) => {
  await withFixture(async (server) => {
    await gotoRun(page, server);

    const panel = page.getByRole("region", { name: "Site map" });
    const canvas = panel.locator("canvas");
    await expect(canvas).toHaveCount(1);
    await expect
      .poll(async () => {
        const panelBox = await panel.boundingBox();
        const canvasBox = await canvas.boundingBox();
        if (panelBox === null || canvasBox === null) return Number.NEGATIVE_INFINITY;
        return Math.round(canvasBox.height - panelBox.height);
      })
      .toBeGreaterThanOrEqual(-1);
  });
});

test("S5 blueprint cites stored evidence, drops the invented id, and the share view is read-only", async ({
  page,
  browser
}) => {
  const guard = attachErrorGuard(page);
  await withFixture(
    async (server) => {
      await gotoRun(page, server);
      await page.getByRole("button", { name: "Challenge", exact: true }).click();
      await page.getByRole("button", { name: "Challenge the plan", exact: true }).click();
      await expect(page.locator(".s4-verdict-word")).toHaveText("Revised");

      await page.getByRole("button", { name: "Blueprint", exact: true }).click();
      await expect(page.locator('section[aria-label="Place Blueprint"]')).toBeVisible();

      await expect(page.locator(".s5-title")).toHaveText(JUDGE_COMPOSE_TITLE);
      await expect(page.locator(".s5-source-pill")).toHaveText("LLM");

      const rationale = page.locator(".s5-rationale");
      await expect(rationale).toContainText("The corner plan holds a micro-screening anchor");
      await expect(rationale).not.toContainText(JUDGE_INVENTED_CITATION);
      await expect(rationale).not.toContainText(JUDGE_INVENTED_CITATION.replace("ev-", ""));

      const refs = page.locator(".s5-rationale sup.s5-sup");
      expect(await refs.count()).toBeGreaterThanOrEqual(1);

      const receipts = page.locator(".s5-receipt-list li");
      expect(await receipts.count()).toBeGreaterThan(0);

      await expect(page.locator(".s5-grade-square")).toHaveAttribute("aria-label", /^Evidence grade [A-C]$/);
      await expect(page.locator(".s5-method-link")).toHaveAttribute("href", "/method");

      await page.getByRole("button", { name: "Without Qloo", exact: true }).click();
      const modal = page.locator("#s5-compare-title");
      await expect(modal).toBeVisible();
      await expect(page.locator("#s5-compare-title")).toHaveText("Without Qloo");
      await expect(
        page.locator('section[aria-label="With no cultural evidence"] h3')
      ).toHaveText("What the agent would have recommended with no cultural evidence");
      const priorItems = await page
        .locator('section[aria-label="With no cultural evidence"] li.s5-modal-item')
        .allInnerTexts();
      expect(priorItems).toContain("Devoción");
      expect(priorItems).not.toContain("thesis");
      expect(priorItems).not.toContain("members");
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Share blueprint", exact: true }).click();
      await expect(page.locator(".s5-share-status")).toContainText("Anyone with the link can read this snapshot.");

      await expect(page.getByRole("button", { name: "Copy as Markdown", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Print", exact: true })).toBeVisible();

      const snapshot = await server.store.findBlueprintSnapshot(server.runId);
      expect(snapshot).not.toBeNull();
      const shareUrl = `${server.baseUrl}/run/${server.runId}/blueprint?share=${snapshot?.shareToken ?? ""}`;
      expect(shareUrl).toContain("share=");

      const shareContext = await browser.newContext();
      const sharePage = await shareContext.newPage();
      await sharePage.goto(shareUrl);
      await expect(sharePage.locator(".s5-title")).toHaveText(JUDGE_COMPOSE_TITLE);
      await expect(sharePage.getByRole("button", { name: "Challenge the plan" })).toHaveCount(0);
      await expect(sharePage.locator(".s1-tab")).toHaveCount(0);
      await shareContext.close();

      const rendered = await page.locator("body").innerText();
      expectHonestRenderedText(rendered);

      expect(guard.consoleErrors).toEqual([]);
      expect(guard.pageErrors).toEqual([]);
    },
    {
      labelLlmResponses: {
        "challenge.attack_order": [judgeChallengeAndCompose],
        "blueprint:compose": [judgeChallengeAndCompose]
      }
    }
  );
});

test("S3 replacement records R1, runs the mini challenge, and shows the revision row", async ({
  page
}) => {
  const guard = attachErrorGuard(page);
  await withFixture(async (server) => {
    await gotoRun(page, server);
    await openCompositions(page);
    await openConnections(page);

    await expect(page.getByRole("button", { name: "Map of meaning" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page
      .getByRole("button", { name: "Component Comp court tree, composition C", exact: true })
      .dispatchEvent("click");
    const sheet = page.locator('aside[aria-label="Component sheet"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".s3-sheet-name")).toHaveText("Court Tree Roasters");
    await expect(sheet.getByText("Exemplar places")).toBeVisible();
    await expect(sheet.locator(".s3-sheet-list")).toContainText("Court Tree Roasters");
    await sheet.getByRole("button", { name: "Replace", exact: true }).click();

    const panel = page.locator('aside[aria-label="Replace Court Tree Roasters"]');
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Devoción" }).click();
    await panel.getByRole("button", { name: "Replace with Devoción", exact: true }).click();

    const success = page.locator('aside[aria-label="Replacement recorded"]');
    await expect(success).toBeVisible();
    await expect(success.locator(".s3-replace-verdict")).not.toBeEmpty();
    await expect(success.getByText(/Weakest link becomes: /)).toBeVisible();
    await expect(success.locator(".s3-replace-attack-kind")).toHaveText([
      "Drop-one ablation",
      "Rival weighting"
    ]);

    await expect(success).toBeHidden({ timeout: 5000 });

    await expect(page.locator('button[aria-label="Component Comp court tree, composition C"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Component Comp devocion"]')).toBeVisible();

    await page.getByRole("button", { name: /^C Comp clay/ }).click();
    await page
      .locator('button[aria-label^="Component Comp devocion"]')
      .dispatchEvent("click");
    await expect(sheet.locator(".s3-sheet-name")).toHaveText("Devoción");
    await sheet.getByRole("button", { name: "Replace", exact: true }).click();

    const revisions = page.locator('aside[aria-label="Replace Devoción"]');
    await expect(revisions).toBeVisible();
    await expect(revisions.getByText("Revisions on this run")).toBeVisible();
    const revisionRow = revisions.locator("li.s3-replace-revision");
    await expect(revisionRow).toContainText(/R1: Court Tree Roasters → Devoción \(Anchor\)/);
    await expect(revisionRow).toContainText(/ΔC [+-]/);

    await page.keyboard.press("Escape");
    await expect(revisions).toBeHidden();

    const rendered = await page.locator("body").innerText();
    expectHonestRenderedText(rendered);

    expect(guard.consoleErrors).toEqual([]);
    expect(guard.pageErrors).toEqual([]);
  });
});
