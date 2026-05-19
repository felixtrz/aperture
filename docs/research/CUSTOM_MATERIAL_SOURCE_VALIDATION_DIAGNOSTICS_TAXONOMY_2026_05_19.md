# Custom Material Source Validation Diagnostics Taxonomy

Date: 2026-05-19

Task: `task-1713`

## Purpose

Define a non-binding diagnostics taxonomy for future public custom material
source asset validation after Decision 0012.

This document does not add validators, public TypeScript APIs, package exports,
app-owned adapter facade options, prepared-resource adapters, shaders, rendered
custom material families, IBL, shadows, or binary GLB loading.

## Boundary

Source validation diagnostics answer: "Is this source material asset shape valid
as data?"

They are separate from:

- route diagnostics: whether a queued material can find a compatible route or
  adapter;
- dependency readiness diagnostics: whether referenced textures, samplers,
  shaders, buffers, lights, or environment inputs are available;
- preparation diagnostics: whether renderer-owned resources can be prepared
  from valid source and dependency data;
- frame-resource diagnostics: whether prepared resources can be assembled for a
  draw route;
- pipeline diagnostics: whether a specialized pipeline can be created or used;
  and
- app facade diagnostics: whether app-owned adapter registration is allowed and
  complete.

## Candidate Code Families

Use a dedicated `customMaterialSource.*` prefix for source shape diagnostics.
Do not reuse route or WebGPU app diagnostic prefixes.

Suggested initial codes:

| Code                                             | Severity | Meaning                                                               |
| ------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| `customMaterialSource.invalidDiscriminator`      | error    | The source does not use the accepted custom-material discriminator.   |
| `customMaterialSource.invalidFamilyKey`          | error    | The family key is missing, empty, malformed, or not namespaced.       |
| `customMaterialSource.reservedFamilyKey`         | error    | The family key collides with a built-in or reserved Aperture key.     |
| `customMaterialSource.invalidLabel`              | warning  | The label is missing, empty, or not useful for reports.               |
| `customMaterialSource.invalidRenderState`        | error    | Render-state fields are missing, unknown, or out of accepted range.   |
| `customMaterialSource.invalidPipelineKeyInput`   | error    | Pipeline-key fields are not serializable or use unsupported values.   |
| `customMaterialSource.invalidBindingDeclaration` | error    | A binding declaration is malformed or uses an unsupported binding.    |
| `customMaterialSource.invalidDependency`         | error    | A dependency declaration is malformed or not representable as data.   |
| `customMaterialSource.invalidMetadata`           | warning  | Metadata is not JSON-safe or tries to affect rendering implicitly.    |
| `customMaterialSource.liveRendererObject`        | error    | Source data contains a live WebGPU object, callback, adapter, or map. |

The exact code list should be locked by implementation tests when validators
are added.

## Stable Diagnostic Fields

Future source validation diagnostics should stay small and JSON-safe:

- `code`: stable diagnostic code.
- `severity`: `error` or `warning`.
- `message`: actionable human-readable message.
- `familyKey`: the candidate custom family key, when available.
- `label`: the source label, when available and safe.
- `field`: dot-path to the invalid source field, such as
  `renderState.alphaMode` or `bindings[0].kind`.
- `expected`: short string or string array describing accepted values.
- `actual`: primitive JSON value or type name, never a full object graph.
- `dependencyName`: stable dependency declaration name, when relevant.
- `bindingName`: stable binding declaration name, when relevant.

Do not include source payload bytes, raw source asset objects, WebGPU handles,
callbacks, adapter instances, cache maps, functions, class instances, cyclic
objects, or mutable renderer state.

## JSON Safety Rules

Allowed diagnostic payload values:

- strings;
- numbers;
- booleans;
- null;
- arrays of those primitive values; and
- small plain records of those primitive values.

Disallowed values:

- `GPUBuffer`, `GPUTexture`, `GPUTextureView`, `GPUSampler`, `GPUBindGroup`,
  `GPUPipeline`, `GPUShaderModule`, or any live backend object;
- callbacks, classes, promises, symbols, maps, sets, weak maps, weak sets, dates,
  typed arrays, array buffers, and source payload bytes;
- adapter objects, app objects, ECS worlds, render worlds, or mutable caches;
  and
- complete source asset objects.

## Validation Phases

The first validator should run before route preparation and before app-owned
adapter facade registration can imply render support.

Recommended phased approach:

1. Shape-only validation: discriminator, `familyKey`, label, render state,
   pipeline-key inputs, binding declarations, dependency declarations, metadata,
   and live-object rejection.
2. Family registration validation: family key registration, duplicate
   registration, and built-in/reserved collisions.
3. Dependency declaration validation: stable texture/sampler/shader/buffer/light
   dependency names and handle/key formats.
4. Preparation compatibility validation: whether a valid source declaration can
   be handled by a registered renderer-owned adapter.

Only phase 1 belongs to the first source-shape validator. Later phases should
use distinct diagnostic prefixes or explicit subcategories if they report
registration, dependency readiness, or renderer preparation failures.

## Relationship To Existing Diagnostics

- `MaterialValidationDiagnostic` currently covers built-in material validation.
  Custom source diagnostics should not be folded into built-in material codes
  until a public type is implemented.
- `standardMaterialTexture.*` diagnostics describe StandardMaterial texture
  readiness and fidelity, not custom source shape validity.
- `queuedMaterialPrepareRoute.*` diagnostics describe route adapter availability
  and material mismatch after source validation has already succeeded.
- `webGpuApp.*` diagnostics describe app-level normalization and reporting, not
  source asset shape ownership.

## Suggested Follow-Up

Add a docs or test-only source validation design slice that turns this taxonomy
into expected validator inputs and outputs. Runtime validation should still wait
until the public custom source TypeScript shape is introduced deliberately.
