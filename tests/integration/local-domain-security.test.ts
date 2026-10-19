import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { beforeEach, it, expect, vi } from "vitest";
import type { RequestOptions } from "node:https";
import type { IncomingMessage } from "node:http";
import type { DetailedPeerCertificate } from "node:tls";

const mocks = vi.hoisted(() => ({ dns: vi.fn(), https: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.dns }));
vi.mock("node:https", () => ({ request: mocks.https }));
import { fetchPublicUrl } from "@atlas/core/local-domain";
type Reply = { status: number; headers: Record<string, string>; bytes: Buffer; remote?: string };
let replies: Reply[], requests: RequestOptions[];
beforeEach(() => {
  replies = [];
  requests = [];
  mocks.dns.mockReset();
  mocks.https.mockReset();
  mocks.dns.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  mocks.https.mockImplementation(
    (options: RequestOptions, callback: (r: IncomingMessage) => void) => {
      requests.push(options);
      const reply = replies.shift();
      if (!reply) throw Error("Unplanned external request");
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error: Error) => void;
      };
      let destroyed = false;
      req.destroy = (error) => {
        destroyed = true;
        queueMicrotask(() => req.emit("error", error));
      };
      req.end = () =>
        queueMicrotask(() => {
          const socket = new EventEmitter() as EventEmitter & { remoteAddress: string };
          socket.remoteAddress = reply.remote ?? "8.8.8.8";
          req.emit("socket", socket);
          socket.emit("secureConnect");
          if (destroyed) return;
          const response = Readable.from([reply.bytes]) as unknown as IncomingMessage;
          response.statusCode = reply.status;
          response.headers = reply.headers;
          callback(response);
        });
      return req;
    },
  );
});
it("rejects mixed public/private DNS before opening any socket", async () => {
  mocks.dns.mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ]);
  await expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
    code: "URL_ADDRESS_DENIED",
  });
  expect(requests).toEqual([]);
});
it("pins the numeric address with original TLS/Host identity and revalidates every redirect", async () => {
  const raw = gzipSync(
    Buffer.from(
      "<main><h1>Fictional source</h1><p>Stable_identifier.</p><script>never()</script></main>",
    ),
  );
  replies.push(
    { status: 302, headers: { location: "https://next.example/article" }, bytes: Buffer.alloc(0) },
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" },
      bytes: raw,
    },
  );
  const imported = await fetchPublicUrl("https://public.example/source");
  expect(imported.bytes).toEqual(raw);
  expect(imported.text).toContain("Stable_identifier");
  expect(imported.text).not.toContain("never");
  expect(imported.redirects).toEqual(["https://next.example/article"]);
  expect(mocks.dns).toHaveBeenCalledTimes(2);
  expect(requests.map((r) => r.hostname)).toEqual(["8.8.8.8", "8.8.8.8"]);
  expect(requests.map((r) => r.servername)).toEqual(["public.example", "next.example"]);
  expect(requests[0]?.headers).toMatchObject({ Host: "public.example" });
  expect(requests[0]?.agent).toBe(false);
});
it("denies redirected private destinations and socket address changes", async () => {
  replies.push({
    status: 302,
    headers: { location: "https://private.example/article" },
    bytes: Buffer.alloc(0),
  });
  mocks.dns
    .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
    .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
  await expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
    code: "URL_ADDRESS_DENIED",
  });
  expect(requests).toHaveLength(1);
  mocks.dns.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  replies.push({
    status: 200,
    headers: { "content-type": "text/plain" },
    bytes: Buffer.from("Untrusted"),
    remote: "127.0.0.1",
  });
  await expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
    code: "URL_FETCH_FAILED",
  });
});
it("bounds compressed expansion and rejects malformed compression without capture", async () => {
  replies.push({
    status: 200,
    headers: { "content-type": "text/plain", "content-encoding": "gzip" },
    bytes: gzipSync(Buffer.from("x".repeat(100000))),
  });
  await expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
    code: "URL_BODY_LIMIT",
  });
  replies.push({
    status: 200,
    headers: { "content-type": "text/plain", "content-encoding": "gzip" },
    bytes: Buffer.from("not gzip"),
  });
  await expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
    code: "URL_FETCH_FAILED",
  });
});
it("retains certificate hostname verification and refuses unsupported media and redirect loops", async () => {
  replies.push({
    status: 200,
    headers: { "content-type": "application/octet-stream" },
    bytes: Buffer.from("unsupported"),
  });
  await expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
    code: "URL_MEDIA_UNSUPPORTED",
  });
  const verify = requests[0]?.checkServerIdentity;
  expect(typeof verify).toBe("function");
  expect(
    verify?.("8.8.8.8", {
      subjectaltname: "DNS:other.example",
      subject: { CN: "other.example" },
    } as DetailedPeerCertificate),
  ).toBeInstanceOf(Error);
  for (let i = 0; i < 4; i++)
    replies.push({
      status: 302,
      headers: { location: `https://public.example/redirect-${i}` },
      bytes: Buffer.alloc(0),
    });
  await expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
    code: "URL_REDIRECT_LIMIT",
  });
  expect(requests).toHaveLength(5);
});
it("times out stalled DNS before opening a transport", async () => {
  vi.useFakeTimers();
  try {
    mocks.dns.mockImplementation(() => new Promise(() => {}));
    const pending = expect(fetchPublicUrl("https://public.example/source")).rejects.toMatchObject({
      code: "URL_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(15001);
    await pending;
    expect(requests).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});
