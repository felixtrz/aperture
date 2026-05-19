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
  readonly readiness?: {
    readonly ibl: {
      readonly status: string;
      readonly phases: Record<string, string>;
    };
    readonly shadow: {
      readonly status: string;
      readonly phases: Record<string, string>;
    };
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
    readonly textures: {
      readonly ready: boolean;
      readonly status: string;
      readonly descriptorCount: number;
      readonly slotCount: number;
      readonly preparedSlotCount: number;
      readonly sections: {
        readonly iblDescriptors: boolean;
        readonly texturePreparation: boolean;
        readonly textureUpload: boolean;
        readonly prefiltering: boolean;
        readonly shaderSampling: boolean;
      };
      readonly slots: readonly {
        readonly environmentMapResourceKey: string;
        readonly environmentIds: readonly number[];
        readonly kind: string;
        readonly sourceResourceKey: string | null;
        readonly placeholder: string | null;
        readonly textureKey: string | null;
        readonly viewKey: string | null;
        readonly samplerKey: string | null;
        readonly dimension: string;
        readonly format: string;
        readonly usageIntent: string;
        readonly preparation: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly samplers: {
      readonly ready: boolean;
      readonly status: string;
      readonly textureSlotCount: number;
      readonly samplerCount: number;
      readonly allocatedSamplerCount: number;
      readonly sections: {
        readonly texturePreparation: boolean;
        readonly samplerDescriptors: boolean;
        readonly gpuAllocation: boolean;
        readonly bindGroupLayout: boolean;
        readonly shaderSampling: boolean;
      };
      readonly samplers: readonly {
        readonly environmentMapResourceKey: string;
        readonly environmentIds: readonly number[];
        readonly kind: string;
        readonly sourceResourceKey: string;
        readonly samplerKey: string;
        readonly addressModeU: string;
        readonly addressModeV: string;
        readonly addressModeW: string;
        readonly magFilter: string;
        readonly minFilter: string;
        readonly mipmapFilter: string;
        readonly maxAnisotropy: number;
        readonly allocation: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly samplerResources: {
      readonly ready: boolean;
      readonly status: string;
      readonly samplerDescriptorCount: number;
      readonly createdSamplerCount: number;
      readonly sections: {
        readonly samplerDescriptors: boolean;
        readonly gpuAllocation: boolean;
        readonly bindGroupLayout: boolean;
        readonly shaderSampling: boolean;
      };
      readonly resources: readonly {
        readonly valid: boolean;
        readonly resourceKey: string;
        readonly descriptor: {
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
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly diffuseResourceSummary: {
      readonly ready: boolean;
      readonly status: string;
      readonly counts: {
        readonly textureSlots: number;
        readonly diffuseTextureResources: number;
        readonly samplerResources: number;
        readonly deferredSpecularSlots: number;
      };
      readonly sections: {
        readonly texturePreparation: boolean;
        readonly diffuseTextureResource: boolean;
        readonly samplerResources: boolean;
        readonly specularPrefiltering: boolean;
        readonly bindGroupLayout: boolean;
        readonly shaderSampling: boolean;
      };
      readonly resourceKeys: {
        readonly diffuseTextures: readonly string[];
        readonly samplers: readonly string[];
        readonly deferredSpecularTextures: readonly string[];
      };
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly passPlan: {
      readonly ready: boolean;
      readonly status: string;
      readonly slotCount: number;
      readonly passCount: number;
      readonly sections: {
        readonly texturePreparation: boolean;
        readonly passPlans: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
      readonly passes: readonly {
        readonly passKey: string;
        readonly environmentMapResourceKey: string;
        readonly environmentIds: readonly number[];
        readonly kind: string;
        readonly sourceResourceKey: string;
        readonly textureKey: string;
        readonly viewKey: string;
        readonly samplerKey: string;
        readonly operation: string;
        readonly submission: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly resourceSummary: {
      readonly ready: boolean;
      readonly status: string;
      readonly counts: {
        readonly environmentMaps: number;
        readonly descriptors: number;
        readonly textureSlots: number;
        readonly plannedTextures: number;
        readonly plannedViews: number;
        readonly plannedSamplers: number;
        readonly preparationPasses: number;
      };
      readonly sections: {
        readonly iblDescriptors: boolean;
        readonly textureDescriptors: boolean;
        readonly textureUpload: boolean;
        readonly prefilterPassPlans: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
      readonly resourceKeys: {
        readonly environmentMaps: readonly string[];
        readonly textures: readonly string[];
        readonly views: readonly string[];
        readonly samplers: readonly string[];
        readonly passes: readonly string[];
      };
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly viewProjection: {
      readonly ready: boolean;
      readonly status: string;
      readonly requestCount: number;
      readonly passCount: number;
      readonly planCount: number;
      readonly sections: {
        readonly shadowRequests: boolean;
        readonly lightPackets: boolean;
        readonly passPlans: boolean;
        readonly matrixPlanning: boolean;
        readonly gpuResources: boolean;
      };
      readonly plans: readonly {
        readonly shadowId: number;
        readonly lightId: number;
        readonly planKey: string;
        readonly passKey: string;
        readonly lightKind: string;
        readonly lightTransformOffset: number;
        readonly mapSize: number;
        readonly casterLayerMask: number;
        readonly receiverLayerMask: number;
        readonly projection: string;
        readonly viewMatrixKey: string;
        readonly projectionMatrixKey: string;
        readonly viewProjectionMatrixKey: string;
        readonly computation: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly casterDrawList: {
      readonly ready: boolean;
      readonly status: string;
      readonly requestCount: number;
      readonly meshDrawCount: number;
      readonly listCount: number;
      readonly includedDrawCount: number;
      readonly skippedDrawCount: number;
      readonly sections: {
        readonly shadowRequests: boolean;
        readonly passPlans: boolean;
        readonly casterFiltering: boolean;
        readonly commandEncoding: boolean;
      };
      readonly lists: readonly {
        readonly shadowId: number;
        readonly lightId: number;
        readonly passKey: string;
        readonly casterLayerMask: number;
        readonly receiverLayerMask: number;
        readonly includedDrawCount: number;
        readonly skippedDrawCount: number;
        readonly commandEncoding: string;
        readonly draws: readonly {
          readonly renderId: number;
          readonly meshKey: string;
          readonly materialKey: string;
          readonly submesh: number;
          readonly layerMask: number;
        }[];
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly shaderBinding: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly slotCount: number;
      readonly sections: {
        readonly iblPassPlanning: boolean;
        readonly shadowPlanning: boolean;
        readonly bindGroupLayout: boolean;
        readonly shaderSampling: boolean;
      };
      readonly slots: readonly {
        readonly bindingKey: string;
        readonly resourceKey: string;
        readonly kind: string;
        readonly source: string;
        readonly readiness: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly commandPlan: {
      readonly ready: boolean;
      readonly status: string;
      readonly counts: {
        readonly requests: number;
        readonly passes: number;
        readonly viewProjectionPlans: number;
        readonly matrices: number;
        readonly casterLists: number;
        readonly drawCommands: number;
        readonly commandPlans: number;
      };
      readonly sections: {
        readonly shadowPassPlan: boolean;
        readonly viewProjectionPlanning: boolean;
        readonly matrixBufferDescriptor: boolean;
        readonly casterDrawLists: boolean;
        readonly commandEncoding: boolean;
        readonly gpuCommands: boolean;
      };
      readonly commands: readonly {
        readonly commandKey: string;
        readonly shadowId: number;
        readonly lightId: number;
        readonly passKey: string;
        readonly matrixResourceKey: string;
        readonly matrixOffsetBytes: number;
        readonly drawCount: number;
        readonly commandEncoding: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly pipelineKey: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly featureCount: number;
      readonly sections: {
        readonly bindingReadiness: boolean;
        readonly pipelineKeyMetadata: boolean;
        readonly pipelineDescriptor: boolean;
        readonly bindGroupLayout: boolean;
        readonly shaderSampling: boolean;
      };
      readonly features: readonly {
        readonly feature: string;
        readonly pipelineKeyToken: string;
        readonly source: string;
        readonly requiredBySlotCount: number;
        readonly readiness: string;
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
    readonly passPlan: {
      readonly ready: boolean;
      readonly status: string;
      readonly requestCount: number;
      readonly textureCount: number;
      readonly passCount: number;
      readonly sections: {
        readonly shadowRequests: boolean;
        readonly textureResources: boolean;
        readonly passPlans: boolean;
        readonly passSubmission: boolean;
        readonly gpuCommands: boolean;
      };
      readonly passes: readonly {
        readonly shadowId: number;
        readonly lightId: number;
        readonly passKey: string;
        readonly resourceKey: string;
        readonly textureKey: string;
        readonly viewKey: string;
        readonly width: number;
        readonly height: number;
        readonly depthFormat: string;
        readonly casterLayerMask: number;
        readonly receiverLayerMask: number;
        readonly depthLoadOp: string;
        readonly depthStoreOp: string;
        readonly depthClearValue: number;
        readonly submission: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly matrixBuffer: {
      readonly ready: boolean;
      readonly status: string;
      readonly planCount: number;
      readonly matrixCount: number;
      readonly byteSize: number;
      readonly sections: {
        readonly viewProjectionPlanning: boolean;
        readonly bufferDescriptor: boolean;
        readonly gpuAllocation: boolean;
        readonly upload: boolean;
      };
      readonly descriptor: {
        readonly resourceKey: string;
        readonly label: string;
        readonly usage: string;
        readonly matrixCount: number;
        readonly strideBytes: number;
        readonly byteSize: number;
        readonly entries: readonly {
          readonly shadowId: number;
          readonly lightId: number;
          readonly planKey: string;
          readonly passKey: string;
          readonly matrixKey: string;
          readonly offsetBytes: number;
          readonly sizeBytes: number;
          readonly upload: string;
        }[];
      } | null;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly standardMaterial: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly shadowRequestCount: number;
      readonly passCount: number;
      readonly sections: {
        readonly shadowRequests: boolean;
        readonly shadowTextureResources: boolean;
        readonly shadowPassPlan: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
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
    readiness: {
      ibl: {
        status: "deferred",
        phases: {
          environmentMap: "ready",
          descriptors: "ready",
          texturePreparation: "deferred",
          diffuseTextureResource: "ready",
          samplerDescriptors: "ready",
          samplerResources: "ready",
          diffuseResourceSummary: "deferred",
          preparationPasses: "deferred",
          resourceSummary: "deferred",
          standardMaterial: "ready",
          shaderBinding: "deferred",
          pipelineKey: "deferred",
          shaderSampling: "deferred",
        },
      },
      shadow: {
        status: "deferred",
        phases: {
          descriptors: "ready",
          resourceReadiness: "ready",
          textureDescriptors: "deferred",
          passPlans: "deferred",
          viewProjection: "deferred",
          matrixBuffer: "deferred",
          casterDrawLists: "deferred",
          commandPlans: "deferred",
          resourceSummary: "deferred",
          standardMaterial: "deferred",
          rendering: "deferred",
        },
      },
    },
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
      textures: {
        ready: false,
        status: "deferred",
        descriptorCount: 1,
        slotCount: 2,
        preparedSlotCount: 0,
        sections: {
          iblDescriptors: true,
          texturePreparation: true,
          textureUpload: false,
          prefiltering: false,
          shaderSampling: false,
        },
        slots: [
          {
            environmentMapResourceKey:
              "environment-map:gltf:environment:studio",
            environmentIds: [expect.any(Number)],
            kind: "diffuse",
            sourceResourceKey: "texture:gltf:environment:studio:diffuse",
            placeholder: null,
            textureKey: "texture:gltf:environment:studio:diffuse:texture",
            viewKey: "texture:gltf:environment:studio:diffuse:view",
            samplerKey: "texture:gltf:environment:studio:diffuse:sampler",
            dimension: "cube",
            format: "rgba16float",
            usageIntent: "texture-binding",
            preparation: "deferred",
          },
          {
            environmentMapResourceKey:
              "environment-map:gltf:environment:studio",
            environmentIds: [expect.any(Number)],
            kind: "specular",
            sourceResourceKey: "texture:gltf:environment:studio:specular",
            placeholder: null,
            textureKey: "texture:gltf:environment:studio:specular:texture",
            viewKey: "texture:gltf:environment:studio:specular:view",
            samplerKey: "texture:gltf:environment:studio:specular:sampler",
            dimension: "cube",
            format: "rgba16float",
            usageIntent: "texture-binding",
            preparation: "deferred",
          },
        ],
        diagnostics: [
          {
            code: "iblTexturePreparation.preparationDeferred",
            severity: "warning",
          },
        ],
      },
      diffuseTextureResource: {
        ready: true,
        status: "available",
        textureSlotCount: 2,
        diffuseSlotCount: 1,
        createdTextureCount: 1,
        sections: {
          texturePreparation: true,
          diffuseTextureResource: true,
          gpuAllocation: true,
          specularPrefiltering: false,
          shaderSampling: false,
        },
        resources: [
          {
            valid: true,
            resourceKey: "texture:gltf:environment:studio:diffuse:texture",
            descriptor: {
              label: "environment-map:gltf:environment:studio:diffuse-ibl",
              size: [64, 64, 6],
              format: "rgba16float",
              usage: 6,
              mipLevelCount: 1,
            },
          },
        ],
        diagnostics: [],
      },
      samplers: {
        ready: true,
        status: "ready",
        textureSlotCount: 2,
        samplerCount: 2,
        allocatedSamplerCount: 2,
        sections: {
          texturePreparation: true,
          samplerDescriptors: true,
          gpuAllocation: true,
          bindGroupLayout: false,
          shaderSampling: false,
        },
        samplers: [
          {
            environmentMapResourceKey:
              "environment-map:gltf:environment:studio",
            environmentIds: [expect.any(Number)],
            kind: "diffuse",
            sourceResourceKey: "texture:gltf:environment:studio:diffuse",
            samplerKey: "texture:gltf:environment:studio:diffuse:sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            maxAnisotropy: 1,
            allocation: "ready",
          },
          {
            environmentMapResourceKey:
              "environment-map:gltf:environment:studio",
            environmentIds: [expect.any(Number)],
            kind: "specular",
            sourceResourceKey: "texture:gltf:environment:studio:specular",
            samplerKey: "texture:gltf:environment:studio:specular:sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            maxAnisotropy: 1,
            allocation: "ready",
          },
        ],
        diagnostics: [],
      },
      samplerResources: {
        ready: true,
        status: "available",
        samplerDescriptorCount: 2,
        createdSamplerCount: 2,
        sections: {
          samplerDescriptors: true,
          gpuAllocation: true,
          bindGroupLayout: false,
          shaderSampling: false,
        },
        resources: [
          {
            valid: true,
            resourceKey: "texture:gltf:environment:studio:diffuse:sampler",
            descriptor: {
              label:
                "environment-map:gltf:environment:studio:diffuse:ibl-sampler",
              addressModeU: "clamp-to-edge",
              addressModeV: "clamp-to-edge",
              addressModeW: "clamp-to-edge",
              magFilter: "linear",
              minFilter: "linear",
              mipmapFilter: "linear",
              lodMinClamp: 0,
              lodMaxClamp: 32,
              maxAnisotropy: 1,
            },
          },
          {
            valid: true,
            resourceKey: "texture:gltf:environment:studio:specular:sampler",
            descriptor: {
              label:
                "environment-map:gltf:environment:studio:specular:ibl-sampler",
              addressModeU: "clamp-to-edge",
              addressModeV: "clamp-to-edge",
              addressModeW: "clamp-to-edge",
              magFilter: "linear",
              minFilter: "linear",
              mipmapFilter: "linear",
              lodMinClamp: 0,
              lodMaxClamp: 32,
              maxAnisotropy: 1,
            },
          },
        ],
        diagnostics: [],
      },
      diffuseResourceSummary: {
        ready: false,
        status: "deferred",
        counts: {
          textureSlots: 2,
          diffuseTextureResources: 1,
          samplerResources: 2,
          deferredSpecularSlots: 1,
        },
        sections: {
          texturePreparation: true,
          diffuseTextureResource: true,
          samplerResources: true,
          specularPrefiltering: false,
          bindGroupLayout: false,
          shaderSampling: false,
        },
        resourceKeys: {
          diffuseTextures: ["texture:gltf:environment:studio:diffuse:texture"],
          samplers: [
            "texture:gltf:environment:studio:diffuse:sampler",
            "texture:gltf:environment:studio:specular:sampler",
          ],
          deferredSpecularTextures: [
            "texture:gltf:environment:studio:specular:texture",
          ],
        },
        diagnostics: [
          {
            code: "diffuseIblResourceSummary.specularPrefilteringDeferred",
            severity: "warning",
          },
          {
            code: "diffuseIblResourceSummary.bindGroupLayoutDeferred",
            severity: "warning",
          },
          {
            code: "diffuseIblResourceSummary.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      passPlan: {
        ready: false,
        status: "deferred",
        slotCount: 2,
        passCount: 2,
        sections: {
          texturePreparation: true,
          passPlans: true,
          passSubmission: false,
          shaderSampling: false,
        },
        passes: [
          {
            passKey: "ibl-pass:environment-map:gltf:environment:studio:diffuse",
            environmentMapResourceKey:
              "environment-map:gltf:environment:studio",
            environmentIds: [expect.any(Number)],
            kind: "diffuse",
            sourceResourceKey: "texture:gltf:environment:studio:diffuse",
            textureKey: "texture:gltf:environment:studio:diffuse:texture",
            viewKey: "texture:gltf:environment:studio:diffuse:view",
            samplerKey: "texture:gltf:environment:studio:diffuse:sampler",
            operation: "irradiance-convolution",
            submission: "deferred",
          },
          {
            passKey:
              "ibl-pass:environment-map:gltf:environment:studio:specular",
            environmentMapResourceKey:
              "environment-map:gltf:environment:studio",
            environmentIds: [expect.any(Number)],
            kind: "specular",
            sourceResourceKey: "texture:gltf:environment:studio:specular",
            textureKey: "texture:gltf:environment:studio:specular:texture",
            viewKey: "texture:gltf:environment:studio:specular:view",
            samplerKey: "texture:gltf:environment:studio:specular:sampler",
            operation: "specular-prefilter",
            submission: "deferred",
          },
        ],
        diagnostics: [
          {
            code: "iblPreparationPass.submissionDeferred",
            severity: "warning",
          },
        ],
      },
      resourceSummary: {
        ready: false,
        status: "deferred",
        counts: {
          environmentMaps: 1,
          descriptors: 1,
          textureSlots: 2,
          plannedTextures: 2,
          plannedViews: 2,
          plannedSamplers: 2,
          preparationPasses: 2,
        },
        sections: {
          iblDescriptors: true,
          textureDescriptors: true,
          textureUpload: false,
          prefilterPassPlans: true,
          passSubmission: false,
          shaderSampling: false,
        },
        resourceKeys: {
          environmentMaps: ["environment-map:gltf:environment:studio"],
          textures: [
            "texture:gltf:environment:studio:diffuse:texture",
            "texture:gltf:environment:studio:specular:texture",
          ],
          views: [
            "texture:gltf:environment:studio:diffuse:view",
            "texture:gltf:environment:studio:specular:view",
          ],
          samplers: [
            "texture:gltf:environment:studio:diffuse:sampler",
            "texture:gltf:environment:studio:specular:sampler",
          ],
          passes: [
            "ibl-pass:environment-map:gltf:environment:studio:diffuse",
            "ibl-pass:environment-map:gltf:environment:studio:specular",
          ],
        },
        diagnostics: [
          {
            code: "iblPreparationResourceSummary.textureUploadDeferred",
            severity: "warning",
          },
          {
            code: "iblPreparationResourceSummary.passSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "iblPreparationResourceSummary.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      shaderBinding: {
        ready: false,
        status: "deferred",
        standardMaterialCount: 2,
        slotCount: 4,
        sections: {
          iblPassPlanning: true,
          shadowPlanning: true,
          bindGroupLayout: false,
          shaderSampling: false,
        },
        slots: expect.arrayContaining([
          expect.objectContaining({
            kind: "ibl-diffuse",
            source: "ibl",
            readiness: "deferred",
          }),
          expect.objectContaining({
            kind: "ibl-specular",
            source: "ibl",
            readiness: "deferred",
          }),
          expect.objectContaining({
            kind: "shadow-view-projection",
            source: "shadow",
            readiness: "deferred",
          }),
          expect.objectContaining({
            kind: "shadow-map",
            source: "shadow",
            readiness: "deferred",
          }),
        ]),
        diagnostics: [
          {
            code: "standardMaterialIblShadowBinding.bindGroupDeferred",
            severity: "warning",
          },
          {
            code: "standardMaterialIblShadowBinding.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      pipelineKey: {
        ready: false,
        status: "deferred",
        standardMaterialCount: 2,
        featureCount: 4,
        sections: {
          bindingReadiness: true,
          pipelineKeyMetadata: true,
          pipelineDescriptor: false,
          bindGroupLayout: false,
          shaderSampling: false,
        },
        features: [
          {
            feature: "ibl-diffuse-irradiance",
            pipelineKeyToken: "iblDiffuseIrradiance",
            source: "ibl",
            requiredBySlotCount: 1,
            readiness: "deferred",
          },
          {
            feature: "ibl-specular-prefilter",
            pipelineKeyToken: "iblSpecularPrefilter",
            source: "ibl",
            requiredBySlotCount: 1,
            readiness: "deferred",
          },
          {
            feature: "shadow-map",
            pipelineKeyToken: "shadowMap",
            source: "shadow",
            requiredBySlotCount: 1,
            readiness: "deferred",
          },
          {
            feature: "shadow-view-projection",
            pipelineKeyToken: "shadowViewProjection",
            source: "shadow",
            requiredBySlotCount: 1,
            readiness: "deferred",
          },
        ],
        diagnostics: [
          {
            code: "standardMaterialIblShadowPipelineKey.deferredFeature",
            severity: "warning",
          },
          {
            code: "standardMaterialIblShadowPipelineKey.deferredFeature",
            severity: "warning",
          },
          {
            code: "standardMaterialIblShadowPipelineKey.deferredFeature",
            severity: "warning",
          },
          {
            code: "standardMaterialIblShadowPipelineKey.deferredFeature",
            severity: "warning",
          },
          {
            code: "standardMaterialIblShadowPipelineKey.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
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
      passPlan: {
        ready: false,
        status: "deferred",
        requestCount: 1,
        textureCount: 1,
        passCount: 1,
        sections: {
          shadowRequests: true,
          textureResources: true,
          passPlans: true,
          passSubmission: false,
          gpuCommands: false,
        },
        passes: [
          {
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            resourceKey: expect.stringMatching(/^shadow-map:\d+:light:\d+$/),
            textureKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:texture$/,
            ),
            viewKey: expect.stringMatching(/^shadow-map:\d+:light:\d+:view$/),
            width: 1024,
            height: 1024,
            depthFormat: "depth24plus",
            casterLayerMask: 1,
            receiverLayerMask: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            depthClearValue: 1,
            submission: "deferred",
          },
        ],
        diagnostics: [
          {
            code: "shadowPassPlan.submissionDeferred",
            severity: "warning",
          },
        ],
      },
      viewProjection: {
        ready: false,
        status: "deferred",
        requestCount: 1,
        passCount: 1,
        planCount: 1,
        sections: {
          shadowRequests: true,
          lightPackets: true,
          passPlans: true,
          matrixPlanning: false,
          gpuResources: false,
        },
        plans: [
          {
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            planKey: expect.stringMatching(
              /^directional-shadow-view-projection:\d+:light:\d+$/,
            ),
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            lightKind: "directional",
            lightTransformOffset: expect.any(Number),
            mapSize: 1024,
            casterLayerMask: 1,
            receiverLayerMask: 1,
            projection: "orthographic",
            viewMatrixKey: expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:view$/,
            ),
            projectionMatrixKey: expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:projection$/,
            ),
            viewProjectionMatrixKey: expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:view-projection$/,
            ),
            computation: "deferred",
          },
        ],
        diagnostics: [
          {
            code: "directionalShadowViewProjection.matrixDeferred",
            severity: "warning",
          },
        ],
      },
      matrixBuffer: {
        ready: false,
        status: "deferred",
        planCount: 1,
        matrixCount: 1,
        byteSize: 64,
        sections: {
          viewProjectionPlanning: true,
          bufferDescriptor: true,
          gpuAllocation: false,
          upload: false,
        },
        descriptor: {
          resourceKey: "shadow-matrix-buffer:directional",
          label: "DirectionalShadowMatrices/storage",
          usage: "read-only-storage-buffer",
          matrixCount: 1,
          strideBytes: 64,
          byteSize: 64,
          entries: [
            {
              shadowId: expect.any(Number),
              lightId: expect.any(Number),
              planKey: expect.stringMatching(
                /^directional-shadow-view-projection:\d+:light:\d+$/,
              ),
              passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
              matrixKey: expect.stringMatching(
                /^shadow-pass:\d+:light:\d+:view-projection$/,
              ),
              offsetBytes: 0,
              sizeBytes: 64,
              upload: "deferred",
            },
          ],
        },
        diagnostics: [
          {
            code: "shadowMatrixBuffer.uploadDeferred",
            severity: "warning",
          },
        ],
      },
      casterDrawList: {
        ready: false,
        status: "deferred",
        requestCount: 1,
        meshDrawCount: 3,
        listCount: 1,
        includedDrawCount: 3,
        skippedDrawCount: 0,
        sections: {
          shadowRequests: true,
          passPlans: true,
          casterFiltering: true,
          commandEncoding: false,
        },
        lists: [
          {
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            casterLayerMask: 1,
            receiverLayerMask: 1,
            includedDrawCount: 3,
            skippedDrawCount: 0,
            commandEncoding: "deferred",
            draws: expect.arrayContaining([
              expect.objectContaining({
                meshKey: expect.stringMatching(/^mesh:gltf:/),
                materialKey: expect.stringMatching(/^material:gltf:/),
                submesh: 0,
                layerMask: 1,
              }),
            ]),
          },
        ],
        diagnostics: [
          {
            code: "shadowCasterDrawList.commandEncodingDeferred",
            severity: "warning",
          },
        ],
      },
      commandPlan: {
        ready: false,
        status: "deferred",
        counts: {
          requests: 1,
          passes: 1,
          viewProjectionPlans: 1,
          matrices: 1,
          casterLists: 1,
          drawCommands: 3,
          commandPlans: 1,
        },
        sections: {
          shadowPassPlan: true,
          viewProjectionPlanning: true,
          matrixBufferDescriptor: true,
          casterDrawLists: true,
          commandEncoding: false,
          gpuCommands: false,
        },
        commands: [
          {
            commandKey: expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:caster-commands$/,
            ),
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            matrixResourceKey: "shadow-matrix-buffer:directional",
            matrixOffsetBytes: 0,
            drawCount: 3,
            commandEncoding: "deferred",
          },
        ],
        diagnostics: [
          {
            code: "shadowCasterCommandPlan.commandEncodingDeferred",
            severity: "warning",
          },
        ],
      },
      resourceSummary: {
        ready: false,
        status: "deferred",
        counts: {
          requests: 1,
          textures: 1,
          passes: 1,
          viewProjectionPlans: 1,
          matrices: 1,
          casterLists: 1,
          commandPlans: 1,
          drawCommands: 3,
        },
        sections: {
          textureResources: true,
          passPlans: true,
          viewProjectionPlanning: true,
          matrixBufferDescriptor: true,
          casterDrawLists: true,
          commandPlans: true,
          gpuAllocation: false,
          commandEncoding: false,
        },
        resourceKeys: {
          textures: [
            expect.stringMatching(/^shadow-map:\d+:light:\d+:texture$/),
          ],
          views: [expect.stringMatching(/^shadow-map:\d+:light:\d+:view$/)],
          passes: [expect.stringMatching(/^shadow-pass:\d+:light:\d+$/)],
          matrixBuffers: ["shadow-matrix-buffer:directional"],
          commands: [
            expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:caster-commands$/,
            ),
          ],
        },
        diagnostics: [
          {
            code: "shadowCommandResourceSummary.textureAllocationDeferred",
            severity: "warning",
          },
          {
            code: "shadowCommandResourceSummary.commandEncodingDeferred",
            severity: "warning",
          },
        ],
      },
      standardMaterial: {
        ready: false,
        status: "deferred",
        standardMaterialCount: 2,
        shadowRequestCount: 1,
        passCount: 1,
        sections: {
          shadowRequests: true,
          shadowTextureResources: true,
          shadowPassPlan: true,
          passSubmission: false,
          shaderSampling: false,
        },
        diagnostics: [
          {
            code: "standardMaterialShadow.passSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "standardMaterialShadow.shaderSamplingDeferred",
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
