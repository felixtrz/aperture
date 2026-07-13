---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
---

MRT authoring + user-pass render-target writes (parity plan B3) — the analog
of three.js `WebGLRenderTarget count > 1` / `MRTNode` and `EffectComposer`
custom passes. `material.customWgsl({ colorTargets })` declares N color
targets (index = fragment `@location`; target 0 is the pass color, extras
pair facade render targets with per-target format and write mask); fragment
outputs are validated against the declaration at preparation
(`customMaterialSource.colorTargetMismatch`) — never as a device error — and
the `color-targets:` pipeline-key segment participates only when declared,
so existing materials keep byte-identical keys. The frame attaches the
realized facade textures at their declared locations (extras clear to
transparent black and always store), with structured diagnostics for
unavailable/mismatched targets, MSAA apps, and passes or routes that cannot
host MRT draws. User render passes (`app.addRenderPass`) may now write
facade render targets instead of scene-color: declared writes attach the
realized textures in order with per-write clear/load intent (always stored,
no depth), reads resolve to sampleable views with graph ordering edges, and
ping-pong between two persistent user targets works across frames. Mixing
scene-color with target writes, size mismatches, and unavailable targets are
loud skips (`webgpu.userPass.renderWrite*`); write cycles are rejected at
frame-graph compile, and the legacy route reports user passes as skipped
exactly as before. Ships `examples/gbuffer` (custom G-buffer: albedo +
world-space normal + object ID from one MRT material, resolved by a user
pass into three scene-color bands) with pixel and graph-pass-count e2e
coverage.
