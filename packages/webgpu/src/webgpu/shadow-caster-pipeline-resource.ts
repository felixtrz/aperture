import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "./pipeline-cache.js";
import {
  renderPipelineResourceKey,
  shaderModuleResourceKey,
} from "./resource-keys.js";
import type {
  WebGpuShaderCreateDescriptor,
  WebGpuShaderModuleLike,
} from "./shader.js";
import type {
  ShadowCasterPipelineDescriptorMetadata,
  ShadowCasterPipelineDescriptorReport,
} from "./shadow-caster-pipeline-descriptor.js";
import {
  createShadowCasterMatrixBindGroupLayoutDescriptor,
  SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY,
} from "./shadow-caster-matrix-bind-group-resource.js";
import { UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT } from "./unlit-pipeline.js";

export const SHADOW_CASTER_DEPTH_ONLY_WGSL = /* wgsl */ `
struct ShadowMatrices {
  matrices: array<mat4x4<f32>>,
};

@group(0) @binding(0) var<storage, read> shadowMatrices: ShadowMatrices;

struct VertexInput {
  @location(0) position: vec3f,
  @builtin(instance_index) instanceIndex: u32,
};

@vertex
fn vs_main(input: VertexInput) -> @builtin(position) vec4f {
  return shadowMatrices.matrices[input.instanceIndex] * vec4f(input.position, 1.0);
}

@fragment
fn fs_main() {
}
`;

export type ShadowCasterPipelineResourceStatus =
  | "available"
  | "missing"
  | "not-required";

export type ShadowCasterPipelineResourceDiagnosticCode =
  | "shadowCasterPipelineResource.missingDescriptor"
  | "shadowCasterPipelineResource.createShaderModuleUnavailable"
  | "shadowCasterPipelineResource.createRenderPipelineUnavailable"
  | "shadowCasterPipelineResource.pipelineCreationFailed"
  | "shadowCasterPipelineResource.passSubmissionDeferred"
  | "shadowCasterPipelineResource.shaderSamplingDeferred";

export interface ShadowCasterPipelineResourceDiagnostic {
  readonly code: ShadowCasterPipelineResourceDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface ShadowCasterPipelineResource {
  readonly pipelineKey: string;
  readonly resourceKey: string;
  readonly shaderModuleKey: string;
  readonly label: string;
  readonly shaderModule: WebGpuShaderModuleLike;
  readonly matrixBindGroupLayout: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface ShadowCasterPipelineResourceReport {
  readonly ready: boolean;
  readonly status: ShadowCasterPipelineResourceStatus;
  readonly descriptorCount: number;
  readonly createdPipelineCount: number;
  readonly reusedPipelineCount: number;
  readonly sections: {
    readonly pipelineDescriptor: boolean;
    readonly shaderModule: boolean;
    readonly pipelineCreation: boolean;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly resource: ShadowCasterPipelineResource | null;
  readonly diagnostics: readonly ShadowCasterPipelineResourceDiagnostic[];
}

export type ShadowCasterPipelineResourceReportJsonValue = Omit<
  ShadowCasterPipelineResourceReport,
  "resource"
> & {
  readonly resource: {
    readonly pipelineKey: string;
    readonly resourceKey: string;
    readonly shaderModuleKey: string;
    readonly label: string;
  } | null;
};

export interface ShadowCasterPipelineDeviceLike extends WebGpuRenderPipelineDeviceLike {
  createShaderModule?: (
    descriptor: WebGpuShaderCreateDescriptor,
  ) => WebGpuShaderModuleLike;
  createBindGroupLayout?: (descriptor: unknown) => unknown;
  createPipelineLayout?: (descriptor: unknown) => unknown;
}

export interface CreateShadowCasterPipelineResourceReportOptions {
  readonly device: ShadowCasterPipelineDeviceLike;
  readonly descriptor: ShadowCasterPipelineDescriptorReport;
  readonly cache?: Map<string, ShadowCasterPipelineResource>;
}

export function createShadowCasterPipelineResourceReport(
  options: CreateShadowCasterPipelineResourceReportOptions,
): ShadowCasterPipelineResourceReport {
  if (options.descriptor.status === "not-required") {
    return report({
      status: "not-required",
      descriptorCount: 0,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      resource: null,
      diagnostics: [],
    });
  }

  const metadata = options.descriptor.descriptor;

  if (metadata === null) {
    return report({
      status: "missing",
      descriptorCount: 0,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterPipelineResource.missingDescriptor",
          severity: "warning",
          message:
            "Shadow caster pipeline resource creation requires depth-only pipeline descriptor metadata.",
        },
      ],
    });
  }

  const cached = options.cache?.get(metadata.pipelineKey);

  if (cached !== undefined) {
    return report({
      status: "available",
      descriptorCount: 1,
      createdPipelineCount: 0,
      reusedPipelineCount: 1,
      resource: cached,
      diagnostics: deferredDiagnostics(),
    });
  }

  if (options.device.createShaderModule === undefined) {
    return report({
      status: "missing",
      descriptorCount: 1,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterPipelineResource.createShaderModuleUnavailable",
          severity: "warning",
          message:
            "WebGPU device cannot create the shadow caster shader module.",
        },
      ],
    });
  }

  if (options.device.createRenderPipeline === undefined) {
    return report({
      status: "missing",
      descriptorCount: 1,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterPipelineResource.createRenderPipelineUnavailable",
          severity: "warning",
          message:
            "WebGPU device cannot create the shadow caster render pipeline.",
        },
      ],
    });
  }

  const shaderModule = options.device.createShaderModule({
    label: metadata.shader.label,
    code: SHADOW_CASTER_DEPTH_ONLY_WGSL,
  });
  const explicitLayout = createExplicitShadowCasterPipelineLayout(
    options.device,
  );
  const descriptor = createBrowserShadowCasterPipelineDescriptor(
    metadata,
    shaderModule,
    explicitLayout.pipelineLayout ?? "auto",
  );

  try {
    const resource: ShadowCasterPipelineResource = {
      pipelineKey: metadata.pipelineKey,
      resourceKey: renderPipelineResourceKey(metadata.pipelineKey),
      shaderModuleKey: shaderModuleResourceKey(metadata.shader.label),
      label: metadata.label,
      shaderModule,
      matrixBindGroupLayout: explicitLayout.matrixBindGroupLayout,
      pipeline: options.device.createRenderPipeline(descriptor),
      descriptor,
    };

    options.cache?.set(metadata.pipelineKey, resource);

    return report({
      status: "available",
      descriptorCount: 1,
      createdPipelineCount: 1,
      reusedPipelineCount: 0,
      resource,
      diagnostics: deferredDiagnostics(),
    });
  } catch (error) {
    return report({
      status: "missing",
      descriptorCount: 1,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      resource: null,
      diagnostics: [
        {
          code: "shadowCasterPipelineResource.pipelineCreationFailed",
          severity: "warning",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU shadow caster render pipeline creation failed.",
        },
      ],
    });
  }
}

export function createBrowserShadowCasterPipelineDescriptor(
  metadata: ShadowCasterPipelineDescriptorMetadata,
  shaderModule: WebGpuShaderModuleLike,
  layout: unknown = "auto",
): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: metadata.label,
    layout,
    vertex: {
      module: shaderModule,
      entryPoint: metadata.shader.entryPoints.vertex,
      buffers: [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    },
    primitive: {
      topology: metadata.primitive.topology,
      frontFace: metadata.primitive.frontFace,
      cullMode: metadata.primitive.cullMode,
    },
    fragment: {
      module: shaderModule,
      entryPoint: metadata.shader.entryPoints.fragment,
      targets: [],
    },
    depthStencil: {
      format: metadata.depthStencil.format,
      depthWriteEnabled: metadata.depthStencil.depthWriteEnabled,
      depthCompare: metadata.depthStencil.depthCompare,
    },
  };
}

function createExplicitShadowCasterPipelineLayout(
  device: ShadowCasterPipelineDeviceLike,
): {
  readonly matrixBindGroupLayout: unknown;
  readonly pipelineLayout: unknown | null;
} {
  if (
    device.createBindGroupLayout === undefined ||
    device.createPipelineLayout === undefined
  ) {
    return {
      matrixBindGroupLayout: null,
      pipelineLayout: null,
    };
  }

  const matrixBindGroupLayout = device.createBindGroupLayout(
    createShadowCasterMatrixBindGroupLayoutDescriptor(),
  );
  const pipelineLayout = device.createPipelineLayout({
    label: `shadow-caster:pipeline-layout:${SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY}`,
    bindGroupLayouts: [matrixBindGroupLayout],
  });

  return { matrixBindGroupLayout, pipelineLayout };
}

export function shadowCasterPipelineResourceReportToJsonValue(
  value: ShadowCasterPipelineResourceReport,
): ShadowCasterPipelineResourceReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    descriptorCount: value.descriptorCount,
    createdPipelineCount: value.createdPipelineCount,
    reusedPipelineCount: value.reusedPipelineCount,
    sections: { ...value.sections },
    resource:
      value.resource === null
        ? null
        : {
            pipelineKey: value.resource.pipelineKey,
            resourceKey: value.resource.resourceKey,
            shaderModuleKey: value.resource.shaderModuleKey,
            label: value.resource.label,
          },
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowCasterPipelineResourceReportToJson(
  value: ShadowCasterPipelineResourceReport,
): string {
  return JSON.stringify(shadowCasterPipelineResourceReportToJsonValue(value));
}

function report(input: {
  readonly status: ShadowCasterPipelineResourceStatus;
  readonly descriptorCount: number;
  readonly createdPipelineCount: number;
  readonly reusedPipelineCount: number;
  readonly resource: ShadowCasterPipelineResource | null;
  readonly diagnostics: readonly ShadowCasterPipelineResourceDiagnostic[];
}): ShadowCasterPipelineResourceReport {
  const available = input.status === "available";

  return {
    ready: input.status === "available" || input.status === "not-required",
    status: input.status,
    descriptorCount: input.descriptorCount,
    createdPipelineCount: input.createdPipelineCount,
    reusedPipelineCount: input.reusedPipelineCount,
    sections: {
      pipelineDescriptor:
        input.descriptorCount > 0 || input.status === "not-required",
      shaderModule: available,
      pipelineCreation: available,
      passSubmission: false,
      shaderSampling: false,
    },
    resource: input.resource,
    diagnostics: input.diagnostics,
  };
}

function deferredDiagnostics(): readonly ShadowCasterPipelineResourceDiagnostic[] {
  return [
    {
      code: "shadowCasterPipelineResource.passSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow caster pipeline resource is available, but shadow pass submission is deferred.",
    },
    {
      code: "shadowCasterPipelineResource.shaderSamplingDeferred",
      severity: "warning",
      message:
        "Shadow caster pipeline resource is available, but StandardMaterial shadow sampling remains deferred.",
    },
  ];
}
