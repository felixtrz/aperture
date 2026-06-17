import {
  AudioSimulationSpace,
  AudioEmitter,
  bumpAudioPlayEpoch,
  createAudioEmitter,
  stopAudioEmitter,
  type AudioDistanceModel,
  type AudioEmitterInput,
  type AudioPanningModel,
} from "@aperture-engine/render";
import type {
  AudioClipHandle,
  EcsWorld,
  Entity,
  Vec3Like,
} from "@aperture-engine/simulation";
import type { SystemAssetAccess, SystemAudioAssetHandle } from "./assets.js";
import { createEntityWithMetadata } from "./spawn/metadata.js";
import { writeTransform } from "./spawn/transforms.js";
import type { SystemTransformInput } from "./spawn/types.js";

export type AudioClipDescriptorInput = AudioClipHandle | SystemAudioAssetHandle;

export interface AudioLowpassOptions {
  /** Cutoff frequency in Hz. Omit for an open filter. */
  readonly frequency?: number;
  /** Resonance/Q. Defaults to the engine's click-free lowpass Q. */
  readonly q?: number;
}

export interface AudioAutomationTarget {
  /** Target value for a click-free frame-to-frame automation update. */
  readonly target: number;
}

export type AudioAutomationNumber = number | AudioAutomationTarget;

export interface AudioLowpassAutomationOptions {
  /** Target cutoff frequency in Hz. */
  readonly frequency?: AudioAutomationNumber;
  /** Target resonance/Q. */
  readonly q?: AudioAutomationNumber;
}

export interface AudioLoopAutomationOptions {
  /** Target gain. The voice manager moves to this value click-free. */
  readonly gain?: AudioAutomationNumber;
  /** Target playback rate multiplier. */
  readonly timeScale?: AudioAutomationNumber;
  /** Mute/unmute via gain-to-zero while keeping loop playback phase alive. */
  readonly muted?: boolean;
  /** Target lowpass filter values, or false to open the authored lowpass. */
  readonly lowpass?: AudioLowpassAutomationOptions | false;
  /** Target lowpass cutoff in Hz. */
  readonly lowpassFrequency?: AudioAutomationNumber;
  /** Target lowpass resonance/Q. */
  readonly lowpassQ?: AudioAutomationNumber;
}

export interface AudioEmitterControlOptions {
  readonly busId?: string;
  readonly gain?: number;
  readonly timeScale?: number;
  readonly muted?: boolean;
  readonly priority?: number;
  readonly seed?: number;
  readonly offsetSec?: number;
  readonly loopStart?: number;
  readonly loopEnd?: number;
  readonly simulationSpace?: AudioSimulationSpace;
  readonly panningModel?: AudioPanningModel;
  readonly distanceModel?: AudioDistanceModel;
  readonly refDistance?: number;
  readonly maxDistance?: number;
  readonly rolloffFactor?: number;
  readonly coneInnerAngle?: number;
  readonly coneOuterAngle?: number;
  readonly coneOuterGain?: number;
  readonly boundsCenter?: Vec3Like;
  readonly audibilityRadius?: number;
  readonly occlusion?: number;
  readonly lowpass?: AudioLowpassOptions | false;
  readonly lowpassFrequency?: number;
  readonly lowpassQ?: number;
  readonly transform?: SystemTransformInput;
}

export interface AudioLoopOptions extends AudioEmitterControlOptions {
  readonly clip: AudioClipDescriptorInput;
  readonly active?: boolean;
}

export interface AudioLoopUpdateOptions extends AudioEmitterControlOptions {
  readonly clip?: AudioClipDescriptorInput;
  readonly active?: boolean;
}

type MutableAudioLoopUpdateOptions = {
  -readonly [TKey in keyof AudioLoopUpdateOptions]: AudioLoopUpdateOptions[TKey];
};

export interface AudioOneShotOptions extends AudioEmitterControlOptions {
  readonly clip: AudioClipDescriptorInput;
}

export interface AudioLoopHandle {
  readonly id: string;
  readonly entity: Entity;
  set(options: AudioLoopUpdateOptions): AudioLoopHandle;
  automate(options: AudioLoopAutomationOptions): AudioLoopHandle;
  /** Silence the loop without tearing down its stable emitter. */
  pause(): AudioLoopHandle;
  /** Make a paused loop audible again. */
  resume(): AudioLoopHandle;
  play(): number;
  stop(): number;
}

export interface AudioAccess {
  /** Resolve a config-authored audio clip by id. */
  clip(id: string): SystemAudioAssetHandle;
  /** Upsert a stable looping emitter owned by ECS. */
  loop(id: string, options: AudioLoopOptions): AudioLoopHandle;
  /** Patch a loop emitter if it exists. Returns null when the id is unknown. */
  set(id: string, options: AudioLoopUpdateOptions): AudioLoopHandle | null;
  /** Patch common loop automation targets if the loop exists. */
  automate(
    id: string,
    options: AudioLoopAutomationOptions,
  ): AudioLoopHandle | null;
  /**
   * Silence a stable loop while preserving its emitter and loop phase. Returns
   * false when the id is unknown.
   */
  pause(id: string): boolean;
  /** Resume a previously paused stable loop. Returns false when unknown. */
  resume(id: string): boolean;
  /** Request a click-free stop of a stable loop. */
  stop(id: string): boolean;
  /** Fire a stable one-shot emitter by bumping its play epoch. */
  playOneShot(id: string, options: AudioOneShotOptions): Entity;
}

export function createAudioAccess(options: {
  readonly world: EcsWorld;
  readonly assets: SystemAssetAccess;
}): AudioAccess {
  const loops = new Map<string, Entity>();
  const oneShots = new Map<string, Entity>();

  const access: AudioAccess = {
    clip(id) {
      return options.assets.audio(id);
    },
    loop(id, loopOptions) {
      const entity = getOrCreateEmitter(
        options.world,
        loops,
        id,
        `audio.loop.${id}`,
      );
      writeTransform(entity, loopOptions.transform ?? {});
      writeFullEmitter(entity, {
        ...toEmitterInput(loopOptions),
        loop: true,
        autoplay: true,
        active: loopOptions.active ?? true,
      });
      return handleFor(access, id, entity);
    },
    set(id, patch) {
      const entity = loops.get(id);
      if (entity === undefined) {
        return null;
      }
      if (patch.transform !== undefined) {
        writeTransform(entity, patch.transform);
      }
      patchEmitter(entity, patch);
      return handleFor(access, id, entity);
    },
    automate(id, automation) {
      return access.set(id, automationPatch(automation));
    },
    pause(id) {
      const entity = loops.get(id);
      if (entity === undefined) {
        return false;
      }
      patchEmitter(entity, { active: true, muted: true });
      return true;
    },
    resume(id) {
      const entity = loops.get(id);
      if (entity === undefined) {
        return false;
      }
      patchEmitter(entity, { active: true, muted: false });
      return true;
    },
    stop(id) {
      const entity = loops.get(id);
      if (entity === undefined) {
        return false;
      }
      stopAudioEmitter(entity);
      return true;
    },
    playOneShot(id, shotOptions) {
      const entity = getOrCreateEmitter(
        options.world,
        oneShots,
        id,
        `audio.oneshot.${id}`,
      );
      writeTransform(entity, shotOptions.transform ?? {});
      writeFullEmitter(entity, {
        ...toEmitterInput(shotOptions),
        loop: false,
        autoplay: true,
        active: true,
      });
      bumpAudioPlayEpoch(entity);
      return entity;
    },
  };

  return access;
}

function getOrCreateEmitter(
  world: EcsWorld,
  entities: Map<string, Entity>,
  id: string,
  key: string,
): Entity {
  const existing = entities.get(id);
  if (existing !== undefined) {
    return existing;
  }

  const entity = createEntityWithMetadata(
    world,
    { key, name: key, tags: ["audio"] },
    "audio",
  );
  writeTransform(entity, {});
  entities.set(id, entity);
  return entity;
}

function handleFor(
  access: AudioAccess,
  id: string,
  entity: Entity,
): AudioLoopHandle {
  return {
    id,
    entity,
    set(options) {
      return access.set(id, options) ?? this;
    },
    automate(options) {
      return access.automate(id, options) ?? this;
    },
    pause() {
      access.pause(id);
      return this;
    },
    resume() {
      access.resume(id);
      return this;
    },
    play() {
      return bumpAudioPlayEpoch(entity);
    },
    stop() {
      return stopAudioEmitter(entity);
    },
  };
}

function automationPatch(
  options: AudioLoopAutomationOptions,
): AudioLoopUpdateOptions {
  const patch: MutableAudioLoopUpdateOptions = {};
  assignAutomationIfDefined(patch, "gain", options.gain);
  assignAutomationIfDefined(patch, "timeScale", options.timeScale);
  if (options.muted !== undefined) {
    patch.muted = options.muted;
  }

  if (options.lowpass === false) {
    patch.lowpass = false;
  } else if (options.lowpass !== undefined) {
    patch.lowpass = {
      ...(options.lowpass.frequency === undefined
        ? {}
        : { frequency: automationTarget(options.lowpass.frequency) }),
      ...(options.lowpass.q === undefined
        ? {}
        : { q: automationTarget(options.lowpass.q) }),
    };
  }

  assignAutomationIfDefined(
    patch,
    "lowpassFrequency",
    options.lowpassFrequency,
  );
  assignAutomationIfDefined(patch, "lowpassQ", options.lowpassQ);
  return patch;
}

function toEmitterInput(
  options: AudioEmitterControlOptions & {
    readonly clip: AudioClipDescriptorInput;
  },
): AudioEmitterInput {
  const input: AudioEmitterInput = {
    clip: resolveAudioClipHandle(options.clip),
    simulationSpace: options.simulationSpace ?? AudioSimulationSpace.Local,
    lowpassFrequency: lowpassFrequency(options),
    lowpassQ: lowpassQ(options),
  };
  assignIfDefined(input, "busId", options.busId);
  assignIfDefined(input, "gain", options.gain);
  assignIfDefined(input, "timeScale", options.timeScale);
  assignIfDefined(input, "muted", options.muted);
  assignIfDefined(input, "seed", options.seed);
  assignIfDefined(input, "priority", options.priority);
  assignIfDefined(input, "offsetSec", options.offsetSec);
  assignIfDefined(input, "loopStart", options.loopStart);
  assignIfDefined(input, "loopEnd", options.loopEnd);
  assignIfDefined(input, "panningModel", options.panningModel);
  assignIfDefined(input, "distanceModel", options.distanceModel);
  assignIfDefined(input, "refDistance", options.refDistance);
  assignIfDefined(input, "maxDistance", options.maxDistance);
  assignIfDefined(input, "rolloffFactor", options.rolloffFactor);
  assignIfDefined(input, "coneInnerAngle", options.coneInnerAngle);
  assignIfDefined(input, "coneOuterAngle", options.coneOuterAngle);
  assignIfDefined(input, "coneOuterGain", options.coneOuterGain);
  assignIfDefined(input, "boundsCenter", options.boundsCenter);
  assignIfDefined(input, "audibilityRadius", options.audibilityRadius);
  assignIfDefined(input, "occlusion", options.occlusion);
  return input;
}

function writeFullEmitter(entity: Entity, input: AudioEmitterInput): void {
  const exists = entity.hasComponent(AudioEmitter);
  const data = createAudioEmitter({
    ...input,
    ...(exists && input.playEpoch === undefined
      ? { playEpoch: epochValue(entity.getValue(AudioEmitter, "playEpoch")) }
      : {}),
    ...(exists && input.stopEpoch === undefined
      ? { stopEpoch: epochValue(entity.getValue(AudioEmitter, "stopEpoch")) }
      : {}),
  }) as Required<ReturnType<typeof createAudioEmitter>>;
  if (!exists) {
    entity.addComponent(AudioEmitter, data);
    return;
  }

  entity.setValue(AudioEmitter, "clipId", data.clipId);
  entity.setValue(AudioEmitter, "busId", data.busId);
  entity.setValue(AudioEmitter, "gain", data.gain);
  entity.setValue(AudioEmitter, "timeScale", data.timeScale);
  entity.setValue(AudioEmitter, "loop", data.loop);
  entity.setValue(AudioEmitter, "autoplay", data.autoplay);
  entity.setValue(AudioEmitter, "playEpoch", data.playEpoch);
  entity.setValue(AudioEmitter, "stopEpoch", data.stopEpoch);
  entity.setValue(AudioEmitter, "seed", data.seed);
  entity.setValue(AudioEmitter, "priority", data.priority);
  entity.setValue(AudioEmitter, "muted", data.muted);
  entity.setValue(AudioEmitter, "offsetSec", data.offsetSec);
  entity.setValue(AudioEmitter, "loopStart", data.loopStart);
  entity.setValue(AudioEmitter, "loopEnd", data.loopEnd);
  entity.setValue(AudioEmitter, "simulationSpace", data.simulationSpace);
  entity.setValue(AudioEmitter, "panningModel", data.panningModel);
  entity.setValue(AudioEmitter, "distanceModel", data.distanceModel);
  entity.setValue(AudioEmitter, "refDistance", data.refDistance);
  entity.setValue(AudioEmitter, "maxDistance", data.maxDistance);
  entity.setValue(AudioEmitter, "rolloffFactor", data.rolloffFactor);
  entity.setValue(AudioEmitter, "coneInnerAngle", data.coneInnerAngle);
  entity.setValue(AudioEmitter, "coneOuterAngle", data.coneOuterAngle);
  entity.setValue(AudioEmitter, "coneOuterGain", data.coneOuterGain);
  entity.getVectorView(AudioEmitter, "boundsCenter").set(data.boundsCenter);
  entity.setValue(AudioEmitter, "audibilityRadius", data.audibilityRadius);
  entity.setValue(AudioEmitter, "occlusion", data.occlusion);
  entity.setValue(AudioEmitter, "lowpassFrequency", data.lowpassFrequency);
  entity.setValue(AudioEmitter, "lowpassQ", data.lowpassQ);
  entity.setValue(AudioEmitter, "active", data.active);
}

function patchEmitter(entity: Entity, options: AudioLoopUpdateOptions): void {
  if (!entity.hasComponent(AudioEmitter)) {
    if (options.clip === undefined) {
      return;
    }
    writeFullEmitter(
      entity,
      toEmitterInput({ ...options, clip: options.clip }),
    );
    return;
  }

  if (options.clip !== undefined) {
    entity.setValue(
      AudioEmitter,
      "clipId",
      createAudioEmitter({ clip: resolveAudioClipHandle(options.clip) })
        .clipId ?? "",
    );
  }
  setIfDefined(entity, "busId", options.busId);
  setIfDefined(entity, "gain", options.gain);
  setIfDefined(entity, "timeScale", options.timeScale);
  setIfDefined(entity, "muted", options.muted);
  setIfDefined(entity, "seed", options.seed);
  setIfDefined(entity, "priority", options.priority);
  setIfDefined(entity, "offsetSec", options.offsetSec);
  setIfDefined(entity, "loopStart", options.loopStart);
  setIfDefined(entity, "loopEnd", options.loopEnd);
  setIfDefined(entity, "simulationSpace", options.simulationSpace);
  setIfDefined(entity, "panningModel", options.panningModel);
  setIfDefined(entity, "distanceModel", options.distanceModel);
  setIfDefined(entity, "refDistance", options.refDistance);
  setIfDefined(entity, "maxDistance", options.maxDistance);
  setIfDefined(entity, "rolloffFactor", options.rolloffFactor);
  setIfDefined(entity, "coneInnerAngle", options.coneInnerAngle);
  setIfDefined(entity, "coneOuterAngle", options.coneOuterAngle);
  setIfDefined(entity, "coneOuterGain", options.coneOuterGain);
  if (options.boundsCenter !== undefined) {
    entity
      .getVectorView(AudioEmitter, "boundsCenter")
      .set(options.boundsCenter);
  }
  setIfDefined(entity, "audibilityRadius", options.audibilityRadius);
  setIfDefined(entity, "occlusion", options.occlusion);
  if (options.lowpass !== undefined || options.lowpassFrequency !== undefined) {
    entity.setValue(
      AudioEmitter,
      "lowpassFrequency",
      lowpassFrequency(options),
    );
  }
  if (options.lowpass !== undefined || options.lowpassQ !== undefined) {
    entity.setValue(AudioEmitter, "lowpassQ", lowpassQ(options));
  }
  setIfDefined(entity, "active", options.active);
}

function setIfDefined(
  entity: Entity,
  field: keyof AudioEmitterInput | "active",
  value: unknown,
): void {
  if (value !== undefined) {
    entity.setValue(AudioEmitter, field as never, value as never);
  }
}

function assignIfDefined<TKey extends keyof AudioEmitterInput>(
  target: AudioEmitterInput,
  key: TKey,
  value: AudioEmitterInput[TKey] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function assignAutomationIfDefined<
  TKey extends keyof MutableAudioLoopUpdateOptions,
>(
  target: MutableAudioLoopUpdateOptions,
  key: TKey,
  value: AudioAutomationNumber | undefined,
): void {
  if (value !== undefined) {
    target[key] = automationTarget(value) as never;
  }
}

function automationTarget(value: AudioAutomationNumber): number {
  return typeof value === "number" ? value : value.target;
}

function lowpassFrequency(options: AudioEmitterControlOptions): number {
  if (options.lowpass === false) {
    return 22000;
  }
  return options.lowpass?.frequency ?? options.lowpassFrequency ?? 22000;
}

function lowpassQ(options: AudioEmitterControlOptions): number {
  if (options.lowpass === false) {
    return 0.7;
  }
  return options.lowpass?.q ?? options.lowpassQ ?? 0.7;
}

function resolveAudioClipHandle(
  input: AudioClipDescriptorInput,
): AudioClipHandle {
  if (typeof input === "object" && input !== null && "renderHandle" in input) {
    return (input as SystemAudioAssetHandle).renderHandle;
  }

  return input as AudioClipHandle;
}

function epochValue(value: unknown): number {
  return Number.isInteger(value) ? (value as number) | 0 : 0;
}
