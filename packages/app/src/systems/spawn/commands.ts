import {
  Camera,
  Light,
  LightKind,
  Material,
  Mesh,
  createCamera,
  createLight,
} from "@aperture-engine/render";
import {
  DebugMetadata,
  assetHandleKey,
  type AssetRegistry,
  type EcsWorld,
} from "@aperture-engine/simulation";
import {
  Animation,
  createAnimationAccess,
  createAnimationDriverState,
  registerRuntimeComponents,
} from "@aperture-engine/runtime";
import type { SystemAssetAccess } from "../assets.js";
import { AppEntitySource } from "../components.js";
import type { SystemDiagnostics } from "../diagnostics.js";
import { ApertureSystemError } from "../errors.js";
import { resolveMaterialHandle, resolveMeshHandle } from "./assets.js";
import {
  applyGltfSourceMetadata,
  firstReplayRootEntity,
  replayGltfLoadedScene,
} from "./gltf.js";
import {
  applySpawnMetadata,
  createEntityWithMetadata,
  upsertDebugMetadata,
} from "./metadata.js";
import { addTransform, writeTransform } from "./transforms.js";
import type { SpawnCommands } from "./types.js";

export function createSpawnCommands(options: {
  readonly world: EcsWorld;
  readonly registry: AssetRegistry;
  readonly diagnostics: SystemDiagnostics;
  readonly assets: SystemAssetAccess;
}): SpawnCommands {
  return {
    camera(input = {}) {
      const entity = createEntityWithMetadata(options.world, input, "camera");
      addTransform(entity, input.transform);
      entity.addComponent(
        Camera,
        createCamera({
          ...(input.camera ?? {}),
          ...(input.fovYDegrees === undefined
            ? {}
            : { fovYRadians: (input.fovYDegrees * Math.PI) / 180 }),
        }),
      );
      return entity;
    },
    light(input = {}) {
      const entity = createEntityWithMetadata(options.world, input, "light");
      addTransform(entity, input.transform);
      entity.addComponent(
        Light,
        createLight({
          ...(input.light ?? {}),
          kind: input.kind ?? input.light?.kind ?? LightKind.Directional,
          ...(input.color === undefined ? {} : { color: input.color }),
          intensity:
            input.illuminance ?? input.intensity ?? input.light?.intensity ?? 1,
        }),
      );
      return entity;
    },
    mesh(input) {
      const entity = createEntityWithMetadata(options.world, input, "mesh");
      const meshHandle = resolveMeshHandle(options, input);
      const materialHandle = resolveMaterialHandle(options, input);

      addTransform(entity, input.transform);
      entity.addComponent(Mesh, { meshId: assetHandleKey(meshHandle) });
      entity.addComponent(Material, {
        materialId: assetHandleKey(materialHandle),
      });
      return entity;
    },
    gltf(handle, input = {}) {
      if (!handle.ready.value) {
        throw new ApertureSystemError(
          "aperture.spawn.gltfNotReady",
          `GLTF asset '${handle.id}' is not ready.`,
          "Use preload: 'blocking', wait for this.assets.gltf(id).ready, or call this.commands.requestAsset(id) before spawning.",
        );
      }

      const loadedScene = handle.scene.value;

      if (loadedScene === null) {
        const entity = createEntityWithMetadata(options.world, input, "gltf");
        addTransform(entity, input.transform);
        entity.addComponent(DebugMetadata, {
          tag: "gltf",
          note: handle.url,
        });
        entity.addComponent(AppEntitySource, {
          kind: "gltf",
          assetId: handle.id,
          gltfNodePath: "placeholder",
        });
        return entity;
      }

      const replay = replayGltfLoadedScene(options.world, loadedScene);
      const root = firstReplayRootEntity(loadedScene, replay);

      applyGltfSourceMetadata(options.world, loadedScene, replay);
      applySpawnMetadata(options.world, root, input, "gltf");
      writeTransform(root, input.transform);
      upsertDebugMetadata(root, {
        tag: "gltf",
        note: handle.url,
      });

      // Bind imported clips to live entities (via the replay key map) and
      // attach an engine animation driver to the root, so the public
      // animation() controls can play/crossfade without hand-rolled sampling.
      if (loadedScene.clips.length > 0) {
        registerRuntimeComponents(options.world);
        root.addComponent(Animation, {
          state: createAnimationDriverState({
            clips: loadedScene.clips.map((clip) => ({
              id: clip.name,
              clip: clip.clip,
            })),
            targets: replay.entitiesByKey,
          }),
        });
      }

      return root;
    },
    animation(entity) {
      return createAnimationAccess(entity);
    },
  };
}
