import type { LightGpuBufferResource } from "./light-packing.js";
import {
  DEFAULT_LIGHT_BIND_GROUP,
  type LightBindGroupLayoutResource,
} from "./light-bind-group-layout.js";
import {
  STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING,
  STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING,
  STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING,
  type StandardAreaLightLtcResources,
} from "./standard-area-light-ltc-resource.js";

export type LightBindGroupDescriptorDiagnosticCode =
  | "lightBindGroup.missingLightGpuBufferResource"
  | "lightBindGroup.missingLayoutKey";

export interface LightBindGroupDescriptorDiagnostic {
  readonly code: LightBindGroupDescriptorDiagnosticCode;
  readonly message: string;
}

export interface CreateLightBindGroupDescriptorPlanOptions {
  readonly lightGpuBufferResource: LightGpuBufferResource | null;
  readonly areaLightLtcResources?: StandardAreaLightLtcResources | null;
  readonly layoutKey: string | null;
  readonly group?: number;
  readonly label?: string;
}

export interface LightBindGroupDescriptorEntry {
  readonly binding: number;
  readonly resourceKey: string;
  readonly resource:
    | { readonly buffer: unknown }
    | { readonly textureView: unknown }
    | { readonly sampler: unknown };
}

export interface LightBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly group: number;
  readonly label: string;
  readonly resourceKey: string | null;
  readonly layoutKey: string | null;
  readonly entries: readonly LightBindGroupDescriptorEntry[];
  readonly diagnostics: readonly LightBindGroupDescriptorDiagnostic[];
}

export interface LightBindGroupDescriptorPlanJsonValue {
  readonly valid: boolean;
  readonly group: number;
  readonly label: string;
  readonly resourceKey: string | null;
  readonly layoutKey: string | null;
  readonly entries: readonly {
    readonly binding: number;
    readonly resourceKey: string;
    readonly resourceKind: "buffer" | "texture-view" | "sampler";
  }[];
  readonly diagnostics: readonly LightBindGroupDescriptorDiagnostic[];
}

export type LightBindGroupResourceDiagnosticCode =
  | "lightBindGroupResource.nullDescriptorPlan"
  | "lightBindGroupResource.invalidDescriptorPlan"
  | "lightBindGroupResource.missingLayout"
  | "lightBindGroupResource.missingDeviceSupport"
  | "lightBindGroupResource.creationFailed";

export interface LightBindGroupResourceDiagnostic {
  readonly code: LightBindGroupResourceDiagnosticCode;
  readonly message: string;
  readonly resourceKey?: string;
  readonly layoutKey?: string;
}

export interface LightBindGroupCreationEntry {
  readonly binding: number;
  readonly resource: unknown;
}

export interface LightBindGroupCreationDescriptor {
  readonly label: string;
  readonly layout: unknown;
  readonly entries: readonly LightBindGroupCreationEntry[];
}

export interface LightBindGroupDeviceLike {
  createBindGroup?: (descriptor: LightBindGroupCreationDescriptor) => unknown;
}

export interface LightBindGroupResource {
  readonly group: number;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface CreateLightBindGroupResourceOptions {
  readonly device: LightBindGroupDeviceLike;
  readonly plan: LightBindGroupDescriptorPlan | null;
  readonly layout: LightBindGroupLayoutResource | null;
}

export interface CreateLightBindGroupResourceResult {
  readonly valid: boolean;
  readonly resource: LightBindGroupResource | null;
  readonly diagnostics: readonly LightBindGroupResourceDiagnostic[];
}

export interface LightBindGroupResourceJsonValue {
  readonly group: number;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly entryResourceKeys: readonly string[];
}

export interface CreateLightBindGroupResourceResultJsonValue {
  readonly valid: boolean;
  readonly resource: LightBindGroupResourceJsonValue | null;
  readonly counts: {
    readonly bindGroups: number;
    readonly entries: number;
    readonly diagnostics: number;
  };
  readonly diagnostics: readonly LightBindGroupResourceDiagnostic[];
}

export function lightBindGroupResourceKey(
  lightBufferResourceKey: string,
  group = DEFAULT_LIGHT_BIND_GROUP,
): string {
  return `bind-group:lights/group-${group}/${lightBufferResourceKey}`;
}

export function createLightBindGroupDescriptorPlan(
  options: CreateLightBindGroupDescriptorPlanOptions,
): LightBindGroupDescriptorPlan {
  const group = options.group ?? DEFAULT_LIGHT_BIND_GROUP;
  const label = options.label ?? `lights/group-${group}`;
  const diagnostics: LightBindGroupDescriptorDiagnostic[] = [];

  if (options.layoutKey === null || options.layoutKey.length === 0) {
    diagnostics.push({
      code: "lightBindGroup.missingLayoutKey",
      message: "Light bind group planning requires a layout resource key.",
    });
  }

  if (options.lightGpuBufferResource === null) {
    diagnostics.push({
      code: "lightBindGroup.missingLightGpuBufferResource",
      message:
        "Light bind group planning requires a light GPU buffer resource.",
    });
  }

  const entries: LightBindGroupDescriptorEntry[] =
    options.lightGpuBufferResource === null
      ? []
      : [
          {
            binding: 0,
            resourceKey: options.lightGpuBufferResource.floatResourceKey,
            resource: { buffer: options.lightGpuBufferResource.floatBuffer },
          },
          {
            binding: 1,
            resourceKey: options.lightGpuBufferResource.metadataResourceKey,
            resource: {
              buffer: options.lightGpuBufferResource.metadataBuffer,
            },
          },
        ];

  appendAreaLightLtcEntries(entries, options.areaLightLtcResources ?? null);

  return {
    valid: diagnostics.length === 0,
    group,
    label,
    resourceKey:
      options.lightGpuBufferResource === null
        ? null
        : lightBindGroupResourceKey(
            options.lightGpuBufferResource.resourceKey,
            group,
          ),
    layoutKey: options.layoutKey,
    entries,
    diagnostics,
  };
}

export function lightBindGroupDescriptorPlanToJsonValue(
  plan: LightBindGroupDescriptorPlan,
): LightBindGroupDescriptorPlanJsonValue {
  return {
    valid: plan.valid,
    group: plan.group,
    label: plan.label,
    resourceKey: plan.resourceKey,
    layoutKey: plan.layoutKey,
    entries: plan.entries.map((entry) => ({
      binding: entry.binding,
      resourceKey: entry.resourceKey,
      resourceKind: lightBindGroupEntryResourceKind(entry),
    })),
    diagnostics: plan.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function lightBindGroupDescriptorPlanToJson(
  plan: LightBindGroupDescriptorPlan,
): string {
  return JSON.stringify(lightBindGroupDescriptorPlanToJsonValue(plan));
}

export function createLightBindGroupResource(
  options: CreateLightBindGroupResourceOptions,
): CreateLightBindGroupResourceResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.nullDescriptorPlan",
          message: "Cannot create a light bind group from a null plan.",
        },
      ],
    };
  }

  if (!options.plan.valid || options.plan.resourceKey === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.invalidDescriptorPlan",
          message:
            "Cannot create a light bind group from an invalid descriptor plan.",
          ...(options.plan.resourceKey === null
            ? {}
            : { resourceKey: options.plan.resourceKey }),
          ...(options.plan.layoutKey === null
            ? {}
            : { layoutKey: options.plan.layoutKey }),
        },
      ],
    };
  }

  if (
    options.layout === null ||
    options.layout.layoutKey !== options.plan.layoutKey
  ) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.missingLayout",
          resourceKey: options.plan.resourceKey,
          ...(options.plan.layoutKey === null
            ? {}
            : { layoutKey: options.plan.layoutKey }),
          message: `Missing light bind group layout resource '${options.plan.layoutKey ?? "null"}'.`,
        },
      ],
    };
  }

  if (options.device.createBindGroup === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.missingDeviceSupport",
          resourceKey: options.plan.resourceKey,
          layoutKey: options.layout.layoutKey,
          message: "WebGPU device cannot create light bind groups.",
        },
      ],
    };
  }

  const descriptor: LightBindGroupCreationDescriptor = {
    label: options.plan.label,
    layout: options.layout.layout,
    entries: options.plan.entries.map((entry) => ({
      binding: entry.binding,
      resource: lightBindGroupCreationResource(entry),
    })),
  };

  try {
    return {
      valid: true,
      resource: {
        group: options.plan.group,
        resourceKey: options.plan.resourceKey,
        layoutKey: options.layout.layoutKey,
        bindGroup: options.device.createBindGroup(descriptor),
        entryResourceKeys: options.plan.entries.map(
          (entry) => entry.resourceKey,
        ),
      },
      diagnostics: [],
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupResource.creationFailed",
          resourceKey: options.plan.resourceKey,
          layoutKey: options.layout.layoutKey,
          message: `Failed to create light bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

export function createLightBindGroupResourceResultToJsonValue(
  result: CreateLightBindGroupResourceResult,
): CreateLightBindGroupResourceResultJsonValue {
  return {
    valid: result.valid,
    resource:
      result.resource === null
        ? null
        : {
            group: result.resource.group,
            resourceKey: result.resource.resourceKey,
            layoutKey: result.resource.layoutKey,
            entryResourceKeys: [...result.resource.entryResourceKeys],
          },
    counts: {
      bindGroups: result.resource === null ? 0 : 1,
      entries: result.resource?.entryResourceKeys.length ?? 0,
      diagnostics: result.diagnostics.length,
    },
    diagnostics: result.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function createLightBindGroupResourceResultToJson(
  result: CreateLightBindGroupResourceResult,
): string {
  return JSON.stringify(createLightBindGroupResourceResultToJsonValue(result));
}

function appendAreaLightLtcEntries(
  entries: LightBindGroupDescriptorEntry[],
  resources: StandardAreaLightLtcResources | null,
): void {
  if (resources === null) {
    return;
  }

  entries.push(
    {
      binding: STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING,
      resourceKey: resources.matrixTexture.resourceKey,
      resource: { textureView: resources.matrixTexture.view },
    },
    {
      binding: STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING,
      resourceKey: resources.fresnelTexture.resourceKey,
      resource: { textureView: resources.fresnelTexture.view },
    },
    {
      binding: STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING,
      resourceKey: resources.sampler.resourceKey,
      resource: { sampler: resources.sampler.sampler },
    },
  );
}

function lightBindGroupEntryResourceKind(
  entry: LightBindGroupDescriptorEntry,
): "buffer" | "texture-view" | "sampler" {
  if ("buffer" in entry.resource) {
    return "buffer";
  }

  if ("textureView" in entry.resource) {
    return "texture-view";
  }

  return "sampler";
}

function lightBindGroupCreationResource(
  entry: LightBindGroupDescriptorEntry,
): unknown {
  if ("textureView" in entry.resource) {
    return entry.resource.textureView;
  }

  if ("sampler" in entry.resource) {
    return entry.resource.sampler;
  }

  return entry.resource;
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
