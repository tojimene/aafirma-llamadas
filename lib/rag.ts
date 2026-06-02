import { embedText } from "./ai";
import { RAG_TOP_K, REPORT_TEMPLATE_TYPE } from "./constants";
import { getServiceClient } from "./supabase";

export type KnowledgeMatch = {
  id: string;
  content: string;
  category: string;
  source_title: string;
  similarity: number;
};

// Recupera los fragmentos de conocimiento más relevantes para una llamada.
export async function retrieveKnowledge(
  query: string,
  topK: number = RAG_TOP_K
): Promise<KnowledgeMatch[]> {
  const supabase = getServiceClient();

  const queryEmbedding = await embedText(query);

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: queryEmbedding,
    match_count: topK,
    min_similarity: 0.15,
  });

  if (error) {
    console.error("Error en match_knowledge:", error.message);
    return [];
  }

  return (data ?? []) as KnowledgeMatch[];
}

export type ReportTemplate = {
  title: string;
  content: string;
};

// Obtiene la estructura de informe ACTIVA (la última subida). Null si no hay.
export async function getActiveReportTemplate(): Promise<ReportTemplate | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("title, full_content")
    .eq("category", REPORT_TEMPLATE_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.full_content) return null;

  return { title: data.title, content: data.full_content };
}

// Construye el bloque de contexto que se inyecta al modelo.
export function buildContextBlock(matches: KnowledgeMatch[]): string {
  if (!matches.length) {
    return "(No hay material de referencia cargado todavía. Usa buenas prácticas generales de ventas consultivas.)";
  }

  return matches
    .map((m, i) => {
      const label = m.source_title || m.category;
      return `[Referencia ${i + 1} · ${label}]\n${m.content}`;
    })
    .join("\n\n---\n\n");
}
