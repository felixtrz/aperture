import { describe, expect, it } from "vitest";
import {
  createAudioSoundBoardOrThrow,
  createFirstAudioGestureStarter,
} from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  FakeAudioBuffer,
  type FakeAudioBufferSourceNode,
  type FakeBiquadFilterNode,
  type FakeGainNode,
} from "@aperture-engine/audio/test-support";

describe("audio sound board", () => {
  it("starts loop voices with managed gain, pitch, and lowpass automation", async () => {
    const backend = new FakeAudioBackend({ state: "suspended" });
    const board = createAudioSoundBoardOrThrow({
      backend,
      clips: {
        engine: {
          buffer: new FakeAudioBuffer(2, 48_000) as unknown as AudioBuffer,
        },
      },
    });

    await board.unlock();
    expect(backend.state).toBe("running");

    const voice = await board.startLoop("engine", {
      bus: "sfx",
      lowpass: { frequency: 7000, q: 0.7 },
    });

    expect(voice).not.toBeNull();
    const source = backend.created.sources.at(-1) as FakeAudioBufferSourceNode;
    const lowpass = backend.created.biquads.at(-1) as FakeBiquadFilterNode;
    const gain = backend.created.gains.at(-1) as FakeGainNode;
    expect(source.started).toBe(true);
    expect(source.loop).toBe(true);
    expect(lowpass.type).toBe("lowpass");
    expect(lowpass.frequency.value).toBe(7000);
    expect(gain.gain.value).toBe(0);

    voice?.setPlaybackRate(2.5, 0.03);
    voice?.setGain(0.25, 0.03);
    voice?.setLowpassFrequency(1200, 0.05);

    expect(source.playbackRate.lastEvent()).toMatchObject({
      method: "linearRampToValueAtTime",
      value: 2.5,
      time: 0.03,
    });
    expect(gain.gain.lastEvent()).toMatchObject({
      method: "linearRampToValueAtTime",
      value: 0.25,
      time: 0.03,
    });
    expect(lowpass.frequency.lastEvent()).toMatchObject({
      method: "setTargetAtTime",
      value: 1200,
      timeConstant: 0.05,
    });

    voice?.stop();
    expect(source.stopped).toBe(true);
  });

  it("caches decoded clips and creates single-use one-shot sources", async () => {
    const backend = new FakeAudioBackend();
    const board = createAudioSoundBoardOrThrow({
      backend,
      clips: {
        impact: { bytes: new ArrayBuffer(8) },
      },
    });

    expect(await board.playOneShot("impact", { gain: 0.4 })).toBe(true);
    expect(await board.playOneShot("impact", { gain: 0.6 })).toBe(true);
    expect(backend.decodeCalls).toBe(1);
    expect(backend.created.sources).toHaveLength(2);

    const latestSource = backend.created.sources.at(
      -1,
    ) as FakeAudioBufferSourceNode;
    const latestGain = backend.created.gains.at(-1) as FakeGainNode;
    expect(latestSource.started).toBe(true);
    expect(latestGain.gain.value).toBe(0.6);

    latestSource.onended?.();
    expect(latestSource.connections).toHaveLength(0);
    expect(latestGain.connections).toHaveLength(0);
  });

  it("runs a first-gesture starter exactly once", () => {
    const target = new FakeGestureTarget();
    let starts = 0;
    const starter = createFirstAudioGestureStarter(target, () => {
      starts += 1;
    });

    target.dispatch("keydown");
    target.dispatch("pointerdown");
    expect(starter.started).toBe(true);
    expect(starts).toBe(1);

    starter.dispose();
    target.dispatch("touchstart");
    expect(starts).toBe(1);
  });
});

class FakeGestureTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  }
}
