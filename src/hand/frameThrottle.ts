export function shouldSample(lastSampleAt: number | null, now: number, minIntervalMs: number): boolean {
  return lastSampleAt === null || now - lastSampleAt >= minIntervalMs;
}
