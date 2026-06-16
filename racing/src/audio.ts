/**
 * Main-thread audio driver for the racing port.
 *
 * APP-ONLY: this module does not touch any engine package internals. It builds a
 * racing-specific engine/skid/impact model from REFERENCE_SPEC §8, but the
 * reusable Web Audio lifecycle now lives behind `@aperture-engine/audio`:
 * gesture startup, clip fetch/decode/cache, loop voices, one-shots, click-free
 * gain/pitch automation, lowpass nodes, mixer routing, and teardown.
 *
 * The whole thing is fail-soft: if the Web Audio API or the backend is
 * unavailable (SSR, locked-down browser, decode failure) it silently no-ops and
 * never throws into the page.
 */
import {
  createAudioSoundBoard,
  createFirstAudioGestureStarter,
  type AudioLoopVoice,
  type AudioSoundBoard,
  type FirstAudioGestureStarter,
} from "@aperture-engine/audio";
import { readGeneratedSignals } from "@aperture-engine/app/browser";
import {
  clamp,
  lerp,
  remapClamped as remap,
} from "@aperture-engine/simulation";

// ── Signal access (mirrors hud.ts via public browser signal helpers) ──────────

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
  const signals = readGeneratedSignals();
  return {
    speed: readNumber(signals?.speed, 0),
    throttle: readNumber(signals?.throttle, 0),
    driftIntensity: readNumber(signals?.driftIntensity, 0),
    started: readBool(signals?.started),
  };
}

// ── Math helpers (REFERENCE_SPEC §8) ──────────────────────────────────────────

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
  let rafId = 0;
  const gestureStarter: FirstAudioGestureStarter =
    createFirstAudioGestureStarter(window, () => {
      void boot();
    });

  // Late-bound graph (created on first gesture).
  let soundBoard: AudioSoundBoard | null = null;
  let engineVoice: AudioLoopVoice | null = null;
  let engineLayer: AudioLoopVoice | null = null;
  let skidVoice: AudioLoopVoice | null = null;
  let impactReady = false;

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

  async function boot(): Promise<void> {
    try {
      const created = createAudioSoundBoard({
        web: { latencyHint: "interactive" },
        clips: CLIP_URLS,
      });
      if (!created.ok) {
        return;
      }
      soundBoard = created.soundBoard;
      await created.soundBoard.unlock();
      if (disposed) {
        teardownGraph();
        return;
      }
      await loadClips(created.soundBoard);
      if (disposed) {
        teardownGraph();
        return;
      }
      lastTime = performance.now();
      prevSpeed = readSignals().speed;
      rafId = requestAnimationFrame(frame);
    } catch {
      // Missing AudioContext, rejected unlock, or decode failure: degrade to
      // silence and never surface to the page.
      teardownGraph();
    }
  }

  async function loadClips(board: AudioSoundBoard): Promise<void> {
    const [engineBuf, skidBuf, impactBuf] = await Promise.all([
      board.preload("engine"),
      board.preload("skid"),
      board.preload("impact"),
    ]);
    if (disposed) return;

    // Engine loops run on the `sfx` bus (passes through the master limiter).
    if (engineBuf !== null) {
      engineVoice = await board.startLoop("engine", {
        bus: "sfx",
        lowpass: { frequency: 7000, q: 0.7 },
      });
      engineLayer = await board.startLoop("engine", {
        bus: "sfx",
        lowpass: { frequency: 7000, q: 0.7 },
      });
    }
    if (skidBuf !== null) {
      skidVoice = await board.startLoop("skid", { bus: "sfx" });
    }
    impactReady = impactBuf !== null;
  }

  function frame(now: number): void {
    if (disposed) return;
    const dt = clamp((now - lastTime) / 1000, 0, MAX_FRAME_DELTA);
    lastTime = now;
    rafId = requestAnimationFrame(frame);

    const board = soundBoard;
    if (board === null) return;
    const signals = readSignals();

    // Mute everything until the sim reports the first input gesture (spec §8).
    if (signals.started) haveStarted = true;
    const masterTarget = haveStarted ? 1 : 0;

    updateEngine(signals, dt, masterTarget);
    updateSkid(signals, masterTarget);
    updateImpact(board, signals, dt, masterTarget);

    prevSpeed = signals.speed;
    if (impactCooldown > 0) impactCooldown = Math.max(0, impactCooldown - dt);
  }

  function updateEngine(
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

    applyVoice(engineVoice, pitch, engineVol * masterTarget, cutoff);
    if (engineLayer !== null) {
      // The layer voice is the same loop, pitched an octave-ish lower and
      // quieter, for body (spec: "layer vol *0.4").
      applyVoice(
        engineLayer,
        pitch * 0.5,
        engineVol * ENGINE_LAYER_GAIN * masterTarget,
        cutoff,
      );
    }
  }

  function applyVoice(
    voice: AudioLoopVoice,
    pitch: number,
    vol: number,
    cutoff: number | null,
  ): void {
    voice.setPlaybackRate(pitch, 0.03);
    voice.setGain(Math.max(0, vol), 0.03);
    if (cutoff !== null) voice.setLowpassFrequency(cutoff, 0.05);
  }

  function updateSkid(signals: Signals, masterTarget: number): void {
    if (skidVoice === null) return;
    const drift = signals.driftIntensity;
    let targetVol = 0;
    let pitch = 1;
    if (drift > SKID_DRIFT_THRESHOLD) {
      targetVol = remap(clamp(drift, 0.5, 2.5), 0.5, 2.5, 0.05, 0.3);
      pitch = clamp(signals.speed * 3, 1, 3); // speed is normalized 0..1
    }
    skidVol = targetVol;
    skidVoice.setGain(skidVol * masterTarget, 0.05);
    skidVoice.setPlaybackRate(pitch, 0.05);
  }

  function updateImpact(
    board: AudioSoundBoard,
    signals: Signals,
    _dt: number,
    masterTarget: number,
  ): void {
    if (!impactReady) return;
    if (masterTarget <= 0) return;
    const drop = prevSpeed - signals.speed;
    if (drop > IMPACT_SPEED_DROP_THRESHOLD && impactCooldown === 0) {
      const impactVel = clamp(drop * IMPACT_VEL_SCALE, 0, 6);
      const vol = clamp(remap(impactVel, 0, 6, 0.01, 1.0), 0.01, 1.0);
      void board.playOneShot("impact", {
        bus: "sfx",
        gain: vol * masterTarget,
      });
      impactCooldown = IMPACT_MIN_INTERVAL;
    }
  }

  function teardownGraph(): void {
    soundBoard?.dispose();
    soundBoard = null;
    engineVoice = null;
    engineLayer = null;
    skidVoice = null;
    impactReady = false;
  }

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      gestureStarter.dispose();
      if (rafId !== 0) cancelAnimationFrame(rafId);
      teardownGraph();
    },
  };
}
