import { describe, expect, it } from "vitest";
import {
  SOURCE_FOOTSTEP_GAIN,
  SOURCE_FOOTSTEP_VOLUME_DB,
  SOURCE_ONE_SHOT_GAIN,
  SOURCE_ONE_SHOT_MAX_TIME_SCALE,
  SOURCE_ONE_SHOT_MIN_TIME_SCALE,
  SOURCE_ONE_SHOT_VOLUME_DB,
  dbToLinearGain,
  sourceEnemyDamageAudioEvents,
  sourceFootstepAudible,
  sourceOneShotTimeScale,
} from "../../fps/src/lib/fps-audio.js";

describe("Starter Kit FPS audio", () => {
  it("uses the source footstep volume in linear gain", () => {
    expect(SOURCE_FOOTSTEP_VOLUME_DB).toBe(-5);
    expect(SOURCE_FOOTSTEP_GAIN).toBeCloseTo(0.562341, 6);
    expect(dbToLinearGain(-5)).toBeCloseTo(SOURCE_FOOTSTEP_GAIN, 10);
  });

  it("uses the source one-shot audio pool volume and pitch range", () => {
    expect(SOURCE_ONE_SHOT_VOLUME_DB).toBe(-10);
    expect(SOURCE_ONE_SHOT_GAIN).toBeCloseTo(0.316228, 6);
    expect(dbToLinearGain(-10)).toBeCloseTo(SOURCE_ONE_SHOT_GAIN, 10);
    expect(SOURCE_ONE_SHOT_MIN_TIME_SCALE).toBe(0.9);
    expect(SOURCE_ONE_SHOT_MAX_TIME_SCALE).toBe(1.1);

    expect(sourceOneShotTimeScale(0)).toBeCloseTo(0.9, 10);
    expect(sourceOneShotTimeScale(0.5)).toBeCloseTo(1, 10);
    expect(sourceOneShotTimeScale(1)).toBeCloseTo(1.1, 10);
    expect(sourceOneShotTimeScale(-1)).toBeCloseTo(0.9, 10);
    expect(sourceOneShotTimeScale(Number.NaN)).toBeCloseTo(0.9, 10);
    expect(sourceOneShotTimeScale(2)).toBeCloseTo(1.1, 10);
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
