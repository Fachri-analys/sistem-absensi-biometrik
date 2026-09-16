/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" menghasilkan bundle server minimal (hanya file yang benar-
  // benar dipakai) — penting untuk image Docker yang kecil di topologi
  // on-prem mini PC (docs/11-DEPLOYMENT.md §6), bukan menyalin seluruh
  // node_modules mentah-mentah ke image produksi.
  output: "standalone",

  // Header keamanan dasar di level HTTP response (docs/06-SECURITY-SPEC.md).
  // Ini pelengkap, BUKAN pengganti — CORS/CSRF/rate-limit tetap ditegakkan
  // di kode (lib/rate-limit.ts, lib/require-auth.ts), header ini lapisan
  // pertahanan tambahan di level browser.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  eslint: {
    // Build produksi tidak boleh gagal cuma karena lint warning — lint tetap
    // dijalankan terpisah di CI (`npm run lint`) sebagai gate sendiri,
    // bukan digabung ke build step yang tujuannya beda.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
