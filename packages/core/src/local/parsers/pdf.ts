import { fork, execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { z } from "@atlas/contracts";
import { DomainError } from "../transactions.js";

export const pdfResultSchema = z
  .object({
    text: z.string(),
    status: z.enum(["pdf_text", "ocr_required", "password_unsupported", "page_limit_unsupported"]),
    page_ranges: z
      .array(
        z.object({
          page: z.number().int().positive(),
          start: z.number().int().nonnegative(),
          end: z.number().int().nonnegative(),
        }),
      )
      .max(200),
  })
  .strict();
export type PdfResult = z.infer<typeof pdfResultSchema>;
export async function extractPdf(bytes: Uint8Array): Promise<PdfResult> {
  if (bytes.length > 20971520 || !Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from("%PDF-")))
    throw new DomainError("PDF_INPUT_INVALID", 415);
  return new Promise((resolve, reject) => {
    const child = fork(new URL("../pdf-worker.js", import.meta.url), [], {
      execArgv: ["--max-old-space-size=256", "--disallow-code-generation-from-strings"],
      serialization: "advanced",
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
      env: {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
        TEMP: process.env.TEMP ?? "",
        TMP: process.env.TMP ?? "",
      },
    });
    let settled = false,
      monitoring = false;
    const finish = (error?: Error, result?: PdfResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearInterval(monitor);
      child.kill();
      if (error) reject(error);
      else if (result) resolve(result);
    };
    const deadline = setTimeout(() => finish(new DomainError("PDF_TIMEOUT", 413)), 30000);
    const monitor = setInterval(() => {
      if (monitoring || !child.pid) return;
      monitoring = true;
      if (process.platform === "win32")
        execFile(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `(Get-Process -Id ${child.pid} -ErrorAction Stop).WorkingSet64`,
          ],
          { windowsHide: true, timeout: 2000, maxBuffer: 1024 },
          (error, stdout) => {
            monitoring = false;
            if (!error && Number(stdout.trim()) > 536870912)
              finish(new DomainError("PDF_MEMORY_LIMIT", 413));
          },
        );
      else
        void readFile(`/proc/${child.pid}/status`, "utf8")
          .then((raw) => {
            const kb = Number(/^VmRSS:\s+(\d+)/m.exec(raw)?.[1] ?? 0);
            if (kb * 1024 > 536870912) finish(new DomainError("PDF_MEMORY_LIMIT", 413));
          })
          .catch(() => {})
          .finally(() => {
            monitoring = false;
          });
    }, 1000);
    child.once("error", () => finish(new DomainError("PDF_PROCESS_FAILED", 503)));
    child.once("exit", () => {
      if (!settled) finish(new DomainError("PDF_EXTRACTION_FAILED", 415));
    });
    child.once("message", (message) => {
      try {
        const result = pdfResultSchema.parse(message);
        if (Buffer.byteLength(result.text) > 2097152) throw Error("Text limit");
        const points = Array.from(result.text).length;
        let end = 0;
        for (const page of result.page_ranges) {
          if (page.start < end || page.end < page.start || page.end > points)
            throw Error("Page range invalid");
          end = page.end;
        }
        finish(undefined, result);
      } catch {
        finish(new DomainError("PDF_EXTRACTION_FAILED", 415));
      }
    });
    child.send({ bytes }, (error) => {
      if (error) finish(new DomainError("PDF_PROCESS_FAILED", 503));
    });
  });
}
