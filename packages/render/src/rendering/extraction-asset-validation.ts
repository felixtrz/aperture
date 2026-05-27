import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  Entity,
  EnvironmentMapHandle,
  MaterialHandle,
  SamplerHandle,
  TextureHandle,
} from "@aperture-engine/simulation";
import {
  createStandardMaterialNormalMapTangentReadinessReport,
  createStandardMaterialTextureReadinessReport,
  type MaterialAsset,
  type MaterialTextureBinding,
  type StandardMaterialAsset,
  type TextureAsset,
  type SamplerAsset,
} from "../materials/index.js";
import type { MeshAsset } from "../mesh/index.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import type { RenderDiagnostic } from "./snapshot.js";

export function validateStandardNormalMapReadiness(input: {
  readonly mesh: MeshAsset;
  readonly material: MaterialAsset;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly entity: Entity;
  readonly diagnostics: RenderDiagnostic[];
}): boolean {
  if (input.material.kind !== "standard") {
    return true;
  }

  const report = createStandardMaterialNormalMapTangentReadinessReport({
    mesh: input.mesh,
    material: input.material,
    meshKey: input.meshKey,
    materialKey: input.materialKey,
  });

  if (report.ready) {
    return true;
  }

  for (const readinessDiagnostic of report.diagnostics) {
    input.diagnostics.push({
      code: `render.${readinessDiagnostic.code}`,
      severity: readinessDiagnostic.severity,
      entity: entityRef(input.entity),
      assetKey: input.materialKey,
      message: readinessDiagnostic.message,
    });
  }

  return false;
}

export function validateStandardMaterialTextureReadiness(input: {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
  readonly entity: Entity;
  readonly diagnostics: RenderDiagnostic[];
}): boolean {
  const report = createStandardMaterialTextureReadinessReport({
    registry: input.registry,
    material: input.material,
  });

  if (report.ready) {
    return true;
  }

  for (const readinessDiagnostic of report.diagnostics) {
    input.diagnostics.push({
      code: `render.${readinessDiagnostic.code}`,
      severity: readinessDiagnostic.severity,
      entity: entityRef(input.entity),
      assetKey: readinessDiagnostic.materialKey,
      materialKey: readinessDiagnostic.materialKey,
      ...(readinessDiagnostic.textureKey === undefined
        ? {}
        : { textureKey: readinessDiagnostic.textureKey }),
      ...(readinessDiagnostic.samplerKey === undefined
        ? {}
        : { samplerKey: readinessDiagnostic.samplerKey }),
      ...(readinessDiagnostic.field === undefined
        ? {}
        : { field: readinessDiagnostic.field }),
      ...(readinessDiagnostic.dependencyKind === undefined
        ? {}
        : { dependencyKind: readinessDiagnostic.dependencyKind }),
      ...(readinessDiagnostic.status === undefined
        ? {}
        : { status: readinessDiagnostic.status }),
      ...(readinessDiagnostic.expectedSemantic === undefined
        ? {}
        : { expectedSemantic: readinessDiagnostic.expectedSemantic }),
      ...(readinessDiagnostic.actualSemantic === undefined
        ? {}
        : { actualSemantic: readinessDiagnostic.actualSemantic }),
      ...(readinessDiagnostic.expectedColorSpaces === undefined
        ? {}
        : {
            expectedColorSpaces: [...readinessDiagnostic.expectedColorSpaces],
          }),
      ...(readinessDiagnostic.actualColorSpace === undefined
        ? {}
        : { actualColorSpace: readinessDiagnostic.actualColorSpace }),
      ...(readinessDiagnostic.texCoord === undefined
        ? {}
        : { texCoord: readinessDiagnostic.texCoord }),
      ...(readinessDiagnostic.supportedTexCoords === undefined
        ? {}
        : {
            supportedTexCoords: [...readinessDiagnostic.supportedTexCoords],
          }),
      ...(readinessDiagnostic.textureTransform === undefined
        ? {}
        : {
            textureTransform: {
              ...readinessDiagnostic.textureTransform,
              ...(readinessDiagnostic.textureTransform.offset === undefined
                ? {}
                : {
                    offset: [
                      readinessDiagnostic.textureTransform.offset[0],
                      readinessDiagnostic.textureTransform.offset[1],
                    ],
                  }),
              ...(readinessDiagnostic.textureTransform.scale === undefined
                ? {}
                : {
                    scale: [
                      readinessDiagnostic.textureTransform.scale[0],
                      readinessDiagnostic.textureTransform.scale[1],
                    ],
                  }),
            },
          }),
      message: readinessDiagnostic.message,
    });
  }

  return false;
}

export function validateStandardMaterialUvSetReadiness(input: {
  readonly mesh: MeshAsset;
  readonly material: StandardMaterialAsset;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly entity: Entity;
  readonly diagnostics: RenderDiagnostic[];
}): boolean {
  if (!usesStandardTexCoord1(input.material)) {
    return true;
  }

  if (meshHasSemantic(input.mesh, "TEXCOORD_1")) {
    return true;
  }

  for (const [field, binding] of standardMaterialTextureBindings(
    input.material,
  )) {
    if (binding === null || binding.texture === null) {
      continue;
    }

    const texCoord = binding.texCoord ?? 0;

    if (texCoord !== 1) {
      continue;
    }

    const textureKey = assetHandleKey(binding.texture);

    input.diagnostics.push({
      code: "render.standardMaterialTexture.missingTexCoord1",
      severity: "warning",
      entity: entityRef(input.entity),
      assetKey: input.materialKey,
      materialKey: input.materialKey,
      meshKey: input.meshKey,
      textureKey,
      field,
      texCoord,
      message: `StandardMaterial ${field} uses TEXCOORD_1 texture '${textureKey}', but mesh '${input.meshKey}' does not provide a TEXCOORD_1 vertex attribute.`,
    });
  }

  return false;
}

function usesStandardTexCoord1(material: StandardMaterialAsset): boolean {
  return standardMaterialTextureBindings(material).some(([, binding]) => {
    return (
      binding !== null &&
      binding.texture !== null &&
      (binding.texCoord ?? 0) === 1
    );
  });
}

function standardMaterialTextureBindings(
  material: StandardMaterialAsset,
): readonly (readonly [
  (
    | "baseColorTexture"
    | "metallicRoughnessTexture"
    | "normalTexture"
    | "occlusionTexture"
    | "emissiveTexture"
  ),
  MaterialTextureBinding | null,
])[] {
  return [
    ["baseColorTexture", material.baseColorTexture],
    ["metallicRoughnessTexture", material.metallicRoughnessTexture],
    ["normalTexture", material.normalTexture],
    ["occlusionTexture", material.occlusionTexture],
    ["emissiveTexture", material.emissiveTexture],
  ];
}

function meshHasSemantic(mesh: MeshAsset, semantic: "TEXCOORD_1"): boolean {
  return mesh.vertexStreams.some((stream) =>
    stream.attributes.some((attribute) => attribute.semantic === semantic),
  );
}

export function validateMaterialTextureDependencies(
  material: MaterialAsset,
  materialHandle: MaterialHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
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
