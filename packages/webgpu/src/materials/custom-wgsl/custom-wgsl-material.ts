import type {
  PreparedCustomWgslBindingLayoutEntry,
  PreparedCustomWgslBindingResourceEntry,
  PreparedCustomWgslMaterial,
} from "@aperture-engine/render";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "../core/material-render-state.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../../gpu/pipeline-cache.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "../../gpu/shader.js";
import { createInstanceAttributeVertexBufferLayout } from "../../resources/attributes/instance-attribute-buffer.js";
import { UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT } from "../unlit/unlit-pipeline.js";

const WEBGPU_SHADER_STAGE_VERTEX = 1;
const WEBGPU_SHADER_STAGE_FRAGMENT = 2;

export type CustomWgslMaterialResourceDiagnosticCode =
  | "customWgslMaterial.shaderDiagnostic"
  | "customWgslMaterial.shaderCreationFailed"
  | "customWgslMaterial.createRenderPipelineUnavailable"
  | "customWgslMaterial.pipelineCreationFailed"
  | "customWgslMaterial.missingPipelineLayout"
  | "customWgslMaterial.createBindGroupUnavailable"
  | "customWgslMaterial.missingBindingResource"
  | "customWgslMaterial.bindGroupCreationFailed";

export interface CustomWgslMaterialResourceDiagnostic {
  readonly code: CustomWgslMaterialResourceDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
  readonly binding?: number;
  readonly resourceKey?: string;
}

export interface CustomWgslMaterialGpuResource {
  readonly resourceKey: string;
  readonly resource: unknown;
}

export interface BrowserCustomWgslMaterialPipelineDescriptorInput {
  readonly material: PreparedCustomWgslMaterial;
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}

export interface CreateCustomWgslMaterialRenderPipelineResourceOptions {
  readonly device: CustomWgslMaterialPipelineDeviceLike;
  readonly material: PreparedCustomWgslMaterial;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}

export interface CustomWgslMaterialRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateCustomWgslMaterialRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: CustomWgslMaterialRenderPipelineResource | null;
  readonly diagnostics: readonly CustomWgslMaterialResourceDiagnostic[];
}

export interface CustomWgslMaterialPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export interface CustomWgslMaterialBindGroupLayoutEntryDescriptor {
  readonly binding: number;
  readonly visibility: number;
  readonly buffer?: {
    readonly type: "uniform" | "read-only-storage";
  };
  readonly texture?: {
    readonly sampleType: "float";
    readonly viewDimension: "2d";
    readonly multisampled: false;
  };
  readonly sampler?: {
    readonly type: "filtering";
  };
}

export interface CustomWgslMaterialBindGroupLayoutDescriptor {
  readonly label: string;
  readonly entries: readonly CustomWgslMaterialBindGroupLayoutEntryDescriptor[];
}

export interface CustomWgslMaterialBindGroupCreationEntry {
  readonly binding: number;
  readonly resource: unknown;
}

export interface CustomWgslMaterialBindGroupCreationDescriptor {
  readonly label: string;
  readonly layout: unknown;
  readonly entries: readonly CustomWgslMaterialBindGroupCreationEntry[];
}

export interface CustomWgslMaterialBindGroupDeviceLike {
  createBindGroup?: (
    descriptor: CustomWgslMaterialBindGroupCreationDescriptor,
  ) => unknown;
}

export interface CustomWgslMaterialPipelineLayoutProvider {
  getBindGroupLayout?: (group: number) => unknown;
}

export interface CreateCustomWgslMaterialBindGroupResourceOptions {
  readonly device: CustomWgslMaterialBindGroupDeviceLike;
  readonly material: PreparedCustomWgslMaterial;
  readonly pipeline: CustomWgslMaterialPipelineLayoutProvider;
  readonly resources: readonly CustomWgslMaterialGpuResource[];
}

export interface CustomWgslMaterialBindGroupResource {
  readonly group: 2;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
  readonly descriptor: CustomWgslMaterialBindGroupCreationDescriptor;
}

export interface CreateCustomWgslMaterialBindGroupResourceResult {
  readonly valid: boolean;
  readonly resource: CustomWgslMaterialBindGroupResource | null;
  readonly diagnostics: readonly CustomWgslMaterialResourceDiagnostic[];
}

export interface CustomWgslMaterialDeviceLike
  extends
    CustomWgslMaterialPipelineDeviceLike,
    CustomWgslMaterialBindGroupDeviceLike {}

export interface CreateCustomWgslMaterialRenderResourcesOptions extends Omit<
  CreateCustomWgslMaterialRenderPipelineResourceOptions,
  "device"
> {
  readonly device: CustomWgslMaterialDeviceLike;
  readonly resources: readonly CustomWgslMaterialGpuResource[];
}

export interface CustomWgslMaterialRenderResources {
  readonly pipeline: CustomWgslMaterialRenderPipelineResource;
  readonly bindGroup: CustomWgslMaterialBindGroupResource;
}

export interface CreateCustomWgslMaterialRenderResourcesResult {
  readonly valid: boolean;
  readonly resources: CustomWgslMaterialRenderResources | null;
  readonly pipeline: CreateCustomWgslMaterialRenderPipelineResourceResult;
  readonly bindGroup: CreateCustomWgslMaterialBindGroupResourceResult | null;
  readonly diagnostics: readonly CustomWgslMaterialResourceDiagnostic[];
}

export async function createCustomWgslMaterialRenderPipelineResource(
  options: CreateCustomWgslMaterialRenderPipelineResourceOptions,
): Promise<CreateCustomWgslMaterialRenderPipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: options.material.shader.moduleKey,
      code: options.material.shader.code,
      entryPoints: [
        options.material.shader.vertexEntryPoint,
        options.material.shader.fragmentEntryPoint,
      ],
    },
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "customWgslMaterial.shaderCreationFailed",
          reason: shaderModule.reason,
          message: shaderModule.message,
        },
      ],
    };
  }

  if (options.device.createRenderPipeline === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "customWgslMaterial.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create custom WGSL render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserCustomWgslMaterialPipelineDescriptor({
    material: options.material,
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
    ...(options.sampleCount === undefined
      ? {}
      : { sampleCount: options.sampleCount }),
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
  });

  try {
    return {
      valid: true,
      resource: {
        cacheKey: customWgslMaterialRenderPipelineCacheKey({
          material: options.material,
          colorFormat: options.colorFormat,
          ...(options.sampleCount === undefined
            ? {}
            : { sampleCount: options.sampleCount }),
          ...(options.depthFormat === undefined
            ? {}
            : { depthFormat: options.depthFormat }),
        }),
        shaderModule: shaderModule.module,
        pipeline: options.device.createRenderPipeline(descriptor),
        descriptor,
      },
      diagnostics: shaderDiagnostics,
    };
  } catch (cause) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "customWgslMaterial.pipelineCreationFailed",
          message: `Failed to create custom WGSL render pipeline '${options.material.pipeline.pipelineKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

export function createBrowserCustomWgslMaterialPipelineDescriptor(
  input: BrowserCustomWgslMaterialPipelineDescriptorInput,
): WebGpuRenderPipelineCreateDescriptor {
  const renderState = resolveWebGpuPipelineRenderState(
    input.material.pipeline.pipelineKey,
    input.depthFormat,
  );
  const colorTarget = createWebGpuColorTargetDescriptor(
    input.colorFormat,
    renderState,
  );
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `${input.material.label}:${input.colorFormat}:triangle-list`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: input.material.shader.vertexEntryPoint,
      buffers:
        input.material.pipeline.instanceAttributes === null
          ? [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT]
          : [
              UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
              createInstanceAttributeVertexBufferLayout(
                input.material.pipeline.instanceAttributes,
              ),
            ],
    },
    fragment: {
      module: input.shaderModule,
      entryPoint: input.material.shader.fragmentEntryPoint,
      targets: [colorTarget],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: input.material.pipeline.renderState.frontFace,
      cullMode: renderState.cullMode,
    },
    multisample: {
      count: input.sampleCount ?? 1,
    },
  };
  const depthStencil = createWebGpuDepthStencilDescriptor(
    input.depthFormat,
    renderState,
  );

  if (depthStencil === null) {
    return descriptor;
  }

  return { ...descriptor, depthStencil };
}

export function createCustomWgslMaterialBindGroupLayoutDescriptor(
  material: PreparedCustomWgslMaterial,
): CustomWgslMaterialBindGroupLayoutDescriptor {
  return {
    label: material.bindGroupLayout.resourceKey,
    entries: material.bindGroupLayout.entries.map((entry) =>
      createBindGroupLayoutEntryDescriptor(entry),
    ),
  };
}

export async function createCustomWgslMaterialRenderResources(
  options: CreateCustomWgslMaterialRenderResourcesOptions,
): Promise<CreateCustomWgslMaterialRenderResourcesResult> {
  const pipeline =
    await createCustomWgslMaterialRenderPipelineResource(options);

  if (!pipeline.valid || pipeline.resource === null) {
    return {
      valid: false,
      resources: null,
      pipeline,
      bindGroup: null,
      diagnostics: pipeline.diagnostics,
    };
  }

  const bindGroup = createCustomWgslMaterialBindGroupResource({
    device: options.device,
    material: options.material,
    pipeline: pipeline.resource
      .pipeline as CustomWgslMaterialPipelineLayoutProvider,
    resources: options.resources,
  });
  const valid = bindGroup.valid && bindGroup.resource !== null;

  return {
    valid,
    resources: valid
      ? {
          pipeline: pipeline.resource,
          bindGroup: bindGroup.resource as CustomWgslMaterialBindGroupResource,
        }
      : null,
    pipeline,
    bindGroup,
    diagnostics: [...pipeline.diagnostics, ...bindGroup.diagnostics],
  };
}

export function createCustomWgslMaterialBindGroupResource(
  options: CreateCustomWgslMaterialBindGroupResourceOptions,
): CreateCustomWgslMaterialBindGroupResourceResult {
  const diagnostics: CustomWgslMaterialResourceDiagnostic[] = [];
  const layout = options.pipeline.getBindGroupLayout?.(2);

  if (layout === undefined) {
    diagnostics.push({
      code: "customWgslMaterial.missingPipelineLayout",
      message:
        "Custom WGSL material bind group creation requires pipeline bind group layout 2.",
    });
  }

  if (options.device.createBindGroup === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...diagnostics,
        {
          code: "customWgslMaterial.createBindGroupUnavailable",
          message: "WebGPU device cannot create custom WGSL bind groups.",
        },
      ],
    };
  }

  if (layout === undefined) {
    return { valid: false, resource: null, diagnostics };
  }

  const descriptor = createCustomWgslMaterialBindGroupCreationDescriptor(
    options.material,
    layout,
    options.resources,
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
        resourceKey: options.material.bindGroup.resourceKey,
        layoutKey: options.material.bindGroup.layoutResourceKey,
        bindGroup: options.device.createBindGroup(descriptor),
        entryResourceKeys: customWgslMaterialBindGroupMatchKeys(
          options.material,
        ),
        descriptor,
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
          code: "customWgslMaterial.bindGroupCreationFailed",
          resourceKey: options.material.bindGroup.resourceKey,
          message: `Failed to create custom WGSL bind group '${options.material.bindGroup.resourceKey}': ${messageFromCause(cause)}`,
        },
      ],
    };
  }
}

function createCustomWgslMaterialBindGroupCreationDescriptor(
  material: PreparedCustomWgslMaterial,
  layout: unknown,
  resources: readonly CustomWgslMaterialGpuResource[],
  diagnostics: CustomWgslMaterialResourceDiagnostic[],
): CustomWgslMaterialBindGroupCreationDescriptor | null {
  const resourcesByKey = new Map(
    resources.map((resource) => [resource.resourceKey, resource.resource]),
  );
  const entries = material.bindGroup.entries.flatMap((entry) => {
    const resource = resourcesByKey.get(entry.resourceKey);

    if (resource === undefined) {
      diagnostics.push(missingResourceDiagnostic(entry));
      return [];
    }

    return [{ binding: entry.binding, resource }];
  });

  if (entries.length !== material.bindGroup.entries.length) {
    return null;
  }

  return {
    label: material.bindGroup.resourceKey,
    layout,
    entries,
  };
}

function createBindGroupLayoutEntryDescriptor(
  entry: PreparedCustomWgslBindingLayoutEntry,
): CustomWgslMaterialBindGroupLayoutEntryDescriptor {
  const base = {
    binding: entry.binding,
    visibility: shaderVisibility(entry),
  };

  switch (entry.kind) {
    case "uniform-buffer":
      return { ...base, buffer: { type: "uniform" } };
    case "storage-buffer":
      return { ...base, buffer: { type: "read-only-storage" } };
    case "texture":
      return {
        ...base,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
      };
    case "sampler":
      return { ...base, sampler: { type: "filtering" } };
  }
}

function shaderVisibility(
  entry: Pick<PreparedCustomWgslBindingLayoutEntry, "visibility">,
): number {
  let visibility = 0;

  if (entry.visibility.includes("vertex")) {
    visibility |= WEBGPU_SHADER_STAGE_VERTEX;
  }

  if (entry.visibility.includes("fragment")) {
    visibility |= WEBGPU_SHADER_STAGE_FRAGMENT;
  }

  return visibility;
}

function missingResourceDiagnostic(
  entry: PreparedCustomWgslBindingResourceEntry,
): CustomWgslMaterialResourceDiagnostic {
  return {
    code: "customWgslMaterial.missingBindingResource",
    binding: entry.binding,
    resourceKey: entry.resourceKey,
    message: `Missing GPU resource '${entry.resourceKey}' for custom WGSL binding ${entry.binding}.`,
  };
}

function customWgslMaterialBindGroupMatchKeys(
  material: PreparedCustomWgslMaterial,
): readonly string[] {
  return uniqueStrings([
    material.materialKey,
    material.sourceMaterialKey,
    material.bindGroup.resourceKey,
    ...material.bindGroup.entries.map((entry) => entry.resourceKey),
  ]);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): CustomWgslMaterialResourceDiagnostic {
  return {
    code: "customWgslMaterial.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}

function customWgslMaterialRenderPipelineCacheKey(input: {
  readonly material: PreparedCustomWgslMaterial;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): string {
  return [
    "custom-wgsl",
    input.colorFormat,
    input.depthFormat ?? "none",
    `samples-${input.sampleCount ?? 1}`,
    input.material.pipeline.pipelineKey,
  ].join("|");
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
