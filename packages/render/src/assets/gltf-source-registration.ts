import {
  assetHandleKey,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
  type AssetRegistry,
} from "@aperture-engine/simulation";

import type {
  GltfPlannedMaterialAsset,
  GltfPlannedSamplerAsset,
  GltfPlannedTextureAsset,
} from "./gltf-asset-mapping.js";
import {
  assetDiagnosticsFromGltfMappingDiagnostics,
  findGltfPlannedTextureForSampler,
  gltfMaterialDependencyHandles,
  materialIdFromGltfPlannedHandleKey,
} from "./gltf-source-registration-dependencies.js";
import {
  createGltfSourceAssetRegistrationReport,
  gltfSourceAssetRegistrationReportToJson,
  gltfSourceAssetRegistrationReportToJsonValue,
} from "./gltf-source-registration-report.js";
import {
  skipAllGltfSourceAssetsForInvalidRoot,
  skipDuplicateGltfSourceAsset,
  skipGltfSourceAssetRegistration,
} from "./gltf-source-registration-skips.js";
import type {
  GltfRegisteredSourceAsset,
  GltfSkippedSourceAsset,
  GltfSourceAssetRegistrationDiagnostic,
  GltfSourceAssetRegistrationOptions,
  GltfSourceAssetRegistrationReport,
} from "./gltf-source-registration-types.js";

export {
  gltfSourceAssetRegistrationReportToJson,
  gltfSourceAssetRegistrationReportToJsonValue,
};

export type * from "./gltf-source-registration-types.js";

export function registerGltfSourceAssetsFromMappingReport(
  options: GltfSourceAssetRegistrationOptions,
): GltfSourceAssetRegistrationReport {
  const diagnostics: GltfSourceAssetRegistrationDiagnostic[] = [];
  const written: GltfRegisteredSourceAsset[] = [];
  const skipped: GltfSkippedSourceAsset[] = [];

  if (!options.report.root.valid) {
    skipAllGltfSourceAssetsForInvalidRoot(options.report, diagnostics, skipped);
    return createGltfSourceAssetRegistrationReport({
      diagnostics,
      written,
      skipped,
    });
  }

  for (const texture of options.report.textures) {
    registerTexture({
      registry: options.registry,
      texture,
      diagnostics,
      written,
      skipped,
    });
  }

  for (const sampler of options.report.samplers) {
    registerSampler({
      registry: options.registry,
      sampler,
      texture: findGltfPlannedTextureForSampler(options.report, sampler),
      diagnostics,
      written,
      skipped,
    });
  }

  for (const material of options.report.materials) {
    registerMaterial({
      registry: options.registry,
      material,
      diagnostics,
      written,
      skipped,
    });
  }

  return createGltfSourceAssetRegistrationReport({
    diagnostics,
    written,
    skipped,
  });
}

function registerTexture(input: {
  readonly registry: AssetRegistry;
  readonly texture: GltfPlannedTextureAsset;
  readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
  readonly written: GltfRegisteredSourceAsset[];
  readonly skipped: GltfSkippedSourceAsset[];
}): void {
  const handle = createTextureHandle(input.texture.handleKey);
  const registeredHandleKey = assetHandleKey(handle);

  if (!input.texture.report.valid || input.texture.texture === null) {
    skipGltfSourceAssetRegistration({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      entry: {
        kind: "texture",
        plannedHandleKey: input.texture.handleKey,
        registeredHandleKey,
        textureIndex: input.texture.textureIndex,
        slot: input.texture.slot,
      },
      code: "gltfRegistration.invalidPlannedAsset",
      message: `Texture '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
    });
    return;
  }

  const existingEntry = input.registry.get(handle);

  if (existingEntry !== undefined && existingEntry.status !== "loading") {
    skipDuplicateGltfSourceAsset({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      kind: "texture",
      plannedHandleKey: input.texture.handleKey,
      registeredHandleKey,
      textureIndex: input.texture.textureIndex,
      slot: input.texture.slot,
    });
    return;
  }

  const registryDiagnostics = assetDiagnosticsFromGltfMappingDiagnostics(
    input.texture.report.diagnostics,
  );
  if (existingEntry === undefined) {
    input.registry.register<"texture", typeof input.texture.texture>(handle, {
      label: input.texture.texture.label,
      diagnostics: registryDiagnostics,
    });
  }
  input.registry.markReady(handle, input.texture.texture, registryDiagnostics);
  input.written.push({
    kind: "texture",
    plannedHandleKey: input.texture.handleKey,
    registeredHandleKey,
    textureIndex: input.texture.textureIndex,
    slot: input.texture.slot,
    diagnostics: registryDiagnostics,
  });
}

function registerSampler(input: {
  readonly registry: AssetRegistry;
  readonly sampler: GltfPlannedSamplerAsset;
  readonly texture: GltfPlannedTextureAsset | undefined;
  readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
  readonly written: GltfRegisteredSourceAsset[];
  readonly skipped: GltfSkippedSourceAsset[];
}): void {
  const handle = createSamplerHandle(input.sampler.handleKey);
  const registeredHandleKey = assetHandleKey(handle);

  if (
    input.texture === undefined ||
    !input.texture.report.valid ||
    input.sampler.sampler === null
  ) {
    skipGltfSourceAssetRegistration({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      entry: {
        kind: "sampler",
        plannedHandleKey: input.sampler.handleKey,
        registeredHandleKey,
        textureIndex: input.sampler.textureIndex,
        slot: input.sampler.slot,
      },
      code: "gltfRegistration.invalidPlannedAsset",
      message: `Sampler '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
    });
    return;
  }

  if (input.registry.has(handle)) {
    skipDuplicateGltfSourceAsset({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      kind: "sampler",
      plannedHandleKey: input.sampler.handleKey,
      registeredHandleKey,
      textureIndex: input.sampler.textureIndex,
      slot: input.sampler.slot,
    });
    return;
  }

  const registryDiagnostics = assetDiagnosticsFromGltfMappingDiagnostics(
    input.texture.report.diagnostics,
  );
  input.registry.register<"sampler", typeof input.sampler.sampler>(handle, {
    label: input.sampler.sampler.label,
    diagnostics: registryDiagnostics,
  });
  input.registry.markReady(handle, input.sampler.sampler, registryDiagnostics);
  input.written.push({
    kind: "sampler",
    plannedHandleKey: input.sampler.handleKey,
    registeredHandleKey,
    textureIndex: input.sampler.textureIndex,
    slot: input.sampler.slot,
    diagnostics: registryDiagnostics,
  });
}

function registerMaterial(input: {
  readonly registry: AssetRegistry;
  readonly material: GltfPlannedMaterialAsset;
  readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
  readonly written: GltfRegisteredSourceAsset[];
  readonly skipped: GltfSkippedSourceAsset[];
}): void {
  const handle = createMaterialHandle(
    materialIdFromGltfPlannedHandleKey(input.material.handleKey),
  );
  const registeredHandleKey = assetHandleKey(handle);

  if (!input.material.report.valid || input.material.material === null) {
    skipGltfSourceAssetRegistration({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      entry: {
        kind: "material",
        plannedHandleKey: input.material.handleKey,
        registeredHandleKey,
        materialIndex: input.material.materialIndex,
      },
      code: "gltfRegistration.invalidPlannedAsset",
      message: `Material '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
    });
    return;
  }

  if (input.registry.has(handle)) {
    skipDuplicateGltfSourceAsset({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      kind: "material",
      plannedHandleKey: input.material.handleKey,
      registeredHandleKey,
      materialIndex: input.material.materialIndex,
    });
    return;
  }

  const dependencies = gltfMaterialDependencyHandles(input.material.material);
  const missingDependency = dependencies.find(
    (dependency) => !input.registry.has(dependency),
  );
  if (missingDependency !== undefined) {
    const dependencyKey = assetHandleKey(missingDependency);
    skipGltfSourceAssetRegistration({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      entry: {
        kind: "material",
        plannedHandleKey: input.material.handleKey,
        registeredHandleKey,
        materialIndex: input.material.materialIndex,
        dependencyKey,
      },
      code: "gltfRegistration.missingDependency",
      message: `Material '${registeredHandleKey}' was not registered because dependency '${dependencyKey}' is missing.`,
    });
    return;
  }

  const registryDiagnostics = assetDiagnosticsFromGltfMappingDiagnostics(
    input.material.report.diagnostics,
  );
  input.registry.register<"material", typeof input.material.material>(handle, {
    label: input.material.material.label,
    dependencies,
    diagnostics: registryDiagnostics,
  });
  input.registry.markReady(
    handle,
    input.material.material,
    registryDiagnostics,
  );
  input.written.push({
    kind: "material",
    plannedHandleKey: input.material.handleKey,
    registeredHandleKey,
    materialIndex: input.material.materialIndex,
    dependencyHandleKeys: dependencies.map((dependency) =>
      assetHandleKey(dependency),
    ),
    diagnostics: registryDiagnostics,
  });
}
