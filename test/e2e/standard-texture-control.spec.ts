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
      readonly magFilter: string;
      readonly minFilter: string;
      readonly expectedColor: RgbaTuple;
      readonly rejectedNearestColor: RgbaTuple;
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

  await page.goto("/examples/standard-texture-control.html");

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus("standard-texture-control-status", status);
  expect(
    status,
    "standard texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
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
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );

  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
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
  const expectedTexture = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedTextureColor),
  );
  const expectedScalar = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedScalarColor),
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

  await page.goto(
    "/examples/standard-texture-control.html?scenario=base-color-uv1",
  );

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-base-color-uv1-status",
    status,
  );
  expect(
    status,
    "base-color UV1 texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "base-color-uv1",
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

  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
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
  const expectedTexture = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedTextureColor),
  );
  const expectedScalar = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedScalarColor),
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

  await page.goto(
    "/examples/standard-texture-control.html?scenario=base-color-linear-sampler",
  );

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-base-color-linear-sampler-status",
    status,
  );
  expect(
    status,
    "base-color linear sampler texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "base-color-linear-sampler",
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

  if (
    status.standardTexture === undefined ||
    status.standardTexture.expectedSampler === undefined ||
    status.standardTexture.expectedSampler === null
  ) {
    throw new Error("standard sampler texture status is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const texturedSample = readPngPixel(
    screenshot,
    status.standardTexture.samples.textured.x,
    status.standardTexture.samples.textured.y,
  );
  const expectedLinear = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedSampler.expectedColor),
  );
  const rejectedNearest = rgbaColorToPixel(
    rgbaTupleToColor(
      status.standardTexture.expectedSampler.rejectedNearestColor,
    ),
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

test("standard texture control renders a distinct normal-mapped material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/standard-texture-control.html?scenario=normal-map",
  );

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-normal-map-status",
    status,
  );
  expect(
    status,
    "normal-map texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "normal-map",
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

  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
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

  await page.goto("/examples/standard-texture-control.html?scenario=occlusion");

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-occlusion-status",
    status,
  );
  expect(
    status,
    "occlusion texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "occlusion",
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

  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
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

  await page.goto("/examples/standard-texture-control.html?scenario=emissive");

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus("standard-texture-control-emissive-status", status);
  expect(
    status,
    "emissive texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "emissive",
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

  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
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

  await page.goto(
    "/examples/standard-texture-control.html?scenario=metallic-roughness",
  );

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-metallic-roughness-status",
    status,
  );
  expect(
    status,
    "metallic-roughness texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "metallic-roughness",
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

  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
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
    await page.goto(
      `/examples/standard-texture-control.html?scenario=${fixture.scenario}`,
    );

    const status =
      await waitForExampleStatus<StandardTextureControlStatus>(page);

    await attachExampleStatus(fixture.attachmentName, status);
    expect(
      status,
      `${fixture.expectedStatus} texture status should publish`,
    ).toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);
    expectStatusJsonSafeForGpu(status);
    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "standard-texture-control",
      scenario: fixture.scenario,
      ok: true,
      phase: "expected-failure",
      expectedFailure: true,
      expectedDiagnostic: "render.standardMaterialTexture.textureNotReady",
      expectedTextureStatus: fixture.expectedStatus,
      extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 1 },
      draw: { drawCalls: 0 },
    });
    expect(status.diagnosticCodes).toContain(
      "render.standardMaterialTexture.textureNotReady",
    );
  });
}

test("standard texture control reports normal maps without tangents before submitting draws", async ({
  page,
}) => {
  await page.goto(
    "/examples/standard-texture-control.html?scenario=normal-map-missing-tangents",
  );

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-normal-map-missing-tangents-status",
    status,
  );
  expect(
    status,
    "normal-map missing-tangents status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "normal-map-missing-tangents",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedDiagnostic: "render.standardNormalMap.missingTangents",
    expectedTextureStatus: "missing-tangents",
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 2 },
    draw: { drawCalls: 0 },
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
  await page.goto(
    "/examples/standard-texture-control.html?scenario=base-color-transform",
  );

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-base-color-transform-status",
    status,
  );
  expect(status, "base-color transform status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: "base-color-transform",
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedDiagnostic:
      "render.standardMaterialTexture.unsupportedTextureTransform",
    expectedTextureStatus: "unsupported-transform",
    extraction: { views: 1, meshDraws: 0, lights: 2, diagnostics: 2 },
    draw: { drawCalls: 0 },
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
