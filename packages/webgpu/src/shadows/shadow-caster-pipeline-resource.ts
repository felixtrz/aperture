import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../gpu/pipeline-cache.js";
import {
  renderPipelineResourceKey,
  shaderModuleResourceKey,
} from "../resources/core/resource-keys.js";
import type {
  WebGpuShaderCreateDescriptor,
  WebGpuShaderModuleLike,
} from "../gpu/shader.js";
import type {
  ShadowCasterPipelineDescriptorMetadata,
  ShadowCasterPipelineDescriptorReport,
} from "./shadow-caster-pipeline-descriptor.js";
import {
  createShadowCasterMatrixBindGroupLayoutDescriptor,
  SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY,
} from "./shadow-caster-matrix-bind-group-resource.js";
import {
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  type UnlitPrimitiveVertexBufferLayout,
} from "../materials/unlit/unlit-pipeline.js";

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
  readonly resources: readonly ShadowCasterPipelineResource[];
  readonly diagnostics: readonly ShadowCasterPipelineResourceDiagnostic[];
}

export type ShadowCasterPipelineResourceReportJsonValue = Omit<
  ShadowCasterPipelineResourceReport,
  "resource" | "resources"
> & {
  readonly resource: {
    readonly pipelineKey: string;
    readonly resourceKey: string;
    readonly shaderModuleKey: string;
    readonly label: string;
  } | null;
  readonly resources: readonly {
    readonly pipelineKey: string;
    readonly resourceKey: string;
    readonly shaderModuleKey: string;
    readonly label: string;
  }[];
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
      resources: [],
      diagnostics: [],
    });
  }

  const metadataEntries =
    options.descriptor.descriptors.length > 0
      ? options.descriptor.descriptors
      : options.descriptor.descriptor === null
        ? []
        : [options.descriptor.descriptor];

  if (metadataEntries.length === 0) {
    return report({
      status: "missing",
      descriptorCount: 0,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      resource: null,
      resources: [],
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

  const cachedResources: ShadowCasterPipelineResource[] = [];
  const pendingMetadata: ShadowCasterPipelineDescriptorMetadata[] = [];

  for (const metadata of metadataEntries) {
    const cached = options.cache?.get(metadata.pipelineKey);

    if (cached === undefined) {
      pendingMetadata.push(metadata);
    } else {
      cachedResources.push(cached);
    }
  }

  if (pendingMetadata.length === 0) {
    return report({
      status: "available",
      descriptorCount: metadataEntries.length,
      createdPipelineCount: 0,
      reusedPipelineCount: cachedResources.length,
      resource: cachedResources[0] ?? null,
      resources: cachedResources,
      diagnostics: deferredDiagnostics(),
    });
  }

  if (options.device.createShaderModule === undefined) {
    return report({
      status: "missing",
      descriptorCount: metadataEntries.length,
      createdPipelineCount: 0,
      reusedPipelineCount: cachedResources.length,
      resource: null,
      resources: cachedResources,
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
      descriptorCount: metadataEntries.length,
      createdPipelineCount: 0,
      reusedPipelineCount: cachedResources.length,
      resource: null,
      resources: cachedResources,
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

  const createRenderPipeline = options.device.createRenderPipeline.bind(
    options.device,
  );
  const shaderModule = options.device.createShaderModule({
    label: pendingMetadata[0]?.shader.label ?? "shadow-caster-depth-only",
    code: SHADOW_CASTER_DEPTH_ONLY_WGSL,
  });
  const explicitLayout = createExplicitShadowCasterPipelineLayout(
    options.device,
  );

  try {
    const createdResources = pendingMetadata.map((metadata) => {
      const descriptor = createBrowserShadowCasterPipelineDescriptor(
        metadata,
        shaderModule,
        explicitLayout.pipelineLayout ?? "auto",
      );
      const resource: ShadowCasterPipelineResource = {
        pipelineKey: metadata.pipelineKey,
        resourceKey: renderPipelineResourceKey(metadata.pipelineKey),
        shaderModuleKey: shaderModuleResourceKey(metadata.shader.label),
        label: metadata.label,
        shaderModule,
        matrixBindGroupLayout: explicitLayout.matrixBindGroupLayout,
        pipeline: createRenderPipeline(descriptor),
        descriptor,
      };

      options.cache?.set(metadata.pipelineKey, resource);

      return resource;
    });
    const resources = [...cachedResources, ...createdResources];

    return report({
      status: "available",
      descriptorCount: metadataEntries.length,
      createdPipelineCount: createdResources.length,
      reusedPipelineCount: cachedResources.length,
      resource: resources[0] ?? null,
      resources,
      diagnostics: deferredDiagnostics(),
    });
  } catch (error) {
    return report({
      status: "missing",
      descriptorCount: metadataEntries.length,
      createdPipelineCount: 0,
      reusedPipelineCount: cachedResources.length,
      resource: null,
      resources: cachedResources,
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
      buffers: resolveShadowCasterVertexBufferLayouts(
        metadata.vertex.meshLayoutKey,
      ),
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
      depthBias: metadata.depthStencil.depthBias,
      depthBiasSlopeScale: metadata.depthStencil.depthBiasSlopeScale,
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
    resources: value.resources.map((resource) => ({
      pipelineKey: resource.pipelineKey,
      resourceKey: resource.resourceKey,
      shaderModuleKey: resource.shaderModuleKey,
      label: resource.label,
    })),
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
  readonly resources: readonly ShadowCasterPipelineResource[];
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
    resources: input.resources,
    diagnostics: input.diagnostics,
  };
}

function resolveShadowCasterVertexBufferLayouts(
  meshLayoutKey: string | null,
): readonly UnlitPrimitiveVertexBufferLayout[] {
  const parsed = parseShadowCasterPositionLayout(meshLayoutKey);

  return parsed === null ? [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT] : [parsed];
}

function parseShadowCasterPositionLayout(
  meshLayoutKey: string | null,
): UnlitPrimitiveVertexBufferLayout | null {
  if (meshLayoutKey === null || meshLayoutKey.trim().length === 0) {
    return null;
  }

  const firstStream = meshLayoutKey.split("|")[0];

  if (firstStream === undefined) {
    return null;
  }

  let explicitStride: number | null = null;
  let offset = 0;
  let positionOffset: number | null = null;

  for (const rawToken of firstStream.split(",")) {
    const token = rawToken.trim();

    if (token.length === 0) {
      return null;
    }

    if (token.startsWith("stride=")) {
      const stride = parseExplicitMeshLayoutStride(token);

      if (stride === null || explicitStride !== null) {
        return null;
      }

      explicitStride = stride;
      continue;
    }

    const parsed = parseExplicitMeshLayoutAttributeOffset(token);
    const semantic = meshLayoutTokenSemantic(parsed.token);
    const format = shadowCasterMeshLayoutTokenFormat(parsed.token);

    if (semantic === null || format === null) {
      return null;
    }

    const attributeOffset = parsed.offset ?? offset;
    const attributeEnd = attributeOffset + vertexFormatByteSize(format);

    if (semantic === "POSITION") {
      positionOffset = attributeOffset;
    }

    offset =
      parsed.offset === null ? attributeEnd : Math.max(offset, attributeEnd);
  }

  const arrayStride = explicitStride ?? offset;

  return positionOffset !== null && arrayStride >= positionOffset + 12
    ? {
        arrayStride,
        stepMode: "vertex",
        attributes: [
          {
            shaderLocation: 0,
            offset: positionOffset,
            format: "float32x3",
          },
        ],
      }
    : null;
}

function meshLayoutTokenSemantic(token: string): string | null {
  const [semantic] = token.split(":");

  return semantic === undefined || semantic.length === 0 ? null : semantic;
}

function shadowCasterMeshLayoutTokenFormat(token: string): string | null {
  const [semantic, format] = token.split(":");

  switch (semantic) {
    case "POSITION":
    case "NORMAL":
    case "MORPH_POSITION_0":
    case "MORPH_NORMAL_0":
    case "MORPH_POSITION_1":
    case "MORPH_NORMAL_1":
      return format === undefined ? "float32x3" : null;
    case "TEXCOORD_0":
    case "TEXCOORD_1":
      return format === undefined ? "float32x2" : null;
    case "TANGENT":
      return format === undefined ? "float32x4" : null;
    case "COLOR_0":
      return format === undefined || isShadowCasterColorFormat(format)
        ? (format ?? "float32x4")
        : null;
    case "JOINTS_0":
      return format === undefined
        ? "uint16x4"
        : format === "uint8x4" || format === "uint16x4"
          ? format
          : null;
    case "WEIGHTS_0":
      return format === undefined || isShadowCasterWeightFormat(format)
        ? (format ?? "float32x4")
        : null;
    default:
      return null;
  }
}

function parseExplicitMeshLayoutStride(token: string): number | null {
  const rawStride = token.slice("stride=".length);
  const value = Number.parseInt(rawStride, 10);

  return Number.isInteger(value) && value > 0 && String(value) === rawStride
    ? value
    : null;
}

function parseExplicitMeshLayoutAttributeOffset(token: string): {
  readonly token: string;
  readonly offset: number | null;
} {
  const offsetSeparator = token.lastIndexOf("@");

  if (offsetSeparator < 0) {
    return { token, offset: null };
  }

  const baseToken = token.slice(0, offsetSeparator);
  const rawOffset = token.slice(offsetSeparator + 1);
  const offset = Number.parseInt(rawOffset, 10);

  return Number.isInteger(offset) &&
    offset >= 0 &&
    String(offset) === rawOffset &&
    baseToken.length > 0
    ? { token: baseToken, offset }
    : { token: "", offset: null };
}

function isShadowCasterColorFormat(format: string): boolean {
  return (
    format === "float32x3" ||
    format === "float32x4" ||
    format === "unorm8x4" ||
    format === "unorm16x4"
  );
}

function isShadowCasterWeightFormat(format: string): boolean {
  return (
    format === "float32x4" || format === "unorm8x4" || format === "unorm16x4"
  );
}

function vertexFormatByteSize(format: string): number {
  switch (format) {
    case "uint8x4":
    case "unorm8x4":
      return 4;
    case "uint16x4":
    case "unorm16x4":
    case "float32x2":
      return 8;
    case "float32x3":
      return 12;
    case "float32x4":
      return 16;
    default:
      return 0;
  }
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
