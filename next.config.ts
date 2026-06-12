import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Evita che Turbopack scelga ~/ come root per via del package-lock.json in home.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
