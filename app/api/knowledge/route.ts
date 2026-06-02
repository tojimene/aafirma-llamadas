import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { embedBatch } from "@/lib/ai";
import { chunkText } from "@/lib/text";
import { getServiceClient } from "@/lib/supabase";
import { getKnowledgeType, REPORT_TEMPLATE_TYPE } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

// Lista el material de conocimiento.
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("id, title, category, description, char_count, chunk_count, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ sources: data ?? [] });
  } catch (err) {
    console.error("knowledge GET:", err);
    return NextResponse.json({ error: "Error al listar." }, { status: 500 });
  }
}

// Añade un documento: lo trocea, genera embeddings y lo indexa.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { title, category, description, content } = await req.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Faltan título o contenido." },
        { status: 400 }
      );
    }

    const type = getKnowledgeType(category);
    if (!type) {
      return NextResponse.json(
        { error: "Tipo de material no válido." },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // La estructura del informe no se indexa con RAG: se guarda completa
    // para inyectarla siempre en el análisis.
    const shouldEmbed = type.useRag;
    const chunks = shouldEmbed ? chunkText(content) : [];

    if (shouldEmbed && !chunks.length) {
      return NextResponse.json(
        { error: "El contenido no tiene texto utilizable." },
        { status: 422 }
      );
    }

    const { data: source, error: sourceError } = await supabase
      .from("knowledge_sources")
      .insert({
        title: title.trim(),
        category: type.value,
        description: description?.trim() || null,
        full_content: content,
        char_count: content.length,
        chunk_count: chunks.length,
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (sourceError) throw sourceError;

    if (shouldEmbed) {
      const embeddings = await embedBatch(chunks);
      const rows = chunks.map((chunk, i) => ({
        source_id: source.id,
        content: chunk,
        category: type.value,
        embedding: embeddings[i],
      }));

      const { error: chunkError } = await supabase
        .from("knowledge_chunks")
        .insert(rows);

      if (chunkError) throw chunkError;
    }

    return NextResponse.json({
      id: source.id,
      chunks: chunks.length,
      isTemplate: type.value === REPORT_TEMPLATE_TYPE,
    });
  } catch (err) {
    console.error("knowledge POST:", err);
    return NextResponse.json(
      { error: "Error al guardar el conocimiento." },
      { status: 500 }
    );
  }
}

// Elimina un documento (y sus fragmentos por cascade).
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  try {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("knowledge_sources")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("knowledge DELETE:", err);
    return NextResponse.json({ error: "Error al eliminar." }, { status: 500 });
  }
}
