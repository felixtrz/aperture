# Tracker/backlog alignment after Standard glTF normal-scale visual proof - 2026-05-18

## Scope

Audit the public tracker and ready backlog after adding deterministic browser
proof that `normalTexture.scale` changes rendered output.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

- The visual proof is now implementation-backed: the `normal-map-scale` glTF
  fixture renders a scalar StandardMaterial control and the reduced-scale
  normal-textured material in one frame, then verifies screenshot and readback
  deltas.
- `docs/index.html` now points the next focus at planning the next route or
  StandardMaterial follow-up instead of the completed visual proof.
- `docs/render-pipeline-comparison.html` now lists normal-scale visual/readback
  proof as working and removes the deterministic visual proof from the missing
  list.
- The ready backlog needed refill after this task, so two concrete follow-up
  audits were added after the existing planning/audit/tracker sequence.

## Recommendation

Start `task-1531`: plan the next route or StandardMaterial follow-up after the
normal-scale visual proof. Prefer one focused browser-verifiable fidelity slice
or one route-boundary cleanup; keep IBL, shadows, binary GLB loading, and
app-level non-built-in rendering deferred.

## Validation

- `pnpm run check:progress`
