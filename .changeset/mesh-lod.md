---
"@aperture-engine/render": minor
"@aperture-engine/runtime": minor
"@aperture-engine/app": minor
---

Mesh LOD (parity plan E2) — the analog of three.js `THREE.LOD`. A new `Lod`
authoring component holds N levels (each a mesh handle + an ascending distance
threshold), a `hysteresis` band, and a deterministic `currentLevel` selection
state. Per-camera level selection runs **worker-side in extraction**
(`extractLodSelection`) against the primary view: for each `Lod` entity it takes
the camera→object world distance and picks the level via a pure, unit-tested
`selectLodLevel(distance, thresholds, currentLevel, hysteresis)` — the highest
level whose threshold the distance has cleared, with a symmetric hysteresis band
that keeps the previous level sticky (a switch up needs `distance >= threshold +
hysteresis`, a switch down needs `distance < threshold - hysteresis`). The
selected level's mesh handle **overrides the drawn mesh** in
`readMeshEntityExtractionState`, so LOD needs **no renderer/webgpu change** — the
existing `meshDraws` family just carries a different handle per frame.

**Deterministic hysteresis state.** The sticky selection lives on the ECS
component (`Lod.currentLevel`), NOT in renderer memory, and extraction rewrites
it in place ONLY when the level actually changes (which bumps the entity version
so the mesh-draw cache re-resolves the new level mesh; unchanged frames neither
churn the version nor perturb the cache). Because the state is ordinary
deterministic world state, selections reproduce exactly under record/replay. The
per-frame tally rides `snapshot.report.lod = { entities, levels }` where
`levels[i]` counts entities currently at level `i` — the draw-count-shifts-with-
distance signal.

**Byte-identity + determinism.** A frame with no `Lod` entities writes nothing,
omits `report.lod`, and resolves every mesh handle exactly as before, so it is
byte-identical to a pre-E2 snapshot/report (pinned by a no-LOD literal test). The
new component is registered last so no existing component's type index shifts; no
determinism fixture uses LOD, and `test/determinism` is GREEN with no refresh.

Authoring surface: `Lod` + `createLod` + `validateLodInput`/`validateLodLevels`
(`@aperture-engine/render`), the `withLod(...)` trait
(`@aperture-engine/runtime`), and a `lod` option on `spawn.mesh(...)`
(`@aperture-engine/app`) — the base `mesh` is the fallback and each level supplies
its own mesh + distance while the shared `material` is reused. Every failure path
(empty levels, out-of-order thresholds, missing level mesh handle, negative
hysteresis) emits a structured `lod.*` diagnostic (surfaced as `render.lod.*` at
extraction) and the entity falls back to its base mesh rather than raising a
device error. Ships `examples/mesh-lod` (a field of LOD'd rocks the camera dollies
near→far) with a frame-report e2e proving the per-level distribution shifts with
distance AND that two nudges straddling the raw threshold inside the hysteresis
band report the identical distribution (no popping). Limitations (honest):
distance-based only (camera→object world position, the three.js `LOD.update`
model — no screen-coverage metric); selects against the primary/active view
(single-camera scenes); the LOD swaps the mesh handle only (shared material), not
whole sub-objects.
