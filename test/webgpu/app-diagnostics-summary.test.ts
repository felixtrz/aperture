import { describe, expect, it } from "vitest";

import type { MaterialQueuePhaseSummary } from "@aperture-engine/render";
import {
  collectWebGpuAppMaterialDependencyReadiness,
  collectWebGpuAppMaterialQueueRouteReport,
  createQueuedMaterialFrameResourceSetSummary,
  createWebGpuAppDiagnosticsSummary,
  type QueuedMaterialFrameResourceSetSummary,
  type RenderFrameQueueDiagnosticsSummary,
} from "@aperture-engine/webgpu";

describe("WebGPU app diagnostics summary", () => {
  it("summarizes empty diagnostic groups", () => {
    expect(createWebGpuAppDiagnosticsSummary({})).toEqual({
      sectionCount: 0,
    });
  });

  it("summarizes partial diagnostic groups", () => {
    const materialQueue = materialQueueSummary();

    expect(createWebGpuAppDiagnosticsSummary({ materialQueue })).toEqual({
      sectionCount: 1,
      materialQueue,
    });
  });

  it("summarizes full diagnostic groups without exposing app payloads", () => {
    const materialQueue = materialQueueSummary();
    const materialQueueRoute = materialQueueRouteSummary();
    const routedResourceSet = routedResourceSetSummary();
    const renderFrameQueue = renderFrameQueueSummary();
    const directLighting = directLightingSummary();
    const summary = createWebGpuAppDiagnosticsSummary({
      materialQueue,
      materialQueueRoute,
      routedResourceSet,
      renderFrameQueue,
      directLighting,
    });

    expect(summary).toEqual({
      sectionCount: 5,
      materialQueue,
      materialQueueRoute,
      routedResourceSet,
      renderFrameQueue,
      directLighting,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain("meshDraws");
    expect(serialized).not.toContain("sourceMesh");
    expect(serialized).not.toContain("gpu-buffer-handle");
    expect(serialized).not.toContain("bindGroup");
  });

  it("keeps the public routedResourceSet field for generic material frame-resource summaries", () => {
    const routedResourceSet = createQueuedMaterialFrameResourceSetSummary([
      {
        materialFamily: "debug-normal",
        pipelineKey: "debug-normal|opaque",
        renderPhase: "opaque",
      },
      {
        materialFamily: "standard",
        pipelineKey: "standard|opaque",
        renderPhase: "opaque",
      },
      {
        materialFamily: "standard",
        pipelineKey: "standard|transparent",
        renderPhase: "transparent",
      },
    ]);
    const summary = createWebGpuAppDiagnosticsSummary({ routedResourceSet });

    expect(summary).toEqual({
      sectionCount: 1,
      routedResourceSet: {
        itemCount: 3,
        byFamily: [
          { family: "debug-normal", itemCount: 1 },
          { family: "standard", itemCount: 2 },
        ],
        byPipeline: [
          { pipelineKey: "debug-normal|opaque", itemCount: 1 },
          { pipelineKey: "standard|opaque", itemCount: 1 },
          { pipelineKey: "standard|transparent", itemCount: 1 },
        ],
        byFamilyAndPipeline: [
          {
            family: "debug-normal",
            pipelineKey: "debug-normal|opaque",
            itemCount: 1,
          },
          {
            family: "standard",
            pipelineKey: "standard|opaque",
            itemCount: 1,
          },
          {
            family: "standard",
            pipelineKey: "standard|transparent",
            itemCount: 1,
          },
        ],
      },
    });
    expect(JSON.stringify(summary)).not.toMatch(
      /GPUDevice|GPUTexture|GPUBuffer|WebGpuApp|bindGroup|sourceMesh/,
    );
    expect(summary).not.toHaveProperty("standardResourceSet");
    expect(summary).not.toHaveProperty("customPreviewResourceSet");
  });

  it("collects material queue route report diagnostics through the public report field", () => {
    const routeReport = materialQueueRouteSummary();

    expect(
      collectWebGpuAppMaterialQueueRouteReport([
        "ignored",
        { code: "other", report: routeReport },
        { code: "webGpuApp.materialQueueRouteReport", report: routeReport },
      ]),
    ).toBe(routeReport);
  });

  it("ignores missing and malformed material queue route report diagnostics", () => {
    expect(collectWebGpuAppMaterialQueueRouteReport([])).toBeNull();
    expect(
      collectWebGpuAppMaterialQueueRouteReport([
        { code: "webGpuApp.materialQueueRouteReport" },
        { code: "webGpuApp.materialQueueRouteReport", report: null },
        { code: "webGpuApp.materialQueueRouteReport", report: "route" },
      ]),
    ).toBeNull();
  });

  it("keeps collected material queue route reports JSON safe", () => {
    const routeReport = collectWebGpuAppMaterialQueueRouteReport([
      {
        code: "webGpuApp.materialQueueRouteReport",
        report: materialQueueRouteSummary(),
      },
    ]);

    expect(routeReport).not.toBeNull();
    expect(JSON.stringify(routeReport)).not.toMatch(
      /GPUDevice|GPUTexture|GPUBuffer|WebGpuApp|bindGroup|sourceMesh/,
    );
  });

  it("collects material dependency readiness diagnostics through the public field", () => {
    const readiness = materialDependencyReadinessSummary();

    expect(
      collectWebGpuAppMaterialDependencyReadiness([
        "ignored",
        { code: "other", materialDependencyReadiness: readiness },
        {
          code: "webGpuApp.materialDependenciesNotReady",
          materialDependencyReadiness: readiness,
        },
      ]),
    ).toEqual([readiness]);
  });

  it("ignores missing and malformed material dependency readiness diagnostics", () => {
    expect(collectWebGpuAppMaterialDependencyReadiness([])).toEqual([]);
    expect(
      collectWebGpuAppMaterialDependencyReadiness([
        { code: "webGpuApp.materialDependenciesNotReady" },
        {
          code: "webGpuApp.materialDependenciesNotReady",
          materialDependencyReadiness: null,
        },
        {
          code: "webGpuApp.materialDependenciesNotReady",
          materialDependencyReadiness: "ready",
        },
      ]),
    ).toEqual([]);
  });

  it("keeps collected material dependency readiness reports JSON safe", () => {
    const readiness = collectWebGpuAppMaterialDependencyReadiness([
      {
        code: "webGpuApp.materialDependenciesNotReady",
        materialDependencyReadiness: materialDependencyReadinessSummary(),
      },
    ]);

    expect(readiness).toHaveLength(1);
    expect(JSON.stringify(readiness)).not.toMatch(
      /GPUDevice|GPUTexture|GPUBuffer|WebGpuApp|bindGroup|sourceMesh/,
    );
  });
});

function materialQueueSummary(): MaterialQueuePhaseSummary {
  return {
    itemCount: 2,
    byPhase: [{ phase: "opaque", itemCount: 2 }],
    byFamily: [{ family: "standard", itemCount: 2 }],
    byPhaseAndFamily: [{ phase: "opaque", family: "standard", itemCount: 2 }],
  };
}

function materialQueueRouteSummary() {
  return {
    valid: false,
    queueItemCount: 2,
    routedItemCount: 1,
    skippedItemCount: 1,
    byFamily: [
      {
        key: "debug-normal",
        queuedCount: 1,
        routedCount: 0,
        skippedCount: 1,
      },
      {
        key: "standard",
        queuedCount: 1,
        routedCount: 1,
        skippedCount: 0,
      },
    ],
    byPhase: [
      {
        key: "opaque",
        queuedCount: 2,
        routedCount: 1,
        skippedCount: 1,
      },
    ],
    diagnosticSummary: {
      total: 1,
      bySeverity: { info: 0, warning: 0, error: 1 },
      byCode: { "webGpuApp.unsupportedMaterialQueueFamily": 1 },
    },
    diagnostics: [
      {
        code: "webGpuApp.unsupportedMaterialQueueFamily",
        message: "Unsupported route.",
        severity: "error" as const,
        materialFamily: "debug-normal",
      },
    ],
  };
}

function routedResourceSetSummary(): QueuedMaterialFrameResourceSetSummary {
  return {
    itemCount: 2,
    byFamily: [{ family: "standard", itemCount: 2 }],
    byPipeline: [
      { pipelineKey: "standard|alpha:opaque|textures:none", itemCount: 2 },
    ],
    byFamilyAndPipeline: [
      {
        family: "standard",
        pipelineKey: "standard|alpha:opaque|textures:none",
        itemCount: 2,
      },
    ],
  };
}

function renderFrameQueueSummary(): RenderFrameQueueDiagnosticsSummary {
  return {
    ready: true,
    readyDrawCount: 2,
    blockedDrawCount: 0,
    packageCount: 2,
    packagePoolSize: 2,
    packageSlotsReused: 2,
    packageSlotsCreated: 0,
    missingPackedTransformCount: 0,
    diagnostics: {
      total: 0,
      byCode: {},
    },
  };
}

function directLightingSummary() {
  return {
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
    sections: {
      lightGpuBuffers: true,
      lightBindGroupLayout: true,
      lightBindGroup: true,
      shaderMetadata: true,
    },
    resources: {
      lightGpuBufferResourceKey: "light-buffer:main",
      lightBindGroupLayoutKey: "bind-group-layout:lights/group-3",
      lightBindGroupResourceKey: "bind-group:lights/group-3/light-buffer:main",
    },
    shaderMetadata: {
      valid: true,
      diagnostics: [],
    },
    diagnostics: [],
  };
}

function materialDependencyReadinessSummary() {
  return {
    ready: false,
    materialKey: "material:delayed-standard",
    diagnostics: {
      total: 1,
      bySeverity: { info: 0, warning: 1, error: 0 },
      byCode: { "materialDependency.textureNotReady": 1 },
    },
    dependencies: [
      {
        kind: "texture",
        key: "texture:loading-base-color",
        status: "loading",
      },
    ],
  };
}
