# Aperture Out-of-the-Box Model Lighting Plan

**Status:** Implemented (2026-07-10)  
**Priority:** P0–P2  
**Objective:** Ensure imported glTF models are attractively and correctly lit by default, while preserving source material fidelity and providing actionable diagnostics when a scene cannot render those materials well.

---

## 1. Problem statement

Aperture currently permits a common failure mode:

1. A glTF contains highly metallic materials.
2. The scene has a directional light and uniform ambient light, but no environment map.
3. Aperture’s ambient diffuse term is multiplied by `(1 - metallic)`.
4. Fully metallic materials therefore receive no ambient fill.
5. Without specular image-based lighting, unlit faces become dark and model detail disappears.
6. The renderer produces no diagnostic explaining the problem.

The current GLB viewer and game templates encourage this configuration by using a directional light plus ambient light, while omitting ACES tonemapping, exposure and an environment.

The result is technically valid but visually poor.

---

## 2. Goals

- New Aperture projects display typical glTF models attractively without manual lighting work.
- Physically based metallic materials receive appropriate specular environment lighting.
- Source glTF material values remain unchanged unless the author explicitly selects an appearance preset.
- Agents and developers can inspect material properties without parsing GLB binaries.
- Lighting failures produce specific, actionable diagnostics.
- Headless and headed rendering remain deterministic and verifiable.
- Existing applications retain their current appearance unless they opt into the new defaults or use a newly generated scaffold.

## 3. Non-goals

- Silently correcting every questionable material in imported assets.
- Automatically adding image textures to assets that were authored without them.
- Guaranteeing visual parity with every Three.js renderer configuration.
- Changing existing applications’ lighting through a patch release.
- Replacing artist-authored lighting in production scenes.

---

## 4. Design principles

### Preserve source fidelity

The default import policy remains `source`. Aperture must not silently replace valid glTF metalness, roughness, color or emissive values.

### Fix lighting before modifying materials

A neutral environment is the correct general solution for metallic PBR assets. Material normalization is an explicit fallback for stylized assets.

### Make invalid presentation states observable

A renderer that knows a fully metallic material has no specular environment should report that fact.

### Keep lighting ECS-owned

Lighting presets must spawn normal ECS light and environment entities. They must not create hidden mutable renderer state.

### Separate compatibility defaults from scaffold defaults

Existing runtime defaults may remain unchanged initially. New `game` and `glb-viewer` projects should use the improved presentation profile.

---

# 5. Implementation workstreams

## Workstream A — Establish reproducible lighting fixtures

### LGT-001: Add representative material fixtures

**Priority:** P0  
**Size:** S

Add three small fixtures to the rendering test assets:

1. **Metallic fixture**
   - Multiple base colors.
   - `metallicFactor: 1`.
   - `roughnessFactor: 1`.
   - No textures.

2. **Dielectric fixture**
   - `metallicFactor: 0`.
   - Roughness around `0.6`.
   - No textures.

3. **Textured PBR fixture**
   - Base-color texture.
   - Metallic-roughness texture.
   - Normal texture.

The metallic fixture should reproduce the KMS Space Kit failure without requiring third-party licensed assets.

### Acceptance criteria

- All fixtures load in `assetMode: strict`.
- Material factors can be inspected in automated tests.
- The metallic fixture renders poorly under ambient-plus-directional lighting without an environment.
- The same fixture renders with visible colored midtones and specular separation under the studio profile.
- Fixtures contain no network dependencies.

---

## Workstream B — Correct the IBL capability record

### LGT-002: Reconcile IBL implementation, diagnostics and documentation

**Priority:** P0  
**Size:** M

The renderer contains executable diffuse and specular IBL sampling, but several readiness structures and documents still report shader sampling as deferred.

Update:

- [standard-material-ibl-readiness.ts](/Users/felixz/Projects/aperture/packages/webgpu/src/materials/standard/standard-material-ibl-readiness.ts:24)
- `DIAGNOSTICS_CATALOG.md`
- `ARCHITECTURE.md`
- `RENDER_FRAME_READINESS.md`
- `LIGHT_SHADER_WGSL_CONTRACT.md`
- Any IBL resource summaries that still report obsolete deferred states.

Replace static `shaderSampling: false` fields with state derived from the executable pipeline and bound resources.

### Acceptance criteria

- No active diagnostic claims StandardMaterial IBL sampling is unimplemented when the executable IBL pipeline is selected.
- Readiness reports distinguish:
  - No environment requested.
  - Environment requested but source missing.
  - Environment preparation failed.
  - Diffuse IBL ready.
  - Diffuse and specular IBL ready.
  - IBL pipeline active for the current frame.
- The readiness result agrees with the submitted pipeline key.
- Existing IBL e2e tests remain green.
- Documentation contains one authoritative description of the supported end-to-end IBL path.

---

## Workstream C — Add lighting-health diagnostics

### LGT-003: Implement a material/lighting compatibility analyzer

**Priority:** P0  
**Size:** M

Add a pure, headless-compatible analyzer that examines:

- Visible StandardMaterial instances.
- Material metalness and roughness.
- Active ambient, directional, point and area lights.
- Active environment maps.
- IBL preparation and pipeline state.
- Tonemapping and exposure configuration.

Initial diagnostics:

#### `render.material.metalWithoutSpecularIbl`

Emit when:

- At least one visible material has `metallicFactor >= 0.8`.
- No usable specular environment/IBL is active.

Diagnostic payload:

```ts
{
  code: "render.material.metalWithoutSpecularIbl",
  severity: "warning",
  materialCount: 4,
  entityCount: 7,
  maximumMetallicFactor: 1,
  activeEnvironmentCount: 0,
  message: "Highly metallic materials are visible without specular environment lighting.",
  suggestions: [
    "Add an environment light with an HDR map.",
    "For stylized painted assets, explicitly lower metallicFactor with a material preset."
  ]
}
```

#### `render.output.untoneMappedHighRange`

Emit only when measured pre-output luminance indicates clipping risk and tonemapping is `none`. Avoid warning based solely on authored light intensity.

#### `render.environment.requestedButInactive`

Emit when an environment is authored but is not actually contributing to the selected StandardMaterial pipeline.

### Acceptance criteria

- Metallic fixture plus ambient/directional lighting produces `metalWithoutSpecularIbl`.
- The same fixture with active specular IBL does not produce the warning.
- A dielectric fixture without an environment does not produce the warning.
- Hidden or culled metallic materials do not trigger a visible-scene warning.
- Diagnostics are JSON-safe and deterministic.
- Diagnostics identify affected materials and entities.
- Every warning contains at least one valid Aperture-specific remediation.
- The analyzer can run without a GPU.

---

## Workstream D — Ship a neutral studio environment

### LGT-004: Add a built-in studio HDR reference asset

**Priority:** P0  
**Size:** M

Add a neutral, redistributable studio environment to `@aperture-engine/reference-assets`.

Requirements:

- Neutral white/gray lighting.
- Enough directional variation to reveal surface shape.
- No strong photographic details or colored branding.
- Suitable for both stylized and realistic models.
- Embedded or locally packaged for strict headless use.
- PMREM output cached per renderer/device and source version.

### Acceptance criteria

- Asset license and attribution are documented.
- Asset works without network access.
- `assetMode: strict` loads it successfully.
- Diffuse irradiance and specular PMREM preparation succeed.
- Repeated use shares cached GPU resources.
- No steady-state per-frame environment preparation occurs.
- Compressed package-size increase is no greater than 512 KB unless explicitly approved.
- Default metallic fixture retains its base-color hue and visible form under the environment.

---

## Workstream E — Add ECS lighting presets

### LGT-005: Add `spawn.lightRig`

**Priority:** P0  
**Size:** M

Proposed API:

```ts
this.spawn.lightRig({
  key: "lighting.main",
  preset: "studio-neutral",
  environmentMap: this.assets.hdr("studio"),
  shadows: true,
});
```

The helper should spawn ordinary ECS entities for:

- Environment light.
- Directional key light.
- Optional rim or area light.
- Shadow settings.

Initial presets:

- `studio-neutral`
- `outdoor-neutral`
- `none`

Preset values must be public, inspectable and individually overridable.

### Acceptance criteria

- Every generated light is a normal ECS entity.
- Presets are deterministic.
- Individual light values can be overridden.
- Removing the rig removes all entities it owns.
- The headless snapshot exposes all generated entities and settings.
- No mutable renderer-only scene graph is introduced.
- The studio preset activates diffuse and specular IBL.
- The studio preset produces no metallic-without-IBL warning.

---

### LGT-006: Add direct environment authoring ergonomics

**Priority:** P1  
**Size:** S

Proposed API:

```ts
this.spawn.environment({
  key: "lighting.environment",
  source: this.assets.hdr("studio"),
  intensity: 1,
});
```

This should replace the current need to bury `environmentMap` inside the nested `light` object.

### Acceptance criteria

- The API creates an ECS light with `kind: "environment"`.
- Invalid asset kinds fail with a specific authoring diagnostic.
- Environment intensity is exposed through normal ECS inspection.
- Existing low-level environment-light authoring remains supported.

---

## Workstream F — Improve output defaults

### LGT-007: Use ACES and exposure in visual templates

**Priority:** P0  
**Size:** S

Update new `game` and `glb-viewer` templates:

```ts
render: {
  tonemap: "aces",
  exposure: 1,
  outputColorSpace: "srgb",
  defaultCamera: false,
  defaultLight: false,
  sampleCount: 4,
}
```

Do not change the `minimal` template unless it is explicitly redefined as a visual starter.

Target files include:

- [glb-viewer.ts](/Users/felixz/Projects/aperture/packages/cli/src/create/templates/glb-viewer.ts:69)
- `packages/cli/src/create/templates/game.ts`

### Acceptance criteria

- Newly generated game and GLB viewer projects use ACES.
- Exposure activates the HDR scene path.
- Output color space remains sRGB.
- Existing projects are not rewritten.
- Template generation tests assert the complete render profile.
- Bright highlights roll off instead of hard clipping.
- UI rendering remains correctly composed with the HDR scene.

---

## Workstream G — Explicit material appearance policies

### LGT-008: Improve documentation for existing glTF material patches

**Priority:** P0  
**Size:** S

The existing `materials` option supports appearance changes but is documented mainly as a render-state adjustment.

Document examples for:

- Metalness and roughness normalization.
- Emissive adjustment.
- Base-color tinting.
- Source material preservation.
- Clone/reuse behavior.
- Scope across an imported subtree.

### Acceptance criteria

- `spawn.gltf` API documentation lists all supported StandardMaterial patch fields.
- At least one example demonstrates stylized painted assets.
- Documentation explicitly states that source materials are not mutated.
- Generated type documentation links `materials` to `StandardMaterialPatch`.

---

### LGT-009: Add named material presets

**Priority:** P1  
**Size:** M

Proposed API:

```ts
this.spawn.gltf(model, {
  materials: material.preset("painted-stylized"),
});
```

Initial presets:

| Preset             | Intended use                        |
| ------------------ | ----------------------------------- |
| `source`           | Preserve imported material values   |
| `painted-stylized` | Mostly dielectric painted props     |
| `matte`            | High-roughness nonmetallic surfaces |
| `preview-safe`     | Neutral asset inspection fallback   |

Suggested `painted-stylized` starting values:

```ts
{
  metallicFactor: 0.12,
  roughnessFactor: 0.72
}
```

Do not add emissive by default unless a separate tint/emissive option is selected.

### Acceptance criteria

- `source` produces byte-equivalent material values to unmodified import.
- Presets patch cloned material assets rather than source assets.
- Presets are deterministic and versioned.
- Preset values are documented and inspectable.
- A preset can be extended with explicit field overrides.
- Shader-variant-changing fields are either supported safely or rejected clearly.

---

## Workstream H — Agent and developer inspection tools

### LGT-010: Add `asset_inspect`

**Priority:** P0  
**Size:** M

Expose a material summary through CLI and MCP:

```json
{
  "asset": "hq",
  "meshes": 3,
  "materials": [
    {
      "name": "metalDark",
      "kind": "standard",
      "baseColorFactor": [0.675, 0.71, 0.774, 1],
      "metallicFactor": 1,
      "roughnessFactor": 1,
      "textures": {
        "baseColor": false,
        "metallicRoughness": false,
        "normal": false,
        "emissive": false
      }
    }
  ],
  "summary": {
    "imageCount": 0,
    "textureCount": 0,
    "highMetallicMaterialCount": 4
  }
}
```

### Acceptance criteria

- Works in headless mode.
- Does not require GPU initialization.
- Reports imported values before and after spawn-time patches.
- Clearly distinguishes “no texture authored” from “texture failed to load.”
- Reports normals, tangents and UV availability.
- Output is bounded and JSON-safe.
- The KMS-style failure is evident from one inspection call.

---

### LGT-011: Add `render_diagnose`

**Priority:** P0  
**Size:** M

Return a compact scene-level report:

```json
{
  "output": {
    "tonemap": "aces",
    "exposure": 1,
    "hdr": true,
    "colorSpace": "srgb"
  },
  "lighting": {
    "directional": 1,
    "ambient": 0,
    "environment": 1,
    "point": 1,
    "specularIblActive": true
  },
  "materials": {
    "visible": 12,
    "highMetallic": 4,
    "highMetallicWithoutIbl": 0
  },
  "warnings": []
}
```

Integrate the same report into `frame_capture` diagnostics.

### Acceptance criteria

- Report agrees with the current extracted render snapshot.
- Readiness reflects resources actually used for the submitted frame.
- A successful frame capture cannot report inactive IBL when its pipeline key uses IBL.
- Headed and headless reports agree for the same snapshot.
- Reports include no raw GPU handles or non-serializable state.

---

## Workstream I — Documentation and agent guidance

### LGT-012: Add a “Lighting imported models” recipe

**Priority:** P0  
**Size:** S

Cover:

- Why metallic materials need an environment.
- Why uniform ambient does not illuminate pure metals.
- ACES and exposure.
- Source fidelity versus material presets.
- Textureless but valid glTF assets.
- How to use `asset_inspect` and `render_diagnose`.
- When a hemisphere or rim light is useful.
- Why hemisphere light is not a substitute for specular IBL.

### Acceptance criteria

- Recipe contains a complete copy-pasteable ECS setup.
- Recipe includes both physically faithful and stylized paths.
- No section claims supported IBL functionality is deferred.
- The recipe is linked from getting started, GLB viewer and diagnostics documentation.

---

### LGT-013: Update Aperture-managed `AGENTS.md`

**Priority:** P1  
**Size:** S

Add a short model-import checkpoint:

1. Inspect imported material values.
2. Check whether an environment is active for metallic materials.
3. Run `render_diagnose`.
4. Capture one representative frame.
5. Resolve lighting-health warnings before declaring visual completion.

### Acceptance criteria

- Instructions remain concise.
- They prefer machine-readable diagnostics before subjective screenshot review.
- They do not require browser iteration for normal simulation work.
- They require a headed check only for final visual parity.

---

## Workstream J — API terminology cleanup

### LGT-014: Resolve `illuminance` versus `intensity`

**Priority:** P2  
**Size:** M

`illuminance` currently aliases directly to the renderer’s raw intensity scalar.

Choose one:

1. Deprecate `illuminance` and consistently use `intensity`, or
2. Implement physically meaningful units and conversions for each light kind.

Recommended near-term choice: deprecate `illuminance`.

### Acceptance criteria

- Templates no longer use `illuminance` as a raw alias.
- Documentation does not imply lux when no physical conversion occurs.
- Existing usage continues to function through a deprecation period.
- Conflicting simultaneous `illuminance` and `intensity` values produce a diagnostic.

---

# 6. Template outcome

A newly generated GLB viewer should resemble:

```ts
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: {
        translation: [0, 1.4, 4],
        lookAt: [0, 0.4, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.lightRig({
      key: "lighting.presentation",
      preset: "studio-neutral",
      environmentMap: this.assets.hdr("studioEnvironment"),
      shadows: true,
    });

    this.spawn.gltf(this.assets.gltf("model"), {
      key: "viewer.model",
      castShadow: true,
      receiveShadow: true,
    });
  }
}
```

The generated render configuration should use ACES, exposure `1` and sRGB.

---

# 7. Validation matrix

| Scenario                                          | Expected presentation                       | Expected diagnostic                |
| ------------------------------------------------- | ------------------------------------------- | ---------------------------------- |
| Metallic fixture, ambient only                    | Dark/incomplete by physical design          | `metalWithoutSpecularIbl`          |
| Metallic fixture, studio environment              | Colored midtones and specular response      | None                               |
| Metallic fixture, stylized preset, no environment | Readable diffuse form                       | Optional informational notice only |
| Dielectric fixture, ambient plus key              | Readable diffuse form                       | No metallic warning                |
| Textured PBR fixture, studio environment          | Textures, normals and reflections visible   | None                               |
| Missing authored texture                          | Placeholder/failure according to asset mode | Texture-loading diagnostic         |
| Textureless authored asset                        | Base-color-factor material renders normally | No missing-texture diagnostic      |
| Environment authored but preparation fails        | Direct lighting still renders               | Environment inactive warning       |
| ACES disabled with measured clipping              | Harder highlight clipping                   | Untone-mapped high-range warning   |
| Existing app without new preset                   | Existing appearance unchanged               | No compatibility regression        |

---

# 8. Mandatory validation gate

A change may not merge unless all applicable stages pass.

## Gate 1 — Static and unit validation

Required:

```sh
pnpm run typecheck
pnpm test
```

Must cover:

- Material classification thresholds.
- Environment/IBL readiness.
- Diagnostic serialization.
- Source-preserving material patches.
- Preset expansion.
- Lighting-rig entity creation and teardown.
- Template generation.

### Blocking failures

- Type errors.
- Non-deterministic diagnostic ordering.
- Source material mutation.
- Diagnostics containing raw GPU resources.
- Stale IBL readiness state.

---

## Gate 2 — Strict headless rendering

Run each fixture with:

```sh
pnpm exec aperture headless serve aperture.headless.config.ts \
  --seed 1 \
  --asset-mode strict
```

Capture at a fixed `960 × 640` viewport.

Required assertions:

- All real assets load without placeholders.
- Lighting-health diagnostics match the validation matrix.
- Render snapshot contains the expected light and environment entities.
- IBL pipeline activation matches readiness.
- Repeated runs with the same seed produce identical ECS digests.
- No unexpected render diagnostics occur.

### Blocking failures

- Placeholder-backed fixture assets.
- Metallic scene without an environment and without a warning.
- Environment reported ready but not selected by the material pipeline.
- Headless digest instability.

---

## Gate 3 — Visual regression

Create one human-approved golden for each validation scenario.

Suggested comparisons on the authoritative render environment:

- SSIM: `>= 0.985`
- Per-channel mean absolute error: `<= 0.01`
- No more than a 5% increase in crushed-dark object pixels.
- No more than a 5% increase in clipped-highlight object pixels.

For cross-GPU headed validation, use more tolerant thresholds:

- SSIM: `>= 0.97`
- Per-channel mean absolute error: `<= 0.025`

Object metrics must use a deterministic object mask or known fixture region rather than the entire background.

### Blocking failures

- Metallic base colors collapse to neutral gray or black.
- Major faces lose separation relative to the approved golden.
- Highlight clipping materially increases.
- Background changes hide an object-level regression.

---

## Gate 4 — Headed WebGPU parity

Required for changes to lighting, materials, HDR, environment processing or output composition.

Validate:

- DPR 1 and DPR 2.
- At least one supported WebGPU adapter.
- Live canvas and offline frame capture.
- UI composition over the HDR scene.
- Shadow filtering and environment contribution.
- Browser console diagnostics.

### Blocking failures

- Headed and headless lighting-health reports disagree.
- Live canvas and captured frame use different tonemapping.
- Environment appears in one target but not the other.
- UI is incorrectly tone-mapped or dimmed.
- Browser reports shader or bind-group errors.

---

## Gate 5 — Compatibility

Run existing showcase visual and behavior tests.

Required:

- Existing projects without a lighting preset keep their prior output.
- Existing `spawn.light` and `spawn.gltf` calls remain valid.
- Existing material patches preserve their semantics.
- Core renderer defaults do not change in a patch release.
- New scaffold defaults are asserted separately from runtime defaults.

### Blocking failures

- Unrequested visual changes in existing applications.
- New lights appearing in apps that did not opt in.
- Changed material factors without an explicit preset or patch.
- Significant steady-state rendering regression.

---

## Gate 6 — Performance

Measure cold setup and steady-state behavior.

Required:

- Environment PMREM generation occurs once per source/device.
- No recurring PMREM or irradiance work after initialization.
- No per-frame allocation introduced by lighting-health analysis.
- Diagnostics reuse extracted/material summary data where possible.
- Studio profile adds no more than 5% to steady-state GPU frame time on the reference scene.
- Studio reference asset adds no more than 512 KB compressed without explicit approval.

### Blocking failures

- Environment preparation repeats per frame.
- Unbounded material scanning occurs every frame.
- Default profile causes persistent shader compilation churn.
- Memory grows across repeated reset/reload cycles.

---

## Gate 7 — Fresh-project usability

Generate a project from the released template and replace its sample asset with the metallic fixture.

The evaluator should receive no special lighting instructions.

Required result:

- Model is immediately readable.
- ACES and HDR are active.
- Specular IBL is active.
- `render_diagnose` contains no unresolved lighting warnings.
- No manual material modification is necessary.
- A developer can discover the optional stylized preset from API documentation.

For agent evaluation, run the same “display this GLB” task three times in clean workspaces.

### Passing threshold

- Three out of three runs produce a properly lit model.
- Three out of three runs inspect or diagnose the imported materials.
- No run incorrectly reports authored textureless materials as failed textures.

---

# 9. Rollout strategy

## Release 1 — Observability

Ship:

- Correct IBL readiness.
- `asset_inspect`.
- `render_diagnose`.
- Metallic-without-IBL diagnostic.
- Documentation corrections.

Do not change visual defaults yet.

## Release 2 — Improved scaffolds

Ship:

- Studio reference environment.
- `spawn.lightRig`.
- ACES/exposure in `game` and `glb-viewer`.
- Updated model-lighting recipe.
- Updated Aperture-managed agent instructions.

Existing apps remain unchanged.

## Release 3 — Appearance ergonomics

Ship:

- Named material presets.
- Direct `spawn.environment`.
- `illuminance` deprecation.
- Additional lighting profiles if validated.

## Future major release

Evaluate making ACES and a neutral presentation profile the runtime default. Treat this as a deliberate breaking visual change with migration documentation and before/after captures.

---

# 10. Definition of done

The initiative is complete when:

- A textureless, fully metallic glTF is attractively visible in a newly generated GLB viewer without manual lighting code.
- Metallic materials without specular IBL always produce an actionable warning.
- Textureless authored assets are never mislabeled as failed textures.
- Source materials remain unchanged unless an explicit policy is selected.
- ACES, exposure, environment and active IBL state are inspectable through tooling.
- IBL implementation, diagnostics and documentation agree.
- Headless and headed validation gates pass.
- Existing applications retain their previous appearance.
- The fresh-project agent evaluation passes three out of three runs.
