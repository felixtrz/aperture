import { EcsType, LocalTransform, defineComponent, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { MorphTargetWeights } from "/aperture/worker-modules/packages/render/dist/index.js";
import { AnimationMixer, } from "./animation-mixer.js";
export const Animation = defineComponent("aperture.runtime.animation", {
    // The live AnimationDriverState (mixer + target bindings). Held by
    // reference (same-thread); never snapshot-transported.
    state: { type: EcsType.Object, default: null },
}, "Per-entity animation driver: an AnimationMixer plus target entity bindings.");
/** Build driver state from clip bindings + a target-key → entity map. */
export function createAnimationDriverState(input) {
    const mixer = new AnimationMixer();
    for (const { id, clip } of input.clips) {
        mixer.addClip(id, clip);
    }
    return { mixer, targets: input.targets };
}
function readDriverState(entity) {
    if (!entity.hasComponent(Animation)) {
        return null;
    }
    const state = entity.getValue(Animation, "state");
    return state ?? null;
}
/** Engine-owned animation controls for `entity` (throws if it has no driver). */
export function createAnimationAccess(entity) {
    const state = readDriverState(entity);
    if (state === null) {
        throw new Error("createAnimationAccess: entity has no Animation driver state.");
    }
    const { mixer } = state;
    return {
        get clipIds() {
            return mixer.clipIds;
        },
        playClip(clipId, options) {
            mixer.play(clipId, options);
        },
        crossFade(fromClipId, toClipId, durationSeconds) {
            if (mixer.activeClipId !== fromClipId) {
                mixer.play(fromClipId, { loop: "repeat" });
            }
            mixer.crossFadeTo(toClipId, durationSeconds);
        },
        pause() {
            mixer.pause();
        },
        resume() {
            mixer.resume();
        },
        seek(time) {
            mixer.seek(time);
        },
        get activeClipId() {
            return mixer.activeClipId;
        },
        get time() {
            return mixer.time;
        },
        get isCrossFading() {
            return mixer.isCrossFading;
        },
    };
}
/**
 * Advance every animation driver in `world` by `deltaSeconds`, writing blended
 * TRS samples into target `LocalTransform`s and morph weights into target
 * `MorphTargetWeights`. Returns the number of drivers advanced.
 */
export function updateAnimationDrivers(world, deltaSeconds) {
    const query = world.queryManager.registerQuery({ required: [Animation] });
    let advanced = 0;
    for (const entity of query.entities) {
        const state = readDriverState(entity);
        if (state === null) {
            continue;
        }
        const channels = state.mixer.update(deltaSeconds);
        for (const channel of channels) {
            const target = state.targets.get(channel.targetId);
            if (target === undefined || !target.hasComponent(LocalTransform)) {
                continue;
            }
            target.getVectorView(LocalTransform, channel.path).set(channel.value);
        }
        for (const weightChannel of state.mixer.weightChannels) {
            const target = state.targets.get(weightChannel.targetId);
            if (target === undefined || !target.hasComponent(MorphTargetWeights)) {
                continue;
            }
            target.setValue(MorphTargetWeights, "weights", Float32Array.from(weightChannel.value));
            target.setValue(MorphTargetWeights, "targetCount", weightChannel.value.length);
        }
        advanced += 1;
    }
    return advanced;
}
//# sourceMappingURL=animation-driver-system.js.map