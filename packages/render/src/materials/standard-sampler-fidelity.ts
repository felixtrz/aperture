import { assetHandleKey } from "@aperture-engine/simulation";
import type { MaterialAsset } from "./types.js";
import { inspectStandardMaterialSamplers } from "./standard-sampler-fidelity-inspection.js";
import type {
  StandardMaterialSamplerFidelityOptions,
  StandardMaterialSamplerFidelityReport,
  StandardMaterialSamplerFidelityReportJsonValue,
} from "./standard-sampler-fidelity-types.js";

export type {
  StandardMaterialSamplerFidelityDiagnostic,
  StandardMaterialSamplerFidelityDiagnosticCode,
  StandardMaterialSamplerFidelityOptions,
  StandardMaterialSamplerFidelityReport,
  StandardMaterialSamplerFidelityReportJsonValue,
  StandardMaterialSamplerFidelitySlot,
} from "./standard-sampler-fidelity-types.js";

export function createStandardMaterialSamplerFidelityReport(
  options: StandardMaterialSamplerFidelityOptions,
): StandardMaterialSamplerFidelityReport {
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
          code: "standardMaterialSampler.missingMaterial",
          severity: "error",
          materialKey,
          status: "missing",
          message: `StandardMaterial sampler fidelity requires registered material '${materialKey}'.`,
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
          code: "standardMaterialSampler.materialNotReady",
          severity: entry.status === "failed" ? "error" : "warning",
          materialKey,
          status: entry.status,
          message: `StandardMaterial sampler fidelity requires material '${materialKey}' to be ready, not '${entry.status}'.`,
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
          code: "standardMaterialSampler.unsupportedMaterialKind",
          severity: "error",
          materialKey,
          materialKind: entry.asset.kind,
          message: `StandardMaterial sampler fidelity requires a StandardMaterial, not '${entry.asset.kind}'.`,
        },
      ],
    };
  }

  return inspectStandardMaterialSamplers(
    options.registry,
    materialKey,
    entry.asset,
  );
}

export function standardMaterialSamplerFidelityReportToJsonValue(
  report: StandardMaterialSamplerFidelityReport,
): StandardMaterialSamplerFidelityReportJsonValue {
  return {
    ...report,
    slots: report.slots.map((slot) => ({ ...slot })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialSamplerFidelityReportToJson(
  report: StandardMaterialSamplerFidelityReport,
): string {
  return JSON.stringify(
    standardMaterialSamplerFidelityReportToJsonValue(report),
  );
}
