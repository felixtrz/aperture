import {
  assetHandleKey,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

import type { GltfMaterialTextureSlot } from "../materials/index.js";
import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import { materialIdFromGltfPlannedHandleKey } from "./gltf-source-registration-dependencies.js";
import type {
  GltfSkippedSourceAsset,
  GltfSourceAssetRegistrationDiagnostic,
  GltfSourceAssetRegistrationDiagnosticCode,
  GltfSourceAssetRegistrationKind,
} from "./gltf-source-registration-types.js";

export function skipAllGltfSourceAssetsForInvalidRoot(
  report: GltfAssetMappingReport,
  diagnostics: GltfSourceAssetRegistrationDiagnostic[],
  skipped: GltfSkippedSourceAsset[],
): void {
  for (const texture of report.textures) {
    const handle = createTextureHandle(texture.handleKey);
    skipGltfSourceAssetRegistration({
      diagnostics,
      skipped,
      entry: {
        kind: "texture",
        plannedHandleKey: texture.handleKey,
        registeredHandleKey: assetHandleKey(handle),
        textureIndex: texture.textureIndex,
        slot: texture.slot,
      },
      code: "gltfRegistration.rootInvalid",
      message: `Texture '${assetHandleKey(handle)}' was not registered because the glTF root is invalid.`,
    });
  }

  for (const sampler of report.samplers) {
    const handle = createSamplerHandle(sampler.handleKey);
    skipGltfSourceAssetRegistration({
      diagnostics,
      skipped,
      entry: {
        kind: "sampler",
        plannedHandleKey: sampler.handleKey,
        registeredHandleKey: assetHandleKey(handle),
        textureIndex: sampler.textureIndex,
        slot: sampler.slot,
      },
      code: "gltfRegistration.rootInvalid",
      message: `Sampler '${assetHandleKey(handle)}' was not registered because the glTF root is invalid.`,
    });
  }

  for (const material of report.materials) {
    const handle = createMaterialHandle(
      materialIdFromGltfPlannedHandleKey(material.handleKey),
    );
    skipGltfSourceAssetRegistration({
      diagnostics,
      skipped,
      entry: {
        kind: "material",
        plannedHandleKey: material.handleKey,
        registeredHandleKey: assetHandleKey(handle),
        materialIndex: material.materialIndex,
      },
      code: "gltfRegistration.rootInvalid",
      message: `Material '${assetHandleKey(handle)}' was not registered because the glTF root is invalid.`,
    });
  }
}

export function skipDuplicateGltfSourceAsset(input: {
  readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
  readonly skipped: GltfSkippedSourceAsset[];
  readonly kind: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
}): void {
  skipGltfSourceAssetRegistration({
    diagnostics: input.diagnostics,
    skipped: input.skipped,
    entry: {
      kind: input.kind,
      plannedHandleKey: input.plannedHandleKey,
      registeredHandleKey: input.registeredHandleKey,
      ...(input.materialIndex === undefined
        ? {}
        : { materialIndex: input.materialIndex }),
      ...(input.textureIndex === undefined
        ? {}
        : { textureIndex: input.textureIndex }),
      ...(input.slot === undefined ? {} : { slot: input.slot }),
    },
    code: "gltfRegistration.duplicateAssetKey",
    message: `Asset '${input.registeredHandleKey}' already exists and was not overwritten.`,
  });
}

export function skipGltfSourceAssetRegistration(input: {
  readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
  readonly skipped: GltfSkippedSourceAsset[];
  readonly entry: Omit<GltfSkippedSourceAsset, "diagnostics" | "reason"> & {
    readonly dependencyKey?: string;
  };
  readonly code: GltfSourceAssetRegistrationDiagnosticCode;
  readonly message: string;
}): void {
  const diagnostic: GltfSourceAssetRegistrationDiagnostic = {
    code: input.code,
    severity: "error",
    message: input.message,
    kind: input.entry.kind,
    plannedHandleKey: input.entry.plannedHandleKey,
    registeredHandleKey: input.entry.registeredHandleKey,
    ...(input.entry.materialIndex === undefined
      ? {}
      : { materialIndex: input.entry.materialIndex }),
    ...(input.entry.textureIndex === undefined
      ? {}
      : { textureIndex: input.entry.textureIndex }),
    ...(input.entry.samplerIndex === undefined
      ? {}
      : { samplerIndex: input.entry.samplerIndex }),
    ...(input.entry.slot === undefined ? {} : { slot: input.entry.slot }),
    ...(input.entry.dependencyKey === undefined
      ? {}
      : { dependencyKey: input.entry.dependencyKey }),
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    ...input.entry,
    reason: input.code,
    diagnostics: [diagnostic],
  });
}
