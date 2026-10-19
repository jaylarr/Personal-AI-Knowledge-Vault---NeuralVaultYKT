import { expect, test } from "@playwright/test";
import { ready, root } from "./neural-helpers.js";

test("graph inherits the original shell across routes and mobile navigation remains labelled", async ({
  page,
}) => {
  for (const width of [1440, 1024, 768, 390, 320, 300]) {
    await page.setViewportSize({ width, height: 900 });
    let baseline: unknown;
    for (const route of ["/", "/inbox", "/setup", "/graph?view=all"]) {
      await page.goto(route);
      await expect(page.locator(".sidebar")).toBeVisible();
      const appearance = await page.evaluate(() => {
        const read = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) throw Error(selector);
          const s = getComputedStyle(el);
          return {
            width: s.width,
            background: s.backgroundColor,
            font: s.fontFamily,
            padding: s.padding,
            border: s.borderColor,
          };
        };
        return { sidebar: read(".sidebar"), header: read(".topbar") };
      });
      if (!baseline) baseline = appearance;
      else expect(appearance).toEqual(baseline);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await expect(page.getByRole("heading", { name: "Your knowledge graph" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh files" })).toBeVisible();
    await expect(page.locator(".sidebar .nav-item span").first()).toBeVisible();
  }
});

for (const dpr of [1, 2])
  for (const quality of ["high", "medium", "low"] as const) {
    test(`full-resolution ${quality} buffers at DPR ${dpr}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await page.goto("http://localhost:4320/");
      await page.evaluate(
        (q) => localStorage.setItem("atlas-neural-settings", JSON.stringify({ quality: q })),
        quality,
      );
      await page.goto("http://localhost:4320/graph?view=all");
      await ready(page, 6);
      const expected = Math.min(dpr, quality === "high" ? 2 : quality === "medium" ? 1.5 : 1);
      await expect(root(page)).toHaveAttribute("data-effective-dpr", String(expected));
      const actual = await root(page).evaluate((el) => ({
        bufferW: Number((el as HTMLElement).dataset.bufferWidth),
        bufferH: Number((el as HTMLElement).dataset.bufferHeight),
        composerW: Number((el as HTMLElement).dataset.composerWidth),
        composerH: Number((el as HTMLElement).dataset.composerHeight),
        samples: Number((el as HTMLElement).dataset.composerSamples),
      }));
      const box = await page.locator("canvas").boundingBox();
      if (!box) throw Error("canvas");
      expect(Math.abs(actual.bufferW - box.width * expected)).toBeLessThanOrEqual(1);
      expect(Math.abs(actual.bufferH - box.height * expected)).toBeLessThanOrEqual(1);
      if (quality !== "low") {
        expect(actual.composerW).toBe(actual.bufferW);
        expect(actual.composerH).toBe(actual.bufferH);
        expect(actual.samples).toBeLessThanOrEqual(quality === "high" ? 4 : 2);
      } else expect(actual.composerW).toBe(0);
      await page.screenshot({ path: `.artifacts/local-browser/g04-${quality}-dpr${dpr}.png` });
      await context.close();
    });
  }
