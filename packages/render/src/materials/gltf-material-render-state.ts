import { createDefaultRenderState } from "./factories.js";
import { mapAlphaCutoff } from "./gltf-material-scalars.js";
import type { GltfMaterialMappingDiagnostic } from "./gltf-material-types.js";
import { toDiagnosticValue } from "./gltf-material-utils.js";
import type { RenderStateDescriptor } from "./types.js";

export function withTransmissionRenderState(
  renderState: RenderStateDescriptor,
  transmissionFactor: number,
): RenderStateDescriptor {
  if (transmissionFactor <= 0 || renderState.alphaMode !== "opaque") {
    return renderState;
  }

  return createDefaultRenderState({
    ...renderState,
    alphaMode: "blend",
    depth: { ...renderState.depth, write: false },
    blend: { preset: "alpha" },
  });
}

export function gltfRenderState(
  material: Record<string, unknown>,
  materialKey: string,
  diagnostics: GltfMaterialMappingDiagnostic[],
): RenderStateDescriptor {
  const alphaMode = material.alphaMode ?? "OPAQUE";
  const doubleSided = material.doubleSided ?? false;

  if (!["OPAQUE", "MASK", "BLEND"].includes(String(alphaMode))) {
    diagnostics.push({
      code: "gltfMaterial.invalidField",
      severity: "error",
      materialKey,
      field: "alphaMode",
      value: toDiagnosticValue(alphaMode),
      message: "alphaMode must be OPAQUE, MASK, or BLEND.",
    });
  }

  if (typeof doubleSided !== "boolean") {
    diagnostics.push({
      code: "gltfMaterial.invalidField",
      severity: "error",
      materialKey,
      field: "doubleSided",
      value: toDiagnosticValue(doubleSided),
      message: "doubleSided must be a boolean when present.",
    });
  }

  const alphaCutoff = mapAlphaCutoff({
    materialKey,
    field: "alphaCutoff",
    value: material.alphaCutoff,
    fallback: 0.5,
    diagnostics,
  });

  if (alphaMode === "BLEND") {
    return createDefaultRenderState({
      alphaMode: "blend",
      alphaCutoff,
      cullMode: doubleSided === true ? "none" : "back",
      depth: { test: true, write: false, compare: "less" },
      blend: { preset: "alpha" },
    });
  }

  if (alphaMode === "MASK") {
    return createDefaultRenderState({
      alphaMode: "mask",
      alphaCutoff,
      cullMode: doubleSided === true ? "none" : "back",
    });
  }

  return createDefaultRenderState({
    alphaMode: "opaque",
    alphaCutoff,
    cullMode: doubleSided === true ? "none" : "back",
  });
}
