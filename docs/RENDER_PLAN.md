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
Material textures and ordinary instancing remain supported. Storage shader
composition retains its existing WGSL. The separate `sun-ambient-v1` transport
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
They do not establish a speed improvement. Controlled benchmarks must retain
identical scene data, rendering settings and numerical gates, measure candidates
separately, and report SwiftShader software observations separately from future
physical GPU measurements.

## Measured disposition (2026-10-14)

This implementation is a research candidate, not an accepted performance rewrite.
Two controlled native SwiftShader WebGPU comparisons failed the predeclared
acceptance gate: at least 10% less queue time than the prior owner specialization
in both run orders, greater than reference drift, and no end-to-end regression.
The cached storage plan also failed. A directional-facing shadow shortcut was
measured separately and removed from live shader composition after both blocks
regressed; its exact source and results remain in the experiment evidence.

The existing light-kind, packed-order, filter and owner specializations account
for the large improvement over the original shader. Explicit layouts, uniform
transport and CPU plan caching did not establish an additional GPU advantage.
Do not interpret this work as surpassing Three.js or physical-GPU validation.
Promotion requires new evidence; transmission correctness fixes can be reviewed
separately from this unaccepted performance architecture.
