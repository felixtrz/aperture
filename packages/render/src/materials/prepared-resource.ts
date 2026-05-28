import { assetHandleKey } from "@aperture-engine/simulation";
import {
  createMaterialDependencyReadinessReport,
  materialDependencyReadinessReportToJsonValue,
} from "./dependency-readiness.js";
import {
  createMaterialPipelineKeyInput,
  materialPipelineKeyInputToKey,
} from "./pipeline-key.js";
import type { MaterialAsset } from "./types.js";
import {
  collectMaterialDependencyKeys,
  collectTextureBindingResources,
} from "./prepared-resource-dependencies.js";
import type {
  CreatePreparedMaterialResourceDescriptorOptions,
  CreatePreparedMaterialResourceDescriptorResult,
} from "./prepared-resource-types.js";
import { validateMaterialAsset } from "./validation.js";

export type {
  CreatePreparedMaterialResourceDescriptorOptions,
  CreatePreparedMaterialResourceDescriptorResult,
  PreparedMaterialResourceDescriptor,
  PreparedMaterialResourceDiagnostic,
  PreparedMaterialTextureBindingResource,
} from "./prepared-resource-types.js";

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
