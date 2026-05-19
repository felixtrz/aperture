import type {
  WebGpuBindGroupLayoutDescriptor,
  WebGpuBindGroupLayoutEntryDescriptor,
} from "./bind-group-layout-cache.js";
import type { IblSamplerResourceReport } from "./ibl-sampler-resource.js";
import type {
  DiffuseIblTextureResourceReport,
  SpecularIblTextureResourceReport,
} from "./ibl-texture-resource.js";
import type { LightGpuBufferResource } from "./light-packing.js";
import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
import type { ShadowSamplerResourceReport } from "./standard-material-shadow-bind-group.js";

export const STANDARD_LIGHT_SHADOW_BIND_GROUP = 3;
export const STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY =
  "standard/lights-shadow/group-3";
export const STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY =
  "standard/lights-ibl/group-3";
export const STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY =
  "standard/lights-shadow-ibl/group-3";

export type StandardLightShadowBindGroupDiagnosticCode =
  | "standardLightShadowBindGroup.missingLayoutKey"
  | "standardLightShadowBindGroup.missingLightGpuBufferResource"
  | "standardLightShadowBindGroup.missingMatrixBufferResource"
  | "standardLightShadowBindGroup.missingDepthTextureResource"
  | "standardLightShadowBindGroup.missingSamplerResource"
  | "standardLightShadowBindGroup.missingDiffuseIblTextureResource"
  | "standardLightShadowBindGroup.missingIblSamplerResource"
  | "standardLightShadowBindGroupResource.nullDescriptorPlan"
  | "standardLightShadowBindGroupResource.invalidDescriptorPlan"
  | "standardLightShadowBindGroupResource.missingLayout"
  | "standardLightShadowBindGroupResource.missingDeviceSupport"
  | "standardLightShadowBindGroupResource.creationFailed";

export interface StandardLightShadowBindGroupDiagnostic {
  readonly code: StandardLightShadowBindGroupDiagnosticCode;
  readonly message: string;
  readonly resourceKey?: string;
  readonly layoutKey?: string;
}

export interface StandardLightShadowBindGroupDescriptorEntry {
  readonly binding: number;
  readonly resourceKey: string;
  readonly resourceKind: "buffer" | "texture-view" | "sampler";
}

export interface StandardLightShadowBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly group: typeof STANDARD_LIGHT_SHADOW_BIND_GROUP;
  readonly label: string;
  readonly resourceKey: string | null;
  readonly layoutKey: string | null;
  readonly entries: readonly StandardLightShadowBindGroupDescriptorEntry[];
  readonly diagnostics: readonly StandardLightShadowBindGroupDiagnostic[];
}

export interface StandardLightShadowBindGroupResource {
  readonly group: typeof STANDARD_LIGHT_SHADOW_BIND_GROUP;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface CreateStandardLightShadowBindGroupResourceResult {
  readonly valid: boolean;
  readonly resource: StandardLightShadowBindGroupResource | null;
  readonly diagnostics: readonly StandardLightShadowBindGroupDiagnostic[];
}

export interface CreateStandardLightShadowBindGroupDescriptorPlanOptions {
  readonly lightGpuBufferResource: LightGpuBufferResource | null;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ShadowSamplerResourceReport;
  readonly layoutKey?: string | null;
  readonly label?: string;
}

export interface CreateStandardLightIblBindGroupDescriptorPlanOptions {
  readonly lightGpuBufferResource: LightGpuBufferResource | null;
  readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
  readonly specularTextureResource?: SpecularIblTextureResourceReport;
  readonly samplerResource: IblSamplerResourceReport;
  readonly shadowReceiverResources?: StandardLightIblShadowReceiverResources;
  readonly shadowRequired?: boolean;
  readonly layoutKey?: string | null;
  readonly label?: string;
}

export interface StandardLightIblShadowReceiverResources {
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ShadowSamplerResourceReport;
}

export interface StandardLightShadowBindGroupLayoutResource {
  readonly group: typeof STANDARD_LIGHT_SHADOW_BIND_GROUP;
  readonly layoutKey: string;
  readonly layout: unknown;
  readonly descriptor: WebGpuBindGroupLayoutDescriptor;
}

export interface StandardLightShadowBindGroupDeviceLike {
  createBindGroup?: (descriptor: {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly {
      readonly binding: number;
      readonly resource: unknown;
    }[];
  }) => unknown;
}

export function createStandardLightShadowBindGroupLayoutDescriptor(): WebGpuBindGroupLayoutDescriptor {
  return {
    label: STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
    entries: [
      { binding: 0, visibility: 0x2, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: 0x2, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: 0x3, buffer: { type: "read-only-storage" } },
      {
        binding: 3,
        visibility: 0x2,
        texture: {
          sampleType: "depth",
          viewDimension: "2d",
          multisampled: false,
        },
      },
      { binding: 4, visibility: 0x2, sampler: { type: "comparison" } },
    ],
  };
}

export function createStandardLightIblBindGroupLayoutDescriptor(options?: {
  readonly shadowMap?: boolean;
  readonly specularProof?: boolean;
}): WebGpuBindGroupLayoutDescriptor {
  const entries: WebGpuBindGroupLayoutEntryDescriptor[] = [
    { binding: 0, visibility: 0x2, buffer: { type: "read-only-storage" } },
    { binding: 1, visibility: 0x2, buffer: { type: "read-only-storage" } },
  ];

  if (options?.shadowMap === true) {
    entries.push(
      { binding: 2, visibility: 0x3, buffer: { type: "read-only-storage" } },
      {
        binding: 3,
        visibility: 0x2,
        texture: {
          sampleType: "depth",
          viewDimension: "2d",
          multisampled: false,
        },
      },
      { binding: 4, visibility: 0x2, sampler: { type: "comparison" } },
    );
  }

  entries.push(
    {
      binding: 5,
      visibility: 0x2,
      texture: {
        sampleType: "float",
        viewDimension: "cube",
        multisampled: false,
      },
    },
    { binding: 6, visibility: 0x2, sampler: { type: "filtering" } },
  );

  if (options?.specularProof === true) {
    entries.push({
      binding: 7,
      visibility: 0x2,
      texture: {
        sampleType: "float",
        viewDimension: "cube",
        multisampled: false,
      },
    });
  }

  return {
    label:
      options?.shadowMap === true
        ? STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
        : STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY,
    entries,
  };
}

export function createStandardLightShadowBindGroupLayoutResource(
  createBindGroupLayout: (
    descriptor: WebGpuBindGroupLayoutDescriptor,
  ) => unknown,
  layoutKey = STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
): StandardLightShadowBindGroupLayoutResource {
  const descriptor = createStandardLightShadowBindGroupLayoutDescriptor();

  return {
    group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
    layoutKey,
    layout: createBindGroupLayout(descriptor),
    descriptor,
  };
}

export function createStandardLightShadowBindGroupDescriptorPlan(
  options: CreateStandardLightShadowBindGroupDescriptorPlanOptions,
): StandardLightShadowBindGroupDescriptorPlan {
  const layoutKey =
    options.layoutKey ?? STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY;
  const label = options.label ?? STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY;
  const diagnostics: StandardLightShadowBindGroupDiagnostic[] = [];
  const entries: StandardLightShadowBindGroupDescriptorEntry[] = [];

  if (layoutKey === null || layoutKey.length === 0) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingLayoutKey",
      message:
        "StandardMaterial light/shadow bind-group planning requires a layout key.",
    });
  }

  if (options.lightGpuBufferResource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingLightGpuBufferResource",
      message:
        "StandardMaterial light/shadow bind-group planning requires light GPU buffers.",
    });
  } else {
    entries.push(
      {
        binding: 0,
        resourceKey: options.lightGpuBufferResource.floatResourceKey,
        resourceKind: "buffer",
      },
      {
        binding: 1,
        resourceKey: options.lightGpuBufferResource.metadataResourceKey,
        resourceKind: "buffer",
      },
    );
  }

  if (options.matrixBufferResource.resource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingMatrixBufferResource",
      message:
        "StandardMaterial light/shadow bind-group planning requires a shadow matrix buffer.",
    });
  } else {
    entries.push({
      binding: 2,
      resourceKey: options.matrixBufferResource.resource.resourceKey,
      resourceKind: "buffer",
    });
  }

  const depthResource = options.depthTextureResources.resources.find(
    (resource) => resource.allocation.resource !== null,
  );

  if (depthResource === undefined) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingDepthTextureResource",
      message:
        "StandardMaterial light/shadow bind-group planning requires a shadow depth texture view.",
    });
  } else {
    entries.push({
      binding: 3,
      resourceKey: depthResource.textureKey,
      resourceKind: "texture-view",
    });
  }

  if (options.samplerResource.resource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingSamplerResource",
      message:
        "StandardMaterial light/shadow bind-group planning requires a shadow comparison sampler.",
    });
  } else {
    entries.push({
      binding: 4,
      resourceKey: options.samplerResource.resource.resourceKey,
      resourceKind: "sampler",
    });
  }

  return {
    valid: diagnostics.length === 0,
    group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
    label,
    resourceKey:
      diagnostics.length === 0
        ? standardLightShadowBindGroupResourceKey(entries)
        : null,
    layoutKey,
    entries,
    diagnostics,
  };
}

export function createStandardLightIblBindGroupDescriptorPlan(
  options: CreateStandardLightIblBindGroupDescriptorPlanOptions,
): StandardLightShadowBindGroupDescriptorPlan {
  const shadowMap = options.shadowRequired === true;
  const layoutKey =
    options.layoutKey ??
    (shadowMap
      ? STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
      : STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY);
  const label =
    options.label ??
    (shadowMap
      ? STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY
      : STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY);
  const diagnostics: StandardLightShadowBindGroupDiagnostic[] = [];
  const entries: StandardLightShadowBindGroupDescriptorEntry[] = [];

  if (layoutKey === null || layoutKey.length === 0) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingLayoutKey",
      message:
        "StandardMaterial light/IBL bind-group planning requires a layout key.",
    });
  }

  if (options.lightGpuBufferResource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingLightGpuBufferResource",
      message:
        "StandardMaterial light/IBL bind-group planning requires light GPU buffers.",
    });
  } else {
    entries.push(
      {
        binding: 0,
        resourceKey: options.lightGpuBufferResource.floatResourceKey,
        resourceKind: "buffer",
      },
      {
        binding: 1,
        resourceKey: options.lightGpuBufferResource.metadataResourceKey,
        resourceKind: "buffer",
      },
    );
  }

  if (shadowMap) {
    const shadowResources = options.shadowReceiverResources;

    if (shadowResources === undefined) {
      diagnostics.push(
        {
          code: "standardLightShadowBindGroup.missingMatrixBufferResource",
          message:
            "StandardMaterial light/shadow/IBL bind-group planning requires a shadow matrix buffer.",
        },
        {
          code: "standardLightShadowBindGroup.missingDepthTextureResource",
          message:
            "StandardMaterial light/shadow/IBL bind-group planning requires a shadow depth texture view.",
        },
        {
          code: "standardLightShadowBindGroup.missingSamplerResource",
          message:
            "StandardMaterial light/shadow/IBL bind-group planning requires a shadow comparison sampler.",
        },
      );
    } else {
      appendShadowEntries(shadowResources, entries, diagnostics);
    }
  }

  const diffuseResource =
    options.diffuseTextureResource.resources.find(
      (resource) => resource.valid && resource.resource !== null,
    )?.resource ?? null;

  if (diffuseResource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingDiffuseIblTextureResource",
      message:
        "StandardMaterial light/IBL bind-group planning requires a diffuse IBL texture view.",
    });
  } else {
    entries.push({
      binding: 5,
      resourceKey: diffuseResource.resourceKey,
      resourceKind: "texture-view",
    });
  }

  const samplerResource =
    options.samplerResource.resources.find(
      (resource) => resource.valid && resource.resource !== null,
    )?.resource ?? null;

  if (samplerResource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingIblSamplerResource",
      message:
        "StandardMaterial light/IBL bind-group planning requires an IBL sampler.",
    });
  } else {
    entries.push({
      binding: 6,
      resourceKey: samplerResource.resourceKey,
      resourceKind: "sampler",
    });
  }

  if (options.specularTextureResource !== undefined) {
    const specularResource =
      options.specularTextureResource.resources.find(
        (resource) => resource.valid && resource.resource !== null,
      )?.resource ?? null;

    if (specularResource === null) {
      diagnostics.push({
        code: "standardLightShadowBindGroup.missingDiffuseIblTextureResource",
        message:
          "StandardMaterial light/IBL bind-group planning requires a specular IBL proof texture view.",
      });
    } else {
      entries.push({
        binding: 7,
        resourceKey: specularResource.resourceKey,
        resourceKind: "texture-view",
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
    label,
    resourceKey:
      diagnostics.length === 0 && layoutKey !== null
        ? standardLightShadowBindGroupResourceKey(entries, layoutKey)
        : null,
    layoutKey,
    entries,
    diagnostics,
  };
}

export function createStandardLightShadowBindGroupResource(options: {
  readonly device: StandardLightShadowBindGroupDeviceLike;
  readonly plan: StandardLightShadowBindGroupDescriptorPlan | null;
  readonly layout: StandardLightShadowBindGroupLayoutResource | null;
  readonly lightGpuBufferResource: LightGpuBufferResource | null;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ShadowSamplerResourceReport;
  readonly diffuseTextureResource?: DiffuseIblTextureResourceReport;
  readonly specularTextureResource?: SpecularIblTextureResourceReport;
  readonly iblSamplerResource?: IblSamplerResourceReport;
}): CreateStandardLightShadowBindGroupResourceResult {
  if (options.plan === null) {
    return resourceResult(
      "standardLightShadowBindGroupResource.nullDescriptorPlan",
    );
  }

  if (!options.plan.valid || options.plan.resourceKey === null) {
    return resourceResult(
      "standardLightShadowBindGroupResource.invalidDescriptorPlan",
      options.plan.resourceKey ?? undefined,
      options.plan.layoutKey ?? undefined,
    );
  }

  if (
    options.layout === null ||
    options.layout.layoutKey !== options.plan.layoutKey
  ) {
    return resourceResult(
      "standardLightShadowBindGroupResource.missingLayout",
      options.plan.resourceKey,
      options.plan.layoutKey ?? undefined,
    );
  }

  if (options.device.createBindGroup === undefined) {
    return resourceResult(
      "standardLightShadowBindGroupResource.missingDeviceSupport",
      options.plan.resourceKey,
      options.layout.layoutKey,
    );
  }

  const entries = createCreationEntries(options.plan, options);

  if (entries.length !== options.plan.entries.length) {
    return resourceResult(
      "standardLightShadowBindGroupResource.invalidDescriptorPlan",
      options.plan.resourceKey,
      options.plan.layoutKey ?? undefined,
    );
  }

  try {
    const resource: StandardLightShadowBindGroupResource = {
      group: STANDARD_LIGHT_SHADOW_BIND_GROUP,
      resourceKey: options.plan.resourceKey,
      layoutKey: options.layout.layoutKey,
      bindGroup: options.device.createBindGroup({
        label: options.plan.label,
        layout: options.layout.layout,
        entries,
      }),
      entryResourceKeys: options.plan.entries.map((entry) => entry.resourceKey),
    };

    return { valid: true, resource, diagnostics: [] };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "standardLightShadowBindGroupResource.creationFailed",
          resourceKey: options.plan.resourceKey,
          layoutKey: options.layout.layoutKey,
          message: `Failed to create StandardMaterial light/shadow bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

function standardLightShadowBindGroupResourceKey(
  entries: readonly StandardLightShadowBindGroupDescriptorEntry[],
  layoutKey = STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
): string {
  return `bind-group:${layoutKey}/${entries
    .map((entry) => `${entry.binding}:${entry.resourceKey}`)
    .join("/")}`;
}

function createCreationEntries(
  plan: StandardLightShadowBindGroupDescriptorPlan,
  resources: Parameters<typeof createStandardLightShadowBindGroupResource>[0],
): { readonly binding: number; readonly resource: unknown }[] {
  const buffers = new Map<string, unknown>();
  const textures = new Map<string, unknown>();
  const samplers = new Map<string, unknown>();

  if (resources.lightGpuBufferResource !== null) {
    buffers.set(
      resources.lightGpuBufferResource.floatResourceKey,
      resources.lightGpuBufferResource.floatBuffer,
    );
    buffers.set(
      resources.lightGpuBufferResource.metadataResourceKey,
      resources.lightGpuBufferResource.metadataBuffer,
    );
  }

  if (resources.matrixBufferResource.resource !== null) {
    buffers.set(
      resources.matrixBufferResource.resource.resourceKey,
      resources.matrixBufferResource.resource.buffer,
    );
  }

  for (const resource of resources.depthTextureResources.resources) {
    if (resource.allocation.resource !== null) {
      textures.set(resource.textureKey, resource.allocation.resource.view);
    }
  }

  if (resources.samplerResource.resource !== null) {
    samplers.set(
      resources.samplerResource.resource.resourceKey,
      resources.samplerResource.resource.sampler,
    );
  }

  for (const resource of resources.diffuseTextureResource?.resources ?? []) {
    if (resource.valid && resource.resource !== null) {
      textures.set(resource.resource.resourceKey, resource.resource.view);
    }
  }

  for (const resource of resources.specularTextureResource?.resources ?? []) {
    if (resource.valid && resource.resource !== null) {
      textures.set(resource.resource.resourceKey, resource.resource.view);
    }
  }

  for (const resource of resources.iblSamplerResource?.resources ?? []) {
    if (resource.valid && resource.resource !== null) {
      samplers.set(resource.resource.resourceKey, resource.resource.sampler);
    }
  }

  return plan.entries.flatMap((entry) => {
    if (entry.resourceKind === "texture-view") {
      const texture = textures.get(entry.resourceKey);
      return texture === undefined
        ? []
        : [{ binding: entry.binding, resource: texture }];
    }

    if (entry.resourceKind === "sampler") {
      const sampler = samplers.get(entry.resourceKey);
      return sampler === undefined
        ? []
        : [{ binding: entry.binding, resource: sampler }];
    }

    const buffer = buffers.get(entry.resourceKey);
    return buffer === undefined
      ? []
      : [{ binding: entry.binding, resource: { buffer } }];
  });
}

function appendShadowEntries(
  shadowResources: StandardLightIblShadowReceiverResources,
  entries: StandardLightShadowBindGroupDescriptorEntry[],
  diagnostics: StandardLightShadowBindGroupDiagnostic[],
): void {
  if (shadowResources.matrixBufferResource.resource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingMatrixBufferResource",
      message:
        "StandardMaterial light/shadow/IBL bind-group planning requires a shadow matrix buffer.",
    });
  } else {
    entries.push({
      binding: 2,
      resourceKey: shadowResources.matrixBufferResource.resource.resourceKey,
      resourceKind: "buffer",
    });
  }

  const depthResource = shadowResources.depthTextureResources.resources.find(
    (resource) => resource.allocation.resource !== null,
  );

  if (depthResource === undefined) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingDepthTextureResource",
      message:
        "StandardMaterial light/shadow/IBL bind-group planning requires a shadow depth texture view.",
    });
  } else {
    entries.push({
      binding: 3,
      resourceKey: depthResource.textureKey,
      resourceKind: "texture-view",
    });
  }

  if (shadowResources.samplerResource.resource === null) {
    diagnostics.push({
      code: "standardLightShadowBindGroup.missingSamplerResource",
      message:
        "StandardMaterial light/shadow/IBL bind-group planning requires a shadow comparison sampler.",
    });
  } else {
    entries.push({
      binding: 4,
      resourceKey: shadowResources.samplerResource.resource.resourceKey,
      resourceKind: "sampler",
    });
  }
}

function resourceResult(
  code: StandardLightShadowBindGroupDiagnosticCode,
  resourceKey?: string,
  layoutKey?: string,
): CreateStandardLightShadowBindGroupResourceResult {
  return {
    valid: false,
    resource: null,
    diagnostics: [
      {
        code,
        ...(resourceKey === undefined ? {} : { resourceKey }),
        ...(layoutKey === undefined ? {} : { layoutKey }),
        message: standardLightShadowResourceMessage(code),
      },
    ],
  };
}

function standardLightShadowResourceMessage(
  code: StandardLightShadowBindGroupDiagnosticCode,
): string {
  switch (code) {
    case "standardLightShadowBindGroupResource.nullDescriptorPlan":
      return "Cannot create a StandardMaterial light/shadow bind group from a null plan.";
    case "standardLightShadowBindGroupResource.invalidDescriptorPlan":
      return "Cannot create a StandardMaterial light/shadow bind group from an invalid descriptor plan.";
    case "standardLightShadowBindGroupResource.missingLayout":
      return "Missing StandardMaterial light/shadow bind-group layout resource.";
    case "standardLightShadowBindGroupResource.missingDeviceSupport":
      return "WebGPU device cannot create StandardMaterial light/shadow bind groups.";
    default:
      return "StandardMaterial light/shadow bind-group resource creation failed.";
  }
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
