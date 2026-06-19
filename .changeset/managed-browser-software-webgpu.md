---
"@aperture-engine/cli": minor
---

feat(cli): render software WebGPU in the managed dev browser on GPU-less hosts

`aperture dev up` now resolves a WebGPU backend for the Playwright-driven
browser instead of always assuming a hardware GPU. A new `--gpu <auto|hardware|
software>` flag (with `--software`/`--hardware` aliases and an `APERTURE_GPU`
environment variable) controls it; `auto` (the default) keeps using the
hardware GPU on desktops and falls back to SwiftShader on Linux hosts with no
`/dev/dri` device node, such as CI runners and dev containers.

In software mode the CLI launches Chrome with the SwiftShader Vulkan flags and,
because headless Chrome will not composite software WebGPU into screenshots or
pixel readbacks, runs the browser headed. On GPU-less Linux it auto-starts an
Xvfb virtual display (and tears it down with the session) so the same command
works out of the box without wrapping it in `xvfb-run`. Hardware-GPU desktops
are unchanged.
