import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const supabase = getServiceClient();

    const [callsCount, knowledgeCount, recent, scores] = await Promise.all([
      supabase.from("calls").select("id", { count: "exact", head: true }),
      supabase
        .from("knowledge_sources")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("calls")
        .select("id, title, score, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("calls").select("score").not("score", "is", null),
    ]);

    const scoreValues = (scores.data ?? [])
      .map((r) => r.score as number)
      .filter((n) => typeof n === "number");
    const avgScore = scoreValues.length
      ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
      : null;

    return {
      totalCalls: callsCount.count ?? 0,
      totalKnowledge: knowledgeCount.count ?? 0,
      avgScore,
      recent: recent.data ?? [],
      error: false,
    };
  } catch {
    return {
      totalCalls: 0,
      totalKnowledge: 0,
      avgScore: null,
      recent: [],
      error: true,
    };
  }
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-serif mt-2 text-3xl text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Panel</h1>
          <p className="mt-1 text-sm text-muted">
            Resumen de la actividad de análisis de llamadas.
          </p>
        </div>
        <Link
          href="/analizar"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          + Analizar llamada
        </Link>
      </div>

      {stats.error && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          No se pudo conectar a la base de datos. Revisa las variables de
          entorno de Supabase y que el esquema SQL esté ejecutado.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Llamadas analizadas" value={String(stats.totalCalls)} />
        <StatCard
          label="Documentos de conocimiento"
          value={String(stats.totalKnowledge)}
          hint="Material que alimenta el análisis"
        />
        <StatCard
          label="Puntuación media"
          value={stats.avgScore !== null ? `${stats.avgScore}/100` : "—"}
        />
      </div>

      <h2 className="font-serif mt-10 mb-3 text-xl text-foreground">
        Últimas llamadas
      </h2>
      <div className="rounded-xl border border-border bg-surface">
        {stats.recent.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            Aún no hay llamadas analizadas.{" "}
            <Link href="/analizar" className="text-accent hover:underline">
              Analiza la primera
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recent.map((call) => (
              <li key={call.id}>
                <Link
                  href={`/historial/${call.id}`}
                  className="flex items-center justify-between px-5 py-4 transition hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {call.title}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(call.created_at).toLocaleString("es-ES", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  {typeof call.score === "number" && (
                    <span className="ml-4 shrink-0 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                      {call.score}/100
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
