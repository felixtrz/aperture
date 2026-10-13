import type {
  PreparedAppTextureSamplerResources,
  WebGpuAppTextureSamplerPreparationDiagnostic,
} from "../../app/app-texture-sampler-resources.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "../../resources/textures/texture-resources.js";

export interface PreparedMaterialTextureSamplerDependencies {
  readonly valid: boolean;
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly diagnostics: readonly WebGpuAppTextureSamplerPreparationDiagnostic[];
}

export function createPreparedMaterialTextureSamplerDependencies(
  resources: PreparedAppTextureSamplerResources,
): PreparedMaterialTextureSamplerDependencies {
  return resources;
}
