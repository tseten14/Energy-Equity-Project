/**
 * Build and dev-server setup.
 *
 * `npm run dev` serves the site at http://localhost:8080. `npm run build` produces
 * a Cloudflare bundle through Nitro. Server functions read secrets from `process.env`.
 * Vite restarts in the same process when `.env` changes, and Node will not replace a
 * variable that is already set, so this file parses `.env` and assigns over the old values.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

if (existsSync(".env")) {
  Object.assign(process.env, parseEnv(readFileSync(".env", "utf8")));
}

export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wraps server-side rendering so a crash shows the error page.
      server: { entry: "server" },
      // Browser code must not import src/server. The build fails if it does.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    // Dev stays on Node. Only the production build targets Cloudflare.
    ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
    react(),
  ],
}));
