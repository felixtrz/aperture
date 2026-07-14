---
"@aperture-engine/runtime": minor
---

Animation mixer v2 (parity plan F1) — N-lane weighted blending + additive
layers, the three.js `AnimationMixer` / `AnimationAction` + `makeClipAdditive`
analog. `AnimationMixer` now models an arbitrary number of simultaneous **lanes**
(actions), each carrying `{ clip, weight, speed (timeScale), loop, enabled,
additive }` plus fade state. `playLane(clipId, options)` adds a lane and returns
a live `AnimationLane` handle with chainable controls (`setWeight` / `setSpeed` /
`setLoop` / `setEnabled` / `fadeIn` / `fadeOut` / `seek` / `stop`); compose N
weighted lanes for a blend space (idle/walk/run) and mark a lane `additive: true`
to layer a delta clip (a head-look) on top.

**Blend model.** Each `update(delta)` advances every enabled lane's local time
(reusing the existing once/repeat/pingpong + signed-speed loop logic), applies
each lane's fade ramp to get an effective weight, blends all NON-additive lanes
with the existing normalized `blendAnimationClipSamples` (quaternion
hemisphere-aware), then applies additive lanes on top of that base pose:
translation/scale add `weight · delta`, rotation premultiplies the base by a
weight-scaled `slerp(identity, delta, weight)` delta quaternion, and morph
weights add `weight · delta`. An additive-only target (a head-look over a rig
whose base clips never touch the head) synthesizes a rest base
(translation `0` / scale `1` / rotation identity) so the layer still produces a
channel.

**Additive delta clips.** `makeAdditiveClip(clip, { referenceClip?, referenceTime? })`
is the `AnimationUtils.makeClipAdditive` analog: it converts a clip into
per-keyframe deltas relative to a reference pose sampled from `referenceClip`
(default: the clip itself) at `referenceTime` — `sampled − reference` for
translation/scale/weights and `inverse(reference) ⊗ sampled` for rotation. New
supporting primitives ship in `animation-blending.ts`: `multiplyQuaternions`,
`conjugateQuaternion`, `slerpQuaternions`, `scaleQuaternionRotation`,
`applyAdditiveAnimationChannels`, and `applyAdditiveWeightDeltas`.

**Backward compatible.** The v1 single-clip + one-crossfade surface
(`play` / `crossFadeTo` / `pause` / `resume` / `seek`, and the getters
`activeClipId` / `time` / `clamped` / `isCrossFading` / `state` /
`weightChannels`) is preserved exactly, re-implemented as thin wrappers over the
lane model: `play` clears all lanes and starts one at weight 1; `crossFadeTo`
fades the current lane out (removing it when fully faded) while fading a new lane
in with the same complementary linear ramp. `AnimationMixerState` gains a
`laneCount` field; every existing mixer/driver/app test and the glb-viewer /
animation-skinning routes are unchanged.

**Determinism.** All math is pure array math with no `Date.now()` / `Math.random()`
(lane ids are a monotonic per-mixer counter), so identical `(clips, lane setup,
fixed delta sequence)` produces bit-identical channel + morph-weight output — a
replay-equality unit test runs the same fixed-step schedule twice over a
three-lane blend + additive-look setup and asserts deep equality.

Ships `examples/locomotion-blend`: a two-bone rig whose hip height is a
speed-driven idle/walk/run blend space with an additive head-look layer on top,
rendered through the engine (worker builds the clips + drives the mixer, main
thread renders the two markers). A Playwright e2e drives the `speed` and `look`
inputs to distinct values and asserts the sampled bone pose at a fixed frame —
low speed → idle-dominant (hip low, idle weight ≈ 1), mid speeds → idle↔walk and
walk↔run blends (hip at the weighted-average height), and the additive head-look
yaws the head bone by the same amount at idle AND at the walk/run blend (proving
the additive layer is independent of the locomotion base), with half look weight
producing half the yaw — plus a same-input replay for determinism.

Limitations (honest): the clip format is unchanged (translation/rotation/scale/
weights channels only — no property tracks), and lane **synchronization** (three.js
`syncWith` / `AnimationAction` events like `finished`/`loop`) is not implemented;
IK is a separate item (F2). `makeAdditiveClip` produces LINEAR delta clips
(CUBICSPLINE tangents are resampled to keyframe values), which keeps the delta
math exact and allocation-light.
