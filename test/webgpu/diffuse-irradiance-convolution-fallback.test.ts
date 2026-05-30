import { describe, expect, it } from "vitest";

import {
  createDiffuseIblTextureResourceReport,
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  createIblTexturePreparationReport,
  type DiffuseIblCubeSource,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu/test-support";

// A device that can allocate + upload textures but has NO compute support, like
// the headless/worker-safe fake devices the simulation tests use. The irradiance
// convolution must degrade gracefully on such a device (verbatim upload), per the
// headless/worker-safe architectural invariant.
function deviceWithoutCompute(): TextureGpuDeviceLike {
  return {
    createTexture: () => ({ createView: () => ({}) }),
    queue: { writeTexture: () => {} },
  };
}

function studioTextures() {
  return createIblTexturePreparationReport({
    descriptors: createIblResourceDescriptorReport({
      snapshot: [
        {
          environmentId: 1,
          handle: createEnvironmentMapHandle("studio"),
          color: [1, 1, 1, 1],
          intensity: 1,
          layerMask: 1,
        },
      ],
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
          diffuseResourceKey: "texture:studio:diffuse-irradiance",
          specularResourceKey: "texture:studio:specular-prefilter",
        },
      ],
    }),
    preparation: "ready",
  });
}

const FACE_SIZE = 4;
const diffuseSource: DiffuseIblCubeSource = {
  environmentMapResourceKey: "environment-map:studio",
  faceSize: FACE_SIZE,
  format: "rgba8unorm",
  faces: Array.from(
    { length: 6 },
    () => new Uint8Array(FACE_SIZE * FACE_SIZE * 4),
  ),
};

describe("diffuse irradiance convolution device fallback", () => {
  it("falls back to a verbatim cube + deferred diagnostic when the device cannot run compute", () => {
    const report = createDiffuseIblTextureResourceReport({
      device: deviceWithoutCompute(),
      textures: studioTextures(),
      diffuseSources: [diffuseSource],
    });

    // The diffuse cube is still produced (no crash) — just not convolved.
    expect(report.ready).toBe(true);
    expect(report.resources[0]?.valid).toBe(true);
    expect(report.convolved).toBeUndefined();
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "iblTextureResource.diffuseIrradianceConvolutionDeferred",
    );
  });

  it("uploads verbatim with NO deferred diagnostic when convolveIrradiance is explicitly disabled", () => {
    const report = createDiffuseIblTextureResourceReport({
      device: deviceWithoutCompute(),
      textures: studioTextures(),
      convolveIrradiance: false,
      diffuseSources: [diffuseSource],
    });

    expect(report.ready).toBe(true);
    expect(report.convolved).toBeUndefined();
    expect(
      report.diagnostics.map((diagnostic) => diagnostic.code),
    ).not.toContain("iblTextureResource.diffuseIrradianceConvolutionDeferred");
  });
});
