import type {
  WebGpuBindGroupLayoutDescriptor,
  WebGpuBindGroupLayoutDeviceLike,
} from "./bind-group-layout-cache.js";

export const DEFAULT_LIGHT_BIND_GROUP = 3;
export const DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY = 0x2;

export type LightBindGroupLayoutDiagnosticCode =
  | "lightBindGroupLayout.missingDeviceSupport"
  | "lightBindGroupLayout.creationFailed";

export interface LightBindGroupLayoutDiagnostic {
  readonly code: LightBindGroupLayoutDiagnosticCode;
  readonly message: string;
  readonly layoutKey?: string;
}

export interface CreateLightBindGroupLayoutDescriptorOptions {
  readonly group?: number;
  readonly label?: string;
  readonly visibility?: number;
  readonly transmissionSceneColor?: boolean;
}

export interface CreateLightBindGroupLayoutResourceOptions extends CreateLightBindGroupLayoutDescriptorOptions {
  readonly device: WebGpuBindGroupLayoutDeviceLike;
  readonly layoutKey?: string;
}

export interface LightBindGroupLayoutResource {
  readonly group: number;
  readonly layoutKey: string;
  readonly layout: unknown;
  readonly descriptor: WebGpuBindGroupLayoutDescriptor;
}

export interface CreateLightBindGroupLayoutResourceResult {
  readonly valid: boolean;
  readonly resource: LightBindGroupLayoutResource | null;
  readonly diagnostics: readonly LightBindGroupLayoutDiagnostic[];
}

export function lightBindGroupLayoutResourceKey(
  group = DEFAULT_LIGHT_BIND_GROUP,
): string {
  return `bind-group-layout:lights/group-${group}`;
}

export function createLightBindGroupLayoutDescriptor(
  options: CreateLightBindGroupLayoutDescriptorOptions = {},
): WebGpuBindGroupLayoutDescriptor {
  const group = options.group ?? DEFAULT_LIGHT_BIND_GROUP;
  const visibility =
    options.visibility ?? DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY;

  return {
    label: options.label ?? `lights/group-${group}`,
    entries: [
      {
        binding: 0,
        visibility,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility,
        buffer: { type: "read-only-storage" },
      },
      ...(options.transmissionSceneColor === true
        ? [
            {
              binding: 14,
              visibility,
              texture: { sampleType: "float" },
            },
            {
              binding: 15,
              visibility,
              sampler: { type: "filtering" },
            },
          ]
        : []),
    ],
  };
}

export function createLightBindGroupLayoutResource(
  options: CreateLightBindGroupLayoutResourceOptions,
): CreateLightBindGroupLayoutResourceResult {
  const group = options.group ?? DEFAULT_LIGHT_BIND_GROUP;
  const layoutKey = options.layoutKey ?? lightBindGroupLayoutResourceKey(group);
  const descriptor = createLightBindGroupLayoutDescriptor(options);

  if (options.device.createBindGroupLayout === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupLayout.missingDeviceSupport",
          layoutKey,
          message: "WebGPU device cannot create light bind group layouts.",
        },
      ],
    };
  }

  try {
    return {
      valid: true,
      resource: {
        group,
        layoutKey,
        layout: options.device.createBindGroupLayout(descriptor),
        descriptor,
      },
      diagnostics: [],
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "lightBindGroupLayout.creationFailed",
          layoutKey,
          message: `Failed to create light bind group layout '${layoutKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
