import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/require-admin";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Actualiza un usuario: rol, estado activo o contraseña.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const isSelf = id === guard.session.user.id;

  try {
    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (typeof body.is_active === "boolean") {
      if (isSelf && body.is_active === false)
        return NextResponse.json(
          { error: "No puedes desactivar tu propia cuenta." },
          { status: 400 }
        );
      update.is_active = body.is_active;
    }

    if (body.role === "admin" || body.role === "analista") {
      if (isSelf && body.role !== "admin")
        return NextResponse.json(
          { error: "No puedes quitarte el rol de administrador a ti mismo." },
          { status: 400 }
        );
      update.role = body.role;
    }

    if (body.password) {
      if (String(body.password).length < 6)
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 6 caracteres." },
          { status: 400 }
        );
      update.password_hash = await bcrypt.hash(String(body.password), 12);
    }

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("app_users")
      .update(update)
      .eq("id", id)
      .select("id, email, full_name, role, is_active, last_login_at, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("users PATCH:", err);
    return NextResponse.json({ error: "Error al actualizar." }, { status: 500 });
  }
}

// Elimina un usuario.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  if (id === guard.session.user.id)
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta." },
      { status: 400 }
    );

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("users DELETE:", err);
    return NextResponse.json({ error: "Error al eliminar." }, { status: 500 });
  }
}
