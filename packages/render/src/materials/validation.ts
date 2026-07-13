import { MAX_CLIP_PLANES } from "../rendering/clip-planes.js";
import { materialTextureBindings } from "./bindings.js";
import type {
  MaterialAsset,
  MaterialValidationDiagnostic,
  MaterialValidationReport,
  RenderStateDescriptor,
  StencilStateDescriptor,
  TextureAsset,
} from "./types.js";

export function validateMaterialAsset(
  material: MaterialAsset,
): MaterialValidationReport {
  const diagnostics: MaterialValidationDiagnostic[] = [];

  validateRenderState(material.renderState, diagnostics);

  for (const feature of material.unsupportedFeatures ?? []) {
    diagnostics.push({
      code: "material.unsupportedFeature",
      field: feature,
      message: `MVP materials do not support '${feature}'.`,
    });
  }

  for (const [field, binding] of materialTextureBindings(material)) {
    if (binding.texture === null) {
      diagnostics.push({
        code: "material.missingTextureHandle",
        field,
        message: `${field} is missing a texture handle.`,
      });
    }

    if (binding.sampler === null) {
      diagnostics.push({
        code: "material.missingSamplerHandle",
        field,
        message: `${field} is missing a sampler handle.`,
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

export function validateTextureAsset(
  texture: TextureAsset,
): MaterialValidationReport {
  const diagnostics: MaterialValidationDiagnostic[] = [];

  if (
    texture.colorSpace === "srgb" &&
    !["base-color", "emissive"].includes(texture.semantic)
  ) {
    diagnostics.push({
      code: "material.invalidTextureColorSpace",
      field: "colorSpace",
      message: `${texture.semantic} textures must use linear or data color space, not srgb.`,
    });
  }

  if (textureFormatIsSrgb(texture.format) !== (texture.colorSpace === "srgb")) {
    diagnostics.push({
      code: "material.invalidTextureColorSpaceFormat",
      field: "format",
      message: `${texture.semantic} texture '${texture.label}' declares color space '${texture.colorSpace}' but uses format '${texture.format}'.`,
    });
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function textureFormatIsSrgb(format: TextureAsset["format"]): boolean {
  return format.endsWith("-srgb");
}

function validateRenderState(
  renderState: RenderStateDescriptor,
  diagnostics: MaterialValidationDiagnostic[],
): void {
  if (renderState.alphaCutoff < 0 || renderState.alphaCutoff > 1) {
    diagnostics.push({
      code: "material.invalidAlphaCutoff",
      field: "renderState.alphaCutoff",
      message: "Alpha cutoff must be between 0 and 1.",
    });
  }

  if (renderState.alphaMode === "blend" && renderState.depth.write) {
    diagnostics.push({
      code: "material.incompatibleRenderState",
      field: "renderState.depth.write",
      message: "Blend materials must disable depth writes.",
    });
  }

  if (
    renderState.alphaMode === "blend" &&
    renderState.blend.preset === "none"
  ) {
    diagnostics.push({
      code: "material.incompatibleRenderState",
      field: "renderState.blend",
      message: "Blend materials must use a non-none blend preset.",
    });
  }

  if (renderState.stencil !== undefined) {
    validateStencilState(renderState.stencil, diagnostics);
  }

  if (
    renderState.clipPlanes !== undefined &&
    renderState.clipPlanes.length > MAX_CLIP_PLANES
  ) {
    diagnostics.push({
      code: "material.clipPlanesExceedLimit",
      field: "renderState.clipPlanes",
      message: `A material may declare at most ${MAX_CLIP_PLANES} clip planes; ${renderState.clipPlanes.length} were provided and the extras are dropped.`,
    });
  }
}

// D1: the stencil sub-state's reference and masks must be unsigned 32-bit
// integers (they encode into the pipeline key and, for the reference, drive
// `setStencilReference`). `createStencilState` clamps these, so this catches
// hand-built descriptors that bypass the factory.
function validateStencilState(
  stencil: StencilStateDescriptor,
  diagnostics: MaterialValidationDiagnostic[],
): void {
  for (const [field, value] of [
    ["renderState.stencil.reference", stencil.reference],
    ["renderState.stencil.readMask", stencil.readMask],
    ["renderState.stencil.writeMask", stencil.writeMask],
  ] as const) {
    if (!isUint32(value)) {
      diagnostics.push({
        code: "material.invalidStencilState",
        field,
        message: `${field} must be an unsigned 32-bit integer (0..4294967295), got ${String(
          value,
        )}.`,
      });
    }
  }
}

function isUint32(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
