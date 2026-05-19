import type {
  DiffuseIblTextureResourceReport,
  SpecularIblTextureResourceReport,
} from "./ibl-texture-resource.js";
import type { IblSamplerResourceReport } from "./ibl-sampler-resource.js";
import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
import { bindGroupResourceKey } from "./resource-keys.js";
import type { StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";
import {
  createStandardMaterialIblBindGroupLayoutPlan,
  type StandardMaterialIblBindGroupLayoutPlan,
} from "./standard-material-ibl-bind-group-layout.js";

export type StandardMaterialIblBindGroupDescriptorStatus =
  | "deferred"
  | "missing"
  | "not-required";

export type StandardMaterialIblBindGroupDescriptorDiagnosticCode =
  | "standardMaterialIblBindGroup.invalidLayout"
  | "standardMaterialIblBindGroup.missingDiffuseTextureResource"
  | "standardMaterialIblBindGroup.specularTextureResourceDeferred"
  | "standardMaterialIblBindGroup.missingSamplerResource"
  | "standardMaterialIblBindGroup.bindGroupCreationDeferred"
  | "standardMaterialIblBindGroup.shaderSamplingDeferred";

export interface StandardMaterialIblBindGroupDescriptorDiagnostic {
  readonly code: StandardMaterialIblBindGroupDescriptorDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly binding?: number;
  readonly resourceKey?: string;
}

export interface StandardMaterialIblBindGroupDescriptorEntry {
  readonly group: 4;
  readonly binding: 0 | 1 | 2;
  readonly resourceKey: string;
  readonly resourceKind: Extract<
    StandardMaterialBindGroupResourceKind,
    "texture-view" | "sampler"
  >;
}

export interface StandardMaterialIblBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly group: 4;
  readonly resourceKey: string | null;
  readonly entries: readonly StandardMaterialIblBindGroupDescriptorEntry[];
  readonly diagnostics: readonly StandardMaterialIblBindGroupDescriptorDiagnostic[];
}

export interface StandardMaterialIblBindGroupDescriptorReadinessReport {
  readonly ready: boolean;
  readonly status: StandardMaterialIblBindGroupDescriptorStatus;
  readonly standardMaterialCount: number;
  readonly group: 4;
  readonly entryCount: number;
  readonly sections: {
    readonly layoutMetadata: boolean;
    readonly descriptorPlan: boolean;
    readonly diffuseTextureResource: boolean;
    readonly specularTextureResource: boolean;
    readonly samplerResource: boolean;
    readonly bindGroupResource: false;
    readonly shaderSampling: false;
  };
  readonly plan: StandardMaterialIblBindGroupDescriptorPlan | null;
  readonly diagnostics: readonly StandardMaterialIblBindGroupDescriptorDiagnostic[];
}

export type StandardMaterialIblBindGroupDescriptorReadinessReportJsonValue =
  StandardMaterialIblBindGroupDescriptorReadinessReport;

export interface CreateStandardMaterialIblBindGroupDescriptorPlanOptions {
  readonly layout?: StandardMaterialIblBindGroupLayoutPlan | null;
  readonly textures: IblTexturePreparationReport;
  readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
  readonly specularTextureResource?: SpecularIblTextureResourceReport;
  readonly samplers: IblSamplerResourceReport;
}

export interface CreateStandardMaterialIblBindGroupDescriptorReadinessOptions extends CreateStandardMaterialIblBindGroupDescriptorPlanOptions {
  readonly standardMaterialCount: number;
}

export function createStandardMaterialIblBindGroupDescriptorPlan(
  options: CreateStandardMaterialIblBindGroupDescriptorPlanOptions,
): StandardMaterialIblBindGroupDescriptorPlan {
  const layout =
    options.layout ?? createStandardMaterialIblBindGroupLayoutPlan();
  const diagnostics: StandardMaterialIblBindGroupDescriptorDiagnostic[] = [];
  const entries: StandardMaterialIblBindGroupDescriptorEntry[] = [];

  if (!layout.valid) {
    diagnostics.push({
      code: "standardMaterialIblBindGroup.invalidLayout",
      severity: "warning",
      message:
        "StandardMaterial IBL bind-group descriptor planning requires valid group 4 layout metadata.",
    });
  }

  const diffuseResourceKey = firstValidTextureResourceKey(
    options.diffuseTextureResource,
  );

  if (diffuseResourceKey === null) {
    diagnostics.push({
      code: "standardMaterialIblBindGroup.missingDiffuseTextureResource",
      severity: "warning",
      binding: 0,
      message:
        "StandardMaterial IBL bind-group descriptor planning requires an available diffuse irradiance texture resource.",
    });
  } else {
    entries.push({
      group: 4,
      binding: 0,
      resourceKey: diffuseResourceKey,
      resourceKind: "texture-view",
    });
  }

  const specularResourceKey =
    options.specularTextureResource === undefined
      ? null
      : firstValidSpecularTextureResourceKey(options.specularTextureResource);

  if (specularResourceKey === null) {
    const plannedSpecularResourceKey = firstSpecularTextureKey(
      options.textures,
    );
    diagnostics.push({
      code: "standardMaterialIblBindGroup.specularTextureResourceDeferred",
      severity: "warning",
      binding: 1,
      ...(plannedSpecularResourceKey === null
        ? {}
        : { resourceKey: plannedSpecularResourceKey }),
      message:
        "StandardMaterial IBL bind-group descriptor planning requires a renderer-owned specular prefilter texture resource, which is still deferred.",
    });
  } else {
    entries.push({
      group: 4,
      binding: 1,
      resourceKey: specularResourceKey,
      resourceKind: "texture-view",
    });
  }

  const samplerResourceKey = firstValidSamplerResourceKey(options.samplers);

  if (samplerResourceKey === null) {
    diagnostics.push({
      code: "standardMaterialIblBindGroup.missingSamplerResource",
      severity: "warning",
      binding: 2,
      message:
        "StandardMaterial IBL bind-group descriptor planning requires an available IBL sampler resource.",
    });
  } else {
    entries.push({
      group: 4,
      binding: 2,
      resourceKey: samplerResourceKey,
      resourceKind: "sampler",
    });
  }

  return {
    valid: diagnostics.length === 0,
    group: 4,
    resourceKey:
      diagnostics.length === 0
        ? createStandardMaterialIblBindGroupResourceKey(entries)
        : null,
    entries,
    diagnostics,
  };
}

export function createStandardMaterialIblBindGroupDescriptorReadinessReport(
  options: CreateStandardMaterialIblBindGroupDescriptorReadinessOptions,
): StandardMaterialIblBindGroupDescriptorReadinessReport {
  if (options.standardMaterialCount === 0) {
    return {
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      group: 4,
      entryCount: 0,
      sections: {
        layoutMetadata: true,
        descriptorPlan: true,
        diffuseTextureResource: true,
        specularTextureResource: false,
        samplerResource: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      plan: null,
      diagnostics: [],
    };
  }

  const plan = createStandardMaterialIblBindGroupDescriptorPlan(options);
  const hasBlockingMissingResources = plan.diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "standardMaterialIblBindGroup.invalidLayout" ||
      diagnostic.code ===
        "standardMaterialIblBindGroup.missingDiffuseTextureResource" ||
      diagnostic.code === "standardMaterialIblBindGroup.missingSamplerResource",
  );
  const diagnostics: StandardMaterialIblBindGroupDescriptorDiagnostic[] = [
    ...plan.diagnostics,
  ];

  if (!hasBlockingMissingResources) {
    diagnostics.push(
      {
        code: "standardMaterialIblBindGroup.bindGroupCreationDeferred",
        severity: "warning",
        message:
          "StandardMaterial IBL bind-group descriptor keys are planned, but live bind-group creation is deferred.",
      },
      {
        code: "standardMaterialIblBindGroup.shaderSamplingDeferred",
        severity: "warning",
        message:
          "StandardMaterial IBL bind-group descriptor keys are planned, but WGSL shader sampling is deferred.",
      },
    );
  }

  return {
    ready: false,
    status: hasBlockingMissingResources ? "missing" : "deferred",
    standardMaterialCount: options.standardMaterialCount,
    group: 4,
    entryCount: plan.entries.length,
    sections: {
      layoutMetadata: options.layout?.valid ?? true,
      descriptorPlan: true,
      diffuseTextureResource: plan.entries.some((entry) => entry.binding === 0),
      specularTextureResource: plan.entries.some(
        (entry) => entry.binding === 1,
      ),
      samplerResource: plan.entries.some((entry) => entry.binding === 2),
      bindGroupResource: false,
      shaderSampling: false,
    },
    plan,
    diagnostics,
  };
}

function firstValidSpecularTextureResourceKey(
  report: SpecularIblTextureResourceReport,
): string | null {
  return (
    report.resources.find((resource) => resource.valid)?.resource
      ?.resourceKey ?? null
  );
}

export function standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(
  report: StandardMaterialIblBindGroupDescriptorReadinessReport,
): StandardMaterialIblBindGroupDescriptorReadinessReportJsonValue {
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

export function standardMaterialIblBindGroupDescriptorReadinessReportToJson(
  report: StandardMaterialIblBindGroupDescriptorReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(report),
  );
}

export function createStandardMaterialIblBindGroupResourceKey(
  entries: readonly StandardMaterialIblBindGroupDescriptorEntry[],
): string {
  return bindGroupResourceKey(
    `standard/ibl/group-4/${entries
      .slice()
      .sort((a, b) => a.binding - b.binding)
      .map((entry) => `${entry.binding}:${entry.resourceKey}`)
      .join("/")}`,
  );
}

function firstValidTextureResourceKey(
  report: DiffuseIblTextureResourceReport,
): string | null {
  return (
    report.resources.find((resource) => resource.valid)?.resource
      ?.resourceKey ?? null
  );
}

function firstValidSamplerResourceKey(
  report: IblSamplerResourceReport,
): string | null {
  return (
    report.resources.find((resource) => resource.valid)?.resource
      ?.resourceKey ?? null
  );
}

function firstSpecularTextureKey(
  report: IblTexturePreparationReport,
): string | null {
  return (
    report.slots.find((slot) => slot.kind === "specular")?.textureKey ?? null
  );
}
