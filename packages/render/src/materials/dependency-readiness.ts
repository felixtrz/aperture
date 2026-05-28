import { assetHandleKey } from "@aperture-engine/simulation";
import { materialTextureBindings } from "./bindings.js";
import { inspectMaterialDependencySlot } from "./dependency-readiness-inspection.js";
import type {
  MaterialAssetDependencyReadinessDiagnostic,
  MaterialAssetDependencyReadinessOptions,
  MaterialAssetDependencyReadinessReport,
  MaterialAssetDependencyReadinessReportJsonValue,
  MaterialAssetDependencySlotReadiness,
} from "./dependency-readiness-types.js";
import type { MaterialAsset } from "./types.js";

export type {
  MaterialAssetDependencyReadinessDiagnostic,
  MaterialAssetDependencyReadinessDiagnosticCode,
  MaterialAssetDependencyReadinessDiagnosticJsonValue,
  MaterialAssetDependencyReadinessOptions,
  MaterialAssetDependencyReadinessReport,
  MaterialAssetDependencyReadinessReportJsonValue,
  MaterialAssetDependencyReadinessStatus,
  MaterialAssetDependencySlotReadiness,
  MaterialAssetDependencySlotReadinessJsonValue,
  MaterialDependencyKind,
} from "./dependency-readiness-types.js";

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

    inspectMaterialDependencySlot({
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
    inspectMaterialDependencySlot({
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
