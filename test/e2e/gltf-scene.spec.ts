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
  readonly source?: {
    readonly bufferBackedGlbFixture?: {
      readonly status: string;
      readonly outputSummary: {
        readonly meshConstruction: {
          readonly status: string;
          readonly valid: boolean | null;
          readonly meshCount: number;
          readonly submeshCount: number;
          readonly vertexCount: number;
          readonly indexCount: number;
          readonly diagnosticsCount: number;
        };
        readonly ecsCommandPlan: {
          readonly status: string;
          readonly valid: boolean | null;
          readonly rootEntityCount: number;
          readonly commandCount: number;
          readonly createEntityCount: number;
          readonly addComponentCount: number;
          readonly dependencyCount: number;
          readonly skippedCount: number;
          readonly diagnosticsCount: number;
        };
        readonly ecsReplayReadiness: {
          readonly status: string;
          readonly ready: boolean | null;
          readonly expectedCreateEntityCount: number;
          readonly expectedAddComponentCount: number;
          readonly blockerCount: number;
        };
      };
    };
    readonly glbFixture: {
      readonly status: string;
      readonly sourceKind: string;
      readonly byteLength: number | null;
      readonly externalBuffers: readonly unknown[];
      readonly diagnostics: readonly unknown[];
      readonly glbSourceStatus: {
        readonly valid: boolean;
        readonly chunks: readonly {
          readonly type: string;
          readonly byteLength: number;
        }[];
      } | null;
      readonly outputSummary: {
        readonly meshConstruction: {
          readonly status: string;
          readonly valid: boolean | null;
          readonly meshCount: number;
          readonly submeshCount: number;
          readonly vertexCount: number;
          readonly indexCount: number;
          readonly diagnosticsCount: number;
        };
      };
    };
  };
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
      readonly source: string;
      readonly valid: boolean;
      readonly created: number;
      readonly diagnostics: number;
    };
    readonly visibleBufferBackedReplay: {
      readonly source: string;
      readonly valid: boolean;
      readonly created: number;
      readonly diagnostics: number;
      readonly meshHandleKey: string;
      readonly materialHandleKey: string;
      readonly materialSource: string;
      readonly baseColorFactor: readonly number[];
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
    readonly diffuseTextureResource: {
      readonly ready: boolean;
      readonly status: string;
      readonly textureSlotCount: number;
      readonly diffuseSlotCount: number;
      readonly createdTextureCount: number;
      readonly reusedTextureCount: number;
      readonly sections: Record<string, boolean>;
      readonly resources: readonly {
        readonly valid: boolean;
        readonly resourceKey: string;
        readonly descriptor: unknown;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly specularTextureResource: {
      readonly ready: boolean;
      readonly status: string;
      readonly textureSlotCount: number;
      readonly specularSlotCount: number;
      readonly createdTextureCount: number;
      readonly reusedTextureCount: number;
      readonly sections: Record<string, boolean>;
      readonly resources: readonly {
        readonly valid: boolean;
        readonly resourceKey: string;
        readonly descriptor: unknown;
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
      readonly reusedSamplerCount: number;
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
    readonly resourceReuse: {
      readonly diffuseTextureResourcesCreated: number;
      readonly diffuseTextureResourcesReused: number;
      readonly specularTextureResourcesCreated: number;
      readonly specularTextureResourcesReused: number;
      readonly samplerResourcesCreated: number;
      readonly samplerResourcesReused: number;
    };
    readonly cacheSummary: {
      readonly diffuseTextureEntries: number;
      readonly specularTextureEntries: number;
      readonly samplerEntries: number;
      readonly standardIblBindGroupEntries: number;
      readonly shadowSamplerEntries: number;
      readonly standardShadowBindGroupEntries: number;
      readonly totalEntries: number;
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
    readonly bindGroupLayout: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly group: number;
      readonly bindingCount: number;
      readonly sections: {
        readonly layoutMetadata: boolean;
        readonly layoutDescriptor: boolean;
        readonly bindGroupResource: boolean;
        readonly shaderSampling: boolean;
      };
      readonly layout: {
        readonly group: number;
        readonly label: string;
        readonly entries: readonly {
          readonly binding: number;
          readonly label: string;
          readonly resource: string;
        }[];
        readonly metadata: {
          readonly group: number;
          readonly name: string;
          readonly layoutKey: string;
          readonly bindings: readonly {
            readonly binding: number;
            readonly name: string;
            readonly resourceKind: string;
            readonly visibility: readonly string[];
            readonly required: boolean;
          }[];
        };
      } | null;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly bindGroupDescriptor: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly group: number;
      readonly entryCount: number;
      readonly sections: {
        readonly layoutMetadata: boolean;
        readonly descriptorPlan: boolean;
        readonly diffuseTextureResource: boolean;
        readonly specularTextureResource: boolean;
        readonly samplerResource: boolean;
        readonly bindGroupResource: boolean;
        readonly shaderSampling: boolean;
      };
      readonly plan: {
        readonly valid: boolean;
        readonly group: number;
        readonly resourceKey: string | null;
        readonly entries: readonly {
          readonly group: number;
          readonly binding: number;
          readonly resourceKey: string;
          readonly resourceKind: string;
        }[];
        readonly diagnostics: readonly {
          readonly code: string;
          readonly severity: string;
        }[];
      } | null;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly bindGroupResource: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly group: number;
      readonly createdBindGroupCount: number;
      readonly reusedBindGroupCount: number;
      readonly sections: Record<string, boolean>;
      readonly resource: {
        readonly group: number;
        readonly resourceKey: string;
        readonly layoutKey: string;
        readonly entryResourceKeys: readonly string[];
      } | null;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly appFrameRoute: {
      readonly ready: boolean;
      readonly status: string;
      readonly group: number;
      readonly sections: {
        readonly bindGroupResource: boolean;
        readonly appFrameResources: boolean;
        readonly drawListBinding: boolean;
        readonly shaderSampling: boolean;
      };
      readonly resource: {
        readonly group: number;
        readonly resourceKey: string;
        readonly layoutKey: string;
        readonly entryResourceKeys: readonly string[];
      } | null;
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
    readonly commandEncoding: {
      readonly ready: boolean;
      readonly status: string;
      readonly counts: {
        readonly passes: number;
        readonly depthViews: number;
        readonly matrixBuffers: number;
        readonly casterLists: number;
        readonly commandPlans: number;
        readonly commandRecords: number;
        readonly drawCommands: number;
      };
      readonly sections: {
        readonly passPlans: boolean;
        readonly depthTextureResources: boolean;
        readonly matrixBufferResource: boolean;
        readonly casterDrawLists: boolean;
        readonly commandPlans: boolean;
        readonly commandEncoding: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
      readonly records: readonly {
        readonly passKey: string;
        readonly shadowId: number;
        readonly lightId: number;
        readonly depthTextureKey: string;
        readonly depthViewKey: string;
        readonly matrixResourceKey: string;
        readonly commandKey: string;
        readonly drawCount: number;
        readonly commandEncoding: string;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly pipelineDescriptor: {
      readonly ready: boolean;
      readonly status: string;
      readonly commandRecordCount: number;
      readonly descriptorCount: number;
      readonly sections: {
        readonly commandEncoding: boolean;
        readonly vertexBufferLayout: boolean;
        readonly indexBuffer: boolean;
        readonly matrixBufferLayout: boolean;
        readonly depthStencil: boolean;
        readonly colorTargets: boolean;
        readonly pipelineCreation: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
      readonly descriptor: {
        readonly pipelineKey: string;
        readonly label: string;
        readonly shader: {
          readonly family: string;
          readonly label: string;
          readonly entryPoints: {
            readonly vertex: string;
            readonly fragment: string | null;
          };
        };
        readonly vertex: {
          readonly buffers: readonly string[];
          readonly matrixBufferLayoutKey: string;
        };
        readonly index: {
          readonly required: boolean;
          readonly format: string;
        };
        readonly primitive: {
          readonly topology: string;
          readonly cullMode: string;
          readonly frontFace: string;
        };
        readonly depthStencil: {
          readonly format: string;
          readonly depthWriteEnabled: boolean;
          readonly depthCompare: string;
        };
        readonly colorTargets: readonly unknown[];
      } | null;
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
    readonly matrixBufferResource: {
      readonly ready: boolean;
      readonly status: string;
      readonly matrixCount: number;
      readonly byteSize: number;
      readonly createdBufferCount: number;
      readonly reusedBufferCount: number;
      readonly sections: Record<string, boolean>;
      readonly resource: {
        readonly resourceKey: string;
        readonly label: string;
        readonly byteSize: number;
        readonly matrixCount: number;
        readonly entryMatrixKeys: readonly string[];
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
      readonly mode?: string;
      readonly specularProof?: boolean;
      readonly deferred?: readonly string[];
      readonly diagnostic?: {
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
    readonly depthTextureResources: {
      readonly ready: boolean;
      readonly status: string;
      readonly textureDescriptorCount: number;
      readonly createdTextureCount: number;
      readonly sections: {
        readonly textureDescriptors: boolean;
        readonly depthTextureResource: boolean;
        readonly gpuAllocation: boolean;
        readonly matrixUpload: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
      readonly resources: readonly {
        readonly valid: boolean;
        readonly shadowId: number;
        readonly lightId: number;
        readonly resourceKey: string;
        readonly textureKey: string;
        readonly viewKey: string;
        readonly descriptor: {
          readonly label?: string;
          readonly size: readonly [number, number, number];
          readonly format: string;
          readonly usage: number;
          readonly mipLevelCount?: number;
        } | null;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly depthResourceSummary: {
      readonly ready: boolean;
      readonly status: string;
      readonly counts: {
        readonly textureDescriptors: number;
        readonly depthTextureResources: number;
      };
      readonly sections: {
        readonly textureDescriptors: boolean;
        readonly depthTextureResource: boolean;
        readonly gpuAllocation: boolean;
        readonly matrixUpload: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
      readonly resourceKeys: {
        readonly textures: readonly string[];
        readonly views: readonly string[];
      };
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
    readonly passAttachments: {
      readonly ready: boolean;
      readonly status: string;
      readonly passCount: number;
      readonly attachmentCount: number;
      readonly sections: {
        readonly passPlans: boolean;
        readonly depthTextureResources: boolean;
        readonly depthAttachments: boolean;
        readonly commandEncoder: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: boolean;
      };
      readonly attachments: readonly {
        readonly passKey: string;
        readonly shadowId: number;
        readonly lightId: number;
        readonly textureKey: string;
        readonly viewKey: string;
        readonly width: number;
        readonly height: number;
        readonly depthFormat: string;
        readonly depthLoadOp: string;
        readonly depthStoreOp: string;
        readonly depthClearValue: number;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
      }[];
    };
    readonly matrixComputation: {
      readonly ready: boolean;
      readonly status: string;
      readonly planCount: number;
      readonly matrixCount: number;
      readonly sections: {
        readonly viewProjectionPlanning: boolean;
        readonly transformData: boolean;
        readonly matrixComputation: boolean;
        readonly gpuBufferAllocation: boolean;
        readonly upload: boolean;
        readonly passSubmission: boolean;
      };
      readonly matrices: readonly {
        readonly shadowId: number;
        readonly lightId: number;
        readonly planKey: string;
        readonly passKey: string;
        readonly matrixKey: string;
        readonly lightTransformOffset: number;
        readonly center: readonly number[];
        readonly lightDirection: readonly number[];
        readonly lightPosition: readonly number[];
        readonly orthographicSize: number;
        readonly near: number;
        readonly far: number;
        readonly viewMatrix: readonly number[];
        readonly projectionMatrix: readonly number[];
        readonly viewProjectionMatrix: readonly number[];
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
    readonly bindGroupDescriptor: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly group: number;
      readonly entryCount: number;
      readonly sections: Record<string, boolean>;
      readonly plan: {
        readonly valid: boolean;
        readonly group: number;
        readonly resourceKey: string | null;
        readonly entries: readonly {
          readonly group: number;
          readonly binding: number;
          readonly resourceKey: string;
          readonly resourceKind: string;
        }[];
        readonly diagnostics: readonly {
          readonly code: string;
          readonly severity: string;
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
    readonly bindGroupLayout: {
      readonly ready: boolean;
      readonly status: string;
      readonly standardMaterialCount: number;
      readonly group: number;
      readonly bindingCount: number;
      readonly sections: {
        readonly layoutMetadata: boolean;
        readonly layoutDescriptor: boolean;
        readonly bindGroupResource: boolean;
        readonly shaderSampling: boolean;
      };
      readonly layout: {
        readonly group: number;
        readonly label: string;
        readonly entries: readonly {
          readonly binding: number;
          readonly label: string;
          readonly resource: string;
        }[];
        readonly metadata: {
          readonly group: number;
          readonly name: string;
          readonly layoutKey: string;
        };
      } | null;
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

  await page.goto("/examples/gltf-scene.html?disable-shadow-receiver=1");

  let status = await waitForExampleStatus<GltfSceneStatus>(page);

  expect(status, "GLTF scene status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  await page.waitForFunction(
    () =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= 3,
  );
  const noShadowScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/gltf-scene.html?disable-ibl-sampling=1");
  status = await waitForExampleStatus<GltfSceneStatus>(page);

  expect(status, "GLTF scene status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  await page.waitForFunction(
    () =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= 3,
  );
  const noIblScreenshot = await page.locator("#aperture-canvas").screenshot();

  await page.goto("/examples/gltf-scene.html?disable-specular-ibl-sampling=1");
  status = await waitForExampleStatus<GltfSceneStatus>(page);

  expect(status, "GLTF scene status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  await page.waitForFunction(
    () =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= 3,
  );
  const noSpecularIblScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await page.goto("/examples/gltf-scene.html");
  status = await waitForExampleStatus<GltfSceneStatus>(page);

  expect(status, "GLTF scene status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  await page.waitForFunction(
    () =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= 3,
  );
  status = await page.evaluate(
    () =>
      (globalThis as { readonly __APERTURE_EXAMPLE_STATUS__?: GltfSceneStatus })
        .__APERTURE_EXAMPLE_STATUS__,
  );
  await attachExampleStatus("gltf-scene-status", status);

  expect(status, "GLTF scene status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "gltf-scene",
    ok: true,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    source: {
      glbFixture: {
        status: "loaded",
        sourceKind: "glb",
        byteLength: expect.any(Number),
        externalBuffers: [],
        diagnostics: [],
        glbSourceStatus: {
          valid: true,
          chunks: [{ type: "json", byteLength: expect.any(Number) }],
        },
        outputSummary: {
          meshConstruction: {
            status: "absent",
            valid: null,
            meshCount: 0,
            submeshCount: 0,
            vertexCount: 0,
            indexCount: 0,
            diagnosticsCount: 0,
          },
        },
      },
      bufferBackedGlbFixture: {
        status: "loaded",
        outputSummary: {
          meshConstruction: {
            status: "ready",
            valid: true,
            meshCount: 1,
            submeshCount: 1,
            vertexCount: 3,
            indexCount: 3,
            diagnosticsCount: 0,
          },
          ecsCommandPlan: {
            status: "ready",
            valid: true,
            rootEntityCount: 1,
            commandCount: 12,
            createEntityCount: 2,
            addComponentCount: 10,
            dependencyCount: 0,
            skippedCount: 0,
            diagnosticsCount: 0,
          },
          ecsReplayReadiness: {
            status: "ready",
            ready: true,
            expectedCreateEntityCount: 2,
            expectedAddComponentCount: 10,
            blockerCount: 0,
          },
        },
      },
    },
    readiness: {
      ibl: {
        status: "deferred",
        phases: {
          environmentMap: "ready",
          descriptors: "ready",
          texturePreparation: "deferred",
          diffuseTextureResource: "ready",
          specularTextureResource: "ready",
          samplerDescriptors: "ready",
          samplerResources: "ready",
          diffuseResourceSummary: "deferred",
          preparationPasses: "deferred",
          resourceSummary: "deferred",
          standardMaterial: "ready",
          bindGroupLayout: "deferred",
          bindGroupDescriptor: "deferred",
          bindGroupResource: "ready",
          appFrameRoute: "ready",
          shaderBinding: "deferred",
          pipelineKey: "deferred",
          shaderSampling: "ready",
        },
      },
      shadow: {
        status: "missing",
        phases: {
          descriptors: "ready",
          resourceReadiness: "ready",
          textureDescriptors: "deferred",
          depthTextureResources: "ready",
          depthResourceSummary: "deferred",
          passPlans: "deferred",
          passAttachments: "deferred",
          viewProjection: "deferred",
          matrixComputation: "ready",
          matrixBuffer: "ready",
          matrixBufferResource: "ready",
          casterDrawLists: "deferred",
          commandPlans: "deferred",
          commandEncoding: "deferred",
          pipelineDescriptor: "deferred",
          pipelineResource: "ready",
          matrixBindGroupResource: "ready",
          frameResources: "deferred",
          commandRecords: "ready",
          encoderAssembly: "missing",
          commandBufferSubmission: "submitted",
          depthProbe: "ready",
          receiverBinding: "ready",
          resourceSummary: "deferred",
          bindGroupLayout: "deferred",
          bindGroupDescriptor: "deferred",
          samplerResource: "ready",
          bindGroupResource: "ready",
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
      replay: {
        source: "runtime-facade",
        valid: true,
        created: 7,
        diagnostics: 0,
      },
      visibleBufferBackedReplay: {
        source: "runtime-facade",
        valid: true,
        created: 1,
        diagnostics: 0,
        meshHandleKey: "mesh:gltf:buffer-backed:mesh:0:primitive:0",
        materialHandleKey: "material:buffer-backed:material:0",
        materialSource: "registered",
        baseColorFactor: [0.12, 0.78, 0.46, 1],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 4,
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
        createdTextureCount: 0,
        reusedTextureCount: 1,
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
      specularTextureResource: {
        ready: true,
        status: "available",
        textureSlotCount: 2,
        specularSlotCount: 1,
        createdTextureCount: 0,
        reusedTextureCount: 1,
        sections: {
          texturePreparation: true,
          specularTextureResource: true,
          gpuAllocation: true,
          proofUpload: true,
          prefiltering: false,
          bindGroupResource: false,
          shaderSampling: false,
        },
        resources: [
          {
            valid: true,
            resourceKey: "texture:gltf:environment:studio:specular:texture",
            descriptor: {
              label: "environment-map:gltf:environment:studio:specular-ibl",
              size: [128, 128, 6],
              format: "rgba16float",
              usage: 22,
              mipLevelCount: 8,
            },
          },
        ],
        diagnostics: [
          {
            code: "iblTextureResource.specularProofUploadPlaceholder",
            severity: "warning",
          },
          {
            code: "iblTextureResource.specularPrefilteringDeferred",
            severity: "warning",
          },
        ],
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
        createdSamplerCount: 0,
        reusedSamplerCount: 2,
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
      resourceReuse: {
        diffuseTextureResourcesCreated: 0,
        diffuseTextureResourcesReused: 1,
        specularTextureResourcesCreated: 0,
        specularTextureResourcesReused: 1,
        samplerResourcesCreated: 0,
        samplerResourcesReused: 2,
      },
      cacheSummary: {
        diffuseTextureEntries: 1,
        specularTextureEntries: 1,
        samplerEntries: 2,
        standardIblBindGroupEntries: 1,
        shadowSamplerEntries: 1,
        standardShadowBindGroupEntries: 1,
        shadowCasterPipelineEntries: 1,
        shadowCasterMatrixBindGroupEntries: 1,
        totalEntries: 9,
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
      bindGroupLayout: {
        ready: false,
        status: "deferred",
        standardMaterialCount: 2,
        group: 4,
        bindingCount: 3,
        sections: {
          layoutMetadata: true,
          layoutDescriptor: true,
          bindGroupResource: false,
          shaderSampling: false,
        },
        layout: {
          group: 4,
          label: "standard/ibl/group-4",
          entries: [
            {
              binding: 0,
              label: "diffuseIrradianceTexture",
              resource: "texture",
            },
            {
              binding: 1,
              label: "specularPrefilterTexture",
              resource: "texture",
            },
            {
              binding: 2,
              label: "iblSampler",
              resource: "sampler",
            },
          ],
          metadata: {
            group: 4,
            name: "standardMaterialIbl",
            layoutKey: "standard/ibl/group-4",
          },
        },
        diagnostics: [
          {
            code: "standardMaterialIblBindGroupLayout.bindGroupResourceDeferred",
            severity: "warning",
          },
          {
            code: "standardMaterialIblBindGroupLayout.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      bindGroupDescriptor: {
        ready: false,
        status: "deferred",
        standardMaterialCount: 2,
        group: 4,
        entryCount: 3,
        sections: {
          layoutMetadata: true,
          descriptorPlan: true,
          diffuseTextureResource: true,
          specularTextureResource: true,
          samplerResource: true,
          bindGroupResource: false,
          shaderSampling: false,
        },
        plan: {
          valid: true,
          group: 4,
          resourceKey: expect.stringMatching(
            /^bind-group:standard\/ibl\/group-4\//,
          ),
          entries: [
            {
              group: 4,
              binding: 0,
              resourceKey: "texture:gltf:environment:studio:diffuse:texture",
              resourceKind: "texture-view",
            },
            {
              group: 4,
              binding: 1,
              resourceKey: "texture:gltf:environment:studio:specular:texture",
              resourceKind: "texture-view",
            },
            {
              group: 4,
              binding: 2,
              resourceKey: "texture:gltf:environment:studio:diffuse:sampler",
              resourceKind: "sampler",
            },
          ],
          diagnostics: [],
        },
        diagnostics: [
          {
            code: "standardMaterialIblBindGroup.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      bindGroupResource: {
        ready: true,
        status: "available",
        standardMaterialCount: 2,
        group: 4,
        createdBindGroupCount: 0,
        reusedBindGroupCount: 1,
        sections: {
          descriptorPlan: true,
          layoutResource: true,
          textureResources: true,
          samplerResource: true,
          bindGroupResource: true,
          shaderSampling: false,
        },
        resource: {
          group: 4,
          resourceKey: expect.stringMatching(
            /^bind-group:standard\/ibl\/group-4\//,
          ),
          layoutKey: "standard/ibl/group-4",
          entryResourceKeys: [
            "texture:gltf:environment:studio:diffuse:texture",
            "texture:gltf:environment:studio:specular:texture",
            "texture:gltf:environment:studio:diffuse:sampler",
          ],
        },
        diagnostics: [
          {
            code: "standardMaterialIblBindGroupResource.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      appFrameRoute: {
        ready: true,
        status: "ready",
        group: 4,
        sections: {
          bindGroupResource: true,
          appFrameResources: true,
          drawListBinding: false,
          shaderSampling: false,
        },
        resource: {
          group: 4,
          resourceKey: expect.stringMatching(
            /^bind-group:standard\/ibl\/group-4\//,
          ),
          layoutKey: "standard/ibl/group-4",
          entryResourceKeys: [
            "texture:gltf:environment:studio:diffuse:texture",
            "texture:gltf:environment:studio:specular:texture",
            "texture:gltf:environment:studio:diffuse:sampler",
          ],
        },
        diagnostics: [
          {
            code: "gltfScene.standardMaterialIblAppRoute.shaderSamplingDeferred",
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
        supported: true,
        mode: "diffuse-ibl",
        specularProof: true,
        deferred: ["specular-prefilter", "split-sum-brdf", "skybox"],
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
      depthTextureResources: {
        ready: true,
        status: "available",
        textureDescriptorCount: 1,
        createdTextureCount: 1,
        sections: {
          textureDescriptors: true,
          depthTextureResource: true,
          gpuAllocation: true,
          matrixUpload: false,
          passSubmission: false,
          shaderSampling: false,
        },
        resources: [
          {
            valid: true,
            resourceKey: expect.stringMatching(/^shadow-map:\d+:light:\d+$/),
            textureKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:texture$/,
            ),
            viewKey: expect.stringMatching(/^shadow-map:\d+:light:\d+:view$/),
            descriptor: {
              label: expect.stringMatching(/^shadow-map:\d+:light:\d+:depth$/),
              size: [1024, 1024, 1],
              format: "depth24plus",
              usage: 20,
              mipLevelCount: 1,
            },
          },
        ],
        diagnostics: [],
      },
      depthResourceSummary: {
        ready: false,
        status: "deferred",
        counts: {
          textureDescriptors: 1,
          depthTextureResources: 1,
        },
        sections: {
          textureDescriptors: true,
          depthTextureResource: true,
          gpuAllocation: true,
          matrixUpload: false,
          passSubmission: false,
          shaderSampling: false,
        },
        resourceKeys: {
          textures: [
            expect.stringMatching(/^shadow-map:\d+:light:\d+:texture$/),
          ],
          views: [expect.stringMatching(/^shadow-map:\d+:light:\d+:view$/)],
        },
        diagnostics: [
          {
            code: "shadowDepthResourceSummary.matrixUploadDeferred",
            severity: "warning",
          },
          {
            code: "shadowDepthResourceSummary.passSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "shadowDepthResourceSummary.shaderSamplingDeferred",
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
      passAttachments: {
        ready: false,
        status: "deferred",
        passCount: 1,
        attachmentCount: 1,
        sections: {
          passPlans: true,
          depthTextureResources: true,
          depthAttachments: true,
          commandEncoder: false,
          passSubmission: false,
          shaderSampling: false,
        },
        attachments: [
          {
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            textureKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:texture$/,
            ),
            viewKey: expect.stringMatching(/^shadow-map:\d+:light:\d+:view$/),
            width: 1024,
            height: 1024,
            depthFormat: "depth24plus",
            depthLoadOp: "clear",
            depthStoreOp: "store",
            depthClearValue: 1,
          },
        ],
        diagnostics: [
          {
            code: "shadowPassAttachmentDescriptor.passSubmissionDeferred",
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
      matrixComputation: {
        ready: true,
        status: "ready",
        planCount: 1,
        matrixCount: 1,
        sections: {
          viewProjectionPlanning: true,
          transformData: true,
          matrixComputation: true,
          gpuBufferAllocation: false,
          upload: false,
          passSubmission: false,
        },
        matrices: [
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
            lightTransformOffset: expect.any(Number),
            center: [0, 0, 0],
            lightDirection: expect.arrayContaining([
              expect.any(Number),
              expect.any(Number),
              expect.any(Number),
            ]),
            lightPosition: expect.arrayContaining([
              expect.any(Number),
              expect.any(Number),
              expect.any(Number),
            ]),
            orthographicSize: 20,
            near: 0.1,
            far: 100,
            viewMatrix: expect.arrayContaining([expect.any(Number)]),
            projectionMatrix: expect.arrayContaining([expect.any(Number)]),
            viewProjectionMatrix: expect.arrayContaining([expect.any(Number)]),
          },
        ],
        diagnostics: [],
      },
      projectionCoverage: {
        ready: true,
        status: "ready",
        matrixKey: expect.stringMatching(
          /^shadow-pass:\d+:light:\d+:view-projection$/,
        ),
        sampleCount: 5,
        receiverInsideCount: expect.any(Number),
        casterInsideCount: expect.any(Number),
        records: expect.arrayContaining([
          expect.objectContaining({
            key: "receiver:plane:center",
            role: "receiver",
            shape: "plane",
            insideProjection: expect.any(Boolean),
            uv: [expect.any(Number), expect.any(Number)],
            depth: expect.any(Number),
            projectionDistance: expect.any(Number),
          }),
          expect.objectContaining({
            key: "receiver:box-center-depth-probe",
            role: "receiver",
            shape: "debug-depth-probe",
            insideProjection: true,
            uv: [expect.any(Number), expect.any(Number)],
            depth: expect.any(Number),
            projectionDistance: expect.any(Number),
          }),
          expect.objectContaining({
            key: "caster:box:center",
            role: "caster",
            shape: "box",
            insideProjection: expect.any(Boolean),
            uv: [expect.any(Number), expect.any(Number)],
            depth: expect.any(Number),
            projectionDistance: expect.any(Number),
          }),
        ]),
        diagnostics: [],
      },
      depthProbe: {
        ready: true,
        status: "ready",
        sampleCount: 5,
        probedSampleCount: 5,
        sections: {
          projectionCoverage: true,
          depthTextureResource: true,
          samplerResource: true,
          commandBufferSubmission: true,
          probeShader: true,
          readback: true,
        },
        records: expect.arrayContaining([
          expect.objectContaining({
            key: "receiver:box-center-depth-probe",
            role: "receiver",
            shape: "debug-depth-probe",
            receiverCompareDepth: expect.any(Number),
            sampledDepth: expect.any(Number),
            compareResult: 0,
            expected: "shadowed",
            texel: [expect.any(Number), expect.any(Number)],
          }),
          expect.objectContaining({
            key: "caster:box:center",
            role: "caster",
            sampledDepth: expect.any(Number),
            compareResult: 0,
            expected: "shadowed",
          }),
        ]),
        strictPair: {
          receiverKey: "receiver:plane:center",
          casterKey: "caster:box:center",
          receiverCompareDepth: expect.any(Number),
          receiverSampledDepth: expect.any(Number),
          receiverCompareResult: 0,
          casterProjectionDepth: expect.any(Number),
          uvDistance: expect.any(Number),
          expectedReceiver: "shadowed",
        },
        diagnostics: [],
      },
      matrixBuffer: {
        ready: true,
        status: "ready",
        planCount: 1,
        matrixCount: 1,
        byteSize: 64,
        sections: {
          viewProjectionPlanning: true,
          bufferDescriptor: true,
          gpuAllocation: false,
          upload: true,
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
              upload: "ready",
            },
          ],
        },
        diagnostics: [],
      },
      matrixBufferResource: {
        ready: true,
        status: "available",
        matrixCount: 1,
        byteSize: 64,
        createdBufferCount: 1,
        reusedBufferCount: 0,
        sections: {
          matrixComputation: true,
          bufferDescriptor: true,
          bufferAllocation: true,
          upload: true,
          bindGroupResource: false,
          shaderSampling: false,
        },
        resource: {
          resourceKey: "shadow-matrix-buffer:directional",
          label: "DirectionalShadowMatrices/storage",
          byteSize: 64,
          matrixCount: 1,
          entryMatrixKeys: [
            expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:view-projection$/,
            ),
          ],
        },
        diagnostics: [
          {
            code: "shadowMatrixBufferResource.bindGroupDeferred",
            severity: "warning",
          },
          {
            code: "shadowMatrixBufferResource.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      bindGroupDescriptor: {
        ready: false,
        status: "deferred",
        standardMaterialCount: 2,
        group: 5,
        entryCount: 3,
        sections: {
          layoutMetadata: true,
          descriptorPlan: true,
          matrixBufferResource: true,
          depthTextureResource: true,
          samplerResource: true,
          bindGroupResource: false,
          shaderSampling: false,
        },
        plan: {
          valid: true,
          group: 5,
          resourceKey: expect.stringMatching(
            /^bind-group:standard\/shadow\/group-5\//,
          ),
          entries: [
            {
              group: 5,
              binding: 0,
              resourceKey: "shadow-matrix-buffer:directional",
              resourceKind: "buffer",
            },
            {
              group: 5,
              binding: 1,
              resourceKey: expect.stringMatching(
                /^shadow-map:\d+:light:\d+:texture$/,
              ),
              resourceKind: "texture-view",
            },
            {
              group: 5,
              binding: 2,
              resourceKey: "shadow-sampler:directional",
              resourceKind: "sampler",
            },
          ],
          diagnostics: [],
        },
        diagnostics: [
          {
            code: "standardMaterialShadowBindGroup.bindGroupCreationDeferred",
            severity: "warning",
          },
          {
            code: "standardMaterialShadowBindGroup.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      samplerResource: {
        ready: true,
        status: "available",
        createdSamplerCount: 0,
        reusedSamplerCount: 1,
        sections: {
          samplerDescriptor: true,
          samplerResource: true,
          bindGroupResource: false,
          shaderSampling: false,
        },
        resource: {
          resourceKey: "shadow-sampler:directional",
          descriptor: {
            label: "shadow-sampler:directional",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "nearest",
            minFilter: "nearest",
            mipmapFilter: "nearest",
            lodMinClamp: 0,
            lodMaxClamp: 32,
            compare: "less-equal",
          },
        },
        diagnostics: [
          {
            code: "shadowSamplerResource.bindGroupDeferred",
            severity: "warning",
          },
          {
            code: "shadowSamplerResource.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      bindGroupResource: {
        ready: true,
        status: "available",
        standardMaterialCount: 2,
        group: 5,
        createdBindGroupCount: 0,
        reusedBindGroupCount: 1,
        sections: {
          descriptorPlan: true,
          layoutResource: true,
          matrixBufferResource: true,
          depthTextureResource: true,
          samplerResource: true,
          bindGroupResource: true,
          passSubmission: false,
          shaderSampling: false,
        },
        resource: {
          group: 5,
          resourceKey: expect.stringMatching(
            /^bind-group:standard\/shadow\/group-5\//,
          ),
          layoutKey: "standard/shadow/group-5",
          entryResourceKeys: [
            "shadow-matrix-buffer:directional",
            expect.stringMatching(/^shadow-map:\d+:light:\d+:texture$/),
            "shadow-sampler:directional",
          ],
        },
        diagnostics: [
          {
            code: "standardMaterialShadowBindGroupResource.passSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "standardMaterialShadowBindGroupResource.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      casterDrawList: {
        ready: false,
        status: "deferred",
        requestCount: 1,
        meshDrawCount: 4,
        listCount: 1,
        includedDrawCount: 4,
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
            includedDrawCount: 4,
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
          drawCommands: 4,
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
            drawCount: 4,
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
      commandEncoding: {
        ready: false,
        status: "deferred",
        counts: {
          passes: 1,
          depthViews: 1,
          matrixBuffers: 1,
          casterLists: 1,
          commandPlans: 1,
          commandRecords: 1,
          drawCommands: 4,
        },
        sections: {
          passPlans: true,
          depthTextureResources: true,
          matrixBufferResource: true,
          casterDrawLists: false,
          commandPlans: false,
          commandEncoding: false,
          passSubmission: false,
          shaderSampling: false,
        },
        records: [
          {
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            depthTextureKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:texture$/,
            ),
            depthViewKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:view$/,
            ),
            matrixResourceKey: "shadow-matrix-buffer:directional",
            commandKey: expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:caster-commands$/,
            ),
            drawCount: 4,
            commandEncoding: "ready",
          },
        ],
        diagnostics: [],
      },
      pipelineDescriptor: {
        ready: false,
        status: "deferred",
        commandRecordCount: 1,
        descriptorCount: 1,
        sections: {
          commandEncoding: true,
          vertexBufferLayout: true,
          indexBuffer: true,
          matrixBufferLayout: true,
          depthStencil: true,
          colorTargets: true,
          pipelineCreation: false,
          passSubmission: false,
          shaderSampling: false,
        },
        descriptor: {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/back",
          label: "shadow-caster-depth-only:depth24plus:triangle-list",
          shader: {
            family: "shadow-caster",
            label: "shadow-caster-depth-only",
            entryPoints: {
              vertex: "vs_main",
              fragment: null,
            },
          },
          vertex: {
            buffers: ["POSITION"],
            matrixBufferLayoutKey:
              "shadow-caster/group-0:directional-shadow-matrices@0",
          },
          index: {
            required: true,
            format: "uint32",
          },
          primitive: {
            topology: "triangle-list",
            cullMode: "back",
            frontFace: "ccw",
          },
          depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less-equal",
          },
          colorTargets: [],
        },
        diagnostics: [
          {
            code: "shadowCasterPipelineDescriptor.commandEncodingDeferred",
            severity: "warning",
          },
          {
            code: "shadowCasterPipelineDescriptor.passSubmissionDeferred",
            severity: "warning",
          },
        ],
      },
      pipelineResource: {
        ready: true,
        status: "available",
        descriptorCount: 1,
        createdPipelineCount: 0,
        reusedPipelineCount: 1,
        sections: {
          pipelineDescriptor: true,
          shaderModule: true,
          pipelineCreation: true,
          passSubmission: false,
          shaderSampling: false,
        },
        resource: {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/back",
          resourceKey:
            "render-pipeline:shadow-caster/depth-only/depth24plus/triangle-list/back",
          shaderModuleKey: "shader-module:shadow-caster-depth-only",
          label: "shadow-caster-depth-only:depth24plus:triangle-list",
        },
        diagnostics: [
          {
            code: "shadowCasterPipelineResource.passSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "shadowCasterPipelineResource.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      matrixBindGroupResource: {
        ready: true,
        status: "available",
        matrixBufferCount: 1,
        createdBindGroupCount: 0,
        reusedBindGroupCount: 1,
        sections: {
          matrixBufferResource: true,
          bindGroupLayout: true,
          bindGroupResource: true,
          passSubmission: false,
          shaderSampling: false,
        },
        resource: {
          group: 0,
          matrixResourceKey: "shadow-matrix-buffer:directional",
          resourceKey:
            "bind-group:shadow-caster/group-0/shadow-matrix-buffer:directional",
          layoutKey: "shadow-caster/group-0:directional-shadow-matrices@0",
          entryResourceKeys: ["shadow-matrix-buffer:directional"],
        },
        diagnostics: [
          {
            code: "shadowCasterMatrixBindGroupResource.passSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "shadowCasterMatrixBindGroupResource.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      frameResources: {
        ready: false,
        status: "deferred",
        counts: {
          casterDraws: 4,
          readyDraws: 4,
          missingMeshBuffers: 0,
          pipelineDescriptors: 1,
          matrixBuffers: 1,
        },
        sections: {
          casterDrawLists: true,
          preparedMeshBuffers: true,
          matrixBufferResource: true,
          pipelineDescriptor: true,
          pipelineCreation: false,
          passSubmission: false,
          shaderSampling: false,
        },
        records: expect.arrayContaining([
          {
            renderId: expect.any(Number),
            meshKey: "mesh:gltf:mesh:0:primitive:0",
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            meshResourceKey: expect.stringMatching(/^mesh-buffer:/),
            vertexBufferResourceKeys: [
              expect.stringMatching(/^mesh-vertex-buffer:/),
            ],
            indexBufferResourceKey:
              expect.stringMatching(/^mesh-index-buffer:/),
            matrixResourceKey: "shadow-matrix-buffer:directional",
            pipelineKey:
              "shadow-caster/depth-only/depth24plus/triangle-list/back",
            ready: true,
          },
          {
            renderId: expect.any(Number),
            meshKey: "mesh:gltf:mesh:1:primitive:0",
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            meshResourceKey: expect.stringMatching(/^mesh-buffer:/),
            vertexBufferResourceKeys: [
              expect.stringMatching(/^mesh-vertex-buffer:/),
            ],
            indexBufferResourceKey:
              expect.stringMatching(/^mesh-index-buffer:/),
            matrixResourceKey: "shadow-matrix-buffer:directional",
            pipelineKey:
              "shadow-caster/depth-only/depth24plus/triangle-list/back",
            ready: true,
          },
          {
            renderId: expect.any(Number),
            meshKey: "mesh:gltf:mesh:2:primitive:0",
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            meshResourceKey: expect.stringMatching(/^mesh-buffer:/),
            vertexBufferResourceKeys: [
              expect.stringMatching(/^mesh-vertex-buffer:/),
            ],
            indexBufferResourceKey:
              expect.stringMatching(/^mesh-index-buffer:/),
            matrixResourceKey: "shadow-matrix-buffer:directional",
            pipelineKey:
              "shadow-caster/depth-only/depth24plus/triangle-list/back",
            ready: true,
          },
          {
            renderId: expect.any(Number),
            meshKey: "mesh:gltf:buffer-backed:mesh:0:primitive:0",
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            meshResourceKey: expect.stringMatching(/^mesh-buffer:/),
            vertexBufferResourceKeys: [
              expect.stringMatching(/^mesh-vertex-buffer:/),
            ],
            indexBufferResourceKey:
              expect.stringMatching(/^mesh-index-buffer:/),
            matrixResourceKey: "shadow-matrix-buffer:directional",
            pipelineKey:
              "shadow-caster/depth-only/depth24plus/triangle-list/back",
            ready: true,
          },
        ]),
        diagnostics: [
          {
            code: "shadowCasterFrameResource.pipelineCreationDeferred",
            severity: "warning",
          },
          {
            code: "shadowCasterFrameResource.passSubmissionDeferred",
            severity: "warning",
          },
        ],
      },
      commandRecords: {
        ready: true,
        status: "ready",
        counts: {
          frameResourceDraws: 4,
          readyFrameResourceDraws: 4,
          pipelineResources: 1,
          matrixBindGroups: 1,
          meshResources: 4,
          commandRecords: 1,
          commandCount: 20,
          drawCalls: 4,
          indexedDrawCalls: 4,
        },
        sections: {
          frameResources: true,
          commandPlans: true,
          pipelineResources: true,
          matrixBindGroups: true,
          meshBuffers: true,
          commandRecords: true,
          commandBufferFinish: false,
          queueSubmission: false,
          shaderSampling: false,
        },
        records: [
          {
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            commandKey: expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:caster-commands$/,
            ),
            renderIds: [
              expect.any(Number),
              expect.any(Number),
              expect.any(Number),
              expect.any(Number),
            ],
            commandCount: 20,
            drawCalls: 4,
            indexedDrawCalls: 4,
            pipelineKeys: [
              "shadow-caster/depth-only/depth24plus/triangle-list/back",
            ],
            pipelineResourceKeys: [
              "shadow-caster/depth-only/depth24plus/triangle-list/back",
            ],
            bindGroupResourceKeys: [
              "bind-group:shadow-caster/group-0/shadow-matrix-buffer:directional",
            ],
            vertexBufferResourceKeys: [
              expect.stringMatching(/^mesh-vertex-buffer:/),
              expect.stringMatching(/^mesh-vertex-buffer:/),
              expect.stringMatching(/^mesh-vertex-buffer:/),
              expect.stringMatching(/^mesh-vertex-buffer:/),
            ],
            indexBufferResourceKeys: [
              expect.stringMatching(/^mesh-index-buffer:/),
              expect.stringMatching(/^mesh-index-buffer:/),
              expect.stringMatching(/^mesh-index-buffer:/),
              expect.stringMatching(/^mesh-index-buffer:/),
            ],
            drawCommandKeys: [
              expect.stringMatching(/^shadow-pass:\d+:light:\d+:draw:\d+$/),
              expect.stringMatching(/^shadow-pass:\d+:light:\d+:draw:\d+$/),
              expect.stringMatching(/^shadow-pass:\d+:light:\d+:draw:\d+$/),
              expect.stringMatching(/^shadow-pass:\d+:light:\d+:draw:\d+$/),
            ],
          },
        ],
        commandRecords: [
          {
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            commandKey: expect.stringMatching(
              /^shadow-pass:\d+:light:\d+:caster-commands$/,
            ),
            commandCount: 20,
          },
        ],
        diagnostics: [
          {
            code: "shadowCasterCommandRecord.passSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "shadowCasterCommandRecord.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      encoderAssembly: {
        ready: false,
        status: "missing",
        counts: {
          passes: 1,
          attachments: 1,
          frameResourceDraws: 4,
          commandRecords: 1,
          assembledPasses: 1,
          commandCount: 20,
          executedCommands: 20,
          drawCalls: 4,
        },
        sections: {
          attachmentDescriptors: true,
          frameResources: false,
          commandRecords: true,
          passBegin: true,
          commandExecution: true,
          passEnd: true,
          commandBufferFinish: false,
          queueSubmission: false,
          shaderSampling: false,
        },
        records: [
          {
            passKey: expect.stringMatching(/^shadow-pass:\d+:light:\d+$/),
            shadowId: expect.any(Number),
            lightId: expect.any(Number),
            depthTextureKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:texture$/,
            ),
            depthViewKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:view$/,
            ),
            commandCount: 20,
            executedCommands: 20,
            drawCalls: 4,
            indexedDrawCalls: 4,
            begun: true,
            ended: true,
          },
        ],
        diagnostics: [
          {
            code: "shadowPassEncoderAssembly.frameResourcesNotReady",
            severity: "warning",
          },
          {
            code: "shadowPassEncoderAssembly.commandBufferSubmissionDeferred",
            severity: "warning",
          },
          {
            code: "shadowPassEncoderAssembly.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      commandBufferSubmission: {
        ready: true,
        status: "submitted",
        counts: {
          assembledPasses: 1,
          commandCount: 20,
          drawCalls: 4,
          commandBuffers: 1,
          submittedCommandBuffers: 1,
          skippedSubmissions: 0,
        },
        sections: {
          encoderAssembly: true,
          commandBufferFinish: true,
          queueSubmission: true,
          shaderSampling: false,
        },
        commandBufferKeys: ["command-buffer:shadow-pass:directional"],
        diagnostics: [
          {
            code: "shadowPassCommandBufferSubmission.shaderSamplingDeferred",
            severity: "warning",
          },
        ],
      },
      receiverBinding: {
        ready: true,
        status: "ready",
        standardMaterialCount: 2,
        receiverCount: 2,
        sections: {
          matrixBufferResource: true,
          depthTextureResource: true,
          samplerResource: true,
          bindGroupResource: true,
          commandBufferSubmission: true,
          shaderSampling: true,
        },
        records: [
          {
            receiverKey: "standard-material-shadow-receiver:0",
            group: 5,
            matrixResourceKey: "shadow-matrix-buffer:directional",
            depthTextureResourceKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+$/,
            ),
            depthViewKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:view$/,
            ),
            samplerResourceKey: "shadow-sampler:directional",
            bindGroupResourceKey: expect.stringMatching(
              /^bind-group:standard\/shadow\/group-5\//,
            ),
            commandBufferStatus: "submitted",
          },
          {
            receiverKey: "standard-material-shadow-receiver:1",
            group: 5,
            matrixResourceKey: "shadow-matrix-buffer:directional",
            depthTextureResourceKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+$/,
            ),
            depthViewKey: expect.stringMatching(
              /^shadow-map:\d+:light:\d+:view$/,
            ),
            samplerResourceKey: "shadow-sampler:directional",
            bindGroupResourceKey: expect.stringMatching(
              /^bind-group:standard\/shadow\/group-5\//,
            ),
            commandBufferStatus: "submitted",
          },
        ],
        diagnostics: [],
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
          drawCommands: 4,
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
      bindGroupLayout: {
        ready: false,
        status: "deferred",
        standardMaterialCount: 2,
        group: 5,
        bindingCount: 3,
        sections: {
          layoutMetadata: true,
          layoutDescriptor: true,
          bindGroupResource: false,
          shaderSampling: false,
        },
        layout: {
          group: 5,
          label: "standard/shadow/group-5",
          entries: [
            {
              binding: 0,
              label: "directionalShadowMatrices",
              resource: "read-only-storage-buffer",
            },
            {
              binding: 1,
              label: "directionalShadowMap",
              resource: "texture",
            },
            {
              binding: 2,
              label: "directionalShadowSampler",
              resource: "sampler",
            },
          ],
          metadata: {
            group: 5,
            name: "standardMaterialShadow",
            layoutKey: "standard/shadow/group-5",
          },
        },
        diagnostics: [
          {
            code: "standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred",
            severity: "warning",
          },
          {
            code: "standardMaterialShadowBindGroupLayout.shaderSamplingDeferred",
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
    draw: { drawCalls: 4, indexedDrawCalls: 4 },
    renderWorld: { active: 4 },
  });
  expect(JSON.stringify(status.source?.glbFixture)).not.toContain(
    "binaryChunk",
  );
  expect(JSON.stringify(status.source?.glbFixture)).not.toContain("jsonText");
  expect(JSON.stringify(status.source?.glbFixture)).not.toContain("Uint8Array");
  expect(JSON.stringify(status.source?.glbFixture)).not.toContain(
    "Float32Array",
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("gltf-scene-frame.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleSceneRegions(screenshot, status);
  expectDiffuseIblActivation(noIblScreenshot, screenshot, status);
  expectSpecularIblProofActivation(noSpecularIblScreenshot, screenshot, status);
  expectReceiverShadowActivation(noShadowScreenshot, screenshot, status);
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
    plane: strongestRegionSample(screenshot, clear, 0.57, 0.5, 0.63, 0.63),
    box: strongestRegionSample(screenshot, clear, 0.42, 0.35, 0.58, 0.65),
    cone: strongestRegionSample(screenshot, clear, 0.58, 0.38, 0.75, 0.67),
  };

  for (const [name, sample] of Object.entries(samples)) {
    expect(
      pixelDistance(sample, clear),
      `${name} region should contain non-clear pixels; sample=${JSON.stringify(
        sample,
      )}`,
    ).toBeGreaterThan(20);
  }

  expect(pixelDistance(samples.box, samples.cone)).toBeGreaterThan(18);
}

function expectReceiverShadowActivation(
  before: Buffer,
  screenshot: Buffer,
  status: GltfSceneStatus,
): void {
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const beforeLuminance = averageRegionLuminance(
    before,
    clear,
    standardReceiverRegion(),
  );
  const afterLuminance = averageRegionLuminance(
    screenshot,
    clear,
    standardReceiverRegion(),
  );
  const maxDelta = maxRegionLuminanceDelta(
    before,
    screenshot,
    clear,
    standardReceiverRegion(),
  );
  const routedPipelines = (
    status as GltfSceneStatus & {
      readonly report: {
        readonly diagnosticsSummary?: {
          readonly routedResourceSet: {
            readonly byPipeline: readonly {
              readonly pipelineKey: string;
              readonly itemCount: number;
            }[];
          };
        };
      };
    }
  ).report.diagnosticsSummary?.routedResourceSet.byPipeline;

  expect(
    routedPipelines,
    "StandardMaterial shadow receiver proof requires the shadowMap pipeline route.",
  ).toEqual(
    expect.arrayContaining([
      {
        pipelineKey:
          "standard|iblDiffuse|iblSpecularProof|shadowMap|opaque|back|less|none",
        itemCount: 2,
      },
    ]),
  );
  expect(
    afterLuminance.visibleSamples,
    `receiver region should contain enough visible samples; after=${JSON.stringify(
      afterLuminance,
    )}`,
  ).toBeGreaterThanOrEqual(4);
  expect(
    maxDelta,
    `receiver region should change after shadow sampling; before=${JSON.stringify(
      beforeLuminance,
    )} after=${JSON.stringify(afterLuminance)} maxDelta=${maxDelta}`,
  ).toBeGreaterThan(8);
}

function expectDiffuseIblActivation(
  before: Buffer,
  after: Buffer,
  status: GltfSceneStatus,
): void {
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const delta = maxRegionLuminanceDelta(
    before,
    after,
    clear,
    standardIblProbeRegion(),
  );

  expect(
    status.ibl?.sampling.supported,
    "GLTF scene should report diffuse IBL shader sampling ready.",
  ).toBe(true);
  expect(
    delta,
    `standard material region should change after diffuse IBL sampling; maxDelta=${delta}`,
  ).toBeGreaterThan(4);
}

function expectSpecularIblProofActivation(
  _before: Buffer,
  _after: Buffer,
  status: GltfSceneStatus,
): void {
  const routedPipelines = (
    status as GltfSceneStatus & {
      readonly report: {
        readonly diagnosticsSummary?: {
          readonly routedResourceSet: {
            readonly byPipeline: readonly {
              readonly pipelineKey: string;
              readonly itemCount: number;
            }[];
          };
        };
      };
    }
  ).report.diagnosticsSummary?.routedResourceSet.byPipeline;

  expect(
    status.ibl?.sampling.specularProof,
    "GLTF scene should report placeholder specular IBL proof sampling ready.",
  ).toBe(true);
  expect(
    routedPipelines,
    "GLTF scene should route standard materials through the specular IBL proof pipeline.",
  ).toEqual(
    expect.arrayContaining([
      {
        pipelineKey:
          "standard|iblDiffuse|iblSpecularProof|shadowMap|opaque|back|less|none",
        itemCount: 2,
      },
    ]),
  );
}

function standardIblProbeRegion(): {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
} {
  return { minX: 0.42, minY: 0.35, width: 0.33, height: 0.32 };
}

function standardReceiverRegion(): {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
} {
  return { minX: 0.56, minY: 0.47, width: 0.04, height: 0.14 };
}

function averageRegionLuminance(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
  region: ReturnType<typeof standardReceiverRegion>,
): {
  readonly visibleSamples: number;
  readonly average: number;
} {
  let visibleSamples = 0;
  let totalLuminance = 0;

  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const sample = readPngPixel(
        screenshot,
        region.minX + (region.width * x) / 6,
        region.minY + (region.height * y) / 6,
      );

      if (pixelDistance(sample, clear) <= 20) {
        continue;
      }

      visibleSamples += 1;
      totalLuminance +=
        sample.r * 0.2126 + sample.g * 0.7152 + sample.b * 0.0722;
    }
  }

  return {
    visibleSamples,
    average: visibleSamples === 0 ? 0 : totalLuminance / visibleSamples,
  };
}

function maxRegionLuminanceDelta(
  before: Buffer,
  after: Buffer,
  clear: ReturnType<typeof readPngPixel>,
  region: ReturnType<typeof standardReceiverRegion>,
): number {
  let maxDelta = 0;

  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const xRatio = region.minX + (region.width * x) / 8;
      const yRatio = region.minY + (region.height * y) / 8;
      const beforeSample = readPngPixel(before, xRatio, yRatio);
      const afterSample = readPngPixel(after, xRatio, yRatio);

      if (
        pixelDistance(beforeSample, clear) <= 20 &&
        pixelDistance(afterSample, clear) <= 20
      ) {
        continue;
      }

      const beforeLuminance =
        beforeSample.r * 0.2126 +
        beforeSample.g * 0.7152 +
        beforeSample.b * 0.0722;
      const afterLuminance =
        afterSample.r * 0.2126 +
        afterSample.g * 0.7152 +
        afterSample.b * 0.0722;

      maxDelta = Math.max(maxDelta, Math.abs(beforeLuminance - afterLuminance));
    }
  }

  return maxDelta;
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
