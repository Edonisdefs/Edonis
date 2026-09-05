import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  assertSafeKey,
  StorageObjectNotFoundError,
  type GetResult,
  type PutResult,
  type StorageProvider,
} from "./types";

const META_SUFFIX = ".meta.json";

/**
 * Dateisystem-Storage für lokale Entwicklung und Demos.
 * Ausdrücklich nicht für serverlose Produktionsumgebungen gedacht – dort
 * greift der S3-Provider.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private readonly root: string;

  constructor(rootDir: string) {
    // turbopackIgnore: Der Pfad ist konfigurierbar (STORAGE_LOCAL_DIR) und
    // daher statisch nicht auflösbar. Ohne diesen Hinweis würde der Bundler
    // vorsorglich das gesamte Projekt in die Server-Ausgabe kopieren. Dieser
    // Provider ist ohnehin nur für Entwicklung und Demo gedacht – in
    // Produktion greift der S3-Provider.
    this.root = path.resolve(/* turbopackIgnore: true */ process.cwd(), rootDir);
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) {
      throw new Error(`Ungültiger Storage-Key: ${key}`);
    }
    return full;
  }

  async put(
    key: string,
    body: Buffer,
    options: { contentType: string },
  ): Promise<PutResult> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    await fs.writeFile(
      `${target}${META_SUFFIX}`,
      JSON.stringify({ contentType: options.contentType, size: body.length }),
      "utf8",
    );
    return { key, size: body.length };
  }

  async get(key: string): Promise<GetResult> {
    const target = this.resolve(key);
    try {
      const body = await fs.readFile(target);
      let contentType = "application/octet-stream";
      try {
        const meta = JSON.parse(
          await fs.readFile(`${target}${META_SUFFIX}`, "utf8"),
        ) as { contentType?: string };
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // Metadaten sind optional.
      }
      return { body, contentType };
    } catch {
      throw new StorageObjectNotFoundError(key);
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolve(key);
    await fs.rm(target, { force: true });
    await fs.rm(`${target}${META_SUFFIX}`, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(): Promise<string | null> {
    // Lokale Dateien werden über /api/files/[...key] mit Sitzungsprüfung
    // ausgeliefert, nicht über eine signierte URL.
    return null;
  }
}
