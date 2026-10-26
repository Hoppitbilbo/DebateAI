import { defineConfig, loadEnv } from "vite";
import { execFileSync } from "node:child_process";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// In development the Go server runs on :8080 (npm run dev:server) and Vite
// proxies /api to it, so the browser talks to a single origin.
const API_TARGET = process.env.API_TARGET || "http://127.0.0.1:8080";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let release = env.SENTRY_RELEASE || env.VITE_SENTRY_RELEASE;
  if (!release) {
    try {
      release = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch { /* Builds outside a checkout supply SENTRY_RELEASE instead. */ }
  }
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN && env.VITE_SENTRY_DSN);
  if (command === "build" && env.VITE_SENTRY_DSN && !uploadSourceMaps) {
    console.warn("Sentry source maps were not uploaded: set SENTRY_AUTH_TOKEN for readable production stack traces.");
  }
  return {
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
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      uploadSourceMaps && sentryVitePlugin({
        org: env.SENTRY_ORG || "aidebate-sx",
        project: env.SENTRY_PROJECT || "debateai-web",
        authToken: env.SENTRY_AUTH_TOKEN,
        telemetry: false,
        release: { name: release },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
      }),
    ].filter(Boolean),
    define: {
      "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release || ""),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
      // Maps contain source code: emit them only for a private Sentry upload.
      sourcemap: uploadSourceMaps ? "hidden" : false,
    },
  };
});
