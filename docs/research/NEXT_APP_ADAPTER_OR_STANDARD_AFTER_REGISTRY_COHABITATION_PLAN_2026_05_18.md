# Next App Adapter Or Standard Follow-Up After Registry Coexistence

Date: 2026-05-18

Task: `task-1681`

## Context

The generic adapter registry now has a test proving built-in app resource
families and a test-only app-owned family key can validate together without
creating public custom material source assets. The next risk is registration
policy: if a future app-owned adapter uses a built-in family key, Aperture must
not silently override built-in behavior or hide the collision behind fallback
semantics.

## Candidates

### Explicit App-Owned Adapter Facade Candidate

Add a focused registry policy regression for app-owned adapters that collide
with a built-in family key.

Pros:

- It is the next smallest guard before any app facade accepts user-supplied
  backend adapters.
- It tests deterministic first-registered behavior and duplicate diagnostics
  without exposing custom source material authoring.
- It keeps Decision 0010 intact because only adapter/route family keys are in
  scope.

Cons:

- It remains unit-level policy coverage rather than an app facade option.
- It does not render non-built-in pixels.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add another browser fixture for a remaining StandardMaterial/glTF behavior such
as texture transform rotation or a color-space status guard.

Pros:

- Continues visible material fidelity work.
- Existing fixtures and Playwright helpers are mature.

Cons:

- It does not address the immediate adapter registration policy risk surfaced
  by the previous coexistence test.

Decision: defer.

### Diagnostics / Tooling Candidate

Turn the current research-level material route diagnostics map into a stable
public docs page.

Pros:

- Improves agent-readable debugging.

Cons:

- The names may still change while app-owned adapter registration policy is
  being clarified.

Decision: defer.

## Selected Follow-Up

### task-1683 — Add built-in family collision registry regression

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-material-adapter-json.test.ts`; implementation files only
if the regression exposes a focused defect.
Reference anchor:
this plan, `docs/DECISIONS.md` Decision 0010,
`docs/research/APP_ADAPTER_REGISTRY_COHABITATION_REGRESSION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`references/bevy/crates/bevy_render/src/render_asset.rs`, and
`references/bevy/crates/bevy_pbr/src/material.rs`.

Acceptance criteria:

- Add a generic adapter registry regression where an app-owned adapter reuses a
  built-in family key such as `standard` after the built-in registrations.
- Assert the duplicate-family diagnostic is a warning with stable first and
  duplicate indexes.
- Assert `get("standard")` returns the first built-in-style registration rather
  than the colliding app-owned registration.
- Assert validation remains JSON-safe and does not imply override, fallback,
  public custom material source authoring, app-level non-built-in rendering,
  IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1682` to audit this selected follow-up plan before implementation.
