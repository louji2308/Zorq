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
});

test("unknown client route /run/does-not-exist still serves the SPA (SPA fallback)", async ({
  page
}) => {
  const response = await page.goto("/run/does-not-exist");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Zorq" })).toBeVisible();
  await expect(page.getByText("Run id: does-not-exist")).toBeVisible();

  const rendered = await page.locator("body").innerText();
  expect(rendered).not.toContain("Phase 6 will build this screen");
  expect(rendered).not.toContain("Cannot GET");
  expect(rendered).not.toMatch(/\bError:/);
});
