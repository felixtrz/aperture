import { type AssetRegistry } from "@aperture-engine/simulation";
import type {
  CustomWgslMaterialAsset,
  PreparedCustomWgslMaterial,
} from "@aperture-engine/render";
import type { CustomWgslMaterialGpuResource } from "../materials/custom-wgsl/custom-wgsl-material.js";
import {
  prepareAppSamplerResource,
  prepareAppTextureResource,
  type AppTextureSamplerResourceCache,
  type AppTextureSamplerResourceReuseReport,
  type WebGpuAppTextureSamplerPreparationDiagnostic,
} from "./app-texture-sampler-resources.js";

export interface CustomWgslAppTextureSamplerBindingResources {
  readonly valid: boolean;
  readonly resources: readonly CustomWgslMaterialGpuResource[];
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly diagnostics: readonly (
    | WebGpuAppTextureSamplerPreparationDiagnostic
    | CustomWgslAppTextureSamplerBindingDiagnostic
  )[];
}

interface CustomWgslAppTextureSamplerBindingDiagnostic {
  readonly code:
    | "webGpuApp.customWgslBindingNotPrepared"
    | "webGpuApp.customWgslSceneDepthUnavailable";
  readonly message: string;
  readonly binding: number;
}

/**
 * B4: the frame's stored scene depth, supplied by the render route so a
 * `source: "scene-depth"` texture binding resolves to it (read-only). The
 * `sampleCount` lets the route assert the material's `multisampled` declaration
 * matches the app's MSAA state before binding.
 */
export interface CustomWgslAppSceneDepthResource {
  readonly view: unknown;
  readonly sampleCount: number;
}

export function prepareCustomWgslAppTextureSamplerBindingResources(options: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: AppTextureSamplerResourceCache;
  readonly reuse: AppTextureSamplerResourceReuseReport;
  readonly source: CustomWgslMaterialAsset;
  readonly material: PreparedCustomWgslMaterial;
  readonly sceneDepth?: CustomWgslAppSceneDepthResource | null;
}): CustomWgslAppTextureSamplerBindingResources {
  const diagnostics: CustomWgslAppTextureSamplerBindingDiagnostic[] = [];
  const textureSamplerDiagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] =
    [];
  const resources: CustomWgslMaterialGpuResource[] = [];
  const textureKeys: string[] = [];
  const samplerKeys: string[] = [];

  for (const binding of options.source.bindings) {
    const resourceKey = preparedBindingResourceKey(
      options.material,
      binding.binding,
      diagnostics,
    );

    if (resourceKey === null) {
      continue;
    }

    if (binding.kind === "texture" && binding.source === "scene-depth") {
      // B4: bind the frame's stored scene depth (read-only) — the opaque pass
      // wrote it, this transparent draw samples it. The route peels the draw
      // into a read-only-depth boundary so sampling the depth attachment is
      // legal.
      const sceneDepthView = options.sceneDepth?.view;

      if (sceneDepthView === undefined || sceneDepthView === null) {
        diagnostics.push({
          code: "webGpuApp.customWgslSceneDepthUnavailable",
          binding: binding.binding,
          message: `Custom WGSL binding ${binding.binding} requests scene-depth, but no scene depth attachment was available this frame (the route did not supply one).`,
        });
      } else {
        resources.push({ resourceKey, resource: sceneDepthView });
        textureKeys.push(`scene-depth:${options.material.materialKey}`);
      }
    } else if (binding.kind === "texture" && binding.texture !== undefined) {
      const texture = prepareAppTextureResource({
        assets: options.assets,
        device: options.device,
        cache: options.cache,
        handle: binding.texture,
        reuse: options.reuse,
        diagnostics: textureSamplerDiagnostics,
      });

      if (texture !== null) {
        resources.push({
          resourceKey,
          resource: texture.resource.view,
        });
        textureKeys.push(texture.cacheKey);
      }
    }

    if (binding.kind === "sampler") {
      const sampler = prepareAppSamplerResource({
        assets: options.assets,
        device: options.device,
        cache: options.cache,
        handle: binding.sampler,
        reuse: options.reuse,
        diagnostics: textureSamplerDiagnostics,
      });

      if (sampler !== null) {
        resources.push({
          resourceKey,
          resource: sampler.resource.sampler,
        });
        samplerKeys.push(sampler.cacheKey);
      }
    }
  }

  const expectedExternalResourceCount = options.source.bindings.filter(
    (binding) => binding.kind === "texture" || binding.kind === "sampler",
  ).length;

  return {
    valid:
      diagnostics.length === 0 &&
      textureSamplerDiagnostics.length === 0 &&
      resources.length === expectedExternalResourceCount,
    resources,
    textureKeys,
    samplerKeys,
    diagnostics: [...diagnostics, ...textureSamplerDiagnostics],
  };
}

function preparedBindingResourceKey(
  material: PreparedCustomWgslMaterial,
  binding: number,
  diagnostics: CustomWgslAppTextureSamplerBindingDiagnostic[],
): string | null {
  const entry = material.bindGroup.entries.find(
    (candidate) => candidate.binding === binding,
  );

  if (entry === undefined) {
    diagnostics.push({
      code: "webGpuApp.customWgslBindingNotPrepared",
      binding,
      message: `Custom WGSL binding ${binding} was not present in the prepared material bind group.`,
    });
    return null;
  }

  return entry.resourceKey;
}
