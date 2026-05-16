import {
  createMeshGpuUploadPlan,
  type MeshAsset,
  type MeshUploadPlanDiagnostic,
} from "../mesh/index.js";
import {
  packUnlitMaterial,
  type MaterialAsset,
  type UnlitMaterialPackingDiagnostic,
} from "../materials/index.js";
import type {
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "../rendering/index.js";
import {
  createMeshGpuBuffers,
  type MeshGpuBufferCreationDiagnostic,
  type MeshGpuBufferResource,
} from "./mesh-buffer-resources.js";
import {
  createMeshUploadBufferDescriptors,
  type MeshUploadBufferDescriptorDiagnostic,
} from "./mesh-buffer-descriptors.js";
import {
  createUnlitBindGroupDescriptorPlan,
  createUnlitBindGroupsFromBuffers,
  type CreateUnlitBindGroupsResult,
  type UnlitBindGroupBufferResource,
  type UnlitBindGroupDescriptorDiagnostic,
  type UnlitBindGroupLayoutResource,
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

export type UnlitFrameGpuResourceDiagnosticCode =
  | "unlitFrameResources.missingMesh"
  | "unlitFrameResources.missingViewUniforms"
  | "unlitFrameResources.missingWorldTransforms"
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
  readonly viewUniforms: PackedSnapshotViewUniforms | null;
  readonly worldTransforms: PackedSnapshotTransforms | null;
  readonly material: MaterialAsset | null;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
}

export interface UnlitFrameGpuResources {
  readonly mesh: MeshGpuBufferResource;
  readonly viewUniform: ViewUniformGpuBufferResource;
  readonly worldTransforms: WorldTransformGpuBufferResource;
  readonly material: UnlitMaterialGpuBufferResource;
  readonly bindGroups: CreateUnlitBindGroupsResult["resources"];
}

export interface CreateUnlitFrameGpuResourcesResult {
  readonly valid: boolean;
  readonly resources: UnlitFrameGpuResources | null;
  readonly diagnostics: readonly CreateUnlitFrameGpuResourcesDiagnostic[];
}

export function createUnlitFrameGpuResources(
  options: CreateUnlitFrameGpuResourcesOptions,
): CreateUnlitFrameGpuResourcesResult {
  const diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[] = [];
  const mesh = createMeshResource(options, diagnostics);
  const viewUniform = createViewUniformResource(options, diagnostics);
  const worldTransforms = createWorldTransformResource(options, diagnostics);
  const material = createMaterialResource(options, diagnostics);
  const bindGroupPlan = createUnlitBindGroupDescriptorPlan({
    viewUniformResourceKey: viewUniform?.resourceKey ?? null,
    worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
    materialResourceKey: material?.resourceKey ?? null,
  });

  diagnostics.push(...bindGroupPlan.diagnostics);

  const bindGroups = createUnlitBindGroupsFromBuffers({
    device: options.device,
    plan: bindGroupPlan,
    layouts: options.layouts,
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
      material === null
        ? null
        : { resourceKey: material.resourceKey, buffer: material.uniformBuffer },
    ]),
  });

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

function createMeshResource(
  options: CreateUnlitFrameGpuResourcesOptions,
  diagnostics: CreateUnlitFrameGpuResourcesDiagnostic[],
): MeshGpuBufferResource | null {
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
  options: CreateUnlitFrameGpuResourcesOptions,
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
  options: CreateUnlitFrameGpuResourcesOptions,
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
  options: CreateUnlitFrameGpuResourcesOptions,
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

function compactBufferResources(
  resources: readonly (UnlitBindGroupBufferResource | null)[],
): readonly UnlitBindGroupBufferResource[] {
  return resources.flatMap((resource) => (resource === null ? [] : [resource]));
}
