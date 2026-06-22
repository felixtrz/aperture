import { assetHandleKey } from "@aperture-engine/simulation";
import type { MaterialAsset } from "./types.js";
import { inspectStandardMaterialTextures } from "./standard-texture-readiness-inspection.js";
import {
  standardMaterialTextureReadinessReportToJson,
  standardMaterialTextureReadinessReportToJsonValue,
} from "./standard-texture-readiness-report.js";
import type {
  StandardMaterialTextureReadinessOptions,
  StandardMaterialTextureReadinessReport,
} from "./standard-texture-readiness-types.js";

export {
  standardMaterialTextureReadinessReportToJson,
  standardMaterialTextureReadinessReportToJsonValue,
};

export type {
  StandardMaterialTextureField,
  StandardMaterialTextureReadinessDiagnostic,
  StandardMaterialTextureReadinessDiagnosticCode,
  StandardMaterialTextureReadinessOptions,
  StandardMaterialTextureReadinessReport,
  StandardMaterialTextureReadinessReportJsonValue,
  StandardMaterialTextureReadinessSlot,
} from "./standard-texture-readiness-types.js";

export function createStandardMaterialTextureReadinessReport(
  options: StandardMaterialTextureReadinessOptions,
): StandardMaterialTextureReadinessReport {
  const materialKey = assetHandleKey(options.material);
  const entry = options.registry.get<"material", MaterialAsset>(
    options.material,
  );

  if (entry === undefined) {
    return {
      ready: false,
      materialKey,
      materialStatus: "missing",
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialTexture.missingMaterial",
          severity: "error",
          materialKey,
          status: "missing",
          message: `StandardMaterial texture readiness requires registered material '${materialKey}'.`,
        },
      ],
    };
  }

  if (entry.status !== "ready" || entry.asset === null) {
    return {
      ready: false,
      materialKey,
      materialStatus: entry.status,
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialTexture.materialNotReady",
          severity: entry.status === "failed" ? "error" : "warning",
          materialKey,
          status: entry.status,
          message: `StandardMaterial texture readiness requires material '${materialKey}' to be ready, not '${entry.status}'.`,
        },
      ],
    };
  }

  if (entry.asset.kind !== "standard") {
    return {
      ready: false,
      materialKey,
      materialStatus: entry.status,
      materialKind: entry.asset.kind,
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialTexture.unsupportedMaterialKind",
          severity: "error",
          materialKey,
          message: `StandardMaterial texture readiness requires a StandardMaterial, not '${entry.asset.kind}'.`,
        },
      ],
    };
  }

  return inspectStandardMaterialTextures(
    options.registry,
    materialKey,
    entry.asset,
  );
}
