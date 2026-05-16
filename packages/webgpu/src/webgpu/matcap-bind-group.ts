import type { MatcapMaterialResourceDependencies } from "./matcap-material-buffer.js";
import {
  validateMatcapMaterialBindGroupLayout,
  type MatcapMaterialBindGroupLayoutDescriptor,
} from "./matcap-bind-group-layout.js";
import { bindGroupResourceKey } from "./resource-keys.js";

export type MatcapMaterialBindGroupResourceKind =
  | "buffer"
  | "texture-view"
  | "sampler";

export type MatcapMaterialBindGroupDescriptorDiagnosticCode =
  | "matcapMaterialBindGroup.missingMaterialResource"
  | "matcapMaterialBindGroup.missingTextureResource"
  | "matcapMaterialBindGroup.missingSamplerResource";

export interface MatcapMaterialBindGroupDescriptorDiagnostic {
  readonly code: MatcapMaterialBindGroupDescriptorDiagnosticCode;
  readonly message: string;
  readonly binding?: number;
}

export interface MatcapMaterialBindGroupResourceInput {
  readonly materialResourceKey: string | null;
  readonly dependencies: {
    readonly matcapTexture: {
      readonly textureKey: string | null;
      readonly samplerKey: string | null;
    };
  };
}

export interface MatcapMaterialBindGroupDescriptorEntry {
  readonly group: 2;
  readonly binding: number;
  readonly resourceKey: string;
  readonly resourceKind: MatcapMaterialBindGroupResourceKind;
}

export interface MatcapMaterialBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly group: 2;
  readonly resourceKey: string | null;
  readonly entries: readonly MatcapMaterialBindGroupDescriptorEntry[];
  readonly diagnostics: readonly MatcapMaterialBindGroupDescriptorDiagnostic[];
}

export type MatcapMaterialBindGroupResourceDiagnosticCode =
  | "matcapMaterialBindGroupResource.nullDescriptorPlan"
  | "matcapMaterialBindGroupResource.invalidDescriptorPlan"
  | "matcapMaterialBindGroupResource.missingLayout"
  | "matcapMaterialBindGroupResource.invalidLayout"
  | "matcapMaterialBindGroupResource.missingDeviceSupport"
  | "matcapMaterialBindGroupResource.missingBufferResource"
  | "matcapMaterialBindGroupResource.missingTextureResource"
  | "matcapMaterialBindGroupResource.missingSamplerResource"
  | "matcapMaterialBindGroupResource.creationFailed";

export interface MatcapMaterialBindGroupResourceDiagnostic {
  readonly code: MatcapMaterialBindGroupResourceDiagnosticCode;
  readonly message: string;
  readonly group?: 2;
  readonly binding?: number;
  readonly resourceKey?: string;
  readonly layoutKey?: string;
}

export interface MatcapMaterialBindGroupLayoutResource {
  readonly group: number;
  readonly layoutKey: string;
  readonly layout: unknown;
  readonly descriptor?: MatcapMaterialBindGroupLayoutDescriptor;
}

export interface MatcapMaterialBindGroupBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
}

export interface MatcapMaterialBindGroupTextureResource {
  readonly resourceKey: string;
  readonly view: unknown;
}

export interface MatcapMaterialBindGroupSamplerResource {
  readonly resourceKey: string;
  readonly sampler: unknown;
}

export interface MatcapMaterialBindGroupCreationEntry {
  readonly binding: number;
  readonly resource: unknown;
}

export interface MatcapMaterialBindGroupCreationDescriptor {
  readonly label: string;
  readonly layout: unknown;
  readonly entries: readonly MatcapMaterialBindGroupCreationEntry[];
}

export interface MatcapMaterialBindGroupDeviceLike {
  createBindGroup?: (
    descriptor: MatcapMaterialBindGroupCreationDescriptor,
  ) => unknown;
}

export interface MatcapMaterialBindGroupResource {
  readonly group: 2;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface CreateMatcapMaterialBindGroupResourceOptions {
  readonly device: MatcapMaterialBindGroupDeviceLike;
  readonly plan: MatcapMaterialBindGroupDescriptorPlan | null;
  readonly layout: MatcapMaterialBindGroupLayoutResource | null;
  readonly buffers: readonly MatcapMaterialBindGroupBufferResource[];
  readonly textures: readonly MatcapMaterialBindGroupTextureResource[];
  readonly samplers: readonly MatcapMaterialBindGroupSamplerResource[];
}

export interface CreateMatcapMaterialBindGroupResourceResult {
  readonly valid: boolean;
  readonly resource: MatcapMaterialBindGroupResource | null;
  readonly diagnostics: readonly MatcapMaterialBindGroupResourceDiagnostic[];
}

export function createMatcapMaterialBindGroupDescriptorPlan(
  input: MatcapMaterialBindGroupResourceInput,
): MatcapMaterialBindGroupDescriptorPlan {
  const diagnostics: MatcapMaterialBindGroupDescriptorDiagnostic[] = [];
  const entries: MatcapMaterialBindGroupDescriptorEntry[] = [];

  if (input.materialResourceKey === null) {
    diagnostics.push({
      code: "matcapMaterialBindGroup.missingMaterialResource",
      binding: 0,
      message:
        "Matcap material bind group planning requires a material uniform buffer resource.",
    });
  } else {
    entries.push({
      group: 2,
      binding: 0,
      resourceKey: input.materialResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.dependencies.matcapTexture.textureKey === null) {
    diagnostics.push({
      code: "matcapMaterialBindGroup.missingTextureResource",
      binding: 1,
      message: "Matcap material bind group planning requires a texture key.",
    });
  } else {
    entries.push({
      group: 2,
      binding: 1,
      resourceKey: input.dependencies.matcapTexture.textureKey,
      resourceKind: "texture-view",
    });
  }

  if (input.dependencies.matcapTexture.samplerKey === null) {
    diagnostics.push({
      code: "matcapMaterialBindGroup.missingSamplerResource",
      binding: 2,
      message: "Matcap material bind group planning requires a sampler key.",
    });
  } else {
    entries.push({
      group: 2,
      binding: 2,
      resourceKey: input.dependencies.matcapTexture.samplerKey,
      resourceKind: "sampler",
    });
  }

  return {
    valid: diagnostics.length === 0,
    group: 2,
    resourceKey:
      diagnostics.length === 0
        ? createMatcapMaterialBindGroupResourceKey(entries)
        : null,
    entries,
    diagnostics,
  };
}

export function createMatcapMaterialBindGroupDescriptorPlanFromDependencies(
  materialResourceKey: string | null,
  dependencies: MatcapMaterialResourceDependencies,
): MatcapMaterialBindGroupDescriptorPlan {
  return createMatcapMaterialBindGroupDescriptorPlan({
    materialResourceKey,
    dependencies,
  });
}

export function createMatcapMaterialBindGroupResourceKey(
  entries: readonly MatcapMaterialBindGroupDescriptorEntry[],
): string {
  return bindGroupResourceKey(
    `matcap/group-2/${entries
      .slice()
      .sort((a, b) => a.binding - b.binding)
      .map((entry) => `${entry.binding}:${entry.resourceKey}`)
      .join("/")}`,
  );
}

export function createMatcapMaterialBindGroupResource(
  options: CreateMatcapMaterialBindGroupResourceOptions,
): CreateMatcapMaterialBindGroupResourceResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "matcapMaterialBindGroupResource.nullDescriptorPlan",
          message:
            "Cannot create a matcap material bind group from a null descriptor plan.",
        },
      ],
    };
  }

  const diagnostics: MatcapMaterialBindGroupResourceDiagnostic[] = [];

  if (!options.plan.valid || options.plan.resourceKey === null) {
    diagnostics.push({
      code: "matcapMaterialBindGroupResource.invalidDescriptorPlan",
      message:
        "Cannot create a matcap material bind group from an invalid descriptor plan.",
    });
  }

  if (options.layout === null) {
    diagnostics.push({
      code: "matcapMaterialBindGroupResource.missingLayout",
      group: 2,
      message:
        "Matcap material bind group creation requires a group-2 layout resource.",
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
          code: "matcapMaterialBindGroupResource.missingDeviceSupport",
          message: "WebGPU device cannot create matcap material bind groups.",
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

  const descriptor = createMatcapBindGroupCreationDescriptor(
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
          code: "matcapMaterialBindGroupResource.creationFailed",
          group: 2,
          resourceKey: options.plan.resourceKey,
          layoutKey: options.layout.layoutKey,
          message: `Failed to create matcap material bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

function validateLayoutResource(
  layout: MatcapMaterialBindGroupLayoutResource,
): readonly MatcapMaterialBindGroupResourceDiagnostic[] {
  const diagnostics: MatcapMaterialBindGroupResourceDiagnostic[] = [];

  if (layout.group !== 2) {
    diagnostics.push({
      code: "matcapMaterialBindGroupResource.invalidLayout",
      group: 2,
      layoutKey: layout.layoutKey,
      message: `Matcap material bind group layout resource must be group 2, not ${layout.group}.`,
    });
  }

  if (layout.descriptor !== undefined) {
    for (const diagnostic of validateMatcapMaterialBindGroupLayout(
      layout.descriptor,
    )) {
      diagnostics.push({
        code: "matcapMaterialBindGroupResource.invalidLayout",
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

function createMatcapBindGroupCreationDescriptor(
  plan: MatcapMaterialBindGroupDescriptorPlan,
  layout: MatcapMaterialBindGroupLayoutResource,
  resources: Pick<
    CreateMatcapMaterialBindGroupResourceOptions,
    "buffers" | "textures" | "samplers"
  >,
  diagnostics: MatcapMaterialBindGroupResourceDiagnostic[],
): MatcapMaterialBindGroupCreationDescriptor | null {
  const buffers = new Map(
    resources.buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]),
  );
  const textures = new Map(
    resources.textures.map((texture) => [texture.resourceKey, texture.view]),
  );
  const samplers = new Map(
    resources.samplers.map((sampler) => [sampler.resourceKey, sampler.sampler]),
  );
  const entries = plan.entries.flatMap((entry) => {
    const resource = resolveMatcapMaterialResource(
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
    label: "matcap/group-2",
    layout: layout.layout,
    entries,
  };
}

function resolveMatcapMaterialResource(
  entry: MatcapMaterialBindGroupDescriptorEntry,
  buffers: ReadonlyMap<string, unknown>,
  textures: ReadonlyMap<string, unknown>,
  samplers: ReadonlyMap<string, unknown>,
  diagnostics: MatcapMaterialBindGroupResourceDiagnostic[],
): unknown | null {
  switch (entry.resourceKind) {
    case "buffer": {
      const buffer = buffers.get(entry.resourceKey);

      if (buffer === undefined) {
        diagnostics.push({
          code: "matcapMaterialBindGroupResource.missingBufferResource",
          group: 2,
          binding: entry.binding,
          resourceKey: entry.resourceKey,
          message: `Missing GPU buffer resource '${entry.resourceKey}' for matcap material group 2.`,
        });
        return null;
      }

      return { buffer };
    }
    case "texture-view": {
      const texture = textures.get(entry.resourceKey);

      if (texture === undefined) {
        diagnostics.push({
          code: "matcapMaterialBindGroupResource.missingTextureResource",
          group: 2,
          binding: entry.binding,
          resourceKey: entry.resourceKey,
          message: `Missing GPU texture view resource '${entry.resourceKey}' for matcap material group 2.`,
        });
        return null;
      }

      return texture;
    }
    case "sampler": {
      const sampler = samplers.get(entry.resourceKey);

      if (sampler === undefined) {
        diagnostics.push({
          code: "matcapMaterialBindGroupResource.missingSamplerResource",
          group: 2,
          binding: entry.binding,
          resourceKey: entry.resourceKey,
          message: `Missing GPU sampler resource '${entry.resourceKey}' for matcap material group 2.`,
        });
        return null;
      }

      return sampler;
    }
  }
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
