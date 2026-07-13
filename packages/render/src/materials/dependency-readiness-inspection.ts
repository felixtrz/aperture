import {
  assetHandleKey,
  createRenderTargetHandle,
  type AssetHandle,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  MaterialAssetDependencyReadinessDiagnostic,
  MaterialAssetDependencyReadinessDiagnosticCode,
  MaterialAssetDependencyReadinessStatus,
  MaterialAssetDependencySlotReadiness,
  MaterialDependencyKind,
} from "./dependency-readiness-types.js";
import { isRenderTargetAsset } from "../assets/render-target-asset.js";

export interface InspectMaterialDependencySlotInput {
  readonly registry: AssetRegistry;
  readonly materialKey: string;
  readonly field: string;
  readonly dependencyKind: MaterialDependencyKind;
  readonly handle: AssetHandle | null;
  readonly textureKey: string | undefined;
  readonly samplerKey: string | undefined;
  readonly slots: MaterialAssetDependencySlotReadiness[];
  readonly diagnostics: MaterialAssetDependencyReadinessDiagnostic[];
}

export function inspectMaterialDependencySlot(
  input: InspectMaterialDependencySlotInput,
): void {
  if (input.handle === null) {
    input.slots.push({
      field: input.field,
      dependency: input.dependencyKind,
      dependencyKind: input.dependencyKind,
      handleKey: null,
      status: "missing",
      ready: false,
    });
    input.diagnostics.push({
      code: missingHandleDiagnosticCode(input.dependencyKind),
      materialKey: input.materialKey,
      field: input.field,
      dependencyKind: input.dependencyKind,
      ...(input.textureKey === undefined
        ? {}
        : { textureKey: input.textureKey }),
      ...(input.samplerKey === undefined
        ? {}
        : { samplerKey: input.samplerKey }),
      status: "missing",
      message: `${input.field} is missing a ${input.dependencyKind} handle.`,
    });
    return;
  }

  const dependencyKey = assetHandleKey(input.handle);
  const entry = input.registry.get(input.handle);
  let status: MaterialAssetDependencyReadinessStatus =
    entry?.status ?? "missing";

  // B1: a texture dependency with no texture source asset is satisfied by a
  // ready, sampleable facade render target registered under the same id (the
  // renderer serves the realized target color texture for the binding).
  if (
    status !== "ready" &&
    input.dependencyKind === "texture" &&
    input.handle.kind === "texture" &&
    renderTargetSatisfiesTextureDependency(input.registry, input.handle.id)
  ) {
    status = "ready";
  }

  input.slots.push({
    field: input.field,
    dependency: input.dependencyKind,
    dependencyKind: input.dependencyKind,
    handleKey: dependencyKey,
    status,
    ready: status === "ready",
  });

  if (status === "ready") {
    return;
  }

  input.diagnostics.push({
    code: materialDependencyDiagnosticCode(input.dependencyKind, status),
    materialKey: input.materialKey,
    field: input.field,
    dependencyKind: input.dependencyKind,
    dependencyKey,
    ...(input.textureKey === undefined ? {} : { textureKey: input.textureKey }),
    ...(input.samplerKey === undefined ? {} : { samplerKey: input.samplerKey }),
    status,
    message: `${input.field} ${input.dependencyKind} dependency '${dependencyKey}' is '${status}'.`,
  });
}

function renderTargetSatisfiesTextureDependency(
  registry: AssetRegistry,
  id: string,
): boolean {
  const entry = registry.get(createRenderTargetHandle(id));

  return (
    entry !== undefined &&
    entry.status === "ready" &&
    isRenderTargetAsset(entry.asset) &&
    entry.asset.sampleable
  );
}

function missingHandleDiagnosticCode(
  dependencyKind: MaterialDependencyKind,
): MaterialAssetDependencyReadinessDiagnosticCode {
  switch (dependencyKind) {
    case "texture":
      return "materialDependency.missingTextureHandle";
    case "sampler":
      return "materialDependency.missingSamplerHandle";
    case "shader":
      return "materialDependency.missingShaderHandle";
    case "buffer":
      return "materialDependency.missingBufferHandle";
  }
}

function materialDependencyDiagnosticCode(
  dependencyKind: MaterialDependencyKind,
  status: MaterialAssetDependencyReadinessStatus,
): MaterialAssetDependencyReadinessDiagnosticCode {
  switch (status) {
    case "missing":
      return "materialDependency.dependencyMissing";
    case "registered":
      return "materialDependency.dependencyRegistered";
    case "loading":
      return "materialDependency.dependencyLoading";
    case "failed":
      return "materialDependency.dependencyFailed";
    case "ready":
      throw new Error(
        `Ready ${dependencyKind} dependencies do not produce diagnostics.`,
      );
  }
}
