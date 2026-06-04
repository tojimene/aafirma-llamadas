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

// Punto de la línea de tiempo: qué ocurre en cada momento de la llamada.
export type TimelineItem = {
  momento: string; // mm:ss (o vacío si la transcripción no trae marcas de tiempo)
  evento: string; // qué pasa en ese momento (1 frase)
};

// Hallazgo con localización temporal en la llamada.
// momento: "mm:ss" si la transcripción trae marcas de tiempo; vacío si no.
// cita: frase textual exacta de la transcripción para localizar el momento.
export type Hallazgo = {
  momento: string;
  cita: string;
  detalle: string;
};

// Prioridad 80/20: una de las pocas cosas con mayor impacto en mejorar la llamada.
export type Prioridad = {
  titulo: string;
  porque: string;
  accion: string;
  momento: string;
  cita: string;
};

export type RedFlag = {
  flag: string;
  oportunidad: string;
  momento: string;
  cita: string;
};

export type RebateObjecion = {
  objecion: string;
  manejoActual: string;
  rebateRecomendado: string;
  momento: string;
  cita: string;
};

export type CallAnalysis = {
  resumen: string;
  puntuacionGlobal: number; // 0-100
  resultadoProbable: string;
  // Recorrido cronológico de la llamada (qué pasa en cada minuto:segundo).
  lineaTiempo: TimelineItem[];
  // 80/20: las 2-3 cosas más importantes para mejorar la llamada.
  prioridades: Prioridad[];
  // Señales de riesgo que son oportunidades de mejora.
  redFlags: RedFlag[];
  // Errores por fase clave (con momento y cita textual).
  erroresSondeo: Hallazgo[];
  erroresPitch: Hallazgo[];
  erroresObjeciones: Hallazgo[];
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

MARCAS DE TIEMPO Y LOCALIZACIÓN (OBLIGATORIO):
- Para CADA hallazgo (prioridad, error de fase, red flag y objeción) indica DÓNDE ocurre en la llamada.
- Si la transcripción incluye marcas de tiempo (p.ej. [00:12], 00:12, 1:23, 12:34, "min 5"),
  copia en el campo "momento" el minuto:segundo EXACTO en formato mm:ss (o hh:mm:ss si la llamada es larga).
  Usa la marca de tiempo MÁS CERCANA que aparezca justo antes de la frase citada.
- Si la transcripción NO trae marcas de tiempo, deja "momento" como "" (cadena vacía).
- En "cita" copia SIEMPRE la frase textual EXACTA de la transcripción donde ocurre el hallazgo
  (lo más corta posible pero suficiente para localizarla). Nunca la dejes vacía.
- NUNCA inventes una marca de tiempo que no aparezca literalmente en la transcripción.

LÍNEA DE TIEMPO (campo "lineaTiempo"):
- Es un recorrido CRONOLÓGICO de la llamada para que el usuario sepa qué pasa en cada momento SIN tener que escucharla.
- Si la transcripción trae marcas de tiempo, la línea de tiempo es OBLIGATORIA: recorre la llamada en orden,
  con el mm:ss REAL de cada momento importante (saludo, sondeo, propuesta, precio, objeciones, cierre, etc.)
  y una frase corta de qué ocurre. Incluye entre 5 y 12 hitos según la longitud de la llamada.
- Si NO hay marcas de tiempo, deja "lineaTiempo" como [] (array vacío).

Reglas:
- Sé concreto y cita momentos/frases reales de la llamada para justificar cada punto.
- No inventes datos que no estén en la transcripción.
- Prioriza calidad sobre cantidad: pocas observaciones, pero las que más impactan.
- ESCRIBE PARA LECTURA RÁPIDA: frases cortas y directas. NADA de párrafos largos.
  Cada elemento de lista, máximo 1-2 frases. Cada campo "porque", "accion",
  "manejoActual", "rebateRecomendado", "oportunidad" debe ser conciso (1-2 frases).
  Para "seccionesPersonalizadas", usa frases cortas o viñetas separadas por saltos
  de línea, nunca un bloque denso.
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

Analiza la llamada y responde con un JSON con EXACTAMENTE esta forma.
RECUERDA: "momento" = mm:ss exacto si hay marcas de tiempo, si no "". "cita" = frase textual EXACTA de la llamada (nunca vacía).
{
  "resumen": "string (2-3 frases: qué pasó y dónde se ganó o perdió la venta)",
  "puntuacionGlobal": number,
  "resultadoProbable": "string corto (p.ej. 'Alta probabilidad de cierre', 'Necesita seguimiento', 'Perdida')",
  "lineaTiempo": [{"momento": "mm:ss real de la transcripción", "evento": "qué ocurre en ese momento (frase corta)"}],
  "prioridades": [{"titulo": "la mejora más importante", "porque": "por qué es lo que más impacta", "accion": "qué hacer exactamente la próxima vez", "momento": "mm:ss o ''", "cita": "frase textual exacta del momento clave"}],
  "redFlags": [{"flag": "señal de riesgo detectada en la llamada", "oportunidad": "cómo convertirla en mejora", "momento": "mm:ss o ''", "cita": "frase textual exacta"}],
  "erroresSondeo": [{"momento": "mm:ss o ''", "cita": "frase textual exacta donde ocurre", "detalle": "qué falló y por qué, en la fase de sondeo/descubrimiento"}],
  "erroresPitch": [{"momento": "mm:ss o ''", "cita": "frase textual exacta donde ocurre", "detalle": "qué falló y por qué, en la fase de pitch/propuesta"}],
  "erroresObjeciones": [{"momento": "mm:ss o ''", "cita": "frase textual exacta donde ocurre", "detalle": "qué falló y por qué, en el manejo y rebate de objeciones"}],
  "rebateObjeciones": [{"objecion": "objeción del cliente", "manejoActual": "cómo la manejó el asesor", "rebateRecomendado": "cómo debió rebatirla según el playbook", "momento": "mm:ss o ''", "cita": "frase textual exacta de la objeción"}],
  "seccionesPersonalizadas": ${seccionesSpec}
}

IMPORTANTE: en "prioridades" incluye SOLO 2 o 3, las de mayor impacto (regla 80/20).
Presta atención especial al rebate de objeciones, al debate de precio con estructura y al posicionamiento del coste de la inacción (deudas crecientes, embargos).`;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// Convierte una lista a Hallazgo[], aceptando tanto objetos {momento,cita,detalle}
// como strings sueltos (formato antiguo del modelo).
function toHallazgos(v: unknown): Hallazgo[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (typeof item === "string") {
        return { momento: "", cita: "", detalle: item };
      }
      const o = (item ?? {}) as Record<string, unknown>;
      return {
        momento: str(o.momento),
        cita: str(o.cita),
        detalle: str(o.detalle ?? o.descripcion ?? o.error ?? o.texto),
      };
    })
    .filter((h) => h.detalle.trim() || h.cita.trim());
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
    lineaTiempo: asArray<Record<string, unknown>>(parsed.lineaTiempo)
      .map((t) => ({ momento: str(t.momento), evento: str(t.evento) }))
      .filter((t) => t.evento.trim()),
    prioridades: asArray<Record<string, unknown>>(parsed.prioridades)
      .filter((p) => p?.titulo)
      .map((p) => ({
        titulo: str(p.titulo),
        porque: str(p.porque),
        accion: str(p.accion),
        momento: str(p.momento),
        cita: str(p.cita),
      })),
    redFlags: asArray<Record<string, unknown>>(parsed.redFlags)
      .filter((r) => r?.flag)
      .map((r) => ({
        flag: str(r.flag),
        oportunidad: str(r.oportunidad),
        momento: str(r.momento),
        cita: str(r.cita),
      })),
    erroresSondeo: toHallazgos(parsed.erroresSondeo),
    erroresPitch: toHallazgos(parsed.erroresPitch),
    erroresObjeciones: toHallazgos(parsed.erroresObjeciones),
    rebateObjeciones: asArray<Record<string, unknown>>(parsed.rebateObjeciones)
      .filter((o) => o?.objecion)
      .map((o) => ({
        objecion: str(o.objecion),
        manejoActual: str(o.manejoActual),
        rebateRecomendado: str(o.rebateRecomendado),
        momento: str(o.momento),
        cita: str(o.cita),
      })),
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
