"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Fotos direkt von der Baustelle. Auf dem Smartphone öffnet `capture` die
 * Kamera, auf dem Desktop den Dateidialog.
 */
export function PhotoUploader({ jobId }: { jobId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("photos", file);

    try {
      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Die Fotos konnten nicht gespeichert werden.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Keine Verbindung. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(event) => void handleChange(event.target.files)}
      />
      <Button
        type="button"
        variant="secondary"
        block
        size="lg"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin-slow" aria-hidden />
            Fotos werden hochgeladen …
          </>
        ) : (
          <>
            <Camera aria-hidden />
            Fotos aufnehmen oder auswählen
          </>
        )}
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
