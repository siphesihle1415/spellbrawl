import { describe, expect, it, vi } from "vitest";
import { acquireFromPool, type Playable } from "./audioPool";

function fakePlayable(overrides: Partial<Playable> = {}): Playable {
  return { paused: true, ended: false, currentTime: 0, volume: 1, play: vi.fn(), ...overrides };
}

describe("acquireFromPool", () => {
  it("creates a new instance and adds it to the pool when it starts empty", () => {
    const pool: Playable[] = [];
    const created = fakePlayable();
    const create = vi.fn(() => created);

    const result = acquireFromPool(pool, create);

    expect(result).toBe(created);
    expect(pool).toEqual([created]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reuses a paused instance already in the pool instead of creating a new one", () => {
    const idle = fakePlayable({ paused: true });
    const pool: Playable[] = [idle];
    const create = vi.fn(() => fakePlayable());

    const result = acquireFromPool(pool, create);

    expect(result).toBe(idle);
    expect(pool).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates an additional instance when every pooled instance is still playing", () => {
    const busy = fakePlayable({ paused: false, ended: false });
    const pool: Playable[] = [busy];
    const created = fakePlayable();
    const create = vi.fn(() => created);

    const result = acquireFromPool(pool, create);

    expect(result).toBe(created);
    expect(pool).toEqual([busy, created]);
  });
});
