"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Panel", icon: "▦", adminOnly: false },
  { href: "/analizar", label: "Analizar llamada", icon: "✦", adminOnly: false },
  { href: "/conocimiento", label: "Base de conocimiento", icon: "▤", adminOnly: false },
  { href: "/historial", label: "Historial", icon: "↻", adminOnly: false },
  { href: "/usuarios", label: "Usuarios", icon: "◍", adminOnly: true },
];

type SidebarProps = {
  userName: string;
  userRole: string;
};

export default function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-3 px-5 py-6">
        <Image
          src="/logo.png"
          alt="AA Firma"
          width={36}
          height={36}
          className="rounded-md"
        />
        <div className="leading-tight">
          <p className="font-serif text-sm text-foreground">AA Firma</p>
          <p className="text-[11px] text-muted">Análisis de llamadas</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        {NAV_ITEMS.filter(
          (item) => !item.adminOnly || userRole === "admin"
        ).map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <span className="w-4 text-center text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm text-foreground">{userName}</p>
          <p className="text-[11px] capitalize text-muted">{userRole}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition hover:bg-surface-2 hover:text-danger"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
