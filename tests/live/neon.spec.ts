import { randomBytes, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { expect, test } from "@playwright/test";
import { createPool, inTransaction } from "@atlas/core";

test("real Neon signup, session restore, sign-in/out, JWT, persistence and RLS", async ({
  page,
  request,
}) => {
  const env = parseEnv(await readFile(".env.local", "utf8"));
  const target = JSON.parse(await readFile("docs/neon-target.json", "utf8"));
  expect(env.DATABASE_TARGET_ID).toBe(
    `${target.projectId}:${target.branchId}:${target.databaseName}`,
  );
  let existing: { email: string; password: string } | undefined;
  try {
    existing = JSON.parse(await readFile(".local/neon-test-user.json", "utf8"));
  } catch {
    /* First verification creates one synthetic identity. */
  }
  const email = existing?.email ?? `atlas-setup-${randomUUID()}@example.invalid`;
  const password = existing?.password ?? `A!${randomBytes(24).toString("base64url")}`;
  // Synthetic credentials stay only in ignored local configuration for explicit test reruns.
  await mkdir(".local", { recursive: true });
  await writeFile(".local/neon-test-user.json", JSON.stringify({ email, password }), {
    mode: 0o600,
  });
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.name));
  await page.goto("/");
  await expect(page.getByText("PostgreSQL: connected · Auth: connected")).toBeVisible({
    timeout: 15000,
  });
  expect((await request.get("/api/v1/auth/check")).status()).toBe(401);
  expect(
    (
      await request.get("/api/v1/auth/check", {
        headers: { Authorization: "Bearer invalid-synthetic-token" },
      })
    ).status(),
  ).toBe(401);
  if (!existing) await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: existing ? "Sign in" : "Create account", exact: true })
    .click();
  await expect(page.getByTestId("signed-in-user")).toHaveText(email, { timeout: 20000 });
  const authenticatedRequest = page.waitForRequest(
    (req) => req.url().endsWith("/api/v1/auth/check") && req.method() === "POST",
    { timeout: 20000 },
  );
  await page.getByRole("button", { name: "Test database connection", exact: true }).click();
  const authorization = (await authenticatedRequest).headers().authorization;
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authenticated request missing token");
  const token = authorization.slice(7);
  await expect(page.getByTestId("verification-receipt")).toBeVisible({ timeout: 20000 });
  const first = await request.get("/api/v1/auth/check", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(first.status()).toBe(200);
  const body = (await first.json()) as { receipt: { id: string }; vault_access: string };
  expect(body.vault_access).toBe("setup_required");
  expect(body.receipt.id).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByTestId("signed-in-user")).toHaveText(email);
  const afterReload = await request.get("/api/v1/auth/check", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await afterReload.json()).receipt.id).toBe(body.receipt.id);
  // A separate real pooled connection proves committed persistence, then wrong/missing identity denial.
  const database = createPool(env.ATLAS_DATABASE_URL ?? "", "atlas-neon-live-test");
  const directUrl = new URL(env.DATABASE_URL_UNPOOLED ?? "");
  directUrl.searchParams.set("sslmode", "verify-full");
  const direct = createPool(directUrl.href, "atlas-neon-auth-profile-verification");
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    const identity = { issuer: new URL(target.authBaseUrl).origin, subject: payload.sub as string };
    const read = (issuer: string, subject: string) =>
      inTransaction(database, async (client) => {
        await client.query(
          "SELECT set_config('app.auth_issuer',$1,true),set_config('app.auth_subject',$2,true)",
          [issuer, subject],
        );
        return client.query("SELECT check_id FROM atlas_setup.auth_checks WHERE check_id=$1", [
          body.receipt.id,
        ]);
      });
    expect((await read(identity.issuer, identity.subject)).rows[0]?.check_id).toBe(body.receipt.id);
    expect((await read(identity.issuer, "different-synthetic-subject")).rowCount).toBe(0);
    expect((await database.query("SELECT check_id FROM atlas_setup.auth_checks")).rowCount).toBe(0);
    const profile = await direct.query('SELECT id FROM neon_auth."user" WHERE email=$1', [email]);
    expect(profile.rowCount).toBe(1);
    expect(String(profile.rows[0].id)).toBe(identity.subject);
    const flags = await database.query(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
    );
    expect(flags.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  } finally {
    await Promise.all([database.end(), direct.end()]);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("signed-in-user")).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(`${password}-wrong`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Authentication failed. Check your details or email verification requirements."),
  ).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("signed-in-user")).toHaveText(email, { timeout: 15000 });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
  await page.screenshot({ path: ".artifacts/neon-connected-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: ".artifacts/neon-connected-mobile.png", fullPage: true });
  await writeFile(
    ".artifacts/neon-live-result.json",
    JSON.stringify(
      {
        project: target.projectId,
        branch: target.branchName,
        database: "passed",
        auth: "passed",
        signup: true,
        signIn: true,
        signOut: true,
        reload: true,
        jwtVerification: true,
        persistenceAcrossConnections: true,
        crossIdentityDenial: true,
        unauthenticatedDenial: true,
        authProfileInPostgres: true,
        elevatedRuntimeRole: false,
        emailDelivery: "disabled by existing Auth configuration",
      },
      null,
      2,
    ),
  );
});
