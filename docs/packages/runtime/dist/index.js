import { updateSkeletonPalettes } from "./skinning-palette-system.js";
import { createSimulationFixedStepRunner, } from "./fixed-step-schedule.js";
import { Animation, createAnimationDriverState, updateAnimationDrivers, } from "./animation-driver-system.js";
import { AssetRegistry, DebugMetadata, Enabled, EcsType, LocalTransform, Name, Parent, WorldTransform, assetHandleKey, createParent, createRootTransform, createSystem, createWorld, defineComponent, quatFromAxisAngle, registerMetadataComponents, registerTransformComponents, resolveWorldTransforms, } from "@aperture-engine/simulation";
import { Camera, Fog, InstanceData, InstanceTint, Light, LightCookie, LightKind, LightShadowSettings, AudioEmitter, AudioListener, Material, MaterialSlots, Mesh, MorphTargetWeights, OcclusionQuery, ParticleEmitter, ProceduralSky, RenderLayer, RenderOrder, RuntimeUniform, ShadowCaster, ShadowReceiver, Skin, Sprite, Skybox, UiHitTarget, UiImage, UiNode, UiPanel, UiScreen, UiScroll, UiText, Visibility, createCamera, createFog, createInstanceData, createInstanceTint, createLight, createLightCookie, createLightShadowSettings, createMaterialSlots, createMorphTargetWeights, createOcclusionQuery, createAudioEmitter, createAudioListener, createParticleEmitter, createProceduralSky, createRuntimeUniform, createSkin, createSprite, createSkybox, createUiHitTarget, createUiImage, createUiNode, createUiPanel, createRenderExtractionCache, createUiScreen, createUiScroll, createUiText, extractRenderSnapshot, replayGltfEcsAuthoringCommands, registerRenderAuthoringComponents, } from "@aperture-engine/render";
import { Collider, ExternalForce, ExternalImpulse, KinematicTarget, PhysicsCharacterController, PhysicsDebug, PhysicsGravity, PhysicsJoint, PhysicsMaterial, PhysicsVelocity, RigidBody, createCollider, createExternalForce, createExternalImpulse, createKinematicTarget, createPhysicsCharacterController, createPhysicsDebug, createPhysicsGravity, createPhysicsJoint, createPhysicsMaterial, createPhysicsVelocity, createRigidBody, registerPhysicsComponents, } from "@aperture-engine/physics";
export * from "./simulation-worker.js";
export * from "./shared-snapshot-transport.js";
export * from "./animation-blending.js";
export * from "./animation-clip.js";
export * from "./animation-mixer.js";
export * from "./skinning-palette-system.js";
export * from "./animation-driver-system.js";
export * from "./fixed-step-schedule.js";
export * from "@aperture-engine/physics";
export const Spin = defineComponent("aperture.runtime.spin", {
    radiansPerSecond: { type: EcsType.Float32, default: 1 },
    axis: { type: EcsType.Vec3, default: [0, 1, 0] },
}, "Simple runtime spin component for proof-point examples and tests.");
const SpinSystemBase = createSystem({
    spin: {
        required: [Spin, LocalTransform],
    },
});
export class SpinSystem extends SpinSystemBase {
    update(_delta, time) {
        for (const entity of this.queries.spin.entities) {
            const speed = entity.getValue(Spin, "radiansPerSecond") ?? 1;
            const axis = entity.getVectorView(Spin, "axis");
            const rotation = quatFromAxisAngle([read(axis, 0), read(axis, 1), read(axis, 2)], time * speed);
            entity.getVectorView(LocalTransform, "rotation").set(rotation);
        }
    }
}
export function createSimulationApp(options = {}) {
    const world = options.world ?? createWorld(options.worldOptions);
    const assets = options.assets ?? new AssetRegistry();
    registerTransformComponents(world);
    registerMetadataComponents(world);
    registerRuntimeComponents(world);
    const fixedStep = createSimulationFixedStepRunner(options.fixedStep, {
        world,
        assets,
    });
    const app = {
        world,
        assets,
        spawn(...initializers) {
            const entity = world.createEntity();
            const context = { app, world, assets };
            for (const initializer of initializers) {
                initializer(entity, context);
            }
            return entity;
        },
        registerSystem(system) {
            world.registerSystem(system);
            return this;
        },
        registerFixedStepTask(task, taskOptions) {
            return fixedStep.registerTask(task, taskOptions);
        },
        resetFixedStepClock() {
            fixedStep.reset();
        },
        step(delta = 0, time = 0) {
            const timingStartedAt = nowMilliseconds();
            let timingCursor = timingStartedAt;
            const markTiming = () => {
                const now = nowMilliseconds();
                const elapsed = Math.max(0, now - timingCursor);
                timingCursor = now;
                return elapsed;
            };
            world.update(delta, time);
            const worldUpdateMilliseconds = markTiming();
            // Advance animation drivers (write joint/node LocalTransforms from the
            // mixer) AFTER user systems and BEFORE world-transform resolution (M2-T8).
            updateAnimationDrivers(world, delta);
            const animationMilliseconds = markTiming();
            // Fixed-step work runs after frame-rate ECS updates and animation writes,
            // then before transform resolution so physics writeback can affect the
            // extracted render snapshot in the same frame.
            const fixedStepResult = fixedStep.step(delta, time);
            const fixedStepMilliseconds = markTiming();
            const transform = resolveWorldTransforms(world);
            const transformMilliseconds = markTiming();
            // Compute skin joint palettes from same-frame resolved world transforms,
            // after resolution and before any extraction (M2-T6).
            updateSkeletonPalettes(world);
            const skeletonMilliseconds = markTiming();
            return {
                transform,
                fixedStep: fixedStepResult,
                timing: {
                    totalMilliseconds: Math.max(0, nowMilliseconds() - timingStartedAt),
                    worldUpdateMilliseconds,
                    animationMilliseconds,
                    fixedStepMilliseconds,
                    transformMilliseconds,
                    skeletonMilliseconds,
                },
            };
        },
    };
    return app;
}
function nowMilliseconds() {
    return typeof performance === "undefined" ? Date.now() : performance.now();
}
export function createExtractionApp(options = {}) {
    const app = createSimulationApp(options);
    registerRenderAuthoringComponents(app.world);
    // AI-13: one persistent extraction cache per app instance, threaded into
    // every extraction so unchanged entities are served from cached packets.
    // Output stays byte-identical to a cold extraction (writeback tracks entity
    // versions); the cache stores derived packet data only, never live ECS refs.
    const cache = createRenderExtractionCache();
    let currentTime = 0;
    return {
        ...app,
        step(delta = 0, time = 0) {
            currentTime = time;
            return app.step(delta, time);
        },
        extract(frame = 0) {
            return extractRenderSnapshot(app.world, app.assets, {
                frame,
                time: currentTime,
                cache,
            });
        },
        stepAndExtract(delta = 0, time = 0, frame = 0) {
            currentTime = time;
            app.step(delta, time);
            return extractRenderSnapshot(app.world, app.assets, {
                frame,
                time,
                cache,
            });
        },
    };
}
export function applyGltfEcsCommandPlanToApp(options) {
    return replayGltfEcsAuthoringCommands({
        world: options.app.world,
        plan: options.plan,
        ...(options.registerComponents === undefined
            ? {}
            : { registerComponents: options.registerComponents }),
    });
}
export function registerRuntimeComponents(world) {
    world.registerComponent(Spin);
    world.registerComponent(Animation);
    return world;
}
export function withComponent(component, data) {
    return (entity) => {
        if (data === undefined) {
            entity.addComponent(component);
        }
        else {
            entity.addComponent(component, data);
        }
    };
}
export function withTransform(input = {}) {
    return (entity, context) => {
        registerTransformComponents(context.world);
        const root = createRootTransform(input);
        entity.addComponent(LocalTransform, root.local);
        entity.addComponent(Parent, createParent(input.parent ?? null));
        entity.addComponent(WorldTransform, root.world);
    };
}
export function withMesh(handle) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Mesh, { meshId: assetHandleKey(handle) });
    };
}
export function withMaterial(handle) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Material, { materialId: assetHandleKey(handle) });
    };
}
export function withMaterialSlots(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(MaterialSlots, createMaterialSlots(materialSlotsInput(input)));
    };
}
export function withSprite(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Sprite, createSprite(input));
    };
}
export function withParticleEmitter(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(ParticleEmitter, createParticleEmitter(input));
    };
}
export function withAudioEmitter(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(AudioEmitter, createAudioEmitter(input));
    };
}
export function withAudioListener(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(AudioListener, createAudioListener(input));
    };
}
export function withUiScreen(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(UiScreen, createUiScreen(input));
    };
}
export function withUiNode(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(UiNode, createUiNode(input));
    };
}
export function withUiPanel(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(UiPanel, createUiPanel(input));
    };
}
export function withUiImage(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(UiImage, createUiImage(input));
    };
}
export function withUiText(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(UiText, createUiText(input));
    };
}
export function withUiHitTarget(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(UiHitTarget, createUiHitTarget(input));
    };
}
export function withUiScroll(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(UiScroll, createUiScroll(input));
    };
}
function materialSlotsInput(input) {
    if ("slots" in input) {
        return input;
    }
    return {
        slots: input.map((material, slot) => ({ slot, material })),
    };
}
export function withSkybox(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Skybox, createSkybox(input));
    };
}
export function withProceduralSky(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(ProceduralSky, createProceduralSky(input));
    };
}
export function withRuntimeUniform(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(RuntimeUniform, createRuntimeUniform(input));
    };
}
export function withFog(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Fog, createFog(input));
    };
}
export function withCamera(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Camera, createCamera(input));
    };
}
export function withLight(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Light, createLight(input));
    };
}
export function withLightCookie(texture, input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(LightCookie, createLightCookie({
            ...input,
            texture,
        }));
    };
}
export function withEnvironmentMap(handle, input = {}) {
    return withLight({
        ...input,
        kind: LightKind.Environment,
        environmentMap: handle,
    });
}
export function withLightShadowSettings(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(LightShadowSettings, createLightShadowSettings(input));
    };
}
export function withShadowCaster(enabled = true) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(ShadowCaster, { enabled });
    };
}
export function withShadowReceiver(enabled = true) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(ShadowReceiver, { enabled });
    };
}
export function withVisibility(visible = true) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Visibility, { visible });
    };
}
export function withOcclusionQuery(input = {}) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(OcclusionQuery, createOcclusionQuery(input));
    };
}
export function withRenderLayer(mask = 1) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(RenderLayer, { mask });
    };
}
export function withRenderOrder(value = 0) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(RenderOrder, { value });
    };
}
export function withRigidBody(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(RigidBody, createRigidBody(input));
    };
}
export function withCollider(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(Collider, createCollider(input));
    };
}
export function withPhysicsVelocity(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(PhysicsVelocity, createPhysicsVelocity(input));
    };
}
export function withExternalForce(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(ExternalForce, createExternalForce(input));
    };
}
export function withExternalImpulse(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(ExternalImpulse, createExternalImpulse(input));
    };
}
export function withKinematicTarget(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(KinematicTarget, createKinematicTarget(input));
    };
}
export function withPhysicsGravity(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(PhysicsGravity, createPhysicsGravity(input));
    };
}
export function withPhysicsCharacterController(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(PhysicsCharacterController, createPhysicsCharacterController(input));
    };
}
export function withPhysicsMaterial(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(PhysicsMaterial, createPhysicsMaterial(input));
    };
}
export function withPhysicsJoint(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(PhysicsJoint, createPhysicsJoint(input));
    };
}
export function withPhysicsDebug(input = {}) {
    return (entity, context) => {
        registerPhysicsComponents(context.world);
        entity.addComponent(PhysicsDebug, createPhysicsDebug(input));
    };
}
export function withInstanceTint(color) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(InstanceTint, createInstanceTint({ color }));
    };
}
export function withInstanceData(materialKind, values) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(InstanceData, createInstanceData({ materialKind, values }));
    };
}
export function withSkin(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(Skin, createSkin(input));
    };
}
export function withAnimation(input) {
    return (entity, context) => {
        registerRuntimeComponents(context.world);
        entity.addComponent(Animation, {
            state: createAnimationDriverState(input),
        });
    };
}
export function withMorphTargetWeights(input) {
    return (entity, context) => {
        registerRenderAuthoringComponents(context.world);
        entity.addComponent(MorphTargetWeights, createMorphTargetWeights(input));
    };
}
export function withEnabled(value = true) {
    return (entity, context) => {
        registerMetadataComponents(context.world);
        entity.addComponent(Enabled, { value });
    };
}
export function withName(value) {
    return (entity, context) => {
        registerMetadataComponents(context.world);
        entity.addComponent(Name, { value });
    };
}
export function withDebugMetadata(input) {
    return (entity, context) => {
        registerMetadataComponents(context.world);
        entity.addComponent(DebugMetadata, {
            tag: input.tag ?? "",
            note: input.note ?? "",
        });
    };
}
export function withSpin(input = {}) {
    return (entity, context) => {
        registerRuntimeComponents(context.world);
        entity.addComponent(Spin, {
            radiansPerSecond: input.radiansPerSecond ?? 1,
            axis: input.axis === undefined
                ? [0, 1, 0]
                : [input.axis[0], input.axis[1], input.axis[2]],
        });
    };
}
function read(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Missing value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=index.js.map