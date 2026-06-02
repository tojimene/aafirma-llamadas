import { chatComplete } from "./ai";
import {
  buildContextBlock,
  getActiveReportTemplate,
  retrieveKnowledge,
} from "./rag";

export type ScoredItem = {
  fase: string;
  puntuacion: number; // 0-100
  comentario: string;
};

export type CustomSection = {
  titulo: string;
  contenido: string;
};

export type CallAnalysis = {
  resumen: string;
  puntuacionGlobal: number; // 0-100
  sentimientoCliente: string;
  resultadoProbable: string;
  fortalezas: string[];
  debilidades: string[];
  oportunidadesMejora: string[];
  fases: ScoredItem[];
  objecionesDetectadas: string[];
  frasesDestacadas: { cita: string; comentario: string }[];
  recomendacionesAccionables: string[];
  proximaLlamada: string[];
  // Secciones que siguen la "estructura del informe" definida por la firma.
  seccionesPersonalizadas: CustomSection[];
};

const SYSTEM_PROMPT = `Eres un analista senior de calidad de llamadas de venta para Alvarado Abreu Firma & Co., un despacho de abogados de Costa Rica especializado en Ley Concursal, refinanciamiento de pasivos e intermediación bancaria.

Tu trabajo es analizar en profundidad la transcripción de una llamada de venta y devolver una evaluación rigurosa, objetiva y accionable. Debes basarte SIEMPRE que sea posible en el MATERIAL DE REFERENCIA proporcionado (estructuras ideales, correcciones previas y guiones de la firma). Si el material de referencia indica un criterio, ese criterio tiene prioridad sobre las buenas prácticas genéricas.

Reglas:
- Sé concreto y cita momentos de la llamada cuando justifiques un punto.
- No inventes datos que no estén en la transcripción.
- Las puntuaciones van de 0 a 100.
- Escribe en español neutro y profesional.
- Devuelve EXCLUSIVAMENTE un objeto JSON válido con el esquema indicado, sin texto adicional.`;

function buildUserPrompt(
  transcript: string,
  context: string,
  template: string | null
): string {
  const templateBlock = template
    ? `\n==============================
ESTRUCTURA DEL INFORME FINAL (definida por la firma).
Debes rellenar "seccionesPersonalizadas" siguiendo EXACTAMENTE estas secciones,
en el mismo orden, con el contenido analizado de esta llamada:
${template}
==============================\n`
    : "";

  const customField = template
    ? `,\n  "seccionesPersonalizadas": [{"titulo": "nombre de la sección de la plantilla", "contenido": "texto desarrollado para esta llamada"}]`
    : `,\n  "seccionesPersonalizadas": []`;

  return `MATERIAL DE REFERENCIA DE LA FIRMA (llamadas modelo, SOPs y guiones · usar como criterio principal):
${context}
${templateBlock}
==============================
TRANSCRIPCIÓN DE LA LLAMADA A ANALIZAR:
${transcript}
==============================

Analiza la llamada y responde con un JSON con EXACTAMENTE esta forma:
{
  "resumen": "string (3-5 frases)",
  "puntuacionGlobal": number,
  "sentimientoCliente": "string corto",
  "resultadoProbable": "string corto (p.ej. 'Alta probabilidad de cierre', 'Necesita seguimiento', 'Perdida')",
  "fortalezas": ["string", ...],
  "debilidades": ["string", ...],
  "oportunidadesMejora": ["string", ...],
  "fases": [{"fase": "Apertura/Descubrimiento/Propuesta/Manejo de objeciones/Cierre", "puntuacion": number, "comentario": "string"}],
  "objecionesDetectadas": ["string", ...],
  "frasesDestacadas": [{"cita": "frase textual de la llamada", "comentario": "por qué es relevante"}],
  "recomendacionesAccionables": ["string", ...],
  "proximaLlamada": ["string", ...]${customField}
}`;
}

function safeParse(raw: string): CallAnalysis {
  let text = raw.trim();
  // Quitar fences por si el modelo los añade.
  text = text.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

  const parsed = JSON.parse(text);

  return {
    resumen: parsed.resumen ?? "",
    puntuacionGlobal: Number(parsed.puntuacionGlobal ?? 0),
    sentimientoCliente: parsed.sentimientoCliente ?? "No determinado",
    resultadoProbable: parsed.resultadoProbable ?? "No determinado",
    fortalezas: parsed.fortalezas ?? [],
    debilidades: parsed.debilidades ?? [],
    oportunidadesMejora: parsed.oportunidadesMejora ?? [],
    fases: parsed.fases ?? [],
    objecionesDetectadas: parsed.objecionesDetectadas ?? [],
    frasesDestacadas: parsed.frasesDestacadas ?? [],
    recomendacionesAccionables: parsed.recomendacionesAccionables ?? [],
    proximaLlamada: parsed.proximaLlamada ?? [],
    seccionesPersonalizadas: Array.isArray(parsed.seccionesPersonalizadas)
      ? parsed.seccionesPersonalizadas.filter(
          (s: CustomSection) => s && s.titulo
        )
      : [],
  };
}

export type ProgressStage =
  | "recuperando"
  | "plantilla"
  | "analizando"
  | "procesando";

export type ProgressEvent = {
  stage: ProgressStage;
  pct: number;
  message: string;
};

type OnProgress = (e: ProgressEvent) => void | Promise<void>;

// Ejecuta el análisis completo de una transcripción usando RAG + LLM.
// Acepta un callback opcional para reportar el progreso por fases.
export async function analyzeCall(
  transcript: string,
  onProgress?: OnProgress
): Promise<{
  analysis: CallAnalysis;
  referencesUsed: { title: string; category: string; similarity: number }[];
}> {
  const emit = async (e: ProgressEvent) => {
    if (onProgress) await onProgress(e);
  };

  await emit({
    stage: "recuperando",
    pct: 15,
    message: "Recuperando material de la base de conocimiento…",
  });
  const matches = await retrieveKnowledge(transcript.slice(0, 6000));

  await emit({
    stage: "plantilla",
    pct: 30,
    message: "Cargando la estructura del informe…",
  });
  const template = await getActiveReportTemplate();
  const context = buildContextBlock(matches);

  await emit({
    stage: "analizando",
    pct: 45,
    message: "Analizando la llamada con IA (esto es lo que más tarda)…",
  });
  const raw = await chatComplete({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(transcript, context, template?.content ?? null),
    temperature: 0.3,
    jsonMode: true,
  });

  await emit({
    stage: "procesando",
    pct: 85,
    message: "Procesando el resultado…",
  });
  const analysis = safeParse(raw);

  return {
    analysis,
    referencesUsed: matches.map((m) => ({
      title: m.source_title || m.category,
      category: m.category,
      similarity: m.similarity,
    })),
  };
}
