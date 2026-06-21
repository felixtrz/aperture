import { computed, signal as createSignal, } from "/aperture/worker-modules/node_modules/@preact/signals-core/dist/signals-core.mjs";
import { Children, DebugMetadata, EcsType, Enabled, LocalTransform, Name, Parent, WorldTransform, clamp, clamp01, createSystem as createElicsSystem, defineComponent, expSmoothingAlpha, hexColor, inverseLerp, lerp, lerpAngle, quatFromEuler, quatFromEulerYXZ, quatFromAxisAngle, quatLookAt, quatMultiply, quatNormalize, remap, remapClamped, rotateVec3ByQuat, serializeEntityRef, vec3Add, vec3AddScaled, vec3Cross, vec3Distance, vec3Dot, vec3Length, vec3LengthSq, vec3Normalize, vec3ProjectOnPlane, vec3Scale, vec3Subtract, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { createScheduledEffects, registerSystemEffects, } from "./systems/effects.js";
import { ApertureSystemError } from "./systems/errors.js";
import { getApertureSystemContext, } from "./systems/context.js";
export { createFollowCameraController, writeFollowCameraPose, } from "./controllers/follow-camera.js";
export { createSpatialQueries } from "./spatial/index.js";
export { Children, DebugMetadata, Enabled, EcsType, LocalTransform, Name, Parent, WorldTransform, computed, createSignal as signal, defineComponent, clamp, clamp01, expSmoothingAlpha, hexColor, inverseLerp, lerp, lerpAngle, quatFromAxisAngle, quatFromEuler, quatFromEulerYXZ, quatLookAt, quatMultiply, quatNormalize, remap, remapClamped, rotateVec3ByQuat, serializeEntityRef, vec3Add, vec3AddScaled, vec3Cross, vec3Distance, vec3Dot, vec3Length, vec3LengthSq, vec3Normalize, vec3ProjectOnPlane, vec3Scale, vec3Subtract, };
export { AudioSimulationSpace, ParticleSimulationSpace, } from "/aperture/worker-modules/packages/render/dist/index.js";
export { createSignalSummary } from "./systems/signals.js";
export { createResourceStore, defineResource, resource, } from "./systems/resources.js";
export { createStartOptionsAccess, filterSystemStartOptions, } from "./systems/start-options.js";
export { flushApertureSystemEffects } from "./systems/effects.js";
export { createDefaultSystemGltfAssetDecoderProvider } from "./systems/assets.js";
export { systemAssetReadyMetadata } from "./systems/assets.js";
export { AppEntityKey, AppEntitySource, AppEntityTags, RenderInterpolation, registerApertureAppComponents, } from "./systems/components.js";
export { ScreenSpaceFraming, ScreenSpaceFramingFit, createScreenSpaceFraming, } from "./systems/screen-space-framing.js";
export { createGltfInstanceAccess } from "./systems/gltf.js";
export { createHierarchyAccess } from "./systems/hierarchy.js";
export { APERTURE_HTML_BRIDGE_COMMAND_CHANNEL, APERTURE_HTML_EVENT_CHANNEL_PREFIX, HtmlBridgeStateResource, createHtmlBridgeAccess, htmlEventChannel, } from "./systems/html-bridge.js";
export { createPrefabAccess } from "./systems/prefabs.js";
export { createParticleAccess } from "./systems/particles.js";
export { createAudioAccess } from "./systems/audio.js";
export { createMaterialAccess } from "./systems/materials.js";
export { createMeshAccess } from "./systems/meshes.js";
export { createTrailAccess } from "./systems/trails.js";
export { createPhysicsAccess } from "./systems/physics.js";
export { createFixedStepAccess } from "./systems/fixed-step.js";
export { createInteractionAccess, PointerInteractionState, runInteractionFrame, runUiScrollFrame, UI_SCROLL_DISABLED_DIAGNOSTIC, } from "./interaction/index.js";
export { material, mesh, physics, shader } from "./systems/spawn/index.js";
export { createApertureSystemContext, installApertureSystemContext, } from "./systems/context.js";
export { createSpatialIndexPopulationState, populateSpatialIndexFromWorld, } from "./systems/spatial-index-population.js";
export function createSystem(descriptor = {}) {
    const priority = normalizeSystemPriority(descriptor.priority);
    const queries = descriptor.queries ?? {};
    const schema = descriptor.config ?? {};
    const aperture = Object.freeze({
        schedule: Object.freeze({ priority }),
    });
    const Base = createElicsSystem(queries, schema);
    class ApertureSystemBase extends Base {
        static aperture = aperture;
        #context;
        #effects;
        #disposeFixedStep;
        constructor(...args) {
            super(...args);
            this.#context = getApertureSystemContext(this.world);
            this.#effects = createScheduledEffects();
            registerSystemEffects(this, this.#effects);
            this.#disposeFixedStep = this.#registerFixedUpdate(args[2]);
        }
        get signals() {
            return this.#context.signals;
        }
        get resources() {
            return this.#context.resources;
        }
        get startOptions() {
            return this.#context.startOptions;
        }
        get input() {
            return this.#context.input;
        }
        get actions() {
            return this.#context.input.actions;
        }
        get keyboard() {
            return this.#context.input.keyboard;
        }
        get gamepads() {
            return this.#context.input.gamepads;
        }
        get assetsRegistry() {
            return this.#context.assetsRegistry;
        }
        get assets() {
            return this.#context.assets;
        }
        get commands() {
            return this.#context.commands;
        }
        get spawn() {
            return this.#context.spawn;
        }
        get spatial() {
            return this.#context.spatial;
        }
        get cameras() {
            return this.#context.cameras;
        }
        get gltf() {
            return this.#context.gltf;
        }
        get hierarchy() {
            return this.#context.hierarchy;
        }
        get prefabs() {
            return this.#context.prefabs;
        }
        get particles() {
            return this.#context.particles;
        }
        get audio() {
            return this.#context.audio;
        }
        get materials() {
            return this.#context.materials;
        }
        get meshes() {
            return this.#context.meshes;
        }
        get trails() {
            return this.#context.trails;
        }
        get physics() {
            return this.#context.physics;
        }
        get fixedStep() {
            return this.#context.fixedStep;
        }
        get interaction() {
            return this.#context.interaction;
        }
        get html() {
            return this.#context.html;
        }
        get diagnostics() {
            return this.#context.diagnostics;
        }
        get effects() {
            return this.#effects;
        }
        destroy() {
            this.#disposeFixedStep?.();
            this.#effects.dispose();
        }
        #registerFixedUpdate(priorityArg) {
            const fixedUpdate = this.fixedUpdate;
            if (typeof fixedUpdate !== "function" ||
                !this.#context.fixedStep.available) {
                return null;
            }
            const taskPriority = Number.isFinite(priorityArg)
                ? priorityArg
                : priority;
            return this.#context.fixedStep.register((context) => fixedUpdate.call(this, context), { priority: taskPriority });
        }
    }
    return ApertureSystemBase;
}
function normalizeSystemPriority(priority) {
    const normalized = priority ?? 0;
    if (!Number.isFinite(normalized)) {
        throw new ApertureSystemError("aperture.system.invalidPriority", "System descriptor priority must be a finite number.", "Use createSystem({ priority: 0 }) or omit priority.", { priority: normalized });
    }
    return normalized;
}
//# sourceMappingURL=systems.js.map