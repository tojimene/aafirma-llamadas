"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AnalysisResult from "@/components/AnalysisResult";
import { ACCEPTED_FILE_TYPES } from "@/lib/constants";
import type { CallAnalysis } from "@/lib/analysis";

type AnalyzeResponse = {
  id: string;
  analysis: CallAnalysis;
};

export default function AnalizarPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setIsExtracting(true);

    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo leer el archivo.");
      setTranscript((prev) => (prev ? prev + "\n\n" : "") + data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer el archivo.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAnalyze() {
    setError("");
    if (transcript.trim().length < 50) {
      setError("La transcripción es demasiado corta para analizar.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Llamada sin título",
          transcript,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en el análisis.");
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en el análisis.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function resetForm() {
    setTitle("");
    setTranscript("");
    setResult(null);
    setError("");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-foreground">Analizar llamada</h1>
        <p className="mt-1 text-sm text-muted">
          Pega o sube la transcripción. El sistema la analiza con el material de
          tu base de conocimiento.
        </p>
      </div>

      {!result && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Título de la llamada
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Cliente Juan Pérez · Refinanciamiento"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted">
                Transcripción
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                {isExtracting ? "Leyendo archivo…" : "+ Subir archivo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFile}
                className="hidden"
              />
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={14}
              placeholder="Pega aquí la transcripción de la llamada…"
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm leading-relaxed text-foreground outline-none transition focus:border-accent"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {transcript.length.toLocaleString("es-ES")} caracteres
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || isExtracting}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isAnalyzing ? "Analizando en profundidad…" : "Analizar llamada"}
          </button>

          {isAnalyzing && (
            <p className="text-center text-xs text-muted">
              Esto puede tardar entre 15 y 40 segundos.
            </p>
          )}
        </div>
      )}

      {result && (
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl text-foreground">
              {title || "Resultado"}
            </h2>
            <div className="flex gap-2">
              <a
                href={`/api/report/${result.id}`}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                ↓ Descargar informe Word
              </a>
              <button
                onClick={resetForm}
                className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
              >
                Analizar otra
              </button>
            </div>
          </div>
          <AnalysisResult analysis={result.analysis} />
        </div>
      )}
    </div>
  );
}
