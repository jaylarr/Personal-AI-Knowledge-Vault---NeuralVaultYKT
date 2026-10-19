import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

export function createNeonS3Client(input: {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  const endpoint = new URL(input.endpoint);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw Error("Invalid storage endpoint");
  return new S3Client({
    endpoint: endpoint.href,
    region: input.region,
    credentials: { accessKeyId: input.accessKeyId, secretAccessKey: input.secretAccessKey },
    forcePathStyle: true,
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
export async function checkNeonSourceBucket(client: S3Client) {
  await client.send(new HeadBucketCommand({ Bucket: "atlas-sources" }), {
    abortSignal: AbortSignal.timeout(5000),
  });
  return "connected" as const;
}
