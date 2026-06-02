import mammoth from "mammoth";

// Extrae texto plano de un archivo subido (.txt, .md, .pdf, .docx).
// Se ejecuta solo en el servidor.
export async function extractTextFromFile(
  file: File
): Promise<{ text: string; warning?: string }> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return { text: buffer.toString("utf-8") };
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value };
  }

  if (name.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return { text: result.text };
    } finally {
      await parser.destroy();
    }
  }

  return {
    text: buffer.toString("utf-8"),
    warning: "Formato no reconocido; se intentó leer como texto plano.",
  };
}
