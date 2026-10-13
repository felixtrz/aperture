import { trackApertureSystemOwner } from "./internal/app-lifecycle.js";
import { computed, signal as createSignal, } from "@preact/signals-core";
import { Children, DebugMetadata, EcsType, Enabled, LocalTransform, Name, Parent, WorldTransform, clamp, clamp01, createSystem as createElicsSystem, defineComponent, expSmoothingAlpha, hexColor, inverseLerp, lerp, lerpAngle, quatFromEuler, quatFromEulerYXZ, quatFromAxisAngle, quatLookAt, quatMultiply, quatNormalize, remap, remapClamped, rotateVec3ByQuat, serializeEntityRef, vec3Add, vec3AddScaled, vec3Cross, vec3Distance, vec3Dot, vec3Length, vec3LengthSq, vec3Normalize, vec3ProjectOnPlane, vec3Scale, vec3Subtract, } from "@aperture-engine/simulation";
import { createScheduledEffects, registerSystemEffects, } from "./systems/effects.js";
import { ApertureSystemError } from "./systems/errors.js";
import { getApertureSystemContext, } from "./systems/context.js";
export { createFollowCameraController, writeFollowCameraPose, } from "./controllers/follow-camera.js";
export { createSpatialQueries } from "./spatial/index.js";
export { Children, DebugMetadata, Enabled, EcsType, LocalTransform, Name, Parent, WorldTransform, computed, createSignal as signal, defineComponent, clamp, clamp01, expSmoothingAlpha, hexColor, inverseLerp, lerp, lerpAngle, quatFromAxisAngle, quatFromEuler, quatFromEulerYXZ, quatLookAt, quatMultiply, quatNormalize, remap, remapClamped, rotateVec3ByQuat, serializeEntityRef, vec3Add, vec3AddScaled, vec3Cross, vec3Distance, vec3Dot, vec3Length, vec3LengthSq, vec3Normalize, vec3ProjectOnPlane, vec3Scale, vec3Subtract, };
export { AudioSimulationSpace, 
// Render authoring components apps commonly need to query or mutate from
// systems (e.g. a camera-aspect system) without reaching into the
// transitive @aperture-engine/render package (battletest finding F28).
Camera, Light, Visibility, } from "@aperture-engine/render";
export { ParticleSimulationSpace } from "@aperture-engine/particles";
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
export { color } from "./systems/color.js";
export { createMaterialAccess } from "./systems/materials.js";
export { createMeshAccess } from "./systems/meshes.js";
export { createTrailAccess } from "./systems/trails.js";
export { createPhysicsAccess } from "./systems/physics.js";
export { createFixedStepAccess } from "./systems/fixed-step.js";
// Re-export from the leaf interaction modules rather than the `interaction`
// barrel: the barrel's `export *` cannot be traced by rolldown (Vite's bundler)
// through the `systems -> interaction/access -> systems/components` cycle, which
// broke `vite build` for generated apps (see GH #24).
export { createInteractionAccess } from "./interaction/access.js";
export { PointerInteractionState } from "./interaction/pointer-events.js";
export { runInteractionFrame } from "./interaction/system.js";
export { runUiScrollFrame, UI_SCROLL_DISABLED_DIAGNOSTIC, } from "./interaction/ui-scroll.js";
export { LIGHT_RIG_PRESETS, MATERIAL_APPEARANCE_PRESETS, MATERIAL_APPEARANCE_PRESET_VERSION, createMaterialAppearancePreset, material, mesh, physics, shader, } from "./systems/spawn/index.js";
export { createApertureSystemContext, installApertureSystemContext, } from "./systems/context.js";
export { createApertureRandom, restoreApertureRandom, snapshotApertureRandom, } from "./systems/random.js";
export { advanceApertureFrameTime, createApertureFrameTime, restoreApertureFrameTime, resetApertureFrameTime, snapshotApertureFrameTime, } from "./systems/frame-time.js";
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
            trackApertureSystemOwner(this.world, this);
            const systemName = this.#deterministicSystemName();
            this.#effects = createScheduledEffects({
                runCallback: ({ phase, callback }) => this.#context.determinism.run({ system: systemName, phase: `effect:${phase}` }, callback),
            });
            this.#wrapDeterministicLifecycle(systemName);
            registerSystemEffects(this, this.#effects);
            this.#disposeFixedStep = this.#registerFixedUpdate(args[2]);
        }
        get signals() {
            return this.#context.signals;
        }
        get random() {
            return this.#context.random;
        }
        get time() {
            return this.#context.time;
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
        get determinism() {
            return this.#context.determinism;
        }
        destroy() {
            this.#disposeFixedStep?.();
            this.#effects.dispose();
        }
        #deterministicSystemName() {
            return (this.constructor.name ||
                "AnonymousApertureSystem");
        }
        #wrapDeterministicLifecycle(systemName) {
            this.#wrapDeterministicMethod("init", systemName);
            this.#wrapDeterministicMethod("update", systemName);
            this.#wrapDeterministicMethod("fixedUpdate", systemName);
        }
        #wrapDeterministicMethod(phase, systemName) {
            const original = this[phase];
            if (typeof original !== "function") {
                return;
            }
            Object.defineProperty(this, phase, {
                configurable: true,
                value: (...methodArgs) => this.#context.determinism.run({ system: systemName, phase }, () => runSystemLifecyclePhase(systemName, phase, () => original.apply(this, methodArgs))),
            });
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
/**
 * Run one system lifecycle phase, attributing any thrown error to the system
 * and phase. Without this an exception in init()/update()/fixedUpdate() surfaces
 * as a bare, unattributed message (e.g. `aperture.cli.failed: <message>`), so a
 * consumer cannot tell which system failed (finding F9). Handles both
 * synchronous throws and rejected promises (async lifecycles).
 */
function runSystemLifecyclePhase(systemName, phase, call) {
    try {
        const result = call();
        if (result !== null &&
            typeof result === "object" &&
            typeof result.then === "function") {
            return result.then((value) => value, (error) => {
                throw attributeSystemLifecycleError(systemName, phase, error);
            });
        }
        return result;
    }
    catch (error) {
        throw attributeSystemLifecycleError(systemName, phase, error);
    }
}
function attributeSystemLifecycleError(systemName, phase, error) {
    // Preserve errors that already carry structured Aperture attribution.
    if (error instanceof ApertureSystemError) {
        return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new ApertureSystemError("aperture.system.lifecycleFailed", `System '${systemName}' threw during ${phase}(): ${message}`, `Fix the exception raised in ${systemName}.${phase}(); inspect diagnostic.error.cause.${error instanceof Error && error.stack ? "stack" : "message"} for the original failure.`, { system: systemName, phase }, { cause: error });
    if (error instanceof Error && typeof error.stack === "string") {
        wrapped.stack = `${wrapped.stack ?? wrapped.message}\nCaused by: ${error.stack}`;
    }
    return wrapped;
}
//# sourceMappingURL=systems.js.map