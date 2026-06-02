import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { getServiceClient } from "./lib/supabase";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const supabase = getServiceClient();
        const { data: user, error } = await supabase
          .from("app_users")
          .select("id, email, full_name, password_hash, role, is_active")
          .eq("email", email)
          .single();

        if (error || !user || !user.is_active) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        await supabase
          .from("app_users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
        };
      },
    }),
  ],
});
