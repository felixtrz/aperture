import {
  createRenderTargetHandle,
  type AssetRegistry,
  type Entity,
  type EnvironmentMapHandle,
  type MaterialHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type {
  SourceMaterialAsset,
  SamplerAsset,
  TextureAsset,
} from "../materials/index.js";
import { isCustomWgslMaterialAsset } from "../materials/index.js";
import { isRenderTargetAsset } from "../assets/render-target-asset.js";
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
    // B4: source-backed texture bindings (scene-depth) have no asset handle.
    if (binding.kind === "texture" && binding.texture !== undefined) {
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
    // B1: a texture handle may reference the color texture of a facade
    // render-target source asset registered under the same id — the WebGPU
    // layer serves the realized target texture for it, so extraction accepts
    // a ready, sampleable render target in place of a texture asset.
    return validateRenderTargetColorTextureState(
      handle,
      assets,
      entity,
      diagnostics,
    );
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.texture.${entry.status}`, entity, handle),
    );
    return false;
  }

  return true;
}

function validateRenderTargetColorTextureState(
  handle: TextureHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  const entry = assets.get<"render-target", unknown>(
    createRenderTargetHandle(handle.id),
  );

  if (
    entry === undefined ||
    entry.status !== "ready" ||
    !isRenderTargetAsset(entry.asset)
  ) {
    diagnostics.push(diagnostic("render.texture.missing", entity, handle));
    return false;
  }

  if (!entry.asset.sampleable) {
    diagnostics.push(
      diagnostic("render.texture.renderTargetNotSampleable", entity, handle),
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
