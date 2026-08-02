import {
  assetHandleKey,
  type AssetRegistry,
  type EcsWorld,
  type ParticleEffectHandle,
  type Vec3Like,
  type Vec4Like,
} from "@aperture-engine/simulation";
import {
  validateParticleEffectAsset,
  type ParticleEffectAsset,
  type ParticleEmitterEffectAsset,
} from "../assets/particles.js";
import type { RenderDiagnostic } from "./snapshot.js";

export interface ParticleVec3Range {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface ParticleVec3RangeInput {
  readonly min: Vec3Like;
  readonly max: Vec3Like;
}

export interface ParticleBurstBudget {
  /** Stable pool identity shared by requests that compete for one ceiling. */
  readonly key: string;
  /** Maximum particles reserved by pending and active bursts in this pool. */
  readonly maxParticles: number;
}

export interface ParticleBurstRequest {
  readonly effect: ParticleEffectHandle;
  readonly count: number;
  readonly position: Vec3Like;
  readonly positionJitter?: ParticleVec3RangeInput;
  readonly velocity?: ParticleVec3RangeInput;
  readonly seed?: number;
  readonly timeScale?: number;
  readonly layerMask?: number;
  readonly boundsCenter?: Vec3Like;
  readonly boundsRadius?: number;
  /** Uniform multiplier applied to the effect's authored particle sizes. */
  readonly sizeScale?: number;
  /** Multiplier applied to the effect's authored launch speed. */
  readonly speedScale?: number;
  /** Multiplier applied to the effect's authored particle lifetime. */
  readonly lifetimeScale?: number;
  /** Per-burst RGBA tint, multiplied over the effect's authored colour. */
  readonly color?: Vec4Like;
  /** World-space emitter rotation applied at particle birth. */
  readonly rotation?: Vec4Like;
  /**
   * Optional hard pool ceiling.
   *
   * Admission reserves particles until the burst retires. Requests are
   * clamped to the remaining room and rejected when the pool is saturated.
   */
  readonly budget?: ParticleBurstBudget;
}

export interface ActiveParticleBurst {
  readonly seq: number;
  readonly request: ParticleBurstRequest;
  readonly effect: ParticleEffectHandle;
  readonly effectVersion: number;
  readonly startFrame: number;
  readonly startTime: number;
  /** Effect-local age accumulated by the queue's mutable playback clock. */
  readonly ageSeconds: number;
  /** Effective per-frame rate (request rate multiplied by the queue clock). */
  readonly playbackTimeScale: number;
  /** Mutable world-root translation shared by every transient burst. */
  readonly origin: readonly [number, number, number];
  readonly ttlSeconds: number;
}

export interface ParticleBurstQueueOptions {
  readonly maxActive?: number;
  readonly maxPerFrame?: number;
}

export interface ParticleBurstQueueSummary {
  readonly maxActive: number;
  readonly maxPerFrame: number;
  readonly pending: number;
  readonly active: number;
  readonly enqueued: number;
  readonly promoted: number;
  readonly dropped: number;
  readonly rejectedNotReady: number;
  readonly rejectedInvalid: number;
  readonly pendingParticles: number;
  readonly activeParticles: number;
  readonly oldestActiveAgeSeconds: number;
  readonly activePlaybackTimeScale: number;
  readonly budgetClamped: number;
  readonly budgetClampedParticles: number;
  readonly budgetRejected: number;
  readonly budgets: readonly {
    readonly key: string;
    readonly maxParticles: number;
    readonly reservedParticles: number;
  }[];
}

export interface ParticleBurstQueue {
  enqueue(request: ParticleBurstRequest): boolean;
  /**
   * Set the shared playback rate for transient bursts already in flight.
   *
   * Unlike the per-request `timeScale`, this is mutable: setting it to zero
   * freezes every active burst without changing its accumulated age.
   */
  setTimeScale(timeScale: number): void;
  /**
   * Translate every active transient burst through one shared world root.
   *
   * This mirrors particle engines that retain particles in map-local
   * coordinates while a camera-relative world root moves beneath them.
   */
  setOrigin(origin: Vec3Like): void;
  drain(input: {
    readonly frame: number;
    readonly time: number;
    readonly assets: AssetRegistry;
    readonly diagnostics: RenderDiagnostic[];
  }): readonly ActiveParticleBurst[];
  summary(): ParticleBurstQueueSummary;
}

const PARTICLE_BURST_QUEUE_GLOBAL = "aperture.render.particleBurstQueue";
const DEFAULT_MAX_ACTIVE = 1024;
const DEFAULT_MAX_PER_FRAME = 64;
const DEFAULT_FRAME_RATE = 60;

export function createParticleBurstQueue(
  options: ParticleBurstQueueOptions = {},
): ParticleBurstQueue {
  const maxActive = Math.max(
    1,
    Math.trunc(options.maxActive ?? DEFAULT_MAX_ACTIVE),
  );
  const maxPerFrame = Math.max(
    1,
    Math.trunc(options.maxPerFrame ?? DEFAULT_MAX_PER_FRAME),
  );
  const pending: ParticleBurstRequest[] = [];
  const active: ActiveParticleBurst[] = [];
  let pendingHead = 0;
  let seqCounter = 1;
  let enqueued = 0;
  let promotedTotal = 0;
  let dropped = 0;
  let droppedSinceDrain = 0;
  let rejectedNotReady = 0;
  let rejectedInvalid = 0;
  let budgetClamped = 0;
  let budgetClampedParticles = 0;
  let budgetRejected = 0;
  let playbackTimeScale = 1;
  let origin: [number, number, number] = [0, 0, 0];
  let lastDrainTime: number | null = null;

  return {
    enqueue(request) {
      let normalized = normalizeRequest(request);
      if (normalized.count <= 0) {
        rejectedInvalid += 1;
        return false;
      }

      const budget = normalized.budget;
      if (budget !== undefined) {
        if (budget.key.length === 0 || budget.maxParticles <= 0) {
          rejectedInvalid += 1;
          return false;
        }
        const remaining = Math.max(
          0,
          budget.maxParticles - reservedBudgetParticles(budget.key),
        );
        if (remaining <= 0) {
          budgetRejected += 1;
          return false;
        }
        if (normalized.count > remaining) {
          budgetClamped += 1;
          budgetClampedParticles += normalized.count - remaining;
          normalized = { ...normalized, count: remaining };
        }
      }

      if (active.length + pendingCount() >= maxActive) {
        dropped += 1;
        droppedSinceDrain += 1;
        return false;
      }

      pending.push(normalized);
      enqueued += 1;
      return true;
    },
    setTimeScale(timeScale) {
      playbackTimeScale = Math.max(0, finite(timeScale));
    },
    setOrigin(nextOrigin) {
      origin = tuple3(nextOrigin);
    },
    drain(input) {
      const rawDelta =
        lastDrainTime === null ? 0 : Math.max(0, input.time - lastDrainTime);
      const frameDelta = Number.isFinite(rawDelta) ? rawDelta : 0;
      lastDrainTime = input.time;
      let promoted = 0;
      while (
        promoted < maxPerFrame &&
        pendingHead < pending.length &&
        active.length < maxActive
      ) {
        const request = pending[pendingHead] as ParticleBurstRequest;
        pendingHead += 1;
        const effectEntry = input.assets.get<
          "particle-effect",
          ParticleEffectAsset
        >(request.effect);
        const effect = effectEntry?.asset;

        if (
          effectEntry?.status !== "ready" ||
          effect === undefined ||
          effect === null
        ) {
          input.diagnostics.push({
            code: "render.particle.burstEffectNotReady",
            severity: "warning",
            assetKey: assetHandleKey(request.effect),
            message: `Dropped particle burst: effect '${assetHandleKey(request.effect)}' is not ready.`,
          });
          rejectedNotReady += 1;
          continue;
        }

        if (effect.type !== "emitter") {
          input.diagnostics.push({
            code: "render.particle.burstCompositeUnsupported",
            severity: "warning",
            assetKey: assetHandleKey(request.effect),
            message: `Dropped particle burst: composite effect '${assetHandleKey(request.effect)}' cannot be emitted as a one-shot burst. Emit a leaf particle effect instead.`,
          });
          rejectedInvalid += 1;
          continue;
        }

        const validation = validateParticleEffectAsset(effect);
        if (!validation.valid) {
          input.diagnostics.push({
            code: "render.particle.burstEffectInvalid",
            severity: "warning",
            assetKey: assetHandleKey(request.effect),
            message: `Dropped particle burst: effect '${assetHandleKey(request.effect)}' is invalid.`,
          });
          rejectedInvalid += 1;
          continue;
        }

        active.push({
          seq: seqCounter++,
          request,
          effect: request.effect,
          effectVersion: effectEntry.version,
          startFrame: input.frame,
          startTime: input.time,
          ageSeconds: 0,
          playbackTimeScale:
            playbackTimeScale * Math.max(0, finite(request.timeScale ?? 1)),
          origin,
          ttlSeconds: particleBurstTtlSeconds(effect, request),
        });
        promoted += 1;
        promotedTotal += 1;
      }
      compactPendingRequests();

      let writeIndex = 0;
      for (let readIndex = 0; readIndex < active.length; readIndex += 1) {
        const burst = active[readIndex] as ActiveParticleBurst;
        const effectiveTimeScale =
          playbackTimeScale * Math.max(0, finite(burst.request.timeScale ?? 1));
        const ageSeconds =
          burst.ageSeconds +
          (burst.startFrame === input.frame
            ? 0
            : frameDelta * effectiveTimeScale);
        if (ageSeconds <= burst.ttlSeconds) {
          active[writeIndex] = {
            ...burst,
            ageSeconds,
            playbackTimeScale: effectiveTimeScale,
            origin,
          };
          writeIndex += 1;
        }
      }
      active.length = writeIndex;

      if (droppedSinceDrain > 0) {
        input.diagnostics.push({
          code: "render.particle.burstOverflow",
          severity: "warning",
          message: `Dropped ${droppedSinceDrain} particle burst(s): queue at capacity (${maxActive}).`,
        });
        droppedSinceDrain = 0;
      }

      return [...active];
    },
    summary() {
      return {
        maxActive,
        maxPerFrame,
        pending: pendingCount(),
        active: active.length,
        enqueued,
        promoted: promotedTotal,
        dropped,
        rejectedNotReady,
        rejectedInvalid,
        pendingParticles: pendingParticleCount(),
        activeParticles: activeParticleCount(),
        oldestActiveAgeSeconds: active[0]?.ageSeconds ?? 0,
        activePlaybackTimeScale: active[0]?.playbackTimeScale ?? 0,
        budgetClamped,
        budgetClampedParticles,
        budgetRejected,
        budgets: budgetSummary(),
      };
    },
  };

  function pendingCount(): number {
    return pending.length - pendingHead;
  }

  function pendingParticleCount(): number {
    let count = 0;
    for (let index = pendingHead; index < pending.length; index += 1) {
      count += pending[index]?.count ?? 0;
    }
    return count;
  }

  function activeParticleCount(): number {
    let count = 0;
    for (const burst of active) {
      count += burst.request.count;
    }
    return count;
  }

  function reservedBudgetParticles(key: string): number {
    let count = 0;
    for (let index = pendingHead; index < pending.length; index += 1) {
      const request = pending[index];
      if (request?.budget?.key === key) {
        count += request.count;
      }
    }
    for (const burst of active) {
      if (burst.request.budget?.key === key) {
        count += burst.request.count;
      }
    }
    return count;
  }

  function budgetSummary(): ParticleBurstQueueSummary["budgets"] {
    const entries = new Map<
      string,
      { key: string; maxParticles: number; reservedParticles: number }
    >();
    const add = (request: ParticleBurstRequest) => {
      const budget = request.budget;
      if (budget === undefined) {
        return;
      }
      const current = entries.get(budget.key);
      if (current === undefined) {
        entries.set(budget.key, {
          key: budget.key,
          maxParticles: budget.maxParticles,
          reservedParticles: request.count,
        });
        return;
      }
      current.maxParticles = Math.max(
        current.maxParticles,
        budget.maxParticles,
      );
      current.reservedParticles += request.count;
    };
    for (let index = pendingHead; index < pending.length; index += 1) {
      const request = pending[index];
      if (request !== undefined) {
        add(request);
      }
    }
    for (const burst of active) {
      add(burst.request);
    }
    return [...entries.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  function compactPendingRequests(): void {
    if (pendingHead === 0) {
      return;
    }

    if (pendingHead >= pending.length) {
      pending.length = 0;
      pendingHead = 0;
      return;
    }

    if (pendingHead < 64 && pendingHead * 2 < pending.length) {
      return;
    }

    pending.splice(0, pendingHead);
    pendingHead = 0;
  }
}

export function installParticleBurstQueue(
  world: EcsWorld,
  queue: ParticleBurstQueue = createParticleBurstQueue(),
): ParticleBurstQueue {
  world.globals[PARTICLE_BURST_QUEUE_GLOBAL] = queue;
  return queue;
}

export function getParticleBurstQueue(
  world: EcsWorld,
): ParticleBurstQueue | null {
  const queue = world.globals[PARTICLE_BURST_QUEUE_GLOBAL];
  return isParticleBurstQueue(queue) ? queue : null;
}

export function getOrCreateParticleBurstQueue(
  world: EcsWorld,
): ParticleBurstQueue {
  return getParticleBurstQueue(world) ?? installParticleBurstQueue(world);
}

export function particleBurstPositionRange(
  request: ParticleBurstRequest,
): ParticleVec3Range {
  const position = tuple3(request.position);
  const jitter = request.positionJitter;

  if (jitter === undefined) {
    return { min: position, max: position };
  }

  const min = tuple3(jitter.min);
  const max = tuple3(jitter.max);

  return {
    min: [position[0] + min[0], position[1] + min[1], position[2] + min[2]],
    max: [position[0] + max[0], position[1] + max[1], position[2] + max[2]],
  };
}

export function particleBurstVelocityRange(
  request: ParticleBurstRequest,
): ParticleVec3Range {
  if (request.velocity === undefined) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
    };
  }

  return {
    min: tuple3(request.velocity.min),
    max: tuple3(request.velocity.max),
  };
}

function particleBurstTtlSeconds(
  effect: ParticleEmitterEffectAsset,
  request: ParticleBurstRequest,
): number {
  const lifetimeSeconds =
    Math.max(effect.runtime.lifetime.max, 0.001) *
    Math.max(0, finite(request.lifetimeScale ?? 1));
  const timeScale = Math.max(0, finite(request.timeScale ?? 1));

  // Age is accumulated in effect-local seconds. Scale the two-frame
  // retirement pad so observable real-time lifetime remains compatible with
  // the previous fixed-rate queue.
  return lifetimeSeconds + (timeScale * 2) / DEFAULT_FRAME_RATE;
}

function normalizeRequest(request: ParticleBurstRequest): ParticleBurstRequest {
  return {
    ...request,
    count: Math.max(0, Math.trunc(request.count)),
    position: tuple3(request.position),
    ...(request.timeScale === undefined
      ? {}
      : { timeScale: Math.max(0, finite(request.timeScale)) }),
    ...(request.positionJitter === undefined
      ? {}
      : {
          positionJitter: {
            min: tuple3(request.positionJitter.min),
            max: tuple3(request.positionJitter.max),
          },
        }),
    ...(request.velocity === undefined
      ? {}
      : {
          velocity: {
            min: tuple3(request.velocity.min),
            max: tuple3(request.velocity.max),
          },
        }),
    ...(request.boundsCenter === undefined
      ? {}
      : { boundsCenter: tuple3(request.boundsCenter) }),
    ...(request.sizeScale === undefined
      ? {}
      : { sizeScale: Math.max(0, finite(request.sizeScale)) }),
    ...(request.speedScale === undefined
      ? {}
      : { speedScale: Math.max(0, finite(request.speedScale)) }),
    ...(request.lifetimeScale === undefined
      ? {}
      : { lifetimeScale: Math.max(0, finite(request.lifetimeScale)) }),
    ...(request.color === undefined ? {} : { color: tuple4(request.color) }),
    ...(request.rotation === undefined
      ? {}
      : { rotation: normalizedQuaternion(request.rotation) }),
    ...(request.budget === undefined
      ? {}
      : {
          budget: {
            key: request.budget.key.trim(),
            maxParticles: Math.max(
              0,
              Math.trunc(finite(request.budget.maxParticles)),
            ),
          },
        }),
  };
}

function tuple3(values: Vec3Like): [number, number, number] {
  return [finite(values[0]), finite(values[1]), finite(values[2])];
}

function tuple4(values: Vec4Like): [number, number, number, number] {
  return [
    finite(values[0]),
    finite(values[1]),
    finite(values[2]),
    finite(values[3]),
  ];
}

function normalizedQuaternion(
  values: Vec4Like,
): [number, number, number, number] {
  const quaternion = tuple4(values);
  const length = Math.hypot(
    quaternion[0],
    quaternion[1],
    quaternion[2],
    quaternion[3],
  );
  if (length <= 0.000001) {
    return [0, 0, 0, 1];
  }
  return [
    quaternion[0] / length,
    quaternion[1] / length,
    quaternion[2] / length,
    quaternion[3] / length,
  ];
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isParticleBurstQueue(value: unknown): value is ParticleBurstQueue {
  return (
    typeof value === "object" &&
    value !== null &&
    "enqueue" in value &&
    "drain" in value &&
    "summary" in value
  );
}
