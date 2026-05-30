import { createMeshGpuUploadPlan } from "@aperture-engine/render";
import {
  createInstanceTintBufferDescriptor,
  createInstanceTintGpuBuffer,
  type InstanceTintGpuBufferResource,
} from "../../resources/attributes/instance-tint-buffer.js";
import {
  createSkinningJointBufferDescriptor,
  createSkinningJointGpuBuffer,
  type SkinningJointGpuBufferResource,
} from "../../resources/attributes/skinning-joint-buffer.js";
import {
  createMorphTargetWeightBufferDescriptor,
  createMorphTargetWeightGpuBuffer,
  type MorphTargetWeightGpuBufferResource,
} from "../../resources/attributes/morph-target-weight-buffer.js";
import {
  createMorphTargetDeltaBufferDescriptor,
  createMorphTargetDeltaGpuBuffer,
  type MorphTargetDeltaGpuBufferResource,
} from "../../resources/attributes/morph-target-delta-buffer.js";
import {
  createMorphInstanceDescriptorBufferDescriptor,
  createMorphInstanceDescriptorGpuBuffer,
  type MorphInstanceDescriptorGpuBufferResource,
} from "../../resources/attributes/morph-instance-descriptor-buffer.js";
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
import { createStandardMaterialPreparationPlan } from "./standard-material-buffer.js";
import {
  createStandardMaterialGpuBuffer,
  type StandardMaterialGpuBufferResource,
} from "./standard-material-buffer-resource.js";
import type {
  CreateStandardFrameGpuResourcesDiagnostic,
  CreateStandardFrameGpuResourcesOptions,
} from "./standard-frame-resources.js";

export function requiresInstanceTintBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("instance-tint");
}

export function requiresSkinningJointBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("skinned");
}

export function requiresMorphTargetWeightBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("morphed");
}

export function createMeshResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "mesh" | "preparedMesh"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): MeshGpuBufferResource | null {
  if (options.preparedMesh !== undefined) {
    return options.preparedMesh;
  }

  if (options.mesh === null) {
    diagnostics.push({
      code: "standardFrameResources.missingMesh",
      message: "Standard frame GPU resource creation requires a mesh asset.",
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

export function createViewUniformResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "viewUniforms"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): ViewUniformGpuBufferResource | null {
  if (options.viewUniforms === null) {
    diagnostics.push({
      code: "standardFrameResources.missingViewUniforms",
      message:
        "Standard frame GPU resource creation requires packed view uniforms.",
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

export function createWorldTransformResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "worldTransforms"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): WorldTransformGpuBufferResource | null {
  if (options.worldTransforms === null) {
    diagnostics.push({
      code: "standardFrameResources.missingWorldTransforms",
      message:
        "Standard frame GPU resource creation requires packed world transforms.",
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

export function createInstanceTintResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "instanceTints" | "pipelineKey"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): InstanceTintGpuBufferResource | null {
  if (!requiresInstanceTintBuffer(options.pipelineKey)) {
    return null;
  }

  if (options.instanceTints === undefined || options.instanceTints === null) {
    diagnostics.push({
      code: "standardFrameResources.missingInstanceTints",
      message:
        "Standard frame GPU resource creation requires packed instance tints for an instance-tint pipeline.",
    });
    return null;
  }

  const descriptor = createInstanceTintBufferDescriptor(options.instanceTints);

  diagnostics.push(...descriptor.diagnostics);

  const resource = createInstanceTintGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

export function createSkinningJointResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "snapshot" | "draw" | "pipelineKey"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): SkinningJointGpuBufferResource | null {
  if (!requiresSkinningJointBuffer(options.pipelineKey)) {
    return null;
  }

  if (options.draw === undefined) {
    diagnostics.push({
      code: "skinningJointBuffer.missingOffset",
      renderId: 0,
      field: "draw",
      message:
        "Standard frame GPU resource creation requires a draw packet for a skinned pipeline.",
    });
    return null;
  }

  const descriptor = createSkinningJointBufferDescriptor(
    options.snapshot,
    options.draw,
  );

  diagnostics.push(...descriptor.diagnostics);

  const resource = createSkinningJointGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

export function createMorphTargetWeightResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "snapshot" | "draw" | "pipelineKey"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): MorphTargetWeightGpuBufferResource | null {
  if (!requiresMorphTargetWeightBuffer(options.pipelineKey)) {
    return null;
  }

  if (options.draw === undefined) {
    diagnostics.push({
      code: "morphTargetWeightBuffer.missingData",
      renderId: 0,
      field: "draw",
      message:
        "Standard frame GPU resource creation requires a draw packet for a morphed pipeline.",
    });
    return null;
  }

  const descriptor = createMorphTargetWeightBufferDescriptor(
    options.snapshot,
    options.draw,
  );

  diagnostics.push(...descriptor.diagnostics);

  const resource = createMorphTargetWeightGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

export function createMorphTargetDeltaResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "snapshot" | "draw" | "pipelineKey"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): MorphTargetDeltaGpuBufferResource | null {
  if (!requiresMorphTargetWeightBuffer(options.pipelineKey)) {
    return null;
  }

  if (options.draw === undefined) {
    diagnostics.push({
      code: "morphTargetDeltaBuffer.missingData",
      renderId: 0,
      field: "draw",
      message:
        "Standard frame GPU resource creation requires a draw packet for a morphed pipeline.",
    });
    return null;
  }

  const descriptor = createMorphTargetDeltaBufferDescriptor(
    options.snapshot,
    options.draw,
  );

  diagnostics.push(...descriptor.diagnostics);

  const resource = createMorphTargetDeltaGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

export function createMorphInstanceDescriptorResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "device" | "snapshot" | "draw" | "pipelineKey"
  >,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): MorphInstanceDescriptorGpuBufferResource | null {
  if (!requiresMorphTargetWeightBuffer(options.pipelineKey)) {
    return null;
  }

  if (options.draw === undefined) {
    diagnostics.push({
      code: "morphInstanceDescriptorBuffer.missingData",
      renderId: 0,
      field: "draw",
      message:
        "Standard frame GPU resource creation requires a draw packet for a morphed pipeline.",
    });
    return null;
  }

  const descriptor = createMorphInstanceDescriptorBufferDescriptor(
    options.snapshot,
    options.draw,
  );

  diagnostics.push(...descriptor.diagnostics);

  const resource = createMorphInstanceDescriptorGpuBuffer({
    device: options.device,
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}

export function createMaterialResource(
  options: Pick<CreateStandardFrameGpuResourcesOptions, "device" | "material">,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): StandardMaterialGpuBufferResource | null {
  if (options.material === null) {
    diagnostics.push({
      code: "standardFrameResources.missingMaterial",
      message:
        "Standard frame GPU resource creation requires a standard material asset.",
    });
    return null;
  }

  const preparation = createStandardMaterialPreparationPlan(options.material, {
    label: `${options.material.label}/uniform`,
  });

  diagnostics.push(...preparation.diagnostics);

  const resource = createStandardMaterialGpuBuffer({
    device: options.device,
    plan: preparation.plan?.materialBuffer ?? null,
  });

  diagnostics.push(...resource.diagnostics);

  return resource.valid ? resource.resource : null;
}
