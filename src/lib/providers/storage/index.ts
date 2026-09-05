import "server-only";

import { getEnv } from "@/lib/env";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider } from "./types";

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  const env = getEnv();

  if (env.STORAGE_DRIVER === "s3") {
    if (!env.S3_BUCKET) {
      throw new Error(
        'STORAGE_DRIVER="s3" gesetzt, aber S3_BUCKET fehlt. Bitte .env prüfen.',
      );
    }
    cached = new S3StorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  } else {
    cached = new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
  }

  return cached;
}

/** Nur für Tests. */
export function setStorageForTesting(provider: StorageProvider | null): void {
  cached = provider;
}

export * from "./types";
