import {
  type MeshAsset,
  type MeshDrawPacket,
  type MeshUploadPlanDiagnostic,
  type PackedSnapshotInstanceTints,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type RenderSnapshot,
  type StandardMaterialAsset,
} from "@aperture-engine/render";
import type { WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import type { CurrentTextureLike } from "../../app/presentation/current-texture-view.js";
import {
  createLightBindGroupDescriptorPlan,
  createLightBindGroupResource,
  type LightBindGroupDescriptorDiagnostic,
  type LightBindGroupResource,
  type LightBindGroupResourceDiagnostic,
  type StandardTransmissionSceneColorResources,
} from "../../lighting/light-bind-group.js";
import type {
  LocalLightClusterDescriptor,
  LocalLightClusterGpuResource,
  LocalLightClusterGpuResourceDiagnostic,
} from "../../lighting/local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import {
  createLocalLightClusterResource,
  requiresClusteredLocalLightBuffer,
  requiresClusteredLocalLightCookies,
  reusesShadowMatricesForClusteredLocalLightCookies,
} from "./standard-frame-local-light-resources.js";
import type { LightBindGroupLayoutResource } from "../../lighting/light-bind-group-layout.js";
import {
  createInstanceTintResource,
  createMaterialResource,
  createMeshResource,
  createMorphTargetWeightResource,
  createMorphTargetDeltaResource,
  createMorphInstanceDescriptorResource,
  createSkinningJointResource,
  createViewUniformResource,
  createWorldTransformResource,
  requiresInstanceTintBuffer,
  requiresMorphTargetWeightBuffer,
  requiresSkinningJointBuffer,
} from "./standard-frame-base-resources.js";
import {
  createSnapshotLightGpuBuffers,
  type CreateSnapshotLightGpuBuffersDiagnostic,
  type CreateSnapshotLightGpuBuffersResult,
} from "../../lighting/lighting-resource-plan.js";
import type {
  InstanceTintBufferDescriptorDiagnostic,
  InstanceTintGpuBufferDiagnostic,
  InstanceTintGpuBufferResource,
} from "../../resources/attributes/instance-tint-buffer.js";
import type {
  SkinningJointBufferDescriptorDiagnostic,
  SkinningJointGpuBufferDiagnostic,
  SkinningJointGpuBufferResource,
} from "../../resources/attributes/skinning-joint-buffer.js";
import type {
  MorphTargetWeightBufferDescriptorDiagnostic,
  MorphTargetWeightGpuBufferDiagnostic,
  MorphTargetWeightGpuBufferResource,
} from "../../resources/attributes/morph-target-weight-buffer.js";
import type {
  MorphTargetDeltaBufferDescriptorDiagnostic,
  MorphTargetDeltaGpuBufferDiagnostic,
  MorphTargetDeltaGpuBufferResource,
} from "../../resources/attributes/morph-target-delta-buffer.js";
import type {
  MorphInstanceDescriptorBufferDescriptorDiagnostic,
  MorphInstanceDescriptorGpuBufferDiagnostic,
  MorphInstanceDescriptorGpuBufferResource,
} from "../../resources/attributes/morph-instance-descriptor-buffer.js";
import type {
  MeshGpuBufferCreationDiagnostic,
  MeshGpuBufferResource,
} from "../../resources/meshes/mesh-buffer-resources.js";
import type { MeshUploadBufferDescriptorDiagnostic } from "../../resources/meshes/mesh-buffer-descriptors.js";
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
import type { IblSamplerResourceReport } from "../../lighting/ibl-sampler-resource.js";
import type {
  DiffuseIblTextureResourceReport,
  SpecularIblTextureResourceReport,
} from "../../lighting/ibl-texture-resource.js";
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
import type {
  StandardMaterialGpuBufferDiagnostic,
  StandardMaterialGpuBufferResource,
} from "./standard-material-buffer-resource.js";
import type { ShadowDepthTextureResourceReport } from "../../shadows/shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "../../shadows/shadow-matrix-buffer-resource.js";
import type { ShadowSamplerResourceReport } from "./standard-material-shadow-bind-group.js";
import type {
  StandardMaterialBufferDescriptorDiagnostic,
  StandardMaterialPackingDiagnostic,
} from "./standard-material-buffer.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "../../resources/textures/texture-resources.js";
import {
  createUnlitBindGroupsFromGpuResources,
  type CreateUnlitBindGroupsResult,
  type UnlitBindGroupDescriptorDiagnostic,
  type UnlitBindGroupDescriptorEntry,
  type UnlitBindGroupDescriptorPlan,
  type UnlitBindGroupLayoutResource,
  type UnlitBindGroupResource,
  type UnlitBindGroupResourceDiagnostic,
} from "../unlit/unlit-bind-group.js";
import type { ViewUniformBufferDescriptorDiagnostic } from "../../resources/views/view-uniform-buffer.js";
import type {
  ViewUniformGpuBufferDiagnostic,
  ViewUniformGpuBufferResource,
} from "../../resources/views/view-uniform-buffer-resource.js";
import type {
  WorldTransformBufferDescriptorDiagnostic,
  WorldTransformGpuBufferDiagnostic,
  WorldTransformGpuBufferResource,
} from "../../resources/transforms/world-transform-buffer.js";

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
  | MorphTargetDeltaBufferDescriptorDiagnostic
  | MorphTargetDeltaGpuBufferDiagnostic
  | MorphInstanceDescriptorBufferDescriptorDiagnostic
  | MorphInstanceDescriptorGpuBufferDiagnostic
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
  | LocalLightClusterGpuResourceDiagnostic
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
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
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
  readonly sharedBindGroupCache?:
    | BindGroupResourceCache<UnlitBindGroupResource>
    | undefined;
  readonly lightBindGroupCache?:
    | BindGroupResourceCache<LightBindGroupResource>
    | undefined;
  readonly standardLightShadowBindGroupCache?:
    | BindGroupResourceCache<StandardLightShadowBindGroupResource>
    | undefined;
  readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
  readonly standardAreaLightLtcResources?: StandardAreaLightLtcResources | null;
  readonly localLightClusterDescriptor?: LocalLightClusterDescriptor | null;
  readonly localLightClusterResources?: LocalLightClusterGpuResource | null;
  readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
  readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
  readonly textures?: readonly TextureGpuResource[];
  readonly samplers?: readonly SamplerGpuResource[];
}

export interface StandardFrameTransmissionSceneColorResources extends StandardTransmissionSceneColorResources {
  readonly texture: StandardTransmissionSceneColorResources["texture"] & {
    readonly texture: CurrentTextureLike;
    readonly width: number;
    readonly height: number;
    readonly format: string;
  };
}

export interface StandardFrameShadowReceiverResourceSet {
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ShadowSamplerResourceReport;
}

export interface StandardFrameShadowReceiverResources extends StandardFrameShadowReceiverResourceSet {
  readonly shadowKind?:
    | "directional"
    | "directional-cascaded"
    | "point"
    | "point-array"
    | "spot"
    | "spot-array"
    | "multi"
    | "multi-spot-array"
    | "multi-point-array"
    | "multi-spot-array-point-array";
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
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource;
  readonly instanceTints?: InstanceTintGpuBufferResource;
  readonly skinningJointMatrices?: SkinningJointGpuBufferResource;
  readonly morphTargetWeights?: MorphTargetWeightGpuBufferResource;
  readonly morphTargetDeltas?: MorphTargetDeltaGpuBufferResource;
  readonly morphInstanceDescriptors?: MorphInstanceDescriptorGpuBufferResource;
  readonly material: StandardMaterialGpuBufferResource;
  readonly lightGpuBuffers: CreateSnapshotLightGpuBuffersResult;
  readonly localLightClusters?: LocalLightClusterGpuResource;
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
  const morphTargetDeltas = createMorphTargetDeltaResource(
    options,
    diagnostics,
  );
  const morphInstanceDescriptors = createMorphInstanceDescriptorResource(
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
    morphTargetDeltas,
    morphInstanceDescriptors,
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

  const localLightClusters = createLocalLightClusterResource(
    options,
    diagnostics,
  );
  const lightBindGroup = createLightBindGroup(
    options,
    lightGpuBuffers,
    localLightClusters,
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
      (morphTargetWeights === null ||
        morphTargetDeltas === null ||
        morphInstanceDescriptors === null)) ||
    material === null ||
    !sharedBindGroups.valid ||
    materialBindGroup === null ||
    !lightGpuBuffers.valid ||
    lightGpuBuffers.resource === null ||
    (requiresClusteredLocalLightBuffer(options.pipelineKey) &&
      localLightClusters === null) ||
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
      ...(options.previousWorldTransforms === undefined ||
      options.previousWorldTransforms === null
        ? {}
        : { previousWorldTransforms: options.previousWorldTransforms }),
      ...(instanceTints === null ? {} : { instanceTints }),
      ...(skinningJointMatrices === null ? {} : { skinningJointMatrices }),
      ...(morphTargetWeights === null ? {} : { morphTargetWeights }),
      ...(morphTargetDeltas === null ? {} : { morphTargetDeltas }),
      ...(morphInstanceDescriptors === null
        ? {}
        : { morphInstanceDescriptors }),
      material,
      lightGpuBuffers,
      ...(localLightClusters === null ? {} : { localLightClusters }),
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

function createSharedBindGroups(
  options: CreateStandardFrameGpuResourcesOptions,
  viewUniform: ViewUniformGpuBufferResource | null,
  worldTransforms: WorldTransformGpuBufferResource | null,
  skinningJointMatrices: SkinningJointGpuBufferResource | null,
  morphTargetWeights: MorphTargetWeightGpuBufferResource | null,
  morphTargetDeltas: MorphTargetDeltaGpuBufferResource | null,
  morphInstanceDescriptors: MorphInstanceDescriptorGpuBufferResource | null,
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
          morphTargetDeltaResourceKey: morphTargetDeltas?.resourceKey ?? null,
          morphInstanceDescriptorResourceKey:
            morphInstanceDescriptors?.resourceKey ?? null,
        }
      : {}),
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
    bindGroupCache: options.sharedBindGroupCache,
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
      ...(morphTargetDeltas === null
        ? []
        : [
            {
              resourceKey: morphTargetDeltas.resourceKey,
              buffer: morphTargetDeltas.buffer,
            },
          ]),
      ...(morphInstanceDescriptors === null
        ? []
        : [
            {
              resourceKey: morphInstanceDescriptors.resourceKey,
              buffer: morphInstanceDescriptors.buffer,
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
  localLightClusters: LocalLightClusterGpuResource | null,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): LightBindGroupResource | StandardLightShadowBindGroupResource | null {
  if (
    options.pipelineKey.includes("iblDiffuse") &&
    options.standardMaterialIblResources !== undefined
  ) {
    return createLightIblBindGroup(
      options,
      lightGpuBuffers,
      localLightClusters,
      diagnostics,
    );
  }

  if (
    (options.pipelineKey.includes("shadowMap") ||
      options.pipelineKey.includes("pointShadowMap")) &&
    options.shadowReceiverResources !== undefined
  ) {
    return createLightShadowBindGroup(
      options,
      lightGpuBuffers,
      localLightClusters,
      diagnostics,
    );
  }

  const plan = createLightBindGroupDescriptorPlan({
    lightGpuBufferResource: lightGpuBuffers.resource,
    layoutKey: options.lightLayout?.layoutKey ?? null,
    label: "standard/lights",
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
    localLightClusterResources: localLightClusters,
    localLightCookieResources: requiresClusteredLocalLightCookies(
      options.pipelineKey,
    )
      ? (options.localLightCookieResources ?? null)
      : null,
    ...(options.transmissionSceneColorResources === undefined ||
    options.transmissionSceneColorResources === null ||
    !options.pipelineKey.split("|").includes("transmission")
      ? {}
      : {
          transmissionSceneColorResources:
            options.transmissionSceneColorResources,
          pipelineKey: options.pipelineKey,
        }),
    ...(options.lightLayout === null
      ? {}
      : { group: options.lightLayout.group }),
  });

  diagnostics.push(...plan.diagnostics);

  const result = createLightBindGroupResource({
    device: options.device,
    plan,
    layout: options.lightLayout,
    bindGroupCache: options.lightBindGroupCache,
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createLightIblBindGroup(
  options: CreateStandardFrameGpuResourcesOptions,
  lightGpuBuffers: CreateSnapshotLightGpuBuffersResult,
  localLightClusters: LocalLightClusterGpuResource | null,
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
  const cascadedShadowMap = options.pipelineKey.includes("cascadedShadowMap");
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
    cascadedShadowMap,
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
    localLightClusterResources: localLightClusters,
    localLightCookieResources: requiresClusteredLocalLightCookies(
      options.pipelineKey,
    )
      ? (options.localLightCookieResources ?? null)
      : null,
    reuseShadowMatricesForLocalLightCookies:
      reusesShadowMatricesForClusteredLocalLightCookies(options.pipelineKey),
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
    bindGroupCache: options.standardLightShadowBindGroupCache,
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
    localLightClusterResources: localLightClusters,
    localLightCookieResources: requiresClusteredLocalLightCookies(
      options.pipelineKey,
    )
      ? (options.localLightCookieResources ?? null)
      : null,
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createLightShadowBindGroup(
  options: CreateStandardFrameGpuResourcesOptions,
  lightGpuBuffers: CreateSnapshotLightGpuBuffersResult,
  localLightClusters: LocalLightClusterGpuResource | null,
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
      localLightClusterResources: localLightClusters,
      localLightCookieResources: requiresClusteredLocalLightCookies(
        options.pipelineKey,
      )
        ? (options.localLightCookieResources ?? null)
        : null,
      reuseShadowMatricesForLocalLightCookies:
        reusesShadowMatricesForClusteredLocalLightCookies(options.pipelineKey),
    });

    diagnostics.push(...plan.diagnostics);

    const result = createStandardLightShadowBindGroupResource({
      device: options.device,
      plan,
      layout:
        options.lightLayout as StandardLightShadowBindGroupLayoutResource | null,
      bindGroupCache: options.standardLightShadowBindGroupCache,
      lightGpuBufferResource: lightGpuBuffers.resource,
      matrixBufferResource: shadowReceiverResources.matrixBufferResource,
      depthTextureResources: shadowReceiverResources.depthTextureResources,
      samplerResource: shadowReceiverResources.samplerResource,
      additionalShadowReceiverResources: [
        shadowReceiverResources.spotShadowReceiverResources,
        shadowReceiverResources.pointShadowReceiverResources,
      ],
      areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
      localLightClusterResources: localLightClusters,
      localLightCookieResources: requiresClusteredLocalLightCookies(
        options.pipelineKey,
      )
        ? (options.localLightCookieResources ?? null)
        : null,
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
    localLightClusterResources: localLightClusters,
    localLightCookieResources: requiresClusteredLocalLightCookies(
      options.pipelineKey,
    )
      ? (options.localLightCookieResources ?? null)
      : null,
    reuseShadowMatricesForLocalLightCookies:
      reusesShadowMatricesForClusteredLocalLightCookies(options.pipelineKey),
  });

  diagnostics.push(...plan.diagnostics);

  const result = createStandardLightShadowBindGroupResource({
    device: options.device,
    plan,
    layout:
      options.lightLayout as StandardLightShadowBindGroupLayoutResource | null,
    bindGroupCache: options.standardLightShadowBindGroupCache,
    lightGpuBufferResource: lightGpuBuffers.resource,
    matrixBufferResource: shadowReceiverResources.matrixBufferResource,
    depthTextureResources: shadowReceiverResources.depthTextureResources,
    samplerResource: shadowReceiverResources.samplerResource,
    areaLightLtcResources: options.standardAreaLightLtcResources ?? null,
    localLightClusterResources: localLightClusters,
    localLightCookieResources: requiresClusteredLocalLightCookies(
      options.pipelineKey,
    )
      ? (options.localLightCookieResources ?? null)
      : null,
  });

  diagnostics.push(...result.diagnostics);

  return result.valid ? result.resource : null;
}

function createSharedBindGroupDescriptorPlan(input: {
  readonly viewUniformResourceKey: string | null;
  readonly worldTransformResourceKey: string | null;
  readonly skinningJointResourceKey?: string | null;
  readonly morphTargetWeightResourceKey?: string | null;
  readonly morphTargetDeltaResourceKey?: string | null;
  readonly morphInstanceDescriptorResourceKey?: string | null;
  readonly previousWorldTransformResourceKey?: string | null;
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

  if (input.morphTargetDeltaResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingTransformResource",
      message:
        "Standard morphed shared bind group planning requires a morph target delta buffer.",
    });
  } else if (input.morphTargetDeltaResourceKey !== undefined) {
    entries.push({
      group: 1,
      binding: 4,
      resourceKey: input.morphTargetDeltaResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.morphInstanceDescriptorResourceKey === null) {
    diagnostics.push({
      code: "unlitBindGroup.missingTransformResource",
      message:
        "Standard morphed shared bind group planning requires a morph instance descriptor buffer.",
    });
  } else if (input.morphInstanceDescriptorResourceKey !== undefined) {
    entries.push({
      group: 1,
      binding: 5,
      resourceKey: input.morphInstanceDescriptorResourceKey,
      resourceKind: "buffer",
    });
  }

  if (input.previousWorldTransformResourceKey !== undefined) {
    if (input.previousWorldTransformResourceKey === null) {
      diagnostics.push({
        code: "unlitBindGroup.missingTransformResource",
        message:
          "Standard motion-vector shared bind group planning requires a previous world transform buffer.",
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
    reusedTextureCount: 0,
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
