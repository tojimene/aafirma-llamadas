"use client";

import { useEffect, useState } from "react";

type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export default function UsersManager({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analista");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (active) setUsers(data.users ?? []);
      } catch {
        if (active) setUsers([]);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear.");
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("analista");
      setNotice("Usuario creado correctamente.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear.");
    } finally {
      setIsCreating(false);
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setError("");
    setNotice("");
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error al actualizar.");
      return;
    }
    await loadUsers();
  }

  async function handleResetPassword(id: string, name: string) {
    const newPass = prompt(`Nueva contraseña para ${name} (mínimo 6 caracteres):`);
    if (!newPass) return;
    await patchUser(id, { password: newPass });
    setNotice("Contraseña actualizada.");
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar al usuario ${name}? Esta acción no se puede deshacer.`))
      return;
    setError("");
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error al eliminar.");
      return;
    }
    await loadUsers();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* Crear usuario */}
      <div>
        <h2 className="font-serif mb-4 text-xl text-foreground">Crear usuario</h2>
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-xl border border-border bg-surface p-5"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Contraseña
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            >
              <option value="analista">Analista</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-success">{notice}</p>}

          <button
            type="submit"
            disabled={isCreating}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isCreating ? "Creando…" : "Crear usuario"}
          </button>
        </form>
      </div>

      {/* Listado */}
      <div>
        <h2 className="font-serif mb-4 text-xl text-foreground">
          Usuarios ({users.length})
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <li
                  key={u.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {u.full_name}
                        </p>
                        {isSelf && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                            tú
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            u.role === "admin"
                              ? "bg-accent text-background"
                              : "bg-surface-2 text-muted"
                          }`}
                        >
                          {u.role === "admin" ? "ADMIN" : "ANALISTA"}
                        </span>
                        {!u.is_active && (
                          <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-semibold text-danger">
                            INACTIVO
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {u.last_login_at
                          ? `Último acceso: ${new Date(u.last_login_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}`
                          : "Nunca ha accedido"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() =>
                          patchUser(u.id, {
                            role: u.role === "admin" ? "analista" : "admin",
                          })
                        }
                        disabled={isSelf}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition hover:text-foreground disabled:opacity-30"
                      >
                        {u.role === "admin" ? "Hacer analista" : "Hacer admin"}
                      </button>
                      <button
                        onClick={() => patchUser(u.id, { is_active: !u.is_active })}
                        disabled={isSelf}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition hover:text-foreground disabled:opacity-30"
                      >
                        {u.is_active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id, u.full_name)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition hover:text-foreground"
                      >
                        Cambiar clave
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.full_name)}
                        disabled={isSelf}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition hover:text-danger disabled:opacity-30"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
