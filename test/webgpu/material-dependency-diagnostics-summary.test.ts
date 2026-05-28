import { describe, expect, it } from "vitest";

import type {
  MaterialAssetDependencyReadinessDiagnosticJsonValue,
  MaterialAssetDependencyReadinessReportJsonValue,
  MaterialAssetDependencySlotReadinessJsonValue,
} from "@aperture-engine/render";
import { createMaterialDependencyDiagnosticsSummary } from "@aperture-engine/webgpu/test-support";

describe("material dependency diagnostics summary", () => {
  it("summarizes empty dependency readiness reports", () => {
    expect(createMaterialDependencyDiagnosticsSummary([])).toEqual({
      materialCount: 0,
      readyMaterialCount: 0,
      blockedMaterialCount: 0,
      slotCount: 0,
      readySlotCount: 0,
      blockedSlotCount: 0,
      byMaterialKind: [],
      byDependencyKind: [],
      byStatus: [],
      diagnostics: {
        total: 0,
        byCode: {},
      },
    });
  });

  it("summarizes ready StandardMaterial texture dependencies", () => {
    const summary = createMaterialDependencyDiagnosticsSummary([
      report({
        ready: true,
        materialKind: "standard",
        slots: [
          slot("baseColorTexture", "texture", "texture:ready-base-color"),
          slot("baseColorTexture", "sampler", "sampler:ready-base-color"),
        ],
      }),
    ]);

    expect(summary).toEqual({
      materialCount: 1,
      readyMaterialCount: 1,
      blockedMaterialCount: 0,
      slotCount: 2,
      readySlotCount: 2,
      blockedSlotCount: 0,
      byMaterialKind: [
        {
          materialKind: "standard",
          materialCount: 1,
          readyMaterialCount: 1,
          blockedMaterialCount: 0,
        },
      ],
      byDependencyKind: [
        {
          dependencyKind: "texture",
          slotCount: 1,
          readySlotCount: 1,
          blockedSlotCount: 0,
        },
        {
          dependencyKind: "sampler",
          slotCount: 1,
          readySlotCount: 1,
          blockedSlotCount: 0,
        },
      ],
      byStatus: [{ status: "ready", slotCount: 2 }],
      diagnostics: {
        total: 0,
        byCode: {},
      },
    });
  });

  it("summarizes missing and loading StandardMaterial dependencies without handles", () => {
    const summary = createMaterialDependencyDiagnosticsSummary([
      report({
        ready: false,
        materialKind: "standard",
        slots: [
          slot(
            "metallicRoughnessTexture",
            "texture",
            "texture:missing-standard-mr",
            "missing",
          ),
          slot(
            "metallicRoughnessTexture",
            "sampler",
            "sampler:loading-standard-mr",
            "loading",
          ),
        ],
        diagnostics: [
          diagnostic(
            "materialDependency.dependencyMissing",
            "metallicRoughnessTexture",
            "texture",
            "texture:missing-standard-mr",
          ),
          diagnostic(
            "materialDependency.dependencyLoading",
            "metallicRoughnessTexture",
            "sampler",
            "sampler:loading-standard-mr",
          ),
        ],
      }),
    ]);

    expect(summary).toEqual({
      materialCount: 1,
      readyMaterialCount: 0,
      blockedMaterialCount: 1,
      slotCount: 2,
      readySlotCount: 0,
      blockedSlotCount: 2,
      byMaterialKind: [
        {
          materialKind: "standard",
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
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain("material:blocked-standard");
    expect(serialized).not.toContain("texture:missing-standard-mr");
    expect(serialized).not.toContain("sampler:loading-standard-mr");
    expect(serialized).not.toContain("gpu-texture-handle");
  });
});

function report(input: {
  readonly ready: boolean;
  readonly materialKind: "standard";
  readonly slots: readonly MaterialAssetDependencySlotReadinessJsonValue[];
  readonly diagnostics?: readonly MaterialAssetDependencyReadinessDiagnosticJsonValue[];
}): MaterialAssetDependencyReadinessReportJsonValue {
  return {
    ready: input.ready,
    materialKey: input.ready
      ? "material:ready-standard"
      : "material:blocked-standard",
    materialStatus: "ready",
    materialKind: input.materialKind,
    dependencies: input.slots,
    slots: input.slots,
    diagnostics: input.diagnostics ?? [],
  };
}

function slot(
  field: string,
  dependencyKind: "texture" | "sampler",
  handleKey: string,
  status: "ready" | "missing" | "loading" = "ready",
): MaterialAssetDependencySlotReadinessJsonValue {
  return {
    field,
    dependency: dependencyKind,
    dependencyKind,
    handleKey,
    status,
    ready: status === "ready",
  };
}

function diagnostic(
  code: MaterialAssetDependencyReadinessDiagnosticJsonValue["code"],
  field: string,
  dependencyKind: "texture" | "sampler",
  dependencyKey: string,
): MaterialAssetDependencyReadinessDiagnosticJsonValue {
  return {
    code,
    message: `${field} ${dependencyKind} is not ready.`,
    materialKey: "material:blocked-standard",
    field,
    dependencyKind,
    dependencyKey,
    status:
      code === "materialDependency.dependencyLoading" ? "loading" : "missing",
  };
}
