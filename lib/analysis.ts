import { chatComplete } from "./ai";
import {
  buildContextBlock,
  getActiveReportTemplate,
  retrieveKnowledge,
} from "./rag";

export type CustomSection = {
  titulo: string;
  contenido: string;
};

// Prioridad 80/20: una de las pocas cosas con mayor impacto en mejorar la llamada.
export type Prioridad = {
  titulo: string;
  porque: string;
  accion: string;
};

export type RedFlag = {
  flag: string;
  oportunidad: string;
};

export type RebateObjecion = {
  objecion: string;
  manejoActual: string;
  rebateRecomendado: string;
};

export type CallAnalysis = {
  resumen: string;
  puntuacionGlobal: number; // 0-100
  resultadoProbable: string;
  // 80/20: las 2-3 cosas más importantes para mejorar la llamada.
  prioridades: Prioridad[];
  // Señales de riesgo que son oportunidades de mejora.
  redFlags: RedFlag[];
  // Errores por fase clave.
  erroresSondeo: string[];
  erroresPitch: string[];
  erroresObjeciones: string[];
  // Rebate de objeciones (prioridad de la firma).
  rebateObjeciones: RebateObjecion[];
  // Secciones que siguen la "estructura del informe" definida por la firma.
  seccionesPersonalizadas: CustomSection[];
};

const SYSTEM_PROMPT = `Eres el analista senior de calidad de llamadas de venta de Alvarado Abreu Firma & Co., un despacho de Costa Rica especializado en Ley Concursal, refinanciamiento de pasivos e intermediación bancaria.

Tu objetivo NO es hacer un informe largo, sino dar un diagnóstico SIMPLE, ENFOCADO y ACCIONABLE bajo el principio 80/20: identificar las POCAS cosas (2 o 3) que, si se corrigen, más mejorarían la llamada.

USA A FONDO EL MATERIAL DE REFERENCIA de la firma (llamadas modelo, SOPs, guiones, indicaciones). Compara la llamada analizada contra ese material. Si el material define un criterio, ese criterio MANDA sobre cualquier buena práctica genérica. Apóyate en las llamadas modelo para mostrar "así debería haberse hecho".

PLAYBOOK DE LA FIRMA (criterios que SIEMPRE debes evaluar):
1. REBATE DE OBJECIONES (máxima prioridad): evalúa cómo el asesor detecta y rebate cada objeción. Una objeción sin rebatir es un fallo grave.
2. DEBATE DE PRECIO CON ESTRUCTURA: el asesor no debe rendirse ante el "es caro". Debe anclar el valor y debatir el precio con una estructura clara (desglose, comparación, valor frente a la situación actual).
3. COSTE DE LA INACCIÓN vs COSTE DEL ACCESO: el asesor debe posicionar que NO actuar sale más caro: si el cliente no inicia ahora, sus deudas crecen, se expone a embargos y resolverlo después es más difícil y costoso. El coste del servicio se justifica frente al coste de no hacer nada.
4. SONDEO: descubrir bien la situación (monto de deuda, entidades, cuota, atraso, impacto emocional) antes de proponer.
5. PITCH: presentar la solución (protección legal de la Ley Concursal, autoridad de la firma) conectada a lo descubierto, sin hablar de más.

Reglas:
- Sé concreto y cita momentos/frases reales de la llamada para justificar cada punto.
- No inventes datos que no estén en la transcripción.
- Prioriza calidad sobre cantidad: pocas observaciones, pero las que más impactan.
- La puntuación global va de 0 a 100.
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
Además del análisis, rellena "seccionesPersonalizadas" siguiendo EXACTAMENTE estas
secciones, en el mismo orden, con el contenido analizado de esta llamada:
${template}
==============================\n`
    : "";

  const seccionesSpec = template
    ? `[{"titulo": "nombre de la sección de la plantilla", "contenido": "texto desarrollado para esta llamada"}]`
    : `[]`;

  return `MATERIAL DE REFERENCIA DE LA FIRMA (llamadas modelo, SOPs, guiones e indicaciones · úsalo a fondo como criterio principal):
${context}
${templateBlock}
==============================
TRANSCRIPCIÓN DE LA LLAMADA A ANALIZAR:
${transcript}
==============================

Analiza la llamada y responde con un JSON con EXACTAMENTE esta forma:
{
  "resumen": "string (2-3 frases: qué pasó y dónde se ganó o perdió la venta)",
  "puntuacionGlobal": number,
  "resultadoProbable": "string corto (p.ej. 'Alta probabilidad de cierre', 'Necesita seguimiento', 'Perdida')",
  "prioridades": [{"titulo": "la mejora más importante", "porque": "por qué es lo que más impacta", "accion": "qué hacer exactamente la próxima vez"}],
  "redFlags": [{"flag": "señal de riesgo detectada en la llamada", "oportunidad": "cómo convertirla en mejora"}],
  "erroresSondeo": ["errores concretos en la fase de sondeo/descubrimiento"],
  "erroresPitch": ["errores concretos en la fase de pitch/propuesta"],
  "erroresObjeciones": ["errores concretos en el manejo y rebate de objeciones"],
  "rebateObjeciones": [{"objecion": "objeción del cliente", "manejoActual": "cómo la manejó el asesor", "rebateRecomendado": "cómo debió rebatirla según el playbook"}],
  "seccionesPersonalizadas": ${seccionesSpec}
}

IMPORTANTE: en "prioridades" incluye SOLO 2 o 3, las de mayor impacto (regla 80/20).
Presta atención especial al rebate de objeciones, al debate de precio con estructura y al posicionamiento del coste de la inacción (deudas crecientes, embargos).`;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function safeParse(raw: string): CallAnalysis {
  let text = raw.trim();
  text = text.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

  const parsed = JSON.parse(text);

  return {
    resumen: parsed.resumen ?? "",
    puntuacionGlobal: Number(parsed.puntuacionGlobal ?? 0),
    resultadoProbable: parsed.resultadoProbable ?? "No determinado",
    prioridades: asArray<Prioridad>(parsed.prioridades).filter((p) => p?.titulo),
    redFlags: asArray<RedFlag>(parsed.redFlags).filter((r) => r?.flag),
    erroresSondeo: asArray<string>(parsed.erroresSondeo),
    erroresPitch: asArray<string>(parsed.erroresPitch),
    erroresObjeciones: asArray<string>(parsed.erroresObjeciones),
    rebateObjeciones: asArray<RebateObjecion>(parsed.rebateObjeciones).filter(
      (o) => o?.objecion
    ),
    seccionesPersonalizadas: asArray<CustomSection>(
      parsed.seccionesPersonalizadas
    ).filter((s) => s?.titulo),
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
  const matches = await retrieveKnowledge(transcript.slice(0, 8000));

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
