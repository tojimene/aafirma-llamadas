"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACCEPTED_FILE_TYPES,
  KNOWLEDGE_TYPES,
  REPORT_TEMPLATE_TYPE,
} from "@/lib/constants";

type KnowledgeSource = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  char_count: number;
  chunk_count: number;
  created_at: string;
};

export default function ConocimientoPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeType, setActiveType] = useState(KNOWLEDGE_TYPES[0].value);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const currentType = KNOWLEDGE_TYPES.find((t) => t.value === activeType)!;

  const filteredSources = useMemo(
    () => sources.filter((s) => s.category === activeType),
    [sources, activeType]
  );

  async function loadSources() {
    try {
      const res = await fetch("/api/knowledge");
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch {
      setSources([]);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/knowledge");
        const data = await res.json();
        if (active) setSources(data.sources ?? []);
      } catch {
        if (active) setSources([]);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function switchTab(value: string) {
    setActiveType(value);
    setError("");
  }

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
      setContent((prev) => (prev ? prev + "\n\n" : "") + data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer el archivo.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setError("");
    if (!title.trim()) return setError("Añade un título.");
    if (content.trim().length < 20)
      return setError("El contenido es demasiado corto.");

    setIsSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: activeType,
          description: description.trim(),
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setTitle("");
      setDescription("");
      setContent("");
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento de la base de conocimiento?")) return;
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    await loadSources();
  }

  const isTemplateType = activeType === REPORT_TEMPLATE_TYPE;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-foreground">
          Base de conocimiento
        </h1>
        <p className="mt-1 text-sm text-muted">
          Material que alimenta y da forma a cada análisis.
        </p>
      </div>

      {/* Pestañas por tipo */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {KNOWLEDGE_TYPES.map((t) => {
          const count = sources.filter((s) => s.category === t.value).length;
          const isActive = t.value === activeType;
          return (
            <button
              key={t.value}
              onClick={() => switchTab(t.value)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.shortLabel}
              {count > 0 && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mb-6 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-muted">
        {currentType.description}
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Formulario */}
        <div className="space-y-4">
          <h2 className="font-serif text-xl text-foreground">
            Añadir · {currentType.shortLabel}
          </h2>

          {isTemplateType && (
            <div className="rounded-lg border border-accent/30 bg-accent-soft p-3 text-xs text-accent">
              Solo se usa la <strong>última</strong> estructura subida. Define
              aquí las secciones que quieres que tenga el documento Word final
              (p. ej. &ldquo;Resumen ejecutivo&rdquo;, &ldquo;Errores
              críticos&rdquo;, &ldquo;Plan de mejora&rdquo;…).
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isTemplateType
                  ? "Ej. Plantilla de informe de calidad v1"
                  : "Ej. Llamada modelo · cierre exitoso"
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted">
                {isTemplateType ? "Estructura / secciones" : "Contenido"}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                {isExtracting ? "Leyendo…" : "+ Subir archivo"}
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
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder={
                isTemplateType
                  ? "Lista las secciones del informe final, una por línea o con descripción de qué debe contener cada una…"
                  : "Pega aquí la transcripción de la buena llamada, el SOP o el guion…"
              }
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            onClick={handleSave}
            disabled={isSaving || isExtracting}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isSaving
              ? isTemplateType
                ? "Guardando estructura…"
                : "Guardando e indexando…"
              : "Guardar"}
          </button>
        </div>

        {/* Listado del tipo activo */}
        <div>
          <h2 className="font-serif mb-4 text-xl text-foreground">
            {currentType.shortLabel} cargado
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : filteredSources.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
              Todavía no hay material de este tipo.
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredSources.map((s, index) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {s.title}
                        </p>
                        {isTemplateType && index === 0 && (
                          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-background">
                            ACTIVA
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="mt-1 text-xs text-muted">{s.description}</p>
                      )}
                      <p className="mt-2 text-[11px] text-muted">
                        {isTemplateType
                          ? `${s.char_count.toLocaleString("es-ES")} caracteres`
                          : `${s.chunk_count} fragmentos · ${s.char_count.toLocaleString("es-ES")} caracteres`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="shrink-0 text-xs text-muted transition hover:text-danger"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
