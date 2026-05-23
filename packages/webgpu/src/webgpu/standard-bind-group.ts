import { bindGroupResourceKey } from "./resource-keys.js";
import type { StandardMaterialResourceDependencies } from "./standard-material-buffer.js";
import {
  validateStandardMaterialBindGroupLayout,
  type StandardMaterialBindGroupLayoutDescriptor,
} from "./standard-bind-group-layout.js";

export type StandardMaterialBindGroupResourceKind =
  | "buffer"
  | "texture-view"
  | "sampler";

export type StandardMaterialTextureSlot =
  | "baseColor"
  | "metallicRoughness"
  | "normal"
  | "occlusion"
  | "emissive"
  | "clearcoat";

export type StandardMaterialBindGroupDescriptorDiagnosticCode =
  | "standardMaterialBindGroup.missingMaterialResource"
  | "standardMaterialBindGroup.missingTextureResource"
  | "standardMaterialBindGroup.missingSamplerResource";

export interface StandardMaterialBindGroupDescriptorDiagnostic {
  readonly code: StandardMaterialBindGroupDescriptorDiagnosticCode;
  readonly message: string;
  readonly slot?: StandardMaterialTextureSlot;
  readonly binding?: number;
}

export interface StandardMaterialBindGroupResourceInput {
  readonly materialResourceKey: string | null;
  readonly dependencies: StandardMaterialResourceDependencies;
}

export interface StandardMaterialBindGroupDescriptorEntry {
  readonly group: 2;
  readonly binding: number;
  readonly resourceKey: string;
  readonly resourceKind: StandardMaterialBindGroupResourceKind;
}

export interface StandardMaterialBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly group: 2;
  readonly resourceKey: string | null;
  readonly entries: readonly StandardMaterialBindGroupDescriptorEntry[];
  readonly diagnostics: readonly StandardMaterialBindGroupDescriptorDiagnostic[];
}

export type StandardMaterialBindGroupResourceDiagnosticCode =
  | "standardMaterialBindGroupResource.nullDescriptorPlan"
  | "standardMaterialBindGroupResource.invalidDescriptorPlan"
  | "standardMaterialBindGroupResource.missingLayout"
  | "standardMaterialBindGroupResource.invalidLayout"
  | "standardMaterialBindGroupResource.missingDeviceSupport"
  | "standardMaterialBindGroupResource.missingBufferResource"
  | "standardMaterialBindGroupResource.missingTextureResource"
  | "standardMaterialBindGroupResource.missingSamplerResource"
  | "standardMaterialBindGroupResource.creationFailed";

export interface StandardMaterialBindGroupResourceDiagnostic {
  readonly code: StandardMaterialBindGroupResourceDiagnosticCode;
  readonly message: string;
  readonly group?: 2;
  readonly binding?: number;
  readonly resourceKey?: string;
  readonly layoutKey?: string;
}

export interface StandardMaterialBindGroupLayoutResource {
  readonly group: number;
  readonly layoutKey: string;
  readonly layout: unknown;
  readonly descriptor?: StandardMaterialBindGroupLayoutDescriptor;
}

export interface StandardMaterialBindGroupBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
}

export interface StandardMaterialBindGroupTextureResource {
  readonly resourceKey: string;
  readonly view: unknown;
}

export interface StandardMaterialBindGroupSamplerResource {
  readonly resourceKey: string;
  readonly sampler: unknown;
}

export interface StandardMaterialBindGroupCreationEntry {
  readonly binding: number;
  readonly resource: unknown;
}

export interface StandardMaterialBindGroupCreationDescriptor {
  readonly label: string;
  readonly layout: unknown;
  readonly entries: readonly StandardMaterialBindGroupCreationEntry[];
}

export interface StandardMaterialBindGroupDeviceLike {
  createBindGroup?: (
    descriptor: StandardMaterialBindGroupCreationDescriptor,
  ) => unknown;
}

export interface StandardMaterialBindGroupResource {
  readonly group: 2;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface CreateStandardMaterialBindGroupResourceOptions {
  readonly device: StandardMaterialBindGroupDeviceLike;
  readonly plan: StandardMaterialBindGroupDescriptorPlan | null;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly buffers: readonly StandardMaterialBindGroupBufferResource[];
  readonly textures?: readonly StandardMaterialBindGroupTextureResource[];
  readonly samplers?: readonly StandardMaterialBindGroupSamplerResource[];
}

export interface CreateStandardMaterialBindGroupResourceResult {
  readonly valid: boolean;
  readonly resource: StandardMaterialBindGroupResource | null;
  readonly diagnostics: readonly StandardMaterialBindGroupResourceDiagnostic[];
}

export function createStandardMaterialBindGroupDescriptorPlan(
  input: StandardMaterialBindGroupResourceInput,
): StandardMaterialBindGroupDescriptorPlan {
  const diagnostics: StandardMaterialBindGroupDescriptorDiagnostic[] = [];
  const entries: StandardMaterialBindGroupDescriptorEntry[] = [];

  if (input.materialResourceKey === null) {
    diagnostics.push({
      code: "standardMaterialBindGroup.missingMaterialResource",
      binding: 0,
      message:
        "Standard material bind group planning requires a material uniform buffer resource.",
    });
  } else {
    entries.push({
      group: 2,
      binding: 0,
      resourceKey: input.materialResourceKey,
      resourceKind: "buffer",
    });
  }

  addTexturePair(
    entries,
    diagnostics,
    "baseColor",
    1,
    2,
    input.dependencies.baseColor,
  );
  addTexturePair(
    entries,
    diagnostics,
    "metallicRoughness",
    3,
    4,
    input.dependencies.metallicRoughness,
  );
  addTexturePair(
    entries,
    diagnostics,
    "normal",
    5,
    6,
    input.dependencies.normal,
  );
  addTexturePair(
    entries,
    diagnostics,
    "occlusion",
    7,
    8,
    input.dependencies.occlusion,
  );
  addTexturePair(
    entries,
    diagnostics,
    "emissive",
    9,
    10,
    input.dependencies.emissive,
  );
  addTexturePair(
    entries,
    diagnostics,
    "clearcoat",
    11,
    12,
    input.dependencies.clearcoat,
  );

  return {
    valid: diagnostics.length === 0,
    group: 2,
    resourceKey:
      diagnostics.length === 0
        ? createStandardMaterialBindGroupResourceKey(entries)
        : null,
    entries,
    diagnostics,
  };
}

export function createStandardMaterialBindGroupResourceKey(
  entries: readonly StandardMaterialBindGroupDescriptorEntry[],
): string {
  return bindGroupResourceKey(
    `standard/group-2/${entries
      .slice()
      .sort((a, b) => a.binding - b.binding)
      .map((entry) => `${entry.binding}:${entry.resourceKey}`)
      .join("/")}`,
  );
}

export function createStandardMaterialBindGroupResource(
  options: CreateStandardMaterialBindGroupResourceOptions,
): CreateStandardMaterialBindGroupResourceResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "standardMaterialBindGroupResource.nullDescriptorPlan",
          message:
            "Cannot create a standard material bind group from a null descriptor plan.",
        },
      ],
    };
  }

  const diagnostics: StandardMaterialBindGroupResourceDiagnostic[] = [];

  if (!options.plan.valid || options.plan.resourceKey === null) {
    diagnostics.push({
      code: "standardMaterialBindGroupResource.invalidDescriptorPlan",
      message:
        "Cannot create a standard material bind group from an invalid descriptor plan.",
    });
  }

  if (options.layout === null) {
    diagnostics.push({
      code: "standardMaterialBindGroupResource.missingLayout",
      group: 2,
      message:
        "Standard material bind group creation requires a group-2 layout resource.",
    });
  } else {
    diagnostics.push(...validateLayoutResource(options.layout));
  }

  if (options.device.createBindGroup === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...diagnostics,
        {
          code: "standardMaterialBindGroupResource.missingDeviceSupport",
          message: "WebGPU device cannot create standard material bind groups.",
        },
      ],
    };
  }

  if (
    diagnostics.length > 0 ||
    options.layout === null ||
    options.plan.resourceKey === null
  ) {
    return { valid: false, resource: null, diagnostics };
  }

  const descriptor = createStandardBindGroupCreationDescriptor(
    options.plan,
    options.layout,
    options,
    diagnostics,
  );

  if (descriptor === null) {
    return { valid: false, resource: null, diagnostics };
  }

  try {
    return {
      valid: true,
      resource: {
        group: 2,
        resourceKey: options.plan.resourceKey,
        layoutKey: options.layout.layoutKey,
        bindGroup: options.device.createBindGroup(descriptor),
        entryResourceKeys: options.plan.entries.map(
          (entry) => entry.resourceKey,
        ),
      },
      diagnostics,
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...diagnostics,
        {
          code: "standardMaterialBindGroupResource.creationFailed",
          group: 2,
          resourceKey: options.plan.resourceKey,
          layoutKey: options.layout.layoutKey,
          message: `Failed to create standard material bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

function validateLayoutResource(
  layout: StandardMaterialBindGroupLayoutResource,
): readonly StandardMaterialBindGroupResourceDiagnostic[] {
  const diagnostics: StandardMaterialBindGroupResourceDiagnostic[] = [];

  if (layout.group !== 2) {
    diagnostics.push({
      code: "standardMaterialBindGroupResource.invalidLayout",
      group: 2,
      layoutKey: layout.layoutKey,
      message: `Standard material bind group layout resource must be group 2, not ${layout.group}.`,
    });
  }

  if (layout.descriptor !== undefined) {
    for (const diagnostic of validateStandardMaterialBindGroupLayout(
      layout.descriptor,
    )) {
      diagnostics.push({
        code: "standardMaterialBindGroupResource.invalidLayout",
        group: 2,
        layoutKey: layout.layoutKey,
        message: diagnostic.message,
        ...(diagnostic.binding === undefined
          ? {}
          : { binding: diagnostic.binding }),
      });
    }
  }

  return diagnostics;
}

function createStandardBindGroupCreationDescriptor(
  plan: StandardMaterialBindGroupDescriptorPlan,
  layout: StandardMaterialBindGroupLayoutResource,
  resources: Pick<
    CreateStandardMaterialBindGroupResourceOptions,
    "buffers" | "textures" | "samplers"
  >,
  diagnostics: StandardMaterialBindGroupResourceDiagnostic[],
): StandardMaterialBindGroupCreationDescriptor | null {
  const buffers = new Map(
    resources.buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]),
  );
  const textures = new Map(
    (resources.textures ?? []).map((texture) => [
      texture.resourceKey,
      texture.view,
    ]),
  );
  const samplers = new Map(
    (resources.samplers ?? []).map((sampler) => [
      sampler.resourceKey,
      sampler.sampler,
    ]),
  );
  const entries = plan.entries.flatMap((entry) => {
    const resource = resolveStandardMaterialResource(
      entry,
      buffers,
      textures,
      samplers,
      diagnostics,
    );

    return resource === null ? [] : [{ binding: entry.binding, resource }];
  });

  if (entries.length !== plan.entries.length) {
    return null;
  }

  return {
    label: "standard/group-2",
    layout: layout.layout,
    entries,
  };
}

function resolveStandardMaterialResource(
  entry: StandardMaterialBindGroupDescriptorEntry,
  buffers: ReadonlyMap<string, unknown>,
  textures: ReadonlyMap<string, unknown>,
  samplers: ReadonlyMap<string, unknown>,
  diagnostics: StandardMaterialBindGroupResourceDiagnostic[],
): unknown | null {
  switch (entry.resourceKind) {
    case "buffer": {
      const buffer = buffers.get(entry.resourceKey);

      if (buffer === undefined) {
        diagnostics.push({
          code: "standardMaterialBindGroupResource.missingBufferResource",
          group: 2,
          binding: entry.binding,
          resourceKey: entry.resourceKey,
          message: `Missing GPU buffer resource '${entry.resourceKey}' for standard material group 2.`,
        });
        return null;
      }

      return { buffer };
    }
    case "texture-view": {
      const texture = textures.get(entry.resourceKey);

      if (texture === undefined) {
        diagnostics.push({
          code: "standardMaterialBindGroupResource.missingTextureResource",
          group: 2,
          binding: entry.binding,
          resourceKey: entry.resourceKey,
          message: `Missing GPU texture view resource '${entry.resourceKey}' for standard material group 2.`,
        });
        return null;
      }

      return texture;
    }
    case "sampler": {
      const sampler = samplers.get(entry.resourceKey);

      if (sampler === undefined) {
        diagnostics.push({
          code: "standardMaterialBindGroupResource.missingSamplerResource",
          group: 2,
          binding: entry.binding,
          resourceKey: entry.resourceKey,
          message: `Missing GPU sampler resource '${entry.resourceKey}' for standard material group 2.`,
        });
        return null;
      }

      return sampler;
    }
  }
}

function addTexturePair(
  entries: StandardMaterialBindGroupDescriptorEntry[],
  diagnostics: StandardMaterialBindGroupDescriptorDiagnostic[],
  slot: StandardMaterialTextureSlot,
  textureBinding: number,
  samplerBinding: number,
  dependency: StandardMaterialResourceDependencies[StandardMaterialTextureSlot],
): void {
  const textured =
    dependency.textureKey !== null || dependency.samplerKey !== null;

  if (!textured) {
    return;
  }

  if (dependency.textureKey === null) {
    diagnostics.push({
      code: "standardMaterialBindGroup.missingTextureResource",
      slot,
      binding: textureBinding,
      message: `${slot} texture binding requires a texture resource key.`,
    });
  } else {
    entries.push({
      group: 2,
      binding: textureBinding,
      resourceKey: dependency.textureKey,
      resourceKind: "texture-view",
    });
  }

  if (dependency.samplerKey === null) {
    diagnostics.push({
      code: "standardMaterialBindGroup.missingSamplerResource",
      slot,
      binding: samplerBinding,
      message: `${slot} texture binding requires a sampler resource key.`,
    });
  } else {
    entries.push({
      group: 2,
      binding: samplerBinding,
      resourceKey: dependency.samplerKey,
      resourceKind: "sampler",
    });
  }
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
