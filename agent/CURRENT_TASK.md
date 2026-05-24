# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3128.

Status: `task-3127` completed the post-LTC render-pipeline parity audit.

Key finding:

- The previous StandardMaterial many-light shader blocker is closed: Aperture
  now prepares per-view/light-set clustered local-light resources and shades
  point/spot lights from per-cluster index lists instead of scanning every
  packed light per fragment.
- The next SOTA efficiency blocker is CPU-side cluster construction.
  `packages/webgpu/src/webgpu/local-light-clusters.ts` currently loops over
  every cluster cell and scans the full local-light list for each cell.
- PlayCanvas' `WorldClusters` reference computes each local light's affected
  cell min/max range, then writes that light only into those cells. That is the
  better build shape for large grids and many lights.
- The next feature-combination blocker after cluster-build efficiency is
  StandardMaterial CSM plus IBL in one group-3 route. The current route can
  prove CSM and IBL separately, but its layout selection does not yet bind a
  2D-array cascaded shadow map together with diffuse/specular IBL textures.

Next step: run `task-3128` from `agent/BACKLOG.md`, replacing clustered
local-light cell scans with a light-driven fill and browser-visible
build-pressure telemetry.

Reference anchor for the next task:

- `references/engine/src/scene/lighting/world-clusters.js`.
