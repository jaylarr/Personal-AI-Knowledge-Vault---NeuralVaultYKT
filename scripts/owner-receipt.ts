import { z } from "@atlas/contracts";
import type { VerifiedIdentity } from "@atlas/core";

// Setup-only validation of rows read by the administrator from the JWT-verified
// receipt table joined to managed Auth. Never accept these rows from HTTP input.
export function identityFromVerifiedReceipt(
  rows: unknown,
  email: string,
  expectedIssuer: string,
  now = Date.now(),
): VerifiedIdentity {
  const selected = z.email().parse(email);
  if (selected.toLowerCase().endsWith("@example.invalid")) throw Error("Synthetic owner denied");
  const matches = z
    .array(
      z.object({
        email: z.email(),
        issuer: z.url(),
        subject: z.string().min(1),
        auth_user_id: z.string().min(1),
        check_id: z.uuid(),
        checked_at: z.coerce.date(),
      }),
    )
    .length(1)
    .parse(rows);
  const row = matches[0];
  if (
    !row ||
    row.email.toLowerCase() !== selected.toLowerCase() ||
    row.issuer !== expectedIssuer ||
    row.subject !== row.auth_user_id ||
    row.checked_at.getTime() > now ||
    now - row.checked_at.getTime() > 10 * 60 * 1000
  )
    throw Error("Recent verified owner receipt required");
  return { issuer: row.issuer, subject: row.subject };
}
