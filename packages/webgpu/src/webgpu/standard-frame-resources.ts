import {
  createMeshGpuUploadPlan,
  type MeshAsset,
  type MeshUploadPlanDiagnostic,
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
import {
  createStandardMaterialGpuBuffer,
  type StandardMaterialGpuBufferDiagnostic,
  type StandardMaterialGpuBufferResource,
} from "./standard-material-buffer-resource.js";
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
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | CreateSnapshotLightGpuBuffersDiagnostic
  | LightBindGroupDescriptorDiagnostic
  | LightBindGroupResourceDiagnostic
  | UnlitBindGroupDescriptorDiagnostic
  | UnlitBindGroupResourceDiagnostic;

export interface StandardFrameGpuResourceDeviceLike extends WebGpuBufferDeviceLike {
  createBindGroup?: (descriptor: unknown) => unknown;
}

export interface CreateStandardFrameGpuResourcesOptions {
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly mesh: MeshAsset | null;
  readonly viewUniforms: PackedSnapshotViewUniforms | null;
  readonly worldTransforms: PackedSnapshotTransforms | null;
  readonly material: StandardMaterialAsset | null;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly lightLayout: LightBindGroupLayoutResource | null;
  readonly textures?: readonly TextureGpuResource[];
  readonly samplers?: readonly SamplerGpuResource[];
}

export interface StandardFrameGpuResources {
  readonly mesh: MeshGpuBufferResource;
  readonly viewUniform: ViewUniformGpuBufferResource;
  readonly worldTransforms: WorldTransformGpuBufferResource;
  readonly material: StandardMaterialGpuBufferResource;
  readonly lightGpuBuffers: CreateSnapshotLightGpuBuffersResult;
  readonly materialBindGroup: StandardMaterialBindGroupResource;
  readonly lightBindGroup: LightBindGroupResource;
  readonly bindGroups: readonly UnlitBindGroupResource[];
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
  const material = createMaterialResource(options, diagnostics);
  const sharedBindGroups = createSharedBindGroups(
    options,
    viewUniform,
    worldTransforms,
    diagnostics,
  );
  const materialBindGroup = createMaterialBindGroup(
    options,
    material,
    diagnostics,
  );
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

  if (
    mesh === null ||
    viewUniform === null ||
    worldTransforms === null ||
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
      material,
      lightGpuBuffers,
      materialBindGroup,
      lightBindGroup,
      bindGroups: [
        ...sharedBindGroups.resources,
        materialBindGroup,
        lightBindGroup,
      ],
    },
    diagnostics,
  };
}

function createMeshResource(
  options: Pick<CreateStandardFrameGpuResourcesOptions, "device" | "mesh">,
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): MeshGpuBufferResource | null {
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
  diagnostics: CreateStandardFrameGpuResourcesDiagnostic[],
): CreateUnlitBindGroupsResult {
  const plan = createSharedBindGroupDescriptorPlan({
    viewUniformResourceKey: viewUniform?.resourceKey ?? null,
    worldTransformResourceKey: worldTransforms?.resourceKey ?? null,
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
): LightBindGroupResource | null {
  const plan = createLightBindGroupDescriptorPlan({
    lightGpuBufferResource: lightGpuBuffers.resource,
    layoutKey: options.lightLayout?.layoutKey ?? null,
    label: "standard/lights",
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

function createSharedBindGroupDescriptorPlan(input: {
  readonly viewUniformResourceKey: string | null;
  readonly worldTransformResourceKey: string | null;
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

  return { valid: diagnostics.length === 0, entries, diagnostics };
}
