# Next Route Or Standard Follow-Up After Registry Validation

Date: 2026-05-18

Task: `task-1661`

## Context

`task-1658` added generic queued material adapter registry validation with
optional expected family keys. `task-1659` confirmed the helper stays generic
and leaves built-in required-family policy in the built-in validator.

The next slice should keep moving the material route spine toward generic
material-family support without exposing public custom material source assets
or app-level runtime custom material registration.

## Candidates

### Route / Prepared-Resource Candidate

Add a non-built-in prepared-resource route shell regression.

Pros:

- Directly follows the test-only generic app adapter proof and registry
  validation helper.
- Exercises the next ordered decomposition slice: prepared-resource route
  metadata for non-built-in families without drawing.
- Can stay unit-level and JSON-safe, proving facade keys, backend preparation
  keys, route status, diagnostic counts, and absence of raw handles for an
  arbitrary family string.
- Does not require `createWebGpuApp()` changes, public custom material source
  APIs, shaders, browser fixtures, or GPU resources.

Cons:

- It is still metadata/contract coverage, not rendered pixels.
- It does not yet define app-level runtime adapter registration.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add metallic/roughness scalar factor times texture browser coverage.

Pros:

- Useful glTF PBR fidelity coverage.
- Browser-verifiable through existing StandardMaterial texture fixture and
  readback helpers.

Cons:

- The route architecture still has a concrete generic prepared-resource
  contract gap.
- More glTF fidelity work can wait until the non-built-in route metadata
  boundary is less ambiguous.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote the material route diagnostics map into a public docs page.

Pros:

- Helps humans and agents understand diagnostic layers.
- Low implementation risk.

Cons:

- The map is still changing while generic adapter/route support is being
  decomposed.
- It does not advance the material-family route spine as directly as the route
  shell regression.

Decision: defer.

## Selected Follow-Up

### task-1663 — Add non-built-in prepared-resource route shell regression

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-material-frame-resource-route.test.ts`; implementation
files only if the regression exposes a focused gap.
Reference anchor:
this plan,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`docs/research/GENERIC_APP_ADAPTER_REGISTRY_VALIDATION_HELPER_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
`test/webgpu/queued-material-generic-app-adapter-contract.test.ts`,
`references/three.js/src/renderers/common/Pipelines.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a test-only non-built-in family route shell using distinct facade and
  backend mesh/material resource keys.
- Assert shell summary reports family, prepared status, key-presence booleans,
  pipeline key, source version, frame, and sorted diagnostic code counts.
- Assert JSON-safe shell and summary output omit raw GPU handles and do not
  require public source material APIs, shaders, examples, or browser fixtures.

## Next Step

Run `task-1662` to audit this selected follow-up plan before implementation.
