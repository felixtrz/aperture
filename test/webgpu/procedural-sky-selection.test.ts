import { describe, expect, it } from "vitest";
import type {
  ProceduralSkyPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { selectProceduralSkyForView } from "../../packages/webgpu/src/app/procedural-sky.js";

function sky(
  skyId: number,
  priority: number,
  layerMask = 1,
): ProceduralSkyPacket {
  return {
    skyId,
    entity: { index: skyId, generation: 0 },
    model: "gradient",
    priority,
    topColor: [0, 0, 0],
    horizonColor: [0, 0, 0],
    bottomColor: [0, 0, 0],
    horizonPosition: 0.4,
    horizonSoftness: 0.24,
    intensity: 1,
    sunDirection: [0, 1, 0],
    sunColor: [1, 1, 1],
    sunRadius: 0.02,
    sunGlow: 0.35,
    ditherStrength: 0.003,
    layerMask,
  } as ProceduralSkyPacket;
}

const view = { layerMask: 1 } as RenderSnapshot["views"][number];

describe("selectProceduralSkyForView", () => {
  it("draws the highest-priority layer-matching sky, not the first", () => {
    expect(
      selectProceduralSkyForView([sky(1, 0), sky(2, 5), sky(3, 2)], view)
        ?.skyId,
    ).toBe(2);
  });

  it("keeps extraction order on ties and skips other layers", () => {
    expect(
      selectProceduralSkyForView([sky(1, 3), sky(2, 3)], view)?.skyId,
    ).toBe(1);
    expect(
      selectProceduralSkyForView([sky(1, 9, 2), sky(2, 0)], view)?.skyId,
    ).toBe(2);
    expect(selectProceduralSkyForView([sky(1, 9, 2)], view)).toBeNull();
  });
});
