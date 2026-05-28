import {
  replayGltfEcsAuthoringCommands,
  type GltfEcsCommandReplayReport,
} from "@aperture-engine/render";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { SystemGltfLoadedScene } from "../assets.js";
import {
  AppEntitySource,
  registerApertureAppComponents,
} from "../components.js";
import { formatReportDiagnostics } from "../diagnostics.js";
import { ApertureSystemError } from "../errors.js";

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
