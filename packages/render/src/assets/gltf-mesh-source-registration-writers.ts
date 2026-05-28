import {
  assetHandleKey,
  createMeshHandle,
  type AssetDiagnostic,
  type AssetHandle,
  type AssetRegistry,
} from "@aperture-engine/simulation";

import type {
  GltfMeshAssetConstructionDiagnostic,
  GltfMeshAssetConstructionReport,
  GltfPlannedMeshSourceAsset,
} from "./gltf-mesh-asset-construction.js";
import type {
  GltfMeshSourceAssetRegistrationDiagnostic,
  GltfMeshSourceAssetRegistrationDiagnosticCode,
  GltfRegisteredMeshSourceAsset,
  GltfSkippedMeshSourceAsset,
} from "./gltf-mesh-source-registration.js";
import type { MeshAsset } from "../mesh/index.js";

export function registerGltfPlannedMeshSourceAsset(input: {
  readonly registry: AssetRegistry;
  readonly report: GltfMeshAssetConstructionReport;
  readonly mesh: GltfPlannedMeshSourceAsset;
  readonly diagnostics: GltfMeshSourceAssetRegistrationDiagnostic[];
  readonly written: GltfRegisteredMeshSourceAsset[];
  readonly skipped: GltfSkippedMeshSourceAsset[];
}): void {
  const handle = createHandle(input.mesh, input.diagnostics, input.skipped);

  if (handle === null) {
    return;
  }

  const registeredHandleKey = assetHandleKey(handle);

  if (input.mesh.mesh === null) {
    skip({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      mesh: input.mesh,
      registeredHandleKey,
      code: "gltfMeshRegistration.invalidPlannedAsset",
      message: `Mesh '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
    });
    return;
  }

  if (input.registry.has(handle)) {
    skip({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      mesh: input.mesh,
      registeredHandleKey,
      code: "gltfMeshRegistration.duplicateAssetKey",
      message: `Mesh '${registeredHandleKey}' already exists and was not overwritten.`,
    });
    return;
  }

  const registryDiagnostics = assetDiagnosticsForMesh(
    input.report.diagnostics,
    input.mesh,
  );
  input.registry.register<"mesh", MeshAsset>(handle, {
    label: input.mesh.mesh.label,
    diagnostics: registryDiagnostics,
  });
  input.registry.markReady(handle, input.mesh.mesh, registryDiagnostics);
  input.written.push({
    kind: "mesh",
    plannedHandleKey: input.mesh.handleKey,
    registeredHandleKey,
    meshIndex: input.mesh.meshIndex,
    primitiveIndex: input.mesh.primitiveIndex,
    diagnostics: registryDiagnostics,
  });
}

function createHandle(
  mesh: GltfPlannedMeshSourceAsset,
  diagnostics: GltfMeshSourceAssetRegistrationDiagnostic[],
  skipped: GltfSkippedMeshSourceAsset[],
): AssetHandle<"mesh"> | null {
  try {
    return createMeshHandle(meshIdFromPlannedHandleKey(mesh.handleKey));
  } catch {
    skip({
      diagnostics,
      skipped,
      mesh,
      registeredHandleKey: mesh.registeredHandleKey,
      code: "gltfMeshRegistration.invalidHandleKey",
      message: `Mesh '${mesh.registeredHandleKey}' was not registered because its planned handle key is invalid.`,
    });
    return null;
  }
}

function skip(input: {
  readonly diagnostics: GltfMeshSourceAssetRegistrationDiagnostic[];
  readonly skipped: GltfSkippedMeshSourceAsset[];
  readonly mesh: GltfPlannedMeshSourceAsset;
  readonly registeredHandleKey: string;
  readonly code: GltfMeshSourceAssetRegistrationDiagnosticCode;
  readonly message: string;
}): void {
  const diagnostic: GltfMeshSourceAssetRegistrationDiagnostic = {
    code: input.code,
    severity: "error",
    message: input.message,
    kind: "mesh",
    plannedHandleKey: input.mesh.handleKey,
    registeredHandleKey: input.registeredHandleKey,
    meshIndex: input.mesh.meshIndex,
    primitiveIndex: input.mesh.primitiveIndex,
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    kind: "mesh",
    plannedHandleKey: input.mesh.handleKey,
    registeredHandleKey: input.registeredHandleKey,
    meshIndex: input.mesh.meshIndex,
    primitiveIndex: input.mesh.primitiveIndex,
    reason: input.code,
    diagnostics: [diagnostic],
  });
}

function assetDiagnosticsForMesh(
  diagnostics: readonly GltfMeshAssetConstructionDiagnostic[],
  mesh: GltfPlannedMeshSourceAsset,
): readonly AssetDiagnostic[] {
  return diagnostics
    .filter((diagnostic) => diagnosticMatchesMesh(diagnostic, mesh))
    .map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
    }));
}

function diagnosticMatchesMesh(
  diagnostic: GltfMeshAssetConstructionDiagnostic,
  mesh: GltfPlannedMeshSourceAsset,
): boolean {
  if (
    diagnostic.meshIndex !== undefined &&
    diagnostic.meshIndex !== mesh.meshIndex
  ) {
    return false;
  }

  if (
    diagnostic.primitiveIndex !== undefined &&
    diagnostic.primitiveIndex !== mesh.primitiveIndex
  ) {
    return false;
  }

  if (
    diagnostic.meshHandleKey !== undefined &&
    diagnostic.meshHandleKey !== mesh.handleKey &&
    diagnostic.meshHandleKey !== mesh.registeredHandleKey
  ) {
    return false;
  }

  return (
    diagnostic.meshIndex !== undefined ||
    diagnostic.primitiveIndex !== undefined ||
    diagnostic.meshHandleKey !== undefined
  );
}

function meshIdFromPlannedHandleKey(handleKey: string): string {
  const prefix = "mesh:";
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}
