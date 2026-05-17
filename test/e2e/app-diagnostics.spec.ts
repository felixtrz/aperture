import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface AppDiagnosticsStatus extends ExampleStatusBase {
  readonly diagnosticOnly?: boolean;
  readonly diagnosticCodes?: readonly string[];
  readonly clearColor?: unknown;
  readonly scenarios?: {
    readonly mixedMaterials?: AppDiagnosticScenarioStatus;
    readonly materialDependencies?: AppDiagnosticScenarioStatus;
    readonly standardMaterialDependencies?: AppDiagnosticScenarioStatus;
    readonly mixedMaterialSuccess?: AppDiagnosticScenarioStatus;
  };
  readonly textureFidelitySummary?: AppDiagnosticTextureFidelitySummary;
  readonly samplerFidelitySummary?: AppDiagnosticSamplerFidelitySummary;
}

interface AppDiagnosticScenarioStatus {
  readonly caseId: string;
  readonly ok: boolean;
  readonly expectedFailure: boolean;
  readonly expectedDiagnostic?: string;
  readonly submitted: boolean;
  readonly dependencySummary?: AppDiagnosticDependencySummary;
  readonly failedMaterialKind?: string;
  readonly failedMaterialKey?: string;
  readonly failedDependencyFields?: readonly string[];
  readonly failedResourceKeys?: readonly string[];
  readonly diagnosticCodes: readonly string[];
  readonly message: string;
  readonly preparedResourceSummary?: AppDiagnosticPreparedResourceSummary;
  readonly preparedLifetimeSummary?: AppDiagnosticPreparedLifetimeSummary;
  readonly report: {
    readonly ok: boolean;
    readonly counts: {
      readonly meshDraws: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
    readonly diagnostics: readonly {
      readonly code?: string;
      readonly message?: string;
    }[];
    readonly materialDependencyReadiness?: readonly unknown[];
  };
}

interface AppDiagnosticDependencySummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
  readonly byMaterialKind: readonly {
    readonly materialKind: string;
    readonly materialCount: number;
    readonly readyMaterialCount: number;
    readonly blockedMaterialCount: number;
  }[];
  readonly byDependencyKind: readonly {
    readonly dependencyKind: string;
    readonly slotCount: number;
    readonly readySlotCount: number;
    readonly blockedSlotCount: number;
  }[];
  readonly byStatus: readonly {
    readonly status: string;
    readonly slotCount: number;
  }[];
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}

interface AppDiagnosticTextureFidelitySummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
  readonly byField: readonly {
    readonly field: string;
    readonly slotCount: number;
    readonly readySlotCount: number;
    readonly blockedSlotCount: number;
  }[];
  readonly byIssue: readonly {
    readonly code: string;
    readonly count: number;
  }[];
  readonly samplerIssueCount: number;
  readonly colorSpaceIssueCount: number;
  readonly semanticIssueCount: number;
  readonly texCoordIssueCount: number;
  readonly transformIssueCount: number;
}

interface AppDiagnosticSamplerFidelitySummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly warningCount: number;
  readonly byField: readonly {
    readonly field: string;
    readonly slotCount: number;
    readonly warningCount: number;
  }[];
  readonly byIssue: readonly {
    readonly code: string;
    readonly count: number;
  }[];
  readonly mipmapIssueCount: number;
  readonly lodIssueCount: number;
  readonly anisotropyIssueCount: number;
}

interface AppDiagnosticPreparedResourceSummary {
  readonly preparedMeshes: { readonly totalEntries: number };
  readonly preparedMaterials: {
    readonly totalEntries: number;
    readonly families: Record<string, { readonly entries: number }>;
  };
  readonly bindings: {
    readonly meshes: { readonly present: boolean };
    readonly materials: { readonly present: boolean };
  };
  readonly drawReadiness: {
    readonly present: boolean;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly diagnostics: {
    readonly total: number;
    readonly warnings: number;
    readonly errors: number;
  };
}

interface AppDiagnosticPreparedLifetimeSummary {
  readonly facade: {
    readonly preparedMeshes: number;
    readonly preparedMaterials: number;
    readonly readyDraws: number;
    readonly blockedDraws: number;
  };
  readonly backend: {
    readonly meshResources: number;
    readonly materialBuffers: number;
    readonly staleResources: number;
    readonly missingResources: number;
    readonly pendingDestroyResources: number;
  };
  readonly diagnostics: readonly unknown[];
}

test("app diagnostics example exposes app-facade failure reports", async ({
  page,
}) => {
  await page.goto("/examples/app-diagnostics.html");

  const status = await waitForExampleStatus<AppDiagnosticsStatus>(page);

  await attachExampleStatus("app-diagnostics-status", status);
  expect(status, "app diagnostics status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "app-diagnostics",
    diagnosticOnly: true,
    ok: true,
    phase: "diagnostics-ready",
    renderingBackend: "webgpu-explicit",
  });

  const mixed = status.scenarios?.mixedMaterials;
  const dependencies = status.scenarios?.materialDependencies;
  const standardDependencies = status.scenarios?.standardMaterialDependencies;
  const success = status.scenarios?.mixedMaterialSuccess;

  expect(mixed, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "mixed-materials",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    submitted: false,
    failedMaterialKind: "matcap",
    report: {
      ok: false,
      counts: { meshDraws: 2, drawCalls: 0 },
    },
  });
  expect(mixed?.diagnosticCodes).toContain(
    "webGpuApp.materialDependenciesNotReady",
  );
  expect(mixed?.diagnosticCodes).not.toContain(
    "webGpuApp.additionalDrawResourceUnsupported",
  );
  expect(mixed?.failedResourceKeys).toEqual(
    expect.arrayContaining([
      "texture:diagnostic-missing-matcap",
      "sampler:diagnostic-loading-matcap",
    ]),
  );
  expectDependencySummary(mixed?.dependencySummary, "matcap");
  expectDependencySummaryOmitsHandles(mixed?.dependencySummary, [
    "diagnostic-missing-matcap",
    "diagnostic-loading-matcap",
  ]);
  expect(mixed?.message).toContain("source asset dependencies");

  expect(dependencies, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "material-dependencies",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    report: {
      ok: false,
      counts: { meshDraws: 0, drawCalls: 0 },
    },
  });
  expect(dependencies?.diagnosticCodes).toEqual(
    expect.arrayContaining([
      "render.texture.missing",
      "render.sampler.loading",
      "webGpuApp.materialDependenciesNotReady",
      "webGpuApp.emptySnapshot",
    ]),
  );
  expect(dependencies?.message).toContain("source asset dependencies");
  expect(dependencies?.report.materialDependencyReadiness).toHaveLength(1);
  expectDependencySummary(dependencies?.dependencySummary, "unlit");
  expectDependencySummaryOmitsHandles(dependencies?.dependencySummary, [
    "dependency-missing-texture",
    "dependency-loading-sampler",
  ]);

  expect(standardDependencies, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "standard-material-dependencies",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    submitted: false,
    failedMaterialKind: "standard",
    report: {
      ok: false,
      counts: { meshDraws: 1, drawCalls: 0 },
    },
  });
  expect(standardDependencies?.diagnosticCodes).toContain(
    "webGpuApp.materialDependenciesNotReady",
  );
  expect(standardDependencies?.failedDependencyFields).toEqual([
    "baseColorTexture",
    "baseColorTexture",
  ]);
  expect(standardDependencies?.failedResourceKeys).toEqual(
    expect.arrayContaining([
      "texture:standard-missing-base-color",
      "sampler:standard-loading-base-color",
    ]),
  );
  expect(standardDependencies?.report.materialDependencyReadiness).toHaveLength(
    1,
  );
  expectDependencySummary(standardDependencies?.dependencySummary, "standard");
  expectDependencySummaryOmitsHandles(standardDependencies?.dependencySummary, [
    "standard-missing-base-color",
    "standard-loading-base-color",
  ]);
  expect(standardDependencies?.message).toContain("source asset dependencies");

  expect(success, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "mixed-material-success",
    ok: true,
    expectedFailure: false,
    submitted: true,
    report: {
      ok: true,
      counts: { meshDraws: 2, drawCalls: 2, diagnostics: 0 },
      diagnostics: [],
    },
  });
  expect(success?.diagnosticCodes).toEqual([]);
  expectPreparedResourceSummary(success?.preparedResourceSummary);
  expectPreparedResourceSummaryOmitsHandles(success?.preparedResourceSummary);
  expectPreparedLifetimeSummary(success?.preparedLifetimeSummary);
  expectPreparedLifetimeSummaryOmitsHandles(success?.preparedLifetimeSummary);
  expectTextureFidelitySummary(status.textureFidelitySummary);
  expectTextureFidelitySummaryOmitsHandles(status.textureFidelitySummary);
  expectSamplerFidelitySummary(status.samplerFidelitySummary);
  expectSamplerFidelitySummaryOmitsHandles(status.samplerFidelitySummary);

  await page.waitForTimeout(100);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("app-diagnostics-mixed-success.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleMixedMaterialPixels(screenshot, status);
});

function expectDependencySummary(
  summary: AppDiagnosticDependencySummary | undefined,
  materialKind: string,
): void {
  expect(summary).toMatchObject({
    materialCount: 1,
    readyMaterialCount: 0,
    blockedMaterialCount: 1,
    slotCount: 2,
    readySlotCount: 0,
    blockedSlotCount: 2,
    byMaterialKind: [
      {
        materialKind,
        materialCount: 1,
        readyMaterialCount: 0,
        blockedMaterialCount: 1,
      },
    ],
    byDependencyKind: [
      {
        dependencyKind: "texture",
        slotCount: 1,
        readySlotCount: 0,
        blockedSlotCount: 1,
      },
      {
        dependencyKind: "sampler",
        slotCount: 1,
        readySlotCount: 0,
        blockedSlotCount: 1,
      },
    ],
    byStatus: [
      { status: "missing", slotCount: 1 },
      { status: "loading", slotCount: 1 },
    ],
    diagnostics: {
      total: 2,
      byCode: {
        "materialDependency.dependencyMissing": 1,
        "materialDependency.dependencyLoading": 1,
      },
    },
  });
}

function expectDependencySummaryOmitsHandles(
  summary: AppDiagnosticDependencySummary | undefined,
  substrings: readonly string[],
): void {
  const serialized = JSON.stringify(summary);

  for (const substring of substrings) {
    expect(serialized).not.toContain(substring);
  }
}

function expectTextureFidelitySummary(
  summary: AppDiagnosticTextureFidelitySummary | undefined,
): void {
  expect(summary).toMatchObject({
    materialCount: 1,
    readyMaterialCount: 0,
    blockedMaterialCount: 1,
    slotCount: 5,
    readySlotCount: 0,
    blockedSlotCount: 5,
    samplerIssueCount: 2,
    colorSpaceIssueCount: 1,
    semanticIssueCount: 1,
    texCoordIssueCount: 1,
    transformIssueCount: 1,
  });
  expect(summary?.byField.map((field) => field.field)).toEqual([
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
  ]);
  expect(summary?.byIssue.map((issue) => issue.code)).toEqual([
    "standardMaterialTexture.invalidColorSpace",
    "standardMaterialTexture.invalidSemantic",
    "standardMaterialTexture.missingSamplerHandle",
    "standardMaterialTexture.samplerNotReady",
    "standardMaterialTexture.unsupportedTexCoord",
    "standardMaterialTexture.unsupportedTextureTransform",
  ]);
}

function expectTextureFidelitySummaryOmitsHandles(
  summary: AppDiagnosticTextureFidelitySummary | undefined,
): void {
  const serialized = JSON.stringify(summary);

  for (const substring of [
    "example-standard-texture-fidelity",
    "example-base",
    "example-normal",
    "example-emissive",
    "sampler:",
    "GPU",
  ]) {
    expect(serialized).not.toContain(substring);
  }
}

function expectSamplerFidelitySummary(
  summary: AppDiagnosticSamplerFidelitySummary | undefined,
): void {
  expect(summary).toMatchObject({
    materialCount: 1,
    readyMaterialCount: 1,
    blockedMaterialCount: 0,
    slotCount: 2,
    warningCount: 3,
    mipmapIssueCount: 1,
    lodIssueCount: 1,
    anisotropyIssueCount: 1,
  });
  expect(summary?.byField).toEqual([
    { field: "baseColorTexture", slotCount: 1, warningCount: 2 },
    { field: "normalTexture", slotCount: 1, warningCount: 1 },
  ]);
  expect(summary?.byIssue.map((issue) => issue.code)).toEqual([
    "standardMaterialSampler.anisotropyNotReported",
    "standardMaterialSampler.lodMaxExceedsMipRange",
    "standardMaterialSampler.mipmapFilterWithoutMips",
  ]);
}

function expectSamplerFidelitySummaryOmitsHandles(
  summary: AppDiagnosticSamplerFidelitySummary | undefined,
): void {
  const serialized = JSON.stringify(summary);

  for (const substring of [
    "example-standard-sampler-fidelity",
    "texture:",
    "sampler:",
    "GPU",
  ]) {
    expect(serialized).not.toContain(substring);
  }
}

function expectPreparedResourceSummary(
  summary: AppDiagnosticPreparedResourceSummary | undefined,
): void {
  expect(summary).toMatchObject({
    preparedMeshes: { totalEntries: 1 },
    preparedMaterials: {
      totalEntries: 2,
      families: {
        unlit: { entries: 1 },
        matcap: { entries: 1 },
        standard: { entries: 0 },
      },
    },
    bindings: {
      meshes: { present: false },
      materials: { present: false },
    },
    drawReadiness: {
      present: true,
      ready: 2,
      blocked: 0,
    },
    diagnostics: {
      total: 0,
      warnings: 0,
      errors: 0,
    },
  });
}

function expectPreparedResourceSummaryOmitsHandles(
  summary: AppDiagnosticPreparedResourceSummary | undefined,
): void {
  const serialized = JSON.stringify(summary);

  for (const substring of [
    "diagnostic-mixed-success-cube",
    "diagnostic-success-unlit",
    "diagnostic-success-matcap",
    "GPU",
  ]) {
    expect(serialized).not.toContain(substring);
  }
}

function expectPreparedLifetimeSummary(
  summary: AppDiagnosticPreparedLifetimeSummary | undefined,
): void {
  expect(summary).toEqual({
    facade: {
      preparedMeshes: 1,
      preparedMaterials: 2,
      readyDraws: 2,
      blockedDraws: 0,
    },
    backend: {
      meshResources: 1,
      materialBuffers: 2,
      staleResources: 0,
      missingResources: 0,
      pendingDestroyResources: 0,
    },
    diagnostics: [],
  });
}

function expectPreparedLifetimeSummaryOmitsHandles(
  summary: AppDiagnosticPreparedLifetimeSummary | undefined,
): void {
  const serialized = JSON.stringify(summary);

  for (const substring of [
    "diagnostic-mixed-success-cube",
    "diagnostic-success-unlit",
    "diagnostic-success-matcap",
    "GPU",
  ]) {
    expect(serialized).not.toContain(substring);
  }
}

function expectVisibleMixedMaterialPixels(
  screenshot: Buffer,
  status: AppDiagnosticsStatus,
): void {
  const clear =
    status.clearColor !== undefined &&
    typeof status.clearColor === "object" &&
    status.clearColor !== null
      ? rgbaColorToPixel(
          status.clearColor as { r: number; g: number; b: number; a: number },
        )
      : { r: 5, g: 6, b: 8, a: 255 };
  const samples = [
    strongestRegionSample(screenshot, 0.25, 0.34, 0.46, 0.66, clear),
    strongestRegionSample(screenshot, 0.54, 0.34, 0.75, 0.66, clear),
  ];

  for (const sample of samples) {
    expect(
      pixelDistance(sample, clear),
      `mixed material success should leave non-background pixels; sample=${JSON.stringify(
        sample,
      )} clear=${JSON.stringify(clear)}`,
    ).toBeGreaterThan(30);
  }
}

function strongestRegionSample(
  screenshot: Buffer,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  clear: ReturnType<typeof readPngPixel>,
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
