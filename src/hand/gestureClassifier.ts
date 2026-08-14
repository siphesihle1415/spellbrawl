import type { Gesture } from "../game/types";

export type Landmark = { x: number; y: number; z: number };
export type PoseResult = { gesture: Gesture; confidence: number };
export type FistSample = { scale: number; at: number };

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const RING_MCP = 13;
const PINKY_MCP = 17;

const PINCH_RATIO_THRESHOLD = 0.4;
const HANDS_APART_RATIO_THRESHOLD = 3.5;
const THRUST_WINDOW_MS = 250;
const THRUST_GROWTH_RATIO = 1.4;

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isFingerExtended(hand: Landmark[], tipIndex: number, mcpIndex: number): boolean {
  return hand[tipIndex].y < hand[mcpIndex].y;
}

function handScale(hand: Landmark[]): number {
  return dist(hand[WRIST], hand[MIDDLE_MCP]);
}

function classifySingleHand(hand: Landmark[]): PoseResult | null {
  const scale = handScale(hand);
  const pinchRatio = dist(hand[THUMB_TIP], hand[INDEX_TIP]) / scale;

  if (pinchRatio < PINCH_RATIO_THRESHOLD) {
    const confidence = Math.min(1, 1 - pinchRatio / PINCH_RATIO_THRESHOLD);
    return { gesture: "PINCH", confidence };
  }

  const indexUp = isFingerExtended(hand, INDEX_TIP, INDEX_MCP);
  const middleUp = isFingerExtended(hand, MIDDLE_TIP, MIDDLE_MCP);
  const ringUp = isFingerExtended(hand, RING_TIP, RING_MCP);
  const pinkyUp = isFingerExtended(hand, PINKY_TIP, PINKY_MCP);

  if (indexUp && middleUp && ringUp && pinkyUp) return { gesture: "OPEN_PALM", confidence: 0.9 };
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "FIST", confidence: 0.9 };
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "POINT", confidence: 0.9 };

  return null;
}

export function classifyPose(hands: Landmark[][]): PoseResult | null {
  if (hands.length === 0) return null;

  if (hands.length >= 2) {
    const scale = (handScale(hands[0]) + handScale(hands[1])) / 2;
    const ratio = dist(hands[0][WRIST], hands[1][WRIST]) / scale;
    if (ratio >= HANDS_APART_RATIO_THRESHOLD) {
      const confidence = Math.min(1, ratio / (HANDS_APART_RATIO_THRESHOLD * 1.5));
      return { gesture: "HANDS_APART", confidence };
    }
  }

  return classifySingleHand(hands[0]);
}

export function classifyThrust(history: FistSample[]): boolean {
  if (history.length < 2) return false;

  const latest = history[history.length - 1];
  const windowStart = latest.at - THRUST_WINDOW_MS;
  const earliestInWindow = history.find((sample) => sample.at >= windowStart);

  if (!earliestInWindow || earliestInWindow === latest || earliestInWindow.scale <= 0) return false;

  return latest.scale / earliestInWindow.scale >= THRUST_GROWTH_RATIO;
}

// exported for reuse by handScale-dependent checks
export { dist, handScale };
