import { describe, expect, it } from "vitest";

import * as webgpu from "@aperture-engine/webgpu";
import {
  recordPreparedAppMaterialResourceUse,
  type PreparedAppMaterialResourceReuseCounters,
} from "../../packages/webgpu/src/webgpu/prepared-app-material-resource.js";

describe("prepared app material resource reuse counters", () => {
  it("records created and reused prepared material resources consistently", () => {
    const counters = reuseCounters();

    recordPreparedAppMaterialResourceUse(
      counters,
      { status: "created", resource: { id: "first" } },
      3,
    );
    recordPreparedAppMaterialResourceUse(
      counters,
      { status: "reused", resource: { id: "second" } },
      3,
    );

    expect(counters).toMatchObject({
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      bindGroupsCreated: 5,
      bindGroupsReused: 1,
    });
  });

  it("keeps the helper off the public WebGPU package surface", () => {
    expect("recordPreparedAppMaterialResourceUse" in webgpu).toBe(false);
  });
});

function reuseCounters(): PreparedAppMaterialResourceReuseCounters {
  return {
    materialBuffersCreated: 0,
    materialBuffersReused: 0,
    preparedMaterialBuffersCreated: 0,
    preparedMaterialBuffersReused: 0,
    preparedMaterialBindGroupsCreated: 0,
    preparedMaterialBindGroupsReused: 0,
    bindGroupsCreated: 0,
    bindGroupsReused: 0,
  };
}
