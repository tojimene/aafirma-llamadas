import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Estos paquetes generan documentos en el servidor y no deben empaquetarse.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
