import type { MatcapMaterialBindGroupResourceKind } from "./matcap-bind-group.js";

export type MatcapMaterialShaderVisibility = "vertex" | "fragment" | "compute";

export interface MatcapMaterialBindGroupLayoutBindingMetadata {
  readonly binding: number;
  readonly name: string;
  readonly resourceKind: MatcapMaterialBindGroupResourceKind;
  readonly visibility: readonly MatcapMaterialShaderVisibility[];
  readonly required: boolean;
}

export interface MatcapMaterialBindGroupLayoutMetadata {
  readonly group: number;
  readonly name: string;
  readonly layoutKey: string;
  readonly bindings: readonly MatcapMaterialBindGroupLayoutBindingMetadata[];
}

export interface MatcapMaterialBindGroupLayoutEntry {
  readonly binding: number;
  readonly label: string;
  readonly resource: "uniform-buffer" | "texture" | "sampler";
}

export interface MatcapMaterialBindGroupLayoutDescriptor {
  readonly group: 2;
  readonly label: string;
  readonly entries: readonly MatcapMaterialBindGroupLayoutEntry[];
  readonly metadata: MatcapMaterialBindGroupLayoutMetadata;
}

export type MatcapMaterialBindGroupLayoutDiagnosticCode =
  | "matcapMaterialBindGroupLayout.invalidGroup"
  | "matcapMaterialBindGroupLayout.missingBinding"
  | "matcapMaterialBindGroupLayout.resourceKindMismatch";

export interface MatcapMaterialBindGroupLayoutDiagnostic {
  readonly code: MatcapMaterialBindGroupLayoutDiagnosticCode;
  readonly message: string;
  readonly binding?: number;
}

export interface MatcapMaterialBindGroupLayoutPlan {
  readonly valid: boolean;
  readonly layout: MatcapMaterialBindGroupLayoutDescriptor;
  readonly diagnostics: readonly MatcapMaterialBindGroupLayoutDiagnostic[];
}

export function createMatcapMaterialBindGroupLayoutMetadata(
  layoutKey = "matcap/group-2",
): MatcapMaterialBindGroupLayoutMetadata {
  return {
    group: 2,
    name: "matcapMaterial",
    layoutKey,
    bindings: [
      {
        binding: 0,
        name: "matcapMaterial",
        resourceKind: "buffer",
        visibility: ["fragment"],
        required: true,
      },
      {
        binding: 1,
        name: "matcapTexture",
        resourceKind: "texture-view",
        visibility: ["fragment"],
        required: true,
      },
      {
        binding: 2,
        name: "matcapSampler",
        resourceKind: "sampler",
        visibility: ["fragment"],
        required: true,
      },
    ],
  };
}

export function createMatcapMaterialBindGroupLayoutPlan(
  layoutKey = "matcap/group-2",
): MatcapMaterialBindGroupLayoutPlan {
  const metadata = createMatcapMaterialBindGroupLayoutMetadata(layoutKey);
  const layout: MatcapMaterialBindGroupLayoutDescriptor = {
    group: 2,
    label: "matcap/group-2",
    entries: metadata.bindings.map((binding) => ({
      binding: binding.binding,
      label: binding.name,
      resource: resourceKindToLayoutResource(binding.resourceKind),
    })),
    metadata,
  };
  const diagnostics = validateMatcapMaterialBindGroupLayout(layout);

  return {
    valid: diagnostics.length === 0,
    layout,
    diagnostics,
  };
}

export function validateMatcapMaterialBindGroupLayout(layout: {
  readonly group: number;
  readonly entries: readonly MatcapMaterialBindGroupLayoutEntry[];
  readonly metadata?: MatcapMaterialBindGroupLayoutMetadata;
}): readonly MatcapMaterialBindGroupLayoutDiagnostic[] {
  const diagnostics: MatcapMaterialBindGroupLayoutDiagnostic[] = [];
  const metadata =
    layout.metadata ?? createMatcapMaterialBindGroupLayoutMetadata();

  if (layout.group !== 2) {
    diagnostics.push({
      code: "matcapMaterialBindGroupLayout.invalidGroup",
      message: `Matcap material resources must use bind group 2; received group ${layout.group}.`,
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
        code: "matcapMaterialBindGroupLayout.missingBinding",
        binding: binding.binding,
        message: `Matcap material bind group layout is missing required binding ${binding.binding}.`,
      });
      continue;
    }

    const expected = resourceKindToLayoutResource(binding.resourceKind);

    if (entry.resource !== expected) {
      diagnostics.push({
        code: "matcapMaterialBindGroupLayout.resourceKindMismatch",
        binding: binding.binding,
        message: `Matcap material binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
      });
    }
  }

  return diagnostics;
}

function resourceKindToLayoutResource(
  kind: MatcapMaterialBindGroupResourceKind,
): MatcapMaterialBindGroupLayoutEntry["resource"] {
  switch (kind) {
    case "buffer":
      return "uniform-buffer";
    case "texture-view":
      return "texture";
    case "sampler":
      return "sampler";
  }
}
