import {
  validateDebugNormalMaterialBindGroupLayout,
  type DebugNormalMaterialBindGroupLayoutDescriptor,
} from "./debug-normal-bind-group-layout.js";
import { bindGroupResourceKey } from "../../resources/core/resource-keys.js";

export type DebugNormalMaterialBindGroupResourceKind = "buffer";

export type DebugNormalMaterialBindGroupDescriptorDiagnosticCode =
  "debugNormalMaterialBindGroup.missingMaterialResource";

export interface DebugNormalMaterialBindGroupDescriptorDiagnostic {
  readonly code: DebugNormalMaterialBindGroupDescriptorDiagnosticCode;
  readonly message: string;
  readonly binding?: number;
}

export interface DebugNormalMaterialBindGroupResourceInput {
  readonly materialResourceKey: string | null;
}

export interface DebugNormalMaterialBindGroupDescriptorEntry {
  readonly group: 2;
  readonly binding: number;
  readonly resourceKey: string;
  readonly resourceKind: DebugNormalMaterialBindGroupResourceKind;
}

export interface DebugNormalMaterialBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly group: 2;
  readonly resourceKey: string | null;
  readonly entries: readonly DebugNormalMaterialBindGroupDescriptorEntry[];
  readonly diagnostics: readonly DebugNormalMaterialBindGroupDescriptorDiagnostic[];
}

export type DebugNormalMaterialBindGroupResourceDiagnosticCode =
  | "debugNormalMaterialBindGroupResource.nullDescriptorPlan"
  | "debugNormalMaterialBindGroupResource.invalidDescriptorPlan"
  | "debugNormalMaterialBindGroupResource.missingLayout"
  | "debugNormalMaterialBindGroupResource.invalidLayout"
  | "debugNormalMaterialBindGroupResource.missingDeviceSupport"
  | "debugNormalMaterialBindGroupResource.missingBufferResource"
  | "debugNormalMaterialBindGroupResource.creationFailed";

export interface DebugNormalMaterialBindGroupResourceDiagnostic {
  readonly code: DebugNormalMaterialBindGroupResourceDiagnosticCode;
  readonly message: string;
  readonly group?: 2;
  readonly binding?: number;
  readonly resourceKey?: string;
  readonly layoutKey?: string;
}

export interface DebugNormalMaterialBindGroupLayoutResource {
  readonly group: number;
  readonly layoutKey: string;
  readonly layout: unknown;
  readonly descriptor?: DebugNormalMaterialBindGroupLayoutDescriptor;
}

export interface DebugNormalMaterialBindGroupBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
}

export interface DebugNormalMaterialBindGroupCreationEntry {
  readonly binding: number;
  readonly resource: unknown;
}

export interface DebugNormalMaterialBindGroupCreationDescriptor {
  readonly label: string;
  readonly layout: unknown;
  readonly entries: readonly DebugNormalMaterialBindGroupCreationEntry[];
}

export interface DebugNormalMaterialBindGroupDeviceLike {
  createBindGroup?: (
    descriptor: DebugNormalMaterialBindGroupCreationDescriptor,
  ) => unknown;
}

export interface DebugNormalMaterialBindGroupResource {
  readonly group: 2;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface DebugNormalMaterialBindGroupResourceJsonValue {
  readonly group: 2;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly entryResourceKeys: readonly string[];
}

export interface CreateDebugNormalMaterialBindGroupResourceOptions {
  readonly device: DebugNormalMaterialBindGroupDeviceLike;
  readonly plan: DebugNormalMaterialBindGroupDescriptorPlan | null;
  readonly layout: DebugNormalMaterialBindGroupLayoutResource | null;
  readonly buffers: readonly DebugNormalMaterialBindGroupBufferResource[];
}

export interface CreateDebugNormalMaterialBindGroupResourceResult {
  readonly valid: boolean;
  readonly resource: DebugNormalMaterialBindGroupResource | null;
  readonly diagnostics: readonly DebugNormalMaterialBindGroupResourceDiagnostic[];
}

export function createDebugNormalMaterialBindGroupDescriptorPlan(
  input: DebugNormalMaterialBindGroupResourceInput,
): DebugNormalMaterialBindGroupDescriptorPlan {
  if (input.materialResourceKey === null) {
    return {
      valid: false,
      group: 2,
      resourceKey: null,
      entries: [],
      diagnostics: [
        {
          code: "debugNormalMaterialBindGroup.missingMaterialResource",
          binding: 0,
          message:
            "DebugNormal material bind group planning requires a material uniform buffer resource.",
        },
      ],
    };
  }

  const entries: readonly DebugNormalMaterialBindGroupDescriptorEntry[] = [
    {
      group: 2,
      binding: 0,
      resourceKey: input.materialResourceKey,
      resourceKind: "buffer",
    },
  ];

  return {
    valid: true,
    group: 2,
    resourceKey: createDebugNormalMaterialBindGroupResourceKey(entries),
    entries,
    diagnostics: [],
  };
}

export function createDebugNormalMaterialBindGroupResourceKey(
  entries: readonly DebugNormalMaterialBindGroupDescriptorEntry[],
): string {
  return bindGroupResourceKey(
    `debug-normal/group-2/${entries
      .slice()
      .sort((a, b) => a.binding - b.binding)
      .map((entry) => `${entry.binding}:${entry.resourceKey}`)
      .join("/")}`,
  );
}

export function createDebugNormalMaterialBindGroupResource(
  options: CreateDebugNormalMaterialBindGroupResourceOptions,
): CreateDebugNormalMaterialBindGroupResourceResult {
  if (options.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "debugNormalMaterialBindGroupResource.nullDescriptorPlan",
          message:
            "Cannot create a debug-normal material bind group from a null descriptor plan.",
        },
      ],
    };
  }

  const diagnostics: DebugNormalMaterialBindGroupResourceDiagnostic[] = [];

  if (!options.plan.valid || options.plan.resourceKey === null) {
    diagnostics.push({
      code: "debugNormalMaterialBindGroupResource.invalidDescriptorPlan",
      message:
        "Cannot create a debug-normal material bind group from an invalid descriptor plan.",
    });
  }

  if (options.layout === null) {
    diagnostics.push({
      code: "debugNormalMaterialBindGroupResource.missingLayout",
      group: 2,
      message:
        "DebugNormal material bind group creation requires a group-2 layout resource.",
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
          code: "debugNormalMaterialBindGroupResource.missingDeviceSupport",
          message:
            "WebGPU device cannot create debug-normal material bind groups.",
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

  const descriptor = createDebugNormalBindGroupCreationDescriptor(
    options.plan,
    options.layout,
    options.buffers,
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
          code: "debugNormalMaterialBindGroupResource.creationFailed",
          group: 2,
          resourceKey: options.plan.resourceKey,
          layoutKey: options.layout.layoutKey,
          message: `Failed to create debug-normal material bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

export function debugNormalMaterialBindGroupResourceToJsonValue(
  resource: DebugNormalMaterialBindGroupResource,
): DebugNormalMaterialBindGroupResourceJsonValue {
  return {
    group: resource.group,
    resourceKey: resource.resourceKey,
    layoutKey: resource.layoutKey,
    entryResourceKeys: resource.entryResourceKeys,
  };
}

function validateLayoutResource(
  layout: DebugNormalMaterialBindGroupLayoutResource,
): readonly DebugNormalMaterialBindGroupResourceDiagnostic[] {
  const diagnostics: DebugNormalMaterialBindGroupResourceDiagnostic[] = [];

  if (layout.group !== 2) {
    diagnostics.push({
      code: "debugNormalMaterialBindGroupResource.invalidLayout",
      group: 2,
      layoutKey: layout.layoutKey,
      message: `DebugNormal material bind group layout resource must be group 2, not ${layout.group}.`,
    });
  }

  if (layout.descriptor !== undefined) {
    for (const diagnostic of validateDebugNormalMaterialBindGroupLayout(
      layout.descriptor,
    )) {
      diagnostics.push({
        code: "debugNormalMaterialBindGroupResource.invalidLayout",
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

function createDebugNormalBindGroupCreationDescriptor(
  plan: DebugNormalMaterialBindGroupDescriptorPlan,
  layout: DebugNormalMaterialBindGroupLayoutResource,
  buffers: readonly DebugNormalMaterialBindGroupBufferResource[],
  diagnostics: DebugNormalMaterialBindGroupResourceDiagnostic[],
): DebugNormalMaterialBindGroupCreationDescriptor | null {
  const bufferMap = new Map(
    buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]),
  );
  const entries = plan.entries.flatMap((entry) => {
    const buffer = bufferMap.get(entry.resourceKey);

    if (buffer === undefined) {
      diagnostics.push({
        code: "debugNormalMaterialBindGroupResource.missingBufferResource",
        group: 2,
        binding: entry.binding,
        resourceKey: entry.resourceKey,
        message: `Missing GPU buffer resource '${entry.resourceKey}' for debug-normal material group 2.`,
      });
      return [];
    }

    return [{ binding: entry.binding, resource: { buffer } }];
  });

  if (entries.length !== plan.entries.length) {
    return null;
  }

  return {
    label: "debug-normal/group-2",
    layout: layout.layout,
    entries,
  };
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
