import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { z } from "@atlas/contracts";
import { pdfResultSchema } from "./parsers/pdf.js";

// Only byte-backed text extraction is used. No rendering, annotation/action
// execution, document URL, password collection, XFA, OCR, or auxiliary fetching.
globalThis.fetch = async () => {
  throw Error("PDF_NETWORK_DISABLED");
};
class NoExternalData {
  async fetch() {
    throw Error("PDF_AUXILIARY_DATA_DISABLED");
  }
}
process.once("message", async (input) => {
  try {
    const bytes = z
      .instanceof(Uint8Array)
      .parse(z.object({ bytes: z.unknown() }).parse(input).bytes);
    if (bytes.length > 20971520) throw Error("Raw limit");
    const loading = getDocument({
      data: new Uint8Array(bytes),
      verbosity: 0,
      enableXfa: false,
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: false,
      useWasm: false,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      stopAtErrors: true,
      BinaryDataFactory: NoExternalData,
      maxImageSize: 0,
    });
    loading.onPassword = () => {
      process.send?.(
        pdfResultSchema.parse({ text: "", status: "password_unsupported", page_ranges: [] }),
      );
      void loading.destroy();
    };
    const doc = await loading.promise;
    if (doc.numPages > 200) {
      process.send?.(
        pdfResultSchema.parse({ text: "", status: "page_limit_unsupported", page_ranges: [] }),
      );
      await loading.destroy();
      return;
    }
    let text = "",
      offset = 0;
    const page_ranges: { page: number; start: number; end: number }[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const loaded = await doc.getPage(page),
        content = await loaded.getTextContent({ disableNormalization: false });
      let pageText = "";
      for (const item of content.items)
        if ("str" in item) {
          pageText += item.str;
          if (item.hasEOL) pageText += "\n";
          else pageText += " ";
        }
      pageText = pageText.replace(/\r\n?/g, "\n").trim() + "\n";
      if (page > 1) {
        text += "\n";
        offset++;
      }
      const start = offset;
      text += pageText;
      offset += Array.from(pageText).length;
      page_ranges.push({ page, start, end: offset });
      loaded.cleanup();
      if (Buffer.byteLength(text) > 2097152) throw Error("Extracted limit");
    }
    await loading.destroy();
    process.send?.(
      pdfResultSchema.parse({
        text,
        status: text.trim() ? "pdf_text" : "ocr_required",
        page_ranges,
      }),
    );
  } catch {
    process.exitCode = 1;
    process.disconnect?.();
  }
});
