# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3076` — Cascaded shadow maps for directional lights.

Status: started 2026-05-22. The data-contract/planning slice is in place:
`LightShadowSettings.cascadeCount` validates 1-4, extraction and packed snapshot
transport preserve it, WebGPU shadow descriptor/texture/pass/view-projection and
matrix reports fan directional shadow requests into per-cascade records, and
StandardMaterial shadow bind-group planning blocks cascaded 2D-array depth views
until receiver sampling supports them.

Next step: implement executable CSM texture-array binding/submission,
distance-based receiver cascade selection, and the outdoor browser proof.
