import { expect, test, type Page } from "@playwright/test";

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
      readonly diagnosticDetails?: readonly {
        readonly layer?: string;
        readonly code?: string;
        readonly severity?: string;
        readonly message?: string;
        readonly materialIndex?: number;
        readonly textureIndex?: number;
        readonly samplerIndex?: number;
        readonly slot?: string;
        readonly field?: string;
        readonly extensionName?: string;
        readonly dependencyKind?: string;
        readonly value?: string | number | boolean | null;
      }[];
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
    readonly expectedNormalScale?: number | null;
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
    readonly expectedAlphaBlendTexture?: {
      readonly source: {
        readonly alphaMode: string;
        readonly alphaCutoff: number;
        readonly doubleSided: boolean;
      };
      readonly opaqueColor: RgbaTuple;
      readonly translucentColor: RgbaTuple;
      readonly opaqueSample: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
      readonly translucentSample: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
    } | null;
    readonly expectedDelayedDependencies?: {
      readonly loadingTextureKey: string;
      readonly failedTextureKey?: string;
      readonly loadingSamplerKey?: string;
      readonly failedSamplerKey: string;
    } | null;
    readonly expectedTextureTransform?: {
      readonly offset?: readonly [number, number];
      readonly scale?: readonly [number, number];
      readonly rotation?: number;
    } | null;
    readonly expectedSampler?: {
      readonly addressModeU?: string;
      readonly addressModeV?: string;
      readonly magFilter?: string;
      readonly minFilter?: string;
      readonly sampleUv?: {
        readonly u: number;
        readonly v: number;
      };
      readonly expectedColor: RgbaTuple;
      readonly rejectedClampColor?: RgbaTuple;
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
        readonly actualFormat?: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly field?: string;
        readonly dependencyKind?: string;
        readonly textureKey?: string;
        readonly samplerKey?: string;
        readonly status?: string;
        readonly actualColorSpace?: string;
        readonly expectedFormatSrgb?: boolean;
        readonly actualFormat?: string;
      }[];
    };
    readonly sample: { readonly x: number; readonly y: number };
    readonly samples?: {
      readonly scalar?: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
      readonly textured?: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
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
      readonly translucent?: {
        readonly id: string;
        readonly x: number;
        readonly y: number;
      };
    };
  };
  readonly standardMaterial?: {
    readonly meshKey: string;
    readonly materialKey: string;
    readonly expectedEmissive?: {
      readonly factor: readonly number[];
      readonly color: readonly number[] | null;
    } | null;
    readonly sample?: { readonly x: number; readonly y: number };
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
  } | null;
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

interface MultiTextureStandardSlotExpectation {
  readonly field: string;
  readonly textureIndex: number;
  readonly texCoord?: number;
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

test("standard glTF texture fixture maps valid non-default sampler enums", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=valid-non-default-sampler",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-valid-non-default-sampler-status",
    status,
  );
  expect(
    status,
    "standard glTF valid non-default sampler status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "valid-non-default-sampler",
    materialModel: "gltf-standard-valid-non-default-sampler",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
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
              magFilter: 9729,
              minFilter: 9987,
              wrapS: 10497,
              wrapT: 33648,
            },
            mapped: {
              kind: "sampler",
              addressModeU: "repeat",
              addressModeV: "mirror-repeat",
              addressModeW: "repeat",
              magFilter: "linear",
              minFilter: "linear",
              mipmapFilter: "linear",
              lodMinClamp: 0,
              lodMaxClamp: 32,
              maxAnisotropy: 1,
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
      samplerMapping: {
        source: {
          magFilter: 9729,
          minFilter: 9987,
          wrapS: 10497,
          wrapT: 33648,
        },
        mapped: {
          addressModeU: "repeat",
          addressModeV: "mirror-repeat",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
        },
      },
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.diagnosticCodes ?? []).toEqual([]);
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );
  expect(status.standardTexture?.samplerMapping).toEqual(
    status.gltf?.assetMapping.samplers?.[0],
  );
  expectSamplerStatusContainsNoBackendResources(
    status.standardTexture?.samplerMapping,
  );
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders a valid repeat sampler", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=valid-repeat-sampler",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-valid-repeat-sampler-status",
    status,
  );
  expect(
    status,
    "standard glTF valid repeat sampler status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "valid-repeat-sampler",
    materialModel: "gltf-standard-valid-repeat-sampler",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
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
              wrapS: 10497,
              wrapT: 33071,
            },
            mapped: {
              kind: "sampler",
              addressModeU: "repeat",
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
    },
    standardTexture: {
      samplerMapping: {
        source: {
          magFilter: 9728,
          minFilter: 9728,
          wrapS: 10497,
          wrapT: 33071,
        },
        mapped: {
          addressModeU: "repeat",
          addressModeV: "clamp-to-edge",
          magFilter: "nearest",
          minFilter: "nearest",
          mipmapFilter: "nearest",
        },
      },
      expectedSampler: {
        addressModeU: "repeat",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
        sampleUv: { u: 1.25, v: 0.25 },
        expectedColor: expect.any(Array),
        rejectedClampColor: expect.any(Array),
      },
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.diagnosticCodes ?? []).toEqual([]);
  expect(status.standardTexture?.samplerMapping).toEqual(
    status.gltf?.assetMapping.samplers?.[0],
  );
  expectSamplerStatusContainsNoBackendResources(
    status.standardTexture?.samplerMapping,
  );
  await expectValidRepeatSamplerPixels(page, status);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture maps omitted sampler defaults", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=default-sampler",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-default-sampler-status",
    status,
  );
  expect(
    status,
    "standard glTF default sampler status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "default-sampler",
    materialModel: "gltf-standard-default-sampler",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
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
            source: null,
            mapped: {
              kind: "sampler",
              addressModeU: "repeat",
              addressModeV: "repeat",
              addressModeW: "repeat",
              magFilter: "linear",
              minFilter: "linear",
              mipmapFilter: "linear",
              lodMinClamp: 0,
              lodMaxClamp: 32,
              maxAnisotropy: 1,
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
      samplerMapping: {
        source: null,
        mapped: {
          addressModeU: "repeat",
          addressModeV: "repeat",
          addressModeW: "repeat",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
        },
      },
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.diagnosticCodes ?? []).toEqual([]);
  expect(status.standardTexture?.samplerMapping).toEqual(
    status.gltf?.assetMapping.samplers?.[0],
  );
  expectSamplerStatusContainsNoBackendResources(
    status.standardTexture?.samplerMapping,
  );
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

test("standard glTF texture fixture renders combined base-color and metallic-roughness textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-metallic-roughness",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-metallic-roughness-status",
    status,
  );

  if (status === undefined) {
    throw new Error(
      "standard glTF combined base-color metallic-roughness status missing",
    );
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedMultiTextureStandardStatus(status, {
    scenario: "base-color-metallic-roughness",
    materialModel: "gltf-standard-base-color-metallic-roughness",
    registrationWritten: 6,
    slots: [
      { field: "baseColorTexture", textureIndex: 0, texCoord: 0 },
      { field: "metallicRoughnessTexture", textureIndex: 1, texCoord: 0 },
    ],
    standardTexture: {
      expectedTextureColor: expect.any(Array),
      expectedMetallicRoughness: {
        metallic: expect.any(Number),
        roughness: expect.any(Number),
      },
    },
    pipelineKey:
      "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
  });

  const standardTexture = status.standardTexture;

  if (standardTexture === undefined) {
    throw new Error(
      "standard glTF combined base-color metallic-roughness texture status missing",
    );
  }

  const expectedTextureColor = standardTexture.expectedTextureColor;

  if (expectedTextureColor === undefined || expectedTextureColor === null) {
    throw new Error(
      "standard glTF combined texture expected base color is missing",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const sampled = readPngPixel(
    screenshot,
    standardTexture.sample.x,
    standardTexture.sample.y,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(sampled, clear)).toBeGreaterThan(30);
  expect(sampled.b).toBeGreaterThan(sampled.g + 20);
  expect(sampled.b).toBeGreaterThan(sampled.r + 40);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(pixelDistance(readbackTextured.pixel, clear)).toBeGreaterThan(30);
      expect(readbackTextured.pixel.b).toBeGreaterThan(
        readbackTextured.pixel.g + 20,
      );
      expect(readbackTextured.pixel.b).toBeGreaterThan(
        readbackTextured.pixel.r + 40,
      );
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders combined base-color metallic-roughness and normal textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-metallic-roughness-normal",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-metallic-roughness-normal-status",
    status,
  );

  if (status === undefined) {
    throw new Error(
      "standard glTF combined base-color metallic-roughness normal status missing",
    );
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedMultiTextureStandardStatus(status, {
    scenario: "base-color-metallic-roughness-normal",
    materialModel: "gltf-standard-base-color-metallic-roughness-normal",
    registrationWritten: 8,
    slots: [
      { field: "baseColorTexture", textureIndex: 0, texCoord: 0 },
      { field: "metallicRoughnessTexture", textureIndex: 1, texCoord: 0 },
      { field: "normalTexture", textureIndex: 2, texCoord: 0 },
    ],
    standardTexture: {
      expectedTextureColor: expect.any(Array),
      expectedMetallicRoughness: {
        metallic: expect.any(Number),
        roughness: expect.any(Number),
      },
      expectedNormalMap: {
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
      },
      expectedNormalScale: 2,
    },
    pipelineKey:
      "standard|baseColorTexture|metallicRoughnessTexture|normalTexture|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
  });

  const standardTexture = status.standardTexture;

  if (standardTexture === undefined) {
    throw new Error(
      "standard glTF combined base-color metallic-roughness normal texture status missing",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const sampled = readPngPixel(
    screenshot,
    standardTexture.sample.x,
    standardTexture.sample.y,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(sampled, clear)).toBeGreaterThan(30);
  expect(sampled.b).toBeGreaterThan(sampled.g + 10);
  expect(sampled.b).toBeGreaterThan(sampled.r + 20);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(pixelDistance(readbackTextured.pixel, clear)).toBeGreaterThan(30);
      expect(readbackTextured.pixel.b).toBeGreaterThan(
        readbackTextured.pixel.r + 20,
      );
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders combined base-color occlusion and emissive textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-occlusion-emissive",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-occlusion-emissive-status",
    status,
  );

  if (status === undefined) {
    throw new Error(
      "standard glTF combined base-color occlusion emissive status missing",
    );
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedMultiTextureStandardStatus(status, {
    scenario: "base-color-occlusion-emissive",
    materialModel: "gltf-standard-base-color-occlusion-emissive",
    registrationWritten: 8,
    slots: [
      { field: "baseColorTexture", textureIndex: 0 },
      { field: "occlusionTexture", textureIndex: 1 },
      { field: "emissiveTexture", textureIndex: 2 },
    ],
    standardTexture: {
      expectedTextureColor: expect.any(Array),
      expectedOcclusion: {
        red: expect.any(Number),
        strength: expect.any(Number),
      },
      expectedEmissive: {
        factor: expect.any(Array),
        color: expect.any(Array),
      },
    },
    pipelineKey:
      "standard|baseColorTexture|emissiveTexture|occlusionTexture|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
  });

  const standardTexture = status.standardTexture;

  if (standardTexture === undefined) {
    throw new Error(
      "standard glTF combined base-color occlusion emissive texture status missing",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const sampled = readPngPixel(
    screenshot,
    standardTexture.sample.x,
    standardTexture.sample.y,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(sampled, clear)).toBeGreaterThan(30);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(pixelDistance(readbackTextured.pixel, clear)).toBeGreaterThan(30);
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders combined base-color alpha-mask and emissive textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-alpha-mask-emissive",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-base-color-alpha-mask-emissive-status",
    status,
  );

  if (status === undefined) {
    throw new Error(
      "standard glTF combined base-color alpha-mask emissive status missing",
    );
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedMultiTextureStandardStatus(status, {
    scenario: "base-color-alpha-mask-emissive",
    materialModel: "gltf-standard-base-color-alpha-mask-emissive",
    registrationWritten: 6,
    slots: [
      { field: "baseColorTexture", textureIndex: 0, texCoord: 0 },
      { field: "emissiveTexture", textureIndex: 1, texCoord: 0 },
    ],
    standardTexture: {
      expectedTextureColor: expect.any(Array),
      expectedAlphaMaskTexture: {
        source: {
          alphaMode: "MASK",
          alphaCutoff: 0.5,
          doubleSided: true,
        },
      },
      expectedEmissive: {
        factor: expect.any(Array),
        color: expect.any(Array),
      },
      samples: {
        opaque: { id: "opaque", x: expect.any(Number), y: expect.any(Number) },
        masked: { id: "masked", x: expect.any(Number), y: expect.any(Number) },
      },
    },
    pipelineKey:
      "standard|baseColorTexture|emissiveTexture|mask|none|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
  });
  expect(status.standardMaterial).toMatchObject({
    renderState: {
      source: {
        alphaMode: "MASK",
        alphaCutoff: 0.5,
        doubleSided: true,
      },
      mapped: {
        alphaMode: "mask",
        alphaCutoff: 0.5,
        cullMode: "none",
        depth: { test: true, write: true, compare: "less" },
        blend: { preset: "none" },
      },
    },
  });

  await expectAlphaMaskTexturePixels(
    page,
    status,
    "standard glTF combined alpha-mask emissive",
  );

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
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
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

test("standard glTF texture fixture samples transformed base-color through TEXCOORD_1", async ({
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
  expectRenderedGltfTextureStatus(status, {
    scenario: "base-color-uv1-transform",
    materialModel: "gltf-standard-base-color-uv1-transform",
    textureSlot: "baseColorTexture",
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    pipelineKey: "standard|baseColorTexture|uv1|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
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
        ready: true,
        slots: [
          expect.objectContaining({
            textureKey: "texture:gltf:texture:0:baseColorTexture",
            texCoord: 1,
            field: "baseColorTexture",
            ready: true,
          }),
        ],
        diagnostics: [],
      },
    },
  });

  const standardTexture = status.standardTexture;

  if (standardTexture === undefined) {
    throw new Error("standard glTF transformed UV1 texture status missing");
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
    throw new Error("standard glTF transformed UV1 expectations are missing");
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

test("standard glTF texture fixture samples transformed metallic-roughness through TEXCOORD_1", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=metallic-roughness-uv1",
  );

  const controlStatus =
    await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-metallic-roughness-uv1-status",
    controlStatus,
  );

  if (controlStatus === undefined) {
    throw new Error("standard glTF metallic-roughness UV1 status missing");
  }

  skipIfUnsupportedWebGpu(controlStatus);
  expectStatusJsonSafeForGpu(controlStatus);
  expectRenderedGltfTextureStatus(controlStatus, {
    scenario: "metallic-roughness-uv1",
    materialModel: "gltf-standard-metallic-roughness-uv1",
    textureSlot: "metallicRoughnessTexture",
    textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
    samplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
    pipelineKey: "standard|metallicRoughnessTexture|uv1|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
  });
  expect(controlStatus).toMatchObject({
    standardTexture: {
      expectedTexCoord: 1,
      expectedUv1: {
        u: expect.any(Number),
        v: expect.any(Number),
      },
      expectedTextureTransform: null,
      expectedMetallicRoughness: {
        metallic: 0,
        roughness: 1,
      },
      readiness: {
        ready: true,
        slots: [
          expect.objectContaining({
            field: "metallicRoughnessTexture",
            textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
            texCoord: 1,
            ready: true,
          }),
        ],
        diagnostics: [],
      },
    },
  });

  const controlTexture = controlStatus.standardTexture;

  if (controlTexture === undefined) {
    throw new Error(
      "standard glTF metallic-roughness UV1 texture status missing",
    );
  }

  const controlScreenshot = await page.locator("#aperture-canvas").screenshot();
  const controlSample = readPngPixel(
    controlScreenshot,
    controlTexture.sample.x,
    controlTexture.sample.y,
  );

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=metallic-roughness-uv1-transform",
  );

  const transformedStatus =
    await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-metallic-roughness-uv1-transform-status",
    transformedStatus,
  );

  if (transformedStatus === undefined) {
    throw new Error(
      "standard glTF transformed metallic-roughness UV1 status missing",
    );
  }

  skipIfUnsupportedWebGpu(transformedStatus);
  expectStatusJsonSafeForGpu(transformedStatus);
  expectRenderedGltfTextureStatus(transformedStatus, {
    scenario: "metallic-roughness-uv1-transform",
    materialModel: "gltf-standard-metallic-roughness-uv1-transform",
    textureSlot: "metallicRoughnessTexture",
    textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
    samplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
    pipelineKey: "standard|metallicRoughnessTexture|uv1|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
  });
  expect(transformedStatus).toMatchObject({
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
      expectedMetallicRoughness: {
        metallic: 1,
        roughness: 1,
      },
      readiness: {
        ready: true,
        slots: [
          expect.objectContaining({
            field: "metallicRoughnessTexture",
            textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
            texCoord: 1,
            ready: true,
          }),
        ],
        diagnostics: [],
      },
    },
  });

  const transformedTexture = transformedStatus.standardTexture;

  if (transformedTexture === undefined) {
    throw new Error(
      "standard glTF transformed metallic-roughness UV1 texture status missing",
    );
  }

  const transformedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const transformedSample = readPngPixel(
    transformedScreenshot,
    transformedTexture.sample.x,
    transformedTexture.sample.y,
  );

  expect(pixelDistance(transformedSample, controlSample)).toBeGreaterThan(12);

  if (controlStatus.readback?.ok && transformedStatus.readback?.ok) {
    const controlReadback = controlStatus.readback.samples.find(
      (sample) => sample.id === "textured",
    );
    const transformedReadback = transformedStatus.readback.samples.find(
      (sample) => sample.id === "transformed",
    );

    expect(controlReadback).toBeDefined();
    expect(transformedReadback).toBeDefined();

    if (controlReadback !== undefined && transformedReadback !== undefined) {
      expect(
        pixelDistance(transformedReadback.pixel, controlReadback.pixel),
      ).toBeGreaterThan(12);
    }
  }

  expect(
    transformedStatus.gltf?.assetMapping.diagnosticCodes ?? [],
  ).not.toContain("gltfMaterial.unsupportedTextureTransform");
  expect(transformedStatus.diagnosticCodes ?? []).toEqual([]);
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

test("standard glTF texture fixture applies normal texture scale", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-gltf-texture.html?scenario=normal-map");
  const controlStatus =
    await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-normal-scale-control-status",
    controlStatus,
  );
  expect(controlStatus).toBeDefined();

  if (controlStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(controlStatus);
  expectStatusJsonSafeForGpu(controlStatus);
  expect(controlStatus.standardTexture?.expectedNormalScale).toBe(2);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=normal-map-scale",
  );
  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-normal-scale-status",
    status,
  );
  expect(status, "standard glTF normal scale status missing").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "normal-map-scale",
    materialModel: "gltf-standard-normal-scale",
    ok: true,
    phase: "rendered",
    standardTexture: {
      textureKey: "texture:gltf:texture:0:normalTexture",
      samplerKey: "sampler:gltf:sampler:0:normalTexture",
      textureSlot: "normalTexture",
      expectedNormalMap: {
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
      },
      expectedNormalScale: 0.25,
      readiness: {
        ready: true,
        diagnostics: [],
      },
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 2,
    },
    extraction: { views: 1, meshDraws: 2, lights: 2, diagnostics: 0 },
    draw: { packages: 2, drawCalls: 2 },
  });
  expect(status.pipelines?.keys).toEqual(
    expect.arrayContaining([
      "standard|opaque|back|less|none",
      "standard|normalTexture|opaque|back|less|none",
    ]),
  );
  expect(status.pipelines?.meshLayoutKeys).toEqual(
    expect.arrayContaining(["POSITION,NORMAL,TEXCOORD_0,TANGENT"]),
  );
  expect(status.standardTexture?.samplerMapping).toEqual(
    status.gltf?.assetMapping.samplers?.[0],
  );
  expectSamplerStatusContainsNoBackendResources(
    status.standardTexture?.samplerMapping,
  );

  if (status.standardTexture === undefined) {
    throw new Error("standard glTF normal scale status is missing");
  }
  if (
    status.standardTexture.samples?.scalar === undefined ||
    status.standardTexture.samples.textured === undefined
  ) {
    throw new Error("standard glTF normal scale comparison samples missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const scalarSample = readPngPixel(
    screenshot,
    status.standardTexture.samples.scalar.x,
    status.standardTexture.samples.scalar.y,
  );
  const texturedSample = readPngPixel(
    screenshot,
    status.standardTexture.samples.textured.x,
    status.standardTexture.samples.textured.y,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(scalarSample, clear)).toBeGreaterThan(30);
  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(30);
  expect(pixelDistance(scalarSample, texturedSample)).toBeGreaterThan(12);

  if (status.readback?.ok) {
    const readbackScalar = status.readback.samples.find(
      (sample) => sample.id === "scalar",
    );
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackScalar).toBeDefined();
    expect(readbackTextured).toBeDefined();

    if (readbackScalar !== undefined && readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackScalar.pixel, readbackTextured.pixel),
        `normal-scale readback samples should differ; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(12);
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders a transformed normal texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=normal-map-transform",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-normal-map-transform-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF normal transform status missing");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "normal-map-transform",
    materialModel: "gltf-standard-normal-transform",
    textureSlot: "normalTexture",
    textureKey: "texture:gltf:texture:0:normalTexture",
    samplerKey: "sampler:gltf:sampler:0:normalTexture",
    pipelineKey: "standard|normalTexture|opaque|back|less|none",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
  });
  expect(status).toMatchObject({
    ok: true,
    phase: "rendered",
    materialModel: "gltf-standard-normal-transform",
    standardTexture: {
      expectedTexCoord: 0,
      expectedTextureTransform: {
        offset: [0.5, 0],
        scale: [0.5, 1],
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
  expect(status.pipelines?.keys).toContain(
    "standard|normalTexture|opaque|back|less|none",
  );
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

test("standard glTF texture fixture applies occlusion texture strength", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-gltf-texture.html?scenario=occlusion");
  const controlStatus =
    await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-occlusion-strength-control-status",
    controlStatus,
  );
  expect(controlStatus).toBeDefined();

  if (controlStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(controlStatus);
  expectStatusJsonSafeForGpu(controlStatus);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=occlusion-strength",
  );
  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-occlusion-strength-status",
    status,
  );
  expect(
    status,
    "standard glTF occlusion strength status missing",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "occlusion-strength",
    materialModel: "gltf-standard-occlusion-strength",
    textureSlot: "occlusionTexture",
    textureKey: "texture:gltf:texture:0:occlusionTexture",
    samplerKey: "sampler:gltf:sampler:0:occlusionTexture",
    pipelineKey: "standard|occlusionTexture|opaque|back|less|none",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "occlusion-strength",
    materialModel: "gltf-standard-occlusion-strength",
    ok: true,
    phase: "rendered",
    standardTexture: {
      textureKey: "texture:gltf:texture:0:occlusionTexture",
      samplerKey: "sampler:gltf:sampler:0:occlusionTexture",
      textureSlot: "occlusionTexture",
      expectedOcclusion: {
        red: expect.any(Number),
        strength: 0.25,
      },
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });

  if (status.standardTexture === undefined) {
    throw new Error("standard glTF occlusion strength status is missing");
  }

  expect(status.standardTexture.expectedOcclusion).toMatchObject({
    red: expect.any(Number),
    strength: 0.25,
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

  if (controlStatus.readback?.ok && status.readback?.ok) {
    const controlReadback = controlStatus.readback.samples.find(
      (sample) => sample.id === "textured",
    );
    const strengthReadback = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(controlReadback).toBeDefined();
    expect(strengthReadback).toBeDefined();

    if (controlReadback !== undefined && strengthReadback !== undefined) {
      expect(
        pixelDistance(controlReadback.pixel, strengthReadback.pixel),
        `glTF occlusion strength should change readback output; control=${JSON.stringify(
          controlStatus,
          null,
          2,
        )}; strength=${JSON.stringify(status, null, 2)}`,
      ).toBeGreaterThan(2);
    }
  }

  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders a transformed occlusion texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=occlusion-transform",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-occlusion-transform-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF occlusion transform status missing");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "occlusion-transform",
    materialModel: "gltf-standard-occlusion-transform",
    textureSlot: "occlusionTexture",
    textureKey: "texture:gltf:texture:0:occlusionTexture",
    samplerKey: "sampler:gltf:sampler:0:occlusionTexture",
    pipelineKey: "standard|occlusionTexture|opaque|back|less|none",
  });
  expect(status).toMatchObject({
    ok: true,
    phase: "rendered",
    materialModel: "gltf-standard-occlusion-transform",
    standardTexture: {
      expectedTexCoord: 0,
      expectedTextureTransform: {
        offset: [0.5, 0],
        scale: [0.5, 1],
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
  expect(status.pipelines?.keys).toContain(
    "standard|occlusionTexture|opaque|back|less|none",
  );
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

test("standard glTF texture fixture renders emissive factor without an emissive texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=emissive-factor",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-emissive-factor-status",
    status,
  );
  expect(
    status,
    "standard glTF emissive factor status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "emissive-factor",
    materialModel: "gltf-standard-emissive-factor",
    ok: true,
    phase: "rendered",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 0,
        samplers: [],
      },
    },
    standardMaterial: {
      expectedEmissive: {
        factor: expect.any(Array),
        color: null,
      },
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.pipelines?.keys).toContain("standard|opaque|back|less|none");

  if (status.standardMaterial?.sample === undefined) {
    throw new Error("standard glTF emissive factor sample is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const emissiveSample = readPngPixel(
    screenshot,
    status.standardMaterial.sample.x,
    status.standardMaterial.sample.y,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(emissiveSample, clear)).toBeGreaterThan(30);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, clear),
        `glTF emissive factor readback sample should not match clear; status=${JSON.stringify(
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

test("standard glTF texture fixture renders a transformed emissive texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=emissive-transform",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-emissive-transform-status",
    status,
  );

  if (status === undefined) {
    throw new Error("standard glTF emissive transform status missing");
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectRenderedGltfTextureStatus(status, {
    scenario: "emissive-transform",
    materialModel: "gltf-standard-emissive-transform",
    textureSlot: "emissiveTexture",
    textureKey: "texture:gltf:texture:0:emissiveTexture",
    samplerKey: "sampler:gltf:sampler:0:emissiveTexture",
    pipelineKey: "standard|emissiveTexture|opaque|back|less|none",
  });
  expect(status).toMatchObject({
    ok: true,
    phase: "rendered",
    materialModel: "gltf-standard-emissive-transform",
    standardTexture: {
      expectedTexCoord: 0,
      expectedTextureTransform: {
        offset: [0.5, 0],
        scale: [0.5, 1],
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
  expect(status.pipelines?.keys).toContain(
    "standard|emissiveTexture|opaque|back|less|none",
  );
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

test("standard glTF texture fixture reports alpha-blend render state", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-gltf-texture.html?scenario=alpha-blend");

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus("standard-gltf-texture-alpha-blend-status", status);
  expect(
    status,
    "standard glTF alpha-blend status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "alpha-blend",
    materialModel: "gltf-standard-alpha-blend",
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
      readiness: {
        ready: true,
        diagnostics: [],
      },
    },
    standardMaterial: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      renderState: {
        source: {
          alphaMode: "BLEND",
          alphaCutoff: 0.5,
          doubleSided: false,
        },
        mapped: {
          alphaMode: "blend",
          alphaCutoff: 0.5,
          cullMode: "back",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      },
    },
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 0 },
    diagnosticsSummary: {
      sectionCount: 4,
      materialQueue: {
        itemCount: 1,
        byPhase: [{ phase: "transparent", itemCount: 1 }],
        byFamily: [{ family: "standard", itemCount: 1 }],
        byPhaseAndFamily: [
          { phase: "transparent", family: "standard", itemCount: 1 },
        ],
      },
      routedResourceSet: {
        itemCount: 1,
        byFamily: [{ family: "standard", itemCount: 1 }],
        byPipeline: [
          {
            pipelineKey: "standard|baseColorTexture|blend|back|less|alpha",
            itemCount: 1,
          },
        ],
        byFamilyAndPipeline: [
          {
            family: "standard",
            pipelineKey: "standard|baseColorTexture|blend|back|less|alpha",
            itemCount: 1,
          },
        ],
      },
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
      bindGroupsCreated: 0,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|blend|back|less|alpha",
  );
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture blends translucent base-color pixels", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=alpha-blend-texture",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-alpha-blend-texture-status",
    status,
  );
  expect(
    status,
    "standard glTF alpha-blend texture status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "alpha-blend-texture",
    materialModel: "gltf-standard-alpha-blend-texture",
    ok: true,
    phase: "rendered",
    standardTexture: {
      textureSlot: "baseColorTexture",
      expectedAlphaBlendTexture: {
        source: {
          alphaMode: "BLEND",
          alphaCutoff: 0.5,
          doubleSided: false,
        },
      },
      samples: {
        opaque: { id: "opaque", x: expect.any(Number), y: expect.any(Number) },
        translucent: {
          id: "masked",
          x: expect.any(Number),
          y: expect.any(Number),
        },
      },
      readiness: {
        ready: true,
        diagnostics: [],
      },
    },
    standardMaterial: {
      renderState: {
        mapped: {
          alphaMode: "blend",
          cullMode: "back",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      },
    },
    diagnosticsSummary: {
      materialQueue: {
        byPhase: [{ phase: "transparent", itemCount: 1 }],
      },
      routedResourceSet: {
        byPipeline: [
          {
            pipelineKey: "standard|baseColorTexture|blend|back|less|alpha",
            itemCount: 1,
          },
        ],
      },
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|blend|back|less|alpha",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);

  if (status.standardTexture?.expectedAlphaBlendTexture == null) {
    throw new Error("standard glTF alpha-blend texture expectation is missing");
  }
  if (
    status.standardTexture.samples?.opaque === undefined ||
    status.standardTexture.samples.translucent === undefined
  ) {
    throw new Error("standard glTF alpha-blend sample points are missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });
  const opaquePixel = readPngPixel(
    screenshot,
    status.standardTexture.samples.opaque.x,
    status.standardTexture.samples.opaque.y,
  );
  const translucentPixel = readPngPixel(
    screenshot,
    status.standardTexture.samples.translucent.x,
    status.standardTexture.samples.translucent.y,
  );

  expect(pixelDistance(opaquePixel, clear)).toBeGreaterThan(30);
  expect(pixelDistance(translucentPixel, clear)).toBeGreaterThan(5);
  expect(pixelDistance(translucentPixel, clear)).toBeLessThan(
    pixelDistance(opaquePixel, clear),
  );

  if (status.readback?.ok) {
    const readbackOpaque = status.readback.samples.find(
      (sample) => sample.id === "opaque",
    );
    const readbackTranslucent = status.readback.samples.find(
      (sample) => sample.id === "masked",
    );

    expect(readbackOpaque).toBeDefined();
    expect(readbackTranslucent).toBeDefined();

    if (readbackOpaque !== undefined && readbackTranslucent !== undefined) {
      expect(pixelDistance(readbackOpaque.pixel, clear)).toBeGreaterThan(30);
      expect(pixelDistance(readbackTranslucent.pixel, clear)).toBeGreaterThan(
        5,
      );
      expect(pixelDistance(readbackTranslucent.pixel, clear)).toBeLessThan(
        pixelDistance(readbackOpaque.pixel, clear),
      );
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard glTF alpha-blend double-sided fixture renders with no culling", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=alpha-blend-double-sided",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-alpha-blend-double-sided-status",
    status,
  );
  expect(
    status,
    "standard glTF alpha-blend double-sided status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "alpha-blend-double-sided",
    materialModel: "gltf-standard-alpha-blend-double-sided",
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
          alphaMode: "BLEND",
          alphaCutoff: 0.5,
          doubleSided: true,
        },
        mapped: {
          alphaMode: "blend",
          alphaCutoff: 0.5,
          cullMode: "none",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      },
    },
    backface: {
      sample: { id: "backface", x: expect.any(Number), y: expect.any(Number) },
      expectedColor: expect.any(Array),
    },
    diagnosticsSummary: {
      materialQueue: {
        byPhase: [{ phase: "transparent", itemCount: 1 }],
      },
      routedResourceSet: {
        byPipeline: [
          {
            pipelineKey: "standard|blend|none|less|alpha",
            itemCount: 1,
          },
        ],
      },
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.pipelines?.keys).toContain("standard|blend|none|less|alpha");
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);

  if (status.backface === undefined) {
    throw new Error(
      "standard glTF alpha-blend double-sided expectation is missing",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });
  const pixel = readPngPixel(
    screenshot,
    status.backface.sample.x,
    status.backface.sample.y,
  );

  expect(pixelDistance(pixel, clear)).toBeGreaterThan(20);

  if (status.readback?.ok) {
    const readbackBackface = status.readback.samples.find(
      (sample) => sample.id === "backface",
    );

    expect(readbackBackface).toBeDefined();

    if (readbackBackface !== undefined) {
      expect(pixelDistance(readbackBackface.pixel, clear)).toBeGreaterThan(20);
    }
  }

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

  await expectAlphaMaskTexturePixels(page, status, "standard glTF alpha-mask");

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

test("standard glTF opaque double-sided fixture renders backfaces", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=opaque-double-sided",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-opaque-double-sided-status",
    status,
  );
  expect(
    status,
    "standard glTF opaque double-sided status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "opaque-double-sided",
    materialModel: "gltf-standard-opaque-double-sided",
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
          doubleSided: true,
        },
        mapped: {
          alphaMode: "opaque",
          alphaCutoff: 0.5,
          cullMode: "none",
          depth: { test: true, write: true, compare: "less" },
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
  expect(status.pipelines?.keys).toContain("standard|opaque|none|less|none");
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0",
  );
  expect(status.diagnosticCodes ?? []).toEqual([]);

  if (status.backface === undefined) {
    throw new Error("standard glTF opaque double-sided expectation is missing");
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

test("standard glTF texture fixture reports metallic-roughness delayed dependencies", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=metallic-roughness-delayed-dependencies",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-metallic-roughness-delayed-dependencies-status",
    status,
  );
  expect(
    status,
    "standard glTF metallic-roughness delayed dependency status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectExpectedGltfTextureFailureStatus(status, {
    scenario: "metallic-roughness-delayed-dependencies",
    expectedMappingDiagnostic: null,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    expectedTextureStatus: "metallic-roughness-delayed-dependencies",
    textureSlot: "metallicRoughnessTexture",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "metallic-roughness-delayed-dependencies",
    materialModel: "gltf-standard-metallic-roughness-delayed-dependencies",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: null,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    expectedTextureStatus: "metallic-roughness-delayed-dependencies",
    standardTexture: {
      textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
      samplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
      textureSlot: "metallicRoughnessTexture",
      expectedDelayedDependencies: {
        loadingTextureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
        failedSamplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
      },
    },
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 2 },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
    },
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
        field: "metallicRoughnessTexture",
        dependencyKind: "texture",
        handleKey: "texture:gltf:texture:0:metallicRoughnessTexture",
        status: "loading",
        ready: false,
      }),
      expect.objectContaining({
        field: "metallicRoughnessTexture",
        dependencyKind: "sampler",
        handleKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
        status: "failed",
        ready: false,
      }),
    ]),
  );
  expect(dependencyReport?.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "materialDependency.dependencyLoading",
        dependencyKind: "texture",
        dependencyKey: "texture:gltf:texture:0:metallicRoughnessTexture",
        status: "loading",
      }),
      expect.objectContaining({
        code: "materialDependency.dependencyFailed",
        dependencyKind: "sampler",
        dependencyKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
        status: "failed",
      }),
    ]),
  );
  expect(status.standardTexture?.readiness).toMatchObject({
    ready: false,
    materialKey: "material:gltf:material:0",
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        code: "standardMaterialTexture.textureNotReady",
        field: "metallicRoughnessTexture",
        dependencyKind: "texture",
        textureKey: "texture:gltf:texture:0:metallicRoughnessTexture",
        status: "loading",
      }),
      expect.objectContaining({
        code: "standardMaterialTexture.samplerNotReady",
        field: "metallicRoughnessTexture",
        dependencyKind: "sampler",
        samplerKey: "sampler:gltf:sampler:0:metallicRoughnessTexture",
        status: "failed",
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

test("standard glTF texture fixture reports occlusion and emissive delayed dependencies", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=occlusion-emissive-delayed-dependencies",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-occlusion-emissive-delayed-dependencies-status",
    status,
  );
  expect(
    status,
    "standard glTF occlusion/emissive delayed dependency status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "occlusion-emissive-delayed-dependencies",
    materialModel: "gltf-standard-occlusion-emissive-delayed-dependencies",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: null,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    expectedTextureStatus: "occlusion-emissive-delayed-dependencies",
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
      textureKey: "texture:gltf:texture:0:occlusionTexture",
      samplerKey: "sampler:gltf:sampler:0:occlusionTexture",
      textureSlot: "occlusionTexture",
      expectedDelayedDependencies: {
        loadingTextureKey: "texture:gltf:texture:0:occlusionTexture",
        failedSamplerKey: "sampler:gltf:sampler:1:emissiveTexture",
      },
    },
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 2 },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
    },
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
        field: "occlusionTexture",
        dependencyKind: "texture",
        handleKey: "texture:gltf:texture:0:occlusionTexture",
        status: "loading",
        ready: false,
      }),
      expect.objectContaining({
        field: "emissiveTexture",
        dependencyKind: "sampler",
        handleKey: "sampler:gltf:sampler:1:emissiveTexture",
        status: "failed",
        ready: false,
      }),
    ]),
  );
  expect(dependencyReport?.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "materialDependency.dependencyLoading",
        dependencyKind: "texture",
        dependencyKey: "texture:gltf:texture:0:occlusionTexture",
        status: "loading",
      }),
      expect.objectContaining({
        code: "materialDependency.dependencyFailed",
        dependencyKind: "sampler",
        dependencyKey: "sampler:gltf:sampler:1:emissiveTexture",
        status: "failed",
      }),
    ]),
  );
  expect(status.standardTexture?.readiness).toMatchObject({
    ready: false,
    materialKey: "material:gltf:material:0",
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        code: "standardMaterialTexture.textureNotReady",
        field: "occlusionTexture",
        dependencyKind: "texture",
        textureKey: "texture:gltf:texture:0:occlusionTexture",
        status: "loading",
      }),
      expect.objectContaining({
        code: "standardMaterialTexture.samplerNotReady",
        field: "emissiveTexture",
        dependencyKind: "sampler",
        samplerKey: "sampler:gltf:sampler:1:emissiveTexture",
        status: "failed",
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
        diagnostics: expect.any(Number),
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
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: expect.any(Number),
    },
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

test("standard glTF texture fixture reports format/color-space mismatches before submitting draws", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=base-color-format-color-space-mismatch",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-format-color-space-mismatch-status",
    status,
  );
  expect(
    status,
    "standard glTF texture format/color-space mismatch status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expectExpectedGltfTextureFailureStatus(status, {
    scenario: "base-color-format-color-space-mismatch",
    expectedMappingDiagnostic: null,
    expectedDiagnostic:
      "render.standardMaterialTexture.invalidColorSpaceFormat",
    expectedTextureStatus: "format-color-space-mismatch",
    textureSlot: "baseColorTexture",
  });
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    materialModel: "gltf-standard-base-color-format-color-space-mismatch",
    standardTexture: {
      readiness: {
        ready: false,
        slots: [
          {
            field: "baseColorTexture",
            textureKey: "texture:gltf:texture:0:baseColorTexture",
            actualFormat: "rgba8unorm",
            ready: false,
          },
        ],
        diagnostics: [
          {
            code: "standardMaterialTexture.invalidColorSpaceFormat",
            field: "baseColorTexture",
            textureKey: "texture:gltf:texture:0:baseColorTexture",
            actualColorSpace: "srgb",
            expectedFormatSrgb: true,
            actualFormat: "rgba8unorm",
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes ?? []).not.toContain(
    "gltfMaterial.unsupportedTextureTransform",
  );
  expect(status.diagnosticCodes).toContain(
    "render.standardMaterialTexture.invalidColorSpaceFormat",
  );
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports unsupported required material extensions before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=unsupported-required-material-extension",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-unsupported-required-material-extension-status",
    status,
  );
  expect(
    status,
    "standard glTF unsupported required extension status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "unsupported-required-material-extension",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.unsupportedRequiredExtension",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "unsupported-required-material-extension",
    materialModel: "gltf-standard-unsupported-required-material-extension",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 2,
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 1,
            diagnosticCount: 1,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.gltf?.assetMapping.diagnosticCodes).toContain(
    "gltfMaterial.unsupportedRequiredExtension",
  );
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.unsupportedRequiredExtension",
        severity: "error",
        materialIndex: 0,
        field: "extensions.KHR_materials_clearcoat",
        extensionName: "KHR_materials_clearcoat",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture renders unsupported optional material extensions with warnings", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=unsupported-optional-material-extension",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-unsupported-optional-material-extension-status",
    status,
  );
  expect(
    status,
    "standard glTF unsupported optional extension status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "unsupported-optional-material-extension",
    ok: true,
    phase: "rendered",
    materialModel: "gltf-standard-unsupported-optional-material-extension",
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
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfMaterial.unsupportedOptionalExtension",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.unsupportedOptionalExtension",
        severity: "warning",
        materialIndex: 0,
        field: "extensions.KHR_materials_clearcoat",
        extensionName: "KHR_materials_clearcoat",
      }),
    ]),
  );
  expect(status.standardTexture).toMatchObject({
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    textureSlot: "baseColorTexture",
    readiness: { ready: true, diagnostics: [] },
  });
  expect(status.diagnosticCodes ?? []).toEqual([]);
  expect(status.diagnosticsSummary?.materialQueue?.itemCount).toBe(1);
  expect(status.diagnosticsSummary?.routedResourceSet?.itemCount).toBe(1);
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports multiple unsupported optional material extension warnings", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=multiple-optional-material-extensions",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-multiple-optional-material-extensions-status",
    status,
  );
  expect(
    status,
    "standard glTF multiple optional extension status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "multiple-optional-material-extensions",
    ok: true,
    phase: "rendered",
    materialModel: "gltf-standard-multiple-optional-material-extensions",
    gltf: {
      assetMapping: {
        valid: true,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 2,
      },
      registration: {
        valid: true,
        written: 4,
        diagnostics: 0,
      },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfMaterial.unsupportedOptionalExtension",
    "gltfMaterial.unsupportedOptionalExtension",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.unsupportedOptionalExtension",
        severity: "warning",
        materialIndex: 0,
        field: "extensions.KHR_materials_clearcoat",
        extensionName: "KHR_materials_clearcoat",
      }),
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.unsupportedOptionalExtension",
        severity: "warning",
        materialIndex: 0,
        field: "extensions.KHR_materials_transmission",
        extensionName: "KHR_materials_transmission",
      }),
    ]),
  );
  expect(status.standardTexture).toMatchObject({
    textureKey: "texture:gltf:texture:0:baseColorTexture",
    samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
    textureSlot: "baseColorTexture",
    readiness: { ready: true, diagnostics: [] },
  });
  expect(status.diagnosticCodes ?? []).toEqual([]);
  expect(status.diagnosticsSummary?.materialQueue?.itemCount).toBe(1);
  expect(status.diagnosticsSummary?.routedResourceSet?.itemCount).toBe(1);
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports invalid render-state fields before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=invalid-render-state",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-invalid-render-state-status",
    status,
  );
  expect(
    status,
    "standard glTF invalid render-state status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "invalid-render-state",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.invalidField",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "invalid-render-state",
    materialModel: "gltf-standard-invalid-render-state",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 3,
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 1,
            diagnosticCount: 1,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfMaterial.invalidField",
    "gltfMaterial.invalidField",
    "gltfMaterial.invalidField",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialIndex: 0,
        field: "alphaMode",
        value: "CUTOUT",
      }),
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialIndex: 0,
        field: "doubleSided",
        value: "true",
      }),
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialIndex: 0,
        field: "alphaCutoff",
        value: 1.5,
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports invalid material scalar factors before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=invalid-material-scalar",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-invalid-material-scalar-status",
    status,
  );
  expect(
    status,
    "standard glTF invalid material scalar status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "invalid-material-scalar",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.invalidField",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "invalid-material-scalar",
    materialModel: "gltf-standard-invalid-material-scalar",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 1,
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 1,
            diagnosticCount: 1,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfMaterial.invalidField",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialIndex: 0,
        field: "pbrMetallicRoughness.metallicFactor",
        value: "metallic",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports invalid vector factors before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=invalid-vector-factor",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-invalid-vector-factor-status",
    status,
  );
  expect(
    status,
    "standard glTF invalid vector factor status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "invalid-vector-factor",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.invalidField",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "invalid-vector-factor",
    materialModel: "gltf-standard-invalid-vector-factor",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 1,
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 1,
            diagnosticCount: 1,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfMaterial.invalidField",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialIndex: 0,
        field: "pbrMetallicRoughness.baseColorFactor",
        value: "hot-pink",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports invalid texture scalar fields before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=invalid-texture-scalar",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-invalid-texture-scalar-status",
    status,
  );
  expect(
    status,
    "standard glTF invalid texture scalar status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "invalid-texture-scalar",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.invalidField",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "invalid-texture-scalar",
    materialModel: "gltf-standard-invalid-texture-scalar",
    gltf: {
      assetMapping: {
        valid: false,
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
        valid: false,
        written: 3,
        diagnostics: 1,
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.standardTexture).toMatchObject({
    textureSlot: "occlusionTexture",
    readiness: {
      ready: false,
      materialStatus: "missing",
      diagnostics: [
        expect.objectContaining({
          code: "standardMaterialTexture.missingMaterial",
        }),
      ],
    },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfMaterial.invalidField",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialIndex: 0,
        field: "occlusionTexture.strength",
        value: "strong",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports unresolved texture bindings before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=unresolved-texture-binding",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-unresolved-texture-binding-status",
    status,
  );
  expect(
    status,
    "standard glTF unresolved texture-binding status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "unresolved-texture-binding",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.unresolvedTextureBinding",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "unresolved-texture-binding",
    materialModel: "gltf-standard-unresolved-texture-binding",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 2,
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 3,
            diagnosticCount: 3,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    standardTexture: {
      textureKey: "texture:gltf:texture:0:baseColorTexture",
      samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      textureSlot: "baseColorTexture",
      readiness: {
        ready: false,
        materialKey: "material:gltf:material:0",
        diagnostics: [
          {
            code: "standardMaterialTexture.missingMaterial",
            status: "missing",
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    draw: { drawCalls: 0 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfTexture.malformedImage",
    "gltfMaterial.unresolvedTextureBinding",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "texture",
        code: "gltfTexture.malformedImage",
        severity: "error",
        textureIndex: 0,
        slot: "baseColorTexture",
        field: "images[7]",
      }),
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        materialIndex: 0,
        textureIndex: 0,
        slot: "baseColorTexture",
        field: "pbrMetallicRoughness.baseColorTexture",
        dependencyKind: "texture",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports invalid sampler indices before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=invalid-sampler-index",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-invalid-sampler-index-status",
    status,
  );
  expect(
    status,
    "standard glTF invalid sampler-index status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "invalid-sampler-index",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.unresolvedTextureBinding",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "invalid-sampler-index",
    materialModel: "gltf-standard-invalid-sampler-index",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 2,
        samplers: [
          {
            handleKey: "gltf:sampler:0:baseColorTexture",
            textureIndex: 0,
            slot: "baseColorTexture",
            mapped: {
              kind: "sampler",
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
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 3,
            diagnosticCount: 3,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    standardTexture: {
      textureKey: "texture:gltf:texture:0:baseColorTexture",
      samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      textureSlot: "baseColorTexture",
      samplerMapping: {
        handleKey: "gltf:sampler:0:baseColorTexture",
        textureIndex: 0,
        slot: "baseColorTexture",
        mapped: {
          kind: "sampler",
        },
      },
      readiness: {
        ready: false,
        materialKey: "material:gltf:material:0",
        diagnostics: [
          {
            code: "standardMaterialTexture.missingMaterial",
            status: "missing",
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfTexture.invalidSamplerIndex",
    "gltfMaterial.unresolvedTextureBinding",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "texture",
        code: "gltfTexture.invalidSamplerIndex",
        severity: "error",
        textureIndex: 0,
        samplerIndex: 3,
        slot: "baseColorTexture",
        field: "textures[0].sampler",
      }),
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        materialIndex: 0,
        textureIndex: 0,
        samplerIndex: 3,
        slot: "baseColorTexture",
        field: "pbrMetallicRoughness.baseColorTexture",
        dependencyKind: "sampler",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports invalid sampler enum values before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=invalid-sampler-enum",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-invalid-sampler-enum-status",
    status,
  );
  expect(
    status,
    "standard glTF invalid sampler-enum status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "invalid-sampler-enum",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.unresolvedTextureBinding",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "invalid-sampler-enum",
    materialModel: "gltf-standard-invalid-sampler-enum",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 1,
        samplerCount: 1,
        materialCount: 1,
        diagnostics: 2,
        samplers: [
          {
            handleKey: "gltf:sampler:0:baseColorTexture",
            textureIndex: 0,
            slot: "baseColorTexture",
            mapped: {
              kind: "sampler",
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
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 3,
            diagnosticCount: 3,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    standardTexture: {
      textureKey: "texture:gltf:texture:0:baseColorTexture",
      samplerKey: "sampler:gltf:sampler:0:baseColorTexture",
      textureSlot: "baseColorTexture",
      samplerMapping: {
        handleKey: "gltf:sampler:0:baseColorTexture",
        textureIndex: 0,
        slot: "baseColorTexture",
        source: {
          wrapS: 33071,
        },
        mapped: {
          kind: "sampler",
        },
      },
      readiness: {
        ready: false,
        materialKey: "material:gltf:material:0",
        diagnostics: [
          {
            code: "standardMaterialTexture.missingMaterial",
            status: "missing",
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfTexture.invalidSampler",
    "gltfMaterial.unresolvedTextureBinding",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "texture",
        code: "gltfTexture.invalidSampler",
        severity: "error",
        textureIndex: 0,
        samplerIndex: 0,
        slot: "baseColorTexture",
        field: "sampler.wrapS",
        value: "repeat",
      }),
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        materialIndex: 0,
        textureIndex: 0,
        samplerIndex: 0,
        slot: "baseColorTexture",
        field: "pbrMetallicRoughness.baseColorTexture",
        dependencyKind: "sampler",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
  expect(status.diagnosticsSummary).toBeUndefined();
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  webGpuValidation.expectNoWarnings();
});

test("standard glTF texture fixture reports invalid texture-info fields before registration", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-gltf-texture.html?scenario=invalid-texture-info",
  );

  const status = await waitForExampleStatus<StandardGltfTextureStatus>(page);

  await attachExampleStatus(
    "standard-gltf-texture-invalid-texture-info-status",
    status,
  );
  expect(
    status,
    "standard glTF invalid texture-info status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-gltf-texture",
    scenario: "invalid-texture-info",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedMappingDiagnostic: "gltfMaterial.invalidTextureInfo",
    expectedDiagnostic: "render.missingMaterialHandle",
    expectedTextureStatus: "invalid-texture-info",
    materialModel: "gltf-standard-invalid-texture-info",
    gltf: {
      assetMapping: {
        valid: false,
        textureCount: 0,
        samplerCount: 0,
        materialCount: 1,
        diagnostics: 2,
      },
      meshConstruction: {
        valid: true,
        meshCount: 1,
        diagnostics: 0,
      },
      registration: {
        valid: false,
        written: 1,
        diagnostics: 1,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 1,
            diagnosticCount: 1,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: 1,
    },
    resources: {
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
      materialBuffersCreated: 0,
      bindGroupsCreated: 0,
    },
    draw: { packages: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.standardTexture).toBeUndefined();
  expect(status.gltf?.assetMapping.diagnosticCodes).toEqual([
    "gltfMaterial.invalidTextureInfo",
    "gltfMaterial.invalidTextureInfo",
  ]);
  expect(status.gltf?.assetMapping.diagnosticDetails).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidTextureInfo",
        severity: "error",
        materialIndex: 0,
        slot: "baseColorTexture",
        field: "pbrMetallicRoughness.baseColorTexture.index",
        value: "zero",
      }),
      expect.objectContaining({
        layer: "material",
        code: "gltfMaterial.invalidTextureInfo",
        severity: "error",
        materialIndex: 0,
        slot: "baseColorTexture",
        field: "pbrMetallicRoughness.baseColorTexture.texCoord",
        value: "uv1",
      }),
    ]),
  );
  expect(status.diagnosticCodes).toContain("render.missingMaterialHandle");
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

async function expectValidRepeatSamplerPixels(
  page: Page,
  status: StandardGltfTextureStatus,
): Promise<void> {
  const expectedSampler = status.standardTexture?.expectedSampler;

  if (
    expectedSampler === undefined ||
    expectedSampler === null ||
    expectedSampler.rejectedClampColor === undefined
  ) {
    throw new Error("standard glTF repeat sampler expectation is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const sample = status.standardTexture?.sample ?? { x: 0.5, y: 0.5 };
  const texturedSample = readPngPixel(screenshot, sample.x, sample.y);
  const expectedRepeat = rgbaColorToPixel(
    rgbaTupleToColor(expectedSampler.expectedColor),
  );
  const rejectedClamp = rgbaColorToPixel(
    rgbaTupleToColor(expectedSampler.rejectedClampColor),
  );

  expect(pixelDistance(texturedSample, expectedRepeat)).toBeLessThan(
    pixelDistance(texturedSample, rejectedClamp),
  );

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (readbackSample) => readbackSample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, expectedRepeat),
        `glTF repeat sampler readback sample should resolve the wrapped texel; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeLessThan(pixelDistance(readbackTextured.pixel, rejectedClamp));
    }
  }
}

async function expectAlphaMaskTexturePixels(
  page: Page,
  status: StandardGltfTextureStatus,
  label: string,
): Promise<void> {
  if (status.standardTexture?.expectedAlphaMaskTexture == null) {
    throw new Error(`${label} texture expectation is missing`);
  }
  if (status.standardTexture.samples === undefined) {
    throw new Error(`${label} sample points are missing`);
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
}

function expectRenderedMultiTextureStandardStatus(
  status: StandardGltfTextureStatus,
  options: {
    readonly scenario: string;
    readonly materialModel: string;
    readonly registrationWritten: number;
    readonly slots: readonly MultiTextureStandardSlotExpectation[];
    readonly standardTexture?: Record<string, unknown>;
    readonly pipelineKey: string;
    readonly meshLayoutKey: string;
  },
): void {
  expect(options.slots.length).toBeGreaterThan(1);

  const [primarySlot] = options.slots;

  if (primarySlot === undefined) {
    throw new Error("multi-texture StandardMaterial helper requires a slot");
  }

  const slotTextureKey = (slot: MultiTextureStandardSlotExpectation): string =>
    `texture:gltf:texture:${slot.textureIndex}:${slot.field}`;
  const slotSamplerKey = (slot: MultiTextureStandardSlotExpectation): string =>
    `sampler:gltf:sampler:${slot.textureIndex}:${slot.field}`;

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
        textureCount: options.slots.length,
        samplerCount: options.slots.length,
        materialCount: 1,
        diagnostics: 0,
        samplers: options.slots.map((slot) =>
          expect.objectContaining({
            handleKey: `gltf:sampler:${slot.textureIndex}:${slot.field}`,
            textureIndex: slot.textureIndex,
            slot: slot.field,
            mapped: expect.objectContaining({ kind: "sampler" }),
          }),
        ),
      },
      registration: {
        valid: true,
        written: options.registrationWritten,
        diagnostics: 0,
      },
    },
    standardTexture: {
      meshKey: "mesh:gltf:mesh:0:primitive:0",
      materialKey: "material:gltf:material:0",
      textureKey: slotTextureKey(primarySlot),
      samplerKey: slotSamplerKey(primarySlot),
      textureSlot: primarySlot.field,
      ...options.standardTexture,
      readiness: {
        ready: true,
        slots: options.slots.map((slot) =>
          expect.objectContaining({
            field: slot.field,
            textureKey: slotTextureKey(slot),
            ...(slot.texCoord === undefined ? {} : { texCoord: slot.texCoord }),
            ready: true,
          }),
        ),
        diagnostics: [],
      },
    },
    resources: {
      textureResourcesCreated: options.slots.length,
      samplerResourcesCreated: options.slots.length,
      materialBuffersCreated: 1,
      bindGroupsCreated: 0,
    },
    draw: { packages: 1, drawCalls: 1 },
  });
  expect(status.pipelines?.keys).toContain(options.pipelineKey);
  expect(status.pipelines?.meshLayoutKeys).toContain(options.meshLayoutKey);

  for (const sampler of status.gltf?.assetMapping.samplers ?? []) {
    expectSamplerStatusContainsNoBackendResources(sampler);
  }
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
      sectionCount: 4,
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
      directLighting: {
        ready: true,
        lightCounts: {
          total: 2,
          direct: 1,
          ambient: 1,
          directional: 1,
          point: 0,
          spot: 0,
          environment: 0,
        },
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
    readonly expectedMappingDiagnostic: string | null;
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
        diagnostics: expect.any(Number),
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
    extraction: {
      views: 1,
      meshDraws: 0,
      lights: 2,
      diagnostics: expect.any(Number),
    },
    draw: { drawCalls: 0 },
  });
  if (options.expectedMappingDiagnostic === null) {
    expect(status.gltf?.assetMapping.diagnosticCodes ?? []).toEqual([]);
  } else {
    expect(status.gltf?.assetMapping.diagnosticCodes).toContain(
      options.expectedMappingDiagnostic,
    );
  }
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
