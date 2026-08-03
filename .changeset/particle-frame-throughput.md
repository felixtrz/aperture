---
"@aperture-engine/webgpu": minor
---

Stop the particle frame path from blocking on a GPU fence, and extend
frozen-timeline reuse from batched bursts to continuous emitters.

Retiring a dropped particle emitter used to `await queue.onSubmittedWorkDone()`
inside frame assembly before destroying its buffers. Any frame that dropped an
emitter — every frame of a live particle scene, because bursts retire and
per-entity emitters despawn — therefore serialized the renderer against the
GPU, and since the app skips snapshots while a render is in flight, frame
production collapsed exactly when particle churn was highest. Stale buffers are
now removed from the caches immediately and destroyed when the fence resolves,
off the frame's critical path, so the safety property is unchanged (nothing is
destroyed before the work that referenced it completes) while frame assembly
never waits. A burst-batch buffer replaced by a capacity resize goes through the
same retirement instead of an inline destroy.

Per-emitter frame-resource preparation (pipeline, texture, sampler,
soft-particle resources) is no longer `async`. Only render-pipeline creation can
suspend, so once an effect's pipeline is cached the whole lookup returns
synchronously; a frame with 64 warm emitters now yields a handful of microtask
turns instead of one per emitter per frame.

Continuous emitters stepped by exactly zero now reuse the previous frame's pack
instead of resimulating and reuploading it. `writeParticleCpuBuffer` is a pure
function of the CPU particle arrays, the effect, the step delta, and the
emitter's world placement, and `presentationAges` already guarantees a
zero-delta repack is byte-identical — so when the step is zero (`timeScale` 0,
zero simulation speed, or an authored playback clock that has not advanced) and
the emitter has not moved, both the repack and the GPU upload are skipped. This
covers per-entity trail emitters on a frozen timeline, which the batched-burst
frozen-layout reuse never reached: a frozen field of continuous emitters now
reports `simulatedEmitters: 0` and `uploadedBytes: 0` and keeps drawing the same
particles. A frozen emitter that is carried to a new transform still repacks,
and a shared continuous batch skips its upload only while its slice layout is
unchanged. `ParticleFrameReport.simulatedEmitters` and `uploadedBytes` now count
only emitters that actually advanced, on both the single and batched continuous
paths.
