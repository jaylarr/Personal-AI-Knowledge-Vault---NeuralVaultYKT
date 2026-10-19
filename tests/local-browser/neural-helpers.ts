import { expect, type Page } from "@playwright/test";
import { type Snapshot, sampleGraph } from "../../apps/web/src/app/neural/model.js";
export const root = (page: Page) => page.locator(".neural-graph");
export async function ready(page: Page, count?: number) {
  // The stress fixture includes worker settling and shader preparation. Record
  // its actual time; a generic 5s locator deadline is not a performance result.
  await expect(page.locator("canvas")).toBeVisible({
    timeout: count !== undefined && count >= 5000 ? 20000 : 5000,
  });
  await expect(root(page)).toHaveAttribute("data-camera", /.+,/);
  if (count !== undefined)
    await expect(root(page)).toHaveAttribute("data-node-count", String(count));
  await page.waitForTimeout(750);
}
export async function fixture(page: Page, n: number, e: number) {
  if (page.url() === "about:blank") await page.goto("/");
  const original = (await (await page.request.get("/api/v1/local/vault")).json()) as Snapshot;
  const template = original.notes[0];
  if (!template) throw Error("Missing fixture template");
  const g = sampleGraph(n, e);
  const notes = g.nodes.map((node, i) => ({
    ...template,
    id: node.id,
    title: `Sample ${node.title}`,
    markdown: node.summary,
    kind: i < 10 ? ("project" as const) : ("note" as const),
    project_id: i < 10 ? null : `sample-${i % 10}`,
    knowledge: null,
    effective_state: "legacy" as const,
    path: `Synthetic/Sample-${i}.md`,
  }));
  await page.route("**/api/v1/local/vault*", (route) =>
    route.fulfill({
      json: {
        ...original,
        vault_root: `${original.vault_root}/controlled-synthetic-${n}-${e}`,
        notes,
        edges: g.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          kind: "markdown",
        })),
      },
    }),
  );
  return g;
}
export async function searchSelect(page: Page, title: string) {
  const input = page.getByRole("searchbox", { name: "Search knowledge graph" });
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByRole("complementary", { name: "Knowledge inspector" })).toBeVisible();
}
