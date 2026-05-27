import { describe, expect, it } from "vitest";

import * as webgpu from "@aperture-engine/webgpu";
import {
  createWebGpuAppPickSharedBindGroups,
  popWebGpuPickErrorScope,
  pushWebGpuPickErrorScope,
  webGpuAppPickPixel,
} from "../../packages/webgpu/src/app/picking.js";
import type { WebGpuIdBufferPickPipelineResource } from "../../packages/webgpu/src/picking/id-buffer-pick.js";

describe("WebGPU app picking helpers", () => {
  it("floors finite canvas coordinates and rejects out-of-bounds picks", () => {
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, 2.9, 1.1)).toEqual({
      x: 2,
      y: 1,
    });
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, -1, 1)).toBeNull();
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, 8, 1)).toBeNull();
    expect(webGpuAppPickPixel({ width: 8, height: 4 }, 1, 4)).toBeNull();
    expect(
      webGpuAppPickPixel({ width: 8, height: 4 }, Number.NaN, 1),
    ).toBeNull();
  });

  it("creates shared pick bind groups from pipeline layouts", () => {
    const descriptors: unknown[] = [];
    const device = {
      createBindGroup: (descriptor: unknown) => {
        descriptors.push(descriptor);
        return `bind-group:${descriptors.length}`;
      },
    };
    const pipeline = pickPipeline();

    const result = createWebGpuAppPickSharedBindGroups({
      device,
      pipeline,
      viewUniformBuffer: "view-buffer",
      worldTransformBuffer: "transform-buffer",
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.viewBindGroup).toMatchObject({
      group: 0,
      resourceKey: "id-buffer-pick/view",
      bindGroup: "bind-group:1",
    });
    expect(result.worldTransformBindGroup).toMatchObject({
      group: 1,
      resourceKey: "id-buffer-pick/world-transforms",
      bindGroup: "bind-group:2",
    });
    expect(descriptors).toEqual([
      expect.objectContaining({ layout: "view-layout" }),
      expect.objectContaining({ layout: "world-layout" }),
    ]);
  });

  it("diagnoses missing pick bind group support", () => {
    const result = createWebGpuAppPickSharedBindGroups({
      device: {},
      pipeline: pickPipeline(),
      viewUniformBuffer: "view-buffer",
      worldTransformBuffer: "transform-buffer",
    });

    expect(result.valid).toBe(false);
    expect(result.viewBindGroup.bindGroup).toBeNull();
    expect(result.worldTransformBindGroup.bindGroup).toBeNull();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "webGpuApp.pickCreateBindGroupUnavailable",
      }),
    ]);
  });

  it("keeps diagnostic error scopes best-effort", async () => {
    const events: string[] = [];
    const scoped = {
      pushErrorScope: (filter: "validation") => {
        events.push(`push:${filter}`);
      },
      popErrorScope: async () => ({ message: "validation failed" }),
    };

    pushWebGpuPickErrorScope(scoped);

    await expect(popWebGpuPickErrorScope(scoped)).resolves.toBe(
      "validation failed",
    );
    await expect(popWebGpuPickErrorScope({})).resolves.toBeNull();
    expect(() =>
      pushWebGpuPickErrorScope({
        pushErrorScope: () => {
          throw new Error("scope unavailable");
        },
      }),
    ).not.toThrow();
    expect(events).toEqual(["push:validation"]);
  });

  it("keeps app picking helpers off the public WebGPU package surface", () => {
    expect("webGpuAppPickPixel" in webgpu).toBe(false);
    expect("createWebGpuAppPickSharedBindGroups" in webgpu).toBe(false);
  });
});

function pickPipeline(): WebGpuIdBufferPickPipelineResource {
  return {
    cacheKey: "pick-pipeline",
    shaderModule: "shader-module",
    pipeline: "pipeline",
    descriptor: { label: "pick-pipeline" },
    layouts: {
      view: "view-layout",
      worldTransforms: "world-layout",
      ids: "ids-layout",
    },
  };
}
