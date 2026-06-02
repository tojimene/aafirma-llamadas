"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCallButton({
  callId,
  title,
}: {
  callId: string;
  title: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar la llamada "${title}"? Esta acción no se puede deshacer.`))
      return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/calls/${callId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo eliminar.");
        return;
      }
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      title="Eliminar llamada"
      className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
    >
      {isDeleting ? "…" : "Eliminar"}
    </button>
  );
}
