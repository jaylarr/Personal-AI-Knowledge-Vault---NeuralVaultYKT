import { describe, expect, it } from "vitest";
import {
  collectionSeedSchema,
  evidenceSchema,
  memoryCandidateSchema,
  organizationBatchSchema,
} from "@atlas/contracts";
import { randomUUID } from "node:crypto";

describe("browser-safe source-backed contracts", () => {
  it("rejects empty/reversed/fractional evidence spans and malformed hashes", () => {
    const base = {
      source_version_id: randomUUID(),
      start_offset: 0,
      end_offset: 5,
      quote_sha256: "0".repeat(64),
    };
    expect(evidenceSchema.safeParse(base).success).toBe(true);
    for (const bad of [
      { ...base, end_offset: 0 },
      { ...base, start_offset: 5 },
      { ...base, end_offset: 2.5 },
      { ...base, quote_sha256: "invalid" },
    ])
      expect(evidenceSchema.safeParse(bad).success).toBe(false);
  });
  it("requires source evidence and rejects privileged fields on submitted memories", () => {
    const base = {
      type: "semantic",
      title: "Fact",
      subject_key: "test",
      summary: "Source-backed fact",
      structured_content: {},
      claim_kind: "explicit_fact",
      confidence: 0.9,
      evidence: [
        {
          source_version_id: randomUUID(),
          start_offset: 0,
          end_offset: 3,
          quote_sha256: "0".repeat(64),
        },
      ],
    };
    expect(memoryCandidateSchema.safeParse(base).success).toBe(true);
    expect(memoryCandidateSchema.safeParse({ ...base, status: "active" }).success).toBe(false);
    expect(memoryCandidateSchema.safeParse({ ...base, evidence: [] }).success).toBe(false);
    expect(memoryCandidateSchema.safeParse({ ...base, confidence: 1.1 }).success).toBe(false);
  });
  it("enforces batch limits and rejects duplicate or forged task fields", () => {
    const base = {
      source_version_id: randomUUID(),
      expected_source_revision: 1,
      contract_version: 1,
      batch_index: 0,
      chunk_ids: [randomUUID()],
      allowed_collection_ids: [],
    };
    expect(organizationBatchSchema.safeParse(base).success).toBe(true);
    expect(
      organizationBatchSchema.safeParse({ ...base, chunk_ids: Array(21).fill(randomUUID()) })
        .success,
    ).toBe(false);
    expect(
      organizationBatchSchema.safeParse({
        ...base,
        chunk_ids: [base.chunk_ids[0], base.chunk_ids[0]],
      }).success,
    ).toBe(false);
    expect(organizationBatchSchema.safeParse({ ...base, agent_id: randomUUID() }).success).toBe(
      false,
    );
  });
  it("rejects empty seed names rather than silently altering the source tree", () => {
    expect(
      collectionSeedSchema.safeParse([{ key: "family-1", name: "", children: [] }]).success,
    ).toBe(false);
  });
});
