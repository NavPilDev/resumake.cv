import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) resolves its worker script relative to its
  // own file on disk at runtime. Left to the default bundler behavior, the
  // dev server traces it into a server chunk and that relative resolution
  // breaks ("Cannot find module .../pdf.worker.mjs"). Excluding it from
  // bundling leaves it as a normal node_modules require, which resolves
  // correctly.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
