import "server-only";

import { getEnv } from "@/lib/env";
import { AnthropicAiProvider } from "./anthropic";
import { MockAiProvider } from "./mock";
import type { AiProvider } from "./types";

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const env = getEnv();

  if (env.AI_PROVIDER === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      // Ohne Key nicht abstürzen: Das MVP bleibt mit der regelbasierten
      // Extraktion vollständig bedienbar.
      console.warn(
        "[ai] AI_PROVIDER=anthropic, aber ANTHROPIC_API_KEY fehlt – nutze regelbasierte Extraktion.",
      );
      cached = new MockAiProvider();
      return cached;
    }
    cached = new AnthropicAiProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
    });
    return cached;
  }

  cached = new MockAiProvider();
  return cached;
}

/** Nur für Tests. */
export function setAiProviderForTesting(provider: AiProvider | null): void {
  cached = provider;
}

export * from "./types";
export * from "./schema";
