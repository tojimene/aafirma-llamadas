import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getCalls() {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("calls")
      .select("id, title, score, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function HistorialPage() {
  const calls = await getCalls();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-foreground">Historial</h1>
        <p className="mt-1 text-sm text-muted">
          Todas las llamadas analizadas.
        </p>
      </div>

      {calls.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          Aún no hay llamadas analizadas.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {calls.map((call) => (
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
        </div>
      )}
    </div>
  );
}
