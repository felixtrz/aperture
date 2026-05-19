# First Shadow Pass Command Encoding Plan — 2026-05-19

## Context

The GLTF scene path now has renderer-owned shadow depth texture/view resources,
computed directional shadow matrices, a live uploaded shadow matrix buffer, a
live comparison shadow sampler, and live StandardMaterial shadow group 5 bind
groups. Shadow pass descriptors, caster draw lists, and command plans remain
JSON-safe data only.

Reference anchors inspected:

- `packages/webgpu/src/webgpu/shadow-pass-plan.ts`
- `packages/webgpu/src/webgpu/shadow-caster-draw-list-plan.ts`
- `packages/webgpu/src/webgpu/shadow-caster-command-plan-readiness.ts`
- `packages/webgpu/src/webgpu/render-pass-command-executor.ts`
- `references/engine/src/scene/renderer/render-pass-forward.js`
- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

Common pattern: both reference engines render directional shadow maps as
separate depth-only passes before the forward pass consumes the resulting shadow
map. Aperture should keep the pass as a WebGPU renderer-owned derived view of
ECS extraction data: shadow requests, pass plans, caster lists, matrix-buffer
entries, prepared mesh resources, and depth texture views.

## Options Compared

### Option A — Depth-Only Pipeline Metadata First

Add descriptor-only metadata for a depth-only shadow caster pipeline and keep
command encoding deferred.

Pros:

- Low risk and easy to test.
- Clarifies pipeline key shape before command work.

Cons:

- Does not advance submission.
- Adds another deferred status layer after live resources are already present.

### Option B — Shadow Pass Command Encoder Resource

Create a narrow command-resource report that begins a depth-only render pass for
each planned shadow pass, binds prepared mesh buffers, and records draw counts
against the existing caster command plans. Keep StandardMaterial shadow sampling
deferred.

Pros:

- First real movement from shadow planning to WebGPU command work.
- Uses existing shadow pass, caster list, and matrix-buffer data.
- Can stay JSON-safe by reporting command/pass counts and diagnostics without
  exposing GPU command objects.

Cons:

- Needs a minimal depth-only pipeline contract or a temporary explicit
  diagnostic if a material cannot cast yet.
- Browser validation must distinguish command encoding from visible shadow
  sampling.

### Option C — Submit Shadow Pass Before Encoding Report

Wire shadow pass submission directly into the app frame loop and infer status
from frame diagnostics.

Pros:

- Fastest route to shadow-map execution.

Cons:

- Too broad for one safe slice.
- Risks hiding missing pipeline/caster diagnostics inside frame submission.

## Selected Follow-Up

Select Option B, but scope the first implementation as a JSON-safe
`ShadowPassCommandEncodingReport` that records command-encoding readiness and
draw counts over existing pass/caster/matrix data. It should not wire shadow
sampling into StandardMaterial yet.

The follow-up should:

- Accept shadow pass plans, depth texture resources, shadow matrix buffer
  resources, caster draw lists, and command plans.
- Produce one command-encoding record per shadow pass when all prerequisites are
  available.
- Report missing depth views, matrix buffers, caster lists, and command plans
  with stable diagnostics.
- Keep actual StandardMaterial shadow sampling deferred.
