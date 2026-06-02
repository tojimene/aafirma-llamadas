"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AnalysisEditor from "@/components/AnalysisEditor";
import { ACCEPTED_FILE_TYPES } from "@/lib/constants";
import type { CallAnalysis } from "@/lib/analysis";

type Result = {
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
  const [progress, setProgress] = useState(0);
  const [stageMsg, setStageMsg] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

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
      const text = await res.text();
      let data: { text?: string; error?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `El servidor devolvió una respuesta inesperada (${res.status}).`
        );
      }
      if (!res.ok) throw new Error(data.error || "No se pudo leer el archivo.");
      setTranscript((prev) => (prev ? prev + "\n\n" : "") + (data.text ?? ""));
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
    setProgress(5);
    setStageMsg("Iniciando análisis…");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Llamada sin título",
          transcript,
        }),
      });

      // Si la respuesta no es un stream válido, intentamos leer el error legible.
      if (!res.ok || !res.body) {
        const text = await res.text();
        let msg = `El servidor respondió con un error (${res.status}).`;
        try {
          msg = JSON.parse(text).error || msg;
        } catch {
          /* respuesta no-JSON: dejamos el mensaje genérico */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: Result | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }

          if (evt.error) throw new Error(String(evt.error));
          if (evt.done) {
            finalResult = { id: String(evt.id), analysis: evt.analysis as CallAnalysis };
            setProgress(100);
            setStageMsg("Completado");
          } else if (typeof evt.pct === "number") {
            setProgress(evt.pct as number);
            if (typeof evt.message === "string") setStageMsg(evt.message);
          }
        }
      }

      if (!finalResult) {
        throw new Error(
          "El análisis se interrumpió antes de terminar (posible límite de tiempo del servidor). Prueba con una transcripción más corta."
        );
      }

      setResult(finalResult);
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
    setProgress(0);
    setStageMsg("");
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
              disabled={isAnalyzing}
              placeholder="Ej. Cliente Juan Pérez · Refinanciamiento"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent disabled:opacity-50"
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
                disabled={isExtracting || isAnalyzing}
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
              disabled={isAnalyzing}
              rows={14}
              placeholder="Pega aquí la transcripción de la llamada…"
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm leading-relaxed text-foreground outline-none transition focus:border-accent disabled:opacity-50"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {transcript.length.toLocaleString("es-ES")} caracteres
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Barra de progreso */}
          {isAnalyzing && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-foreground">{stageMsg}</span>
                <span className="text-muted">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || isExtracting}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isAnalyzing ? "Analizando…" : "Analizar llamada"}
          </button>
        </div>
      )}

      {result && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-2xl text-foreground">Resultado</h2>
            <button
              onClick={resetForm}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
            >
              Analizar otra
            </button>
          </div>
          <AnalysisEditor
            initialAnalysis={result.analysis}
            initialTitle={title || "Llamada sin título"}
            callId={result.id}
          />
        </div>
      )}
    </div>
  );
}
