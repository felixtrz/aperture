import {
  createMeshGpuUploadPlan,
  type MeshAsset,
  type MeshDrawPacket,
  type MeshUploadPlanDiagnostic,
  type PackedSnapshotInstanceTints,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type RenderSnapshot,
  type StandardMaterialAsset,
} from "@aperture-engine/render";
import type { WebGpuBufferDeviceLike } from "./buffer.js";
import {
  createLightBindGroupDescriptorPlan,
  createLightBindGroupResource,
  type LightBindGroupDescriptorDiagnostic,
  type LightBindGroupResource,
  type LightBindGroupResourceDiagnostic,
} from "./light-bind-group.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import {
  createSnapshotLightGpuBuffers,
  type CreateSnapshotLightGpuBuffersDiagnostic,
  type CreateSnapshotLightGpuBuffersResult,
} from "./lighting-resource-plan.js";
import {
  createInstanceTintBufferDescriptor,
  createInstanceTintGpuBuffer,
  type InstanceTintBufferDescriptorDiagnostic,
  type InstanceTintGpuBufferDiagnostic,
  type InstanceTintGpuBufferResource,
} from "./instance-tint-buffer.js";
import {
  createSkinningJointBufferDescriptor,
  createSkinningJointGpuBuffer,
  type SkinningJointBufferDescriptorDiagnostic,
  type SkinningJointGpuBufferDiagnostic,
  type SkinningJointGpuBufferResource,
} from "./skinning-joint-buffer.js";
import {
  createMorphTargetWeightBufferDescriptor,
  createMorphTargetWeightGpuBuffer,
  type MorphTargetWeightBufferDescriptorDiagnostic,
  type MorphTargetWeightGpuBufferDiagnostic,
  type MorphTargetWeightGpuBufferResource,
} from "./morph-target-weight-buffer.js";
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
  createStandardMaterialBindGroupDescriptorPlan,
  createStandardMaterialBindGroupResource,
  type StandardMaterialBindGroupDescriptorDiagnostic,
  type StandardMaterialBindGroupLayoutResource,
  type StandardMaterialBindGroupResource,
  type StandardMaterialBindGroupResourceDiagnostic,
} from "./standard-bind-group.js";
import type {
  StandardMaterialIblBindGroupResource,
  StandardMaterialIblBindGroupResourceReport,
} from "./standard-material-ibl-bind-group.js";
import type { IblSamplerResourceReport } from "./ibl-sampler-resource.js";
import type {
  DiffuseIblTextureResourceReport,
  SpecularIblTextureResourceReport,
} from "./ibl-texture-resource.js";
import {
  createStandardLightIblBindGroupDescriptorPlan,
  createStandardLightMultiShadowBindGroupDescriptorPlan,
  createStandardLightShadowBindGroupDescriptorPlan,
  createStandardLightShadowBindGroupResource,
  type StandardLightShadowBindGroupDiagnostic,
  type StandardLightShadowBindGroupLayoutResource,
  type StandardLightShadowBindGroupResource,
} from "./standard-light-shadow-bind-group.js";
import type { StandardAreaLightLtcResources } from "./standard-area-light-ltc-resource.js";
import {
  createStandardMaterialGpuBuffer,
  type StandardMaterialGpuBufferDiagnostic,
  type StandardMaterialGpuBufferResource,
} from "./standard-material-buffer-resource.js";
import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
import type { ShadowSamplerResourceReport } from "./standard-material-shadow-bind-group.js";
import {
  createStandardMaterialPreparationPlan,
  type StandardMaterialBufferDescriptorDiagnostic,
  type StandardMaterialPackingDiagnostic,
} from "./standard-material-buffer.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "./texture-resources.js";
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

export type StandardFrameGpuResourceDiagnosticCode =
  | "standardFrameResources.missingMesh"
  | "standardFrameResources.missingViewUniforms"
  | "standardFrameResources.missingWorldTransforms"
  | "standardFrameResources.missingInstanceTints"
  | "standardFrameResources.missingMaterial"
  | "standardFrameResources.missingLights";

export interface StandardFrameGpuResourceDiagnostic {
  readonly code: StandardFrameGpuResourceDiagnosticCode;
  readonly message: string;
}

export type CreateStandardFrameGpuResourcesDiagnostic =
  | StandardFrameGpuResourceDiagnostic
  | MeshUploadPlanDiagnostic
  | MeshUploadBufferDescriptorDiagnostic
  | MeshGpuBufferCreationDiagnostic
  | ViewUniformBufferDescriptorDiagnostic
  | ViewUniformGpuBufferDiagnostic
  | WorldTransformBufferDescriptorDiagnostic
  | WorldTransformGpuBufferDiagnostic
  | SkinningJointBufferDescriptorDiagnostic
  | SkinningJointGpuBufferDiagnostic
  | MorphTargetWeightBufferDescriptorDiagnostic
  | MorphTargetWeightGpuBufferDiagnostic
  | InstanceTintBufferDescriptorDiagnostic
  | InstanceTintGpuBufferDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | CreateSnapshotLightGpuBuffersDiagnostic
  | LightBindGroupDescriptorDiagnostic
  | LightBindGroupResourceDiagnostic
  | StandardLightShadowBindGroupDiagnostic
  | UnlitBindGroupDescriptorDiagnostic
  | UnlitBindGroupResourceDiagnostic;

export interface StandardFrameGpuResourceDeviceLike extends WebGpuBufferDeviceLike {
  createBindGroup?: (descriptor: unknown) => unknown;
}

export interface CreateStandardFrameGpuResourcesOptions {
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly draw?: MeshDrawPacket;
  readonly pipelineKey: string;
  readonly mesh: MeshAsset | null;
  readonly preparedMesh?: MeshGpuBufferResource | undefined;
  readonly viewUniforms: PackedSnapshotViewUniforms | null;
  readonly worldTransforms: PackedSnapshotTransforms | null;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly material: StandardMaterialAsset | null;
  readonly preparedMaterial?:
    | PreparedStandardFrameMaterialResources
    | undefined;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly lightLayout:
    | LightBindGroupLayoutResource
    | StandardLightShadowBindGroupLayoutResource
    | null;
  readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
  readonly standardAreaLightLtcResources?: StandardAreaLightLtcResources | null;
  readonly textures?: readonly TextureGpuResource[];
  readonly samplers?: readonly SamplerGpuResource[];
}

export interface StandardFrameShadowReceiverResourceSet {
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ShadowSamplerResourceReport;
}

export interface StandardFrameShadowReceiverResources extends StandardFrameShadowReceiverResourceSet {
  readonly shadowKind?: "directional" | "point" | "spot" | "multi";
  readonly spotShadowReceiverResources?: StandardFrameShadowReceiverResourceSet;
  readonly pointShadowReceiverResources?: StandardFrameShadowReceiverResourceSet;
}

export interface StandardFrameIblResources {
  readonly bindGroupResource: StandardMaterialIblBindGroupResourceReport;
  readonly diffuseTextureResource?: DiffuseIblTextureResourceReport;
  readonly specularTextureResource?: SpecularIblTextureResourceReport;
  readonly samplerResource?: IblSamplerResourceReport;
}

export interface StandardFrameGpuResources {
  readonly mesh: MeshGpuBufferResource;
  readonly viewUniform: ViewUniformGpuBufferResource;
  readonly worldTransforms: WorldTransformGpuBufferResource;
  readonly instanceTints?: InstanceTintGpuBufferResource;
  readonly skinningJointMatrices?: SkinningJointGpuBufferResource;
  readonly morphTargetWeights?: MorphTargetWeightGpuBufferResource;
  readonly material: StandardMaterialGpuBufferResource;
  readonly lightGpuBuffers: CreateSnapshotLightGpuBuffersResult;
  readonly materialBindGroup: StandardMaterialBindGroupResource;
  readonly lightBindGroup:
    | LightBindGroupResource
    | StandardLightShadowBindGroupResource;
  readonly standardMaterialIblBindGroup?: StandardMaterialIblBindGroupResource;
  readonly bindGroups: readonly UnlitBindGroupResource[];
}

export interface PreparedStandardFrameMaterialResources {
  readonly material: StandardMaterialGpuBufferResource;
  readonly bindGroup: StandardMaterialBindGroupResource;
}

export interface CreateStandardFrameGpuResourcesResult {
  readonly valid: boolean;
  readonly resources: StandardFrameGpuResources | null;
  readonly diagnostics: readonly CreateStandardFrameGpuResourcesDiagnostic[];
}

export function createStandardFrameGpuResources(
  options: CreateStandardFrameGpuResourcesOptions,
): CreateStandardFrameGpuResourcesResult {
  const diagnostics: CreateStandardFrameGpuResourcesDiagnostic[] = [];
  const mesh = createMeshResource(options, diagnostics);
  const viewUniform = createViewUniformResource(options, diagnostics);
  const worldTransforms = createWorldTransformResource(options, diagnostics);
  const instanceTints = createInstanceTintResource(options, diagnostics);
  const skinningJointMatrices = createSkinningJointResource(
    options,
    diagnostics,
  );
  const morphTargetWeights = createMorphTargetWeightResource(
    options,
    diagnostics,
  );
  const material =
    options.preparedMaterial?.material ??
    createMaterialResource(options, diagnostics);
  const sharedBindGroups = createSharedBindGroups(
    options,
    viewUniform,
    worldTransforms,
    skinningJointMatrices,
    morphTargetWeights,
    diagnostics,
  );
  const materialBindGroup =
    options.preparedMaterial?.bindGroup ??
    createMaterialBindGroup(options, material, diagnostics);
  const lightGpuBuffers = createSnapshotLightGpuBuffers(options.snapshot, {
    device: options.device,
  });

  diagnostics.push(...lightGpuBuffers.diagnostics);

  if (lightGpuBuffers.valid && lightGpuBuffers.resource === null) {
    diagnostics.push({
      code: "standardFrameResources.missingLights",
      message:
        "Standard frame GPU resource creation requires at least one extracted light.",
    });
  }

  const lightBindGroup = createLightBindGroup(
    options,
    lightGpuBuffers,
    diagnostics,
  );
  const standardMaterialIblBindGroup =
    resolveStandardMaterialIblBindGroupResource(options);

  if (
    mesh === null ||
    viewUniform === null ||
    worldTransforms === null ||
    (requiresInstanceTintBuffer(options.pipelineKey) &&
      instanceTints === null) ||
    (requiresSkinningJointBuffer(options.pipelineKey) &&
      skinningJointMatrices === null) ||
    (requiresMorphTargetWeightBuffer(options.pipelineKey) &&
      morphTargetWeights === null) ||
    material === null ||
    !sharedBindGroups.valid ||
    materialBindGroup === null ||
    !lightGpuBuffers.valid ||
    lightGpuBuffers.resource === null ||
    lightBindGroup === null
  ) {
    return { valid: false, resources: null, diagnostics };
  }

  return {
    valid: diagnostics.length === 0,
    resources: {
      mesh,
      viewUniform,
      worldTransforms,
      ...(instanceTints === null ? {} : { instanceTints }),
      ...(skinningJointMatrices === null ? {} : { skinningJointMatrices }),
      ...(morphTargetWeights === null ? {} : { morphTargetWeights }),
      material,
      lightGpuBuffers,
      materialBindGroup,
      lightBindGroup,
      ...(standardMaterialIblBindGroup === null
        ? {}
        : { standardMaterialIblBindGroup }),
      bindGroups: [
        ...sharedBindGroups.resources,
        materialBindGroup,
        lightBindGroup,
      ],
    },
    diagnostics,
  };
}

function requiresInstanceTintBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("instance-tint");
}

function requiresSkinningJointBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("skinned");
}

function requiresMorphTargetWeightBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("morphed");
}

function resolveStandardMaterialIblBindGroupResource(
  options: Pick<
    CreateStandardFrameGpuResourcesOptions,
    "standardMaterialIblResources"
  >,
): StandardMaterialIblBindGroupResource | null {
  const report = options.standardMaterialIblResources?.bindGroupResource;

  return report?.status === "available" && report.resource !== null
    ? report.resource
    : null;
}

function createMeshResource(
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

function createViewUniformResource(
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

function createWorldTransformResource(
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

function createInstanceTintResource(
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

function createSkinningJointResource(
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

function createMorphTargetWeightResource(
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

function createMaterialResource(
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

function createSharedBindGroups(
  options: CreateStandardFrameGpuResourcesOptions,
  viewUniform: ViewUniformGpuBufferResource | null,
  worldTransforms: WorldTransformGpuBufferResource | null,
  skinningJointMatrices: SkinningJointGpuBufferResource | null,
  morphTargetWeights: MorphTargetWeightGpuBufferResource | null,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): CreateUnlitBindGroupsResult {
  const plan = createSharedBindGroupDescriptorPlan({
    viewUniformResourceKey: viewUniform?.resourceKey ?? null,
    worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
    ...(requiresSkinningJointBuffer(options.pipelineKey)
      ? {
          skinningJointResourceKey: skinningJointMatrices?.resourceKey ?? null,
        }
      : {}),
    ...(requiresMorphTargetWeightBuffer(options.pipelineKey)
      ? {
          morphTargetWeightResourceKey: morphTargetWeights?.resourceKey ?? null,
        }
      : {}),
  });

  diagnostics.push(...plan.diagnostics);

  const result = createUnlitBindGroupsFromGpuResources({
    device: options.device,
    plan,
    layouts: options.sharedLayouts,
    requiredGroups: [0, 1],
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
      ...(skinningJointMatrices === null
        ? []
        : [
            {
              resourceKey: skinningJointMatrices.resourceKey,
              buffer: skinningJointMatrices.buffer,
            },
          ]),
      ...(morphTargetWeights === null
        ? []
        : [
            {
              resourceKey: morphTargetWeights.resourceKey,
              buffer: morphTargetWeights.buffer,
            },
          ]),
    ],
  });

  diagnostics.push(...result.diagnostics);

  return result;
}

function createMaterialBindGroup(
  options: CreateStandardFrameGpuResourcesOptions,
  material: StandardMaterialGpuBufferResource | null,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): StandardMaterialBindGroupResource | null {
  const plan =
    material === null
      ? null
      : createStandardMaterialBindGroupDescriptorPlan({
          materialResourceKey: material.resourceKey,
          dependencies: material.dependencies,
        });

  if (plan !== null) {
    diagnostics.push(...plan.diagnostics);
  }

  const result = createStandardMaterialBindGroupResource({
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
    ...(options.textures === undefined ? {} : { textures: options.textures }),
    ...(options.samplers === undefined ? {} : { samplers: options.samplers }),
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createLightBindGroup(
  options: CreateStandardFrameGpuResourcesOptions,
  lightGpuBuffers: CreateSnapshotLightGpuBuffersResult,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): LightBindGroupResource | StandardLightShadowBindGroupResource | null {
  if (
    options.pipelineKey.includes("iblDiffuse") &&
    options.standardMaterialIblResources !== undefined
  ) {
    return createLightIblBindGroup(options, lightGpuBuffers, diagnostics);
  }

  if (
    (options.pipelineKey.includes("shadowMap") ||
      options.pipelineKey.includes("pointShadowMap")) &&
    options.shadowReceiverResources !== undefined
  ) {
    return createLightShadowBindGroup(options, lightGpuBuffers, diagnostics);
  }

  const plan = createLightBindGroupDescriptorPlan({
    lightGpuBufferResource: lightGpuBuffers.resource,
    layoutKey: options.lightLayout?.layoutKey ?? null,
    label: "standard/lights",
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
    ...(options.lightLayout === null
      ? {}
      : { group: options.lightLayout.group }),
  });

  diagnostics.push(...plan.diagnostics);

  const result = createLightBindGroupResource({
    device: options.device,
    plan,
    layout: options.lightLayout,
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createLightIblBindGroup(
  options: CreateStandardFrameGpuResourcesOptions,
  lightGpuBuffers: CreateSnapshotLightGpuBuffersResult,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): StandardLightShadowBindGroupResource | null {
  const iblResources = options.standardMaterialIblResources;

  if (
    iblResources === undefined ||
    iblResources.diffuseTextureResource === undefined ||
    iblResources.samplerResource === undefined
  ) {
    return null;
  }

  const shadowRequired =
    options.pipelineKey.includes("shadowMap") ||
    options.pipelineKey.includes("pointShadowMap");
  const shadowReceiverResources = shadowRequired
    ? options.shadowReceiverResources
    : undefined;
  const plan = createStandardLightIblBindGroupDescriptorPlan({
    lightGpuBufferResource: lightGpuBuffers.resource,
    layoutKey: options.lightLayout?.layoutKey ?? null,
    label: shadowRequired
      ? "standard/lights-shadow-ibl"
      : "standard/lights-ibl",
    diffuseTextureResource: iblResources.diffuseTextureResource,
    ...(options.pipelineKey.includes("iblSpecularProof") &&
    iblResources.specularTextureResource !== undefined
      ? { specularTextureResource: iblResources.specularTextureResource }
      : {}),
    samplerResource: iblResources.samplerResource,
    shadowRequired,
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
    ...(shadowReceiverResources === undefined
      ? {}
      : { shadowReceiverResources }),
  });

  diagnostics.push(...plan.diagnostics);

  const result = createStandardLightShadowBindGroupResource({
    device: options.device,
    plan,
    layout:
      options.lightLayout as StandardLightShadowBindGroupLayoutResource | null,
    lightGpuBufferResource: lightGpuBuffers.resource,
    matrixBufferResource:
      shadowReceiverResources?.matrixBufferResource ??
      emptyShadowMatrixBufferResourceReport(),
    depthTextureResources:
      shadowReceiverResources?.depthTextureResources ??
      emptyShadowDepthTextureResourceReport(),
    samplerResource:
      shadowReceiverResources?.samplerResource ??
      emptyShadowSamplerResourceReport(),
    diffuseTextureResource: iblResources.diffuseTextureResource,
    ...(options.pipelineKey.includes("iblSpecularProof") &&
    iblResources.specularTextureResource !== undefined
      ? { specularTextureResource: iblResources.specularTextureResource }
      : {}),
    iblSamplerResource: iblResources.samplerResource,
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createLightShadowBindGroup(
  options: CreateStandardFrameGpuResourcesOptions,
  lightGpuBuffers: CreateSnapshotLightGpuBuffersResult,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): StandardLightShadowBindGroupResource | null {
  const shadowReceiverResources = options.shadowReceiverResources;

  if (shadowReceiverResources === undefined) {
    return null;
  }

  if (
    options.pipelineKey.includes("shadowMap") &&
    options.pipelineKey.includes("pointShadowMap") &&
    shadowReceiverResources.spotShadowReceiverResources !== undefined &&
    shadowReceiverResources.pointShadowReceiverResources !== undefined
  ) {
    const plan = createStandardLightMultiShadowBindGroupDescriptorPlan({
      lightGpuBufferResource: lightGpuBuffers.resource,
      layoutKey: options.lightLayout?.layoutKey ?? null,
      label: "standard/lights-multi-shadow",
      directionalShadowReceiverResources: shadowReceiverResources,
      spotShadowReceiverResources:
        shadowReceiverResources.spotShadowReceiverResources,
      pointShadowReceiverResources:
        shadowReceiverResources.pointShadowReceiverResources,
      areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
    });

    diagnostics.push(...plan.diagnostics);

    const result = createStandardLightShadowBindGroupResource({
      device: options.device,
      plan,
      layout:
        options.lightLayout as StandardLightShadowBindGroupLayoutResource | null,
      lightGpuBufferResource: lightGpuBuffers.resource,
      matrixBufferResource: shadowReceiverResources.matrixBufferResource,
      depthTextureResources: shadowReceiverResources.depthTextureResources,
      samplerResource: shadowReceiverResources.samplerResource,
      additionalShadowReceiverResources: [
        shadowReceiverResources.spotShadowReceiverResources,
        shadowReceiverResources.pointShadowReceiverResources,
      ],
      areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
    });

    diagnostics.push(...result.diagnostics);

    return result.valid ? result.resource : null;
  }

  const plan = createStandardLightShadowBindGroupDescriptorPlan({
    lightGpuBufferResource: lightGpuBuffers.resource,
    layoutKey: options.lightLayout?.layoutKey ?? null,
    label: "standard/lights-shadow",
    matrixBufferResource: shadowReceiverResources.matrixBufferResource,
    depthTextureResources: shadowReceiverResources.depthTextureResources,
    samplerResource: shadowReceiverResources.samplerResource,
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
  });

  diagnostics.push(...plan.diagnostics);

  const result = createStandardLightShadowBindGroupResource({
    device: options.device,
    plan,
    layout:
      options.lightLayout as StandardLightShadowBindGroupLayoutResource | null,
    lightGpuBufferResource: lightGpuBuffers.resource,
    matrixBufferResource: shadowReceiverResources.matrixBufferResource,
    depthTextureResources: shadowReceiverResources.depthTextureResources,
    samplerResource: shadowReceiverResources.samplerResource,
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createSharedBindGroupDescriptorPlan(input: {
  readonly viewUniformResourceKey: string | null;
  readonly worldTransformResourceKey: string | null;
  readonly skinningJointResourceKey?: string | null;
  readonly morphTargetWeightResourceKey?: string | null;
}): UnlitBindGroupDescriptorPlan {
  const diagnostics: UnlitBindGroupDescriptorDiagnostic[] = [];
  const entries: UnlitBindGroupDescriptorEntry[] = [];

  if (input.viewUniformResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingViewResource",
      message: "Standard shared bind group planning requires a view uniform.",
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
        "Standard shared bind group planning requires a world transform buffer.",
    });
  } else {
    entries.push({
      group: 1,
      binding: 0,
      resourceKey: input.worldTransformResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.skinningJointResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingTransformResource",
      message:
        "Standard skinned shared bind group planning requires a skinning joint matrix buffer.",
    });
  } else if (input.skinningJointResourceKey !== undefined) {
    entries.push({
      group: 1,
      binding: 1,
      resourceKey: input.skinningJointResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.morphTargetWeightResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingTransformResource",
      message:
        "Standard morphed shared bind group planning requires a morph target weight buffer.",
    });
  } else if (input.morphTargetWeightResourceKey !== undefined) {
    entries.push({
      group: 1,
      binding: 2,
      resourceKey: input.morphTargetWeightResourceKey,
      resourceKind: "buffer",
    });
  }

  return { valid: diagnostics.length === 0, entries, diagnostics };
}

function emptyShadowMatrixBufferResourceReport(): ShadowMatrixBufferResourceReport {
  return {
    ready: false,
    status: "missing",
    matrixCount: 0,
    byteSize: 0,
    createdBufferCount: 0,
    reusedBufferCount: 0,
    sections: {
      matrixComputation: false,
      bufferDescriptor: false,
      bufferAllocation: false,
      upload: false,
      bindGroupResource: false,
      shaderSampling: false,
    },
    resource: null,
    diagnostics: [],
  };
}

function emptyShadowDepthTextureResourceReport(): ShadowDepthTextureResourceReport {
  return {
    ready: false,
    status: "missing",
    textureDescriptorCount: 0,
    createdTextureCount: 0,
    sections: {
      textureDescriptors: false,
      depthTextureResource: false,
      gpuAllocation: false,
      matrixUpload: false,
      passSubmission: false,
      shaderSampling: false,
    },
    resources: [],
    diagnostics: [],
  };
}

function emptyShadowSamplerResourceReport(): ShadowSamplerResourceReport {
  return {
    ready: false,
    status: "missing",
    createdSamplerCount: 0,
    reusedSamplerCount: 0,
    sections: {
      samplerDescriptor: true,
      samplerResource: false,
      bindGroupResource: false,
      shaderSampling: false,
    },
    resource: null,
    diagnostics: [],
  };
}
