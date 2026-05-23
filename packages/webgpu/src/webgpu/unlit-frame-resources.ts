import {
  createMeshGpuUploadPlan,
  type MeshAsset,
  type MeshUploadPlanDiagnostic,
} from "@aperture-engine/render";
import {
  packUnlitMaterial,
  type MaterialAsset,
  type UnlitMaterialPackingDiagnostic,
} from "@aperture-engine/render";
import type {
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import {
  createMeshGpuBuffers,
  type MeshGpuBufferCreationDiagnostic,
  type MeshGpuBufferResource,
} from "./mesh-buffer-resources.js";
import {
  createMeshUploadBufferDescriptors,
  type MeshUploadBufferDescriptorDiagnostic,
} from "./mesh-buffer-descriptors.js";
import type { BindGroupResourceCache } from "./bind-group-resource-cache.js";
import {
  createUnlitBindGroupDescriptorPlan,
  createUnlitBindGroupsFromGpuResources,
  type CreateUnlitBindGroupsResult,
  type UnlitBindGroupDescriptorPlan,
  type UnlitBindGroupDescriptorEntry,
  type UnlitBindGroupBufferResource,
  type UnlitBindGroupDescriptorDiagnostic,
  type UnlitBindGroupLayoutResource,
  type UnlitBindGroupResource,
  type UnlitBindGroupResourceDiagnostic,
} from "./unlit-bind-group.js";
import {
  createUnlitMaterialBufferDescriptor,
  type UnlitMaterialBufferDescriptorDiagnostic,
} from "./unlit-material-buffer.js";
import {
  createUnlitMaterialGpuBuffer,
  type UnlitMaterialGpuBufferDiagnostic,
  type UnlitMaterialGpuBufferResource,
} from "./unlit-material-buffer-resource.js";
import {
  createViewUniformBufferDescriptor,
  type ViewUniformBufferDescriptorDiagnostic,
} from "./view-uniform-buffer.js";
import {
  createViewUniformGpuBuffer,
  type ViewUniformGpuBufferDiagnostic,
  type ViewUniformGpuBufferResource,
} from "./view-uniform-buffer-resource.js";
import type { WebGpuBufferDeviceLike } from "./buffer.js";
import {
  createWorldTransformBufferDescriptor,
  createWorldTransformGpuBuffer,
  type WorldTransformBufferDescriptorDiagnostic,
  type WorldTransformGpuBufferDiagnostic,
  type WorldTransformGpuBufferResource,
} from "./world-transform-buffer.js";
import type { UnlitBindGroupDeviceLike } from "./unlit-bind-group.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "./texture-resources.js";

export type UnlitFrameGpuResourceDiagnosticCode =
  | "unlitFrameResources.missingMesh"
  | "unlitFrameResources.missingViewUniforms"
  | "unlitFrameResources.missingWorldTransforms"
  | "unlitFrameResources.missingMaterials"
  | "unlitFrameResources.missingMaterial";

export interface UnlitFrameGpuResourceDiagnostic {
  readonly code: UnlitFrameGpuResourceDiagnosticCode;
  readonly message: string;
}

export type CreateUnlitFrameGpuResourcesDiagnostic =
  | UnlitFrameGpuResourceDiagnostic
  | MeshUploadPlanDiagnostic
  | MeshUploadBufferDescriptorDiagnostic
  | MeshGpuBufferCreationDiagnostic
  | ViewUniformBufferDescriptorDiagnostic
  | ViewUniformGpuBufferDiagnostic
  | WorldTransformBufferDescriptorDiagnostic
  | WorldTransformGpuBufferDiagnostic
  | UnlitMaterialPackingDiagnostic
  | UnlitMaterialBufferDescriptorDiagnostic
  | UnlitMaterialGpuBufferDiagnostic
  | UnlitBindGroupDescriptorDiagnostic
  | UnlitBindGroupResourceDiagnostic;

export interface UnlitFrameGpuResourceDeviceLike
  extends WebGpuBufferDeviceLike, UnlitBindGroupDeviceLike {}

export interface CreateUnlitFrameGpuResourcesOptions {
  readonly device: UnlitFrameGpuResourceDeviceLike;
  readonly mesh: MeshAsset | null;
  readonly preparedMesh?: MeshGpuBufferResource | undefined;
  readonly viewUniforms: PackedSnapshotViewUniforms | null;
  readonly worldTransforms: PackedSnapshotTransforms | null;
  readonly material: MaterialAsset | null;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
  readonly preparedMaterial?: PreparedUnlitFrameMaterialResources | undefined;
  readonly bindGroupCache?:
    | BindGroupResourceCache<UnlitBindGroupResource>
    | undefined;
  readonly textures?: readonly TextureGpuResource[];
  readonly samplers?: readonly SamplerGpuResource[];
}

export interface CreateMultiMaterialUnlitFrameGpuResourcesOptions {
  readonly device: UnlitFrameGpuResourceDeviceLike;
  readonly mesh: MeshAsset | null;
  readonly viewUniforms: PackedSnapshotViewUniforms | null;
  readonly worldTransforms: PackedSnapshotTransforms | null;
  readonly materials: readonly (MaterialAsset | null)[] | null;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
  readonly bindGroupCache?:
    | BindGroupResourceCache<UnlitBindGroupResource>
    | undefined;
  readonly materialLayouts?:
    | readonly (readonly UnlitBindGroupLayoutResource[])[]
    | undefined;
  readonly textures?: readonly TextureGpuResource[];
  readonly samplers?: readonly SamplerGpuResource[];
}

export interface UnlitFrameGpuResources {
  readonly mesh: MeshGpuBufferResource;
  readonly viewUniform: ViewUniformGpuBufferResource;
  readonly worldTransforms: WorldTransformGpuBufferResource;
  readonly material: UnlitMaterialGpuBufferResource;
  readonly bindGroups: CreateUnlitBindGroupsResult["resources"];
}

export interface PreparedUnlitFrameMaterialResources {
  readonly material: UnlitMaterialGpuBufferResource;
  readonly bindGroup: UnlitBindGroupResource;
}

export interface MultiMaterialUnlitFrameGpuResources {
  readonly mesh: MeshGpuBufferResource;
  readonly viewUniform: ViewUniformGpuBufferResource;
  readonly worldTransforms: WorldTransformGpuBufferResource;
  readonly materials: readonly UnlitMaterialGpuBufferResource[];
  readonly bindGroups: CreateUnlitBindGroupsResult["resources"];
}

export interface CreateUnlitFrameGpuResourcesResult {
  readonly valid: boolean;
  readonly resources: UnlitFrameGpuResources | null;
  readonly diagnostics: readonly CreateUnlitFrameGpuResourcesDiagnostic[];
}

export interface CreateMultiMaterialUnlitFrameGpuResourcesResult {
  readonly valid: boolean;
  readonly resources: MultiMaterialUnlitFrameGpuResources | null;
  readonly diagnostics: readonly CreateUnlitFrameGpuResourcesDiagnostic[];
}

export function createUnlitFrameGpuResources(
  options: CreateUnlitFrameGpuResourcesOptions,
): CreateUnlitFrameGpuResourcesResult {
  const diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[] = [];
  const mesh = createMeshResource(options, diagnostics);
  const viewUniform = createViewUniformResource(options, diagnostics);
  const worldTransforms = createWorldTransformResource(options, diagnostics);
  const material =
    options.preparedMaterial?.material ??
    createMaterialResource(options, diagnostics);
  let bindGroups: CreateUnlitFrameBindGroupsResult;

  if (options.preparedMaterial === undefined) {
    const bindGroupPlan = createUnlitBindGroupDescriptorPlan({
      viewUniformResourceKey: viewUniform?.resourceKey ?? null,
      worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
      materialResourceKey: material?.resourceKey ?? null,
      baseColorTextureResourceKey:
        material?.dependencies.baseColorTextureKey ?? null,
      baseColorSamplerResourceKey:
        material?.dependencies.baseColorSamplerKey ?? null,
    });

    diagnostics.push(...bindGroupPlan.diagnostics);

    bindGroups = createUnlitBindGroupsFromGpuResources({
      device: options.device,
      plan: bindGroupPlan,
      layouts: options.layouts,
      bindGroupCache: options.bindGroupCache,
      buffers: compactBufferResources([
        viewUniform === null
          ? null
          : {
              resourceKey: viewUniform.resourceKey,
              buffer: viewUniform.buffer,
            },
        worldTransforms === null
          ? null
          : {
              resourceKey: worldTransforms.resourceKey,
              buffer: worldTransforms.buffer,
            },
        material === null
          ? null
          : {
              resourceKey: material.resourceKey,
              buffer: material.uniformBuffer,
            },
      ]),
      textures: options.textures,
      samplers: options.samplers,
    });
  } else {
    bindGroups = createUnlitFrameBindGroupsFromPreparedMaterial({
      device: options.device,
      viewUniform,
      worldTransforms,
      layouts: options.layouts,
      preparedMaterial: options.preparedMaterial,
      bindGroupCache: options.bindGroupCache,
    });
  }

  diagnostics.push(...bindGroups.diagnostics);

  if (
    mesh === null ||
    viewUniform === null ||
    worldTransforms === null ||
    material === null ||
    !bindGroups.valid
  ) {
    return { valid: false, resources: null, diagnostics };
  }

  return {
    valid: true,
    resources: {
      mesh,
      viewUniform,
      worldTransforms,
      material,
      bindGroups: bindGroups.resources,
    },
    diagnostics,
  };
}

function createUnlitFrameBindGroupsFromPreparedMaterial(options: {
  readonly device: UnlitFrameGpuResourceDeviceLike;
  readonly viewUniform: ViewUniformGpuBufferResource | null;
  readonly worldTransforms: WorldTransformGpuBufferResource | null;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
  readonly preparedMaterial: PreparedUnlitFrameMaterialResources;
  readonly bindGroupCache?:
    | BindGroupResourceCache<UnlitBindGroupResource>
    | undefined;
}): CreateUnlitFrameBindGroupsResult {
  const sharedBindGroupPlan = createSharedBindGroupDescriptorPlan({
    viewUniformResourceKey: options.viewUniform?.resourceKey ?? null,
    worldTransformResourceKey: options.worldTransforms?.resourceKey ?? null,
  });
  const sharedBindGroups = createUnlitBindGroupsFromGpuResources({
    device: options.device,
    plan: sharedBindGroupPlan,
    layouts: options.layouts,
    bindGroupCache: options.bindGroupCache,
    buffers: compactBufferResources([
      options.viewUniform === null
        ? null
        : {
            resourceKey: options.viewUniform.resourceKey,
            buffer: options.viewUniform.buffer,
          },
      options.worldTransforms === null
        ? null
        : {
            resourceKey: options.worldTransforms.resourceKey,
            buffer: options.worldTransforms.buffer,
          },
    ]),
    requiredGroups: [0, 1],
  });

  return {
    valid: sharedBindGroupPlan.valid && sharedBindGroups.valid,
    resources: [
      ...sharedBindGroups.resources,
      options.preparedMaterial.bindGroup,
    ],
    diagnostics: [
      ...sharedBindGroupPlan.diagnostics,
      ...sharedBindGroups.diagnostics,
    ],
  };
}

interface CreateUnlitFrameBindGroupsResult {
  readonly valid: boolean;
  readonly resources: CreateUnlitBindGroupsResult["resources"];
  readonly diagnostics: readonly CreateUnlitFrameGpuResourcesDiagnostic[];
}

export function createMultiMaterialUnlitFrameGpuResources(
  options: CreateMultiMaterialUnlitFrameGpuResourcesOptions,
): CreateMultiMaterialUnlitFrameGpuResourcesResult {
  const diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[] = [];
  const mesh = createMeshResource(options, diagnostics);
  const viewUniform = createViewUniformResource(options, diagnostics);
  const worldTransforms = createWorldTransformResource(options, diagnostics);
  const materials = createMaterialResources(options, diagnostics);
  const sharedBindGroupPlan = createSharedBindGroupDescriptorPlan({
    viewUniformResourceKey: viewUniform?.resourceKey ?? null,
    worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
  });

  diagnostics.push(...sharedBindGroupPlan.diagnostics);

  const sharedBindGroups = createUnlitBindGroupsFromGpuResources({
    device: options.device,
    plan: sharedBindGroupPlan,
    layouts: options.layouts,
    bindGroupCache: options.bindGroupCache,
    buffers: compactBufferResources([
      viewUniform === null
        ? null
        : { resourceKey: viewUniform.resourceKey, buffer: viewUniform.buffer },
      worldTransforms === null
        ? null
        : {
            resourceKey: worldTransforms.resourceKey,
            buffer: worldTransforms.buffer,
          },
    ]),
    textures: options.textures,
    samplers: options.samplers,
  });

  diagnostics.push(...sharedBindGroups.diagnostics);

  const materialBindGroups = createMaterialBindGroups(
    options,
    materials,
    diagnostics,
  );
  const materialCount = options.materials?.length ?? 0;

  if (
    mesh === null ||
    viewUniform === null ||
    worldTransforms === null ||
    materialCount === 0 ||
    materials.length !== materialCount ||
    !sharedBindGroups.valid ||
    !materialBindGroups.valid
  ) {
    return { valid: false, resources: null, diagnostics };
  }

  return {
    valid: true,
    resources: {
      mesh,
      viewUniform,
      worldTransforms,
      materials,
      bindGroups: [
        ...sharedBindGroups.resources,
        ...materialBindGroups.bindGroups,
      ],
    },
    diagnostics,
  };
}

function createMeshResource(
  options: UnlitSharedFrameGpuResourceOptions,
  diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[],
): MeshGpuBufferResource | null {
  if (options.preparedMesh !== undefined) {
    return options.preparedMesh;
  }

  if (options.mesh === null) {
    diagnostics.push({
      code: "unlitFrameResources.missingMesh",
      message: "Unlit frame GPU resource creation requires a mesh asset.",
    });
    return null;
  }

  const upload = createMeshGpuUploadPlan(options.mesh);

  diagnostics.push(...upload.diagnostics);

  const descriptors = createMeshUploadBufferDescriptors(upload.plan);

  diagnostics.push(...descriptors.diagnostics);

  const resource = createMeshGpuBuffers({
    device: options.device,
    plan: descriptors.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

function createViewUniformResource(
  options: UnlitSharedFrameGpuResourceOptions,
  diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[],
): ViewUniformGpuBufferResource | null {
  if (options.viewUniforms === null) {
    diagnostics.push({
      code: "unlitFrameResources.missingViewUniforms",
      message:
        "Unlit frame GPU resource creation requires packed view uniforms.",
    });
    return null;
  }

  const descriptor = createViewUniformBufferDescriptor(options.viewUniforms);

  diagnostics.push(...descriptor.diagnostics);

  const resource = createViewUniformGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

function createWorldTransformResource(
  options: UnlitSharedFrameGpuResourceOptions,
  diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[],
): WorldTransformGpuBufferResource | null {
  if (options.worldTransforms === null) {
    diagnostics.push({
      code: "unlitFrameResources.missingWorldTransforms",
      message:
        "Unlit frame GPU resource creation requires packed world transforms.",
    });
    return null;
  }

  const descriptor = createWorldTransformBufferDescriptor(
    options.worldTransforms,
  );

  diagnostics.push(...descriptor.diagnostics);

  const resource = createWorldTransformGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

function createMaterialResource(
  options: UnlitMaterialFrameGpuResourceOptions,
  diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[],
): UnlitMaterialGpuBufferResource | null {
  if (options.material === null) {
    diagnostics.push({
      code: "unlitFrameResources.missingMaterial",
      message: "Unlit frame GPU resource creation requires a material asset.",
    });
    return null;
  }

  const packed = packUnlitMaterial(options.material);

  diagnostics.push(...packed.diagnostics);

  const descriptor = createUnlitMaterialBufferDescriptor(packed.packed, {
    label: `${options.material.label}/uniform`,
  });

  diagnostics.push(...descriptor.diagnostics);

  const resource = createUnlitMaterialGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

interface UnlitSharedFrameGpuResourceOptions {
  readonly device: UnlitFrameGpuResourceDeviceLike;
  readonly mesh: MeshAsset | null;
  readonly preparedMesh?: MeshGpuBufferResource | undefined;
  readonly viewUniforms: PackedSnapshotViewUniforms | null;
  readonly worldTransforms: PackedSnapshotTransforms | null;
}

interface UnlitMaterialFrameGpuResourceOptions {
  readonly device: UnlitFrameGpuResourceDeviceLike;
  readonly material: MaterialAsset | null;
}

interface CreateMaterialBindGroupsResult {
  readonly valid: boolean;
  readonly bindGroups: CreateUnlitBindGroupsResult["resources"];
}

function createMaterialResources(
  options: CreateMultiMaterialUnlitFrameGpuResourcesOptions,
  diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[],
): readonly UnlitMaterialGpuBufferResource[] {
  if (options.materials === null || options.materials.length === 0) {
    diagnostics.push({
      code: "unlitFrameResources.missingMaterials",
      message:
        "Multi-material unlit frame GPU resource creation requires at least one material asset.",
    });
    return [];
  }

  return options.materials.flatMap((material, index) => {
    if (material === null) {
      diagnostics.push({
        code: "unlitFrameResources.missingMaterial",
        message: `Multi-material unlit frame GPU resource creation is missing material asset at index ${index}.`,
      });
      return [];
    }

    const resource = createMaterialResource(
      { device: options.device, material },
      diagnostics,
    );

    return resource === null ? [] : [resource];
  });
}

function createSharedBindGroupDescriptorPlan(input: {
  readonly viewUniformResourceKey: string | null;
  readonly worldTransformResourceKey: string | null;
}): UnlitBindGroupDescriptorPlan {
  const diagnostics: UnlitBindGroupDescriptorDiagnostic[] = [];
  const entries: UnlitBindGroupDescriptorEntry[] = [];

  if (input.viewUniformResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingViewResource",
      message: "Unlit bind group planning requires a view uniform resource.",
    });
  } else {
    entries.push({
      group: 0,
      binding: 0,
      resourceKey: input.viewUniformResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.worldTransformResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingTransformResource",
      message:
        "Unlit bind group planning requires a world transform buffer resource.",
    });
  } else {
    entries.push({
      group: 1,
      binding: 0,
      resourceKey: input.worldTransformResourceKey,
      resourceKind: "buffer",
    });
  }

  return {
    valid: diagnostics.length === 0,
    entries,
    diagnostics,
  };
}

function createMaterialBindGroups(
  options: CreateMultiMaterialUnlitFrameGpuResourcesOptions,
  materials: readonly UnlitMaterialGpuBufferResource[],
  diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[],
): CreateMaterialBindGroupsResult {
  const bindGroups: UnlitBindGroupResource[] = [];
  let valid = true;

  for (const [index, material] of materials.entries()) {
    const result = createUnlitBindGroupsFromGpuResources({
      device: options.device,
      plan: {
        valid: true,
        entries: [
          {
            group: 2,
            binding: 0,
            resourceKey: material.resourceKey,
            resourceKind: "buffer",
          },
          ...texturedMaterialBindGroupEntries(material),
        ],
        diagnostics: [],
      },
      layouts: options.materialLayouts?.[index] ?? options.layouts,
      bindGroupCache: options.bindGroupCache,
      buffers: [
        {
          resourceKey: material.resourceKey,
          buffer: material.uniformBuffer,
        },
      ],
      textures: options.textures,
      samplers: options.samplers,
    });

    diagnostics.push(...result.diagnostics);
    bindGroups.push(...result.resources);
    valid = valid && result.valid;
  }

  return { valid, bindGroups };
}

function texturedMaterialBindGroupEntries(
  material: UnlitMaterialGpuBufferResource,
): readonly UnlitBindGroupDescriptorEntry[] {
  const entries: UnlitBindGroupDescriptorEntry[] = [];

  if (material.dependencies.baseColorTextureKey !== null) {
    entries.push({
      group: 2,
      binding: 1,
      resourceKey: material.dependencies.baseColorTextureKey,
      resourceKind: "texture-view",
    });
  }

  if (material.dependencies.baseColorSamplerKey !== null) {
    entries.push({
      group: 2,
      binding: 2,
      resourceKey: material.dependencies.baseColorSamplerKey,
      resourceKind: "sampler",
    });
  }

  return entries;
}

function compactBufferResources(
  resources: readonly (UnlitBindGroupBufferResource | null)[],
): readonly UnlitBindGroupBufferResource[] {
  return resources.flatMap((resource) => (resource === null ? [] : [resource]));
}
