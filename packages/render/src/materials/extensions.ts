import type { ShaderArtifact } from "@aperture-engine/shader";

export type MaterialExtensionParameters = readonly [
  number,
  number,
  number,
  number,
];
/** Data-only WGSL library and uniform parameters. Named hooks use the contracts
 * in STANDARD_MATERIAL_EXTENSION_WGSL; the renderer owns every GPU variant. */
export interface StandardMaterialExtension {
  readonly shader: ShaderArtifact;
  readonly surface?: string;
  readonly deform?: string;
  readonly opacity?: string;
  readonly parameters: MaterialExtensionParameters;
  /** Required for animated deformation with motion vectors. Defaults to current. */
  readonly previousParameters?: MaterialExtensionParameters;
}

/** Supply this module to the build-time compiler as aperture-material.wgsl.
 * Surface hooks cannot alter alpha: use the separate opacity hook so color,
 * shadow/depth and picking all evaluate the same visibility function. */
export const STANDARD_MATERIAL_EXTENSION_WGSL = `
struct ApertureVertex { position: vec3f, normal: vec3f };
struct ApertureSurface { baseColor: vec3f, normal: vec3f, metallic: f32, roughness: f32, emissive: vec3f };
`;

export function validateStandardMaterialExtension(
  extension: StandardMaterialExtension,
): void {
  if (
    extension.shader.format !== "aperture.shader" ||
    extension.shader.version !== 1 ||
    extension.shader.bindings.length > 0 ||
    extension.shader.entryPoints.length > 0
  )
    throw new Error(
      "aperture.material.extension.library: extensions require a compiled library without bindings or stage entry points.",
    );
  if (!extension.surface && !extension.deform && !extension.opacity)
    throw new Error(
      "aperture.material.extension.hook: provide a surface, deform or opacity hook.",
    );
  for (const name of [extension.surface, extension.deform, extension.opacity])
    if (name !== undefined && !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))
      throw new Error(
        "aperture.material.extension.hook: hook names must be WGSL identifiers.",
      );
  for (const values of [
    extension.parameters,
    extension.previousParameters ?? extension.parameters,
  ])
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value)))
      throw new Error(
        "aperture.material.extension.parameters: provide four finite f32 values.",
      );
}

/** Uniform values do not specialize pipelines or split otherwise compatible batches. */
export function standardMaterialExtensionKey(
  extension: StandardMaterialExtension,
): string {
  return `${extension.shader.hash}:${extension.shader.layoutHash}:${extension.surface ?? ""}:${extension.deform ?? ""}:${extension.opacity ?? ""}`;
}
