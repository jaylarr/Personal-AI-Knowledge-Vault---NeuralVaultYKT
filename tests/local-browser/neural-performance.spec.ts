import { writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { expect, type Page, test } from "@playwright/test";
import { fixture, ready, root, searchSelect } from "./neural-helpers.js";

async function measure(page: Page, frames = 90) {
  return page.evaluate(async (count) => {
    const times: number[] = [];
    let last = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        times.push(now - last);
        last = now;
        if (times.length >= count) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const sorted = [...times].sort((a, b) => a - b);
    return {
      fps: Number((1000 / (times.reduce((a, b) => a + b, 0) / times.length)).toFixed(1)),
      p95ms: Number((sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1)),
    };
  }, frames);
}
async function resources(page: Page) {
  return root(page).evaluate((el) => ({
    quality: el.getAttribute("data-quality"),
    geometries: Number(el.getAttribute("data-geometries")),
    textures: Number(el.getAttribute("data-textures")),
    programs: Number(el.getAttribute("data-programs")),
    drawCalls: Number(el.getAttribute("data-draw-calls")),
    activePulses: Number(el.getAttribute("data-active-pulses")),
    activeZaps: Number(el.getAttribute("data-active-zaps")),
  }));
}

test("measured 100/500/1500/5000 profiles and bounded repeated effects", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const reports: unknown[] = [];
  for (const count of [100, 500, 1500, 5000]) {
    await page.unroute("**/api/v1/local/vault*");
    const sample = await fixture(page, count, count * 2);
    const start = performance.now();
    await page.goto("/graph?view=all");
    await ready(page, count);
    const readyMs = Math.round(performance.now() - start);
    const layoutMs = await root(page).getAttribute("data-layout-ms");
    await expect(root(page)).toHaveAttribute("data-edge-count", String(sample.edges.length));
    const hardware = await page.evaluate(() => {
      const gl = document.querySelector("canvas")?.getContext("webgl2"),
        debug = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        gpu: gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable",
        logicalProcessors: navigator.hardwareConcurrency,
        dpr: devicePixelRatio,
      };
    });
    const idle = await measure(page),
      base = await resources(page);
    const rect = await page.locator("canvas").boundingBox();
    if (!rect) throw Error("canvas");
    await page.mouse.move(rect.x + rect.width * 0.4, rect.y + rect.height * 0.5);
    await page.mouse.down();
    const camera = await root(page).getAttribute("data-camera");
    const orbitPromise = measure(page);
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(rect.x + rect.width * 0.4 + i * 6, rect.y + rect.height * 0.5 + i);
      await page.waitForTimeout(15);
    }
    const orbit = await orbitPromise;
    expect(await root(page).getAttribute("data-camera")).not.toBe(camera);
    await page.mouse.up();
    await searchSelect(page, "Sample Engineering 2");
    await page.waitForTimeout(700);
    const propagatePromise = measure(page);
    for (let i = 0; i < 12; i++) {
      await page.getByRole("button", { name: "Trace links", exact: true }).click();
      await page.waitForTimeout(80);
    }
    const propagation = await propagatePromise;
    const after = await resources(page);
    expect(after.geometries).toBeLessThanOrEqual(base.geometries);
    expect(after.activePulses).toBeLessThanOrEqual(80);
    expect(after.activeZaps).toBeLessThanOrEqual(10);
    reports.push({
      nodes: count,
      edges: sample.edges.length,
      readyMs,
      layoutMs,
      idle,
      orbit,
      propagation,
      base,
      after,
      hardware,
    });
    if (count === 500)
      await page.screenshot({ path: ".artifacts/local-browser/neural-benchmark-500.png" });
  }
  const report = {
    date: new Date().toISOString(),
    cpu: cpus()[0]?.model,
    browser: browser.version(),
    viewport: { width: 1440, height: 900 },
    notes:
      "Synthetic sample only. readyMs includes 750ms camera settling. FPS from 90 rAF intervals. Headless Edge on this PC; not a cross-device guarantee.",
    profiles: reports,
  };
  await writeFile(
    ".artifacts/local-browser/neural-benchmarks.json",
    JSON.stringify(report, null, 2),
  );
  await testInfo.attach("neural-benchmarks", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
});

test("quality replacements, polling and context remount keep resource counts bounded", async ({
  page,
}) => {
  test.setTimeout(60000);
  await fixture(page, 500, 1000);
  await page.goto("/graph?view=all");
  await ready(page, 500);
  await page.getByRole("button", { name: "Graph settings", exact: true }).click();
  const select = page.getByLabel("Performance quality", { exact: true });
  await select.selectOption("high");
  await page.waitForTimeout(1200);
  const base = await resources(page);
  for (let i = 0; i < 3; i++) {
    await select.selectOption("low");
    await page.waitForTimeout(150);
    await select.selectOption("high");
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1500);
  const after = await resources(page);
  expect(after.geometries).toBe(base.geometries);
  expect(after.textures).toBe(base.textures);
  expect(after.programs).toBeLessThanOrEqual(base.programs + 1);
  await page.getByRole("button", { name: "Close settings", exact: true }).click();
  await page.getByRole("button", { name: "Pause animation", exact: true }).click();
  await page.waitForTimeout(150);
  const before = await root(page).getAttribute("data-graph-time");
  await page.waitForTimeout(4200);
  expect(await root(page).getAttribute("data-graph-time")).toBe(before);
});

test("measured 500-node Auto tier at DPR2", async ({ browser }, testInfo) => {
  test.setTimeout(60000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    await fixture(page, 500, 1000);
    const started = performance.now();
    await page.goto("http://localhost:4320/graph?view=all");
    await ready(page, 500);
    const readyMs = Math.round(performance.now() - started);
    await page.waitForTimeout(3500);
    const rect = await page.locator("canvas").boundingBox();
    if (!rect) throw Error("Missing canvas");
    await page.mouse.move(rect.x + rect.width * 0.4, rect.y + rect.height * 0.5);
    await page.mouse.down();
    const measuring = measure(page, 120);
    for (let i = 0; i < 40; i++) {
      await page.mouse.move(rect.x + rect.width * 0.4 + i * 4, rect.y + rect.height * 0.5 + i);
      await page.waitForTimeout(15);
    }
    const orbit = await measuring;
    await page.mouse.up();
    const report = {
      at: new Date().toISOString(),
      cpu: cpus()[0]?.model,
      browser: browser.version(),
      dpr: 2,
      nodes: 500,
      edges: 1000,
      readyMs,
      orbit,
      resources: await resources(page),
      effectiveDpr: await root(page).getAttribute("data-effective-dpr"),
      note: "Synthetic controlled headless Edge measurement on this PC. Auto may select a lower quality tier.",
    };
    await writeFile(".artifacts/local-browser/neural-dpr2.json", JSON.stringify(report, null, 2));
    await page.screenshot({ path: ".artifacts/local-browser/neural-dpr2.png" });
    await testInfo.attach("neural-dpr2", {
      body: JSON.stringify(report),
      contentType: "application/json",
    });
    expect(orbit.fps).toBeGreaterThanOrEqual(30);
  } finally {
    await context.close();
  }
});
