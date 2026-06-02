import { auth } from "@/auth";
import { Session } from "next-auth";

type AdminResult =
  | { ok: true; session: Session }
  | { ok: false; status: number; error: string };

// Verifica que hay sesión y que el rol es admin. Para usar en route handlers.
export async function requireAdmin(): Promise<AdminResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, status: 401, error: "No autorizado" };
  }
  if (session.user.role !== "admin") {
    return { ok: false, status: 403, error: "Requiere permisos de administrador" };
  }
  return { ok: true, session };
}
