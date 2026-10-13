import type { StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";

export type StandardMaterialShadowShaderVisibility =
  | "vertex"
  | "fragment"
  | "compute";

export type StandardMaterialShadowBindGroupLayoutStatus =
  | "deferred"
  | "missing"
  | "not-required";

export interface StandardMaterialShadowBindGroupLayoutBindingMetadata {
  readonly binding: number;
  readonly name: string;
  readonly resourceKind: StandardMaterialBindGroupResourceKind;
  readonly visibility: readonly StandardMaterialShadowShaderVisibility[];
  readonly required: boolean;
}

export interface StandardMaterialShadowBindGroupLayoutMetadata {
  readonly group: 5;
  readonly name: "standardMaterialShadow";
  readonly layoutKey: string;
  readonly bindings: readonly StandardMaterialShadowBindGroupLayoutBindingMetadata[];
}

export interface StandardMaterialShadowBindGroupLayoutEntry {
  readonly binding: number;
  readonly label: string;
  readonly resource: "read-only-storage-buffer" | "texture" | "sampler";
}

export interface StandardMaterialShadowBindGroupLayoutDescriptor {
  readonly group: 5;
  readonly label: string;
  readonly entries: readonly StandardMaterialShadowBindGroupLayoutEntry[];
  readonly metadata: StandardMaterialShadowBindGroupLayoutMetadata;
}

export type StandardMaterialShadowBindGroupLayoutDiagnosticCode =
  | "standardMaterialShadowBindGroupLayout.invalidGroup"
  | "standardMaterialShadowBindGroupLayout.missingBinding"
  | "standardMaterialShadowBindGroupLayout.resourceKindMismatch";

export interface StandardMaterialShadowBindGroupLayoutDiagnostic {
  readonly code: StandardMaterialShadowBindGroupLayoutDiagnosticCode;
  readonly message: string;
  readonly binding?: number;
}

export interface StandardMaterialShadowBindGroupLayoutPlan {
  readonly valid: boolean;
  readonly layout: StandardMaterialShadowBindGroupLayoutDescriptor;
  readonly diagnostics: readonly StandardMaterialShadowBindGroupLayoutDiagnostic[];
}

export interface StandardMaterialShadowBindGroupLayoutReadinessDiagnostic {
  readonly code:
    | "standardMaterialShadowBindGroupLayout.invalidLayout"
    | "standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred"
    | "standardMaterialShadowBindGroupLayout.shaderSamplingDeferred";
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface StandardMaterialShadowBindGroupLayoutReadinessReport {
  readonly ready: boolean;
  readonly status: StandardMaterialShadowBindGroupLayoutStatus;
  readonly standardMaterialCount: number;
  readonly group: 5;
  readonly bindingCount: number;
  readonly sections: {
    readonly layoutMetadata: boolean;
    readonly layoutDescriptor: boolean;
    readonly bindGroupResource: false;
    readonly shaderSampling: false;
  };
  readonly layout: StandardMaterialShadowBindGroupLayoutDescriptor | null;
  readonly diagnostics: readonly StandardMaterialShadowBindGroupLayoutReadinessDiagnostic[];
}

export type StandardMaterialShadowBindGroupLayoutReadinessReportJsonValue =
  StandardMaterialShadowBindGroupLayoutReadinessReport;

export interface StandardMaterialShadowBindGroupLayoutReadinessInput {
  readonly standardMaterialCount: number;
  readonly layoutKey?: string;
  readonly plan?: StandardMaterialShadowBindGroupLayoutPlan;
}

export function createStandardMaterialShadowBindGroupLayoutMetadata(
  layoutKey = "standard/shadow/group-5",
): StandardMaterialShadowBindGroupLayoutMetadata {
  return {
    group: 5,
    name: "standardMaterialShadow",
    layoutKey,
    bindings: [
      bufferBinding(0, "directionalShadowMatrices"),
      textureBinding(1, "directionalShadowMap"),
      samplerBinding(2, "directionalShadowSampler"),
    ],
  };
}

export function createStandardMaterialShadowBindGroupLayoutPlan(
  layoutKey = "standard/shadow/group-5",
): StandardMaterialShadowBindGroupLayoutPlan {
  const metadata =
    createStandardMaterialShadowBindGroupLayoutMetadata(layoutKey);
  const layout: StandardMaterialShadowBindGroupLayoutDescriptor = {
    group: 5,
    label: layoutKey,
    entries: metadata.bindings.map((binding) => ({
      binding: binding.binding,
      label: binding.name,
      resource: resourceKindToLayoutResource(binding.resourceKind),
    })),
    metadata,
  };
  const diagnostics = validateStandardMaterialShadowBindGroupLayout(layout);

  return {
    valid: diagnostics.length === 0,
    layout,
    diagnostics,
  };
}

export function validateStandardMaterialShadowBindGroupLayout(layout: {
  readonly group: number;
  readonly entries: readonly StandardMaterialShadowBindGroupLayoutEntry[];
  readonly metadata?: StandardMaterialShadowBindGroupLayoutMetadata;
}): readonly StandardMaterialShadowBindGroupLayoutDiagnostic[] {
  const diagnostics: StandardMaterialShadowBindGroupLayoutDiagnostic[] = [];
  const metadata =
    layout.metadata ?? createStandardMaterialShadowBindGroupLayoutMetadata();

  if (layout.group !== 5) {
    diagnostics.push({
      code: "standardMaterialShadowBindGroupLayout.invalidGroup",
      message: `Standard material shadow resources must use bind group 5; received group ${layout.group}.`,
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
        code: "standardMaterialShadowBindGroupLayout.missingBinding",
        binding: binding.binding,
        message: `Standard material shadow bind group layout is missing required binding ${binding.binding}.`,
      });
      continue;
    }

    const expected = resourceKindToLayoutResource(binding.resourceKind);

    if (entry.resource !== expected) {
      diagnostics.push({
        code: "standardMaterialShadowBindGroupLayout.resourceKindMismatch",
        binding: binding.binding,
        message: `Standard material shadow binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
      });
    }
  }

  return diagnostics;
}

export function createStandardMaterialShadowBindGroupLayoutReadinessReport(
  input: StandardMaterialShadowBindGroupLayoutReadinessInput,
): StandardMaterialShadowBindGroupLayoutReadinessReport {
  if (input.standardMaterialCount === 0) {
    return {
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      group: 5,
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
    input.plan ??
    createStandardMaterialShadowBindGroupLayoutPlan(input.layoutKey);

  if (!plan.valid) {
    return {
      ready: false,
      status: "missing",
      standardMaterialCount: input.standardMaterialCount,
      group: 5,
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
          code: "standardMaterialShadowBindGroupLayout.invalidLayout",
          severity: "warning",
          message:
            "StandardMaterial shadow bind-group layout metadata is invalid.",
        },
      ],
    };
  }

  return {
    ready: false,
    status: "deferred",
    standardMaterialCount: input.standardMaterialCount,
    group: 5,
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
        code: "standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred",
        severity: "warning",
        message:
          "StandardMaterial shadow bind-group layout metadata is planned, but bind group resource creation is deferred.",
      },
      {
        code: "standardMaterialShadowBindGroupLayout.shaderSamplingDeferred",
        severity: "warning",
        message:
          "StandardMaterial shadow bind-group layout metadata is planned, but WGSL shader sampling is deferred.",
      },
    ],
  };
}

export function standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue(
  report: StandardMaterialShadowBindGroupLayoutReadinessReport,
): StandardMaterialShadowBindGroupLayoutReadinessReportJsonValue {
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

export function standardMaterialShadowBindGroupLayoutReadinessReportToJson(
  report: StandardMaterialShadowBindGroupLayoutReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue(report),
  );
}

function bufferBinding(
  binding: number,
  name: string,
): StandardMaterialShadowBindGroupLayoutBindingMetadata {
  return {
    binding,
    name,
    resourceKind: "buffer",
    visibility: ["vertex", "fragment"],
    required: true,
  };
}

function textureBinding(
  binding: number,
  name: string,
): StandardMaterialShadowBindGroupLayoutBindingMetadata {
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
): StandardMaterialShadowBindGroupLayoutBindingMetadata {
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
): StandardMaterialShadowBindGroupLayoutEntry["resource"] {
  switch (kind) {
    case "buffer":
      return "read-only-storage-buffer";
    case "texture-view":
      return "texture";
    case "sampler":
      return "sampler";
  }
}
