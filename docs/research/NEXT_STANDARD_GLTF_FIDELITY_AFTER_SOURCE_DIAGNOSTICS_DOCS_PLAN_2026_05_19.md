# Next Standard glTF Fidelity After Source Diagnostics Docs

Date: 2026-05-19

Task: `task-1731`

## Context

The custom material source diagnostics track now has a decision, taxonomy,
fixture matrix, executable test-only guardrail, and public diagnostics summary
boundary. The next useful slice should return to StandardMaterial/glTF fidelity
unless package-level custom source validation is required to unblock material
route architecture.

Reference files inspected:

- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `test/webgpu/standard-shader.test.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates

### StandardMaterial / glTF Fidelity Candidate

Tighten the existing emissive texture browser proof so it asserts the exact
non-default `emissiveFactor` and sampled emissive texture color exposed in
JSON-safe status.

Pros:

- Uses an existing browser scenario and fixture path.
- Verifies a glTF PBR rule already represented in WGSL:
  `emissiveFactor * emissiveSample.rgb`.
- Avoids new WebGPU features, binary GLB loading, IBL, shadows, or custom
  material APIs.

Cons:

- It is a narrow assertion hardening slice, not a new rendered scenario.

Decision: select.

### Package-Level Source Validation Candidate

Move the test-only custom source validator helper into `packages/render`.

Pros:

- Would make source validation reusable.

Cons:

- The exact public custom source TypeScript shape is still not implemented.
- The docs/test guardrails are sufficient for now, and moving too early could
  look like public custom material API support.

Decision: defer.

### Diagnostics / Tooling Candidate

Add another docs summary around custom material diagnostics.

Pros:

- Low risk.

Cons:

- The diagnostics track is now adequately documented for the current stage.

Decision: defer.

## Selected Follow-Up

### task-1733 — Tighten emissive texture factor browser assertions

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`; implementation files only if the
assertion exposes a focused defect.
Reference anchor:
this plan, `packages/webgpu/src/webgpu/standard-shader.ts`,
`test/webgpu/standard-shader.test.ts`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Update the existing emissive texture browser test to assert exact JSON-safe
  `expectedEmissive.factor` and `expectedEmissive.color` values.
- Preserve existing screenshot/readback checks and WebGPU warning guards.
- Do not add new scenarios, public custom material APIs, app-owned adapter
  facades, IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1732` to audit this selected follow-up plan before implementation.
