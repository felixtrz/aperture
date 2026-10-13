import {
  UNLIT_MESH_SHADER,
  type BuiltInShaderBindingMetadata,
  type BuiltInShaderSourceModule,
} from "./unlit-shader.js";
import {
  createUnlitBindGroupLayoutMetadata,
  type UnlitBindGroupLayoutMetadata,
} from "./unlit-bind-group.js";

export type UnlitBindGroupLayoutDiagnosticCode =
  | "unlitBindGroupLayout.missingBinding"
  | "unlitBindGroupLayout.unsupportedResource";

export interface UnlitBindGroupLayoutDiagnostic {
  readonly code: UnlitBindGroupLayoutDiagnosticCode;
  readonly message: string;
  readonly bindingId?: string;
}

export interface UnlitBindGroupLayoutEntry {
  readonly binding: number;
  readonly label: string;
  readonly resource: BuiltInShaderBindingMetadata["resource"];
}

export interface UnlitBindGroupLayoutDescriptor {
  readonly group: number;
  readonly label: string;
  readonly entries: readonly UnlitBindGroupLayoutEntry[];
  readonly metadata: UnlitBindGroupLayoutMetadata;
}

export interface UnlitBindGroupLayoutPlan {
  readonly layouts: readonly UnlitBindGroupLayoutDescriptor[];
  readonly diagnostics: readonly UnlitBindGroupLayoutDiagnostic[];
  readonly valid: boolean;
}

export function createUnlitBindGroupLayoutPlan(
  shader: BuiltInShaderSourceModule = UNLIT_MESH_SHADER,
): UnlitBindGroupLayoutPlan {
  const diagnostics: UnlitBindGroupLayoutDiagnostic[] = [];
  const required = ["viewProjection", "worldTransforms", "unlitMaterial"];
  const bindings = new Map(
    shader.bindings.map((binding) => [binding.id, binding]),
  );
  const layouts = new Map<number, UnlitBindGroupLayoutDescriptor>();

  for (const id of required) {
    const binding = bindings.get(id as BuiltInShaderBindingMetadata["id"]);

    if (binding === undefined) {
      diagnostics.push({
        code: "unlitBindGroupLayout.missingBinding",
        bindingId: id,
        message: `Unlit shader metadata is missing '${id}' binding metadata.`,
      });
      continue;
    }

    addBindingLayout(binding, layouts, diagnostics);
  }

  for (const binding of shader.bindings) {
    if (required.includes(binding.id)) {
      continue;
    }

    addBindingLayout(binding, layouts, diagnostics);
  }

  return {
    valid: diagnostics.length === 0,
    layouts: [...layouts.values()]
      .sort((a, b) => a.group - b.group)
      .map((layout) => ({
        ...layout,
        metadata: createUnlitBindGroupLayoutMetadata(
          layout.group,
          layout.label,
        ),
      })),
    diagnostics,
  };
}

function addBindingLayout(
  binding: BuiltInShaderBindingMetadata,
  layouts: Map<number, UnlitBindGroupLayoutDescriptor>,
  diagnostics: UnlitBindGroupLayoutDiagnostic[],
): void {
  if (!isSupportedBindGroupResource(binding.resource)) {
    diagnostics.push({
      code: "unlitBindGroupLayout.unsupportedResource",
      bindingId: binding.id,
      message: `Unsupported unlit binding resource '${String(binding.resource)}'.`,
    });
    return;
  }

  const current =
    layouts.get(binding.group) ??
    ({
      group: binding.group,
      label: `unlit/group-${binding.group}`,
      entries: [],
      metadata: createUnlitBindGroupLayoutMetadata(
        binding.group,
        `unlit/group-${binding.group}`,
      ),
    } satisfies UnlitBindGroupLayoutDescriptor);

  layouts.set(binding.group, {
    ...current,
    entries: [
      ...current.entries,
      {
        binding: binding.binding,
        label: binding.label,
        resource: binding.resource,
      },
    ].sort((a, b) => a.binding - b.binding),
  });
}

function isSupportedBindGroupResource(
  resource: BuiltInShaderBindingMetadata["resource"],
): boolean {
  return (
    resource === "uniform-buffer" ||
    resource === "read-only-storage-buffer" ||
    resource === "texture" ||
    resource === "sampler"
  );
}
