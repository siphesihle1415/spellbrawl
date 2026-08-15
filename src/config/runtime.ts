function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const clientRuntimeConfig = {
  workerHost: import.meta.env.VITE_WORKER_HOST?.trim() || "127.0.0.1:8787",
  roomConnectTimeoutMs: positiveInteger(import.meta.env.VITE_ROOM_CONNECT_TIMEOUT_MS, 10_000),
  directorRequestTimeoutMs: positiveInteger(import.meta.env.VITE_DIRECTOR_TIMEOUT_MS, 18_000),
} as const;
