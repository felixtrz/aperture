import { bindGroupResourceKey } from "./resource-keys.js";

export type UnlitBindGroupDescriptorDiagnosticCode =
  | "unlitBindGroup.missingViewResource"
  | "unlitBindGroup.missingTransformResource"
  | "unlitBindGroup.missingMaterialResource"
  | "unlitBindGroup.missingBaseColorTextureResource"
  | "unlitBindGroup.missingBaseColorSamplerResource";

export interface UnlitBindGroupDescriptorDiagnostic {
  readonly code: UnlitBindGroupDescriptorDiagnosticCode;
  readonly message: string;
}

export interface UnlitBindGroupResourceInput {
  readonly viewUniformResourceKey: string | null;
  readonly worldTransformResourceKey: string | null;
  readonly materialResourceKey: string | null;
  readonly baseColorTextureResourceKey?: string | null;
  readonly baseColorSamplerResourceKey?: string | null;
}

export type UnlitBindGroupResourceKind = "buffer" | "texture-view" | "sampler";

export interface UnlitBindGroupDescriptorEntry {
  readonly group: number;
  readonly binding: number;
  readonly resourceKey: string;
  readonly resourceKind: UnlitBindGroupResourceKind;
}

export interface UnlitBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly entries: readonly UnlitBindGroupDescriptorEntry[];
  readonly diagnostics: readonly UnlitBindGroupDescriptorDiagnostic[];
}

export type UnlitBindGroupResourceDiagnosticCode =
  | "unlitBindGroupResource.nullDescriptorPlan"
  | "unlitBindGroupResource.invalidDescriptorPlan"
  | "unlitBindGroupResource.missingLayout"
  | "unlitBindGroupResource.missingDeviceSupport"
  | "unlitBindGroupResource.missingBufferResource"
  | "unlitBindGroupResource.missingTextureResource"
  | "unlitBindGroupResource.missingSamplerResource";

export interface UnlitBindGroupResourceDiagnostic {
  readonly code: UnlitBindGroupResourceDiagnosticCode;
  readonly message: string;
  readonly group?: number;
  readonly resourceKey?: string;
}

export interface UnlitBindGroupLayoutResource {
  readonly group: number;
  readonly layoutKey: string;
  readonly layout: unknown;
}

export interface UnlitBindGroupCreationEntry {
  readonly binding: number;
  readonly resource: unknown;
}

export interface UnlitBindGroupCreationDescriptor {
  readonly label: string;
  readonly layout: unknown;
  readonly entries: readonly UnlitBindGroupCreationEntry[];
}

export interface UnlitBindGroupDeviceLike {
  createBindGroup?: (descriptor: UnlitBindGroupCreationDescriptor) => unknown;
}

export interface UnlitBindGroupResource {
  readonly group: number;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface CreateUnlitBindGroupsOptions {
  readonly device: UnlitBindGroupDeviceLike;
  readonly plan: UnlitBindGroupDescriptorPlan | null;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
}

export interface UnlitBindGroupBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
}

export interface UnlitBindGroupTextureResource {
  readonly resourceKey: string;
  readonly view: unknown;
}

export interface UnlitBindGroupSamplerResource {
  readonly resourceKey: string;
  readonly sampler: unknown;
}

export interface CreateUnlitBindGroupsFromBuffersOptions {
  readonly device: UnlitBindGroupDeviceLike;
  readonly plan: UnlitBindGroupDescriptorPlan | null;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
  readonly buffers: readonly UnlitBindGroupBufferResource[];
}

export interface CreateUnlitBindGroupsFromGpuResourcesOptions extends CreateUnlitBindGroupsFromBuffersOptions {
  readonly textures?: readonly UnlitBindGroupTextureResource[] | undefined;
  readonly samplers?: readonly UnlitBindGroupSamplerResource[] | undefined;
}

export interface CreateUnlitBindGroupsResult {
  readonly valid: boolean;
  readonly resources: readonly UnlitBindGroupResource[];
  readonly diagnostics: readonly UnlitBindGroupResourceDiagnostic[];
}

export function createUnlitBindGroupDescriptorPlan(
  input: UnlitBindGroupResourceInput,
): UnlitBindGroupDescriptorPlan {
  const diagnostics: UnlitBindGroupDescriptorDiagnostic[] = [];
  const entries: UnlitBindGroupDescriptorEntry[] = [];

  if (input.viewUniformResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingViewResource",
      message: "Unlit bind group planning requires a view uniform resource.",
    });
  } else {
    entries.push({
      group: 0,
      binding: 0,
      resourceKey: input.viewUniformResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.worldTransformResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingTransformResource",
      message:
        "Unlit bind group planning requires a world transform buffer resource.",
    });
  } else {
    entries.push({
      group: 1,
      binding: 0,
      resourceKey: input.worldTransformResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.materialResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingMaterialResource",
      message:
        "Unlit bind group planning requires a material uniform resource.",
    });
  } else {
    entries.push({
      group: 2,
      binding: 0,
      resourceKey: input.materialResourceKey,
      resourceKind: "buffer",
    });
  }

  const textured =
    input.baseColorTextureResourceKey != null ||
    input.baseColorSamplerResourceKey != null;

  if (textured && input.baseColorTextureResourceKey == null) {
    diagnostics.push({
      code: "unlitBindGroup.missingBaseColorTextureResource",
      message:
        "Textured unlit bind group planning requires a base-color texture resource.",
    });
  } else if (input.baseColorTextureResourceKey != null) {
    entries.push({
      group: 2,
      binding: 1,
      resourceKey: input.baseColorTextureResourceKey,
      resourceKind: "texture-view",
    });
  }

  if (textured && input.baseColorSamplerResourceKey == null) {
    diagnostics.push({
      code: "unlitBindGroup.missingBaseColorSamplerResource",
      message:
        "Textured unlit bind group planning requires a base-color sampler resource.",
    });
  } else if (input.baseColorSamplerResourceKey != null) {
    entries.push({
      group: 2,
      binding: 2,
      resourceKey: input.baseColorSamplerResourceKey,
      resourceKind: "sampler",
    });
  }

  return {
    valid: diagnostics.length === 0,
    entries,
    diagnostics,
  };
}

export function createUnlitBindGroups(
  options: CreateUnlitBindGroupsOptions,
): CreateUnlitBindGroupsResult {
  return createUnlitBindGroupResources({
    device: options.device,
    plan: options.plan,
    layouts: options.layouts,
    resolveResource: (entry) => ({ resourceKey: entry.resourceKey }),
  });
}

export function createUnlitBindGroupsFromBuffers(
  options: CreateUnlitBindGroupsFromBuffersOptions,
): CreateUnlitBindGroupsResult {
  return createUnlitBindGroupsFromGpuResources(options);
}

export function createUnlitBindGroupsFromGpuResources(
  options: CreateUnlitBindGroupsFromGpuResourcesOptions,
): CreateUnlitBindGroupsResult {
  const buffers = new Map(
    options.buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]),
  );
  const textures = new Map(
    (options.textures ?? []).map((texture) => [
      texture.resourceKey,
      texture.view,
    ]),
  );
  const samplers = new Map(
    (options.samplers ?? []).map((sampler) => [
      sampler.resourceKey,
      sampler.sampler,
    ]),
  );

  return createUnlitBindGroupResources({
    device: options.device,
    plan: options.plan,
    layouts: options.layouts,
    resolveResource: (entry, diagnostics) => {
      switch (entry.resourceKind) {
        case "buffer": {
          const buffer = buffers.get(entry.resourceKey);

          if (buffer === undefined) {
            diagnostics.push({
              code: "unlitBindGroupResource.missingBufferResource",
              resourceKey: entry.resourceKey,
              group: entry.group,
              message: `Missing GPU buffer resource '${entry.resourceKey}' for unlit group ${entry.group}.`,
            });
            return null;
          }

          return { buffer };
        }
        case "texture-view": {
          const texture = textures.get(entry.resourceKey);

          if (texture === undefined) {
            diagnostics.push({
              code: "unlitBindGroupResource.missingTextureResource",
              resourceKey: entry.resourceKey,
              group: entry.group,
              message: `Missing GPU texture view resource '${entry.resourceKey}' for unlit group ${entry.group}.`,
            });
            return null;
          }

          return texture;
        }
        case "sampler": {
          const sampler = samplers.get(entry.resourceKey);

          if (sampler === undefined) {
            diagnostics.push({
              code: "unlitBindGroupResource.missingSamplerResource",
              resourceKey: entry.resourceKey,
              group: entry.group,
              message: `Missing GPU sampler resource '${entry.resourceKey}' for unlit group ${entry.group}.`,
            });
            return null;
          }

          return sampler;
        }
      }
    },
  });
}

interface CreateUnlitBindGroupResourcesOptions {
  readonly device: UnlitBindGroupDeviceLike;
  readonly plan: UnlitBindGroupDescriptorPlan | null;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
  readonly resolveResource: (
    entry: UnlitBindGroupDescriptorEntry,
    diagnostics: UnlitBindGroupResourceDiagnostic[],
  ) => UnlitBindGroupCreationEntry["resource"] | null;
}

function createUnlitBindGroupResources(
  options: CreateUnlitBindGroupResourcesOptions,
): CreateUnlitBindGroupsResult {
  if (options.plan === null) {
    return {
      valid: false,
      resources: [],
      diagnostics: [
        {
          code: "unlitBindGroupResource.nullDescriptorPlan",
          message:
            "Cannot create unlit bind groups from a null descriptor plan.",
        },
      ],
    };
  }

  const diagnostics: UnlitBindGroupResourceDiagnostic[] = [];

  if (!options.plan.valid) {
    diagnostics.push({
      code: "unlitBindGroupResource.invalidDescriptorPlan",
      message:
        "Cannot create complete unlit bind groups from an invalid descriptor plan.",
    });
  }

  if (options.device.createBindGroup === undefined) {
    return {
      valid: false,
      resources: [],
      diagnostics: [
        ...diagnostics,
        {
          code: "unlitBindGroupResource.missingDeviceSupport",
          message: "WebGPU device cannot create bind groups.",
        },
      ],
    };
  }

  const layoutByGroup = new Map(
    options.layouts.map((layout) => [layout.group, layout]),
  );
  const resources: UnlitBindGroupResource[] = [];

  for (const [group, entries] of groupPlanEntries(options.plan.entries)) {
    const layout = layoutByGroup.get(group);

    if (layout === undefined) {
      diagnostics.push({
        code: "unlitBindGroupResource.missingLayout",
        group,
        message: `Missing bind group layout resource for unlit group ${group}.`,
      });
      continue;
    }

    const descriptor = createBindGroupDescriptor(
      group,
      entries,
      layout.layout,
      options.resolveResource,
      diagnostics,
    );

    if (descriptor === null) {
      continue;
    }

    const bindGroup = options.device.createBindGroup(descriptor);

    resources.push({
      group,
      resourceKey: createUnlitBindGroupResourceKey(group, entries),
      layoutKey: layout.layoutKey,
      bindGroup,
      entryResourceKeys: entries.map((entry) => entry.resourceKey),
    });
  }

  return {
    valid: diagnostics.length === 0,
    resources,
    diagnostics,
  };
}

function groupPlanEntries(
  entries: readonly UnlitBindGroupDescriptorEntry[],
): ReadonlyMap<number, readonly UnlitBindGroupDescriptorEntry[]> {
  const groups = new Map<number, UnlitBindGroupDescriptorEntry[]>();

  for (const entry of entries) {
    const group = groups.get(entry.group) ?? [];

    group.push(entry);
    groups.set(entry.group, group);
  }

  return new Map(
    [...groups]
      .sort(([a], [b]) => a - b)
      .map(([group, groupEntries]) => [
        group,
        groupEntries.sort((a, b) => a.binding - b.binding),
      ]),
  );
}

function createBindGroupDescriptor(
  group: number,
  entries: readonly UnlitBindGroupDescriptorEntry[],
  layout: unknown,
  resolveResource: CreateUnlitBindGroupResourcesOptions["resolveResource"],
  diagnostics: UnlitBindGroupResourceDiagnostic[],
): UnlitBindGroupCreationDescriptor | null {
  const resolvedEntries = entries.flatMap((entry) => {
    const resource = resolveResource(entry, diagnostics);

    if (resource === null) {
      return [];
    }

    return [{ binding: entry.binding, resource }];
  });

  if (resolvedEntries.length !== entries.length) {
    return null;
  }

  return {
    label: `unlit/group-${group}`,
    layout,
    entries: resolvedEntries,
  };
}

function createUnlitBindGroupResourceKey(
  group: number,
  entries: readonly UnlitBindGroupDescriptorEntry[],
): string {
  return bindGroupResourceKey(
    [
      `unlit/group-${group}`,
      ...entries.map((entry) => `${entry.binding}:${entry.resourceKey}`),
    ].join("/"),
  );
}
