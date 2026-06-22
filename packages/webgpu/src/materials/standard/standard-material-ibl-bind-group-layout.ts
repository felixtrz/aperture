import type { StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";

export type StandardMaterialIblShaderVisibility =
  | "vertex"
  | "fragment"
  | "compute";

export type StandardMaterialIblBindGroupLayoutStatus =
  | "deferred"
  | "missing"
  | "not-required";

export interface StandardMaterialIblBindGroupLayoutBindingMetadata {
  readonly binding: number;
  readonly name: string;
  readonly resourceKind: StandardMaterialBindGroupResourceKind;
  readonly visibility: readonly StandardMaterialIblShaderVisibility[];
  readonly required: boolean;
}

export interface StandardMaterialIblBindGroupLayoutMetadata {
  readonly group: 4;
  readonly name: "standardMaterialIbl";
  readonly layoutKey: string;
  readonly bindings: readonly StandardMaterialIblBindGroupLayoutBindingMetadata[];
}

export interface StandardMaterialIblBindGroupLayoutEntry {
  readonly binding: number;
  readonly label: string;
  readonly resource: "uniform-buffer" | "texture" | "sampler";
}

export interface StandardMaterialIblBindGroupLayoutDescriptor {
  readonly group: 4;
  readonly label: string;
  readonly entries: readonly StandardMaterialIblBindGroupLayoutEntry[];
  readonly metadata: StandardMaterialIblBindGroupLayoutMetadata;
}

export type StandardMaterialIblBindGroupLayoutDiagnosticCode =
  | "standardMaterialIblBindGroupLayout.invalidGroup"
  | "standardMaterialIblBindGroupLayout.missingBinding"
  | "standardMaterialIblBindGroupLayout.resourceKindMismatch";

export interface StandardMaterialIblBindGroupLayoutDiagnostic {
  readonly code: StandardMaterialIblBindGroupLayoutDiagnosticCode;
  readonly message: string;
  readonly binding?: number;
}

export interface StandardMaterialIblBindGroupLayoutPlan {
  readonly valid: boolean;
  readonly layout: StandardMaterialIblBindGroupLayoutDescriptor;
  readonly diagnostics: readonly StandardMaterialIblBindGroupLayoutDiagnostic[];
}

export interface StandardMaterialIblBindGroupLayoutReadinessDiagnostic {
  readonly code:
    | "standardMaterialIblBindGroupLayout.invalidLayout"
    | "standardMaterialIblBindGroupLayout.bindGroupResourceDeferred"
    | "standardMaterialIblBindGroupLayout.shaderSamplingDeferred";
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface StandardMaterialIblBindGroupLayoutReadinessReport {
  readonly ready: boolean;
  readonly status: StandardMaterialIblBindGroupLayoutStatus;
  readonly standardMaterialCount: number;
  readonly group: 4;
  readonly bindingCount: number;
  readonly sections: {
    readonly layoutMetadata: boolean;
    readonly layoutDescriptor: boolean;
    readonly bindGroupResource: false;
    readonly shaderSampling: false;
  };
  readonly layout: StandardMaterialIblBindGroupLayoutDescriptor | null;
  readonly diagnostics: readonly StandardMaterialIblBindGroupLayoutReadinessDiagnostic[];
}

export type StandardMaterialIblBindGroupLayoutReadinessReportJsonValue =
  StandardMaterialIblBindGroupLayoutReadinessReport;

export interface StandardMaterialIblBindGroupLayoutReadinessInput {
  readonly standardMaterialCount: number;
  readonly layoutKey?: string;
  readonly plan?: StandardMaterialIblBindGroupLayoutPlan;
}

export function createStandardMaterialIblBindGroupLayoutMetadata(
  layoutKey = "standard/ibl/group-4",
): StandardMaterialIblBindGroupLayoutMetadata {
  return {
    group: 4,
    name: "standardMaterialIbl",
    layoutKey,
    bindings: [
      textureBinding(0, "diffuseIrradianceTexture"),
      textureBinding(1, "specularPrefilterTexture"),
      samplerBinding(2, "iblSampler"),
    ],
  };
}

export function createStandardMaterialIblBindGroupLayoutPlan(
  layoutKey = "standard/ibl/group-4",
): StandardMaterialIblBindGroupLayoutPlan {
  const metadata = createStandardMaterialIblBindGroupLayoutMetadata(layoutKey);
  const layout: StandardMaterialIblBindGroupLayoutDescriptor = {
    group: 4,
    label: layoutKey,
    entries: metadata.bindings.map((binding) => ({
      binding: binding.binding,
      label: binding.name,
      resource: resourceKindToLayoutResource(binding.resourceKind),
    })),
    metadata,
  };
  const diagnostics = validateStandardMaterialIblBindGroupLayout(layout);

  return {
    valid: diagnostics.length === 0,
    layout,
    diagnostics,
  };
}

export function validateStandardMaterialIblBindGroupLayout(layout: {
  readonly group: number;
  readonly entries: readonly StandardMaterialIblBindGroupLayoutEntry[];
  readonly metadata?: StandardMaterialIblBindGroupLayoutMetadata;
}): readonly StandardMaterialIblBindGroupLayoutDiagnostic[] {
  const diagnostics: StandardMaterialIblBindGroupLayoutDiagnostic[] = [];
  const metadata =
    layout.metadata ?? createStandardMaterialIblBindGroupLayoutMetadata();

  if (layout.group !== 4) {
    diagnostics.push({
      code: "standardMaterialIblBindGroupLayout.invalidGroup",
      message: `Standard material IBL resources must use bind group 4; received group ${layout.group}.`,
    });
  }

  const entryByBinding = new Map(
    layout.entries.map((entry) => [entry.binding, entry]),
  );

  for (const binding of metadata.bindings) {
    if (!binding.required) {
      continue;
    }

    const entry = entryByBinding.get(binding.binding);

    if (entry === undefined) {
      diagnostics.push({
        code: "standardMaterialIblBindGroupLayout.missingBinding",
        binding: binding.binding,
        message: `Standard material IBL bind group layout is missing required binding ${binding.binding}.`,
      });
      continue;
    }

    const expected = resourceKindToLayoutResource(binding.resourceKind);

    if (entry.resource !== expected) {
      diagnostics.push({
        code: "standardMaterialIblBindGroupLayout.resourceKindMismatch",
        binding: binding.binding,
        message: `Standard material IBL binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
      });
    }
  }

  return diagnostics;
}

export function createStandardMaterialIblBindGroupLayoutReadinessReport(
  input: StandardMaterialIblBindGroupLayoutReadinessInput,
): StandardMaterialIblBindGroupLayoutReadinessReport {
  if (input.standardMaterialCount === 0) {
    return {
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      group: 4,
      bindingCount: 0,
      sections: {
        layoutMetadata: true,
        layoutDescriptor: true,
        bindGroupResource: false,
        shaderSampling: false,
      },
      layout: null,
      diagnostics: [],
    };
  }

  const plan =
    input.plan ?? createStandardMaterialIblBindGroupLayoutPlan(input.layoutKey);

  if (!plan.valid) {
    return {
      ready: false,
      status: "missing",
      standardMaterialCount: input.standardMaterialCount,
      group: 4,
      bindingCount: plan.layout.entries.length,
      sections: {
        layoutMetadata: true,
        layoutDescriptor: false,
        bindGroupResource: false,
        shaderSampling: false,
      },
      layout: plan.layout,
      diagnostics: [
        {
          code: "standardMaterialIblBindGroupLayout.invalidLayout",
          severity: "warning",
          message:
            "StandardMaterial IBL bind-group layout metadata is invalid.",
        },
      ],
    };
  }

  return {
    ready: false,
    status: "deferred",
    standardMaterialCount: input.standardMaterialCount,
    group: 4,
    bindingCount: plan.layout.entries.length,
    sections: {
      layoutMetadata: true,
      layoutDescriptor: true,
      bindGroupResource: false,
      shaderSampling: false,
    },
    layout: plan.layout,
    diagnostics: [
      {
        code: "standardMaterialIblBindGroupLayout.bindGroupResourceDeferred",
        severity: "warning",
        message:
          "StandardMaterial IBL bind-group layout metadata is planned, but bind group resource creation is deferred.",
      },
      {
        code: "standardMaterialIblBindGroupLayout.shaderSamplingDeferred",
        severity: "warning",
        message:
          "StandardMaterial IBL bind-group layout metadata is planned, but WGSL shader sampling is deferred.",
      },
    ],
  };
}

export function standardMaterialIblBindGroupLayoutReadinessReportToJsonValue(
  report: StandardMaterialIblBindGroupLayoutReadinessReport,
): StandardMaterialIblBindGroupLayoutReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    standardMaterialCount: report.standardMaterialCount,
    group: report.group,
    bindingCount: report.bindingCount,
    sections: { ...report.sections },
    layout:
      report.layout === null
        ? null
        : {
            ...report.layout,
            entries: report.layout.entries.map((entry) => ({ ...entry })),
            metadata: {
              ...report.layout.metadata,
              bindings: report.layout.metadata.bindings.map((binding) => ({
                ...binding,
                visibility: [...binding.visibility],
              })),
            },
          },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialIblBindGroupLayoutReadinessReportToJson(
  report: StandardMaterialIblBindGroupLayoutReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialIblBindGroupLayoutReadinessReportToJsonValue(report),
  );
}

function textureBinding(
  binding: number,
  name: string,
): StandardMaterialIblBindGroupLayoutBindingMetadata {
  return {
    binding,
    name,
    resourceKind: "texture-view",
    visibility: ["fragment"],
    required: true,
  };
}

function samplerBinding(
  binding: number,
  name: string,
): StandardMaterialIblBindGroupLayoutBindingMetadata {
  return {
    binding,
    name,
    resourceKind: "sampler",
    visibility: ["fragment"],
    required: true,
  };
}

function resourceKindToLayoutResource(
  kind: StandardMaterialBindGroupResourceKind,
): StandardMaterialIblBindGroupLayoutEntry["resource"] {
  switch (kind) {
    case "texture-view":
      return "texture";
    case "sampler":
      return "sampler";
    case "buffer":
      return "uniform-buffer";
  }
}
