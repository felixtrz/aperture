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
  readonly source?: {
    readonly ok: boolean;
    readonly byteLength: number | null;
    readonly status: {
      readonly status: string;
      readonly sourceKind: string;
      readonly diagnostics: readonly unknown[];
    } | null;
    readonly imageDecode: {
      readonly decoded: readonly {
        readonly imageIndex: number;
        readonly sourceKind: string;
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
      readonly yfov: number;
      readonly aspect: number;
      readonly near: number;
      readonly far: number;
      readonly translation: readonly number[];
      readonly rotation: readonly number[];
    };
    readonly cameras: readonly unknown[];
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
    readonly lights: readonly {
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
    }[];
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
  };
}

interface MaterialFamilyStatus {
  readonly family: string;
  readonly count: number;
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
    "Imported camera",
    "Morph target",
    "Skin metadata",
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
            readonly source?: { readonly ok?: boolean };
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

test("Playwright reports unsupported morph targets while rendering the base GLB mesh", async ({
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
            readonly source?: { readonly ok?: boolean };
            readonly gltf?: {
              readonly metadata?: {
                readonly unsupportedFeatureDiagnostics?: readonly {
                  readonly code?: string;
                  readonly targetCount?: number;
                  readonly primitiveCount?: number;
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
        status?.selectedAsset?.id === "morph-target" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 1 &&
        status.extraction?.meshDraws === 1 &&
        status.gltf?.metadata?.unsupportedFeatureDiagnostics?.some(
          (diagnostic) =>
            diagnostic.code === "gltfMetadata.unsupportedMorphTargets" &&
            diagnostic.targetCount === 2 &&
            diagnostic.primitiveCount === 1,
        ) === true
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
      materialFamilies: [{ family: "unlit", count: 1 }],
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
          used: ["KHR_materials_unlit"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [
          {
            code: "gltfMetadata.unsupportedMorphTargets",
            severity: "warning",
            count: 2,
            targetCount: 2,
            primitiveCount: 1,
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
    `morph target base mesh should still render visible pixels; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports unsupported skinning while rendering the base GLB mesh", async ({
  page,
}) => {
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
                readonly unsupportedFeatureDiagnostics?: readonly {
                  readonly code?: string;
                  readonly skinCount?: number;
                  readonly jointCount?: number;
                  readonly inverseBindMatrixCount?: number;
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
        status?.selectedAsset?.id === "skinning" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.gltf?.primitiveMaterials?.resolved === 1 &&
        status.extraction?.meshDraws === 1 &&
        status.gltf?.metadata?.unsupportedFeatureDiagnostics?.some(
          (diagnostic) =>
            diagnostic.code === "gltfMetadata.unsupportedSkins" &&
            diagnostic.skinCount === 1 &&
            diagnostic.jointCount === 2 &&
            diagnostic.inverseBindMatrixCount === 2,
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
      label: "Skin metadata",
      source: "sample",
      url: "/examples/assets/skinning.glb",
      loading: false,
      materialFamilies: [{ family: "unlit", count: 1 }],
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
          used: ["KHR_materials_unlit"],
          required: [],
        },
        unsupportedFeatureDiagnostics: [
          {
            code: "gltfMetadata.unsupportedSkins",
            severity: "warning",
            count: 1,
            skinCount: 1,
            jointCount: 2,
            inverseBindMatrixCount: 2,
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
    `skinning base mesh should still render visible pixels; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);
  webGpuValidation.expectNoWarnings();
});

test("Playwright reports an unsupported orthographic imported camera while rendering with the fitted orbit camera", async ({
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
              readonly selected?: unknown;
              readonly cameras?: readonly {
                readonly status?: string;
                readonly reason?: string;
              }[];
            };
            readonly extraction?: { readonly meshDraws?: number };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        (status?.frame ?? 0) >= 3 &&
        status?.selectedAsset?.id === "orthographic-camera" &&
        status.selectedAsset.loading === false &&
        status.importedCamera?.status === "unsupported" &&
        status.importedCamera.controls?.available === false &&
        status.importedCamera.controls.enabled === false &&
        status.importedCamera.selected === null &&
        status.importedCamera.cameras?.some(
          (camera) =>
            camera.status === "unsupported" &&
            camera.reason === "orthographic-camera",
        ) === true &&
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
      status: "unsupported",
      controls: {
        available: false,
        enabled: false,
      },
      selected: null,
      cameras: [
        {
          status: "unsupported",
          supported: false,
          nodeIndex: 1,
          cameraIndex: 0,
          entityKey: expect.stringMatching(
            /^viewer-orthographic-camera-\d+:node:1$/,
          ),
          name: "UnsupportedOrthoCamera",
          nodeName: "UnsupportedOrthographicCameraNode",
          cameraName: "UnsupportedOrthoCamera",
          projection: "orthographic",
          reason: "orthographic-camera",
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
    `orthographic-camera base mesh should render through the fitted orbit camera; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);
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

async function loadNormalMapViewerSample(page: Page): Promise<GlbViewerStatus> {
  await page.goto("/examples/glb-viewer.html?asset=normal-map");
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
        status?.selectedAsset?.id === "normal-map" &&
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
    undefined,
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
