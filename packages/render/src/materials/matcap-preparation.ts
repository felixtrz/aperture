import {
  assetHandleKey,
  type AssetRegistry,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import { createMaterialPipelineKeyInput } from "./pipeline-key.js";
import {
  createMaterialDependencyReadinessReport,
  materialDependencyReadinessReportToJsonValue,
  type MaterialAssetDependencyReadinessDiagnostic,
  type MaterialAssetDependencyReadinessReportJsonValue,
} from "./dependency-readiness.js";
import type { MatcapMaterialAsset, MaterialAsset } from "./types.js";
import { validateMaterialAsset } from "./validation.js";

export type MatcapMaterialPreparationDiagnostic =
  | MaterialAssetDependencyReadinessDiagnostic
  | {
      readonly code:
        | "matcapPrepare.missingMaterial"
        | "matcapPrepare.materialNotReady"
        | "matcapPrepare.unsupportedMaterialKind"
        | "matcapPrepare.invalidMaterial";
      readonly message: string;
      readonly materialKey: string;
    };

export interface MatcapMaterialPreparationPlan {
  readonly materialKey: string;
  readonly label: string;
  readonly materialKind: "matcap";
  readonly matcapTexture: {
    readonly textureKey: string;
    readonly samplerKey: string;
  };
  readonly renderState: MatcapMaterialAsset["renderState"];
  readonly pipelineKey: ReturnType<typeof createMaterialPipelineKeyInput>;
  readonly dependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
}

export interface CreateMatcapMaterialPreparationPlanResult {
  readonly valid: boolean;
  readonly plan: MatcapMaterialPreparationPlan | null;
  readonly diagnostics: readonly MatcapMaterialPreparationDiagnostic[];
}

export function createMatcapMaterialPreparationPlan(options: {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
}): CreateMatcapMaterialPreparationPlanResult {
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
          code: "matcapPrepare.missingMaterial",
          materialKey,
          message: `Matcap material '${materialKey}' is not registered.`,
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
          code: "matcapPrepare.materialNotReady",
          materialKey,
          message: `Matcap material '${materialKey}' is '${entry.status}', not ready.`,
        },
      ],
    };
  }

  if (entry.asset.kind !== "matcap") {
    return {
      valid: false,
      plan: null,
      diagnostics: [
        {
          code: "matcapPrepare.unsupportedMaterialKind",
          materialKey,
          message: `Matcap material preparation requires a 'matcap' material, not '${entry.asset.kind}'.`,
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
        code: "matcapPrepare.invalidMaterial",
        materialKey,
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

  const texture = material.matcapTexture?.texture;
  const sampler = material.matcapTexture?.sampler;

  if (
    texture === null ||
    texture === undefined ||
    sampler === null ||
    sampler === undefined
  ) {
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
      materialKind: "matcap",
      matcapTexture: {
        textureKey: assetHandleKey(texture),
        samplerKey: assetHandleKey(sampler),
      },
      renderState: material.renderState,
      pipelineKey: createMaterialPipelineKeyInput(material),
      dependencyReadiness:
        materialDependencyReadinessReportToJsonValue(readiness),
    },
    diagnostics: [],
  };
}
