import { cloneTextureTransform } from "./standard-texture-readiness-utils.js";
import type {
  StandardMaterialTextureReadinessReport,
  StandardMaterialTextureReadinessReportJsonValue,
} from "./standard-texture-readiness-types.js";

export function standardMaterialTextureReadinessReportToJsonValue(
  report: StandardMaterialTextureReadinessReport,
): StandardMaterialTextureReadinessReportJsonValue {
  return {
    ...report,
    slots: report.slots.map((slot) => ({
      ...slot,
      expectedColorSpaces: [...slot.expectedColorSpaces],
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      ...(diagnostic.expectedColorSpaces === undefined
        ? {}
        : { expectedColorSpaces: [...diagnostic.expectedColorSpaces] }),
      ...(diagnostic.supportedTexCoords === undefined
        ? {}
        : { supportedTexCoords: [...diagnostic.supportedTexCoords] }),
      ...(diagnostic.textureTransform === undefined
        ? {}
        : {
            textureTransform: cloneTextureTransform(
              diagnostic.textureTransform,
            ),
          }),
    })),
  };
}

export function standardMaterialTextureReadinessReportToJson(
  report: StandardMaterialTextureReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialTextureReadinessReportToJsonValue(report),
  );
}
