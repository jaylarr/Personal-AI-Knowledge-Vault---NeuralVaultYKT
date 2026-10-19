import { expect, test } from "@playwright/test";
import { fixture, ready, root, searchSelect } from "./neural-helpers.js";

test("WebGL shaders, sustained orbit, wheel/pan, picking and pause", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/graph?view=all");
  await ready(page, 6);
  const canvas = page.locator("canvas"),
    b = await canvas.boundingBox();
  if (!b) throw Error("canvas");
  const before = await root(page).getAttribute("data-camera");
  await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.42);
  await page.mouse.down();
  const samples: string[] = [];
  for (let i = 0; i < 24; i++) {
    await page.mouse.move(b.x + b.width * 0.45 + i * 8, b.y + b.height * 0.42 + i);
    await page.waitForTimeout(20);
    samples.push((await root(page).getAttribute("data-camera")) ?? "");
  }
  expect(new Set(samples).size).toBeGreaterThan(12);
  await page.mouse.up();
  expect(samples.at(-1)).not.toBe(before);
  expect(new URL(page.url()).searchParams.get("note")).toBeNull();
  const camera = await root(page).getAttribute("data-camera");
  await page.mouse.wheel(0, -220);
  await expect.poll(() => root(page).getAttribute("data-camera")).not.toBe(camera);
  await page.getByRole("button", { name: "Pan graph", exact: true }).click();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const panBefore = await root(page).getAttribute("data-camera");
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 70, b.y + b.height / 2 - 40, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => root(page).getAttribute("data-camera")).not.toBe(panBefore);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(750);
  // Keyboard label activation selects a real file while pointer input remains on the canvas.
  const label = page.locator("[data-node-id]").first();
  await label.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("complementary", { name: "Knowledge inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Pause animation", exact: true }).click();
  await page.waitForTimeout(150);
  const time = await root(page).getAttribute("data-graph-time");
  await page.waitForTimeout(300);
  expect(await root(page).getAttribute("data-graph-time")).toBe(time);
  await page.getByRole("button", { name: "Resume animation", exact: true }).click();
  await expect.poll(() => root(page).getAttribute("data-graph-time")).not.toBe(time);
  await page.screenshot({ path: ".artifacts/local-browser/neural-desktop.png" });
  expect(errors).toEqual([]);
});

test("search, real directed pulse/arrival, filters and stable GPU resources", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/graph?view=all");
  await ready(page, 6);
  await searchSelect(page, "Alpha observed decision");
  await expect(page.locator(".neural-inspector h2")).toHaveText("Alpha observed decision");
  await expect
    .poll(async () => Number(await root(page).getAttribute("data-active-pulses")))
    .toBeGreaterThan(0);
  await page.screenshot({ path: ".artifacts/local-browser/neural-pulse.png" });
  await page.waitForTimeout(1100);
  const geometries = await root(page).getAttribute("data-geometries");
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: "Trace links", exact: true }).click();
    await page.waitForTimeout(40);
    expect(Number(await root(page).getAttribute("data-active-zaps"))).toBeLessThanOrEqual(10);
  }
  expect(await root(page).getAttribute("data-geometries")).toBe(geometries);
  await page.getByRole("button", { name: "Filter categories", exact: true }).click();
  const expandedResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/local/vault") &&
      new URL(response.url()).searchParams.get("depth") === "2",
  );
  await page
    .getByRole("button", { name: "Load two hops around selected item", exact: true })
    .click();
  expect((await expandedResponse).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Two-hop neighborhood loaded", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".neural-inspector h2")).toHaveText("Alpha observed decision");
  await page
    .getByRole("complementary", { name: "Category filters" })
    .getByRole("checkbox", { name: /Controlled Alpha/ })
    .uncheck();
  expect(await root(page).getAttribute("data-geometries")).toBe(geometries);
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  await page.getByRole("button", { name: "Graph settings", exact: true }).click();
  await page.getByLabel("Electric zaps", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Close settings", exact: true }).click();
  await page.getByRole("button", { name: "Trace links", exact: true }).click();
  await page.waitForTimeout(40);
  await expect(root(page)).toHaveAttribute("data-active-zaps", "0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(root(page)).toHaveAttribute("data-motion", "reduced");
  await page.getByRole("button", { name: "Trace links", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-active-pulses", "0");
});

test("empty, single, sparse and dense real-shaped datasets", async ({ page }) => {
  await fixture(page, 0, 0);
  await page.goto("/graph?view=all");
  await ready(page, 0);
  await expect(page.getByText("No files in this view", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/local/vault*");
  await fixture(page, 1, 0);
  await page.reload();
  await ready(page, 1);
  await expect(root(page)).toHaveAttribute("data-edge-count", "0");
  await page.unroute("**/api/v1/local/vault*");
  const g = await fixture(page, 300, 600);
  await page.reload();
  await ready(page, 300);
  await expect(root(page)).toHaveAttribute("data-edge-count", String(g.edges.length));
  await expect(page.locator("[data-node-id]")).toHaveCount(10);
  await page.screenshot({ path: ".artifacts/local-browser/neural-sample-300.png" });
});

test("context loss recovers; WebGL unavailable keeps searchable file access", async ({ page }) => {
  await page.goto("/graph?view=all");
  await ready(page, 6);
  await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const gl = c?.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator(".neural-context-fallback")).toBeVisible();
  await page.getByRole("button", { name: "Retry 3D view", exact: true }).last().click();
  await ready(page, 6);
  await expect(page.locator(".neural-context-fallback")).toHaveCount(0);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).includes("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.reload();
  await expect(page.getByText("3D view is unavailable", { exact: true })).toBeVisible();
  await searchSelect(page, "Beta evidence");
  await expect(page.locator(".neural-inspector h2")).toHaveText("Beta evidence");
});
