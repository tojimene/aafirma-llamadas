import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WebSocketImpl from "ws";

// Node < 22 no trae WebSocket global; supabase-js lo necesita al iniciar realtime.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}

let cachedClient: SupabaseClient | null = null;

// Cliente de servidor con service_role. SOLO usar en el backend (API routes / server actions).
// Nunca exponer la service key al cliente.
export function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}
