# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3110.

Status: Tier 20 is complete. Baseline SSAO, SSR, and DOF shipped as
depth-readable post effects with square raw-vs-effect browser proofs, and the
strict reference-parity follow-ups are complete:

- `task-3093` upgraded SSAO toward the PlayCanvas spiral AO reference.
- `task-3094` upgraded SSR toward the three.js `SSRPass`
  normal/fresnel/distance-attenuation shape.
- `task-3095` upgraded DOF toward the PlayCanvas/Bevy
  circle-of-confusion quality shape.
- `task-3096` added a renderer-owned multisampled-depth shader route so SSAO,
  SSR, and DOF can run in MSAA scenes without example-specific depth plumbing.
- `task-3108` added texture-backed iridescence thickness factors, so
  `KHR_materials_iridescence.iridescenceThicknessTexture` now maps into
  StandardMaterial and drives per-texel thin-film thickness in the browser
  proof.
- `task-3109` added texture-backed clearcoat roughness factors, so
  `KHR_materials_clearcoat.clearcoatRoughnessTexture` now maps into
  StandardMaterial and drives per-texel coating highlight sharpness in the
  browser proof.

Next step: start `task-3110` from `agent/BACKLOG.md`, auditing the current
post-Tier-20 render pipeline against three.js and PlayCanvas to identify the
highest-impact remaining SOTA/efficiency gaps and queue the next visible
implementation slices.
