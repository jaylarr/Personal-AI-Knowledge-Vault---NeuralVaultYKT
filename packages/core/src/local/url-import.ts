import { lookup } from "node:dns/promises";
import { Worker } from "node:worker_threads";
import { request } from "node:https";
import { checkServerIdentity } from "node:tls";
import { isIP } from "node:net";
import { createBrotliDecompress, createUnzip } from "node:zlib";
import ipaddr from "ipaddr.js";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { DomainError } from "./transactions.js";
import { normalized } from "./sources.js";

export function isPublicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    if (parsed.range() !== "unicast") return false;
    const denied =
      parsed.kind() === "ipv4"
        ? ["192.0.0.0/24", "192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24"]
        : ["2001::/23", "2001:db8::/32"];
    if (parsed.kind() === "ipv6" && !parsed.match(ipaddr.parseCIDR("2000::/3"))) return false;
    return !denied.some((cidr) => parsed.match(ipaddr.parseCIDR(cidr)));
  } catch {
    return false;
  }
}
export function validateImportUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DomainError("INVALID_URL", 400);
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    url.hash ||
    isIP(host.replace(/^\[|\]$/g, "")) ||
    !host.includes(".") ||
    host.endsWith(".") ||
    /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|onion)$/.test(host)
  )
    throw new DomainError("URL_NOT_PUBLIC_HTTPS", 400);
  return url;
}
export function htmlToText(html: string) {
  const tree = parse(html),
    nodes: DefaultTreeAdapterMap["node"][] = [];
  const stack: { node: DefaultTreeAdapterMap["node"]; depth: number }[] = [
    { node: tree, depth: 0 },
  ];
  while (stack.length) {
    const next = stack.pop()!;
    if (next.depth > 128 || nodes.length >= 20000)
      throw new DomainError("HTML_STRUCTURE_LIMIT", 413);
    nodes.push(next.node);
    if ("childNodes" in next.node)
      for (const node of [...next.node.childNodes].reverse())
        stack.push({ node, depth: next.depth + 1 });
  }
  const root =
    nodes.find((n) => "tagName" in n && n.tagName === "main") ??
    nodes.find((n) => "tagName" in n && n.tagName === "article") ??
    nodes.find((n) => "tagName" in n && n.tagName === "body") ??
    tree;
  const skip = new Set(["script", "style", "nav", "form", "template", "head", "iframe", "object"]);
  function text(n: DefaultTreeAdapterMap["node"]): string {
    if ("tagName" in n && skip.has(n.tagName)) return "";
    if ("value" in n) return n.value;
    const inner = "childNodes" in n ? n.childNodes.map(text).join("") : "";
    if (!("tagName" in n)) return inner;
    if (/^h[1-6]$/.test(n.tagName)) return `\n\n${"#".repeat(Number(n.tagName[1]))} ${inner}\n\n`;
    if (n.tagName === "pre") return `\n\n\`\`\`\n${inner}\n\`\`\`\n\n`;
    if (["p", "div", "section", "article", "main", "li", "br", "tr"].includes(n.tagName))
      return `\n${inner}\n`;
    return inner;
  }
  const result = text(root)
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (Buffer.byteLength(result) > 2097152) throw new DomainError("URL_TEXT_TOO_LARGE", 413);
  return result;
}
export async function fetchPublicUrl(value: string) {
  let url = validateImportUrl(value);
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  const redirects: string[] = [];
  try {
    for (let hop = 0; hop <= 3; hop++) {
      const addresses = await Promise.race([
        lookup(url.hostname, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) =>
          controller.signal.addEventListener(
            "abort",
            () => reject(new DomainError("URL_TIMEOUT", 503)),
            { once: true },
          ),
        ),
      ]);
      if (controller.signal.aborted) throw new DomainError("URL_TIMEOUT", 503);
      if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
        throw new DomainError("URL_ADDRESS_DENIED", 400);
      const pinned = addresses.find((a) => a.family === 4) ?? addresses[0];
      if (!pinned) throw new DomainError("URL_ADDRESS_DENIED", 400);
      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const req = request(
          {
            hostname: pinned.address,
            servername: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: "GET",
            agent: false,
            signal: controller.signal,
            checkServerIdentity: (_host, cert) => checkServerIdentity(url.hostname, cert),
            headers: {
              Host: url.host,
              Accept: "text/html,text/plain,text/markdown",
              "Accept-Encoding": "identity",
              "User-Agent": "ATLAS-Local-Importer/1",
            },
          },
          resolve,
        );
        const connect = setTimeout(() => req.destroy(new Error("CONNECT_TIMEOUT")), 5000);
        req.once("socket", (socket) =>
          socket.once("secureConnect", () => {
            clearTimeout(connect);
            if (
              !socket.remoteAddress ||
              ipaddr.process(socket.remoteAddress).toNormalizedString() !==
                ipaddr.process(pinned.address).toNormalizedString()
            )
              req.destroy(new Error("ADDRESS_CHANGED"));
          }),
        );
        req.once("error", (error) => {
          clearTimeout(connect);
          reject(error);
        });
        req.end();
      });
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        const location = response.headers.location;
        response.destroy();
        if (!location || hop === 3) throw new DomainError("URL_REDIRECT_LIMIT", 400);
        url = validateImportUrl(new URL(location, url).href);
        redirects.push(url.href);
        continue;
      }
      if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
        response.destroy();
        throw new DomainError("URL_HTTP_FAILURE", 400);
      }
      const media = (response.headers["content-type"] ?? "").split(";")[0]?.toLowerCase() ?? "";
      if (!["text/html", "text/plain", "text/markdown"].includes(media)) {
        response.destroy();
        throw new DomainError("URL_MEDIA_UNSUPPORTED", 415);
      }
      const encoding = response.headers["content-encoding"] ?? "identity";
      if (!["identity", "gzip", "deflate", "br"].includes(encoding)) {
        response.destroy();
        throw new DomainError("URL_ENCODING_UNSUPPORTED", 415);
      }
      let rawBytes = 0,
        total = 0;
      const raw: Buffer[] = [],
        decoded: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        rawBytes += chunk.length;
        if (rawBytes > 2097152) response.destroy(new Error("URL_BODY_LIMIT"));
        else raw.push(Buffer.from(chunk));
      });
      const stream =
        encoding === "identity"
          ? response
          : response.pipe(encoding === "br" ? createBrotliDecompress() : createUnzip());
      response.on("error", (error) => {
        if (stream !== response) stream.destroy(error);
      });
      const abort = () => stream.destroy(new Error("URL_TIMEOUT"));
      controller.signal.addEventListener("abort", abort, { once: true });
      try {
        for await (const chunk of stream) {
          const bytes = Buffer.from(chunk as Uint8Array);
          total += bytes.length;
          if (total > 2097152 || total > Math.max(65536, rawBytes * 20)) {
            response.destroy();
            stream.destroy();
            throw new DomainError("URL_BODY_LIMIT", 413);
          }
          decoded.push(bytes);
        }
      } finally {
        controller.signal.removeEventListener("abort", abort);
        response.destroy();
      }
      const content = normalized(Buffer.concat(decoded));
      return {
        bytes: Buffer.concat(raw),
        media_type: media,
        extension: media === "text/html" ? "html" : "txt",
        text: media === "text/html" ? await boundedHtml(content, controller.signal) : content,
        final_url: url.href,
        redirects,
        content_encoding: encoding,
      };
    }
    throw new DomainError("URL_REDIRECT_LIMIT", 400);
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError("URL_FETCH_FAILED", 503);
  } finally {
    clearTimeout(timer);
  }
}
function boundedHtml(content: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./html-worker.js", import.meta.url), {
      workerData: content,
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    let settled = false;
    const finish = (error?: Error, text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      void worker.terminate();
      if (error) reject(error);
      else if (text !== undefined) resolve(text);
    };
    const abort = () => finish(new DomainError("URL_TIMEOUT", 503)),
      timer = setTimeout(abort, 5000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    worker.once("message", (value) => {
      if (typeof value !== "string" || Buffer.byteLength(value) > 2097152)
        finish(new DomainError("HTML_TEXT_LIMIT", 413));
      else finish(undefined, value);
    });
    worker.once("error", () => finish(new DomainError("HTML_PARSE_FAILED", 415)));
    worker.once("exit", (code) => {
      if (!settled) finish(new DomainError(code ? "HTML_PARSE_FAILED" : "HTML_NO_OUTPUT", 415));
    });
  });
}
