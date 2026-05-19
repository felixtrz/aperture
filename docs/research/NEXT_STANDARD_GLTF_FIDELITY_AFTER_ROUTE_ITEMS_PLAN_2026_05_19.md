# Next StandardMaterial/glTF Fidelity After Route Items — 2026-05-19

## Context

Normal, occlusion, and emissive transformed texture fixtures now pin exact
JSON-safe slot/readiness/sampler status. The next fidelity slice should stay
test-only and keep hardening existing rendered proof points.

## Candidates

### A. Base-color rotation transform status hardening

The base-color rotation transform fixture already proves pixels/readback, but
its status assertions still use broad transform matching. It can be tightened
to exact transform, readiness slot, sampler mapping, and pipeline assertions.

### B. New glTF material feature

Too broad for this window and risks adding unsupported PBR surface area.

### C. Diagnostics/tooling follow-up

Tracker alignment is fresh, so tooling-only work is lower value than hardening
an existing browser proof.

## Selection

Select `task-1784`: tighten the base-color rotation transform fixture status.

## Acceptance Reminder

Keep the change in `test/e2e/standard-gltf-texture.spec.ts`; preserve existing
pixel/readback and WebGPU warning guards; do not add new runtime features.
