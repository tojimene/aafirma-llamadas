"use client";

import { useState } from "react";
import type { CallAnalysis } from "@/lib/analysis";

function cleanList(items: string[]): string[] {
  return items.map((i) => i.trim()).filter(Boolean);
}

function cleanAnalysis(a: CallAnalysis): CallAnalysis {
  return {
    ...a,
    puntuacionGlobal: Math.min(100, Math.max(0, Number(a.puntuacionGlobal) || 0)),
    fortalezas: cleanList(a.fortalezas),
    debilidades: cleanList(a.debilidades),
    oportunidadesMejora: cleanList(a.oportunidadesMejora),
    objecionesDetectadas: cleanList(a.objecionesDetectadas),
    recomendacionesAccionables: cleanList(a.recomendacionesAccionables),
    proximaLlamada: cleanList(a.proximaLlamada),
    fases: a.fases.filter((f) => f.fase?.trim()),
    frasesDestacadas: a.frasesDestacadas.filter((f) => f.cita?.trim()),
    seccionesPersonalizadas: a.seccionesPersonalizadas.filter((s) =>
      s.titulo?.trim()
    ),
  };
}

const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted";
const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent";
const cardCls = "rounded-xl border border-border bg-surface p-5";

function ListField({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className={cardCls}>
      <label className={labelCls}>{label}</label>
      <p className="mb-2 text-[11px] text-muted">Un elemento por línea.</p>
      <textarea
        value={items.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        rows={Math.max(3, items.length + 1)}
        className={`${inputCls} resize-y leading-relaxed`}
      />
    </div>
  );
}

type Props = {
  initialAnalysis: CallAnalysis;
  initialTitle: string;
  callId?: string;
};

export default function AnalysisEditor({
  initialAnalysis,
  initialTitle,
  callId,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [a, setA] = useState<CallAnalysis>(initialAnalysis);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function set<K extends keyof CallAnalysis>(key: K, value: CallAnalysis[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!callId) return;
    setError("");
    setNotice("");
    setIsSaving(true);
    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, analysis: cleanAnalysis(a) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setNotice("Cambios guardados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload() {
    setError("");
    setNotice("");
    setIsDownloading(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, analysis: cleanAnalysis(a) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo generar el informe.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `informe-${title || "llamada"}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="sticky top-0 z-10 -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <p className="text-xs text-muted">
          Puedes editar cualquier campo antes de descargar el informe.
        </p>
        <div className="flex items-center gap-2">
          {notice && <span className="text-xs text-success">{notice}</span>}
          {error && <span className="text-xs text-danger">{error}</span>}
          {callId && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-accent disabled:opacity-50"
            >
              {isSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isDownloading ? "Generando…" : "↓ Descargar informe Word"}
          </button>
        </div>
      </div>

      {/* Cabecera editable */}
      <div className={cardCls}>
        <label className={labelCls}>Título</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputCls} mb-4`}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Puntuación (0-100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={a.puntuacionGlobal}
              onChange={(e) => set("puntuacionGlobal", Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Sentimiento</label>
            <input
              value={a.sentimientoCliente}
              onChange={(e) => set("sentimientoCliente", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Resultado probable</label>
            <input
              value={a.resultadoProbable}
              onChange={(e) => set("resultadoProbable", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className={cardCls}>
        <label className={labelCls}>Resumen ejecutivo</label>
        <textarea
          value={a.resumen}
          onChange={(e) => set("resumen", e.target.value)}
          rows={4}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      </div>

      {/* Fases */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center justify-between">
          <label className={labelCls}>Evaluación por fases</label>
          <button
            onClick={() =>
              set("fases", [...a.fases, { fase: "", puntuacion: 0, comentario: "" }])
            }
            className="text-xs text-accent hover:underline"
          >
            + Añadir fase
          </button>
        </div>
        <div className="space-y-3">
          {a.fases.map((f, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex gap-2">
                <input
                  value={f.fase}
                  placeholder="Nombre de la fase"
                  onChange={(e) => {
                    const next = [...a.fases];
                    next[i] = { ...f, fase: e.target.value };
                    set("fases", next);
                  }}
                  className={`${inputCls} flex-1`}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={f.puntuacion}
                  onChange={(e) => {
                    const next = [...a.fases];
                    next[i] = { ...f, puntuacion: Number(e.target.value) };
                    set("fases", next);
                  }}
                  className={`${inputCls} w-20`}
                />
                <button
                  onClick={() => set("fases", a.fases.filter((_, j) => j !== i))}
                  className="rounded-lg border border-border px-2 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={f.comentario}
                placeholder="Comentario"
                onChange={(e) => {
                  const next = [...a.fases];
                  next[i] = { ...f, comentario: e.target.value };
                  set("fases", next);
                }}
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <ListField label="Fortalezas" items={a.fortalezas} onChange={(v) => set("fortalezas", v)} />
        <ListField label="Debilidades" items={a.debilidades} onChange={(v) => set("debilidades", v)} />
        <ListField label="Oportunidades de mejora" items={a.oportunidadesMejora} onChange={(v) => set("oportunidadesMejora", v)} />
        <ListField label="Objeciones detectadas" items={a.objecionesDetectadas} onChange={(v) => set("objecionesDetectadas", v)} />
      </div>

      {/* Frases destacadas */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center justify-between">
          <label className={labelCls}>Frases destacadas</label>
          <button
            onClick={() =>
              set("frasesDestacadas", [...a.frasesDestacadas, { cita: "", comentario: "" }])
            }
            className="text-xs text-accent hover:underline"
          >
            + Añadir frase
          </button>
        </div>
        <div className="space-y-3">
          {a.frasesDestacadas.map((f, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex gap-2">
                <input
                  value={f.cita}
                  placeholder="Cita textual"
                  onChange={(e) => {
                    const next = [...a.frasesDestacadas];
                    next[i] = { ...f, cita: e.target.value };
                    set("frasesDestacadas", next);
                  }}
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() =>
                    set("frasesDestacadas", a.frasesDestacadas.filter((_, j) => j !== i))
                  }
                  className="rounded-lg border border-border px-2 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={f.comentario}
                placeholder="Comentario"
                onChange={(e) => {
                  const next = [...a.frasesDestacadas];
                  next[i] = { ...f, comentario: e.target.value };
                  set("frasesDestacadas", next);
                }}
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <ListField label="Recomendaciones accionables" items={a.recomendacionesAccionables} onChange={(v) => set("recomendacionesAccionables", v)} />
        <ListField label="Próxima llamada" items={a.proximaLlamada} onChange={(v) => set("proximaLlamada", v)} />
      </div>

      {/* Secciones personalizadas (estructura de la firma) */}
      <div className="rounded-xl border border-accent/30 bg-accent-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-accent">
            Informe según la estructura de la firma
          </label>
          <button
            onClick={() =>
              set("seccionesPersonalizadas", [
                ...a.seccionesPersonalizadas,
                { titulo: "", contenido: "" },
              ])
            }
            className="text-xs text-accent hover:underline"
          >
            + Añadir sección
          </button>
        </div>
        {a.seccionesPersonalizadas.length === 0 && (
          <p className="text-xs text-muted">
            No hay secciones (no había una estructura de informe activa al analizar).
          </p>
        )}
        <div className="space-y-3">
          {a.seccionesPersonalizadas.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex gap-2">
                <input
                  value={s.titulo}
                  placeholder="Título de la sección"
                  onChange={(e) => {
                    const next = [...a.seccionesPersonalizadas];
                    next[i] = { ...s, titulo: e.target.value };
                    set("seccionesPersonalizadas", next);
                  }}
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() =>
                    set(
                      "seccionesPersonalizadas",
                      a.seccionesPersonalizadas.filter((_, j) => j !== i)
                    )
                  }
                  className="rounded-lg border border-border px-2 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={s.contenido}
                placeholder="Contenido"
                onChange={(e) => {
                  const next = [...a.seccionesPersonalizadas];
                  next[i] = { ...s, contenido: e.target.value };
                  set("seccionesPersonalizadas", next);
                }}
                rows={4}
                className={`${inputCls} resize-y leading-relaxed`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
