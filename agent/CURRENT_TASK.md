# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3090` — Depth of field (bokeh).

Status: ready. Tier 20 has shipped `task-3088` SSAO and `task-3089` SSR. The
post-pass contract now supports renderer-owned depth texture dependencies, app
depth attachments are sampleable by post effects,
`createWebGpuSsaoPostEffect()` reads scene depth in a full-screen WebGPU pass,
`createWebGpuSsrPostEffect()` blends screen-space reflection color from scene
depth, and `examples/ssao.html` / `examples/ssr.html` prove visible
raw-vs-effect differences in square canvases.

Next step: continue Tier 20 with depth of field. Read the `task-3090`
references first: `references/three.js/examples/jsm/postprocessing/BokehPass.js`
and `references/engine/scripts/posteffects/posteffect-bokeh.js` before writing
code.
