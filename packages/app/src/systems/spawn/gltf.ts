import {
  Material,
  patchMatcapMaterial,
  patchStandardMaterial,
  patchUnlitMaterial,
  replayGltfEcsAuthoringCommands,
  type GltfEcsCommandReplayReport,
  type MaterialAsset,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import {
  assetHandleKey,
  createMaterialHandle,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import type { SystemGltfLoadedScene } from "../assets.js";
import {
  AppEntitySource,
  registerApertureAppComponents,
} from "../components.js";
import { formatReportDiagnostics } from "../diagnostics.js";
import type { SystemDiagnostics } from "../diagnostics.js";
import { ApertureSystemError } from "../errors.js";
import type { SpawnGltfMaterialOverrides } from "./types.js";

export function applyGltfSourceMetadata(
  world: EcsWorld,
  scene: SystemGltfLoadedScene,
  replay: GltfEcsCommandReplayReport,
): void {
  registerApertureAppComponents(world);

  for (const [entityKey, entity] of replay.entitiesByKey) {
    upsertAppEntitySource(entity, sourceFromGltfEntityKey(scene, entityKey));
  }
}

export function replayGltfLoadedScene(
  world: EcsWorld,
  scene: SystemGltfLoadedScene,
): GltfEcsCommandReplayReport {
  const replay = replayGltfEcsAuthoringCommands({
    world,
    plan: scene.commandPlan,
  });

  if (!replay.valid) {
    throw new ApertureSystemError(
      "aperture.spawn.gltfReplayFailed",
      `GLTF ECS commands could not be replayed. ${formatReportDiagnostics(
        replay.diagnostics,
      )}`,
      "Check the loaded glTF scene command plan diagnostics.",
    );
  }

  return replay;
}

export function firstReplayRootEntity(
  scene: SystemGltfLoadedScene,
  replay: GltfEcsCommandReplayReport,
): Entity {
  const rootKey = scene.commandPlan.rootEntityKeys[0];
  const root =
    rootKey === undefined
      ? undefined
      : (replay.entitiesByKey.get(rootKey) ??
        replay.entitiesByKey.values().next().value);

  if (root === undefined) {
    throw new ApertureSystemError(
      "aperture.spawn.gltfRootMissing",
      "GLTF scene replay did not create a root entity.",
      "Check the loaded glTF scene traversal report.",
    );
  }

  return root;
}

export function applyGltfMaterialOverrides(input: {
  readonly registry: AssetRegistry;
  readonly diagnostics: SystemDiagnostics;
  readonly scene: SystemGltfLoadedScene;
  readonly replay: GltfEcsCommandReplayReport;
  readonly overrides: SpawnGltfMaterialOverrides | undefined;
}): void {
  if (!hasMaterialOverrides(input.overrides)) {
    return;
  }

  const replacements = new Map<string, string>();

  for (const entity of input.replay.entitiesByKey.values()) {
    if (!entity.active || !entity.hasComponent(Material)) {
      continue;
    }

    const sourceMaterialKey = entity.getValue(Material, "materialId");
    if (typeof sourceMaterialKey !== "string" || sourceMaterialKey === "") {
      continue;
    }

    let replacementKey = replacements.get(sourceMaterialKey);
    if (replacementKey === undefined) {
      const replacement = cloneGltfMaterialForSpawn({
        registry: input.registry,
        diagnostics: input.diagnostics,
        scene: input.scene,
        sourceMaterialKey,
        overrides: input.overrides,
      });
      if (replacement === null) {
        continue;
      }
      replacementKey = replacement;
      replacements.set(sourceMaterialKey, replacementKey);
    }

    entity.setValue(Material, "materialId", replacementKey);
  }
}

function sourceFromGltfEntityKey(
  scene: SystemGltfLoadedScene,
  entityKey: string,
): {
  readonly kind: string;
  readonly assetId: string;
  readonly gltfNodeIndex: number;
  readonly gltfNodePath: string;
} {
  const prefix = `${scene.assetId}:`;
  const localKey = entityKey.startsWith(prefix)
    ? entityKey.slice(prefix.length)
    : entityKey;

  if (localKey.startsWith("scene:")) {
    return {
      kind: "gltf",
      assetId: scene.assetId,
      gltfNodeIndex: -1,
      gltfNodePath: localKey,
    };
  }

  const match = /^node:(\d+)(?::mesh:(\d+):primitive:(\d+))?$/u.exec(localKey);

  if (match !== null) {
    const nodeIndex = Number(match[1]);
    const meshIndex = match[2] === undefined ? null : Number(match[2]);
    const primitiveIndex = match[3] === undefined ? null : Number(match[3]);

    return {
      kind: "gltf",
      assetId: scene.assetId,
      gltfNodeIndex: nodeIndex,
      gltfNodePath:
        meshIndex === null || primitiveIndex === null
          ? `nodes[${nodeIndex}]`
          : `nodes[${nodeIndex}].mesh[${meshIndex}].primitives[${primitiveIndex}]`,
    };
  }

  return {
    kind: "gltf",
    assetId: scene.assetId,
    gltfNodeIndex: -1,
    gltfNodePath: localKey,
  };
}

function hasMaterialOverrides(
  overrides: SpawnGltfMaterialOverrides | undefined,
): overrides is SpawnGltfMaterialOverrides {
  return (
    overrides !== undefined &&
    Object.values(overrides).some((value) => value !== undefined)
  );
}

function cloneGltfMaterialForSpawn(input: {
  readonly registry: AssetRegistry;
  readonly diagnostics: SystemDiagnostics;
  readonly scene: SystemGltfLoadedScene;
  readonly sourceMaterialKey: string;
  readonly overrides: SpawnGltfMaterialOverrides;
}): string | null {
  const sourceHandle = materialHandleFromKey(input.sourceMaterialKey);
  const sourceEntry = input.registry.get<"material", SourceMaterialAsset>(
    sourceHandle,
  );

  if (sourceEntry?.status !== "ready" || sourceEntry.asset === null) {
    input.diagnostics.warn("aperture.spawn.gltfMaterialOverrideSkipped", {
      assetId: input.scene.assetId,
      sourceMaterialKey: input.sourceMaterialKey,
      reason: "source-material-not-ready",
    });
    return null;
  }

  const patched = patchMaterialAsset(sourceEntry.asset, input.overrides);
  if (patched === null) {
    input.diagnostics.warn("aperture.spawn.gltfMaterialOverrideSkipped", {
      assetId: input.scene.assetId,
      sourceMaterialKey: input.sourceMaterialKey,
      kind: builtInMaterialKind(sourceEntry.asset) ?? "custom-wgsl",
      reason: "unsupported-material-kind",
    });
    return null;
  }

  const replacementHandle = createMaterialHandle(
    [
      materialIdFromHandleKey(input.sourceMaterialKey),
      "override",
      materialOverrideKey(input.overrides),
    ].join(":"),
  );
  if (!input.registry.has(replacementHandle)) {
    input.registry.register<"material", SourceMaterialAsset>(
      replacementHandle,
      {
        label: `${sourceEntry.label} (spawn override)`,
        dependencies: sourceEntry.dependencies,
        diagnostics: sourceEntry.diagnostics,
      },
    );
  }
  input.registry.markReady<"material", SourceMaterialAsset>(
    replacementHandle,
    patched,
    sourceEntry.diagnostics,
  );

  return assetHandleKey(replacementHandle);
}

function patchMaterialAsset(
  material: SourceMaterialAsset,
  overrides: SpawnGltfMaterialOverrides,
): SourceMaterialAsset | null {
  switch (builtInMaterialKind(material)) {
    case "standard":
      return patchStandardMaterial(
        material as Extract<MaterialAsset, { readonly kind: "standard" }>,
        overrides,
      );
    case "unlit":
      return patchUnlitMaterial(
        material as Extract<MaterialAsset, { readonly kind: "unlit" }>,
        overrides,
      );
    case "matcap":
      return patchMatcapMaterial(
        material as Extract<MaterialAsset, { readonly kind: "matcap" }>,
        overrides,
      );
    default:
      return null;
  }
}

function builtInMaterialKind(
  material: SourceMaterialAsset,
): MaterialAsset["kind"] | null {
  const kind = (material as { readonly kind?: unknown }).kind;
  return kind === "standard" ||
    kind === "unlit" ||
    kind === "matcap" ||
    kind === "debug-normal"
    ? kind
    : null;
}

function materialHandleFromKey(handleKey: string): MaterialHandle {
  return createMaterialHandle(materialIdFromHandleKey(handleKey));
}

function materialIdFromHandleKey(handleKey: string): string {
  const prefix = "material:";
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}

function materialOverrideKey(overrides: SpawnGltfMaterialOverrides): string {
  return hashString(JSON.stringify(overrides));
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function upsertAppEntitySource(
  entity: Entity,
  value: {
    readonly kind: string;
    readonly assetId: string;
    readonly gltfNodeIndex: number;
    readonly gltfNodePath: string;
  },
): void {
  if (entity.hasComponent(AppEntitySource)) {
    entity.setValue(AppEntitySource, "kind", value.kind);
    entity.setValue(AppEntitySource, "assetId", value.assetId);
    entity.setValue(AppEntitySource, "gltfNodeIndex", value.gltfNodeIndex);
    entity.setValue(AppEntitySource, "gltfNodePath", value.gltfNodePath);
    return;
  }

  entity.addComponent(AppEntitySource, value);
}
