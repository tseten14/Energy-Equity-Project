/** Reads one server environment variable. Blank and missing values are both treated as unset. */
import "@tanstack/react-start/server-only";

export function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
