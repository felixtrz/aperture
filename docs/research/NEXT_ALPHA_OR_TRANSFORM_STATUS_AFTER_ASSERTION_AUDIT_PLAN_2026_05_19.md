# Next Alpha Or Transform Status After Assertion Audit

Date: 2026-05-19

Task: `task-1756`

## Context

The recent assertion-hardening audit recommended either alpha/render-state
status hardening or texture-transform status hardening as the next focused
StandardMaterial/glTF direction.

Reference files inspected:

- `docs/research/STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_2026_05_19.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`

## Candidates

### Alpha / Render-State Status Candidate

Tighten existing alpha-mask and alpha-blend browser status assertions around
source `alphaMode`, `alphaCutoff`, `doubleSided`, mapped cull mode, depth, and
blend state.

Pros:

- Exercises material render-state mapping, pipeline keys, culling, and pixel
  expectations together.
- Directly follows the assertion-hardening audit recommendation.
- Uses existing browser scenarios.

Cons:

- Requires careful selection to avoid duplicate assertions already present in
  some alpha tests.

Decision: select.

### Texture-Transform Status Candidate

Tighten transform status assertions around offset, scale, rotation, sampled UV,
and `TEXCOORD_1` expectations.

Pros:

- Important for glTF texture fidelity.
- Existing transformed fixtures provide good coverage anchors.

Cons:

- Transform fixtures already have several exact assertions; alpha/render-state
  combines status and render behavior more directly.

Decision: defer.

### Route / Diagnostics Candidate

Return to route diagnostics or custom source validation work.

Pros:

- Continues architecture hardening.

Cons:

- The current browser assertion audit specifically recommended alpha or
  transform status next.

Decision: defer.

## Selected Follow-Up

### task-1758 — Tighten alpha/render-state status assertions

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
this plan, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Select a focused set of existing alpha-mask and alpha-blend browser tests and
  tighten JSON-safe status assertions for source and mapped render state.
- Preserve existing screenshot/readback, diagnostics, and WebGPU warning checks.
- Do not add new scenarios, public custom material APIs, app-owned adapter
  facades, IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1757` to audit this selected follow-up plan before implementation.
