export interface Playable {
  paused: boolean;
  ended: boolean;
  currentTime: number;
  volume: number;
  play(): void | Promise<void>;
}

export function acquireFromPool<T extends Playable>(pool: T[], create: () => T): T {
  const idle = pool.find((item) => item.paused || item.ended);
  if (idle) return idle;
  const created = create();
  pool.push(created);
  return created;
}
