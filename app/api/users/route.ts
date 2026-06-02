import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/require-admin";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lista los usuarios de la aplicación.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("app_users")
      .select("id, email, full_name, role, is_active, last_login_at, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ users: data ?? [] });
  } catch (err) {
    console.error("users GET:", err);
    return NextResponse.json({ error: "Error al listar usuarios." }, { status: 500 });
  }
}

// Crea un nuevo usuario.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { email, fullName, password, role } = await req.json();

    const cleanEmail = String(email ?? "").toLowerCase().trim();
    if (!EMAIL_RE.test(cleanEmail))
      return NextResponse.json({ error: "Email no válido." }, { status: 400 });
    if (!fullName?.trim())
      return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    if (!password || String(password).length < 6)
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );

    const supabase = getServiceClient();
    const passwordHash = await bcrypt.hash(String(password), 12);

    const { data, error } = await supabase
      .from("app_users")
      .insert({
        email: cleanEmail,
        full_name: fullName.trim(),
        password_hash: passwordHash,
        role: role === "admin" ? "admin" : "analista",
        is_active: true,
      })
      .select("id, email, full_name, role, is_active, created_at")
      .single();

    if (error) {
      if (error.code === "23505")
        return NextResponse.json(
          { error: "Ya existe un usuario con ese email." },
          { status: 409 }
        );
      throw error;
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("users POST:", err);
    return NextResponse.json({ error: "Error al crear el usuario." }, { status: 500 });
  }
}
