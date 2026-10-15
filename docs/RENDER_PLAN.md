# Standard material render planning

The standard renderer finalizes lighting features after shadow, IBL and local
cookie/cluster facts are resolved. Simulation and extraction remain authoritative;
the main thread derives a `StandardRenderPlan` from the received snapshot's batch
key. The plan's feature object drives shader selection, its binding descriptors
drive layout metadata, and the created pipeline carries that same plan into
single and queued frame-resource preparation. Resources use the selected light
transport and transmission producer requirement from this plan.

Repeated structural inputs reuse an immutable pure plan from a bounded cache of
256 entries. Its identity includes feature keys, vertex/deformation flags and
planning options, while excluding material IDs and numeric light values. Supplied
feature objects are copied and derived anew so caller mutation cannot change an
existing plan. Eviction drops only the CPU cache reference; a compiled or submitted
pipeline can continue holding its unchanged plan. Numeric packet packing and
versioned uploads remain live. App pipeline hits skip plan derivation entirely,
and existing pipeline layout records reuse their cached string key through an
app-cache-scoped identity lookup. Clearing the app cache invalidates that lookup.

The first explicit-layout path covers one ambient and one directional light in
the original packed order, one ordinary single 2D PCF sun receiver, and opaque
standard materials without IBL, extensions, fog, deformation or clustered lights.
Material textures and ordinary instancing remain supported. For admitted storage
plans, fixed WGSL arrays describe the existing two-light packet: 58 float words,
12 metadata words and one shadow matrix. Explicit bindings require at least
232, 48 and 64 bytes respectively, including bindings that shader constant
folding can make unreachable. Array lengths become constants; packed data,
runtime updates and shadow sampling remain unchanged. The same narrow route
evaluates Schlick's fifth power by multiplication. This preserves the BRDF,
although floating-point rounding can differ from general `pow` lowering.

The admitted path also prepares draw-constant lighting and texture terms in the
vertex stage. Four flat `vec4` varyings carry sun direction, sun and ambient
radiance, shadow parameters, and base-color UV sine/cosine. The shader uses the
same WGSL functions and live packed buffers as the fragment implementation;
`flat` interpolation preserves each value. Light storage is visible to both
stages, and material uniforms gain vertex visibility only for textured variants.
Numeric updates reuse the existing pipeline and buffer upload machinery.

UV coordinates and their scaled/rotated/offset arithmetic remain in the fragment
stage, as do normal processing, BRDF evaluation, alpha discard and shadow
sampling. This avoids the rounding change of interpolating transformed UVs.
The four varyings follow existing locations within the portable interface budget.
This is a frequency change inside the derived renderer, with no new authoritative
state or worker/extraction dependency.

Eligibility is derived by the plan, never trusted from a caller's feature hint.
Automatic-layout fallback clears the fixed-storage hint before compilation,
including when the device layout cache reaches its admission limit. Other light
counts, shadow owners or material features retain the general path.

The separate `sun-ambient-v1` transport
uses two uniform buffers at the existing light bindings: 240 bytes of f32 data
and 64 bytes of i32 metadata. Original packed words keep their order, with a
count/word-count header in the final metadata vec4. The shader keeps count and
word bounds guards. The controlled comparison rejected this transport: queue and end-to-end
time regressed in both run orders. It remains disabled in the app frame loop.

Explicit bind-group and pipeline layouts belong to the device. Their cache is
shared across frame preparation and admits at most 128 binding-layout variants
per device. Existing variants remain reusable after the cap; a new variant uses a
matching storage shader and automatic layout before native shader creation.
Device identity prevents layout reuse across devices. Material/resource identity
and versioned numeric uploads remain in their existing resource caches.
The full pipeline cache still includes vertex layouts, render state, targets and
sample count; its existing policy is unchanged. An aggregate cap on compiled
pipelines is deferred. Multiple compatible pipelines can share one admitted
layout variant.

Other lighting and material combinations retain automatic layouts and their
existing general algorithms. Authored shader overrides keep automatic layouts,
disable the small uniform specialization and retain the complete LTC resource
contract. Motion and indirect auxiliary output variants also retain automatic
layouts. External receiver resources prevent the ordinary specialization during
frame feature derivation.

Transmission is a producer/consumer requirement in the plan: the scene-color
grab must prepare a float 2D view and filtering sampler for group 3 bindings 14
and 15 before the consuming scene draws. That requirement applies to ordinary,
shadow, IBL and mixed shadow providers. Missing resources are a readiness error;
the producer and sampled view must be verified through actual native resources.

The typed planning and explicit layouts establish a shared renderer contract.
Their original comparisons did not establish a speed improvement. Controlled benchmarks must retain
identical scene data, rendering settings and numerical gates, measure candidates
separately, and report SwiftShader software observations separately from future
physical GPU measurements.

## Measured disposition (2026-10-15)

The flat draw-constant candidate passed its complete predeclared performance gate
on the controlled SwiftShader workload: queue-completion medians were 16.7% /
14.5% below contemporaneous Three.js WebGPU, in forward and reverse order.
Both gains exceeded reference drift. End-to-end medians were 9.4% / 6.5% lower
than Three.js and lower than every other declared Aperture control in both orders.
All measured benchmark images matched their respective engine references exactly. A later confirmation of the unchanged implementation used
all six Three.js/parent/candidate orderings, with 18 fresh processes and 96 measured
frames each. Every block passed: 17.0%–28.0% lower queue latency and 10.5%–21.2%
lower end-to-end latency than Three.js, with all 54 reference images exact.
The two windows are reported separately.

This result supports the narrow software-renderer optimization, not a general
Three.js or physical-GPU superiority claim. No hardware runner is available.
The structural plan, explicit layouts, uniform transport and caching alone did
not establish an additional speed advantage. Earlier failed windows remain
failed. A later opaque-discard deletion also failed its gate and was reverted;
the selected implementation retains discard.

See the complete [acceptance report](../benchmarks/render-plan-architecture-20261014/README.md)
for the run declaration, controls, native correctness checks, repository validation
and retained failures.
