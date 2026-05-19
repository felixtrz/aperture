# Next Standard glTF Assertion After Combined Emissive

Date: 2026-05-19

Task: `task-1741`

## Context

The emissive texture fixtures now assert exact JSON-safe factor/color status
across standalone and combined scenarios. The metallic-roughness browser
fixtures still accept broad numeric matchers for the base channel values in
several existing tests.

Reference files inspected:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Candidates

### Metallic-Roughness Exact Status Candidate

Tighten existing metallic-roughness browser status assertions so they pin the
exact base texture channel values `64 / 255` and `16 / 255`.

Pros:

- Uses existing browser scenarios and fixture constants.
- Complements the existing scalar-factor multiplication test.
- Keeps the work limited to assertion hardening.

Cons:

- Does not add a new rendered scenario.

Decision: select.

### Alpha Fixture Assertion Candidate

Tighten alpha-mask/alpha-blend status assertions.

Pros:

- Alpha behavior remains important for glTF fidelity.

Cons:

- Metallic-roughness channel values are closer to the current material-fidelity
  track and can be pinned in one focused slice.

Decision: defer.

### Route / Diagnostics Candidate

Return to route or package-level custom source validation work.

Pros:

- Continues material architecture hardening.

Cons:

- The current ready track is StandardMaterial/glTF assertion cleanup.

Decision: defer.

## Selected Follow-Up

### task-1743 — Tighten metallic-roughness channel status assertions

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
this plan, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Assert exact `expectedMetallicRoughness.metallic` and `.roughness` values in
  the standalone metallic-roughness texture browser test.
- Assert the same exact values in combined base-color/metallic-roughness and
  base-color/metallic-roughness/normal browser tests.
- Preserve existing screenshot/readback, diagnostics, and WebGPU warning checks.
- Do not add new scenarios, public custom material APIs, app-owned adapter
  facades, IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1742` to audit this selected follow-up plan before implementation.
