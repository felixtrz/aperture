import {
  createMeshGpuUploadPlan,
  type DebugNormalMaterialAsset,
  type MeshAsset,
  type MeshUploadPlanDiagnostic,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import type { WebGpuBufferDeviceLike } from "./buffer.js";
import {
  createDebugNormalMaterialBindGroupDescriptorPlan,
  createDebugNormalMaterialBindGroupResource,
  type DebugNormalMaterialBindGroupDescriptorDiagnostic,
  type DebugNormalMaterialBindGroupLayoutResource,
  type DebugNormalMaterialBindGroupResource,
  type DebugNormalMaterialBindGroupResourceDiagnostic,
} from "./debug-normal-bind-group.js";
import {
  createDebugNormalMaterialGpuBuffer,
  type DebugNormalMaterialGpuBufferDiagnostic,
  type DebugNormalMaterialGpuBufferResource,
} from "./debug-normal-material-buffer-resource.js";
import {
  createDebugNormalMaterialGpuPreparationPlan,
  type DebugNormalMaterialBufferDescriptorDiagnostic,
  type DebugNormalMaterialPackingDiagnostic,
} from "./debug-normal-material-buffer.js";
import {
  createMeshUploadBufferDescriptors,
  type MeshUploadBufferDescriptorDiagnostic,
} from "./mesh-buffer-descriptors.js";
import {
  createMeshGpuBuffers,
  type MeshGpuBufferCreationDiagnostic,
  type MeshGpuBufferResource,
} from "./mesh-buffer-resources.js";
import type { BindGroupResourceCache } from "./bind-group-resource-cache.js";
import {
  createUnlitBindGroupsFromGpuResources,
  type CreateUnlitBindGroupsResult,
  type UnlitBindGroupDescriptorDiagnostic,
  type UnlitBindGroupDescriptorEntry,
  type UnlitBindGroupDescriptorPlan,
  type UnlitBindGroupLayoutResource,
  type UnlitBindGroupResource,
  type UnlitBindGroupResourceDiagnostic,
} from "./unlit-bind-group.js";
import {
  createViewUniformBufferDescriptor,
  type ViewUniformBufferDescriptorDiagnostic,
} from "./view-uniform-buffer.js";
import {
  createViewUniformGpuBuffer,
  type ViewUniformGpuBufferDiagnostic,
  type ViewUniformGpuBufferResource,
} from "./view-uniform-buffer-resource.js";
import {
  createWorldTransformBufferDescriptor,
  createWorldTransformGpuBuffer,
  type WorldTransformBufferDescriptorDiagnostic,
  type WorldTransformGpuBufferDiagnostic,
  type WorldTransformGpuBufferResource,
} from "./world-transform-buffer.js";

export type DebugNormalFrameGpuResourceDiagnosticCode =
  | "debugNormalFrameResources.missingMesh"
  | "debugNormalFrameResources.missingViewUniforms"
  | "debugNormalFrameResources.missingWorldTransforms"
  | "debugNormalFrameResources.missingMaterial";

export interface DebugNormalFrameGpuResourceDiagnostic {
  readonly code: DebugNormalFrameGpuResourceDiagnosticCode;
  readonly message: string;
}

export type CreateDebugNormalFrameGpuResourcesDiagnostic =
  | DebugNormalFrameGpuResourceDiagnostic
  | MeshUploadPlanDiagnostic
  | MeshUploadBufferDescriptorDiagnostic
  | MeshGpuBufferCreationDiagnostic
  | ViewUniformBufferDescriptorDiagnostic
  | ViewUniformGpuBufferDiagnostic
  | WorldTransformBufferDescriptorDiagnostic
  | WorldTransformGpuBufferDiagnostic
  | DebugNormalMaterialPackingDiagnostic
  | DebugNormalMaterialBufferDescriptorDiagnostic
  | DebugNormalMaterialGpuBufferDiagnostic
  | DebugNormalMaterialBindGroupDescriptorDiagnostic
  | DebugNormalMaterialBindGroupResourceDiagnostic
  | UnlitBindGroupDescriptorDiagnostic
  | UnlitBindGroupResourceDiagnostic;

export interface DebugNormalFrameGpuResourceDeviceLike extends WebGpuBufferDeviceLike {
  createBindGroup?: (descriptor: unknown) => unknown;
}

export interface PreparedDebugNormalFrameMaterialResources {
  readonly material: DebugNormalMaterialGpuBufferResource;
  readonly bindGroup: DebugNormalMaterialBindGroupResource;
}

export interface CreateDebugNormalFrameGpuResourcesOptions {
  readonly device: DebugNormalFrameGpuResourceDeviceLike;
  readonly mesh: MeshAsset | null;
  readonly preparedMesh?: MeshGpuBufferResource | undefined;
  readonly viewUniforms: PackedSnapshotViewUniforms | null;
  readonly worldTransforms: PackedSnapshotTransforms | null;
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
  readonly material: DebugNormalMaterialAsset | null;
  readonly preparedMaterial?:
    | PreparedDebugNormalFrameMaterialResources
    | undefined;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: DebugNormalMaterialBindGroupLayoutResource | null;
  readonly bindGroupCache?:
    | BindGroupResourceCache<UnlitBindGroupResource>
    | undefined;
}

export interface DebugNormalFrameGpuResources {
  readonly mesh: MeshGpuBufferResource;
  readonly viewUniform: ViewUniformGpuBufferResource;
  readonly worldTransforms: WorldTransformGpuBufferResource;
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource;
  readonly material: DebugNormalMaterialGpuBufferResource;
  readonly materialBindGroup: DebugNormalMaterialBindGroupResource;
  readonly bindGroups: readonly (
    | UnlitBindGroupResource
    | DebugNormalMaterialBindGroupResource
  )[];
}

export interface CreateDebugNormalFrameGpuResourcesResult {
  readonly valid: boolean;
  readonly resources: DebugNormalFrameGpuResources | null;
  readonly diagnostics: readonly CreateDebugNormalFrameGpuResourcesDiagnostic[];
}

export function createDebugNormalFrameGpuResources(
  options: CreateDebugNormalFrameGpuResourcesOptions,
): CreateDebugNormalFrameGpuResourcesResult {
  const diagnostics: CreateDebugNormalFrameGpuResourcesDiagnostic[] = [];
  const mesh = createMeshResource(options, diagnostics);
  const viewUniform = createViewUniformResource(options, diagnostics);
  const worldTransforms = createWorldTransformResource(options, diagnostics);
  const material =
    options.preparedMaterial?.material ??
    createMaterialResource(options, diagnostics);
  const sharedBindGroups = createSharedBindGroups(
    options,
    viewUniform,
    worldTransforms,
    diagnostics,
  );
  const materialBindGroup =
    options.preparedMaterial?.bindGroup ??
    createMaterialBindGroup(options, material, diagnostics);

  if (
    mesh === null ||
    viewUniform === null ||
    worldTransforms === null ||
    material === null ||
    !sharedBindGroups.valid ||
    materialBindGroup === null
  ) {
    return { valid: false, resources: null, diagnostics };
  }

  return {
    valid: diagnostics.length === 0,
    resources: {
      mesh,
      viewUniform,
      worldTransforms,
      ...(options.previousWorldTransforms === undefined ||
      options.previousWorldTransforms === null
        ? {}
        : { previousWorldTransforms: options.previousWorldTransforms }),
      material,
      materialBindGroup,
      bindGroups: [...sharedBindGroups.resources, materialBindGroup],
    },
    diagnostics,
  };
}

function createMeshResource(
  options: Pick<
    CreateDebugNormalFrameGpuResourcesOptions,
    "device" | "mesh" | "preparedMesh"
  >,
  diagnostics: CreateDebugNormalFrameGpuResourcesDiagnostic[],
): MeshGpuBufferResource | null {
  if (options.preparedMesh !== undefined) {
    return options.preparedMesh;
  }

  if (options.mesh === null) {
    diagnostics.push({
      code: "debugNormalFrameResources.missingMesh",
      message: "DebugNormal frame GPU resource creation requires a mesh asset.",
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
  options: Pick<
    CreateDebugNormalFrameGpuResourcesOptions,
    "device" | "viewUniforms"
  >,
  diagnostics: CreateDebugNormalFrameGpuResourcesDiagnostic[],
): ViewUniformGpuBufferResource | null {
  if (options.viewUniforms === null) {
    diagnostics.push({
      code: "debugNormalFrameResources.missingViewUniforms",
      message:
        "DebugNormal frame GPU resource creation requires packed view uniforms.",
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
  options: Pick<
    CreateDebugNormalFrameGpuResourcesOptions,
    "device" | "worldTransforms"
  >,
  diagnostics: CreateDebugNormalFrameGpuResourcesDiagnostic[],
): WorldTransformGpuBufferResource | null {
  if (options.worldTransforms === null) {
    diagnostics.push({
      code: "debugNormalFrameResources.missingWorldTransforms",
      message:
        "DebugNormal frame GPU resource creation requires packed world transforms.",
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
  options: Pick<
    CreateDebugNormalFrameGpuResourcesOptions,
    "device" | "material"
  >,
  diagnostics: CreateDebugNormalFrameGpuResourcesDiagnostic[],
): DebugNormalMaterialGpuBufferResource | null {
  if (options.material === null) {
    diagnostics.push({
      code: "debugNormalFrameResources.missingMaterial",
      message:
        "DebugNormal frame GPU resource creation requires a debug-normal material asset.",
    });
    return null;
  }

  const preparation = createDebugNormalMaterialGpuPreparationPlan(
    options.material,
    {
      label: `${options.material.label}/uniform`,
    },
  );

  diagnostics.push(...preparation.diagnostics);

  const resource = createDebugNormalMaterialGpuBuffer({
    device: options.device,
    plan: preparation.plan?.materialBuffer ?? null,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

function createSharedBindGroups(
  options: CreateDebugNormalFrameGpuResourcesOptions,
  viewUniform: ViewUniformGpuBufferResource | null,
  worldTransforms: WorldTransformGpuBufferResource | null,
  diagnostics: CreateDebugNormalFrameGpuResourcesDiagnostic[],
): CreateUnlitBindGroupsResult {
  const plan = createSharedBindGroupDescriptorPlan({
    viewUniformResourceKey: viewUniform?.resourceKey ?? null,
    worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
    ...(options.previousWorldTransforms === undefined
      ? {}
      : {
          previousWorldTransformResourceKey:
            options.previousWorldTransforms?.resourceKey ?? null,
        }),
  });

  diagnostics.push(...plan.diagnostics);

  const result = createUnlitBindGroupsFromGpuResources({
    device: options.device,
    plan,
    layouts: options.sharedLayouts,
    requiredGroups: [0, 1],
    bindGroupCache: options.bindGroupCache,
    buffers: [
      ...(viewUniform === null
        ? []
        : [
            {
              resourceKey: viewUniform.resourceKey,
              buffer: viewUniform.buffer,
            },
          ]),
      ...(worldTransforms === null
        ? []
        : [
            {
              resourceKey: worldTransforms.resourceKey,
              buffer: worldTransforms.buffer,
            },
          ]),
      ...(options.previousWorldTransforms === undefined ||
      options.previousWorldTransforms === null
        ? []
        : [
            {
              resourceKey: options.previousWorldTransforms.resourceKey,
              buffer: options.previousWorldTransforms.buffer,
            },
          ]),
    ],
  });

  diagnostics.push(...result.diagnostics);

  return result;
}

function createMaterialBindGroup(
  options: CreateDebugNormalFrameGpuResourcesOptions,
  material: DebugNormalMaterialGpuBufferResource | null,
  diagnostics: CreateDebugNormalFrameGpuResourcesDiagnostic[],
): DebugNormalMaterialBindGroupResource | null {
  const plan =
    material === null
      ? null
      : createDebugNormalMaterialBindGroupDescriptorPlan({
          materialResourceKey: material.resourceKey,
        });

  if (plan !== null) {
    diagnostics.push(...plan.diagnostics);
  }

  const result = createDebugNormalMaterialBindGroupResource({
    device: options.device,
    plan,
    layout: options.materialLayout,
    buffers:
      material === null
        ? []
        : [
            {
              resourceKey: material.resourceKey,
              buffer: material.uniformBuffer,
            },
          ],
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createSharedBindGroupDescriptorPlan(input: {
  readonly viewUniformResourceKey: string | null;
  readonly worldTransformResourceKey: string | null;
  readonly previousWorldTransformResourceKey?: string | null;
}): UnlitBindGroupDescriptorPlan {
  const diagnostics: UnlitBindGroupDescriptorDiagnostic[] = [];
  const entries: UnlitBindGroupDescriptorEntry[] = [];

  if (input.viewUniformResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingViewResource",
      message:
        "DebugNormal shared bind group planning requires a view uniform.",
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
        "DebugNormal shared bind group planning requires a world transform buffer.",
    });
  } else {
    entries.push({
      group: 1,
      binding: 0,
      resourceKey: input.worldTransformResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.previousWorldTransformResourceKey !== undefined) {
    if (input.previousWorldTransformResourceKey === null) {
      diagnostics.push({
        code: "unlitBindGroup.missingTransformResource",
        message:
          "DebugNormal motion-vector shared bind group planning requires a previous world transform buffer.",
      });
    } else {
      entries.push({
        group: 1,
        binding: 3,
        resourceKey: input.previousWorldTransformResourceKey,
        resourceKind: "buffer",
      });
    }
  }

  return { valid: diagnostics.length === 0, entries, diagnostics };
}
