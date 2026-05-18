# Optional glTF Material-Extension Warning Status Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1295` optional glTF material-extension warning status plan.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/OPTIONAL_GLTF_MATERIAL_EXTENSION_WARNING_STATUS_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The plan correctly distinguishes optional-extension warnings from
expected-failure no-work fixtures.

The selected fixture should render the base StandardMaterial successfully while
surfacing `gltfMaterial.unsupportedOptionalExtension` as a warning. That gives
the browser/status path coverage for non-blocking glTF fidelity diagnostics
without pretending the optional extension is supported.

Boundary checks:

- no PBR feature support for the optional extension is implied;
- no shader, WebGPU upload, route migration, binary GLB loading, or GLB viewer
  behavior is required;
- the fixture remains ECS-authored and render-derived through the existing
  example app path;
- JSON status should include warning details without raw GPU handles or source
  texture bytes.

## Recommendation

Implement `task-1304` next if staying on glTF fidelity.

If switching back to route architecture, implement `task-1303` first to prove
unregistered route keys remain diagnostics-only in app-level routing.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
