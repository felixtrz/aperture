import { describe, expect, it } from "vitest";

import {
  materialPipelineFamilyFromKey,
  requiredBindGroupGroupsForPipelineKey,
} from "@aperture-engine/webgpu/test-support";

describe("material pipeline selection", () => {
  it("selects WebGPU material pipeline families from extracted batch keys", () => {
    expect(materialPipelineFamilyFromKey("unlit|opaque|back|less|none")).toBe(
      "unlit",
    );
    expect(
      materialPipelineFamilyFromKey("standard|opaque|back|less|none"),
    ).toBe("standard");
    expect(
      materialPipelineFamilyFromKey(
        "matcap|matcapTexture|opaque|back|less|none",
      ),
    ).toBe("matcap");
    expect(
      materialPipelineFamilyFromKey("debug-normal|opaque|back|less|none"),
    ).toBe("debug-normal");
    expect(materialPipelineFamilyFromKey("pipeline:legacy")).toBeNull();
  });

  it("requires the light bind group only for standard material draws", () => {
    expect(
      requiredBindGroupGroupsForPipelineKey("unlit|opaque|back|less|none"),
    ).toEqual([0, 1, 2]);
    expect(
      requiredBindGroupGroupsForPipelineKey(
        "matcap|matcapTexture|opaque|back|less|none",
      ),
    ).toEqual([0, 1, 2]);
    expect(
      requiredBindGroupGroupsForPipelineKey(
        "debug-normal|opaque|back|less|none",
      ),
    ).toEqual([0, 1, 2]);
    expect(
      requiredBindGroupGroupsForPipelineKey("standard|opaque|back|less|none"),
    ).toEqual([0, 1, 2, 3]);
    expect(
      requiredBindGroupGroupsForPipelineKey(
        "standard|shadowMap|opaque|back|less|none",
      ),
    ).toEqual([0, 1, 2, 3]);
    expect(requiredBindGroupGroupsForPipelineKey("pipeline:legacy")).toEqual([
      0, 1, 2,
    ]);
  });
});
