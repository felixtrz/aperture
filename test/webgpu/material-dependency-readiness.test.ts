import { describe, expect, it } from "vitest";

import { checkMaterialDependencyReadiness } from "@aperture-engine/webgpu";

describe("material texture dependency readiness", () => {
  it("treats materials without texture dependencies as ready", () => {
    expect(
      checkMaterialDependencyReadiness({
        dependencies: {
          baseColorTextureKey: null,
          baseColorSamplerKey: null,
        },
        availableTextureKeys: new Set(),
        availableSamplerKeys: new Set(),
      }),
    ).toEqual({ ready: true, diagnostics: [] });
  });

  it("reports ready when texture and sampler resources are available", () => {
    expect(
      checkMaterialDependencyReadiness({
        dependencies: {
          baseColorTextureKey: "texture:albedo",
          baseColorSamplerKey: "sampler:linear",
        },
        availableTextureKeys: new Set(["texture:albedo"]),
        availableSamplerKeys: new Set(["sampler:linear"]),
      }),
    ).toEqual({ ready: true, diagnostics: [] });
  });

  it("reports missing texture and sampler resources", () => {
    expect(
      checkMaterialDependencyReadiness({
        dependencies: {
          baseColorTextureKey: "texture:missing",
          baseColorSamplerKey: "sampler:missing",
        },
        availableTextureKeys: new Set(),
        availableSamplerKeys: new Set(),
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "materialDependency.missingTextureResource",
      "materialDependency.missingSamplerResource",
    ]);
  });

  it("reports missing texture or sampler independently", () => {
    expect(
      checkMaterialDependencyReadiness({
        dependencies: {
          baseColorTextureKey: "texture:missing",
          baseColorSamplerKey: "sampler:linear",
        },
        availableTextureKeys: new Set(),
        availableSamplerKeys: new Set(["sampler:linear"]),
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["materialDependency.missingTextureResource"]);

    expect(
      checkMaterialDependencyReadiness({
        dependencies: {
          baseColorTextureKey: "texture:albedo",
          baseColorSamplerKey: "sampler:missing",
        },
        availableTextureKeys: new Set(["texture:albedo"]),
        availableSamplerKeys: new Set(),
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["materialDependency.missingSamplerResource"]);
  });

  it("isolates missing dependencies across multiple textured materials", () => {
    const reports = [
      checkMaterialDependencyReadiness({
        dependencies: {
          baseColorTextureKey: "texture:ready",
          baseColorSamplerKey: "sampler:shared",
        },
        availableTextureKeys: new Set(["texture:ready"]),
        availableSamplerKeys: new Set(["sampler:shared"]),
      }),
      checkMaterialDependencyReadiness({
        dependencies: {
          baseColorTextureKey: "texture:missing",
          baseColorSamplerKey: "sampler:shared",
        },
        availableTextureKeys: new Set(["texture:ready"]),
        availableSamplerKeys: new Set(["sampler:shared"]),
      }),
    ];

    expect(reports.map((report) => report.ready)).toEqual([true, false]);
    expect(
      reports.flatMap((report) =>
        report.diagnostics.map((diagnostic) => ({
          code: diagnostic.code,
          resourceKey: diagnostic.resourceKey,
        })),
      ),
    ).toEqual([
      {
        code: "materialDependency.missingTextureResource",
        resourceKey: "texture:missing",
      },
    ]);
  });

  it("accepts multiple materials sharing ready texture and sampler resources", () => {
    const reports = [
      dependencies("texture:shared", "sampler:shared"),
      dependencies("texture:shared", "sampler:shared"),
    ].map((materialDependencies) =>
      checkMaterialDependencyReadiness({
        dependencies: materialDependencies,
        availableTextureKeys: new Set(["texture:shared"]),
        availableSamplerKeys: new Set(["sampler:shared"]),
      }),
    );

    expect(reports).toEqual([
      { ready: true, diagnostics: [] },
      { ready: true, diagnostics: [] },
    ]);
  });

  it("reports a missing shared dependency for each checked material", () => {
    const reports = [
      dependencies("texture:shared-missing", "sampler:shared"),
      dependencies("texture:shared-missing", "sampler:shared"),
    ].map((materialDependencies) =>
      checkMaterialDependencyReadiness({
        dependencies: materialDependencies,
        availableTextureKeys: new Set(),
        availableSamplerKeys: new Set(["sampler:shared"]),
      }),
    );

    expect(reports.map((report) => report.ready)).toEqual([false, false]);
    expect(
      reports.flatMap((report) =>
        report.diagnostics.map((diagnostic) => ({
          code: diagnostic.code,
          resourceKey: diagnostic.resourceKey,
          message: diagnostic.message,
        })),
      ),
    ).toEqual([
      {
        code: "materialDependency.missingTextureResource",
        resourceKey: "texture:shared-missing",
        message: "Missing texture resource 'texture:shared-missing'.",
      },
      {
        code: "materialDependency.missingTextureResource",
        resourceKey: "texture:shared-missing",
        message: "Missing texture resource 'texture:shared-missing'.",
      },
    ]);
  });
});

function dependencies(
  baseColorTextureKey: string,
  baseColorSamplerKey: string,
) {
  return { baseColorTextureKey, baseColorSamplerKey };
}
