/**
 * Storage-Abstraktion.
 *
 * Das MVP läuft mit `local` (Dateisystem) ohne jede externe Abhängigkeit.
 * In Produktion wird derselbe Vertrag von `s3` erfüllt (AWS S3, Cloudflare R2,
 * MinIO, Hetzner Object Storage …).
 */

export type PutResult = {
  key: string;
  size: number;
};

export type GetResult = {
  body: Buffer;
  contentType: string;
};

export interface StorageProvider {
  readonly name: string;
  put(
    key: string,
    body: Buffer,
    options: { contentType: string },
  ): Promise<PutResult>;
  get(key: string): Promise<GetResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Signierte URL, falls der Provider das unterstützt – sonst `null`. */
  signedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
}

export class StorageObjectNotFoundError extends Error {
  readonly status = 404;
  constructor(key: string) {
    super(`Datei nicht gefunden: ${key}`);
    this.name = "StorageObjectNotFoundError";
  }
}

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,255}$/;

/**
 * Storage-Keys werden aus IDs zusammengesetzt, sind also nie frei wählbar.
 * Die Prüfung bleibt trotzdem: sie verhindert Path-Traversal, falls doch
 * einmal Nutzereingabe in einen Key gerät.
 */
export function assertSafeKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error(`Ungültiger Storage-Key: ${key}`);
  }
}

/** Alle Objekte liegen unter dem Mandanten-Präfix – Basis der Zugriffsprüfung. */
export function orgPrefix(organizationId: string): string {
  return `org/${organizationId}`;
}

export function buildKey(
  organizationId: string,
  ...segments: string[]
): string {
  const key = [orgPrefix(organizationId), ...segments].join("/");
  assertSafeKey(key);
  return key;
}
