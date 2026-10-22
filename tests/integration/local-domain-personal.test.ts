import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
it("new personal records do not escape through legacy snapshot or reviewed general context", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-personal-http-")),
    token = `atlas_${randomBytes(32).toString("base64url")}`,
    local = createLocalServices(root, { agentId: "legacy", token }),
    owner = { kind: "owner" as const, id: "owner" };
  try {
    await local.domain.auth.bootstrap();
    await local.personal.policy.update(owner, {
      policy: { enabled: true },
      expected_revision: 0,
      request_key: randomUUID(),
    });
    const confirmation = await local.personal.policy.confirmation(owner, {
      request_key: randomUUID(),
      concept_key: "workflow.private",
      statement: "The fictional owner confirms this personal working preference.",
      summary: "The fictional owner prefers private workflow details to remain scoped.",
      applies_when: "Using this synthetic personal privacy fixture.",
      exceptions: [],
    });
    await local.personal.capture(owner, {
      title: "Private fixture subject",
      kind: "decision",
      request_key: randomUUID(),
      markdown: "The fictional owner prefers private workflow details to remain scoped.",
      provenance: { paths: [], verification: "Explicit owner fixture confirmation." },
      owner_confirmation_id: confirmation.id,
      knowledge: {
        type: "preference",
        scope: "owner",
        key: "workflow.private",
        summary: "The fictional owner prefers private workflow details to remain scoped.",
        applies_when: "Using this synthetic personal privacy fixture.",
        topics: ["workflow"],
        basis: "owner_explicit",
        source_statement: "The fictional owner confirms this personal working preference.",
      },
    });
    const id = randomUUID();
    await local.domain.store.transaction(owner, randomUUID(), { id }, () => ({
      mutations: [
        {
          kind: "personal_candidate",
          entity_id: id,
          expected_revision: 0,
          data: { status: "proposed", claim: "Do not leak candidate sentinel" },
          body: "Do not leak candidate sentinel",
        },
      ],
      result: { id },
    }));
    await local.vault.writeExclusive(
      "Owner/SkillSources/fixture/source/SKILL.md",
      "# Private backed up skill sentinel\n",
    );
    const app = createApp(
      loadConfig({ NODE_ENV: "test", API_PORT: "4323" }),
      undefined,
      undefined,
      local,
    );
    const legacy = await app.request("http://localhost:4323/api/v1/local/vault", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(legacy.status).toBe(200);
    const text = await legacy.text();
    expect(text).not.toContain("candidate sentinel");
    expect(text).not.toContain("Private fixture subject");
    expect(text).not.toContain("Private backed up skill sentinel");
    const denied = await app.request("http://localhost:4323/api/v1/agent/personal/context", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(denied.status).toBe(403);
    const ownerView = await app.request("http://localhost:4323/api/v1/local/personal/profile", {
      headers: { Cookie: `atlas_local=${local.cookie}` },
    });
    expect(ownerView.status).toBe(200);
    expect(await ownerView.text()).toContain("Private fixture subject");
    const cross = await app.request("http://localhost:4323/api/v1/local/personal/profile", {
      headers: { Origin: "https://attacker.example", Cookie: `atlas_local=${local.cookie}` },
    });
    expect(cross.status).toBe(403);
  } finally {
    local.domain.close();
    await rm(root, { recursive: true, force: true });
  }
});
