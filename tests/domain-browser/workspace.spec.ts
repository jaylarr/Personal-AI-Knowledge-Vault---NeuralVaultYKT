import { expect, test } from "@playwright/test";

test("conversation capture exposes the supported JSON file input", async ({ page }) => {
  await page.goto("/sources");
  await page.getByText("Add source material", { exact: true }).click();
  await page
    .getByLabel("Capture method", { exact: true })
    .selectOption({ label: "Select conversation turns (supported JSON)" });
  const input = page.getByLabel("File to preserve", { exact: true });
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute("type", "file");
  await expect(input).toHaveAttribute("accept", ".json");
  await page.screenshot({
    path: ".artifacts/domain-browser/conversation-capture.png",
    fullPage: true,
  });
});

test("owner captures, edits, reloads and downloads exact source bytes without an AI agent", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("/sources");
  await page.getByText("Add source material", { exact: true }).click();
  await page.getByLabel("Source title", { exact: true }).fill("Controlled offline brief");
  await page
    .getByLabel("Source text", { exact: true })
    .fill("The fictional clinic uses exact_identifier for its offline records. 🧠\n");
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Controlled offline brief", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".domain-detail .file-kind")).toContainText("captured", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Edit as a new version", exact: true }).click();
  const edited = "A revised fictional brief preserves exact_identifier and Unicode 🧠.\n";
  await page.getByLabel("New version text", { exact: true }).fill(edited);
  await page.getByRole("button", { name: "Save new version", exact: true }).click();
  await expect(page.locator(".domain-source-text")).toHaveText(edited);
  await expect(page.locator(".domain-detail header")).toContainText("Version 2");
  const href = await page
    .getByRole("link", { name: "Download exact original", exact: true })
    .getAttribute("href");
  if (!href) throw Error("Missing original download");
  const original = await page.request.get(href);
  expect(await original.text()).toBe(edited);
  await page.reload();
  await expect(page.locator(".domain-source-text")).toHaveText(edited);
  const sourceId = href.split("/sources/")[1]?.split("/")[0];
  if (!sourceId) throw Error("Missing source ID");
  await page.goto(`/graph?view=all&note=${sourceId}`);
  await expect(page.getByRole("complementary", { name: "Knowledge inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await expect(page.locator(".domain-source-text")).toHaveText(edited);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".artifacts/domain-browser/source-mobile.png", fullPage: true });
});

for (const width of [1440, 1024, 768, 390, 320, 300])
  test(`local owner routes remain accessible at ${width}px`, async ({ page }) => {
    const heights: Record<number, number> = {
      1440: 900,
      1024: 768,
      768: 1024,
      390: 844,
      320: 700,
      300: 565,
    };
    await page.setViewportSize({ width, height: heights[width] ?? 900 });
    for (const route of [
      "/sources",
      "/inbox",
      "/review",
      "/search",
      "/agents",
      "/organization",
      "/activity",
      "/backup",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByLabel("Local source workspace", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    if (width === 1440) {
      await page.goto("/sources");
      await expect(
        page.getByRole("region", { name: "Local source workspace", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: ".artifacts/domain-browser/sources-desktop.png",
        fullPage: true,
      });
    }
  });

test("owner explicitly changes processing defaults and persists them across reload", async ({
  page,
}) => {
  await page.goto("/agents");
  const setting = page.getByRole("checkbox", {
    name: "Apply high-confidence collection suggestions automatically",
  });
  await expect(setting).not.toBeChecked();
  await setting.check();
  await page.getByRole("button", { name: "Save processing defaults", exact: true }).click();
  await expect(page.getByText("Processing defaults saved locally.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(setting).toBeChecked();
  await setting.uncheck();
  await page.getByRole("button", { name: "Save processing defaults", exact: true }).click();
  await expect(page.getByText("Processing defaults saved locally.", { exact: true })).toBeVisible();
});

test("narrow workspace retains enlarged text and keyboard capture with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/sources");
  await page.route("**/controlled-text-size.css", (route) =>
    route.fulfill({ contentType: "text/css", body: "html { font-size: 200% !important; }" }),
  );
  await page.addStyleTag({ url: "/controlled-text-size.css" });
  const capture = page.locator("summary").filter({ hasText: "Add source material" });
  await capture.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Source title", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Source title", { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".artifacts/domain-browser/source-enlarged.png", fullPage: true });
});

test("owner checks exact evidence, approves, and searches the reviewed fact", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: "Fictional storage proposal", exact: false }).click();
  await page.getByRole("button", { name: "Inspect exact evidence", exact: false }).click();
  await expect(page.locator("mark")).toContainText("SQLite");
  await expect(page.getByText("Original hash matches", { exact: false })).toBeVisible();
  await page
    .getByLabel("Review reason", { exact: true })
    .fill("Checked the supplied fictional source span and its original hash.");
  await page.getByRole("button", { name: "Approve checked evidence", exact: true }).click();
  await expect(
    page.locator(".domain-split").getByText("memory · active", { exact: true }),
  ).toBeVisible();
  await page.goto("/search");
  await page
    .getByRole("searchbox", { name: "Search knowledge", exact: true })
    .fill("Fictional storage proposal");
  await page.getByRole("button", { name: "Search local knowledge", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional storage proposal", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inspect this retrieval trace", exact: true }).click();
  await expect(page.getByText("Recorded results in rank order.", { exact: false })).toBeVisible();
  await page.screenshot({ path: ".artifacts/domain-browser/reviewed-search.png", fullPage: true });
  await page
    .locator("article.domain-panel")
    .filter({ has: page.getByRole("heading", { name: "Fictional storage proposal", exact: true }) })
    .getByRole("link", { name: "Show this recorded item in the graph", exact: true })
    .click();
  await expect(page.locator(".neural-inspector h2")).toHaveText("Fictional storage proposal");
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await expect(page.getByLabel("Review reason", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Inspect exact evidence", exact: false }).click();
  await expect(page.locator("mark")).toContainText("SQLite");
});
test("search UI follows bounded continuation responses without replacing earlier results", async ({
  page,
}) => {
  await page.goto("/search");
  const response = await page.request.post("/api/v1/local/domain/retrieval", {
    data: { query: "", token_budget: 8192 },
  });
  expect(response.ok()).toBe(true);
  const packet = await response.json();
  const first = packet.items[0],
    second = packet.items[1];
  if (!first || !second) throw Error("Missing controlled local result fixtures");
  let followed = false;
  await page.route("**/api/v1/local/domain/retrieval", async (route) => {
    const next = route.request().postDataJSON().continuation === "controlled-ui-next";
    followed ||= next;
    await route.fulfill({
      json: {
        ...packet,
        items: [next ? second : first],
        has_more: !next,
        continuation: next ? null : "controlled-ui-next",
      },
    });
  });
  await page
    .getByRole("searchbox", { name: "Search knowledge", exact: true })
    .fill("Controlled pagination");
  await page.getByRole("button", { name: "Search local knowledge", exact: true }).click();
  await expect(page.getByRole("heading", { name: first.title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more matching results", exact: true }).click();
  await expect(page.getByRole("heading", { name: second.title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: first.title, exact: true })).toBeVisible();
  expect(followed).toBe(true);
  await expect(
    page.getByRole("button", { name: "Load more matching results", exact: true }),
  ).toHaveCount(0);
});

test("verified backup and isolated restore finish through owner controls", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/backup");
  await page.getByRole("button", { name: "Create verified local backup", exact: true }).click();
  await expect(page.getByText("manifest verified", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Restore into an isolated new folder", exact: true })
    .click();
  await expect(
    page.getByText("Restore complete; credentials disabled.", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("PDF import retains originals and exposes extracted version metadata", async ({ page }) => {
  test.setTimeout(45000);
  await page.goto("/sources");
  await page.getByText("Add source material", { exact: true }).click();
  await page.getByLabel("Source title", { exact: true }).fill("Controlled PDF source");
  await page.getByLabel("Capture method", { exact: true }).selectOption("file");
  await page
    .getByLabel("File to preserve", { exact: true })
    .setInputFiles("tests/fixtures/pdfs/text.pdf");
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Controlled PDF source", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".domain-source-text")).toContainText("stable_identifier", {
    timeout: 20000,
  });
  await expect(page.locator(".domain-detail header")).toContainText("pdf text");
  await expect(page.getByLabel("Source version history").locator("option")).toHaveCount(2);
  await page.getByLabel("Source version history").selectOption({ index: 1 });
  await expect(page.getByText("Historical version.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit as a new version", exact: true }),
  ).toBeDisabled();
});
