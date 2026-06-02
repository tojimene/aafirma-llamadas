// Modelos y parámetros centrales. Cambia el modelo aquí para toda la app.
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

// Dimensiones del modelo de embeddings (text-embedding-3-small = 1536).
export const EMBEDDING_DIM = 1536;

// Cuántos fragmentos de conocimiento se recuperan por análisis (RAG).
export const RAG_TOP_K = 6;

// Tamaño de los trozos de texto al indexar conocimiento.
export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 150;

export type KnowledgeType = {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
  // ¿Se indexa con embeddings para el RAG? La plantilla del informe no.
  useRag: boolean;
};

// Tipo especial: define la estructura del documento final descargable.
export const REPORT_TEMPLATE_TYPE = "estructura_informe";

// Los tres tipos de material de la base de conocimiento.
export const KNOWLEDGE_TYPES: KnowledgeType[] = [
  {
    value: "llamada_modelo",
    label: "Llamadas modelo (buenas)",
    shortLabel: "Llamadas modelo",
    description:
      "Transcripciones de llamadas excelentes. El sistema aprende de ellas cómo deben hacerse y compara las nuevas contra estas.",
    useRag: true,
  },
  {
    value: "sop_guion",
    label: "SOPs, guiones e indicaciones",
    shortLabel: "SOPs y guiones",
    description:
      "Procedimientos, guiones de objeciones e indicaciones de cómo debe llevarse la llamada y qué se debe analizar.",
    useRag: true,
  },
  {
    value: REPORT_TEMPLATE_TYPE,
    label: "Estructura del informe final",
    shortLabel: "Estructura informe",
    description:
      "Define las secciones que tendrá el documento Word descargable. Se usa siempre la última que subas.",
    useRag: false,
  },
];

export function getKnowledgeType(value: string): KnowledgeType | undefined {
  return KNOWLEDGE_TYPES.find((t) => t.value === value);
}

// Tipos de archivo aceptados para subir texto.
export const ACCEPTED_FILE_TYPES = ".txt,.md,.pdf,.docx";
