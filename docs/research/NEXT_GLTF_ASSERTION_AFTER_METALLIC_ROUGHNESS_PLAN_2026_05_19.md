# Next glTF Assertion After Metallic-Roughness

Date: 2026-05-19

Task: `task-1746`

## Context

Metallic-roughness status now pins exact base channel values. Occlusion status
still accepts broad numeric matchers for the sampled red channel in existing
browser tests.

## Candidates

### Occlusion Exact Status Candidate

Tighten existing occlusion browser status assertions so they pin the exact red
channel value `32 / 255` for standalone occlusion, occlusion-strength, and the
combined base-color/occlusion/emissive fixture.

Pros:

- Uses existing scenarios.
- Complements the recent exact emissive and metallic-roughness assertions.
- Keeps the work to Playwright assertion hardening.

Cons:

- Assertion hardening only.

Decision: select.

### Alpha Assertion Candidate

Tighten alpha status assertions.

Pros:

- Alpha fidelity remains important.

Cons:

- Occlusion has a clearer shared scalar value across existing fixtures.

Decision: defer.

### Route / Diagnostics Candidate

Return to source validation or route diagnostics.

Pros:

- Continues material architecture work.

Cons:

- The current track is browser fidelity assertion hardening.

Decision: defer.

## Selected Follow-Up

### task-1748 — Tighten occlusion red channel status assertions

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
this plan, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Assert exact `expectedOcclusion.red` value `32 / 255` in the standalone
  occlusion browser test.
- Assert the same exact red value in the occlusion-strength and combined
  base-color/occlusion/emissive browser tests while preserving their strength
  checks.
- Preserve existing screenshot/readback, diagnostics, and WebGPU warning checks.
- Do not add new scenarios, public custom material APIs, app-owned adapter
  facades, IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1747` to audit this selected follow-up plan before implementation.
