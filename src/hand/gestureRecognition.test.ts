import { describe, expect, it } from "vitest";
import { classifyHandPose, type Landmark, TemporalGestureRecognizer } from "./gestureRecognition";

const hand = (extended: boolean[]): Landmark[] => {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0 }));
  points[0] = { x: 0.5, y: 0.9, z: 0 };
  points[4] = { x: 0.2, y: 0.58, z: 0 };
  const fingers = [
    { mcp: 5, pip: 6, dip: 7, tip: 8, x: 0.38 },
    { mcp: 9, pip: 10, dip: 11, tip: 12, x: 0.47 },
    { mcp: 13, pip: 14, dip: 15, tip: 16, x: 0.56 },
    { mcp: 17, pip: 18, dip: 19, tip: 20, x: 0.65 },
  ];
  fingers.forEach((finger, index) => {
    points[finger.mcp] = { x: finger.x, y: 0.68, z: 0 };
    points[finger.pip] = { x: finger.x, y: 0.5, z: 0 };
    points[finger.dip] = { x: finger.x, y: extended[index] ? 0.34 : 0.67, z: 0 };
    points[finger.tip] = { x: finger.x, y: extended[index] ? 0.18 : 0.76, z: 0 };
  });
  return points;
};

describe("landmark gesture recognition", () => {
  it("recognizes open palm, fist, and point poses", () => {
    expect(classifyHandPose(hand([true, true, true, true]))?.gesture).toBe("OPEN_PALM");
    expect(classifyHandPose(hand([false, false, false, false]))?.gesture).toBe("FIST");
    expect(classifyHandPose(hand([true, false, false, false]))?.gesture).toBe("POINT");
  });

  it("recognizes a normalized pinch", () => {
    const pinched = hand([true, false, false, false]);
    pinched[4] = { ...pinched[8] };
    expect(classifyHandPose(pinched)?.gesture).toBe("PINCH");
  });

  it("confirms a stable gesture once", () => {
    const recognizer = new TemporalGestureRecognizer(120);
    const open = hand([true, true, true, true]);
    expect(recognizer.update([open], 0).confirmed).toBeUndefined();
    expect(recognizer.update([open], 130).confirmed).toBe("OPEN_PALM");
    expect(recognizer.update([open], 180).confirmed).toBeUndefined();
  });

  it("detects hands moving apart", () => {
    const recognizer = new TemporalGestureRecognizer(100);
    const left = hand([true, true, true, true]);
    const right = hand([true, true, true, true]);
    left.forEach((point) => { point.x -= 0.25; });
    right.forEach((point) => { point.x += 0.25; });
    recognizer.update([left, right], 0);
    expect(recognizer.update([left, right], 120).confirmed).toBe("HANDS_APART");
  });

  it("detects a fist thrusting toward the camera", () => {
    const recognizer = new TemporalGestureRecognizer(100);
    const fist = hand([false, false, false, false]);
    recognizer.update([fist], 0);
    expect(recognizer.update([fist], 120).confirmed).toBe("FIST");

    const wrist = fist[0];
    const closer = fist.map((point) => ({
      ...point,
      x: wrist.x + (point.x - wrist.x) * 1.32,
      y: wrist.y + (point.y - wrist.y) * 1.32,
    }));
    expect(recognizer.update([closer], 260).confirmed).toBe("THRUST");
  });
});
