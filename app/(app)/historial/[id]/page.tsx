import Link from "next/link";
import { notFound } from "next/navigation";
import AnalysisResult from "@/components/AnalysisResult";
import { getServiceClient } from "@/lib/supabase";
import type { CallAnalysis } from "@/lib/analysis";

export const dynamic = "force-dynamic";

async function getCall(id: string) {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("calls")
      .select("id, title, analysis, created_at")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getCall(id);

  if (!call || !call.analysis) notFound();

  const analysis = call.analysis as CallAnalysis;

  return (
    <div>
      <Link
        href="/historial"
        className="mb-4 inline-block text-sm text-muted transition hover:text-foreground"
      >
        ← Volver al historial
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-foreground">{call.title}</h1>
          <p className="mt-1 text-xs text-muted">
            {new Date(call.created_at).toLocaleString("es-ES", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
        <a
          href={`/api/report/${call.id}`}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          ↓ Descargar informe Word
        </a>
      </div>

      <AnalysisResult analysis={analysis} />
    </div>
  );
}
