import { Camera, Fog, Light, LightKind, LightShadowSettings, Material, Mesh, ParticleEmitter, ProceduralSky, RuntimeUniform, ShadowCaster, ShadowReceiver, Skybox, createCamera, createFog, createLight, createLightShadowSettings, createParticleEmitter, createProceduralSky, createRuntimeUniform, createSkybox, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { DebugMetadata, assetHandleKey, componentRegistryFromWorld, instantiatePrefab, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { Animation, createAnimationAccess, createAnimationDriverState, registerRuntimeComponents, } from "/aperture/worker-modules/packages/runtime/dist/index.js";
import { PHYSICS_ENTITY_REF_STRING_FIELDS } from "/aperture/worker-modules/packages/physics/dist/index.js";
import { AppEntitySource } from "../components.js";
import { ApertureSystemError } from "../errors.js";
import { resolveMaterialHandle, resolveMeshHandle } from "./assets.js";
import { applyGltfMaterialOverrides, applyGltfSourceMetadata, firstReplayRootEntity, replayGltfLoadedScene, } from "./gltf.js";
import { applySpawnMetadata, createEntityWithMetadata, upsertDebugMetadata, } from "./metadata.js";
import { applyPhysicsSpawnDescriptor } from "./physics.js";
import { addTransform, writeTransform } from "./transforms.js";
export function createSpawnCommands(options) {
    const commands = {
        camera(input = {}) {
            const entity = createEntityWithMetadata(options.world, input, "camera");
            addTransform(entity, input.transform);
            entity.addComponent(Camera, createCamera({
                ...(input.camera ?? {}),
                ...(input.fovYDegrees === undefined
                    ? {}
                    : { fovYRadians: (input.fovYDegrees * Math.PI) / 180 }),
            }));
            return entity;
        },
        light(input = {}) {
            const entity = createEntityWithMetadata(options.world, input, "light");
            addTransform(entity, input.transform);
            entity.addComponent(Light, createLight({
                ...(input.light ?? {}),
                kind: input.kind ?? input.light?.kind ?? LightKind.Directional,
                ...(input.color === undefined ? {} : { color: input.color }),
                ...(input.groundColor === undefined
                    ? {}
                    : { groundColor: input.groundColor }),
                intensity: input.illuminance ?? input.intensity ?? input.light?.intensity ?? 1,
            }));
            if (input.shadow !== undefined && input.shadow !== false) {
                entity.addComponent(LightShadowSettings, createLightShadowSettings({
                    ...(input.shadow === true ? {} : input.shadow),
                    enabled: true,
                }));
            }
            return entity;
        },
        fog(input = {}) {
            const entity = createEntityWithMetadata(options.world, input, "fog");
            addTransform(entity, input.transform);
            entity.addComponent(Fog, createFog(input));
            return entity;
        },
        skybox(input) {
            const entity = createEntityWithMetadata(options.world, input, "skybox");
            addTransform(entity, input.transform);
            entity.addComponent(Skybox, createSkybox({
                texture: resolveSkyboxTexture(input.texture),
                ...(input.sampler === undefined
                    ? {}
                    : { sampler: input.sampler }),
                ...(input.intensity === undefined
                    ? {}
                    : { intensity: input.intensity }),
            }));
            return entity;
        },
        proceduralSky(input = {}) {
            const entity = createEntityWithMetadata(options.world, input, "procedural-sky");
            addTransform(entity, input.transform);
            entity.addComponent(ProceduralSky, createProceduralSky(input));
            return entity;
        },
        runtimeUniform(input) {
            const entity = createEntityWithMetadata(options.world, input, "runtime-uniform");
            entity.addComponent(RuntimeUniform, createRuntimeUniform({
                key: input.uniformKey,
                values: input.values,
                ...(input.version === undefined ? {} : { version: input.version }),
            }));
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
            // Author both true and false explicitly: `castShadow: false` must attach
            // ShadowCaster{enabled:false} so it actually opts the mesh OUT of casting
            // (meshes cast by default when the component is absent). Leaving it
            // undefined keeps the default-cast behavior.
            if (input.castShadow !== undefined) {
                entity.addComponent(ShadowCaster, { enabled: input.castShadow });
            }
            if (input.receiveShadow !== undefined) {
                entity.addComponent(ShadowReceiver, { enabled: input.receiveShadow });
            }
            applyPhysicsSpawnDescriptor({
                world: options.world,
                entity,
                input: input.physics,
                diagnostics: options.diagnostics,
            });
            return entity;
        },
        particles(input) {
            const entity = createEntityWithMetadata(options.world, input, "particles");
            addTransform(entity, input.transform);
            entity.addComponent(ParticleEmitter, createParticleEmitter({
                ...input,
                effect: resolveParticleEffectHandle(input.effect),
            }));
            return entity;
        },
        physics(input) {
            const entity = createEntityWithMetadata(options.world, input, "physics");
            addTransform(entity, input.transform);
            applyPhysicsSpawnDescriptor({
                world: options.world,
                entity,
                input: input.physics,
                diagnostics: options.diagnostics,
            });
            return entity;
        },
        gltf(handle, input = {}) {
            if (!handle.ready.value) {
                throw new ApertureSystemError("aperture.spawn.gltfNotReady", `GLTF asset '${handle.id}' is not ready.`, "Use preload: 'blocking', wait for this.assets.gltf(id).ready, or call this.commands.requestAsset(id) before spawning.");
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
            applyGltfMaterialOverrides({
                registry: options.registry,
                diagnostics: options.diagnostics,
                scene: loadedScene,
                replay,
                overrides: input.materials,
            });
            if (input.castShadow !== undefined || input.receiveShadow !== undefined) {
                for (const meshEntity of replay.entitiesByKey.values()) {
                    if (!meshEntity.hasComponent(Mesh)) {
                        continue;
                    }
                    // Apply explicit true/false to every mesh in the subtree; `false`
                    // opts the subtree out of casting/receiving (default is to cast).
                    if (input.castShadow !== undefined) {
                        meshEntity.addComponent(ShadowCaster, {
                            enabled: input.castShadow,
                        });
                    }
                    if (input.receiveShadow !== undefined) {
                        meshEntity.addComponent(ShadowReceiver, {
                            enabled: input.receiveShadow,
                        });
                    }
                }
            }
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
        gltfBatch(handle, input) {
            return input.instances.map((instance) => commands.gltf(handle, gltfBatchInstanceOptions(input, instance)));
        },
        prefab(handle, input = {}) {
            const entry = options.registry.get(handle);
            if (entry?.status !== "ready" || entry.asset === null) {
                throw new ApertureSystemError("aperture.spawn.prefabNotReady", `Prefab asset '${handle.id}' is not registered and ready.`, "Register the prefab via this.prefabs.register(document) before spawning it.");
            }
            const result = instantiatePrefab(options.world, entry.asset, {
                registry: componentRegistryFromWorld(options.world, {
                    entityRefStringFields: PHYSICS_ENTITY_REF_STRING_FIELDS,
                }),
                ...(input.transform === undefined
                    ? {}
                    : { transform: input.transform }),
                ...(input.overrides === undefined
                    ? {}
                    : { overrides: input.overrides }),
            });
            if (result.root === null) {
                throw new ApertureSystemError("aperture.spawn.prefabEmpty", `Prefab asset '${handle.id}' produced no root entity.`, "Ensure the prefab document has at least one root entity (a record without a Parent).");
            }
            applySpawnMetadata(options.world, result.root, input, "prefab");
            return result.root;
        },
        animation(entity) {
            return createAnimationAccess(entity);
        },
    };
    return commands;
}
function resolveParticleEffectHandle(input) {
    if ("renderHandle" in input) {
        return input.renderHandle;
    }
    return input;
}
function resolveSkyboxTexture(input) {
    if ("renderHandle" in input) {
        return input.renderHandle;
    }
    return input;
}
function gltfBatchInstanceOptions(batch, instance) {
    const materials = instance.materials ?? batch.materials;
    const castShadow = instance.castShadow ?? batch.castShadow;
    const receiveShadow = instance.receiveShadow ?? batch.receiveShadow;
    return {
        ...(instance.key === undefined ? {} : { key: instance.key }),
        ...(instance.name === undefined ? {} : { name: instance.name }),
        ...mergedBatchTags(batch.tags, instance.tags),
        ...(instance.transform === undefined
            ? {}
            : { transform: instance.transform }),
        ...(materials === undefined ? {} : { materials }),
        ...(castShadow === undefined ? {} : { castShadow }),
        ...(receiveShadow === undefined ? {} : { receiveShadow }),
    };
}
function mergedBatchTags(batchTags, instanceTags) {
    if (batchTags === undefined && instanceTags === undefined) {
        return {};
    }
    const tags = [];
    for (const tag of [...(batchTags ?? []), ...(instanceTags ?? [])]) {
        if (!tags.includes(tag)) {
            tags.push(tag);
        }
    }
    return { tags };
}
//# sourceMappingURL=commands.js.map