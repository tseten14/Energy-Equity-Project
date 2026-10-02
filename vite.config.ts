// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vite only exposes VITE_* variables. Server functions read their secrets from process.env, which the
// hosting platform fills in production; locally they come from .env (never committed).
// Assigned rather than loaded with process.loadEnvFile, which never replaces a value that is already
// set: Vite restarts in the same process when .env changes, so edits would otherwise be ignored.
if (existsSync(".env")) Object.assign(process.env, parseEnv(readFileSync(".env", "utf8")));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
