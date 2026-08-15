import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

/**
 * Relative asset URLs plus hash-based routing mean the build in dist/ can be
 * dropped at any path on any static host with no rewrite rules — the domain
 * root, a subdirectory, or straight off the filesystem.
 */
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
