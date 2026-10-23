import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

/** Small storage interface (SPEC: all storage behind `BlobStore`). */
export interface BlobStore {
  put(key: string, body: Uint8Array | Blob | string, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** Time-limited GET URL; the bucket is private. */
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

// Bucket name declared in neon.ts. Endpoint, region and credentials come from
// the AWS_* vars that `neon deploy` / `neon env pull` write to .env.local.
const BUCKET = "assets";

export function createNeonBlobStore(): BlobStore {
  const files = new Files({ adapter: neon({ bucket: BUCKET }) });
  return {
    async put(key, body, contentType) {
      await files.upload(key, body, { contentType });
    },
    async get(key) {
      const file = await files.download(key);
      return new Uint8Array(await file.arrayBuffer());
    },
    async delete(key) {
      await files.delete(key);
    },
    signedUrl(key, expiresInSeconds = 3600) {
      return files.url(key, { expiresIn: expiresInSeconds });
    },
  };
}
