import { expect, test } from "@playwright/test";
test("local signed owner: organization persistence, mobile reflow and sign-out clearing", async ({
  page,
  request,
}) => {
  const fixture = (await (await request.get("/fixture/session")).json()) as {
    token: string;
    authOrigin: string;
  };
  let signedIn = true;
  await page.route(`${fixture.authOrigin}/**`, async (route) => {
    if (route.request().url().includes("/sign-out")) {
      signedIn = false;
      return route.fulfill({ json: { success: true } });
    }
    if (route.request().url().includes("/get-session"))
      return route.fulfill({
        headers: { "content-type": "application/json", "set-auth-jwt": fixture.token },
        body: JSON.stringify(
          signedIn
            ? {
                session: {
                  id: "fixture-session",
                  token: fixture.token,
                  expiresAt: new Date(Date.now() + 3600000).toISOString(),
                  userId: "fixture-user",
                },
                user: {
                  id: "fixture-user",
                  email: "owner@example.invalid",
                  name: "Fixture owner",
                  emailVerified: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              }
            : null,
        ),
      });
    return route.abort();
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Knowledge organization" })).toBeVisible();
  await page.getByRole("button", { name: "Agent-first browser project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved by your agents" })).toBeVisible();
  await page.getByText("Automatic knowledge is visible", { exact: false }).click();
  await expect(
    page.getByText("Observed in this controlled local fixture:", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: ".artifacts/owner-browser/agent-knowledge-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".artifacts/owner-browser/agent-knowledge-mobile.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Browser clinic");
  await page.getByLabel("Project slug").fill("browser-clinic");
  await page.getByLabel("Description").fill("Persistent local project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Browser clinic", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Browser clinic", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Browser clinic", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit project Browser clinic" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Renamed clinic");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Renamed clinic", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New collection", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Browser notes");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "· Browser notes", exact: true })).toBeVisible();
  await page.screenshot({ path: ".artifacts/owner-browser/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".artifacts/owner-browser/mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("region", { name: "Knowledge organization" })).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("disabled owner loses displayed organization on refresh, without showing cached private rows", async ({
  page,
  request,
}) => {
  const fixture = (await (await request.get("/fixture/session")).json()) as {
    token: string;
    authOrigin: string;
  };
  await page.route(`${fixture.authOrigin}/**`, (route) =>
    route.fulfill({
      headers: { "content-type": "application/json", "set-auth-jwt": fixture.token },
      body: JSON.stringify({
        session: {
          id: "fixture-session",
          token: fixture.token,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        user: { id: "fixture-user", email: "owner@example.invalid" },
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Knowledge organization" })).toBeVisible();
  await request.post("/fixture/owner/disable");
  try {
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(page.getByRole("region", { name: "Knowledge organization" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Renamed clinic", exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText("Workspace could not be loaded");
  } finally {
    await request.post("/fixture/owner/enable");
  }
});
