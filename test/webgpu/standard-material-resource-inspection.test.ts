import { describe, expect, it } from "vitest";

import {
  createRenderResourceSummaryReport,
  createStandardMaterialResourceInspectionRecords,
  createStandardMaterialResourceInspectionReport,
  type StandardMaterialGpuBufferResource,
} from "@aperture-engine/webgpu";

describe("standard material resource inspection", () => {
  it("creates live, missing, stale, and pending-destroy material records", () => {
    const report = createStandardMaterialResourceInspectionReport([
      {
        assetKey: "material:live",
        expectedResourceKey: "material-buffer:live",
        resource: standardResource("material-buffer:live"),
        version: 2,
        expectedVersion: 2,
      },
      {
        assetKey: "material:missing",
        expectedResourceKey: "material-buffer:missing",
        resource: null,
      },
      {
        assetKey: "material:stale",
        expectedResourceKey: "material-buffer:stale",
        resource: standardResource("material-buffer:stale"),
        version: 1,
        expectedVersion: 2,
      },
      {
        assetKey: "material:destroy",
        expectedResourceKey: "material-buffer:destroy",
        resource: standardResource("material-buffer:destroy"),
        pendingDestroy: true,
      },
    ]);

    expect(report.records).toEqual([
      {
        kind: "material",
        assetKey: "material:destroy",
        resourceKey: "material-buffer:destroy",
        status: "pending-destroy",
        pendingDestroy: true,
      },
      {
        kind: "material",
        assetKey: "material:live",
        resourceKey: "material-buffer:live",
        version: 2,
        expectedVersion: 2,
        status: "live",
        pendingDestroy: false,
      },
      {
        kind: "material",
        assetKey: "material:missing",
        resourceKey: "material-buffer:missing",
        status: "missing",
        pendingDestroy: false,
      },
      {
        kind: "material",
        assetKey: "material:stale",
        resourceKey: "material-buffer:stale",
        version: 1,
        expectedVersion: 2,
        status: "stale",
        pendingDestroy: false,
      },
    ]);
    expect(report.counts).toEqual({
      total: 4,
      live: 1,
      missing: 1,
      stale: 1,
      pendingDestroy: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderResourceInspection.pendingDestroy",
      "renderResourceInspection.missingResource",
      "renderResourceInspection.staleResource",
    ]);
  });

  it("feeds standard material inspection records into resource summaries", () => {
    const inspection = createStandardMaterialResourceInspectionReport([
      {
        assetKey: "material:missing",
        expectedResourceKey: "material-buffer:missing",
        resource: null,
      },
      {
        assetKey: "material:stale",
        expectedResourceKey: "material-buffer:stale",
        resource: standardResource("material-buffer:stale"),
        version: "old",
        expectedVersion: "new",
      },
    ]);
    const summary = createRenderResourceSummaryReport({
      meshResources: [],
      materialResources: [],
      viewUniformResources: [],
      shaderResources: [],
      pipelines: [],
      resourceInspection: inspection,
    });

    expect(summary.counts).toMatchObject({
      inspectedResources: 2,
      missingResources: 1,
      staleResources: 1,
      errors: 1,
      warnings: 1,
    });
    expect(summary.diagnostics).toEqual([
      {
        code: "renderResourceInspection.missingResource",
        message: "Renderer resource 'material-buffer:missing' is missing.",
        severity: "error",
        resourceKey: "material-buffer:missing",
      },
      {
        code: "renderResourceInspection.staleResource",
        message: "Renderer resource 'material-buffer:stale' is stale.",
        severity: "warning",
        resourceKey: "material-buffer:stale",
      },
    ]);
  });

  it("creates records without exposing raw GPU buffer handles", () => {
    const rawBuffer = { raw: "GPUBuffer" };
    const records = createStandardMaterialResourceInspectionRecords([
      {
        assetKey: "material:live",
        expectedResourceKey: "material-buffer:live",
        resource: standardResource("material-buffer:live", rawBuffer),
      },
    ]);

    expect(JSON.stringify(records)).not.toContain("GPUBuffer");
    expect(records[0]).toMatchObject({
      kind: "material",
      assetKey: "material:live",
      resourceKey: "material-buffer:live",
      status: "live",
    });
  });
});

function standardResource(
  resourceKey: string,
  uniformBuffer: unknown = {},
): StandardMaterialGpuBufferResource {
  return {
    resourceKey,
    uniformBuffer,
    featureFlags: 0,
    dependencies: {
      baseColor: textureDependency(),
      metallicRoughness: textureDependency(),
      normal: textureDependency(),
      occlusion: textureDependency(),
      emissive: textureDependency(),
      clearcoat: textureDependency(),
      transmission: textureDependency(),
    },
  };
}

function textureDependency(): StandardMaterialGpuBufferResource["dependencies"]["baseColor"] {
  return { textureKey: null, samplerKey: null, texCoord: 0 };
}
