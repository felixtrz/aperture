import {
  AudioSimulationSpace,
  clamp,
  createSystem,
  lerp,
  remapClamped as remap,
} from "@aperture-engine/app/systems";
import { MAX_SPEED } from "../lib/tuning.js";
import { VehicleResource } from "../lib/vehicle-resource.js";

// Port of the REFERENCE_SPEC §8 audio model. Aperture owns AudioContext unlock,
// clip decode/cache, graph nodes, looping voices, one-shots, and mixer routing;
// racing only authors ECS audio intent from deterministic vehicle state.

const GEAR_COUNT = 3;
const GEAR_WINDOW = 1 / GEAR_COUNT;
const UPSHIFT_RPM = 0.92;
const DOWNSHIFT_RPM = 0.35;
const SHIFT_COOLDOWN = 0.35;
const PITCH_LOW = [1.05, 1.25, 1.4] as const;
const PITCH_HIGH = [3.5, 2.9, 2.3] as const;
const ENGINE_LAYER_GAIN = 0.4;

const SKID_DRIFT_THRESHOLD = 0.5;

const IMPACT_SPEED_DROP_THRESHOLD = 0.18;
const IMPACT_VEL_SCALE = 6 / 0.6;
const IMPACT_MIN_INTERVAL = 0.12;

const MAX_FRAME_DELTA = 0.05;

export default class RacingAudioSystem extends createSystem({ priority: 127 }) {
  #gear = 0;
  #rpm = 0;
  #shiftTimer = 0;
  #engineVol = 0;
  #skidVol = 0;
  #prevSpeed = 0;
  #impactCooldown = 0;
  #haveStarted = false;

  override update(delta: number): void {
    const vehicle = this.resources.read(VehicleResource);
    const dt = clamp(delta, 0, MAX_FRAME_DELTA);

    if (!vehicle.ready || dt <= 0) {
      return;
    }

    const speed = clamp(Math.abs(vehicle.linearSpeed) / MAX_SPEED, 0, 1);
    const throttle = vehicle.throttle;

    if (vehicle.hadInput) {
      this.#haveStarted = true;
    }
    const masterTarget = this.#haveStarted ? 1 : 0;

    this.#updateEngine(speed, throttle, dt, masterTarget);
    this.#updateSkid(speed, vehicle.driftIntensity, masterTarget);
    this.#updateImpact(speed, masterTarget);

    this.#prevSpeed = speed;
    if (this.#impactCooldown > 0) {
      this.#impactCooldown = Math.max(0, this.#impactCooldown - dt);
    }
  }

  #updateEngine(
    absSpeed: number,
    throttle: number,
    dt: number,
    masterTarget: number,
  ): void {
    if (this.#shiftTimer > 0) {
      this.#shiftTimer = Math.max(0, this.#shiftTimer - dt);
    }
    if (this.#shiftTimer === 0) {
      if (this.#rpm > UPSHIFT_RPM && this.#gear < GEAR_COUNT - 1) {
        this.#gear += 1;
        this.#shiftTimer = SHIFT_COOLDOWN;
      } else if (this.#rpm < DOWNSHIFT_RPM && this.#gear > 0) {
        this.#gear -= 1;
        this.#shiftTimer = SHIFT_COOLDOWN;
      }
    }

    const gearStart = this.#gear * GEAR_WINDOW;
    const inGear = clamp((absSpeed - gearStart) / GEAR_WINDOW, 0, 1);
    const targetRpm = clamp(inGear * 0.85 + throttle * 0.2, 0, 1.05);
    const rate = targetRpm > this.#rpm ? 4 * (0.3 + Math.max(0, throttle)) : 4;
    this.#rpm = lerp(this.#rpm, targetRpm, Math.min(1, dt * rate));

    const low = PITCH_LOW[this.#gear] ?? PITCH_LOW[0];
    const high = PITCH_HIGH[this.#gear] ?? PITCH_HIGH[0];
    const pitch = lerp(low, high, this.#rpm);

    const targetVol = remap(absSpeed + throttle * 0.5, 0, 1.5, 0.02, 0.25);
    this.#engineVol = lerp(this.#engineVol, targetVol, Math.min(1, dt * 5));

    const cutoff = remap(throttle, 0, 1, 700, 7000);
    this.audio.loop("racing.engine", {
      clip: this.audio.clip("engine"),
      busId: "sfx",
      gain: this.#engineVol * masterTarget,
      timeScale: pitch,
      lowpass: { frequency: cutoff, q: 0.7 },
      simulationSpace: AudioSimulationSpace.Local,
    });
    this.audio.loop("racing.engine.layer", {
      clip: this.audio.clip("engine"),
      busId: "sfx",
      gain: this.#engineVol * ENGINE_LAYER_GAIN * masterTarget,
      timeScale: pitch * 0.5,
      lowpass: { frequency: cutoff, q: 0.7 },
      simulationSpace: AudioSimulationSpace.Local,
    });
  }

  #updateSkid(
    speed: number,
    driftIntensity: number,
    masterTarget: number,
  ): void {
    let targetVol = 0;
    let pitch = 1;
    if (driftIntensity > SKID_DRIFT_THRESHOLD) {
      targetVol = remap(clamp(driftIntensity, 0.5, 2.5), 0.5, 2.5, 0.05, 0.3);
      pitch = clamp(speed * 3, 1, 3);
    }
    this.#skidVol = targetVol;
    this.audio.loop("racing.skid", {
      clip: this.audio.clip("skid"),
      busId: "sfx",
      gain: this.#skidVol * masterTarget,
      timeScale: pitch,
      simulationSpace: AudioSimulationSpace.Local,
    });
  }

  #updateImpact(speed: number, masterTarget: number): void {
    if (masterTarget <= 0) {
      return;
    }
    const drop = this.#prevSpeed - speed;
    if (drop > IMPACT_SPEED_DROP_THRESHOLD && this.#impactCooldown === 0) {
      const impactVel = clamp(drop * IMPACT_VEL_SCALE, 0, 6);
      const gain = clamp(remap(impactVel, 0, 6, 0.01, 1), 0.01, 1);
      this.audio.playOneShot("racing.impact", {
        clip: this.audio.clip("impact"),
        busId: "sfx",
        gain: gain * masterTarget,
        simulationSpace: AudioSimulationSpace.Local,
      });
      this.#impactCooldown = IMPACT_MIN_INTERVAL;
    }
  }
}
