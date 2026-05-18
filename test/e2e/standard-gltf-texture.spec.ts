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
  readonly expectedMappingDiagnostic?: string | null;
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
    readonly expectedUntransformedTextureColor?: RgbaTuple | null;
    readonly expectedOffsetScaleTextureColor?: RgbaTuple | null;
    readonly expectedMetallicRoughness?: {
      readonly metallic: number;
      readonly roughness: number;
    } | null;
    readonly expectedNormalMap?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly expectedOcclusion?: {
      readonly red: number;
      readonly strength: number;
    } | null;
    readonly expectedEmissive?: {
      readonly factor: readonly [number, number, number];
      readonly color: RgbaTuple;
    } | null;
    readonly expectedAlphaMaskTexture?: {
      readonly source: {
        readonly alphaMode: string;
        readonly alphaCutoff: number;
        readonly doubleSided: boolean;
      };
      readonly opaqueColor: RgbaTuple;
      readonly maskedColor: RgbaTuple;
      readonly opaqueSample: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
      readonly maskedSample: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
    } | null;
    readonly expectedDelayedDependencies?: {
      readonly loadingTextureKey: string;
      readonly failedTextureKey: string;
      readonly loadingSamplerKey: string;
      readonly failedSamplerKey: string;
    } | null;
    readonly expectedTextureTransform?: {
      readonly offset?: readonly [number, number];
      readonly scale?: readonly [number, number];
      readonly rotation?: number;
    } | null;
    readonly expectedTexCoord?: number;
    readonly expectedUv1?: {
      readonly u: number;
      readonly v: number;
    } | null;
    readonly readiness?: {
      readonly ready: boolean;
      readonly materialKey: string;
      readonly slots?: readonly {
        readonly field: string;
        readonly textureKey: string;
        readonly texCoord: number;
        readonly ready: boolean;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly field?: string;
        readonly dependencyKind?: string;
        readonly textureKey?: string;
        readonly samplerKey?: string;
        readonly status?: string;
      }[];
    };
    readonly sample: { readonly x: number; readonly y: number };
    readonly samples?: {
      readonly opaque: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
      readonly masked: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
    };
  };
  readonly standardMaterial?: {
    readonly meshKey: string;
    readonly materialKey: string;
    readonly renderState: {
      readonly source: {
        readonly alphaMode: string;
        readonly alphaCutoff: number;
        readonly doubleSided: boolean;
      } | null;
      readonly mapped: {
        readonly alphaMode: string;
        readonly alphaCutoff: number;
        readonly cullMode: string;
        readonly depth: {
          readonly test: boolean;
          readonly write: boolean;
          readonly compare: string;
        };
        readonly blend: { readonly preset: string };
      } | null;
    };
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
  readonly backface?: {
    readonly sample: {
      readonly id: string;
      readonly x: number;
      readonly y: number;
    };
    readonly expectedColor: RgbaTuple;
  };
  readonly materialDependencyReadiness?: readonly {
    readonly ready: boolean;
    readonly materialKey: string;
    readonly dependencies: readonly {
      readonly field: string;
      readonly dependencyKind: string;
      readonly handleKey: string | null;
      readonly status: string;
      readonly ready: boolean;
    }[];
    readonly diagnostics: readonly {
      readonly code: string;
      readonly dependencyKind?: string;
      readonly dependencyKey?: string;
      readonly status?: string;
    }[];
  }[];
  readonly diagnosticsSummary?: {
    readonly sectionCount: number;
    readonly materialQueue?: {
      readonly itemCount: number;
      readonly byPhase: readonly {
        readonly phase: string;
        readonly itemCount: number;
      }[];
      readonly byFamily: readonly {
        readonly family: string;
        readonly itemCount: number;
      }[];
      readonly byPhaseAndFamily: readonly {
        readonly phase: string;
        readonly family: string;
        readonly itemCount: number;
      }[];
    };
    readonly routedResourceSet?: {
      readonly itemCount: number;
      readonly byFamily: readonly {
        readonly family: string;
        readonly itemCount: number;
      }[];
      readonly byPipeline: readonly {
        readonly pipelineKey: string;
        readonly itemCount: number;
      }[];
      readonly byFamilyAndPipeline: readonly {
        readonly family: string;
        readonly pipelineKey: string;
        readonly itemCount: number;
      }[];
    };
    readonly materialQueueRoute?: {
      readonly valid: boolean;
      readonly queueItemCount: number;
      readonly routedItemCount: number;
      readonly skippedItemCount: number;
    };
  };
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

test("standard glTF texture fixture samples base-color offset and scale transforms", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-transform-sampling",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-transform-sampling-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF texture transform sampling status missing");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "base-color-transform-sampling",
    materialModel: "gltf-standard-base-color-transform-sampling",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
  });
  expect(status.standardTexture?.expectedTextureTransform).toEqual({
    offset: [0.5, 0],
    scale: [0.5, 1],
  });
  expect(status.standardTexture?.readiness).toMatchObject({
    ready: true,
    diagnostics: [],
  });
  const standardTexture = status.standardTexture;

  if (standardTexture === undefined) {
    throw new Error("standard glTF texture transform status is missing");
  }

  const expectedTransformedColor = standardTexture.expectedTextureColor;
  const expectedUntransformedColor =
    standardTexture.expectedUntransformedTextureColor;

  if (
    expectedTransformedColor === undefined ||
    expectedTransformedColor === null ||
    expectedUntransformedColor === undefined ||
    expectedUntransformedColor === null
  ) {
    throw new Error("standard glTF texture transform expectation is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const transformedExpected = rgbaColorToPixel(
    rgbaTupleToColor(expectedTransformedColor),
  );
  const untransformedExpected = rgbaColorToPixel(
    rgbaTupleToColor(expectedUntransformedColor),
  );
  const sampled = readPngPixel(
    screenshot,
    standardTexture.sample.x,
    standardTexture.sample.y,
  );

  expect(pixelDistance(sampled, transformedExpected)).toBeLessThan(
    pixelDistance(sampled, untransformedExpected),
  );

  if (status.readback?.ok) {
    const readbackTransformed = status.readback.samples.find(
      (sample) => sample.id === "transformed",
    );

    expect(readbackTransformed).toBeDefined();

    if (readbackTransformed !== undefined) {
      expect(
        pixelDistance(readbackTransformed.pixel, transformedExpected),
      ).toBeLessThan(
        pixelDistance(readbackTransformed.pixel, untransformedExpected),
      );
    }
  }

  expect(status.gltf?.assetMapping.diagnosticCodes ?? []).not.toContain(
    "gltfMaterial.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture samples base-color rotation transforms", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-transform-rotation-sampling",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-transform-rotation-sampling-status",
    status,
  );

  if (status === undefined) {
    throw new Error(
      "standard glTF texture transform rotation sampling status missing",
    );
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "base-color-transform-rotation-sampling",
    materialModel: "gltf-standard-base-color-transform-rotation-sampling",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
  });
  expect(status.standardTexture?.expectedTextureTransform).toMatchObject({
    offset: [0.5, 0.5],
    scale: [1, 1],
  });
  expect(
    status.standardTexture?.expectedTextureTransform?.rotation,
  ).toBeCloseTo(Math.PI / 2, 8);
  expect(status.standardTexture?.readiness).toMatchObject({
    ready: true,
    diagnostics: [],
  });
  const standardTexture = status.standardTexture;

  if (standardTexture === undefined) {
    throw new Error("standard glTF texture rotation status is missing");
  }

  const expectedRotatedColor = standardTexture.expectedTextureColor;
  const expectedUntransformedColor =
    standardTexture.expectedUntransformedTextureColor;
  const expectedOffsetScaleOnlyColor =
    standardTexture.expectedOffsetScaleTextureColor;

  if (
    expectedRotatedColor === undefined ||
    expectedRotatedColor === null ||
    expectedUntransformedColor === undefined ||
    expectedUntransformedColor === null ||
    expectedOffsetScaleOnlyColor === undefined ||
    expectedOffsetScaleOnlyColor === null
  ) {
    throw new Error("standard glTF texture rotation expectation is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const rotatedExpected = rgbaColorToPixel(
    rgbaTupleToColor(expectedRotatedColor),
  );
  const untransformedExpected = rgbaColorToPixel(
    rgbaTupleToColor(expectedUntransformedColor),
  );
  const offsetScaleOnlyExpected = rgbaColorToPixel(
    rgbaTupleToColor(expectedOffsetScaleOnlyColor),
  );
  const sampled = readPngPixel(
    screenshot,
    standardTexture.sample.x,
    standardTexture.sample.y,
  );

  expect(pixelDistance(sampled, rotatedExpected)).toBeLessThan(
    pixelDistance(sampled, untransformedExpected),
  );
  expect(pixelDistance(sampled, rotatedExpected)).toBeLessThan(
    pixelDistance(sampled, offsetScaleOnlyExpected),
  );

  if (status.readback?.ok) {
    const readbackRotated = status.readback.samples.find(
      (sample) => sample.id === "rotated",
    );

    expect(readbackRotated).toBeDefined();

    if (readbackRotated !== undefined) {
      expect(
        pixelDistance(readbackRotated.pixel, rotatedExpected),
      ).toBeLessThan(
        pixelDistance(readbackRotated.pixel, untransformedExpected),
      );
      expect(
        pixelDistance(readbackRotated.pixel, rotatedExpected),
      ).toBeLessThan(
        pixelDistance(readbackRotated.pixel, offsetScaleOnlyExpected),
      );
    }
  }

  expect(status.gltf?.assetMapping.diagnosticCodes ?? []).not.toContain(
    "gltfMaterial.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture samples base-color through TEXCOORD_1", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-uv1",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-uv1-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF base-color UV1 status missing");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "base-color-uv1",
    materialModel: "gltf-standard-base-color-uv1",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|uv1|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
  });
  expect(status.standardTexture).toMatchObject({
    expectedTexCoord: 1,
    expectedUv1: {
      u: expect.any(Number),
      v: expect.any(Number),
    },
    readiness: {
      ready: true,
      slots: [
        expect.objectContaining({
          field: "baseColorTexture",
          textureKey: "texture:gltf:texture:0:baseColorTexture",
          texCoord: 1,
          ready: true,
        }),
      ],
      diagnostics: [],
    },
  });

  const standardTexture = status.standardTexture;

  if (standardTexture === undefined) {
    throw new Error("standard glTF base-color UV1 texture status missing");
  }

  const expectedUv1Color = standardTexture.expectedTextureColor;
  const rejectedUv0Color = standardTexture.expectedUntransformedTextureColor;

  if (
    expectedUv1Color === undefined ||
    expectedUv1Color === null ||
    rejectedUv0Color === undefined ||
    rejectedUv0Color === null
  ) {
    throw new Error("standard glTF base-color UV1 expectation is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const expectedUv1 = rgbaColorToPixel(rgbaTupleToColor(expectedUv1Color));
  const rejectedUv0 = rgbaColorToPixel(rgbaTupleToColor(rejectedUv0Color));
  const sampled = readPngPixel(
    screenshot,
    standardTexture.sample.x,
    standardTexture.sample.y,
  );

  expect(pixelDistance(sampled, expectedUv1)).toBeLessThan(
    pixelDistance(sampled, rejectedUv0),
  );

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(pixelDistance(readbackTextured.pixel, expectedUv1)).toBeLessThan(
        pixelDistance(readbackTextured.pixel, rejectedUv0),
      );
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports missing TEXCOORD_1 before submitting draws", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-uv1-missing",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-uv1-missing-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF missing UV1 status missing");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "base-color-uv1-missing",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: null,
    expectedDiagnostic: "render.standardMaterialTexture.missingTexCoord1",
    expectedTextureStatus: "missing-texcoord1",
    materialModel: "gltf-standard-base-color-uv1-missing",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 0,
        diagnosticCodes: [],
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
      expectedTexCoord: 1,
      expectedUv1: null,
      readiness: {
        ready: true,
        slots: [
          expect.objectContaining({
            field: "baseColorTexture",
            textureKey: "texture:gltf:texture:0:baseColorTexture",
            texCoord: 1,
            ready: true,
          }),
        ],
        diagnostics: [],
      },
    },
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 1 },
    draw: { drawCalls: 0 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes ?? []).not.toContain(
    "gltfMaterial.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes).toContain(
    "render.standardMaterialTexture.missingTexCoord1",
  );
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports transformed TEXCOORD_1 before submitting draws", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-uv1-transform",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-uv1-transform-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF transformed UV1 status missing");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectExpectedGltfTextureFailureStatus(status, {
    scenario: "base-color-uv1-transform",
    expectedMappingDiagnostic: "gltfMaterial.unsupportedTextureTransform",
    expectedDiagnostic:
      "render.standardMaterialTexture.unsupportedTextureTransform",
    expectedTextureStatus: "unsupported-transform",
    textureSlot: "baseColorTexture",
  });
  expect(status).toMatchObject({
    materialModel: "gltf-standard-base-color-uv1-transform",
    standardTexture: {
      expectedTexCoord: 1,
      expectedUv1: {
        u: expect.any(Number),
        v: expect.any(Number),
      },
      expectedTextureTransform: {
        offset: [0.5, 0],
        scale: [0.5, 1],
      },
      readiness: {
        ready: false,
        diagnostics: [
          expect.objectContaining({
            code: "standardMaterialTexture.unsupportedTextureTransform",
            field: "baseColorTexture",
          }),
        ],
      },
    },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toContain(
    "gltfMaterial.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes).toContain(
    "render.standardMaterialTexture.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes).not.toContain(
    "render.standardMaterialTexture.missingTexCoord1",
  );
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders metallic-roughness transforms", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=metallic-roughness-transform",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-metallic-roughness-transform-status",
    status,
  );

  if (status === undefined) {
    throw new Error(
      "standard glTF metallic-roughness transform status missing",
    );
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "metallic-roughness-transform",
    materialModel: "gltf-standard-metallic-roughness-transform",
    textureSlot: "metallicRoughnessTexture",
    textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
    samplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
    pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
  });
  expect(status).toMatchObject({
    ok: true,
    phase: "rendered",
    materialModel: "gltf-standard-metallic-roughness-transform",
    standardTexture: {
      expectedTexCoord: 0,
      expectedTextureTransform: {
        offset: [0.5, 0],
        scale: [0.5, 1],
      },
      expectedMetallicRoughness: {
        metallic: expect.any(Number),
        roughness: expect.any(Number),
      },
      readiness: {
        ready: true,
        diagnostics: [],
      },
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).not.toContain(
    "gltfMaterial.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes).not.toContain(
    "render.standardMaterialTexture.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes).not.toContain(
    "render.standardMaterialTexture.missingTexCoord1",
  );
  expect(status.diagnosticsSummary?.routedResourceSet?.byFamily).toContainEqual(
    {
      family: "standard",
      itemCount: 1,
    },
  );
  expect(status.pipelines?.keys).toContain(
    "standard|metallicRoughnessTexture|opaque|back|less|none",
  );
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );
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

test("standard glTF texture fixture renders a mapped occlusion texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-gltf-texture.html?scenario=occlusion");

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus("standard-gltf-texture-occlusion-status", status);
  expect(
    status,
    "standard glTF occlusion texture status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "occlusion",
    materialModel: "gltf-standard-occlusion-texture",
    textureSlot: "occlusionTexture",
    textureKey: "texture:gltf:texture:0:occlusionTexture",
    samplerKey: "sampler:gltf:sampler:0:occlusionTexture",
    pipelineKey: "standard|occlusionTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "occlusion",
    materialModel: "gltf-standard-occlusion-texture",
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
            handleKey: "gltf:sampler:0:occlusionTexture",
            textureIndex: 0,
            slot: "occlusionTexture",
          },
        ],
      },
    },
    standardTexture: {
      textureKey: "texture:gltf:texture:0:occlusionTexture",
      samplerKey: "sampler:gltf:sampler:0:occlusionTexture",
      textureSlot: "occlusionTexture",
      expectedTextureColor: null,
      expectedOcclusion: {
        red: expect.any(Number),
        strength: 1,
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

  if (status.standardTexture === undefined) {
    throw new Error("standard glTF occlusion texture status is missing");
  }

  expect(status.standardTexture.expectedOcclusion).toMatchObject({
    red: expect.any(Number),
    strength: 1,
  });

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

  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(10);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, clear),
        `glTF occlusion readback sample should not match clear; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(10);
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders a mapped emissive texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-gltf-texture.html?scenario=emissive");

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus("standard-gltf-texture-emissive-status", status);
  expect(
    status,
    "standard glTF emissive texture status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "emissive",
    materialModel: "gltf-standard-emissive-texture",
    textureSlot: "emissiveTexture",
    textureKey: "texture:gltf:texture:0:emissiveTexture",
    samplerKey: "sampler:gltf:sampler:0:emissiveTexture",
    pipelineKey: "standard|emissiveTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "emissive",
    materialModel: "gltf-standard-emissive-texture",
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
            handleKey: "gltf:sampler:0:emissiveTexture",
            textureIndex: 0,
            slot: "emissiveTexture",
          },
        ],
      },
    },
    standardTexture: {
      textureKey: "texture:gltf:texture:0:emissiveTexture",
      samplerKey: "sampler:gltf:sampler:0:emissiveTexture",
      textureSlot: "emissiveTexture",
      expectedTextureColor: null,
      expectedEmissive: {
        factor: expect.any(Array),
        color: expect.any(Array),
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

  if (status.standardTexture === undefined) {
    throw new Error("standard glTF emissive texture status is missing");
  }

  expect(status.standardTexture.expectedEmissive).toMatchObject({
    factor: expect.any(Array),
    color: expect.any(Array),
  });

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
        `glTF emissive readback sample should not match clear; status=${JSON.stringify(
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

test("standard glTF texture fixture reports alpha-mask double-sided render state", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=alpha-mask-double-sided",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-alpha-mask-double-sided-status",
    status,
  );
  expect(
    status,
    "standard glTF alpha-mask double-sided status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "alpha-mask-double-sided",
    materialModel: "gltf-standard-alpha-mask-double-sided",
    ok: true,
    phase: "rendered",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: true,
        diagnostics: 0,
      },
    },
    standardMaterial: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      renderState: {
        source: {
          alphaMode: "MASK",
          alphaCutoff: 0.35,
          doubleSided: true,
        },
        mapped: {
          alphaMode: "mask",
          alphaCutoff: 0.35,
          cullMode: "none",
          depth: { test: true, write: true, compare: "less" },
          blend: { preset: "none" },
        },
      },
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.pipelines?.keys).toContain("standard|mask|none|less|none");
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture masks pixels with base-color alpha", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=alpha-mask-texture",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus("standard-gltf-texture-alpha-mask-status", status);
  expect(
    status,
    "standard glTF alpha-mask texture status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "alpha-mask-texture",
    materialModel: "gltf-standard-alpha-mask-texture",
    ok: true,
    phase: "rendered",
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
        diagnostics: 0,
      },
    },
    standardTexture: {
      textureSlot: "baseColorTexture",
      textureKey: "texture:gltf:texture:0:baseColorTexture",
      samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      expectedAlphaMaskTexture: {
        source: {
          alphaMode: "MASK",
          alphaCutoff: 0.5,
          doubleSided: true,
        },
      },
      samples: {
        opaque: { id: "opaque", x: expect.any(Number), y: expect.any(Number) },
        masked: { id: "masked", x: expect.any(Number), y: expect.any(Number) },
      },
    },
    standardMaterial: {
      renderState: {
        mapped: {
          alphaMode: "mask",
          alphaCutoff: 0.5,
          cullMode: "none",
          blend: { preset: "none" },
        },
      },
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|mask|none|less|none",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);

  if (status.standardTexture?.expectedAlphaMaskTexture == null) {
    throw new Error("standard glTF alpha-mask texture expectation is missing");
  }
  if (status.standardTexture.samples === undefined) {
    throw new Error("standard glTF alpha-mask sample points are missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });
  const opaqueExpected = rgbaColorToPixel(
    rgbaTupleToColor(
      status.standardTexture.expectedAlphaMaskTexture.opaqueColor,
    ),
  );
  const opaquePixel = readPngPixel(
    screenshot,
    status.standardTexture.samples.opaque.x,
    status.standardTexture.samples.opaque.y,
  );
  const maskedPixel = readPngPixel(
    screenshot,
    status.standardTexture.samples.masked.x,
    status.standardTexture.samples.masked.y,
  );

  expect(pixelDistance(opaquePixel, opaqueExpected)).toBeLessThan(
    pixelDistance(opaquePixel, clear),
  );
  expect(pixelDistance(maskedPixel, clear)).toBeLessThan(
    pixelDistance(maskedPixel, opaqueExpected),
  );

  if (status.readback?.ok) {
    const readbackOpaque = status.readback.samples.find(
      (sample) => sample.id === "opaque",
    );
    const readbackMasked = status.readback.samples.find(
      (sample) => sample.id === "masked",
    );

    expect(readbackOpaque).toBeDefined();
    expect(readbackMasked).toBeDefined();

    if (readbackOpaque !== undefined) {
      expect(pixelDistance(readbackOpaque.pixel, opaqueExpected)).toBeLessThan(
        pixelDistance(readbackOpaque.pixel, clear),
      );
    }
    if (readbackMasked !== undefined) {
      expect(pixelDistance(readbackMasked.pixel, clear)).toBeLessThan(
        pixelDistance(readbackMasked.pixel, opaqueExpected),
      );
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard glTF alpha-mask backface fixture renders with no culling", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=alpha-mask-backface",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-alpha-mask-backface-status",
    status,
  );
  expect(
    status,
    "standard glTF alpha-mask backface status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "alpha-mask-backface",
    materialModel: "gltf-standard-alpha-mask-backface",
    ok: true,
    phase: "rendered",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: true,
        diagnostics: 0,
      },
    },
    standardMaterial: {
      renderState: {
        source: {
          alphaMode: "MASK",
          alphaCutoff: 0.35,
          doubleSided: true,
        },
        mapped: {
          alphaMode: "mask",
          alphaCutoff: 0.35,
          cullMode: "none",
          blend: { preset: "none" },
        },
      },
    },
    backface: {
      sample: { id: "backface", x: expect.any(Number), y: expect.any(Number) },
      expectedColor: expect.any(Array),
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.pipelines?.keys).toContain("standard|mask|none|less|none");
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);

  if (status.backface === undefined) {
    throw new Error("standard glTF alpha-mask backface expectation is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });
  const expected = rgbaColorToPixel(
    rgbaTupleToColor(status.backface.expectedColor),
  );
  const pixel = readPngPixel(
    screenshot,
    status.backface.sample.x,
    status.backface.sample.y,
  );

  expect(pixelDistance(pixel, expected)).toBeLessThan(
    pixelDistance(pixel, clear),
  );

  if (status.readback?.ok) {
    const readbackBackface = status.readback.samples.find(
      (sample) => sample.id === "backface",
    );

    expect(readbackBackface).toBeDefined();

    if (readbackBackface !== undefined) {
      expect(pixelDistance(readbackBackface.pixel, expected)).toBeLessThan(
        pixelDistance(readbackBackface.pixel, clear),
      );
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard glTF alpha-mask texture fixture survives a narrow viewport", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 480, height: 640 });
  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=alpha-mask-texture",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-alpha-mask-mobile-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF mobile alpha-mask status did not publish");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    ok: true,
    phase: "rendered",
    scenario: "alpha-mask-texture",
    extraction: { meshDraws: 1, diagnostics: 0 },
    draw: { drawCalls: 1 },
  });
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|mask|none|less|none",
  );

  if (status.standardTexture?.expectedAlphaMaskTexture == null) {
    throw new Error("standard glTF mobile alpha-mask expectation is missing");
  }
  if (status.standardTexture.samples === undefined) {
    throw new Error("standard glTF mobile alpha-mask samples are missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });
  const opaqueExpected = rgbaColorToPixel(
    rgbaTupleToColor(
      status.standardTexture.expectedAlphaMaskTexture.opaqueColor,
    ),
  );
  const opaquePixel = readPngPixel(
    screenshot,
    status.standardTexture.samples.opaque.x,
    status.standardTexture.samples.opaque.y,
  );
  const maskedPixel = readPngPixel(
    screenshot,
    status.standardTexture.samples.masked.x,
    status.standardTexture.samples.masked.y,
  );

  expect(pixelDistance(opaquePixel, opaqueExpected)).toBeLessThan(
    pixelDistance(opaquePixel, clear),
  );
  expect(pixelDistance(maskedPixel, clear)).toBeLessThan(
    pixelDistance(maskedPixel, opaqueExpected),
  );
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports delayed source dependencies", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=delayed-dependencies",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-delayed-dependencies-status",
    status,
  );
  expect(
    status,
    "standard glTF delayed dependency status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "delayed-dependencies",
    materialModel: "gltf-standard-delayed-dependencies",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: null,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    expectedTextureStatus: "delayed-dependencies",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 2,
        samplerCount: 2,
        materialCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: true,
        written: 6,
        diagnostics: 0,
      },
    },
    standardTexture: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      textureKey: "texture:gltf:texture:0:baseColorTexture",
      samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      textureSlot: "baseColorTexture",
      expectedDelayedDependencies: {
        loadingTextureKey: "texture:gltf:texture:0:baseColorTexture",
        failedTextureKey: "texture:gltf:texture:1:normalTexture",
        loadingSamplerKey: "sampler:gltf:sampler:1:normalTexture",
        failedSamplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      },
    },
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 4 },
    draw: { drawCalls: 0 },
  });

  const dependencyReport = status.materialDependencyReadiness?.[0];

  expect(dependencyReport).toMatchObject({
    ready: false,
    materialKey: "material:gltf:material:0",
  });
  expect(dependencyReport?.dependencies).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: "baseColorTexture",
        dependencyKind: "texture",
        handleKey: "texture:gltf:texture:0:baseColorTexture",
        status: "loading",
        ready: false,
      }),
      expect.objectContaining({
        field: "baseColorTexture",
        dependencyKind: "sampler",
        handleKey: "sampler:gltf:sampler:0:baseColorTexture",
        status: "failed",
        ready: false,
      }),
      expect.objectContaining({
        field: "normalTexture",
        dependencyKind: "texture",
        handleKey: "texture:gltf:texture:1:normalTexture",
        status: "failed",
        ready: false,
      }),
      expect.objectContaining({
        field: "normalTexture",
        dependencyKind: "sampler",
        handleKey: "sampler:gltf:sampler:1:normalTexture",
        status: "loading",
        ready: false,
      }),
    ]),
  );
  expect(dependencyReport?.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "materialDependency.dependencyLoading",
        dependencyKind: "texture",
        dependencyKey: "texture:gltf:texture:0:baseColorTexture",
        status: "loading",
      }),
      expect.objectContaining({
        code: "materialDependency.dependencyFailed",
        dependencyKind: "sampler",
        dependencyKey: "sampler:gltf:sampler:0:baseColorTexture",
        status: "failed",
      }),
      expect.objectContaining({
        code: "materialDependency.dependencyFailed",
        dependencyKind: "texture",
        dependencyKey: "texture:gltf:texture:1:normalTexture",
        status: "failed",
      }),
      expect.objectContaining({
        code: "materialDependency.dependencyLoading",
        dependencyKind: "sampler",
        dependencyKey: "sampler:gltf:sampler:1:normalTexture",
        status: "loading",
      }),
    ]),
  );
  expect(status.standardTexture?.readiness).toMatchObject({
    ready: false,
    materialKey: "material:gltf:material:0",
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        code: "standardMaterialTexture.textureNotReady",
        field: "baseColorTexture",
        dependencyKind: "texture",
        textureKey: "texture:gltf:texture:0:baseColorTexture",
        status: "loading",
      }),
      expect.objectContaining({
        code: "standardMaterialTexture.samplerNotReady",
        field: "baseColorTexture",
        dependencyKind: "sampler",
        samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
        status: "failed",
      }),
      expect.objectContaining({
        code: "standardMaterialTexture.textureNotReady",
        field: "normalTexture",
        dependencyKind: "texture",
        textureKey: "texture:gltf:texture:1:normalTexture",
        status: "failed",
      }),
      expect.objectContaining({
        code: "standardMaterialTexture.samplerNotReady",
        field: "normalTexture",
        dependencyKind: "sampler",
        samplerKey: "sampler:gltf:sampler:1:normalTexture",
        status: "loading",
      }),
    ]),
  });
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.diagnosticCodes).toContain(
    "webGpuApp.materialDependenciesNotReady",
  );
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
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
  expect(status.diagnosticsSummary).toBeUndefined();
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
    diagnosticsSummary: {
      sectionCount: 2,
      materialQueue: {
        itemCount: 1,
        byPhase: [{ phase: "opaque", itemCount: 1 }],
        byFamily: [{ family: "standard", itemCount: 1 }],
        byPhaseAndFamily: [
          { phase: "opaque", family: "standard", itemCount: 1 },
        ],
      },
      routedResourceSet: {
        itemCount: 1,
        byFamily: [{ family: "standard", itemCount: 1 }],
        byPipeline: [{ pipelineKey: options.pipelineKey, itemCount: 1 }],
        byFamilyAndPipeline: [
          {
            family: "standard",
            pipelineKey: options.pipelineKey,
            itemCount: 1,
          },
        ],
      },
    },
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
