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

test("GET / renders the React SPA shell with the Home placeholder and no error markers", async ({
  page
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Zorq" })).toBeVisible();
  await expect(page.getByText("Phase 6 will build this screen")).toBeVisible();

  const rendered = await page.locator("body").innerText();
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
