import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractTextFromFile } from "@/lib/parse-file";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 }
      );
    }

    const { text, warning } = await extractTextFromFile(file);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del archivo." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: text.trim(), warning });
  } catch (err) {
    console.error("extract error:", err);
    return NextResponse.json(
      { error: "Error al procesar el archivo." },
      { status: 500 }
    );
  }
}
