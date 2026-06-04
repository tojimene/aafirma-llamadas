import { embedBatch } from "./ai";
import { LEARNING_CATEGORY } from "./constants";
import { getServiceClient } from "./supabase";
import { chunkText } from "./text";
import type { CallAnalysis } from "./analysis";

// Construye una "lección" concisa a partir del análisis de una llamada.
// El objetivo es que el sistema RECUERDE los patrones y rebates útiles para
// mejorar futuros análisis (aprendizaje continuo).
function buildLessonText(title: string, a: CallAnalysis): string {
  const parts: string[] = [];
  parts.push(`Lección aprendida de la llamada: "${title}".`);
  parts.push(`Resultado: ${a.resultadoProbable} (puntuación ${a.puntuacionGlobal}/100).`);
  if (a.resumen) parts.push(`Resumen: ${a.resumen}`);

  if (a.prioridades?.length) {
    parts.push(
      "Mejoras prioritarias:\n" +
        a.prioridades
          .map((p) => `- ${p.titulo}. Acción: ${p.accion}`)
          .join("\n")
    );
  }

  if (a.rebateObjeciones?.length) {
    parts.push(
      "Objeciones y cómo rebatirlas (modelo a seguir):\n" +
        a.rebateObjeciones
          .map((o) => `- Objeción: "${o.objecion}". Rebate recomendado: ${o.rebateRecomendado}`)
          .join("\n")
    );
  }

  const errores = [
    ...a.erroresSondeo,
    ...a.erroresPitch,
    ...a.erroresObjeciones,
  ]
    .map((h) => h.detalle)
    .filter(Boolean);
  if (errores.length) {
    parts.push("Errores a evitar:\n" + errores.map((e) => `- ${e}`).join("\n"));
  }

  return parts.join("\n\n");
}

// Indexa (o reindexa) la lección de una llamada en la base de conocimiento,
// para que la IA aprenda de cada llamada que se analiza. Best-effort: si algo
// falla, no debe romper el flujo principal.
export async function indexCallLearning(params: {
  callId: string;
  title: string;
  analysis: CallAnalysis;
  createdBy?: string | null;
}): Promise<void> {
  const { callId, title, analysis, createdBy } = params;

  try {
    const supabase = getServiceClient();

    // Elimina el aprendizaje previo de esta llamada (si se reanaliza/edita),
    // para no duplicar. Los chunks se borran en cascada.
    await supabase
      .from("knowledge_sources")
      .delete()
      .eq("call_id", callId)
      .eq("category", LEARNING_CATEGORY);

    const lesson = buildLessonText(title, analysis);
    const chunks = chunkText(lesson);
    if (!chunks.length) return;

    const { data: source, error: sourceError } = await supabase
      .from("knowledge_sources")
      .insert({
        title: `Aprendizaje · ${title}`,
        category: LEARNING_CATEGORY,
        description: "Lección generada automáticamente a partir de una llamada analizada.",
        full_content: lesson,
        char_count: lesson.length,
        chunk_count: chunks.length,
        call_id: callId,
        created_by: createdBy ?? null,
      })
      .select("id")
      .single();

    if (sourceError) throw sourceError;

    const embeddings = await embedBatch(chunks);
    const rows = chunks.map((chunk, i) => ({
      source_id: source.id,
      content: chunk,
      category: LEARNING_CATEGORY,
      embedding: embeddings[i],
    }));

    const { error: chunkError } = await supabase
      .from("knowledge_chunks")
      .insert(rows);
    if (chunkError) throw chunkError;
  } catch (err) {
    // No interrumpimos el flujo principal si el aprendizaje falla.
    console.error("indexCallLearning error:", err);
  }
}
