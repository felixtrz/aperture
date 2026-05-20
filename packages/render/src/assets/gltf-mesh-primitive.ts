import { assetHandleKey, createMeshHandle } from "@aperture-engine/simulation";

import type { MeshAsset } from "../mesh/index.js";
import {
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
  type GltfRootValidationReportJsonValue,
} from "./gltf-root.js";

export type GltfMeshPrimitiveMappingDiagnosticSeverity = "error" | "warning";

export type GltfMeshPrimitiveMappingLayer = "root" | "mesh";

export type GltfMeshPrimitiveMappingDiagnosticCode =
  | "gltfMesh.malformedMeshes"
  | "gltfMesh.missingMesh"
  | "gltfMesh.malformedPrimitives"
  | "gltfMesh.missingPrimitive"
  | "gltfMesh.malformedPrimitive"
  | "gltfMesh.missingPosition"
  | "gltfMesh.invalidAccessorReference"
  | "gltfMesh.unsupportedPrimitiveMode"
  | "gltfMesh.unsupportedCompressedPrimitive"
  | "gltfMesh.unresolvedAccessorData";

export type GltfMeshPrimitiveDiagnosticValue = string | number | boolean | null;

export type GltfMeshPrimitiveAttributeSemantic =
  | "POSITION"
  | "NORMAL"
  | "TEXCOORD_0"
  | "TANGENT";

export interface GltfMeshPrimitiveMappingDiagnostic {
  readonly layer: GltfMeshPrimitiveMappingLayer;
  readonly code: string;
  readonly severity: GltfMeshPrimitiveMappingDiagnosticSeverity;
  readonly message: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly accessorIndex?: number;
  readonly attribute?: GltfMeshPrimitiveAttributeSemantic;
  readonly field?: string;
  readonly mode?: number;
  readonly extensionName?: string;
  readonly value?: GltfMeshPrimitiveDiagnosticValue;
}

export interface GltfMeshPrimitiveSelection {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
}

export interface GltfMeshPrimitiveMappingOptions {
  readonly root: unknown;
  readonly meshPrimitiveIndices?: readonly GltfMeshPrimitiveSelection[];
  readonly keyPrefix?: string;
}

export interface GltfMeshPrimitiveAttributeReference {
  readonly semantic: GltfMeshPrimitiveAttributeSemantic;
  readonly accessorIndex: number;
}

export interface GltfMeshPrimitiveAttributeReferences {
  readonly position: GltfMeshPrimitiveAttributeReference;
  readonly normal?: GltfMeshPrimitiveAttributeReference;
  readonly texcoord0?: GltfMeshPrimitiveAttributeReference;
  readonly tangent?: GltfMeshPrimitiveAttributeReference;
}

export interface GltfMeshPrimitiveIndexReference {
  readonly accessorIndex: number;
}

export interface GltfPlannedMeshPrimitiveAsset {
  readonly handleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly label: string;
  readonly topology: "triangle-list";
  readonly attributes: GltfMeshPrimitiveAttributeReferences;
  readonly indices: GltfMeshPrimitiveIndexReference | null;
  readonly materialIndex: number | null;
  readonly mesh: MeshAsset | null;
}

export interface GltfMeshPrimitiveMappingReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly meshes: readonly GltfPlannedMeshPrimitiveAsset[];
  readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
}

export interface GltfMeshAssetJsonSummary {
  readonly kind: "mesh";
  readonly label: string;
  readonly vertexStreams: number;
  readonly submeshes: number;
  readonly materialSlots: number;
  readonly indexFormat?: "uint16" | "uint32";
  readonly indexCount?: number;
  readonly hasLocalAabb: boolean;
  readonly hasLocalSphere: boolean;
}

export interface GltfPlannedMeshPrimitiveAssetJsonValue extends Omit<
  GltfPlannedMeshPrimitiveAsset,
  "mesh"
> {
  readonly mesh: GltfMeshAssetJsonSummary | null;
}

export interface GltfMeshPrimitiveMappingReportJsonValue {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly meshes: readonly GltfPlannedMeshPrimitiveAssetJsonValue[];
  readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
}

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
    return result({ root, diagnostics, meshes: [] });
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
    return result({ root, diagnostics, meshes: [] });
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

  return result({ root, diagnostics, meshes: plannedMeshes });
}

export function gltfMeshPrimitiveMappingReportToJsonValue(
  report: GltfMeshPrimitiveMappingReport,
): GltfMeshPrimitiveMappingReportJsonValue {
  return {
    valid: report.valid,
    root: report.root,
    meshes: report.meshes.map((mesh) => ({
      ...mesh,
      mesh: mesh.mesh === null ? null : meshAssetToJsonSummary(mesh.mesh),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMeshPrimitiveMappingReportToJson(
  report: GltfMeshPrimitiveMappingReport,
): string {
  return JSON.stringify(gltfMeshPrimitiveMappingReportToJsonValue(report));
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
  const attributes = mapAttributes(input);
  const indices = mapIndexReference(input);
  const materialIndex = mapMaterialIndex(input.primitive.material);

  const hasNewError = input.diagnostics
    .slice(errorCountBefore)
    .some((diagnostic) => diagnostic.severity === "error");
  if (topology === null || attributes === null || hasNewError) {
    return null;
  }

  input.diagnostics.push({
    layer: "mesh",
    code: "gltfMesh.unresolvedAccessorData",
    severity: "warning",
    meshIndex: input.meshIndex,
    primitiveIndex: input.primitiveIndex,
    message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} references accessors that have not been decoded; planned mesh source asset remains null.`,
  });

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
    materialIndex,
    mesh: null,
  };
}

function inspectUnsupportedCompression(input: {
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): void {
  const extensions = input.primitive.extensions;
  if (!isRecord(extensions)) {
    return;
  }

  for (const extensionName of [
    "KHR_draco_mesh_compression",
    "EXT_meshopt_compression",
  ]) {
    if (extensions[extensionName] !== undefined) {
      input.diagnostics.push({
        layer: "mesh",
        code: "gltfMesh.unsupportedCompressedPrimitive",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        extensionName,
        message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} uses unsupported compressed primitive extension '${extensionName}'.`,
      });
    }
  }
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

function mapAttributes(input: {
  readonly root: Record<string, unknown>;
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfMeshPrimitiveAttributeReferences | null {
  const attributes = input.primitive.attributes;
  if (!isRecord(attributes)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.missingPosition",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.POSITION`,
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must include a POSITION attribute.`,
    });
    return null;
  }

  const position = mapAttributeReference(input, attributes, "POSITION");
  if (position === null) {
    return null;
  }

  const normal = mapAttributeReference(input, attributes, "NORMAL");
  const texcoord0 = mapAttributeReference(input, attributes, "TEXCOORD_0");
  const tangent = mapAttributeReference(input, attributes, "TANGENT");
  const hasOptionalAttributeError = input.diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      diagnostic.meshIndex === input.meshIndex &&
      diagnostic.primitiveIndex === input.primitiveIndex &&
      (diagnostic.attribute === "NORMAL" ||
        diagnostic.attribute === "TEXCOORD_0" ||
        diagnostic.attribute === "TANGENT"),
  );
  if (hasOptionalAttributeError) {
    return null;
  }

  return {
    position,
    ...(normal === null ? {} : { normal }),
    ...(texcoord0 === null ? {} : { texcoord0 }),
    ...(tangent === null ? {} : { tangent }),
  };
}

function mapAttributeReference(
  input: {
    readonly root: Record<string, unknown>;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
  },
  attributes: Record<string, unknown>,
  semantic: GltfMeshPrimitiveAttributeSemantic,
): GltfMeshPrimitiveAttributeReference | null {
  const accessorIndex = attributes[semantic];
  if (accessorIndex === undefined) {
    if (semantic === "POSITION") {
      input.diagnostics.push({
        layer: "mesh",
        code: "gltfMesh.missingPosition",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        attribute: semantic,
        field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.POSITION`,
        message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must include a POSITION attribute.`,
      });
    }
    return null;
  }

  if (!validAccessorReference(input.root, accessorIndex)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidAccessorReference",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      attribute: semantic,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.${semantic}`,
      value: toDiagnosticValue(accessorIndex),
      ...(typeof accessorIndex === "number" ? { accessorIndex } : {}),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid ${semantic} accessor reference.`,
    });
    return null;
  }

  return { semantic, accessorIndex };
}

function mapIndexReference(input: {
  readonly root: Record<string, unknown>;
  readonly primitive: Record<string, unknown>;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMeshPrimitiveMappingDiagnostic[];
}): GltfMeshPrimitiveIndexReference | null {
  const accessorIndex = input.primitive.indices;
  if (accessorIndex === undefined) {
    return null;
  }

  if (!validAccessorReference(input.root, accessorIndex)) {
    input.diagnostics.push({
      layer: "mesh",
      code: "gltfMesh.invalidAccessorReference",
      severity: "error",
      meshIndex: input.meshIndex,
      primitiveIndex: input.primitiveIndex,
      field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].indices`,
      value: toDiagnosticValue(accessorIndex),
      ...(typeof accessorIndex === "number" ? { accessorIndex } : {}),
      message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid indices accessor reference.`,
    });
    return null;
  }

  return { accessorIndex };
}

function validAccessorReference(
  root: Record<string, unknown>,
  accessorIndex: unknown,
): accessorIndex is number {
  return (
    Number.isInteger(accessorIndex) &&
    typeof accessorIndex === "number" &&
    accessorIndex >= 0 &&
    Array.isArray(root.accessors) &&
    accessorIndex < root.accessors.length
  );
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

function result(input: {
  readonly root: GltfRootValidationReportJsonValue;
  readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
  readonly meshes: readonly GltfPlannedMeshPrimitiveAsset[];
}): GltfMeshPrimitiveMappingReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    root: input.root,
    meshes: input.meshes,
    diagnostics: input.diagnostics,
  };
}

function meshAssetToJsonSummary(mesh: MeshAsset): GltfMeshAssetJsonSummary {
  return {
    kind: "mesh",
    label: mesh.label,
    vertexStreams: mesh.vertexStreams.length,
    submeshes: mesh.submeshes.length,
    materialSlots: mesh.materialSlots.length,
    ...(mesh.indexBuffer === undefined
      ? {}
      : {
          indexFormat: mesh.indexBuffer.format,
          indexCount: mesh.indexBuffer.data.length,
        }),
    hasLocalAabb: mesh.localAabb !== undefined,
    hasLocalSphere: mesh.localSphere !== undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDiagnosticValue(value: unknown): GltfMeshPrimitiveDiagnosticValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "undefined":
      return "undefined";
    case "bigint":
    case "symbol":
    case "function":
    case "object":
      return Object.prototype.toString.call(value);
  }

  return String(value);
}
