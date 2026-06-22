import type { DebugNormalMaterialBindGroupResourceKind } from "./debug-normal-bind-group.js";

export type DebugNormalMaterialShaderVisibility =
  | "vertex"
  | "fragment"
  | "compute";

export interface DebugNormalMaterialBindGroupLayoutBindingMetadata {
  readonly binding: number;
  readonly name: string;
  readonly resourceKind: DebugNormalMaterialBindGroupResourceKind;
  readonly visibility: readonly DebugNormalMaterialShaderVisibility[];
  readonly required: boolean;
}

export interface DebugNormalMaterialBindGroupLayoutMetadata {
  readonly group: number;
  readonly name: string;
  readonly layoutKey: string;
  readonly bindings: readonly DebugNormalMaterialBindGroupLayoutBindingMetadata[];
}

export interface DebugNormalMaterialBindGroupLayoutEntry {
  readonly binding: number;
  readonly label: string;
  readonly resource: "uniform-buffer";
}

export interface DebugNormalMaterialBindGroupLayoutDescriptor {
  readonly group: 2;
  readonly label: string;
  readonly entries: readonly DebugNormalMaterialBindGroupLayoutEntry[];
  readonly metadata: DebugNormalMaterialBindGroupLayoutMetadata;
}

export type DebugNormalMaterialBindGroupLayoutDiagnosticCode =
  | "debugNormalMaterialBindGroupLayout.invalidGroup"
  | "debugNormalMaterialBindGroupLayout.missingBinding"
  | "debugNormalMaterialBindGroupLayout.resourceKindMismatch";

export interface DebugNormalMaterialBindGroupLayoutDiagnostic {
  readonly code: DebugNormalMaterialBindGroupLayoutDiagnosticCode;
  readonly message: string;
  readonly binding?: number;
}

export interface DebugNormalMaterialBindGroupLayoutPlan {
  readonly valid: boolean;
  readonly layout: DebugNormalMaterialBindGroupLayoutDescriptor;
  readonly diagnostics: readonly DebugNormalMaterialBindGroupLayoutDiagnostic[];
}

export function createDebugNormalMaterialBindGroupLayoutMetadata(
  layoutKey = "debug-normal/group-2",
): DebugNormalMaterialBindGroupLayoutMetadata {
  return {
    group: 2,
    name: "debugNormalMaterial",
    layoutKey,
    bindings: [
      {
        binding: 0,
        name: "debugNormalMaterial",
        resourceKind: "buffer",
        visibility: ["fragment"],
        required: true,
      },
    ],
  };
}

export function createDebugNormalMaterialBindGroupLayoutPlan(
  layoutKey = "debug-normal/group-2",
): DebugNormalMaterialBindGroupLayoutPlan {
  const metadata = createDebugNormalMaterialBindGroupLayoutMetadata(layoutKey);
  const layout: DebugNormalMaterialBindGroupLayoutDescriptor = {
    group: 2,
    label: "debug-normal/group-2",
    entries: metadata.bindings.map((binding) => ({
      binding: binding.binding,
      label: binding.name,
      resource: "uniform-buffer",
    })),
    metadata,
  };
  const diagnostics = validateDebugNormalMaterialBindGroupLayout(layout);

  return {
    valid: diagnostics.length === 0,
    layout,
    diagnostics,
  };
}

export function validateDebugNormalMaterialBindGroupLayout(layout: {
  readonly group: number;
  readonly entries: readonly DebugNormalMaterialBindGroupLayoutEntry[];
  readonly metadata?: DebugNormalMaterialBindGroupLayoutMetadata;
}): readonly DebugNormalMaterialBindGroupLayoutDiagnostic[] {
  const diagnostics: DebugNormalMaterialBindGroupLayoutDiagnostic[] = [];
  const metadata =
    layout.metadata ?? createDebugNormalMaterialBindGroupLayoutMetadata();

  if (layout.group !== 2) {
    diagnostics.push({
      code: "debugNormalMaterialBindGroupLayout.invalidGroup",
      message: `DebugNormal material resources must use bind group 2; received group ${layout.group}.`,
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
        code: "debugNormalMaterialBindGroupLayout.missingBinding",
        binding: binding.binding,
        message: `DebugNormal material bind group layout is missing required binding ${binding.binding}.`,
      });
      continue;
    }

    if (entry.resource !== "uniform-buffer") {
      diagnostics.push({
        code: "debugNormalMaterialBindGroupLayout.resourceKindMismatch",
        binding: binding.binding,
        message: `DebugNormal material binding ${binding.binding} must be 'uniform-buffer', not '${entry.resource}'.`,
      });
    }
  }

  return diagnostics;
}
