import { assetHandleKey, createMeshHandle } from "@aperture-engine/simulation";

import {
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
} from "./gltf-root.js";
import {
  mapGltfMeshPrimitiveAttributes,
  mapGltfMeshPrimitiveIndexReference,
} from "./gltf-mesh-primitive-attributes.js";
import {
  inspectUnsupportedCompression,
  mapCompressedPrimitive,
} from "./gltf-mesh-primitive-compression.js";
import {
  createGltfMeshPrimitiveMappingReportResult,
  gltfMeshPrimitiveMappingReportToJson,
  gltfMeshPrimitiveMappingReportToJsonValue,
} from "./gltf-mesh-primitive-report.js";
import type {
  GltfMeshPrimitiveMappingDiagnostic,
  GltfMeshPrimitiveMappingOptions,
  GltfMeshPrimitiveMappingReport,
  GltfMeshPrimitiveSelection,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive-types.js";
import { isRecord, toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";

export {
  gltfMeshPrimitiveMappingReportToJson,
  gltfMeshPrimitiveMappingReportToJsonValue,
};

export type * from "./gltf-mesh-primitive-types.js";

interface PrimitiveReferenceResult {
  readonly primitive: Record<string, unknown> | null;
  readonly mesh: Record<string, unknown> | null;
  readonly fatal: boolean;
}

const GLTF_MODE_TRIANGLES = 4;

export function createGltfMeshPrimitiveMappingReport(
  options: GltfMeshPrimitiveMappingOptions,
): GltfMeshPrimitiveMappingReport {
  const rootValidation = validateGltfRootForAssetMapping(options.root);
  const root = gltfRootValidationReportToJsonValue(rootValidation);
  const diagnostics: GltfMeshPrimitiveMappingDiagnostic[] =
    rootValidation.diagnostics.map((diagnostic) => ({
      layer: "root" as const,
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
      ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
    }));

  if (!isRecord(options.root)) {
    return createGltfMeshPrimitiveMappingReportResult({
      root,
      diagnostics,
      meshes: [],
    });
  }

  const meshesField = options.root.meshes;
  if (meshesField !== undefined && !Array.isArray(meshesField)) {
    diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.malformedMeshes",
      severity: "error",
      field: "meshes",
      value: toDiagnosticValue(meshesField),
      message: "glTF meshes must be an array when present.",
    });
    return createGltfMeshPrimitiveMappingReportResult({
      root,
      diagnostics,
      meshes: [],
    });
  }

  const meshes = Array.isArray(meshesField) ? meshesField : [];
  const selections =
    options.meshPrimitiveIndices ?? allPrimitiveSelections(meshes);
  const plannedMeshes: GltfPlannedMeshPrimitiveAsset[] = [];

  for (const selection of selections) {
    const reference = resolvePrimitiveReference({
      meshes,
      meshIndex: selection.meshIndex,
      primitiveIndex: selection.primitiveIndex,
      diagnostics,
    });
    if (reference.fatal || reference.primitive === null) {
      continue;
    }

    const planned = planPrimitive({
      options,
      root: options.root,
      mesh: reference.mesh,
      primitive: reference.primitive,
      meshIndex: selection.meshIndex,
      primitiveIndex: selection.primitiveIndex,
      diagnostics,
    });
    if (planned !== null) {
      plannedMeshes.push(planned);
    }
  }

  return createGltfMeshPrimitiveMappingReportResult({
    root,
    diagnostics,
    meshes: plannedMeshes,
  });
}

function resolvePrimitiveReference(input: {
  readonly meshes: readonly unknown[];
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): PrimitiveReferenceResult {
  const mesh = input.meshes[input.meshIndex];
  if (!isRecord(mesh)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.missingMesh",
      severity: "error",
      meshIndex: input.meshIndex,
      message: `glTF mesh ${input.meshIndex} does not exist or is not an object.`,
    });
    return { primitive: null, mesh: null, fatal: true };
  }

  if (!Array.isArray(mesh.primitives)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.malformedPrimitives",
      severity: "error",
      meshIndex: input.meshIndex,
      field: `meshes[${input.meshIndex}].primitives`,
      value: toDiagnosticValue(mesh.primitives),
      message: `glTF mesh ${input.meshIndex} must include a primitives array.`,
    });
    return { primitive: null, mesh, fatal: true };
  }

  const primitive = mesh.primitives[input.primitiveIndex];
  if (primitive === undefined) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.missingPrimitive",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} does not exist.`,
    });
    return { primitive: null, mesh, fatal: true };
  }

  if (!isRecord(primitive)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.malformedPrimitive",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}]`,
      value: toDiagnosticValue(primitive),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must be an object.`,
    });
    return { primitive: null, mesh, fatal: true };
  }

  return { primitive, mesh, fatal: false };
}

function planPrimitive(input: {
  readonly options: GltfMeshPrimitiveMappingOptions;
  readonly root: Record<string, unknown>;
  readonly mesh: Record<string, unknown> | null;
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfPlannedMeshPrimitiveAsset | null {
  const errorCountBefore = input.diagnostics.length;

  inspectUnsupportedCompression(input);
  const topology = mapTopology(input);
  const attributes = mapGltfMeshPrimitiveAttributes(input);
  const compression =
    attributes === null ? null : mapCompressedPrimitive(input, attributes);
  const indices = mapGltfMeshPrimitiveIndexReference(input);
  const materialIndex = mapMaterialIndex(input.primitive.material);

  const hasNewError = input.diagnostics
    .slice(errorCountBefore)
    .some((diagnostic) => diagnostic.severity === "error");
  if (topology === null || attributes === null || hasNewError) {
    return null;
  }

  if (compression === null) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.unresolvedAccessorData",
      severity: "warning",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} references accessors that have not been decoded; planned mesh source asset remains null.`,
    });
  }

  const handleKey = plannedHandleKey(
    input.options,
    input.meshIndex,
    input.primitiveIndex,
  );
  return {
    handleKey,
    registeredHandleKey: assetHandleKey(createMeshHandle(handleKey)),
    meshIndex: input.meshIndex,
    primitiveIndex: input.primitiveIndex,
    label: primitiveLabel(input.mesh, input.meshIndex, input.primitiveIndex),
    topology,
    attributes,
    indices,
    compression,
    materialIndex,
    mesh: null,
  };
}

function mapTopology(input: {
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): "triangle-list" | null {
  const mode = input.primitive.mode;
  if (mode === undefined || mode === GLTF_MODE_TRIANGLES) {
    return "triangle-list";
  }

  input.diagnostics.push({
    layer: "mesh",
    code: "gltfMesh.unsupportedPrimitiveMode",
    severity: "warning",
    meshIndex: input.meshIndex,
    primitiveIndex: input.primitiveIndex,
    field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].mode`,
    ...(typeof mode === "number"
      ? { mode }
      : { value: toDiagnosticValue(mode) }),
    message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} uses unsupported primitive mode '${String(mode)}'; only TRIANGLES mode 4 is rendered by this mapper, so this primitive is skipped.`,
  });
  return null;
}

function mapMaterialIndex(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : null;
}

function allPrimitiveSelections(
  meshes: readonly unknown[],
): readonly GltfMeshPrimitiveSelection[] {
  const selections: GltfMeshPrimitiveSelection[] = [];
  for (const [meshIndex, mesh] of meshes.entries()) {
    if (!isRecord(mesh) || !Array.isArray(mesh.primitives)) {
      continue;
    }

    for (
      let primitiveIndex = 0;
      primitiveIndex < mesh.primitives.length;
      primitiveIndex += 1
    ) {
      selections.push({ meshIndex, primitiveIndex });
    }
  }
  return selections;
}

function plannedHandleKey(
  options: GltfMeshPrimitiveMappingOptions,
  meshIndex: number,
  primitiveIndex: number,
): string {
  return `${options.keyPrefix ?? "gltf"}:mesh:${meshIndex}:primitive:${primitiveIndex}`;
}

function primitiveLabel(
  mesh: Record<string, unknown> | null,
  meshIndex: number,
  primitiveIndex: number,
): string {
  return typeof mesh?.name === "string" && mesh.name.length > 0
    ? `${mesh.name}.primitive.${primitiveIndex}`
    : `gltf mesh ${meshIndex} primitive ${primitiveIndex}`;
}
