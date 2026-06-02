"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError("Credenciales incorrectas o usuario inactivo.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="AA Firma"
            width={72}
            height={72}
            className="rounded-lg"
            priority
          />
          <h1 className="font-serif mt-6 text-2xl text-foreground">
            Alvarado Abreu Firma & Co.
          </h1>
          <p className="mt-1 text-sm text-muted">
            Análisis interno de llamadas de venta
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface p-6"
        >
          <label className="mb-1 block text-xs font-medium text-muted">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="mb-4 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            placeholder="tu@aafirma.co"
          />

          <label className="mb-1 block text-xs font-medium text-muted">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mb-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            placeholder="••••••••"
          />

          {error && (
            <p className="mb-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Verificando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Acceso restringido · Uso interno
        </p>
      </div>
    </main>
  );
}
