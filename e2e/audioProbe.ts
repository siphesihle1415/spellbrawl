import { expect, type Page } from "@playwright/test";

// Observe real browser playback; do not stub play() or bypass autoplay policy.
export async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const observed = { files: [] as string[], tones: [] as number[] };
    Object.assign(window, { observedAudio: observed });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return play.call(this).then(() => { observed.files.push(new URL(this.src).pathname); });
    };
    // AudioParam.value can still be the default before the audio render thread
    // applies scheduled automation. Capture the scheduled starting frequency.
    const scheduledValues = new WeakMap<AudioParam, number>();
    const setValueAtTime = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (value: number, time: number) {
      scheduledValues.set(this, value);
      return setValueAtTime.call(this, value, time);
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      if (this.context.state === "running") observed.tones.push(scheduledValues.get(this.frequency) ?? this.frequency.value);
      start.call(this, when);
    };
  });
}

export async function expectAudioFile(page: Page, path: string) {
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { observedAudio: { files: string[] } }).observedAudio.files,
  )).toContain(path);
}

export async function expectAudioTone(page: Page, frequency: number) {
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { observedAudio: { tones: number[] } }).observedAudio.tones,
  )).toContain(frequency);
}
