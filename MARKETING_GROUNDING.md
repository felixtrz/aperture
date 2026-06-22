# Aperture Marketing Plan — Source-Code Grounding Review

A fact-check of the "Aperture Research Positioning" marketing plan against the
actual state of this repository. Goal: make sure every public claim is grounded
in what the code really does, so the announcement is bold *and* defensible.

Status legend: ✅ confirmed · 🟡 true with a caveat / wording tweak ·
❌ inaccurate or contradicted (must fix).

---

## Bottom line

The architecture the plan describes is **real, implemented, and load-bearing** —
not aspirational. The five assumptions are well-supported as *framing*, and the
"what exists today" feature list is accurate. Two issues were found; both are now
addressed (see [Fixes applied](#fixes-applied)).

---

## Claim-by-claim verification

| Claim in the plan | Verdict | Evidence in repo |
| --- | --- | --- |
| WebGPU-only, no WebGL fallback | ✅ | Documented load-bearing invariant (`AGENTS.md`, README, DECISIONS 0001). The only `WebGL` string in the codebase is a *comment* about porting three.js's ACES tonemap — not a backend. |
| ECS-native; simulation authoritative, rendering derived | ✅ | Enforced by a package-boundary checker. Data flow `ECS World → Render Extraction → Render Snapshot → WebGPU`. ECS built on the third-party `elics` library (DECISIONS 0006) plus a custom versioning wrapper. |
| Worker-by-default | ✅ | `packages/app` spins up a simulation worker by default; main thread owns canvas/WebGPU/input. Documented invariant in `AGENTS.md`. |
| Render snapshot boundary + SharedArrayBuffer "happy path" | ✅ | Two transports exist: transferable typed arrays (default) and a `SharedArrayBuffer` transport (`packages/runtime/src/shared-snapshot-transport.ts`, `docs/SHARED_ARRAY_BUFFER_TRANSPORT.md`). |
| Headless / data-first simulation (no GPU/browser) | ✅ | `createApertureHeadlessRunner` is a first-class Node API with `step()`/`extract()`. The `simulation` package is boundary-forbidden from importing browser/WebGPU globals. Strongest evidence for Assumption 4. |
| Deterministic fixed timestep | ✅ | `packages/runtime/src/fixed-step-schedule.ts`; frame-stamped input enables deterministic replay. |
| Agent-native tooling (Assumption 2) | ✅ | Working MCP server (`aperture mcp stdio`), ~56 agent tools (ECS query/snapshot/diff/step, render diagnostics, picking, camera, input, reference search), large structured diagnostics catalog (`docs/DIAGNOSTICS_CATALOG.md`, 7,100+ lines), reference RAG with pinned embeddings. See `docs/AI_TOOLING.md`. |
| Physics | ✅ | Rapier backend (`@dimforge/rapier3d-compat`) behind a backend-neutral contract (DECISIONS 0018). |
| Interaction (picking, raycasting, pointer events) | ✅ | GPU id-buffer picking, pointer-event state machine, AABB/sphere raycaster. |
| Audio | ✅ | Real: pooled spatial voice graph, submix buses, ducking, streaming music. |
| Examples | ✅ | **124** example `.html` files spanning materials, shadows, IBL, post-fx, cameras, physics, animation/skinning, GLTF. |
| Showcase apps | ✅ | **4** real games: `city-builder`, `fps`, `platformer`, `racing` (not stubs). |
| CLI scaffolding | ✅ | `aperture create` with 3 working templates (minimal, glb-viewer, game). |
| Documentation | ✅ | 18 docs files + a full docs site. |
| "Personal project, not a Meta product" | ✅ | No Meta branding anywhere; author Felix Zhang / elixr.games, MIT license. |
| "Intentionally does not support WebXR right now" | ✅ | No WebXR implementation exists (no `navigator.xr` / `requestSession` in code). |
| "Does not currently plan to support WebXR" | ❌ → ✅ | **Was contradicted** by `docs/DECISIONS.md` record 0020 ("Aperture is planning WebXR support…"). Now removed — see Fixes applied. |
| "First multithreaded-by-default web 3D engine" | 🟡 | The *architecture* is genuinely worker-by-default, but "first" is a claim about the external landscape that source can't establish. Keep the "to my knowledge" hedge. |
| One developer + agents, ≈ one month | 🟡 | Feature breadth is fully supported and the README states the repo is "maintained mostly by AI agents." But the **timeline is not provable from the repo** (history is a single squashed commit). Present "≈ a month" as personal testimony, not artifact-provable fact. |

---

## Nuances worth a wording tweak

- **Assumption 5 (ecosystem moat) cuts slightly against itself.** Aperture itself
  leans on third-party ecosystem pieces — `elics` (ECS), Rapier (physics), Draco,
  Transformers.js — and `references/` vendors three.js, three-mesh-bvh, bevy, etc.
  as corpus raw material. This is *consistent* with the "ecosystem becomes raw
  material agents adapt" thesis, so lean into that framing rather than implying
  Aperture avoids dependencies. Avoid "bespoke instead of dependencies."

- **IWSDK isn't strictly "unrelated."** `docs/AI_TOOLING.md` notes Aperture's
  reference search reuses "the same pinned … embedding model used by IWSDK
  reference search." There's a documented technical lineage. "Separate project,
  not a Meta product, different goals" is safer than "unrelated."

- **Example count:** it's 124 files — "120+" is the safe phrasing.

---

## Fixes applied

To make the repo consistent with the "no WebXR planned" positioning:

1. **Removed decision record `0020 — WebXR Is a View and Input Mode Over the
   Existing Boundary`** from `docs/DECISIONS.md` (it explicitly stated
   "Aperture is planning WebXR support"). Subsequent records renumbered
   0021→0020, 0022→0021, 0023→0022 to keep the sequence gap-free; no external
   cross-references to these numbers exist.
2. **Removed the vestigial `xr: { active }` input signal** from
   `packages/app/src/input/state.ts` and `packages/app/src/input/types.ts`. It
   was declared but never read anywhere — a leftover WebXR placeholder.

`pnpm run build` (full typecheck) passes after these changes. After the edits, a
repo-wide search for `webxr` / `XRSession` / `navigator.xr` returns no matches.

---

## Everything else

The five assumptions, the Three.js positioning, the "Week of Aperture" rollout,
and the tone guidelines are all well-supported by what's actually in the repo.
The plan is safe to run on, provided the timeline and "first" claims keep their
honest hedges.
