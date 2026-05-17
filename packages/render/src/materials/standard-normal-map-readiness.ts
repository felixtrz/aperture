import type { MeshAsset, MeshVertexSemantic } from "../mesh/index.js";
import type { MaterialAsset, StandardMaterialAsset } from "./types.js";

export type StandardMaterialNormalMapTangentDiagnosticCode =
  | "standardNormalMap.unsupportedMaterialKind"
  | "standardNormalMap.missingTangents";

export interface StandardMaterialNormalMapTangentDiagnostic {
  readonly code: StandardMaterialNormalMapTangentDiagnosticCode;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly meshKey?: string;
  readonly materialKey?: string;
}

export interface StandardMaterialNormalMapTangentReadinessReport {
  readonly ready: boolean;
  readonly materialKind: MaterialAsset["kind"];
  readonly normalMapAuthored: boolean;
  readonly requiresTangents: boolean;
  readonly hasTangents: boolean;
  readonly meshSemantics: readonly MeshVertexSemantic[];
  readonly diagnostics: readonly StandardMaterialNormalMapTangentDiagnostic[];
}

export interface StandardMaterialNormalMapTangentReadinessOptions {
  readonly mesh: MeshAsset;
  readonly material: MaterialAsset;
  readonly meshKey?: string;
  readonly materialKey?: string;
}

export type StandardMaterialNormalMapTangentReadinessReportJsonValue =
  StandardMaterialNormalMapTangentReadinessReport;

export function createStandardMaterialNormalMapTangentReadinessReport(
  options: StandardMaterialNormalMapTangentReadinessOptions,
): StandardMaterialNormalMapTangentReadinessReport {
  const meshSemantics = uniqueMeshSemantics(options.mesh);
  const hasTangents = meshSemantics.includes("TANGENT");

  if (options.material.kind !== "standard") {
    return {
      ready: false,
      materialKind: options.material.kind,
      normalMapAuthored: false,
      requiresTangents: false,
      hasTangents,
      meshSemantics,
      diagnostics: [
        {
          code: "standardNormalMap.unsupportedMaterialKind",
          severity: "error",
          ...(options.meshKey === undefined
            ? {}
            : { meshKey: options.meshKey }),
          ...(options.materialKey === undefined
            ? {}
            : { materialKey: options.materialKey }),
          message: `Standard normal-map tangent readiness requires a StandardMaterial, not '${options.material.kind}'.`,
        },
      ],
    };
  }

  return createStandardReadinessReport({
    meshSemantics,
    hasTangents,
    material: options.material,
    ...(options.meshKey === undefined ? {} : { meshKey: options.meshKey }),
    ...(options.materialKey === undefined
      ? {}
      : { materialKey: options.materialKey }),
  });
}

export function standardMaterialNormalMapTangentReadinessReportToJsonValue(
  report: StandardMaterialNormalMapTangentReadinessReport,
): StandardMaterialNormalMapTangentReadinessReportJsonValue {
  return {
    ...report,
    meshSemantics: [...report.meshSemantics],
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialNormalMapTangentReadinessReportToJson(
  report: StandardMaterialNormalMapTangentReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialNormalMapTangentReadinessReportToJsonValue(report),
  );
}

function createStandardReadinessReport(input: {
  readonly meshSemantics: readonly MeshVertexSemantic[];
  readonly hasTangents: boolean;
  readonly material: StandardMaterialAsset;
  readonly meshKey?: string;
  readonly materialKey?: string;
}): StandardMaterialNormalMapTangentReadinessReport {
  const normalMapAuthored = input.material.normalTexture !== null;
  const requiresTangents = normalMapAuthored;
  const diagnostics: StandardMaterialNormalMapTangentDiagnostic[] = [];

  if (requiresTangents && !input.hasTangents) {
    diagnostics.push({
      code: "standardNormalMap.missingTangents",
      severity: "warning",
      ...(input.meshKey === undefined ? {} : { meshKey: input.meshKey }),
      ...(input.materialKey === undefined
        ? {}
        : { materialKey: input.materialKey }),
      message:
        "StandardMaterial normalTexture requires mesh TANGENT vertex attributes before tangent-space normal mapping can render.",
    });
  }

  return {
    ready: diagnostics.length === 0,
    materialKind: input.material.kind,
    normalMapAuthored,
    requiresTangents,
    hasTangents: input.hasTangents,
    meshSemantics: input.meshSemantics,
    diagnostics,
  };
}

function uniqueMeshSemantics(mesh: MeshAsset): readonly MeshVertexSemantic[] {
  return [
    ...new Set(
      mesh.vertexStreams.flatMap((stream) =>
        stream.attributes.map((attribute) => attribute.semantic),
      ),
    ),
  ].sort();
}
