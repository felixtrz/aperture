# Standard Shader Composer TODO

Status: TODO

## Problem

`@aperture-engine/webgpu` does not currently have a real material compiler for
`StandardMaterial`. It has a capable shader variant generator, but the generator
is mostly built from one large WGSL source string plus feature-specific string
replacement passes.

That worked well enough for early vertical slices, but the Shadow Lab parity work
exposed the core risk: a small lighting-model correction had to be mirrored
through several exact string anchors.

The ambient diffuse fix changed the base shader from:

```wgsl
let ambientDiffuse = ambient * baseColor * (1.0 - metallic);
```

to the Three/glTF-aligned Lambert form:

```wgsl
let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * (1.0 / PI);
```

Because shader features are assembled by matching exact WGSL text, the same
expression also had to be updated in the occlusion, IBL, and indirect-channel
variant paths. That is a structural problem: future lighting changes can silently
miss one variant, or a harmless formatting/refactor change can break a feature
in an unrelated shader path.

## Current Shape

The current StandardMaterial path is closer to a pre-node shader chunk system
than to a compiler:

- `standard-shader-source.ts` owns the large base WGSL shader.
- `standard-shader.ts` applies feature-dependent replacements for textures,
  UVs, material factors, alpha, occlusion, emissive, shadows, IBL, fog,
  clearcoat, transmission, skinning, morph targets, and related variants.
- `standard-shader-ibl-sampling.ts`,
  `standard-shader-shadow-sampling.ts`,
  `standard-shader-light-sampling.ts`, and
  `standard-shader-extension-sampling.ts` inject larger feature blocks by
  replacing exact snippets.
- `standard-skinning-shader.ts` and `standard-morph-target-shader.ts` patch the
  vertex path the same way.
- `standard-indirect-channel-shader.ts` rewrites the fragment output shape by
  regexing the generated WGSL.

This is not a full shader graph, AST, or material compiler. The output is useful
and feature-rich, but the assembly mechanism is fragile.

## Why This Matters Before v1

This is now v1-risky because StandardMaterial is the main glTF-aligned material
family. It already carries many cross-cutting feature interactions:

- base color texture
- metallic-roughness texture
- normal map
- occlusion texture
- emissive texture
- alpha mask
- double-sided normals
- direct lights
- clustered local lights
- directional shadows
- point shadows
- shadow arrays
- diffuse IBL
- specular IBL
- fog
- output tonemapping/color space
- clearcoat
- transmission
- skinning
- morph targets
- indirect-channel output

Exact string patching makes these combinations hard to reason about. It also
means tests often assert generated text rather than a stable composition
contract.

## Desired Direction

Do not jump straight to a broad node material system. The right next step is a
small, typed StandardMaterial shader composer that keeps the current material
feature set but stops relying on implicit text anchors.

The composer should model the fragment and vertex shader as structured slots:

- declarations: structs, constants, bindings, varyings
- vertex inputs and outputs
- helper functions
- material sampling statements
- geometric normal and tangent-space normal setup
- light accumulation statements
- direct lighting terms
- indirect diffuse terms
- indirect specular terms
- shadow receiver terms
- emissive term
- alpha/discard policy
- fog/output transform
- fragment output shape

Feature modules should contribute to named slots instead of searching for exact
WGSL lines. The final WGSL can still be emitted as text, but it should be emitted
from structured terms.

Example target shape:

```ts
fragment.indirectDiffuseTerms.add("ambientDiffuse", ambientDiffuseExpression);
fragment.indirectDiffuseTerms.add("diffuseIbl", diffuseIblExpression);
fragment.indirectSpecularTerms.add("specularIbl", specularIblExpression);
fragment.directTerms.add("direct", directExpression);
fragment.emissiveTerm = emissiveExpression;
fragment.shadowReceiver = directionalShadowReceiverExpression;
```

Then final color assembly becomes generated from the term lists, not found and
replaced after the fact.

## Migration Plan

1. Add a small internal Standard shader composition model.
   - Keep it private to `packages/webgpu/src/materials/standard`.
   - Do not expose a public shader API yet.
   - Keep the generated WGSL output intentionally close to the current output so
     pipeline keys and tests stay reviewable.

2. Move fragment color assembly first.
   - Own `ambientDiffuse`, `diffuseIbl`, `specularIbl`, `direct`, and
     `emissive` as structured terms.
   - Remove exact replacements around `let color = ...`.
   - Make shadow receiver composition explicit: direct-only attenuation versus
     current IBL/shadow behavior should be a deliberate policy, not a side effect
     of replacement order.

3. Move material sampling and texture feature injection next.
   - Base color, metallic-roughness, normal, occlusion, and emissive texture
     paths should contribute declarations, bindings, sample statements, and
     final material expressions through slots.

4. Move output-shape transforms.
   - Fog, tonemap/color space, and indirect-channel output should wrap named
     color expressions rather than regex the generated fragment function.

5. Move vertex feature injection.
   - Skinning and morph targets should contribute vertex inputs, bindings,
     helper functions, and position/normal/tangent transform stages through
     vertex slots.

6. Add strict composition diagnostics.
   - Unknown feature combinations should throw or return structured diagnostics
     during shader creation.
   - Duplicate slot ownership should fail loudly.
   - Required slot omissions should fail loudly.

## Acceptance Criteria

- `StandardMaterial` variants no longer depend on matching exact color assembly
  strings such as `let color = ambientDiffuse + direct + ...`.
- Ambient diffuse BRDF changes are made in one place and propagate to all
  variants.
- IBL, shadows, occlusion, emissive, fog, and indirect-channel variants are
  assembled from named terms.
- Existing StandardMaterial shader tests still cover generated WGSL, but at
  least some tests assert the composition contract rather than only final string
  snippets.
- Existing Shadow Lab full-scene rendering still works after the migration.
- Focused WebGPU tests pass, including:
  - `test/webgpu/standard-shader.test.ts`
  - `test/webgpu/standard-indirect-channel-shader.test.ts`
  - `test/webgpu/standard-material-shadow-bind-group.test.ts`
  - shadow frame tests that exercise GLTF caster layouts

## Non-Goals

- Do not build a public node material system in this task.
- Do not add a general WGSL parser unless the smaller composer proves
  insufficient.
- Do not redesign material assets or pipeline keys unless a concrete mismatch
  blocks the composer.
- Do not change visual output except where the current output is demonstrably
  wrong.

## Estimated Work

Small hardening only: 0.5-1 day.

Proper StandardMaterial composer: 3-5 focused days.

Full public material compiler or node graph: 2+ weeks and should be treated as a
separate design effort.
