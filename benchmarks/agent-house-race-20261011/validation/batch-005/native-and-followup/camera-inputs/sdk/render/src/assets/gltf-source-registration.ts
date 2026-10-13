import { findGltfPlannedTextureForSampler } from "./gltf-source-registration-dependencies.js";
import {
  createGltfSourceAssetRegistrationReport,
  gltfSourceAssetRegistrationReportToJson,
  gltfSourceAssetRegistrationReportToJsonValue,
} from "./gltf-source-registration-report.js";
import { skipAllGltfSourceAssetsForInvalidRoot } from "./gltf-source-registration-skips.js";
import type {
  GltfRegisteredSourceAsset,
  GltfSkippedSourceAsset,
  GltfSourceAssetRegistrationDiagnostic,
  GltfSourceAssetRegistrationOptions,
  GltfSourceAssetRegistrationReport,
} from "./gltf-source-registration-types.js";
import {
  registerGltfPlannedMaterialAsset,
  registerGltfPlannedSamplerAsset,
  registerGltfPlannedTextureAsset,
} from "./gltf-source-registration-writers.js";

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
    registerGltfPlannedTextureAsset({
      registry: options.registry,
      texture,
      diagnostics,
      written,
      skipped,
    });
  }

  for (const sampler of options.report.samplers) {
    registerGltfPlannedSamplerAsset({
      registry: options.registry,
      sampler,
      texture: findGltfPlannedTextureForSampler(options.report, sampler),
      diagnostics,
      written,
      skipped,
    });
  }

  for (const material of options.report.materials) {
    registerGltfPlannedMaterialAsset({
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
