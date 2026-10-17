# Dawn-backed Node rendering

Aperture's portable Node tooling uses the direct `webgpu@0.6.2` Dawn binding.
There is no vgpu dependency. CPU-only `aperture headless` extraction remains
independent of GPU initialization. Browser app imports do not load native code.

## Use the renderer

```sh
aperture headless aperture.headless.config.ts --out scene.bundle.json --asset-mode strict
aperture render scene.bundle.json --out scene.png
aperture render scene.bundle.json --backend browser --out browser.png
aperture render serve --backend dawn --adapter software
aperture mcp stdio --backend dawn --adapter software
```

Dawn is the default portable renderer after qualification. Select `--backend
browser` for browser verification. `APERTURE_RENDER_BACKEND` sets the tooling
default; command arguments take precedence. No automatic fallback hides a native
initialization or rendering error. Browser-only page capture still uses a browser.

`--adapter auto|hardware|software` is an explicit policy. Hardware/software requests
must match the selected adapter; a mismatch fails. `auto` reports what was selected.
Software rendering requires an installed software driver and never downloads one
at render time. `NodeDeviceOptions` additionally accepts the backend, adapter name,
required/optional features and required limits. Missing capabilities fail before
resource creation. Configure `VK_ICD_FILENAMES` and the system loader search path
for a provisioned Vulkan ICD on Linux.

The qualified baseline is Linux x64 with the pinned SwiftShader driver, Node
22.18.0 and Node 24. The binding also exposes Metal/D3D12 paths, but macOS, Windows,
other architectures and physical GPUs need their own qualification before being
claimed as supported release baselines. The default platform mapping is Vulkan
on Linux, Metal on macOS and D3D12 on Windows. Binding installation, adapter policy,
feature/limit, shader, readback, device-loss and timeout errors remain distinct.

For the reproducible repository software lane:

```sh
npm install --prefix .aperture-env/driver-package --ignore-scripts --package-lock=false @sparticuz/chromium@153.0.0
node scripts/provision-dawn-software.mjs .aperture-env/driver-package/node_modules/@sparticuz/chromium/bin/swiftshader.tar.br
export VK_ICD_FILENAMES="$PWD/.aperture-env/dawn-runtime/vk_swiftshader_icd.json"
export LD_LIBRARY_PATH="$PWD/.aperture-env/dawn-runtime${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
pnpm build
pnpm test:dawn
pnpm check:dawn-memory
pnpm check:pack-cli:dawn
```

Provisioning is a separate opt-in command that validates the pinned archive's
SHA-256 and extracts the driver; it does not launch Chromium. Runtime packages
and their third-party licenses are listed in the package notices. This native
lane fails if the driver/device is absent; it never reports a skip as success.

## Shared contracts and ownership

`@aperture-engine/adapter-node` provides `createNodeDevice()` and
`createOffscreenOutput()`. `@aperture-engine/app/render-bundle` hydrates embedded
assets, environment maps and snapshots through the same app renderer used by the
browser harness, preserving HDR, ACES, MSAA, SSAO, bloom, shadows and strict asset closure.
Unresolved URLs and unsupported embedded assets fail preflight.

The output specifies size, format, color space, alpha mode and sample count.
Readback aligns staging rows to WebGPU's 256-byte requirement, removes padding,
swizzles BGRA and converts premultiplied alpha to straight-alpha RGBA. PNG output
includes sRGB metadata. Readback allocations and dimensions are bounded.

A warm CLI/MCP slot owns one child process and device. Accepted jobs are serialized
and each owns fresh app resources; bounded immutable pipeline caches may persist.
Disposal drains accepted work, releases resources and awaits process exit. A hard
job timeout terminates the worker and awaits close, so hung native work cannot
keep the parent alive. Parent IPC EOF also disposes Dawn. Borrowed app devices and
outputs remain caller-owned; destroy the device only after all contexts finish.

## Metadata migration

Render metadata uses `schemaVersion: 2` and a discriminated `backend`:

- `backend: 'dawn'` includes `dawn` binding/version, policy, selected adapter,
  backend, features and cache data. It has no fabricated browser launch fields.
- `backend: 'browser'` includes `browser` launch metadata and browser WebGPU info.

Both include requested/actual dimensions, bundle digest, diagnostics, lighting
health and optional shadow/shader reports. Consumers that previously assumed
`metadata.browser` should branch on `metadata.backend`. Warm serve startup emits
the same backend identity. MCP `shader_build`, `shader_inspect`, `shader_render`
and frame capture share the selected renderer. Build/inspection do not create a GPU.

## Evidence and performance

Reproduce native/browser comparisons with `scripts/dawn-browser-parity.mjs` and
`scripts/shader-browser-parity.mjs`. In the cloud environment these and
`scripts/verify-shader-examples.mjs` must run inside the approved
[cleanup and browser verification route](CLOUD_LOCAL_RENDERING.md).

`bench-dawn.mjs` reports cold initialization, first render, warm round-trip,
prepare/render, GPU completion wait, readback, PNG encoding and RSS/heap samples.
Portable jobs additionally report snapshot decode, asset restoration, renderer
initialization, environment preparation and render submission under
`cpuTimings.portable`. `gpuCompletionMs` is a wall-clock fence wait; `readbackMs`
now measures output copying after that fence (older metadata combined both). Times are CPU and
end-to-end measurements, not GPU timestamps or a native/browser speed guarantee.
`check-dawn-memory.mjs` retains 1,200 alternating-size jobs and checks generous
absolute peak/growth budgets over the final two 300-job windows. Raw samples
include cache warm-up. The measured local run peaked near 407 MiB and its final
window medians decreased by about 6 MiB RSS and 3 MiB heap. This is evidence for
that runtime, not a universal memory bound.

The required native CI matrix runs actual GPU tests and clean packed installs on
Node 22.18.0 and 24. Browser verification remains a separate compatibility gate.
