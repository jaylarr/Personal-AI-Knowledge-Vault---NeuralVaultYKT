# Decisions

## ADR-001 — Existing agents provide inference (2026-10-16)

Problem: avoid a separate AI-provider API for a personal vault. Options considered in planning: provider-backed worker or existing connected agents. Choice: existing owner-authorized agents through local MCP; deterministic worker only. No model SDK/keys/embeddings/billing. Tradeoff: saved sources await an active capable authorized agent. Impacts all organization and retrieval steps.

## ADR-002 — Local API and dedicated Neon backend (2026-10-16)

Problem: persistent personal knowledge with local agent access. Choice: loopback Hono plus a new ATLAS Neon Singapore project, managed Auth/private S3 storage; preserve original sources. Alternatives: Supabase / hosted API, superseded by owner choices. Tradeoff: cloud persistence requires Internet and local API must run. Cloud setup remains gated. Impacts S03–S09/E01–E02.

## ADR-003 — SQL isolation and reviewed memory (2026-10-16)

Problem: prevent unauthorized knowledge disclosure and fabricated facts. Choice: same-client principal transactions, RLS, narrow ACL helpers, source-evidence audience intersection, reviewed memory history. Tradeoff: additional schema/policy/testing work. No browser DB or administrative application connection. Impacts S05–S23.

## ADR-004 — Lexical and stored-graph retrieval first (2026-10-16)

Problem: compact durable context without embeddings. Choice: PostgreSQL simple full-text, exact identifiers, trigram, approved aliases and real stored edges. Tradeoff: less semantic recall; label mode truthfully and evaluate it. Impacts S12/S18–S20.

## ADR-005 — Source-first deterministic jobs and scoped agent tasks (2026-10-16)

Problem: preserve originals and recover interrupted organization without broad private sharing. Choice: immutable versions, deterministic chunk/index jobs, explicit version/agent grants, fenced leases, atomic validated submissions and owner review. Tradeoff: explicit sharing and task resumption. Impacts S09–S17/S21.
