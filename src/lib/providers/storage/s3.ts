import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  assertSafeKey,
  StorageObjectNotFoundError,
  type GetResult,
  type PutResult,
  type StorageProvider,
} from "./types";

export type S3StorageOptions = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
};

/** S3-kompatibler Storage (AWS S3, Cloudflare R2, MinIO, …). */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint || undefined,
      forcePathStyle: options.forcePathStyle ?? false,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            }
          : undefined,
    });
  }

  async put(
    key: string,
    body: Buffer,
    options: { contentType: string },
  ): Promise<PutResult> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
      }),
    );
    return { key, size: body.length };
  }

  async get(key: string): Promise<GetResult> {
    assertSafeKey(key);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new StorageObjectNotFoundError(key);
      return {
        body: Buffer.from(bytes),
        contentType: response.ContentType ?? "application/octet-stream",
      };
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) throw error;
      throw new StorageObjectNotFoundError(key);
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    assertSafeKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    assertSafeKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
