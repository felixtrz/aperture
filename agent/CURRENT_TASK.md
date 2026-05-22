# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3078` — Sprite component + billboard renderer.

Status: in progress / partial. Tier 16 is complete: RectAreaLight/LTC,
area-light shape metadata, executable directional CSM receiver sampling, and the
combined outdoor scene proof now exist. A first `task-3078` slice added ECS
`Sprite` authoring, `withSprite`, snapshot sprite packets, and an experimental
WebGPU sprite-only path, but browser pixel proof failed with black/zero pixels.

Next step: debug or replace the WebGPU sprite pixel path, then restore a public
sprite billboard example and Playwright proof that camera rotation does not
rotate the sprite on screen.
