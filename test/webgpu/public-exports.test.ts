import { describe, expect, it } from "vitest";

import * as publicWebGpu from "@aperture-engine/webgpu";
import * as webGpuTestSupport from "@aperture-engine/webgpu/test-support";

describe("WebGPU public exports", () => {
  it("keeps app-facing helpers on the root barrel", () => {
    expect(publicWebGpu).toHaveProperty("createWebGpuApp");
    expect(publicWebGpu).toHaveProperty("initializeWebGpu");
    expect(publicWebGpu).toHaveProperty("createWebGpuBloomPostEffect");
    expect(publicWebGpu).toHaveProperty("createReadbackCanvasTextureUsage");
  });

  it("keeps simulation/render barrels out of the WebGPU root", () => {
    expect(publicWebGpu).not.toHaveProperty("AssetRegistry");
    expect(publicWebGpu).not.toHaveProperty("createWorld");
    expect(publicWebGpu).not.toHaveProperty("createPreparedMaterialStore");
  });

  it("keeps full backend coverage available through test support", () => {
    expect(webGpuTestSupport).toHaveProperty("AssetRegistry");
    expect(webGpuTestSupport).toHaveProperty("createWorld");
    expect(webGpuTestSupport).toHaveProperty("createPreparedMaterialStore");
  });
});
