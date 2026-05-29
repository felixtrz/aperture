import type {
  AssetRegistry,
  Entity,
  EnvironmentMapHandle,
  MaterialHandle,
  SamplerHandle,
  TextureHandle,
} from "@aperture-engine/simulation";
import type {
  SourceMaterialAsset,
  SamplerAsset,
  TextureAsset,
} from "../materials/index.js";
import { isCustomWgslMaterialAsset } from "../materials/index.js";
import { diagnostic } from "./extraction-diagnostics.js";
import type { RenderDiagnostic } from "./snapshot.js";

export function validateMaterialTextureDependencies(
  material: SourceMaterialAsset,
  materialHandle: MaterialHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  if (isCustomWgslMaterialAsset(material)) {
    return validateCustomMaterialBindingDependencies(
      material,
      assets,
      entity,
      diagnostics,
    );
  }

  if (material.kind !== "unlit" || material.baseColorTexture === null) {
    return true;
  }

  const binding = material.baseColorTexture;
  let valid = true;

  if (binding.texture === null) {
    diagnostics.push(
      diagnostic(
        "render.material.missingTextureHandle",
        entity,
        materialHandle,
      ),
    );
    valid = false;
  } else {
    valid =
      validateTextureAssetState(binding.texture, assets, entity, diagnostics) &&
      valid;
  }

  if (binding.sampler === null) {
    diagnostics.push(
      diagnostic(
        "render.material.missingSamplerHandle",
        entity,
        materialHandle,
      ),
    );
    valid = false;
  } else {
    valid =
      validateSamplerAssetState(binding.sampler, assets, entity, diagnostics) &&
      valid;
  }

  return valid;
}

function validateCustomMaterialBindingDependencies(
  material: Extract<
    SourceMaterialAsset,
    { readonly sourceDiscriminator: "custom-material-source" }
  >,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  let valid = true;

  for (const binding of material.bindings) {
    if (binding.kind === "texture") {
      valid =
        validateTextureAssetState(
          binding.texture,
          assets,
          entity,
          diagnostics,
        ) && valid;
    }

    if (binding.kind === "sampler") {
      valid =
        validateSamplerAssetState(
          binding.sampler,
          assets,
          entity,
          diagnostics,
        ) && valid;
    }
  }

  return valid;
}

export function validateTextureAssetState(
  handle: TextureHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  const entry = assets.get<"texture", TextureAsset>(handle);

  if (entry === undefined) {
    diagnostics.push(diagnostic("render.texture.missing", entity, handle));
    return false;
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.texture.${entry.status}`, entity, handle),
    );
    return false;
  }

  return true;
}

export function validateSkyboxTextureAssetState(
  handle: TextureHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): TextureAsset | null {
  const entry = assets.get<"texture", TextureAsset>(handle);

  if (entry === undefined) {
    diagnostics.push(diagnostic("render.texture.missing", entity, handle));
    return null;
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.texture.${entry.status}`, entity, handle),
    );
    return null;
  }

  if (entry.asset.dimension !== "cube" || entry.asset.depthOrLayers !== 6) {
    diagnostics.push(
      diagnostic("render.skybox.textureNotCube", entity, handle),
    );
    return null;
  }

  return entry.asset;
}

export function validateSamplerAssetState(
  handle: SamplerHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  const entry = assets.get<"sampler", SamplerAsset>(handle);

  if (entry === undefined) {
    diagnostics.push(diagnostic("render.sampler.missing", entity, handle));
    return false;
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.sampler.${entry.status}`, entity, handle),
    );
    return false;
  }

  return true;
}

export function validateEnvironmentMapAssetState(
  handle: EnvironmentMapHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  const entry = assets.get<"environment-map">(handle);

  if (entry === undefined) {
    diagnostics.push(diagnostic("render.environment.missing", entity, handle));
    return false;
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.environment.${entry.status}`, entity, handle),
    );
    return false;
  }

  return true;
}
