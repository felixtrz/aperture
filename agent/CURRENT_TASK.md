# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3089` — SSR (screen-space reflections).

Status: ready. Tier 20 has shipped `task-3088` SSAO. The post-pass contract now
supports renderer-owned depth texture dependencies, app depth attachments are
sampleable by post effects, `createWebGpuSsaoPostEffect()` reads scene depth in
a full-screen WebGPU pass, and `examples/ssao.html` proves visible
raw-vs-SSAO darkening in square canvases.

Next step: continue Tier 20 with screen-space reflections. Read the `task-3089`
references first: `references/three.js/examples/jsm/postprocessing/SSRPass.js`
and the relevant PlayCanvas/Bevy depth-screen-space references before writing
code.
