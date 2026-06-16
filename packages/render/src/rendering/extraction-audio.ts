import {
  Enabled,
  WorldTransform,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  AudioEmitter,
  AudioListener,
  AudioSimulationSpace,
  Camera,
  RenderLayer,
} from "./authoring.js";
import type { AudioClipAsset } from "../assets/audio-clip.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { parseAudioClipHandle } from "./extraction-inputs.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";
import { createStableRenderId } from "./snapshot-sort-key.js";
import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  AudioSimulationSpacePacket,
  RenderDiagnostic,
} from "./snapshot.js";

/**
 * Extract intent-only audio emitters into per-frame packets. Unlike particle
 * emitters, audio is NOT frustum-culled (an off-screen / behind-the-camera
 * source must still be heard); audibility virtualization is a main-side concern
 * (AU-9). Each emitter's WORLD matrix rides the shared `transforms` array via
 * `worldTransformOffset`, exactly like a particle emitter.
 */
export function extractAudioEmitters(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  diagnostics: RenderDiagnostic[],
): AudioEmitterPacket[] {
  const query = world.queryManager.registerQuery({ required: [AudioEmitter] });
  const packets: AudioEmitterPacket[] = [];

  for (const entity of sortedEntities(query.entities)) {
    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      diagnostics.push(diagnostic("render.disabled", entity));
      continue;
    }
    if (entity.getValue(AudioEmitter, "active") === false) {
      diagnostics.push(diagnostic("render.audio.inactive", entity));
      continue;
    }
    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }

    const clip = parseAudioClipHandle(
      entity.getValue(AudioEmitter, "clipId") ?? "",
    );

    if (clip === null) {
      diagnostics.push(diagnostic("render.audio.invalidClip", entity));
      continue;
    }

    const entry = assets.get<"audio-clip", AudioClipAsset>(clip);

    if (entry === undefined) {
      diagnostics.push(diagnostic("render.audio.clipMissing", entity, clip));
      continue;
    }
    if (entry.status !== "ready" || entry.asset === null) {
      diagnostics.push(
        diagnostic(`render.audio.clip.${entry.status}`, entity, clip),
      );
      continue;
    }

    const layerMask = entity.hasComponent(RenderLayer)
      ? (entity.getValue(RenderLayer, "mask") ?? 1)
      : 1;
    const worldTransformOffset = pushMatrix(
      transforms,
      readWorldMatrix(entity),
    );
    const simulationSpace: AudioSimulationSpacePacket =
      entity.getValue(AudioEmitter, "simulationSpace") ===
      AudioSimulationSpace.Local
        ? "local"
        : "world";

    // A PannerNode requires maxDistance > refDistance; a misauthored emitter
    // with maxDistance <= refDistance yields a degenerate (linear-model
    // divide-by-zero) falloff. Enforce a strictly-greater range here so neither
    // the PannerNode nor the main-side rolloff scorer ever sees the bad case.
    const refDistance = finitePositive(
      entity.getValue(AudioEmitter, "refDistance"),
      1,
    );
    const maxDistanceRaw = finitePositive(
      entity.getValue(AudioEmitter, "maxDistance"),
      10000,
    );
    const maxDistance =
      maxDistanceRaw > refDistance ? maxDistanceRaw : refDistance + 1;

    packets.push({
      key: { kind: "entity", id: createStableRenderId(entityRef(entity)) },
      entity: entityRef(entity),
      clip,
      clipVersion: entry.version,
      busId: stringOr(entity.getValue(AudioEmitter, "busId"), "sfx"),
      gain: finiteNonNegative(entity.getValue(AudioEmitter, "gain"), 1),
      loop: entity.getValue(AudioEmitter, "loop") === true,
      autoplay: entity.getValue(AudioEmitter, "autoplay") === true,
      playEpoch: finiteInteger(entity.getValue(AudioEmitter, "playEpoch"), 0),
      stopEpoch: finiteInteger(entity.getValue(AudioEmitter, "stopEpoch"), 0),
      timeScale: finiteNonNegative(
        entity.getValue(AudioEmitter, "timeScale"),
        1,
      ),
      priority: finiteInteger(entity.getValue(AudioEmitter, "priority"), 0),
      panningModel:
        entity.getValue(AudioEmitter, "panningModel") === "HRTF"
          ? "HRTF"
          : "equalpower",
      simulationSpace,
      distanceModel: parseDistanceModel(
        entity.getValue(AudioEmitter, "distanceModel"),
      ),
      refDistance,
      maxDistance,
      rolloffFactor: finiteNonNegative(
        entity.getValue(AudioEmitter, "rolloffFactor"),
        1,
      ),
      coneInnerAngle: finiteNumber(
        entity.getValue(AudioEmitter, "coneInnerAngle"),
        360,
      ),
      coneOuterAngle: finiteNumber(
        entity.getValue(AudioEmitter, "coneOuterAngle"),
        360,
      ),
      coneOuterGain: finiteNumber(
        entity.getValue(AudioEmitter, "coneOuterGain"),
        0,
      ),
      offsetSec: finiteNonNegative(
        entity.getValue(AudioEmitter, "offsetSec"),
        0,
      ),
      loopStart: finiteNonNegative(
        entity.getValue(AudioEmitter, "loopStart"),
        0,
      ),
      loopEnd: finiteNonNegative(entity.getValue(AudioEmitter, "loopEnd"), 0),
      seed: finiteInteger(entity.getValue(AudioEmitter, "seed"), 1),
      boundsCenter: readVec3(
        entity.getVectorView(AudioEmitter, "boundsCenter"),
      ),
      audibilityRadius: finiteNonNegative(
        entity.getValue(AudioEmitter, "audibilityRadius"),
        0,
      ),
      occlusion: clamp01(
        finiteNumber(entity.getValue(AudioEmitter, "occlusion"), 0),
      ),
      lowpassFrequency: finitePositive(
        entity.getValue(AudioEmitter, "lowpassFrequency"),
        22000,
      ),
      lowpassQ: finitePositive(entity.getValue(AudioEmitter, "lowpassQ"), 0.7),
      audibility: "audible",
      muted: entity.getValue(AudioEmitter, "muted") === true,
      worldTransformOffset,
      layerMask,
    });
  }

  return packets;
}

/**
 * Extract the single active {@link AudioListener}. The first active listener
 * wins (Bevy semantics); any additional active listener gets a diagnostic and
 * is ignored. Camera fallback when no listener exists lands in AU-5.
 */
export function extractAudioListener(
  world: EcsWorld,
  transforms: number[],
  diagnostics: RenderDiagnostic[],
  hasEmitters: boolean,
): AudioListenerPacket | undefined {
  const query = world.queryManager.registerQuery({ required: [AudioListener] });
  let chosen: AudioListenerPacket | undefined;

  for (const entity of sortedEntities(query.entities)) {
    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      continue;
    }
    if (entity.getValue(AudioListener, "active") === false) {
      continue;
    }
    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }
    if (chosen !== undefined) {
      diagnostics.push(diagnostic("render.audio.multipleListeners", entity));
      continue;
    }

    chosen = {
      listenerId: createStableRenderId(entityRef(entity)),
      entity: entityRef(entity),
      worldTransformOffset: pushMatrix(transforms, readWorldMatrix(entity)),
      masterGain: finiteNonNegative(
        entity.getValue(AudioListener, "masterGain"),
        1,
      ),
    };
  }

  // Fallback: no explicit AudioListener → adopt the highest-priority active
  // Camera's WORLD pose so positional audio "just works" out of the box. Only
  // when the scene actually has emitters, so an audio-free camera scene neither
  // ships a useless listener packet nor forfeits the SharedArrayBuffer path.
  if (chosen === undefined && hasEmitters) {
    const camera = highestPriorityCamera(world);
    if (camera !== undefined) {
      chosen = {
        listenerId: createStableRenderId(entityRef(camera)),
        entity: entityRef(camera),
        worldTransformOffset: pushMatrix(transforms, readWorldMatrix(camera)),
        masterGain: 1,
      };
    }
  }

  return chosen;
}

function highestPriorityCamera(world: EcsWorld): Entity | undefined {
  const query = world.queryManager.registerQuery({ required: [Camera] });
  let best: Entity | undefined;
  let bestPriority = Number.NEGATIVE_INFINITY;

  for (const entity of sortedEntities(query.entities)) {
    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      continue;
    }
    if (!entity.hasComponent(WorldTransform)) {
      continue;
    }
    const priority = finiteInteger(entity.getValue(Camera, "priority"), 0);
    if (best === undefined || priority > bestPriority) {
      best = entity;
      bestPriority = priority;
    }
  }

  return best;
}

function parseDistanceModel(
  value: unknown,
): "inverse" | "linear" | "exponential" {
  return value === "linear" || value === "exponential" ? value : "inverse";
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readVec3(value: unknown): readonly [number, number, number] {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const v = value as ArrayLike<number>;
    return [
      finiteNumber(v[0], 0),
      finiteNumber(v[1], 0),
      finiteNumber(v[2], 0),
    ];
  }
  return [0, 0, 0];
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function finiteInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? (value as number) : fallback;
}

function finitePositive(value: unknown, fallback: number): number {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function finiteNonNegative(value: unknown, fallback: number): number {
  const number = finiteNumber(value, fallback);
  return number >= 0 ? number : fallback;
}
