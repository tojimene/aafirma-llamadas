import { embedText } from "./ai";
import {
  LEARNING_CATEGORY,
  RAG_TOP_K,
  REPORT_TEMPLATE_TYPE,
} from "./constants";
import { getServiceClient } from "./supabase";

export type KnowledgeMatch = {
  id: string;
  content: string;
  category: string;
  source_title: string;
  similarity: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  llamada_modelo: "Llamada modelo (así debe hacerse)",
  sop_guion: "SOP / guion / indicación",
  [LEARNING_CATEGORY]: "Aprendizaje de una llamada anterior",
};

// Llama a la RPC de búsqueda semántica, opcionalmente filtrando por categoría.
// Tiene un fallback por si la BD aún no tiene el parámetro filter_category
// (función antigua de 3 argumentos): en ese caso filtra en cliente.
async function matchKnowledge(
  queryEmbedding: number[],
  count: number,
  category?: string
): Promise<KnowledgeMatch[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: queryEmbedding,
    match_count: count,
    min_similarity: 0.05,
    filter_category: category ?? null,
  });

  if (!error) return (data ?? []) as KnowledgeMatch[];

  // Fallback: BD con la función antigua sin filter_category.
  const fallback = await supabase.rpc("match_knowledge", {
    query_embedding: queryEmbedding,
    match_count: category ? count * 6 : count,
    min_similarity: 0.05,
  });
  if (fallback.error) {
    console.error("Error en match_knowledge:", fallback.error.message);
    return [];
  }
  let rows = (fallback.data ?? []) as KnowledgeMatch[];
  if (category) rows = rows.filter((r) => r.category === category).slice(0, count);
  return rows;
}

// Recupera conocimiento relevante GARANTIZANDO una mezcla equilibrada:
// llamadas modelo + SOPs/guiones + aprendizajes de llamadas anteriores.
// Así el modelo siempre "lee" la documentación clave, no solo lo más parecido.
export async function retrieveKnowledge(
  query: string,
  topK: number = RAG_TOP_K
): Promise<KnowledgeMatch[]> {
  const queryEmbedding = await embedText(query);

  // Cuotas por categoría para asegurar representación de cada tipo de material.
  const [modelos, sops, aprendizajes, general] = await Promise.all([
    matchKnowledge(queryEmbedding, 4, "llamada_modelo"),
    matchKnowledge(queryEmbedding, 4, "sop_guion"),
    matchKnowledge(queryEmbedding, 3, LEARNING_CATEGORY),
    matchKnowledge(queryEmbedding, topK),
  ]);

  // Mezcla y deduplica por id, manteniendo el orden de prioridad.
  const seen = new Set<string>();
  const merged: KnowledgeMatch[] = [];
  for (const m of [...modelos, ...sops, ...aprendizajes, ...general]) {
    if (m.id && !seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }

  // Ordena por similitud descendente y limita el total inyectado.
  merged.sort((a, b) => b.similarity - a.similarity);
  return merged.slice(0, topK + 4);
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
      const tipo = CATEGORY_LABELS[m.category] || m.category;
      const titulo = m.source_title ? ` · ${m.source_title}` : "";
      return `[Referencia ${i + 1} · ${tipo}${titulo}]\n${m.content}`;
    })
    .join("\n\n---\n\n");
}
