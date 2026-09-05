import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import { jobReportExtractionSchema, parseExtraction } from "./schema";
import { buildUserPrompt, EXTRACTION_SYSTEM_PROMPT } from "./prompt";
import {
  AiExtractionError,
  type AiProvider,
  type ExtractJobReportInput,
  type ExtractionOutcome,
} from "./types";

export type AnthropicOptions = {
  apiKey: string;
  model: string;
};

/**
 * Produktiver KI-Provider.
 *
 * Nutzt Structured Outputs: Die Antwort wird serverseitig gegen das
 * Zod-Schema erzwungen, es gibt also kein JSON-Parsing von Freitext und keine
 * halb gefüllten Felder. Zusätzlich ist die serverseitige Fallback-Kette
 * aktiv, damit eine abgelehnte Anfrage nicht die Aufnahme des Monteurs
 * verliert.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
  }

  async extractJobReport(
    input: ExtractJobReportInput,
  ): Promise<ExtractionOutcome> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.options.model,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          {
            type: "text",
            text: EXTRACTION_SYSTEM_PROMPT,
            // Der stabile Teil der Anweisung wird gecacht; der betriebs-
            // spezifische Kontext steht in der User-Nachricht dahinter.
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: buildUserPrompt(input) }],
        output_config: {
          effort: "medium",
          format: betaZodOutputFormat(jobReportExtractionSchema),
        },
      });

      if (response.stop_reason === "refusal") {
        throw new AiExtractionError(
          "Die KI hat die Verarbeitung dieses Berichts abgelehnt. Bitte die Daten manuell erfassen.",
        );
      }

      if (!response.parsed_output) {
        throw new AiExtractionError(
          "Die KI hat kein auswertbares Ergebnis geliefert.",
        );
      }

      return {
        // Zweite Validierung: Was gespeichert wird, entspricht garantiert
        // dem Schema – unabhängig davon, was über die Leitung kam.
        extraction: parseExtraction(response.parsed_output),
        provider: this.name,
        model: response.model ?? this.options.model,
      };
    } catch (error) {
      if (error instanceof AiExtractionError) throw error;

      if (error instanceof Anthropic.RateLimitError) {
        throw new AiExtractionError(
          "Die KI ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.",
          error,
        );
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new AiExtractionError(
          "Der KI-Zugang ist nicht korrekt konfiguriert.",
          error,
        );
      }
      if (error instanceof Anthropic.APIError) {
        throw new AiExtractionError(
          `Die KI-Anfrage ist fehlgeschlagen (HTTP ${error.status ?? "?"}).`,
          error,
        );
      }
      throw new AiExtractionError("Die KI ist nicht erreichbar.", error);
    }
  }
}
