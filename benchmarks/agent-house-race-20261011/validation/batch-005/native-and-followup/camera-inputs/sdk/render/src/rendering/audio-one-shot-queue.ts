import type { AudioClipHandle, Vec3Like } from "@aperture-engine/simulation";
import type { AudioEmitterPacket, RenderDiagnostic } from "./snapshot.js";

/**
 * A fire-and-forget one-shot request (no long-lived entity). Authored worker-side
 * (e.g. from a `playOneShot` command), drained each frame into transient
 * `AudioEmitterPacket`s with disjoint `{kind:"oneshot", seq}` voice keys.
 */
export interface OneShotRequest {
  readonly clip: AudioClipHandle;
  readonly busId?: string;
  readonly gain?: number;
  readonly timeScale?: number;
  readonly seed?: number;
  readonly worldPos?: Vec3Like;
  /** Spatialize through a PannerNode (default true when a worldPos is given). */
  readonly spatial?: boolean;
}

export interface OneShotEmitterQueueOptions {
  /** Max simultaneous transient emitters; enqueue beyond this is dropped. */
  readonly maxActive?: number;
  /** Max transient emitters promoted from the pending queue per frame. */
  readonly maxPerFrame?: number;
  /** Frames a transient emitter is re-emitted so its voice can start + play. */
  readonly ttlFrames?: number;
}

export interface OneShotEmitterQueue {
  /** Queue a one-shot; returns false (and counts a drop) when at capacity. */
  enqueue(request: OneShotRequest): boolean;
  /** Drain into this frame's transient packets, pushing matrices + diagnostics. */
  drain(
    transforms: number[],
    diagnostics: RenderDiagnostic[],
  ): AudioEmitterPacket[];
  /** Total one-shots dropped due to overflow. */
  readonly droppedCount: number;
  /** Currently-live transient emitters. */
  readonly activeCount: number;
}

interface ActiveOneShot {
  readonly seq: number;
  readonly request: OneShotRequest;
  framesLeft: number;
}

const DEFAULT_MAX_ACTIVE = 32;
const DEFAULT_MAX_PER_FRAME = 8;
const DEFAULT_TTL_FRAMES = 8;

export function createOneShotEmitterQueue(
  options: OneShotEmitterQueueOptions = {},
): OneShotEmitterQueue {
  const maxActive = Math.max(1, options.maxActive ?? DEFAULT_MAX_ACTIVE);
  const maxPerFrame = Math.max(1, options.maxPerFrame ?? DEFAULT_MAX_PER_FRAME);
  const ttlFrames = Math.max(1, options.ttlFrames ?? DEFAULT_TTL_FRAMES);

  const pending: OneShotRequest[] = [];
  const active: ActiveOneShot[] = [];
  let seqCounter = 1;
  let droppedCount = 0;
  let droppedSinceDrain = 0;

  return {
    get droppedCount(): number {
      return droppedCount;
    },
    get activeCount(): number {
      return active.length;
    },
    enqueue(request) {
      if (active.length + pending.length >= maxActive) {
        droppedCount += 1;
        droppedSinceDrain += 1;
        return false;
      }
      pending.push(request);
      return true;
    },
    drain(transforms, diagnostics) {
      let promoted = 0;
      while (
        promoted < maxPerFrame &&
        pending.length > 0 &&
        active.length < maxActive
      ) {
        const request = pending.shift() as OneShotRequest;
        active.push({ seq: seqCounter++, request, framesLeft: ttlFrames });
        promoted += 1;
      }

      const packets: AudioEmitterPacket[] = [];
      for (let index = active.length - 1; index >= 0; index -= 1) {
        const entry = active[index] as ActiveOneShot;
        packets.push(toPacket(entry, transforms));
        entry.framesLeft -= 1;
        if (entry.framesLeft <= 0) {
          active.splice(index, 1);
        }
      }

      if (droppedSinceDrain > 0) {
        diagnostics.push({
          code: "render.audio.oneShotOverflow",
          severity: "warning",
          message: `Dropped ${droppedSinceDrain} one-shot(s): queue at capacity (${maxActive}).`,
        });
        droppedSinceDrain = 0;
      }

      return packets;
    },
  };
}

function toPacket(
  entry: ActiveOneShot,
  transforms: number[],
): AudioEmitterPacket {
  const request = entry.request;
  const px = request.worldPos?.[0] ?? 0;
  const py = request.worldPos?.[1] ?? 0;
  const pz = request.worldPos?.[2] ?? 0;
  const worldTransformOffset = transforms.length;
  // Identity basis translated to the one-shot's world position.
  transforms.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, px, py, pz, 1);
  const spatial = request.spatial ?? request.worldPos !== undefined;

  return {
    key: { kind: "oneshot", seq: entry.seq },
    entity: { index: -1, generation: 0 },
    clip: request.clip,
    clipVersion: 1,
    busId: request.busId ?? "sfx",
    gain: request.gain ?? 1,
    loop: false,
    // autoplay fires the one-shot once on first sight (no playEpoch bump needed).
    autoplay: true,
    playEpoch: 0,
    stopEpoch: 0,
    timeScale: request.timeScale ?? 1,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: spatial ? "world" : "local",
    distanceModel: "inverse",
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    occlusion: 0,
    lowpassFrequency: 22000,
    lowpassQ: 0.7,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    audibility: "audible",
    muted: false,
    worldTransformOffset,
    layerMask: 1,
  };
}
