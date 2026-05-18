import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase, RgbaTuple } from "./example-status-types.js";
import type { SceneReadbackStatus } from "./example-status-types.js";

interface StandardGltfTextureStatus extends ExampleStatusBase {
  readonly fixtureId?: string;
  readonly expectedFailure?: boolean;
  readonly expectedMappingDiagnostic?: string;
  readonly expectedDiagnostic?: string;
  readonly expectedTextureStatus?: string;
  readonly materialModel?: string;
  readonly renderingBackend?: string;
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly gltf?: {
    readonly assetMapping: {
      readonly valid: boolean;
      readonly textureCount: number;
      readonly samplerCount: number;
      readonly materialCount: number;
      readonly diagnostics: number;
      readonly diagnosticCodes?: readonly string[];
      readonly samplers?: readonly StandardGltfTextureSamplerMappingStatus[];
    };
    readonly meshConstruction: {
      readonly valid: boolean;
      readonly meshCount: number;
      readonly diagnostics: number;
    };
    readonly registration: {
      readonly valid: boolean;
      readonly written: number;
      readonly diagnostics: number;
      readonly stages: readonly {
        readonly stage: string;
        readonly status: string;
        readonly writtenCount: number;
        readonly skippedCount: number;
        readonly diagnosticCount: number;
      }[];
    };
  };
  readonly standardTexture?: {
    readonly meshKey: string;
    readonly materialKey: string;
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly textureSlot: string;
    readonly samplerMapping?: StandardGltfTextureSamplerMappingStatus;
    readonly expectedTextureColor?: RgbaTuple | null;
    readonly expectedMetallicRoughness?: {
      readonly metallic: number;
      readonly roughness: number;
    } | null;
    readonly expectedNormalMap?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly expectedTextureTransform?: {
      readonly offset?: readonly [number, number];
      readonly scale?: readonly [number, number];
      readonly rotation?: number;
    } | null;
    readonly sample: { readonly x: number; readonly y: number };
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly resources?: {
    readonly textureResourcesCreated: number;
    readonly samplerResourcesCreated: number;
    readonly materialBuffersCreated: number;
    readonly bindGroupsCreated: number;
  };
  readonly pipelines?: {
    readonly keys: readonly string[];
    readonly meshLayoutKeys?: readonly string[];
  };
  readonly draw?: {
    readonly packages: number;
    readonly commands: number;
    readonly drawCalls: number;
  };
  readonly diagnosticCodes?: readonly string[];
  readonly readback?: SceneReadbackStatus;
}

interface StandardGltfTextureSamplerMappingStatus {
  readonly handleKey: string | null;
  readonly textureIndex: number | null;
  readonly slot: string | null;
  readonly source: {
    readonly magFilter: number;
    readonly minFilter: number;
    readonly wrapS: number;
    readonly wrapT: number;
  };
  readonly mapped: {
    readonly kind: string;
    readonly label: string;
    readonly addressModeU: string;
    readonly addressModeV: string;
    readonly addressModeW: string;
    readonly magFilter: string;
    readonly minFilter: string;
    readonly mipmapFilter: string;
    readonly lodMinClamp: number;
    readonly lodMaxClamp: number;
    readonly maxAnisotropy: number;
  } | null;
}

test("standard glTF texture fixture renders a mapped base-color texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-gltf-texture.html");

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus("standard-gltf-texture-status", status);
  expect(status, "standard glTF texture status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "ready",
    materialModel: "gltf-standard-base-color-texture",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    fixtureId: "inline-gltf-standard-base-color-texture",
    materialModel: "gltf-standard-base-color-texture",
    ok: true,
    phase: "rendered",
    renderingBackend: "webgpu-explicit",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 0,
        samplers: [
          {
            handleKey: "gltf:sampler:0:baseColorTexture",
            textureIndex: 0,
            slot: "baseColorTexture",
            source: {
              magFilter: 9728,
              minFilter: 9728,
              wrapS: 33071,
              wrapT: 33071,
            },
            mapped: {
              kind: "sampler",
              addressModeU: "clamp-to-edge",
              addressModeV: "clamp-to-edge",
              addressModeW: "repeat",
              magFilter: "nearest",
              minFilter: "nearest",
              mipmapFilter: "nearest",
              lodMinClamp: 0,
              lodMaxClamp: 32,
              maxAnisotropy: 1,
            },
          },
        ],
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: true,
        written: 4,
        diagnostics: 0,
      },
    },
    standardTexture: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      textureKey: "texture:gltf:texture:0:baseColorTexture",
      samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      textureSlot: "baseColorTexture",
      samplerMapping: {
        source: {
          magFilter: 9728,
          minFilter: 9728,
          wrapS: 33071,
          wrapT: 33071,
        },
        mapped: {
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
          magFilter: "nearest",
          minFilter: "nearest",
          mipmapFilter: "nearest",
        },
      },
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.gltf?.registration.stages).toEqual([
    {
      stage: "materialTextureSamplerRegistration",
      status: "provided",
      writtenCount: 3,
      skippedCount: 0,
      diagnosticCount: 0,
    },
    {
      stage: "meshRegistration",
      status: "provided",
      writtenCount: 1,
      skippedCount: 0,
      diagnosticCount: 0,
    },
  ]);
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );

  if (status.standardTexture === undefined) {
    throw new Error("standard glTF texture status is missing");
  }
  if (
    status.standardTexture.expectedTextureColor === undefined ||
    status.standardTexture.expectedTextureColor === null
  ) {
    throw new Error("standard glTF texture expected color is missing");
  }

  expect(status.standardTexture.samplerMapping).toEqual(
    status.gltf?.assetMapping.samplers?.[0],
  );
  expectSamplerStatusContainsNoBackendResources(
    status.standardTexture.samplerMapping,
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const texturedSample = readPngPixel(
    screenshot,
    status.standardTexture.sample.x,
    status.standardTexture.sample.y,
  );
  const expectedTexture = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedTextureColor),
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(texturedSample, expectedTexture)).toBeLessThan(
    pixelDistance(texturedSample, clear),
  );
  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(40);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, expectedTexture),
        `glTF texture readback sample should match the mapped base-color texture; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeLessThan(pixelDistance(readbackTextured.pixel, clear));
    }
  } else {
    expect(status.readback?.reason, JSON.stringify(status, null, 2)).toEqual(
      expect.any(String),
    );
    expect(status.readback?.message, JSON.stringify(status, null, 2)).toEqual(
      expect.any(String),
    );
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders a mapped metallic-roughness texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=metallic-roughness",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-metallic-roughness-status",
    status,
  );
  expect(
    status,
    "standard glTF metallic-roughness texture status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "metallic-roughness",
    materialModel: "gltf-standard-metallic-roughness-texture",
    textureSlot: "metallicRoughnessTexture",
    textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
    samplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
    pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "metallic-roughness",
    materialModel: "gltf-standard-metallic-roughness-texture",
    ok: true,
    phase: "rendered",
    renderingBackend: "webgpu-explicit",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 0,
        samplers: [
          {
            handleKey: "gltf:sampler:0:metallicRoughnessTexture",
            textureIndex: 0,
            slot: "metallicRoughnessTexture",
            source: {
              magFilter: 9728,
              minFilter: 9728,
              wrapS: 33071,
              wrapT: 33071,
            },
            mapped: {
              kind: "sampler",
              addressModeU: "clamp-to-edge",
              addressModeV: "clamp-to-edge",
              magFilter: "nearest",
              minFilter: "nearest",
              mipmapFilter: "nearest",
            },
          },
        ],
      },
      registration: {
        valid: true,
        written: 4,
        diagnostics: 0,
      },
    },
    standardTexture: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
      samplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
      textureSlot: "metallicRoughnessTexture",
      expectedTextureColor: null,
      expectedMetallicRoughness: {
        metallic: expect.any(Number),
        roughness: expect.any(Number),
      },
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.pipelines?.keys).toContain(
    "standard|metallicRoughnessTexture|opaque|back|less|none",
  );
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );

  if (status.standardTexture === undefined) {
    throw new Error("standard glTF metallic-roughness status is missing");
  }

  expect(status.standardTexture.samplerMapping).toEqual(
    status.gltf?.assetMapping.samplers?.[0],
  );
  expectSamplerStatusContainsNoBackendResources(
    status.standardTexture.samplerMapping,
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const texturedSample = readPngPixel(
    screenshot,
    status.standardTexture.sample.x,
    status.standardTexture.sample.y,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(30);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, clear),
        `glTF metallic-roughness readback sample should not match clear; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(30);
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders a mapped normal texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-gltf-texture.html?scenario=normal-map");

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus("standard-gltf-texture-normal-map-status", status);
  expect(
    status,
    "standard glTF normal texture status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "normal-map",
    materialModel: "gltf-standard-normal-texture",
    textureSlot: "normalTexture",
    textureKey: "texture:gltf:texture:0:normalTexture",
    samplerKey: "sampler:gltf:sampler:0:normalTexture",
    pipelineKey: "standard|normalTexture|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "normal-map",
    materialModel: "gltf-standard-normal-texture",
    ok: true,
    phase: "rendered",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 0,
        samplers: [
          {
            handleKey: "gltf:sampler:0:normalTexture",
            textureIndex: 0,
            slot: "normalTexture",
          },
        ],
      },
    },
    standardTexture: {
      textureKey: "texture:gltf:texture:0:normalTexture",
      samplerKey: "sampler:gltf:sampler:0:normalTexture",
      textureSlot: "normalTexture",
      expectedTextureColor: null,
      expectedNormalMap: {
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
      },
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    draw: { packages: 1, drawCalls: 1 },
  });

  if (status.standardTexture === undefined) {
    throw new Error("standard glTF normal texture status is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const texturedSample = readPngPixel(
    screenshot,
    status.standardTexture.sample.x,
    status.standardTexture.sample.y,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(30);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, clear),
        `glTF normal readback sample should not match clear; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(30);
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports texture transforms before submitting draws", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-transform",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-transform-status",
    status,
  );
  expect(
    status,
    "standard glTF texture transform status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectExpectedGltfTextureFailureStatus(status, {
    scenario: "base-color-transform",
    expectedMappingDiagnostic: "gltfMaterial.unsupportedTextureTransform",
    expectedDiagnostic:
      "render.standardMaterialTexture.unsupportedTextureTransform",
    expectedTextureStatus: "unsupported-transform",
    textureSlot: "baseColorTexture",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "base-color-transform",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.unsupportedTextureTransform",
    expectedDiagnostic:
      "render.standardMaterialTexture.unsupportedTextureTransform",
    expectedTextureStatus: "unsupported-transform",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 1,
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: true,
        written: 4,
        diagnostics: 0,
      },
    },
    standardTexture: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      textureKey: "texture:gltf:texture:0:baseColorTexture",
      samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      textureSlot: "baseColorTexture",
      expectedTextureTransform: {
        offset: [expect.any(Number), expect.any(Number)],
      },
    },
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 1 },
    draw: { drawCalls: 0 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toContain(
    "gltfMaterial.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes).toContain(
    "render.standardMaterialTexture.unsupportedTextureTransform",
  );
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

function rgbaTupleToColor(color: RgbaTuple): {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
} {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}

function expectRenderedGltfTextureStatus(
  status: StandardGltfTextureStatus,
  options: {
    readonly scenario: string;
    readonly materialModel: string;
    readonly textureSlot: string;
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly pipelineKey: string;
    readonly meshLayoutKey?: string;
  },
): void {
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: options.scenario,
    materialModel: options.materialModel,
    ok: true,
    phase: "rendered",
    renderingBackend: "webgpu-explicit",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: true,
        written: 4,
        diagnostics: 0,
      },
    },
    standardTexture: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      textureKey: options.textureKey,
      samplerKey: options.samplerKey,
      textureSlot: options.textureSlot,
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.pipelines?.keys).toContain(options.pipelineKey);
  expect(status.pipelines?.meshLayoutKeys).toContain(
    options.meshLayoutKey ?? "POSITION,NORMAL,TEXCOORD_0",
  );
  expect(status.standardTexture?.samplerMapping).toEqual(
    status.gltf?.assetMapping.samplers?.[0],
  );
  expectSamplerStatusContainsNoBackendResources(
    status.standardTexture?.samplerMapping,
  );
}

function expectExpectedGltfTextureFailureStatus(
  status: StandardGltfTextureStatus,
  options: {
    readonly scenario: string;
    readonly expectedMappingDiagnostic: string;
    readonly expectedDiagnostic: string;
    readonly expectedTextureStatus: string;
    readonly textureSlot: string;
  },
): void {
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: options.scenario,
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: options.expectedMappingDiagnostic,
    expectedDiagnostic: options.expectedDiagnostic,
    expectedTextureStatus: options.expectedTextureStatus,
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 1,
      },
      registration: {
        valid: true,
        written: 4,
        diagnostics: 0,
      },
    },
    standardTexture: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      textureSlot: options.textureSlot,
    },
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 1 },
    draw: { drawCalls: 0 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toContain(
    options.expectedMappingDiagnostic,
  );
  expect(status.diagnosticCodes).toContain(options.expectedDiagnostic);
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
}

function expectSamplerStatusContainsNoBackendResources(
  sampler: StandardGltfTextureSamplerMappingStatus | undefined,
): void {
  expect(sampler).toBeDefined();

  if (sampler === undefined) {
    return;
  }

  const serialized = JSON.stringify(sampler);

  expect(serialized).not.toContain("GPUSampler");
  expect(serialized).not.toContain("GPUDevice");
  expect(serialized).not.toContain("cache");
  expect(Object.keys(sampler.mapped ?? {})).not.toContain("resource");
}
