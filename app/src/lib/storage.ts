import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

type StorageProvider = "local" | "s3" | "r2";

function getProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "s3" || provider === "r2") return provider;
  return "local";
}

// ─── Local Storage ──────────────────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

function safePath(filePath: string): string {
  const resolved = path.resolve(UPLOADS_DIR, filePath);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) && resolved !== UPLOADS_DIR) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

async function localSave(filePath: string, data: Buffer): Promise<void> {
  const fullPath = safePath(filePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);
}

async function localRead(filePath: string): Promise<Buffer | null> {
  const fullPath = safePath(filePath);
  try {
    return await readFile(fullPath);
  } catch {
    return null;
  }
}

async function localExists(filePath: string): Promise<boolean> {
  const fullPath = safePath(filePath);
  try {
    const s = await stat(fullPath);
    return s.isFile();
  } catch {
    return false;
  }
}

// ─── S3-Compatible Storage (S3 + R2) ────────────────────────────────────────
// @aws-sdk/client-s3 is an optional dependency — install it only if using S3/R2.
// We use require() so webpack doesn't fail when the package is absent.

function getS3Config() {
  return {
    bucket: process.env.S3_BUCKET || "",
    region: process.env.S3_REGION || "auto",
    accessKey: process.env.S3_ACCESS_KEY || "",
    secretKey: process.env.S3_SECRET_KEY || "",
    endpoint: process.env.S3_ENDPOINT, // Required for R2
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadS3(): any {
  try {
    // Dynamic require — webpack won't statically analyze this
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@aws-sdk/client-s3");
  } catch {
    throw new StorageError(
      "S3 storage requires @aws-sdk/client-s3. Install it with: npm install @aws-sdk/client-s3"
    );
  }
}

async function s3Save(filePath: string, data: Buffer, contentType?: string): Promise<void> {
  const config = getS3Config();
  const { S3Client, PutObjectCommand } = loadS3();

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: filePath,
        Body: data,
        ContentType: contentType || "application/octet-stream",
      })
    );
  } catch (err) {
    if (err instanceof StorageError) throw err;
    console.error("S3 storage error (save):", err);
    throw new StorageError("Failed to save file to storage");
  }
}

async function s3Read(filePath: string): Promise<Buffer | null> {
  const config = getS3Config();
  const { S3Client, GetObjectCommand } = loadS3();

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  });

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: filePath,
      })
    );
    const stream = response.Body;
    if (!stream) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err: unknown) {
    if (err instanceof StorageError) throw err;
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "NoSuchKey") {
      return null;
    }
    console.error("S3 storage error (read):", err);
    throw new StorageError("Failed to read file from storage");
  }
}

async function s3Exists(filePath: string): Promise<boolean> {
  const config = getS3Config();
  const { S3Client, HeadObjectCommand } = loadS3();

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  });

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: filePath,
      })
    );
    return true;
  } catch (err) {
    if (err instanceof StorageError) throw err;
    return false;
  }
}

// ─── Storage Error ──────────────────────────────────────────────────────────

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function saveFile(filePath: string, data: Buffer, contentType?: string): Promise<void> {
  const provider = getProvider();
  if (provider === "local") return localSave(filePath, data);
  return s3Save(filePath, data, contentType);
}

export async function readFile_(filePath: string): Promise<Buffer | null> {
  const provider = getProvider();
  if (provider === "local") return localRead(filePath);
  return s3Read(filePath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  const provider = getProvider();
  if (provider === "local") return localExists(filePath);
  return s3Exists(filePath);
}

export function getStoragePath(
  organizationId: string,
  portalSlug: string,
  filename: string
): string {
  return `orgs/${organizationId}/portals/${portalSlug}/${filename}`;
}
