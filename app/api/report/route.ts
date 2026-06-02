import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildReportDocx } from "@/lib/report-docx";
import type { CallAnalysis } from "@/lib/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "informe"
  );
}

// Genera el Word a partir del análisis recibido en el cuerpo (permite editarlo
// antes de descargar, sin necesidad de guardarlo en la base de datos).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { title, analysis } = await req.json();
    if (!analysis)
      return NextResponse.json({ error: "Falta el análisis." }, { status: 400 });

    const buffer = await buildReportDocx(analysis as CallAnalysis, {
      title: title || "Informe de llamada",
      analystName: session.user.name ?? undefined,
      date: new Date(),
    });

    const filename = `informe-${slugify(title || "llamada")}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("report POST error:", err);
    return NextResponse.json(
      { error: "Error al generar el informe." },
      { status: 500 }
    );
  }
}
