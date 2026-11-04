/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Workers Assets で配信する静的書き出し（out/）。
  // SSR・API Routes は使っていない（データは /api/* の Worker から取得する）。
  output: "export",
};

module.exports = nextConfig;
