import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { analyzeCall } from "@/lib/analysis";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Vercel: Hobby admite hasta 60s; Pro hasta 300s. Sube este valor si usas Pro.
export const maxDuration = 60;

// Devuelve un stream NDJSON con eventos de progreso y, al final, el resultado.
// Cada línea es un objeto JSON: {stage,pct,message} | {done,id,analysis} | {error}
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let title = "Llamada sin título";
  let transcript = "";
  try {
    const body = await req.json();
    title = body.title?.trim() || title;
    transcript = body.transcript ?? "";
  } catch {
    return new Response(JSON.stringify({ error: "Petición no válida." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!transcript || transcript.trim().length < 50) {
    return new Response(
      JSON.stringify({ error: "La transcripción es demasiado corta." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        send({ stage: "iniciando", pct: 5, message: "Iniciando análisis…" });

        const { analysis, referencesUsed } = await analyzeCall(
          transcript,
          (e) => send(e)
        );

        send({ stage: "guardando", pct: 92, message: "Guardando la llamada…" });

        const supabase = getServiceClient();
        const { data, error } = await supabase
          .from("calls")
          .insert({
            title,
            transcript,
            status: "completado",
            score: analysis.puntuacionGlobal,
            analysis,
            references_used: referencesUsed,
            created_by: userId,
          })
          .select("id")
          .single();

        if (error) throw new Error(`Error al guardar en la base de datos: ${error.message}`);

        send({
          done: true,
          pct: 100,
          id: data.id,
          analysis,
          referencesUsed,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error desconocido en el análisis.";
        console.error("analyze stream error:", err);
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
