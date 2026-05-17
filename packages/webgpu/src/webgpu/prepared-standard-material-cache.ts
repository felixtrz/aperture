import {
  assetHandleKey,
  type AssetRegistry,
  type AssetStatus,
  type MaterialHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type {
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
} from "@aperture-engine/render";
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
import type { StandardFrameGpuResourceDeviceLike } from "./standard-frame-resources.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "./texture-resources.js";

export type PreparedScalarStandardMaterialCacheStatus =
  | "created"
  | "reused"
  | "skipped"
  | "failed";

export interface PreparedScalarStandardMaterialResource {
  readonly cacheKey: string;
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly material: StandardMaterialGpuBufferResource;
  readonly bindGroup: StandardMaterialBindGroupResource;
}

export interface PreparedBaseColorTexturedStandardMaterialResource extends PreparedScalarStandardMaterialResource {
  readonly dependencyCacheKeySegments: readonly string[];
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
}

export interface PreparedScalarStandardMaterialCache {
  readonly resources: Map<string, PreparedScalarStandardMaterialResource>;
}

export type StandardTextureDependencyField =
  | "baseColorTexture"
  | "metallicRoughnessTexture"
  | "normalTexture"
  | "occlusionTexture"
  | "emissiveTexture";

const STANDARD_TEXTURE_DEPENDENCY_FIELDS: readonly StandardTextureDependencyField[] =
  [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
  ];

type StandardMaterialTextureBinding = NonNullable<
  StandardMaterialAsset[StandardTextureDependencyField]
>;

export interface PreparedStandardTextureDependencyVersionKey {
  readonly field: StandardTextureDependencyField;
  readonly kind: "texture" | "sampler";
  readonly handleKey: string;
  readonly version: number;
  readonly versionKey: string;
}

export interface PreparedStandardTextureBindingDependencyKeys {
  readonly field: StandardTextureDependencyField;
  readonly texture: PreparedStandardTextureDependencyVersionKey;
  readonly sampler: PreparedStandardTextureDependencyVersionKey;
  readonly cacheKeySegments: readonly string[];
}

export interface PreparedStandardTextureDependencyKeys {
  readonly bindings: readonly PreparedStandardTextureBindingDependencyKeys[];
  readonly cacheKeySegments: readonly string[];
}

export type PreparedStandardTextureDependencyDiagnostic =
  | {
      readonly code:
        | "preparedStandardTextureDependency.missingTextureHandle"
        | "preparedStandardTextureDependency.missingSamplerHandle";
      readonly message: string;
      readonly field:
        | `${StandardTextureDependencyField}.texture`
        | `${StandardTextureDependencyField}.sampler`;
    }
  | {
      readonly code:
        | "preparedStandardTextureDependency.textureSourceNotReady"
        | "preparedStandardTextureDependency.samplerSourceNotReady";
      readonly message: string;
      readonly field: StandardTextureDependencyField;
      readonly resourceKey: string;
      readonly status: AssetStatus | "missing";
    };

export interface CreatePreparedStandardBaseColorTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardBaseColorTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export type PreparedScalarStandardMaterialDiagnostic =
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedScalarStandardMaterial.notScalar"
        | "preparedScalarStandardMaterial.missingLayout"
        | "preparedScalarStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export type PreparedBaseColorTexturedStandardMaterialDiagnostic =
  | PreparedStandardTextureDependencyDiagnostic
  | StandardMaterialPackingDiagnostic
  | StandardMaterialBufferDescriptorDiagnostic
  | StandardMaterialGpuBufferDiagnostic
  | StandardMaterialBindGroupDescriptorDiagnostic
  | StandardMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured"
        | "preparedBaseColorTexturedStandardMaterial.missingLayout"
        | "preparedBaseColorTexturedStandardMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export interface PrepareScalarStandardMaterialResourceOptions {
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
}

export interface PrepareScalarStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedScalarStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedScalarStandardMaterialDiagnostic[];
}

export interface PrepareBaseColorTexturedStandardMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: StandardFrameGpuResourceDeviceLike;
  readonly cache: PreparedScalarStandardMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: StandardMaterialAsset;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
}

export interface PrepareBaseColorTexturedStandardMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedScalarStandardMaterialCacheStatus;
  readonly resource: PreparedBaseColorTexturedStandardMaterialResource | null;
  readonly diagnostics: readonly PreparedBaseColorTexturedStandardMaterialDiagnostic[];
}

export function createPreparedScalarStandardMaterialCache(): PreparedScalarStandardMaterialCache {
  return { resources: new Map() };
}

export function createPreparedStandardTextureDependencyKeys(
  options: CreatePreparedStandardTextureDependencyKeysOptions,
): CreatePreparedStandardTextureDependencyKeysResult {
  const diagnostics: PreparedStandardTextureDependencyDiagnostic[] = [];
  const bindings: PreparedStandardTextureBindingDependencyKeys[] = [];

  for (const field of STANDARD_TEXTURE_DEPENDENCY_FIELDS) {
    const binding = standardTextureBinding(options.material, field);

    if (binding === null) {
      continue;
    }

    const result = createPreparedStandardTextureBindingDependencyKeys({
      registry: options.registry,
      field,
      binding,
    });

    diagnostics.push(...result.diagnostics);

    if (result.dependencies !== null) {
      bindings.push(result.dependencies);
    }
  }

  if (diagnostics.length > 0) {
    return { valid: false, dependencies: null, diagnostics };
  }

  if (bindings.length === 0) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return {
    valid: true,
    dependencies: {
      bindings,
      cacheKeySegments: bindings.flatMap((binding) => binding.cacheKeySegments),
    },
    diagnostics: [],
  };
}

export function createPreparedStandardBaseColorTextureDependencyKeys(
  options: CreatePreparedStandardBaseColorTextureDependencyKeysOptions,
): CreatePreparedStandardBaseColorTextureDependencyKeysResult {
  const binding = options.material.baseColorTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "baseColorTexture",
    binding,
  });
}

function createPreparedStandardTextureBindingDependencyKeys(options: {
  readonly registry: AssetRegistry;
  readonly field: StandardTextureDependencyField;
  readonly binding: StandardMaterialTextureBinding;
}): CreatePreparedStandardBaseColorTextureDependencyKeysResult {
  const diagnostics: PreparedStandardTextureDependencyDiagnostic[] = [];

  if (options.binding.texture === null) {
    diagnostics.push({
      code: "preparedStandardTextureDependency.missingTextureHandle",
      field: `${options.field}.texture`,
      message:
        "Prepared StandardMaterial texture resources require a texture handle.",
    });
  }

  if (options.binding.sampler === null) {
    diagnostics.push({
      code: "preparedStandardTextureDependency.missingSamplerHandle",
      field: `${options.field}.sampler`,
      message:
        "Prepared StandardMaterial texture resources require a sampler handle.",
    });
  }

  const texture =
    options.binding.texture === null
      ? null
      : preparedStandardTextureDependencyVersionKey({
          registry: options.registry,
          handle: options.binding.texture,
          field: options.field,
          diagnostics,
        });
  const sampler =
    options.binding.sampler === null
      ? null
      : preparedStandardSamplerDependencyVersionKey({
          registry: options.registry,
          handle: options.binding.sampler,
          field: options.field,
          diagnostics,
        });

  if (diagnostics.length > 0 || texture === null || sampler === null) {
    return { valid: false, dependencies: null, diagnostics };
  }

  return {
    valid: true,
    dependencies: {
      field: options.field,
      texture,
      sampler,
      cacheKeySegments: [
        `${options.field}:texture:${texture.versionKey}`,
        `${options.field}:sampler:${sampler.versionKey}`,
      ],
    },
    diagnostics: [],
  };
}

export function prepareScalarStandardMaterialResource(
  options: PrepareScalarStandardMaterialResourceOptions,
): PrepareScalarStandardMaterialResourceResult {
  const sourceMaterialKey = assetHandleKey(options.handle);

  if (!isScalarStandardMaterial(options.material)) {
    return {
      valid: true,
      status: "skipped",
      resource: null,
      diagnostics: [
        {
          code: "preparedScalarStandardMaterial.notScalar",
          materialKey: sourceMaterialKey,
          message:
            "Scalar StandardMaterial prepared caching does not handle textured StandardMaterial variants.",
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
          code: "preparedScalarStandardMaterial.missingLayout",
          materialKey: sourceMaterialKey,
          message:
            "Scalar StandardMaterial prepared caching requires a group-2 material bind group layout.",
        },
      ],
    };
  }

  const cacheKey = preparedScalarStandardMaterialCacheKey({
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
  });
  const cached = options.cache.resources.get(cacheKey);

  if (cached !== undefined) {
    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const preparation = createStandardMaterialPreparationPlan(options.material, {
    label: `prepared-material:${sourceMaterialKey}`,
  });
  const material = createStandardMaterialGpuBuffer({
    device: options.device,
    plan: preparation.plan?.materialBuffer ?? null,
  });
  const bindGroupPlan = createStandardMaterialBindGroupDescriptorPlan({
    materialResourceKey: material.resource?.resourceKey ?? null,
    dependencies:
      preparation.plan?.materialBuffer.dependencies ??
      emptyStandardMaterialDependencies(),
  });
  const bindGroup = createStandardMaterialBindGroupResource({
    device: options.device,
    plan: bindGroupPlan,
    layout: options.layout,
    buffers:
      material.resource === null
        ? []
        : [
            {
              resourceKey: material.resource.resourceKey,
              buffer: material.resource.uniformBuffer,
            },
          ],
  });
  const diagnostics: PreparedScalarStandardMaterialDiagnostic[] = [
    ...preparation.diagnostics,
    ...material.diagnostics,
    ...bindGroup.diagnostics,
  ];

  if (
    diagnostics.length > 0 ||
    !preparation.valid ||
    preparation.plan === null ||
    !material.valid ||
    material.resource === null ||
    !bindGroup.valid ||
    bindGroup.resource === null
  ) {
    if (bindGroup.resource === null && diagnostics.length === 0) {
      diagnostics.push({
        code: "preparedScalarStandardMaterial.missingPreparedBindGroup",
        materialKey: sourceMaterialKey,
        layoutKey: options.layout.layoutKey,
        message:
          "Scalar StandardMaterial prepared caching did not create a group-2 bind group.",
      });
    }

    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics,
    };
  }

  const resource: PreparedScalarStandardMaterialResource = {
    cacheKey,
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    materialResourceKey: material.resource.resourceKey,
    bindGroupResourceKey: bindGroup.resource.resourceKey,
    material: material.resource,
    bindGroup: bindGroup.resource,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function prepareBaseColorTexturedStandardMaterialResource(
  options: PrepareBaseColorTexturedStandardMaterialResourceOptions,
): PrepareBaseColorTexturedStandardMaterialResourceResult {
  const sourceMaterialKey = assetHandleKey(options.handle);

  if (!isBaseColorOnlyStandardMaterial(options.material)) {
    return {
      valid: true,
      status: "skipped",
      resource: null,
      diagnostics: [
        {
          code: "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured",
          materialKey: sourceMaterialKey,
          message:
            "Base-color textured StandardMaterial prepared caching requires exactly a base-color texture binding.",
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
          code: "preparedBaseColorTexturedStandardMaterial.missingLayout",
          materialKey: sourceMaterialKey,
          message:
            "Base-color textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        },
      ],
    };
  }

  const dependencyResult = createPreparedStandardBaseColorTextureDependencyKeys(
    {
      registry: options.registry,
      material: options.material,
    },
  );

  if (!dependencyResult.valid || dependencyResult.dependencies === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: dependencyResult.diagnostics,
    };
  }

  const cacheKey = preparedTexturedStandardMaterialCacheKey({
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
  });
  const cached = options.cache.resources.get(cacheKey) as
    | PreparedBaseColorTexturedStandardMaterialResource
    | undefined;

  if (cached !== undefined) {
    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const preparation = createStandardMaterialPreparationPlan(options.material, {
    label: `prepared-material:${sourceMaterialKey}`,
  });
  const material = createStandardMaterialGpuBuffer({
    device: options.device,
    plan: preparation.plan?.materialBuffer ?? null,
  });
  const bindGroupPlan = createStandardMaterialBindGroupDescriptorPlan({
    materialResourceKey: material.resource?.resourceKey ?? null,
    dependencies:
      preparation.plan?.materialBuffer.dependencies ??
      emptyStandardMaterialDependencies(),
  });
  const bindGroup = createStandardMaterialBindGroupResource({
    device: options.device,
    plan: bindGroupPlan,
    layout: options.layout,
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
  });
  const diagnostics: PreparedBaseColorTexturedStandardMaterialDiagnostic[] = [
    ...preparation.diagnostics,
    ...material.diagnostics,
    ...bindGroupPlan.diagnostics,
    ...bindGroup.diagnostics,
  ];

  if (
    diagnostics.length > 0 ||
    !preparation.valid ||
    preparation.plan === null ||
    !material.valid ||
    material.resource === null ||
    !bindGroup.valid ||
    bindGroup.resource === null
  ) {
    if (bindGroup.resource === null && diagnostics.length === 0) {
      diagnostics.push({
        code: "preparedBaseColorTexturedStandardMaterial.missingPreparedBindGroup",
        materialKey: sourceMaterialKey,
        layoutKey: options.layout.layoutKey,
        message:
          "Base-color textured StandardMaterial prepared caching did not create a group-2 bind group.",
      });
    }

    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics,
    };
  }

  const resource: PreparedBaseColorTexturedStandardMaterialResource = {
    cacheKey,
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
    textureResourceKey: dependencyResult.dependencies.texture.handleKey,
    samplerResourceKey: dependencyResult.dependencies.sampler.handleKey,
    materialResourceKey: material.resource.resourceKey,
    bindGroupResourceKey: bindGroup.resource.resourceKey,
    material: material.resource,
    bindGroup: bindGroup.resource,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function preparedScalarStandardMaterialCacheKey(input: {
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

export function preparedTexturedStandardMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly dependencyCacheKeySegments: readonly string[];
}): string {
  return [
    input.sourceMaterialKey,
    `version:${input.sourceVersion}`,
    `pipeline:${input.pipelineKey}`,
    `layout:${input.layoutKey}`,
    ...input.dependencyCacheKeySegments,
  ].join("|");
}

function isScalarStandardMaterial(material: StandardMaterialAsset): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function isBaseColorOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture !== null &&
    material.metallicRoughnessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

function standardTextureBinding(
  material: StandardMaterialAsset,
  field: StandardTextureDependencyField,
): StandardMaterialTextureBinding | null {
  switch (field) {
    case "baseColorTexture":
      return material.baseColorTexture;
    case "metallicRoughnessTexture":
      return material.metallicRoughnessTexture;
    case "normalTexture":
      return material.normalTexture;
    case "occlusionTexture":
      return material.occlusionTexture;
    case "emissiveTexture":
      return material.emissiveTexture;
  }
}

function emptyStandardMaterialDependencies(): Parameters<
  typeof createStandardMaterialBindGroupDescriptorPlan
>[0]["dependencies"] {
  const empty = { textureKey: null, samplerKey: null, texCoord: 0 };

  return {
    baseColor: empty,
    metallicRoughness: empty,
    normal: empty,
    occlusion: empty,
    emissive: empty,
  };
}

function preparedStandardTextureDependencyVersionKey(options: {
  readonly registry: AssetRegistry;
  readonly handle: TextureHandle;
  readonly field: StandardTextureDependencyField;
  readonly diagnostics: PreparedStandardTextureDependencyDiagnostic[];
}): PreparedStandardTextureDependencyVersionKey | null {
  const handleKey = assetHandleKey(options.handle);
  const entry = options.registry.get<"texture", TextureAsset>(options.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    options.diagnostics.push({
      code: "preparedStandardTextureDependency.textureSourceNotReady",
      field: options.field,
      resourceKey: handleKey,
      status: entry?.status ?? "missing",
      message: `Texture source asset '${handleKey}' is not ready for prepared StandardMaterial resources.`,
    });
    return null;
  }

  return {
    field: options.field,
    kind: "texture",
    handleKey,
    version: entry.version,
    versionKey: `${handleKey}@${entry.version}`,
  };
}

function preparedStandardSamplerDependencyVersionKey(options: {
  readonly registry: AssetRegistry;
  readonly handle: SamplerHandle;
  readonly field: StandardTextureDependencyField;
  readonly diagnostics: PreparedStandardTextureDependencyDiagnostic[];
}): PreparedStandardTextureDependencyVersionKey | null {
  const handleKey = assetHandleKey(options.handle);
  const entry = options.registry.get<"sampler", SamplerAsset>(options.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    options.diagnostics.push({
      code: "preparedStandardTextureDependency.samplerSourceNotReady",
      field: options.field,
      resourceKey: handleKey,
      status: entry?.status ?? "missing",
      message: `Sampler source asset '${handleKey}' is not ready for prepared StandardMaterial resources.`,
    });
    return null;
  }

  return {
    field: options.field,
    kind: "sampler",
    handleKey,
    version: entry.version,
    versionKey: `${handleKey}@${entry.version}`,
  };
}
