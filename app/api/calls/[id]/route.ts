import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getServiceClient } from "@/lib/supabase";
import type { CallAnalysis } from "@/lib/analysis";

export const runtime = "nodejs";

// Guarda cambios en una llamada (título y/o análisis editado).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim())
      update.title = body.title.trim();

    if (body.analysis) {
      const analysis = body.analysis as CallAnalysis;
      update.analysis = analysis;
      if (typeof analysis.puntuacionGlobal === "number")
        update.score = analysis.puntuacionGlobal;
    }

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("calls")
      .update(update)
      .eq("id", id)
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("calls PATCH:", err);
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }
}

// Elimina una llamada analizada.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("calls").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("calls DELETE:", err);
    return NextResponse.json({ error: "Error al eliminar." }, { status: 500 });
  }
}
