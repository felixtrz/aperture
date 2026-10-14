import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
} from "../../lighting/light-packing.js";
import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";
import { supportsStandardSmallLightUniforms } from "./standard-small-light-uniforms.js";

const FLOAT_WORDS = 2 * PACKED_LIGHT_FLOAT_STRIDE;
const METADATA_WORDS = 2 * PACKED_LIGHT_METADATA_STRIDE;

/** Same packed storage ABI; only its admitted array lengths become static. */
export const STANDARD_FIXED_LIGHT_STORAGE_BYTES = [
  FLOAT_WORDS * Float32Array.BYTES_PER_ELEMENT,
  METADATA_WORDS * Int32Array.BYTES_PER_ELEMENT,
  16 * Float32Array.BYTES_PER_ELEMENT,
] as const;

export function applyStandardFixedLightStorage(
  source: string,
  features: StandardTextureShaderFeatures,
): string {
  if (features.fixedLightStorage === undefined) return source;
  if (
    features.smallLightUniforms !== undefined ||
    !supportsStandardSmallLightUniforms(features)
  ) {
    throw new Error(
      "Fixed light storage requires one ambient and one PCF sun.",
    );
  }
  // The render plan owns explicit layout admission. Retain all three bindings
  // even when constant folding makes metadata unreachable in the shader.
  let code = source;
  for (const [name, type, count] of [
    ["lightFloats", "f32", FLOAT_WORDS],
    ["lightMetadata", "i32", METADATA_WORDS],
    ["directionalShadowMatrices", "mat4x4f", 1],
  ] as const) {
    const declaration = `${name}: array<${type}>;`;
    if (code.split(declaration).length !== 2) {
      throw new Error(
        "Fixed light storage declaration did not match its schema.",
      );
    }
    code = code
      .replace(declaration, `${name}: array<${type}, ${count}>;`)
      .replaceAll(`arrayLength(&${name})`, `${count}u`);
  }
  return code;
}
