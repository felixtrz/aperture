import { describe, expect, it } from "vitest";

import {
  createOrReuseWebGpuDepthTexture,
  createWebGpuDepthTextureCacheSlot,
} from "../../packages/webgpu/src/webgpu/depth-texture-resource.js";

describe("WebGPU app depth texture resource", () => {
  it("reuses matching depth textures and recreates resized targets", () => {
    const events: string[] = [];
    let textureId = 0;
    const device = {
      createTexture(descriptor: unknown) {
        textureId += 1;
        const id = textureId;

        events.push(`create:${JSON.stringify(descriptor)}`);

        return {
          createView() {
            events.push(`view:${id}`);
            return { id: `view:${id}` };
          },
          destroy() {
            events.push(`destroy:${id}`);
          },
        };
      },
    };
    const cache = createWebGpuDepthTextureCacheSlot();

    const first = createOrReuseWebGpuDepthTexture({
      device,
      cache,
      width: 640,
      height: 360,
    });
    const second = createOrReuseWebGpuDepthTexture({
      device,
      cache,
      width: 640,
      height: 360,
    });
    const resized = createOrReuseWebGpuDepthTexture({
      device,
      cache,
      width: 800,
      height: 450,
    });

    expect(first.status).toBe("created");
    expect(first.resource).toMatchObject({
      format: "depth24plus",
      width: 640,
      height: 360,
    });
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(resized.status).toBe("created");
    expect(resized.resource).toMatchObject({ width: 800, height: 450 });
    expect(events).toEqual([
      'create:{"label":"aperture/webgpu-app/depth","size":[640,360,1],"format":"depth24plus","sampleCount":1,"usage":16}',
      "view:1",
      "destroy:1",
      'create:{"label":"aperture/webgpu-app/depth","size":[800,450,1],"format":"depth24plus","sampleCount":1,"usage":16}',
      "view:2",
    ]);
  });
});
