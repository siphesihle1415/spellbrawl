import type { Gesture } from "../game/types";

export type Landmark = { x: number; y: number; z: number };
export type PoseResult = { gesture: Gesture; confidence: number };

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

const PINCH_RATIO_THRESHOLD = 0.4;

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Rotation-invariant curl check: a curled finger pulls its tip back toward the wrist,
// so the tip ends up closer to the wrist than the PIP joint regardless of hand tilt —
// unlike a plain tip.y vs mcp.y comparison, which only works when the hand is upright.
function isFingerExtended(hand: Landmark[], tipIndex: number, pipIndex: number): boolean {
  return dist(hand[WRIST], hand[tipIndex]) > dist(hand[WRIST], hand[pipIndex]);
}

function handScale(hand: Landmark[]): number {
  return dist(hand[WRIST], hand[MIDDLE_MCP]);
}

function classifySingleHand(hand: Landmark[]): PoseResult | null {
  const indexUp = isFingerExtended(hand, INDEX_TIP, INDEX_PIP);
  const middleUp = isFingerExtended(hand, MIDDLE_TIP, MIDDLE_PIP);
  const ringUp = isFingerExtended(hand, RING_TIP, RING_PIP);
  const pinkyUp = isFingerExtended(hand, PINKY_TIP, PINKY_PIP);

  // A closed fist naturally rests the thumb near the curled index finger, which would
  // also satisfy the pinch-distance check below — so an all-curled hand must win as FIST
  // before pinch gets a chance to misclassify it.
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "FIST", confidence: 0.9 };

  const scale = handScale(hand);
  const pinchRatio = dist(hand[THUMB_TIP], hand[INDEX_TIP]) / scale;

  if (pinchRatio < PINCH_RATIO_THRESHOLD) {
    const confidence = Math.min(1, 1 - pinchRatio / PINCH_RATIO_THRESHOLD);
    return { gesture: "PINCH", confidence };
  }

  if (indexUp && middleUp && ringUp && pinkyUp) return { gesture: "OPEN_PALM", confidence: 0.9 };
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "POINT", confidence: 0.9 };

  return null;
}

export function classifyPose(hands: Landmark[][]): PoseResult | null {
  if (hands.length === 0) return null;

  return classifySingleHand(hands[0]);
}

// exported for reuse by handScale-dependent checks
export { dist, handScale };
