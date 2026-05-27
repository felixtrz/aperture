import type {
  AssetRegistry,
  MaterialHandle,
  MeshHandle,
} from "@aperture-engine/simulation";
import { assetHandleKey } from "@aperture-engine/simulation";
import type { MeshAsset, StandardMaterialAsset } from "@aperture-engine/render";
import {
  createPreparedAppMaterialFallbackDiagnostic,
  type PreparedAppMaterialFallbackDiagnostic,
  type PreparedAppMaterialResourceUse,
} from "../core/prepared-app-material-resource.js";
import type { PreparedMaterialTextureSamplerDependencies } from "../core/prepared-material-texture-sampler-dependencies.js";
import {
  prepareAppMeshResource,
  type PreparedAppMeshResourceUse,
  type PreparedMeshGpuResourceCache,
} from "../../resources/meshes/prepared-app-mesh-resource.js";
import {
  prepareBaseColorTexturedStandardMaterialResource,
  prepareClearcoatRoughnessTexturedStandardMaterialResource,
  prepareClearcoatTexturedStandardMaterialResource,
  prepareIridescenceThicknessTexturedStandardMaterialResource,
  prepareIridescenceTexturedStandardMaterialResource,
  prepareMetallicRoughnessTexturedStandardMaterialResource,
  prepareNormalTexturedStandardMaterialResource,
  prepareOcclusionEmissiveTexturedStandardMaterialResource,
  prepareScalarStandardMaterialResource,
  prepareSheenColorTexturedStandardMaterialResource,
  prepareSheenRoughnessTexturedStandardMaterialResource,
  prepareTransmissionTexturedStandardMaterialResource,
  type PreparedBaseColorTexturedStandardMaterialResource,
  type PreparedClearcoatRoughnessTexturedStandardMaterialResource,
  type PreparedClearcoatTexturedStandardMaterialResource,
  type PreparedIridescenceThicknessTexturedStandardMaterialResource,
  type PreparedIridescenceTexturedStandardMaterialResource,
  type PreparedMetallicRoughnessTexturedStandardMaterialResource,
  type PreparedNormalTexturedStandardMaterialResource,
  type PreparedOcclusionEmissiveTexturedStandardMaterialResource,
  type PreparedScalarStandardMaterialCache,
  type PreparedScalarStandardMaterialResource,
  type PreparedSheenColorTexturedStandardMaterialResource,
  type PreparedSheenRoughnessTexturedStandardMaterialResource,
  type PreparedTransmissionTexturedStandardMaterialResource,
} from "./prepared-standard-material-cache.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";

export type PreparedStandardMaterialUse = PreparedAppMaterialResourceUse<
  | PreparedScalarStandardMaterialResource
  | PreparedBaseColorTexturedStandardMaterialResource
  | PreparedMetallicRoughnessTexturedStandardMaterialResource
  | PreparedNormalTexturedStandardMaterialResource
  | PreparedClearcoatTexturedStandardMaterialResource
  | PreparedClearcoatRoughnessTexturedStandardMaterialResource
  | PreparedTransmissionTexturedStandardMaterialResource
  | PreparedSheenColorTexturedStandardMaterialResource
  | PreparedSheenRoughnessTexturedStandardMaterialResource
  | PreparedIridescenceTexturedStandardMaterialResource
  | PreparedIridescenceThicknessTexturedStandardMaterialResource
  | PreparedOcclusionEmissiveTexturedStandardMaterialResource
>;

export function preparePreparedStandardMesh(options: {
  readonly device: unknown;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly frame?: number | undefined;
  readonly material: StandardMaterialAsset | null;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
}): PreparedAppMeshResourceUse | null {
  if (options.mesh === null || options.material === null) {
    return null;
  }

  return prepareAppMeshResource({
    device: options.device,
    mesh: options.mesh,
    meshHandle: options.meshHandle,
    meshKey: options.meshKey,
    frame: options.frame,
    preparedMeshes: options.preparedMeshes,
  });
}

export function preparePreparedStandardMaterial(
  options: {
    readonly device: unknown;
    readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
    readonly materialHandle: MaterialHandle;
    readonly material: StandardMaterialAsset | null;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly assets: AssetRegistry;
    readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  },
  fallbackDiagnostics: PreparedAppMaterialFallbackDiagnostic[],
): PreparedStandardMaterialUse | null {
  if (options.material === null) {
    return null;
  }

  const sourceVersion = sourceVersionFromAssetKey(
    options.materialKey,
    options.sourceMaterialKey,
  );

  if (sourceVersion === null) {
    return null;
  }

  const result =
    options.material.baseColorTexture !== null
      ? prepareBaseColorTexturedStandardMaterialResource({
          registry: options.assets,
          device: options.device as Parameters<
            typeof prepareBaseColorTexturedStandardMaterialResource
          >[0]["device"],
          cache: options.preparedScalarMaterials,
          handle: options.materialHandle,
          material: options.material,
          sourceVersion,
          frame: options.frame,
          pipelineKey: options.pipelineKey,
          layout: options.materialLayout,
          textures: options.textureSamplerDependencies.textures,
          samplers: options.textureSamplerDependencies.samplers,
        })
      : options.material.metallicRoughnessTexture !== null
        ? prepareMetallicRoughnessTexturedStandardMaterialResource({
            registry: options.assets,
            device: options.device as Parameters<
              typeof prepareMetallicRoughnessTexturedStandardMaterialResource
            >[0]["device"],
            cache: options.preparedScalarMaterials,
            handle: options.materialHandle,
            material: options.material,
            sourceVersion,
            frame: options.frame,
            pipelineKey: options.pipelineKey,
            layout: options.materialLayout,
            textures: options.textureSamplerDependencies.textures,
            samplers: options.textureSamplerDependencies.samplers,
          })
        : options.material.normalTexture !== null
          ? prepareNormalTexturedStandardMaterialResource({
              registry: options.assets,
              device: options.device as Parameters<
                typeof prepareNormalTexturedStandardMaterialResource
              >[0]["device"],
              cache: options.preparedScalarMaterials,
              handle: options.materialHandle,
              material: options.material,
              sourceVersion,
              frame: options.frame,
              pipelineKey: options.pipelineKey,
              layout: options.materialLayout,
              textures: options.textureSamplerDependencies.textures,
              samplers: options.textureSamplerDependencies.samplers,
            })
          : options.material.clearcoatTexture !== null
            ? prepareClearcoatTexturedStandardMaterialResource({
                registry: options.assets,
                device: options.device as Parameters<
                  typeof prepareClearcoatTexturedStandardMaterialResource
                >[0]["device"],
                cache: options.preparedScalarMaterials,
                handle: options.materialHandle,
                material: options.material,
                sourceVersion,
                frame: options.frame,
                pipelineKey: options.pipelineKey,
                layout: options.materialLayout,
                textures: options.textureSamplerDependencies.textures,
                samplers: options.textureSamplerDependencies.samplers,
              })
            : options.material.clearcoatRoughnessTexture !== null
              ? prepareClearcoatRoughnessTexturedStandardMaterialResource({
                  registry: options.assets,
                  device: options.device as Parameters<
                    typeof prepareClearcoatRoughnessTexturedStandardMaterialResource
                  >[0]["device"],
                  cache: options.preparedScalarMaterials,
                  handle: options.materialHandle,
                  material: options.material,
                  sourceVersion,
                  frame: options.frame,
                  pipelineKey: options.pipelineKey,
                  layout: options.materialLayout,
                  textures: options.textureSamplerDependencies.textures,
                  samplers: options.textureSamplerDependencies.samplers,
                })
              : options.material.transmissionTexture !== null
                ? prepareTransmissionTexturedStandardMaterialResource({
                    registry: options.assets,
                    device: options.device as Parameters<
                      typeof prepareTransmissionTexturedStandardMaterialResource
                    >[0]["device"],
                    cache: options.preparedScalarMaterials,
                    handle: options.materialHandle,
                    material: options.material,
                    sourceVersion,
                    frame: options.frame,
                    pipelineKey: options.pipelineKey,
                    layout: options.materialLayout,
                    textures: options.textureSamplerDependencies.textures,
                    samplers: options.textureSamplerDependencies.samplers,
                  })
                : options.material.sheenColorTexture !== null
                  ? prepareSheenColorTexturedStandardMaterialResource({
                      registry: options.assets,
                      device: options.device as Parameters<
                        typeof prepareSheenColorTexturedStandardMaterialResource
                      >[0]["device"],
                      cache: options.preparedScalarMaterials,
                      handle: options.materialHandle,
                      material: options.material,
                      sourceVersion,
                      frame: options.frame,
                      pipelineKey: options.pipelineKey,
                      layout: options.materialLayout,
                      textures: options.textureSamplerDependencies.textures,
                      samplers: options.textureSamplerDependencies.samplers,
                    })
                  : options.material.sheenRoughnessTexture !== null
                    ? prepareSheenRoughnessTexturedStandardMaterialResource({
                        registry: options.assets,
                        device: options.device as Parameters<
                          typeof prepareSheenRoughnessTexturedStandardMaterialResource
                        >[0]["device"],
                        cache: options.preparedScalarMaterials,
                        handle: options.materialHandle,
                        material: options.material,
                        sourceVersion,
                        frame: options.frame,
                        pipelineKey: options.pipelineKey,
                        layout: options.materialLayout,
                        textures: options.textureSamplerDependencies.textures,
                        samplers: options.textureSamplerDependencies.samplers,
                      })
                    : options.material.iridescenceTexture !== null
                      ? prepareIridescenceTexturedStandardMaterialResource({
                          registry: options.assets,
                          device: options.device as Parameters<
                            typeof prepareIridescenceTexturedStandardMaterialResource
                          >[0]["device"],
                          cache: options.preparedScalarMaterials,
                          handle: options.materialHandle,
                          material: options.material,
                          sourceVersion,
                          frame: options.frame,
                          pipelineKey: options.pipelineKey,
                          layout: options.materialLayout,
                          textures: options.textureSamplerDependencies.textures,
                          samplers: options.textureSamplerDependencies.samplers,
                        })
                      : options.material.iridescenceThicknessTexture !== null
                        ? prepareIridescenceThicknessTexturedStandardMaterialResource(
                            {
                              registry: options.assets,
                              device: options.device as Parameters<
                                typeof prepareIridescenceThicknessTexturedStandardMaterialResource
                              >[0]["device"],
                              cache: options.preparedScalarMaterials,
                              handle: options.materialHandle,
                              material: options.material,
                              sourceVersion,
                              frame: options.frame,
                              pipelineKey: options.pipelineKey,
                              layout: options.materialLayout,
                              textures:
                                options.textureSamplerDependencies.textures,
                              samplers:
                                options.textureSamplerDependencies.samplers,
                            },
                          )
                        : options.material.occlusionTexture !== null ||
                            options.material.emissiveTexture !== null
                          ? prepareOcclusionEmissiveTexturedStandardMaterialResource(
                              {
                                registry: options.assets,
                                device: options.device as Parameters<
                                  typeof prepareOcclusionEmissiveTexturedStandardMaterialResource
                                >[0]["device"],
                                cache: options.preparedScalarMaterials,
                                handle: options.materialHandle,
                                material: options.material,
                                sourceVersion,
                                frame: options.frame,
                                pipelineKey: options.pipelineKey,
                                layout: options.materialLayout,
                                textures:
                                  options.textureSamplerDependencies.textures,
                                samplers:
                                  options.textureSamplerDependencies.samplers,
                              },
                            )
                          : prepareScalarStandardMaterialResource({
                              device: options.device as Parameters<
                                typeof prepareScalarStandardMaterialResource
                              >[0]["device"],
                              cache: options.preparedScalarMaterials,
                              handle: options.materialHandle,
                              material: options.material,
                              sourceVersion,
                              frame: options.frame,
                              pipelineKey: options.pipelineKey,
                              layout: options.materialLayout,
                            });

  if (
    result.valid &&
    result.resource !== null &&
    (result.status === "created" || result.status === "reused")
  ) {
    return { status: result.status, resource: result.resource };
  }

  const diagnostic = createPreparedAppMaterialFallbackDiagnostic({
    materialFamily: "standard",
    materialKey: assetHandleKey(options.materialHandle),
    status: result.status,
    diagnostics: result.diagnostics,
  });

  if (diagnostic !== null) {
    fallbackDiagnostics.push(diagnostic);
  }

  return null;
}

function sourceVersionFromAssetKey(
  assetKey: string,
  sourceAssetKey: string,
): number | null {
  const prefix = `${sourceAssetKey}@`;

  if (!assetKey.startsWith(prefix)) {
    return null;
  }

  const version = Number.parseInt(assetKey.slice(prefix.length), 10);

  return Number.isFinite(version) ? version : null;
}
