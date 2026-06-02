import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 usa "proxy" (antes "middleware"). Solo config edge-safe (sin DB).
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Protege todo salvo assets estáticos y la propia API de auth.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|logo.png|.*\\.png$).*)",
  ],
};
