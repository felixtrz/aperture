import {
  EcsType,
  LocalTransform,
  defineComponent,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import { MorphTargetWeights } from "@aperture-engine/render";

import {
  AnimationMixer,
  type AnimationPlayOptions,
} from "./animation-mixer.js";
import type { AnimationClip } from "./animation-clip.js";

/**
 * Engine ECS animation driver: per animated root it owns an {@link
 * AnimationMixer} and, each step, advances it by delta and writes the blended
 * per-target TRS samples into the bound joint/node `LocalTransform`s (and morph
 * weights into `MorphTargetWeights`). This replaces the hand-rolled glb-viewer
 * control loop (applyAnimationAtTime, examples/glb-viewer.worker.js:5311) with
 * an engine system.
 *
 * It is invoked imperatively from the runtime `step()` AFTER `world.update`
 * (user systems) and BEFORE `resolveWorldTransforms` + the joint-palette
 * compute (M2-T6), so the animated pose is same-frame.
 */

/** A clip the mixer can play, keyed by a stable id (e.g. its name). */
export interface AnimationClipBinding {
  readonly id: string;
  readonly clip: AnimationClip;
}

/** Per-entity driver state held on the {@link Animation} component. */
export interface AnimationDriverState {
  readonly mixer: AnimationMixer;
  /** Clip target id (entity key) -> live target entity. */
  readonly targets: ReadonlyMap<string, Entity>;
}

export const Animation = defineComponent(
  "aperture.runtime.animation",
  {
    // The live AnimationDriverState (mixer + target bindings). Held by
    // reference (same-thread); never snapshot-transported.
    state: { type: EcsType.Object, default: null },
  },
  "Per-entity animation driver: an AnimationMixer plus target entity bindings.",
);

/** Build driver state from clip bindings + a target-key → entity map. */
export function createAnimationDriverState(input: {
  readonly clips: Iterable<AnimationClipBinding>;
  readonly targets: ReadonlyMap<string, Entity>;
}): AnimationDriverState {
  const mixer = new AnimationMixer();
  for (const { id, clip } of input.clips) {
    mixer.addClip(id, clip);
  }
  return { mixer, targets: input.targets };
}

/**
 * Public, engine-owned controls for an entity's animation. Delegates to the
 * entity's {@link AnimationMixer}; no hand-rolled sampling.
 */
export interface AnimationAccess {
  readonly clipIds: readonly string[];
  playClip(clipId: string, options?: AnimationPlayOptions): void;
  /** Crossfade from `fromClipId` to `toClipId` over `durationSeconds`. */
  crossFade(
    fromClipId: string,
    toClipId: string,
    durationSeconds: number,
  ): void;
  pause(): void;
  resume(): void;
  seek(time: number): void;
  readonly activeClipId: string | null;
  readonly time: number;
  readonly isCrossFading: boolean;
}

function readDriverState(entity: Entity): AnimationDriverState | null {
  if (!entity.hasComponent(Animation)) {
    return null;
  }
  const state = entity.getValue(Animation, "state") as
    | AnimationDriverState
    | null
    | undefined;
  return state ?? null;
}

/** Engine-owned animation controls for `entity`; no-op when it has no driver. */
export function createAnimationAccess(entity: Entity): AnimationAccess {
  const state = readDriverState(entity);
  if (state === null) {
    return createNoopAnimationAccess();
  }
  const { mixer } = state;
  return {
    get clipIds() {
      return mixer.clipIds;
    },
    playClip(clipId, options) {
      if (mixer.clipIds.length === 0) {
        return;
      }
      mixer.play(clipId, options);
    },
    crossFade(fromClipId, toClipId, durationSeconds) {
      if (mixer.clipIds.length === 0) {
        return;
      }
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

function createNoopAnimationAccess(): AnimationAccess {
  return {
    get clipIds() {
      return [];
    },
    playClip() {},
    crossFade() {},
    pause() {},
    resume() {},
    seek() {},
    get activeClipId() {
      return null;
    },
    get time() {
      return 0;
    },
    get isCrossFading() {
      return false;
    },
  };
}

/**
 * Advance every animation driver in `world` by `deltaSeconds`, writing blended
 * TRS samples into target `LocalTransform`s and morph weights into target
 * `MorphTargetWeights`. Returns the number of drivers advanced.
 */
export function updateAnimationDrivers(
  world: EcsWorld,
  deltaSeconds: number,
): number {
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
      target.setValue(
        MorphTargetWeights,
        "weights",
        Float32Array.from(weightChannel.value),
      );
      target.setValue(
        MorphTargetWeights,
        "targetCount",
        weightChannel.value.length,
      );
    }

    advanced += 1;
  }

  return advanced;
}
