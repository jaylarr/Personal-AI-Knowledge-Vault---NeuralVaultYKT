import { expect, test } from "@playwright/test";
import { ready, root, searchSelect } from "./neural-helpers.js";

test("responsive controls, expanded pane and inspector at narrow widths", async ({ page }) => {
  for (const width of [768, 390, 320, 300]) {
    await page.setViewportSize({ width, height: width === 300 ? 565 : 844 });
    await page.goto("/graph?view=all");
    await ready(page, 6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Expand graph", exact: true }).click();
    await expect(root(page)).toHaveClass(/is-expanded/);
    const stage = await page.locator(".neural-stage").boundingBox();
    expect(stage?.height).toBeGreaterThan(350);
    for (const button of await page
      .locator(".neural-controls button")
      .filter({ visible: true })
      .all()) {
      const b = await button.boundingBox();
      if (!b) throw Error("control");
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      if (width < 480) expect(b.width).toBeGreaterThanOrEqual(44);
    }
    await searchSelect(page, "Beta evidence");
    const inspector = await page.locator(".neural-inspector").boundingBox();
    expect(inspector?.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `.artifacts/local-browser/neural-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(root(page)).not.toHaveClass(/is-expanded/);
    await expect(page.getByRole("button", { name: "Expand graph", exact: true })).toBeFocused();
  }
});
test("camera and type filters survive reload while corrupt saved view state recovers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/graph?view=all");
  await ready(page, 6);
  await page.getByRole("button", { name: "Pause animation", exact: true }).click();
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw Error("Missing canvas");
  await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height * 0.7, {
    steps: 20,
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Filter categories", exact: true }).click();
  await page.getByLabel("Graph item type", { exact: true }).selectOption("project");
  await expect(
    page.locator(".neural-labels").getByText("Beta evidence", { exact: true }),
  ).not.toBeVisible();
  const before = (await root(page).getAttribute("data-camera"))!.split(",").map(Number);
  await page.reload();
  await ready(page, 6);
  const after = (await root(page).getAttribute("data-camera"))!.split(",").map(Number);
  expect(Math.hypot(...before.map((value, i) => value - after[i]!))).toBeLessThan(0.5);
  await page.getByRole("button", { name: "Filter categories", exact: true }).click();
  await expect(page.getByLabel("Graph item type", { exact: true })).toHaveValue("project");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("atlas-view:")) localStorage.setItem(key, "corrupt view");
  });
  // Navigate after corrupting with a fresh document to avoid the normal pagehide
  // writer repairing the test input before it can exercise the parser.
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("atlas-view:")) localStorage.setItem(key, "corrupt view");
  });
  await page.reload();
  await ready(page, 6);
  await page.getByRole("button", { name: "Filter categories", exact: true }).click();
  await expect(page.getByLabel("Graph item type", { exact: true })).toHaveValue("all");
});

test("native touch orbit, pinch and toolbar taps", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4320/graph?view=all");
  await ready(page, 6);
  const b = await page.locator("canvas").boundingBox();
  if (!b) throw Error("canvas");
  const x = b.x + 100,
    y = b.y + b.height * 0.45,
    session = await context.newCDPSession(page);
  const initial = await root(page).getAttribute("data-camera");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 0 }],
  });
  for (let i = 1; i <= 8; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + i * 9, y: y + i * 2, id: 0 }],
    });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => root(page).getAttribute("data-camera")).not.toBe(initial);
  const before = await root(page).getAttribute("data-camera");
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x, y, id: 0 },
      { x: x + 70, y, id: 1 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 20, y, id: 0 },
      { x: x + 100, y, id: 1 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => root(page).getAttribute("data-camera")).not.toBe(before);
  await page.getByRole("button", { name: "Pause animation", exact: true }).tap();
  await expect(root(page)).toHaveAttribute("data-motion", "paused");
  await page.getByRole("searchbox", { name: "Search knowledge graph" }).fill("Beta evidence");
  await page.locator(".neural-results li button").first().tap();
  await expect(page.locator(".neural-inspector h2")).toHaveText("Beta evidence");
  await context.close();
});
