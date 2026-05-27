import { bindGroupResourceKey } from "../resources/core/resource-keys.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";

export const SHADOW_CASTER_MATRIX_BIND_GROUP = 0;
export const SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY =
  "shadow-caster/group-0:directional-shadow-matrices@0";

export type ShadowCasterMatrixBindGroupResourceStatus =
  | "available"
  | "missing"
  | "not-required";

export type ShadowCasterMatrixBindGroupResourceDiagnosticCode =
  | "shadowCasterMatrixBindGroupResource.missingMatrixBufferResource"
  | "shadowCasterMatrixBindGroupResource.createBindGroupLayoutUnavailable"
  | "shadowCasterMatrixBindGroupResource.createBindGroupUnavailable"
  | "shadowCasterMatrixBindGroupResource.creationFailed"
  | "shadowCasterMatrixBindGroupResource.passSubmissionDeferred"
  | "shadowCasterMatrixBindGroupResource.shaderSamplingDeferred";

export interface ShadowCasterMatrixBindGroupResourceDiagnostic {
  readonly code: ShadowCasterMatrixBindGroupResourceDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly resourceKey?: string;
}

export interface ShadowCasterMatrixBindGroupResource {
  readonly group: 0;
  readonly matrixResourceKey: string;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly layout: unknown;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface ShadowCasterMatrixBindGroupResourceReport {
  readonly ready: boolean;
  readonly status: ShadowCasterMatrixBindGroupResourceStatus;
  readonly matrixBufferCount: number;
  readonly createdBindGroupCount: number;
  readonly reusedBindGroupCount: number;
  readonly sections: {
    readonly matrixBufferResource: boolean;
    readonly bindGroupLayout: boolean;
    readonly bindGroupResource: boolean;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly resource: ShadowCasterMatrixBindGroupResource | null;
  readonly diagnostics: readonly ShadowCasterMatrixBindGroupResourceDiagnostic[];
}

export type ShadowCasterMatrixBindGroupResourceReportJsonValue = Omit<
  ShadowCasterMatrixBindGroupResourceReport,
  "resource"
> & {
  readonly resource: {
    readonly group: 0;
    readonly matrixResourceKey: string;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly entryResourceKeys: readonly string[];
  } | null;
};

export interface ShadowCasterMatrixBindGroupDeviceLike {
  readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
  readonly createBindGroup?: (descriptor: unknown) => unknown;
}

export interface CreateShadowCasterMatrixBindGroupResourceReportOptions {
  readonly device: ShadowCasterMatrixBindGroupDeviceLike;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly layout?: unknown;
  readonly cache?: Map<string, ShadowCasterMatrixBindGroupResource>;
}

export function createShadowCasterMatrixBindGroupResourceReport(
  options: CreateShadowCasterMatrixBindGroupResourceReportOptions,
): ShadowCasterMatrixBindGroupResourceReport {
  if (options.matrixBufferResource.status === "not-required") {
    return report({
      status: "not-required",
      matrixBufferCount: 0,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 0,
      resource: null,
      diagnostics: [],
    });
  }

  const matrixResource = options.matrixBufferResource.resource;

  if (matrixResource === null) {
    return report({
      status: "missing",
      matrixBufferCount: 0,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterMatrixBindGroupResource.missingMatrixBufferResource",
          severity: "warning",
          message:
            "Shadow caster matrix bind-group creation requires a live shadow matrix buffer resource.",
        },
      ],
    });
  }

  const resourceKey = shadowCasterMatrixBindGroupResourceKey(
    matrixResource.resourceKey,
  );
  const cached = options.cache?.get(resourceKey);

  if (cached !== undefined) {
    return report({
      status: "available",
      matrixBufferCount: 1,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 1,
      resource: cached,
      diagnostics: deferredDiagnostics(),
    });
  }

  if (
    options.layout === undefined &&
    options.device.createBindGroupLayout === undefined
  ) {
    return report({
      status: "missing",
      matrixBufferCount: 1,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterMatrixBindGroupResource.createBindGroupLayoutUnavailable",
          severity: "warning",
          resourceKey,
          message:
            "WebGPU device cannot create the shadow caster matrix bind-group layout.",
        },
      ],
    });
  }

  if (options.device.createBindGroup === undefined) {
    return report({
      status: "missing",
      matrixBufferCount: 1,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterMatrixBindGroupResource.createBindGroupUnavailable",
          severity: "warning",
          resourceKey,
          message:
            "WebGPU device cannot create the shadow caster matrix bind group.",
        },
      ],
    });
  }

  try {
    const layout =
      options.layout ??
      options.device.createBindGroupLayout?.(
        createShadowCasterMatrixBindGroupLayoutDescriptor(),
      );
    const bindGroup = options.device.createBindGroup({
      label: resourceKey,
      layout,
      entries: [
        {
          binding: 0,
          resource: { buffer: matrixResource.buffer },
        },
      ],
    });
    const resource: ShadowCasterMatrixBindGroupResource = {
      group: SHADOW_CASTER_MATRIX_BIND_GROUP,
      matrixResourceKey: matrixResource.resourceKey,
      resourceKey,
      layoutKey: SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY,
      layout,
      bindGroup,
      entryResourceKeys: [matrixResource.resourceKey],
    };

    options.cache?.set(resourceKey, resource);

    return report({
      status: "available",
      matrixBufferCount: 1,
      createdBindGroupCount: 1,
      reusedBindGroupCount: 0,
      resource,
      diagnostics: deferredDiagnostics(),
    });
  } catch (error) {
    return report({
      status: "missing",
      matrixBufferCount: 1,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterMatrixBindGroupResource.creationFailed",
          severity: "warning",
          resourceKey,
          message:
            error instanceof Error
              ? error.message
              : "WebGPU shadow caster matrix bind-group creation failed.",
        },
      ],
    });
  }
}

export function createShadowCasterMatrixBindGroupLayoutDescriptor() {
  return {
    label: SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY,
    entries: [
      {
        binding: 0,
        visibility: 1,
        buffer: { type: "read-only-storage" },
      },
    ],
  };
}

export function shadowCasterMatrixBindGroupResourceKey(
  matrixResourceKey: string,
): string {
  return bindGroupResourceKey(
    `shadow-caster/group-${SHADOW_CASTER_MATRIX_BIND_GROUP}/${matrixResourceKey}`,
  );
}

export function shadowCasterMatrixBindGroupResourceReportToJsonValue(
  value: ShadowCasterMatrixBindGroupResourceReport,
): ShadowCasterMatrixBindGroupResourceReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    matrixBufferCount: value.matrixBufferCount,
    createdBindGroupCount: value.createdBindGroupCount,
    reusedBindGroupCount: value.reusedBindGroupCount,
    sections: { ...value.sections },
    resource:
      value.resource === null
        ? null
        : {
            group: value.resource.group,
            matrixResourceKey: value.resource.matrixResourceKey,
            resourceKey: value.resource.resourceKey,
            layoutKey: value.resource.layoutKey,
            entryResourceKeys: [...value.resource.entryResourceKeys],
          },
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowCasterMatrixBindGroupResourceReportToJson(
  value: ShadowCasterMatrixBindGroupResourceReport,
): string {
  return JSON.stringify(
    shadowCasterMatrixBindGroupResourceReportToJsonValue(value),
  );
}

function report(input: {
  readonly status: ShadowCasterMatrixBindGroupResourceStatus;
  readonly matrixBufferCount: number;
  readonly createdBindGroupCount: number;
  readonly reusedBindGroupCount: number;
  readonly resource: ShadowCasterMatrixBindGroupResource | null;
  readonly diagnostics: readonly ShadowCasterMatrixBindGroupResourceDiagnostic[];
}): ShadowCasterMatrixBindGroupResourceReport {
  const available = input.status === "available";

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    matrixBufferCount: input.matrixBufferCount,
    createdBindGroupCount: input.createdBindGroupCount,
    reusedBindGroupCount: input.reusedBindGroupCount,
    sections: {
      matrixBufferResource:
        input.matrixBufferCount > 0 || input.status === "not-required",
      bindGroupLayout: available,
      bindGroupResource: available,
      passSubmission: false,
      shaderSampling: false,
    },
    resource: input.resource,
    diagnostics: input.diagnostics,
  };
}

function deferredDiagnostics(): readonly ShadowCasterMatrixBindGroupResourceDiagnostic[] {
  return [
    {
      code: "shadowCasterMatrixBindGroupResource.passSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow caster matrix bind group is available, but shadow pass submission is deferred.",
    },
    {
      code: "shadowCasterMatrixBindGroupResource.shaderSamplingDeferred",
      severity: "warning",
      message:
        "Shadow caster matrix bind group is available, but StandardMaterial shadow sampling remains deferred.",
    },
  ];
}
