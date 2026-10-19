import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Offline foundation tests never contact managed Auth; real integration is test:neon.
  await page.route(
    (url) => url.hostname.includes(".neonauth."),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      }),
  );
});

test("shows truthful setup status, navigates and protects domain routes", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your knowledge workspace" })).toBeVisible();
  await expect(
    page.getByText("Connect the dedicated Neon database", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No knowledge has been loaded into this installation."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inbox", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  expect((await request.get("/ready")).status()).toBe(503);
  expect((await request.get("/api/v1/projects")).status()).toBe(401);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [320, 740],
  [1280, 600],
]) {
  test(`setup reflows at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width ?? 390, height: height ?? 844 });
    await page.goto("/");
    await expect(
      page.getByText("Connect the dedicated Neon database", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `.artifacts/foundation-${width}x${height}.png`, fullPage: true });
  });
}

test("keyboard skip link, enlarged text and reduced motion remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your knowledge workspace", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  await page.screenshot({ path: ".artifacts/foundation-200-percent.png", fullPage: true });
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter(
        (element) =>
          element.getBoundingClientRect().right > window.innerWidth + 1 && !element.closest("nav"),
      )
      .map((element) => `${element.tagName}.${element.className}`),
  );
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole("heading", { name: "Connect your knowledge vault" })).toBeVisible();
});
