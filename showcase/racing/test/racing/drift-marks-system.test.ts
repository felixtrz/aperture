import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import { VehicleResource } from "../../src/lib/vehicle-resource.js";
import DriftMarksSystem from "../../src/systems/drift-marks.system.js";

describe("racing drift marks", () => {
  it("publishes renderable rear tire trail meshes while drifting", async () => {
    class DriftSetupSystem extends createSystem({ priority: 0 }) {
      #frame = 0;

      override init(): void {
        this.spawn.camera({
          key: "camera.drift-marks",
          transform: { translation: [0, 4, 8], lookAt: [0, 0, 0] },
          camera: { frustumCulling: false },
        });
      }

      override update(): void {
        const offset = this.#frame * 0.1;

        this.resources.write(VehicleResource, (vehicle) => {
          vehicle.ready = true;
          vehicle.container = [0, 0, 0];
          vehicle.driftIntensity = 1;
          vehicle.linearSpeed = 2;
          vehicle.wheelBL = [-1 + offset, 0, 0];
          vehicle.wheelBR = [1 + offset, 0, 0];
        });

        this.#frame += 1;
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      fixedStep: { fixedDelta: 1 / 60 },
      systems: [{ default: DriftSetupSystem }, { default: DriftMarksSystem }],
    });

    app.stepAndExtract(1 / 60, 0, 1);
    const snapshot = app.stepAndExtract(1 / 60, 1 / 60, 2);
    const driftDraws = snapshot.meshDraws.filter(
      (draw) => draw.material.id === "racing.driftMarks.material",
    );

    expect(snapshot.diagnostics).toEqual([]);
    expect(driftDraws).toHaveLength(2);
    expect(driftDraws.map((draw) => draw.indexCount)).toEqual([6, 6]);
  });
});
