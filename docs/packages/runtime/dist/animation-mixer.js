/**
 * Headless, ECS-free animation time driver. Owns playback state for one active
 * clip plus a single crossfade lane, and on each `update(delta)` produces pure
 * per-target blended TRS samples (plus blended morph-weight channels). It never
 * touches entities — the ECS driver system (M2-T8) consumes its output — so it
 * is reusable by both unit tests and the worker simulation thread.
 *
 * Extracted from the hand-rolled glb-viewer worker control loop
 * (updateActiveAnimation / applyAnimationAtTime / animationClipLocalTime /
 * wrapTime / startActiveAnimationCrossFade / updateAnimationCrossFadeWeights,
 * examples/glb-viewer.worker.js:5280-5491) and three.js AnimationAction loop /
 * crossFade semantics (references/three.js src/animation/AnimationAction.js).
 * Unlike the worker it uses an internal time accumulator (no playbackOffset
 * recompute) and adds a `pingpong` loop mode.
 */
import { blendAnimationClipSamples, crossFadeTo, sampleAnimationCrossFade, } from "./animation-blending.js";
import { sampleAnimationChannel, } from "./animation-clip.js";
export class AnimationMixer {
    clips = new Map();
    current = null;
    previous = null;
    crossFade = null;
    paused = false;
    lastWeightChannels = [];
    constructor(clips) {
        if (clips !== undefined) {
            for (const [id, clip] of clips) {
                this.clips.set(id, clip);
            }
        }
    }
    /** Register (or replace) a clip the mixer can play by id. */
    addClip(id, clip) {
        this.clips.set(id, clip);
    }
    hasClip(id) {
        return this.clips.has(id);
    }
    /** Ids of all registered clips. */
    get clipIds() {
        return [...this.clips.keys()];
    }
    /** Begin playing `clipId` from `startTime`, replacing any current playback. */
    play(clipId, options = {}) {
        const clip = this.clips.get(clipId);
        if (clip === undefined) {
            throw new Error(`AnimationMixer.play: unknown clip id "${clipId}"`);
        }
        this.current = this.makeLane(clipId, clip, options);
        this.previous = null;
        this.crossFade = null;
        this.paused = false;
    }
    /** Crossfade from the current clip to `clipId` over `durationSeconds`. */
    crossFadeTo(clipId, durationSeconds) {
        const clip = this.clips.get(clipId);
        if (clip === undefined) {
            throw new Error(`AnimationMixer.crossFadeTo: unknown clip id "${clipId}"`);
        }
        if (this.current === null) {
            // Nothing to fade from — behave like a plain play().
            this.play(clipId, {});
            return;
        }
        const from = this.current;
        const to = this.makeLane(clipId, clip, {
            loop: from.loop,
            speed: from.speed,
        });
        this.previous = from;
        this.current = to;
        this.crossFade = {
            fade: crossFadeTo(from.clipId, to.clipId, durationSeconds),
            elapsed: 0,
        };
        this.paused = false;
    }
    pause() {
        this.paused = true;
    }
    resume() {
        this.paused = false;
    }
    /** Scrub the active clip to `time` seconds (clamped to the clip duration). */
    seek(time) {
        if (this.current === null) {
            return;
        }
        const duration = clipDuration(this.current.clip);
        this.current.time = clamp(time, 0, duration);
        this.current.clamped = false;
    }
    get state() {
        return {
            activeClipId: this.current?.clipId ?? null,
            time: this.current?.time ?? 0,
            speed: this.current?.speed ?? 1,
            loop: this.current?.loop ?? "repeat",
            paused: this.paused,
            clamped: this.current?.clamped ?? false,
            crossFading: this.crossFade !== null,
        };
    }
    get activeClipId() {
        return this.current?.clipId ?? null;
    }
    get time() {
        return this.current?.time ?? 0;
    }
    get clamped() {
        return this.current?.clamped ?? false;
    }
    get isCrossFading() {
        return this.crossFade !== null;
    }
    /** Blended morph-target weight channels produced by the last `update()`. */
    get weightChannels() {
        return this.lastWeightChannels;
    }
    /**
     * Advance playback by `deltaSeconds` and return the blended per-target TRS
     * channels. Morph-weight channels are available via {@link weightChannels}.
     * When paused, time does not advance but the current pose is still returned.
     */
    update(deltaSeconds) {
        if (this.current === null) {
            this.lastWeightChannels = [];
            return [];
        }
        const effectiveDelta = this.paused ? 0 : deltaSeconds;
        this.advanceLane(this.current, effectiveDelta);
        let fromWeight = 0;
        let toWeight = 1;
        let crossFadeFinished = false;
        if (this.crossFade !== null && this.previous !== null) {
            this.advanceLane(this.previous, effectiveDelta);
            this.crossFade.elapsed += effectiveDelta;
            const weights = sampleAnimationCrossFade(this.crossFade.fade, this.crossFade.elapsed);
            fromWeight = weights[0]?.weight ?? 0;
            toWeight = weights[1]?.weight ?? 1;
            crossFadeFinished =
                this.crossFade.elapsed >= this.crossFade.fade.durationSeconds;
        }
        const samples = [];
        const weightContributors = new Map();
        this.collectLane(this.current, toWeight, samples, weightContributors);
        if (this.crossFade !== null && this.previous !== null) {
            this.collectLane(this.previous, fromWeight, samples, weightContributors);
        }
        const blended = blendAnimationClipSamples(samples);
        this.lastWeightChannels = finalizeWeightChannels(weightContributors);
        if (crossFadeFinished) {
            this.previous = null;
            this.crossFade = null;
        }
        return blended;
    }
    makeLane(clipId, clip, options) {
        const loop = options.loop ?? "repeat";
        const speed = Number.isFinite(options.speed) ? options.speed : 1;
        const duration = clipDuration(clip);
        const startTime = Number.isFinite(options.startTime)
            ? clamp(options.startTime, 0, duration)
            : 0;
        return {
            clipId,
            clip,
            time: startTime,
            speed,
            loop,
            pingpongDirection: 1,
            clamped: false,
        };
    }
    advanceLane(lane, delta) {
        const duration = clipDuration(lane.clip);
        if (duration <= 0) {
            lane.time = 0;
            return;
        }
        if (delta === 0) {
            return;
        }
        const direction = lane.loop === "pingpong" ? lane.pingpongDirection : 1;
        let next = lane.time + delta * lane.speed * direction;
        switch (lane.loop) {
            case "repeat": {
                lane.time = wrapTime(next, duration);
                lane.clamped = false;
                break;
            }
            case "once": {
                if (next >= duration) {
                    lane.time = duration;
                    lane.clamped = true;
                }
                else if (next <= 0) {
                    lane.time = 0;
                    lane.clamped = true;
                }
                else {
                    lane.time = next;
                    lane.clamped = false;
                }
                break;
            }
            case "pingpong": {
                // Reflect at each endpoint, flipping direction so the clip bounces.
                // Guard against huge deltas with a few reflection iterations.
                let guard = 0;
                while ((next < 0 || next > duration) && guard < 64) {
                    if (next > duration) {
                        next = 2 * duration - next;
                        lane.pingpongDirection = (lane.pingpongDirection * -1);
                    }
                    else if (next < 0) {
                        next = -next;
                        lane.pingpongDirection = (lane.pingpongDirection * -1);
                    }
                    guard += 1;
                }
                lane.time = clamp(next, 0, duration);
                lane.clamped = false;
                break;
            }
        }
    }
    collectLane(lane, weight, samples, weightContributors) {
        if (weight <= 0) {
            return;
        }
        for (const channel of lane.clip.channels) {
            const value = sampleAnimationChannel(channel, lane.time);
            if (channel.path === "weights") {
                accumulateWeightChannel(weightContributors, channel.targetId, value, weight);
                continue;
            }
            samples.push({
                clipId: lane.clipId,
                targetId: channel.targetId,
                // Narrowed: non-"weights" paths are exactly AnimationBlendPath.
                path: channel.path,
                weight,
                value,
            });
        }
    }
}
function accumulateWeightChannel(weightContributors, targetId, value, weight) {
    let entry = weightContributors.get(targetId);
    if (entry === undefined) {
        entry = { value: new Array(value.length).fill(0), weight: 0 };
        weightContributors.set(targetId, entry);
    }
    for (let i = 0; i < value.length; i += 1) {
        entry.value[i] = (entry.value[i] ?? 0) + (value[i] ?? 0) * weight;
    }
    entry.weight += weight;
}
function finalizeWeightChannels(weightContributors) {
    const channels = [];
    for (const [targetId, entry] of weightContributors) {
        const totalWeight = entry.weight;
        const value = totalWeight > 0
            ? entry.value.map((component) => component / totalWeight)
            : entry.value;
        channels.push({
            targetId,
            path: "weights",
            value,
            weight: Number(totalWeight.toFixed(6)),
        });
    }
    return channels;
}
function clipDuration(clip) {
    return Math.max(0, clip.duration);
}
function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
function wrapTime(time, duration) {
    return duration > 0 ? ((time % duration) + duration) % duration : 0;
}
//# sourceMappingURL=animation-mixer.js.map