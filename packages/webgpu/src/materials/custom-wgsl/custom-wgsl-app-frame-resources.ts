import {
  createMeshGpuUploadPlan,
  type MeshAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type PreparedCustomWgslMaterial,
  type RuntimeUniformPacket,
  type RuntimeUniformValueRecord,
} from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  writeWebGpuBufferData,
  type WebGpuBufferDeviceLike,
} from "../../gpu/buffer.js";
import {
  createMeshGpuBuffers,
  type MeshGpuBufferResource,
} from "../../resources/meshes/mesh-buffer-resources.js";
import { createMeshUploadBufferDescriptors } from "../../resources/meshes/mesh-buffer-descriptors.js";
import { createViewUniformBufferDescriptor } from "../../resources/views/view-uniform-buffer.js";
import {
  createViewUniformGpuBuffer,
  type ViewUniformGpuBufferResource,
} from "../../resources/views/view-uniform-buffer-resource.js";
import {
  createWorldTransformBufferDescriptor,
  createWorldTransformGpuBuffer,
  type WorldTransformGpuBufferResource,
} from "../../resources/transforms/world-transform-buffer.js";
import {
  createUnlitBindGroupsFromGpuResources,
  type UnlitBindGroupResource,
} from "../unlit/unlit-bind-group.js";
import {
  createCustomWgslMaterialBindGroupResource,
  createCustomWgslMaterialRenderResources,
  type CustomWgslMaterialBindGroupResource,
  type CustomWgslMaterialDeviceLike,
  type CustomWgslMaterialGpuResource,
  type CustomWgslMaterialRenderPipelineResource,
  type CreateCustomWgslMaterialRenderPipelineResourceResult,
  type CreateCustomWgslMaterialRenderResourcesResult,
  type CustomWgslMaterialRenderResources,
} from "./custom-wgsl-material.js";

interface CustomWgslAppFrameResources {
  readonly mesh: MeshGpuBufferResource;
  readonly viewUniform: ViewUniformGpuBufferResource;
  readonly worldTransforms: WorldTransformGpuBufferResource;
  readonly material: CustomWgslMaterialBindGroupResource;
  readonly custom: CustomWgslMaterialRenderResources;
  readonly bindGroups: readonly (
    | UnlitBindGroupResource
    | CustomWgslMaterialBindGroupResource
  )[];
}

export interface CustomWgslRuntimeUniformBufferResource {
  readonly key: string;
  readonly buffer: unknown;
  readonly byteLength: number;
  valueKey: string;
}

export interface CustomWgslRuntimeUniformReuseCounters {
  dynamicBufferWrites: number;
}

export interface CreateCustomWgslAppFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: CustomWgslAppFrameResources | null;
  readonly pipelineResult: CreateCustomWgslMaterialRenderPipelineResourceResult | null;
  readonly pipeline: CustomWgslMaterialRenderPipelineResource | null;
  readonly diagnostics: readonly unknown[];
}

export async function createCustomWgslAppFrameResources(options: {
  readonly device: WebGpuBufferDeviceLike & CustomWgslMaterialDeviceLike;
  readonly mesh: MeshAsset;
  readonly material: PreparedCustomWgslMaterial;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly pipelineResult?: CreateCustomWgslMaterialRenderPipelineResourceResult;
  readonly bindingResources?: readonly CustomWgslMaterialGpuResource[];
  readonly bindingResourceDiagnostics?: readonly unknown[];
  readonly runtimeUniforms?: readonly RuntimeUniformPacket[];
  readonly runtimeUniformCache?: Map<
    string,
    CustomWgslRuntimeUniformBufferResource
  >;
  readonly reuse?: CustomWgslRuntimeUniformReuseCounters;
}): Promise<CreateCustomWgslAppFrameResourcesResult> {
  const diagnostics: unknown[] = [];

  diagnostics.push(...(options.bindingResourceDiagnostics ?? []));

  const meshUpload = createMeshGpuUploadPlan(options.mesh);

  diagnostics.push(...meshUpload.diagnostics);

  const meshDescriptors = createMeshUploadBufferDescriptors(meshUpload.plan);

  diagnostics.push(...meshDescriptors.diagnostics);

  const meshResource = createMeshGpuBuffers({
    device: options.device,
    plan: meshDescriptors.plan,
  });

  diagnostics.push(...meshResource.diagnostics);

  const viewDescriptor = createViewUniformBufferDescriptor(
    options.viewUniforms,
  );

  diagnostics.push(...viewDescriptor.diagnostics);

  const viewUniform = createViewUniformGpuBuffer({
    device: options.device,
    plan: viewDescriptor.plan,
  });

  diagnostics.push(...viewUniform.diagnostics);

  const transformDescriptor = createWorldTransformBufferDescriptor(
    options.worldTransforms,
  );

  diagnostics.push(...transformDescriptor.diagnostics);

  const worldTransforms = createWorldTransformGpuBuffer({
    device: options.device,
    plan: transformDescriptor.plan,
  });

  diagnostics.push(...worldTransforms.diagnostics);

  const materialResources = createCustomWgslBindingResources({
    device: options.device,
    material: options.material,
    externalResources: options.bindingResources ?? [],
    runtimeUniforms: options.runtimeUniforms ?? [],
    ...(options.runtimeUniformCache === undefined
      ? {}
      : { runtimeUniformCache: options.runtimeUniformCache }),
    ...(options.reuse === undefined ? {} : { reuse: options.reuse }),
  });

  diagnostics.push(...materialResources.diagnostics);

  const customResources =
    options.pipelineResult === undefined
      ? await createCustomWgslMaterialRenderResources({
          device: options.device,
          material: options.material,
          colorFormat: options.colorFormat,
          ...(options.depthFormat === undefined
            ? {}
            : { depthFormat: options.depthFormat }),
          ...(options.sampleCount === undefined
            ? {}
            : { sampleCount: options.sampleCount }),
          resources: materialResources.resources,
        })
      : await createCustomWgslMaterialRenderResourcesFromPipeline({
          device: options.device,
          material: options.material,
          pipelineResult: options.pipelineResult,
          resources: materialResources.resources,
        });

  diagnostics.push(...customResources.diagnostics);

  if (
    meshResource.resource === null ||
    viewUniform.resource === null ||
    worldTransforms.resource === null ||
    customResources.resources === null
  ) {
    return {
      valid: false,
      resources: null,
      pipelineResult: customResources.pipeline,
      pipeline: customResources.resources?.pipeline ?? null,
      diagnostics,
    };
  }

  const customFrameResources = customResources.resources;
  const pipeline = customFrameResources.pipeline.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipeline.getBindGroupLayout === undefined) {
    return {
      valid: false,
      resources: null,
      pipelineResult: customResources.pipeline,
      pipeline: customFrameResources.pipeline,
      diagnostics: [
        ...diagnostics,
        {
          code: "customWgslAppFrameResources.missingPipelineLayouts",
          message:
            "Custom WGSL pipeline does not expose bind group layouts for app frame resources.",
        },
      ],
    };
  }

  const sharedBindGroups = createUnlitBindGroupsFromGpuResources({
    device: options.device,
    plan: {
      valid: true,
      diagnostics: [],
      entries: [
        {
          group: 0,
          binding: 0,
          resourceKey: viewUniform.resource.resourceKey,
          resourceKind: "buffer",
        },
        {
          group: 1,
          binding: 0,
          resourceKey: worldTransforms.resource.resourceKey,
          resourceKind: "buffer",
        },
      ],
    },
    layouts: [0, 1].map((group) => ({
      group,
      layoutKey: `${options.material.pipeline.pipelineKey}/layout-${group}`,
      layout: pipeline.getBindGroupLayout?.(group),
    })),
    buffers: [
      {
        resourceKey: viewUniform.resource.resourceKey,
        buffer: viewUniform.resource.buffer,
      },
      {
        resourceKey: worldTransforms.resource.resourceKey,
        buffer: worldTransforms.resource.buffer,
      },
    ],
    requiredGroups: [0, 1],
  });

  diagnostics.push(...sharedBindGroups.diagnostics);

  if (!sharedBindGroups.valid) {
    return {
      valid: false,
      resources: null,
      pipelineResult: customResources.pipeline,
      pipeline: customFrameResources.pipeline,
      diagnostics,
    };
  }

  const pipelineScopedSharedBindGroups = sharedBindGroups.resources.map(
    (bindGroup) =>
      withCustomWgslPipelineMatchKey(
        bindGroup,
        customFrameResources.pipeline.cacheKey,
      ),
  );

  return {
    valid: true,
    pipelineResult: customResources.pipeline,
    pipeline: customFrameResources.pipeline,
    resources: {
      mesh: meshResource.resource,
      viewUniform: viewUniform.resource,
      worldTransforms: worldTransforms.resource,
      material: customFrameResources.bindGroup,
      custom: customFrameResources,
      bindGroups: [
        ...pipelineScopedSharedBindGroups,
        customFrameResources.bindGroup,
      ],
    },
    diagnostics,
  };
}

function withCustomWgslPipelineMatchKey(
  bindGroup: UnlitBindGroupResource,
  pipelineKey: string,
): UnlitBindGroupResource {
  return bindGroup.entryResourceKeys.includes(pipelineKey)
    ? bindGroup
    : {
        ...bindGroup,
        entryResourceKeys: [...bindGroup.entryResourceKeys, pipelineKey],
      };
}

async function createCustomWgslMaterialRenderResourcesFromPipeline(options: {
  readonly device: CustomWgslMaterialDeviceLike;
  readonly material: PreparedCustomWgslMaterial;
  readonly pipelineResult: CreateCustomWgslMaterialRenderPipelineResourceResult;
  readonly resources: readonly CustomWgslMaterialGpuResource[];
}): Promise<CreateCustomWgslMaterialRenderResourcesResult> {
  const pipeline = options.pipelineResult.resource;

  if (!options.pipelineResult.valid || pipeline === null) {
    return {
      valid: false,
      resources: null,
      pipeline: options.pipelineResult,
      bindGroup: null,
      diagnostics: options.pipelineResult.diagnostics,
    };
  }

  const bindGroup = createCustomWgslMaterialBindGroupResource({
    device: options.device,
    material: options.material,
    pipeline: pipeline.pipeline as {
      getBindGroupLayout?: (group: number) => unknown;
    },
    resources: options.resources,
  });

  return {
    valid: bindGroup.valid && bindGroup.resource !== null,
    resources:
      bindGroup.resource === null
        ? null
        : { pipeline, bindGroup: bindGroup.resource },
    pipeline: options.pipelineResult,
    bindGroup,
    diagnostics: [
      ...options.pipelineResult.diagnostics,
      ...bindGroup.diagnostics,
    ],
  };
}

function createCustomWgslBindingResources(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly material: PreparedCustomWgslMaterial;
  readonly externalResources: readonly CustomWgslMaterialGpuResource[];
  readonly runtimeUniforms: readonly RuntimeUniformPacket[];
  readonly runtimeUniformCache?: Map<
    string,
    CustomWgslRuntimeUniformBufferResource
  >;
  readonly reuse?: CustomWgslRuntimeUniformReuseCounters;
}): {
  readonly resources: readonly CustomWgslMaterialGpuResource[];
  readonly diagnostics: readonly unknown[];
} {
  const resources: CustomWgslMaterialGpuResource[] = [];
  const diagnostics: unknown[] = [];
  const externalResources = new Map(
    options.externalResources.map((resource) => [
      resource.resourceKey,
      resource.resource,
    ]),
  );
  const runtimeUniforms = new Map(
    options.runtimeUniforms.map((uniform) => [uniform.key, uniform]),
  );

  for (const binding of options.material.bindGroup.entries) {
    const layout = options.material.bindGroupLayout.entries.find(
      (entry) => entry.binding === binding.binding,
    );
    const externalResource = externalResources.get(binding.resourceKey);

    if (externalResource !== undefined) {
      resources.push({
        resourceKey: binding.resourceKey,
        resource: externalResource,
      });
      continue;
    }

    if (layout?.kind !== "uniform-buffer") {
      diagnostics.push({
        code: "customWgslAppFrameResources.unsupportedBindingKind",
        message: `Custom WGSL app route currently supports uniform-buffer bindings, not '${layout?.kind ?? "unknown"}'.`,
        binding: binding.binding,
        resourceKey: binding.resourceKey,
      });
      continue;
    }

    const runtimeValues = resolveRuntimeUniformValues({
      layout,
      binding,
      runtimeUniforms,
      diagnostics,
    });

    if (runtimeValues === null) {
      continue;
    }

    const bytes = encodeUniformBinding(
      options.material,
      binding.binding,
      runtimeValues,
    );
    const runtimeUniformKey = layout.runtimeUniformKey;
    const runtimeResource =
      runtimeUniformKey === undefined
        ? null
        : getOrCreateCustomWgslRuntimeUniformResource({
            device: options.device,
            material: options.material,
            binding,
            runtimeUniformKey,
            data: bytes,
            ...(options.runtimeUniformCache === undefined
              ? {}
              : { cache: options.runtimeUniformCache }),
            ...(options.reuse === undefined ? {} : { reuse: options.reuse }),
            diagnostics,
          });

    if (runtimeResource !== null) {
      resources.push({
        resourceKey: binding.resourceKey,
        resource: { buffer: runtimeResource.buffer },
      });
      continue;
    }

    if (runtimeUniformKey !== undefined) {
      continue;
    }

    const bufferUsage = (
      globalThis as { GPUBufferUsage?: { UNIFORM: number; COPY_DST: number } }
    ).GPUBufferUsage ?? {
      UNIFORM: 0x40,
      COPY_DST: 0x08,
    };
    const buffer = createWebGpuBuffer({
      device: options.device,
      descriptor: {
        label: binding.resourceKey,
        size: bytes.byteLength,
        usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
        initialData: bytes,
      },
    });

    if (!buffer.ok) {
      diagnostics.push({
        code: "customWgslAppFrameResources.uniformBufferFailed",
        message: buffer.message,
        binding: binding.binding,
        resourceKey: binding.resourceKey,
      });
      continue;
    }

    resources.push({
      resourceKey: binding.resourceKey,
      resource: { buffer: buffer.buffer },
    });
  }

  return { resources, diagnostics };
}

function encodeUniformBinding(
  material: PreparedCustomWgslMaterial,
  bindingIndex: number,
  runtimeValues?: RuntimeUniformValueRecord,
): Uint8Array {
  const sourceBinding = material.bindGroupLayout.entries.find(
    (entry) => entry.binding === bindingIndex,
  );
  const fields = Object.entries(sourceBinding?.fields ?? {});
  const layout = fields.map(([name, field]) => ({
    name,
    type: field.type,
    value:
      runtimeValues?.[name] ??
      sourceBinding?.values?.[name] ??
      field.default ??
      0,
  }));
  let offset = 0;

  for (const field of layout) {
    offset = alignTo(offset, uniformFieldAlignment(field.type));
    offset += uniformFieldSize(field.type);
  }

  const byteLength = alignTo(Math.max(offset, 4), 16);
  const bytes = new Uint8Array(byteLength);
  const view = new DataView(bytes.buffer);
  offset = 0;

  for (const field of layout) {
    offset = alignTo(offset, uniformFieldAlignment(field.type));
    writeUniformField(view, offset, field.type, field.value);
    offset += uniformFieldSize(field.type);
  }

  if (sourceBinding === undefined || fields.length === 0) {
    return new Uint8Array(16);
  }

  return bytes;
}

function resolveRuntimeUniformValues(input: {
  readonly layout:
    | PreparedCustomWgslMaterial["bindGroupLayout"]["entries"][number]
    | undefined;
  readonly binding: PreparedCustomWgslMaterial["bindGroup"]["entries"][number];
  readonly runtimeUniforms: ReadonlyMap<string, RuntimeUniformPacket>;
  readonly diagnostics: unknown[];
}): RuntimeUniformValueRecord | undefined | null {
  const runtimeUniformKey = input.layout?.runtimeUniformKey;

  if (runtimeUniformKey === undefined) {
    return undefined;
  }

  const packet = input.runtimeUniforms.get(runtimeUniformKey);

  if (packet === undefined) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.runtimeUniformMissing",
      severity: "error",
      message: `Custom WGSL binding ${String(input.binding.binding)} requires runtime uniform '${runtimeUniformKey}', but no runtime uniform packet with that key was extracted.`,
      binding: input.binding.binding,
      resourceKey: input.binding.resourceKey,
      runtimeUniformKey,
    });
    return null;
  }

  const fields = input.layout?.fields ?? {};
  const missingFields: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    if (!hasOwn(packet.values, name)) {
      missingFields.push(name);
      continue;
    }

    const value = packet.values[name];

    if (!runtimeUniformValueMatchesField(value, field.type)) {
      input.diagnostics.push({
        code: "customWgslAppFrameResources.runtimeUniformInvalidValue",
        severity: "error",
        message: `Runtime uniform '${runtimeUniformKey}' value '${name}' does not match custom WGSL field type '${field.type}'.`,
        binding: input.binding.binding,
        resourceKey: input.binding.resourceKey,
        runtimeUniformKey,
        field: name,
      });
      return null;
    }
  }

  if (missingFields.length > 0) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.runtimeUniformMissingFields",
      severity: "warning",
      message: `Runtime uniform '${runtimeUniformKey}' is missing value(s) for ${missingFields.join(", ")}; material defaults will be used.`,
      binding: input.binding.binding,
      resourceKey: input.binding.resourceKey,
      runtimeUniformKey,
      fields: missingFields,
    });
  }

  return packet.values;
}

function getOrCreateCustomWgslRuntimeUniformResource(input: {
  readonly device: WebGpuBufferDeviceLike;
  readonly material: PreparedCustomWgslMaterial;
  readonly binding: PreparedCustomWgslMaterial["bindGroup"]["entries"][number];
  readonly runtimeUniformKey: string;
  readonly data: Uint8Array;
  readonly cache?: Map<string, CustomWgslRuntimeUniformBufferResource>;
  readonly reuse?: CustomWgslRuntimeUniformReuseCounters;
  readonly diagnostics: unknown[];
}): CustomWgslRuntimeUniformBufferResource | null {
  const key = [
    "custom-wgsl-runtime-uniform",
    input.material.sourceMaterialKey,
    `binding-${String(input.binding.binding)}`,
    input.runtimeUniformKey,
  ].join(":");
  const valueKey = customWgslUniformValueKey(input.data);
  const cached = input.cache?.get(key);

  if (cached !== undefined && cached.byteLength === input.data.byteLength) {
    if (cached.valueKey !== valueKey) {
      if (!writeWebGpuBufferData(input.device, cached.buffer, input.data)) {
        input.diagnostics.push({
          code: "customWgslAppFrameResources.runtimeUniformWriteFailed",
          severity: "error",
          message: `WebGPU device cannot write updated runtime uniform '${input.runtimeUniformKey}'.`,
          binding: input.binding.binding,
          resourceKey: input.binding.resourceKey,
          runtimeUniformKey: input.runtimeUniformKey,
        });
        return null;
      }

      cached.valueKey = valueKey;
      if (input.reuse !== undefined) {
        input.reuse.dynamicBufferWrites += 1;
      }
    }

    return cached;
  }

  const bufferUsage = (
    globalThis as { GPUBufferUsage?: { UNIFORM: number; COPY_DST: number } }
  ).GPUBufferUsage ?? {
    UNIFORM: 0x40,
    COPY_DST: 0x08,
  };
  const buffer = createWebGpuBuffer({
    device: input.device,
    descriptor: {
      label: key,
      size: input.data.byteLength,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
      initialData: input.data,
    },
  });

  if (!buffer.ok) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.runtimeUniformBufferFailed",
      severity: "error",
      message: buffer.message,
      binding: input.binding.binding,
      resourceKey: input.binding.resourceKey,
      runtimeUniformKey: input.runtimeUniformKey,
    });
    return null;
  }

  const resource: CustomWgslRuntimeUniformBufferResource = {
    key,
    buffer: buffer.buffer,
    byteLength: input.data.byteLength,
    valueKey,
  };

  input.cache?.set(key, resource);

  if (input.reuse !== undefined) {
    input.reuse.dynamicBufferWrites += 1;
  }

  return resource;
}

function runtimeUniformValueMatchesField(
  value: unknown,
  type: string,
): boolean {
  const count = uniformFieldComponentCount(type);

  if (count === 1) {
    return (
      (typeof value === "number" && Number.isFinite(value)) ||
      (Array.isArray(value) &&
        value.length >= 1 &&
        typeof value[0] === "number" &&
        Number.isFinite(value[0]))
    );
  }

  return (
    Array.isArray(value) &&
    value.length >= count &&
    value
      .slice(0, count)
      .every(
        (component) =>
          typeof component === "number" && Number.isFinite(component),
      )
  );
}

function writeUniformField(
  view: DataView,
  offset: number,
  type: string,
  value: unknown,
): void {
  const values = Array.isArray(value) ? value : [value];
  const count = uniformFieldComponentCount(type);

  for (let index = 0; index < count; index += 1) {
    const raw = values[index] ?? 0;
    const numeric = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;

    if (type === "int32" || type === "Int32") {
      view.setInt32(offset + index * 4, numeric, true);
    } else if (type === "uint32" || type === "Uint32") {
      view.setUint32(offset + index * 4, numeric, true);
    } else {
      view.setFloat32(offset + index * 4, numeric, true);
    }
  }
}

function uniformFieldAlignment(type: string): number {
  switch (type) {
    case "vec2":
    case "Vec2":
      return 8;
    case "vec3":
    case "Vec3":
    case "vec4":
    case "Vec4":
    case "Color":
    case "mat4x4":
      return 16;
    default:
      return 4;
  }
}

function uniformFieldSize(type: string): number {
  switch (type) {
    case "vec2":
    case "Vec2":
      return 8;
    case "vec3":
    case "Vec3":
    case "vec4":
    case "Vec4":
    case "Color":
      return 16;
    case "mat4x4":
      return 64;
    default:
      return 4;
  }
}

function uniformFieldComponentCount(type: string): number {
  switch (type) {
    case "vec2":
    case "Vec2":
      return 2;
    case "vec3":
    case "Vec3":
      return 3;
    case "vec4":
    case "Vec4":
    case "Color":
      return 4;
    case "mat4x4":
      return 16;
    default:
      return 1;
  }
}

function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function customWgslUniformValueKey(data: Uint8Array): string {
  return Array.from(data).join(",");
}

function hasOwn(
  record: Readonly<Record<string, unknown>>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}
