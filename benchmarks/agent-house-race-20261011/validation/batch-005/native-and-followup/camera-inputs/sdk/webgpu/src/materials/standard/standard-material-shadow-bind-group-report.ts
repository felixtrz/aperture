import type {
  ShadowSamplerDescriptor,
  ShadowSamplerResourceReport,
  StandardMaterialShadowBindGroupDescriptorReadinessReport,
  StandardMaterialShadowBindGroupResourceReport,
} from "./standard-material-shadow-bind-group.js";

export type ShadowSamplerResourceReportJsonValue = Omit<
  ShadowSamplerResourceReport,
  "resource"
> & {
  readonly resource: {
    readonly resourceKey: string;
    readonly descriptor: ShadowSamplerDescriptor;
  } | null;
};

export type StandardMaterialShadowBindGroupResourceReportJsonValue = Omit<
  StandardMaterialShadowBindGroupResourceReport,
  "resource"
> & {
  readonly resource: {
    readonly group: 5;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly entryResourceKeys: readonly string[];
  } | null;
};

export type StandardMaterialShadowBindGroupDescriptorReadinessReportJsonValue =
  StandardMaterialShadowBindGroupDescriptorReadinessReport;

export function shadowSamplerResourceReportToJsonValue(
  report: ShadowSamplerResourceReport,
): ShadowSamplerResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    createdSamplerCount: report.createdSamplerCount,
    reusedSamplerCount: report.reusedSamplerCount,
    sections: { ...report.sections },
    resource:
      report.resource === null
        ? null
        : {
            resourceKey: report.resource.resourceKey,
            descriptor: { ...report.resource.descriptor },
          },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowSamplerResourceReportToJson(
  report: ShadowSamplerResourceReport,
): string {
  return JSON.stringify(shadowSamplerResourceReportToJsonValue(report));
}

export function standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(
  report: StandardMaterialShadowBindGroupDescriptorReadinessReport,
): StandardMaterialShadowBindGroupDescriptorReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    standardMaterialCount: report.standardMaterialCount,
    group: report.group,
    entryCount: report.entryCount,
    sections: { ...report.sections },
    plan:
      report.plan === null
        ? null
        : {
            valid: report.plan.valid,
            group: report.plan.group,
            resourceKey: report.plan.resourceKey,
            entries: report.plan.entries.map((entry) => ({ ...entry })),
            diagnostics: report.plan.diagnostics.map((diagnostic) => ({
              ...diagnostic,
            })),
          },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialShadowBindGroupDescriptorReadinessReportToJson(
  report: StandardMaterialShadowBindGroupDescriptorReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(report),
  );
}

export function standardMaterialShadowBindGroupResourceReportToJsonValue(
  report: StandardMaterialShadowBindGroupResourceReport,
): StandardMaterialShadowBindGroupResourceReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    standardMaterialCount: report.standardMaterialCount,
    group: report.group,
    createdBindGroupCount: report.createdBindGroupCount,
    reusedBindGroupCount: report.reusedBindGroupCount,
    sections: { ...report.sections },
    resource:
      report.resource === null
        ? null
        : {
            group: report.resource.group,
            resourceKey: report.resource.resourceKey,
            layoutKey: report.resource.layoutKey,
            entryResourceKeys: [...report.resource.entryResourceKeys],
          },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialShadowBindGroupResourceReportToJson(
  report: StandardMaterialShadowBindGroupResourceReport,
): string {
  return JSON.stringify(
    standardMaterialShadowBindGroupResourceReportToJsonValue(report),
  );
}
