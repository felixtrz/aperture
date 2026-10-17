# Shader-first rendering

Aperture shaders are WGSL. A standalone GPU program uses the same resource
manager, frame graph and executor as the app renderer, without starting ECS,
physics, a worker, or UI. Use an ECS app when you need scene state and engine
materials; see [material integration](SHADER_MATERIALS.md).

## Build a shader

Install `@aperture-engine/gpu`, `@aperture-engine/shader` and, for Vite,
`@aperture-engine/vite-plugin`. Add `apertureShaders()` from the Vite plugin to
`plugins`. The app's `aperture()` plugin already includes the shader loader.

Create `effect.wgsl`:

```wgsl
struct Parameters { color: vec4f };
@group(0) @binding(0) var<uniform> parameters: Parameters;
@fragment fn main(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
  let stripe = 0.65 + 0.35 * sin(pixel.x * 0.04);
  return vec4f(parameters.color.rgb * stripe, 1.0);
}
```

Create a canvas and a short module:

```js
import { createBrowserGpuContext } from "@aperture-engine/gpu/browser";
import shader from "./effect.wgsl?aperture";

const gpu = await createBrowserGpuContext({
  canvas: document.querySelector("canvas"),
  record: true,
});
const effect = await gpu.effect({
  name: "stripes",
  shader,
  bindings: { parameters: { uniform: { color: [0.2, 0.7, 0.5, 1] } } },
});
await gpu.frame({ time: 0, delta: 0 });
effect.parameters({ parameters: { color: [0.9, 0.4, 0.2, 1] } });
await gpu.frame({ time: 1 / 60, delta: 1 / 60 });
// On teardown: await gpu.dispose().
```

Uniform values do not change pipeline identity. Binding names and WGSL layouts
are reflected at build time, including alignment, padding, arrays and matrices.
`packShaderBuffer(binding.layout, values)` uses that same contract for host buffers.
No compiler is imported by the ordinary shader or GPU runtime entry points.

For Node tooling, compile an artifact with
`aperture shader build effect.wgsl --out effect.shader.json --types effect.d.ts`.
Inspect it with `aperture shader inspect effect.shader.json`. An artifact contains
code and layout hashes, entry points, bindings, capabilities, dependencies and
original file/line mappings. Generated TypeScript describes host parameters.

Modules use `// @import "./palette.wgsl"`. Imports are resolved before device
compilation; cycles and conflicting declarations fail. GPU diagnostics map back
to the original module. WGSL semantic validation still runs on the actual device.
For generated source, explicitly import `prepareShader` from
`@aperture-engine/shader/prepare` and call it during setup with an entry and a
`modules` map. This loads reflection on demand, uses Web Crypto, and performs no
file or URL loading. Never prepare shaders in the frame loop.

## Resources and passes

`gpu.resource()` declares buffers, textures and samplers. Omitted texture sizes
follow the output. Use `usage` to declare uniform/storage/vertex/index/indirect,
sampled/storage texture, attachment, and copy requirements. `gpu.compute()` and
`gpu.draw()` share the effect API; a compute pass can write vertex and indirect
buffers consumed by a draw in the same submission. No CPU readback is required.

Draws accept multiple `targets`, explicit resolve targets, depth, vertex layouts,
indices, indirect commands and render state. Texture references include mip,
layer and history selection. Invalid usage, overlapping read/write subresources,
attachment feedback and undefined/discarded contents fail before submission.
Use `lifetime: 'history'` for two initialized textures, reading `history:
'previous'` and writing `history: 'current'`. The pair flips only after success.
`reset()` and `resize()` reset owned temporal state; failed allocation preserves
existing resources. `inspect()` reports descriptors, generations and ownership.

`importBuffer()` and `importTexture()` require the owning device, declared usage
and a `ready` completion promise. Imports are borrowed: the context never resizes
or destroys them. The producer must finish its writes before resolving `ready`;
coordinate subsequent writes between frames. Captures reject borrowed resources.
The core `createGpuContext({device, output})` borrows both objects. The browser
helper owns its device unless you supply `device`, allowing several contexts to
share a device with explicit lifetime management.

## Replacement and capture

```js
const replacement = await effect.replace(nextArtifact);
if (!replacement.ok) console.error(replacement.diagnostics);
```

Replacement validates the candidate before swapping. Failure keeps the last valid
pipeline and parameters. Compatible parameters migrate; removed or incompatible
parameters receive diagnostics. Layout changes rebuild bindings. Vite invalidates
all shader modules that depend on an edited imported file.

With `record: true`, encode `gpu.capture()` using `encodeShaderJob` from the shader
package and save the JSON. It contains resource initialization, shader artifacts,
parameter/frame inputs and an ordered replay sequence. Render it with:

```sh
aperture shader render capture.json --out capture.png
aperture shader render capture.json --backend browser --out browser.png
```

A shader job has its own `aperture.shader-job` versioned envelope. It executes
built-in effect/draw/compute operations, never embedded JavaScript, callbacks or
application-module URLs. It does not pretend to be an ECS snapshot. CLI and MCP
reports include graph order, capabilities and shader diagnostics. `cpuEncodeMs`
measures CPU encoding, not GPU time; GPU timings are only available where an
explicit timestamp-query path is enabled.

Run `examples/shader-workbench` with its Vite config for a procedural raymarch,
compute-to-indirect-draw, temporal feedback and MRT composition. The controls
support stepping, reset and portable capture. The palette library is also used by
`examples/material-shaders`. See [Dawn setup](DAWN_NODE_RENDERING.md) for native
rendering and the qualification commands.
