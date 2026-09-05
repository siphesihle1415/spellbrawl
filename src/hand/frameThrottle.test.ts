import { describe, expect, it } from "vitest";
import { shouldSample } from "./frameThrottle";

describe("shouldSample", () => {
  it("samples immediately when no prior sample exists", () => {
    expect(shouldSample(null, 1_000, 66)).toBe(true);
  });

  it("rejects a sample that arrives before the minimum interval has elapsed", () => {
    expect(shouldSample(1_000, 1_030, 66)).toBe(false);
  });

  it("accepts a sample once the minimum interval has elapsed", () => {
    expect(shouldSample(1_000, 1_066, 66)).toBe(true);
  });
});
