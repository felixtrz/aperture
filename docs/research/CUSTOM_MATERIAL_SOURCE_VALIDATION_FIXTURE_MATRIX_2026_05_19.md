# Custom Material Source Validation Fixture Matrix

Date: 2026-05-19

Task: `task-1718`

## Purpose

Provide non-binding fixture examples for future custom material source
validation tests.

These examples are expected input/output shapes, not a public TypeScript API.
They should help future validators lock diagnostic behavior without adding
app-owned adapter facades, rendered custom material families, WebGPU resources,
IBL, shadows, or binary GLB loading.

## Fixture Conventions

Example inputs use plain JSON-like records:

- `sourceDiscriminator` stands in for the future custom source discriminator.
- `familyKey` stands in for the registered material family key.
- `renderState`, `pipelineKey`, `bindings`, `dependencies`, and `metadata`
  stand in for Decision 0012 source-shape regions.

Expected diagnostics include only:

- `code`;
- `severity`;
- `field`;
- `familyKey`, when available;
- `label`, when safe;
- `expected`, when concise; and
- `actual`, as a primitive value or type name.

Do not include full source objects, source payload bytes, WebGPU handles,
callbacks, adapter objects, caches, maps, sets, typed arrays, promises, or class
instances.

## Fixture Matrix

| Fixture                        | Input focus                          | Expected diagnostics                                                                                                                                                |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valid-minimal`                | Minimal valid data-only shape        | none                                                                                                                                                                |
| `wrong-discriminator`          | Built-in-like or unknown source tag  | `customMaterialSource.invalidDiscriminator` with `field: "sourceDiscriminator"`                                                                                     |
| `empty-family-key`             | Missing or empty family key          | `customMaterialSource.invalidFamilyKey` with `field: "familyKey"`                                                                                                   |
| `reserved-family-key`          | `standard`, `unlit`, or reserved key | `customMaterialSource.reservedFamilyKey` with `field: "familyKey"`                                                                                                  |
| `empty-label`                  | Empty user label                     | `customMaterialSource.invalidLabel` warning with `field: "label"`                                                                                                   |
| `unknown-alpha-mode`           | Invalid render state enum            | `customMaterialSource.invalidRenderState` with `field: "renderState.alphaMode"`                                                                                     |
| `nonserializable-pipeline-key` | Function/symbol/object key value     | `customMaterialSource.invalidPipelineKeyInput` with `field: "pipelineKey.features[0]"` or matching path                                                             |
| `malformed-binding`            | Binding missing name or kind         | `customMaterialSource.invalidBindingDeclaration` with `field: "bindings[0]"`                                                                                        |
| `malformed-dependency`         | Dependency cannot be represented     | `customMaterialSource.invalidDependency` with `field: "dependencies[0]"`                                                                                            |
| `metadata-affects-rendering`   | Metadata tries to drive rendering    | `customMaterialSource.invalidMetadata` warning with `field: "metadata"`                                                                                             |
| `live-webgpu-object`           | Source contains GPU-like object      | `customMaterialSource.liveRendererObject` with the tightest field path, such as `bindings[0].resource`, and `actual` set to a short type name such as `"GPUBuffer"` |
| `callback-in-source`           | Source contains a function           | `customMaterialSource.liveRendererObject` with the tightest field path and `actual: "function"`                                                                     |

## Example Expected Records

### Empty Family Key

```json
[
  {
    "code": "customMaterialSource.invalidFamilyKey",
    "severity": "error",
    "field": "familyKey",
    "expected": "non-empty namespaced custom material family key",
    "actual": ""
  }
]
```

### Reserved Family Key

```json
[
  {
    "code": "customMaterialSource.reservedFamilyKey",
    "severity": "error",
    "field": "familyKey",
    "familyKey": "standard",
    "expected": "custom family key that does not collide with built-in families",
    "actual": "standard"
  }
]
```

### Live WebGPU Object

```json
[
  {
    "code": "customMaterialSource.liveRendererObject",
    "severity": "error",
    "field": "bindings[0].resource",
    "familyKey": "example.preview/custom",
    "expected": "stable data key or asset handle",
    "actual": "GPUBuffer"
  }
]
```

## Non-Goals

- No accepted public `CustomMaterialAsset` TypeScript interface.
- No validator implementation.
- No app-owned adapter registration.
- No shader module, WGSL, bind group, pipeline, or prepared-resource behavior.
- No browser fixture or rendered pixels.

## Suggested Follow-Up

Turn this matrix into targeted tests only after the public source-shape
TypeScript surface is introduced or a deliberately test-only validator helper is
accepted. Until then, use this document as a design guardrail for diagnostic
payload shape and source-vs-route separation.
