import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailure,
} from "../gpu/buffer.js";
import type { ShadowMatrixBufferDescriptorReport } from "./shadow-matrix-buffer-descriptor.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";

export type ShadowMatrixBufferResourceStatus =
  | "available"
  | "missing"
  | "not-required";

export type ShadowMatrixBufferResourceDiagnosticCode =
  | "shadowMatrixBufferResource.missingDescriptor"
  | "shadowMatrixBufferResource.missingMatrices"
  | "shadowMatrixBufferResource.missingMatrixData"
  | "shadowMatrixBufferResource.bufferCreationFailed"
  | "shadowMatrixBufferResource.bindGroupDeferred"
  | "shadowMatrixBufferResource.shaderSamplingDeferred";

export interface ShadowMatrixBufferResourceDiagnostic {
  readonly code: ShadowMatrixBufferResourceDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly matrixKey?: string;
  readonly reason?: WebGpuBufferFailure["reason"];
}

export interface ShadowMatrixBufferResource {
  readonly resourceKey: string;
  readonly label: string;
  readonly buffer: unknown;
  readonly byteSize: number;
  readonly matrixCount: number;
  readonly entryMatrixKeys: readonly string[];
}

export interface ShadowMatrixBufferResourceReport {
  readonly ready: boolean;
  readonly status: ShadowMatrixBufferResourceStatus;
  readonly matrixCount: number;
  readonly byteSize: number;
  readonly createdBufferCount: number;
  readonly reusedBufferCount: number;
  readonly sections: {
    readonly matrixComputation: boolean;
    readonly bufferDescriptor: boolean;
    readonly bufferAllocation: boolean;
    readonly upload: boolean;
    readonly bindGroupResource: false;
    readonly shaderSampling: false;
  };
  readonly resource: ShadowMatrixBufferResource | null;
  readonly diagnostics: readonly ShadowMatrixBufferResourceDiagnostic[];
}

export type ShadowMatrixBufferResourceReportJsonValue = Omit<
  ShadowMatrixBufferResourceReport,
  "resource"
> & {
  readonly resource: {
    readonly resourceKey: string;
    readonly label: string;
    readonly byteSize: number;
    readonly matrixCount: number;
    readonly entryMatrixKeys: readonly string[];
  } | null;
};

export interface CreateShadowMatrixBufferResourceReportOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly descriptor: ShadowMatrixBufferDescriptorReport;
  readonly matrices: ShadowMatrixComputationReportLike;
  readonly cache?: Map<string, ShadowMatrixBufferResource>;
}

export interface ShadowMatrixComputationLike {
  readonly matrixKey: string;
  readonly viewProjectionMatrix: readonly number[];
}

export interface ShadowMatrixComputationReportLike {
  readonly status: "ready" | "missing" | "unsupported" | "not-required";
  readonly matrixCount: number;
  readonly matrices: readonly ShadowMatrixComputationLike[];
}

export const DEFAULT_SHADOW_MATRIX_BUFFER_USAGE =
  WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;

export function createShadowMatrixBufferResourceReport(
  options: CreateShadowMatrixBufferResourceReportOptions,
): ShadowMatrixBufferResourceReport {
  if (
    options.descriptor.status === "not-required" ||
    options.matrices.status === "not-required"
  ) {
    return report({
      status: "not-required",
      matrixCount: 0,
      byteSize: 0,
      createdBufferCount: 0,
      reusedBufferCount: 0,
      resource: null,
      diagnostics: [],
    });
  }

  const diagnostics: ShadowMatrixBufferResourceDiagnostic[] = [];

  if (options.descriptor.descriptor === null) {
    diagnostics.push({
      code: "shadowMatrixBufferResource.missingDescriptor",
      severity: "warning",
      message:
        "Shadow matrix buffer resource allocation requires a matrix buffer descriptor.",
    });
  }

  if (options.matrices.status !== "ready") {
    diagnostics.push({
      code: "shadowMatrixBufferResource.missingMatrices",
      severity: "warning",
      message:
        "Shadow matrix buffer resource allocation requires computed directional shadow matrices.",
    });
  }

  if (diagnostics.length > 0 || options.descriptor.descriptor === null) {
    return report({
      status: "missing",
      matrixCount: options.matrices.matrixCount,
      byteSize: options.descriptor.byteSize,
      createdBufferCount: 0,
      reusedBufferCount: 0,
      resource: null,
      diagnostics,
    });
  }

  const descriptor = options.descriptor.descriptor;
  const cached = options.cache?.get(descriptor.resourceKey);

  if (cached !== undefined) {
    return report({
      status: "available",
      matrixCount: cached.matrixCount,
      byteSize: cached.byteSize,
      createdBufferCount: 0,
      reusedBufferCount: 1,
      resource: cached,
      diagnostics: deferredDiagnostics(),
    });
  }

  const packed = packShadowMatrices(options.descriptor, options.matrices);

  if ("diagnostics" in packed) {
    return report({
      status: "missing",
      matrixCount: options.matrices.matrixCount,
      byteSize: descriptor.byteSize,
      createdBufferCount: 0,
      reusedBufferCount: 0,
      resource: null,
      diagnostics: packed.diagnostics,
    });
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: descriptor.label,
      size: descriptor.byteSize,
      usage: DEFAULT_SHADOW_MATRIX_BUFFER_USAGE,
      initialData: packed.data,
    },
  });

  if (!buffer.ok) {
    return report({
      status: "missing",
      matrixCount: descriptor.matrixCount,
      byteSize: descriptor.byteSize,
      createdBufferCount: 0,
      reusedBufferCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowMatrixBufferResource.bufferCreationFailed",
          severity: "warning",
          reason: buffer.reason,
          message: buffer.message,
        },
      ],
    });
  }

  const resource: ShadowMatrixBufferResource = {
    resourceKey: descriptor.resourceKey,
    label: descriptor.label,
    buffer: buffer.buffer,
    byteSize: descriptor.byteSize,
    matrixCount: descriptor.matrixCount,
    entryMatrixKeys: descriptor.entries.map((entry) => entry.matrixKey),
  };

  options.cache?.set(descriptor.resourceKey, resource);

  return report({
    status: "available",
    matrixCount: descriptor.matrixCount,
    byteSize: descriptor.byteSize,
    createdBufferCount: 1,
    reusedBufferCount: 0,
    resource,
    diagnostics: deferredDiagnostics(),
  });
}

export function shadowMatrixBufferResourceReportToJsonValue(
  value: ShadowMatrixBufferResourceReport,
): ShadowMatrixBufferResourceReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    matrixCount: value.matrixCount,
    byteSize: value.byteSize,
    createdBufferCount: value.createdBufferCount,
    reusedBufferCount: value.reusedBufferCount,
    sections: { ...value.sections },
    resource:
      value.resource === null
        ? null
        : {
            resourceKey: value.resource.resourceKey,
            label: value.resource.label,
            byteSize: value.resource.byteSize,
            matrixCount: value.resource.matrixCount,
            entryMatrixKeys: [...value.resource.entryMatrixKeys],
          },
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowMatrixBufferResourceReportToJson(
  value: ShadowMatrixBufferResourceReport,
): string {
  return JSON.stringify(shadowMatrixBufferResourceReportToJsonValue(value));
}

function packShadowMatrices(
  descriptor: ShadowMatrixBufferDescriptorReport,
  matrices: ShadowMatrixComputationReportLike,
):
  | { readonly data: Float32Array }
  | { readonly diagnostics: readonly ShadowMatrixBufferResourceDiagnostic[] } {
  const bufferDescriptor = descriptor.descriptor;

  if (bufferDescriptor === null) {
    return {
      diagnostics: [
        {
          code: "shadowMatrixBufferResource.missingDescriptor",
          severity: "warning",
          message: "Shadow matrix packing requires a matrix buffer descriptor.",
        },
      ],
    };
  }

  const matrixByKey = new Map(
    matrices.matrices.map((matrix) => [matrix.matrixKey, matrix]),
  );
  const data = new Float32Array(bufferDescriptor.byteSize / 4);
  const diagnostics: ShadowMatrixBufferResourceDiagnostic[] = [];

  for (const entry of bufferDescriptor.entries) {
    const matrix = matrixByKey.get(entry.matrixKey);

    if (matrix === undefined) {
      diagnostics.push({
        code: "shadowMatrixBufferResource.missingMatrixData",
        severity: "warning",
        matrixKey: entry.matrixKey,
        message: `Shadow matrix '${entry.matrixKey}' is missing computed matrix data.`,
      });
      continue;
    }

    data.set(
      matrix.viewProjectionMatrix,
      entry.offsetBytes / Float32Array.BYTES_PER_ELEMENT,
    );
  }

  return diagnostics.length === 0 ? { data } : { diagnostics };
}

function report(input: {
  readonly status: ShadowMatrixBufferResourceStatus;
  readonly matrixCount: number;
  readonly byteSize: number;
  readonly createdBufferCount: number;
  readonly reusedBufferCount: number;
  readonly resource: ShadowMatrixBufferResource | null;
  readonly diagnostics: readonly ShadowMatrixBufferResourceDiagnostic[];
}): ShadowMatrixBufferResourceReport {
  const available = input.status === "available";

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    matrixCount: input.matrixCount,
    byteSize: input.byteSize,
    createdBufferCount: input.createdBufferCount,
    reusedBufferCount: input.reusedBufferCount,
    sections: {
      matrixComputation: input.status !== "missing",
      bufferDescriptor: input.status !== "missing",
      bufferAllocation: available,
      upload: available,
      bindGroupResource: false,
      shaderSampling: false,
    },
    resource: input.resource,
    diagnostics: input.diagnostics,
  };
}

function deferredDiagnostics(): readonly ShadowMatrixBufferResourceDiagnostic[] {
  return [
    {
      code: "shadowMatrixBufferResource.bindGroupDeferred",
      severity: "warning",
      message:
        "Shadow matrix buffer resource is available, but shadow bind-group creation is deferred.",
    },
    {
      code: "shadowMatrixBufferResource.shaderSamplingDeferred",
      severity: "warning",
      message:
        "Shadow matrix buffer resource is available, but StandardMaterial shadow sampling is deferred.",
    },
  ];
}
