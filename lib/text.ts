import { CHUNK_OVERLAP, CHUNK_SIZE } from "./constants";

// Trocea un texto largo en fragmentos solapados para indexar (RAG).
export function chunkText(
  text: string,
  size: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= size) return clean.length ? [clean] : [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    // Intentar cortar en un salto de párrafo o frase cercano para no partir ideas.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n")
      );
      if (lastBreak > size * 0.5) end = start + lastBreak + 1;
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= clean.length) break;
    start = end - overlap;
  }

  return chunks;
}

// Estimación simple de tokens (~4 chars por token) para acotar contexto.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
