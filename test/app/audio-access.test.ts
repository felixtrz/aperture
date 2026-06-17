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

  it("authors loop lifecycle and automation descriptors as JSON-safe packets", async () => {
    const refs: {
      loop: Entity | null;
      missingPause: boolean | null;
      missingAutomation: boolean | null;
      resumeResult: boolean | null;
    } = {
      loop: null,
      missingPause: null,
      missingAutomation: null,
      resumeResult: null,
    };

    class AudioAutomationSystem extends createSystem({ priority: 0 }) {
      #stage = 0;

      override update(): void {
        const loop = this.audio.loop("engine", {
          clip: this.audio.clip("engine"),
          busId: "sfx",
          gain: 0,
          timeScale: 1,
          lowpass: { frequency: 22000, q: 0.7 },
          simulationSpace: AudioSimulationSpace.Local,
        });
        refs.loop = loop.entity;

        if (this.#stage === 0) {
          refs.missingPause = this.audio.pause("missing");
          refs.missingAutomation =
            this.audio.automate("missing", { gain: 1 }) === null;
          loop
            .automate({
              gain: { target: 0.4 },
              timeScale: { target: 1.2 },
              lowpass: {
                frequency: { target: 900 },
                q: { target: 0.9 },
              },
            })
            .pause();
        } else {
          refs.resumeResult = this.audio.resume("engine");
          this.audio.automate("engine", {
            gain: { target: 0.6 },
            timeScale: 0.75,
            lowpass: false,
          });
        }

        this.#stage += 1;
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
        },
        audio: true,
      }),
      systems: [{ default: AudioAutomationSystem }],
    });

    const pausedSnapshot = app.stepAndExtract(1 / 60, 0, 1);
    const pausedPacket = pausedSnapshot.audioEmitters?.find(
      (packet) => packet.entity.index === refs.loop?.index,
    );

    expect(refs.missingPause).toBe(false);
    expect(refs.missingAutomation).toBe(true);
    expect(pausedPacket).toMatchObject({
      clip: { kind: "audio-clip", id: "engine" },
      loop: true,
      autoplay: true,
      muted: true,
      simulationSpace: "local",
    });
    expect(pausedPacket?.gain).toBeCloseTo(0.4);
    expect(pausedPacket?.timeScale).toBeCloseTo(1.2);
    expect(pausedPacket?.lowpassFrequency).toBeCloseTo(900);
    expect(pausedPacket?.lowpassQ).toBeCloseTo(0.9);
    const serializedPausedPacket = JSON.parse(
      JSON.stringify(pausedPacket),
    ) as typeof pausedPacket;
    expect(serializedPausedPacket).toMatchObject({
      muted: true,
      lowpassFrequency: 900,
    });
    expect(serializedPausedPacket?.gain).toBeCloseTo(0.4);
    expect(serializedPausedPacket?.timeScale).toBeCloseTo(1.2);
    expect(serializedPausedPacket?.lowpassQ).toBeCloseTo(0.9);

    const resumedSnapshot = app.stepAndExtract(1 / 60, 1 / 60, 2);
    const resumedPacket = resumedSnapshot.audioEmitters?.find(
      (packet) => packet.entity.index === refs.loop?.index,
    );

    expect(refs.resumeResult).toBe(true);
    expect(resumedPacket).toMatchObject({
      loop: true,
      autoplay: true,
      muted: false,
    });
    expect(resumedPacket?.gain).toBeCloseTo(0.6);
    expect(resumedPacket?.timeScale).toBeCloseTo(0.75);
    expect(resumedPacket?.lowpassFrequency).toBeCloseTo(22000);
    expect(resumedPacket?.lowpassQ).toBeCloseTo(0.7);
    expect(resumedSnapshot.diagnostics).toEqual([]);
  });
});
