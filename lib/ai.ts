import OpenAI from "openai";
import { EMBEDDING_MODEL, OPENROUTER_MODEL } from "./constants";

// Cliente para el análisis (chat) vía OpenRouter.
function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Falta la variable de entorno OPENROUTER_API_KEY.");

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "AA Firma · Análisis de Llamadas",
    },
  });
}

// Cliente para embeddings vía OpenAI (OpenRouter no expone embeddings de forma fiable).
function getEmbeddingsClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta la variable de entorno OPENAI_API_KEY.");
  return new OpenAI({ apiKey });
}

// Genera el embedding de un texto.
export async function embedText(text: string): Promise<number[]> {
  const client = getEmbeddingsClient();
  const input = text.replace(/\n+/g, " ").trim().slice(0, 8000);
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });
  return res.data[0].embedding;
}

// Genera embeddings para varios textos en una sola llamada (más barato).
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getEmbeddingsClient();
  const input = texts.map((t) => t.replace(/\n+/g, " ").trim().slice(0, 8000));
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });
  return res.data.map((d) => d.embedding);
}

type ChatOptions = {
  system: string;
  user: string;
  temperature?: number;
  jsonMode?: boolean;
};

// Llama al modelo de análisis vía OpenRouter.
export async function chatComplete({
  system,
  user,
  temperature = 0.3,
  jsonMode = false,
}: ChatOptions): Promise<string> {
  const client = getOpenRouterClient();

  const res = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  return res.choices[0]?.message?.content ?? "";
}
