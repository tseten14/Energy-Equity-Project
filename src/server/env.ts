import "@tanstack/react-start/server-only";

export function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing server environment variable ${name}. See .env.example.`);
  return value;
}
