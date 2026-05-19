import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface GltfSceneStatus extends ExampleStatusBase {
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly gltf?: {
    readonly contract: {
      readonly meshPrimitiveCount: number;
      readonly renderablePrimitiveCount: number;
      readonly primitiveShapes: readonly string[];
      readonly materialFamilies: readonly {
        readonly family: string;
        readonly count: number;
      }[];
      readonly cameraCount: number;
      readonly directLightCount: number;
      readonly hasEnvironmentIntent: boolean;
      readonly shadowIntentCount: number;
    };
    readonly diagnostics: readonly unknown[];
    readonly registration: {
      readonly valid: boolean;
    };
    readonly replay: {
      readonly valid: boolean;
      readonly created: number;
      readonly diagnostics: number;
    };
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly diagnostics: number;
    readonly transformDiagnostics: number;
    readonly shadowRequests: number;
  };
  readonly ibl?: {
    readonly environmentMapKey: string;
    readonly readiness: {
      readonly ready: boolean;
      readonly environmentCount: number;
      readonly requiredEnvironmentMapCount: number;
      readonly requirements: readonly {
        readonly resourceKey: string;
        readonly ready: boolean | null;
      }[];
      readonly diagnostics: readonly unknown[];
    };
    readonly descriptor: {
      readonly ready: boolean;
      readonly environmentCount: number;
      readonly requiredEnvironmentMapCount: number;
      readonly descriptorCount: number;
      readonly sections: {
        readonly environmentResourcePlanning: boolean;
        readonly iblDescriptors: boolean;
        readonly shaderSampling: boolean;
      };
      readonly descriptors: readonly {
        readonly environmentMapResourceKey: string;
        readonly ready: boolean;
        readonly diffuse: {
          readonly status: string;
          readonly resourceKey: string | null;
          readonly placeholder: string | null;
        };
        readonly specular: {
          readonly status: string;
          readonly resourceKey: string | null;
          readonly placeholder: string | null;
        };
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly standardMaterial: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly descriptorCount: number;
      readonly sections: {
        readonly iblDescriptors: boolean;
        readonly diffuseIrradiance: boolean | null;
        readonly specularPrefilter: boolean | null;
        readonly shaderSampling: boolean;
      };
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly sampling: {
      readonly supported: boolean;
      readonly diagnostic: {
        readonly code: string;
        readonly severity: string;
      };
    };
  };
  readonly draw?: {
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly shadow?: {
    readonly requests: readonly {
      readonly shadowId: number;
      readonly lightId: number;
      readonly casterLayerMask: number;
      readonly receiverLayerMask: number;
    }[];
    readonly intent: {
      readonly key: string;
      readonly lightKey: string;
      readonly kind: string;
      readonly mapSize: number;
      readonly bias: number;
      readonly normalBias: number;
    };
    readonly descriptor: {
      readonly ready: boolean;
      readonly requestCount: number;
      readonly descriptorCount: number;
      readonly sections: {
        readonly shadowRequests: boolean;
        readonly shadowMapDescriptors: boolean;
        readonly shadowPassSubmission: boolean;
      };
      readonly descriptors: readonly {
        readonly shadowId: number;
        readonly lightId: number;
        readonly resourceKey: string;
        readonly depthFormat: string;
        readonly mapSize: number;
        readonly depthBias: number;
        readonly normalBias: number;
        readonly casterLayerMask: number;
        readonly receiverLayerMask: number;
        readonly ready: boolean;
      }[];
      readonly diagnostics: readonly unknown[];
    };
    readonly resources: {
      readonly ready: boolean;
      readonly status: string;
      readonly requestCount: number;
      readonly descriptorCount: number;
      readonly resourceKeys: readonly string[];
      readonly sections: {
        readonly shadowMapDescriptors: boolean;
        readonly shadowMapResources: boolean;
        readonly shadowPassSubmission: boolean;
      };
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly textures: {
      readonly ready: boolean;
      readonly descriptorCount: number;
      readonly textureCount: number;
      readonly sections: {
        readonly shadowMapDescriptors: boolean;
        readonly textureDescriptors: boolean;
        readonly gpuAllocation: boolean;
      };
      readonly textures: readonly {
        readonly resourceKey: string;
        readonly textureKey: string;
        readonly viewKey: string;
        readonly width: number;
        readonly height: number;
        readonly depthFormat: string;
        readonly usageIntent: string;
        readonly allocation: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly rendering: {
      readonly supported: boolean;
      readonly diagnostic: {
        readonly code: string;
        readonly severity: string;
      };
    };
  };
  readonly renderWorld?: {
    readonly active: number;
  };
}

test("Playwright shows the GLTF scene fixture through the app path", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/gltf-scene.html");

  const status = await waitForExampleStatus<GltfSceneStatus>(page);

  await attachExampleStatus("gltf-scene-status", status);
  expect(status, "GLTF scene status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "gltf-scene",
    ok: true,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    gltf: {
      contract: {
        meshPrimitiveCount: 3,
        renderablePrimitiveCount: 3,
        primitiveShapes: ["box", "cone", "plane"],
        materialFamilies: [
          { family: "standard", count: 2 },
          { family: "unlit", count: 1 },
        ],
        cameraCount: 1,
        directLightCount: 1,
        hasEnvironmentIntent: true,
        shadowIntentCount: 1,
      },
      diagnostics: [],
      registration: { valid: true },
      replay: { valid: true, created: 7, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 3,
      lights: 2,
      environments: 1,
      shadowRequests: 1,
      diagnostics: 0,
      transformDiagnostics: 0,
    },
    ibl: {
      environmentMapKey: "environment-map:gltf:environment:studio",
      readiness: {
        ready: true,
        environmentCount: 1,
        requiredEnvironmentMapCount: 1,
        requirements: [
          {
            resourceKey: "environment-map:gltf:environment:studio",
            ready: true,
          },
        ],
        diagnostics: [],
      },
      descriptor: {
        ready: true,
        environmentCount: 1,
        requiredEnvironmentMapCount: 1,
        descriptorCount: 1,
        sections: {
          environmentResourcePlanning: true,
          iblDescriptors: true,
          shaderSampling: false,
        },
        descriptors: [
          {
            environmentMapResourceKey:
              "environment-map:gltf:environment:studio",
            ready: true,
            diffuse: {
              status: "ready",
              resourceKey: "texture:gltf:environment:studio:diffuse",
              placeholder: null,
            },
            specular: {
              status: "ready",
              resourceKey: "texture:gltf:environment:studio:specular",
              placeholder: null,
            },
          },
        ],
        diagnostics: [],
      },
      standardMaterial: {
        ready: true,
        status: "available",
        standardMaterialCount: 2,
        descriptorCount: 1,
        sections: {
          iblDescriptors: true,
          diffuseIrradiance: true,
          specularPrefilter: true,
          shaderSampling: false,
        },
        diagnostics: [
          {
            code: "standardMaterialIbl.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      sampling: {
        supported: false,
        diagnostic: {
          code: "gltfScene.iblSamplingDeferred",
          severity: "warning",
        },
      },
    },
    shadow: {
      requests: [
        {
          shadowId: expect.any(Number),
          lightId: expect.any(Number),
          casterLayerMask: 1,
          receiverLayerMask: 1,
        },
      ],
      intent: {
        key: "gltf:shadow:directional:0",
        lightKey: "gltf:light:directional:0",
        kind: "directional",
        mapSize: 1024,
        bias: 0.001,
        normalBias: 0.01,
      },
      descriptor: {
        ready: true,
        requestCount: 1,
        descriptorCount: 1,
        sections: {
          shadowRequests: true,
          shadowMapDescriptors: true,
          shadowPassSubmission: false,
        },
        descriptors: [
          {
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            resourceKey: expect.stringMatching(/^shadow-map:\d+:light:\d+$/),
            depthFormat: "depth24plus",
            mapSize: 1024,
            depthBias: 0.001,
            normalBias: 0.01,
            casterLayerMask: 1,
            receiverLayerMask: 1,
            ready: true,
          },
        ],
        diagnostics: [],
      },
      resources: {
        ready: true,
        status: "available",
        requestCount: 1,
        descriptorCount: 1,
        resourceKeys: [expect.stringMatching(/^shadow-map:\d+:light:\d+$/)],
        sections: {
          shadowMapDescriptors: true,
          shadowMapResources: true,
          shadowPassSubmission: false,
        },
        diagnostics: [
          {
            code: "shadowResourceReadiness.passSubmissionDeferred",
            severity: "warning",
          },
        ],
      },
      textures: {
        ready: true,
        descriptorCount: 1,
        textureCount: 1,
        sections: {
          shadowMapDescriptors: true,
          textureDescriptors: true,
          gpuAllocation: false,
        },
        textures: [
          {
            resourceKey: expect.stringMatching(/^shadow-map:\d+:light:\d+$/),
            textureKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:texture$/,
            ),
            viewKey: expect.stringMatching(/^shadow-map:\d+:light:\d+:view$/),
            width: 1024,
            height: 1024,
            depthFormat: "depth24plus",
            usageIntent: "render-attachment",
            allocation: "deferred",
          },
        ],
        diagnostics: [
          {
            code: "shadowTextureResource.allocationDeferred",
            severity: "warning",
          },
        ],
      },
      rendering: {
        supported: false,
        diagnostic: {
          code: "gltfScene.shadowMapDeferred",
          severity: "warning",
        },
      },
    },
    draw: { drawCalls: 3, indexedDrawCalls: 3 },
    renderWorld: { active: 3 },
  });

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("gltf-scene-frame.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleSceneRegions(screenshot, status);
  webGpuValidation.expectNoWarnings();
});

function expectVisibleSceneRegions(
  screenshot: Buffer,
  status: GltfSceneStatus,
): void {
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const samples = {
    plane: strongestRegionSample(screenshot, clear, 0.24, 0.42, 0.4, 0.65),
    box: strongestRegionSample(screenshot, clear, 0.42, 0.35, 0.58, 0.65),
    cone: strongestRegionSample(screenshot, clear, 0.58, 0.38, 0.75, 0.67),
  };

  for (const [name, sample] of Object.entries(samples)) {
    expect(
      pixelDistance(sample, clear),
      `${name} region should contain non-clear pixels; sample=${JSON.stringify(
        sample,
      )}`,
    ).toBeGreaterThan(30);
  }

  expect(pixelDistance(samples.plane, samples.box)).toBeGreaterThan(18);
  expect(pixelDistance(samples.box, samples.cone)).toBeGreaterThan(18);
}

function strongestRegionSample(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ReturnType<typeof readPngPixel> {
  let strongest = clear;
  let strongestDistance = 0;

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const sample = readPngPixel(
        screenshot,
        minX + ((maxX - minX) * x) / 4,
        minY + ((maxY - minY) * y) / 4,
      );
      const distance = pixelDistance(sample, clear);

      if (distance > strongestDistance) {
        strongest = sample;
        strongestDistance = distance;
      }
    }
  }

  return strongest;
}
