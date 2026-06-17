import { describe, expect, it } from "vitest";
import {
  SOURCE_FOOTSTEP_GAIN,
  SOURCE_FOOTSTEP_VOLUME_DB,
  dbToLinearGain,
  sourceEnemyDamageAudioEvents,
  sourceFootstepAudible,
} from "../../fps/src/lib/fps-audio.js";

describe("Starter Kit FPS audio", () => {
  it("uses the source footstep volume in linear gain", () => {
    expect(SOURCE_FOOTSTEP_VOLUME_DB).toBe(-5);
    expect(SOURCE_FOOTSTEP_GAIN).toBeCloseTo(0.562341, 6);
    expect(dbToLinearGain(-5)).toBeCloseTo(SOURCE_FOOTSTEP_GAIN, 10);
  });

  it("audibilizes footsteps from grounded source velocity components", () => {
    expect(
      sourceFootstepAudible({
        grounded: true,
        velocityX: 1,
        velocityZ: 0,
      }),
    ).toBe(false);
    expect(
      sourceFootstepAudible({
        grounded: true,
        velocityX: 1.01,
        velocityZ: 0,
      }),
    ).toBe(true);
    expect(
      sourceFootstepAudible({
        grounded: true,
        velocityX: 0,
        velocityZ: -1.01,
      }),
    ).toBe(true);
    expect(
      sourceFootstepAudible({
        grounded: false,
        velocityX: 5,
        velocityZ: 0,
      }),
    ).toBe(false);
  });

  it("plays source enemy hurt before destroy on lethal damage", () => {
    expect(
      sourceEnemyDamageAudioEvents({
        currentHealth: 100,
        damage: 25,
      }),
    ).toEqual(["enemy-hurt"]);

    expect(
      sourceEnemyDamageAudioEvents({
        currentHealth: 25,
        damage: 25,
      }),
    ).toEqual(["enemy-hurt", "enemy-destroy"]);

    expect(
      sourceEnemyDamageAudioEvents({
        currentHealth: 10,
        damage: 25,
      }),
    ).toEqual(["enemy-hurt", "enemy-destroy"]);
  });

  it("does not emit enemy damage audio for already destroyed enemies", () => {
    expect(
      sourceEnemyDamageAudioEvents({
        currentHealth: 0,
        damage: 25,
      }),
    ).toEqual([]);
  });
});
