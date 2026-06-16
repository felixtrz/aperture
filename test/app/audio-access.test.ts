import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import {
  AudioSimulationSpace,
  createSystem,
} from "@aperture-engine/app/systems";
import type { Entity } from "@aperture-engine/simulation";

describe("app audio access", () => {
  it("authors stable loops and one-shot epochs from systems", async () => {
    const refs: { loop: Entity | null; impact: Entity | null } = {
      loop: null,
      impact: null,
    };

    class AudioSetupSystem extends createSystem({ priority: 0 }) {
      #fired = false;

      override update(): void {
        const loop = this.audio.loop("engine", {
          clip: this.audio.clip("engine"),
          busId: "sfx",
          gain: 0.2,
          timeScale: 1.5,
          lowpass: { frequency: 1200, q: 0.8 },
          simulationSpace: AudioSimulationSpace.Local,
        });
        refs.loop = loop.entity;

        if (!this.#fired) {
          refs.impact = this.audio.playOneShot("impact", {
            clip: this.audio.clip("impact"),
            busId: "sfx",
            gain: 0.75,
            simulationSpace: AudioSimulationSpace.Local,
          });
          this.#fired = true;
        }
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          engine: asset.audio("data:audio/ogg;base64,AQIDBA==", {
            preload: "blocking",
            durationHint: 2,
          }),
          impact: asset.audio("data:audio/ogg;base64,AQIDBA==", {
            preload: "blocking",
            durationHint: 0.5,
          }),
        },
        audio: true,
      }),
      systems: [{ default: AudioSetupSystem }],
    });

    const snapshot = app.stepAndExtract(1 / 60, 0, 1);
    const loopPacket = snapshot.audioEmitters?.find(
      (packet) => packet.entity.index === refs.loop?.index,
    );
    const impactPacket = snapshot.audioEmitters?.find(
      (packet) => packet.entity.index === refs.impact?.index,
    );

    expect(snapshot.report.audioEmitters).toBe(2);
    expect(loopPacket).toMatchObject({
      clip: { kind: "audio-clip", id: "engine" },
      loop: true,
      autoplay: true,
      simulationSpace: "local",
    });
    expect(loopPacket?.gain).toBeCloseTo(0.2);
    expect(loopPacket?.timeScale).toBeCloseTo(1.5);
    expect(loopPacket?.lowpassFrequency).toBeCloseTo(1200);
    expect(loopPacket?.lowpassQ).toBeCloseTo(0.8);
    expect(impactPacket).toMatchObject({
      clip: { kind: "audio-clip", id: "impact" },
      loop: false,
      autoplay: true,
      playEpoch: 1,
      simulationSpace: "local",
    });
    expect(impactPacket?.gain).toBeCloseTo(0.75);
    expect(snapshot.diagnostics).toEqual([]);
  });
});
