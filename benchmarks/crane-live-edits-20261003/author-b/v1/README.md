# Three.js persistent crane live-edit adapter, initial submission

Exploratory native-WebGPU continuation of the frozen continuous-wall crane.
The renderer, geometry, lighting and fixed front-quarter camera are reused.
This is not a new visual authoring challenge, score, GPU-memory benchmark or
performance claim. Exact model identity and full authentic transcripts are
unavailable.

## Invocation and boundary

The parent alone runs this source with the frozen shared harness and adopted
`runVerifiedScene`/runtime-pressure lifecycle. Source entry point is `index.html`.
This author launched no browser or server, installed no dependencies, modified
no engine source, and inspected no other engine's authored scene or review.
The first source submission is frozen after the source hash manifest is emitted.
One revision after the author's own native attempt is available; the parent owns
and retains at most three native attempts, including failures, for this engine.

`scene-data.mjs` and `checks.mjs` are byte-for-byte copies of the frozen own source
at `benchmarks/crane-wall-continuity-20261003/sources/b-continuous-front-quarter`.
The `lighting.mjs` function body is copied verbatim, with only an ES module export
added. The continuous wall remains the frozen native Shape/ExtrudeGeometry
construction. Materials, ACES, exposure, environment, light positions/intensities,
shadow settings, background, orthographic camera and 1024-square DPR-1 output
retain their previous values. The original three.js module routes remain pinned;
`_getFallback = null` precedes renderer initialization and the backend is checked.

## Persistent native state

- One real Worker is created before boot and retained through completion. Its
  internal revision advances only after it successfully builds/checks the next
  requested state. Requests must be strictly sequential.
- One actual THREE.Scene, one WebGPURenderer/device/canvas, 63 actual Mesh objects,
  the material instances and lighting objects persist.
- The worker rebuilds CPU-only procedural source arrays for each independent
  parameter state. No native scene objects are recreated to simulate edits.
  The inherited temporary CPU ExtrudeGeometry inside the source builder is
  disposed there as before; this is separate from renderer-owned geometry.
- Existing native BufferAttribute arrays are mutated using `.set` and
  `.needsUpdate`; their declared native usage is DynamicDrawUsage. Native mesh
  matrices are updated directly. All actual arrays, normals, index buffers and
  world matrices remain inspectable.
- Array-shape changes have a counted geometry replacement/disposal path, without
  changing Mesh identity. The allowed 29 states do not need it in CPU testing:
  all 63 BufferGeometry and 189 BufferAttribute references remain identical.

## Frame correspondence and evidence

The shared harness owns the 29-state sequence, GPU fence/presentation, PNGs,
immutable recording and READY. Its tracking token is treated as opaque.

For each revision, the adapter installs the exact worker payload, checks every
native CPU array against it, then observes actual fixed-camera Scene and Mesh
render callbacks. Each Mesh draw records its genuine id, geometry/attribute ids,
worker revision and world matrix. Scene.onAfterRender occurs after the pinned
WebGPUBackend.finishRender; its renderer.info.frame and renderer.info.calls
identify the actual frame and render call. A queue counter alone is not used.

After that render, one native GPU command encoder copies each renderer-owned
position/index GPUBuffer, and any allocated normal GPUBuffer, into a reusable
MAP_READ staging buffer. The buffer bytes are compared exactly with the native
CPU bytes installed from the worker. Readback is queued on the same device after
the correlated render. All decoded GPU contents, raw byte arrays, byte order and full stream layout/usage
metadata are retained. Raw current worker-source and native CPU attribute bytes
are also retained separately; JSON-decoded numeric arrays alone cannot preserve
the sign bit of zero. The separate `nativeCpuGeometry` retains the CPU attributes;
`sourceGeometry` retains the full current transferred worker source. World
matrices are freshly read and compared with the exact native draw callbacks.

Flat-shaded materials may derive normals without allocating a native normal
GPUBuffer. Such normals are explicitly identified as CPU BufferAttribute data;
they are never represented as a GPU readback. Missing position or index GPU
buffers, unexpected layout, byte mismatches, missing native draw correspondence,
geometry-check failure or validation error fail the attempt.

Genuine scene/Mesh ids come directly from native objects. Geometry and attribute
ids, versions, capacities and each observed GPUBuffer reference identity are
recorded separately. Counters cover actual constructors, replacement assignments,
dispose calls, CPU writes and observed GPUBuffer-reference changes; staging
allocations and submissions are counted separately. The shared harness separately
counts engine-wide native resource calls. None of these counts measure memory,
residency, speed, leak freedom or GC reclamation.

## Checks and retained limitations

`cpu-check.mjs` uses the pinned three.core.js under Node only. It reads source
modules into memory with local import resolution; there are no disposable fixture
files, browser launches or listening sockets. It tests all 29 states against the
402 inherited geometry checks per state, exact source/native attribute equality,
source/lighting preservation, genuine Mesh/geometry/attribute reference stability,
and a clearly labelled synthetic CPU worker-protocol exercise. These are not
native renderer results. Full CPU logs are retained beside the source.

The first CPU matrix comparison rejected native parent multiplication's benign
normalization of negative zero to positive zero. The retained failure diagnostic
is `cpu-check-failure-001.log`. Matrix comparison now uses exact numeric equality
(+0 and -0 equivalent), not byte equality and without a wider tolerance. The
actual GPU-versus-CPU comparison remains byte-exact, and raw bytes survive in
evidence separately from JSON numerical geometry equivalence. The original
empty stdout capture is retained as `cpu-check-result.json`.

Native rendering, actual GPU readback, fixed-camera native draw coverage, PNG
readout after presentation and independent static-golden matching still require
the parent's approved native attempt. No success is claimed for those unrun
checks. All native failures must be retained. The worker and runtime intentionally
remain alive through harness completion; the parent's lifecycle owns cleanup.
