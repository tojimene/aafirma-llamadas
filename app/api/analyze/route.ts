import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzeCall } from "@/lib/analysis";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Vercel: Hobby admite hasta 60s; Pro hasta 300s. Sube este valor si usas Pro.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { title, transcript } = await req.json();

    if (!transcript || transcript.trim().length < 50) {
      return NextResponse.json(
        { error: "La transcripción es demasiado corta." },
        { status: 400 }
      );
    }

    const { analysis, referencesUsed } = await analyzeCall(transcript);

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("calls")
      .insert({
        title: title?.trim() || "Llamada sin título",
        transcript,
        status: "completado",
        score: analysis.puntuacionGlobal,
        analysis,
        references_used: referencesUsed,
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id, analysis, referencesUsed });
  } catch (err) {
    console.error("analyze error:", err);
    const message =
      err instanceof Error ? err.message : "Error en el análisis.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
