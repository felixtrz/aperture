import {
  assetHandleKey,
  createMaterialHandle,
  createSamplerHandle,
  createTextureHandle,
  type AssetDiagnostic,
  type AssetHandle,
  type AssetRegistry,
} from "@aperture-engine/simulation";

import { materialTextureBindings } from "../materials/bindings.js";
import type {
  GltfMaterialTextureSlot,
  MaterialAsset,
} from "../materials/index.js";
import type {
  GltfAssetMappingReport,
  GltfPlannedMaterialAsset,
  GltfPlannedSamplerAsset,
  GltfPlannedTextureAsset,
} from "./gltf-asset-mapping.js";

export type GltfSourceAssetRegistrationKind =
  | "texture"
  | "sampler"
  | "material";

export type GltfSourceAssetRegistrationDiagnosticSeverity = "error" | "warning";

export type GltfSourceAssetRegistrationDiagnosticCode =
  | "gltfRegistration.rootInvalid"
  | "gltfRegistration.duplicateAssetKey"
  | "gltfRegistration.invalidPlannedAsset"
  | "gltfRegistration.missingDependency";

export interface GltfSourceAssetRegistrationDiagnostic {
  readonly code: GltfSourceAssetRegistrationDiagnosticCode;
  readonly severity: GltfSourceAssetRegistrationDiagnosticSeverity;
  readonly message: string;
  readonly kind?: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey?: string;
  readonly registeredHandleKey?: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly dependencyKey?: string;
}

export interface GltfRegisteredSourceAsset {
  readonly kind: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly dependencyHandleKeys?: readonly string[];
  readonly diagnostics: readonly AssetDiagnostic[];
}

export interface GltfSkippedSourceAsset {
  readonly kind: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly reason: GltfSourceAssetRegistrationDiagnosticCode;
  readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
}

export interface GltfSourceAssetRegistrationOptions {
  readonly registry: AssetRegistry;
  readonly report: GltfAssetMappingReport;
}

export interface GltfSourceAssetRegistrationReport {
  readonly valid: boolean;
  readonly written: readonly GltfRegisteredSourceAsset[];
  readonly skipped: readonly GltfSkippedSourceAsset[];
  readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
}

export type GltfSourceAssetRegistrationReportJsonValue =
  GltfSourceAssetRegistrationReport;

export function registerGltfSourceAssetsFromMappingReport(
  options: GltfSourceAssetRegistrationOptions,
): GltfSourceAssetRegistrationReport {
  const diagnostics: GltfSourceAssetRegistrationDiagnostic[] = [];
  const written: GltfRegisteredSourceAsset[] = [];
  const skipped: GltfSkippedSourceAsset[] = [];

  if (!options.report.root.valid) {
    skipAllForInvalidRoot(options.report, diagnostics, skipped);
    return result({ diagnostics, written, skipped });
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
      texture: findPlannedTexture(options.report, sampler),
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

  return result({ diagnostics, written, skipped });
}

export function gltfSourceAssetRegistrationReportToJsonValue(
  report: GltfSourceAssetRegistrationReport,
): GltfSourceAssetRegistrationReportJsonValue {
  return {
    valid: report.valid,
    written: report.written.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
      ...(entry.dependencyHandleKeys === undefined
        ? {}
        : { dependencyHandleKeys: [...entry.dependencyHandleKeys] }),
    })),
    skipped: report.skipped.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfSourceAssetRegistrationReportToJson(
  report: GltfSourceAssetRegistrationReport,
): string {
  return JSON.stringify(gltfSourceAssetRegistrationReportToJsonValue(report));
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
    skip({
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
    skipDuplicate({
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

  const registryDiagnostics = assetDiagnosticsFromMappingDiagnostics(
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
    skip({
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
    skipDuplicate({
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

  const registryDiagnostics = assetDiagnosticsFromMappingDiagnostics(
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
    materialIdFromPlannedHandleKey(input.material.handleKey),
  );
  const registeredHandleKey = assetHandleKey(handle);

  if (!input.material.report.valid || input.material.material === null) {
    skip({
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
    skipDuplicate({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      kind: "material",
      plannedHandleKey: input.material.handleKey,
      registeredHandleKey,
      materialIndex: input.material.materialIndex,
    });
    return;
  }

  const dependencies = materialDependencyHandles(input.material.material);
  const missingDependency = dependencies.find(
    (dependency) => !input.registry.has(dependency),
  );
  if (missingDependency !== undefined) {
    const dependencyKey = assetHandleKey(missingDependency);
    skip({
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

  const registryDiagnostics = assetDiagnosticsFromMappingDiagnostics(
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

function skipAllForInvalidRoot(
  report: GltfAssetMappingReport,
  diagnostics: GltfSourceAssetRegistrationDiagnostic[],
  skipped: GltfSkippedSourceAsset[],
): void {
  for (const texture of report.textures) {
    const handle = createTextureHandle(texture.handleKey);
    skip({
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
    skip({
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
      materialIdFromPlannedHandleKey(material.handleKey),
    );
    skip({
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

function skipDuplicate(input: {
  readonly diagnostics: GltfSourceAssetRegistrationDiagnostic[];
  readonly skipped: GltfSkippedSourceAsset[];
  readonly kind: GltfSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
}): void {
  skip({
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

function skip(input: {
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

function materialDependencyHandles(
  material: MaterialAsset,
): readonly AssetHandle[] {
  const dependencies: AssetHandle[] = [];
  const seen = new Set<string>();

  for (const [, binding] of materialTextureBindings(material)) {
    appendDependency(dependencies, seen, binding.texture);
    appendDependency(dependencies, seen, binding.sampler);
  }

  return dependencies;
}

function appendDependency(
  dependencies: AssetHandle[],
  seen: Set<string>,
  handle: AssetHandle | null,
): void {
  if (handle === null) {
    return;
  }

  const key = assetHandleKey(handle);
  if (!seen.has(key)) {
    seen.add(key);
    dependencies.push(handle);
  }
}

function findPlannedTexture(
  report: GltfAssetMappingReport,
  sampler: GltfPlannedSamplerAsset,
): GltfPlannedTextureAsset | undefined {
  return report.textures.find(
    (texture) =>
      texture.textureIndex === sampler.textureIndex &&
      texture.slot === sampler.slot,
  );
}

function assetDiagnosticsFromMappingDiagnostics(
  diagnostics: readonly {
    readonly code: string;
    readonly message: string;
    readonly severity: "error" | "warning";
  }[],
): readonly AssetDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
  }));
}

function materialIdFromPlannedHandleKey(handleKey: string): string {
  const prefix = "material:";
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}

function result(input: {
  readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
  readonly written: readonly GltfRegisteredSourceAsset[];
  readonly skipped: readonly GltfSkippedSourceAsset[];
}): GltfSourceAssetRegistrationReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    written: input.written,
    skipped: input.skipped,
    diagnostics: input.diagnostics,
  };
}
