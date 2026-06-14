# @aperture-engine/audio

Main-thread Web Audio realization layer for Aperture: a derived view of the authoritative ECS simulation.

## Install

```sh
pnpm add @aperture-engine/audio
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) WebGPU game engine and is normally used together with the other `@aperture-engine/*` packages (notably `@aperture-engine/render`, which produces the per-frame `RenderSnapshot` this layer consumes).

## What it does

Aperture's authoritative simulation runs in a worker; this package is the main-thread audio engine that turns each frame's audio intent into sound. It owns a Web Audio backend, a five-bus submix mixer (`music`, `sfx`, `ui`, `ambient`, `voice`), a decode-once clip cache, and a pooled voice manager with spatial `PannerNode` voices and voice virtualization. Each frame, `applySnapshot` reconciles the live voice graph against the snapshot. It also handles scripted sidechain ducking, game pause vs. tab-hidden suspend, latency compensation, mono downmix, an optional AudioWorklet brickwall limiter, and clip start/end events for captions.

## Usage

```ts
import { createAudioEngine } from "@aperture-engine/audio";

const engine = createAudioEngine({
  // Resolve a clip id (e.g. "audio-clip:boom") to encoded bytes + metadata.
  resolveClip: (clipId) => clipRegistry.get(clipId),
});

// Resume the AudioContext on the first user gesture (autoplay policy).
canvas.addEventListener("pointerdown", () => engine.unlock(), { once: true });

// Each frame: reconcile the voice graph against the render snapshot.
function frame(snapshot, frameDeltaSeconds) {
  engine.applySnapshot(snapshot, frameDeltaSeconds);
}

engine.setBusGain("music", 0.6);
engine.setPaused(true); // game pause: silences sfx/voice/ambient
```

Volume persistence (localStorage-backed, ramped, and mirrored as a deterministic worker command) is available via `createAudioSettings`. Lower-level pieces — `createWebAudioBackend`, `createAudioMixer`, `createClipCache`, `createVoiceManager` — are exported too, but most apps only need `createAudioEngine`.

## Entry points

- `@aperture-engine/audio` — the audio engine, mixer, clip cache, voice manager, backend, and settings.
- `@aperture-engine/audio/test-support` — a deterministic, deviceless `FakeAudioBackend` (and fake node classes) for unit-testing control logic without Web Audio.

## License

Part of the [Aperture](https://github.com/felixtrz/aperture) monorepo. MIT licensed.
