import {
  assetHandleKey,
  type AssetRegistry,
  type AssetStatus,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type {
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
} from "@aperture-engine/render";

export type StandardTextureDependencyField =
  | "baseColorTexture"
  | "metallicRoughnessTexture"
  | "clearcoatTexture"
  | "clearcoatRoughnessTexture"
  | "transmissionTexture"
  | "sheenColorTexture"
  | "sheenRoughnessTexture"
  | "iridescenceTexture"
  | "iridescenceThicknessTexture"
  | "normalTexture"
  | "occlusionTexture"
  | "emissiveTexture";

const STANDARD_TEXTURE_DEPENDENCY_FIELDS: readonly StandardTextureDependencyField[] =
  [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "clearcoatTexture",
    "clearcoatRoughnessTexture",
    "transmissionTexture",
    "sheenColorTexture",
    "sheenRoughnessTexture",
    "iridescenceTexture",
    "iridescenceThicknessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
  ];

export type StandardMaterialTextureBinding = NonNullable<
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

export interface CreatePreparedStandardMetallicRoughnessTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardMetallicRoughnessTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardNormalTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardNormalTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardClearcoatTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardClearcoatTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardTransmissionTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardTransmissionTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardSheenColorTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardSheenColorTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardSheenRoughnessTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardSheenRoughnessTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardIridescenceTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardIridescenceTextureDependencyKeysResult {
  readonly valid: boolean;
  readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
  readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}

export interface CreatePreparedStandardIridescenceThicknessTextureDependencyKeysOptions {
  readonly registry: AssetRegistry;
  readonly material: StandardMaterialAsset;
}

export interface CreatePreparedStandardIridescenceThicknessTextureDependencyKeysResult {
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

export function createPreparedStandardMetallicRoughnessTextureDependencyKeys(
  options: CreatePreparedStandardMetallicRoughnessTextureDependencyKeysOptions,
): CreatePreparedStandardMetallicRoughnessTextureDependencyKeysResult {
  const binding = options.material.metallicRoughnessTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "metallicRoughnessTexture",
    binding,
  });
}

export function createPreparedStandardNormalTextureDependencyKeys(
  options: CreatePreparedStandardNormalTextureDependencyKeysOptions,
): CreatePreparedStandardNormalTextureDependencyKeysResult {
  const binding = options.material.normalTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "normalTexture",
    binding,
  });
}

export function createPreparedStandardClearcoatTextureDependencyKeys(
  options: CreatePreparedStandardClearcoatTextureDependencyKeysOptions,
): CreatePreparedStandardClearcoatTextureDependencyKeysResult {
  const binding = options.material.clearcoatTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "clearcoatTexture",
    binding,
  });
}

export function createPreparedStandardClearcoatRoughnessTextureDependencyKeys(
  options: CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysOptions,
): CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysResult {
  const binding = options.material.clearcoatRoughnessTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "clearcoatRoughnessTexture",
    binding,
  });
}

export function createPreparedStandardTransmissionTextureDependencyKeys(
  options: CreatePreparedStandardTransmissionTextureDependencyKeysOptions,
): CreatePreparedStandardTransmissionTextureDependencyKeysResult {
  const binding = options.material.transmissionTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "transmissionTexture",
    binding,
  });
}

export function createPreparedStandardSheenColorTextureDependencyKeys(
  options: CreatePreparedStandardSheenColorTextureDependencyKeysOptions,
): CreatePreparedStandardSheenColorTextureDependencyKeysResult {
  const binding = options.material.sheenColorTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "sheenColorTexture",
    binding,
  });
}

export function createPreparedStandardSheenRoughnessTextureDependencyKeys(
  options: CreatePreparedStandardSheenRoughnessTextureDependencyKeysOptions,
): CreatePreparedStandardSheenRoughnessTextureDependencyKeysResult {
  const binding = options.material.sheenRoughnessTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "sheenRoughnessTexture",
    binding,
  });
}

export function createPreparedStandardIridescenceTextureDependencyKeys(
  options: CreatePreparedStandardIridescenceTextureDependencyKeysOptions,
): CreatePreparedStandardIridescenceTextureDependencyKeysResult {
  const binding = options.material.iridescenceTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "iridescenceTexture",
    binding,
  });
}

export function createPreparedStandardIridescenceThicknessTextureDependencyKeys(
  options: CreatePreparedStandardIridescenceThicknessTextureDependencyKeysOptions,
): CreatePreparedStandardIridescenceThicknessTextureDependencyKeysResult {
  const binding = options.material.iridescenceThicknessTexture;

  if (binding === null) {
    return { valid: true, dependencies: null, diagnostics: [] };
  }

  return createPreparedStandardTextureBindingDependencyKeys({
    registry: options.registry,
    field: "iridescenceThicknessTexture",
    binding,
  });
}

export function createPreparedStandardTextureBindingDependencyKeys(options: {
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

export function standardTextureBinding(
  material: StandardMaterialAsset,
  field: StandardTextureDependencyField,
): StandardMaterialTextureBinding | null {
  switch (field) {
    case "baseColorTexture":
      return material.baseColorTexture;
    case "metallicRoughnessTexture":
      return material.metallicRoughnessTexture;
    case "clearcoatTexture":
      return material.clearcoatTexture;
    case "clearcoatRoughnessTexture":
      return material.clearcoatRoughnessTexture;
    case "transmissionTexture":
      return material.transmissionTexture;
    case "sheenColorTexture":
      return material.sheenColorTexture;
    case "sheenRoughnessTexture":
      return material.sheenRoughnessTexture;
    case "iridescenceTexture":
      return material.iridescenceTexture;
    case "iridescenceThicknessTexture":
      return material.iridescenceThicknessTexture;
    case "normalTexture":
      return material.normalTexture;
    case "occlusionTexture":
      return material.occlusionTexture;
    case "emissiveTexture":
      return material.emissiveTexture;
  }
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
