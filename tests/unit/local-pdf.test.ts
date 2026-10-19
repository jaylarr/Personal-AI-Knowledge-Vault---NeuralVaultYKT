import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createLocalVault } from "@atlas/core/local-vault";
import {
  extractPdf,
  createLocalStore,
  createSourceService,
  versionData,
  sourceData,
  sha256,
} from "@atlas/core/local-domain";

it("extracts bounded PDF text/page citations and honestly reports unsupported inputs", async () => {
  const fixture = (name: string) => readFile(resolve("tests/fixtures/pdfs", name));
  const result = await extractPdf(await fixture("text.pdf"));
  expect(result.status).toBe("pdf_text");
  expect(result.text).toContain("stable_identifier");
  expect(result.page_ranges).toHaveLength(2);
  for (const page of result.page_ranges)
    expect(Array.from(result.text).slice(page.start, page.end).join("")).toContain(
      page.page === 1 ? "page one" : "Page two",
    );
  expect((await extractPdf(await fixture("empty.pdf"))).status).toBe("ocr_required");
  expect((await extractPdf(await fixture("encrypted.pdf"))).status).toBe("password_unsupported");
  expect((await extractPdf(await fixture("over-pages.pdf"))).status).toBe("page_limit_unsupported");
  await expect(extractPdf(Buffer.from("%PDF-malformed"))).rejects.toMatchObject({
    code: "PDF_EXTRACTION_FAILED",
  });
  await expect(extractPdf(Buffer.alloc(20971521))).rejects.toMatchObject({
    code: "PDF_INPUT_INVALID",
  });
}, 30000);

it("preserves the byte-exact PDF and immutable capture version while adding extracted evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-domain-pdf-"));
  try {
    const store = createLocalStore(createLocalVault(root, "fixture")),
      sources = createSourceService(store),
      bytes = await readFile(resolve("tests/fixtures/pdfs/text.pdf")),
      saved = await sources.capture(
        { kind: "owner", id: "fixture-owner" },
        { request_key: randomUUID(), title: "Fictional PDF source", input_type: "pdf" },
        {
          bytes,
          extension: "pdf",
          media_type: "application/pdf",
          text: "",
          extraction_status: "stored_attachment",
        },
      );
    await sources.processJob(String(saved.job_id));
    const c = await store.catalog(),
      source = sourceData(c, String(saved.source_id)),
      v = versionData(c, source.current_version_id),
      original = versionData(c, String(saved.version_id));
    expect(source.current_version_id).not.toBe(saved.version_id);
    expect(original.text).toBe("");
    expect(v.predecessor_version_id).toBe(original.id);
    expect(v.page_ranges).toHaveLength(2);
    expect(v.raw_sha256).toBe(sha256(bytes));
    expect(await store.read(v.original_path)).toEqual(bytes);
    expect(source.extraction_status).toBe("pdf_text");
    expect(source.processing_state).toBe("captured");
  } finally {
    if (root.startsWith(join(tmpdir(), "atlas-domain-pdf-")))
      await rm(root, { recursive: true, force: true });
  }
}, 30000);
