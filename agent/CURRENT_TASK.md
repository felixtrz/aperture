# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3109.

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

Next step: start `task-3109` from `agent/BACKLOG.md`, rendering
texture-backed StandardMaterial clearcoat roughness factors so
`KHR_materials_clearcoat.clearcoatRoughnessTexture` can vary coating highlight
sharpness per texel instead of remaining an unsupported extension slot.
