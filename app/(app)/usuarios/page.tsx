import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UsersManager from "@/components/UsersManager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-foreground">Usuarios</h1>
        <p className="mt-1 text-sm text-muted">
          Gestiona quién puede acceder a la herramienta.
        </p>
      </div>
      <UsersManager currentUserId={session.user.id} />
    </div>
  );
}
