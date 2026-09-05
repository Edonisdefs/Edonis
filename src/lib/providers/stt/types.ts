/**
 * Speech-to-Text-Abstraktion.
 *
 * Der Anbieter ist bewusst austauschbar: Das MVP läuft mit `mock`, produktiv
 * spricht `openai` das verbreitete `/audio/transcriptions`-Format (OpenAI,
 * Groq, Azure OpenAI, eigenes whisper.cpp-Gateway).
 */

export type TranscriptionInput = {
  audio: Buffer;
  filename: string;
  mimeType: string;
  /** ISO-639-1, z.B. "de" – hilft der Erkennung deutlich. */
  language?: string;
  /** Fachbegriffe als Kontext (Kundenname, Materialkatalog). */
  vocabularyHint?: string;
};

export type TranscriptionResult = {
  text: string;
  language: string | null;
  provider: string;
  model: string | null;
  durationSec: number | null;
};

export interface SttProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}
