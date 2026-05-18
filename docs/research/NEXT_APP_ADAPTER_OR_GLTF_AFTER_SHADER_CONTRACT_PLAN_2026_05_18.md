# Next App Adapter Or glTF Follow-Up After Shader Contract

Date: 2026-05-18

Task: `task-1671`

## Context

The previous slice locked the StandardMaterial metallic-roughness shader contract
at the WGSL level. The route spine also has generic adapter registry validation
and non-built-in route shell coverage, but app-level custom adapter registration
still needs a separate public API decision before implementation.

## Candidates

### App Adapter Registration Candidate

Start app-owned non-built-in adapter registration policy.

Pros:

- Continues the generic route architecture spine.
- Would be the next conceptual step toward real non-built-in material families.

Cons:

- Touches public app policy and custom material boundaries.
- Risks exposing custom material authoring before a decision record defines
  source assets, shader/resource dependencies, and lifecycle.

Decision: defer until a dedicated decision/planning task.

### StandardMaterial / glTF Browser Fidelity Candidate

Add a metallic-roughness factor browser proof.

Pros:

- Directly follows the shader contract regression with browser-level coverage.
- Existing fixture already maps metallic-roughness textures and publishes
  expected metallic/roughness status.
- Verifies glTF scalar factors and texture channels together without changing
  route architecture or public APIs.

Cons:

- Requires example and Playwright fixture edits.
- Does not advance app-level non-built-in adapter registration.

Decision: select.

### Diagnostics / Tooling Candidate

Promote material route diagnostics map into public docs.

Pros:

- Helps agent and human debugging.

Cons:

- Less urgent than locking browser-visible StandardMaterial behavior after the
  shader contract change.

Decision: defer.

## Selected Follow-Up

### task-1673 — Add metallic-roughness factor browser proof

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and targeted status helpers only if needed.
Reference anchor:
this plan,
`docs/research/METALLIC_ROUGHNESS_FACTOR_SHADER_CONTRACT_AUDIT_2026_05_18.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/materials/MeshStandardMaterial.js`,
`references/three.js/src/renderers/webgl/WebGLMaterials.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario where `metallicFactor` and
  `roughnessFactor` are non-default while `metallicRoughnessTexture` is mapped.
- Surface JSON-safe expected factor and texture-channel status.
- Add Playwright coverage proving the scenario renders and reports the expected
  pipeline/readiness state.
- Do not add app-level non-built-in rendering, IBL, shadows, binary GLB loading,
  or public custom material source APIs.

## Next Step

Run `task-1672` to audit this selected follow-up plan before implementation.
