import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildReportDocx } from "@/lib/report-docx";
import { getServiceClient } from "@/lib/supabase";
import type { CallAnalysis } from "@/lib/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "informe";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  try {
    const supabase = getServiceClient();
    const { data: call, error } = await supabase
      .from("calls")
      .select("title, analysis, created_at, app_users:created_by(full_name)")
      .eq("id", id)
      .single();

    if (error || !call?.analysis) {
      return NextResponse.json(
        { error: "Llamada no encontrada." },
        { status: 404 }
      );
    }

    const analystName =
      (call.app_users as { full_name?: string } | null)?.full_name ??
      session.user.name ??
      undefined;

    const buffer = await buildReportDocx(call.analysis as CallAnalysis, {
      title: call.title,
      analystName,
      date: new Date(call.created_at),
    });

    const filename = `informe-${slugify(call.title)}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("report error:", err);
    return NextResponse.json(
      { error: "Error al generar el informe." },
      { status: 500 }
    );
  }
}
