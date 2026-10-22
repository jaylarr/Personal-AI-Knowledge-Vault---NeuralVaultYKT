import { expect, test } from "@playwright/test";
test("personal search supports keyboard input and enlarged text at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/personal");
  await page.getByLabel("Find a personal subject", { exact: true }).focus();
  await page.keyboard.type("evidence");
  await expect(
    page.getByRole("heading", { name: "Concise progress with evidence", exact: true }),
  ).toBeVisible();
  const fontSizes = await page.locator(".personal-workspace *").evaluateAll((elements) =>
    elements.map((element, index) => {
      element.setAttribute("data-enlargement-fixture", String(index));
      return { index, size: Number.parseFloat(getComputedStyle(element).fontSize) };
    }),
  );
  const before = await page
    .locator(".personal-subject p")
    .first()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  await page.route("**/__personal-enlarged.css", (route) =>
    route.fulfill({
      contentType: "text/css",
      body: fontSizes
        .map(
          ({ index, size }) =>
            `[data-enlargement-fixture="${index}"] { font-size: ${size * 2}px !important; }`,
        )
        .join("\n"),
    }),
  );
  await page.addStyleTag({ url: "/__personal-enlarged.css" });
  expect(
    await page
      .locator(".personal-subject p")
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(before * 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: ".artifacts/personal-memory-execution-2026-10-22/personal-320-enlarged.png",
    fullPage: true,
  });
});
for (const width of [1440, 390, 320])
  test(`personal context, skills and scoped coverage at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [route, heading] of [
      ["/personal", "How you work"],
      ["/skills", "Reusable skills"],
      ["/coverage", "Session coverage"],
      ["/personal/review", "Unconfirmed patterns"],
    ]) {
      await page.goto(route!);
      await expect(page.getByRole("heading", { name: heading!, exact: true })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `.artifacts/personal-memory-execution-2026-10-22/${route!.replaceAll("/", "-")}-${width}.png`,
        fullPage: true,
      });
    }
  });
test("owner confirms an edited candidate and can stop using it", async ({ page }) => {
  await page.goto("/personal/review");
  await page.getByRole("button", { name: "Review and confirm", exact: true }).click();
  await page
    .getByLabel("Preference summary", { exact: true })
    .fill("Use compact comparisons when the fictional owner is choosing between options.");
  await page
    .getByLabel("When it applies", { exact: true })
    .fill("When this fictional owner asks to compare several options.");
  await page
    .getByLabel("Exceptions, one per line", { exact: true })
    .fill("Use prose when only one option matters.");
  await page
    .getByLabel("Your confirmation in your own words", { exact: true })
    .fill(
      "For this fictional fixture, I prefer compact comparisons when choosing between options.",
    );
  const [saved] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/personal/candidates/") &&
        response.url().endsWith("/decision") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save explicit preference", exact: true }).click(),
  ]);
  expect(saved.ok()).toBe(true);
  await expect(page.getByText("No unconfirmed patterns to review.")).toBeVisible();
  await page.goto("/personal");
  const subject = page
    .locator(".personal-subject")
    .filter({ has: page.getByRole("heading", { name: "Compact comparisons", exact: true }) });
  await expect(subject).toContainText("Use prose when only one option matters.");
  await subject.getByRole("button", { name: "Stop using", exact: true }).click();
  await subject.getByRole("button", { name: "Confirm stop using", exact: true }).click();
  await expect(subject).toHaveCount(0);
});
