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
import type { MeshAsset } from "../mesh/index.js";

export type GltfMeshSourceAssetRegistrationKind = "mesh";

export type GltfMeshSourceAssetRegistrationDiagnosticSeverity =
  | "error"
  | "warning";

export type GltfMeshSourceAssetRegistrationDiagnosticCode =
  | "gltfMeshRegistration.invalidConstructionReport"
  | "gltfMeshRegistration.invalidPlannedAsset"
  | "gltfMeshRegistration.duplicateAssetKey"
  | "gltfMeshRegistration.invalidHandleKey";

export interface GltfMeshSourceAssetRegistrationDiagnostic {
  readonly code: GltfMeshSourceAssetRegistrationDiagnosticCode;
  readonly severity: GltfMeshSourceAssetRegistrationDiagnosticSeverity;
  readonly message: string;
  readonly kind?: GltfMeshSourceAssetRegistrationKind;
  readonly plannedHandleKey?: string;
  readonly registeredHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
}

export interface GltfRegisteredMeshSourceAsset {
  readonly kind: GltfMeshSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: readonly AssetDiagnostic[];
}

export interface GltfSkippedMeshSourceAsset {
  readonly kind: GltfMeshSourceAssetRegistrationKind;
  readonly plannedHandleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly reason: GltfMeshSourceAssetRegistrationDiagnosticCode;
  readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
}

export interface GltfMeshSourceAssetRegistrationOptions {
  readonly registry: AssetRegistry;
  readonly report: GltfMeshAssetConstructionReport;
}

export interface GltfMeshSourceAssetRegistrationReport {
  readonly valid: boolean;
  readonly written: readonly GltfRegisteredMeshSourceAsset[];
  readonly skipped: readonly GltfSkippedMeshSourceAsset[];
  readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
}

export type GltfMeshSourceAssetRegistrationReportJsonValue =
  GltfMeshSourceAssetRegistrationReport;

export function registerGltfMeshSourceAssetsFromConstructionReport(
  options: GltfMeshSourceAssetRegistrationOptions,
): GltfMeshSourceAssetRegistrationReport {
  const diagnostics: GltfMeshSourceAssetRegistrationDiagnostic[] = [];
  const written: GltfRegisteredMeshSourceAsset[] = [];
  const skipped: GltfSkippedMeshSourceAsset[] = [];

  if (!options.report.valid && options.report.meshes.length === 0) {
    diagnostics.push({
      code: "gltfMeshRegistration.invalidConstructionReport",
      severity: "error",
      message:
        "No mesh source assets were registered because the construction report is invalid.",
    });
    return result({ diagnostics, written, skipped });
  }

  for (const mesh of options.report.meshes) {
    registerMesh({
      registry: options.registry,
      report: options.report,
      mesh,
      diagnostics,
      written,
      skipped,
    });
  }

  return result({ diagnostics, written, skipped });
}

export function gltfMeshSourceAssetRegistrationReportToJsonValue(
  report: GltfMeshSourceAssetRegistrationReport,
): GltfMeshSourceAssetRegistrationReportJsonValue {
  return {
    valid: report.valid,
    written: report.written.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    skipped: report.skipped.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMeshSourceAssetRegistrationReportToJson(
  report: GltfMeshSourceAssetRegistrationReport,
): string {
  return JSON.stringify(
    gltfMeshSourceAssetRegistrationReportToJsonValue(report),
  );
}

function registerMesh(input: {
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

function result(input: {
  readonly diagnostics: readonly GltfMeshSourceAssetRegistrationDiagnostic[];
  readonly written: readonly GltfRegisteredMeshSourceAsset[];
  readonly skipped: readonly GltfSkippedMeshSourceAsset[];
}): GltfMeshSourceAssetRegistrationReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    written: input.written,
    skipped: input.skipped,
    diagnostics: input.diagnostics,
  };
}
