import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createLocalVault } from "@atlas/core/local-vault";
import { localSourceSchema, localVersionSchema } from "@atlas/contracts";
import {
  createLocalStore,
  createSourceService,
  createRetrieval,
  head,
  versionData,
  sha256,
  type Mutation,
} from "@atlas/core/local-domain";

const suppliedRoot = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const root = suppliedRoot
    ? resolve(suppliedRoot)
    : await mkdtemp(join(tmpdir(), "atlas-domain-performance-")),
  owner = { kind: "owner" as const, id: "performance-fixture" };
if (!root.startsWith(join(tmpdir(), "atlas-domain-performance-")))
  throw Error("Only task-owned performance fixtures are accepted");
let safeFixture = false;
const results: unknown[] = [];
let closeStore = () => {};
try {
  let store = createLocalStore(createLocalVault(root, "fixture"));
  const sources = createSourceService(store);
  let retrieval = createRetrieval(store);
  closeStore = () => store.close();
  let c = await store.catalog();
  if (c.records.some((r) => r.actor.id !== owner.id)) throw Error("Fixture ownership mismatch");
  safeFixture = true;
  if (!c.heads.size) {
    await sources.capture(owner, {
      request_key: randomUUID(),
      title: "Exact fixture 0",
      content: "Controlled lexical fixture 0 uses stable_identifier_0.",
    });
    c = await store.catalog();
  }
  const existing = [...c.heads.values()]
      .filter((r) => r.kind === "source")
      .sort(
        (a, b) => Number(String(a.data.title).slice(14)) - Number(String(b.data.title).slice(14)),
      ),
    template = existing[0];
  if (!template) throw Error("Missing fixture template");
  const templateSource = localSourceSchema.parse(template.data),
    templateVersion = versionData(c, templateSource.current_version_id),
    ids = existing.map((r) => r.entity_id);
  let count = ids.length;
  if (count > 5000) throw Error("Fixture exceeds the supported logical item limit");
  for (const size of process.argv.includes("--measure-existing")
    ? [count]
    : process.argv.includes("--through=100")
      ? [100]
      : process.argv.includes("--through=1000")
        ? [100, 1000]
        : [100, 1000, 5000]) {
    if (size < count) continue;
    while (count < size) {
      const mutations: Mutation[] = [],
        blobs: { path: string; bytes: Uint8Array }[] = [];
      const end = Math.min(size, count + 200);
      for (; count < end; count++) {
        const id = randomUUID(),
          vid = randomUUID(),
          text = `Controlled lexical fixture ${count} uses stable_identifier_${count}.`,
          original_path = `Personal/Attachments/${id}/${vid}/original.txt`,
          now = new Date().toISOString();
        ids.push(id);
        const source = localSourceSchema.parse({
            ...templateSource,
            id,
            title: `Exact fixture ${count}`,
            current_version_id: vid,
            processing_state: "captured",
            created_at: now,
          }),
          version = localVersionSchema.parse({
            ...templateVersion,
            id: vid,
            source_id: id,
            original_path,
            text,
            raw_sha256: sha256(text),
            normalized_sha256: sha256(text),
            byte_count: Buffer.byteLength(text),
            captured_at: now,
          });
        mutations.push(
          {
            kind: "source",
            entity_id: id,
            expected_revision: 0,
            data: source,
            body: `# ${source.title}`,
          },
          { kind: "version", entity_id: vid, expected_revision: 0, data: version, body: text },
        );
        blobs.push({ path: original_path, bytes: Buffer.from(text) });
      }
      await store.transaction(owner, randomUUID(), { fixture_count: count }, () => ({
        mutations,
        blobs,
        result: { count },
      }));
      process.stdout.write(JSON.stringify({ fixture_records_prepared: count }) + "\n");
    }
    store.close();
    store = createLocalStore(createLocalVault(root, "fixture"));
    const coldStarted = performance.now();
    await store.catalog();
    const coldCatalogMs = Math.round(performance.now() - coldStarted);
    retrieval = createRetrieval(store);
    await retrieval.retrieve(owner, { query: "stable_identifier_0", token_budget: 8192 });
    const times: number[] = [];
    let matched = 0,
      rankedFirst = 0;
    for (let i = 0; i < 50; i++) {
      const target = Math.floor((i * (size - 1)) / 49),
        query = i % 2 ? `Exact fixture ${target}` : `stable_identifier_${target}`,
        started = performance.now(),
        packet = await retrieval.retrieve(owner, { query, token_budget: 8192 });
      times.push(performance.now() - started);
      if (packet.items.some((item) => item.id === ids[target])) matched++;
      if (packet.items[0]?.id === ids[target]) rankedFirst++;
      if (i % 10 === 0)
        process.stdout.write(
          JSON.stringify({
            progress: i + 1,
            records: size,
            milliseconds: Math.round(times.at(-1) ?? 0),
            diagnostics: store.diagnostics(),
          }) + "\n",
        );
    }
    let admissionRejected: boolean | null = null;
    if (size === 5000) {
      try {
        await createSourceService(store).capture(owner, {
          request_key: randomUUID(),
          title: "Over-limit controlled fixture",
          content: "This additional source must not be acknowledged.",
        });
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "LOGICAL_ITEM_LIMIT")
          throw error;
        admissionRejected = true;
      }
      if (
        !admissionRejected ||
        [...(await store.catalog()).heads.values()].filter((r) => r.kind === "source").length !==
          5000
      )
        throw Error("Logical item admission did not fail atomically");
    }
    times.sort((a, b) => a - b);
    const result = {
      records: size,
      queries: 50,
      matched,
      ranked_first: rankedFirst,
      admission_overflow_rejected: admissionRejected,
      p50_ms: Math.round(times[24] ?? 0),
      p95_ms: Math.round(times[47] ?? 0),
      max_ms: Math.round(times[49] ?? 0),
      target_p95_ms: 1000,
      cold_catalog_ms: coldCatalogMs,
      diagnostics: store.diagnostics(),
    };
    results.push(result);
    process.stdout.write(JSON.stringify(result) + "\n");
  }
  if (!results.length) throw Error("No selected corpus size was measured");
  const output = resolve(
    process.argv.includes("--measure-existing")
      ? ".artifacts/local-completion/retrieval-interim.json"
      : process.argv.includes("--through=100")
        ? ".artifacts/local-completion/retrieval-small-isolated.json"
        : process.argv.includes("--through=1000")
          ? ".artifacts/local-completion/retrieval-small.json"
          : ".artifacts/local-completion/retrieval-performance.json",
  );
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        fixture:
          "disposable local source corpus, full authorized API-core query including integrity checks and trace publication",
        cold_measure:
          "fresh application store/cache at each corpus size; OS filesystem cache is uncontrolled",
        results,
      },
      null,
      2,
    ),
  );
  if (
    results.some((x) => {
      const r = x as { matched: number; ranked_first: number; p95_ms: number };
      return r.matched !== 50 || r.ranked_first !== 50 || r.p95_ms > 1000;
    })
  )
    process.exitCode = 1;
} finally {
  closeStore();
  if (
    safeFixture &&
    !process.argv.includes("--keep-fixture") &&
    root.startsWith(join(tmpdir(), "atlas-domain-performance-"))
  )
    await rm(root, { recursive: true, force: true });
}
