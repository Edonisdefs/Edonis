"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Square, Trash2, Upload } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "uploading" | "done" | "error";

const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Die wichtigste Schaltfläche der Anwendung.
 *
 * Ein Druck startet die Aufnahme, ein Druck beendet sie – danach läuft alles
 * automatisch: Upload, Transkription, KI-Auswertung. Der Monteur muss nichts
 * tippen.
 */
export function VoiceRecorder({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  /** Der `onstop`-Callback braucht die aktuelle Dauer, nicht die beim Start. */
  const secondsRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTracks(), [stopTracks]);

  const upload = useCallback(
    async (blob: Blob, durationSec: number) => {
      setPhase("uploading");
      setMessage("Aufnahme wird ausgewertet …");

      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `bericht.${extension}`);
      formData.append("durationSec", `${durationSec}`);

      try {
        const response = await fetch(`/api/jobs/${jobId}/voice-notes`, {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as {
          message?: string;
          error?: string;
          failed?: boolean;
        };

        if (!response.ok) {
          setPhase("error");
          setMessage(payload.error ?? "Der Upload ist fehlgeschlagen.");
          return;
        }

        setPhase(payload.failed ? "error" : "done");
        setMessage(payload.message ?? "Aufnahme ausgewertet.");
        router.refresh();
      } catch {
        setPhase("error");
        setMessage(
          "Keine Verbindung. Die Aufnahme konnte nicht übertragen werden – bitte erneut versuchen.",
        );
      }
    },
    [jobId, router],
  );

  const start = useCallback(async () => {
    setMessage(null);
    cancelledRef.current = false;

    // Erst beim Antippen prüfen: Auf dem Server ist `navigator` nicht
    // vorhanden, und eine Prüfung während des Renderns würde die Hydration
    // auseinanderlaufen lassen.
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setSupported(false);
      setPhase("error");
      setMessage(
        "Dieser Browser unterstützt keine direkte Aufnahme. Bitte eine Sprachdatei hochladen.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const duration = secondsRef.current;
        stopTracks();
        if (cancelledRef.current) {
          chunksRef.current = [];
          setPhase("idle");
          setSeconds(0);
          return;
        }
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size < 1000) {
          setPhase("error");
          setMessage("Die Aufnahme war zu kurz. Bitte noch einmal sprechen.");
          return;
        }
        void upload(blob, duration);
      };

      recorder.start();
      setPhase("recording");
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        setSeconds((value) => {
          const next = value + 1;
          secondsRef.current = next;
          // Sicherheitsnetz: nach 10 Minuten automatisch beenden.
          if (next >= 600) recorderRef.current?.stop();
          return next;
        });
      }, 1000);
    } catch {
      setPhase("error");
      setMessage(
        "Kein Zugriff auf das Mikrofon. Bitte die Berechtigung im Browser erlauben.",
      );
    }
  }, [stopTracks, upload]);

  const stop = useCallback(() => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
    setMessage(null);
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      await upload(file, 0);
    },
    [upload],
  );

  return (
    <div className="space-y-3">
      {phase === "recording" ? (
        <div className="rounded-[var(--radius-card)] border-2 border-danger/30 bg-danger-soft p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-danger">
            <span className="animate-record size-3 rounded-full bg-danger" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Aufnahme läuft
            </span>
          </div>
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-foreground">
            {formatDuration(seconds)}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Sagen Sie: Kunde, Uhrzeit von–bis, was Sie gemacht haben, welches
            Material Sie verbaut haben.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button size="lg" variant="danger" onClick={stop} className="sm:w-56">
              <Square aria-hidden />
              Aufnahme beenden
            </Button>
            <Button size="lg" variant="ghost" onClick={cancel}>
              <Trash2 aria-hidden />
              Verwerfen
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="lg"
          block
          onClick={start}
          disabled={phase === "uploading"}
          className={cn("h-16 text-lg", phase === "uploading" && "opacity-70")}
        >
          {phase === "uploading" ? (
            <>
              <Loader2 className="animate-spin-slow" aria-hidden />
              Wird ausgewertet …
            </>
          ) : (
            <>
              <Mic aria-hidden />
              Bericht aufnehmen
            </>
          )}
        </Button>
      )}

      {!supported ? (
        <div className="space-y-2">
          <Alert tone="warning">
            Dieser Browser unterstützt keine direkte Aufnahme. Sie können eine
            Sprachnachricht als Datei hochladen.
          </Alert>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-3 text-sm font-medium text-muted hover:bg-surface-muted">
            <Upload className="size-4" aria-hidden />
            Sprachdatei auswählen
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>
        </div>
      ) : null}

      {message ? (
        <Alert
          tone={
            phase === "error" ? "danger" : phase === "done" ? "success" : "info"
          }
        >
          {message}
        </Alert>
      ) : null}
    </div>
  );
}
