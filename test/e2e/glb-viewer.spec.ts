import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface GlbViewerStatus extends ExampleStatusBase {
  readonly frame: number;
  readonly selectedAsset?: {
    readonly id: string;
    readonly label: string;
    readonly source: string;
    readonly url: string;
    readonly loading: boolean;
    readonly materialFamilies: readonly MaterialFamilyStatus[];
    readonly materialSlotSummary?: MaterialSlotSummaryStatus;
  };
  readonly selection?: {
    readonly requestedAssetId: string | null;
    readonly activeAssetId: string | null;
    readonly diagnostics: readonly {
      readonly code: string;
      readonly severity: string;
      readonly message: string;
      readonly requestedAssetId?: string;
      readonly fallbackAssetId?: string;
    }[];
  };
  readonly assetRegistry?: {
    readonly total: number;
    readonly activeRegistered: number;
    readonly staleRegistered: number;
    readonly activeKeys: readonly string[];
  };
  readonly textureGallery?: {
    readonly id: string;
    readonly count: number;
    readonly active: boolean;
    readonly activeIndex: number | null;
    readonly activeAssetId: string | null;
    readonly sampleIds: readonly string[];
  };
  readonly source?: {
    readonly ok: boolean;
    readonly byteLength: number | null;
    readonly status: {
      readonly status: string;
      readonly sourceKind: string;
      readonly externalBuffers?: readonly {
        readonly uri: string;
        readonly status: string;
        readonly byteLength: number | null;
        readonly diagnosticCode?: string;
      }[];
      readonly diagnostics: readonly unknown[];
    } | null;
    readonly outputSummary: GlbSourceOutputSummaryStatus | null;
    readonly imageDecode: {
      readonly decoded: readonly {
        readonly imageIndex: number;
        readonly sourceKind: string;
        readonly decodeMode?: string;
        readonly assetStates?: readonly string[];
        readonly textureHandleKey?: string;
        readonly registryStatusBeforeRegistration?: string;
        readonly registryStatusAfterRegistration?: string;
        readonly uri: string;
        readonly url: string;
        readonly mimeType: string;
        readonly width: number;
        readonly height: number;
        readonly byteLength: number;
      }[];
      readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: string;
        readonly message: string;
        readonly imageIndex?: number;
        readonly uri?: string;
        readonly url?: string;
      }[];
    };
    readonly diagnostics: readonly unknown[];
  };
  readonly gltf?: {
    readonly registration: {
      readonly valid: boolean;
      readonly diagnostics: number;
    };
    readonly primitiveMaterials: {
      readonly valid: boolean;
      readonly resolved: number;
      readonly diagnostics: number;
      readonly families: readonly MaterialFamilyStatus[];
      readonly resolutions: readonly PrimitiveMaterialResolutionStatus[];
    };
    readonly commandPlan: {
      readonly valid: boolean;
      readonly commands: number;
      readonly dependencies: number;
    };
    readonly replay: {
      readonly valid: boolean;
      readonly created: number;
      readonly diagnostics: number;
    };
    readonly metadata: {
      readonly status: string;
      readonly counts: {
        readonly scenes: number;
        readonly nodes: number;
        readonly meshes: number;
        readonly primitives: number;
        readonly materials: number;
        readonly animations: number;
      };
      readonly scene?: {
        readonly defaultSceneIndex: number | null;
        readonly scenes: readonly {
          readonly sceneIndex: number;
          readonly name: string | null;
          readonly selected: boolean;
          readonly rootNodeIndices: readonly number[];
        }[];
      };
      readonly extensions: {
        readonly used: readonly string[];
        readonly required: readonly string[];
      };
      readonly unsupportedFeatureDiagnostics: readonly {
        readonly code: string;
        readonly severity: string;
        readonly message: string;
        readonly count?: number;
        readonly skinCount?: number;
        readonly jointCount?: number;
        readonly inverseBindMatrixCount?: number;
        readonly targetCount?: number;
        readonly primitiveCount?: number;
        readonly meshIndex?: number;
        readonly primitiveIndex?: number;
        readonly mode?: number;
        readonly field?: string;
      }[];
    };
    readonly meshAttributes?: readonly GltfMeshAttributeStatus[];
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly shadowRequests: number;
    readonly diagnostics: number;
    readonly diagnosticsList?: readonly {
      readonly code: string;
      readonly severity: string;
      readonly message: string;
      readonly assetKey?: string;
      readonly materialKey?: string;
      readonly meshKey?: string;
      readonly textureKey?: string;
      readonly samplerKey?: string;
      readonly field?: string;
      readonly texCoord?: number;
    }[];
  };
  readonly ibl?: {
    readonly enabled: boolean;
    readonly controls: {
      readonly enabled: boolean;
      readonly available: boolean;
    };
    readonly ecs: {
      readonly environmentMapKey: string | null;
      readonly intensity: number | null;
      readonly environmentEntityCount: number;
    };
    readonly specularProof: boolean;
    readonly environmentMapKey: string | null;
    readonly resources: {
      readonly diffuseTexture: string | null;
      readonly specularTexture: string | null;
      readonly sampler: string | null;
    };
    readonly rendering: {
      readonly supported: boolean;
      readonly diffusePipelineKey: string | null;
      readonly specularPipelineKey: string | null;
      readonly pipelineKeys: readonly string[];
    };
  };
  readonly shadow?: {
    readonly enabled: boolean;
    readonly controls: {
      readonly receiverEnabled: boolean;
      readonly casterEnabled: boolean;
    };
    readonly ecs: {
      readonly casterEnabled: boolean | null;
      readonly receiverEnabled: boolean | null;
      readonly casterEntityCount: number;
      readonly receiverEntityCount: number;
      readonly enabledCasterEntityCount: number;
      readonly enabledReceiverEntityCount: number;
    };
    readonly authoring: {
      readonly drawCount: number;
      readonly casterCount: number;
      readonly receiverCount: number;
      readonly disabledCasterCount: number;
      readonly disabledReceiverCount: number;
    };
    readonly requests: readonly {
      readonly shadowId: string;
      readonly lightId: string;
      readonly casterLayerMask: number;
      readonly receiverLayerMask: number;
    }[];
    readonly casterDrawList: {
      readonly includedDrawCount: number;
      readonly skippedDrawCount: number;
    } | null;
    readonly commandBufferSubmission: {
      readonly status: string;
    } | null;
    readonly rendering: {
      readonly supported: boolean;
      readonly mode: string;
      readonly pipelineKey: string | null;
    };
  };
  readonly draw?: {
    readonly packages: number;
    readonly drawCalls: number;
  };
  readonly orbit?: {
    readonly yaw: number;
    readonly elevation: number;
    readonly distance: number;
    readonly target: readonly number[];
    readonly fit: {
      readonly status: string;
      readonly center: readonly number[];
      readonly size: readonly number[];
      readonly yaw: number;
      readonly elevation: number;
      readonly distance: number;
      readonly minDistance: number;
      readonly maxDistance: number;
    };
    readonly resetAvailable: boolean;
    readonly dragging: boolean;
  };
  readonly importedCamera?: {
    readonly status: string;
    readonly controls: {
      readonly available: boolean;
      readonly enabled: boolean;
      readonly readyCount: number;
      readonly selectedCameraIndex: number | null;
      readonly selectedNodeIndex: number | null;
    };
    readonly selected: null | {
      readonly status: string;
      readonly supported: boolean;
      readonly nodeIndex: number;
      readonly cameraIndex: number;
      readonly entityKey: string;
      readonly name: string | null;
      readonly nodeName: string | null;
      readonly cameraName: string | null;
      readonly projection: string;
      readonly yfov?: number;
      readonly xmag?: number;
      readonly ymag?: number;
      readonly aspect?: number;
      readonly orthographicHeight?: number;
      readonly near: number;
      readonly far: number;
      readonly translation: readonly number[];
      readonly rotation: readonly number[];
    };
    readonly cameras: readonly ImportedCameraDescriptorStatus[];
  };
  readonly importedLights?: {
    readonly status: string;
    readonly enabled: boolean;
    readonly declaredCount: number;
    readonly replayedCount: number;
    readonly extractedCount: number;
    readonly kinds: readonly {
      readonly kind: string;
      readonly count: number;
    }[];
    readonly lights: readonly ImportedLightDescriptorStatus[];
  };
  readonly lighting?: {
    readonly controls: {
      readonly ambientIntensity: number;
      readonly pointIntensity: number;
    };
    readonly ecs: {
      readonly ambientIntensity: number;
      readonly pointIntensity: number;
    };
    readonly extracted: {
      readonly ambientIntensity: number | null;
      readonly pointIntensity: number | null;
    };
  };
  readonly animation?: {
    readonly status: string;
    readonly clipCount: number;
    readonly clips: readonly {
      readonly index: number;
      readonly name: string;
      readonly duration: number;
    }[];
    readonly activeClipIndex: number;
    readonly activeClipName: string | null;
    readonly time: number;
    readonly speed: number;
    readonly direction: string;
    readonly loopMode: string;
    readonly clamped: boolean;
    readonly duration: number;
    readonly channelCount: number;
    readonly unsupportedChannelCount?: number;
    readonly unsupportedChannels?: readonly {
      readonly code: string;
      readonly animationIndex: number;
      readonly animationName: string | null;
      readonly channelIndex: number;
      readonly samplerIndex: number;
      readonly nodeIndex: number;
      readonly path: string;
      readonly interpolation: string;
      readonly message: string;
    }[];
    readonly animatedNodes: readonly {
      readonly nodeIndex: number;
      readonly entityKey: string;
      readonly path: string;
      readonly interpolation?: string;
      readonly value: readonly number[];
    }[];
  };
  readonly skinning?: {
    readonly status: string;
    readonly skinCount: number;
    readonly jointCount: number;
    readonly skinnedEntities: number;
    readonly animatedJointCount: number;
    readonly time: number;
    readonly entries?: readonly {
      readonly skinIndex: number;
      readonly nodeIndex: number;
      readonly meshIndex: number;
      readonly primitiveIndex: number;
      readonly entityKey: string;
      readonly jointNodeIndices: readonly number[];
    }[];
  };
  readonly morphing?: {
    readonly status: string;
    readonly targetCount: number;
    readonly supportedTargetCount: number;
    readonly morphedEntities: number;
    readonly weights: readonly number[];
    readonly targetNames: readonly string[];
    readonly entries?: readonly {
      readonly nodeIndex: number;
      readonly meshIndex: number;
      readonly primitiveIndex: number;
      readonly entityKey: string;
      readonly targetCount: number;
      readonly declaredTargetCount: number;
      readonly targetNames: readonly string[];
      readonly weights: readonly number[];
    }[];
  };
  readonly hierarchy?: {
    readonly nodes: readonly {
      readonly nodeIndex: number;
      readonly entityKey: string;
      readonly parentEntityKey: string;
      readonly localTranslation: readonly number[] | null;
      readonly worldTranslation: readonly number[] | null;
    }[];
  };
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly renderState?: {
    readonly queues: readonly string[];
    readonly pipelineKeys: readonly string[];
    readonly draws: readonly MeshDrawIdentityStatus[];
  };
  readonly report?: {
    readonly resourceReuse?: ResourceReuseStatus;
    readonly diagnosticsSummary?: RenderDiagnosticsSummaryStatus;
  };
}

interface ResourceReuseStatus {
  readonly meshBuffersCreated?: number;
  readonly meshBuffersReused?: number;
  readonly preparedMeshBuffersCreated?: number;
  readonly preparedMeshBuffersReused?: number;
  readonly preparedMeshFacade?: {
    readonly entries?: readonly unknown[];
  };
  readonly materialBuffersCreated?: number;
  readonly materialBuffersReused?: number;
  readonly preparedMaterialBuffersCreated?: number;
  readonly preparedMaterialBuffersReused?: number;
  readonly preparedMaterialBindGroupsCreated?: number;
  readonly preparedMaterialBindGroupsReused?: number;
  readonly preparedMaterialFacade?: {
    readonly entries?: readonly unknown[];
  };
  readonly textureResourcesCreated?: number;
  readonly textureResourcesReused?: number;
  readonly samplerResourcesCreated?: number;
  readonly samplerResourcesReused?: number;
  readonly bindGroupsCreated?: number;
  readonly bindGroupsReused?: number;
}

interface RenderDiagnosticsSummaryStatus {
  readonly materialQueue?: {
    readonly itemCount?: number;
    readonly byPhase?: readonly RenderDiagnosticBucket[];
    readonly byFamily?: readonly RenderDiagnosticBucket[];
  };
  readonly routedResourceSet?: {
    readonly itemCount?: number;
    readonly byFamily?: readonly RenderDiagnosticBucket[];
    readonly byPipeline?: readonly unknown[];
  };
  readonly directLighting?: {
    readonly ready?: boolean;
    readonly lightCounts?: {
      readonly direct?: number;
      readonly ambient?: number;
    };
    readonly sections?: {
      readonly lightGpuBuffers?: boolean;
      readonly lightBindGroup?: boolean;
    };
  };
  readonly builtInAppResourceAdapters?: {
    readonly valid?: boolean;
    readonly expectedFamilies?: readonly string[];
    readonly registeredFamilies?: readonly string[];
    readonly diagnostics?: readonly unknown[];
  };
}

interface RenderDiagnosticBucket {
  readonly phase?: string;
  readonly family?: string;
  readonly itemCount?: number;
}

interface MeshDrawIdentityStatus {
  readonly renderId: number;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly queue: string;
  readonly pipelineKey: string;
  readonly meshLayoutKey: string;
}

interface GltfMeshAttributeStatus {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly handleKey: string;
  readonly tangentPath: {
    readonly status: string;
    readonly path: string | null;
    readonly reason: string | null;
    readonly diagnosticCode: string | null;
  };
  readonly streams: readonly {
    readonly id: string;
    readonly arrayStride: number;
    readonly vertexCount: number;
    readonly attributes: readonly {
      readonly semantic: string;
      readonly format: string;
      readonly offset: number;
    }[];
  }[];
  readonly indexBuffer: {
    readonly format: string;
    readonly count: number;
  } | null;
}

interface GlbSourceOutputSummaryStatus {
  readonly meshConstruction: {
    readonly status: string;
    readonly meshCount: number;
    readonly submeshCount: number;
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly diagnosticsCount: number;
  };
  readonly sourceRegistration: {
    readonly status: string;
    readonly writtenCount: number;
    readonly skippedCount: number;
    readonly diagnosticsCount: number;
  };
  readonly ecsCommandPlan: {
    readonly status: string;
    readonly commandCount: number;
    readonly dependencyCount: number;
  };
  readonly ecsReplayReadiness: {
    readonly status: string;
    readonly expectedCreateEntityCount: number;
    readonly expectedAddComponentCount: number;
  };
}

interface ImportedCameraDescriptorStatus {
  readonly status: string;
  readonly supported: boolean;
  readonly nodeIndex: number;
  readonly cameraIndex: number;
  readonly entityKey: string;
  readonly name: string | null;
  readonly nodeName: string | null;
  readonly cameraName: string | null;
  readonly projection: string;
  readonly reason?: string;
  readonly yfov?: number;
  readonly xmag?: number;
  readonly ymag?: number;
  readonly aspect?: number;
  readonly orthographicHeight?: number;
  readonly near?: number;
  readonly far?: number;
  readonly translation?: readonly number[];
  readonly rotation?: readonly number[];
}

interface ImportedLightDescriptorStatus {
  readonly status: string;
  readonly supported: boolean;
  readonly nodeIndex: number;
  readonly lightIndex: number;
  readonly entityKey: string;
  readonly name: string | null;
  readonly nodeName: string | null;
  readonly lightName: string | null;
  readonly kind: string;
  readonly color?: readonly number[];
  readonly rawIntensity?: number;
  readonly intensity?: number;
  readonly range?: number;
  readonly extracted: boolean;
}

interface MaterialFamilyStatus {
  readonly family: string;
  readonly count: number;
}

interface MaterialSlotSummaryStatus {
  readonly materialCount: number;
  readonly registeredMaterialCount: number;
  readonly missingMaterialCount: number;
  readonly scalarOnlyMaterialCount: number;
  readonly textureSlots: {
    readonly baseColorTexture: TextureSlotSummaryStatus;
    readonly metallicRoughnessTexture: TextureSlotSummaryStatus;
    readonly normalTexture: TextureSlotSummaryStatus;
    readonly occlusionTexture: TextureSlotSummaryStatus;
    readonly emissiveTexture: TextureSlotSummaryStatus;
  };
  readonly alphaModes: {
    readonly opaque: number;
    readonly mask: number;
    readonly blend: number;
  };
  readonly uv1Usage: {
    readonly materials: number;
    readonly textureSlots: number;
  };
}

interface TextureSlotSummaryStatus {
  readonly count: number;
  readonly uv0: number;
  readonly uv1: number;
  readonly otherUv: number;
}

interface PrimitiveMaterialResolutionStatus {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number;
  readonly materialHandleKey: string;
  readonly family: string;
  readonly alphaMode: string | null;
  readonly alphaCutoff: number | null;
  readonly blendPreset: string | null;
  readonly depthWrite: boolean | null;
  readonly cullMode: string | null;
  readonly pipelineKey: string | null;
  readonly factors: {
    readonly baseColorFactor: readonly number[] | null;
    readonly metallicFactor: number | null;
    readonly roughnessFactor: number | null;
    readonly normalScale: number | null;
    readonly occlusionStrength: number | null;
    readonly emissiveFactor: readonly number[] | null;
  } | null;
  readonly textureSlots: {
    readonly baseColorTexture: TextureSlotStatus | null;
    readonly metallicRoughnessTexture: TextureSlotStatus | null;
    readonly normalTexture: TextureSlotStatus | null;
    readonly occlusionTexture: TextureSlotStatus | null;
    readonly emissiveTexture: TextureSlotStatus | null;
  } | null;
}

interface TextureSlotStatus {
  readonly textureKey: string;
  readonly samplerKey: string | null;
  readonly sampler: null | {
    readonly status: string;
    readonly addressModeU?: string;
    readonly addressModeV?: string;
    readonly addressModeW?: string;
    readonly magFilter?: string;
    readonly minFilter?: string;
    readonly mipmapFilter?: string;
    readonly maxAnisotropy?: number;
  };
  readonly texCoord: number;
  readonly hasTransform: boolean;
  readonly transform: null | {
    readonly offset: readonly number[] | null;
    readonly scale: readonly number[] | null;
    readonly rotation: number | null;
  };
}

test("Playwright renders the fetched sample GLB viewer asset", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html");

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "GLB viewer status should publish").toBeDefined();

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

  const rendered = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(rendered?.ok).toBe(true);
  expectStatusJsonSafeForGpu(rendered);
  await expect(page.locator("#glb-asset-select option")).toHaveText([
    "Mint cube",
    "Amber slab",
    "Sapphire pillar",
    "Lit brass cube",
    "Roughness IBL",
    "Normal map",
    "Normal map generated tangents",
    "Normal scale",
    "Normal transform",
    "Normal transform controls",
    "Textured standard",
    "Embedded texture",
    "URI PNG texture",
    "URI JPEG texture",
    "All-slot URI textures",
    "Imported light",
    "Animated cube",
    "Multi-clip cube",
    "Rotate/scale cube",
    "Step animation",
    "CUBICSPLINE animation",
    "Multi-scene",
    "External glTF",
    "Vertex color",
    "Textured vertex color",
    "Standard vertex color",
    "Imported camera",
    "Imported cameras",
    "Morph target",
    "Skinned character",
    "Orthographic camera",
    "Unsupported primitive",
    "Emissive standard",
    "Occlusion emissive",
    "Emissive transform",
    "Emissive transform controls",
    "Occlusion transform",
    "Occlusion transform controls",
    "Normal occlusion controls",
    "Alpha mask",
    "Alpha mask emissive controls",
    "Alpha blend texture",
    "Sampler state",
    "Sampler wrap controls",
    "Texture transform",
    "Missing UV1",
    "UV1 base color",
    "UV1 image decode controls",
    "Metallic roughness UV1",
    "Rotated MR transform",
    "MR transform controls",
    "Dual primitive",
    "Mixed alpha",
    "Hierarchy cube",
  ]);
  expect(rendered).toMatchObject({
    example: "glb-viewer",
    phase: "render",
    renderingBackend: "webgpu-explicit",
    selectedAsset: {
      id: "cube",
      label: "Mint cube",
      source: "sample",
      url: "/examples/assets/cube.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    source: {
      ok: true,
      byteLength: expect.any(Number),
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      diagnostics: [],
    },
    gltf: {
      registration: { valid: true, diagnostics: 0 },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
        families: [{ family: "unlit", count: 1 }],
      },
      commandPlan: { valid: true, dependencies: 2 },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
    orbit: {
      yaw: 0,
      elevation: expect.any(Number),
      distance: expect.any(Number),
      target: expect.any(Array),
      fit: {
        status: "ready",
        center: expect.any(Array),
        size: expect.any(Array),
        yaw: 0,
        elevation: expect.any(Number),
        distance: expect.any(Number),
        minDistance: expect.any(Number),
        maxDistance: expect.any(Number),
      },
      resetAvailable: true,
      dragging: false,
    },
    lighting: {
      controls: {
        ambientIntensity: 0.24,
        pointIntensity: 18,
      },
      ecs: {
        ambientIntensity: 0.24,
        pointIntensity: 18,
      },
      extracted: {
        ambientIntensity: 0.24,
        pointIntensity: 18,
      },
    },
  });
  const initialOrbit = expectReadyOrbitFit(rendered, "default sample");
  expectNoStaleGlbViewerAssets(rendered, "default sample");

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    rendered?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(rendered.clearColor);
  const center = strongestSample(screenshot, clear);

  expect(
    pixelDistance(center, clear),
    `GLB viewer canvas should contain non-clear pixels; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(strongestNearCenterSample(screenshot, clear), clear),
    "fit camera should keep the default GLB visibly framed near the center",
  ).toBeGreaterThan(20);

  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(880, 360, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      Math.abs(
        (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly orbit?: {
                readonly yaw?: number;
                readonly dragging?: boolean;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__?.orbit?.yaw ?? 0,
      ) > 0.2 &&
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly orbit?: { readonly dragging?: boolean };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.orbit?.dragging ?? true) === false,
  );
  const rotatedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const rotatedScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(rotatedStatus?.orbit?.dragging).toBe(false);
  expect(rotatedStatus?.orbit?.yaw ?? 0).toBeLessThan(-0.2);
  expect(
    maxSampleDelta(screenshot, rotatedScreenshot),
    "dragging the GLB viewer should orbit the camera and change canvas pixels",
  ).toBeGreaterThan(12);

  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 500);
  await page.waitForFunction(
    (initialDistance) => {
      const distance = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly orbit?: { readonly distance?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.orbit?.distance;

      return (
        typeof distance === "number" &&
        Math.abs(distance - initialDistance) > 0.5
      );
    },
    initialOrbit.fit.distance,
    { timeout: 3000 },
  );
  const movedStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    Math.abs((movedStatus?.orbit?.distance ?? 0) - initialOrbit.fit.distance),
    "wheel zoom should move the camera away from the fitted distance",
  ).toBeGreaterThan(0.5);

  await page.locator("#glb-camera-reset").click();
  await page.waitForFunction(
    ({ yaw, distance }) => {
      const orbit = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly orbit?: {
              readonly yaw?: number;
              readonly distance?: number;
              readonly dragging?: boolean;
              readonly resetAvailable?: boolean;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.orbit;

      return (
        orbit?.resetAvailable === true &&
        orbit.dragging === false &&
        typeof orbit.yaw === "number" &&
        typeof orbit.distance === "number" &&
        Math.abs(orbit.yaw - yaw) < 0.02 &&
        Math.abs(orbit.distance - distance) < 0.01
      );
    },
    { yaw: initialOrbit.fit.yaw, distance: initialOrbit.fit.distance },
    { timeout: 3000 },
  );
  const resetStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const resetScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(resetStatus?.orbit).toMatchObject({
    yaw: initialOrbit.fit.yaw,
    elevation: initialOrbit.fit.elevation,
    distance: initialOrbit.fit.distance,
    target: initialOrbit.fit.center,
    resetAvailable: true,
    dragging: false,
  });
  expect(
    maxSampleDelta(screenshot, resetScreenshot),
    "camera reset should return the GLB viewer near the fitted pixels",
  ).toBeLessThan(10);

  await page.locator("#glb-asset-select").selectOption("slab");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "slab" &&
        status.selectedAsset.loading === false &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const slabStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const slabScreenshot = await page.locator("#aperture-canvas").screenshot();
  const slabOrbit = expectReadyOrbitFit(slabStatus, "slab sample");
  expectNoStaleGlbViewerAssets(slabStatus, "slab sample");

  expect(slabStatus).toMatchObject({
    selectedAsset: {
      id: "slab",
      label: "Amber slab",
      source: "sample",
      url: "/examples/assets/amber-slab.glb",
      loading: false,
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      diagnostics: [],
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    maxSampleDelta(rotatedScreenshot, slabScreenshot),
    "switching GLB assets should unload the prior scene and render different pixels",
  ).toBeGreaterThan(16);
  expect(slabOrbit.fit.size).not.toEqual(initialOrbit.fit.size);
  expect(
    pixelDistance(strongestNearCenterSample(slabScreenshot, clear), clear),
    "fit camera should keep the slab GLB visibly framed near the center",
  ).toBeGreaterThan(20);

  await page.locator("#glb-asset-select").selectOption("brass");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly decodeMode?: string;
                  readonly assetStates?: readonly string[];
                }[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly ibl?: {
              readonly rendering?: { readonly supported?: boolean };
            };
            readonly shadow?: {
              readonly rendering?: { readonly supported?: boolean };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "brass" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.extraction?.meshDraws === 2 &&
        status.ibl?.rendering?.supported === true &&
        status.shadow?.rendering?.supported === true &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard",
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const brassStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const brassScreenshot = await page.locator("#aperture-canvas").screenshot();
  const brassOrbit = expectReadyOrbitFit(brassStatus, "lit brass sample");
  expectNoStaleGlbViewerAssets(brassStatus, "lit brass sample");

  expect(brassStatus).toMatchObject({
    selectedAsset: {
      id: "brass",
      label: "Lit brass cube",
      source: "sample",
      url: "/examples/assets/lit-brass-cube.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      diagnostics: [],
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
        families: [{ family: "standard", count: 1 }],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 3,
      environments: 1,
      shadowRequests: 1,
      diagnostics: 0,
    },
    ibl: {
      enabled: true,
      specularProof: true,
      environmentMapKey: "environment-map:glb-viewer-studio",
      resources: {
        diffuseTexture: "texture:glb-viewer-studio:diffuse:texture",
        specularTexture: "texture:glb-viewer-studio:specular-proof:texture",
        sampler: "texture:glb-viewer-studio:diffuse:sampler",
      },
      rendering: {
        supported: true,
        diffusePipelineKey: expect.stringContaining("iblDiffuse"),
        specularPipelineKey: expect.stringContaining("iblSpecularProof"),
      },
    },
    shadow: {
      enabled: true,
      controls: {
        receiverEnabled: true,
        casterEnabled: true,
      },
      authoring: {
        drawCount: 2,
        casterCount: 1,
        receiverCount: 1,
        disabledCasterCount: 1,
        disabledReceiverCount: 1,
      },
      casterDrawList: {
        includedDrawCount: 1,
        skippedDrawCount: 1,
      },
      commandBufferSubmission: {
        status: "submitted",
      },
      rendering: {
        supported: true,
        mode: "directional-depth-compare",
        pipelineKey:
          "standard|iblDiffuse|iblSpecularProof|shadowMap|opaque|back|less|none",
      },
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(brassOrbit.fit.size).not.toEqual(slabOrbit.fit.size);
  expect(
    pixelDistance(strongestNearCenterSample(brassScreenshot, clear), clear),
    "lit StandardMaterial GLB should be visibly framed near the center",
  ).toBeGreaterThan(20);
  expect(
    routedPipelineKeys(brassStatus),
    "lit GLB sample should route through the StandardMaterial app path",
  ).toEqual(
    expect.arrayContaining([
      "standard|iblDiffuse|iblSpecularProof|opaque|back|less|none",
      "standard|iblDiffuse|iblSpecularProof|shadowMap|opaque|back|less|none",
    ]),
  );
  expect(
    maxSampleDelta(slabScreenshot, brassScreenshot),
    "lit StandardMaterial sample should render differently from the unlit slab",
  ).toBeGreaterThan(16);

  await page.locator("#glb-asset-select").selectOption("animated");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly status?: string;
              readonly animatedNodes?: readonly {
                readonly value?: readonly number[];
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "animated" &&
        status.selectedAsset.loading === false &&
        status.animation?.status === "playing" &&
        status.animation.animatedNodes?.[0]?.value?.length === 3 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const animatedStartStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const animatedStartScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const animatedStartX =
    animatedStartStatus?.animation?.animatedNodes[0]?.value[0] ?? 0;
  expectNoStaleGlbViewerAssets(animatedStartStatus, "animated sample");

  expect(animatedStartStatus).toMatchObject({
    selectedAsset: {
      id: "animated",
      label: "Animated cube",
      source: "sample",
      url: "/examples/assets/animated-cube.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    animation: {
      status: "playing",
      clipCount: 1,
      activeClipName: "SlideX",
      duration: 4,
      channelCount: 1,
      animatedNodes: [
        {
          nodeIndex: 0,
          entityKey: expect.stringMatching(/^viewer-animated-\d+:node:0$/),
          path: "translation",
          value: expect.any(Array),
        },
      ],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 1,
        },
        extensions: {
          used: ["KHR_materials_unlit"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
  });

  await page.waitForFunction(
    (initialX) => {
      const value = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly animation?: {
              readonly animatedNodes?: readonly {
                readonly value?: readonly number[];
              }[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.animation?.animatedNodes?.[0]?.value?.[0];

      return typeof value === "number" && Math.abs(value - initialX) > 0.2;
    },
    animatedStartX,
    { timeout: 3000 },
  );
  const animatedLaterStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const animatedLaterScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(
    Math.abs(
      (animatedLaterStatus?.animation?.animatedNodes[0]?.value[0] ?? 0) -
        animatedStartX,
    ),
    "animated GLB status should show transform movement over time",
  ).toBeGreaterThan(0.2);
  expect(
    maxSampleDelta(animatedStartScreenshot, animatedLaterScreenshot),
    "animated GLB playback should change rendered pixels over time",
  ).toBeGreaterThan(8);

  await page.locator("#glb-asset-select").selectOption("dual");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: { readonly resolved?: number };
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "dual" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const dualStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const dualScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(dualStatus).toMatchObject({
    selectedAsset: {
      id: "dual",
      label: "Dual primitive",
      source: "sample",
      url: "/examples/assets/dual-primitive.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: ["KHR_materials_unlit"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "unlit", count: 2 }],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(strongestNearCenterSample(dualScreenshot, clear), clear),
    "multi-primitive GLB should remain visibly framed near the center",
  ).toBeGreaterThan(20);
  expect(
    visibleSampleColorSpread(dualScreenshot, clear),
    "multi-primitive GLB should expose two visibly distinct material regions",
  ).toBeGreaterThan(30);

  await page.locator("#glb-asset-select").selectOption("mixed-alpha");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: { readonly resolved?: number };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "mixed-alpha" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|blend|back|less|alpha",
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const mixedAlphaStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const mixedAlphaScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const opaqueSample = strongestRegionSample(
    mixedAlphaScreenshot,
    clear,
    0.3,
    0.34,
    0.5,
    0.66,
  );
  const transparentSample = strongestRegionSample(
    mixedAlphaScreenshot,
    clear,
    0.5,
    0.34,
    0.7,
    0.66,
  );

  expect(mixedAlphaStatus).toMatchObject({
    selectedAsset: {
      id: "mixed-alpha",
      label: "Mixed alpha",
      source: "sample",
      url: "/examples/assets/mixed-alpha.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: [],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            blendPreset: "none",
            depthWrite: true,
            cullMode: "back",
            pipelineKey: "standard|opaque|back|less|none",
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "blend",
            blendPreset: "alpha",
            depthWrite: false,
            cullMode: "back",
            pipelineKey: "standard|blend|back|less|alpha",
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      queues: expect.arrayContaining(["opaque", "transparent"]),
      pipelineKeys: expect.arrayContaining([
        "standard|opaque|back|less|none",
        "standard|blend|back|less|alpha",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(opaqueSample, clear),
    `mixed alpha GLB opaque primitive should produce visible pixels; sample=${JSON.stringify(
      opaqueSample,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transparentSample, clear),
    `mixed alpha GLB transparent primitive should produce visible pixels; sample=${JSON.stringify(
      transparentSample,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    visibleSampleColorSpread(mixedAlphaScreenshot, clear),
    "mixed alpha GLB primitives should keep distinct material colors",
  ).toBeGreaterThan(24);

  await page.locator("#glb-asset-select").selectOption("hierarchy");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly hierarchy?: { readonly nodes?: readonly unknown[] };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "hierarchy" &&
        status.selectedAsset.loading === false &&
        status.hierarchy?.nodes?.length === 2 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const hierarchyStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const hierarchyScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(hierarchyStatus).toMatchObject({
    selectedAsset: {
      id: "hierarchy",
      label: "Hierarchy cube",
      source: "sample",
      url: "/examples/assets/hierarchy-cube.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 2,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
        extensions: {
          used: ["KHR_materials_unlit"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
    },
    hierarchy: {
      nodes: [
        {
          nodeIndex: 0,
          entityKey: expect.stringMatching(/^viewer-hierarchy-\d+:node:0$/),
          parentEntityKey: expect.stringMatching(
            /^viewer-hierarchy-\d+:scene:0$/,
          ),
          localTranslation: [0.6, 0, 0],
          worldTranslation: [0.6, 0, 0],
        },
        {
          nodeIndex: 1,
          entityKey: expect.stringMatching(/^viewer-hierarchy-\d+:node:1$/),
          parentEntityKey: expect.stringMatching(
            /^viewer-hierarchy-\d+:node:0$/,
          ),
          localTranslation: [0, 0.7, 0],
          worldTranslation: [0.6, 0.7, 0],
        },
      ],
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(strongestNearCenterSample(hierarchyScreenshot, clear), clear),
    "hierarchy GLB should remain visibly framed near the center",
  ).toBeGreaterThan(20);
  expect(
    maxSampleDelta(dualScreenshot, hierarchyScreenshot),
    "hierarchy GLB should render differently from the multi-primitive sample",
  ).toBeGreaterThan(16);

  await page
    .locator("#glb-url-input")
    .fill(new URL("/examples/assets/sapphire-pillar.glb", page.url()).href);
  await page.locator("#glb-url-form button").click();
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: { readonly ok?: boolean };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "custom-url" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const customStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const customScreenshot = await page.locator("#aperture-canvas").screenshot();
  const customOrbit = expectReadyOrbitFit(customStatus, "custom GLB");

  expect(customStatus).toMatchObject({
    selectedAsset: {
      id: "custom-url",
      label: "Custom URL",
      source: "custom",
      url: "/examples/assets/sapphire-pillar.glb",
      loading: false,
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      diagnostics: [],
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    maxSampleDelta(brassScreenshot, customScreenshot),
    "loading a custom GLB URL should replace the selected sample and change rendered pixels",
  ).toBeGreaterThan(16);
  expect(customOrbit.fit.size).not.toEqual(brassOrbit.fit.size);
  expect(
    pixelDistance(strongestNearCenterSample(customScreenshot, clear), clear),
    "fit camera should keep the custom GLB visibly framed near the center",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright pauses and scrubs GLB viewer animation controls", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.locator("#glb-asset-select").selectOption("animated");
  const playingStatus = await waitForAnimationControlStatus(page, {
    status: "playing",
  });

  await page.locator("#glb-animation-toggle").click();
  const pausedStatus = await waitForAnimationControlStatus(page, {
    status: "paused",
  });
  const pausedScreenshot = await page.locator("#aperture-canvas").screenshot();
  const pausedTime = pausedStatus.animation?.time ?? 0;
  const pausedX =
    pausedStatus.animation?.animatedNodes[0]?.value[0] ?? Number.NaN;
  const pausedFrame = pausedStatus.frame;

  await page.waitForFunction(
    ({ frame, time, x }) => {
      const animation = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly animation?: {
              readonly status?: string;
              readonly time?: number;
              readonly animatedNodes?: readonly {
                readonly value?: readonly number[];
              }[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.animation;
      const nextFrame = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame;
      const nextX = animation?.animatedNodes?.[0]?.value?.[0];

      return (
        (nextFrame ?? 0) >= frame + 8 &&
        animation?.status === "paused" &&
        Math.abs((animation.time ?? Number.NaN) - time) < 0.001 &&
        Math.abs((nextX ?? Number.NaN) - x) < 0.001
      );
    },
    { frame: pausedFrame, time: pausedTime, x: pausedX },
    { timeout: 3000 },
  );
  const pausedLaterStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const pausedLaterScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  if (pausedLaterStatus === undefined) {
    throw new Error("Paused animation status did not publish.");
  }

  expect(pausedLaterStatus.animation).toMatchObject({
    status: "paused",
    time: pausedTime,
  });
  expect(
    maxSampleDelta(pausedScreenshot, pausedLaterScreenshot),
    "paused animation should keep rendered pixels stable",
  ).toBeLessThan(3);

  const scrubTime = pausedTime < 2 ? 3.2 : 0.4;
  await setRangeInputValue(page, "#glb-animation-scrub", scrubTime);
  const scrubbedStatus = await waitForAnimationControlStatus(page, {
    status: "paused",
    time: scrubTime,
  });
  const scrubbedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const scrubbedX =
    scrubbedStatus.animation?.animatedNodes[0]?.value[0] ?? Number.NaN;

  expect(
    Math.abs(scrubbedX - pausedX),
    "scrubbing should write a different ECS LocalTransform translation",
  ).toBeGreaterThan(0.2);
  expect(
    maxSampleDelta(pausedScreenshot, scrubbedScreenshot),
    "scrubbing animation time should visibly change rendered pixels",
  ).toBeGreaterThan(8);

  await page.locator("#glb-animation-toggle").click();
  const resumedStatus = await waitForAnimationControlStatus(page, {
    status: "playing",
    timeNot: scrubTime,
  });

  expect(resumedStatus.animation?.status).toBe("playing");
  expect(
    Math.abs((resumedStatus.animation?.time ?? 0) - scrubTime),
    "play should resume time advancement from the scrubbed position",
  ).toBeGreaterThan(0.1);
  expect(playingStatus.animation?.activeClipName).toBe("SlideX");
  webGpuValidation.expectNoWarnings();
});

test("Playwright changes GLB viewer animation playback speed", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.locator("#glb-asset-select").selectOption("animated");
  await waitForAnimationControlStatus(page, {
    status: "playing",
    speed: 1,
  });

  await page.locator("#glb-animation-toggle").click();
  await waitForAnimationControlStatus(page, { status: "paused", speed: 1 });
  await setRangeInputValue(page, "#glb-animation-scrub", 0.5);
  await waitForAnimationControlStatus(page, {
    status: "paused",
    speed: 1,
    time: 0.5,
  });
  await setRangeInputValue(page, "#glb-animation-speed", 0);
  await waitForAnimationControlStatus(page, {
    status: "paused",
    speed: 0,
    time: 0.5,
  });
  await page.locator("#glb-animation-toggle").click();

  const frozenStatus = await waitForAnimationControlStatus(page, {
    status: "playing",
    speed: 0,
    time: 0.5,
  });
  const frozenScreenshot = await page.locator("#aperture-canvas").screenshot();
  const frozenFrame = frozenStatus.frame;
  const frozenX =
    frozenStatus.animation?.animatedNodes[0]?.value[0] ?? Number.NaN;

  await page.waitForFunction(
    ({ frame, time, x }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly animation?: {
              readonly status?: string;
              readonly time?: number;
              readonly speed?: number;
              readonly animatedNodes?: readonly {
                readonly value?: readonly number[];
              }[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const animation = status?.animation;
      const nextX = animation?.animatedNodes?.[0]?.value?.[0];

      return (
        (status?.frame ?? 0) >= frame + 8 &&
        animation?.status === "playing" &&
        animation.speed === 0 &&
        Math.abs((animation.time ?? Number.NaN) - time) < 0.001 &&
        Math.abs((nextX ?? Number.NaN) - x) < 0.001
      );
    },
    { frame: frozenFrame, time: 0.5, x: frozenX },
    { timeout: 3000 },
  );

  const frozenLaterStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const frozenLaterScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(frozenLaterStatus?.animation).toMatchObject({
    status: "playing",
    speed: 0,
    time: 0.5,
  });
  expect(
    maxSampleDelta(frozenScreenshot, frozenLaterScreenshot),
    "speed 0 should freeze rendered animation pixels",
  ).toBeLessThan(3);

  await setRangeInputValue(page, "#glb-animation-speed", 1);
  const defaultStart = await waitForAnimationControlStatus(page, {
    status: "playing",
    speed: 1,
  });
  await waitForAnimationFrameAdvance(page, defaultStart.frame + 12);
  const defaultEnd = await waitForExampleStatus<GlbViewerStatus>(page);
  const defaultDelta = animationTimeDelta(defaultStart, defaultEnd);

  await setRangeInputValue(page, "#glb-animation-speed", 2);
  const fastStart = await waitForAnimationControlStatus(page, {
    status: "playing",
    speed: 2,
  });
  await waitForAnimationFrameAdvance(page, fastStart.frame + 12);
  const fastEnd = await waitForExampleStatus<GlbViewerStatus>(page);
  const fastDelta = animationTimeDelta(fastStart, fastEnd);

  expect(
    defaultDelta,
    "default playback should advance after unfreezing speed",
  ).toBeGreaterThan(0.05);
  expect(
    fastDelta,
    `speed 2 should advance faster than speed 1; default=${defaultDelta} fast=${fastDelta}`,
  ).toBeGreaterThan(defaultDelta * 1.5);
  webGpuValidation.expectNoWarnings();
});

test("Playwright switches GLB viewer animation clips", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=multi-clip");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly clipCount?: number;
              readonly activeClipName?: string | null;
              readonly activeClipIndex?: number;
              readonly animatedNodes?: readonly {
                readonly value?: readonly number[];
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "multi-clip" &&
        status.selectedAsset.loading === false &&
        status.animation?.clipCount === 2 &&
        status.animation.activeClipName === "SlideX" &&
        status.animation.activeClipIndex === 0 &&
        status.animation.animatedNodes?.[0]?.value?.length === 3 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const slideStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const slideScreenshot = await page.locator("#aperture-canvas").screenshot();

  expectStatusJsonSafeForGpu(slideStatus);
  expect(slideStatus).toMatchObject({
    selectedAsset: {
      id: "multi-clip",
      label: "Multi-clip cube",
      source: "sample",
      url: "/examples/assets/multi-clip.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    animation: {
      status: "playing",
      clipCount: 2,
      activeClipIndex: 0,
      activeClipName: "SlideX",
      clips: [
        { index: 0, name: "SlideX", duration: 4 },
        { index: 1, name: "RiseY", duration: 4 },
      ],
      duration: 4,
      channelCount: 1,
    },
    gltf: {
      metadata: {
        counts: {
          animations: 2,
        },
      },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
  });

  await page.locator("#glb-animation-clip").evaluate((node) => {
    const select = node as HTMLSelectElement;

    select.value = "1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(
    () => {
      const animation = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly animation?: {
              readonly activeClipName?: string | null;
              readonly activeClipIndex?: number;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.animation;

      return (
        animation?.activeClipName === "RiseY" && animation.activeClipIndex === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const riseStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const riseScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(riseStatus?.animation).toMatchObject({
    status: "playing",
    clipCount: 2,
    activeClipIndex: 1,
    activeClipName: "RiseY",
  });
  expect(
    maxSampleDelta(slideScreenshot, riseScreenshot),
    "switching animation clips should visibly change the replayed GLB transform",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright applies GLB viewer rotation and scale animation channels", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=rotation-scale");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly activeClipName?: string | null;
              readonly channelCount?: number;
              readonly animatedNodes?: readonly {
                readonly path?: string;
                readonly value?: readonly number[];
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const nodes = status?.animation?.animatedNodes ?? [];
      const rotation = nodes.find((entry) => entry.path === "rotation")?.value;
      const scale = nodes.find((entry) => entry.path === "scale")?.value;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "rotation-scale" &&
        status.selectedAsset.loading === false &&
        status.animation?.activeClipName === "SpinAndPulse" &&
        status.animation.channelCount === 2 &&
        rotation?.length === 4 &&
        scale?.length === 3 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const startStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const startScreenshot = await page.locator("#aperture-canvas").screenshot();
  const startRotation = animatedChannelValue(startStatus, "rotation");
  const startScale = animatedChannelValue(startStatus, "scale");
  const startRotationY = tupleComponent(startRotation, 1, "rotation.y");
  const startScaleX = tupleComponent(startScale, 0, "scale.x");

  expectStatusJsonSafeForGpu(startStatus);
  expect(startStatus).toMatchObject({
    selectedAsset: {
      id: "rotation-scale",
      label: "Rotate/scale cube",
      source: "sample",
      url: "/examples/assets/rotation-scale.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    animation: {
      status: "playing",
      clipCount: 1,
      activeClipIndex: 0,
      activeClipName: "SpinAndPulse",
      duration: 4,
      channelCount: 2,
      animatedNodes: expect.arrayContaining([
        expect.objectContaining({
          nodeIndex: 0,
          entityKey: expect.stringMatching(
            /^viewer-rotation-scale-\d+:node:0$/,
          ),
          path: "rotation",
          value: expect.any(Array),
        }),
        expect.objectContaining({
          nodeIndex: 0,
          entityKey: expect.stringMatching(
            /^viewer-rotation-scale-\d+:node:0$/,
          ),
          path: "scale",
          value: expect.any(Array),
        }),
      ]),
    },
    gltf: {
      metadata: {
        counts: {
          animations: 1,
        },
      },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
  });
  expect(startRotation.length).toBe(4);
  expect(startScale.length).toBe(3);

  await page.waitForFunction(
    ({ rotationY, scaleX }) => {
      if (typeof rotationY !== "number" || typeof scaleX !== "number") {
        return false;
      }

      const nodes =
        (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly animation?: {
                readonly animatedNodes?: readonly {
                  readonly path?: string;
                  readonly value?: readonly number[];
                }[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__?.animation?.animatedNodes ?? [];
      const rotation = nodes.find((entry) => entry.path === "rotation")?.value;
      const scale = nodes.find((entry) => entry.path === "scale")?.value;

      return (
        typeof rotation?.[1] === "number" &&
        typeof scale?.[0] === "number" &&
        Math.abs(rotation[1] - rotationY) > 0.08 &&
        Math.abs(scale[0] - scaleX) > 0.12
      );
    },
    {
      rotationY: startRotationY,
      scaleX: startScaleX,
    },
    { timeout: 3000 },
  );
  const laterStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const laterScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(
    Math.abs(
      animationChannelComponent(laterStatus, "rotation", 1) - startRotationY,
    ),
    "rotation channel status should change over time",
  ).toBeGreaterThan(0.08);
  expect(
    Math.abs(animationChannelComponent(laterStatus, "scale", 0) - startScaleX),
    "scale channel status should change over time",
  ).toBeGreaterThan(0.12);
  expect(
    maxSampleDelta(startScreenshot, laterScreenshot),
    "rotation/scale animation should visibly change rendered pixels",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright holds and steps GLB viewer STEP animation channels", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=step-animation");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly activeClipName?: string | null;
              readonly channelCount?: number;
              readonly animatedNodes?: readonly {
                readonly path?: string;
                readonly interpolation?: string;
                readonly value?: readonly number[];
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const scale = status?.animation?.animatedNodes?.find(
        (entry) => entry.path === "scale",
      );

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "step-animation" &&
        status.selectedAsset.loading === false &&
        status.animation?.activeClipName === "SteppedScale" &&
        status.animation.channelCount === 1 &&
        scale?.interpolation === "STEP" &&
        scale.value?.length === 3 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const loadedStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expectStatusJsonSafeForGpu(loadedStatus);
  expect(loadedStatus).toMatchObject({
    selectedAsset: {
      id: "step-animation",
      label: "Step animation",
      source: "sample",
      url: "/examples/assets/step-animation.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    animation: {
      status: "playing",
      clipCount: 1,
      activeClipIndex: 0,
      activeClipName: "SteppedScale",
      duration: 2,
      channelCount: 1,
      animatedNodes: [
        {
          nodeIndex: 0,
          entityKey: expect.stringMatching(
            /^viewer-step-animation-\d+:node:0$/,
          ),
          path: "scale",
          interpolation: "STEP",
          value: expect.any(Array),
        },
      ],
    },
    gltf: {
      metadata: {
        counts: {
          animations: 1,
        },
      },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
  });

  await page.locator("#glb-animation-toggle").click();
  await waitForStepAnimationStatus(page, { status: "paused" });
  await setRangeInputValue(page, "#glb-animation-scrub", 0.5);
  const beforeStepStatus = await waitForStepAnimationStatus(page, {
    status: "paused",
    time: 0.5,
  });
  const beforeStepScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  await setRangeInputValue(page, "#glb-animation-scrub", 0.9);
  const heldStatus = await waitForStepAnimationStatus(page, {
    status: "paused",
    time: 0.9,
  });
  const heldScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(animationChannelComponent(beforeStepStatus, "scale", 0)).toBeCloseTo(
    0.62,
    2,
  );
  expect(animationChannelComponent(heldStatus, "scale", 0)).toBeCloseTo(
    0.62,
    2,
  );
  expect(
    maxSampleDelta(beforeStepScreenshot, heldScreenshot),
    "STEP interpolation should hold rendered pixels before the next keyframe",
  ).toBeLessThan(4);

  await setRangeInputValue(page, "#glb-animation-scrub", 1.1);
  const steppedStatus = await waitForStepAnimationStatus(page, {
    status: "paused",
    time: 1.1,
  });
  const steppedScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(animationChannelComponent(steppedStatus, "scale", 0)).toBeCloseTo(
    1.42,
    2,
  );
  expect(
    maxSampleDelta(heldScreenshot, steppedScreenshot),
    "STEP interpolation should visibly change rendered pixels after the keyframe",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports unsupported CUBICSPLINE animation while rendering the base GLB mesh", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=cubic-spline");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly status?: string;
              readonly unsupportedChannelCount?: number;
              readonly unsupportedChannels?: readonly {
                readonly code?: string;
                readonly interpolation?: string;
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cubic-spline" &&
        status.selectedAsset.loading === false &&
        status.animation?.status === "absent" &&
        status.animation.unsupportedChannelCount === 1 &&
        status.animation.unsupportedChannels?.some(
          (channel) =>
            channel.code === "gltfAnimation.unsupportedInterpolation" &&
            channel.interpolation === "CUBICSPLINE",
        ) === true &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);
  const clear =
    status?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const visible = strongestRegionSample(
    screenshot,
    clear,
    0.35,
    0.34,
    0.65,
    0.7,
  );

  expect(status).toMatchObject({
    selectedAsset: {
      id: "cubic-spline",
      label: "CUBICSPLINE animation",
      source: "sample",
      url: "/examples/assets/cubic-spline.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    animation: {
      status: "absent",
      clipCount: 0,
      activeClipName: null,
      channelCount: 0,
      unsupportedChannelCount: 1,
      unsupportedChannels: [
        {
          code: "gltfAnimation.unsupportedInterpolation",
          animationIndex: 0,
          animationName: "CubicTranslation",
          channelIndex: 0,
          samplerIndex: 0,
          nodeIndex: 0,
          path: "translation",
          interpolation: "CUBICSPLINE",
        },
      ],
    },
    gltf: {
      metadata: {
        counts: {
          animations: 1,
        },
        unsupportedFeatureDiagnostics: [],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(visible, clear),
    `CUBICSPLINE unsupported sample should still render its base mesh; sample=${JSON.stringify(
      visible,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports multi-scene GLB metadata while rendering the default scene", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=multi-scene");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly scene?: {
                  readonly defaultSceneIndex?: number | null;
                  readonly scenes?: readonly {
                    readonly selected?: boolean;
                    readonly rootNodeIndices?: readonly number[];
                  }[];
                };
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "multi-scene" &&
        status.selectedAsset.loading === false &&
        status.gltf?.metadata?.scene?.defaultSceneIndex === 1 &&
        status.gltf.metadata.scene.scenes?.[1]?.selected === true &&
        status.gltf.metadata.scene.scenes[1]?.rootNodeIndices?.[0] === 1 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);
  const clear =
    status?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const visible = strongestRegionSample(
    screenshot,
    clear,
    0.36,
    0.32,
    0.64,
    0.7,
  );

  expect(status).toMatchObject({
    selectedAsset: {
      id: "multi-scene",
      label: "Multi-scene",
      source: "sample",
      url: "/examples/assets/multi-scene.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 2 }],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 2,
          nodes: 2,
          meshes: 2,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        scene: {
          defaultSceneIndex: 1,
          scenes: [
            {
              sceneIndex: 0,
              name: "Hidden red scene",
              selected: false,
              rootNodeIndices: [0],
            },
            {
              sceneIndex: 1,
              name: "Default green scene",
              selected: true,
              rootNodeIndices: [1],
            },
          ],
        },
        unsupportedFeatureDiagnostics: [],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(visible, clear),
    `multi-scene sample should render the default scene mesh; sample=${JSON.stringify(
      visible,
    )}`,
  ).toBeGreaterThan(20);
  expect(visible.g).toBeGreaterThan(visible.r);
  webGpuValidation.expectNoWarnings();
});

test("Playwright switches GLB viewer selected scenes through ECS replay", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const sceneSelectRow = page.locator("#glb-scene-select-row");
  const sceneSelect = page.locator("#glb-scene-select");

  await page.goto("/examples/glb-viewer.html?asset=multi-scene");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly scene?: {
                  readonly scenes?: readonly {
                    readonly sceneIndex?: number;
                    readonly selected?: boolean;
                    readonly rootNodeIndices?: readonly number[];
                  }[];
                };
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const selected = status?.gltf?.metadata?.scene?.scenes?.find(
        (scene) => scene.selected,
      );

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "multi-scene" &&
        status.selectedAsset.loading === false &&
        selected?.sceneIndex === 1 &&
        selected.rootNodeIndices?.[0] === 1 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(sceneSelectRow).toBeVisible();
  await expect(sceneSelect).toHaveValue("1");

  const defaultStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const defaultScreenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    defaultStatus?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(defaultStatus.clearColor);
  const defaultVisible = strongestRegionSample(
    defaultScreenshot,
    clear,
    0.36,
    0.32,
    0.64,
    0.7,
  );

  await sceneSelect.selectOption("0");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly scene?: {
                  readonly defaultSceneIndex?: number | null;
                  readonly scenes?: readonly {
                    readonly sceneIndex?: number;
                    readonly selected?: boolean;
                    readonly rootNodeIndices?: readonly number[];
                  }[];
                };
              };
              readonly replay?: {
                readonly valid?: boolean;
                readonly diagnostics?: number;
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const selected = status?.gltf?.metadata?.scene?.scenes?.find(
        (scene) => scene.selected,
      );

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "multi-scene" &&
        status.selectedAsset.loading === false &&
        status.gltf?.metadata?.scene?.defaultSceneIndex === 1 &&
        selected?.sceneIndex === 0 &&
        selected.rootNodeIndices?.[0] === 0 &&
        status.gltf?.replay?.valid === true &&
        status.gltf.replay.diagnostics === 0 &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(sceneSelect).toHaveValue("0");

  const selectedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const selectedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const selectedVisible = strongestRegionSample(
    selectedScreenshot,
    clear,
    0.36,
    0.32,
    0.64,
    0.7,
  );

  expectStatusJsonSafeForGpu(selectedStatus);
  expect(selectedStatus).toMatchObject({
    gltf: {
      metadata: {
        scene: {
          defaultSceneIndex: 1,
          scenes: [
            {
              sceneIndex: 0,
              selected: true,
              rootNodeIndices: [0],
            },
            {
              sceneIndex: 1,
              selected: false,
              rootNodeIndices: [1],
            },
          ],
        },
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 1, diagnostics: 0 },
    draw: { drawCalls: 1 },
  });
  expect(
    pixelDistance(defaultVisible, selectedVisible),
    "selected glTF scene should change rendered pixels",
  ).toBeGreaterThan(20);
  expect(selectedVisible.r).toBeGreaterThan(selectedVisible.g);

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly scene?: {
                  readonly scenes?: readonly unknown[];
                };
              };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.gltf?.metadata?.scene?.scenes?.length === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(sceneSelectRow).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer external glTF JSON plus BIN sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=external-gltf");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly status?: {
                readonly sourceKind?: string;
                readonly externalBuffers?: readonly {
                  readonly status?: string;
                }[];
              } | null;
              readonly outputSummary?: {
                readonly meshConstruction?: {
                  readonly status?: string;
                  readonly vertexCount?: number;
                  readonly indexCount?: number;
                };
              } | null;
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "external-gltf" &&
        status.selectedAsset.loading === false &&
        status.source?.status?.sourceKind === "gltf" &&
        status.source.status.externalBuffers?.[0]?.status === "loaded" &&
        status.source.outputSummary?.meshConstruction?.status === "ready" &&
        status.source.outputSummary.meshConstruction.vertexCount === 8 &&
        status.source.outputSummary.meshConstruction.indexCount === 36 &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "external-gltf",
      label: "External glTF",
      source: "sample",
      url: "/examples/assets/external-cube.gltf",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "gltf",
        externalBuffers: [
          {
            uri: "external-cube.bin",
            status: "loaded",
            byteLength: 168,
          },
        ],
        diagnostics: [],
      },
      outputSummary: {
        meshConstruction: {
          status: "ready",
          meshCount: 1,
          submeshCount: 1,
          vertexCount: 8,
          indexCount: 36,
          diagnosticsCount: 0,
        },
      },
      diagnostics: [],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 1, diagnostics: 0 },
    draw: { drawCalls: 1 },
  });

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const visible = strongestNearCenterSample(screenshot, clear);

  expect(
    pixelDistance(visible, clear),
    `external glTF sample should render non-clear pixels; sample=${JSON.stringify(
      visible,
    )}`,
  ).toBeGreaterThan(20);
  expect(visible.g).toBeGreaterThan(visible.r);
  expect(visible.b).toBeGreaterThan(visible.r);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer vertex colors through the unlit route", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=vertex-color");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly outputSummary?: {
                readonly meshConstruction?: {
                  readonly status?: string;
                  readonly vertexCount?: number;
                  readonly indexCount?: number;
                };
              } | null;
            };
            readonly gltf?: {
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly format?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly renderState?: {
              readonly draws?: readonly {
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "vertex-color" &&
        status.selectedAsset.loading === false &&
        status.source?.outputSummary?.meshConstruction?.status === "ready" &&
        status.source.outputSummary.meshConstruction.vertexCount === 4 &&
        status.source.outputSummary.meshConstruction.indexCount === 6 &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "COLOR_0" &&
            attribute.format === "float32x4" &&
            attribute.offset === 32,
        ) &&
        status.renderState?.draws?.[0]?.meshLayoutKey ===
          "POSITION,NORMAL,TEXCOORD_0,COLOR_0" &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "vertex-color",
      label: "Vertex color",
      source: "sample",
      url: "/examples/assets/vertex-color-quad.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      outputSummary: {
        meshConstruction: {
          status: "ready",
          meshCount: 1,
          submeshCount: 1,
          vertexCount: 4,
          indexCount: 6,
          diagnosticsCount: 0,
        },
      },
      diagnostics: [],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
        extensions: {
          used: ["KHR_materials_unlit"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
        families: [{ family: "unlit", count: 1 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "unlit",
            pipelineKey: "unlit|opaque|none|less|none",
          },
        ],
      },
      meshAttributes: [
        {
          meshIndex: 0,
          primitiveIndex: 0,
          streams: [
            {
              arrayStride: 48,
              vertexCount: 4,
              attributes: expect.arrayContaining([
                { semantic: "POSITION", format: "float32x3", offset: 0 },
                { semantic: "NORMAL", format: "float32x3", offset: 12 },
                { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
                { semantic: "COLOR_0", format: "float32x4", offset: 32 },
              ]),
            },
          ],
          indexBuffer: {
            format: "uint16",
            count: 6,
          },
        },
      ],
      replay: { valid: true, diagnostics: 0 },
    },
    renderState: {
      pipelineKeys: ["unlit|opaque|none|less|none"],
      draws: [
        {
          pipelineKey: "unlit|opaque|none|less|none",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
        },
      ],
    },
    extraction: { meshDraws: 1, diagnostics: 0 },
    draw: { drawCalls: 1 },
  });

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const upperLeft = strongestRegionSample(
    screenshot,
    clear,
    0.3,
    0.32,
    0.48,
    0.5,
  );
  const lowerRight = strongestRegionSample(
    screenshot,
    clear,
    0.52,
    0.5,
    0.7,
    0.68,
  );

  expect(
    pixelDistance(upperLeft, clear),
    `vertex-color quad upper-left region should render visible pixels; sample=${JSON.stringify(
      upperLeft,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(lowerRight, clear),
    `vertex-color quad lower-right region should render visible pixels; sample=${JSON.stringify(
      lowerRight,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(upperLeft, lowerRight),
    `vertex-color quad regions should differ; upperLeft=${JSON.stringify(
      upperLeft,
    )} lowerRight=${JSON.stringify(lowerRight)}`,
  ).toBeGreaterThan(25);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer textured vertex colors through the unlit route", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=textured-vertex-color");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    initialStatus,
    "textured vertex-color status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("Textured vertex-color status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly outputSummary?: {
                readonly meshConstruction?: {
                  readonly status?: string;
                  readonly vertexCount?: number;
                  readonly indexCount?: number;
                };
              } | null;
              readonly imageDecode?: {
                readonly decoded?: readonly unknown[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: {
                      readonly textureKey?: string;
                      readonly texCoord?: number;
                    } | null;
                  };
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly format?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly renderState?: {
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];
      const resolution = status?.gltf?.primitiveMaterials?.resolutions?.[0];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "textured-vertex-color" &&
        status.selectedAsset.loading === false &&
        status.source?.outputSummary?.meshConstruction?.status === "ready" &&
        status.source.outputSummary.meshConstruction.vertexCount === 4 &&
        status.source.outputSummary.meshConstruction.indexCount === 6 &&
        (status.source.imageDecode?.decoded?.length ?? 0) === 1 &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "COLOR_0" &&
            attribute.format === "float32x4" &&
            attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        resolution?.pipelineKey ===
          "unlit|baseColorTexture|opaque|none|less|none" &&
        resolution?.textureSlots?.baseColorTexture?.texCoord === 0 &&
        status.renderState?.draws?.[0]?.pipelineKey ===
          "unlit|baseColorTexture|opaque|none|less|none" &&
        status.renderState?.draws?.[0]?.meshLayoutKey ===
          "POSITION,NORMAL,TEXCOORD_0,COLOR_0" &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "textured-vertex-color",
      label: "Textured vertex color",
      source: "sample",
      url: "/examples/assets/textured-vertex-color.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
      materialSlotSummary: {
        textureSlots: {
          baseColorTexture: {
            count: 1,
            uv0: 1,
            uv1: 0,
            otherUv: 0,
          },
        },
      },
    },
    gltf: {
      primitiveMaterials: {
        families: [{ family: "unlit", count: 1 }],
        resolutions: [
          {
            family: "unlit",
            pipelineKey: "unlit|baseColorTexture|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: {
                texCoord: 0,
                textureKey: expect.stringMatching(
                  /^texture:viewer-textured-vertex-color-\d+:texture:0:baseColorTexture$/,
                ),
              },
            },
          },
        ],
      },
      meshAttributes: [
        {
          streams: [
            {
              arrayStride: 48,
              attributes: expect.arrayContaining([
                { semantic: "POSITION", format: "float32x3", offset: 0 },
                { semantic: "NORMAL", format: "float32x3", offset: 12 },
                { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
                { semantic: "COLOR_0", format: "float32x4", offset: 32 },
              ]),
            },
          ],
        },
      ],
    },
    renderState: {
      pipelineKeys: ["unlit|baseColorTexture|opaque|none|less|none"],
      draws: [
        {
          pipelineKey: "unlit|baseColorTexture|opaque|none|less|none",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
        },
      ],
    },
    extraction: { meshDraws: 1, diagnostics: 0 },
    draw: { drawCalls: 1 },
  });

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const upperLeft = strongestRegionSample(
    screenshot,
    clear,
    0.3,
    0.32,
    0.48,
    0.5,
  );
  const lowerRight = strongestRegionSample(
    screenshot,
    clear,
    0.52,
    0.5,
    0.7,
    0.68,
  );

  expect(
    pixelDistance(upperLeft, clear),
    `textured vertex-color upper-left region should render visible pixels; sample=${JSON.stringify(
      upperLeft,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(lowerRight, clear),
    `textured vertex-color lower-right region should render visible pixels; sample=${JSON.stringify(
      lowerRight,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(upperLeft, lowerRight),
    `textured vertex-color regions should differ; upperLeft=${JSON.stringify(
      upperLeft,
    )} lowerRight=${JSON.stringify(lowerRight)}`,
  ).toBeGreaterThan(25);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer vertex colors through the StandardMaterial route", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-vertex-color");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    initialStatus,
    "standard vertex-color status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("Standard vertex-color status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolutions?: readonly {
                  readonly family?: string;
                  readonly pipelineKey?: string;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly format?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly renderState?: {
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];
      const resolution = status?.gltf?.primitiveMaterials?.resolutions?.[0];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-vertex-color" &&
        status.selectedAsset.loading === false &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "COLOR_0" &&
            attribute.format === "float32x4" &&
            attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        resolution?.family === "standard" &&
        resolution?.pipelineKey === "standard|opaque|none|less|none" &&
        status.renderState?.draws?.[0]?.pipelineKey ===
          "standard|opaque|none|less|none" &&
        status.renderState?.draws?.[0]?.meshLayoutKey ===
          "POSITION,NORMAL,TEXCOORD_0,COLOR_0" &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-vertex-color",
      label: "Standard vertex color",
      source: "sample",
      url: "/examples/assets/standard-vertex-color.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    gltf: {
      primitiveMaterials: {
        families: [{ family: "standard", count: 1 }],
        resolutions: [
          {
            family: "standard",
            pipelineKey: "standard|opaque|none|less|none",
          },
        ],
      },
      meshAttributes: [
        {
          streams: [
            {
              arrayStride: 48,
              attributes: expect.arrayContaining([
                { semantic: "POSITION", format: "float32x3", offset: 0 },
                { semantic: "NORMAL", format: "float32x3", offset: 12 },
                { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
                { semantic: "COLOR_0", format: "float32x4", offset: 32 },
              ]),
            },
          ],
        },
      ],
    },
    renderState: {
      pipelineKeys: ["standard|opaque|none|less|none"],
      draws: [
        {
          pipelineKey: "standard|opaque|none|less|none",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
        },
      ],
    },
    extraction: { meshDraws: 1, diagnostics: 0 },
    draw: { drawCalls: 1 },
  });

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const upperLeft = strongestRegionSample(
    screenshot,
    clear,
    0.3,
    0.32,
    0.48,
    0.5,
  );
  const lowerRight = strongestRegionSample(
    screenshot,
    clear,
    0.52,
    0.5,
    0.7,
    0.68,
  );

  expect(
    pixelDistance(upperLeft, clear),
    `standard vertex-color upper-left region should render visible pixels; sample=${JSON.stringify(
      upperLeft,
    )}`,
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(lowerRight, clear),
    `standard vertex-color lower-right region should render visible pixels; sample=${JSON.stringify(
      lowerRight,
    )}`,
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(upperLeft, lowerRight),
    `standard vertex-color regions should differ; upperLeft=${JSON.stringify(
      upperLeft,
    )} lowerRight=${JSON.stringify(lowerRight)}`,
  ).toBeGreaterThan(18);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer textured vertex colors through the StandardMaterial route", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-textured-vertex-color",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    initialStatus,
    "standard textured vertex-color status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("Standard textured vertex-color status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly unknown[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly family?: string;
                  readonly pipelineKey?: string;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly format?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly renderState?: {
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];
      const textured =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const scalar = status?.gltf?.primitiveMaterials?.resolutions?.[1] ?? null;
      const draws = status?.renderState?.draws ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-textured-vertex-color" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        (status.source.imageDecode?.decoded?.length ?? 0) === 1 &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        textured?.family === "standard" &&
        textured.pipelineKey ===
          "standard|baseColorTexture|opaque|none|less|none" &&
        textured.textureSlots?.baseColorTexture?.texCoord === 0 &&
        scalar?.pipelineKey === "standard|opaque|none|less|none" &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "COLOR_0" &&
            attribute.format === "float32x4" &&
            attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        draws.some(
          (draw) =>
            draw.pipelineKey ===
              "standard|baseColorTexture|opaque|none|less|none" &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
        ) &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "standard textured vertex-color status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Standard textured vertex-color status did not publish.");
  }

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-textured-vertex-color",
      label: "Standard textured vertex color",
      source: "sample",
      url: "/examples/assets/standard-textured-vertex-color.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      primitiveMaterials: {
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            family: "standard",
            pipelineKey: "standard|baseColorTexture|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: {
                texCoord: 0,
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-textured-vertex-color-\d+:texture:0:baseColorTexture$/,
                ),
              },
            },
          },
          {
            family: "standard",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: "standard|baseColorTexture|opaque|none|less|none",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
        }),
      ]),
    },
    extraction: { meshDraws: 2, diagnostics: 0 },
    draw: { drawCalls: 2 },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 0,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 48,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "COLOR_0", format: "float32x4", offset: 32 },
            ]),
          }),
        ]),
      }),
    ]),
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const texturedWarm = strongestRegionSample(
    screenshot,
    clear,
    0.28,
    0.34,
    0.46,
    0.52,
  );
  const texturedCool = strongestRegionSample(
    screenshot,
    clear,
    0.42,
    0.5,
    0.56,
    0.68,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.58,
    0.4,
    0.76,
    0.62,
  );

  expect(
    pixelDistance(texturedWarm, clear),
    `standard textured vertex-color warm region should render visible pixels; sample=${JSON.stringify(
      texturedWarm,
    )}`,
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(texturedCool, clear),
    `standard textured vertex-color cool region should render visible pixels; sample=${JSON.stringify(
      texturedCool,
    )}`,
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(texturedWarm, texturedCool),
    `standard textured vertex-color regions should differ; warm=${JSON.stringify(
      texturedWarm,
    )} cool=${JSON.stringify(texturedCool)}`,
  ).toBeGreaterThan(10);
  expect(
    pixelDistance(texturedWarm, scalarControl) +
      pixelDistance(texturedCool, scalarControl),
    "standard textured vertex-color primitive should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright switches GLB viewer to an imported glTF camera", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=imported-camera");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedCamera?: {
              readonly status?: string;
              readonly controls?: {
                readonly available?: boolean;
                readonly enabled?: boolean;
              };
              readonly selected?: {
                readonly projection?: string;
                readonly yfov?: number;
              } | null;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "imported-camera" &&
        status.selectedAsset.loading === false &&
        status.importedCamera?.status === "ready" &&
        status.importedCamera.controls?.available === true &&
        status.importedCamera.controls.enabled === false &&
        status.importedCamera.selected?.projection === "perspective" &&
        Math.abs((status.importedCamera.selected.yfov ?? 0) - 0.72) < 0.001 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const orbitStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const orbitScreenshot = await page.locator("#aperture-canvas").screenshot();

  expectStatusJsonSafeForGpu(orbitStatus);
  expect(orbitStatus).toMatchObject({
    selectedAsset: {
      id: "imported-camera",
      label: "Imported camera",
      source: "sample",
      url: "/examples/assets/imported-camera.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    importedCamera: {
      status: "ready",
      controls: {
        available: true,
        enabled: false,
      },
      selected: {
        status: "ready",
        supported: true,
        nodeIndex: 1,
        cameraIndex: 0,
        entityKey: expect.stringMatching(/^viewer-imported-camera-\d+:node:1$/),
        name: "ImportedPerspective",
        nodeName: "ImportedCameraNode",
        cameraName: "ImportedPerspective",
        projection: "perspective",
        yfov: 0.72,
        aspect: 1.7777778,
        near: 0.1,
        far: 50,
        translation: [2.2, 1, 2.5],
        rotation: expect.any(Array),
      },
    },
    gltf: {
      metadata: {
        counts: {
          nodes: 2,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
  });

  await page.locator("#glb-imported-camera-toggle").click();
  await page.waitForFunction(
    () => {
      const importedCamera = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly importedCamera?: {
              readonly controls?: { readonly enabled?: boolean };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.importedCamera;

      return importedCamera?.controls?.enabled === true;
    },
    undefined,
    { timeout: 3000 },
  );
  const importedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const importedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(importedStatus?.importedCamera).toMatchObject({
    status: "ready",
    controls: {
      available: true,
      enabled: true,
    },
    selected: {
      projection: "perspective",
      yfov: 0.72,
      near: 0.1,
      far: 50,
    },
  });
  expect(
    maxSampleDelta(orbitScreenshot, importedScreenshot),
    "enabling the imported glTF camera should visibly change GLB viewer pixels",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright selects between GLB viewer imported cameras", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=multi-camera");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    initialStatus,
    "multi-camera viewer status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("Multi-camera viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedCamera?: {
              readonly status?: string;
              readonly controls?: {
                readonly available?: boolean;
                readonly enabled?: boolean;
                readonly readyCount?: number;
                readonly selectedCameraIndex?: number | null;
              };
              readonly selected?: {
                readonly cameraIndex?: number;
                readonly cameraName?: string | null;
                readonly yfov?: number;
              } | null;
              readonly cameras?: readonly unknown[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "multi-camera" &&
        status.selectedAsset.loading === false &&
        status.importedCamera?.status === "ready" &&
        status.importedCamera.controls?.available === true &&
        status.importedCamera.controls.enabled === false &&
        status.importedCamera.controls.readyCount === 2 &&
        status.importedCamera.controls.selectedCameraIndex === 0 &&
        status.importedCamera.selected?.cameraIndex === 0 &&
        status.importedCamera.selected.cameraName === "WidePerspective" &&
        Math.abs((status.importedCamera.selected.yfov ?? 0) - 0.72) < 0.001 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  await expect(page.locator("#glb-imported-camera-select option")).toHaveText([
    "WidePerspective",
    "TightPerspective",
  ]);

  const orbitStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expectStatusJsonSafeForGpu(orbitStatus);
  expect(orbitStatus).toMatchObject({
    selectedAsset: {
      id: "multi-camera",
      label: "Imported cameras",
      source: "sample",
      url: "/examples/assets/multi-camera.glb",
      loading: false,
    },
    importedCamera: {
      status: "ready",
      controls: {
        available: true,
        enabled: false,
        readyCount: 2,
        selectedCameraIndex: 0,
        selectedNodeIndex: 1,
      },
      selected: {
        status: "ready",
        supported: true,
        nodeIndex: 1,
        cameraIndex: 0,
        name: "WidePerspective",
        nodeName: "WideCameraNode",
        cameraName: "WidePerspective",
        projection: "perspective",
        yfov: 0.72,
        aspect: 1.7777778,
        near: 0.1,
        far: 50,
      },
      cameras: [
        expect.objectContaining({
          status: "ready",
          cameraIndex: 0,
          cameraName: "WidePerspective",
        }),
        expect.objectContaining({
          status: "ready",
          cameraIndex: 1,
          cameraName: "TightPerspective",
          yfov: 0.38,
        }),
      ],
    },
    gltf: {
      metadata: {
        counts: {
          nodes: 3,
          meshes: 1,
          primitives: 1,
          materials: 1,
        },
      },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
  });

  await page.locator("#glb-imported-camera-toggle").click();
  await page.waitForFunction(
    () => {
      const importedCamera = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly importedCamera?: {
              readonly controls?: { readonly enabled?: boolean };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.importedCamera;

      return importedCamera?.controls?.enabled === true;
    },
    undefined,
    { timeout: 3000 },
  );
  const wideScreenshot = await page.locator("#aperture-canvas").screenshot();

  await page.locator("#glb-imported-camera-select").selectOption("1");
  await page.waitForFunction(
    () => {
      const importedCamera = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly importedCamera?: {
              readonly controls?: {
                readonly enabled?: boolean;
                readonly selectedCameraIndex?: number | null;
              };
              readonly selected?: {
                readonly cameraIndex?: number;
                readonly cameraName?: string | null;
                readonly yfov?: number;
              } | null;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.importedCamera;

      return (
        importedCamera?.controls?.enabled === true &&
        importedCamera.controls.selectedCameraIndex === 1 &&
        importedCamera.selected?.cameraIndex === 1 &&
        importedCamera.selected.cameraName === "TightPerspective" &&
        Math.abs((importedCamera.selected.yfov ?? 0) - 0.38) < 0.001
      );
    },
    undefined,
    { timeout: 3000 },
  );

  const tightStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const tightScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(tightStatus?.importedCamera).toMatchObject({
    controls: {
      available: true,
      enabled: true,
      readyCount: 2,
      selectedCameraIndex: 1,
      selectedNodeIndex: 2,
    },
    selected: {
      nodeIndex: 2,
      cameraIndex: 1,
      cameraName: "TightPerspective",
      yfov: 0.38,
    },
  });
  expect(
    maxSampleDelta(wideScreenshot, tightScreenshot),
    "switching imported cameras should visibly change GLB viewer framing",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright bootstraps GLB viewer imported camera from URL", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=multi-camera&camera=1");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedCamera?: {
              readonly controls?: {
                readonly enabled?: boolean;
                readonly selectedCameraIndex?: number | null;
              };
              readonly selected?: {
                readonly cameraIndex?: number;
                readonly cameraName?: string | null;
              } | null;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "multi-camera" &&
        status.selectedAsset.loading === false &&
        status.importedCamera?.controls?.enabled === false &&
        status.importedCamera.controls.selectedCameraIndex === 1 &&
        status.importedCamera.selected?.cameraIndex === 1 &&
        status.importedCamera.selected.cameraName === "TightPerspective" &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  await expect(page.locator("#glb-imported-camera-select")).toHaveValue("1");
  await expect(page.locator("#glb-imported-camera-toggle")).not.toBeChecked();

  const orbitScreenshot = await page.locator("#aperture-canvas").screenshot();

  await page.goto(
    "/examples/glb-viewer.html?asset=multi-camera&camera=1&imported-camera=1",
  );
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedCamera?: {
              readonly controls?: {
                readonly enabled?: boolean;
                readonly selectedCameraIndex?: number | null;
              };
              readonly selected?: {
                readonly cameraIndex?: number;
                readonly cameraName?: string | null;
                readonly yfov?: number;
              } | null;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "multi-camera" &&
        status.selectedAsset.loading === false &&
        status.importedCamera?.controls?.enabled === true &&
        status.importedCamera.controls.selectedCameraIndex === 1 &&
        status.importedCamera.selected?.cameraIndex === 1 &&
        status.importedCamera.selected.cameraName === "TightPerspective" &&
        Math.abs((status.importedCamera.selected.yfov ?? 0) - 0.38) < 0.001 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  await expect(page.locator("#glb-imported-camera-select")).toHaveValue("1");
  await expect(page.locator("#glb-imported-camera-toggle")).toBeChecked();

  const importedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const importedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(importedStatus?.importedCamera).toMatchObject({
    controls: {
      available: true,
      enabled: true,
      readyCount: 2,
      selectedCameraIndex: 1,
      selectedNodeIndex: 2,
    },
    selected: {
      cameraIndex: 1,
      cameraName: "TightPerspective",
      yfov: 0.38,
    },
  });
  expect(
    maxSampleDelta(orbitScreenshot, importedScreenshot),
    "URL-enabled imported camera should visibly change GLB viewer framing",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders visible morph target weights from the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=morph-target");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly morphing?: {
              readonly status?: string;
              readonly targetCount?: number;
              readonly morphedEntities?: number;
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly metadata?: {
                readonly unsupportedFeatureDiagnostics?: readonly {
                  readonly code?: string;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                  }[];
                }[];
              }[];
              readonly primitiveMaterials?: { readonly resolved?: number };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const semantics =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes?.map(
          (attribute) => attribute.semantic,
        ) ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "morph-target" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 1 &&
        status.gltf?.metadata?.unsupportedFeatureDiagnostics?.length === 0 &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 80 &&
        semantics.includes("MORPH_POSITION_0") &&
        semantics.includes("MORPH_NORMAL_0") &&
        semantics.includes("MORPH_POSITION_1") &&
        semantics.includes("MORPH_NORMAL_1") &&
        status.morphing?.status === "ready" &&
        status.morphing.targetCount === 2 &&
        status.morphing.morphedEntities === 1 &&
        status.extraction?.meshDraws === 1 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|morphed|opaque|none|less|none",
        ) === true &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "morph target viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Morph target viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const center = strongestNearCenterSample(screenshot, clear);
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("ArrayBuffer");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "morph-target",
      label: "Morph target",
      source: "sample",
      url: "/examples/assets/morph-target.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
        extensions: {
          used: [],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
        families: [{ family: "standard", count: 1 }],
      },
      meshAttributes: [
        {
          streams: [
            {
              arrayStride: 80,
              attributes: [
                { semantic: "POSITION", offset: 0 },
                { semantic: "NORMAL", offset: 12 },
                { semantic: "TEXCOORD_0", offset: 24 },
                { semantic: "MORPH_POSITION_0", offset: 32 },
                { semantic: "MORPH_NORMAL_0", offset: 44 },
                { semantic: "MORPH_POSITION_1", offset: 56 },
                { semantic: "MORPH_NORMAL_1", offset: 68 },
              ],
            },
          ],
          indexBuffer: {
            format: "uint16",
            count: 6,
          },
        },
      ],
      replay: { valid: true, diagnostics: 0 },
    },
    morphing: {
      status: "ready",
      targetCount: 2,
      supportedTargetCount: 2,
      morphedEntities: 1,
      weights: [0, 0],
      targetNames: ["slide", "stretch"],
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(status.renderState?.pipelineKeys).toContain(
    "standard|morphed|opaque|none|less|none",
  );
  expect(
    pixelDistance(center, clear),
    `morph target mesh should render visible pixels; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);

  await expect(page.locator("#glb-morph-weight-0")).toBeEnabled();
  const baseScreenshot = screenshot;

  await page.locator("#glb-morph-weight-0").evaluate((node) => {
    if (!(node instanceof HTMLInputElement)) {
      throw new Error("Morph target weight input was not an HTML input.");
    }

    node.value = "1";
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly morphing?: { readonly weights?: readonly number[] };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (status?.morphing?.weights?.[0] ?? 0) > 0.99;
    },
    undefined,
    { timeout: 5000 },
  );

  const morphedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const morphedScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(morphedStatus?.morphing).toMatchObject({
    status: "ready",
    targetCount: 2,
    morphedEntities: 1,
    weights: [1, 0],
  });
  expect(
    maxSampleDelta(baseScreenshot, morphedScreenshot),
    "morph target weight slider should visibly move rendered pixels",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders and animates a skinned GLB mesh", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=skinning");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly metadata?: {
                readonly unsupportedFeatureDiagnostics?: readonly unknown[];
              };
              readonly primitiveMaterials?: { readonly resolved?: number };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly format?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly skinning?: {
              readonly status?: string;
              readonly skinCount?: number;
              readonly jointCount?: number;
              readonly skinnedEntities?: number;
              readonly animatedJointCount?: number;
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "skinning" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 1 &&
        status.gltf?.metadata?.unsupportedFeatureDiagnostics?.length === 0 &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 56 &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "JOINTS_0" &&
            attribute.format === "uint16x4" &&
            attribute.offset === 32,
        ) &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "WEIGHTS_0" &&
            attribute.format === "float32x4" &&
            attribute.offset === 40,
        ) &&
        status.skinning?.status === "ready" &&
        status.skinning.skinCount === 1 &&
        status.skinning.jointCount === 2 &&
        status.skinning.skinnedEntities === 1 &&
        (status.skinning.animatedJointCount ?? 0) >= 1 &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|skinned|opaque|none|less|none",
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "skinning viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Skinning viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const firstFrame = status.frame;
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const center = strongestNearCenterSample(screenshot, clear);
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("ArrayBuffer");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "skinning",
      label: "Skinned character",
      source: "sample",
      url: "/examples/assets/skinning.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 3,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
        extensions: {
          used: [],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
        families: [{ family: "standard", count: 1 }],
      },
      meshAttributes: [
        {
          meshIndex: 0,
          primitiveIndex: 0,
          streams: [
            {
              arrayStride: 56,
              vertexCount: 4,
              attributes: expect.arrayContaining([
                { semantic: "POSITION", format: "float32x3", offset: 0 },
                { semantic: "NORMAL", format: "float32x3", offset: 12 },
                { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
                { semantic: "JOINTS_0", format: "uint16x4", offset: 32 },
                { semantic: "WEIGHTS_0", format: "float32x4", offset: 40 },
              ]),
            },
          ],
          indexBuffer: {
            format: "uint16",
            count: 6,
          },
        },
      ],
      replay: { valid: true, diagnostics: 0 },
    },
    skinning: {
      status: "ready",
      skinCount: 1,
      jointCount: 2,
      skinnedEntities: 1,
      animatedJointCount: 1,
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(status.skinning?.entries?.[0]).toMatchObject({
    skinIndex: 0,
    nodeIndex: 0,
    meshIndex: 0,
    primitiveIndex: 0,
    jointNodeIndices: [1, 2],
  });
  expect(status.renderState?.pipelineKeys).toContain(
    "standard|skinned|opaque|none|less|none",
  );
  expect(
    pixelDistance(center, clear),
    `skinned mesh should render visible pixels; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);
  await page.waitForFunction(
    (frame) =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >=
      frame + 30,
    firstFrame,
    { timeout: 5000 },
  );
  const animatedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(
    maxSampleDelta(screenshot, animatedScreenshot),
    "procedural skinning should update joint palettes and change visible pixels",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright applies a GLB viewer orthographic imported camera", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=orthographic-camera");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedCamera?: {
              readonly status?: string;
              readonly controls?: {
                readonly available?: boolean;
                readonly enabled?: boolean;
              };
              readonly selected?: {
                readonly projection?: string;
                readonly xmag?: number;
                readonly ymag?: number;
                readonly orthographicHeight?: number;
              } | null;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "orthographic-camera" &&
        status.selectedAsset.loading === false &&
        status.importedCamera?.status === "ready" &&
        status.importedCamera.controls?.available === true &&
        status.importedCamera.controls.enabled === false &&
        status.importedCamera.selected?.projection === "orthographic" &&
        Math.abs((status.importedCamera.selected.xmag ?? 0) - 1.8) < 0.001 &&
        Math.abs((status.importedCamera.selected.ymag ?? 0) - 1.2) < 0.001 &&
        Math.abs(
          (status.importedCamera.selected.orthographicHeight ?? 0) - 2.4,
        ) < 0.001 &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "orthographic-camera viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Orthographic-camera viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const center = strongestNearCenterSample(screenshot, clear);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "orthographic-camera",
      label: "Orthographic camera",
      source: "sample",
      url: "/examples/assets/orthographic-camera.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    importedCamera: {
      status: "ready",
      controls: {
        available: true,
        enabled: false,
      },
      selected: {
        status: "ready",
        supported: true,
        nodeIndex: 1,
        cameraIndex: 0,
        entityKey: expect.stringMatching(
          /^viewer-orthographic-camera-\d+:node:1$/,
        ),
        name: "UnsupportedOrthoCamera",
        nodeName: "UnsupportedOrthographicCameraNode",
        cameraName: "UnsupportedOrthoCamera",
        projection: "orthographic",
        xmag: 1.8,
        ymag: 1.2,
        aspect: 1.5,
        orthographicHeight: 2.4,
        near: 0.1,
        far: 50,
        translation: [0, 0.2, 3.2],
        rotation: [0, 0, 0, 1],
      },
      cameras: [
        {
          status: "ready",
          supported: true,
          nodeIndex: 1,
          cameraIndex: 0,
          entityKey: expect.stringMatching(
            /^viewer-orthographic-camera-\d+:node:1$/,
          ),
          name: "UnsupportedOrthoCamera",
          nodeName: "UnsupportedOrthographicCameraNode",
          cameraName: "UnsupportedOrthoCamera",
          projection: "orthographic",
          xmag: 1.8,
          ymag: 1.2,
          aspect: 1.5,
          orthographicHeight: 2.4,
          near: 0.1,
          far: 50,
        },
      ],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 2,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(center, clear),
    `orthographic-camera base mesh should render through the fitted orbit camera before enabling import; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);

  await page.locator("#glb-imported-camera-toggle").click();
  await page.waitForFunction(
    () => {
      const importedCamera = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly importedCamera?: {
              readonly controls?: { readonly enabled?: boolean };
              readonly selected?: {
                readonly projection?: string;
                readonly orthographicHeight?: number;
              } | null;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.importedCamera;

      return (
        importedCamera?.controls?.enabled === true &&
        importedCamera.selected?.projection === "orthographic" &&
        Math.abs((importedCamera.selected.orthographicHeight ?? 0) - 2.4) <
          0.001
      );
    },
    undefined,
    { timeout: 3000 },
  );
  const importedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const importedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(importedStatus?.importedCamera).toMatchObject({
    status: "ready",
    controls: {
      available: true,
      enabled: true,
    },
    selected: {
      projection: "orthographic",
      xmag: 1.8,
      ymag: 1.2,
      aspect: 1.5,
      orthographicHeight: 2.4,
      near: 0.1,
      far: 50,
    },
  });
  expect(
    maxSampleDelta(screenshot, importedScreenshot),
    "enabling the orthographic imported camera should visibly change GLB viewer framing",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright skips an unsupported primitive mode while rendering supported GLB primitives", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=unsupported-primitive");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly metadata?: {
                readonly counts?: { readonly primitives?: number };
                readonly unsupportedFeatureDiagnostics?: readonly {
                  readonly code?: string;
                  readonly meshIndex?: number;
                  readonly primitiveIndex?: number;
                  readonly mode?: number;
                }[];
              };
              readonly primitiveMaterials?: { readonly resolved?: number };
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "unsupported-primitive" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.metadata?.counts?.primitives === 2 &&
        status.gltf.primitiveMaterials?.resolved === 1 &&
        status.extraction?.meshDraws === 1 &&
        status.gltf.metadata.unsupportedFeatureDiagnostics?.some(
          (diagnostic) =>
            diagnostic.code === "gltfMesh.unsupportedPrimitiveMode" &&
            diagnostic.meshIndex === 0 &&
            diagnostic.primitiveIndex === 1 &&
            diagnostic.mode === 1,
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "unsupported-primitive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Unsupported-primitive viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const center = strongestNearCenterSample(screenshot, clear);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "unsupported-primitive",
      label: "Unsupported primitive",
      source: "sample",
      url: "/examples/assets/unsupported-primitive-mode.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      diagnostics: [],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 1,
          animations: 0,
        },
        extensions: {
          used: ["KHR_materials_unlit"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [
          {
            code: "gltfMesh.unsupportedPrimitiveMode",
            severity: "warning",
            meshIndex: 0,
            primitiveIndex: 1,
            mode: 1,
          },
        ],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
        families: [{ family: "unlit", count: 1 }],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(center, clear),
    `supported primitive should still render visible pixels; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders an emissive StandardMaterial GLB viewer sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=emissive-standard");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const emissiveFactor =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.factors
          ?.emissiveFactor;
      const controlFactor =
        status?.gltf?.primitiveMaterials?.resolutions?.[1]?.factors
          ?.emissiveFactor;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "emissive-standard" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true &&
        emissiveFactor?.[0] === 0.85 &&
        emissiveFactor?.[1] === 0.28 &&
        emissiveFactor?.[2] === 0.05 &&
        controlFactor?.[0] === 0 &&
        controlFactor?.[1] === 0 &&
        controlFactor?.[2] === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "emissive StandardMaterial status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Emissive StandardMaterial status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const emissivePixel = readPngPixel(screenshot, 0.36, 0.5);
  const controlPixel = readPngPixel(screenshot, 0.64, 0.5);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "emissive-standard",
      label: "Emissive standard",
      source: "sample",
      url: "/examples/assets/emissive-standard.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.05, 0.05, 0.05, 1],
              metallicFactor: 0,
              roughnessFactor: 0.68,
              emissiveFactor: [0.85, 0.28, 0.05],
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.05, 0.05, 0.05, 1],
              metallicFactor: 0,
              roughnessFactor: 0.68,
              emissiveFactor: [0, 0, 0],
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(emissivePixel, clear),
    `emissive StandardMaterial region should render visible pixels; sample=${JSON.stringify(
      emissivePixel,
    )}`,
  ).toBeGreaterThan(30);
  expect(
    pixelDistance(controlPixel, clear),
    `scalar control region should render visible pixels; sample=${JSON.stringify(
      controlPixel,
    )}`,
  ).toBeGreaterThan(5);
  expect(
    pixelDistance(emissivePixel, controlPixel),
    "emissive factor should visibly differ from the scalar control region",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer base-color texture plus emissive texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-base-emissive");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const combined =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const control =
        status?.gltf?.primitiveMaterials?.resolutions?.[1] ?? null;
      const combinedPipelineKey =
        "standard|baseColorTexture|emissiveTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-base-emissive" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-uri-base-color-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots?.emissiveTexture?.texCoord === 0 &&
        combined.factors?.emissiveFactor?.[0] === 0.9 &&
        control?.pipelineKey ===
          "standard|baseColorTexture|opaque|back|less|none" &&
        control.textureSlots?.baseColorTexture?.texCoord === 0 &&
        control.textureSlots?.emissiveTexture === null &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "base-color plus emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Base-color plus emissive viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const emissive = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const control = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );
  const combinedPipelineKey =
    "standard|baseColorTexture|emissiveTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-base-emissive",
      label: "Base + emissive texture",
      source: "sample",
      url: "/examples/assets/standard-base-emissive.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
      materialSlotSummary: {
        textureSlots: {
          baseColorTexture: { count: 2, uv0: 2, uv1: 0, otherUv: 0 },
          emissiveTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
        },
      },
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-uri-base-color-checker.png",
            url: "/examples/assets/aperture-uri-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [0.45, 0.45, 0.45, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0.9, 0.28, 0.08],
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-base-emissive-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-base-emissive-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-base-emissive-\d+:texture:1:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-base-emissive-\d+:sampler:1:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.45, 0.45, 0.45, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0, 0, 0],
            },
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 2, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|baseColorTexture|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 2 },
  });
  expect(
    pixelDistance(emissive, clear),
    `base/emissive textured region should render visible pixels; sample=${JSON.stringify(
      emissive,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(control, clear),
    `base-color control should render visible pixels; sample=${JSON.stringify(
      control,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(emissive, control),
    "emissive texture should visibly differ from the base-color-only control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer metallic-roughness texture plus emissive texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-metallic-emissive");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const combined = resolutions[0] ?? null;
      const metallicOnly = resolutions[1] ?? null;
      const scalar = resolutions[2] ?? null;
      const combinedPipelineKey =
        "standard|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-metallic-emissive" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        combined.textureSlots?.emissiveTexture?.texCoord === 0 &&
        combined.factors?.emissiveFactor?.[0] === 0.85 &&
        metallicOnly?.pipelineKey ===
          "standard|metallicRoughnessTexture|opaque|back|less|none" &&
        metallicOnly.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        metallicOnly.textureSlots?.emissiveTexture === null &&
        scalar?.pipelineKey === "standard|opaque|back|less|none" &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "metallic-roughness plus emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Metallic-roughness plus emissive viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combinedRegion = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const metallicOnlyRegion = {
    minX: 0.41,
    minY: 0.34,
    maxX: 0.6,
    maxY: 0.66,
  };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const combinedA = readPngPixel(screenshot, 0.28, 0.46);
  const combinedB = readPngPixel(screenshot, 0.36, 0.58);
  const metallicOnlyA = readPngPixel(screenshot, 0.48, 0.46);
  const metallicOnlyB = readPngPixel(screenshot, 0.56, 0.58);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    combinedRegion.minX,
    combinedRegion.minY,
    combinedRegion.maxX,
    combinedRegion.maxY,
  );
  const metallicOnly = strongestRegionSample(
    screenshot,
    clear,
    metallicOnlyRegion.minX,
    metallicOnlyRegion.minY,
    metallicOnlyRegion.maxX,
    metallicOnlyRegion.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const combinedLuminance = averageRegionLuminance(
    screenshot,
    clear,
    combinedRegion,
  );
  const metallicOnlyLuminance = averageRegionLuminance(
    screenshot,
    clear,
    metallicOnlyRegion,
  );
  const combinedPipelineKey =
    "standard|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-metallic-emissive",
      label: "MR + emissive texture",
      source: "sample",
      url: "/examples/assets/standard-metallic-emissive.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [0.72, 0.68, 0.58, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
              emissiveFactor: [0.85, 0.26, 0.08],
            },
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-metallic-emissive-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-metallic-emissive-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-metallic-emissive-\d+:texture:1:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-metallic-emissive-\d+:sampler:1:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey:
              "standard|metallicRoughnessTexture|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: { texCoord: 0 },
              emissiveTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: null,
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|metallicRoughnessTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(
    pixelDistance(combined, clear),
    `combined metallic/emissive region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combinedA, combinedB),
    "combined metallic/emissive primitive should show emissive texture variation",
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(metallicOnlyA, metallicOnlyB),
    "metallic-roughness control should show metallic/roughness texture variation",
  ).toBeGreaterThan(4);
  expect(
    combinedLuminance.average - metallicOnlyLuminance.average,
    `emissive texture should brighten the combined panel; combined=${JSON.stringify(
      combinedLuminance,
    )} metallicOnly=${JSON.stringify(metallicOnlyLuminance)}`,
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(metallicOnly, scalar),
    "metallic/emissive StandardMaterial sample should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer base-color plus metallic-roughness plus emissive textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-base-metallic-emissive",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const combined = resolutions[0] ?? null;
      const baseMetallic = resolutions[1] ?? null;
      const scalar = resolutions[2] ?? null;
      const combinedPipelineKey =
        "standard|baseColorTexture|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-base-metallic-emissive" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-uri-base-color-checker.png") &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        combined.textureSlots?.emissiveTexture?.texCoord === 0 &&
        combined.factors?.emissiveFactor?.[0] === 0.9 &&
        baseMetallic?.pipelineKey ===
          "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none" &&
        baseMetallic.textureSlots?.baseColorTexture?.texCoord === 0 &&
        baseMetallic.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        baseMetallic.textureSlots?.emissiveTexture === null &&
        scalar?.pipelineKey === "standard|opaque|back|less|none" &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "base-color plus metallic-roughness plus emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Base-color plus metallic-roughness plus emissive viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combinedRegion = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const baseMetallicRegion = {
    minX: 0.41,
    minY: 0.34,
    maxX: 0.6,
    maxY: 0.66,
  };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const combinedA = readPngPixel(screenshot, 0.28, 0.46);
  const combinedB = readPngPixel(screenshot, 0.36, 0.58);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    combinedRegion.minX,
    combinedRegion.minY,
    combinedRegion.maxX,
    combinedRegion.maxY,
  );
  const baseMetallic = strongestRegionSample(
    screenshot,
    clear,
    baseMetallicRegion.minX,
    baseMetallicRegion.minY,
    baseMetallicRegion.maxX,
    baseMetallicRegion.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const combinedLuminance = averageRegionLuminance(
    screenshot,
    clear,
    combinedRegion,
  );
  const baseMetallicLuminance = averageRegionLuminance(
    screenshot,
    clear,
    baseMetallicRegion,
  );
  const combinedPipelineKey =
    "standard|baseColorTexture|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-base-metallic-emissive",
      label: "Base + MR + emissive",
      source: "sample",
      url: "/examples/assets/standard-base-metallic-emissive.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-uri-base-color-checker.png",
            url: "/examples/assets/aperture-uri-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 2,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
              emissiveFactor: [0.9, 0.28, 0.08],
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-base-metallic-emissive-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-base-metallic-emissive-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-base-metallic-emissive-\d+:texture:1:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-base-metallic-emissive-\d+:sampler:1:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-base-metallic-emissive-\d+:texture:2:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-base-metallic-emissive-\d+:sampler:2:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey:
              "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              metallicRoughnessTexture: { texCoord: 0 },
              emissiveTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              metallicRoughnessTexture: null,
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(
    pixelDistance(combined, clear),
    `combined base/MR/emissive region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combinedA, combinedB),
    "combined base/MR/emissive primitive should show texture variation",
  ).toBeGreaterThan(4);
  expect(
    combinedLuminance.average - baseMetallicLuminance.average,
    `emissive texture should brighten after base/MR lighting; combined=${JSON.stringify(
      combinedLuminance,
    )} baseMetallic=${JSON.stringify(baseMetallicLuminance)}`,
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(baseMetallic, scalar),
    "base/MR/emissive StandardMaterial sample should differ from the scalar control",
  ).toBeGreaterThan(12);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer transformed base-color plus emissive texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-base-emissive-transform",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly extensions?: {
                  readonly used?: readonly string[];
                };
              };
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const transformed =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.textureSlots ??
        null;
      const untransformed =
        status?.gltf?.primitiveMaterials?.resolutions?.[1]?.textureSlots ??
        null;
      const pipelineKey =
        "standard|baseColorTexture|emissiveTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-base-emissive-transform" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-uri-base-color-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.metadata?.extensions?.used?.includes(
          "KHR_texture_transform",
        ) === true &&
        status.gltf.primitiveMaterials?.resolved === 2 &&
        status.gltf.primitiveMaterials.resolutions?.[0]?.pipelineKey ===
          pipelineKey &&
        status.gltf.primitiveMaterials.resolutions?.[1]?.pipelineKey ===
          pipelineKey &&
        transformed?.baseColorTexture?.hasTransform === true &&
        transformed.baseColorTexture.transform?.offset?.[0] === 0.5 &&
        transformed.baseColorTexture.transform.scale?.[0] === 0.5 &&
        transformed.emissiveTexture?.hasTransform === false &&
        untransformed?.baseColorTexture?.hasTransform === false &&
        untransformed.emissiveTexture?.hasTransform === false &&
        status.renderState?.pipelineKeys?.includes(pipelineKey) === true &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "transformed base plus emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Transformed base plus emissive viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const untransformed = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );
  const pipelineKey =
    "standard|baseColorTexture|emissiveTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-base-emissive-transform",
      label: "Transformed base + emissive",
      source: "sample",
      url: "/examples/assets/standard-base-emissive-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        extensions: {
          used: ["KHR_texture_transform"],
        },
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey,
            textureSlots: {
              baseColorTexture: {
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
              emissiveTexture: {
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey,
            textureSlots: {
              baseColorTexture: {
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
              emissiveTexture: {
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 2, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([pipelineKey]),
    },
    draw: { drawCalls: 2 },
  });
  expect(
    pixelDistance(transformed, clear),
    `transformed base/emissive region should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(untransformed, clear),
    `untransformed base/emissive control should render visible pixels; sample=${JSON.stringify(
      untransformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformed, untransformed),
    "transformed base-color slot should visibly differ from the untransformed base/emissive control",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer transformed base-color plus metallic-roughness textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-base-metallic-transform",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly extensions?: {
                  readonly used?: readonly string[];
                };
              };
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const transformed =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.textureSlots ??
        null;
      const untransformed =
        status?.gltf?.primitiveMaterials?.resolutions?.[1]?.textureSlots ??
        null;
      const scalar =
        status?.gltf?.primitiveMaterials?.resolutions?.[2]?.textureSlots ??
        null;
      const pipelineKey =
        "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-base-metallic-transform" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-uri-base-color-checker.png") &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        status.gltf?.metadata?.extensions?.used?.includes(
          "KHR_texture_transform",
        ) === true &&
        status.gltf.primitiveMaterials?.resolved === 3 &&
        status.gltf.primitiveMaterials.resolutions?.[0]?.pipelineKey ===
          pipelineKey &&
        status.gltf.primitiveMaterials.resolutions?.[1]?.pipelineKey ===
          pipelineKey &&
        transformed?.baseColorTexture?.hasTransform === true &&
        transformed.baseColorTexture.transform?.offset?.[0] === 0.5 &&
        transformed.baseColorTexture.transform.scale?.[0] === 0.5 &&
        transformed.metallicRoughnessTexture?.hasTransform === false &&
        untransformed?.baseColorTexture?.hasTransform === false &&
        untransformed.metallicRoughnessTexture?.hasTransform === false &&
        scalar?.baseColorTexture === null &&
        scalar.metallicRoughnessTexture === null &&
        status.renderState?.pipelineKeys?.includes(pipelineKey) === true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "transformed base plus metallic-roughness viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Transformed base plus metallic-roughness viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const untransformed = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );
  const pipelineKey =
    "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-base-metallic-transform",
      label: "Transformed base + MR",
      source: "sample",
      url: "/examples/assets/standard-base-metallic-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    gltf: {
      metadata: {
        extensions: {
          used: ["KHR_texture_transform"],
        },
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey,
            textureSlots: {
              baseColorTexture: {
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
              metallicRoughnessTexture: {
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey,
            textureSlots: {
              baseColorTexture: {
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
              metallicRoughnessTexture: {
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              metallicRoughnessTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        pipelineKey,
        "standard|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(
    pixelDistance(transformed, clear),
    `transformed base/metallic-roughness region should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(untransformed, clear),
    `untransformed base/metallic-roughness control should render visible pixels; sample=${JSON.stringify(
      untransformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformed, untransformed),
    "transformed base-color slot should visibly differ from the untransformed base/metallic-roughness control",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(transformed, scalar) + pixelDistance(untransformed, scalar),
    "base/metallic-roughness texture controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer base-color texture plus occlusion texture", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-base-occlusion");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly occlusionTexture?: TextureSlotStatus | null;
                  } | null;
                  readonly factors?: {
                    readonly occlusionStrength?: number | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const combined = resolutions[0] ?? null;
      const baseOnly = resolutions[1] ?? null;
      const scalar = resolutions[2] ?? null;
      const combinedPipelineKey =
        "standard|baseColorTexture|occlusionTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-base-occlusion" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-base-color-checker.png") &&
        decodedUris.has("aperture-occlusion-control.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots?.occlusionTexture?.texCoord === 0 &&
        combined.factors?.occlusionStrength === 0.72 &&
        baseOnly?.pipelineKey ===
          "standard|baseColorTexture|opaque|back|less|none" &&
        baseOnly.textureSlots?.baseColorTexture?.texCoord === 0 &&
        baseOnly.textureSlots?.occlusionTexture === null &&
        scalar?.pipelineKey === "standard|opaque|back|less|none" &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "base-color plus occlusion viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Base-color plus occlusion viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combinedRegion = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const baseOnlyRegion = { minX: 0.41, minY: 0.34, maxX: 0.6, maxY: 0.66 };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const combinedA = readPngPixel(screenshot, 0.28, 0.46);
  const combinedB = readPngPixel(screenshot, 0.36, 0.58);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    combinedRegion.minX,
    combinedRegion.minY,
    combinedRegion.maxX,
    combinedRegion.maxY,
  );
  const baseOnly = strongestRegionSample(
    screenshot,
    clear,
    baseOnlyRegion.minX,
    baseOnlyRegion.minY,
    baseOnlyRegion.maxX,
    baseOnlyRegion.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const combinedLuminance = averageRegionLuminance(
    screenshot,
    clear,
    combinedRegion,
  );
  const baseOnlyLuminance = averageRegionLuminance(
    screenshot,
    clear,
    baseOnlyRegion,
  );
  const combinedPipelineKey =
    "standard|baseColorTexture|occlusionTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-base-occlusion",
      label: "Base + occlusion texture",
      source: "sample",
      url: "/examples/assets/standard-base-occlusion.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-occlusion-control.png",
            url: "/examples/assets/aperture-occlusion-control.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              occlusionStrength: 0.72,
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-base-occlusion-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-base-occlusion-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-base-occlusion-\d+:texture:1:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-base-occlusion-\d+:sampler:1:occlusionTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              occlusionTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              occlusionTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(
    pixelDistance(combined, clear),
    `base/occlusion textured region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combinedA, combinedB),
    "base/occlusion primitive should show texture variation",
  ).toBeGreaterThan(4);
  expect(
    Math.abs(baseOnlyLuminance.average - combinedLuminance.average),
    `occlusion should visibly change the combined panel; combined=${JSON.stringify(
      combinedLuminance,
    )} baseOnly=${JSON.stringify(baseOnlyLuminance)}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(baseOnly, scalar),
    "base/occlusion StandardMaterial sample should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer UV1 base-color plus occlusion textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-uv1-base-occlusion",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly occlusionTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const uv0 = resolutions[0]?.textureSlots ?? null;
      const uv1 = resolutions[1]?.textureSlots ?? null;
      const scalar = resolutions[2]?.textureSlots ?? null;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const uv1PipelineKey =
        "standard|baseColorTexture|occlusionTexture|uv1|opaque|back|less|none";
      const attributes =
        status?.gltf?.meshAttributes?.[1]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-uv1-base-occlusion" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-base-color-checker.png") &&
        decodedUris.has("aperture-occlusion-control.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        resolutions[0]?.pipelineKey ===
          "standard|baseColorTexture|occlusionTexture|opaque|back|less|none" &&
        resolutions[1]?.pipelineKey === uv1PipelineKey &&
        uv0?.baseColorTexture?.texCoord === 0 &&
        uv0.occlusionTexture?.texCoord === 0 &&
        uv1?.baseColorTexture?.texCoord === 1 &&
        uv1.occlusionTexture?.texCoord === 1 &&
        scalar?.baseColorTexture === null &&
        scalar.occlusionTexture === null &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TEXCOORD_1" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[1]?.streams?.[0]?.arrayStride === 40 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true &&
        status.renderState?.pipelineKeys?.includes(uv1PipelineKey) === true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === uv1PipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        ) === true &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "UV1 base/occlusion viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("UV1 base/occlusion viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv0Region = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const uv1Region = { minX: 0.41, minY: 0.34, maxX: 0.6, maxY: 0.66 };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const uv0 = strongestRegionSample(
    screenshot,
    clear,
    uv0Region.minX,
    uv0Region.minY,
    uv0Region.maxX,
    uv0Region.maxY,
  );
  const uv1 = strongestRegionSample(
    screenshot,
    clear,
    uv1Region.minX,
    uv1Region.minY,
    uv1Region.maxX,
    uv1Region.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const uv1A = readPngPixel(screenshot, 0.46, 0.46);
  const uv1B = readPngPixel(screenshot, 0.56, 0.58);
  const uv1PipelineKey =
    "standard|baseColorTexture|occlusionTexture|uv1|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-uv1-base-occlusion",
      label: "UV1 base + occlusion",
      source: "sample",
      url: "/examples/assets/standard-uv1-base-occlusion.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
      materialSlotSummary: {
        textureSlots: {
          baseColorTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
          occlusionTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
        },
        uv1Usage: {
          materials: 1,
          textureSlots: 2,
        },
      },
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-occlusion-control.png",
            url: "/examples/assets/aperture-occlusion-control.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey:
              "standard|baseColorTexture|occlusionTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-occlusion-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-occlusion-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-occlusion-\d+:texture:1:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-occlusion-\d+:sampler:1:occlusionTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: uv1PipelineKey,
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-occlusion-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-occlusion-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-occlusion-\d+:texture:1:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-occlusion-\d+:sampler:1:occlusionTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              occlusionTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|occlusionTexture|opaque|back|less|none",
        uv1PipelineKey,
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: uv1PipelineKey,
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        }),
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 1,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 40,
            vertexCount: 4,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TEXCOORD_1", format: "float32x2", offset: 32 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(uv0, clear),
    `UV0 base/occlusion control should render visible pixels; sample=${JSON.stringify(
      uv0,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1, clear),
    `UV1 base/occlusion region should render visible pixels; sample=${JSON.stringify(
      uv1,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1A, uv1B),
    "UV1 base/occlusion primitive should show texture-coordinate variation",
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(uv0, uv1),
    "base-color and occlusion textures routed through UV1 should differ from the UV0 control",
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(uv0, scalar) + pixelDistance(uv1, scalar),
    "textured base/occlusion UV controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer UV1 base-color plus emissive textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-uv1-base-emissive");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const uv0 = resolutions[0]?.textureSlots ?? null;
      const uv1 = resolutions[1]?.textureSlots ?? null;
      const scalar = resolutions[2]?.textureSlots ?? null;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const uv1PipelineKey =
        "standard|baseColorTexture|emissiveTexture|uv1|opaque|back|less|none";
      const attributes =
        status?.gltf?.meshAttributes?.[1]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-uv1-base-emissive" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-uri-base-color-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        resolutions[0]?.pipelineKey ===
          "standard|baseColorTexture|emissiveTexture|opaque|back|less|none" &&
        resolutions[1]?.pipelineKey === uv1PipelineKey &&
        resolutions[1]?.factors?.emissiveFactor?.[0] === 0.9 &&
        uv0?.baseColorTexture?.texCoord === 0 &&
        uv0.emissiveTexture?.texCoord === 0 &&
        uv1?.baseColorTexture?.texCoord === 1 &&
        uv1.emissiveTexture?.texCoord === 1 &&
        scalar?.baseColorTexture === null &&
        scalar.emissiveTexture === null &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TEXCOORD_1" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[1]?.streams?.[0]?.arrayStride === 40 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true &&
        status.renderState?.pipelineKeys?.includes(uv1PipelineKey) === true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === uv1PipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        ) === true &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "UV1 base/emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("UV1 base/emissive viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv0Region = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const uv1Region = { minX: 0.41, minY: 0.34, maxX: 0.6, maxY: 0.66 };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const uv0 = strongestRegionSample(
    screenshot,
    clear,
    uv0Region.minX,
    uv0Region.minY,
    uv0Region.maxX,
    uv0Region.maxY,
  );
  const uv1 = strongestRegionSample(
    screenshot,
    clear,
    uv1Region.minX,
    uv1Region.minY,
    uv1Region.maxX,
    uv1Region.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const uv1A = readPngPixel(screenshot, 0.46, 0.46);
  const uv1B = readPngPixel(screenshot, 0.56, 0.58);
  const uv1Luminance = averageRegionLuminance(screenshot, clear, uv1Region);
  const scalarLuminance = averageRegionLuminance(
    screenshot,
    clear,
    scalarRegion,
  );
  const uv1PipelineKey =
    "standard|baseColorTexture|emissiveTexture|uv1|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-uv1-base-emissive",
      label: "UV1 base + emissive",
      source: "sample",
      url: "/examples/assets/standard-uv1-base-emissive.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
      materialSlotSummary: {
        textureSlots: {
          baseColorTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
          emissiveTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
        },
        uv1Usage: {
          materials: 1,
          textureSlots: 2,
        },
      },
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-uri-base-color-checker.png",
            url: "/examples/assets/aperture-uri-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey:
              "standard|baseColorTexture|emissiveTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              emissiveFactor: [0.9, 0.28, 0.08],
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-emissive-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-emissive-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-emissive-\d+:texture:1:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-emissive-\d+:sampler:1:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: uv1PipelineKey,
            factors: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              emissiveFactor: [0.9, 0.28, 0.08],
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-emissive-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-emissive-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-emissive-\d+:texture:1:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-emissive-\d+:sampler:1:emissiveTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|emissiveTexture|opaque|back|less|none",
        uv1PipelineKey,
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: uv1PipelineKey,
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        }),
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 1,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 40,
            vertexCount: 4,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TEXCOORD_1", format: "float32x2", offset: 32 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(uv0, clear),
    `UV0 base/emissive control should render visible pixels; sample=${JSON.stringify(
      uv0,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1, clear),
    `UV1 base/emissive region should render visible pixels; sample=${JSON.stringify(
      uv1,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1A, uv1B),
    "UV1 base/emissive primitive should show texture-coordinate variation",
  ).toBeGreaterThan(4);
  expect(
    uv1Luminance.average - scalarLuminance.average,
    `emissive UV1 panel should be brighter than the scalar control; uv1=${JSON.stringify(
      uv1Luminance,
    )} scalar=${JSON.stringify(scalarLuminance)}`,
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(uv0, scalar) + pixelDistance(uv1, scalar),
    "textured base/emissive UV controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer UV1 metallic-roughness plus emissive textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-uv1-metallic-emissive",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const uv0 = resolutions[0]?.textureSlots ?? null;
      const uv1 = resolutions[1]?.textureSlots ?? null;
      const scalar = resolutions[2]?.textureSlots ?? null;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const uv1PipelineKey =
        "standard|emissiveTexture|metallicRoughnessTexture|uv1|opaque|back|less|none";
      const attributes =
        status?.gltf?.meshAttributes?.[1]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-uv1-metallic-emissive" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        resolutions[0]?.pipelineKey ===
          "standard|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none" &&
        resolutions[1]?.pipelineKey === uv1PipelineKey &&
        resolutions[1]?.factors?.emissiveFactor?.[0] === 0.9 &&
        uv0?.metallicRoughnessTexture?.texCoord === 0 &&
        uv0.emissiveTexture?.texCoord === 0 &&
        uv1?.metallicRoughnessTexture?.texCoord === 1 &&
        uv1.emissiveTexture?.texCoord === 1 &&
        scalar?.metallicRoughnessTexture === null &&
        scalar.emissiveTexture === null &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TEXCOORD_1" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[1]?.streams?.[0]?.arrayStride === 40 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true &&
        status.renderState?.pipelineKeys?.includes(uv1PipelineKey) === true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === uv1PipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        ) === true &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "UV1 metallic-roughness/emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "UV1 metallic-roughness/emissive viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv0Region = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const uv1Region = { minX: 0.41, minY: 0.34, maxX: 0.6, maxY: 0.66 };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const uv0 = strongestRegionSample(
    screenshot,
    clear,
    uv0Region.minX,
    uv0Region.minY,
    uv0Region.maxX,
    uv0Region.maxY,
  );
  const uv1 = strongestRegionSample(
    screenshot,
    clear,
    uv1Region.minX,
    uv1Region.minY,
    uv1Region.maxX,
    uv1Region.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const uv1A = readPngPixel(screenshot, 0.46, 0.46);
  const uv1B = readPngPixel(screenshot, 0.56, 0.58);
  const uv1PipelineKey =
    "standard|emissiveTexture|metallicRoughnessTexture|uv1|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-uv1-metallic-emissive",
      label: "UV1 MR + emissive",
      source: "sample",
      url: "/examples/assets/standard-uv1-metallic-emissive.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
      materialSlotSummary: {
        textureSlots: {
          metallicRoughnessTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
          emissiveTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
        },
        uv1Usage: {
          materials: 1,
          textureSlots: 2,
        },
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey:
              "standard|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: { texCoord: 0, hasTransform: false },
              emissiveTexture: { texCoord: 0, hasTransform: false },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: uv1PipelineKey,
            textureSlots: {
              metallicRoughnessTexture: { texCoord: 1, hasTransform: false },
              emissiveTexture: { texCoord: 1, hasTransform: false },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: null,
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none",
        uv1PipelineKey,
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: uv1PipelineKey,
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        }),
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(uv0, clear),
    `UV0 metallic/emissive control should render visible pixels; sample=${JSON.stringify(
      uv0,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1, clear),
    `UV1 metallic/emissive region should render visible pixels; sample=${JSON.stringify(
      uv1,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1A, uv1B),
    "UV1 metallic/emissive primitive should show texture-coordinate variation",
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(uv0, scalar) + pixelDistance(uv1, scalar),
    "textured metallic/emissive UV controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer occlusion and emissive texture sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=occlusion-emissive");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly occlusionTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "occlusion-emissive" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|emissiveTexture|occlusionTexture|opaque|none|less|none",
        ) === true &&
        resolution?.textureSlots?.occlusionTexture?.texCoord === 0 &&
        resolution.textureSlots.emissiveTexture?.texCoord === 0 &&
        resolution.factors?.emissiveFactor?.[0] === 0.55
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "occlusion/emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Occlusion/emissive viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const texturedEmissive = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "occlusion-emissive",
      label: "Occlusion emissive",
      source: "sample",
      url: "/examples/assets/occlusion-emissive.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey:
              "standard|emissiveTexture|occlusionTexture|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.06, 0.06, 0.07, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0.55, 0.18, 0.08],
            },
            textureSlots: {
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-occlusion-emissive-\d+:texture:0:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-occlusion-emissive-\d+:sampler:0:occlusionTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-occlusion-emissive-\d+:texture:1:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-occlusion-emissive-\d+:sampler:1:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              occlusionTexture: null,
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|emissiveTexture|occlusionTexture|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(texturedEmissive, clear),
    `occlusion/emissive textured region should render visible pixels; sample=${JSON.stringify(
      texturedEmissive,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(texturedEmissive, scalarControl),
    "occlusion/emissive textured primitive should differ from the scalar control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports an emissive texture transform in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=emissive-transform");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const transform = resolution?.textureSlots?.emissiveTexture?.transform;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "emissive-transform" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|emissiveTexture|opaque|none|less|none",
        ) === true &&
        resolution?.factors?.emissiveFactor?.[0] === 0.9 &&
        resolution.textureSlots?.emissiveTexture?.texCoord === 0 &&
        resolution.textureSlots.emissiveTexture.hasTransform === true &&
        transform?.offset?.[0] === 0.5 &&
        transform.offset[1] === 0 &&
        transform.scale?.[0] === 0.5 &&
        transform.scale[1] === 1 &&
        transform.rotation === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "emissive-transform viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Emissive-transform viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformedEmissive = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "emissive-transform",
      label: "Emissive transform",
      source: "sample",
      url: "/examples/assets/emissive-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|emissiveTexture|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.04, 0.04, 0.05, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0.9, 0.25, 0.08],
            },
            textureSlots: {
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-emissive-transform-\d+:texture:0:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-emissive-transform-\d+:sampler:0:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.15, 0.28, 0.72, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0, 0, 0],
            },
            textureSlots: {
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|emissiveTexture|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(transformedEmissive, clear),
    `emissive-transform region should render visible pixels; sample=${JSON.stringify(
      transformedEmissive,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformedEmissive, scalarControl),
    "emissive-transform textured primitive should differ from the scalar control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright compares transformed and untransformed emissive texture controls in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=emissive-transform-controls",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const transformed = resolutions[0]?.textureSlots?.emissiveTexture ?? null;
      const untransformed =
        resolutions[1]?.textureSlots?.emissiveTexture ?? null;
      const scalar = resolutions[2]?.textureSlots?.emissiveTexture ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "emissive-transform-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|emissiveTexture|opaque|back|less|none",
        ) === true &&
        transformed?.hasTransform === true &&
        transformed.transform?.offset?.[0] === 0.5 &&
        untransformed?.hasTransform === false &&
        scalar === null
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "emissive-transform controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Emissive-transform controls viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const untransformed = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "emissive-transform-controls",
      label: "Emissive transform controls",
      source: "sample",
      url: "/examples/assets/emissive-transform-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 3,
          materials: 3,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|emissiveTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.04, 0.04, 0.05, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0.9, 0.25, 0.08],
            },
            textureSlots: {
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-emissive-transform-controls-\d+:texture:0:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-emissive-transform-controls-\d+:sampler:0:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|emissiveTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.04, 0.04, 0.05, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0.9, 0.25, 0.08],
            },
            textureSlots: {
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-emissive-transform-controls-\d+:texture:0:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-emissive-transform-controls-\d+:sampler:0:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.15, 0.28, 0.72, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
              emissiveFactor: [0, 0, 0],
            },
            textureSlots: {
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|emissiveTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(transformed, clear),
    `transformed emissive control should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformed, untransformed),
    "transformed emissive primitive should differ from the untransformed emissive control",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(transformed, scalar),
    "transformed emissive primitive should differ from the scalar control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer occlusion texture transform sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=occlusion-transform");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly occlusionStrength?: number | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly occlusionTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const transform = resolution?.textureSlots?.occlusionTexture?.transform;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "occlusion-transform" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-occlusion-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|occlusionTexture|opaque|none|less|none",
        ) === true &&
        resolution?.factors?.occlusionStrength === 0.9 &&
        resolution.textureSlots?.occlusionTexture?.texCoord === 0 &&
        resolution.textureSlots.occlusionTexture.hasTransform === true &&
        transform?.offset?.[0] === 0.5 &&
        transform.scale?.[0] === 0.5 &&
        transform.rotation === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "occlusion-transform viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Occlusion-transform viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformedOcclusion = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("[255,180,180");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "occlusion-transform",
      label: "Occlusion transform",
      source: "sample",
      url: "/examples/assets/occlusion-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-occlusion-checker.png",
            url: "/examples/assets/aperture-occlusion-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|occlusionTexture|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.78, 0.72, 0.62, 1],
              metallicFactor: 0,
              roughnessFactor: 0.65,
              occlusionStrength: 0.9,
            },
            textureSlots: {
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-occlusion-transform-\d+:texture:0:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-occlusion-transform-\d+:sampler:0:occlusionTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              occlusionTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|occlusionTexture|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(transformedOcclusion, clear),
    `transformed occlusion region should render visible pixels; sample=${JSON.stringify(
      transformedOcclusion,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformedOcclusion, scalarControl),
    "transformed occlusion primitive should differ from the scalar control",
  ).toBeGreaterThan(10);
  webGpuValidation.expectNoWarnings();
});

test("Playwright compares transformed and untransformed occlusion texture controls in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=occlusion-transform-controls",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly occlusionStrength?: number | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly occlusionTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const transformed =
        resolutions[0]?.textureSlots?.occlusionTexture ?? null;
      const untransformed =
        resolutions[1]?.textureSlots?.occlusionTexture ?? null;
      const scalar = resolutions[2]?.textureSlots?.occlusionTexture ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "occlusion-transform-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-occlusion-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|occlusionTexture|opaque|back|less|none",
        ) === true &&
        resolutions[0]?.factors?.occlusionStrength === 0.9 &&
        transformed?.hasTransform === true &&
        transformed.transform?.offset?.[0] === 0.5 &&
        untransformed?.hasTransform === false &&
        scalar === null
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "occlusion-transform controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Occlusion-transform controls viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const untransformed = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "occlusion-transform-controls",
      label: "Occlusion transform controls",
      source: "sample",
      url: "/examples/assets/occlusion-transform-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-occlusion-checker.png",
            url: "/examples/assets/aperture-occlusion-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 3,
          materials: 3,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|occlusionTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.78, 0.72, 0.62, 1],
              metallicFactor: 0,
              roughnessFactor: 0.65,
              occlusionStrength: 0.9,
            },
            textureSlots: {
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-occlusion-transform-controls-\d+:texture:0:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-occlusion-transform-controls-\d+:sampler:0:occlusionTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|occlusionTexture|opaque|back|less|none",
            textureSlots: {
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-occlusion-transform-controls-\d+:texture:0:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-occlusion-transform-controls-\d+:sampler:0:occlusionTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              occlusionTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|occlusionTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(transformed, clear),
    `transformed occlusion control should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformed, untransformed),
    "transformed occlusion primitive should differ from the untransformed occlusion control",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(transformed, scalar) + pixelDistance(untransformed, scalar),
    "occlusion texture controls should differ from the scalar control",
  ).toBeGreaterThan(12);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer normal plus occlusion URI controls", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=normal-occlusion-controls");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly normalTexture?: TextureSlotStatus | null;
                    readonly occlusionTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const combined =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const normalOnly =
        status?.gltf?.primitiveMaterials?.resolutions?.[1] ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "normal-occlusion-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-normal-checker.png") &&
        decodedUris.has("aperture-occlusion-control.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|normalTexture|occlusionTexture|opaque|back|less|none",
        ) === true &&
        combined?.textureSlots?.normalTexture?.texCoord === 0 &&
        combined.textureSlots?.occlusionTexture?.texCoord === 0 &&
        normalOnly?.textureSlots?.normalTexture?.texCoord === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "normal/occlusion controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Normal/occlusion controls viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combinedRegion = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const normalOnlyRegion = {
    minX: 0.41,
    minY: 0.34,
    maxX: 0.6,
    maxY: 0.66,
  };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const combined = strongestRegionSample(
    screenshot,
    clear,
    combinedRegion.minX,
    combinedRegion.minY,
    combinedRegion.maxX,
    combinedRegion.maxY,
  );
  const normalOnly = strongestRegionSample(
    screenshot,
    clear,
    normalOnlyRegion.minX,
    normalOnlyRegion.minY,
    normalOnlyRegion.maxX,
    normalOnlyRegion.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const combinedLuminance = averageRegionLuminance(
    screenshot,
    clear,
    combinedRegion,
  );
  const normalOnlyLuminance = averageRegionLuminance(
    screenshot,
    clear,
    normalOnlyRegion,
  );
  const combinedPipelineKey =
    "standard|normalTexture|occlusionTexture|opaque|back|less|none";
  const normalOnlyPipelineKey = "standard|normalTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-occlusion-controls",
      label: "Normal occlusion controls",
      source: "sample",
      url: "/examples/assets/normal-occlusion-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-occlusion-control.png",
            url: "/examples/assets/aperture-occlusion-control.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 3,
          materials: 3,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [0.78, 0.72, 0.62, 1],
              metallicFactor: 0,
              roughnessFactor: 0.65,
              normalScale: 1.75,
              occlusionStrength: 1,
            },
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-occlusion-controls-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-occlusion-controls-\d+:sampler:0:normalTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-occlusion-controls-\d+:texture:1:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-occlusion-controls-\d+:sampler:1:occlusionTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: normalOnlyPipelineKey,
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-occlusion-controls-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-occlusion-controls-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              occlusionTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              normalTexture: null,
              occlusionTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        normalOnlyPipelineKey,
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(combined, clear),
    `combined normal/occlusion control should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    normalOnlyLuminance.average - combinedLuminance.average,
    `occlusion should darken the combined panel; combined=${JSON.stringify(
      combinedLuminance,
    )} normalOnly=${JSON.stringify(normalOnlyLuminance)}`,
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(normalOnly, scalar),
    "normal/occlusion URI controls should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer StandardMaterial occlusion plus normal map", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-occlusion-normal");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly normalTexture?: TextureSlotStatus | null;
                    readonly occlusionTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const combined = resolutions[0] ?? null;
      const normalOnly = resolutions[1] ?? null;
      const scalar = resolutions[2] ?? null;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];
      const combinedPipelineKey =
        "standard|normalTexture|occlusionTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-occlusion-normal" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-normal-checker.png") &&
        decodedUris.has("aperture-occlusion-control.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.textureSlots?.normalTexture?.texCoord === 0 &&
        combined.textureSlots?.occlusionTexture?.texCoord === 0 &&
        normalOnly?.pipelineKey ===
          "standard|normalTexture|opaque|back|less|none" &&
        normalOnly.textureSlots?.normalTexture?.texCoord === 0 &&
        normalOnly.textureSlots?.occlusionTexture === null &&
        scalar?.pipelineKey === "standard|opaque|back|less|none" &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TANGENT" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === combinedPipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        ) === true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "StandardMaterial occlusion plus normal viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "StandardMaterial occlusion plus normal viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combinedRegion = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const normalOnlyRegion = {
    minX: 0.41,
    minY: 0.34,
    maxX: 0.6,
    maxY: 0.66,
  };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const combinedA = readPngPixel(screenshot, 0.28, 0.46);
  const combinedB = readPngPixel(screenshot, 0.36, 0.58);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    combinedRegion.minX,
    combinedRegion.minY,
    combinedRegion.maxX,
    combinedRegion.maxY,
  );
  const normalOnly = strongestRegionSample(
    screenshot,
    clear,
    normalOnlyRegion.minX,
    normalOnlyRegion.minY,
    normalOnlyRegion.maxX,
    normalOnlyRegion.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const combinedLuminance = averageRegionLuminance(
    screenshot,
    clear,
    combinedRegion,
  );
  const normalOnlyLuminance = averageRegionLuminance(
    screenshot,
    clear,
    normalOnlyRegion,
  );
  const combinedPipelineKey =
    "standard|normalTexture|occlusionTexture|opaque|back|less|none";
  const normalOnlyPipelineKey = "standard|normalTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-occlusion-normal",
      label: "Occlusion + normal texture",
      source: "sample",
      url: "/examples/assets/standard-occlusion-normal.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-occlusion-control.png",
            url: "/examples/assets/aperture-occlusion-control.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 3,
          materials: 3,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [0.78, 0.72, 0.62, 1],
              metallicFactor: 0,
              roughnessFactor: 0.65,
              normalScale: 1.75,
              occlusionStrength: 1,
            },
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-occlusion-normal-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-occlusion-normal-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-occlusion-normal-\d+:texture:1:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-occlusion-normal-\d+:sampler:1:occlusionTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: normalOnlyPipelineKey,
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-occlusion-normal-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-occlusion-normal-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              occlusionTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              normalTexture: null,
              occlusionTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        normalOnlyPipelineKey,
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 0,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 48,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(combined, clear),
    `combined normal/occlusion region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combinedA, combinedB),
    "combined normal/occlusion primitive should show normal-map lighting variation",
  ).toBeGreaterThan(4);
  expect(
    normalOnlyLuminance.average - combinedLuminance.average,
    `occlusion should darken the combined panel; combined=${JSON.stringify(
      combinedLuminance,
    )} normalOnly=${JSON.stringify(normalOnlyLuminance)}`,
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(normalOnly, scalar),
    "normal/occlusion StandardMaterial sample should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer alpha-mask texture sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=alpha-mask");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly alphaMode?: string | null;
                  readonly alphaCutoff?: number | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "alpha-mask" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|mask|none|less|none",
        ) === true &&
        resolution?.alphaMode === "mask" &&
        resolution.alphaCutoff === 0.5 &&
        resolution.textureSlots?.baseColorTexture?.texCoord === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "alpha-mask viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Alpha-mask viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const alphaMasked = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const maskedProbe = readPngPixel(screenshot, 0.43, 0.43);
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "alpha-mask",
      label: "Alpha mask",
      source: "sample",
      url: "/examples/assets/alpha-mask.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-alpha-mask-checker.png",
            url: "/examples/assets/aperture-alpha-mask-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "mask",
            alphaCutoff: 0.5,
            blendPreset: "none",
            depthWrite: true,
            cullMode: "none",
            pipelineKey: "standard|baseColorTexture|mask|none|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-alpha-mask-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-alpha-mask-\d+:sampler:0:baseColorTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|mask|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(alphaMasked, clear),
    `alpha-mask textured region should render opaque visible pixels; sample=${JSON.stringify(
      alphaMasked,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(maskedProbe, clear),
    `alpha-mask transparent probe should stay close to clear; sample=${JSON.stringify(
      maskedProbe,
    )}`,
  ).toBeLessThan(25);
  expect(
    pixelDistance(alphaMasked, scalarControl),
    "alpha-mask textured primitive should differ from the scalar control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer alpha-mask plus normal-map sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-alpha-normal");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly alphaMode?: string | null;
                  readonly alphaCutoff?: number | null;
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const combined =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const alphaOnly =
        status?.gltf?.primitiveMaterials?.resolutions?.[1] ?? null;
      const scalar = status?.gltf?.primitiveMaterials?.resolutions?.[2] ?? null;
      const combinedPipelineKey =
        "standard|baseColorTexture|normalTexture|mask|none|less|none";
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-alpha-normal" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-alpha-mask-checker.png") &&
        decodedUris.has("aperture-normal-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.alphaMode === "mask" &&
        combined.alphaCutoff === 0.5 &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots?.normalTexture?.texCoord === 0 &&
        alphaOnly?.pipelineKey ===
          "standard|baseColorTexture|mask|none|less|none" &&
        alphaOnly.textureSlots?.baseColorTexture?.texCoord === 0 &&
        alphaOnly.textureSlots?.normalTexture === null &&
        scalar?.pipelineKey === "standard|opaque|none|less|none" &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TANGENT" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === combinedPipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        ) === true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "alpha-mask plus normal viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Alpha-mask plus normal viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const alphaOnly = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );
  const maskedProbe = readPngPixel(screenshot, 0.36, 0.43);
  const combinedPipelineKey =
    "standard|baseColorTexture|normalTexture|mask|none|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-alpha-normal",
      label: "Alpha mask + normal",
      source: "sample",
      url: "/examples/assets/standard-alpha-normal.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-alpha-mask-checker.png",
            url: "/examples/assets/aperture-alpha-mask-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "mask",
            alphaCutoff: 0.5,
            pipelineKey: combinedPipelineKey,
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-alpha-normal-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-alpha-normal-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-alpha-normal-\d+:texture:1:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-alpha-normal-\d+:sampler:1:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "mask",
            alphaCutoff: 0.5,
            pipelineKey: "standard|baseColorTexture|mask|none|less|none",
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              normalTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|baseColorTexture|mask|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(
    pixelDistance(combined, clear),
    `alpha-mask plus normal region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(maskedProbe, clear),
    `alpha-mask plus normal transparent probe should stay close to clear; sample=${JSON.stringify(
      maskedProbe,
    )}`,
  ).toBeLessThan(25);
  expect(
    pixelDistance(combined, alphaOnly),
    "normal map should change the alpha-mask textured primitive",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(alphaOnly, scalar),
    "alpha-mask controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer alpha-mask plus metallic-roughness textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-alpha-metallic");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly alphaMode?: string | null;
                  readonly alphaCutoff?: number | null;
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const combined =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const alphaOnly =
        status?.gltf?.primitiveMaterials?.resolutions?.[1] ?? null;
      const scalar = status?.gltf?.primitiveMaterials?.resolutions?.[2] ?? null;
      const combinedPipelineKey =
        "standard|baseColorTexture|metallicRoughnessTexture|mask|none|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-alpha-metallic" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-alpha-mask-checker.png") &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.alphaMode === "mask" &&
        combined.alphaCutoff === 0.5 &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        alphaOnly?.pipelineKey ===
          "standard|baseColorTexture|mask|none|less|none" &&
        alphaOnly.textureSlots?.baseColorTexture?.texCoord === 0 &&
        alphaOnly.textureSlots?.metallicRoughnessTexture === null &&
        scalar?.pipelineKey === "standard|opaque|none|less|none" &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "alpha-mask plus metallic-roughness viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Alpha-mask plus metallic-roughness viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const alphaOnly = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );
  const maskedProbe = readPngPixel(screenshot, 0.36, 0.43);
  const combinedPipelineKey =
    "standard|baseColorTexture|metallicRoughnessTexture|mask|none|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-alpha-metallic",
      label: "Alpha mask + MR",
      source: "sample",
      url: "/examples/assets/standard-alpha-metallic.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "mask",
            alphaCutoff: 0.5,
            depthWrite: true,
            cullMode: "none",
            pipelineKey: combinedPipelineKey,
            textureSlots: {
              baseColorTexture: { texCoord: 0, hasTransform: false },
              metallicRoughnessTexture: { texCoord: 0, hasTransform: false },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "mask",
            alphaCutoff: 0.5,
            pipelineKey: "standard|baseColorTexture|mask|none|less|none",
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              metallicRoughnessTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
              metallicRoughnessTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|baseColorTexture|mask|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(
    pixelDistance(combined, clear),
    `alpha-mask plus metallic-roughness region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(maskedProbe, clear),
    `alpha-mask plus metallic-roughness transparent probe should stay close to clear; sample=${JSON.stringify(
      maskedProbe,
    )}`,
  ).toBeLessThan(25);
  expect(
    pixelDistance(combined, alphaOnly),
    "metallic-roughness texture should change the alpha-mask textured primitive",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(alphaOnly, scalar),
    "alpha-mask metallic controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer alpha-mask plus emissive URI controls", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=alpha-mask-emissive-controls",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly alphaMode?: string | null;
                  readonly alphaCutoff?: number | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const combined =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const alphaOnly =
        status?.gltf?.primitiveMaterials?.resolutions?.[1] ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "alpha-mask-emissive-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-alpha-mask-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|emissiveTexture|mask|none|less|none",
        ) === true &&
        combined?.alphaMode === "mask" &&
        combined.alphaCutoff === 0.5 &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots.emissiveTexture?.texCoord === 0 &&
        alphaOnly?.alphaMode === "mask" &&
        alphaOnly.alphaCutoff === 0.5 &&
        alphaOnly.textureSlots?.baseColorTexture?.texCoord === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "alpha-mask emissive controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Alpha-mask emissive controls viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const alphaOnly = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );
  const serializedStatus = JSON.stringify(status);
  const combinedPipelineKey =
    "standard|baseColorTexture|emissiveTexture|mask|none|less|none";
  const alphaOnlyPipelineKey = "standard|baseColorTexture|mask|none|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("[255,118,64");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "alpha-mask-emissive-controls",
      label: "Alpha mask emissive controls",
      source: "sample",
      url: "/examples/assets/alpha-mask-emissive-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-alpha-mask-checker.png",
            url: "/examples/assets/aperture-alpha-mask-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 3,
          materials: 3,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "mask",
            alphaCutoff: 0.5,
            blendPreset: "none",
            depthWrite: true,
            cullMode: "none",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [0.22, 0.22, 0.22, 1],
              metallicFactor: 0,
              roughnessFactor: 0.68,
              emissiveFactor: [1, 0.75, 0.2],
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-alpha-mask-emissive-controls-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-alpha-mask-emissive-controls-\d+:sampler:0:baseColorTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-alpha-mask-emissive-controls-\d+:texture:1:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-alpha-mask-emissive-controls-\d+:sampler:1:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "mask",
            alphaCutoff: 0.5,
            blendPreset: "none",
            depthWrite: true,
            cullMode: "none",
            pipelineKey: alphaOnlyPipelineKey,
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-alpha-mask-emissive-controls-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-alpha-mask-emissive-controls-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        alphaOnlyPipelineKey,
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(combined, clear),
    `combined alpha-mask/emissive control should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combined, alphaOnly),
    "combined alpha-mask/emissive primitive should differ from the alpha-mask-only control",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(alphaOnly, scalar),
    "alpha-mask URI controls should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer alpha-blend texture sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=alpha-blend-texture");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly alphaMode?: string | null;
                  readonly blendPreset?: string | null;
                  readonly depthWrite?: boolean | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly queues?: readonly string[];
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "alpha-blend-texture" &&
        status.selectedAsset.loading === false &&
        status.source?.imageDecode?.decoded?.some(
          (entry) => entry.uri === "aperture-alpha-blend-checker.png",
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2 &&
        status.renderState?.queues?.includes("transparent") === true &&
        status.renderState.pipelineKeys?.includes(
          "standard|baseColorTexture|blend|none|less|alpha",
        ) === true &&
        resolution?.alphaMode === "blend" &&
        resolution.blendPreset === "alpha" &&
        resolution.depthWrite === false &&
        resolution.textureSlots?.baseColorTexture?.texCoord === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "alpha-blend viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Alpha-blend viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const translucentA = readPngPixel(screenshot, 0.35, 0.43);
  const translucentB = readPngPixel(screenshot, 0.43, 0.57);
  const opaqueControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "alpha-blend-texture",
      label: "Alpha blend texture",
      source: "sample",
      url: "/examples/assets/alpha-blend-texture.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-alpha-blend-checker.png",
            url: "/examples/assets/aperture-alpha-blend-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "blend",
            alphaCutoff: 0.5,
            blendPreset: "alpha",
            depthWrite: false,
            cullMode: "none",
            pipelineKey: "standard|baseColorTexture|blend|none|less|alpha",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-alpha-blend-texture-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-alpha-blend-texture-\d+:sampler:0:baseColorTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      queues: expect.arrayContaining(["opaque", "transparent"]),
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|blend|none|less|alpha",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(translucentA, clear),
    `alpha-blend textured pixel should differ from clear; sample=${JSON.stringify(
      translucentA,
    )}`,
  ).toBeGreaterThan(10);
  expect(
    pixelDistance(translucentA, opaqueControl) +
      pixelDistance(translucentB, opaqueControl),
    "alpha-blend texture should differ from the opaque control primitive",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer alpha-blend plus emissive textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-alpha-blend-emissive",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly alphaMode?: string | null;
                  readonly blendPreset?: string | null;
                  readonly depthWrite?: boolean | null;
                  readonly cullMode?: string | null;
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                  readonly factors?: {
                    readonly emissiveFactor?: readonly number[] | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly queues?: readonly string[];
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const combined =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const scalar = status?.gltf?.primitiveMaterials?.resolutions?.[1] ?? null;
      const combinedPipelineKey =
        "standard|baseColorTexture|emissiveTexture|blend|none|less|alpha";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-alpha-blend-emissive" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-alpha-blend-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        combined?.alphaMode === "blend" &&
        combined.blendPreset === "alpha" &&
        combined.depthWrite === false &&
        combined.cullMode === "none" &&
        combined.pipelineKey === combinedPipelineKey &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots.emissiveTexture?.texCoord === 0 &&
        combined.factors?.emissiveFactor?.[0] === 0.95 &&
        scalar?.pipelineKey === "standard|opaque|none|less|none" &&
        scalar.textureSlots?.baseColorTexture === null &&
        scalar.textureSlots.emissiveTexture === null &&
        status.renderState?.queues?.includes("transparent") === true &&
        status.renderState.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "alpha-blend plus emissive viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Alpha-blend plus emissive viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );
  const translucentA = readPngPixel(screenshot, 0.35, 0.43);
  const translucentB = readPngPixel(screenshot, 0.43, 0.57);
  const combinedPipelineKey =
    "standard|baseColorTexture|emissiveTexture|blend|none|less|alpha";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-alpha-blend-emissive",
      label: "Alpha blend + emissive",
      source: "sample",
      url: "/examples/assets/standard-alpha-blend-emissive.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-alpha-blend-checker.png",
            url: "/examples/assets/aperture-alpha-blend-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "blend",
            alphaCutoff: 0.5,
            blendPreset: "alpha",
            depthWrite: false,
            cullMode: "none",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.68,
              emissiveFactor: [0.95, 0.48, 0.12],
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-alpha-blend-emissive-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-alpha-blend-emissive-\d+:sampler:0:baseColorTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-alpha-blend-emissive-\d+:texture:1:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-alpha-blend-emissive-\d+:sampler:1:emissiveTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
              emissiveTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      queues: expect.arrayContaining(["opaque", "transparent"]),
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(combined, clear),
    `alpha-blend/emissive region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(10);
  expect(
    pixelDistance(translucentA, translucentB),
    "alpha-blend/emissive primitive should show texture variation",
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(combined, scalar) +
      pixelDistance(translucentA, scalar) +
      pixelDistance(translucentB, scalar),
    "alpha-blend/emissive primitive should differ from the opaque scalar control",
  ).toBeGreaterThan(30);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer alpha-blend texture plus normal map", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-alpha-blend-normal",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly alphaMode?: string | null;
                  readonly blendPreset?: string | null;
                  readonly depthWrite?: boolean | null;
                  readonly cullMode?: string | null;
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly queues?: readonly string[];
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const combined = resolutions[0] ?? null;
      const opaqueBase = resolutions[1] ?? null;
      const scalar = resolutions[2] ?? null;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];
      const combinedPipelineKey =
        "standard|baseColorTexture|normalTexture|blend|none|less|alpha";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-alpha-blend-normal" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-alpha-mask-checker.png") &&
        decodedUris.has("aperture-normal-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.alphaMode === "blend" &&
        combined.blendPreset === "alpha" &&
        combined.depthWrite === false &&
        combined.cullMode === "none" &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots?.normalTexture?.texCoord === 0 &&
        opaqueBase?.pipelineKey ===
          "standard|baseColorTexture|opaque|none|less|none" &&
        opaqueBase.textureSlots?.baseColorTexture?.texCoord === 0 &&
        opaqueBase.textureSlots?.normalTexture === null &&
        scalar?.pipelineKey === "standard|opaque|none|less|none" &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TANGENT" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        status.renderState?.queues?.includes("transparent") === true &&
        status.renderState.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === combinedPipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        ) === true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "alpha-blend plus normal viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Alpha-blend plus normal viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const translucentA = readPngPixel(screenshot, 0.28, 0.46);
  const translucentB = readPngPixel(screenshot, 0.36, 0.58);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const opaqueBase = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );
  const combinedPipelineKey =
    "standard|baseColorTexture|normalTexture|blend|none|less|alpha";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-alpha-blend-normal",
      label: "Alpha blend + normal",
      source: "sample",
      url: "/examples/assets/standard-alpha-blend-normal.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-alpha-mask-checker.png",
            url: "/examples/assets/aperture-alpha-mask-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "blend",
            alphaCutoff: 0.5,
            blendPreset: "alpha",
            depthWrite: false,
            cullMode: "none",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.62,
              normalScale: 2.5,
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-alpha-blend-normal-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-alpha-blend-normal-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-alpha-blend-normal-\d+:texture:1:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-alpha-blend-normal-\d+:sampler:1:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              normalTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      queues: expect.arrayContaining(["opaque", "transparent"]),
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|baseColorTexture|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(
    pixelDistance(combined, clear),
    `alpha-blend normal region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(10);
  expect(
    pixelDistance(translucentA, translucentB),
    "alpha-blend normal primitive should show normal-map or alpha texture variation",
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(translucentA, opaqueBase) +
      pixelDistance(translucentB, opaqueBase),
    "alpha-blend normal primitive should differ from the opaque base control",
  ).toBeGreaterThan(18);
  expect(
    pixelDistance(combined, scalar) + pixelDistance(opaqueBase, scalar),
    "alpha-blend normal sample should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports non-default sampler state for a textured GLB viewer sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=sampler-state");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const sampler =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.textureSlots
          ?.baseColorTexture?.sampler;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "sampler-state" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|opaque|none|less|none",
        ) === true &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true &&
        sampler?.status === "ready" &&
        sampler.addressModeU === "clamp-to-edge" &&
        sampler.addressModeV === "mirror-repeat" &&
        sampler.magFilter === "nearest" &&
        sampler.minFilter === "nearest" &&
        sampler.mipmapFilter === "linear"
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "sampler-state viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Sampler-state viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const texturedWarm = readPngPixel(screenshot, 0.32, 0.42);
  const texturedCool = readPngPixel(screenshot, 0.44, 0.58);
  const scalarControl = readPngPixel(screenshot, 0.64, 0.5);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "sampler-state",
      label: "Sampler state",
      source: "sample",
      url: "/examples/assets/sampler-state.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: {
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-sampler-state-\d+:sampler:0:baseColorTexture$/,
                ),
                sampler: {
                  status: "ready",
                  addressModeU: "clamp-to-edge",
                  addressModeV: "mirror-repeat",
                  addressModeW: "repeat",
                  magFilter: "nearest",
                  minFilter: "nearest",
                  mipmapFilter: "linear",
                  maxAnisotropy: 1,
                },
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(texturedWarm, clear),
    `sampler-state textured region should render visible pixels; sample=${JSON.stringify(
      texturedWarm,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(texturedWarm, texturedCool),
    "sampler-state base-color texture should create visible variation",
  ).toBeGreaterThan(10);
  expect(
    pixelDistance(texturedWarm, scalarControl) +
      pixelDistance(texturedCool, scalarControl),
    "sampler-state textured primitive should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright compares repeat and clamp sampler wrap controls in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=sampler-wrap-controls");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const repeatSampler =
        resolutions[0]?.textureSlots?.baseColorTexture?.sampler;
      const clampSampler =
        resolutions[1]?.textureSlots?.baseColorTexture?.sampler;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "sampler-wrap-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-base-color-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|opaque|back|less|none",
        ) === true &&
        repeatSampler?.addressModeU === "repeat" &&
        repeatSampler.addressModeV === "repeat" &&
        clampSampler?.addressModeU === "clamp-to-edge" &&
        clampSampler.addressModeV === "clamp-to-edge"
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "sampler-wrap controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Sampler-wrap controls viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const repeat = readPngPixel(screenshot, 0.28, 0.5);
  const clamp = readPngPixel(screenshot, 0.49, 0.5);
  const scalar = readPngPixel(screenshot, 0.72, 0.5);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "sampler-wrap-controls",
      label: "Sampler wrap controls",
      source: "sample",
      url: "/examples/assets/sampler-wrap-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-sampler-wrap-controls-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-sampler-wrap-controls-\d+:sampler:0:baseColorTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  addressModeU: "repeat",
                  addressModeV: "repeat",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-sampler-wrap-controls-\d+:texture:1:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-sampler-wrap-controls-\d+:sampler:1:baseColorTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  addressModeU: "clamp-to-edge",
                  addressModeV: "clamp-to-edge",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(repeat, clear),
    `repeat sampler control should render visible pixels; sample=${JSON.stringify(
      repeat,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(repeat, clamp),
    "repeat and clamp sampler controls should produce different pixels",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(repeat, scalar) + pixelDistance(clamp, scalar),
    "sampler wrap textured controls should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports texture-transform metadata for a textured GLB viewer sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=texture-transform");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const baseColor =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.textureSlots
          ?.baseColorTexture;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "texture-transform" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|opaque|back|less|none",
        ) === true &&
        baseColor?.hasTransform === true &&
        baseColor.transform?.offset?.[0] === 0.5 &&
        baseColor.transform?.scale?.[0] === 0.5
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "texture-transform viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Texture-transform viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    0.28,
    0.34,
    0.47,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "texture-transform",
      label: "Texture transform",
      source: "sample",
      url: "/examples/assets/texture-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(transformed, clear),
    `texture-transform region should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformed, scalarControl),
    "transformed texture region should differ from the scalar control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports a missing TEXCOORD_1 GLB viewer diagnostic while rendering the control primitive", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=missing-texcoord1");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly {
                readonly code?: string;
                readonly field?: string;
                readonly texCoord?: number;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const baseColor =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.textureSlots
          ?.baseColorTexture;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "missing-texcoord1" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 1 &&
        status.extraction.diagnostics === 1 &&
        status.draw?.drawCalls === 1 &&
        baseColor?.texCoord === 1 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
              "render.standardMaterialTexture.missingTexCoord1" &&
            diagnostic.field === "baseColorTexture" &&
            diagnostic.texCoord === 1,
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "missing-TEXCOORD_1 viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Missing-TEXCOORD_1 viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "missing-texcoord1",
      label: "Missing UV1",
      source: "sample",
      url: "/examples/assets/missing-texcoord1.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: "standard|baseColorTexture|uv1|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-missing-texcoord1-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-missing-texcoord1-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 1,
      diagnosticsList: [
        expect.objectContaining({
          code: "render.standardMaterialTexture.missingTexCoord1",
          severity: "warning",
          materialKey: expect.stringMatching(
            /^material:viewer-missing-texcoord1-\d+:material:0$/,
          ),
          meshKey: expect.stringMatching(
            /^mesh:viewer-missing-texcoord1-\d+:mesh:0:primitive:0$/,
          ),
          textureKey: expect.stringMatching(
            /^texture:viewer-missing-texcoord1-\d+:texture:0:baseColorTexture$/,
          ),
          field: "baseColorTexture",
          texCoord: 1,
        }),
      ],
    },
    renderState: {
      pipelineKeys: ["standard|opaque|none|less|none"],
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(scalarControl, clear),
    `missing-TEXCOORD_1 scalar control should render visible pixels; sample=${JSON.stringify(
      scalarControl,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer base-color texture through TEXCOORD_1", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=uv1-base-color");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const baseColor =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.textureSlots
          ?.baseColorTexture;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "uv1-base-color" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|uv1|opaque|none|less|none",
        ) === true &&
        baseColor?.texCoord === 1 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "UV1 base-color viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("UV1 base-color viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv1Textured = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "uv1-base-color",
      label: "UV1 base color",
      source: "sample",
      url: "/examples/assets/uv1-base-color.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: "standard|baseColorTexture|uv1|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-uv1-base-color-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-uv1-base-color-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|uv1|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(uv1Textured, clear),
    `UV1 base-color region should render visible pixels; sample=${JSON.stringify(
      uv1Textured,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1Textured, scalarControl),
    "UV1 base-color textured primitive should differ from the scalar control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright compares UV0 and UV1 image-decode controls in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=uv1-image-decode-controls");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const uv0 = resolutions[0]?.textureSlots?.baseColorTexture ?? null;
      const uv1 = resolutions[1]?.textureSlots?.baseColorTexture ?? null;
      const scalar = resolutions[2]?.textureSlots?.baseColorTexture ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "uv1-image-decode-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-base-color-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|opaque|back|less|none",
        ) === true &&
        status.renderState.pipelineKeys.includes(
          "standard|baseColorTexture|uv1|opaque|back|less|none",
        ) === true &&
        uv0?.texCoord === 0 &&
        uv1?.texCoord === 1 &&
        scalar === null &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "UV1 image-decode controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("UV1 image-decode controls viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv0 = readPngPixel(screenshot, 0.28, 0.5);
  const uv1 = readPngPixel(screenshot, 0.49, 0.5);
  const scalar = readPngPixel(screenshot, 0.72, 0.5);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "uv1-image-decode-controls",
      label: "UV1 image decode controls",
      source: "sample",
      url: "/examples/assets/uv1-image-decode-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-uv1-image-decode-controls-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-uv1-image-decode-controls-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|baseColorTexture|uv1|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-uv1-image-decode-controls-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-uv1-image-decode-controls-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|baseColorTexture|uv1|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(uv0, clear),
    `UV0 image-decode control should render visible pixels; sample=${JSON.stringify(
      uv0,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv0, uv1),
    "UV0 and UV1 image-decode controls should produce different pixels",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(uv0, scalar) + pixelDistance(uv1, scalar),
    "UV image-decode textured controls should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer metallic-roughness texture through TEXCOORD_1", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=metallic-roughness-uv1");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const metallicRoughness =
        status?.gltf?.primitiveMaterials?.resolutions?.[0]?.textureSlots
          ?.metallicRoughnessTexture;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "metallic-roughness-uv1" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|metallicRoughnessTexture|uv1|opaque|none|less|none",
        ) === true &&
        metallicRoughness?.texCoord === 1 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "metallic-roughness UV1 viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Metallic-roughness UV1 viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textured = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "metallic-roughness-uv1",
      label: "Metallic roughness UV1",
      source: "sample",
      url: "/examples/assets/metallic-roughness-uv1.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey:
              "standard|metallicRoughnessTexture|uv1|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.72, 0.68, 0.58, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
            },
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-metallic-roughness-uv1-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-metallic-roughness-uv1-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                sampler: expect.objectContaining({
                  status: "ready",
                  magFilter: "nearest",
                  minFilter: "nearest",
                }),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.72, 0.68, 0.58, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
            },
            textureSlots: {
              metallicRoughnessTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|metallicRoughnessTexture|uv1|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(textured, clear),
    `metallic-roughness UV1 region should render visible pixels; sample=${JSON.stringify(
      textured,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(textured, scalarControl),
    "metallic-roughness UV1 primitive should differ from the scalar control",
  ).toBeGreaterThan(15);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports a rotated metallic-roughness texture transform in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=rotated-metallic-roughness-transform",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly metallicFactor?: number | null;
                    readonly roughnessFactor?: number | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const transform =
        resolution?.textureSlots?.metallicRoughnessTexture?.transform;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "rotated-metallic-roughness-transform" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|metallicRoughnessTexture|opaque|none|less|none",
        ) === true &&
        resolution?.factors?.metallicFactor === 1 &&
        resolution.factors.roughnessFactor === 1 &&
        resolution.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        resolution.textureSlots.metallicRoughnessTexture.hasTransform ===
          true &&
        transform?.rotation === 1.571
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "rotated metallic-roughness transform viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Rotated metallic-roughness transform viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    0.27,
    0.34,
    0.46,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.54,
    0.34,
    0.73,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "rotated-metallic-roughness-transform",
      label: "Rotated MR transform",
      source: "sample",
      url: "/examples/assets/rotated-metallic-roughness-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey:
              "standard|metallicRoughnessTexture|opaque|none|less|none",
            factors: {
              baseColorFactor: [0.72, 0.68, 0.58, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
            },
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-rotated-metallic-roughness-transform-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-rotated-metallic-roughness-transform-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0, 0],
                  scale: [1, 1],
                  rotation: 1.571,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|opaque|none|less|none",
            textureSlots: {
              metallicRoughnessTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|metallicRoughnessTexture|opaque|none|less|none",
        "standard|opaque|none|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(transformed, clear),
    `rotated metallic-roughness transform region should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformed, scalarControl),
    "rotated metallic-roughness texture should differ from the scalar control",
  ).toBeGreaterThan(15);
  webGpuValidation.expectNoWarnings();
});

test("Playwright compares transformed and untransformed metallic-roughness texture controls in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=metallic-roughness-transform-controls",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly metallicFactor?: number | null;
                    readonly roughnessFactor?: number | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const transformed =
        resolutions[0]?.textureSlots?.metallicRoughnessTexture ?? null;
      const untransformed =
        resolutions[1]?.textureSlots?.metallicRoughnessTexture ?? null;
      const scalar =
        resolutions[2]?.textureSlots?.metallicRoughnessTexture ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "metallic-roughness-transform-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-metallic-roughness-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|metallicRoughnessTexture|opaque|back|less|none",
        ) === true &&
        resolutions[0]?.factors?.metallicFactor === 1 &&
        resolutions[0].factors.roughnessFactor === 1 &&
        transformed?.hasTransform === true &&
        transformed.transform?.offset?.[0] === 0.5 &&
        untransformed?.hasTransform === false &&
        scalar === null
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "metallic-roughness transform controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Metallic-roughness transform controls viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    0.2,
    0.34,
    0.39,
    0.66,
  );
  const untransformed = strongestRegionSample(
    screenshot,
    clear,
    0.41,
    0.34,
    0.6,
    0.66,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    0.62,
    0.34,
    0.81,
    0.66,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "metallic-roughness-transform-controls",
      label: "MR transform controls",
      source: "sample",
      url: "/examples/assets/metallic-roughness-transform-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 3,
          materials: 3,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey:
              "standard|metallicRoughnessTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.86, 0.72, 0.48, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
            },
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-metallic-roughness-transform-controls-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-metallic-roughness-transform-controls-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey:
              "standard|metallicRoughnessTexture|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-metallic-roughness-transform-controls-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-metallic-roughness-transform-controls-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|metallicRoughnessTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(transformed, clear),
    `transformed metallic-roughness control should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformed, untransformed),
    "transformed metallic-roughness primitive should differ from the untransformed control",
  ).toBeGreaterThan(4);
  expect(
    pixelDistance(transformed, scalar) + pixelDistance(untransformed, scalar),
    "metallic-roughness texture controls should differ from the scalar control",
  ).toBeGreaterThan(12);
  webGpuValidation.expectNoWarnings();
});

test("Playwright clamps and repeats GLB viewer animation loop modes", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=animated");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForAnimationControlStatus(page, { status: "playing", speed: 1 });
  await page.locator("#glb-animation-toggle").click();
  await waitForAnimationControlStatus(page, { status: "paused", speed: 1 });
  await setRangeInputValue(page, "#glb-animation-scrub", 3.9);
  await setRangeInputValue(page, "#glb-animation-speed", 2);
  await setSelectInputValue(page, "#glb-animation-loop", "once");
  await page.locator("#glb-animation-toggle").click();

  await page.waitForFunction(
    () => {
      const animation = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly animation?: {
              readonly status?: string;
              readonly time?: number;
              readonly loopMode?: string;
              readonly clamped?: boolean;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.animation;

      return (
        animation?.status === "playing" &&
        animation.loopMode === "once" &&
        animation.clamped === true &&
        Math.abs((animation.time ?? 0) - 4) < 0.001
      );
    },
    undefined,
    { timeout: 3000 },
  );
  const clampedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const clampedScreenshot = await page.locator("#aperture-canvas").screenshot();
  const clampedFrame = clampedStatus?.frame ?? 0;

  await waitForAnimationFrameAdvance(page, clampedFrame + 8);
  const clampedLaterStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const clampedLaterScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(clampedLaterStatus?.animation).toMatchObject({
    status: "playing",
    loopMode: "once",
    clamped: true,
    time: 4,
  });
  expect(
    maxSampleDelta(clampedScreenshot, clampedLaterScreenshot),
    "once loop mode should hold final rendered pixels after clamping",
  ).toBeLessThan(3);

  await page.locator("#glb-animation-toggle").click();
  await setRangeInputValue(page, "#glb-animation-scrub", 3.9);
  await setSelectInputValue(page, "#glb-animation-loop", "repeat");
  await page.locator("#glb-animation-toggle").click();
  await page.waitForFunction(
    () => {
      const animation = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly animation?: {
              readonly status?: string;
              readonly time?: number;
              readonly loopMode?: string;
              readonly clamped?: boolean;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.animation;

      return (
        animation?.status === "playing" &&
        animation.loopMode === "repeat" &&
        animation.clamped === false &&
        (animation.time ?? 4) < 0.5
      );
    },
    undefined,
    { timeout: 3000 },
  );
  const repeatStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(repeatStatus?.animation).toMatchObject({
    status: "playing",
    loopMode: "repeat",
    clamped: false,
  });
  webGpuValidation.expectNoWarnings();
});

test("Playwright reverses GLB viewer animation playback", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=animated");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForAnimationControlStatus(page, { status: "playing", speed: 1 });
  await page.locator("#glb-animation-toggle").click();
  await waitForAnimationControlStatus(page, { status: "paused", speed: 1 });
  await setRangeInputValue(page, "#glb-animation-scrub", 2);
  const pausedStatus = await waitForAnimationControlStatus(page, {
    status: "paused",
    speed: 1,
    time: 2,
  });
  const pausedX =
    pausedStatus.animation?.animatedNodes[0]?.value[0] ?? Number.NaN;

  await setSelectInputValue(page, "#glb-animation-direction", "reverse");
  await page.locator("#glb-animation-toggle").click();
  await page.waitForFunction(
    ({ time, x }) => {
      const animation = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly animation?: {
              readonly status?: string;
              readonly time?: number;
              readonly direction?: string;
              readonly animatedNodes?: readonly {
                readonly value?: readonly number[];
              }[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.animation;
      const nextX = animation?.animatedNodes?.[0]?.value?.[0];

      return (
        animation?.status === "playing" &&
        animation.direction === "reverse" &&
        (animation.time ?? 4) < time - 0.15 &&
        typeof nextX === "number" &&
        nextX < x - 0.05
      );
    },
    { time: 2, x: pausedX },
    { timeout: 3000 },
  );
  const reverseStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(reverseStatus?.animation).toMatchObject({
    status: "playing",
    direction: "reverse",
    loopMode: "repeat",
    clamped: false,
  });
  expect(
    (reverseStatus?.animation?.time ?? 4) < 2,
    "reverse playback should move time backward from the scrubbed point",
  ).toBe(true);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders the lit brass sample with a shadow-receiver floor", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const baselineStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-shadow-receiver=1&disable-ibl-sampling=1",
    false,
    false,
  );
  const baselineScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const status = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-ibl-sampling=1",
    true,
    false,
  );
  const shadowedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const floorRegion = glbViewerFloorShadowRegion();
  const baselineFloor = averageRegionLuminance(
    baselineScreenshot,
    clear,
    floorRegion,
  );
  const shadowedFloor = averageRegionLuminance(
    shadowedScreenshot,
    clear,
    floorRegion,
  );

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "brass",
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 3,
      environments: 0,
      shadowRequests: 1,
      diagnostics: 0,
    },
    ibl: {
      enabled: false,
      specularProof: false,
      rendering: {
        supported: false,
        diffusePipelineKey: null,
        specularPipelineKey: null,
      },
    },
    shadow: {
      enabled: true,
      controls: {
        receiverEnabled: true,
        casterEnabled: true,
      },
      authoring: {
        drawCount: 2,
        casterCount: 1,
        receiverCount: 1,
        disabledCasterCount: 1,
        disabledReceiverCount: 1,
      },
      casterDrawList: {
        includedDrawCount: 1,
        skippedDrawCount: 1,
      },
      commandBufferSubmission: {
        status: "submitted",
      },
      rendering: {
        supported: true,
        mode: "directional-depth-compare",
        pipelineKey: "standard|shadowMap|opaque|back|less|none",
      },
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(baselineStatus.shadow?.rendering.supported).toBe(false);
  expect(
    shadowedFloor.visibleSamples,
    `shadowed floor region should contain visible receiver samples; sample=${JSON.stringify(
      shadowedFloor,
    )}`,
  ).toBeGreaterThan(6);
  expect(
    baselineFloor.average - shadowedFloor.average,
    `shadow receiver floor should darken when the brass cube casts a shadow; baseline=${JSON.stringify(
      baselineFloor,
    )} shadowed=${JSON.stringify(shadowedFloor)}`,
  ).toBeGreaterThan(7.5);
  expect(
    maxRegionLuminanceDelta(
      baselineScreenshot,
      shadowedScreenshot,
      floorRegion,
    ),
    "enabling the receiver route should visibly change the floor region",
  ).toBeGreaterThan(12);
  webGpuValidation.expectNoWarnings();
});

test("Playwright mutates GLB viewer ECS shadow controls", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const initialStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-ibl-sampling=1",
    true,
    false,
  );
  const shadowedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(initialStatus.shadow).toMatchObject({
    controls: {
      receiverEnabled: true,
      casterEnabled: true,
    },
    ecs: {
      casterEnabled: true,
      receiverEnabled: true,
      casterEntityCount: 1,
      receiverEntityCount: 1,
      enabledCasterEntityCount: 1,
      enabledReceiverEntityCount: 1,
    },
    authoring: {
      casterCount: 1,
      receiverCount: 1,
    },
    casterDrawList: {
      includedDrawCount: 1,
      skippedDrawCount: 1,
    },
    rendering: {
      supported: true,
    },
  });

  await page.locator("#glb-shadow-caster-toggle").setChecked(false);
  const noCasterStatus = await waitForShadowControlStatus(page, {
    receiverEnabled: true,
    casterEnabled: false,
    supported: false,
    casterCount: 0,
    receiverCount: 1,
    includedDrawCount: 0,
  });

  expect(noCasterStatus.shadow).toMatchObject({
    ecs: {
      casterEnabled: false,
      receiverEnabled: true,
      enabledCasterEntityCount: 0,
      enabledReceiverEntityCount: 1,
    },
    authoring: {
      casterCount: 0,
      receiverCount: 1,
      disabledCasterCount: 2,
      disabledReceiverCount: 1,
    },
    casterDrawList: {
      includedDrawCount: 0,
      skippedDrawCount: 2,
    },
    commandBufferSubmission: {
      status: "ready",
    },
  });

  await page.locator("#glb-shadow-caster-toggle").setChecked(true);
  await waitForShadowControlStatus(page, {
    receiverEnabled: true,
    casterEnabled: true,
    supported: true,
    casterCount: 1,
    receiverCount: 1,
    includedDrawCount: 1,
  });

  await page.locator("#glb-shadow-receiver-toggle").setChecked(false);
  const noReceiverStatus = await waitForShadowControlStatus(page, {
    receiverEnabled: false,
    casterEnabled: true,
    supported: false,
    casterCount: 1,
    receiverCount: 0,
    includedDrawCount: 1,
  });
  const noReceiverScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const clear =
    noReceiverStatus.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(noReceiverStatus.clearColor);
  const floorRegion = glbViewerFloorShadowRegion();
  const shadowedFloor = averageRegionLuminance(
    shadowedScreenshot,
    clear,
    floorRegion,
  );
  const unshadowedFloor = averageRegionLuminance(
    noReceiverScreenshot,
    clear,
    floorRegion,
  );

  expectStatusJsonSafeForGpu(noReceiverStatus);
  expect(noReceiverStatus.shadow).toMatchObject({
    ecs: {
      casterEnabled: true,
      receiverEnabled: false,
      enabledCasterEntityCount: 1,
      enabledReceiverEntityCount: 0,
    },
    authoring: {
      casterCount: 1,
      receiverCount: 0,
      disabledCasterCount: 1,
      disabledReceiverCount: 2,
    },
    rendering: {
      supported: false,
      pipelineKey: null,
    },
  });
  expect(
    unshadowedFloor.average - shadowedFloor.average,
    `disabling the ECS shadow receiver should brighten the floor; shadowed=${JSON.stringify(
      shadowedFloor,
    )} unshadowed=${JSON.stringify(unshadowedFloor)}`,
  ).toBeGreaterThan(7);
  expect(
    maxRegionLuminanceDelta(
      shadowedScreenshot,
      noReceiverScreenshot,
      floorRegion,
    ),
    "live receiver control should visibly change the floor region",
  ).toBeGreaterThan(12);
  webGpuValidation.expectNoWarnings();
});

test("Playwright routes the lit brass sample through IBL", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const directStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-ibl-sampling=1",
    true,
    false,
  );
  const directScreenshot = await page.locator("#aperture-canvas").screenshot();
  const iblStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html",
    true,
    true,
  );
  const iblScreenshot = await page.locator("#aperture-canvas").screenshot();

  expectStatusJsonSafeForGpu(iblStatus);
  expect(directStatus.ibl).toMatchObject({
    enabled: false,
    rendering: {
      supported: false,
    },
  });
  expect(iblStatus).toMatchObject({
    selectedAsset: {
      id: "brass",
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    extraction: {
      meshDraws: 2,
      lights: 3,
      environments: 1,
      shadowRequests: 1,
      diagnostics: 0,
    },
    ibl: {
      enabled: true,
      specularProof: true,
      environmentMapKey: "environment-map:glb-viewer-studio",
      resources: {
        diffuseTexture: "texture:glb-viewer-studio:diffuse:texture",
        specularTexture: "texture:glb-viewer-studio:specular-proof:texture",
        sampler: "texture:glb-viewer-studio:diffuse:sampler",
      },
      rendering: {
        supported: true,
        diffusePipelineKey: expect.stringContaining("iblDiffuse"),
        specularPipelineKey: expect.stringContaining("iblSpecularProof"),
      },
    },
    shadow: {
      rendering: {
        supported: true,
        pipelineKey:
          "standard|iblDiffuse|iblSpecularProof|shadowMap|opaque|back|less|none",
      },
    },
  });
  expect(
    routedPipelineKeys(iblStatus),
    "IBL-enabled brass route should stay within the StandardMaterial app route",
  ).toEqual(
    expect.arrayContaining([
      "standard|iblDiffuse|iblSpecularProof|opaque|back|less|none",
      "standard|iblDiffuse|iblSpecularProof|shadowMap|opaque|back|less|none",
    ]),
  );
  expect(
    maxSampleDelta(directScreenshot, iblScreenshot),
    "IBL-enabled brass viewer sample should visibly differ from the direct-lit-only route",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright mutates GLB viewer ECS IBL control", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const initialStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html",
    true,
    true,
  );
  const iblScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(initialStatus.ibl).toMatchObject({
    enabled: true,
    controls: {
      enabled: true,
      available: true,
    },
    ecs: {
      environmentMapKey: "environment-map:glb-viewer-studio",
      intensity: 0.52,
      environmentEntityCount: 1,
    },
    rendering: {
      supported: true,
      diffusePipelineKey: expect.stringContaining("iblDiffuse"),
      specularPipelineKey: expect.stringContaining("iblSpecularProof"),
    },
  });

  await page.locator("#glb-ibl-toggle").setChecked(false);
  const directStatus = await waitForIblControlStatus(page, {
    enabled: false,
    supported: false,
    environmentMapKey: null,
    intensity: 0,
  });
  const directScreenshot = await page.locator("#aperture-canvas").screenshot();

  expectStatusJsonSafeForGpu(directStatus);
  expect(directStatus).toMatchObject({
    extraction: {
      environments: 1,
    },
    ibl: {
      enabled: false,
      controls: {
        enabled: false,
        available: true,
      },
      ecs: {
        environmentMapKey: null,
        intensity: 0,
        environmentEntityCount: 1,
      },
      rendering: {
        supported: false,
        diffusePipelineKey: null,
        specularPipelineKey: null,
      },
    },
  });
  expect(
    routedPipelineKeys(directStatus).some((key) => key.includes("iblDiffuse")),
    "disabled IBL control should remove IBL route tokens",
  ).toBe(false);

  await page.locator("#glb-ibl-toggle").setChecked(true);
  const enabledStatus = await waitForIblControlStatus(page, {
    enabled: true,
    supported: true,
    environmentMapKey: "environment-map:glb-viewer-studio",
    intensity: 0.52,
  });
  const enabledScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(enabledStatus.ibl).toMatchObject({
    enabled: true,
    controls: {
      enabled: true,
      available: true,
    },
    ecs: {
      environmentMapKey: "environment-map:glb-viewer-studio",
      intensity: 0.52,
    },
    rendering: {
      supported: true,
      diffusePipelineKey: expect.stringContaining("iblDiffuse"),
      specularPipelineKey: expect.stringContaining("iblSpecularProof"),
    },
  });
  expect(
    maxSampleDelta(directScreenshot, enabledScreenshot),
    "reenabling ECS-authored environment IBL should visibly change brass pixels",
  ).toBeGreaterThan(8);
  expect(
    maxSampleDelta(directScreenshot, iblScreenshot),
    "disabled IBL control should visibly differ from the original IBL frame",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright compares roughness regions in the GLB viewer IBL sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const directStatus = await loadRoughnessIblViewerSample(
    page,
    "/examples/glb-viewer.html?asset=roughness-ibl&disable-ibl-sampling=1",
    false,
  );
  const directScreenshot = await page.locator("#aperture-canvas").screenshot();
  const iblStatus = await loadRoughnessIblViewerSample(
    page,
    "/examples/glb-viewer.html?asset=roughness-ibl",
    true,
  );
  const iblScreenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    iblStatus.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(iblStatus.clearColor);
  const directGlossy = readPngPixel(directScreenshot, 0.34, 0.46);
  const directRough = readPngPixel(directScreenshot, 0.62, 0.46);
  const iblGlossy = readPngPixel(iblScreenshot, 0.34, 0.46);
  const iblRough = readPngPixel(iblScreenshot, 0.62, 0.46);
  const directComparisonDistance = pixelDistance(directGlossy, directRough);
  const iblComparisonDistance = pixelDistance(iblGlossy, iblRough);

  expectStatusJsonSafeForGpu(iblStatus);
  expect(directStatus.ibl).toMatchObject({
    enabled: false,
    controls: {
      available: false,
    },
    rendering: {
      supported: false,
    },
  });
  expect(iblStatus).toMatchObject({
    selectedAsset: {
      id: "roughness-ibl",
      label: "Roughness IBL",
      source: "sample",
      url: "/examples/assets/roughness-ibl.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: [],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            factors: {
              baseColorFactor: [0.96, 0.96, 0.92, 1],
              metallicFactor: 1,
              roughnessFactor: 0.02,
              emissiveFactor: [0, 0, 0],
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            factors: {
              baseColorFactor: [0.96, 0.96, 0.92, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
              emissiveFactor: [0, 0, 0],
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      environments: 1,
      diagnostics: 0,
    },
    ibl: {
      enabled: true,
      specularProof: true,
      environmentMapKey: "environment-map:glb-viewer-studio",
      rendering: {
        supported: true,
        diffusePipelineKey: expect.stringContaining("iblDiffuse"),
        specularPipelineKey: expect.stringContaining("iblSpecularProof"),
      },
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|iblDiffuse|iblSpecularProof|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(iblGlossy, clear),
    `glossy roughness region should render visible pixels; sample=${JSON.stringify(
      iblGlossy,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(iblRough, clear),
    `rough roughness region should render visible pixels; sample=${JSON.stringify(
      iblRough,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    iblComparisonDistance,
    `IBL should make the glossy and rough regions visibly differ; glossy=${JSON.stringify(
      iblGlossy,
    )} rough=${JSON.stringify(iblRough)}`,
  ).toBeGreaterThan(60);
  expect(
    maxSampleDelta(directScreenshot, iblScreenshot),
    "disabling IBL should visibly change the roughness comparison sample",
  ).toBeGreaterThan(8);
  expect(
    Math.abs(iblComparisonDistance - directComparisonDistance),
    `IBL should change the roughness-region comparison; direct=${directComparisonDistance} ibl=${iblComparisonDistance}`,
  ).toBeGreaterThan(4);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders the GLB viewer normal-mapped sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadNormalMapViewerSample(page);
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const normalA = readPngPixel(screenshot, 0.38, 0.46);
  const normalB = readPngPixel(screenshot, 0.46, 0.58);
  const flatA = readPngPixel(screenshot, 0.56, 0.46);
  const flatB = readPngPixel(screenshot, 0.64, 0.58);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-map",
      label: "Normal map",
      source: "sample",
      url: "/examples/assets/normal-map.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: [],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|normalTexture|opaque|back|less|none",
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-map-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-map-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|normalTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(normalA, clear),
    `normal-mapped region should render visible pixels; sample=${JSON.stringify(
      normalA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(flatA, clear),
    `flat control region should render visible pixels; sample=${JSON.stringify(
      flatA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(normalA, normalB),
    "normal-mapped region should show non-flat lighting variation",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(normalA, flatA) + pixelDistance(normalB, flatB),
    "normal-mapped primitive should differ from the scalar material control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer normal maps with generated tangents", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadNormalMapViewerSample(
    page,
    "normal-map-missing-tangent",
  );
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const normalA = readPngPixel(screenshot, 0.38, 0.46);
  const normalB = readPngPixel(screenshot, 0.46, 0.58);
  const flatA = readPngPixel(screenshot, 0.56, 0.46);
  const flatB = readPngPixel(screenshot, 0.64, 0.58);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-map-missing-tangent",
      label: "Normal map generated tangents",
      source: "sample",
      url: "/examples/assets/normal-map-missing-tangent.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      outputSummary: {
        meshConstruction: {
          status: "ready",
          meshCount: 2,
          submeshCount: 2,
          vertexCount: 8,
          indexCount: 12,
          diagnosticsCount: 1,
        },
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            family: "standard",
            pipelineKey: "standard|normalTexture|opaque|back|less|none",
            textureSlots: {
              normalTexture: {
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              normalTexture: null,
            },
          },
        ],
      },
      meshAttributes: [
        {
          meshIndex: 0,
          primitiveIndex: 0,
          tangentPath: {
            status: "generated",
            path: "generated-mesh-attribute",
            reason: "normalTexture",
            diagnosticCode: "gltfMeshAsset.generatedTangents",
          },
          streams: [
            {
              arrayStride: 48,
              vertexCount: 4,
              attributes: expect.arrayContaining([
                { semantic: "POSITION", format: "float32x3", offset: 0 },
                { semantic: "NORMAL", format: "float32x3", offset: 12 },
                { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
                { semantic: "TANGENT", format: "float32x4", offset: 32 },
              ]),
            },
          ],
        },
        {
          meshIndex: 0,
          primitiveIndex: 1,
          tangentPath: {
            status: "absent",
            path: null,
            reason: null,
            diagnosticCode: null,
          },
          streams: [
            {
              arrayStride: 32,
              vertexCount: 4,
              attributes: expect.not.arrayContaining([
                expect.objectContaining({ semantic: "TANGENT" }),
              ]),
            },
          ],
        },
      ],
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|normalTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: "standard|normalTexture|opaque|back|less|none",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        }),
        expect.objectContaining({
          pipelineKey: "standard|opaque|back|less|none",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
        }),
      ]),
    },
    draw: {
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(normalA, clear),
    `generated-tangent normal-map region should render visible pixels; sample=${JSON.stringify(
      normalA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(flatA, clear),
    `flat control region should render visible pixels; sample=${JSON.stringify(
      flatA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(normalA, normalB),
    "generated-tangent normal-mapped region should show non-flat lighting variation",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(normalA, flatA) + pixelDistance(normalB, flatB),
    "generated-tangent normal-mapped primitive should differ from the scalar material control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer normal map through TEXCOORD_1", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=normal-map-uv1");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const uv0 = resolutions[0]?.textureSlots?.normalTexture ?? null;
      const uv1 = resolutions[1]?.textureSlots?.normalTexture ?? null;
      const scalar = resolutions[2]?.textureSlots?.normalTexture ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "normal-map-uv1" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-normal-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|normalTexture|opaque|back|less|none",
        ) === true &&
        status.renderState.pipelineKeys.includes(
          "standard|normalTexture|uv1|opaque|back|less|none",
        ) === true &&
        uv0?.texCoord === 0 &&
        uv1?.texCoord === 1 &&
        scalar === null &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "normal-map UV1 viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Normal-map UV1 viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv0 = readPngPixel(screenshot, 0.28, 0.5);
  const uv1 = readPngPixel(screenshot, 0.49, 0.5);
  const scalar = readPngPixel(screenshot, 0.72, 0.5);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-map-uv1",
      label: "Normal map UV1",
      source: "sample",
      url: "/examples/assets/normal-map-uv1.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
      materialSlotSummary: {
        textureSlots: {
          normalTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
        },
        uv1Usage: {
          materials: 1,
          textureSlots: 1,
        },
      },
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: "standard|normalTexture|opaque|back|less|none",
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-map-uv1-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-map-uv1-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: "standard|normalTexture|uv1|opaque|back|less|none",
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-map-uv1-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-map-uv1-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|normalTexture|opaque|back|less|none",
        "standard|normalTexture|uv1|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: "standard|normalTexture|uv1|opaque|back|less|none",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT,TEXCOORD_1",
        }),
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 1,
        tangentPath: expect.objectContaining({
          status: "authored",
          path: "authored-mesh-attribute",
          diagnosticCode: null,
        }),
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 56,
            vertexCount: 4,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
              { semantic: "TEXCOORD_1", format: "float32x2", offset: 48 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(uv0, clear),
    `normal-map UV0 control should render visible pixels; sample=${JSON.stringify(
      uv0,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1, clear),
    `normal-map UV1 region should render visible pixels; sample=${JSON.stringify(
      uv1,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv0, uv1),
    "normal maps routed through UV0 and UV1 should produce different pixels",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(uv0, scalar) + pixelDistance(uv1, scalar),
    "normal-map UV controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer base-color plus normal textures through TEXCOORD_1", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-uv1-base-normal");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const uv0 = resolutions[0]?.textureSlots ?? null;
      const uv1 = resolutions[1]?.textureSlots ?? null;
      const scalar = resolutions[2]?.textureSlots ?? null;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const uv1PipelineKey =
        "standard|baseColorTexture|normalTexture|uv1|opaque|back|less|none";
      const attributes =
        status?.gltf?.meshAttributes?.[1]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-uv1-base-normal" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-base-color-checker.png") &&
        decodedUris.has("aperture-normal-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        resolutions[0]?.pipelineKey ===
          "standard|baseColorTexture|normalTexture|opaque|back|less|none" &&
        resolutions[1]?.pipelineKey === uv1PipelineKey &&
        uv0?.baseColorTexture?.texCoord === 0 &&
        uv0.normalTexture?.texCoord === 0 &&
        uv1?.baseColorTexture?.texCoord === 1 &&
        uv1.normalTexture?.texCoord === 1 &&
        scalar?.baseColorTexture === null &&
        scalar.normalTexture === null &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TEXCOORD_1" && attribute.offset === 48,
        ) &&
        status.gltf?.meshAttributes?.[1]?.streams?.[0]?.arrayStride === 56 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true &&
        status.renderState?.pipelineKeys?.includes(uv1PipelineKey) === true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === uv1PipelineKey &&
            draw.meshLayoutKey ===
              "POSITION,NORMAL,TEXCOORD_0,TANGENT,TEXCOORD_1",
        ) === true &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "UV1 base/normal viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("UV1 base/normal viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv0 = readPngPixel(screenshot, 0.28, 0.5);
  const uv1 = readPngPixel(screenshot, 0.49, 0.5);
  const scalar = readPngPixel(screenshot, 0.72, 0.5);
  const uv1PipelineKey =
    "standard|baseColorTexture|normalTexture|uv1|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-uv1-base-normal",
      label: "UV1 base + normal",
      source: "sample",
      url: "/examples/assets/standard-uv1-base-normal.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
      materialSlotSummary: {
        textureSlots: {
          baseColorTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
          normalTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
        },
        uv1Usage: {
          materials: 1,
          textureSlots: 2,
        },
      },
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey:
              "standard|baseColorTexture|normalTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-normal-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-normal-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-normal-\d+:texture:1:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-normal-\d+:sampler:1:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: uv1PipelineKey,
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-normal-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-normal-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-base-normal-\d+:texture:1:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-base-normal-\d+:sampler:1:normalTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|normalTexture|opaque|back|less|none",
        uv1PipelineKey,
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: uv1PipelineKey,
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT,TEXCOORD_1",
        }),
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 1,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 56,
            vertexCount: 4,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
              { semantic: "TEXCOORD_1", format: "float32x2", offset: 48 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(uv0, clear),
    `UV0 base/normal control should render visible pixels; sample=${JSON.stringify(
      uv0,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1, clear),
    `UV1 base/normal region should render visible pixels; sample=${JSON.stringify(
      uv1,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv0, uv1),
    "base-color and normal textures routed through UV1 should differ from the UV0 control",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(uv0, scalar) + pixelDistance(uv1, scalar),
    "textured UV controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer UV1 metallic-roughness plus normal textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-uv1-metallic-normal",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const uv0 = resolutions[0]?.textureSlots ?? null;
      const uv1 = resolutions[1]?.textureSlots ?? null;
      const scalar = resolutions[2]?.textureSlots ?? null;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const uv1PipelineKey =
        "standard|metallicRoughnessTexture|normalTexture|uv1|opaque|back|less|none";
      const attributes =
        status?.gltf?.meshAttributes?.[1]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-uv1-metallic-normal" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        decodedUris.has("aperture-normal-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        resolutions[0]?.pipelineKey ===
          "standard|metallicRoughnessTexture|opaque|back|less|none" &&
        resolutions[1]?.pipelineKey === uv1PipelineKey &&
        uv0?.metallicRoughnessTexture?.texCoord === 0 &&
        uv0.normalTexture === null &&
        uv1?.metallicRoughnessTexture?.texCoord === 1 &&
        uv1.normalTexture?.texCoord === 1 &&
        scalar?.metallicRoughnessTexture === null &&
        scalar.normalTexture === null &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TEXCOORD_1" && attribute.offset === 48,
        ) &&
        status.gltf?.meshAttributes?.[1]?.streams?.[0]?.arrayStride === 56 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true &&
        status.renderState?.pipelineKeys?.includes(uv1PipelineKey) === true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === uv1PipelineKey &&
            draw.meshLayoutKey ===
              "POSITION,NORMAL,TEXCOORD_0,TANGENT,TEXCOORD_1",
        ) === true &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "UV1 metallic/normal viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("UV1 metallic/normal viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const uv0 = readPngPixel(screenshot, 0.28, 0.5);
  const uv1 = readPngPixel(screenshot, 0.49, 0.5);
  const scalar = readPngPixel(screenshot, 0.72, 0.5);
  const uv1PipelineKey =
    "standard|metallicRoughnessTexture|normalTexture|uv1|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-uv1-metallic-normal",
      label: "UV1 MR + normal",
      source: "sample",
      url: "/examples/assets/standard-uv1-metallic-normal.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
      materialSlotSummary: {
        textureSlots: {
          metallicRoughnessTexture: {
            count: 2,
            uv0: 1,
            uv1: 1,
            otherUv: 0,
          },
          normalTexture: {
            count: 1,
            uv0: 0,
            uv1: 1,
            otherUv: 0,
          },
        },
        uv1Usage: {
          materials: 1,
          textureSlots: 2,
        },
      },
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey:
              "standard|metallicRoughnessTexture|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-metallic-normal-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-metallic-normal-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              normalTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: uv1PipelineKey,
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-metallic-normal-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-metallic-normal-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-uv1-metallic-normal-\d+:texture:1:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-uv1-metallic-normal-\d+:sampler:1:normalTexture$/,
                ),
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: null,
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|metallicRoughnessTexture|opaque|back|less|none",
        uv1PipelineKey,
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: uv1PipelineKey,
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT,TEXCOORD_1",
        }),
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 1,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 56,
            vertexCount: 4,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
              { semantic: "TEXCOORD_1", format: "float32x2", offset: 48 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(uv0, clear),
    `UV0 metallic control should render visible pixels; sample=${JSON.stringify(
      uv0,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv1, clear),
    `UV1 metallic/normal region should render visible pixels; sample=${JSON.stringify(
      uv1,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(uv0, uv1),
    "metallic-roughness and normal textures routed through UV1 should differ from the UV0 control",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(uv0, scalar) + pixelDistance(uv1, scalar),
    "textured metallic UV controls should differ from the scalar material control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer transformed UV1 normal map", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=normal-map-uv1-transform");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly unknown[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly { readonly code?: string }[];
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const transformed = resolutions[0]?.textureSlots?.normalTexture ?? null;
      const untransformed = resolutions[1]?.textureSlots?.normalTexture ?? null;
      const scalar = resolutions[2]?.textureSlots?.normalTexture ?? null;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "normal-map-uv1-transform" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        (status.source.imageDecode?.decoded?.length ?? 0) === 1 &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        resolutions[0]?.pipelineKey ===
          "standard|normalTexture|uv1|opaque|back|less|none" &&
        resolutions[1]?.pipelineKey ===
          "standard|normalTexture|uv1|opaque|back|less|none" &&
        transformed?.texCoord === 1 &&
        transformed.hasTransform === true &&
        transformed.transform?.offset?.[0] === 0.5 &&
        transformed.transform?.scale?.[0] === 0.5 &&
        untransformed?.texCoord === 1 &&
        untransformed.hasTransform === false &&
        scalar === null &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TEXCOORD_1" && attribute.offset === 48,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 56 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
            "render.standardMaterialTexture.missingTexCoord1",
        ) !== true &&
        status.renderState?.pipelineKeys?.includes(
          "standard|normalTexture|uv1|opaque|back|less|none",
        ) === true &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "transformed UV1 normal-map status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Transformed UV1 normal-map status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformedA = readPngPixel(screenshot, 0.28, 0.46);
  const transformedB = readPngPixel(screenshot, 0.36, 0.58);
  const untransformedA = readPngPixel(screenshot, 0.48, 0.46);
  const untransformedB = readPngPixel(screenshot, 0.56, 0.58);
  const scalarA = readPngPixel(screenshot, 0.68, 0.46);
  const scalarB = readPngPixel(screenshot, 0.76, 0.58);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-map-uv1-transform",
      label: "Normal map UV1 transform",
      source: "sample",
      url: "/examples/assets/normal-map-uv1-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        resolutions: [
          {
            pipelineKey: "standard|normalTexture|uv1|opaque|back|less|none",
            textureSlots: {
              normalTexture: {
                texCoord: 1,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: null,
                },
              },
            },
          },
          {
            pipelineKey: "standard|normalTexture|uv1|opaque|back|less|none",
            textureSlots: {
              normalTexture: {
                texCoord: 1,
                hasTransform: false,
              },
            },
          },
          {
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              normalTexture: null,
            },
          },
        ],
      },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
      diagnosticsList: [],
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|normalTexture|uv1|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 0,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 56,
            attributes: expect.arrayContaining([
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
              { semantic: "TEXCOORD_1", format: "float32x2", offset: 48 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(transformedA, clear),
    `transformed UV1 normal-map region should render visible pixels; sample=${JSON.stringify(
      transformedA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(untransformedA, clear),
    `untransformed UV1 normal-map region should render visible pixels; sample=${JSON.stringify(
      untransformedA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformedA, transformedB),
    "transformed UV1 normal-map region should show non-flat lighting variation",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(transformedA, untransformedA) +
      pixelDistance(transformedB, untransformedB),
    "transformed UV1 normal-map primitive should differ from the untransformed control",
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(transformedA, scalarA) +
      pixelDistance(untransformedB, scalarB),
    "UV1 normal-map primitives should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer base-color texture plus normal map", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-base-normal");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly unknown[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const combined = resolutions[0] ?? null;
      const baseOnly = resolutions[1] ?? null;
      const scalar = resolutions[2] ?? null;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-base-normal" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        (status.source.imageDecode?.decoded?.length ?? 0) === 2 &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey ===
          "standard|baseColorTexture|normalTexture|opaque|back|less|none" &&
        combined.textureSlots?.baseColorTexture?.texCoord === 0 &&
        combined.textureSlots?.normalTexture?.texCoord === 0 &&
        baseOnly?.pipelineKey ===
          "standard|baseColorTexture|opaque|back|less|none" &&
        scalar?.pipelineKey === "standard|opaque|back|less|none" &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TANGENT" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|normalTexture|opaque|back|less|none",
        ) === true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey ===
              "standard|baseColorTexture|normalTexture|opaque|back|less|none" &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        ) === true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "base-color plus normal viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Base-color plus normal viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combinedA = readPngPixel(screenshot, 0.28, 0.46);
  const combinedB = readPngPixel(screenshot, 0.36, 0.58);
  const baseOnlyA = readPngPixel(screenshot, 0.48, 0.46);
  const baseOnlyB = readPngPixel(screenshot, 0.56, 0.58);
  const scalar = readPngPixel(screenshot, 0.72, 0.5);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-base-normal",
      label: "Base + normal texture",
      source: "sample",
      url: "/examples/assets/standard-base-normal.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            uri: "aperture-base-color-checker.png",
            width: 2,
            height: 2,
          },
          {
            uri: "aperture-normal-checker.png",
            width: 2,
            height: 2,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            pipelineKey:
              "standard|baseColorTexture|normalTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              normalTexture: { texCoord: 0 },
            },
          },
          {
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: { texCoord: 0 },
              normalTexture: null,
            },
          },
          {
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              normalTexture: null,
            },
          },
        ],
      },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|normalTexture|opaque|back|less|none",
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 0,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 48,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(combinedA, clear),
    `combined base/normal region should render visible pixels; sample=${JSON.stringify(
      combinedA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(baseOnlyA, clear),
    `base-color control should render visible pixels; sample=${JSON.stringify(
      baseOnlyA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combinedA, combinedB),
    "combined base/normal region should show texture or normal variation",
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(combinedA, baseOnlyA) + pixelDistance(combinedB, baseOnlyB),
    "combined base/normal primitive should differ from the base-only control",
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(combinedA, scalar) + pixelDistance(baseOnlyA, scalar),
    "textured StandardMaterial primitives should differ from the scalar control",
  ).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer metallic-roughness texture plus normal map", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=standard-metallic-normal");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const combined = resolutions[0] ?? null;
      const metallicOnly = resolutions[1] ?? null;
      const scalar = resolutions[2] ?? null;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];
      const combinedPipelineKey =
        "standard|metallicRoughnessTexture|normalTexture|opaque|back|less|none";

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-metallic-normal" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        decodedUris.has("aperture-normal-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        combined?.pipelineKey === combinedPipelineKey &&
        combined.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        combined.textureSlots?.normalTexture?.texCoord === 0 &&
        metallicOnly?.pipelineKey ===
          "standard|metallicRoughnessTexture|opaque|back|less|none" &&
        metallicOnly.textureSlots?.metallicRoughnessTexture?.texCoord === 0 &&
        scalar?.pipelineKey === "standard|opaque|back|less|none" &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TANGENT" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === combinedPipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        ) === true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "metallic-roughness plus normal viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Metallic-roughness plus normal viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const combinedRegion = { minX: 0.2, minY: 0.34, maxX: 0.39, maxY: 0.66 };
  const metallicOnlyRegion = {
    minX: 0.41,
    minY: 0.34,
    maxX: 0.6,
    maxY: 0.66,
  };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const combinedA = readPngPixel(screenshot, 0.28, 0.46);
  const combinedB = readPngPixel(screenshot, 0.36, 0.58);
  const metallicOnlyA = readPngPixel(screenshot, 0.48, 0.46);
  const metallicOnlyB = readPngPixel(screenshot, 0.56, 0.58);
  const combined = strongestRegionSample(
    screenshot,
    clear,
    combinedRegion.minX,
    combinedRegion.minY,
    combinedRegion.maxX,
    combinedRegion.maxY,
  );
  const metallicOnly = strongestRegionSample(
    screenshot,
    clear,
    metallicOnlyRegion.minX,
    metallicOnlyRegion.minY,
    metallicOnlyRegion.maxX,
    metallicOnlyRegion.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const metallicOnlyLuminance = averageRegionLuminance(
    screenshot,
    clear,
    metallicOnlyRegion,
  );
  const scalarLuminance = averageRegionLuminance(
    screenshot,
    clear,
    scalarRegion,
  );
  const combinedPipelineKey =
    "standard|metallicRoughnessTexture|normalTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-metallic-normal",
      label: "MR + normal texture",
      source: "sample",
      url: "/examples/assets/standard-metallic-normal.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: combinedPipelineKey,
            factors: {
              baseColorFactor: [0.72, 0.68, 0.58, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
              normalScale: 2.5,
            },
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-metallic-normal-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-metallic-normal-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-metallic-normal-\d+:texture:1:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-metallic-normal-\d+:sampler:1:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey:
              "standard|metallicRoughnessTexture|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: { texCoord: 0 },
              normalTexture: null,
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: null,
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|metallicRoughnessTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 0,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 48,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(combined, clear),
    `combined metallic/normal region should render visible pixels; sample=${JSON.stringify(
      combined,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(metallicOnly, clear),
    `metallic-roughness control should render visible pixels; sample=${JSON.stringify(
      metallicOnly,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(combinedA, combinedB),
    "normal-mapped metallic-roughness region should show non-flat lighting",
  ).toBeGreaterThan(5);
  expect(
    pixelDistance(combinedA, metallicOnlyA) +
      pixelDistance(combinedB, metallicOnlyB),
    "normal map should change the metallic-roughness textured primitive",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(metallicOnly, scalar) +
      Math.abs(metallicOnlyLuminance.average - scalarLuminance.average),
    "metallic-roughness texture should differ from the scalar control",
  ).toBeGreaterThan(12);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer transformed metallic-roughness plus normal textures", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=standard-metallic-normal-transform",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly { readonly uri?: string }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                  readonly textureSlots?: {
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
              readonly meshAttributes?: readonly {
                readonly streams?: readonly {
                  readonly arrayStride?: number;
                  readonly attributes?: readonly {
                    readonly semantic?: string;
                    readonly offset?: number;
                  }[];
                }[];
              }[];
              readonly metadata?: {
                readonly extensions?: { readonly used?: readonly string[] };
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
              readonly draws?: readonly {
                readonly pipelineKey?: string;
                readonly meshLayoutKey?: string;
              }[];
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const transformed = resolutions[0]?.textureSlots ?? null;
      const untransformed = resolutions[1]?.textureSlots ?? null;
      const scalar = resolutions[2]?.textureSlots ?? null;
      const attributes =
        status?.gltf?.meshAttributes?.[0]?.streams?.[0]?.attributes ?? [];
      const combinedPipelineKey =
        "standard|metallicRoughnessTexture|normalTexture|opaque|back|less|none";
      const transform = transformed?.metallicRoughnessTexture?.transform;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "standard-metallic-normal-transform" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        decodedUris.has("aperture-normal-checker.png") &&
        status.gltf?.metadata?.extensions?.used?.includes(
          "KHR_texture_transform",
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        resolutions[0]?.pipelineKey === combinedPipelineKey &&
        resolutions[1]?.pipelineKey === combinedPipelineKey &&
        transformed?.metallicRoughnessTexture?.texCoord === 0 &&
        transformed.metallicRoughnessTexture.hasTransform === true &&
        transform?.offset?.[0] === 0.5 &&
        transform.scale?.[0] === 0.5 &&
        transformed.normalTexture?.texCoord === 0 &&
        transformed.normalTexture.hasTransform === false &&
        untransformed?.metallicRoughnessTexture?.texCoord === 0 &&
        untransformed.metallicRoughnessTexture.hasTransform === false &&
        untransformed.normalTexture?.texCoord === 0 &&
        untransformed.normalTexture.hasTransform === false &&
        scalar?.metallicRoughnessTexture === null &&
        scalar.normalTexture === null &&
        attributes.some(
          (attribute) =>
            attribute.semantic === "TANGENT" && attribute.offset === 32,
        ) &&
        status.gltf?.meshAttributes?.[0]?.streams?.[0]?.arrayStride === 48 &&
        status.renderState?.pipelineKeys?.includes(combinedPipelineKey) ===
          true &&
        status.renderState.draws?.some(
          (draw) =>
            draw.pipelineKey === combinedPipelineKey &&
            draw.meshLayoutKey === "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        ) === true &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 3
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "transformed metallic-roughness plus normal viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error(
      "Transformed metallic-roughness plus normal viewer status did not publish.",
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformedRegion = {
    minX: 0.2,
    minY: 0.34,
    maxX: 0.39,
    maxY: 0.66,
  };
  const untransformedRegion = {
    minX: 0.41,
    minY: 0.34,
    maxX: 0.6,
    maxY: 0.66,
  };
  const scalarRegion = { minX: 0.62, minY: 0.34, maxX: 0.81, maxY: 0.66 };
  const transformed = strongestRegionSample(
    screenshot,
    clear,
    transformedRegion.minX,
    transformedRegion.minY,
    transformedRegion.maxX,
    transformedRegion.maxY,
  );
  const untransformed = strongestRegionSample(
    screenshot,
    clear,
    untransformedRegion.minX,
    untransformedRegion.minY,
    untransformedRegion.maxX,
    untransformedRegion.maxY,
  );
  const scalar = strongestRegionSample(
    screenshot,
    clear,
    scalarRegion.minX,
    scalarRegion.minY,
    scalarRegion.maxX,
    scalarRegion.maxY,
  );
  const transformedA = readPngPixel(screenshot, 0.28, 0.46);
  const transformedB = readPngPixel(screenshot, 0.36, 0.58);
  const untransformedA = readPngPixel(screenshot, 0.48, 0.46);
  const untransformedB = readPngPixel(screenshot, 0.56, 0.58);
  const combinedPipelineKey =
    "standard|metallicRoughnessTexture|normalTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "standard-metallic-normal-transform",
      label: "Transformed MR + normal",
      source: "sample",
      url: "/examples/assets/standard-metallic-normal-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            pipelineKey: combinedPipelineKey,
            textureSlots: {
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-metallic-normal-transform-\d+:texture:0:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-metallic-normal-transform-\d+:sampler:0:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: 0,
                },
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-standard-metallic-normal-transform-\d+:texture:1:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-standard-metallic-normal-transform-\d+:sampler:1:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            pipelineKey: combinedPipelineKey,
            textureSlots: {
              metallicRoughnessTexture: {
                texCoord: 0,
                hasTransform: false,
              },
              normalTexture: {
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              metallicRoughnessTexture: null,
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: { meshDraws: 3, diagnostics: 0 },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        combinedPipelineKey,
        "standard|opaque|back|less|none",
      ]),
      draws: expect.arrayContaining([
        expect.objectContaining({
          pipelineKey: combinedPipelineKey,
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        }),
      ]),
    },
    draw: { drawCalls: 3 },
  });
  expect(status.gltf?.meshAttributes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meshIndex: 0,
        primitiveIndex: 0,
        streams: expect.arrayContaining([
          expect.objectContaining({
            arrayStride: 48,
            attributes: expect.arrayContaining([
              { semantic: "POSITION", format: "float32x3", offset: 0 },
              { semantic: "NORMAL", format: "float32x3", offset: 12 },
              { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
              { semantic: "TANGENT", format: "float32x4", offset: 32 },
            ]),
          }),
        ]),
      }),
    ]),
  );
  expect(
    pixelDistance(transformed, clear),
    `transformed metallic/normal region should render visible pixels; sample=${JSON.stringify(
      transformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(untransformed, clear),
    `untransformed metallic/normal control should render visible pixels; sample=${JSON.stringify(
      untransformed,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformedA, untransformedA) +
      pixelDistance(transformedB, untransformedB),
    "transformed metallic-roughness slot should visibly differ from the untransformed normal-map control",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(transformed, scalar) + pixelDistance(untransformed, scalar),
    "textured metallic/normal materials should differ from the scalar control",
  ).toBeGreaterThan(4);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a GLB viewer normal-scale texture sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=normal-scale");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly normalScale?: number | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "normal-scale" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|normalTexture|opaque|back|less|none",
        ) === true &&
        resolution?.factors?.normalScale === 3.5 &&
        resolution.textureSlots?.normalTexture?.texCoord === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "normal-scale viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Normal-scale viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const scaledA = readPngPixel(screenshot, 0.38, 0.46);
  const scaledB = readPngPixel(screenshot, 0.46, 0.58);
  const flatA = readPngPixel(screenshot, 0.56, 0.46);
  const flatB = readPngPixel(screenshot, 0.64, 0.58);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-scale",
      label: "Normal scale",
      source: "sample",
      url: "/examples/assets/normal-scale.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|normalTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.55, 0.68, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              normalScale: 3.5,
            },
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-scale-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-scale-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.55, 0.68, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              normalScale: 1,
            },
            textureSlots: {
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|normalTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(scaledA, clear),
    `normal-scale region should render visible pixels; sample=${JSON.stringify(
      scaledA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(scaledA, scaledB),
    "normal-scale texture should produce non-flat lighting variation",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(scaledA, flatA) + pixelDistance(scaledB, flatB),
    "normal-scale textured primitive should differ from the flat control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports a transformed normal texture in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=normal-transform");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly factors?: {
                    readonly normalScale?: number | null;
                  } | null;
                  readonly textureSlots?: {
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const transform = resolution?.textureSlots?.normalTexture?.transform;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "normal-transform" &&
        status.selectedAsset.loading === false &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|normalTexture|opaque|back|less|none",
        ) === true &&
        resolution?.factors?.normalScale === 2.5 &&
        resolution.textureSlots?.normalTexture?.texCoord === 0 &&
        resolution.textureSlots.normalTexture.hasTransform === true &&
        transform?.offset?.[0] === 0.5 &&
        transform.offset[1] === 0 &&
        transform.scale?.[0] === 0.5 &&
        transform.scale[1] === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "normal-transform viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Normal-transform viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformedA = readPngPixel(screenshot, 0.38, 0.46);
  const transformedB = readPngPixel(screenshot, 0.46, 0.58);
  const flatA = readPngPixel(screenshot, 0.56, 0.46);
  const flatB = readPngPixel(screenshot, 0.64, 0.58);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-transform",
      label: "Normal transform",
      source: "sample",
      url: "/examples/assets/normal-transform.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|normalTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.55, 0.68, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              normalScale: 2.5,
            },
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-transform-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-transform-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: null,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.55, 0.68, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              normalScale: 1,
            },
            textureSlots: {
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|normalTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(transformedA, clear),
    `normal-transform region should render visible pixels; sample=${JSON.stringify(
      transformedA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformedA, transformedB),
    "normal-transform texture should produce non-flat lighting variation",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(transformedA, flatA) + pixelDistance(transformedB, flatB),
    "normal-transform textured primitive should differ from the flat control",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright compares transformed and untransformed normal texture controls in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=normal-transform-controls");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly normalTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolutions = status?.gltf?.primitiveMaterials?.resolutions ?? [];
      const transformed = resolutions[0]?.textureSlots?.normalTexture ?? null;
      const untransformed = resolutions[1]?.textureSlots?.normalTexture ?? null;
      const flat = resolutions[2]?.textureSlots?.normalTexture ?? null;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "normal-transform-controls" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 3,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 3 &&
        status.extraction?.meshDraws === 3 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|normalTexture|opaque|back|less|none",
        ) === true &&
        transformed?.hasTransform === true &&
        transformed.transform?.offset?.[0] === 0.5 &&
        untransformed?.hasTransform === false &&
        flat === null
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "normal-transform controls viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Normal-transform controls viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const transformedA = readPngPixel(screenshot, 0.28, 0.46);
  const transformedB = readPngPixel(screenshot, 0.36, 0.58);
  const untransformedA = readPngPixel(screenshot, 0.48, 0.46);
  const untransformedB = readPngPixel(screenshot, 0.56, 0.58);
  const flatA = readPngPixel(screenshot, 0.68, 0.46);
  const flatB = readPngPixel(screenshot, 0.76, 0.58);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-transform-controls",
      label: "Normal transform controls",
      source: "sample",
      url: "/examples/assets/normal-transform-controls.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 3 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 3,
          materials: 3,
          animations: 0,
        },
        extensions: {
          used: ["KHR_texture_transform"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 3,
        diagnostics: 0,
        families: [{ family: "standard", count: 3 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|normalTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.55, 0.68, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              normalScale: 2.5,
            },
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-transform-controls-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-transform-controls-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: true,
                transform: {
                  offset: [0.5, 0],
                  scale: [0.5, 1],
                  rotation: null,
                },
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|normalTexture|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.55, 0.68, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              normalScale: 2.5,
            },
            textureSlots: {
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-normal-transform-controls-\d+:texture:0:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-normal-transform-controls-\d+:sampler:0:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
                transform: null,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 2,
            materialIndex: 2,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            factors: {
              baseColorFactor: [0.55, 0.68, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.58,
              normalScale: 1,
            },
            textureSlots: {
              normalTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      meshDraws: 3,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|normalTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 3,
      drawCalls: 3,
    },
  });
  expect(
    pixelDistance(transformedA, clear),
    `transformed normal control should render visible pixels; sample=${JSON.stringify(
      transformedA,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(transformedA, untransformedA) +
      pixelDistance(transformedB, untransformedB),
    "transformed normal primitive should differ from the untransformed normal control",
  ).toBeGreaterThan(8);
  expect(
    pixelDistance(transformedA, flatA) + pixelDistance(transformedB, flatB),
    "transformed normal primitive should differ from the flat control",
  ).toBeGreaterThan(18);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders the GLB viewer textured StandardMaterial sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadTexturedStandardViewerSample(page);
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textureWarm = readPngPixel(screenshot, 0.35, 0.43);
  const textureCool = readPngPixel(screenshot, 0.46, 0.57);
  const scalarWarm = readPngPixel(screenshot, 0.56, 0.43);
  const scalarCool = readPngPixel(screenshot, 0.65, 0.57);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "textured-standard",
      label: "Textured standard",
      source: "sample",
      url: "/examples/assets/textured-standard.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: [],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey:
              "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-textured-standard-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-textured-standard-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-textured-standard-\d+:texture:1:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-textured-standard-\d+:sampler:1:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
              metallicRoughnessTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(textureWarm, clear),
    `textured region should render visible pixels; sample=${JSON.stringify(
      textureWarm,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(scalarWarm, clear),
    `scalar control region should render visible pixels; sample=${JSON.stringify(
      scalarWarm,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(textureWarm, textureCool),
    "base-color texture should create visible variation inside the textured primitive",
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(textureWarm, scalarWarm) +
      pixelDistance(textureCool, scalarCool),
    "textured primitive should differ from the scalar StandardMaterial control",
  ).toBeGreaterThan(30);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a BasisU KTX2 texture in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=basis-ktx2-texture");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly mimeType?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
              };
              readonly metadata?: {
                readonly unsupportedFeatureDiagnostics?: readonly unknown[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "basis-ktx2-texture" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.mimeType === "image/ktx2" &&
            entry.width === 40 &&
            entry.height === 40,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 1 &&
        (status.gltf.metadata?.unsupportedFeatureDiagnostics?.length ?? 0) ===
          0 &&
        status.extraction?.meshDraws === 1 &&
        status.renderState?.pipelineKeys?.some((key) =>
          key.startsWith("standard|baseColorTexture|opaque|"),
        ) === true
      );
    },
    undefined,
    { timeout: 7000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "Basis KTX2 viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Basis KTX2 viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textured = readPngPixel(screenshot, 0.5, 0.5);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "basis-ktx2-texture",
      label: "Basis KTX2 texture",
      source: "sample",
      url: "/examples/assets/basis-ktx2-texture.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          expect.objectContaining({
            sourceKind: "buffer-view",
            decodeMode: "async-buffer-view",
            mimeType: "image/ktx2",
            width: 40,
            height: 40,
          }),
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        extensions: {
          used: ["KHR_texture_basisu"],
          required: ["KHR_texture_basisu"],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(textured, clear),
    `Basis KTX2 sample should render visible textured pixels; sample=${JSON.stringify(
      textured,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a Draco-compressed GLB mesh in the viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=draco-heart");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "Draco GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("Draco GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly outputSummary?: {
                readonly meshConstruction?: {
                  readonly status?: string;
                  readonly vertexCount?: number;
                  readonly indexCount?: number;
                  readonly diagnosticsCount?: number;
                };
              };
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly extensions?: {
                  readonly used?: readonly string[];
                  readonly required?: readonly string[];
                };
                readonly unsupportedFeatureDiagnostics?: readonly unknown[];
              };
              readonly primitiveMaterials?: { readonly resolved?: number };
              readonly replay?: { readonly valid?: boolean };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "draco-heart" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.source.outputSummary?.meshConstruction?.status === "ready" &&
        status.source.outputSummary.meshConstruction.vertexCount === 540 &&
        status.source.outputSummary.meshConstruction.indexCount === 540 &&
        status.source.outputSummary.meshConstruction.diagnosticsCount === 0 &&
        status.gltf?.metadata?.extensions?.required?.includes(
          "KHR_draco_mesh_compression",
        ) === true &&
        (status.gltf.metadata.unsupportedFeatureDiagnostics?.length ?? 0) ===
          0 &&
        status.gltf?.primitiveMaterials?.resolved === 1 &&
        status.gltf?.replay?.valid === true &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 7000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "Draco GLB viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Draco GLB viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const visible = strongestNearCenterSample(screenshot, clear);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "draco-heart",
      label: "Draco heart",
      source: "sample",
      url: "/examples/assets/draco-heart.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    source: {
      ok: true,
      outputSummary: {
        meshConstruction: {
          status: "ready",
          meshCount: 1,
          submeshCount: 1,
          vertexCount: 540,
          indexCount: 540,
          diagnosticsCount: 0,
        },
      },
    },
    gltf: {
      metadata: {
        extensions: {
          used: ["KHR_draco_mesh_compression"],
          required: ["KHR_draco_mesh_compression"],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(visible, clear),
    `Draco GLB sample should render visible mesh pixels; sample=${JSON.stringify(
      visible,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders a Meshopt-compressed GLB mesh in the viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=meshopt-cube");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    initialStatus,
    "Meshopt GLB viewer status should publish",
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("Meshopt GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly outputSummary?: {
                readonly meshConstruction?: {
                  readonly status?: string;
                  readonly vertexCount?: number;
                  readonly indexCount?: number;
                  readonly diagnosticsCount?: number;
                };
              };
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly extensions?: {
                  readonly required?: readonly string[];
                };
                readonly unsupportedFeatureDiagnostics?: readonly unknown[];
              };
              readonly primitiveMaterials?: { readonly resolved?: number };
              readonly replay?: { readonly valid?: boolean };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "meshopt-cube" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.source.outputSummary?.meshConstruction?.status === "ready" &&
        status.source.outputSummary.meshConstruction.vertexCount === 24 &&
        status.source.outputSummary.meshConstruction.indexCount === 36 &&
        status.source.outputSummary.meshConstruction.diagnosticsCount === 0 &&
        status.gltf?.metadata?.extensions?.required?.includes(
          "EXT_meshopt_compression",
        ) === true &&
        (status.gltf.metadata.unsupportedFeatureDiagnostics?.length ?? 0) ===
          0 &&
        status.gltf?.primitiveMaterials?.resolved === 1 &&
        status.gltf?.replay?.valid === true &&
        status.extraction?.meshDraws === 1 &&
        status.draw?.drawCalls === 1
      );
    },
    undefined,
    { timeout: 7000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "Meshopt GLB viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Meshopt GLB viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const visible = strongestNearCenterSample(screenshot, clear);

  expectStatusJsonSafeForGpu(status);
  expect(status).toMatchObject({
    selectedAsset: {
      id: "meshopt-cube",
      label: "Meshopt cube",
      source: "sample",
      url: "/examples/assets/meshopt-cube.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    source: {
      ok: true,
      outputSummary: {
        meshConstruction: {
          status: "ready",
          meshCount: 1,
          submeshCount: 1,
          vertexCount: 24,
          indexCount: 36,
          diagnosticsCount: 0,
        },
      },
    },
    gltf: {
      metadata: {
        extensions: {
          used: ["EXT_meshopt_compression"],
          required: ["EXT_meshopt_compression"],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 1,
        diagnostics: 0,
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  expect(
    pixelDistance(visible, clear),
    `Meshopt GLB sample should render visible mesh pixels; sample=${JSON.stringify(
      visible,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders an embedded-image GLB texture sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=embedded-texture");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "embedded-texture" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|opaque|back|less|none",
        ) === true &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "embedded texture viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Embedded texture viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textureWarm = readPngPixel(screenshot, 0.35, 0.43);
  const textureCool = readPngPixel(screenshot, 0.46, 0.57);
  const scalarControl = readPngPixel(screenshot, 0.64, 0.5);
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("[255,74,74");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "embedded-texture",
      label: "Embedded texture",
      source: "sample",
      url: "/examples/assets/embedded-texture.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "buffer-view",
            decodeMode: "async-buffer-view",
            assetStates: ["loading", "ready"],
            textureHandleKey: expect.stringMatching(
              /^texture:viewer-embedded-texture-\d+:texture:0:baseColorTexture$/,
            ),
            registryStatusBeforeRegistration: "loading",
            registryStatusAfterRegistration: "ready",
            uri: "bufferView:8",
            url: "/examples/assets/embedded-texture.glb#bufferView=8",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      metadata: {
        status: "ready",
        counts: {
          scenes: 1,
          nodes: 1,
          meshes: 1,
          primitives: 2,
          materials: 2,
          animations: 0,
        },
        extensions: {
          used: [],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-embedded-texture-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-embedded-texture-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(textureWarm, clear),
    `embedded texture should render visible pixels; sample=${JSON.stringify(
      textureWarm,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(textureWarm, textureCool),
    "embedded base-color texture should create visible variation",
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(textureWarm, scalarControl) +
      pixelDistance(textureCool, scalarControl),
    "embedded textured primitive should differ from the scalar control region",
  ).toBeGreaterThan(30);
  webGpuValidation.expectNoWarnings();
});

test("Playwright decodes a same-origin PNG URI texture for the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=uri-png-texture");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "uri-png-texture" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-uri-base-color-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|opaque|back|less|none",
        ) === true &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "URI PNG texture viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("URI PNG texture viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textureWarm = readPngPixel(screenshot, 0.35, 0.43);
  const textureCool = readPngPixel(screenshot, 0.46, 0.57);
  const scalarControl = readPngPixel(screenshot, 0.64, 0.5);
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("[255,74,74");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "uri-png-texture",
      label: "URI PNG texture",
      source: "sample",
      url: "/examples/assets/uri-png-texture.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-uri-base-color-checker.png",
            url: "/examples/assets/aperture-uri-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-uri-png-texture-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-uri-png-texture-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(textureWarm, clear),
    `URI PNG texture should render visible pixels; sample=${JSON.stringify(
      textureWarm,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(textureWarm, textureCool),
    "same-origin PNG decode should create visible base-color variation",
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(textureWarm, scalarControl) +
      pixelDistance(textureCool, scalarControl),
    "URI PNG textured primitive should differ from the scalar control region",
  ).toBeGreaterThan(30);
  webGpuValidation.expectNoWarnings();
});

test("Playwright decodes a same-origin JPEG URI texture for the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=uri-jpeg-texture");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                  readonly mimeType?: string;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "uri-jpeg-texture" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-jpeg-base-color-checker.jpg" &&
            entry.mimeType === "image/jpeg" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|opaque|back|less|none",
        ) === true &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "URI JPEG texture viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("URI JPEG texture viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textureWarm = readPngPixel(screenshot, 0.35, 0.43);
  const textureCool = readPngPixel(screenshot, 0.46, 0.57);
  const scalarControl = readPngPixel(screenshot, 0.64, 0.5);
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("[255,74,74");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "uri-jpeg-texture",
      label: "URI JPEG texture",
      source: "sample",
      url: "/examples/assets/uri-jpeg-texture.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-jpeg-base-color-checker.jpg",
            url: "/examples/assets/aperture-jpeg-base-color-checker.jpg",
            mimeType: "image/jpeg",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-uri-jpeg-texture-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-uri-jpeg-texture-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(textureWarm, clear),
    `URI JPEG texture should render visible pixels; sample=${JSON.stringify(
      textureWarm,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(textureWarm, textureCool),
    "same-origin JPEG decode should create visible base-color variation",
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(textureWarm, scalarControl) +
      pixelDistance(textureCool, scalarControl),
    "URI JPEG textured primitive should differ from the scalar control region",
  ).toBeGreaterThan(30);
  webGpuValidation.expectNoWarnings();
});

test("Playwright decodes all StandardMaterial URI texture slots in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly textureSlots?: {
                    readonly baseColorTexture?: TextureSlotStatus | null;
                    readonly metallicRoughnessTexture?: TextureSlotStatus | null;
                    readonly normalTexture?: TextureSlotStatus | null;
                    readonly occlusionTexture?: TextureSlotStatus | null;
                    readonly emissiveTexture?: TextureSlotStatus | null;
                  } | null;
                }[];
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const resolution =
        status?.gltf?.primitiveMaterials?.resolutions?.[0] ?? null;
      const decodedUris = new Set(
        status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
      );

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "all-slot-uri-textures" &&
        status.selectedAsset.loading === false &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true &&
        status.source?.ok === true &&
        decodedUris.has("aperture-uri-base-color-checker.png") &&
        decodedUris.has("aperture-metallic-roughness-checker.png") &&
        decodedUris.has("aperture-normal-checker.png") &&
        decodedUris.has("aperture-occlusion-checker.png") &&
        decodedUris.has("aperture-base-color-checker.png") &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|emissiveTexture|metallicRoughnessTexture|normalTexture|occlusionTexture|opaque|back|less|none",
        ) === true &&
        resolution?.textureSlots?.baseColorTexture?.texCoord === 0 &&
        resolution.textureSlots.metallicRoughnessTexture?.texCoord === 0 &&
        resolution.textureSlots.normalTexture?.texCoord === 0 &&
        resolution.textureSlots.occlusionTexture?.texCoord === 0 &&
        resolution.textureSlots.emissiveTexture?.texCoord === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "all-slot URI texture viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("All-slot URI texture viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textured = strongestRegionSample(
    screenshot,
    clear,
    0.28,
    0.34,
    0.47,
    0.66,
  );
  const scalarControl = strongestRegionSample(
    screenshot,
    clear,
    0.53,
    0.34,
    0.72,
    0.66,
  );
  const serializedStatus = JSON.stringify(status);
  const allSlotPipelineKey =
    "standard|baseColorTexture|emissiveTexture|metallicRoughnessTexture|normalTexture|occlusionTexture|opaque|back|less|none";

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("[255,94,82");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "all-slot-uri-textures",
      label: "All-slot URI textures",
      source: "sample",
      url: "/examples/assets/all-slot-uri-textures.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
    },
    source: {
      ok: true,
      imageDecode: {
        decoded: expect.arrayContaining([
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-uri-base-color-checker.png",
            url: "/examples/assets/aperture-uri-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 1,
            sourceKind: "same-origin-uri",
            uri: "aperture-metallic-roughness-checker.png",
            url: "/examples/assets/aperture-metallic-roughness-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 2,
            sourceKind: "same-origin-uri",
            uri: "aperture-normal-checker.png",
            url: "/examples/assets/aperture-normal-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 3,
            sourceKind: "same-origin-uri",
            uri: "aperture-occlusion-checker.png",
            url: "/examples/assets/aperture-occlusion-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
          {
            imageIndex: 4,
            sourceKind: "same-origin-uri",
            uri: "aperture-base-color-checker.png",
            url: "/examples/assets/aperture-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ]),
        diagnostics: [],
      },
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: allSlotPipelineKey,
            factors: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 1,
              roughnessFactor: 1,
              normalScale: 1.75,
              occlusionStrength: 0.72,
              emissiveFactor: [0.35, 0.12, 0.08],
            },
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-all-slot-uri-textures-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-all-slot-uri-textures-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              metallicRoughnessTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-all-slot-uri-textures-\d+:texture:1:metallicRoughnessTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-all-slot-uri-textures-\d+:sampler:1:metallicRoughnessTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              normalTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-all-slot-uri-textures-\d+:texture:2:normalTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-all-slot-uri-textures-\d+:sampler:2:normalTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              occlusionTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-all-slot-uri-textures-\d+:texture:3:occlusionTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-all-slot-uri-textures-\d+:sampler:3:occlusionTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
              emissiveTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-all-slot-uri-textures-\d+:texture:4:emissiveTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-all-slot-uri-textures-\d+:sampler:4:emissiveTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        allSlotPipelineKey,
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  expect(
    pixelDistance(textured, clear),
    `all-slot textured region should render visible pixels; sample=${JSON.stringify(
      textured,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(textured, scalarControl),
    "all-slot textured primitive should differ from the scalar control",
  ).toBeGreaterThan(15);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports selected GLB viewer material-slot summaries", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const samples = [
    {
      id: "all-slot-uri-textures",
      summary: {
        materialCount: 2,
        registeredMaterialCount: 2,
        missingMaterialCount: 0,
        scalarOnlyMaterialCount: 1,
        textureSlots: {
          baseColorTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
          metallicRoughnessTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
          normalTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
          occlusionTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
          emissiveTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
        },
        alphaModes: { opaque: 2, mask: 0, blend: 0 },
        uv1Usage: { materials: 0, textureSlots: 0 },
      },
    },
    {
      id: "sampler-wrap-controls",
      summary: {
        materialCount: 3,
        registeredMaterialCount: 3,
        missingMaterialCount: 0,
        scalarOnlyMaterialCount: 1,
        textureSlots: {
          baseColorTexture: { count: 2, uv0: 2, uv1: 0, otherUv: 0 },
          metallicRoughnessTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          normalTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          occlusionTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          emissiveTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
        },
        alphaModes: { opaque: 3, mask: 0, blend: 0 },
        uv1Usage: { materials: 0, textureSlots: 0 },
      },
    },
    {
      id: "uv1-image-decode-controls",
      summary: {
        materialCount: 3,
        registeredMaterialCount: 3,
        missingMaterialCount: 0,
        scalarOnlyMaterialCount: 1,
        textureSlots: {
          baseColorTexture: { count: 2, uv0: 1, uv1: 1, otherUv: 0 },
          metallicRoughnessTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          normalTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          occlusionTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          emissiveTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
        },
        alphaModes: { opaque: 3, mask: 0, blend: 0 },
        uv1Usage: { materials: 1, textureSlots: 1 },
      },
    },
    {
      id: "brass",
      summary: {
        materialCount: 1,
        registeredMaterialCount: 1,
        missingMaterialCount: 0,
        scalarOnlyMaterialCount: 1,
        textureSlots: {
          baseColorTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          metallicRoughnessTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          normalTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          occlusionTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          emissiveTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
        },
        alphaModes: { opaque: 1, mask: 0, blend: 0 },
        uv1Usage: { materials: 0, textureSlots: 0 },
      },
    },
  ] as const;

  await page.goto(`/examples/glb-viewer.html?asset=${samples[0].id}`);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  for (const sample of samples) {
    await page.goto(`/examples/glb-viewer.html?asset=${sample.id}`);
    await page.waitForFunction(
      (id) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
                readonly materialSlotSummary?: MaterialSlotSummaryStatus;
              };
              readonly source?: { readonly ok?: boolean };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly diagnostics?: number;
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const summary = status?.selectedAsset?.materialSlotSummary;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.source?.ok === true &&
          status.gltf?.primitiveMaterials?.diagnostics === 0 &&
          summary !== undefined &&
          summary.materialCount === status.gltf?.primitiveMaterials?.resolved
        );
      },
      sample.id,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${sample.id} material-slot summary status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${sample.id} material-slot summary did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    expect(JSON.stringify(status)).not.toContain("Uint8Array");
    expect(status).toMatchObject({
      selectedAsset: {
        id: sample.id,
        loading: false,
        materialSlotSummary: sample.summary,
      },
    });
  }

  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer material-slot summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  async function waitForSummaryRows(id: string, materialCount: number) {
    await page.waitForFunction(
      ({ id, materialCount }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
                readonly materialSlotSummary?: MaterialSlotSummaryStatus;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.selectedAsset.materialSlotSummary?.materialCount ===
            materialCount
        );
      },
      { id, materialCount },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(status, `${id} summary-row status should publish`).toBeDefined();

    if (status === undefined) {
      throw new Error(`${id} summary-row status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);

    return status;
  }

  const summaryPanel = page.locator("#glb-material-slot-summary");
  const summaryRow = (key: string) =>
    summaryPanel.locator(`[data-summary-row="${key}"]`);

  const allSlotStatus = await waitForSummaryRows("all-slot-uri-textures", 2);

  expect(allSlotStatus.selectedAsset?.materialSlotSummary).toMatchObject({
    materialCount: 2,
    scalarOnlyMaterialCount: 1,
    textureSlots: {
      baseColorTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
      metallicRoughnessTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
      normalTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
      occlusionTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
      emissiveTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
    },
    alphaModes: { opaque: 2, mask: 0, blend: 0 },
    uv1Usage: { materials: 0, textureSlots: 0 },
  });
  await expect(summaryRow("materials")).toContainText("2 total, 1 scalar");
  await expect(summaryRow("baseColorTexture")).toContainText(
    "1 total, uv0 1, uv1 0, other 0",
  );
  await expect(summaryRow("metallicRoughnessTexture")).toContainText(
    "1 total, uv0 1, uv1 0, other 0",
  );
  await expect(summaryRow("normalTexture")).toContainText(
    "1 total, uv0 1, uv1 0, other 0",
  );
  await expect(summaryRow("occlusionTexture")).toContainText(
    "1 total, uv0 1, uv1 0, other 0",
  );
  await expect(summaryRow("emissiveTexture")).toContainText(
    "1 total, uv0 1, uv1 0, other 0",
  );
  await expect(summaryRow("alphaModes")).toContainText(
    "opaque 2, mask 0, blend 0",
  );
  await expect(summaryRow("uv1Usage")).toContainText("materials 0, slots 0");

  await page.locator("#glb-asset-select").selectOption("brass");
  const brassStatus = await waitForSummaryRows("brass", 1);

  expect(brassStatus.selectedAsset?.materialSlotSummary).toMatchObject({
    materialCount: 1,
    scalarOnlyMaterialCount: 1,
    textureSlots: {
      baseColorTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
      metallicRoughnessTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
      normalTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
      occlusionTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
      emissiveTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
    },
    alphaModes: { opaque: 1, mask: 0, blend: 0 },
    uv1Usage: { materials: 0, textureSlots: 0 },
  });
  await expect(summaryRow("materials")).toContainText("1 total, 1 scalar");
  await expect(summaryRow("baseColorTexture")).toContainText(
    "0 total, uv0 0, uv1 0, other 0",
  );
  await expect(summaryRow("metallicRoughnessTexture")).toContainText(
    "0 total, uv0 0, uv1 0, other 0",
  );
  await expect(summaryRow("normalTexture")).toContainText(
    "0 total, uv0 0, uv1 0, other 0",
  );
  await expect(summaryRow("occlusionTexture")).toContainText(
    "0 total, uv0 0, uv1 0, other 0",
  );
  await expect(summaryRow("emissiveTexture")).toContainText(
    "0 total, uv0 0, uv1 0, other 0",
  );
  await expect(summaryRow("alphaModes")).toContainText(
    "opaque 1, mask 0, blend 0",
  );
  await expect(summaryRow("uv1Usage")).toContainText("materials 0, slots 0");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer decoded-image summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  async function waitForDecodedImageRows({
    url,
    selectedId,
    uris,
  }: {
    readonly url: string;
    readonly selectedId: string;
    readonly uris: readonly string[];
  }) {
    await page.goto(url);
    const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(initialStatus, "GLB viewer status should publish").toBeDefined();

    if (initialStatus === undefined) {
      throw new Error("GLB viewer status did not publish.");
    }

    skipIfUnsupportedWebGpu(initialStatus);
    await page.waitForFunction(
      ({ selectedId, uris }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly source?: {
                readonly imageDecode?: {
                  readonly decoded?: readonly { readonly uri?: string }[];
                  readonly diagnostics?: readonly unknown[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const decodedUris =
          status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [];

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === selectedId &&
          status.selectedAsset.loading === false &&
          decodedUris.length === uris.length &&
          uris.every((uri) => decodedUris.includes(uri)) &&
          status.source?.imageDecode?.diagnostics?.length === 0
        );
      },
      { selectedId, uris },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${selectedId} decoded-image row status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${selectedId} decoded-image row status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    expect(
      status.source?.imageDecode.decoded.map((entry) => entry.uri).sort(),
    ).toEqual([...uris].sort());

    return status;
  }

  const summaryPanel = page.locator("#glb-image-decode-summary");
  const imageRow = (uri: string) =>
    summaryPanel.locator(`[data-image-decode-uri="${uri}"]`);
  const formatDecodedImage = (
    image: NonNullable<
      GlbViewerStatus["source"]
    >["imageDecode"]["decoded"][number],
  ) =>
    `${image.sourceKind}, ${image.uri}, ${image.mimeType}, ${image.width}x${image.height}, ${image.byteLength} bytes`;
  const allSlotUris = [
    "aperture-uri-base-color-checker.png",
    "aperture-metallic-roughness-checker.png",
    "aperture-normal-checker.png",
    "aperture-occlusion-checker.png",
    "aperture-base-color-checker.png",
  ] as const;

  const allSlotStatus = await waitForDecodedImageRows({
    url: "/examples/glb-viewer.html?asset=all-slot-uri-textures",
    selectedId: "all-slot-uri-textures",
    uris: allSlotUris,
  });
  await expect(summaryPanel.locator("[data-image-decode-row]")).toHaveCount(5);
  for (const image of allSlotStatus.source?.imageDecode.decoded ?? []) {
    await expect(imageRow(image.uri)).toContainText(
      `image ${image.imageIndex}`,
    );
    await expect(imageRow(image.uri)).toContainText(formatDecodedImage(image));
  }

  await waitForDecodedImageRows({
    url: `/examples/glb-viewer.html?url=${encodeURIComponent(
      "/examples/assets/uri-png-texture.glb",
    )}`,
    selectedId: "custom-url",
    uris: ["aperture-uri-base-color-checker.png"],
  });
  await expect(summaryPanel.locator("[data-image-decode-row]")).toHaveCount(1);
  await expect(imageRow("aperture-uri-base-color-checker.png")).toContainText(
    "same-origin-uri, aperture-uri-base-color-checker.png, image/png, 2x2, 16 bytes",
  );

  await waitForDecodedImageRows({
    url: "/examples/glb-viewer.html?asset=embedded-texture",
    selectedId: "embedded-texture",
    uris: ["bufferView:8"],
  });
  await expect(summaryPanel.locator("[data-image-decode-row]")).toHaveCount(1);
  await expect(imageRow("bufferView:8")).toContainText("image 0");
  await expect(imageRow("bufferView:8")).toContainText(
    "buffer-view, bufferView:8, image/png, 2x2, 16 bytes",
  );

  await page.goto("/examples/glb-viewer.html?asset=cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly source?: {
              readonly imageDecode?: {
                readonly decoded?: readonly unknown[];
              };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.source?.imageDecode?.decoded?.length === 0 &&
        document.querySelectorAll(
          "#glb-image-decode-summary [data-image-decode-row]",
        ).length === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(summaryPanel.locator("[data-image-decode-row]")).toHaveCount(0);
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer unsupported-feature summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-unsupported-feature-summary");
  const unsupportedRow = (code: string) =>
    summaryPanel.locator(`[data-unsupported-feature-code="${code}"]`);

  async function waitForUnsupportedSample({
    assetId,
    code,
  }: {
    readonly assetId: string;
    readonly code: string;
  }) {
    await page.goto(`/examples/glb-viewer.html?asset=${assetId}`);
    const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(initialStatus, "GLB viewer status should publish").toBeDefined();

    if (initialStatus === undefined) {
      throw new Error("GLB viewer status did not publish.");
    }

    skipIfUnsupportedWebGpu(initialStatus);
    await page.waitForFunction(
      ({ assetId, code }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly importedCamera?: {
                readonly cameras?: readonly {
                  readonly status?: string;
                  readonly reason?: string;
                }[];
              };
              readonly gltf?: {
                readonly metadata?: {
                  readonly unsupportedFeatureDiagnostics?: readonly {
                    readonly code?: string;
                  }[];
                };
              };
              readonly extraction?: {
                readonly meshDraws?: number;
                readonly diagnostics?: number;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const metadataCodes =
          status?.gltf?.metadata?.unsupportedFeatureDiagnostics?.map(
            (diagnostic) => diagnostic.code,
          ) ?? [];
        const hasUnsupportedCamera =
          status?.importedCamera?.cameras?.some(
            (camera) =>
              camera.status === "unsupported" &&
              camera.reason === "orthographic-camera",
          ) === true;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === assetId &&
          status.selectedAsset.loading === false &&
          status.extraction?.meshDraws === 1 &&
          status.extraction.diagnostics === 0 &&
          (metadataCodes.includes(code) ||
            (code === "glbViewer.unsupportedImportedCamera" &&
              hasUnsupportedCamera))
        );
      },
      { assetId, code },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${assetId} unsupported-row status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${assetId} unsupported-row status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
  }

  await waitForUnsupportedSample({
    assetId: "unsupported-primitive",
    code: "gltfMesh.unsupportedPrimitiveMode",
  });
  await expect(
    unsupportedRow("gltfMesh.unsupportedPrimitiveMode"),
  ).toContainText("code gltfMesh.unsupportedPrimitiveMode");
  await expect(
    unsupportedRow("gltfMesh.unsupportedPrimitiveMode"),
  ).toContainText("severity warning");
  await expect(
    unsupportedRow("gltfMesh.unsupportedPrimitiveMode"),
  ).toContainText("mesh 0, primitive 1, mode 1");

  await page.goto("/examples/glb-viewer.html?asset=cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly gltf?: {
              readonly metadata?: {
                readonly unsupportedFeatureDiagnostics?: readonly unknown[];
              };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.gltf?.metadata?.unsupportedFeatureDiagnostics?.length === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(
    summaryPanel.locator("[data-unsupported-feature-row]"),
  ).toHaveCount(0);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer animation summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-animation-summary");
  const animationRow = (key: string) =>
    summaryPanel.locator(`[data-animation-summary-row="${key}"]`);

  await page.goto("/examples/glb-viewer.html?asset=animated");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  async function waitForAnimationRows({
    direction,
    speed,
  }: {
    readonly direction: string;
    readonly speed: number;
  }) {
    await page.waitForFunction(
      ({ direction, speed }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly animation?: {
                readonly status?: string;
                readonly activeClipName?: string | null;
                readonly direction?: string;
                readonly speed?: number;
                readonly duration?: number;
                readonly channelCount?: number;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === "animated" &&
          status.selectedAsset.loading === false &&
          status.animation?.status === "playing" &&
          status.animation.activeClipName === "SlideX" &&
          status.animation.direction === direction &&
          Math.abs((status.animation.speed ?? Number.NaN) - speed) < 0.001 &&
          status.animation.duration === 4 &&
          status.animation.channelCount === 1
        );
      },
      { direction, speed },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(status, "animation summary-row status should publish").toBeDefined();

    if (status === undefined) {
      throw new Error("Animation summary-row status did not publish.");
    }

    expectStatusJsonSafeForGpu(status);
  }

  await waitForAnimationRows({ direction: "forward", speed: 1 });
  await expect(animationRow("clip")).toContainText("SlideX");
  await expect(animationRow("mode")).toContainText("playing, repeat, forward");
  await expect(animationRow("time")).toContainText("/ 4");
  await expect(animationRow("speed")).toContainText("1");
  await expect(animationRow("channels")).toContainText("1 channels, 1 clips");

  await setSelectInputValue(page, "#glb-animation-direction", "reverse");
  await waitForAnimationRows({ direction: "reverse", speed: 1 });
  await expect(animationRow("mode")).toContainText("playing, repeat, reverse");

  await setRangeInputValue(page, "#glb-animation-speed", 2);
  await waitForAnimationRows({ direction: "reverse", speed: 2 });
  await expect(animationRow("speed")).toContainText("2");

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: { readonly status?: string };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.animation?.status === "absent"
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(
    summaryPanel.locator("[data-animation-summary-row]"),
  ).toHaveCount(0);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer animation clip-list rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-animation-clip-summary");
  const clipRow = (index: number) =>
    summaryPanel.locator(`[data-animation-clip-row="${index}"]`);
  const waitForClipRows = async (expected: {
    readonly id: string;
    readonly clipCount: number;
  }) => {
    await page.waitForFunction(
      ({ id, clipCount }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly animation?: {
                readonly clipCount?: number;
                readonly clips?: readonly {
                  readonly index?: number;
                  readonly name?: string;
                  readonly duration?: number;
                }[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.animation?.clipCount === clipCount &&
          status.animation.clips?.length === clipCount &&
          document.querySelectorAll(
            "#glb-animation-clip-summary [data-animation-clip-row]",
          ).length === clipCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} clip-list status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} clip-list status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const expectClipRow = async (
    index: number,
    clip: { readonly name: string; readonly duration: number },
  ) => {
    await expect(clipRow(index)).toContainText(
      `#${index}, ${clip.name}, ${clip.duration}s`,
    );
  };

  await page.goto("/examples/glb-viewer.html?asset=animated");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const animatedStatus = await waitForClipRows({
    id: "animated",
    clipCount: 1,
  });
  await expect(summaryPanel.locator("[data-animation-clip-row]")).toHaveCount(
    1,
  );
  const animatedClip = animatedStatus.animation?.clips[0];

  expect(animatedClip, "animated clip row should publish").toBeDefined();

  if (animatedClip === undefined) {
    throw new Error("Animated clip row did not publish.");
  }

  await expectClipRow(0, animatedClip);

  await page.locator("#glb-asset-select").selectOption("multi-clip");
  const multiClipStatus = await waitForClipRows({
    id: "multi-clip",
    clipCount: 2,
  });
  await expect(summaryPanel.locator("[data-animation-clip-row]")).toHaveCount(
    2,
  );
  const slideClip = multiClipStatus.animation?.clips[0];
  const riseClip = multiClipStatus.animation?.clips[1];

  expect(slideClip, "multi-clip row 0 should publish").toBeDefined();
  expect(riseClip, "multi-clip row 1 should publish").toBeDefined();

  if (slideClip === undefined || riseClip === undefined) {
    throw new Error("Multi-clip rows did not publish.");
  }

  await expectClipRow(0, slideClip);
  await expectClipRow(1, riseClip);

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly status?: string;
              readonly clipCount?: number;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.animation?.status === "absent" &&
        status.animation.clipCount === 0 &&
        document.querySelectorAll(
          "#glb-animation-clip-summary [data-animation-clip-row]",
        ).length === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer animated-node rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-animation-node-summary");
  const nodeRow = (key: string) =>
    summaryPanel.locator(`[data-animation-node-row="${key}"]`);
  const waitForAnimatedNodeRows = async (expected: {
    readonly id: string;
    readonly paths: readonly string[];
  }) => {
    await page.waitForFunction(
      ({ id, paths }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly animation?: {
                readonly animatedNodes?: readonly {
                  readonly nodeIndex?: number;
                  readonly path?: string;
                  readonly value?: readonly number[];
                }[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const nodes = status?.animation?.animatedNodes ?? [];

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          nodes.length === paths.length &&
          paths.every((path) =>
            nodes.some(
              (node) =>
                node.nodeIndex === 0 &&
                node.path === path &&
                (node.value?.length ?? 0) >= 3,
            ),
          ) &&
          document.querySelectorAll(
            "#glb-animation-node-summary [data-animation-node-row]",
          ).length === paths.length
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} animated-node status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} animated-node status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const expectAnimatedNodeRow = async (node: {
    readonly nodeIndex: number;
    readonly path: string;
    readonly interpolation?: string;
    readonly value: readonly number[];
  }) => {
    const row = nodeRow(`${node.nodeIndex}:${node.path}`);

    await expect(row).toContainText(
      `${node.path}, ${node.interpolation ?? "none"}`,
    );
    await expect(row).toContainText(/-?\d/);
  };

  await page.goto("/examples/glb-viewer.html?asset=animated");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const translationStatus = await waitForAnimatedNodeRows({
    id: "animated",
    paths: ["translation"],
  });
  const translationNode = translationStatus.animation?.animatedNodes.find(
    (node) => node.path === "translation",
  );

  expect(
    translationNode,
    "translation animated-node row should publish",
  ).toBeDefined();

  if (translationNode === undefined) {
    throw new Error("Translation animated-node row did not publish.");
  }

  await expectAnimatedNodeRow(translationNode);

  await page.locator("#glb-asset-select").selectOption("rotation-scale");
  const rotationScaleStatus = await waitForAnimatedNodeRows({
    id: "rotation-scale",
    paths: ["rotation", "scale"],
  });

  for (const path of ["rotation", "scale"]) {
    const node = rotationScaleStatus.animation?.animatedNodes.find(
      (entry) => entry.path === path,
    );

    expect(node, `${path} animated-node row should publish`).toBeDefined();

    if (node === undefined) {
      throw new Error(`${path} animated-node row did not publish.`);
    }

    await expectAnimatedNodeRow(node);
  }

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly status?: string;
              readonly animatedNodes?: readonly unknown[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.animation?.status === "absent" &&
        status.animation.animatedNodes?.length === 0 &&
        document.querySelectorAll(
          "#glb-animation-node-summary [data-animation-node-row]",
        ).length === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer animation-channel diagnostic rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-animation-channel-summary");
  const channelSummaryRow = (key: string) =>
    summaryPanel.locator(`[data-animation-channel-summary-row="${key}"]`);
  const channelRow = (index: number) =>
    summaryPanel.locator(`[data-animation-channel-row="${index}"]`);

  await page.goto("/examples/glb-viewer.html?asset=cubic-spline");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly unsupportedChannelCount?: number;
              readonly unsupportedChannels?: readonly {
                readonly code?: string;
                readonly path?: string;
                readonly interpolation?: string;
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cubic-spline" &&
        status.selectedAsset.loading === false &&
        status.animation?.unsupportedChannelCount === 1 &&
        status.animation.unsupportedChannels?.some(
          (channel) =>
            channel.code === "gltfAnimation.unsupportedInterpolation" &&
            channel.path === "translation" &&
            channel.interpolation === "CUBICSPLINE",
        ) === true &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "animation-channel status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Animation-channel status did not publish.");
  }

  expectStatusJsonSafeForGpu(status);
  await expect(
    summaryPanel.locator("[data-animation-channel-summary-row]"),
  ).toHaveCount(2);
  await expect(channelSummaryRow("count")).toContainText("1 channel");
  await expect(channelRow(0)).toContainText(
    "translation, CUBICSPLINE, node 0, sampler 0",
  );

  await page.locator("#glb-asset-select").selectOption("animated");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly status?: string;
              readonly unsupportedChannelCount?: number;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "animated" &&
        status.selectedAsset.loading === false &&
        status.animation?.status === "playing" &&
        status.animation.unsupportedChannelCount === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(
    summaryPanel.locator("[data-animation-channel-summary-row]"),
  ).toHaveCount(0);
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer imported-camera summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-imported-camera-summary");
  const cameraRow = (key: string) =>
    summaryPanel.locator(`[data-imported-camera-summary-row="${key}"]`);

  await page.goto("/examples/glb-viewer.html?asset=imported-camera");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  async function waitForCameraRows(enabled: boolean) {
    await page.waitForFunction(
      (enabled) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly importedCamera?: {
                readonly status?: string;
                readonly controls?: {
                  readonly available?: boolean;
                  readonly enabled?: boolean;
                };
                readonly selected?: {
                  readonly name?: string | null;
                  readonly projection?: string;
                  readonly yfov?: number;
                  readonly near?: number;
                  readonly far?: number;
                } | null;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === "imported-camera" &&
          status.selectedAsset.loading === false &&
          status.importedCamera?.status === "ready" &&
          status.importedCamera.controls?.available === true &&
          status.importedCamera.controls.enabled === enabled &&
          status.importedCamera.selected?.name === "ImportedPerspective" &&
          status.importedCamera.selected.projection === "perspective" &&
          Math.abs((status.importedCamera.selected.yfov ?? 0) - 0.72) < 0.001 &&
          status.importedCamera.selected.near === 0.1 &&
          status.importedCamera.selected.far === 50
        );
      },
      enabled,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      "imported-camera summary-row status should publish",
    ).toBeDefined();

    if (status === undefined) {
      throw new Error("Imported-camera summary-row status did not publish.");
    }

    expectStatusJsonSafeForGpu(status);
  }

  await waitForCameraRows(false);
  await expect(cameraRow("camera")).toContainText("ImportedPerspective");
  await expect(cameraRow("state")).toContainText("orbit");
  await expect(cameraRow("fov")).toContainText("0.72");
  await expect(cameraRow("range")).toContainText("0.1 - 50");
  await expect(cameraRow("aspect")).toContainText("1.778");

  await page.locator("#glb-imported-camera-toggle").click();
  await waitForCameraRows(true);
  await expect(cameraRow("state")).toContainText("imported");

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedCamera?: { readonly status?: string };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.importedCamera?.status === "absent"
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(
    summaryPanel.locator("[data-imported-camera-summary-row]"),
  ).toHaveCount(0);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer imported-camera list rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-imported-camera-list-summary");
  const cameraRow = (index: number) =>
    summaryPanel.locator(`[data-imported-camera-list-row="${index}"]`);
  const waitForCameraListRows = async (expected: {
    readonly id: string;
    readonly status: string;
    readonly cameraCount: number;
  }) => {
    await page.waitForFunction(
      ({ id, status: expectedStatus, cameraCount }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly importedCamera?: {
                readonly status?: string;
                readonly cameras?: readonly {
                  readonly cameraIndex?: number;
                  readonly nodeIndex?: number;
                  readonly projection?: string;
                  readonly status?: string;
                }[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.importedCamera?.status === expectedStatus &&
          status.importedCamera.cameras?.length === cameraCount &&
          document.querySelectorAll(
            "#glb-imported-camera-list-summary [data-imported-camera-list-row]",
          ).length === cameraCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} imported-camera list status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${expected.id} imported-camera list status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const expectCameraListRow = async (
    camera: ImportedCameraDescriptorStatus,
  ) => {
    const row = cameraRow(camera.cameraIndex);
    const name = camera.name ?? camera.cameraName ?? camera.nodeName ?? "none";

    await expect(row).toContainText(name);
    await expect(row).toContainText(camera.projection);
    await expect(row).toContainText(camera.status);
    await expect(row).toContainText(
      `node ${camera.nodeIndex}, camera ${camera.cameraIndex}`,
    );

    if (camera.reason !== undefined) {
      await expect(row).toContainText(camera.reason);
    }
  };

  await page.goto("/examples/glb-viewer.html?asset=imported-camera");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const perspectiveStatus = await waitForCameraListRows({
    id: "imported-camera",
    status: "ready",
    cameraCount: 1,
  });
  const perspectiveCamera = perspectiveStatus.importedCamera?.cameras[0];

  expect(
    perspectiveCamera,
    "perspective imported-camera row should publish",
  ).toBeDefined();

  if (perspectiveCamera === undefined) {
    throw new Error("Perspective imported-camera row did not publish.");
  }

  await expectCameraListRow(perspectiveCamera);

  await page.locator("#glb-asset-select").selectOption("orthographic-camera");
  const orthographicStatus = await waitForCameraListRows({
    id: "orthographic-camera",
    status: "ready",
    cameraCount: 1,
  });
  const orthographicCamera = orthographicStatus.importedCamera?.cameras[0];

  expect(
    orthographicCamera,
    "orthographic imported-camera row should publish",
  ).toBeDefined();

  if (orthographicCamera === undefined) {
    throw new Error("Orthographic imported-camera row did not publish.");
  }

  await expectCameraListRow(orthographicCamera);

  await page.locator("#glb-asset-select").selectOption("cube");
  await waitForCameraListRows({
    id: "cube",
    status: "absent",
    cameraCount: 0,
  });
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer live light summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-light-summary");
  const lightRow = (key: string) =>
    summaryPanel.locator(`[data-light-summary-row="${key}"]`);

  await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-ibl-sampling=1&disable-shadow-receiver=1",
    false,
    false,
  );
  await expect(lightRow("ambient")).toContainText(
    "control 0.24, ecs 0.24, extracted 0.24",
  );
  await expect(lightRow("point")).toContainText(
    "control 18, ecs 18, extracted 18",
  );
  await expect(lightRow("lights")).toContainText("3 extracted");

  await setRangeInputValue(page, "#glb-point-light-intensity", 0);
  await setRangeInputValue(page, "#glb-ambient-intensity", 0);
  const dimStatus = await waitForLightingStatus(page, {
    ambientIntensity: 0,
    pointIntensity: 0,
  });

  expectStatusJsonSafeForGpu(dimStatus);
  await expect(lightRow("ambient")).toContainText(
    "control 0, ecs 0, extracted 0",
  );
  await expect(lightRow("point")).toContainText(
    "control 0, ecs 0, extracted 0",
  );

  await setRangeInputValue(page, "#glb-point-light-intensity", 36);
  await setRangeInputValue(page, "#glb-ambient-intensity", 1);
  const brightStatus = await waitForLightingStatus(page, {
    ambientIntensity: 1,
    pointIntensity: 36,
  });

  expectStatusJsonSafeForGpu(brightStatus);
  await expect(lightRow("ambient")).toContainText(
    "control 1, ecs 1, extracted 1",
  );
  await expect(lightRow("point")).toContainText(
    "control 36, ecs 36, extracted 36",
  );
  await expect(lightRow("lights")).toContainText("3 extracted");

  await page.goto("/examples/glb-viewer.html?asset=imported-light");
  const importedStatus = await waitForImportedLightStatus(page, {
    enabled: true,
  });

  expectStatusJsonSafeForGpu(importedStatus);
  await expect(lightRow("ambient")).toContainText(
    "control 0.24, ecs 0.24, extracted 0.24",
  );
  await expect(lightRow("point")).toContainText(
    "control 18, ecs 18, extracted 18",
  );
  await expect(lightRow("lights")).toContainText("3 extracted");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer scene metadata summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-metadata-summary");
  const metadataRow = (key: string) =>
    summaryPanel.locator(`[data-metadata-summary-row="${key}"]`);

  async function waitForMetadataRows({
    assetId,
    scenes,
    nodes,
    meshes,
    primitives,
    materials,
    animations,
    usedExtensions,
    requiredExtensions,
  }: {
    readonly assetId: string;
    readonly scenes: number;
    readonly nodes: number;
    readonly meshes: number;
    readonly primitives: number;
    readonly materials: number;
    readonly animations: number;
    readonly usedExtensions: number;
    readonly requiredExtensions: number;
  }) {
    await page.goto(`/examples/glb-viewer.html?asset=${assetId}`);
    const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(initialStatus, "GLB viewer status should publish").toBeDefined();

    if (initialStatus === undefined) {
      throw new Error("GLB viewer status did not publish.");
    }

    skipIfUnsupportedWebGpu(initialStatus);
    await page.waitForFunction(
      ({
        assetId,
        scenes,
        nodes,
        meshes,
        primitives,
        materials,
        animations,
      }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly metadata?: {
                  readonly counts?: {
                    readonly scenes?: number;
                    readonly nodes?: number;
                    readonly meshes?: number;
                    readonly primitives?: number;
                    readonly materials?: number;
                    readonly animations?: number;
                  };
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const counts = status?.gltf?.metadata?.counts;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === assetId &&
          status.selectedAsset.loading === false &&
          counts?.scenes === scenes &&
          counts.nodes === nodes &&
          counts.meshes === meshes &&
          counts.primitives === primitives &&
          counts.materials === materials &&
          counts.animations === animations
        );
      },
      {
        assetId,
        scenes,
        nodes,
        meshes,
        primitives,
        materials,
        animations,
      },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${assetId} metadata-row status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${assetId} metadata-row status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    await expect(metadataRow("scene")).toContainText(
      `${scenes} scenes, ${nodes} nodes`,
    );
    await expect(metadataRow("mesh")).toContainText(
      `${meshes} meshes, ${primitives} primitives`,
    );
    await expect(metadataRow("material")).toContainText(
      `${materials} materials`,
    );
    await expect(metadataRow("animation")).toContainText(
      `${animations} animations`,
    );
    await expect(metadataRow("extensions")).toContainText(
      `used ${usedExtensions}, required ${requiredExtensions}`,
    );
  }

  await waitForMetadataRows({
    assetId: "multi-scene",
    scenes: 2,
    nodes: 2,
    meshes: 2,
    primitives: 2,
    materials: 2,
    animations: 0,
    usedExtensions: 1,
    requiredExtensions: 0,
  });
  await waitForMetadataRows({
    assetId: "all-slot-uri-textures",
    scenes: 1,
    nodes: 1,
    meshes: 1,
    primitives: 2,
    materials: 2,
    animations: 0,
    usedExtensions: 0,
    requiredExtensions: 0,
  });
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer selected-scene summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-scene-summary");
  const sceneRow = (key: string) =>
    summaryPanel.locator(`[data-scene-summary-row="${key}"]`);
  const waitForSceneRows = async (expected: {
    readonly id: string;
    readonly defaultSceneIndex: number;
    readonly selectedSceneIndex: number;
    readonly rootCount: number;
    readonly firstRoot: number;
  }) => {
    await page.waitForFunction(
      ({ id, defaultSceneIndex, selectedSceneIndex, rootCount, firstRoot }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly metadata?: {
                  readonly scene?: {
                    readonly defaultSceneIndex?: number | null;
                    readonly scenes?: readonly {
                      readonly sceneIndex?: number;
                      readonly selected?: boolean;
                      readonly rootNodeIndices?: readonly number[];
                    }[];
                  };
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const scene = status?.gltf?.metadata?.scene;
        const selected = scene?.scenes?.find((entry) => entry.selected);

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          scene?.defaultSceneIndex === defaultSceneIndex &&
          selected?.sceneIndex === selectedSceneIndex &&
          selected.rootNodeIndices?.length === rootCount &&
          selected.rootNodeIndices[0] === firstRoot
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} scene-row status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} scene-row status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
  };

  await page.goto("/examples/glb-viewer.html?asset=multi-scene");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForSceneRows({
    id: "multi-scene",
    defaultSceneIndex: 1,
    selectedSceneIndex: 1,
    rootCount: 1,
    firstRoot: 1,
  });
  await expect(summaryPanel.locator("[data-scene-summary-row]")).toHaveCount(4);
  await expect(sceneRow("default")).toContainText("1");
  await expect(sceneRow("selected")).toContainText("1");
  await expect(sceneRow("roots")).toContainText("1 roots");
  await expect(sceneRow("firstRoot")).toContainText("1");

  await page.locator("#glb-asset-select").selectOption("cube");
  await waitForSceneRows({
    id: "cube",
    defaultSceneIndex: 0,
    selectedSceneIndex: 0,
    rootCount: 1,
    firstRoot: 0,
  });
  await expect(sceneRow("default")).toContainText("0");
  await expect(sceneRow("selected")).toContainText("0");
  await expect(sceneRow("roots")).toContainText("1 roots");
  await expect(sceneRow("firstRoot")).toContainText("0");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer selected-asset summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-selected-asset-summary");
  const assetRow = (key: string) =>
    summaryPanel.locator(`[data-selected-asset-summary-row="${key}"]`);
  const waitForSelectedAssetRows = async (expected: {
    readonly id: string;
    readonly source: string;
    readonly materialText: string;
  }) => {
    await page.waitForFunction(
      ({ id, source }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
                readonly url?: string;
                readonly materialFamilies?: readonly unknown[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          typeof status.selectedAsset.url === "string" &&
          status.selectedAsset.materialFamilies !== undefined
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} selected-asset status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} selected-asset status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    await expect(assetRow("source")).toContainText(expected.source);
    await expect(assetRow("loading")).toContainText("false");
    await expect(assetRow("url")).toContainText(
      status.selectedAsset?.url ?? "",
    );
    await expect(assetRow("materials")).toContainText(expected.materialText);
  };

  await page.goto("/examples/glb-viewer.html?asset=cube");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForSelectedAssetRows({
    id: "cube",
    source: "sample",
    materialText: "unlit 1",
  });
  await expect(
    summaryPanel.locator("[data-selected-asset-summary-row]"),
  ).toHaveCount(4);

  await page.locator("#glb-gallery-next").click();
  await waitForSelectedAssetRows({
    id: "all-slot-uri-textures",
    source: "sample",
    materialText: "standard 2",
  });

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  await waitForSelectedAssetRows({
    id: "custom-url",
    source: "custom",
    materialText: "unlit 1",
  });
  await expect(assetRow("url")).toContainText(
    "/examples/assets/sapphire-pillar.glb",
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer orbit-fit summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-orbit-summary");
  const orbitRow = (key: string) =>
    summaryPanel.locator(`[data-orbit-summary-row="${key}"]`);
  const formatTuple = (values: readonly number[]) =>
    values.map((value) => Number(value.toFixed(3))).join(", ");

  await page.goto("/examples/glb-viewer.html?asset=cube");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly orbit?: {
              readonly fit?: { readonly status?: string };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.orbit?.fit?.status === "ready"
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const cubeStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const cubeOrbit = expectReadyOrbitFit(cubeStatus, "cube orbit summary");

  await expect(orbitRow("status")).toContainText("ready");
  await expect(orbitRow("center")).toContainText(
    formatTuple(cubeOrbit.fit.center),
  );
  await expect(orbitRow("size")).toContainText(formatTuple(cubeOrbit.fit.size));
  await expect(orbitRow("distance")).toContainText(String(cubeOrbit.distance));
  await expect(orbitRow("zoom")).toContainText(
    `${cubeOrbit.fit.minDistance} - ${cubeOrbit.fit.maxDistance}`,
  );

  await page.locator("#glb-asset-select").selectOption("brass");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly orbit?: {
              readonly fit?: { readonly status?: string };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "brass" &&
        status.selectedAsset.loading === false &&
        status.orbit?.fit?.status === "ready"
      );
    },
    undefined,
    { timeout: 5000 },
  );
  const brassStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const brassOrbit = expectReadyOrbitFit(brassStatus, "brass orbit summary");

  expect(brassOrbit.fit.size).not.toEqual(cubeOrbit.fit.size);
  await expect(orbitRow("size")).toContainText(
    formatTuple(brassOrbit.fit.size),
  );

  await page.locator("#aperture-canvas").hover();
  await page.mouse.wheel(0, -300);
  await page.locator("#glb-camera-reset").click();
  await page.waitForFunction(
    () => {
      const orbit = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly orbit?: {
              readonly distance?: number;
              readonly fit?: { readonly distance?: number };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.orbit;

      return (
        Math.abs((orbit?.distance ?? 0) - (orbit?.fit?.distance ?? 1)) < 0.001
      );
    },
    undefined,
    { timeout: 3000 },
  );
  const resetStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const resetOrbit = expectReadyOrbitFit(resetStatus, "reset orbit summary");

  await expect(orbitRow("distance")).toContainText(String(resetOrbit.distance));
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer shadow summary rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-shadow-summary");
  const shadowRow = (key: string) =>
    summaryPanel.locator(`[data-shadow-summary-row="${key}"]`);

  const initialStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-ibl-sampling=1",
    true,
    false,
  );

  expect(initialStatus.shadow).toMatchObject({
    controls: {
      receiverEnabled: true,
      casterEnabled: true,
    },
    rendering: {
      supported: true,
      mode: "directional-depth-compare",
    },
  });
  await expect(shadowRow("controls")).toContainText(
    "receiver true, caster true",
  );
  await expect(shadowRow("ecs")).toContainText("receiver true, caster true");
  await expect(shadowRow("authoring")).toContainText("1 casters, 1 receivers");
  await expect(shadowRow("drawList")).toContainText("1 included, 1 skipped");
  await expect(shadowRow("rendering")).toContainText(
    "supported true, directional-depth-compare",
  );
  await expect(shadowRow("submission")).toContainText("submitted");

  await page.locator("#glb-shadow-caster-toggle").setChecked(false);
  await waitForShadowControlStatus(page, {
    receiverEnabled: true,
    casterEnabled: false,
    supported: false,
    casterCount: 0,
    receiverCount: 1,
    includedDrawCount: 0,
  });

  await expect(shadowRow("controls")).toContainText(
    "receiver true, caster false",
  );
  await expect(shadowRow("ecs")).toContainText("receiver true, caster false");
  await expect(shadowRow("authoring")).toContainText("0 casters, 1 receivers");
  await expect(shadowRow("drawList")).toContainText("0 included, 2 skipped");
  await expect(shadowRow("rendering")).toContainText(
    "supported false, directional-depth-compare",
  );
  await expect(shadowRow("submission")).toContainText("ready");

  await page.locator("#glb-shadow-caster-toggle").setChecked(true);
  await waitForShadowControlStatus(page, {
    receiverEnabled: true,
    casterEnabled: true,
    supported: true,
    casterCount: 1,
    receiverCount: 1,
    includedDrawCount: 1,
  });

  await page.locator("#glb-shadow-receiver-toggle").setChecked(false);
  await waitForShadowControlStatus(page, {
    receiverEnabled: false,
    casterEnabled: true,
    supported: false,
    casterCount: 1,
    receiverCount: 0,
    includedDrawCount: 1,
  });

  await expect(shadowRow("controls")).toContainText(
    "receiver false, caster true",
  );
  await expect(shadowRow("ecs")).toContainText("receiver false, caster true");
  await expect(shadowRow("authoring")).toContainText("1 casters, 0 receivers");
  await expect(shadowRow("rendering")).toContainText(
    "supported false, directional-depth-compare",
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly shadow?: {
              readonly enabled?: boolean;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.shadow?.enabled === false
      );
    },
    undefined,
    { timeout: 5000 },
  );

  await expect(summaryPanel.locator("[data-shadow-summary-row]")).toHaveCount(
    0,
  );
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer shadow-request rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-shadow-request-summary");
  const requestRow = (index: number) =>
    summaryPanel.locator(`[data-shadow-request-row="${index}"]`);

  const status = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-ibl-sampling=1",
    true,
    false,
  );
  const request = status.shadow?.requests[0];

  expect(request, "shadow request row should publish").toBeDefined();

  if (request === undefined || status.shadow === undefined) {
    throw new Error("Shadow request row did not publish.");
  }

  await expect(summaryPanel.locator("[data-shadow-request-row]")).toHaveCount(
    1,
  );
  await expect(requestRow(0)).toContainText(
    `${status.shadow.rendering.mode}, supported true, casters ${status.shadow.authoring.casterCount}, receivers ${status.shadow.authoring.receiverCount}`,
  );
  await expect(requestRow(0)).toContainText(`shadow ${request.shadowId}`);
  await expect(requestRow(0)).toContainText(`light ${request.lightId}`);

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly shadow?: {
              readonly enabled?: boolean;
              readonly requests?: readonly unknown[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.shadow?.enabled === false &&
        status.shadow.requests?.length === 0 &&
        document.querySelectorAll(
          "#glb-shadow-request-summary [data-shadow-request-row]",
        ).length === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer IBL summary rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-ibl-summary");
  const iblRow = (key: string) =>
    summaryPanel.locator(`[data-ibl-summary-row="${key}"]`);

  const initialStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html",
    true,
    true,
  );

  expect(initialStatus.ibl).toMatchObject({
    enabled: true,
    controls: {
      enabled: true,
      available: true,
    },
    ecs: {
      environmentMapKey: "environment-map:glb-viewer-studio",
      intensity: 0.52,
    },
    rendering: {
      supported: true,
      diffusePipelineKey: expect.stringContaining("iblDiffuse"),
      specularPipelineKey: expect.stringContaining("iblSpecularProof"),
    },
  });
  await expect(iblRow("controls")).toContainText(
    "enabled true, available true",
  );
  await expect(iblRow("environment")).toContainText(
    "environment-map:glb-viewer-studio, intensity 0.52",
  );
  await expect(iblRow("resources")).toContainText("diffuse");
  await expect(iblRow("resources")).toContainText("specular");
  await expect(iblRow("resources")).toContainText("sampler");
  await expect(iblRow("rendering")).toContainText("supported true");
  await expect(iblRow("rendering")).toContainText("specular true");
  await expect(iblRow("pipelines")).toContainText("iblDiffuse");
  await expect(iblRow("pipelines")).toContainText("iblSpecularProof");

  await page.locator("#glb-ibl-toggle").setChecked(false);
  await waitForIblControlStatus(page, {
    enabled: false,
    supported: false,
    environmentMapKey: null,
    intensity: 0,
  });

  await expect(iblRow("controls")).toContainText(
    "enabled false, available true",
  );
  await expect(iblRow("environment")).toContainText("none, intensity 0");
  await expect(iblRow("rendering")).toContainText("supported false");
  await expect(iblRow("rendering")).toContainText("specular false");
  await expect(iblRow("pipelines")).toContainText(
    "diffuse none, specular none",
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly ibl?: {
              readonly controls?: { readonly available?: boolean };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.ibl?.controls?.available === false
      );
    },
    undefined,
    { timeout: 5000 },
  );

  await expect(summaryPanel.locator("[data-ibl-summary-row]")).toHaveCount(0);
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer IBL resource rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-ibl-resource-summary");
  const iblRow = (key: string) =>
    summaryPanel.locator(`[data-ibl-resource-summary-row="${key}"]`);

  const status = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html",
    true,
    true,
  );

  expect(status.ibl, "IBL resource status should publish").toBeDefined();

  if (status.ibl === undefined) {
    throw new Error("IBL resource status did not publish.");
  }

  await expect(
    summaryPanel.locator("[data-ibl-resource-summary-row]"),
  ).toHaveCount(5);
  await expect(iblRow("state")).toContainText(
    `enabled true, key ${status.ibl.environmentMapKey}`,
  );
  await expect(iblRow("diffuse")).toContainText(
    status.ibl.resources.diffuseTexture ?? "none",
  );
  await expect(iblRow("specular")).toContainText(
    status.ibl.resources.specularTexture ?? "none",
  );
  await expect(iblRow("sampler")).toContainText(
    status.ibl.resources.sampler ?? "none",
  );
  await expect(iblRow("pipelines")).toContainText("iblDiffuse");
  await expect(iblRow("pipelines")).toContainText("iblSpecularProof");

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly ibl?: {
              readonly enabled?: boolean;
              readonly environmentMapKey?: string | null;
              readonly resources?: {
                readonly diffuseTexture?: string | null;
                readonly specularTexture?: string | null;
                readonly sampler?: string | null;
              };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.ibl?.enabled === false &&
        status.ibl.environmentMapKey === null &&
        status.ibl.resources?.diffuseTexture === null &&
        status.ibl.resources.specularTexture === null &&
        status.ibl.resources.sampler === null
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(iblRow("state")).toContainText("enabled false, key none");
  await expect(iblRow("diffuse")).toContainText("none");
  await expect(iblRow("specular")).toContainText("none");
  await expect(iblRow("sampler")).toContainText("none");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer draw and extraction summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-draw-summary");
  const drawRow = (key: string) =>
    summaryPanel.locator(`[data-draw-summary-row="${key}"]`);
  const waitForDrawSummary = async (expected: {
    readonly id: string;
    readonly source: string;
    readonly meshDraws: number;
    readonly drawCalls: number;
  }) => {
    await page.waitForFunction(
      ({ id, source, meshDraws, drawCalls }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly source?: { readonly ok?: boolean };
              readonly extraction?: { readonly meshDraws?: number };
              readonly draw?: { readonly drawCalls?: number };
              readonly renderState?: {
                readonly pipelineKeys?: readonly string[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          status.source?.ok === true &&
          status.extraction?.meshDraws === meshDraws &&
          status.draw?.drawCalls === drawCalls &&
          (status.renderState?.pipelineKeys?.length ?? 0) >= 1
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} draw summary status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} draw summary status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto(
    "/examples/glb-viewer.html?asset=all-slot-uri-textures&disable-ibl-sampling=1",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForDrawSummary({
    id: "all-slot-uri-textures",
    source: "sample",
    meshDraws: 2,
    drawCalls: 2,
  });
  await expect(drawRow("extraction")).toContainText("1 views, 2 draws");
  await expect(drawRow("draw")).toContainText("2 packages, 2 calls");
  await expect(drawRow("materials")).toContainText("standard 2");
  await expect(drawRow("queues")).toContainText("opaque 2");
  await expect(drawRow("pipelines")).toContainText("standard");

  await page.locator("#glb-asset-select").selectOption("brass");
  await waitForDrawSummary({
    id: "brass",
    source: "sample",
    meshDraws: 2,
    drawCalls: 2,
  });
  await expect(drawRow("materials")).toContainText("standard 1");
  await expect(drawRow("pipelines")).toContainText("shadowMap");

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  await waitForDrawSummary({
    id: "custom-url",
    source: "custom",
    meshDraws: 1,
    drawCalls: 1,
  });
  await expect(drawRow("extraction")).toContainText("1 views, 1 draws");
  await expect(drawRow("draw")).toContainText("1 packages, 1 calls");
  await expect(drawRow("materials")).toContainText("unlit 1");
  await expect(drawRow("pipelines")).toContainText("unlit");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer render-state detail rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-render-state-summary");
  const renderStateRow = (key: string) =>
    summaryPanel.locator(`[data-render-state-summary-row="${key}"]`);
  const waitForRenderStateRows = async (expected: {
    readonly id: string;
    readonly source: string;
    readonly pipelineToken: string;
  }) => {
    await page.waitForFunction(
      ({ id, source, pipelineToken }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly renderState?: {
                readonly queues?: readonly string[];
                readonly pipelineKeys?: readonly string[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          (status.renderState?.queues?.length ?? 0) >= 1 &&
          status.renderState?.pipelineKeys?.some((key) =>
            key.includes(pipelineToken),
          ) === true
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} render-state status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} render-state status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto(
    "/examples/glb-viewer.html?asset=all-slot-uri-textures&disable-ibl-sampling=1",
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForRenderStateRows({
    id: "all-slot-uri-textures",
    source: "sample",
    pipelineToken: "baseColorTexture",
  });
  await expect(
    summaryPanel.locator("[data-render-state-summary-row]"),
  ).toHaveCount(3);
  await expect(renderStateRow("queues")).toContainText("opaque 2");
  await expect(renderStateRow("pipelineCount")).toContainText("2 unique");
  await expect(renderStateRow("pipelineKeys")).toContainText(
    "baseColorTexture",
  );

  await page.locator("#glb-asset-select").selectOption("brass");
  await waitForRenderStateRows({
    id: "brass",
    source: "sample",
    pipelineToken: "shadowMap",
  });
  await expect(renderStateRow("pipelineKeys")).toContainText("shadowMap");

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  await waitForRenderStateRows({
    id: "custom-url",
    source: "custom",
    pipelineToken: "unlit",
  });
  await expect(renderStateRow("queues")).toContainText("opaque 1");
  await expect(renderStateRow("pipelineKeys")).toContainText("unlit");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer pipeline-token detail rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-pipeline-token-summary");
  const tokenRow = (meshIndex: number, primitiveIndex: number) =>
    summaryPanel.locator(
      `[data-pipeline-token-row="${meshIndex}:${primitiveIndex}"]`,
    );
  const parsePipelineKey = (pipelineKey: string) => {
    const parts = pipelineKey.split("|");

    return {
      family: parts[0],
      features: parts.slice(1, -4),
      alpha: parts.at(-4),
      cull: parts.at(-3),
      depth: parts.at(-2),
      blend: parts.at(-1),
    };
  };
  const formatTokens = (pipelineKey: string) => {
    const tokens = parsePipelineKey(pipelineKey);
    const features =
      tokens.features.length === 0 ? "none" : tokens.features.join(",");

    return `family ${tokens.family}, features ${features}, alpha ${tokens.alpha}, cull ${tokens.cull}, depth ${tokens.depth}, blend ${tokens.blend}`;
  };
  const waitForPipelineRows = async (expected: {
    readonly id: string;
    readonly resolved: number;
  }) => {
    await page.waitForFunction(
      ({ id, resolved }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly {
                    readonly pipelineKey?: string | null;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const rows = (
          status?.gltf?.primitiveMaterials?.resolutions ?? []
        ).filter((resolution) => typeof resolution.pipelineKey === "string");

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          rows.length === resolved &&
          document.querySelectorAll(
            "#glb-pipeline-token-summary [data-pipeline-token-row]",
          ).length === resolved
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} pipeline-token status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} pipeline-token status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const assertPipelineRows = async (
    status: GlbViewerStatus | undefined,
    expectedCount: number,
  ) => {
    const resolutions = status?.gltf?.primitiveMaterials.resolutions ?? [];

    await expect(summaryPanel.locator("[data-pipeline-token-row]")).toHaveCount(
      expectedCount,
    );

    for (const resolution of resolutions) {
      if (resolution.pipelineKey === null) {
        continue;
      }

      await expect(
        tokenRow(resolution.meshIndex, resolution.primitiveIndex),
      ).toContainText(formatTokens(resolution.pipelineKey));
    }
  };

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await assertPipelineRows(
    await waitForPipelineRows({ id: "all-slot-uri-textures", resolved: 2 }),
    2,
  );
  await expect(tokenRow(0, 0)).toContainText("family standard");
  await expect(tokenRow(0, 0)).toContainText("features baseColorTexture");
  await expect(tokenRow(0, 1)).toContainText("features none");

  await page.locator("#glb-asset-select").selectOption("mixed-alpha");
  await assertPipelineRows(
    await waitForPipelineRows({ id: "mixed-alpha", resolved: 2 }),
    2,
  );
  await expect(tokenRow(0, 0)).toContainText(
    "family standard, features none, alpha opaque, cull back, depth less, blend none",
  );
  await expect(tokenRow(0, 1)).toContainText(
    "family standard, features none, alpha blend, cull back, depth less, blend alpha",
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await assertPipelineRows(
    await waitForPipelineRows({ id: "cube", resolved: 1 }),
    1,
  );
  await expect(tokenRow(0, 0)).toContainText(
    "family unlit, features none, alpha opaque, cull back, depth less, blend none",
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer mesh-draw identity rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-mesh-draw-summary");
  const drawRow = (renderId: number) =>
    summaryPanel.locator(`[data-mesh-draw-row="${renderId}"]`);
  const formatDraw = (draw: MeshDrawIdentityStatus) =>
    `render ${draw.renderId}, mesh ${draw.meshKey}, material ${draw.materialKey}, queue ${draw.queue}, pipeline ${draw.pipelineKey}`;
  const waitForDrawRows = async (expected: {
    readonly id: string;
    readonly source: string;
    readonly drawCount: number;
  }) => {
    await page.waitForFunction(
      ({ id, source, drawCount }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly renderState?: {
                readonly draws?: readonly unknown[];
              };
              readonly extraction?: {
                readonly meshDraws?: number;
              };
              readonly draw?: {
                readonly drawCalls?: number;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          status.extraction?.meshDraws === drawCount &&
          status.draw?.drawCalls === drawCount &&
          status.renderState?.draws?.length === drawCount &&
          document.querySelectorAll(
            "#glb-mesh-draw-summary [data-mesh-draw-row]",
          ).length === drawCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} mesh-draw identity status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${expected.id} mesh-draw identity status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const assertDrawRows = async (
    status: GlbViewerStatus | undefined,
    expectedCount: number,
  ) => {
    const draws = status?.renderState?.draws ?? [];

    expect(draws, "mesh-draw identities should publish").toHaveLength(
      expectedCount,
    );
    await expect(summaryPanel.locator("[data-mesh-draw-row]")).toHaveCount(
      expectedCount,
    );

    for (const draw of draws) {
      await expect(drawRow(draw.renderId)).toContainText(formatDraw(draw));
    }
  };

  await page.goto("/examples/glb-viewer.html?asset=dual");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await assertDrawRows(
    await waitForDrawRows({ id: "dual", source: "sample", drawCount: 2 }),
    2,
  );

  await page.locator("#glb-asset-select").selectOption("mixed-alpha");
  const mixedStatus = await waitForDrawRows({
    id: "mixed-alpha",
    source: "sample",
    drawCount: 2,
  });
  await assertDrawRows(mixedStatus, 2);
  expect(
    mixedStatus.renderState?.draws.map((draw) => draw.queue).sort(),
  ).toEqual(["opaque", "transparent"]);

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  const customStatus = await waitForDrawRows({
    id: "custom-url",
    source: "custom",
    drawCount: 1,
  });
  await assertDrawRows(customStatus, 1);
  await expect(
    drawRow(customStatus.renderState?.draws[0]?.renderId ?? 0),
  ).toContainText("pipeline unlit|opaque|back|less|none");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer prepared-resource reuse rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-prepared-resource-reuse-summary");
  const reuseRow = (key: string) =>
    summaryPanel.locator(`[data-prepared-resource-reuse-row="${key}"]`);
  const count = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
  const entries = (
    facade: { readonly entries?: readonly unknown[] } | undefined,
  ) => (Array.isArray(facade?.entries) ? facade.entries.length : 0);
  const expectedRows = (reuse: ResourceReuseStatus) => ({
    "mesh-buffers": `buffers ${count(reuse.meshBuffersCreated)}/${count(
      reuse.meshBuffersReused,
    )}, prepared ${count(reuse.preparedMeshBuffersCreated)}/${count(
      reuse.preparedMeshBuffersReused,
    )}, facade ${entries(reuse.preparedMeshFacade)}`,
    "material-buffers": `buffers ${count(
      reuse.materialBuffersCreated,
    )}/${count(reuse.materialBuffersReused)}, prepared ${count(
      reuse.preparedMaterialBuffersCreated,
    )}/${count(reuse.preparedMaterialBuffersReused)}, facade ${entries(
      reuse.preparedMaterialFacade,
    )}`,
    "bind-groups": `frame ${count(reuse.bindGroupsCreated)}/${count(
      reuse.bindGroupsReused,
    )}, material ${count(reuse.preparedMaterialBindGroupsCreated)}/${count(
      reuse.preparedMaterialBindGroupsReused,
    )}`,
    textures: `resources ${count(reuse.textureResourcesCreated)}/${count(
      reuse.textureResourcesReused,
    )}`,
    samplers: `resources ${count(reuse.samplerResourcesCreated)}/${count(
      reuse.samplerResourcesReused,
    )}`,
  });
  const waitForReuseRows = async (expected: {
    readonly id: string;
    readonly source: string;
  }) => {
    await page.waitForFunction(
      ({ id, source }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly report?: {
                readonly resourceReuse?: object;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          status.report?.resourceReuse !== undefined &&
          document.querySelectorAll(
            "#glb-prepared-resource-reuse-summary [data-prepared-resource-reuse-row]",
          ).length === 5
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} prepared-resource reuse status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${expected.id} prepared-resource reuse status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const assertReuseRows = async (status: GlbViewerStatus | undefined) => {
    const reuse = status?.report?.resourceReuse;

    expect(reuse, "resource reuse report should publish").toBeDefined();

    if (reuse === undefined) {
      throw new Error("Resource reuse report did not publish.");
    }

    await expect(
      summaryPanel.locator("[data-prepared-resource-reuse-row]"),
    ).toHaveCount(5);

    for (const [key, value] of Object.entries(expectedRows(reuse))) {
      await expect(reuseRow(key)).toContainText(value);
    }
  };

  await page.goto("/examples/glb-viewer.html?asset=cube");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await assertReuseRows(
    await waitForReuseRows({ id: "cube", source: "sample" }),
  );

  await page.locator("#glb-asset-select").selectOption("all-slot-uri-textures");
  await assertReuseRows(
    await waitForReuseRows({
      id: "all-slot-uri-textures",
      source: "sample",
    }),
  );

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/uri-png-texture.glb");
  await page.locator("#glb-url-form button").click();
  await assertReuseRows(
    await waitForReuseRows({ id: "custom-url", source: "custom" }),
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer render-diagnostics section rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-render-diagnostic-summary");
  const diagnosticRow = (key: string) =>
    summaryPanel.locator(`[data-render-diagnostic-row="${key}"]`);
  const count = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
  const bucketCounts = (
    buckets: readonly RenderDiagnosticBucket[] | undefined,
    key: "phase" | "family",
  ) => {
    const rows = (buckets ?? [])
      .filter((bucket) => typeof bucket[key] === "string")
      .map((bucket) => `${bucket[key]} ${count(bucket.itemCount)}`);

    return rows.length === 0 ? "none" : rows.join(", ");
  };
  const sectionCount = (summary: RenderDiagnosticsSummaryStatus | undefined) =>
    [
      summary?.materialQueue,
      summary?.routedResourceSet,
      summary?.directLighting,
      summary?.builtInAppResourceAdapters,
    ].filter((section) => section !== undefined).length;
  const expectedRows = (summary: RenderDiagnosticsSummaryStatus) => ({
    ...(summary.materialQueue === undefined
      ? {}
      : {
          materialQueue: `${count(
            summary.materialQueue.itemCount,
          )} items, phases ${bucketCounts(
            summary.materialQueue.byPhase,
            "phase",
          )}, families ${bucketCounts(summary.materialQueue.byFamily, "family")}`,
        }),
    ...(summary.routedResourceSet === undefined
      ? {}
      : {
          routedResourceSet: `${count(
            summary.routedResourceSet.itemCount,
          )} items, families ${bucketCounts(
            summary.routedResourceSet.byFamily,
            "family",
          )}, pipelines ${summary.routedResourceSet.byPipeline?.length ?? 0}`,
        }),
    ...(summary.directLighting === undefined
      ? {}
      : {
          directLighting: `ready ${
            summary.directLighting.ready === true
          }, direct ${count(
            summary.directLighting.lightCounts?.direct,
          )}, ambient ${count(
            summary.directLighting.lightCounts?.ambient,
          )}, resources ${
            summary.directLighting.sections?.lightGpuBuffers === true
          }/${summary.directLighting.sections?.lightBindGroup === true}`,
        }),
    ...(summary.builtInAppResourceAdapters === undefined
      ? {}
      : {
          builtInAppResourceAdapters: `valid ${
            summary.builtInAppResourceAdapters.valid === true
          }, registered ${
            summary.builtInAppResourceAdapters.registeredFamilies?.length ?? 0
          }, expected ${
            summary.builtInAppResourceAdapters.expectedFamilies?.length ?? 0
          }, diagnostics ${
            summary.builtInAppResourceAdapters.diagnostics?.length ?? 0
          }`,
        }),
  });
  const waitForDiagnosticRows = async (expected: {
    readonly id: string;
    readonly source: string;
  }) => {
    await page.waitForFunction(
      ({ id, source }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly report?: {
                readonly diagnosticsSummary?: {
                  readonly materialQueue?: object;
                  readonly routedResourceSet?: object;
                  readonly directLighting?: object;
                  readonly builtInAppResourceAdapters?: object;
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const summary = status?.report?.diagnosticsSummary;
        const sections = [
          summary?.materialQueue,
          summary?.routedResourceSet,
          summary?.directLighting,
          summary?.builtInAppResourceAdapters,
        ].filter((section) => section !== undefined).length;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          summary !== undefined &&
          sections >= 3 &&
          document.querySelectorAll(
            "#glb-render-diagnostic-summary [data-render-diagnostic-row]",
          ).length === sections
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} render-diagnostics status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${expected.id} render-diagnostics status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const assertDiagnosticRows = async (status: GlbViewerStatus | undefined) => {
    const summary = status?.report?.diagnosticsSummary;

    expect(summary, "render diagnostics summary should publish").toBeDefined();

    if (summary === undefined) {
      throw new Error("Render diagnostics summary did not publish.");
    }

    await expect(
      summaryPanel.locator("[data-render-diagnostic-row]"),
    ).toHaveCount(sectionCount(summary));

    for (const [key, value] of Object.entries(expectedRows(summary))) {
      await expect(diagnosticRow(key)).toContainText(value);
    }
  };

  await page.goto("/examples/glb-viewer.html?asset=brass");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await assertDiagnosticRows(
    await waitForDiagnosticRows({ id: "brass", source: "sample" }),
  );

  await page.locator("#glb-asset-select").selectOption("imported-light");
  await assertDiagnosticRows(
    await waitForDiagnosticRows({ id: "imported-light", source: "sample" }),
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await assertDiagnosticRows(
    await waitForDiagnosticRows({ id: "cube", source: "sample" }),
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer source-output summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-source-output-summary");
  const outputRow = (key: string) =>
    summaryPanel.locator(`[data-source-output-summary-row="${key}"]`);
  const waitForSourceOutputRows = async (expected: {
    readonly id: string;
    readonly source: string;
  }) => {
    await page.waitForFunction(
      ({ id, source }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly source?: {
                readonly ok?: boolean;
                readonly outputSummary?: {
                  readonly meshConstruction?: {
                    readonly status?: string;
                    readonly meshCount?: number;
                    readonly submeshCount?: number;
                  };
                  readonly sourceRegistration?: object;
                  readonly ecsCommandPlan?: object;
                  readonly ecsReplayReadiness?: object;
                } | null;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const summary = status?.source?.outputSummary;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          status.source?.ok === true &&
          typeof summary?.meshConstruction?.status === "string" &&
          (summary.meshConstruction.meshCount ?? 0) >= 1 &&
          (summary.meshConstruction.submeshCount ?? 0) >= 1 &&
          summary.sourceRegistration !== undefined &&
          summary.ecsCommandPlan !== undefined &&
          summary.ecsReplayReadiness !== undefined &&
          document.querySelectorAll(
            "#glb-source-output-summary [data-source-output-summary-row]",
          ).length === 4
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} source-output status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} source-output status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    const summary = status.source?.outputSummary;

    expect(
      summary,
      `${expected.id} output summary should publish`,
    ).toBeDefined();

    if (summary === undefined || summary === null) {
      throw new Error(`${expected.id} output summary did not publish.`);
    }

    await expect(outputRow("meshConstruction")).toContainText(
      `${summary.meshConstruction.status}, meshes ${summary.meshConstruction.meshCount}, submeshes ${summary.meshConstruction.submeshCount}`,
    );
    await expect(outputRow("sourceRegistration")).toContainText(
      `${summary.sourceRegistration.status}, written ${summary.sourceRegistration.writtenCount}, skipped ${summary.sourceRegistration.skippedCount}, diagnostics ${summary.sourceRegistration.diagnosticsCount}`,
    );
    await expect(outputRow("commandPlan")).toContainText(
      `${summary.ecsCommandPlan.status}, commands ${summary.ecsCommandPlan.commandCount}, deps ${summary.ecsCommandPlan.dependencyCount}`,
    );
    await expect(outputRow("replayReadiness")).toContainText(
      `${summary.ecsReplayReadiness.status}, creates ${summary.ecsReplayReadiness.expectedCreateEntityCount}, adds ${summary.ecsReplayReadiness.expectedAddComponentCount}`,
    );
  };

  await page.goto("/examples/glb-viewer.html?asset=cube");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForSourceOutputRows({ id: "cube", source: "sample" });
  await expect(
    summaryPanel.locator("[data-source-output-summary-row]"),
  ).toHaveCount(4);

  await page.locator("#glb-asset-select").selectOption("all-slot-uri-textures");
  await waitForSourceOutputRows({
    id: "all-slot-uri-textures",
    source: "sample",
  });

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  await waitForSourceOutputRows({ id: "custom-url", source: "custom" });
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer primitive material-resolution rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-primitive-material-summary");
  const materialRow = (meshIndex: number, primitiveIndex: number) =>
    summaryPanel.locator(
      `[data-primitive-material-row="${meshIndex}:${primitiveIndex}"]`,
    );
  const waitForPrimitiveMaterialRows = async (
    id: string,
    resolved: number,
    source = "sample",
  ) => {
    await page.waitForFunction(
      ({ id, resolved, source }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly unknown[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          status.gltf.primitiveMaterials.resolutions?.length === resolved
        );
      },
      { id, resolved, source },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${id} primitive material status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${id} primitive material status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=dual");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForPrimitiveMaterialRows("dual", 2);
  await expect(
    summaryPanel.locator("[data-primitive-material-row]"),
  ).toHaveCount(2);
  await expect(materialRow(0, 0)).toContainText(
    "material 0, unlit, opaque, unlit|opaque|back|less|none",
  );
  await expect(materialRow(0, 1)).toContainText(
    "material 1, unlit, opaque, unlit|opaque|back|less|none",
  );

  await page.locator("#glb-asset-select").selectOption("mixed-alpha");
  await waitForPrimitiveMaterialRows("mixed-alpha", 2);
  await expect(materialRow(0, 0)).toContainText(
    "material 0, standard, opaque, standard|opaque|back|less|none",
  );
  await expect(materialRow(0, 1)).toContainText(
    "material 1, standard, blend, standard|blend|back|less|alpha",
  );

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  await waitForPrimitiveMaterialRows("custom-url", 1, "custom");
  await expect(
    summaryPanel.locator("[data-primitive-material-row]"),
  ).toHaveCount(1);
  await expect(materialRow(0, 0)).toContainText(
    "material 0, unlit, opaque, unlit|opaque|back|less|none",
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer material-factor rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-material-factor-summary");
  const factorRow = (meshIndex: number, primitiveIndex: number) =>
    summaryPanel.locator(
      `[data-material-factor-row="${meshIndex}:${primitiveIndex}"]`,
    );
  const formatFactorTuple = (values: readonly number[] | null) =>
    values === null
      ? "none"
      : values.map((value) => Number(value.toFixed(3))).join(", ");
  const formatFactorValue = (value: number | null) =>
    value === null ? "none" : String(value);
  const formatFactors = (
    factors: PrimitiveMaterialResolutionStatus["factors"],
  ) => {
    if (factors === null) {
      return "none";
    }

    return `base ${formatFactorTuple(
      factors.baseColorFactor,
    )}, metal ${formatFactorValue(
      factors.metallicFactor,
    )}, rough ${formatFactorValue(
      factors.roughnessFactor,
    )}, normal ${formatFactorValue(
      factors.normalScale,
    )}, occlusion ${formatFactorValue(
      factors.occlusionStrength,
    )}, emissive ${formatFactorTuple(factors.emissiveFactor)}`;
  };
  const waitForFactorRows = async (expected: {
    readonly id: string;
    readonly resolved: number;
  }) => {
    await page.waitForFunction(
      ({ id, resolved }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly {
                    readonly factors?: unknown;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          status.gltf.primitiveMaterials.resolutions?.filter(
            (resolution) => resolution.factors !== null,
          ).length === resolved &&
          document.querySelectorAll(
            "#glb-material-factor-summary [data-material-factor-row]",
          ).length === resolved
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} material-factor status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} material-factor status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=normal-occlusion-controls");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const controlStatus = await waitForFactorRows({
    id: "normal-occlusion-controls",
    resolved: 3,
  });
  const controlResolution =
    controlStatus.gltf?.primitiveMaterials.resolutions[0];

  expect(
    controlResolution,
    "normal/occlusion factor row should publish",
  ).toBeDefined();

  if (controlResolution === undefined) {
    throw new Error("Normal/occlusion factor row did not publish.");
  }

  await expect(factorRow(0, 0)).toContainText(
    formatFactors(controlResolution.factors),
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  const scalarStatus = await waitForFactorRows({ id: "cube", resolved: 1 });
  const scalarResolution = scalarStatus.gltf?.primitiveMaterials.resolutions[0];

  expect(
    scalarResolution,
    "scalar-only factor row should publish",
  ).toBeDefined();

  if (scalarResolution === undefined) {
    throw new Error("Scalar-only factor row did not publish.");
  }

  await expect(factorRow(0, 0)).toContainText(
    formatFactors(scalarResolution.factors),
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer material-alpha rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-material-alpha-summary");
  const alphaRow = (meshIndex: number, primitiveIndex: number) =>
    summaryPanel.locator(
      `[data-material-alpha-row="${meshIndex}:${primitiveIndex}"]`,
    );
  const formatAlpha = (resolution: PrimitiveMaterialResolutionStatus) =>
    `mode ${resolution.alphaMode ?? "none"}, cutoff ${resolution.alphaCutoff ?? "none"}, blend ${resolution.blendPreset ?? "none"}, depthWrite ${resolution.depthWrite ?? "none"}, cull ${resolution.cullMode ?? "none"}`;
  const waitForAlphaRows = async (expected: {
    readonly id: string;
    readonly resolved: number;
  }) => {
    await page.waitForFunction(
      ({ id, resolved }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly unknown[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          status.gltf.primitiveMaterials.resolutions?.length === resolved &&
          document.querySelectorAll(
            "#glb-material-alpha-summary [data-material-alpha-row]",
          ).length === resolved
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} material-alpha status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} material-alpha status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const samples = [
    { id: "alpha-mask", resolved: 2 },
    { id: "alpha-blend-texture", resolved: 2 },
    { id: "mixed-alpha", resolved: 2 },
    { id: "cube", resolved: 1 },
  ] as const;

  await page.goto(`/examples/glb-viewer.html?asset=${samples[0].id}`);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  for (const sample of samples) {
    if (sample !== samples[0]) {
      await page.locator("#glb-asset-select").selectOption(sample.id);
    }

    const status = await waitForAlphaRows(sample);
    const resolutions = status.gltf?.primitiveMaterials.resolutions ?? [];

    await expect(summaryPanel.locator("[data-material-alpha-row]")).toHaveCount(
      sample.resolved,
    );

    for (const resolution of resolutions) {
      await expect(
        alphaRow(resolution.meshIndex, resolution.primitiveIndex),
      ).toContainText(formatAlpha(resolution));
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer source-loader status rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-source-loader-summary");
  const sourceRow = (key: string) =>
    summaryPanel.locator(`[data-source-loader-summary-row="${key}"]`);
  const waitForSourceLoaderRows = async (expected: {
    readonly id: string;
    readonly source: string;
    readonly unsupportedCode?: string;
  }) => {
    await page.waitForFunction(
      ({ id, source, unsupportedCode }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly source?: {
                readonly ok?: boolean;
                readonly byteLength?: number | null;
                readonly status?: {
                  readonly status?: string;
                  readonly sourceKind?: string;
                } | null;
                readonly imageDecode?: {
                  readonly diagnostics?: readonly unknown[];
                };
                readonly diagnostics?: readonly unknown[];
              };
              readonly gltf?: {
                readonly metadata?: {
                  readonly unsupportedFeatureDiagnostics?: readonly {
                    readonly code?: string;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const unsupportedCodes =
          status?.gltf?.metadata?.unsupportedFeatureDiagnostics?.map(
            (diagnostic) => diagnostic.code,
          ) ?? [];

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          status.source?.ok === true &&
          typeof status.source.byteLength === "number" &&
          status.source.byteLength > 0 &&
          status.source.status?.status === "loaded" &&
          status.source.status.sourceKind === "glb" &&
          (status.source.imageDecode?.diagnostics?.length ?? 0) === 0 &&
          (status.source.diagnostics?.length ?? 0) === 0 &&
          (unsupportedCode === undefined ||
            unsupportedCodes.includes(unsupportedCode))
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} source-loader status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} source-loader status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=cube");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const cubeStatus = await waitForSourceLoaderRows({
    id: "cube",
    source: "sample",
  });

  await expect(
    summaryPanel.locator("[data-source-loader-summary-row]"),
  ).toHaveCount(5);
  await expect(sourceRow("kind")).toContainText("glb");
  await expect(sourceRow("bytes")).toContainText(
    `${cubeStatus.source?.byteLength} bytes`,
  );
  await expect(sourceRow("loader")).toContainText("loaded");
  await expect(sourceRow("imageDiagnostics")).toContainText("0");
  await expect(sourceRow("sourceDiagnostics")).toContainText("0");

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  const customStatus = await waitForSourceLoaderRows({
    id: "custom-url",
    source: "custom",
  });

  expect(customStatus.selectedAsset).toMatchObject({
    id: "custom-url",
    source: "custom",
    url: "/examples/assets/sapphire-pillar.glb",
  });
  await expect(sourceRow("kind")).toContainText("glb");
  await expect(sourceRow("bytes")).toContainText(
    `${customStatus.source?.byteLength} bytes`,
  );
  await expect(sourceRow("loader")).toContainText("loaded");
  await expect(sourceRow("imageDiagnostics")).toContainText("0");
  await expect(sourceRow("sourceDiagnostics")).toContainText("0");

  await page.locator("#glb-asset-select").selectOption("unsupported-primitive");
  const unsupportedStatus = await waitForSourceLoaderRows({
    id: "unsupported-primitive",
    source: "sample",
    unsupportedCode: "gltfMesh.unsupportedPrimitiveMode",
  });

  expect(
    unsupportedStatus.gltf?.metadata.unsupportedFeatureDiagnostics,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "gltfMesh.unsupportedPrimitiveMode",
      }),
    ]),
  );
  await expect(sourceRow("kind")).toContainText("glb");
  await expect(sourceRow("bytes")).toContainText(
    `${unsupportedStatus.source?.byteLength} bytes`,
  );
  await expect(sourceRow("loader")).toContainText("loaded");
  await expect(sourceRow("imageDiagnostics")).toContainText("0");
  await expect(sourceRow("sourceDiagnostics")).toContainText("0");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer hierarchy summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-hierarchy-summary");
  const hierarchyRow = (key: string) =>
    summaryPanel.locator(`[data-hierarchy-summary-row="${key}"]`);
  const waitForHierarchyRows = async (expected: {
    readonly id: string;
    readonly nodeCount: number;
    readonly parentedCount: number;
  }) => {
    await page.waitForFunction(
      ({ id, nodeCount, parentedCount }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly hierarchy?: {
                readonly nodes?: readonly {
                  readonly entityKey?: string;
                  readonly parentEntityKey?: string;
                }[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const nodes = status?.hierarchy?.nodes ?? [];
        const entityKeys = new Set(nodes.map((node) => node.entityKey));
        const parented = nodes.filter((node) =>
          entityKeys.has(node.parentEntityKey),
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          nodes.length === nodeCount &&
          parented.length === parentedCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} hierarchy-row status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} hierarchy-row status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=hierarchy");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const hierarchyStatus = await waitForHierarchyRows({
    id: "hierarchy",
    nodeCount: 2,
    parentedCount: 1,
  });

  expect(hierarchyStatus.hierarchy?.nodes).toMatchObject([
    {
      nodeIndex: 0,
      localTranslation: [0.6, 0, 0],
      worldTranslation: [0.6, 0, 0],
    },
    {
      nodeIndex: 1,
      localTranslation: [0, 0.7, 0],
      worldTranslation: [0.6, 0.7, 0],
    },
  ]);
  await expect(
    summaryPanel.locator("[data-hierarchy-summary-row]"),
  ).toHaveCount(3);
  await expect(hierarchyRow("nodes")).toContainText("2 replayed");
  await expect(hierarchyRow("parented")).toContainText("1 node");
  await expect(hierarchyRow("firstChild")).toContainText(
    "node 1: local 0, 0.7, 0, world 0.6, 0.7, 0",
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await waitForHierarchyRows({
    id: "cube",
    nodeCount: 1,
    parentedCount: 0,
  });
  await expect(hierarchyRow("nodes")).toContainText("1 replayed");
  await expect(hierarchyRow("parented")).toContainText("0 nodes");
  await expect(hierarchyRow("firstChild")).toContainText("none");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer replay-stage status rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-replay-stage-summary");
  const replayRow = (key: string) =>
    summaryPanel.locator(`[data-replay-stage-summary-row="${key}"]`);
  const waitForReplayRows = async (expected: {
    readonly id: string;
    readonly unsupportedCode?: string;
  }) => {
    await page.waitForFunction(
      ({ id, unsupportedCode }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly registration?: {
                  readonly valid?: boolean;
                  readonly diagnostics?: number;
                };
                readonly commandPlan?: {
                  readonly valid?: boolean;
                  readonly commands?: number;
                  readonly dependencies?: number;
                };
                readonly replay?: {
                  readonly valid?: boolean;
                  readonly created?: number;
                  readonly diagnostics?: number;
                };
                readonly metadata?: {
                  readonly unsupportedFeatureDiagnostics?: readonly {
                    readonly code?: string;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const unsupportedCodes =
          status?.gltf?.metadata?.unsupportedFeatureDiagnostics?.map(
            (diagnostic) => diagnostic.code,
          ) ?? [];

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.registration?.valid === true &&
          status.gltf.registration.diagnostics === 0 &&
          status.gltf.commandPlan?.valid === true &&
          (status.gltf.commandPlan.commands ?? 0) > 0 &&
          (status.gltf.commandPlan.dependencies ?? -1) >= 0 &&
          status.gltf.replay?.valid === true &&
          (status.gltf.replay.created ?? 0) > 0 &&
          status.gltf.replay.diagnostics === 0 &&
          (unsupportedCode === undefined ||
            unsupportedCodes.includes(unsupportedCode))
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} replay-stage status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} replay-stage status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=cube");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const cubeStatus = await waitForReplayRows({ id: "cube" });

  await expect(
    summaryPanel.locator("[data-replay-stage-summary-row]"),
  ).toHaveCount(3);
  await expect(replayRow("registration")).toContainText(
    `valid true, diagnostics ${cubeStatus.gltf?.registration.diagnostics}`,
  );
  await expect(replayRow("commandPlan")).toContainText(
    `valid true, commands ${cubeStatus.gltf?.commandPlan.commands}, deps ${cubeStatus.gltf?.commandPlan.dependencies}`,
  );
  await expect(replayRow("replay")).toContainText(
    `valid true, created ${cubeStatus.gltf?.replay.created}, diagnostics ${cubeStatus.gltf?.replay.diagnostics}`,
  );

  await page.locator("#glb-asset-select").selectOption("hierarchy");
  const hierarchyStatus = await waitForReplayRows({ id: "hierarchy" });
  await expect(replayRow("commandPlan")).toContainText(
    `valid true, commands ${hierarchyStatus.gltf?.commandPlan.commands}, deps ${hierarchyStatus.gltf?.commandPlan.dependencies}`,
  );
  await expect(replayRow("replay")).toContainText(
    `valid true, created ${hierarchyStatus.gltf?.replay.created}, diagnostics 0`,
  );

  await page.locator("#glb-asset-select").selectOption("unsupported-primitive");
  const unsupportedStatus = await waitForReplayRows({
    id: "unsupported-primitive",
    unsupportedCode: "gltfMesh.unsupportedPrimitiveMode",
  });
  await expect(replayRow("registration")).toContainText(
    `valid true, diagnostics ${unsupportedStatus.gltf?.registration.diagnostics}`,
  );
  await expect(replayRow("replay")).toContainText(
    `valid true, created ${unsupportedStatus.gltf?.replay.created}, diagnostics 0`,
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer texture-gallery status rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-texture-gallery-summary");
  const galleryRow = (key: string) =>
    summaryPanel.locator(`[data-texture-gallery-summary-row="${key}"]`);
  const waitForGalleryRows = async (expected: {
    readonly id: string;
    readonly active: boolean;
    readonly activeIndex: number | null;
    readonly source?: string;
  }) => {
    await page.waitForFunction(
      ({ id, active, activeIndex, source }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly textureGallery?: {
                readonly active?: boolean;
                readonly activeIndex?: number | null;
                readonly activeAssetId?: string | null;
                readonly count?: number;
                readonly sampleIds?: readonly string[];
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const gallery = status?.textureGallery;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          (source === undefined || status.selectedAsset.source === source) &&
          status.selectedAsset.loading === false &&
          gallery?.active === active &&
          gallery.activeIndex === activeIndex &&
          gallery.count === 5 &&
          gallery.sampleIds?.length === 5 &&
          (active
            ? gallery.activeAssetId === id
            : gallery.activeAssetId === null)
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} texture-gallery status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} texture-gallery status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForGalleryRows({
    id: "all-slot-uri-textures",
    active: true,
    activeIndex: 0,
  });
  await expect(
    summaryPanel.locator("[data-texture-gallery-summary-row]"),
  ).toHaveCount(4);
  await expect(galleryRow("state")).toContainText("active true, count 5");
  await expect(galleryRow("position")).toContainText("index 0 / 5");
  await expect(galleryRow("asset")).toContainText("all-slot-uri-textures");
  await expect(galleryRow("samples")).toContainText("5 available");

  await page.locator("#glb-gallery-next").click();
  await waitForGalleryRows({
    id: "alpha-mask-emissive-controls",
    active: true,
    activeIndex: 1,
  });
  await expect(galleryRow("position")).toContainText("index 1 / 5");
  await expect(galleryRow("asset")).toContainText(
    "alpha-mask-emissive-controls",
  );

  await page.locator("#glb-gallery-prev").click();
  await waitForGalleryRows({
    id: "all-slot-uri-textures",
    active: true,
    activeIndex: 0,
  });
  await expect(galleryRow("position")).toContainText("index 0 / 5");

  await page
    .locator("#glb-url-input")
    .fill("/examples/assets/sapphire-pillar.glb");
  await page.locator("#glb-url-form button").click();
  await waitForGalleryRows({
    id: "custom-url",
    source: "custom",
    active: false,
    activeIndex: null,
  });
  await expect(galleryRow("state")).toContainText("active false, count 5");
  await expect(galleryRow("position")).toContainText("index none / 5");
  await expect(galleryRow("asset")).toContainText("none");
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer extraction diagnostic rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-extraction-diagnostic-summary");
  const diagnosticRow = (code: string) =>
    summaryPanel.locator(`[data-extraction-diagnostic-code="${code}"]`);

  await page.goto("/examples/glb-viewer.html?asset=missing-texcoord1");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly extraction?: {
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly {
                readonly code?: string;
                readonly field?: string;
                readonly texCoord?: number;
              }[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "missing-texcoord1" &&
        status.selectedAsset.loading === false &&
        status.extraction?.diagnostics === 1 &&
        status.extraction.diagnosticsList?.some(
          (diagnostic) =>
            diagnostic.code ===
              "render.standardMaterialTexture.missingTexCoord1" &&
            diagnostic.field === "baseColorTexture" &&
            diagnostic.texCoord === 1,
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "extraction diagnostic status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Extraction diagnostic status did not publish.");
  }

  expectStatusJsonSafeForGpu(status);
  await expect(
    summaryPanel.locator("[data-extraction-diagnostic-row]"),
  ).toHaveCount(1);
  await expect(
    diagnosticRow("render.standardMaterialTexture.missingTexCoord1"),
  ).toContainText(
    "render.standardMaterialTexture.missingTexCoord1, field baseColorTexture, texCoord 1",
  );
  await expect(
    diagnosticRow("render.standardMaterialTexture.missingTexCoord1"),
  ).toContainText("texture 0:baseColorTexture");

  await page
    .locator("#glb-asset-select")
    .selectOption("uv1-image-decode-controls");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly extraction?: {
              readonly diagnostics?: number;
              readonly diagnosticsList?: readonly unknown[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "uv1-image-decode-controls" &&
        status.selectedAsset.loading === false &&
        status.extraction?.diagnostics === 0 &&
        status.extraction.diagnosticsList?.length === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(
    summaryPanel.locator("[data-extraction-diagnostic-row]"),
  ).toHaveCount(0);
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer primitive texture-slot route rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-primitive-texture-slot-summary");
  const textureSlotRow = (
    meshIndex: number,
    primitiveIndex: number,
    slotName: string,
  ) =>
    summaryPanel.locator(
      `[data-primitive-texture-slot-row="${meshIndex}:${primitiveIndex}:${slotName}"]`,
    );
  const waitForTextureSlotRows = async (expected: {
    readonly id: string;
    readonly rowCount: number;
    readonly resolved: number;
  }) => {
    await page.waitForFunction(
      ({ id, rowCount, resolved }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly {
                    readonly textureSlots?: Record<string, unknown> | null;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const rows = (
          status?.gltf?.primitiveMaterials?.resolutions ?? []
        ).flatMap((resolution) =>
          Object.values(resolution.textureSlots ?? {}).filter(
            (slot) => slot !== null,
          ),
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          rows.length === rowCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} primitive texture-slot status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${expected.id} primitive texture-slot status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await waitForTextureSlotRows({
    id: "all-slot-uri-textures",
    resolved: 2,
    rowCount: 5,
  });
  await expect(
    summaryPanel.locator("[data-primitive-texture-slot-row]"),
  ).toHaveCount(5);
  await expect(textureSlotRow(0, 0, "baseColorTexture")).toContainText(
    "texCoord 0, transform false, sampler ready",
  );
  await expect(textureSlotRow(0, 0, "metallicRoughnessTexture")).toContainText(
    "texCoord 0, transform false, sampler ready",
  );
  await expect(textureSlotRow(0, 0, "normalTexture")).toContainText(
    "texCoord 0, transform false, sampler ready",
  );
  await expect(textureSlotRow(0, 0, "occlusionTexture")).toContainText(
    "texCoord 0, transform false, sampler ready",
  );
  await expect(textureSlotRow(0, 0, "emissiveTexture")).toContainText(
    "texCoord 0, transform false, sampler ready",
  );

  await page
    .locator("#glb-asset-select")
    .selectOption("uv1-image-decode-controls");
  await waitForTextureSlotRows({
    id: "uv1-image-decode-controls",
    resolved: 3,
    rowCount: 2,
  });
  await expect(
    summaryPanel.locator("[data-primitive-texture-slot-row]"),
  ).toHaveCount(2);
  await expect(textureSlotRow(0, 0, "baseColorTexture")).toContainText(
    "texCoord 0, transform false, sampler ready",
  );
  await expect(textureSlotRow(0, 1, "baseColorTexture")).toContainText(
    "texCoord 1, transform false, sampler ready",
  );

  await page.locator("#glb-asset-select").selectOption("brass");
  await waitForTextureSlotRows({ id: "brass", resolved: 1, rowCount: 0 });
  await expect(
    summaryPanel.locator("[data-primitive-texture-slot-row]"),
  ).toHaveCount(0);
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer texture handle-key rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-texture-handle-summary");
  const handleRow = (
    meshIndex: number,
    primitiveIndex: number,
    slotName: string,
  ) =>
    summaryPanel.locator(
      `[data-texture-handle-row="${meshIndex}:${primitiveIndex}:${slotName}"]`,
    );
  const slotLabel = (slotName: string) =>
    slotName.replace(/Texture$/, "").replace(/[A-Z]/g, (letter) => {
      return ` ${letter.toLowerCase()}`;
    });
  const formatHandle = (slotName: string, slot: TextureSlotStatus) =>
    `slot ${slotLabel(slotName)}, texture ${slot.textureKey}, sampler ${
      slot.samplerKey ?? "none"
    }, texCoord ${slot.texCoord}`;
  const waitForHandleRows = async (expected: {
    readonly id: string;
    readonly rowCount: number;
    readonly resolved: number;
  }) => {
    await page.waitForFunction(
      ({ id, rowCount, resolved }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly {
                    readonly textureSlots?: Record<string, unknown> | null;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const rows = (
          status?.gltf?.primitiveMaterials?.resolutions ?? []
        ).flatMap((resolution) =>
          Object.values(resolution.textureSlots ?? {}).filter(
            (slot) => slot !== null,
          ),
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          rows.length === rowCount &&
          document.querySelectorAll(
            "#glb-texture-handle-summary [data-texture-handle-row]",
          ).length === rowCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} texture handle-key status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${expected.id} texture handle-key status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const allSlotStatus = await waitForHandleRows({
    id: "all-slot-uri-textures",
    resolved: 2,
    rowCount: 5,
  });
  const allSlotResolution =
    allSlotStatus.gltf?.primitiveMaterials.resolutions[0];
  const allSlotNames = [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
  ] as const;

  expect(
    allSlotResolution,
    "all-slot handle rows should publish",
  ).toBeDefined();

  if (allSlotResolution === undefined) {
    throw new Error("All-slot handle rows did not publish.");
  }

  await expect(summaryPanel.locator("[data-texture-handle-row]")).toHaveCount(
    5,
  );

  for (const slotName of allSlotNames) {
    const slot = allSlotResolution.textureSlots?.[slotName];

    expect(slot, `${slotName} handle row should publish`).toBeDefined();

    if (slot === null || slot === undefined) {
      throw new Error(`${slotName} handle row did not publish.`);
    }

    await expect(handleRow(0, 0, slotName)).toContainText(
      formatHandle(slotName, slot),
    );
  }

  await page.locator("#glb-asset-select").selectOption("sampler-wrap-controls");
  const samplerWrapStatus = await waitForHandleRows({
    id: "sampler-wrap-controls",
    resolved: 3,
    rowCount: 2,
  });
  const repeatSlot =
    samplerWrapStatus.gltf?.primitiveMaterials.resolutions[0]?.textureSlots
      ?.baseColorTexture;
  const clampSlot =
    samplerWrapStatus.gltf?.primitiveMaterials.resolutions[1]?.textureSlots
      ?.baseColorTexture;

  expect(repeatSlot, "repeat sampler handle row should publish").toBeDefined();
  expect(clampSlot, "clamp sampler handle row should publish").toBeDefined();

  if (repeatSlot === null || repeatSlot === undefined) {
    throw new Error("Repeat sampler handle row did not publish.");
  }

  if (clampSlot === null || clampSlot === undefined) {
    throw new Error("Clamp sampler handle row did not publish.");
  }

  await expect(summaryPanel.locator("[data-texture-handle-row]")).toHaveCount(
    2,
  );
  await expect(handleRow(0, 0, "baseColorTexture")).toContainText(
    formatHandle("baseColorTexture", repeatSlot),
  );
  await expect(handleRow(0, 1, "baseColorTexture")).toContainText(
    formatHandle("baseColorTexture", clampSlot),
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await waitForHandleRows({ id: "cube", resolved: 1, rowCount: 0 });
  await expect(summaryPanel.locator("[data-texture-handle-row]")).toHaveCount(
    0,
  );
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer texture-sampler rows", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-texture-sampler-summary");
  const samplerRow = (
    meshIndex: number,
    primitiveIndex: number,
    slotName: string,
  ) =>
    summaryPanel.locator(
      `[data-texture-sampler-row="${meshIndex}:${primitiveIndex}:${slotName}"]`,
    );
  const formatSampler = (slot: TextureSlotStatus | null | undefined) => {
    const sampler = slot?.sampler ?? null;

    return `address ${sampler?.addressModeU ?? "none"}/${sampler?.addressModeV ?? "none"}/${sampler?.addressModeW ?? "none"}, filters ${sampler?.magFilter ?? "none"}/${sampler?.minFilter ?? "none"}/${sampler?.mipmapFilter ?? "none"}, anisotropy ${sampler?.maxAnisotropy ?? "none"}`;
  };
  const waitForSamplerRows = async (expected: {
    readonly id: string;
    readonly rowCount: number;
    readonly resolved: number;
  }) => {
    await page.waitForFunction(
      ({ id, rowCount, resolved }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly {
                    readonly textureSlots?: Record<string, unknown> | null;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const rows = (
          status?.gltf?.primitiveMaterials?.resolutions ?? []
        ).flatMap((resolution) =>
          Object.values(resolution.textureSlots ?? {}).filter(
            (slot) => slot !== null,
          ),
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          rows.length === rowCount &&
          document.querySelectorAll(
            "#glb-texture-sampler-summary [data-texture-sampler-row]",
          ).length === rowCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} texture-sampler status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${expected.id} texture-sampler status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  const allSlotStatus = await waitForSamplerRows({
    id: "all-slot-uri-textures",
    resolved: 2,
    rowCount: 5,
  });
  const allSlotResolution =
    allSlotStatus.gltf?.primitiveMaterials.resolutions[0];
  const allSlotNames = [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
  ] as const;

  expect(
    allSlotResolution,
    "all-slot sampler rows should publish",
  ).toBeDefined();

  if (allSlotResolution === undefined) {
    throw new Error("All-slot sampler rows did not publish.");
  }

  await expect(summaryPanel.locator("[data-texture-sampler-row]")).toHaveCount(
    5,
  );

  for (const slotName of allSlotNames) {
    await expect(samplerRow(0, 0, slotName)).toContainText(
      formatSampler(allSlotResolution.textureSlots?.[slotName]),
    );
  }

  await page.locator("#glb-asset-select").selectOption("sampler-wrap-controls");
  const samplerWrapStatus = await waitForSamplerRows({
    id: "sampler-wrap-controls",
    resolved: 3,
    rowCount: 2,
  });
  const repeatSlot =
    samplerWrapStatus.gltf?.primitiveMaterials.resolutions[0]?.textureSlots
      ?.baseColorTexture;
  const clampSlot =
    samplerWrapStatus.gltf?.primitiveMaterials.resolutions[1]?.textureSlots
      ?.baseColorTexture;

  await expect(summaryPanel.locator("[data-texture-sampler-row]")).toHaveCount(
    2,
  );
  await expect(samplerRow(0, 0, "baseColorTexture")).toContainText(
    formatSampler(repeatSlot),
  );
  await expect(samplerRow(0, 1, "baseColorTexture")).toContainText(
    formatSampler(clampSlot),
  );
  await expect(samplerRow(0, 0, "baseColorTexture")).toContainText(
    "address repeat/repeat",
  );
  await expect(samplerRow(0, 1, "baseColorTexture")).toContainText(
    "address clamp-to-edge/clamp-to-edge",
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await waitForSamplerRows({ id: "cube", resolved: 1, rowCount: 0 });
  await expect(summaryPanel.locator("[data-texture-sampler-row]")).toHaveCount(
    0,
  );
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer texture-transform rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-texture-transform-summary");
  const transformRow = (
    meshIndex: number,
    primitiveIndex: number,
    slotName: string,
  ) =>
    summaryPanel.locator(
      `[data-texture-transform-row="${meshIndex}:${primitiveIndex}:${slotName}"]`,
    );
  const formatTransformTuple = (values: readonly number[] | null) =>
    values === null
      ? "none"
      : values.map((value) => Number(value.toFixed(3))).join(", ");
  const formatTransform = (transform: TextureSlotStatus["transform"]) => {
    if (transform === null) {
      return "none";
    }

    return `offset ${formatTransformTuple(
      transform.offset,
    )}, scale ${formatTransformTuple(
      transform.scale,
    )}, rotation ${transform.rotation ?? "none"}`;
  };
  const waitForTransformRows = async (expected: {
    readonly id: string;
    readonly rowCount: number;
    readonly resolved: number;
  }) => {
    await page.waitForFunction(
      ({ id, rowCount, resolved }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly resolutions?: readonly {
                    readonly textureSlots?: Record<
                      string,
                      TextureSlotStatus | null
                    > | null;
                  }[];
                };
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const rows = (
          status?.gltf?.primitiveMaterials?.resolutions ?? []
        ).flatMap((resolution) =>
          Object.values(resolution.textureSlots ?? {}).filter(
            (slot) => slot?.transform !== null && slot?.transform !== undefined,
          ),
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.gltf?.primitiveMaterials?.resolved === resolved &&
          rows.length === rowCount &&
          document.querySelectorAll(
            "#glb-texture-transform-summary [data-texture-transform-row]",
          ).length === rowCount
        );
      },
      expected,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${expected.id} texture-transform status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(
        `${expected.id} texture-transform status did not publish.`,
      );
    }

    expectStatusJsonSafeForGpu(status);
    return status;
  };
  const samples = [
    { id: "normal-transform-controls", slotName: "normalTexture" },
    { id: "emissive-transform-controls", slotName: "emissiveTexture" },
    {
      id: "metallic-roughness-transform-controls",
      slotName: "metallicRoughnessTexture",
    },
  ] as const;

  await page.goto(`/examples/glb-viewer.html?asset=${samples[0].id}`);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  for (const sample of samples) {
    if (sample !== samples[0]) {
      await page.locator("#glb-asset-select").selectOption(sample.id);
    }

    const status = await waitForTransformRows({
      id: sample.id,
      resolved: 3,
      rowCount: 1,
    });
    const slot =
      status.gltf?.primitiveMaterials.resolutions[0]?.textureSlots?.[
        sample.slotName
      ];

    expect(
      slot?.transform,
      `${sample.id} transform should publish`,
    ).toBeDefined();

    if (slot?.transform === undefined || slot.transform === null) {
      throw new Error(`${sample.id} transform did not publish.`);
    }

    await expect(
      summaryPanel.locator("[data-texture-transform-row]"),
    ).toHaveCount(1);
    await expect(transformRow(0, 0, sample.slotName)).toContainText(
      formatTransform(slot.transform),
    );
  }

  await page.locator("#glb-asset-select").selectOption("all-slot-uri-textures");
  await waitForTransformRows({
    id: "all-slot-uri-textures",
    resolved: 2,
    rowCount: 0,
  });
  await expect(
    summaryPanel.locator("[data-texture-transform-row]"),
  ).toHaveCount(0);
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright navigates the real URI texture gallery with keyboard controls", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const samples = [
    {
      id: "all-slot-uri-textures",
      index: 0,
      drawCount: 2,
      uris: [
        "aperture-uri-base-color-checker.png",
        "aperture-metallic-roughness-checker.png",
      ],
    },
    {
      id: "alpha-mask-emissive-controls",
      index: 1,
      drawCount: 3,
      uris: [
        "aperture-alpha-mask-checker.png",
        "aperture-base-color-checker.png",
      ],
    },
    {
      id: "normal-occlusion-controls",
      index: 2,
      drawCount: 3,
      uris: ["aperture-normal-checker.png", "aperture-occlusion-control.png"],
    },
  ] as const;

  await page.goto(`/examples/glb-viewer.html?asset=${samples[0].id}`);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  async function waitForGallerySample(sample: (typeof samples)[number]) {
    await page.waitForFunction(
      ({ id, index, drawCount, uris }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly selection?: {
                readonly requestedAssetId?: string | null;
                readonly activeAssetId?: string | null;
              };
              readonly textureGallery?: {
                readonly active?: boolean;
                readonly activeIndex?: number | null;
                readonly activeAssetId?: string | null;
                readonly sampleIds?: readonly string[];
              };
              readonly source?: {
                readonly ok?: boolean;
                readonly imageDecode?: {
                  readonly decoded?: readonly { readonly uri?: string }[];
                  readonly diagnostics?: readonly unknown[];
                };
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly diagnostics?: number;
                };
              };
              readonly extraction?: {
                readonly meshDraws?: number;
                readonly diagnostics?: number;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const decodedUris = new Set(
          status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.selection?.requestedAssetId === id &&
          status.selection.activeAssetId === id &&
          status.textureGallery?.active === true &&
          status.textureGallery.activeIndex === index &&
          status.textureGallery.activeAssetId === id &&
          status.textureGallery.sampleIds?.[index] === id &&
          status.source?.ok === true &&
          uris.every((uri) => decodedUris.has(uri)) &&
          status.source.imageDecode?.diagnostics?.length === 0 &&
          status.gltf?.primitiveMaterials?.resolved === drawCount &&
          status.gltf.primitiveMaterials.diagnostics === 0 &&
          status.extraction?.meshDraws === drawCount &&
          status.extraction.diagnostics === 0
        );
      },
      sample,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(status, `${sample.id} gallery status should publish`).toBeDefined();

    if (status === undefined) {
      throw new Error(`${sample.id} gallery status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    expect(status).toMatchObject({
      selectedAsset: {
        id: sample.id,
        loading: false,
      },
      selection: {
        requestedAssetId: sample.id,
        activeAssetId: sample.id,
      },
      textureGallery: {
        id: "real-uri-textures",
        count: 5,
        active: true,
        activeIndex: sample.index,
        activeAssetId: sample.id,
        sampleIds: [
          "all-slot-uri-textures",
          "alpha-mask-emissive-controls",
          "normal-occlusion-controls",
          "sampler-wrap-controls",
          "uv1-image-decode-controls",
        ],
      },
      gltf: {
        primitiveMaterials: {
          resolved: sample.drawCount,
          diagnostics: 0,
        },
      },
      extraction: {
        meshDraws: sample.drawCount,
        diagnostics: 0,
      },
    });

    return page.locator("#aperture-canvas").screenshot();
  }

  const allSlot = await waitForGallerySample(samples[0]);
  await page.keyboard.press("ArrowRight");
  const alphaEmissive = await waitForGallerySample(samples[1]);
  await page.keyboard.press("ArrowRight");
  const normalOcclusion = await waitForGallerySample(samples[2]);
  await page.keyboard.press("ArrowLeft");
  await waitForGallerySample(samples[1]);

  expect(
    maxSampleDelta(allSlot, alphaEmissive),
    "ArrowRight should replace the all-slot gallery asset with alpha/emissive pixels",
  ).toBeGreaterThan(10);
  expect(
    maxSampleDelta(alphaEmissive, normalOcclusion),
    "ArrowRight should replace the alpha/emissive gallery asset with normal/occlusion pixels",
  ).toBeGreaterThan(10);
  webGpuValidation.expectNoWarnings();
});

test("Playwright navigates the real URI texture gallery with button controls", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const samples = [
    {
      id: "all-slot-uri-textures",
      index: 0,
      drawCount: 2,
      uris: [
        "aperture-uri-base-color-checker.png",
        "aperture-metallic-roughness-checker.png",
      ],
    },
    {
      id: "alpha-mask-emissive-controls",
      index: 1,
      drawCount: 3,
      uris: [
        "aperture-alpha-mask-checker.png",
        "aperture-base-color-checker.png",
      ],
    },
    {
      id: "normal-occlusion-controls",
      index: 2,
      drawCount: 3,
      uris: ["aperture-normal-checker.png", "aperture-occlusion-control.png"],
    },
  ] as const;

  await page.goto(`/examples/glb-viewer.html?asset=${samples[0].id}`);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await expect(page.locator("#glb-gallery-prev")).toBeVisible();
  await expect(page.locator("#glb-gallery-next")).toBeVisible();

  async function waitForGallerySample(sample: (typeof samples)[number]) {
    await page.waitForFunction(
      ({ id, index, drawCount, uris }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly selection?: {
                readonly requestedAssetId?: string | null;
                readonly activeAssetId?: string | null;
              };
              readonly textureGallery?: {
                readonly active?: boolean;
                readonly activeIndex?: number | null;
                readonly activeAssetId?: string | null;
                readonly sampleIds?: readonly string[];
              };
              readonly source?: {
                readonly ok?: boolean;
                readonly imageDecode?: {
                  readonly decoded?: readonly { readonly uri?: string }[];
                  readonly diagnostics?: readonly unknown[];
                };
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly diagnostics?: number;
                };
              };
              readonly extraction?: {
                readonly meshDraws?: number;
                readonly diagnostics?: number;
              };
              readonly draw?: { readonly drawCalls?: number };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const decodedUris = new Set(
          status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.selection?.requestedAssetId === id &&
          status.selection.activeAssetId === id &&
          status.textureGallery?.active === true &&
          status.textureGallery.activeIndex === index &&
          status.textureGallery.activeAssetId === id &&
          status.textureGallery.sampleIds?.[index] === id &&
          status.source?.ok === true &&
          uris.every((uri) => decodedUris.has(uri)) &&
          status.source.imageDecode?.diagnostics?.length === 0 &&
          status.gltf?.primitiveMaterials?.resolved === drawCount &&
          status.gltf.primitiveMaterials.diagnostics === 0 &&
          status.extraction?.meshDraws === drawCount &&
          status.extraction.diagnostics === 0 &&
          status.draw?.drawCalls === drawCount
        );
      },
      sample,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(
      status,
      `${sample.id} gallery button status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      throw new Error(`${sample.id} gallery button status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    expect(status).toMatchObject({
      selectedAsset: {
        id: sample.id,
        source: "sample",
        loading: false,
      },
      selection: {
        requestedAssetId: sample.id,
        activeAssetId: sample.id,
      },
      textureGallery: {
        id: "real-uri-textures",
        count: 5,
        active: true,
        activeIndex: sample.index,
        activeAssetId: sample.id,
      },
      gltf: {
        primitiveMaterials: {
          resolved: sample.drawCount,
          diagnostics: 0,
        },
      },
      extraction: {
        meshDraws: sample.drawCount,
        diagnostics: 0,
      },
      draw: {
        drawCalls: sample.drawCount,
      },
    });

    return page.locator("#aperture-canvas").screenshot();
  }

  const allSlot = await waitForGallerySample(samples[0]);
  await page.locator("#glb-gallery-next").click();
  const alphaEmissive = await waitForGallerySample(samples[1]);
  await page.locator("#glb-gallery-next").click();
  const normalOcclusion = await waitForGallerySample(samples[2]);
  await page.locator("#glb-gallery-prev").click();
  await waitForGallerySample(samples[1]);

  expect(
    maxSampleDelta(allSlot, alphaEmissive),
    "next gallery button should replace the all-slot asset with alpha/emissive pixels",
  ).toBeGreaterThan(10);
  expect(
    maxSampleDelta(alphaEmissive, normalOcclusion),
    "next gallery button should replace the alpha/emissive asset with normal/occlusion pixels",
  ).toBeGreaterThan(10);
  webGpuValidation.expectNoWarnings();
});

test("Playwright switches real URI texture GLB viewer samples without stale replay state", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const samples = [
    {
      id: "all-slot-uri-textures",
      label: "All-slot URI textures",
      url: "/examples/assets/all-slot-uri-textures.glb",
      drawCount: 2,
      uris: [
        "aperture-uri-base-color-checker.png",
        "aperture-metallic-roughness-checker.png",
        "aperture-normal-checker.png",
        "aperture-occlusion-checker.png",
        "aperture-base-color-checker.png",
      ],
    },
    {
      id: "alpha-mask-emissive-controls",
      label: "Alpha mask emissive controls",
      url: "/examples/assets/alpha-mask-emissive-controls.glb",
      drawCount: 3,
      uris: [
        "aperture-alpha-mask-checker.png",
        "aperture-base-color-checker.png",
      ],
    },
    {
      id: "normal-occlusion-controls",
      label: "Normal occlusion controls",
      url: "/examples/assets/normal-occlusion-controls.glb",
      drawCount: 3,
      uris: ["aperture-normal-checker.png", "aperture-occlusion-control.png"],
    },
  ] as const;

  await page.goto(`/examples/glb-viewer.html?asset=${samples[0].id}`);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  async function waitForSample(sample: (typeof samples)[number]) {
    await page.waitForFunction(
      ({ id, drawCount, uris }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly loading?: boolean;
              };
              readonly source?: {
                readonly ok?: boolean;
                readonly imageDecode?: {
                  readonly decoded?: readonly {
                    readonly uri?: string;
                  }[];
                  readonly diagnostics?: readonly unknown[];
                };
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                };
              };
              readonly extraction?: {
                readonly meshDraws?: number;
                readonly diagnostics?: number;
              };
              readonly draw?: { readonly drawCalls?: number };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const decodedUris = new Set(
          status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [],
        );

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.loading === false &&
          status.source?.ok === true &&
          status.source.imageDecode?.decoded?.length === uris.length &&
          uris.every((uri) => decodedUris.has(uri)) &&
          status.source.imageDecode.diagnostics?.length === 0 &&
          status.gltf?.primitiveMaterials?.resolved === drawCount &&
          status.extraction?.meshDraws === drawCount &&
          status.extraction.diagnostics === 0 &&
          status.draw?.drawCalls === drawCount
        );
      },
      sample,
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(status, `${sample.id} status should publish`).toBeDefined();

    if (status === undefined) {
      throw new Error(`${sample.id} status did not publish.`);
    }

    const decodedUris = (status.source?.imageDecode?.decoded ?? [])
      .map((entry) => entry.uri)
      .sort();

    expectStatusJsonSafeForGpu(status);
    expect(decodedUris).toEqual([...sample.uris].sort());
    expect(status).toMatchObject({
      selectedAsset: {
        id: sample.id,
        label: sample.label,
        source: "sample",
        url: sample.url,
        loading: false,
        materialFamilies: [{ family: "standard", count: sample.drawCount }],
      },
      source: {
        ok: true,
        imageDecode: {
          diagnostics: [],
        },
      },
      gltf: {
        primitiveMaterials: {
          resolved: sample.drawCount,
          diagnostics: 0,
        },
      },
      extraction: {
        meshDraws: sample.drawCount,
        diagnostics: 0,
      },
      draw: {
        drawCalls: sample.drawCount,
      },
    });

    return page.locator("#aperture-canvas").screenshot();
  }

  const allSlotScreenshot = await waitForSample(samples[0]);

  await page.locator("#glb-asset-select").selectOption(samples[1].id);
  const alphaEmissiveScreenshot = await waitForSample(samples[1]);

  await page.locator("#glb-asset-select").selectOption(samples[2].id);
  const normalOcclusionScreenshot = await waitForSample(samples[2]);

  expect(
    maxSampleDelta(allSlotScreenshot, alphaEmissiveScreenshot),
    "switching from all-slot URI textures to alpha/emissive controls should replace rendered pixels",
  ).toBeGreaterThan(8);
  expect(
    maxSampleDelta(alphaEmissiveScreenshot, normalOcclusionScreenshot),
    "switching from alpha/emissive controls to normal/occlusion controls should replace rendered pixels",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright replays glTF punctual lights in the GLB viewer", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/glb-viewer.html?asset=imported-light&disable-imported-lights=1",
  );
  await waitForImportedLightStatus(page, { enabled: false });
  const defaultStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const defaultScreenshot = await page.locator("#aperture-canvas").screenshot();

  expectStatusJsonSafeForGpu(defaultStatus);
  expect(defaultStatus).toMatchObject({
    selectedAsset: {
      id: "imported-light",
      label: "Imported light",
      source: "sample",
      url: "/examples/assets/imported-light.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 1 }],
    },
    importedLights: {
      status: "ready",
      enabled: false,
      declaredCount: 1,
      replayedCount: 1,
      extractedCount: 0,
      kinds: [{ kind: "point", count: 1 }],
      lights: [
        {
          status: "ready",
          supported: true,
          nodeIndex: 1,
          lightIndex: 0,
          entityKey: expect.stringMatching(
            /^viewer-imported-light-\d+:node:1$/,
          ),
          name: "ImportedWarmPoint",
          nodeName: "ImportedWarmPointNode",
          lightName: "ImportedWarmPoint",
          kind: "point",
          color: [1, 0.18, 0.06, 1],
          rawIntensity: 9,
          intensity: expect.any(Number),
          range: 5,
          extracted: false,
        },
      ],
    },
    gltf: {
      metadata: {
        counts: {
          nodes: 2,
          meshes: 1,
          primitives: 1,
          materials: 1,
          animations: 0,
        },
        extensions: {
          used: ["KHR_lights_punctual"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [],
      },
    },
    extraction: {
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
  });

  await page.goto("/examples/glb-viewer.html?asset=imported-light");
  await waitForImportedLightStatus(page, { enabled: true });
  const importedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const importedScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();

  expect(importedStatus?.importedLights).toMatchObject({
    status: "ready",
    enabled: true,
    declaredCount: 1,
    replayedCount: 1,
    extractedCount: 1,
    kinds: [{ kind: "point", count: 1 }],
    lights: [
      {
        kind: "point",
        rawIntensity: 9,
        range: 5,
        extracted: true,
      },
    ],
  });
  expect(importedStatus?.extraction).toMatchObject({
    meshDraws: 1,
    lights: 3,
    diagnostics: 0,
  });
  expect(
    maxSampleDelta(defaultScreenshot, importedScreenshot),
    "replayed glTF punctual light should visibly change the StandardMaterial sample",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer imported-light summary rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-imported-light-summary");
  const importedLightRow = (key: string) =>
    summaryPanel.locator(`[data-imported-light-summary-row="${key}"]`);

  await page.goto("/examples/glb-viewer.html?asset=imported-light");
  await waitForImportedLightStatus(page, { enabled: true });

  await expect(importedLightRow("controls")).toContainText(
    "enabled true, available true",
  );
  await expect(importedLightRow("counts")).toContainText(
    "declared 1, replayed 1, extracted 1",
  );
  await expect(importedLightRow("kinds")).toContainText("point 1");
  await expect(importedLightRow("first")).toContainText(
    "ImportedWarmPoint: point, extracted true, intensity 9, range 5",
  );

  await page.locator("#glb-imported-light-toggle").setChecked(false);
  const disabledStatus = await waitForImportedLightStatus(page, {
    enabled: false,
  });

  expect(disabledStatus.importedLights).toMatchObject({
    enabled: false,
    extractedCount: 0,
    lights: [{ extracted: false }],
  });
  await expect(importedLightRow("controls")).toContainText(
    "enabled false, available true",
  );
  await expect(importedLightRow("counts")).toContainText(
    "declared 1, replayed 1, extracted 0",
  );
  await expect(importedLightRow("first")).toContainText(
    "ImportedWarmPoint: point, extracted false, intensity 9, range 5",
  );

  await page.locator("#glb-imported-light-toggle").setChecked(true);
  await waitForImportedLightStatus(page, { enabled: true });
  await expect(importedLightRow("counts")).toContainText(
    "declared 1, replayed 1, extracted 1",
  );

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedLights?: {
              readonly status?: string;
              readonly declaredCount?: number;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.importedLights?.status === "absent" &&
        status.importedLights.declaredCount === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );

  await expect(
    summaryPanel.locator("[data-imported-light-summary-row]"),
  ).toHaveCount(0);
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright renders GLB viewer imported-light list rows", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const summaryPanel = page.locator("#glb-imported-light-list-summary");
  const importedLightRow = (index: number) =>
    summaryPanel.locator(`[data-imported-light-list-row="${index}"]`);
  const expectImportedLightListRow = async (
    light: ImportedLightDescriptorStatus,
  ) => {
    const row = importedLightRow(light.lightIndex);
    const name = light.name ?? light.lightName ?? light.nodeName ?? "none";
    const intensity =
      typeof light.rawIntensity === "number" ? light.rawIntensity : "none";
    const range = typeof light.range === "number" ? light.range : "none";

    await expect(row).toContainText(name);
    await expect(row).toContainText(light.kind);
    await expect(row).toContainText(`extracted ${light.extracted}`);
    await expect(row).toContainText(
      `node ${light.nodeIndex}, light ${light.lightIndex}`,
    );
    await expect(row).toContainText(`intensity ${intensity}`);
    await expect(row).toContainText(`range ${range}`);
  };

  await page.goto("/examples/glb-viewer.html?asset=imported-light");
  const enabledStatus = await waitForImportedLightStatus(page, {
    enabled: true,
  });
  const enabledLight = enabledStatus.importedLights?.lights[0];

  expect(
    enabledLight,
    "enabled imported-light row should publish",
  ).toBeDefined();

  if (enabledLight === undefined) {
    throw new Error("Enabled imported-light row did not publish.");
  }

  await expect(
    summaryPanel.locator("[data-imported-light-list-row]"),
  ).toHaveCount(1);
  await expectImportedLightListRow(enabledLight);

  await page.locator("#glb-imported-light-toggle").setChecked(false);
  const disabledStatus = await waitForImportedLightStatus(page, {
    enabled: false,
  });
  const disabledLight = disabledStatus.importedLights?.lights[0];

  expect(
    disabledLight,
    "disabled imported-light row should publish",
  ).toBeDefined();

  if (disabledLight === undefined) {
    throw new Error("Disabled imported-light row did not publish.");
  }

  await expectImportedLightListRow(disabledLight);

  await page.locator("#glb-asset-select").selectOption("cube");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedLights?: {
              readonly status?: string;
              readonly lights?: readonly unknown[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.importedLights?.status === "absent" &&
        status.importedLights.lights?.length === 0 &&
        document.querySelectorAll(
          "#glb-imported-light-list-summary [data-imported-light-list-row]",
        ).length === 0
      );
    },
    undefined,
    { timeout: 5000 },
  );
  await expect(summaryPanel).toBeHidden();
  webGpuValidation.expectNoWarnings();
});

test("Playwright mutates GLB viewer ECS light controls", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const initialStatus = await loadBrassViewerSample(
    page,
    "/examples/glb-viewer.html?disable-ibl-sampling=1&disable-shadow-receiver=1",
    false,
    false,
  );

  expect(initialStatus.lighting).toMatchObject({
    controls: {
      ambientIntensity: 0.24,
      pointIntensity: 18,
    },
    ecs: {
      ambientIntensity: 0.24,
      pointIntensity: 18,
    },
    extracted: {
      ambientIntensity: 0.24,
      pointIntensity: 18,
    },
  });

  await setRangeInputValue(page, "#glb-point-light-intensity", 0);
  await setRangeInputValue(page, "#glb-ambient-intensity", 0);
  const dimStatus = await waitForLightingStatus(page, {
    ambientIntensity: 0,
    pointIntensity: 0,
  });
  const dimScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(dimStatus.lighting).toMatchObject({
    controls: {
      ambientIntensity: 0,
      pointIntensity: 0,
    },
    ecs: {
      ambientIntensity: 0,
      pointIntensity: 0,
    },
    extracted: {
      ambientIntensity: 0,
      pointIntensity: 0,
    },
  });

  await setRangeInputValue(page, "#glb-point-light-intensity", 36);
  await setRangeInputValue(page, "#glb-ambient-intensity", 1);
  const brightStatus = await waitForLightingStatus(page, {
    ambientIntensity: 1,
    pointIntensity: 36,
  });
  const brightScreenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    brightStatus.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(brightStatus.clearColor);
  const dimModel = averageRegionLuminance(
    dimScreenshot,
    clear,
    glbViewerModelRegion(),
  );
  const brightModel = averageRegionLuminance(
    brightScreenshot,
    clear,
    glbViewerModelRegion(),
  );

  expectStatusJsonSafeForGpu(brightStatus);
  expect(brightStatus.lighting).toMatchObject({
    controls: {
      ambientIntensity: 1,
      pointIntensity: 36,
    },
    ecs: {
      ambientIntensity: 1,
      pointIntensity: 36,
    },
    extracted: {
      ambientIntensity: 1,
      pointIntensity: 36,
    },
  });
  expect(
    brightModel.average - dimModel.average,
    `lit brass model should brighten when ECS light controls increase intensity; dim=${JSON.stringify(
      dimModel,
    )} bright=${JSON.stringify(brightModel)}`,
  ).toBeGreaterThan(12);
  expect(
    maxRegionLuminanceDelta(
      dimScreenshot,
      brightScreenshot,
      glbViewerModelRegion(),
    ),
    "changing ECS-authored light components should visibly change the brass model",
  ).toBeGreaterThan(18);
  webGpuValidation.expectNoWarnings();
});

test("Playwright bootstraps a custom GLB URL from the query string", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    `/examples/glb-viewer.html?url=${encodeURIComponent(
      "/examples/assets/sapphire-pillar.glb",
    )}`,
  );

  await page.waitForFunction(
    () =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= 3 &&
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.selectedAsset?.id ?? "") ===
        "custom-url" &&
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: { readonly loading?: boolean };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.selectedAsset?.loading ?? true) ===
        false &&
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.extraction?.meshDraws ?? 0) === 1,
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status?.ok).toBe(true);
  expectStatusJsonSafeForGpu(status);
  expectReadyOrbitFit(status, "query GLB");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "custom-url",
      label: "Custom URL",
      source: "custom",
      url: "/examples/assets/sapphire-pillar.glb",
      loading: false,
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      diagnostics: [],
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
  });
  await expect(page.locator("#glb-url-input")).toHaveValue(
    "http://127.0.0.1:4173/examples/assets/sapphire-pillar.glb",
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);

  expect(
    pixelDistance(strongestSample(screenshot, clear), clear),
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(strongestNearCenterSample(screenshot, clear), clear),
    "query-loaded GLB should be visibly framed near the center",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright decodes a same-origin URI texture from a custom GLB URL", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    `/examples/glb-viewer.html?url=${encodeURIComponent(
      "/examples/assets/uri-png-texture.glb",
    )}`,
  );

  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly source?: string;
              readonly loading?: boolean;
              readonly materialSlotSummary?: MaterialSlotSummaryStatus;
            };
            readonly source?: {
              readonly ok?: boolean;
              readonly imageDecode?: {
                readonly decoded?: readonly {
                  readonly uri?: string;
                  readonly width?: number;
                  readonly height?: number;
                }[];
                readonly diagnostics?: readonly unknown[];
              };
            };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly diagnostics?: number;
              };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly diagnostics?: number;
            };
            readonly draw?: { readonly drawCalls?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const summary = status?.selectedAsset?.materialSlotSummary;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "custom-url" &&
        status.selectedAsset.source === "custom" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.source.imageDecode?.decoded?.some(
          (entry) =>
            entry.uri === "aperture-uri-base-color-checker.png" &&
            entry.width === 2 &&
            entry.height === 2,
        ) === true &&
        status.source.imageDecode.diagnostics?.length === 0 &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.gltf.primitiveMaterials.diagnostics === 0 &&
        status.extraction?.meshDraws === 2 &&
        status.extraction.diagnostics === 0 &&
        status.draw?.drawCalls === 2 &&
        summary?.materialCount === 2 &&
        summary.textureSlots.baseColorTexture.count === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "custom URI PNG texture viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Custom URI PNG texture viewer status did not publish.");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    status.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);
  const textureWarm = readPngPixel(screenshot, 0.35, 0.43);
  const textureCool = readPngPixel(screenshot, 0.46, 0.57);
  const scalarControl = readPngPixel(screenshot, 0.64, 0.5);
  const serializedStatus = JSON.stringify(status);

  expectStatusJsonSafeForGpu(status);
  expect(serializedStatus).not.toContain("Uint8Array");
  expect(serializedStatus).not.toContain("[255,74,74");
  expect(status).toMatchObject({
    selectedAsset: {
      id: "custom-url",
      label: "Custom URL",
      source: "custom",
      url: "/examples/assets/uri-png-texture.glb",
      loading: false,
      materialFamilies: [{ family: "standard", count: 2 }],
      materialSlotSummary: {
        materialCount: 2,
        registeredMaterialCount: 2,
        missingMaterialCount: 0,
        scalarOnlyMaterialCount: 1,
        textureSlots: {
          baseColorTexture: { count: 1, uv0: 1, uv1: 0, otherUv: 0 },
          metallicRoughnessTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          normalTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          occlusionTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
          emissiveTexture: { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
        },
        alphaModes: { opaque: 2, mask: 0, blend: 0 },
        uv1Usage: { materials: 0, textureSlots: 0 },
      },
    },
    selection: {
      requestedAssetId: null,
      activeAssetId: "custom-url",
      diagnostics: [],
    },
    textureGallery: {
      id: "real-uri-textures",
      count: 5,
      active: false,
      activeIndex: null,
      activeAssetId: null,
    },
    source: {
      ok: true,
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      imageDecode: {
        decoded: [
          {
            imageIndex: 0,
            sourceKind: "same-origin-uri",
            uri: "aperture-uri-base-color-checker.png",
            url: "/examples/assets/aperture-uri-base-color-checker.png",
            mimeType: "image/png",
            width: 2,
            height: 2,
            byteLength: 16,
          },
        ],
        diagnostics: [],
      },
      diagnostics: [],
    },
    gltf: {
      primitiveMaterials: {
        valid: true,
        resolved: 2,
        diagnostics: 0,
        families: [{ family: "standard", count: 2 }],
        resolutions: [
          {
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: {
                textureKey: expect.stringMatching(
                  /^texture:viewer-custom-url-\d+:texture:0:baseColorTexture$/,
                ),
                samplerKey: expect.stringMatching(
                  /^sampler:viewer-custom-url-\d+:sampler:0:baseColorTexture$/,
                ),
                texCoord: 0,
                hasTransform: false,
              },
            },
          },
          {
            meshIndex: 0,
            primitiveIndex: 1,
            materialIndex: 1,
            family: "standard",
            alphaMode: "opaque",
            pipelineKey: "standard|opaque|back|less|none",
            textureSlots: {
              baseColorTexture: null,
            },
          },
        ],
      },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 2,
      lights: 2,
      diagnostics: 0,
    },
    renderState: {
      pipelineKeys: expect.arrayContaining([
        "standard|baseColorTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
      ]),
    },
    draw: {
      packages: 2,
      drawCalls: 2,
    },
  });
  await expect(page.locator("#glb-url-input")).toHaveValue(
    "http://127.0.0.1:4173/examples/assets/uri-png-texture.glb",
  );
  const customUrl = new URL(page.url());
  expect(customUrl.searchParams.get("url")).toBe(
    "/examples/assets/uri-png-texture.glb",
  );
  expect(customUrl.searchParams.has("asset")).toBe(false);
  expect(
    pixelDistance(textureWarm, clear),
    `custom URI PNG texture should render visible pixels; sample=${JSON.stringify(
      textureWarm,
    )}`,
  ).toBeGreaterThan(20);
  expect(
    pixelDistance(textureWarm, textureCool),
    "custom GLB same-origin PNG decode should create visible base-color variation",
  ).toBeGreaterThan(12);
  expect(
    pixelDistance(textureWarm, scalarControl) +
      pixelDistance(textureCool, scalarControl),
    "custom GLB textured primitive should differ from the scalar control region",
  ).toBeGreaterThan(30);
  webGpuValidation.expectNoWarnings();
});

test("Playwright persists GLB viewer sample selection in the URL", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  async function waitForSelectedSample(id: string, drawCount: number) {
    await page.waitForFunction(
      ({ id, drawCount }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly selection?: {
                readonly requestedAssetId?: string | null;
                readonly activeAssetId?: string | null;
              };
              readonly extraction?: {
                readonly meshDraws?: number;
                readonly diagnostics?: number;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === "sample" &&
          status.selectedAsset.loading === false &&
          status.selection?.requestedAssetId === id &&
          status.selection.activeAssetId === id &&
          status.extraction?.meshDraws === drawCount &&
          status.extraction.diagnostics === 0
        );
      },
      { id, drawCount },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(status, `${id} persisted status should publish`).toBeDefined();

    if (status === undefined) {
      throw new Error(`${id} persisted status did not publish.`);
    }

    expectStatusJsonSafeForGpu(status);
    expect(status.selectedAsset).toMatchObject({
      id,
      source: "sample",
      loading: false,
    });

    return status;
  }

  await page.locator("#glb-asset-select").selectOption("brass");
  await waitForSelectedSample("brass", 2);
  let persistedUrl = new URL(page.url());
  expect(persistedUrl.pathname).toBe("/examples/glb-viewer.html");
  expect(persistedUrl.searchParams.get("asset")).toBe("brass");
  expect(persistedUrl.searchParams.has("url")).toBe(false);

  await page.reload();
  await waitForSelectedSample("brass", 2);
  await expect(page.locator("#glb-asset-select")).toHaveValue("brass");

  await page.goto("/examples/glb-viewer.html?asset=all-slot-uri-textures");
  await waitForSelectedSample("all-slot-uri-textures", 2);
  await page.locator("#glb-gallery-next").click();
  await waitForSelectedSample("alpha-mask-emissive-controls", 3);
  persistedUrl = new URL(page.url());
  expect(persistedUrl.searchParams.get("asset")).toBe(
    "alpha-mask-emissive-controls",
  );
  expect(persistedUrl.searchParams.has("url")).toBe(false);

  await page.reload();
  await waitForSelectedSample("alpha-mask-emissive-controls", 3);
  await expect(page.locator("#glb-asset-select")).toHaveValue(
    "alpha-mask-emissive-controls",
  );
  webGpuValidation.expectNoWarnings();
});

test("Playwright clears custom URI texture decode state when switching to a sample", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    `/examples/glb-viewer.html?url=${encodeURIComponent(
      "/examples/assets/uri-png-texture.glb",
    )}`,
  );
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  async function waitForActiveAsset({
    id,
    source,
    drawCount,
    uris,
  }: {
    readonly id: string;
    readonly source: "custom" | "sample";
    readonly drawCount: number;
    readonly uris: readonly string[];
  }) {
    await page.waitForFunction(
      ({ id, source, drawCount, uris }) => {
        const status = (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly frame?: number;
              readonly selectedAsset?: {
                readonly id?: string;
                readonly source?: string;
                readonly loading?: boolean;
              };
              readonly source?: {
                readonly ok?: boolean;
                readonly imageDecode?: {
                  readonly decoded?: readonly { readonly uri?: string }[];
                  readonly diagnostics?: readonly unknown[];
                };
              };
              readonly gltf?: {
                readonly primitiveMaterials?: {
                  readonly resolved?: number;
                  readonly diagnostics?: number;
                };
              };
              readonly extraction?: {
                readonly meshDraws?: number;
                readonly diagnostics?: number;
              };
              readonly draw?: { readonly drawCalls?: number };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__;
        const decodedUris =
          status?.source?.imageDecode?.decoded?.map((entry) => entry.uri) ?? [];

        return (
          (status?.frame ?? 0) >= 3 &&
          status?.selectedAsset?.id === id &&
          status.selectedAsset.source === source &&
          status.selectedAsset.loading === false &&
          status.source?.ok === true &&
          decodedUris.length === uris.length &&
          uris.every((uri) => decodedUris.includes(uri)) &&
          status.source.imageDecode?.diagnostics?.length === 0 &&
          status.gltf?.primitiveMaterials?.resolved === drawCount &&
          status.gltf.primitiveMaterials.diagnostics === 0 &&
          status.extraction?.meshDraws === drawCount &&
          status.extraction.diagnostics === 0 &&
          status.draw?.drawCalls === drawCount
        );
      },
      { id, source, drawCount, uris },
      { timeout: 5000 },
    );

    const status = await waitForExampleStatus<GlbViewerStatus>(page);

    expect(status, `${id} active asset status should publish`).toBeDefined();

    if (status === undefined) {
      throw new Error(`${id} active asset status did not publish.`);
    }

    const decodedUris = (status.source?.imageDecode.decoded ?? [])
      .map((entry) => entry.uri)
      .sort();

    expectStatusJsonSafeForGpu(status);
    expect(decodedUris).toEqual([...uris].sort());
    expect(status).toMatchObject({
      selectedAsset: {
        id,
        source,
        loading: false,
      },
      source: {
        ok: true,
        imageDecode: { diagnostics: [] },
      },
      gltf: {
        primitiveMaterials: {
          resolved: drawCount,
          diagnostics: 0,
        },
      },
      extraction: {
        meshDraws: drawCount,
        diagnostics: 0,
      },
      draw: {
        drawCalls: drawCount,
      },
    });

    return page.locator("#aperture-canvas").screenshot();
  }

  const customScreenshot = await waitForActiveAsset({
    id: "custom-url",
    source: "custom",
    drawCount: 2,
    uris: ["aperture-uri-base-color-checker.png"],
  });

  await page
    .locator("#glb-asset-select")
    .selectOption("normal-occlusion-controls");
  const sampleScreenshot = await waitForActiveAsset({
    id: "normal-occlusion-controls",
    source: "sample",
    drawCount: 3,
    uris: ["aperture-normal-checker.png", "aperture-occlusion-control.png"],
  });

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status).toMatchObject({
    selectedAsset: {
      id: "normal-occlusion-controls",
      label: "Normal occlusion controls",
      source: "sample",
      url: "/examples/assets/normal-occlusion-controls.glb",
      loading: false,
    },
    selection: {
      requestedAssetId: "normal-occlusion-controls",
      activeAssetId: "normal-occlusion-controls",
      diagnostics: [],
    },
    textureGallery: {
      active: true,
      activeIndex: 2,
      activeAssetId: "normal-occlusion-controls",
    },
  });
  expect(
    status?.source?.imageDecode.decoded.some(
      (entry) => entry.uri === "aperture-uri-base-color-checker.png",
    ),
  ).toBe(false);
  expect(new URL(page.url()).searchParams.get("asset")).toBe(
    "normal-occlusion-controls",
  );
  expect(new URL(page.url()).searchParams.has("url")).toBe(false);
  expect(
    maxSampleDelta(customScreenshot, sampleScreenshot),
    "switching from custom URI PNG to a committed sample should replace rendered pixels",
  ).toBeGreaterThan(8);
  webGpuValidation.expectNoWarnings();
});

test("Playwright bootstraps a sample GLB asset from the query string", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html?asset=brass");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "brass" &&
        status.selectedAsset.loading === false &&
        status.extraction?.meshDraws === 2
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const brassStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(brassStatus?.ok).toBe(true);
  expectStatusJsonSafeForGpu(brassStatus);
  expect(brassStatus).toMatchObject({
    selectedAsset: {
      id: "brass",
      label: "Lit brass cube",
      source: "sample",
      url: "/examples/assets/lit-brass-cube.glb",
      loading: false,
    },
    selection: {
      requestedAssetId: "brass",
      activeAssetId: "brass",
      diagnostics: [],
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
    },
  });
  await expect(page.locator("#glb-asset-select")).toHaveValue("brass");

  const brassScreenshot = await page.locator("#aperture-canvas").screenshot();
  const brassClear =
    brassStatus?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(brassStatus.clearColor);

  expect(
    pixelDistance(
      strongestNearCenterSample(brassScreenshot, brassClear),
      brassClear,
    ),
    "query-selected brass GLB should render visible centered pixels",
  ).toBeGreaterThan(20);

  await page.goto("/examples/glb-viewer.html?asset=missing-sample");
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly selection?: {
              readonly diagnostics?: readonly { readonly code?: string }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "cube" &&
        status.selectedAsset.loading === false &&
        status.selection?.diagnostics?.[0]?.code ===
          "glbViewerSelection.unknownSampleAsset" &&
        status.extraction?.meshDraws === 1
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const fallbackStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(fallbackStatus?.ok).toBe(true);
  expectStatusJsonSafeForGpu(fallbackStatus);
  expect(fallbackStatus).toMatchObject({
    selectedAsset: {
      id: "cube",
      label: "Mint cube",
      source: "sample",
      url: "/examples/assets/cube.glb",
      loading: false,
    },
    selection: {
      requestedAssetId: "missing-sample",
      activeAssetId: "cube",
      diagnostics: [
        {
          code: "glbViewerSelection.unknownSampleAsset",
          severity: "warning",
          requestedAssetId: "missing-sample",
          fallbackAssetId: "cube",
        },
      ],
    },
    extraction: {
      meshDraws: 1,
      diagnostics: 0,
    },
  });
  await expect(page.locator("#glb-asset-select")).toHaveValue("cube");

  const fallbackScreenshot = await page
    .locator("#aperture-canvas")
    .screenshot();
  const fallbackClear =
    fallbackStatus?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(fallbackStatus.clearColor);

  expect(
    pixelDistance(
      strongestNearCenterSample(fallbackScreenshot, fallbackClear),
      fallbackClear,
    ),
    "invalid query-selected GLB should fall back to a visible default sample",
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

function expectReadyOrbitFit(
  status: GlbViewerStatus | undefined,
  label: string,
): NonNullable<GlbViewerStatus["orbit"]> {
  const orbit = status?.orbit;

  expect(orbit, `${label} should publish orbit status`).toBeDefined();
  expect(orbit?.fit.status, `${label} fit status`).toBe("ready");
  expect(orbit?.fit.center.length, `${label} fit center`).toBe(3);
  expect(orbit?.fit.size.length, `${label} fit size`).toBe(3);
  expect(orbit?.target, `${label} fit target`).toEqual(orbit?.fit.center);
  expect(orbit?.yaw, `${label} fit yaw`).toBeCloseTo(
    orbit?.fit.yaw ?? Number.NaN,
    3,
  );
  expect(orbit?.elevation, `${label} fit elevation`).toBeCloseTo(
    orbit?.fit.elevation ?? Number.NaN,
    3,
  );
  expect(orbit?.distance, `${label} fit distance`).toBeCloseTo(
    orbit?.fit.distance ?? Number.NaN,
    3,
  );
  expect(
    orbit?.fit.size.some((value) => value > 0),
    `${label} fit should have a positive extent`,
  ).toBe(true);
  expect(orbit?.fit.minDistance, `${label} min zoom`).toBeLessThan(
    orbit?.fit.distance ?? 0,
  );
  expect(orbit?.fit.maxDistance, `${label} max zoom`).toBeGreaterThan(
    orbit?.fit.distance ?? 0,
  );
  expect(orbit?.resetAvailable, `${label} reset availability`).toBe(true);

  return orbit as NonNullable<GlbViewerStatus["orbit"]>;
}

function expectNoStaleGlbViewerAssets(
  status: GlbViewerStatus | undefined,
  label: string,
): void {
  expect(
    status?.assetRegistry,
    `${label} should publish asset registry`,
  ).toBeDefined();
  expect(
    status?.assetRegistry?.activeRegistered ?? 0,
    `${label} active registry count`,
  ).toBeGreaterThan(0);
  expect(
    status?.assetRegistry?.staleRegistered,
    `${label} stale registry count`,
  ).toBe(0);
  expect(status?.assetRegistry?.total, `${label} total registry count`).toBe(
    status?.assetRegistry?.activeRegistered,
  );
}

async function loadBrassViewerSample(
  page: Page,
  url: string,
  requireShadow: boolean,
  requireIbl = true,
): Promise<GlbViewerStatus> {
  await page.goto(url);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.locator("#glb-asset-select").selectOption("brass");
  await page.waitForFunction(
    ({ shadowRequired, iblRequired }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
              }[];
            };
            readonly source?: { readonly ok?: boolean };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly shadowRequests?: number;
            };
            readonly ibl?: {
              readonly rendering?: { readonly supported?: boolean };
            };
            readonly shadow?: {
              readonly rendering?: { readonly supported?: boolean };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "brass" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.extraction?.meshDraws === 2 &&
        status.extraction?.shadowRequests === 1 &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard",
        ) === true &&
        (iblRequired
          ? status.ibl?.rendering?.supported === true
          : status.ibl?.rendering?.supported === false) &&
        (shadowRequired
          ? status.shadow?.rendering?.supported === true
          : status.shadow?.rendering?.supported === false)
      );
    },
    { shadowRequired: requireShadow, iblRequired: requireIbl },
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "lit brass viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Lit brass viewer status did not publish.");
  }

  return status;
}

async function loadRoughnessIblViewerSample(
  page: Page,
  url: string,
  requireIbl: boolean,
): Promise<GlbViewerStatus> {
  await page.goto(url);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    (iblRequired) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly primitiveMaterials?: { readonly resolved?: number };
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly environments?: number;
            };
            readonly ibl?: {
              readonly rendering?: { readonly supported?: boolean };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "roughness-ibl" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        (iblRequired
          ? status.extraction?.environments === 1 &&
            status.ibl?.rendering?.supported === true
          : status.ibl?.rendering?.supported === false) &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true
      );
    },
    requireIbl,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "roughness IBL viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Roughness IBL viewer status did not publish.");
  }

  return status;
}

async function loadNormalMapViewerSample(
  page: Page,
  assetId = "normal-map",
): Promise<GlbViewerStatus> {
  await page.goto(`/examples/glb-viewer.html?asset=${assetId}`);
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    (expectedAssetId) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                }[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === expectedAssetId &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|normalTexture|opaque|back|less|none",
        ) === true &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true
      );
    },
    assetId,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "normal-map viewer status should publish").toBeDefined();

  if (status === undefined) {
    throw new Error("Normal-map viewer status did not publish.");
  }

  return status;
}

async function loadTexturedStandardViewerSample(
  page: Page,
): Promise<GlbViewerStatus> {
  await page.goto("/examples/glb-viewer.html?asset=textured-standard");
  const initialStatus = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(initialStatus, "GLB viewer status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("GLB viewer status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
              readonly materialFamilies?: readonly {
                readonly family?: string;
                readonly count?: number;
              }[];
            };
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly primitiveMaterials?: {
                readonly resolved?: number;
                readonly resolutions?: readonly {
                  readonly pipelineKey?: string | null;
                }[];
              };
            };
            readonly extraction?: { readonly meshDraws?: number };
            readonly renderState?: {
              readonly pipelineKeys?: readonly string[];
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "textured-standard" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 2 &&
        status.extraction?.meshDraws === 2 &&
        status.renderState?.pipelineKeys?.includes(
          "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
        ) === true &&
        status.selectedAsset.materialFamilies?.some(
          (entry) => entry.family === "standard" && entry.count === 2,
        ) === true
      );
    },
    undefined,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(
    status,
    "textured StandardMaterial viewer status should publish",
  ).toBeDefined();

  if (status === undefined) {
    throw new Error("Textured StandardMaterial viewer status did not publish.");
  }

  return status;
}

async function waitForAnimationControlStatus(
  page: Page,
  expected: {
    readonly status: "playing" | "paused";
    readonly time?: number;
    readonly timeNot?: number;
    readonly speed?: number;
  },
): Promise<GlbViewerStatus> {
  await page.waitForFunction(
    ({ status, time, timeNot, speed }) => {
      const current = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly status?: string;
              readonly time?: number;
              readonly speed?: number;
              readonly activeClipName?: string | null;
              readonly animatedNodes?: readonly {
                readonly value?: readonly number[];
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const animation = current?.animation;
      const animatedX = animation?.animatedNodes?.[0]?.value?.[0];
      const timeMatches =
        typeof time === "number"
          ? Math.abs((animation?.time ?? Number.NaN) - time) < 0.03
          : true;
      const timeDiffers =
        typeof timeNot === "number"
          ? Math.abs((animation?.time ?? Number.NaN) - timeNot) > 0.1
          : true;
      const speedMatches =
        typeof speed === "number"
          ? Math.abs((animation?.speed ?? Number.NaN) - speed) < 0.001
          : true;

      return (
        current?.selectedAsset?.id === "animated" &&
        current.selectedAsset.loading === false &&
        current.extraction?.meshDraws === 1 &&
        animation?.status === status &&
        animation.activeClipName === "SlideX" &&
        typeof animatedX === "number" &&
        timeMatches &&
        timeDiffers &&
        speedMatches
      );
    },
    expected,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  if (status === undefined) {
    throw new Error("GLB viewer animation control status did not publish.");
  }

  return status;
}

async function waitForStepAnimationStatus(
  page: Page,
  expected: {
    readonly status: "playing" | "paused";
    readonly time?: number;
  },
): Promise<GlbViewerStatus> {
  await page.waitForFunction(
    ({ status, time }) => {
      const current = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly animation?: {
              readonly status?: string;
              readonly time?: number;
              readonly activeClipName?: string | null;
              readonly animatedNodes?: readonly {
                readonly path?: string;
                readonly interpolation?: string;
                readonly value?: readonly number[];
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const scale = current?.animation?.animatedNodes?.find(
        (entry) => entry.path === "scale",
      );
      const timeMatches =
        typeof time === "number"
          ? Math.abs((current?.animation?.time ?? Number.NaN) - time) < 0.03
          : true;

      return (
        current?.selectedAsset?.id === "step-animation" &&
        current.selectedAsset.loading === false &&
        current.extraction?.meshDraws === 1 &&
        current.animation?.status === status &&
        current.animation.activeClipName === "SteppedScale" &&
        scale?.interpolation === "STEP" &&
        typeof scale.value?.[0] === "number" &&
        timeMatches
      );
    },
    expected,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  if (status === undefined) {
    throw new Error("GLB viewer STEP animation status did not publish.");
  }

  return status;
}

async function waitForImportedLightStatus(
  page: Page,
  expected: { readonly enabled: boolean },
): Promise<GlbViewerStatus> {
  await page.waitForFunction(
    ({ enabled }) => {
      const current = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly frame?: number;
            readonly selectedAsset?: {
              readonly id?: string;
              readonly loading?: boolean;
            };
            readonly importedLights?: {
              readonly status?: string;
              readonly enabled?: boolean;
              readonly declaredCount?: number;
              readonly replayedCount?: number;
              readonly extractedCount?: number;
              readonly lights?: readonly {
                readonly kind?: string;
                readonly extracted?: boolean;
              }[];
            };
            readonly extraction?: {
              readonly meshDraws?: number;
              readonly lights?: number;
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (current?.frame ?? 0) >= 3 &&
        current?.selectedAsset?.id === "imported-light" &&
        current.selectedAsset.loading === false &&
        current.importedLights?.status === "ready" &&
        current.importedLights.enabled === enabled &&
        current.importedLights.declaredCount === 1 &&
        current.importedLights.replayedCount === 1 &&
        current.importedLights.extractedCount === (enabled ? 1 : 0) &&
        current.importedLights.lights?.[0]?.kind === "point" &&
        current.importedLights.lights[0].extracted === enabled &&
        current.extraction?.meshDraws === 1 &&
        current.extraction.lights === (enabled ? 3 : 2)
      );
    },
    expected,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  if (status === undefined) {
    throw new Error("GLB viewer imported light status did not publish.");
  }

  return status;
}

function animatedChannelValue(
  status: GlbViewerStatus | undefined,
  path: string,
): readonly number[] {
  const value = status?.animation?.animatedNodes.find(
    (entry) => entry.path === path,
  )?.value;

  if (value === undefined) {
    throw new Error(`Animation channel '${path}' did not publish.`);
  }

  return value;
}

function animationChannelComponent(
  status: GlbViewerStatus | undefined,
  path: string,
  index: number,
): number {
  return tupleComponent(animatedChannelValue(status, path), index, path);
}

function tupleComponent(
  value: readonly number[],
  index: number,
  label: string,
): number {
  const component = value[index];

  if (typeof component !== "number") {
    throw new Error(`Animation channel '${label}' component ${index} missing.`);
  }

  return component;
}

async function waitForAnimationFrameAdvance(
  page: Page,
  minFrame: number,
): Promise<void> {
  await page.waitForFunction(
    (frame) =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= frame,
    minFrame,
    { timeout: 3000 },
  );
}

function animationTimeDelta(
  start: GlbViewerStatus,
  end: GlbViewerStatus | undefined,
): number {
  if (end === undefined || start.animation === undefined) {
    throw new Error("Animation status did not publish after frame advance.");
  }

  const startTime = start.animation.time;
  const endTime = end.animation?.time ?? startTime;
  const duration = start.animation.duration;

  return duration > 0 && endTime < startTime
    ? endTime + duration - startTime
    : endTime - startTime;
}

async function setRangeInputValue(
  page: Page,
  selector: string,
  value: number,
): Promise<void> {
  await page.locator(selector).evaluate((node, nextValue) => {
    const input = node as HTMLInputElement;

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function setSelectInputValue(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  await page.locator(selector).evaluate((node, nextValue) => {
    const select = node as HTMLSelectElement;

    select.value = nextValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function waitForLightingStatus(
  page: Page,
  expected: {
    readonly ambientIntensity: number;
    readonly pointIntensity: number;
  },
): Promise<GlbViewerStatus> {
  await page.waitForFunction(
    ({ ambientIntensity, pointIntensity }) => {
      const lighting = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly lighting?: {
              readonly controls?: {
                readonly ambientIntensity?: number;
                readonly pointIntensity?: number;
              };
              readonly ecs?: {
                readonly ambientIntensity?: number;
                readonly pointIntensity?: number;
              };
              readonly extracted?: {
                readonly ambientIntensity?: number | null;
                readonly pointIntensity?: number | null;
              };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.lighting;

      return (
        Math.abs(
          (lighting?.controls?.ambientIntensity ?? Number.NaN) -
            ambientIntensity,
        ) < 0.001 &&
        Math.abs(
          (lighting?.controls?.pointIntensity ?? Number.NaN) - pointIntensity,
        ) < 0.001 &&
        Math.abs(
          (lighting?.ecs?.ambientIntensity ?? Number.NaN) - ambientIntensity,
        ) < 0.001 &&
        Math.abs(
          (lighting?.ecs?.pointIntensity ?? Number.NaN) - pointIntensity,
        ) < 0.001 &&
        Math.abs(
          (lighting?.extracted?.ambientIntensity ?? Number.NaN) -
            ambientIntensity,
        ) < 0.001 &&
        Math.abs(
          (lighting?.extracted?.pointIntensity ?? Number.NaN) - pointIntensity,
        ) < 0.001
      );
    },
    expected,
    { timeout: 3000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  if (status === undefined) {
    throw new Error("GLB viewer lighting status did not publish.");
  }

  return status;
}

async function waitForShadowControlStatus(
  page: Page,
  expected: {
    readonly receiverEnabled: boolean;
    readonly casterEnabled: boolean;
    readonly supported: boolean;
    readonly casterCount: number;
    readonly receiverCount: number;
    readonly includedDrawCount: number;
  },
): Promise<GlbViewerStatus> {
  await page.waitForFunction(
    ({
      receiverEnabled,
      casterEnabled,
      supported,
      casterCount,
      receiverCount,
      includedDrawCount,
    }) => {
      const shadow = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly shadow?: {
              readonly controls?: {
                readonly receiverEnabled?: boolean;
                readonly casterEnabled?: boolean;
              };
              readonly ecs?: {
                readonly receiverEnabled?: boolean | null;
                readonly casterEnabled?: boolean | null;
              };
              readonly authoring?: {
                readonly casterCount?: number;
                readonly receiverCount?: number;
              };
              readonly casterDrawList?: {
                readonly includedDrawCount?: number;
              } | null;
              readonly rendering?: {
                readonly supported?: boolean;
              };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.shadow;

      return (
        shadow?.controls?.receiverEnabled === receiverEnabled &&
        shadow.controls.casterEnabled === casterEnabled &&
        shadow.ecs?.receiverEnabled === receiverEnabled &&
        shadow.ecs.casterEnabled === casterEnabled &&
        shadow.authoring?.casterCount === casterCount &&
        shadow.authoring.receiverCount === receiverCount &&
        shadow.casterDrawList?.includedDrawCount === includedDrawCount &&
        shadow.rendering?.supported === supported
      );
    },
    expected,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  if (status === undefined) {
    throw new Error("GLB viewer shadow control status did not publish.");
  }

  return status;
}

async function waitForIblControlStatus(
  page: Page,
  expected: {
    readonly enabled: boolean;
    readonly supported: boolean;
    readonly environmentMapKey: string | null;
    readonly intensity: number;
  },
): Promise<GlbViewerStatus> {
  await page.waitForFunction(
    ({ enabled, supported, environmentMapKey, intensity }) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly ibl?: {
              readonly enabled?: boolean;
              readonly controls?: {
                readonly enabled?: boolean;
                readonly available?: boolean;
              };
              readonly ecs?: {
                readonly environmentMapKey?: string | null;
                readonly intensity?: number | null;
              };
              readonly rendering?: {
                readonly supported?: boolean;
              };
            };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      const ibl = status?.ibl;

      return (
        ibl?.enabled === enabled &&
        ibl.controls?.enabled === enabled &&
        ibl.controls.available === true &&
        ibl.ecs?.environmentMapKey === environmentMapKey &&
        Math.abs((ibl.ecs.intensity ?? Number.NaN) - intensity) < 0.001 &&
        ibl.rendering?.supported === supported
      );
    },
    expected,
    { timeout: 5000 },
  );

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  if (status === undefined) {
    throw new Error("GLB viewer IBL control status did not publish.");
  }

  return status;
}

function routedPipelineKeys(status: GlbViewerStatus | undefined): string[] {
  const routed = (
    status as
      | (GlbViewerStatus & {
          readonly report?: {
            readonly diagnosticsSummary?: {
              readonly routedResourceSet?: {
                readonly byPipeline?: readonly {
                  readonly pipelineKey?: string;
                }[];
              };
            };
          };
        })
      | undefined
  )?.report?.diagnosticsSummary?.routedResourceSet?.byPipeline;

  return Array.isArray(routed)
    ? routed.flatMap((entry) =>
        typeof entry.pipelineKey === "string" ? [entry.pipelineKey] : [],
      )
    : [];
}

function strongestSample(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
): ReturnType<typeof readPngPixel> {
  let best = readPngPixel(screenshot, 0.5, 0.5);
  let bestDistance = pixelDistance(best, clear);

  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const sample = readPngPixel(
        screenshot,
        0.35 + (0.3 * x) / 6,
        0.3 + (0.4 * y) / 6,
      );
      const distance = pixelDistance(sample, clear);

      if (distance > bestDistance) {
        best = sample;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function strongestNearCenterSample(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
): ReturnType<typeof readPngPixel> {
  let best = readPngPixel(screenshot, 0.5, 0.5);
  let bestDistance = pixelDistance(best, clear);

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const sample = readPngPixel(
        screenshot,
        0.43 + (0.14 * x) / 4,
        0.43 + (0.14 * y) / 4,
      );
      const distance = pixelDistance(sample, clear);

      if (distance > bestDistance) {
        best = sample;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function visibleSampleColorSpread(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
): number {
  const visibleSamples: ReturnType<typeof readPngPixel>[] = [];

  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const sample = readPngPixel(
        screenshot,
        0.3 + (0.4 * x) / 6,
        0.28 + (0.44 * y) / 6,
      );

      if (pixelDistance(sample, clear) > 20) {
        visibleSamples.push(sample);
      }
    }
  }

  let spread = 0;

  for (const a of visibleSamples) {
    for (const b of visibleSamples) {
      spread = Math.max(spread, pixelDistance(a, b));
    }
  }

  return spread;
}

function strongestRegionSample(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ReturnType<typeof readPngPixel> {
  let best = readPngPixel(screenshot, (minX + maxX) / 2, (minY + maxY) / 2);
  let bestDistance = pixelDistance(best, clear);

  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      const sample = readPngPixel(
        screenshot,
        minX + ((maxX - minX) * x) / 5,
        minY + ((maxY - minY) * y) / 5,
      );
      const distance = pixelDistance(sample, clear);

      if (distance > bestDistance) {
        best = sample;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function glbViewerFloorShadowRegion() {
  return {
    minX: 0.36,
    maxX: 0.64,
    minY: 0.58,
    maxY: 0.82,
  };
}

function glbViewerModelRegion() {
  return {
    minX: 0.34,
    maxX: 0.66,
    minY: 0.3,
    maxY: 0.62,
  };
}

function averageRegionLuminance(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
  region: ReturnType<typeof glbViewerFloorShadowRegion>,
) {
  let total = 0;
  let visibleSamples = 0;

  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      const sample = readPngPixel(
        screenshot,
        region.minX + ((region.maxX - region.minX) * x) / 5,
        region.minY + ((region.maxY - region.minY) * y) / 5,
      );

      if (pixelDistance(sample, clear) <= 18) {
        continue;
      }

      visibleSamples += 1;
      total += luminance(sample);
    }
  }

  return {
    average: visibleSamples === 0 ? 0 : total / visibleSamples,
    visibleSamples,
  };
}

function maxRegionLuminanceDelta(
  before: Buffer,
  after: Buffer,
  region: ReturnType<typeof glbViewerFloorShadowRegion>,
): number {
  let maxDelta = 0;

  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      const xRatio = region.minX + ((region.maxX - region.minX) * x) / 5;
      const yRatio = region.minY + ((region.maxY - region.minY) * y) / 5;

      maxDelta = Math.max(
        maxDelta,
        Math.abs(
          luminance(readPngPixel(before, xRatio, yRatio)) -
            luminance(readPngPixel(after, xRatio, yRatio)),
        ),
      );
    }
  }

  return maxDelta;
}

function luminance(sample: ReturnType<typeof readPngPixel>): number {
  return sample.r * 0.2126 + sample.g * 0.7152 + sample.b * 0.0722;
}

function maxSampleDelta(before: Buffer, after: Buffer): number {
  let maxDelta = 0;

  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const xRatio = 0.35 + (0.3 * x) / 6;
      const yRatio = 0.3 + (0.4 * y) / 6;

      maxDelta = Math.max(
        maxDelta,
        pixelDistance(
          readPngPixel(before, xRatio, yRatio),
          readPngPixel(after, xRatio, yRatio),
        ),
      );
    }
  }

  return maxDelta;
}
