import { expect, test } from "@playwright/test";
import { ready, root, searchSelect } from "./neural-helpers.js";

test("real local file reader, direct edits, reload and zero external requests", async ({
  page,
  request,
}) => {
  const external: string[] = [],
    errors: string[] = [];
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname)) {
      external.push(u.origin);
      return route.abort();
    }
    return route.continue();
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/graph");
  await ready(page, 4);
  await expect(page.getByText("4 files · 3 connections", { exact: true })).toBeVisible();
  await searchSelect(page, "Alpha observed decision");
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await expect(page.locator(".graph-file-panel.is-open .local-note-view h2")).toHaveText(
    "Alpha observed decision",
  );
  await request.post("/fixture/direct-edit");
  await expect(page.locator(".checkpoint-body")).toContainText(
    "Edited directly in Markdown; connected to",
    { timeout: 10000 },
  );
  await expect(page.getByText("Edited directly since capture.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Close file reader", exact: true }).click();
  await page.reload();
  await ready(page, 4);
  await expect(page.locator(".neural-inspector h2")).toHaveText("Alpha observed decision");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("knowledge/activity/all filters retain actual evidence and deep links", async ({ page }) => {
  await page.goto("/graph");
  await ready(page, 4);
  await page.getByLabel("Knowledge view", { exact: true }).selectOption("activity");
  await expect(root(page)).toHaveAttribute("data-node-count", "1");
  await searchSelect(page, "Routine build report");
  await page.reload();
  await ready(page, 1);
  await expect(page.getByLabel("Knowledge view", { exact: true })).toHaveValue("activity");
  await page.getByLabel("Knowledge view", { exact: true }).selectOption("knowledge");
  await expect(root(page)).toHaveAttribute("data-node-count", "4");
  expect(new URL(page.url()).searchParams.has("note")).toBe(true);
  await page.getByLabel("Knowledge view", { exact: true }).selectOption("all");
  await expect(root(page)).toHaveAttribute("data-node-count", "6");
  await searchSelect(page, "Unconfirmed visual preference");
  await expect(page.locator(".neural-evidence")).toContainText("historical report · candidate");
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await expect(
    page.locator(".knowledge-details p").filter({ hasText: "Evidence basis" }),
  ).toHaveText("Evidence basis historical report");
});
test("workspace file search and graph navigation remain account-free", async ({ page }) => {
  await page.goto("/files?view=all");
  await expect(
    page.getByRole("heading", { name: "Your local knowledge vault", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Search local files", exact: true })
    .fill("Beta evidence");
  await expect(page.locator(".local-file-list li")).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Search local files", exact: true })
    .fill("Controlled local evidence from a Markdown file.");
  await expect(page.locator(".local-file-list li")).toHaveCount(1);
  await page.locator(".local-file-list li button").click();
  await expect(page.getByRole("heading", { name: "Beta evidence", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Knowledge graph", exact: true }).click();
  await ready(page, 4);
});
