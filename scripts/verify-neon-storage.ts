import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createNeonS3Client, checkNeonSourceBucket } from "@atlas/core";
import { readNeonSetup } from "./neon-target.js";

let stage = "target validation";
try {
  const { target, env } = await readNeonSetup();
  const endpoint = env.AWS_ENDPOINT_URL_S3,
    region = env.AWS_REGION,
    accessKeyId = env.AWS_ACCESS_KEY_ID,
    secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  if (
    !endpoint ||
    !region ||
    !accessKeyId ||
    !secretAccessKey ||
    !new URL(endpoint).hostname.startsWith(`${target.branchId}.storage.`)
  )
    throw Error("Storage configuration mismatch");
  const client = createNeonS3Client({ endpoint, region, accessKeyId, secretAccessKey });
  const run = randomUUID(),
    key = `setup-checks/${run}/roundtrip.txt`,
    bytes = Buffer.from(
      `ATLAS private storage verification ${run}\r\nUnicode original: café 🌱\n`,
      "utf8",
    ),
    sha = createHash("sha256").update(bytes).digest("hex");
  let created = false;
  try {
    stage = "private bucket health";
    await checkNeonSourceBucket(client);
    stage = "put";
    await client.send(
      new PutObjectCommand({
        Bucket: target.storageBucket,
        Key: key,
        Body: bytes,
        ContentType: "text/plain; charset=utf-8",
        CacheControl: "private, no-store",
        Metadata: { sha256: sha, "atlas-setup-run": run },
      }),
    );
    created = true;
    stage = "head";
    const head = await client.send(
      new HeadObjectCommand({ Bucket: target.storageBucket, Key: key }),
    );
    if (head.ContentLength !== bytes.length || head.Metadata?.sha256 !== sha)
      throw Error("Head metadata mismatch");
    stage = "get";
    const result = await client.send(
        new GetObjectCommand({ Bucket: target.storageBucket, Key: key }),
      ),
      received = await result.Body?.transformToByteArray();
    if (!received || !Buffer.from(received).equals(bytes)) throw Error("Original bytes mismatch");
    stage = "anonymous denial";
    const anonymous = await fetch(`${endpoint.replace(/\/$/, "")}/${target.storageBucket}/${key}`, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (![401, 403, 404].includes(anonymous.status))
      throw Error("Anonymous object read was not denied");
    await anonymous.body?.cancel();
    await writeFile(
      ".local/neon-storage-verification.json",
      JSON.stringify(
        {
          projectId: target.projectId,
          branchId: target.branchId,
          bucket: target.storageBucket,
          put: true,
          head: true,
          get: true,
          byteExact: true,
          anonymousStatus: anonymous.status,
          verifiedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    process.stdout.write(
      `Private atlas-sources: PUT / HEAD / GET passed; exact UTF-8 bytes and SHA-256 metadata match; anonymous GET denied (${anonymous.status}).\n`,
    );
  } finally {
    if (created) {
      // Delete only the exact synthetic object created by this invocation, after
      // rechecking its run marker; never list/delete arbitrary bucket objects.
      const own = await client.send(
        new HeadObjectCommand({ Bucket: target.storageBucket, Key: key }),
      );
      if (own.Metadata?.["atlas-setup-run"] === run) {
        await client.send(new DeleteObjectCommand({ Bucket: target.storageBucket, Key: key }));
        process.stdout.write("Removed only this run's synthetic verification object.\n");
      } else {
        process.stderr.write("Cleanup marker mismatch; object left untouched.\n");
        process.exitCode = 1;
      }
    }
    client.destroy();
  }
} catch (e) {
  const code = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  process.stderr.write(
    `Neon storage verification failed during ${stage}${code ? ` (HTTP ${code})` : ""}; credentials and object details redacted.\n`,
  );
  process.exitCode = 1;
}
