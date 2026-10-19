import { describe, it, expect } from "vitest";
import { identityFromVerifiedReceipt } from "../../scripts/owner-receipt.js";
describe("setup-only server-verified owner receipt", () => {
  const now = Date.now(),
    issuer = "https://auth.fixture.example",
    email = "owner@fixture.example";
  const row = {
    email,
    issuer,
    subject: "owner-subject",
    auth_user_id: "owner-subject",
    check_id: "b34ead26-805e-4ed1-aeea-8a12ff7d5053",
    checked_at: new Date(now - 1000),
  };
  it("accepts one fresh exact identity without receiving a password or token", () => {
    expect(identityFromVerifiedReceipt([row], email, issuer, now)).toEqual({
      issuer,
      subject: row.subject,
    });
  });
  it.each([
    { rows: [] },
    { rows: [row, row] },
    { rows: [{ ...row, issuer: "https://other.example" }] },
    { rows: [{ ...row, auth_user_id: "another" }] },
    { rows: [{ ...row, checked_at: new Date(now - 601000) }] },
    { rows: [{ ...row, checked_at: new Date(now + 1000) }] },
    { rows: [{ ...row, email: "another@fixture.example" }] },
  ])("rejects absent/ambiguous/wrong/stale receipt rows", ({ rows }) => {
    expect(() => identityFromVerifiedReceipt(rows, email, issuer, now)).toThrow();
  });
  it("never promotes synthetic verification accounts", () => {
    expect(() =>
      identityFromVerifiedReceipt(
        [{ ...row, email: "test@example.invalid" }],
        "test@example.invalid",
        issuer,
        now,
      ),
    ).toThrow("Synthetic");
  });
});
