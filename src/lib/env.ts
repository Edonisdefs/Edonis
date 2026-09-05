import "server-only";

import { z } from "zod";

/**
 * Zentrale, serverseitige Konfiguration.
 *
 * Wichtig: Diese Datei ist mit `server-only` markiert. API-Keys dürfen niemals
 * in Client-Komponenten landen. Alle Provider werden ausschließlich in Server
 * Actions / Route Handlern instanziiert.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === "boolean"
      ? value
      : ["1", "true", "yes", "ja", "on"].includes(value.trim().toLowerCase()),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET muss mindestens 32 Zeichen lang sein"),

  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),

  STT_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  STT_API_KEY: z.string().optional(),
  STT_BASE_URL: z.string().default("https://api.openai.com/v1"),
  STT_MODEL: z.string().default("whisper-1"),
  STT_LANGUAGE: z.string().default("de"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("eu-central-1"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: booleanish.default(false),

  ALLOW_SIGNUP: booleanish.default(true),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Ungültige Umgebungskonfiguration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Nur für Tests: erzwingt ein erneutes Einlesen der Umgebung. */
export function resetEnvCache(): void {
  cached = null;
}
