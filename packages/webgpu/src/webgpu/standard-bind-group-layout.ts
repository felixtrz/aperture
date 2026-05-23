import type { StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";

export type StandardMaterialShaderVisibility =
  | "vertex"
  | "fragment"
  | "compute";

export interface StandardMaterialBindGroupLayoutBindingMetadata {
  readonly binding: number;
  readonly name: string;
  readonly resourceKind: StandardMaterialBindGroupResourceKind;
  readonly visibility: readonly StandardMaterialShaderVisibility[];
  readonly required: boolean;
}

export interface StandardMaterialBindGroupLayoutMetadata {
  readonly group: number;
  readonly name: string;
  readonly layoutKey: string;
  readonly bindings: readonly StandardMaterialBindGroupLayoutBindingMetadata[];
}

export interface StandardMaterialBindGroupLayoutEntry {
  readonly binding: number;
  readonly label: string;
  readonly resource: "uniform-buffer" | "texture" | "sampler";
}

export interface StandardMaterialBindGroupLayoutDescriptor {
  readonly group: 2;
  readonly label: string;
  readonly entries: readonly StandardMaterialBindGroupLayoutEntry[];
  readonly metadata: StandardMaterialBindGroupLayoutMetadata;
}

export type StandardMaterialBindGroupLayoutDiagnosticCode =
  | "standardMaterialBindGroupLayout.invalidGroup"
  | "standardMaterialBindGroupLayout.missingBinding"
  | "standardMaterialBindGroupLayout.resourceKindMismatch";

export interface StandardMaterialBindGroupLayoutDiagnostic {
  readonly code: StandardMaterialBindGroupLayoutDiagnosticCode;
  readonly message: string;
  readonly binding?: number;
}

export interface StandardMaterialBindGroupLayoutPlan {
  readonly valid: boolean;
  readonly layout: StandardMaterialBindGroupLayoutDescriptor;
  readonly diagnostics: readonly StandardMaterialBindGroupLayoutDiagnostic[];
}

export function createStandardMaterialBindGroupLayoutMetadata(
  layoutKey = "standard/group-2",
): StandardMaterialBindGroupLayoutMetadata {
  return {
    group: 2,
    name: "standardMaterial",
    layoutKey,
    bindings: [
      {
        binding: 0,
        name: "standardMaterial",
        resourceKind: "buffer",
        visibility: ["fragment"],
        required: true,
      },
      textureBinding(1, "baseColorTexture"),
      samplerBinding(2, "baseColorSampler"),
      textureBinding(3, "metallicRoughnessTexture"),
      samplerBinding(4, "metallicRoughnessSampler"),
      textureBinding(5, "normalTexture"),
      samplerBinding(6, "normalSampler"),
      textureBinding(7, "occlusionTexture"),
      samplerBinding(8, "occlusionSampler"),
      textureBinding(9, "emissiveTexture"),
      samplerBinding(10, "emissiveSampler"),
      textureBinding(11, "clearcoatTexture"),
      samplerBinding(12, "clearcoatSampler"),
    ],
  };
}

export function createStandardMaterialBindGroupLayoutPlan(
  layoutKey = "standard/group-2",
): StandardMaterialBindGroupLayoutPlan {
  const metadata = createStandardMaterialBindGroupLayoutMetadata(layoutKey);
  const layout: StandardMaterialBindGroupLayoutDescriptor = {
    group: 2,
    label: "standard/group-2",
    entries: metadata.bindings.map((binding) => ({
      binding: binding.binding,
      label: binding.name,
      resource: resourceKindToLayoutResource(binding.resourceKind),
    })),
    metadata,
  };
  const diagnostics = validateStandardMaterialBindGroupLayout(layout);

  return {
    valid: diagnostics.length === 0,
    layout,
    diagnostics,
  };
}

export function validateStandardMaterialBindGroupLayout(layout: {
  readonly group: number;
  readonly entries: readonly StandardMaterialBindGroupLayoutEntry[];
  readonly metadata?: StandardMaterialBindGroupLayoutMetadata;
}): readonly StandardMaterialBindGroupLayoutDiagnostic[] {
  const diagnostics: StandardMaterialBindGroupLayoutDiagnostic[] = [];
  const metadata =
    layout.metadata ?? createStandardMaterialBindGroupLayoutMetadata();

  if (layout.group !== 2) {
    diagnostics.push({
      code: "standardMaterialBindGroupLayout.invalidGroup",
      message: `Standard material resources must use bind group 2; received group ${layout.group}.`,
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
        code: "standardMaterialBindGroupLayout.missingBinding",
        binding: binding.binding,
        message: `Standard material bind group layout is missing required binding ${binding.binding}.`,
      });
      continue;
    }

    const expected = resourceKindToLayoutResource(binding.resourceKind);

    if (entry.resource !== expected) {
      diagnostics.push({
        code: "standardMaterialBindGroupLayout.resourceKindMismatch",
        binding: binding.binding,
        message: `Standard material binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
      });
    }
  }

  return diagnostics;
}

function textureBinding(
  binding: number,
  name: string,
): StandardMaterialBindGroupLayoutBindingMetadata {
  return {
    binding,
    name,
    resourceKind: "texture-view",
    visibility: ["fragment"],
    required: false,
  };
}

function samplerBinding(
  binding: number,
  name: string,
): StandardMaterialBindGroupLayoutBindingMetadata {
  return {
    binding,
    name,
    resourceKind: "sampler",
    visibility: ["fragment"],
    required: false,
  };
}

function resourceKindToLayoutResource(
  kind: StandardMaterialBindGroupResourceKind,
): StandardMaterialBindGroupLayoutEntry["resource"] {
  switch (kind) {
    case "buffer":
      return "uniform-buffer";
    case "texture-view":
      return "texture";
    case "sampler":
      return "sampler";
  }
}
