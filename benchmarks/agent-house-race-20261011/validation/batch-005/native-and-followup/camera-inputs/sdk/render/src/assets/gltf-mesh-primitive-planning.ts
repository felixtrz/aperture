import { assetHandleKey, createMeshHandle } from "@aperture-engine/simulation";

import {
  mapGltfMeshPrimitiveAttributes,
  mapGltfMeshPrimitiveIndexReference,
} from "./gltf-mesh-primitive-attributes.js";
import {
  inspectUnsupportedCompression,
  mapCompressedPrimitive,
} from "./gltf-mesh-primitive-compression.js";
import type {
  GltfMeshPrimitiveMappingDiagnostic,
  GltfMeshPrimitiveMappingOptions,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive-types.js";
import { toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";

const GLTF_MODE_TRIANGLES = 4;

export function planGltfMeshPrimitive(input: {
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
