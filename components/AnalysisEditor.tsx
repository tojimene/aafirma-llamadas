"use client";

import { useState } from "react";
import type {
  CallAnalysis,
  Prioridad,
  RebateObjecion,
  RedFlag,
} from "@/lib/analysis";

function cleanList(items: string[]): string[] {
  return items.map((i) => i.trim()).filter(Boolean);
}

// Garantiza que todos los campos existan (registros antiguos / esquema previo).
function normalizeAnalysis(
  a: Partial<CallAnalysis> | null | undefined
): CallAnalysis {
  const x = (a ?? {}) as Record<string, unknown>;
  return {
    resumen: (x.resumen as string) ?? "",
    puntuacionGlobal: Number(x.puntuacionGlobal) || 0,
    resultadoProbable: (x.resultadoProbable as string) ?? "",
    prioridades: Array.isArray(x.prioridades) ? (x.prioridades as Prioridad[]) : [],
    redFlags: Array.isArray(x.redFlags) ? (x.redFlags as RedFlag[]) : [],
    erroresSondeo: Array.isArray(x.erroresSondeo) ? (x.erroresSondeo as string[]) : [],
    erroresPitch: Array.isArray(x.erroresPitch) ? (x.erroresPitch as string[]) : [],
    erroresObjeciones: Array.isArray(x.erroresObjeciones)
      ? (x.erroresObjeciones as string[])
      : [],
    rebateObjeciones: Array.isArray(x.rebateObjeciones)
      ? (x.rebateObjeciones as RebateObjecion[])
      : [],
    seccionesPersonalizadas: Array.isArray(x.seccionesPersonalizadas)
      ? (x.seccionesPersonalizadas as CallAnalysis["seccionesPersonalizadas"])
      : [],
  };
}

function cleanAnalysis(a: CallAnalysis): CallAnalysis {
  return {
    ...a,
    puntuacionGlobal: Math.min(100, Math.max(0, Number(a.puntuacionGlobal) || 0)),
    erroresSondeo: cleanList(a.erroresSondeo),
    erroresPitch: cleanList(a.erroresPitch),
    erroresObjeciones: cleanList(a.erroresObjeciones),
    prioridades: a.prioridades.filter((p) => p.titulo?.trim()),
    redFlags: a.redFlags.filter((r) => r.flag?.trim()),
    rebateObjeciones: a.rebateObjeciones.filter((o) => o.objecion?.trim()),
    seccionesPersonalizadas: a.seccionesPersonalizadas.filter((s) =>
      s.titulo?.trim()
    ),
  };
}

const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted";
const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent";
const cardCls = "rounded-xl border border-border bg-surface p-5";

function ListField({
  label,
  hint,
  items,
  onChange,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className={cardCls}>
      <label className={labelCls}>{label}</label>
      <p className="mb-2 text-[11px] text-muted">{hint ?? "Un elemento por línea."}</p>
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
  const [a, setA] = useState<CallAnalysis>(() => normalizeAnalysis(initialAnalysis));
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function set<K extends keyof CallAnalysis>(key: K, value: CallAnalysis[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
  }

  // Helpers genéricos para arrays de objetos.
  function updateRow<T>(key: keyof CallAnalysis, index: number, patch: Partial<T>) {
    const arr = [...(a[key] as unknown as T[])];
    arr[index] = { ...arr[index], ...patch };
    set(key, arr as unknown as CallAnalysis[typeof key]);
  }
  function removeRow(key: keyof CallAnalysis, index: number) {
    const arr = (a[key] as unknown as unknown[]).filter((_, j) => j !== index);
    set(key, arr as unknown as CallAnalysis[typeof key]);
  }
  function addRow<T>(key: keyof CallAnalysis, empty: T) {
    set(key, [...(a[key] as unknown as T[]), empty] as unknown as CallAnalysis[typeof key]);
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
        <div className="grid gap-4 sm:grid-cols-2">
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
        <label className={labelCls}>Resumen</label>
        <textarea
          value={a.resumen}
          onChange={(e) => set("resumen", e.target.value)}
          rows={3}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      </div>

      {/* 80/20 Prioridades */}
      <div className="rounded-xl border border-accent/40 bg-accent-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-accent">
              Prioridades 80/20
            </label>
            <p className="text-[11px] text-muted">
              Las 2-3 cosas con más impacto para mejorar la llamada.
            </p>
          </div>
          <button
            onClick={() =>
              addRow<Prioridad>("prioridades", { titulo: "", porque: "", accion: "" })
            }
            className="text-xs text-accent hover:underline"
          >
            + Añadir
          </button>
        </div>
        <div className="space-y-3">
          {a.prioridades.map((p, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex gap-2">
                <input
                  value={p.titulo}
                  placeholder="Mejora prioritaria"
                  onChange={(e) =>
                    updateRow<Prioridad>("prioridades", i, { titulo: e.target.value })
                  }
                  className={`${inputCls} flex-1 font-medium`}
                />
                <button
                  onClick={() => removeRow("prioridades", i)}
                  className="rounded-lg border border-border px-2 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={p.porque}
                placeholder="Por qué es lo que más impacta"
                onChange={(e) =>
                  updateRow<Prioridad>("prioridades", i, { porque: e.target.value })
                }
                rows={2}
                className={`${inputCls} mb-2 resize-y`}
              />
              <textarea
                value={p.accion}
                placeholder="Qué hacer exactamente la próxima vez"
                onChange={(e) =>
                  updateRow<Prioridad>("prioridades", i, { accion: e.target.value })
                }
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Errores por fase */}
      <div className="grid gap-5 md:grid-cols-3">
        <ListField
          label="Errores en el sondeo"
          hint="Descubrimiento de la situación."
          items={a.erroresSondeo}
          onChange={(v) => set("erroresSondeo", v)}
        />
        <ListField
          label="Errores en el pitch"
          hint="Presentación de la solución."
          items={a.erroresPitch}
          onChange={(v) => set("erroresPitch", v)}
        />
        <ListField
          label="Errores en objeciones"
          hint="Manejo y rebate."
          items={a.erroresObjeciones}
          onChange={(v) => set("erroresObjeciones", v)}
        />
      </div>

      {/* Rebate de objeciones */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <label className={labelCls}>Rebate de objeciones</label>
            <p className="text-[11px] text-muted">
              Incluye precio y coste de la inacción (deudas, embargos).
            </p>
          </div>
          <button
            onClick={() =>
              addRow<RebateObjecion>("rebateObjeciones", {
                objecion: "",
                manejoActual: "",
                rebateRecomendado: "",
              })
            }
            className="text-xs text-accent hover:underline"
          >
            + Añadir
          </button>
        </div>
        <div className="space-y-3">
          {a.rebateObjeciones.map((o, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex gap-2">
                <input
                  value={o.objecion}
                  placeholder="Objeción del cliente"
                  onChange={(e) =>
                    updateRow<RebateObjecion>("rebateObjeciones", i, {
                      objecion: e.target.value,
                    })
                  }
                  className={`${inputCls} flex-1 font-medium`}
                />
                <button
                  onClick={() => removeRow("rebateObjeciones", i)}
                  className="rounded-lg border border-border px-2 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={o.manejoActual}
                placeholder="Cómo la manejó el asesor"
                onChange={(e) =>
                  updateRow<RebateObjecion>("rebateObjeciones", i, {
                    manejoActual: e.target.value,
                  })
                }
                rows={2}
                className={`${inputCls} mb-2 resize-y`}
              />
              <textarea
                value={o.rebateRecomendado}
                placeholder="Cómo debió rebatirla (recomendado)"
                onChange={(e) =>
                  updateRow<RebateObjecion>("rebateObjeciones", i, {
                    rebateRecomendado: e.target.value,
                  })
                }
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Red flags */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center justify-between">
          <label className={labelCls}>Red flags</label>
          <button
            onClick={() => addRow<RedFlag>("redFlags", { flag: "", oportunidad: "" })}
            className="text-xs text-accent hover:underline"
          >
            + Añadir
          </button>
        </div>
        <div className="space-y-3">
          {a.redFlags.map((r, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex gap-2">
                <input
                  value={r.flag}
                  placeholder="Señal de riesgo"
                  onChange={(e) =>
                    updateRow<RedFlag>("redFlags", i, { flag: e.target.value })
                  }
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => removeRow("redFlags", i)}
                  className="rounded-lg border border-border px-2 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={r.oportunidad}
                placeholder="Cómo convertirla en mejora"
                onChange={(e) =>
                  updateRow<RedFlag>("redFlags", i, { oportunidad: e.target.value })
                }
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Secciones personalizadas (estructura de la firma) */}
      <div className="rounded-xl border border-accent/30 bg-accent-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-accent">
            Informe según la estructura de la firma
          </label>
          <button
            onClick={() =>
              addRow<CallAnalysis["seccionesPersonalizadas"][number]>(
                "seccionesPersonalizadas",
                { titulo: "", contenido: "" }
              )
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
                  onChange={(e) =>
                    updateRow<CallAnalysis["seccionesPersonalizadas"][number]>(
                      "seccionesPersonalizadas",
                      i,
                      { titulo: e.target.value }
                    )
                  }
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => removeRow("seccionesPersonalizadas", i)}
                  className="rounded-lg border border-border px-2 text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={s.contenido}
                placeholder="Contenido"
                onChange={(e) =>
                  updateRow<CallAnalysis["seccionesPersonalizadas"][number]>(
                    "seccionesPersonalizadas",
                    i,
                    { contenido: e.target.value }
                  )
                }
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
