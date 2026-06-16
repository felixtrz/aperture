/**
 * Main-thread audio driver for the racing port.
 *
 * APP-ONLY: this module does not touch any engine package internals. It builds a
 * bespoke Web Audio voice graph out of the *public* `@aperture-engine/audio`
 * seams — {@link createWebAudioBackend} (the AudioContext wrapper) and
 * {@link createAudioMixer} (the bus → master-limiter → destination chain) — and
 * drives it per-frame from the simulation signals the worker publishes.
 *
 * Why not the high-level `AudioEngine`? `AudioEngine.applySnapshot()` is the only
 * way to drive its voices, and it reconciles `AudioEmitterPacket`s out of a
 * `RenderSnapshot` produced by the ECS — it has no imperative "start a loop and
 * set its playbackRate/volume live from the main thread" surface, and no per-gear
 * lowpass model. The mixer + backend give us exactly the public building blocks
 * to realize the REFERENCE_SPEC §8 formulas directly. See the API-gap note at the
 * bottom of the agent report for evidence.
 *
 * The whole thing is fail-soft: if the Web Audio API or the backend is
 * unavailable (SSR, locked-down browser, decode failure) it silently no-ops and
 * never throws into the page.
 */
import {
  createAudioMixer,
  createWebAudioBackend,
  type AudioBackend,
  type AudioMixer,
} from "@aperture-engine/audio";

import { readGeneratedBrowserAppStatus } from "@aperture-engine/app/browser";

// ── Signal access (mirrors hud.ts: status.lastWorkerSummary.signals) ──────────

type JsonRecord = Record<string, unknown>;

function readRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBool(value: unknown): boolean {
  return value === true;
}

interface Signals {
  speed: number; // 0..1 normalized absolute speed
  throttle: number; // -1..1 forward input
  driftIntensity: number; // >= 0
  started: boolean;
}

function readSignals(): Signals {
  const status = readGeneratedBrowserAppStatus();
  const worker = readRecord(status?.lastWorkerSummary);
  const signals = readRecord(worker?.signals);
  return {
    speed: readNumber(signals?.speed, 0),
    throttle: readNumber(signals?.throttle, 0),
    driftIntensity: readNumber(signals?.driftIntensity, 0),
    started: readBool(signals?.started),
  };
}

// ── Math helpers (REFERENCE_SPEC §8) ──────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const span = inMax - inMin;
  if (span === 0) return outMin;
  const t = clamp((v - inMin) / span, 0, 1);
  return outMin + t * (outMax - outMin);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Engine model constants (REFERENCE_SPEC §8) ────────────────────────────────

const GEAR_COUNT = 3;
const GEAR_WINDOW = 1 / GEAR_COUNT;
const UPSHIFT_RPM = 0.92;
const DOWNSHIFT_RPM = 0.35;
const SHIFT_COOLDOWN = 0.35; // seconds
// Per-gear pitch (playbackRate) endpoints; pitch = lerp(low, high, rpm).
const PITCH_LOW = [1.05, 1.25, 1.4] as const;
const PITCH_HIGH = [3.5, 2.9, 2.3] as const;
// Engine clip plays on a dedicated bus alongside a quieter "layer" voice.
const ENGINE_LAYER_GAIN = 0.4;

// Skid model.
const SKID_DRIFT_THRESHOLD = 0.5;

// Impact model: derive an impact velocity from a sharp drop in normalized speed
// (a collision rapidly decelerates the car). The spec's impactVel is on a 0..6
// scale; our speed signal is normalized 0..1, so we scale a per-frame speed drop
// into that range. Gated above a threshold so ordinary braking does not fire it.
const IMPACT_SPEED_DROP_THRESHOLD = 0.18; // normalized speed lost in one frame
const IMPACT_VEL_SCALE = 6 / 0.6; // a 0.6 normalized drop maps to the 6 ceiling
const IMPACT_MIN_INTERVAL = 0.12; // seconds between retriggers (debounce)

const MAX_FRAME_DELTA = 0.05; // clamp dt so a tab-stall doesn't snap the model

// ── Clip URLs (served from racing/public/audio) ───────────────────────────────

const CLIP_URLS = {
  engine: "/audio/engine.ogg",
  skid: "/audio/skid.ogg",
  impact: "/audio/impact.ogg",
} as const;

// ── A single looping voice (engine, engine-layer, or skid) ────────────────────

interface LoopVoice {
  readonly gain: GainNode;
  readonly source: AudioBufferSourceNode;
  /** Optional per-voice lowpass (engine voices only). */
  readonly lowpass: BiquadFilterNode | null;
}

/**
 * Build and start a looping voice routed into `destination` (a mixer bus input).
 * The source starts immediately at silence; callers ramp gain/rate per frame.
 */
function startLoop(
  backend: AudioBackend,
  buffer: AudioBuffer,
  destination: AudioNode,
  withLowpass: boolean,
): LoopVoice {
  const gain = backend.createGain();
  gain.gain.value = 0;
  const source = backend.createSource();
  source.buffer = buffer;
  source.loop = true;

  let lowpass: BiquadFilterNode | null = null;
  if (withLowpass) {
    lowpass = backend.createBiquad();
    lowpass.type = "lowpass";
    lowpass.Q.value = 0.7;
    lowpass.frequency.value = 7000;
    source.connect(lowpass);
    lowpass.connect(gain);
  } else {
    source.connect(gain);
  }
  gain.connect(destination);
  source.start();
  return { gain, source, lowpass };
}

// ── Public entry point ────────────────────────────────────────────────────────

export interface RacingAudioHandle {
  /** Tear everything down (stop the RAF loop, dispose the graph). */
  dispose(): void;
}

/**
 * Lazily create the audio graph and start a self-driving requestAnimationFrame
 * loop. Safe to call exactly once from the main-thread entry (hud.ts). Returns a
 * handle for teardown; the loop and AudioContext are created on the first user
 * gesture (pointerdown/keydown), satisfying the Web Audio autoplay policy.
 *
 * Never throws: any failure (no AudioContext, decode error) degrades to silence.
 */
export function initRacingAudio(): RacingAudioHandle {
  let disposed = false;
  let started = false;
  let rafId = 0;

  // Late-bound graph (created on first gesture).
  let backend: AudioBackend | null = null;
  let mixer: AudioMixer | null = null;
  let engineVoice: LoopVoice | null = null;
  let engineLayer: LoopVoice | null = null;
  let skidVoice: LoopVoice | null = null;
  let impactBuffer: AudioBuffer | null = null;

  // Per-frame model state.
  let lastTime = 0;
  let gear = 0;
  let rpm = 0;
  let shiftTimer = 0;
  let engineVol = 0;
  let skidVol = 0;
  let prevSpeed = 0;
  let impactCooldown = 0;
  let haveStarted = false; // signals.started latch (mute until first input gesture)

  function removeGestureListeners(): void {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
    window.removeEventListener("touchstart", onGesture);
  }

  function onGesture(): void {
    if (disposed || started) return;
    started = true;
    removeGestureListeners();
    void boot();
  }

  async function boot(): Promise<void> {
    try {
      const created = createWebAudioBackend({ latencyHint: "interactive" });
      backend = created;
      mixer = createAudioMixer(created, {});
      // Unlock a context the autoplay policy left suspended.
      if (created.state !== "running") {
        try {
          await created.resume();
        } catch {
          // Resume may reject if the gesture window already closed; the loop
          // will keep mixing silently and a later gesture re-resumes.
        }
      }
      if (disposed) {
        teardownGraph();
        return;
      }
      await loadClips(created, mixer);
      if (disposed) {
        teardownGraph();
        return;
      }
      lastTime = performance.now();
      prevSpeed = readSignals().speed;
      rafId = requestAnimationFrame(frame);
    } catch {
      // createWebAudioBackend throws when no AudioContext exists; degrade to
      // silence and never surface to the page.
      teardownGraph();
    }
  }

  async function loadClips(b: AudioBackend, m: AudioMixer): Promise<void> {
    const [engineBuf, skidBuf, impactBuf] = await Promise.all([
      fetchAndDecode(b, CLIP_URLS.engine),
      fetchAndDecode(b, CLIP_URLS.skid),
      fetchAndDecode(b, CLIP_URLS.impact),
    ]);
    if (disposed) return;

    // Engine loops run on the `sfx` bus (passes through the master limiter).
    const sfxInput = m.busInput("sfx");
    if (engineBuf !== null) {
      engineVoice = startLoop(b, engineBuf, sfxInput, true);
      engineLayer = startLoop(b, engineBuf, sfxInput, true);
    }
    if (skidBuf !== null) {
      skidVoice = startLoop(b, skidBuf, sfxInput, false);
    }
    impactBuffer = impactBuf;
  }

  function frame(now: number): void {
    if (disposed) return;
    const dt = clamp((now - lastTime) / 1000, 0, MAX_FRAME_DELTA);
    lastTime = now;
    rafId = requestAnimationFrame(frame);

    const b = backend;
    if (b === null) return;
    const signals = readSignals();

    // Mute everything until the sim reports the first input gesture (spec §8).
    if (signals.started) haveStarted = true;
    const masterTarget = haveStarted ? 1 : 0;

    updateEngine(b, signals, dt, masterTarget);
    updateSkid(b, signals, masterTarget);
    updateImpact(b, signals, dt, masterTarget);

    prevSpeed = signals.speed;
    if (impactCooldown > 0) impactCooldown = Math.max(0, impactCooldown - dt);
  }

  function updateEngine(
    b: AudioBackend,
    signals: Signals,
    dt: number,
    masterTarget: number,
  ): void {
    if (engineVoice === null) return;
    const absSpeed = signals.speed;
    const throttle = signals.throttle;

    // 3-gear automatic with hysteresis + cooldown.
    if (shiftTimer > 0) shiftTimer = Math.max(0, shiftTimer - dt);
    if (shiftTimer === 0) {
      if (rpm > UPSHIFT_RPM && gear < GEAR_COUNT - 1) {
        gear += 1;
        shiftTimer = SHIFT_COOLDOWN;
      } else if (rpm < DOWNSHIFT_RPM && gear > 0) {
        gear -= 1;
        shiftTimer = SHIFT_COOLDOWN;
      }
    }

    // RPM follows a per-gear target; rises faster than it falls (spec §8).
    const gearStart = gear * GEAR_WINDOW;
    const inGear = clamp((absSpeed - gearStart) / GEAR_WINDOW, 0, 1);
    const targetRPM = clamp(inGear * 0.85 + throttle * 0.2, 0, 1.05);
    const rate = targetRPM > rpm ? 4 * (0.3 + Math.max(0, throttle)) : 4;
    rpm = lerp(rpm, targetRPM, Math.min(1, dt * rate));

    // Pitch (playbackRate) per gear.
    const low = PITCH_LOW[gear] ?? PITCH_LOW[0];
    const high = PITCH_HIGH[gear] ?? PITCH_HIGH[0];
    const pitch = lerp(low, high, rpm);

    // Volume target, smoothed.
    const targetVol = remap(absSpeed + throttle * 0.5, 0, 1.5, 0.02, 0.25);
    engineVol = lerp(engineVol, targetVol, Math.min(1, dt * 5));

    // Lowpass cutoff opens with throttle.
    const cutoff = remap(throttle, 0, 1, 700, 7000);
    const now = b.currentTime;

    applyVoice(engineVoice, b, pitch, engineVol * masterTarget, cutoff);
    if (engineLayer !== null) {
      // The layer voice is the same loop, pitched an octave-ish lower and
      // quieter, for body (spec: "layer vol *0.4").
      applyVoice(
        engineLayer,
        b,
        pitch * 0.5,
        engineVol * ENGINE_LAYER_GAIN * masterTarget,
        cutoff,
      );
    }
    void now;
  }

  function applyVoice(
    voice: LoopVoice,
    b: AudioBackend,
    pitch: number,
    vol: number,
    cutoff: number | null,
  ): void {
    const now = b.currentTime;
    // Click-free ramps; pin current value first.
    voice.source.playbackRate.linearRampToValueAtTime(pitch, now + 0.03);
    voice.gain.gain.linearRampToValueAtTime(Math.max(0, vol), now + 0.03);
    if (cutoff !== null && voice.lowpass !== null) {
      voice.lowpass.frequency.setTargetAtTime(cutoff, now, 0.05);
    }
  }

  function updateSkid(
    b: AudioBackend,
    signals: Signals,
    masterTarget: number,
  ): void {
    if (skidVoice === null) return;
    const drift = signals.driftIntensity;
    let targetVol = 0;
    let pitch = 1;
    if (drift > SKID_DRIFT_THRESHOLD) {
      targetVol = remap(clamp(drift, 0.5, 2.5), 0.5, 2.5, 0.05, 0.3);
      pitch = clamp(signals.speed * 3, 1, 3); // speed is normalized 0..1
    }
    skidVol = targetVol;
    const now = b.currentTime;
    skidVoice.gain.gain.linearRampToValueAtTime(
      skidVol * masterTarget,
      now + 0.05,
    );
    skidVoice.source.playbackRate.linearRampToValueAtTime(pitch, now + 0.05);
  }

  function updateImpact(
    b: AudioBackend,
    signals: Signals,
    _dt: number,
    masterTarget: number,
  ): void {
    if (impactBuffer === null || mixer === null) return;
    if (masterTarget <= 0) return;
    const drop = prevSpeed - signals.speed;
    if (drop > IMPACT_SPEED_DROP_THRESHOLD && impactCooldown === 0) {
      const impactVel = clamp(drop * IMPACT_VEL_SCALE, 0, 6);
      const vol = clamp(remap(impactVel, 0, 6, 0.01, 1.0), 0.01, 1.0);
      fireImpact(b, mixer, vol * masterTarget);
      impactCooldown = IMPACT_MIN_INTERVAL;
    }
  }

  function fireImpact(b: AudioBackend, m: AudioMixer, vol: number): void {
    if (impactBuffer === null) return;
    const gain = b.createGain();
    gain.gain.value = vol;
    const source = b.createSource();
    source.buffer = impactBuffer;
    source.connect(gain);
    gain.connect(m.busInput("sfx"));
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        /* already torn down */
      }
    };
    source.start();
  }

  function teardownGraph(): void {
    try {
      engineVoice?.source.stop();
      engineLayer?.source.stop();
      skidVoice?.source.stop();
    } catch {
      /* sources may not have started */
    }
    mixer?.dispose();
    void backend?.close();
    backend = null;
    mixer = null;
    engineVoice = null;
    engineLayer = null;
    skidVoice = null;
    impactBuffer = null;
  }

  // First-gesture wiring (Web Audio autoplay policy).
  window.addEventListener("pointerdown", onGesture, { once: false });
  window.addEventListener("keydown", onGesture, { once: false });
  window.addEventListener("touchstart", onGesture, { once: false });

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      removeGestureListeners();
      if (rafId !== 0) cancelAnimationFrame(rafId);
      teardownGraph();
    },
  };
}

// ── Clip loading ──────────────────────────────────────────────────────────────

/** Fetch + decode a clip URL into an AudioBuffer; null on any failure. */
async function fetchAndDecode(
  backend: AudioBackend,
  url: string,
): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    return await backend.decode(bytes);
  } catch {
    return null;
  }
}
