import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface GlbViewerStatus extends ExampleStatusBase {
  readonly selectedAsset?: {
    readonly id: string;
    readonly label: string;
    readonly source: string;
    readonly url: string;
    readonly loading: boolean;
    readonly materialFamilies: readonly MaterialFamilyStatus[];
  };
  readonly source?: {
    readonly ok: boolean;
    readonly byteLength: number | null;
    readonly status: {
      readonly status: string;
      readonly sourceKind: string;
      readonly diagnostics: readonly unknown[];
    } | null;
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
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly drawCalls: number;
  };
  readonly orbit?: {
    readonly yaw: number;
    readonly distance: number;
    readonly target: readonly number[];
    readonly fit: {
      readonly status: string;
      readonly center: readonly number[];
      readonly size: readonly number[];
      readonly distance: number;
      readonly minDistance: number;
      readonly maxDistance: number;
    };
    readonly dragging: boolean;
  };
  readonly animation?: {
    readonly status: string;
    readonly clipCount: number;
    readonly activeClipName: string | null;
    readonly time: number;
    readonly duration: number;
    readonly channelCount: number;
    readonly animatedNodes: readonly {
      readonly nodeIndex: number;
      readonly entityKey: string;
      readonly path: string;
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
}

interface MaterialFamilyStatus {
  readonly family: string;
  readonly count: number;
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
    "Animated cube",
    "Dual primitive",
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
      distance: expect.any(Number),
      target: expect.any(Array),
      fit: {
        status: "ready",
        center: expect.any(Array),
        size: expect.any(Array),
        distance: expect.any(Number),
        minDistance: expect.any(Number),
        maxDistance: expect.any(Number),
      },
      dragging: false,
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
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.selectedAsset?.id === "brass" &&
        status.selectedAsset.loading === false &&
        status.source?.ok === true &&
        status.extraction?.meshDraws === 1 &&
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
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
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
  ).toContain("standard|opaque|back|less|none");
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

  return orbit as NonNullable<GlbViewerStatus["orbit"]>;
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
