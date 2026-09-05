import "server-only";

import {
  TranscriptionError,
  type SttProvider,
  type TranscriptionInput,
  type TranscriptionResult,
} from "./types";

export type OpenAiSttOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  language?: string;
};

/**
 * Spricht das OpenAI-kompatible `/audio/transcriptions`-Endpunktformat.
 * Damit funktionieren OpenAI (Whisper/gpt-4o-transcribe), Groq, Azure OpenAI
 * und selbst gehostete Gateways ohne Codeänderung – nur `STT_BASE_URL` und
 * `STT_MODEL` unterscheiden sich.
 */
export class OpenAiSttProvider implements SttProvider {
  readonly name = "openai";

  constructor(private readonly options: OpenAiSttOptions) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
      input.filename,
    );
    form.append("model", this.options.model);
    form.append("response_format", "verbose_json");

    const language = input.language ?? this.options.language;
    if (language) form.append("language", language);
    if (input.vocabularyHint) form.append("prompt", input.vocabularyHint);

    let response: Response;
    try {
      response = await fetch(
        `${this.options.baseUrl.replace(/\/$/, "")}/audio/transcriptions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.options.apiKey}` },
          body: form,
        },
      );
    } catch (error) {
      throw new TranscriptionError(
        "Der Transkriptionsdienst ist nicht erreichbar.",
        error,
      );
    }

    if (!response.ok) {
      // Bewusst ohne Response-Body im Fehlertext: dort können Teile der
      // Aufnahme oder Keys stehen.
      throw new TranscriptionError(
        `Transkription fehlgeschlagen (HTTP ${response.status}).`,
      );
    }

    const payload = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
    };

    if (!payload.text) {
      throw new TranscriptionError("Der Dienst hat keinen Text zurückgegeben.");
    }

    return {
      text: payload.text.trim(),
      language: payload.language ?? language ?? null,
      provider: this.name,
      model: this.options.model,
      durationSec: payload.duration ? Math.round(payload.duration) : null,
    };
  }
}
