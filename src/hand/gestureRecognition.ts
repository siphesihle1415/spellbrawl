import type { Gesture } from "../game/types";

export type Landmark = { x: number; y: number; z?: number };

export type GestureObservation = {
  gesture?: Gesture;
  confidence: number;
  stability: number;
  confirmed?: Gesture;
  handCount: number;
};

type Candidate = { gesture: Gesture; confidence: number };

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const distance = (a: Landmark, b: Landmark) => Math.hypot(
  a.x - b.x,
  a.y - b.y,
  (a.z ?? 0) - (b.z ?? 0),
);

const average = (...values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

const extensionScore = (hand: Landmark[], pip: number, tip: number) => {
  const pipDistance = distance(hand[WRIST], hand[pip]);
  if (pipDistance === 0) return 0;
  const ratio = distance(hand[WRIST], hand[tip]) / pipDistance;
  return clamp((ratio - 1.02) / 0.33);
};

export const palmScale = (hand: Landmark[]) => distance(hand[WRIST], hand[MIDDLE_MCP]);

export function classifyHandPose(hand: Landmark[]): Candidate | undefined {
  if (hand.length < 21 || palmScale(hand) < 0.015) return undefined;

  const index = extensionScore(hand, INDEX_PIP, INDEX_TIP);
  const middle = extensionScore(hand, MIDDLE_PIP, MIDDLE_TIP);
  const ring = extensionScore(hand, RING_PIP, RING_TIP);
  const pinky = extensionScore(hand, PINKY_PIP, PINKY_TIP);
  const folded = [1 - index, 1 - middle, 1 - ring, 1 - pinky];
  const pinchRatio = distance(hand[THUMB_TIP], hand[INDEX_TIP]) / palmScale(hand);

  const pinchConfidence = Math.min(clamp((0.48 - pinchRatio) / 0.3), clamp((index - 0.1) / 0.5));
  if (pinchConfidence >= 0.68) return { gesture: "PINCH", confidence: pinchConfidence };

  const candidates: Candidate[] = [
    { gesture: "OPEN_PALM", confidence: average(index, middle, ring, pinky) },
    { gesture: "FIST", confidence: average(...folded) },
    { gesture: "POINT", confidence: average(index, folded[1], folded[2], folded[3]) },
  ];

  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];
  return best.confidence >= 0.68 ? best : undefined;
}

const handsApartCandidate = (hands: Landmark[][]): Candidate | undefined => {
  if (hands.length < 2) return undefined;
  const scale = average(palmScale(hands[0]), palmScale(hands[1]));
  if (scale === 0) return undefined;
  const ratio = distance(hands[0][WRIST], hands[1][WRIST]) / scale;
  const confidence = clamp((ratio - 1.3) / 1);
  return confidence >= 0.68 ? { gesture: "HANDS_APART", confidence } : undefined;
};

export class TemporalGestureRecognizer {
  private candidate?: Gesture;
  private candidateSince = 0;
  private emitted = false;
  private scales: Array<{ at: number; scale: number }> = [];

  constructor(
    private readonly stableForMs = 120,
    private readonly motionWindowMs = 360,
  ) {}

  reset() {
    this.candidate = undefined;
    this.candidateSince = 0;
    this.emitted = false;
    this.scales = [];
  }

  update(hands: Landmark[][], at: number): GestureObservation {
    if (hands.length === 0) {
      this.reset();
      return { confidence: 0, stability: 0, handCount: 0 };
    }

    const scale = palmScale(hands[0]);
    this.scales = [...this.scales.filter((sample) => at - sample.at <= this.motionWindowMs), { at, scale }];
    const oldestScale = this.scales[0]?.scale ?? scale;
    const growth = oldestScale > 0 ? scale / oldestScale - 1 : 0;
    const pose = classifyHandPose(hands[0]);
    const thrustConfidence = pose?.gesture === "FIST" ? clamp((growth - 0.16) / 0.22) : 0;

    const raw = thrustConfidence >= 0.68
      ? { gesture: "THRUST" as const, confidence: thrustConfidence }
      : handsApartCandidate(hands) ?? pose;

    if (!raw) {
      this.candidate = undefined;
      this.emitted = false;
      return { confidence: 0, stability: 0, handCount: hands.length };
    }

    if (raw.gesture !== this.candidate) {
      this.candidate = raw.gesture;
      this.candidateSince = at;
      this.emitted = false;
    }

    const stability = raw.gesture === "THRUST"
      ? 1
      : clamp((at - this.candidateSince) / this.stableForMs);
    const confirmed = stability >= 1 && !this.emitted ? raw.gesture : undefined;
    if (confirmed) this.emitted = true;

    return {
      gesture: raw.gesture,
      confidence: raw.confidence,
      stability,
      confirmed,
      handCount: hands.length,
    };
  }
}
