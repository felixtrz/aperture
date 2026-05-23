# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3111.

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

`task-3110` completed the post-Tier-20 audit and selected submit efficiency as
the next SOTA blocker. The audit is recorded in
`docs/research/POST_TIER20_RENDER_PIPELINE_PARITY_AUDIT_2026_05_23.md`.

Next step: start `task-3111` from `agent/BACKLOG.md`, eliding redundant
render-pass state commands and publishing command-pressure metrics in a
browser-visible proof.
