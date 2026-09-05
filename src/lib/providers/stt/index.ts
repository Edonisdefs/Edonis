import "server-only";

import { getEnv } from "@/lib/env";
import { MockSttProvider } from "./mock";
import { OpenAiSttProvider } from "./openai";
import type { SttProvider } from "./types";

let cached: SttProvider | null = null;

export function getSttProvider(): SttProvider {
  if (cached) return cached;
  const env = getEnv();

  if (env.STT_PROVIDER === "openai") {
    if (!env.STT_API_KEY) {
      // Fällt bewusst auf den Mock zurück statt die Aufnahme zu verlieren.
      console.warn(
        "[stt] STT_PROVIDER=openai, aber STT_API_KEY fehlt – nutze Mock-Transkription.",
      );
      cached = new MockSttProvider();
      return cached;
    }
    cached = new OpenAiSttProvider({
      apiKey: env.STT_API_KEY,
      baseUrl: env.STT_BASE_URL,
      model: env.STT_MODEL,
      language: env.STT_LANGUAGE,
    });
    return cached;
  }

  cached = new MockSttProvider();
  return cached;
}

/** Nur für Tests. */
export function setSttProviderForTesting(provider: SttProvider | null): void {
  cached = provider;
}

export * from "./types";
