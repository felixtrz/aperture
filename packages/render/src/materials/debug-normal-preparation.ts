import {
  assetHandleKey,
  type AssetRegistry,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import {
  createMaterialDependencyReadinessReport,
  materialDependencyReadinessReportToJsonValue,
  type MaterialAssetDependencyReadinessDiagnostic,
  type MaterialAssetDependencyReadinessReportJsonValue,
} from "./dependency-readiness.js";
import { createMaterialPipelineKeyInput } from "./pipeline-key.js";
import type { DebugNormalMaterialAsset, MaterialAsset } from "./types.js";
import { validateMaterialAsset } from "./validation.js";

export type DebugNormalMaterialPreparationDiagnostic =
  | MaterialAssetDependencyReadinessDiagnostic
  | {
      readonly code:
        | "debugNormalPrepare.missingMaterial"
        | "debugNormalPrepare.materialNotReady"
        | "debugNormalPrepare.unsupportedMaterialKind"
        | "debugNormalPrepare.invalidMaterial";
      readonly message: string;
      readonly materialKey: string;
      readonly field?: string;
    };

export interface DebugNormalMaterialPreparationPlan {
  readonly materialKey: string;
  readonly label: string;
  readonly materialKind: "debug-normal";
  readonly renderState: DebugNormalMaterialAsset["renderState"];
  readonly pipelineKey: ReturnType<typeof createMaterialPipelineKeyInput>;
  readonly dependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
}

export interface CreateDebugNormalMaterialPreparationPlanResult {
  readonly valid: boolean;
  readonly plan: DebugNormalMaterialPreparationPlan | null;
  readonly diagnostics: readonly DebugNormalMaterialPreparationDiagnostic[];
}

export function createDebugNormalMaterialPreparationPlan(options: {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
}): CreateDebugNormalMaterialPreparationPlanResult {
  const materialKey = assetHandleKey(options.material);
  const entry = options.registry.get<"material", MaterialAsset>(
    options.material,
  );

  if (entry === undefined) {
    return {
      valid: false,
      plan: null,
      diagnostics: [
        {
          code: "debugNormalPrepare.missingMaterial",
          materialKey,
          message: `DebugNormal material '${materialKey}' is not registered.`,
        },
      ],
    };
  }

  if (entry.status !== "ready" || entry.asset === null) {
    return {
      valid: false,
      plan: null,
      diagnostics: [
        {
          code: "debugNormalPrepare.materialNotReady",
          materialKey,
          message: `DebugNormal material '${materialKey}' is '${entry.status}', not ready.`,
        },
      ],
    };
  }

  if (entry.asset.kind !== "debug-normal") {
    return {
      valid: false,
      plan: null,
      diagnostics: [
        {
          code: "debugNormalPrepare.unsupportedMaterialKind",
          materialKey,
          message: `DebugNormal material preparation requires a 'debug-normal' material, not '${entry.asset.kind}'.`,
        },
      ],
    };
  }

  const material = entry.asset;
  const validation = validateMaterialAsset(material);

  if (!validation.valid) {
    return {
      valid: false,
      plan: null,
      diagnostics: validation.diagnostics.map((diagnostic) => ({
        code: "debugNormalPrepare.invalidMaterial",
        materialKey,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        message: diagnostic.message,
      })),
    };
  }

  const readiness = createMaterialDependencyReadinessReport({
    registry: options.registry,
    material: options.material,
  });

  if (!readiness.ready) {
    return {
      valid: false,
      plan: null,
      diagnostics: readiness.diagnostics,
    };
  }

  return {
    valid: true,
    plan: {
      materialKey,
      label: material.label,
      materialKind: "debug-normal",
      renderState: material.renderState,
      pipelineKey: createMaterialPipelineKeyInput(material),
      dependencyReadiness:
        materialDependencyReadinessReportToJsonValue(readiness),
    },
    diagnostics: [],
  };
}
