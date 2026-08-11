import type { NextConfig } from "next";

// O app tem ações destrutivas de um clique (excluir imóvel, excluir coluna
// com os imóveis dentro). Os cookies do Supabase são SameSite=Lax, o que já
// barra a maior parte de um ataque de clickjacking, mas estes cabeçalhos
// fecham o caso e custam nada.
//
// Não há CSP de script aqui de propósito: o Next injeta scripts inline e uma
// política restritiva exigiria encanamento de nonce no proxy, com risco de
// quebrar a hidratação. O `frame-ancestors` cobre o risco real deste app.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Esconde "X-Powered-By: Next.js" — não é uma defesa, só evita entregar
  // a versão do framework de graça para scanners.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
