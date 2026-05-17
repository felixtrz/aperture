import {
  assetHandleKey,
  type AssetRegistry,
  type AssetStatus,
  type MaterialHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import {
  createUnlitPreparedMaterialResourceDescriptor,
  packUnlitMaterial,
  type SamplerAsset,
  type TextureAsset,
  type UnlitMaterialAsset,
  type PreparedMaterialResourceDiagnostic,
} from "@aperture-engine/render";
import {
  createUnlitBindGroupsFromGpuResources,
  type UnlitBindGroupDescriptorPlan,
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
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "./texture-resources.js";
import type { UnlitFrameGpuResourceDeviceLike } from "./unlit-frame-resources.js";
import type { UnlitMaterialPackingDiagnostic } from "@aperture-engine/render";

export type PreparedScalarUnlitMaterialCacheStatus =
  | "created"
  | "reused"
  | "skipped"
  | "failed";

export interface PreparedUnlitTextureDependencyVersionKey {
  readonly handleKey: string;
  readonly version: number;
  readonly versionKey: string;
}

export interface PreparedUnlitTextureDependencyKeys {
  readonly texture: PreparedUnlitTextureDependencyVersionKey;
  readonly sampler: PreparedUnlitTextureDependencyVersionKey;
  readonly cacheKeySegments: readonly string[];
}

export type PreparedUnlitTextureDependencyDiagnostic =
  | {
      readonly code:
        | "preparedUnlitTextureDependency.missingTextureHandle"
        | "preparedUnlitTextureDependency.missingSamplerHandle";
      readonly message: string;
      readonly field: "baseColorTexture.texture" | "baseColorTexture.sampler";
    }
  | {
      readonly code:
        | "preparedUnlitTextureDependency.textureSourceNotReady"
        | "preparedUnlitTextureDependency.samplerSourceNotReady";
      readonly message: string;
      readonly resourceKey: string;
      readonly status: AssetStatus | "missing";
    };

export interface CreatePreparedUnlitTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: UnlitMaterialAsset;
}

export interface CreatePreparedUnlitTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedUnlitTextureDependencyKeys | null;
  readonly diagnostics: readonly PreparedUnlitTextureDependencyDiagnostic[];
}

export interface PreparedScalarUnlitMaterialResource {
  readonly cacheKey: string;
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  lastUsedFrame: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly dependencyCacheKeySegments?: readonly string[];
  readonly textureResourceKey?: string;
  readonly samplerResourceKey?: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly material: UnlitMaterialGpuBufferResource;
  readonly bindGroup: UnlitBindGroupResource;
}

export type PreparedTexturedUnlitMaterialResource =
  PreparedScalarUnlitMaterialResource & {
    readonly dependencyCacheKeySegments: readonly string[];
    readonly textureResourceKey: string;
    readonly samplerResourceKey: string;
  };

export interface PreparedScalarUnlitMaterialCache {
  readonly resources: Map<string, PreparedScalarUnlitMaterialResource>;
}

export type PreparedScalarUnlitMaterialDiagnostic =
  | PreparedMaterialResourceDiagnostic
  | UnlitMaterialPackingDiagnostic
  | UnlitMaterialBufferDescriptorDiagnostic
  | UnlitMaterialGpuBufferDiagnostic
  | UnlitBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedScalarUnlitMaterial.notScalar"
        | "preparedScalarUnlitMaterial.missingLayout"
        | "preparedScalarUnlitMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedTexturedUnlitMaterialDiagnostic =
  | PreparedMaterialResourceDiagnostic
  | PreparedUnlitTextureDependencyDiagnostic
  | UnlitMaterialPackingDiagnostic
  | UnlitMaterialBufferDescriptorDiagnostic
  | UnlitMaterialGpuBufferDiagnostic
  | UnlitBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedTexturedUnlitMaterial.notTextured"
        | "preparedTexturedUnlitMaterial.missingLayout"
        | "preparedTexturedUnlitMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export interface PrepareScalarUnlitMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: UnlitFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarUnlitMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: UnlitMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: UnlitBindGroupLayoutResource | null;
}

export interface PrepareScalarUnlitMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarUnlitMaterialCacheStatus;
  readonly resource: PreparedScalarUnlitMaterialResource | null;
  readonly diagnostics: readonly PreparedScalarUnlitMaterialDiagnostic[];
}

export interface PrepareTexturedUnlitMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: UnlitFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarUnlitMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: UnlitMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: UnlitBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareTexturedUnlitMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarUnlitMaterialCacheStatus;
  readonly resource: PreparedTexturedUnlitMaterialResource | null;
  readonly diagnostics: readonly PreparedTexturedUnlitMaterialDiagnostic[];
}

export function createPreparedScalarUnlitMaterialCache(): PreparedScalarUnlitMaterialCache {
  return { resources: new Map() };
}

export function createPreparedUnlitTextureDependencyKeys(
  options: CreatePreparedUnlitTextureDependencyKeysOptions,
): CreatePreparedUnlitTextureDependencyKeysResult {
  const binding = options.material.baseColorTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  const diagnostics: PreparedUnlitTextureDependencyDiagnostic[] = [];

  if (binding.texture === null) {
    diagnostics.push({
      code: "preparedUnlitTextureDependency.missingTextureHandle",
      field: "baseColorTexture.texture",
      message:
        "Prepared textured unlit material resources require a base-color texture handle.",
    });
  }

  if (binding.sampler === null) {
    diagnostics.push({
      code: "preparedUnlitTextureDependency.missingSamplerHandle",
      field: "baseColorTexture.sampler",
      message:
        "Prepared textured unlit material resources require a base-color sampler handle.",
    });
  }

  const texture =
    binding.texture === null
      ? null
      : preparedTextureDependencyVersionKey({
          registry: options.registry,
          handle: binding.texture,
          diagnostics,
        });
  const sampler =
    binding.sampler === null
      ? null
      : preparedSamplerDependencyVersionKey({
          registry: options.registry,
          handle: binding.sampler,
          diagnostics,
        });

  if (diagnostics.length > 0 || texture === null || sampler === null) {
    return { valid: false, dependencies: null, diagnostics };
  }

  return {
    valid: true,
    dependencies: {
      texture,
      sampler,
      cacheKeySegments: [
        `texture:${texture.versionKey}`,
        `sampler:${sampler.versionKey}`,
      ],
    },
    diagnostics: [],
  };
}

export function prepareScalarUnlitMaterialResource(
  options: PrepareScalarUnlitMaterialResourceOptions,
): PrepareScalarUnlitMaterialResourceResult {
  const sourceMaterialKey = assetHandleKey(options.handle);

  if (options.material.baseColorTexture !== null) {
    return {
      valid: true,
      status: "skipped",
      resource: null,
      diagnostics: [
        {
          code: "preparedScalarUnlitMaterial.notScalar",
          materialKey: sourceMaterialKey,
          message:
            "Scalar unlit prepared material caching does not handle textured unlit materials.",
        },
      ],
    };
  }

  if (options.layout === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "preparedScalarUnlitMaterial.missingLayout",
          materialKey: sourceMaterialKey,
          message:
            "Scalar unlit prepared material caching requires a group-2 material bind group layout.",
        },
      ],
    };
  }

  const descriptorResult = createUnlitPreparedMaterialResourceDescriptor({
    registry: options.registry,
    material: options.handle,
  });

  if (!descriptorResult.valid || descriptorResult.descriptor === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: descriptorResult.diagnostics,
    };
  }

  const descriptor = descriptorResult.descriptor;
  const cacheKey = preparedScalarUnlitMaterialCacheKey({
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
  });
  const cached = options.cache.resources.get(cacheKey);

  if (cached !== undefined) {
    cached.lastUsedFrame = options.frame ?? 0;

    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const packed = packUnlitMaterial(options.material);
  const materialDescriptor = createUnlitMaterialBufferDescriptor(
    packed.packed,
    { label: descriptor.materialResourceKey },
  );
  const material = createUnlitMaterialGpuBuffer({
    device: options.device,
    plan: materialDescriptor.plan,
  });
  const bindGroupPlan: UnlitBindGroupDescriptorPlan = {
    valid: true,
    entries: [
      {
        group: 2,
        binding: 0,
        resourceKey: material.resource?.resourceKey ?? nullResourceKey(),
        resourceKind: "buffer",
      },
    ],
    diagnostics: [],
  };
  const bindGroups = createUnlitBindGroupsFromGpuResources({
    device: options.device,
    plan: bindGroupPlan,
    layouts: [options.layout],
    buffers:
      material.resource === null
        ? []
        : [
            {
              resourceKey: material.resource.resourceKey,
              buffer: material.resource.uniformBuffer,
            },
          ],
    requiredGroups: [2],
  });
  const diagnostics: PreparedScalarUnlitMaterialDiagnostic[] = [
    ...packed.diagnostics,
    ...materialDescriptor.diagnostics,
    ...material.diagnostics,
    ...bindGroups.diagnostics,
  ];
  const bindGroup = bindGroups.resources[0];

  if (
    diagnostics.length > 0 ||
    !material.valid ||
    material.resource === null ||
    !bindGroups.valid ||
    bindGroup === undefined
  ) {
    if (bindGroup === undefined && diagnostics.length === 0) {
      diagnostics.push({
        code: "preparedScalarUnlitMaterial.missingPreparedBindGroup",
        materialKey: sourceMaterialKey,
        layoutKey: options.layout.layoutKey,
        message:
          "Scalar unlit prepared material caching did not create a group-2 bind group.",
      });
    }

    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics,
    };
  }

  const resource: PreparedScalarUnlitMaterialResource = {
    cacheKey,
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    lastUsedFrame: options.frame ?? 0,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    materialResourceKey: descriptor.materialResourceKey,
    bindGroupResourceKey: bindGroup.resourceKey,
    material: material.resource,
    bindGroup,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function prepareTexturedUnlitMaterialResource(
  options: PrepareTexturedUnlitMaterialResourceOptions,
): PrepareTexturedUnlitMaterialResourceResult {
  const sourceMaterialKey = assetHandleKey(options.handle);

  if (options.material.baseColorTexture === null) {
    return {
      valid: true,
      status: "skipped",
      resource: null,
      diagnostics: [
        {
          code: "preparedTexturedUnlitMaterial.notTextured",
          materialKey: sourceMaterialKey,
          message:
            "Textured unlit prepared material caching requires a base-color texture binding.",
        },
      ],
    };
  }

  if (options.layout === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "preparedTexturedUnlitMaterial.missingLayout",
          materialKey: sourceMaterialKey,
          message:
            "Textured unlit prepared material caching requires a group-2 material bind group layout.",
        },
      ],
    };
  }

  const dependencyResult = createPreparedUnlitTextureDependencyKeys({
    registry: options.registry,
    material: options.material,
  });

  if (!dependencyResult.valid || dependencyResult.dependencies === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: dependencyResult.diagnostics,
    };
  }

  const descriptorResult = createUnlitPreparedMaterialResourceDescriptor({
    registry: options.registry,
    material: options.handle,
  });

  if (!descriptorResult.valid || descriptorResult.descriptor === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: descriptorResult.diagnostics,
    };
  }

  const descriptor = descriptorResult.descriptor;
  const cacheKey = preparedTexturedUnlitMaterialCacheKey({
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
  });
  const cached = options.cache.resources.get(cacheKey) as
    | PreparedTexturedUnlitMaterialResource
    | undefined;

  if (cached !== undefined) {
    cached.lastUsedFrame = options.frame ?? 0;

    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const packed = packUnlitMaterial(options.material);
  const materialDescriptor = createUnlitMaterialBufferDescriptor(
    packed.packed,
    { label: descriptor.materialResourceKey },
  );
  const material = createUnlitMaterialGpuBuffer({
    device: options.device,
    plan: materialDescriptor.plan,
  });
  const bindGroupPlan: UnlitBindGroupDescriptorPlan = {
    valid: true,
    entries: [
      {
        group: 2,
        binding: 0,
        resourceKey: material.resource?.resourceKey ?? nullResourceKey(),
        resourceKind: "buffer",
      },
      {
        group: 2,
        binding: 1,
        resourceKey: dependencyResult.dependencies.texture.handleKey,
        resourceKind: "texture-view",
      },
      {
        group: 2,
        binding: 2,
        resourceKey: dependencyResult.dependencies.sampler.handleKey,
        resourceKind: "sampler",
      },
    ],
    diagnostics: [],
  };
  const bindGroups = createUnlitBindGroupsFromGpuResources({
    device: options.device,
    plan: bindGroupPlan,
    layouts: [options.layout],
    buffers:
      material.resource === null
        ? []
        : [
            {
              resourceKey: material.resource.resourceKey,
              buffer: material.resource.uniformBuffer,
            },
          ],
    textures: options.textures,
    samplers: options.samplers,
    requiredGroups: [2],
  });
  const diagnostics: PreparedTexturedUnlitMaterialDiagnostic[] = [
    ...packed.diagnostics,
    ...materialDescriptor.diagnostics,
    ...material.diagnostics,
    ...bindGroups.diagnostics,
  ];
  const bindGroup = bindGroups.resources[0];

  if (
    diagnostics.length > 0 ||
    !material.valid ||
    material.resource === null ||
    !bindGroups.valid ||
    bindGroup === undefined
  ) {
    if (bindGroup === undefined && diagnostics.length === 0) {
      diagnostics.push({
        code: "preparedTexturedUnlitMaterial.missingPreparedBindGroup",
        materialKey: sourceMaterialKey,
        layoutKey: options.layout.layoutKey,
        message:
          "Textured unlit prepared material caching did not create a group-2 bind group.",
      });
    }

    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics,
    };
  }

  const resource: PreparedTexturedUnlitMaterialResource = {
    cacheKey,
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    lastUsedFrame: options.frame ?? 0,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
    textureResourceKey: dependencyResult.dependencies.texture.handleKey,
    samplerResourceKey: dependencyResult.dependencies.sampler.handleKey,
    materialResourceKey: descriptor.materialResourceKey,
    bindGroupResourceKey: bindGroup.resourceKey,
    material: material.resource,
    bindGroup,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function preparedScalarUnlitMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
}): string {
  return [
    input.sourceMaterialKey,
    `version:${input.sourceVersion}`,
    `pipeline:${input.pipelineKey}`,
    `layout:${input.layoutKey}`,
  ].join("|");
}

export function preparedTexturedUnlitMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly dependencyCacheKeySegments: readonly string[];
}): string {
  return [
    preparedScalarUnlitMaterialCacheKey(input),
    ...input.dependencyCacheKeySegments,
  ].join("|");
}

function nullResourceKey(): string {
  return "missing";
}

function preparedTextureDependencyVersionKey(options: {
  readonly registry: AssetRegistry;
  readonly handle: TextureHandle;
  readonly diagnostics: PreparedUnlitTextureDependencyDiagnostic[];
}): PreparedUnlitTextureDependencyVersionKey | null {
  const resourceKey = assetHandleKey(options.handle);
  const entry = options.registry.get<"texture", TextureAsset>(options.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    options.diagnostics.push({
      code: "preparedUnlitTextureDependency.textureSourceNotReady",
      resourceKey,
      status: entry?.status ?? "missing",
      message: `Texture source asset '${resourceKey}' is not ready for prepared unlit material resources.`,
    });
    return null;
  }

  return {
    handleKey: resourceKey,
    version: entry.version,
    versionKey: preparedDependencyVersionKey(resourceKey, entry.version),
  };
}

function preparedSamplerDependencyVersionKey(options: {
  readonly registry: AssetRegistry;
  readonly handle: SamplerHandle;
  readonly diagnostics: PreparedUnlitTextureDependencyDiagnostic[];
}): PreparedUnlitTextureDependencyVersionKey | null {
  const resourceKey = assetHandleKey(options.handle);
  const entry = options.registry.get<"sampler", SamplerAsset>(options.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    options.diagnostics.push({
      code: "preparedUnlitTextureDependency.samplerSourceNotReady",
      resourceKey,
      status: entry?.status ?? "missing",
      message: `Sampler source asset '${resourceKey}' is not ready for prepared unlit material resources.`,
    });
    return null;
  }

  return {
    handleKey: resourceKey,
    version: entry.version,
    versionKey: preparedDependencyVersionKey(resourceKey, entry.version),
  };
}

function preparedDependencyVersionKey(
  resourceKey: string,
  version: number,
): string {
  return `${resourceKey}@${version}`;
}
