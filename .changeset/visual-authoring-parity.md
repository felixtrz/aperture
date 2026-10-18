---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
"@aperture-engine/runtime": patch
"@aperture-engine/cli": minor
---

Add portable planar scene reflections and section-loft mesh authoring, with
browser/Dawn examples and an agent iteration guide. Retain fatal worker errors
and promptly release failed frame captures instead of waiting for a dead worker.

Honor environment light intensity, tint and view layers in standard-material IBL,
and expose defaultEnvironmentIntensity for controllable daylight fill.

Add a portable diorama starter with compiled procedural water, and preserve authored call sites in headless geometry diagnostics.

Add a closed faceted beveled-box helper for fitted chamfers on masonry and props.

Add continuous path tubes and endpoint-based profile extrusion, avoiding manual
Euler alignment and detached segments in ropes, branches, beams and roof pieces.

Expose a portable linear reflection tint and update the diorama recipe with
controlled fill, distinct nested surfaces and restrained foliage guidance.

Add a closed faceted icosphere primitive with bounded recursive subdivisions for
portable low-poly foliage and rocks, avoiding repeated hand-built topology.

Expose independent world-space reflection ripple frequency with a compatible default,
and document reference-aware foliage, outward leaflet winding and camera/roof proportions.

Add tested public example recipes for stepped roof-tile courses with closed hip
cuts and branch-attached foliage with deterministic thinning. Document measured
composition corrections and preserve caller-owned ECS layout and materials.
