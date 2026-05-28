import { describe, expect, it } from "vitest";

import * as webgpu from "@aperture-engine/webgpu/test-support";
import {
  createPreparedAppMaterialFallbackDiagnostic,
  createPreparedAppMaterialCacheSummary,
  recordPreparedAppMaterialResourceUse,
  writePreparedAppMaterialCacheSummary,
  type PreparedAppMaterialResourceReuseCounters,
} from "../../packages/webgpu/src/materials/core/prepared-app-material-resource.js";

describe("prepared app material resource reuse counters", () => {
  it("records created and reused prepared material resources consistently", () => {
    const counters = reuseCounters();

    recordPreparedAppMaterialResourceUse(
      counters,
      { status: "created", resource: { id: "first" } },
      3,
    );
    recordPreparedAppMaterialResourceUse(
      counters,
      { status: "reused", resource: { id: "second" } },
      3,
    );

    expect(counters).toMatchObject({
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      bindGroupsCreated: 5,
      bindGroupsReused: 1,
    });
  });

  it("keeps the helper off the public WebGPU package surface", () => {
    expect("recordPreparedAppMaterialResourceUse" in webgpu).toBe(false);
    expect("writePreparedAppMaterialCacheSummary" in webgpu).toBe(false);
    expect("createPreparedAppMaterialFallbackDiagnostic" in webgpu).toBe(false);
  });

  it("writes JSON-safe prepared material cache family counts", () => {
    const summary = createPreparedAppMaterialCacheSummary();

    writePreparedAppMaterialCacheSummary(summary, {
      unlit: cacheWithEntries("unlit:1", "unlit:2"),
      matcap: cacheWithEntries("matcap:1"),
      standard: cacheWithEntries("standard:1", "standard:2", "standard:3"),
      debugNormal: cacheWithEntries("debug-normal:1"),
    });

    expect(summary).toEqual({
      totalEntries: 7,
      families: {
        unlit: { entries: 2 },
        matcap: { entries: 1 },
        standard: { entries: 3 },
        "debug-normal": { entries: 1 },
      },
    });
    expect(JSON.stringify(summary)).not.toContain("Map");
  });

  it("creates sanitized fallback diagnostics for failed prepared material helpers", () => {
    const circular: { self?: unknown; readonly code: string } = {
      code: "preparedTexturedUnlitMaterial.missingLayout",
    };
    circular.self = circular;

    const diagnostic = createPreparedAppMaterialFallbackDiagnostic({
      materialFamily: "unlit",
      materialKey: "material:textured",
      status: "failed",
      diagnostics: [
        circular,
        {
          code: "unlitBindGroupResource.missingTextureResource",
          resourceKey: "texture:albedo",
          raw: () => "not json",
        },
      ],
    });

    expect(diagnostic).toEqual({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "unlit",
      materialKey: "material:textured",
      reason: "missing-layout",
      diagnostics: [
        {
          code: "preparedTexturedUnlitMaterial.missingLayout",
          self: "[Circular]",
        },
        {
          code: "unlitBindGroupResource.missingTextureResource",
          resourceKey: "texture:albedo",
        },
      ],
      message:
        "Prepared unlit material resource creation failed for 'material:textured' and fell back to direct frame-resource creation.",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("raw");
  });

  it("keeps expected skipped prepared material routes silent", () => {
    expect(
      createPreparedAppMaterialFallbackDiagnostic({
        materialFamily: "standard",
        materialKey: "material:pbr",
        status: "skipped",
        diagnostics: [
          {
            code: "preparedScalarStandardMaterial.notScalar",
            materialKey: "material:pbr",
          },
        ],
      }),
    ).toBeNull();
  });

  it("classifies missing prepared texture and sampler resources", () => {
    expect(
      createPreparedAppMaterialFallbackDiagnostic({
        materialFamily: "matcap",
        materialKey: "material:studio",
        status: "failed",
        diagnostics: [
          {
            code: "matcapMaterialBindGroupResource.missingSamplerResource",
            resourceKey: "sampler:linear",
          },
        ],
      }),
    ).toMatchObject({
      code: "webGpuApp.preparedMaterialFallback",
      materialFamily: "matcap",
      materialKey: "material:studio",
      reason: "missing-prepared-dependency",
      diagnostics: [
        {
          code: "matcapMaterialBindGroupResource.missingSamplerResource",
          resourceKey: "sampler:linear",
        },
      ],
    });
  });
});

function reuseCounters(): PreparedAppMaterialResourceReuseCounters {
  return {
    materialBuffersCreated: 0,
    materialBuffersReused: 0,
    preparedMaterialBuffersCreated: 0,
    preparedMaterialBuffersReused: 0,
    preparedMaterialBindGroupsCreated: 0,
    preparedMaterialBindGroupsReused: 0,
    bindGroupsCreated: 0,
    bindGroupsReused: 0,
  };
}

function cacheWithEntries(...keys: string[]) {
  return {
    resources: new Map(keys.map((key) => [key, { key }])),
  };
}
