import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// In development the Go server runs on :8080 (npm run dev:server) and Vite
// proxies /api to it, so the browser talks to a single origin.
const API_TARGET = process.env.API_TARGET || "http://127.0.0.1:8080";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: false },
    },
  },
  preview: {
    host: "::",
    port: 4173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: false },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
}));
