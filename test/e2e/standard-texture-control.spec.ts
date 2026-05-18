import { expect, test, type Page } from "@playwright/test";

import {
  pixelDistance,
  readPngPixel,
  rgbaColorToPixel,
  type RgbaPixel,
} from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase, RgbaTuple } from "./example-status-types.js";
import type { SceneReadbackStatus } from "./example-status-types.js";

const missingTextureScenario = "missing-texture";
const blockedTextureScenarios = [
  {
    scenario: missingTextureScenario,
    expectedStatus: "missing",
    attachmentName: "standard-texture-control-missing-texture-status",
  },
  {
    scenario: "loading-texture",
    expectedStatus: "loading",
    attachmentName: "standard-texture-control-loading-texture-status",
  },
  {
    scenario: "failed-texture",
    expectedStatus: "failed",
    attachmentName: "standard-texture-control-failed-texture-status",
  },
] as const;
type BlockedTextureScenario = (typeof blockedTextureScenarios)[number];

interface StandardTextureControlStatus extends ExampleStatusBase {
  readonly renderingBackend?: string;
  readonly expectedFailure?: boolean;
  readonly expectedDiagnostic?: string;
  readonly expectedTextureStatus?: string;
  readonly diagnosticCodes?: readonly string[];
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly standardTexture?: {
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly textureSlot: string;
    readonly expectedScalarColor: RgbaTuple;
    readonly expectedTextureColor: RgbaTuple;
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
    readonly expectedTexCoord?: number;
    readonly expectedUv1?: {
      readonly u: number;
      readonly v: number;
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
      readonly rejectedNearestColor?: RgbaTuple;
      readonly rejectedClampColor?: RgbaTuple;
    } | null;
    readonly expectedTextureTransform?: {
      readonly offset?: readonly [number, number];
      readonly scale?: readonly [number, number];
      readonly rotation?: number;
    } | null;
    readonly samples: {
      readonly scalar: { readonly x: number; readonly y: number };
      readonly textured: { readonly x: number; readonly y: number };
    };
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
  readonly readback?: SceneReadbackStatus;
}

test("standard texture control renders a distinct base-color textured material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "ready",
    "standard-texture-control-status",
    "standard texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status);
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );

  const standardTexture = requireStandardTextureStatus(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { scalarSample, texturedSample } = readCanvasSamples(
    screenshot,
    standardTexture,
  );
  const expectedTexture = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedTextureColor),
  );
  const expectedScalar = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedScalarColor),
  );

  expect(pixelDistance(texturedSample, expectedTexture)).toBeLessThan(
    pixelDistance(scalarSample, expectedTexture),
  );
  expect(pixelDistance(scalarSample, expectedScalar)).toBeLessThan(
    pixelDistance(texturedSample, expectedScalar),
  );
  expect(pixelDistance(scalarSample, texturedSample)).toBeGreaterThan(40);
  expect(status.readback, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(
      readbackTextured,
      `expected app-facade textured readback sample; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, expectedTexture),
        `textured readback sample should be closer to texture color; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeLessThan(pixelDistance(scalarSample, expectedTexture));
    }
  } else {
    expect(status.readback?.reason, JSON.stringify(status, null, 2)).toEqual(
      expect.any(String),
    );
    expect(status.readback?.message, JSON.stringify(status, null, 2)).toEqual(
      expect.any(String),
    );
  }
  webGpuValidation.expectNoWarnings();
});

test("standard texture control renders a base-color texture through TEXCOORD_1", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "base-color-uv1",
    "standard-texture-control-base-color-uv1-status",
    "base-color UV1 texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status, "base-color-uv1");
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|uv1|opaque|back|less|none",
  );
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
  );
  expect(status.standardTexture).toMatchObject({
    textureSlot: "baseColorTexture",
    expectedTexCoord: 1,
    expectedUv1: {
      u: expect.any(Number),
      v: expect.any(Number),
    },
  });

  const standardTexture = requireStandardTextureStatus(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { scalarSample, texturedSample } = readCanvasSamples(
    screenshot,
    standardTexture,
  );
  const expectedTexture = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedTextureColor),
  );
  const expectedScalar = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedScalarColor),
  );

  expect(pixelDistance(texturedSample, expectedTexture)).toBeLessThan(
    pixelDistance(scalarSample, expectedTexture),
  );
  expect(pixelDistance(scalarSample, expectedScalar)).toBeLessThan(
    pixelDistance(texturedSample, expectedScalar),
  );
  expect(pixelDistance(scalarSample, texturedSample)).toBeGreaterThan(40);

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, expectedTexture),
        `UV1 textured readback sample should resolve the UV1 texel; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeLessThan(pixelDistance(scalarSample, expectedTexture));
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard texture control renders a base-color texture with linear sampling", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "base-color-linear-sampler",
    "standard-texture-control-base-color-linear-sampler-status",
    "base-color linear sampler texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status, "base-color-linear-sampler");
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );
  expect(status.pipelines?.keys).not.toContain(
    "standard|baseColorTexture|linear|opaque|back|less|none",
  );
  expect(status.standardTexture).toMatchObject({
    textureSlot: "baseColorTexture",
    expectedSampler: {
      magFilter: "linear",
      minFilter: "linear",
      expectedColor: expect.any(Array),
      rejectedNearestColor: expect.any(Array),
    },
  });

  const standardTexture = requireStandardTextureStatus(status);

  if (
    standardTexture.expectedSampler === undefined ||
    standardTexture.expectedSampler === null ||
    standardTexture.expectedSampler.rejectedNearestColor === undefined
  ) {
    throw new Error("standard sampler texture status is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { texturedSample } = readCanvasSamples(screenshot, standardTexture);
  const expectedLinear = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedSampler.expectedColor),
  );
  const rejectedNearest = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedSampler.rejectedNearestColor),
  );

  expect(pixelDistance(texturedSample, expectedLinear)).toBeLessThan(
    pixelDistance(texturedSample, rejectedNearest),
  );

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, expectedLinear),
        `linear sampler readback sample should resolve the blended texel; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeLessThan(pixelDistance(readbackTextured.pixel, rejectedNearest));
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard texture control renders a base-color texture with repeat sampler addressing", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "base-color-repeat-sampler",
    "standard-texture-control-base-color-repeat-sampler-status",
    "base-color repeat sampler texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status, "base-color-repeat-sampler");
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );
  expect(status.pipelines?.keys).not.toContain(
    "standard|baseColorTexture|repeat|opaque|back|less|none",
  );
  expect(status.standardTexture).toMatchObject({
    textureSlot: "baseColorTexture",
    expectedSampler: {
      addressModeU: "repeat",
      addressModeV: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      sampleUv: {
        u: expect.any(Number),
        v: expect.any(Number),
      },
      expectedColor: expect.any(Array),
      rejectedClampColor: expect.any(Array),
    },
  });

  const standardTexture = requireStandardTextureStatus(status);

  if (
    standardTexture.expectedSampler === undefined ||
    standardTexture.expectedSampler === null ||
    standardTexture.expectedSampler.rejectedClampColor === undefined
  ) {
    throw new Error("standard repeat sampler texture status is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { texturedSample } = readCanvasSamples(screenshot, standardTexture);
  const expectedRepeat = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedSampler.expectedColor),
  );
  const rejectedClamp = rgbaColorToPixel(
    rgbaTupleToColor(standardTexture.expectedSampler.rejectedClampColor),
  );

  expect(pixelDistance(texturedSample, expectedRepeat)).toBeLessThan(
    pixelDistance(texturedSample, rejectedClamp),
  );

  if (status.readback?.ok) {
    const readbackTextured = status.readback.samples.find(
      (sample) => sample.id === "textured",
    );

    expect(readbackTextured).toBeDefined();

    if (readbackTextured !== undefined) {
      expect(
        pixelDistance(readbackTextured.pixel, expectedRepeat),
        `repeat sampler readback sample should resolve the wrapped texel; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeLessThan(pixelDistance(readbackTextured.pixel, rejectedClamp));
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard texture control renders a distinct normal-mapped material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "normal-map",
    "standard-texture-control-normal-map-status",
    "normal-map texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status, "normal-map");
  expect(status.pipelines?.keys).toContain(
    "standard|normalTexture|opaque|back|less|none",
  );
  expect(status.pipelines?.meshLayoutKeys).toContain(
    "POSITION,NORMAL,TEXCOORD_0,TANGENT",
  );
  expect(status.standardTexture).toMatchObject({
    textureSlot: "normalTexture",
    expectedNormalMap: {
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    },
  });

  const standardTexture = requireStandardTextureStatus(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { scalarSample, texturedSample } = readCanvasSamples(
    screenshot,
    standardTexture,
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
        `normal-map readback samples should differ; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(12);
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard texture control renders a darker occlusion-textured material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "occlusion",
    "standard-texture-control-occlusion-status",
    "occlusion texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status, "occlusion");
  expect(status.pipelines?.keys).toContain(
    "standard|occlusionTexture|opaque|back|less|none",
  );
  expect(status.standardTexture).toMatchObject({
    textureSlot: "occlusionTexture",
    expectedOcclusion: {
      red: expect.any(Number),
      strength: 1,
    },
  });

  const standardTexture = requireStandardTextureStatus(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { scalarSample, texturedSample } = readCanvasSamples(
    screenshot,
    standardTexture,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(scalarSample, clear)).toBeGreaterThan(30);
  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(10);
  expect(luminance(scalarSample) - luminance(texturedSample)).toBeGreaterThan(
    40,
  );

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
        luminance(readbackScalar.pixel) - luminance(readbackTextured.pixel),
        `occlusion readback textured sample should be darker; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(40);
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard texture control renders a brighter emissive-textured material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "emissive",
    "standard-texture-control-emissive-status",
    "emissive texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status, "emissive");
  expect(status.pipelines?.keys).toContain(
    "standard|emissiveTexture|opaque|back|less|none",
  );
  expect(status.standardTexture).toMatchObject({
    textureSlot: "emissiveTexture",
    expectedEmissive: {
      factor: expect.any(Array),
      color: expect.any(Array),
    },
  });

  const standardTexture = requireStandardTextureStatus(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { scalarSample, texturedSample } = readCanvasSamples(
    screenshot,
    standardTexture,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(scalarSample, clear)).toBeGreaterThan(5);
  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(40);
  expect(luminance(texturedSample) - luminance(scalarSample)).toBeGreaterThan(
    40,
  );

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
        luminance(readbackTextured.pixel) - luminance(readbackScalar.pixel),
        `emissive readback textured sample should be brighter; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(40);
    }
  }

  webGpuValidation.expectNoWarnings();
});

test("standard texture control renders a distinct metallic-roughness textured material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  const status = await loadStandardTextureControlStatus(
    page,
    "metallic-roughness",
    "standard-texture-control-metallic-roughness-status",
    "metallic-roughness texture control status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectRenderedStandardTextureStatus(status, "metallic-roughness");
  expect(status.pipelines?.keys).toContain(
    "standard|metallicRoughnessTexture|opaque|back|less|none",
  );
  expect(status.standardTexture).toMatchObject({
    textureSlot: "metallicRoughnessTexture",
    expectedMetallicRoughness: {
      metallic: expect.any(Number),
      roughness: expect.any(Number),
    },
  });

  const standardTexture = requireStandardTextureStatus(status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const { scalarSample, texturedSample } = readCanvasSamples(
    screenshot,
    standardTexture,
  );
  const clear = rgbaColorToPixel({
    r: status.clearColor?.r ?? 0,
    g: status.clearColor?.g ?? 0,
    b: status.clearColor?.b ?? 0,
    a: status.clearColor?.a ?? 1,
  });

  expect(pixelDistance(scalarSample, clear)).toBeGreaterThan(30);
  expect(pixelDistance(texturedSample, clear)).toBeGreaterThan(30);
  expect(pixelDistance(scalarSample, texturedSample)).toBeGreaterThan(18);

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
        `metallic-roughness readback samples should differ; status=${JSON.stringify(
          status,
          null,
          2,
        )}`,
      ).toBeGreaterThan(18);
    }
  }

  webGpuValidation.expectNoWarnings();
});

for (const fixture of blockedTextureScenarios) {
  test(`standard texture control reports ${fixture.expectedStatus} base-color texture without submitting draws`, async ({
    page,
  }) => {
    const status = await loadStandardTextureControlStatus(
      page,
      fixture.scenario,
      fixture.attachmentName,
      `${fixture.expectedStatus} texture status should publish`,
    );

    if (status === undefined) {
      return;
    }

    expectBlockedTextureFailureStatus(status, fixture);
  });
}

test("standard texture control reports normal maps without tangents before submitting draws", async ({
  page,
}) => {
  const status = await loadStandardTextureControlStatus(
    page,
    "normal-map-missing-tangents",
    "standard-texture-control-normal-map-missing-tangents-status",
    "normal-map missing-tangents status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectExpectedFailureStatus(status, {
    scenario: "normal-map-missing-tangents",
    expectedDiagnostic: "render.standardNormalMap.missingTangents",
    expectedTextureStatus: "missing-tangents",
    expectedMeshDraws: 0,
    expectedDiagnostics: 2,
  });
  expect(status.standardTexture).toMatchObject({
    textureSlot: "normalTexture",
    expectedNormalMap: {
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    },
  });
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  expect(status.diagnosticCodes).toContain(
    "render.standardNormalMap.missingTangents",
  );
});

test("standard texture control reports base-color texture transforms before submitting draws", async ({
  page,
}) => {
  const status = await loadStandardTextureControlStatus(
    page,
    "base-color-transform",
    "standard-texture-control-base-color-transform-status",
    "base-color transform status should publish",
  );

  if (status === undefined) {
    return;
  }

  expectExpectedFailureStatus(status, {
    scenario: "base-color-transform",
    expectedDiagnostic:
      "render.standardMaterialTexture.unsupportedTextureTransform",
    expectedTextureStatus: "unsupported-transform",
    expectedMeshDraws: 0,
    expectedDiagnostics: 2,
  });
  expect(status.standardTexture).toMatchObject({
    textureSlot: "baseColorTexture",
    expectedTextureTransform: {
      offset: [expect.any(Number), expect.any(Number)],
    },
  });
  expect(status.pipelines?.keys ?? []).toEqual([]);
  expect(status.pipelines?.meshLayoutKeys ?? []).toEqual([]);
  expect(status.diagnosticCodes).toContain(
    "render.standardMaterialTexture.unsupportedTextureTransform",
  );
});

async function loadStandardTextureControlStatus(
  page: Page,
  scenario: string,
  attachmentName: string,
  message: string,
): Promise<StandardTextureControlStatus | undefined> {
  const query = scenario === "ready" ? "" : `?scenario=${scenario}`;

  await page.goto(`/examples/standard-texture-control.html${query}`);

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(attachmentName, status);
  expect(status, message).toBeDefined();

  if (status === undefined) {
    return undefined;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);

  return status;
}

function expectRenderedStandardTextureStatus(
  status: StandardTextureControlStatus,
  scenario?: string,
): void {
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    ...(scenario === undefined ? {} : { scenario }),
    ok: true,
    phase: "rendered",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 2, lights: 2, diagnostics: 0 },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 2,
    },
    draw: { packages: 2, drawCalls: 2 },
  });
}

function expectBlockedTextureFailureStatus(
  status: StandardTextureControlStatus,
  fixture: BlockedTextureScenario,
): void {
  expectExpectedFailureStatus(status, {
    scenario: fixture.scenario,
    expectedDiagnostic: "render.standardMaterialTexture.textureNotReady",
    expectedTextureStatus: fixture.expectedStatus,
    expectedMeshDraws: 1,
    expectedDiagnostics: 1,
  });
}

function expectExpectedFailureStatus(
  status: StandardTextureControlStatus,
  options: {
    readonly scenario: string;
    readonly expectedDiagnostic: string;
    readonly expectedTextureStatus: string;
    readonly expectedMeshDraws: number;
    readonly expectedDiagnostics: number;
  },
): void {
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: options.scenario,
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedDiagnostic: options.expectedDiagnostic,
    expectedTextureStatus: options.expectedTextureStatus,
    extraction: {
      views: 1,
      meshDraws: options.expectedMeshDraws,
      lights: 2,
      diagnostics: options.expectedDiagnostics,
    },
    draw: { drawCalls: 0 },
  });
  expect(status.diagnosticCodes).toContain(options.expectedDiagnostic);
}

function requireStandardTextureStatus(
  status: StandardTextureControlStatus,
): NonNullable<StandardTextureControlStatus["standardTexture"]> {
  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
  }

  return status.standardTexture;
}

function readCanvasSamples(
  screenshot: Buffer,
  standardTexture: NonNullable<StandardTextureControlStatus["standardTexture"]>,
): {
  readonly scalarSample: RgbaPixel;
  readonly texturedSample: RgbaPixel;
} {
  return {
    scalarSample: readPngPixel(
      screenshot,
      standardTexture.samples.scalar.x,
      standardTexture.samples.scalar.y,
    ),
    texturedSample: readPngPixel(
      screenshot,
      standardTexture.samples.textured.x,
      standardTexture.samples.textured.y,
    ),
  };
}

function rgbaTupleToColor(color: RgbaTuple): {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
} {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
