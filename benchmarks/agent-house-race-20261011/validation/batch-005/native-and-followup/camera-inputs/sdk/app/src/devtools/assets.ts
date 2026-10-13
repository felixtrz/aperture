import {
  analyzeParticleEffectRuntimeFeatures,
  type MaterialTextureBinding,
  type MeshAsset,
  type ParticleEffectAssetInput,
  type ParticleEmitterEffectAssetInput,
  type ParticleEffectRuntimeFeatureReport,
  type StandardMaterialAsset,
} from "@aperture-engine/render";
import type { AssetRegistry } from "@aperture-engine/simulation";
import type {
  ApertureParticleEffectAssetDescriptor,
  ApertureParticleEmitterEffectAssetDescriptor,
} from "../config/index.js";
import {
  systemAssetReadyMetadata,
  type SystemAssetHandle,
  type SystemAssetKind,
  type SystemParticleEffectAssetHandle,
  type SystemGltfAssetHandle,
} from "../systems.js";

const MAX_INSPECTED_GLTF_MATERIALS = 100;
const MAX_INSPECTED_GLTF_MESH_PRIMITIVES = 100;

export interface GltfTextureSlotInspection {
  readonly authored: boolean;
  readonly status:
    | "not-authored"
    | "missing-handle"
    | "missing"
    | "registered"
    | "loading"
    | "ready"
    | "failed";
  readonly textureKey: string | null;
}

export interface GltfMaterialInspection {
  readonly name: string;
  readonly handleKey: string;
  readonly sourceMaterialKey: string | null;
  readonly kind: string;
  readonly baseColorFactor?: readonly number[];
  readonly metallicFactor?: number;
  readonly roughnessFactor?: number;
  readonly emissiveFactor?: readonly number[];
  readonly textures: {
    readonly baseColor: boolean;
    readonly metallicRoughness: boolean;
    readonly normal: boolean;
    readonly emissive: boolean;
  };
  readonly textureStatus: {
    readonly baseColor: GltfTextureSlotInspection;
    readonly metallicRoughness: GltfTextureSlotInspection;
    readonly normal: GltfTextureSlotInspection;
    readonly emissive: GltfTextureSlotInspection;
  };
}

export interface GltfAssetInspectionReport {
  readonly asset: string;
  readonly ready: boolean;
  readonly meshes: number;
  readonly nodes: number;
  readonly primitives: number;
  readonly meshPrimitives: readonly {
    readonly handleKey: string;
    readonly meshIndex: number;
    readonly primitiveIndex: number;
    readonly normals: boolean;
    readonly tangents: boolean;
    readonly uvSets: readonly number[];
  }[];
  readonly materials: readonly GltfMaterialInspection[];
  readonly spawnPatchedMaterials: readonly GltfMaterialInspection[];
  readonly summary: {
    readonly imageCount: number;
    readonly textureCount: number;
    readonly highMetallicMaterialCount: number;
    readonly patchedMaterialCount: number;
    readonly truncatedMaterialCount: number;
    readonly truncatedMeshPrimitiveCount: number;
  };
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "warning";
    readonly message: string;
  }[];
}

interface CachedParticleRuntimeFeatures {
  readonly descriptor: ApertureParticleEffectAssetDescriptor;
  readonly runtimeFeatures: ParticleEffectRuntimeFeatureReport;
}

const PARTICLE_RUNTIME_FEATURE_CACHE = new WeakMap<
  SystemParticleEffectAssetHandle,
  CachedParticleRuntimeFeatures
>();

export function createAssetSummary(
  handles: readonly SystemAssetHandle<SystemAssetKind>[],
): readonly Record<string, unknown>[] {
  return handles.map((handle) => {
    const particleEffectRuntime =
      handle.kind === "particle-effect"
        ? {
            runtimeFeatures: particleRuntimeFeatures(
              handle as SystemParticleEffectAssetHandle,
            ),
          }
        : {};

    return {
      id: handle.id,
      kind: handle.kind,
      url: handle.url,
      preload: handle.preload,
      ready: handle.ready.value,
      error: handle.error.value,
      ...systemAssetReadyMetadata(handle),
      ...particleEffectRuntime,
    };
  });
}

/** Inspect imported and spawn-patched glTF material facts without a GPU. */
export function inspectGltfAsset(
  handle: SystemGltfAssetHandle,
  registry: AssetRegistry,
): GltfAssetInspectionReport {
  const scene = handle.scene.value;

  if (scene === null) {
    return {
      asset: handle.id,
      ready: false,
      meshes: 0,
      nodes: 0,
      primitives: 0,
      meshPrimitives: [],
      materials: [],
      spawnPatchedMaterials: [],
      summary: {
        imageCount: 0,
        textureCount: 0,
        highMetallicMaterialCount: 0,
        patchedMaterialCount: 0,
        truncatedMaterialCount: 0,
        truncatedMeshPrimitiveCount: 0,
      },
      diagnostics: [
        {
          code: "aperture.assetInspect.gltfNotReady",
          severity: "warning",
          message: `glTF asset '${handle.id}' is not loaded and ready for inspection.`,
        },
      ],
    };
  }

  const mappedMaterials = scene.importReport.assetMapping?.materials ?? [];
  const sourceMaterials = mappedMaterials.flatMap((planned) => {
    if (planned.material === null) {
      return [];
    }
    return [
      inspectMaterial(planned.handleKey, planned.material, registry, null),
    ];
  });
  const sourceMaterialIds = mappedMaterials.map((material) =>
    material.handleKey.replace(/^material:/u, ""),
  );
  const spawnPatchedMaterials = registry
    .list({ kind: "material", status: "ready" })
    .flatMap((entry) => {
      const sourceMaterialId = sourceMaterialIds.find(
        (sourceId) =>
          entry.handle.id !== sourceId &&
          entry.handle.id.startsWith(sourceId) &&
          entry.handle.id.includes(":override:"),
      );

      if (sourceMaterialId === undefined || entry.asset === null) {
        return [];
      }

      return [
        inspectMaterial(
          `material:${entry.handle.id}`,
          entry.asset as StandardMaterialAsset,
          registry,
          `material:${sourceMaterialId}`,
        ),
      ];
    })
    .sort((a, b) => a.handleKey.localeCompare(b.handleKey));
  const meshSources = scene.importReport.meshConstruction?.meshes ?? [];
  const meshPrimitives = meshSources
    .flatMap((source) => {
      if (source.mesh === null) {
        return [];
      }
      return [
        inspectMesh(
          source.handleKey,
          source.mesh,
          source.meshIndex,
          source.primitiveIndex,
        ),
      ];
    })
    .slice(0, MAX_INSPECTED_GLTF_MESH_PRIMITIVES);
  const materials = sourceMaterials.slice(0, MAX_INSPECTED_GLTF_MATERIALS);
  const patched = spawnPatchedMaterials.slice(0, MAX_INSPECTED_GLTF_MATERIALS);

  return {
    asset: handle.id,
    ready: true,
    meshes: scene.sourceSummary?.meshCount ?? meshSources.length,
    nodes: scene.sourceSummary?.nodeCount ?? 0,
    primitives: scene.sourceSummary?.primitiveCount ?? meshSources.length,
    meshPrimitives,
    materials,
    spawnPatchedMaterials: patched,
    summary: {
      imageCount:
        scene.sourceSummary?.imageCount ??
        scene.importReport.assetMapping?.textures.length ??
        0,
      textureCount:
        scene.sourceSummary?.textureCount ??
        scene.importReport.assetMapping?.textures.length ??
        0,
      highMetallicMaterialCount: sourceMaterials.filter(
        (material) => (material.metallicFactor ?? 0) >= 0.8,
      ).length,
      patchedMaterialCount: spawnPatchedMaterials.length,
      truncatedMaterialCount:
        Math.max(0, sourceMaterials.length - materials.length) +
        Math.max(0, spawnPatchedMaterials.length - patched.length),
      truncatedMeshPrimitiveCount: Math.max(
        0,
        meshSources.length - meshPrimitives.length,
      ),
    },
    diagnostics: [],
  };
}

function inspectMaterial(
  handleKey: string,
  material:
    | StandardMaterialAsset
    | { readonly kind: string; readonly label: string },
  registry: AssetRegistry,
  sourceMaterialKey: string | null,
): GltfMaterialInspection {
  const standard =
    material.kind === "standard" ? (material as StandardMaterialAsset) : null;
  const baseColor = textureSlot(standard?.baseColorTexture ?? null, registry);
  const metallicRoughness = textureSlot(
    standard?.metallicRoughnessTexture ?? null,
    registry,
  );
  const normal = textureSlot(standard?.normalTexture ?? null, registry);
  const emissive = textureSlot(standard?.emissiveTexture ?? null, registry);

  return {
    name: material.label,
    handleKey,
    sourceMaterialKey,
    kind: material.kind,
    ...(standard === null
      ? {}
      : {
          baseColorFactor: Array.from(standard.baseColorFactor),
          metallicFactor: standard.metallicFactor,
          roughnessFactor: standard.roughnessFactor,
          emissiveFactor: [...standard.emissiveFactor],
        }),
    textures: {
      baseColor: baseColor.authored,
      metallicRoughness: metallicRoughness.authored,
      normal: normal.authored,
      emissive: emissive.authored,
    },
    textureStatus: { baseColor, metallicRoughness, normal, emissive },
  };
}

function textureSlot(
  binding: MaterialTextureBinding | null,
  registry: AssetRegistry,
): GltfTextureSlotInspection {
  if (binding === null) {
    return { authored: false, status: "not-authored", textureKey: null };
  }
  if (binding.texture === null) {
    return { authored: true, status: "missing-handle", textureKey: null };
  }

  const entry = registry.get(binding.texture);
  return {
    authored: true,
    status: entry?.status ?? "missing",
    textureKey: `texture:${binding.texture.id}`,
  };
}

function inspectMesh(
  handleKey: string,
  mesh: MeshAsset,
  meshIndex: number,
  primitiveIndex: number,
) {
  const semantics = mesh.vertexStreams.flatMap((stream) =>
    stream.attributes.map((attribute) => attribute.semantic),
  );
  return {
    handleKey,
    meshIndex,
    primitiveIndex,
    normals: semantics.includes("NORMAL"),
    tangents: semantics.includes("TANGENT"),
    uvSets: semantics
      .flatMap((semantic) => {
        const match = /^TEXCOORD_(\d+)$/u.exec(semantic);
        return match?.[1] === undefined ? [] : [Number(match[1])];
      })
      .sort((a, b) => a - b),
  };
}

function particleRuntimeFeatures(
  handle: SystemParticleEffectAssetHandle,
): ParticleEffectRuntimeFeatureReport {
  const cached = PARTICLE_RUNTIME_FEATURE_CACHE.get(handle);

  if (cached !== undefined && cached.descriptor === handle.descriptor) {
    return cached.runtimeFeatures;
  }

  const runtimeFeatures = analyzeParticleEffectRuntimeFeatures(
    createParticleRuntimeFeatureInput(handle.descriptor),
  );
  PARTICLE_RUNTIME_FEATURE_CACHE.set(handle, {
    descriptor: handle.descriptor,
    runtimeFeatures,
  });
  return runtimeFeatures;
}

function createParticleRuntimeFeatureInput(
  descriptor: ApertureParticleEffectAssetDescriptor,
): ParticleEffectAssetInput {
  if (descriptor.type === "composite") {
    // Composite effects expose no leaf modules; runtime-feature analysis only
    // inspects the discriminant, so an empty emitter list is sufficient here.
    return { version: 2, type: "composite", emitters: [] };
  }

  const renderer = createParticleRuntimeFeatureRenderer(descriptor.renderer);

  return {
    version: 2,
    ...(descriptor.label === undefined ? {} : { label: descriptor.label }),
    ...(descriptor.main === undefined ? {} : { main: descriptor.main }),
    ...(descriptor.emission === undefined
      ? {}
      : { emission: descriptor.emission }),
    ...(descriptor.shape === undefined ? {} : { shape: descriptor.shape }),
    ...(renderer === undefined ? {} : { renderer }),
    ...(descriptor.textureSheetAnimation === undefined
      ? {}
      : { textureSheetAnimation: descriptor.textureSheetAnimation }),
    ...(descriptor.colorOverLifetime === undefined
      ? {}
      : { colorOverLifetime: descriptor.colorOverLifetime }),
    ...(descriptor.sizeOverLifetime === undefined
      ? {}
      : { sizeOverLifetime: descriptor.sizeOverLifetime }),
    ...(descriptor.rotationOverLifetime === undefined
      ? {}
      : { rotationOverLifetime: descriptor.rotationOverLifetime }),
    ...(descriptor.velocityOverLifetime === undefined
      ? {}
      : { velocityOverLifetime: descriptor.velocityOverLifetime }),
    ...(descriptor.forceOverLifetime === undefined
      ? {}
      : { forceOverLifetime: descriptor.forceOverLifetime }),
    ...(descriptor.limitVelocityOverLifetime === undefined
      ? {}
      : { limitVelocityOverLifetime: descriptor.limitVelocityOverLifetime }),
    ...(descriptor.noise === undefined ? {} : { noise: descriptor.noise }),
    ...(descriptor.subEmitters === undefined
      ? {}
      : { subEmitters: descriptor.subEmitters }),
    ...(descriptor.source === undefined ? {} : { source: descriptor.source }),
    ...(descriptor.curveSampleCount === undefined
      ? {}
      : { curveSampleCount: descriptor.curveSampleCount }),
  };
}

function createParticleRuntimeFeatureRenderer(
  renderer: ApertureParticleEmitterEffectAssetDescriptor["renderer"],
): ParticleEmitterEffectAssetInput["renderer"] | undefined {
  if (renderer === undefined) {
    return undefined;
  }

  return {
    ...(renderer.renderMode === undefined
      ? {}
      : { renderMode: renderer.renderMode }),
    ...(renderer.blendMode === undefined
      ? {}
      : { blendMode: renderer.blendMode }),
    ...(renderer.sortMode === undefined ? {} : { sortMode: renderer.sortMode }),
    ...(renderer.renderOrder === undefined
      ? {}
      : { renderOrder: renderer.renderOrder }),
    ...(renderer.softParticles === undefined
      ? {}
      : { softParticles: renderer.softParticles }),
    ...(renderer.texture === null ? { texture: null } : {}),
    ...(renderer.sampler === null ? { sampler: null } : {}),
  };
}
