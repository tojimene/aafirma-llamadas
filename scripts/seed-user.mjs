// Crea o actualiza un usuario de la aplicación.
// Uso:
//   node scripts/seed-user.mjs <email> <contraseña> "<Nombre Completo>" [admin|analista]
//
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import WebSocketImpl from "ws";

// Node < 22 no trae WebSocket global; supabase-js lo necesita al iniciar.
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocketImpl;
}

// Carga simple de .env.local sin dependencias.
function loadEnv() {
  try {
    const content = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2] ?? "";
      value = value.replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local opcional si las vars ya están en el entorno.
  }
}

loadEnv();

const [, , email, password, fullName, roleArg] = process.argv;

if (!email || !password || !fullName) {
  console.error(
    'Uso: node scripts/seed-user.mjs <email> <contraseña> "<Nombre Completo>" [admin|analista]'
  );
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const role = roleArg === "admin" ? "admin" : "analista";
const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const passwordHash = await bcrypt.hash(password, 12);

const { data, error } = await supabase
  .from("app_users")
  .upsert(
    {
      email: email.toLowerCase().trim(),
      full_name: fullName,
      password_hash: passwordHash,
      role,
      is_active: true,
    },
    { onConflict: "email" }
  )
  .select("id, email, full_name, role")
  .single();

if (error) {
  console.error("Error al crear el usuario:", error.message);
  process.exit(1);
}

console.log("Usuario listo:");
console.log(`  ${data.full_name} <${data.email}> · rol: ${data.role}`);
