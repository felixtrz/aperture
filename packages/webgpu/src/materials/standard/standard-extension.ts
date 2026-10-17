import {
  standardMaterialExtensionKey,
  validateStandardMaterialExtension,
  type StandardMaterialAsset,
  type StandardMaterialExtension,
  type BatchCompatibilityKey,
} from "@aperture-engine/render";
import { ShaderError } from "@aperture-engine/shader";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
import {
  STANDARD_FRAGMENT_BASE_COLOR_ALPHA_END,
  STANDARD_FRAGMENT_METALLIC_ROUGHNESS_END,
} from "./standard-shader-composer.js";

export function validateMaterialExtensionVariant(
  material: StandardMaterialAsset,
  batchKey: BatchCompatibilityKey,
): void {
  const extension = material.extension;
  if (extension === undefined) return;
  validateStandardMaterialExtension(extension);
  const fail = (message: string): never => {
    throw new ShaderError([
      {
        code: "aperture.material.extension.unsupportedVariant",
        severity: "error",
        message,
      },
    ]);
  };
  if (batchKey.skinned || batchKey.morphed)
    fail(
      "Material extensions currently require rigid meshes; skinning and morph pass variants are unsupported.",
    );
  if (material.renderState.alphaMode === "blend")
    fail(
      "Material extensions do not yet support alpha-blended visibility/picking variants.",
    );
  if (extension.deform && material.normalTexture?.texture)
    fail(
      "Deformation with tangent-space normal textures requires a tangent deformation contract, which is unsupported.",
    );
  if (
    material.renderState.alphaMode === "mask" &&
    material.baseColorTexture?.texture
  )
    fail(
      "Material extension cutout variants require procedural opacity; textured alpha cutout is unsupported.",
    );
  if (extension.opacity && material.renderState.alphaMode !== "mask")
    fail(
      "An opacity hook requires alphaMode:'mask' and an explicit alpha cutoff.",
    );
}

export function applyStandardMaterialExtension(
  shader: BuiltInShaderSourceModule,
  extension?: StandardMaterialExtension,
): BuiltInShaderSourceModule {
  if (extension === undefined) return shader;
  let code = shader.code.replace(
    "  attenuationColor: vec4f,",
    "  attenuationColor: vec4f,\n  extensionParameters: vec4f,\n  extensionPreviousParameters: vec4f,",
  );
  if (extension.deform) {
    code = code.replace(
      "  let worldPosition = world * vec4f(input.position, 1.0);",
      `  let apertureVertex = ${extension.deform}(ApertureVertex(input.position, input.normal), input.uv, material.extensionParameters);
  let aperturePreviousVertex = ${extension.deform}(ApertureVertex(input.position, input.normal), input.uv, material.extensionPreviousParameters);
  let worldPosition = world * vec4f(apertureVertex.position, 1.0);`,
    );
    code = code.replace(
      "world * vec4f(input.normal, 0.0)",
      "world * vec4f(apertureVertex.normal, 0.0)",
    );
  }
  if (extension.opacity) {
    const fragment = code.indexOf("@fragment");
    code =
      code.slice(0, fragment) +
      code.slice(fragment).replace("  let alpha =", "  var alpha =");
    code = code.replace(
      STANDARD_FRAGMENT_BASE_COLOR_ALPHA_END,
      `  alpha *= ${extension.opacity}(input.uv, material.extensionParameters);\n${STANDARD_FRAGMENT_BASE_COLOR_ALPHA_END}`,
    );
  }
  if (extension.surface) {
    for (const variable of ["baseColor", "normal", "metallic", "roughness"]) {
      // Controlled engine slots, not parsing or rewriting authored WGSL.
      const marker =
        variable === "baseColor" ? "  let baseColor =" : `  let ${variable} =`;
      const fragment = code.indexOf("@fragment");
      code =
        code.slice(0, fragment) +
        code.slice(fragment).replace(marker, marker.replace("let", "var"));
    }
    // Emissive sampling remains in the engine's lighting assembly.
    code = code.replaceAll(
      "material.emissiveFactor",
      "apertureSurface.emissive",
    );
    code = code.replace(
      STANDARD_FRAGMENT_METALLIC_ROUGHNESS_END,
      `${STANDARD_FRAGMENT_METALLIC_ROUGHNESS_END}
  let apertureSurface = ${extension.surface}(ApertureSurface(baseColor, normal, metallic, roughness, material.emissiveFactor), input.uv, input.worldPosition, material.extensionParameters);
  baseColor = max(apertureSurface.baseColor, vec3f(0.0));
  normal = normalize(apertureSurface.normal);
  metallic = clamp(apertureSurface.metallic, 0.0, 1.0);
  roughness = clamp(apertureSurface.roughness, 0.045, 1.0);`,
    );
  }
  return {
    ...shader,
    code: `${extension.shader.code}\n${code}`,
    label: `${shader.label}/extension/${standardMaterialExtensionKey(extension)}`,
  };
}
