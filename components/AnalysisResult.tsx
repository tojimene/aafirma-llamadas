import { CallAnalysis } from "@/lib/analysis";

function scoreColor(score: number): string {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-accent";
  return "text-danger";
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground">
              <span className="text-accent">›</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">— Sin elementos —</p>
      )}
    </div>
  );
}

export default function AnalysisResult({
  analysis,
}: {
  analysis: CallAnalysis;
}) {
  return (
    <div className="space-y-6">
      {/* Cabecera con puntuación */}
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-8 text-center">
        <div className="flex items-baseline gap-1">
          <span
            className={`font-serif text-6xl ${scoreColor(
              analysis.puntuacionGlobal
            )}`}
          >
            {analysis.puntuacionGlobal}
          </span>
          <span className="text-xl text-muted">/100</span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted">
          <span>
            Sentimiento:{" "}
            <span className="text-foreground">{analysis.sentimientoCliente}</span>
          </span>
          <span>
            Resultado:{" "}
            <span className="text-foreground">{analysis.resultadoProbable}</span>
          </span>
        </div>
      </div>

      {/* Resumen */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Resumen ejecutivo
        </h3>
        <p className="text-sm leading-relaxed text-foreground">
          {analysis.resumen}
        </p>
      </div>

      {/* Fases */}
      {analysis.fases.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Evaluación por fases
          </h3>
          <div className="space-y-4">
            {analysis.fases.map((fase, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {fase.fase}
                  </span>
                  <span className={`text-sm font-medium ${scoreColor(fase.puntuacion)}`}>
                    {fase.puntuacion}/100
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, Math.max(0, fase.puntuacion))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">{fase.comentario}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <ListBlock title="Fortalezas" items={analysis.fortalezas} />
        <ListBlock title="Debilidades" items={analysis.debilidades} />
        <ListBlock
          title="Oportunidades de mejora"
          items={analysis.oportunidadesMejora}
        />
        <ListBlock
          title="Objeciones detectadas"
          items={analysis.objecionesDetectadas}
        />
      </div>

      {/* Frases destacadas */}
      {analysis.frasesDestacadas.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Frases destacadas
          </h3>
          <div className="space-y-4">
            {analysis.frasesDestacadas.map((f, i) => (
              <div key={i} className="border-l-2 border-accent pl-4">
                <p className="text-sm italic text-accent">&ldquo;{f.cita}&rdquo;</p>
                <p className="mt-1 text-xs text-muted">{f.comentario}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <ListBlock
          title="Recomendaciones accionables"
          items={analysis.recomendacionesAccionables}
        />
        <ListBlock
          title="Próxima llamada"
          items={analysis.proximaLlamada}
        />
      </div>

      {/* Secciones según la estructura del informe de la firma */}
      {analysis.seccionesPersonalizadas?.length > 0 && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-accent">
            Informe según la estructura de la firma
          </h3>
          <div className="space-y-5">
            {analysis.seccionesPersonalizadas.map((s, i) => (
              <div key={i}>
                <h4 className="mb-1 text-sm font-semibold text-foreground">
                  {s.titulo}
                </h4>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                  {s.contenido}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
