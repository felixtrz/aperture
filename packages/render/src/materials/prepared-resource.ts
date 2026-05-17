import {
  assetHandleKey,
  type AssetHandle,
  type AssetRegistry,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import { materialTextureBindings } from "./bindings.js";
import {
  createMaterialDependencyReadinessReport,
  materialDependencyReadinessReportToJsonValue,
  type MaterialAssetDependencyReadinessDiagnostic,
  type MaterialAssetDependencyReadinessReportJsonValue,
} from "./dependency-readiness.js";
import {
  createMaterialPipelineKeyInput,
  materialPipelineKeyInputToKey,
} from "./pipeline-key.js";
import type {
  MaterialAsset,
  MaterialKind,
  MaterialPipelineKeyInput,
} from "./types.js";
import { validateMaterialAsset } from "./validation.js";

export type PreparedMaterialResourceDiagnostic =
  | MaterialAssetDependencyReadinessDiagnostic
  | {
      readonly code:
        | "preparedMaterialResource.missingMaterial"
        | "preparedMaterialResource.materialNotReady"
        | "preparedMaterialResource.unsupportedMaterialKind"
        | "preparedMaterialResource.invalidMaterial";
      readonly message: string;
      readonly materialKey: string;
      readonly expectedMaterialFamily?: MaterialKind;
      readonly actualMaterialFamily?: MaterialKind;
      readonly field?: string;
    };

export interface PreparedMaterialTextureBindingResource {
  readonly field: string;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly texCoord?: number;
}

export interface PreparedMaterialResourceDescriptor {
  readonly resourceFamily: "material";
  readonly sourceMaterialKey: string;
  readonly materialKey: string;
  readonly label: string;
  readonly materialFamily: MaterialKind;
  readonly materialKind: MaterialKind;
  readonly pipelineKey: string;
  readonly pipelineKeyInput: MaterialPipelineKeyInput;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly dependencies: readonly string[];
  readonly textureBindings: readonly PreparedMaterialTextureBindingResource[];
  readonly dependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
}

export interface CreatePreparedMaterialResourceDescriptorOptions {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
  readonly expectedMaterialFamily?: MaterialKind;
}

export interface CreatePreparedMaterialResourceDescriptorResult {
  readonly valid: boolean;
  readonly descriptor: PreparedMaterialResourceDescriptor | null;
  readonly diagnostics: readonly PreparedMaterialResourceDiagnostic[];
}

export function createPreparedMaterialResourceDescriptor(
  options: CreatePreparedMaterialResourceDescriptorOptions,
): CreatePreparedMaterialResourceDescriptorResult {
  const materialKey = assetHandleKey(options.material);
  const entry = options.registry.get<"material", MaterialAsset>(
    options.material,
  );

  if (entry === undefined) {
    return {
      valid: false,
      descriptor: null,
      diagnostics: [
        {
          code: "preparedMaterialResource.missingMaterial",
          materialKey,
          message: `Material '${materialKey}' is not registered.`,
        },
      ],
    };
  }

  if (entry.status !== "ready" || entry.asset === null) {
    return {
      valid: false,
      descriptor: null,
      diagnostics: [
        {
          code: "preparedMaterialResource.materialNotReady",
          materialKey,
          message: `Material '${materialKey}' is '${entry.status}', not ready.`,
        },
      ],
    };
  }

  const material = entry.asset;

  if (
    options.expectedMaterialFamily !== undefined &&
    material.kind !== options.expectedMaterialFamily
  ) {
    return {
      valid: false,
      descriptor: null,
      diagnostics: [
        {
          code: "preparedMaterialResource.unsupportedMaterialKind",
          materialKey,
          expectedMaterialFamily: options.expectedMaterialFamily,
          actualMaterialFamily: material.kind,
          message: `Prepared material resource descriptor expected '${options.expectedMaterialFamily}', not '${material.kind}'.`,
        },
      ],
    };
  }

  const validation = validateMaterialAsset(material);

  if (!validation.valid) {
    return {
      valid: false,
      descriptor: null,
      diagnostics: validation.diagnostics.map((diagnostic) => ({
        code: "preparedMaterialResource.invalidMaterial",
        materialKey,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        message: diagnostic.message,
      })),
    };
  }

  const dependencyReadiness = createMaterialDependencyReadinessReport({
    registry: options.registry,
    material: options.material,
  });

  if (!dependencyReadiness.ready) {
    return {
      valid: false,
      descriptor: null,
      diagnostics: dependencyReadiness.diagnostics,
    };
  }

  const pipelineKeyInput = createMaterialPipelineKeyInput(material);
  const pipelineKey = materialPipelineKeyInputToKey(pipelineKeyInput);
  const sourceMaterialKey = materialKey;

  return {
    valid: true,
    descriptor: {
      resourceFamily: "material",
      sourceMaterialKey,
      materialKey,
      label: material.label,
      materialFamily: material.kind,
      materialKind: material.kind,
      pipelineKey,
      pipelineKeyInput,
      materialResourceKey: preparedMaterialResourceKey(sourceMaterialKey),
      bindGroupResourceKey: preparedMaterialBindGroupResourceKey({
        sourceMaterialKey,
        pipelineKey,
      }),
      dependencies: collectMaterialDependencyKeys(material),
      textureBindings: collectTextureBindingResources(material),
      dependencyReadiness:
        materialDependencyReadinessReportToJsonValue(dependencyReadiness),
    },
    diagnostics: [],
  };
}

export function createUnlitPreparedMaterialResourceDescriptor(
  options: Omit<
    CreatePreparedMaterialResourceDescriptorOptions,
    "expectedMaterialFamily"
  >,
): CreatePreparedMaterialResourceDescriptorResult {
  return createPreparedMaterialResourceDescriptor({
    ...options,
    expectedMaterialFamily: "unlit",
  });
}

export function createMatcapPreparedMaterialResourceDescriptor(
  options: Omit<
    CreatePreparedMaterialResourceDescriptorOptions,
    "expectedMaterialFamily"
  >,
): CreatePreparedMaterialResourceDescriptorResult {
  return createPreparedMaterialResourceDescriptor({
    ...options,
    expectedMaterialFamily: "matcap",
  });
}

export function createStandardPreparedMaterialResourceDescriptor(
  options: Omit<
    CreatePreparedMaterialResourceDescriptorOptions,
    "expectedMaterialFamily"
  >,
): CreatePreparedMaterialResourceDescriptorResult {
  return createPreparedMaterialResourceDescriptor({
    ...options,
    expectedMaterialFamily: "standard",
  });
}

export function createDebugNormalPreparedMaterialResourceDescriptor(
  options: Omit<
    CreatePreparedMaterialResourceDescriptorOptions,
    "expectedMaterialFamily"
  >,
): CreatePreparedMaterialResourceDescriptorResult {
  return createPreparedMaterialResourceDescriptor({
    ...options,
    expectedMaterialFamily: "debug-normal",
  });
}

export function preparedMaterialResourceKey(sourceMaterialKey: string): string {
  return `prepared-material:${sourceMaterialKey}`;
}

export function preparedMaterialBindGroupResourceKey(input: {
  readonly sourceMaterialKey: string;
  readonly pipelineKey: string;
}): string {
  return `prepared-material-bind-group:${input.sourceMaterialKey}|pipeline:${input.pipelineKey}`;
}

function collectMaterialDependencyKeys(
  material: MaterialAsset,
): readonly string[] {
  const dependencyKeys: string[] = [];
  const seen = new Set<string>();

  for (const [, binding] of materialTextureBindings(material)) {
    appendDependencyKey(binding.texture, dependencyKeys, seen);
    appendDependencyKey(binding.sampler, dependencyKeys, seen);
  }

  return dependencyKeys;
}

function collectTextureBindingResources(
  material: MaterialAsset,
): readonly PreparedMaterialTextureBindingResource[] {
  const resources: PreparedMaterialTextureBindingResource[] = [];

  for (const [field, binding] of materialTextureBindings(material)) {
    if (binding.texture === null || binding.sampler === null) {
      continue;
    }

    resources.push({
      field,
      textureKey: assetHandleKey(binding.texture),
      samplerKey: assetHandleKey(binding.sampler),
      ...(binding.texCoord === undefined ? {} : { texCoord: binding.texCoord }),
    });
  }

  return resources;
}

function appendDependencyKey(
  handle: AssetHandle | null,
  dependencyKeys: string[],
  seen: Set<string>,
): void {
  if (handle === null) {
    return;
  }

  const key = assetHandleKey(handle);

  if (!seen.has(key)) {
    seen.add(key);
    dependencyKeys.push(key);
  }
}
