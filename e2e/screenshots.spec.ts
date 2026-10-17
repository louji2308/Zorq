/*
 * Opt-in screenshot capture for the submission gallery (Final Design §11 "Submission gallery").
 * Run: ZORQ_CAPTURE=1 npx playwright test e2e/screenshots.spec.ts
 *
 * Honesty rule: these screenshots capture real product surfaces only — the S0 brief
 * (no cultural data yet) and the /method page (authored content). Screens that show
 * Qloo-derived measurements are captured from a live run with real keys, never from
 * test fixtures, so the gallery can never present fixture data as live evidence.
 */
import { expect, test } from "@playwright/test";

const CAPTURE = process.env.ZORQ_CAPTURE === "1";
const SIZES = [
  { name: "1440", width: 1440, height: 900 },
  { name: "360", width: 360, height: 800 }
] as const;

test.skip(!CAPTURE, "screenshot capture is opt-in: ZORQ_CAPTURE=1 npx playwright test e2e/screenshots.spec.ts");

for (const size of SIZES) {
  test(`capture S0 brief at ${size.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Zorq" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Try a site" })).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/s0-brief-${size.name}.png`,
      fullPage: true
    });
  });

  test(`capture /method at ${size.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/method");
    await expect(page.getByRole("heading", { level: 1, name: "How Zorq measures" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Measured by Qloo" })).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/method-${size.name}.png`,
      fullPage: true
    });
  });
}
