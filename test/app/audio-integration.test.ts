import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createAudioClipHandle,
} from "@aperture-engine/simulation";
import { createAudioClipAsset } from "@aperture-engine/render";
import type {
  AudioEmitterPacket,
  AudioVoiceKey,
  RenderSnapshot,
} from "@aperture-engine/render";
import type {
  SimulationWorker,
  SimulationWorkerMessageCallback,
  SimulationWorkerSnapshotEvent,
} from "@aperture-engine/runtime";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import { FakeAudioBackend } from "@aperture-engine/audio/test-support";

import { installGeneratedAudio } from "../../packages/app/src/browser/audio.js";

const CLIP = createAudioClipHandle("boom");

/** A worker stub whose snapshots we drive by hand. */
function fakeWorker(): {
  worker: SimulationWorker;
  emit(snapshot: RenderSnapshot): void;
  emitMessage(message: unknown): void;
  listeners: number;
  messageListeners: number;
} {
  const subs = new Set<(event: SimulationWorkerSnapshotEvent) => void>();
  const messageSubs = new Set<SimulationWorkerMessageCallback>();
  const worker = {
    onSnapshot(callback: (event: SimulationWorkerSnapshotEvent) => void) {
      subs.add(callback);
      return () => subs.delete(callback);
    },
    onMessage(callback: SimulationWorkerMessageCallback) {
      messageSubs.add(callback);
      return () => messageSubs.delete(callback);
    },
  } as unknown as SimulationWorker;
  return {
    worker,
    emit(snapshot) {
      const event = {
        frame: snapshot.frame ?? 0,
        snapshot,
      } as SimulationWorkerSnapshotEvent;
      for (const sub of subs) {
        sub(event);
      }
    },
    emitMessage(message) {
      for (const sub of messageSubs) {
        sub(message);
      }
    },
    get listeners() {
      return subs.size;
    },
    get messageListeners() {
      return messageSubs.size;
    },
  };
}

function emitter(over: Partial<AudioEmitterPacket> = {}): AudioEmitterPacket {
  const key: AudioVoiceKey = over.key ?? { kind: "entity", id: 1 };
  return {
    key,
    entity: { index: 1, generation: 0 },
    clip: CLIP,
    clipVersion: 1,
    busId: "sfx",
    gain: 1,
    loop: false,
    autoplay: true,
    playEpoch: 0,
    stopEpoch: 0,
    timeScale: 1,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: "local",
    distanceModel: "inverse",
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    occlusion: 0,
    lowpassFrequency: 22000,
    lowpassQ: 0.7,
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
    ...over,
  };
}

function snap(emitters: AudioEmitterPacket[]): RenderSnapshot {
  return { frame: 1, audioEmitters: emitters } as unknown as RenderSnapshot;
}

function registryWithClip(): AssetRegistry {
  const assets = new AssetRegistry();
  assets.register(CLIP);
  assets.markReady(
    CLIP,
    createAudioClipAsset({ label: "Boom", bytes: new ArrayBuffer(16) }),
  );
  return assets;
}

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe("installGeneratedAudio (main-thread integration)", () => {
  it("drives the engine from worker snapshots and resolves clips from the mirror", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const { worker, emit } = fakeWorker();
    const audio = installGeneratedAudio(worker, registryWithClip(), {
      backend,
      autoUnlock: false,
    });
    if (audio === null) throw new Error("expected audio to install");

    // No snapshot yet ⇒ no voices.
    expect(audio.engine.activeVoiceCount).toBe(0);

    emit(snap([emitter({ autoplay: true })]));
    await tick(); // flush the decode microtask + deferred one-shot start

    // The autoplay emitter became a live voice with a sounding source — proving
    // the snapshot → applySnapshot → voice → registry-resolved clip → decode
    // wire is connected end to end.
    expect(audio.engine.activeVoiceCount).toBe(1);
    expect(audio.engine.activeSourceCount).toBe(1);

    audio.dispose();
  });

  it("keeps worker-authored autoplay loops silent until unlock", async () => {
    const backend = new FakeAudioBackend({ state: "suspended" });
    const { worker, emit } = fakeWorker();
    const audio = installGeneratedAudio(worker, registryWithClip(), {
      backend,
      autoUnlock: false,
    });
    if (audio === null) throw new Error("expected audio to install");

    emit(snap([emitter({ autoplay: true, loop: true })]));
    await tick();

    expect(audio.engine.activeVoiceCount).toBe(1);
    expect(audio.engine.activeSourceCount).toBe(0);
    expect(backend.created.sources.length).toBe(0);

    await audio.engine.unlock();
    emit(snap([emitter({ autoplay: true, loop: true })]));
    await tick();

    expect(audio.engine.activeSourceCount).toBe(1);
    expect(backend.created.sources[0]?.started).toBe(true);

    audio.dispose();
  });

  it("drives the engine from audio-only sideband messages", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const probe = fakeWorker();
    const audio = installGeneratedAudio(probe.worker, registryWithClip(), {
      backend,
      autoUnlock: false,
    });
    if (audio === null) throw new Error("expected audio to install");

    expect(probe.listeners).toBe(1);
    expect(probe.messageListeners).toBe(1);

    probe.emitMessage({
      type: SIMULATION_WORKER_PROTOCOL.audioSnapshot,
      frame: 2,
      snapshot: { ...snap([emitter({ autoplay: true })]), frame: 2 },
    });
    await tick();

    expect(audio.engine.activeVoiceCount).toBe(1);
    expect(audio.engine.activeSourceCount).toBe(1);

    audio.dispose();
  });

  it("can be driven manually without worker snapshot subscriptions", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const probe = fakeWorker();
    const audio = installGeneratedAudio(probe.worker, registryWithClip(), {
      backend,
      autoUnlock: false,
      snapshotSource: "manual",
    });
    if (audio === null) throw new Error("expected audio to install");

    expect(probe.listeners).toBe(0);
    expect(probe.messageListeners).toBe(0);

    audio.applySnapshot(snap([emitter({ autoplay: true })]));
    await tick();

    expect(audio.engine.activeVoiceCount).toBe(1);
    expect(audio.engine.activeSourceCount).toBe(1);

    audio.dispose();
    audio.applySnapshot(snap([emitter({ key: { kind: "entity", id: 2 } })]));
    await tick();
    expect(audio.engine.activeVoiceCount).toBe(0);
  });

  it("stops driving after dispose() and tears the engine down", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const probe = fakeWorker();
    const audio = installGeneratedAudio(probe.worker, registryWithClip(), {
      backend,
      autoUnlock: false,
    });
    if (audio === null) throw new Error("expected audio to install");

    expect(probe.listeners).toBe(1);
    expect(probe.messageListeners).toBe(1);
    audio.dispose();
    expect(probe.listeners).toBe(0);
    expect(probe.messageListeners).toBe(0);

    // A snapshot after dispose must not resurrect a voice.
    probe.emit(snap([emitter({ autoplay: true })]));
    await tick();
    expect(audio.engine.activeVoiceCount).toBe(0);
  });

  it("mixes silently when the clip is not in the registry (no crash)", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const { worker, emit } = fakeWorker();
    const audio = installGeneratedAudio(worker, new AssetRegistry(), {
      backend,
      autoUnlock: false,
    });
    if (audio === null) throw new Error("expected audio to install");

    emit(snap([emitter({ autoplay: true })]));
    await tick();

    // The voice exists (intent reconciled) but no source decoded → silent.
    expect(audio.engine.activeVoiceCount).toBe(1);
    expect(audio.engine.activeSourceCount).toBe(0);

    audio.dispose();
  });
});
