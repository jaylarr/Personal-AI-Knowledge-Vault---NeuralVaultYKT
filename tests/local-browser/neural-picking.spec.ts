import { expect, test } from "@playwright/test";
import { ready, root } from "./neural-helpers.js";

test("point picking, double focus and dragging from a node do not duplicate traces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/graph?view=all");
  await ready(page, 6);
  const label = page.locator("[data-label-id]").filter({ visible: true }).first();
  const p = await label.evaluate((el) => {
    const t = new DOMMatrix((el as HTMLElement).style.transform),
      stage = el.parentElement?.getBoundingClientRect();
    if (!stage) throw Error("stage");
    return { x: stage.x + t.e, y: stage.y + t.f, title: el.textContent };
  });
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.locator(".neural-inspector h2")).toHaveText(p.title ?? "");
  await expect(root(page)).toHaveAttribute("data-trace", "1");
  await page.waitForTimeout(750);
  const selected = page.locator(".neural-labels .is-selected");
  const point = await selected.evaluate((el) => {
    const t = new DOMMatrix((el as HTMLElement).style.transform),
      stage = el.parentElement?.getBoundingClientRect();
    if (!stage) throw Error("stage");
    return { x: stage.x + t.e, y: stage.y + t.f };
  });
  const before = await root(page).getAttribute("data-camera");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  const samples: string[] = [];
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(point.x + i * 5, point.y + i);
    await page.waitForTimeout(17);
    samples.push((await root(page).getAttribute("data-camera")) ?? "");
  }
  expect(new Set(samples).size).toBeGreaterThan(12);
  await page.mouse.up();
  expect(await root(page).getAttribute("data-camera")).not.toBe(before);
  await expect(root(page)).toHaveAttribute("data-trace", "1");
});
