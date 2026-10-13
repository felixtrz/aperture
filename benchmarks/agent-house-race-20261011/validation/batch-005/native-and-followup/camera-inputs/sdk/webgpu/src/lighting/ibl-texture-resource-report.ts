import type {
  DiffuseIblTextureResourceReport,
  DiffuseIblTextureResourceReportJsonValue,
  SpecularIblTextureResourceReport,
  SpecularIblTextureResourceReportJsonValue,
} from "./ibl-texture-resource-types.js";

export function diffuseIblTextureResourceReportToJsonValue(
  report: DiffuseIblTextureResourceReport,
): DiffuseIblTextureResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    textureSlotCount: report.textureSlotCount,
    diffuseSlotCount: report.diffuseSlotCount,
    createdTextureCount: report.createdTextureCount,
    reusedTextureCount: report.reusedTextureCount,
    ...(report.convolved === undefined ? {} : { convolved: report.convolved }),
    ...(report.irradianceFaceSize === undefined
      ? {}
      : { irradianceFaceSize: report.irradianceFaceSize }),
    sections: { ...report.sections },
    resources: report.resources.map((resource) => ({
      valid: resource.valid,
      resourceKey:
        resource.resource?.resourceKey ??
        resource.diagnostics[0]?.resourceKey ??
        "",
      descriptor:
        resource.resource === null
          ? null
          : {
              ...resource.resource.descriptor,
              size: [...resource.resource.descriptor.size] as [
                number,
                number,
                number,
              ],
            },
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: "severity" in diagnostic ? diagnostic.severity : "warning",
      message: diagnostic.message,
      ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
        ? { resourceKey: diagnostic.resourceKey }
        : {}),
    })),
  };
}

export function diffuseIblTextureResourceReportToJson(
  report: DiffuseIblTextureResourceReport,
): string {
  return JSON.stringify(diffuseIblTextureResourceReportToJsonValue(report));
}

export function specularIblTextureResourceReportToJsonValue(
  report: SpecularIblTextureResourceReport,
): SpecularIblTextureResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    textureSlotCount: report.textureSlotCount,
    specularSlotCount: report.specularSlotCount,
    createdTextureCount: report.createdTextureCount,
    reusedTextureCount: report.reusedTextureCount,
    sections: { ...report.sections },
    resources: report.resources.map((resource) => ({
      valid: resource.valid,
      resourceKey:
        resource.resource?.resourceKey ??
        resource.diagnostics[0]?.resourceKey ??
        "",
      descriptor:
        resource.resource === null
          ? null
          : {
              ...resource.resource.descriptor,
              size: [...resource.resource.descriptor.size] as [
                number,
                number,
                number,
              ],
            },
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: "severity" in diagnostic ? diagnostic.severity : "warning",
      message: diagnostic.message,
      ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
        ? { resourceKey: diagnostic.resourceKey }
        : {}),
    })),
  };
}

export function specularIblTextureResourceReportToJson(
  report: SpecularIblTextureResourceReport,
): string {
  return JSON.stringify(specularIblTextureResourceReportToJsonValue(report));
}
