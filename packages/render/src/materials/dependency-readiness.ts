import {
  assetHandleKey,
  type AssetHandle,
  type AssetRegistry,
  type AssetStatus,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import { materialTextureBindings } from "./bindings.js";
import type { MaterialAsset, MaterialKind } from "./types.js";

export type MaterialDependencyKind = "texture" | "sampler";
export type MaterialAssetDependencyReadinessStatus =
  | "ready"
  | "missing"
  | "registered"
  | "loading"
  | "failed";

export type MaterialAssetDependencyReadinessDiagnosticCode =
  | "materialDependency.missingMaterial"
  | "materialDependency.materialNotReady"
  | "materialDependency.missingTextureHandle"
  | "materialDependency.missingSamplerHandle"
  | "materialDependency.dependencyMissing"
  | "materialDependency.dependencyRegistered"
  | "materialDependency.dependencyLoading"
  | "materialDependency.dependencyFailed";

export interface MaterialAssetDependencyReadinessDiagnostic {
  readonly code: MaterialAssetDependencyReadinessDiagnosticCode;
  readonly message: string;
  readonly materialKey: string;
  readonly field?: string;
  readonly dependencyKind?: MaterialDependencyKind;
  readonly dependencyKey?: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly status?: MaterialAssetDependencyReadinessStatus;
}

export interface MaterialAssetDependencySlotReadiness {
  readonly field: string;
  readonly dependency: MaterialDependencyKind;
  readonly dependencyKind: MaterialDependencyKind;
  readonly handleKey: string | null;
  readonly status: MaterialAssetDependencyReadinessStatus;
  readonly ready: boolean;
}

export interface MaterialAssetDependencyReadinessReport {
  readonly ready: boolean;
  readonly materialKey: string;
  readonly materialStatus: AssetStatus | "missing";
  readonly materialKind?: MaterialKind;
  readonly dependencies: readonly MaterialAssetDependencySlotReadiness[];
  readonly slots: readonly MaterialAssetDependencySlotReadiness[];
  readonly diagnostics: readonly MaterialAssetDependencyReadinessDiagnostic[];
}

export interface MaterialAssetDependencyReadinessDiagnosticJsonValue {
  readonly code: MaterialAssetDependencyReadinessDiagnosticCode;
  readonly message: string;
  readonly materialKey: string;
  readonly field?: string;
  readonly dependencyKind?: MaterialDependencyKind;
  readonly dependencyKey?: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly status?: MaterialAssetDependencyReadinessStatus;
}

export interface MaterialAssetDependencySlotReadinessJsonValue {
  readonly field: string;
  readonly dependency: MaterialDependencyKind;
  readonly dependencyKind: MaterialDependencyKind;
  readonly handleKey: string | null;
  readonly status: MaterialAssetDependencyReadinessStatus;
  readonly ready: boolean;
}

export interface MaterialAssetDependencyReadinessReportJsonValue {
  readonly ready: boolean;
  readonly materialKey: string;
  readonly materialStatus: AssetStatus | "missing";
  readonly materialKind?: MaterialKind;
  readonly dependencies: readonly MaterialAssetDependencySlotReadinessJsonValue[];
  readonly slots: readonly MaterialAssetDependencySlotReadinessJsonValue[];
  readonly diagnostics: readonly MaterialAssetDependencyReadinessDiagnosticJsonValue[];
}

export interface MaterialAssetDependencyReadinessOptions {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
}

export function createMaterialAssetDependencyReadinessReport(
  options: MaterialAssetDependencyReadinessOptions,
): MaterialAssetDependencyReadinessReport {
  const materialKey = assetHandleKey(options.material);
  const materialEntry = options.registry.get<"material", MaterialAsset>(
    options.material,
  );
  const diagnostics: MaterialAssetDependencyReadinessDiagnostic[] = [];
  const slots: MaterialAssetDependencySlotReadiness[] = [];

  if (materialEntry === undefined) {
    diagnostics.push({
      code: "materialDependency.missingMaterial",
      materialKey,
      message: `Material '${materialKey}' is not registered.`,
    });
    return {
      ready: false,
      materialKey,
      materialStatus: "missing",
      dependencies: slots,
      slots,
      diagnostics,
    };
  }

  if (materialEntry.status !== "ready" || materialEntry.asset === null) {
    diagnostics.push({
      code: "materialDependency.materialNotReady",
      materialKey,
      status: materialEntry.status,
      message: `Material '${materialKey}' is '${materialEntry.status}', not ready.`,
    });
    return {
      ready: false,
      materialKey,
      materialStatus: materialEntry.status,
      dependencies: slots,
      slots,
      diagnostics,
    };
  }

  for (const [field, binding] of materialTextureBindings(materialEntry.asset)) {
    const textureKey =
      binding.texture === null ? undefined : assetHandleKey(binding.texture);
    const samplerKey =
      binding.sampler === null ? undefined : assetHandleKey(binding.sampler);

    inspectDependencySlot({
      registry: options.registry,
      materialKey,
      field,
      dependencyKind: "texture",
      handle: binding.texture,
      textureKey,
      samplerKey,
      slots,
      diagnostics,
    });
    inspectDependencySlot({
      registry: options.registry,
      materialKey,
      field,
      dependencyKind: "sampler",
      handle: binding.sampler,
      textureKey,
      samplerKey,
      slots,
      diagnostics,
    });
  }

  return {
    ready: diagnostics.length === 0,
    materialKey,
    materialStatus: materialEntry.status,
    materialKind: materialEntry.asset.kind,
    dependencies: slots,
    slots,
    diagnostics,
  };
}

export function createMaterialDependencyReadinessReport(
  options: MaterialAssetDependencyReadinessOptions,
): MaterialAssetDependencyReadinessReport {
  return createMaterialAssetDependencyReadinessReport(options);
}

export function materialAssetDependencyReadinessReportToJsonValue(
  report: MaterialAssetDependencyReadinessReport,
): MaterialAssetDependencyReadinessReportJsonValue {
  const slots = report.slots.map((slot) => ({ ...slot }));

  return {
    ready: report.ready,
    materialKey: report.materialKey,
    materialStatus: report.materialStatus,
    ...(report.materialKind === undefined
      ? {}
      : { materialKind: report.materialKind }),
    dependencies: slots,
    slots,
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function materialDependencyReadinessReportToJsonValue(
  report: MaterialAssetDependencyReadinessReport,
): MaterialAssetDependencyReadinessReportJsonValue {
  return materialAssetDependencyReadinessReportToJsonValue(report);
}

export function materialAssetDependencyReadinessReportToJson(
  report: MaterialAssetDependencyReadinessReport,
): string {
  return JSON.stringify(
    materialAssetDependencyReadinessReportToJsonValue(report),
  );
}

export function materialDependencyReadinessReportToJson(
  report: MaterialAssetDependencyReadinessReport,
): string {
  return materialAssetDependencyReadinessReportToJson(report);
}

function inspectDependencySlot(input: {
  readonly registry: AssetRegistry;
  readonly materialKey: string;
  readonly field: string;
  readonly dependencyKind: MaterialDependencyKind;
  readonly handle: AssetHandle | null;
  readonly textureKey: string | undefined;
  readonly samplerKey: string | undefined;
  readonly slots: MaterialAssetDependencySlotReadiness[];
  readonly diagnostics: MaterialAssetDependencyReadinessDiagnostic[];
}): void {
  if (input.handle === null) {
    input.slots.push({
      field: input.field,
      dependency: input.dependencyKind,
      dependencyKind: input.dependencyKind,
      handleKey: null,
      status: "missing",
      ready: false,
    });
    input.diagnostics.push({
      code:
        input.dependencyKind === "texture"
          ? "materialDependency.missingTextureHandle"
          : "materialDependency.missingSamplerHandle",
      materialKey: input.materialKey,
      field: input.field,
      dependencyKind: input.dependencyKind,
      ...(input.textureKey === undefined
        ? {}
        : { textureKey: input.textureKey }),
      ...(input.samplerKey === undefined
        ? {}
        : { samplerKey: input.samplerKey }),
      status: "missing",
      message: `${input.field} is missing a ${input.dependencyKind} handle.`,
    });
    return;
  }

  const dependencyKey = assetHandleKey(input.handle);
  const entry = input.registry.get(input.handle);
  const status = entry?.status ?? "missing";

  input.slots.push({
    field: input.field,
    dependency: input.dependencyKind,
    dependencyKind: input.dependencyKind,
    handleKey: dependencyKey,
    status,
    ready: status === "ready",
  });

  if (status === "ready") {
    return;
  }

  input.diagnostics.push({
    code: dependencyDiagnosticCode(input.dependencyKind, status),
    materialKey: input.materialKey,
    field: input.field,
    dependencyKind: input.dependencyKind,
    dependencyKey,
    ...(input.textureKey === undefined ? {} : { textureKey: input.textureKey }),
    ...(input.samplerKey === undefined ? {} : { samplerKey: input.samplerKey }),
    status,
    message: `${input.field} ${input.dependencyKind} dependency '${dependencyKey}' is '${status}'.`,
  });
}

function dependencyDiagnosticCode(
  dependencyKind: MaterialDependencyKind,
  status: MaterialAssetDependencyReadinessStatus,
): MaterialAssetDependencyReadinessDiagnosticCode {
  switch (status) {
    case "missing":
      return "materialDependency.dependencyMissing";
    case "registered":
      return "materialDependency.dependencyRegistered";
    case "loading":
      return "materialDependency.dependencyLoading";
    case "failed":
      return "materialDependency.dependencyFailed";
    case "ready":
      throw new Error(
        `Ready ${dependencyKind} dependencies do not produce diagnostics.`,
      );
  }
}
