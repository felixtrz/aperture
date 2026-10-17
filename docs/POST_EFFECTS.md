# Post Effects

Aperture post effects are renderer-owned WebGPU passes that run after a
swapchain scene view has been rendered into an intermediate texture. They do not
read ECS state and they do not become authoritative scene objects.

## App Usage

```ts
import {
  createWebGpuApp,
  createWebGpuBloomPostEffect,
  createWebGpuCopyPostEffect,
  createWebGpuFxaaPostEffect,
} from "@aperture-engine/webgpu";

const app = await createWebGpuApp({
  canvas,
  simulationWorker,
  sourceAssets,
  postEffects: [
    createWebGpuFxaaPostEffect(),
    createWebGpuBloomPostEffect({ threshold: 0.65 }),
  ],
});
```

When `postEffects` has enabled entries, the WebGPU app:

1. Renders the ECS-derived scene commands into a renderer-owned off-screen color
   texture.
2. Runs post effects in array order.
3. Writes the last enabled effect to the swapchain.

The copy effect is intentionally a no-op. It exists to prove the post-pass chain
and can be useful in tests that need to verify input/output preservation.

Built-in effects:

- `createWebGpuCopyPostEffect(...)` samples the previous pass and writes it
  unchanged.
- `createWebGpuFxaaPostEffect(...)` applies a single-pass FXAA shader.
- `createWebGpuBloomPostEffect(...)` declares a renderer-owned
  downsample/upsample graph. The default route builds two lower-resolution
  bright-pass levels, upsamples the lowest level, and composites the blurred
  glow back into the final output.
- `createWebGpuSsaoPostEffect(...)` reconstructs positions from the selected
  camera projection, supporting both orthographic and perspective cameras.
  MSAA depth uses the nearest covered surface; normal reconstruction avoids
  crossing depth discontinuities. `radiusPixels` is a screen-space radius.
  Camera changes update a uniform and reuse the pipeline. Direct callers of
  `prepare()` should supply `projectionMatrix`; without it, `near`, `far` and
  `fovYRadians` provide a perspective fallback. The current effect is single-pass
  SSAO, with no temporal accumulation or spatial denoiser. Low sample counts can
  still show grain in contact regions. Indirect-only attenuation is used when
  the renderer provides the indirect color channel; otherwise AO multiplies
  the composite color, including in the current MSAA route.

`examples/post-effects.html` renders a worker-authored ECS scene through the
same app path and exposes FXAA/Bloom toggles for browser validation.

## Custom Effect Shape

A custom effect implements `WebGpuPostEffect` from
`@aperture-engine/webgpu`. Its `prepare(...)` method receives only renderer
state: the WebGPU-like device, the previous pass texture, output format,
dimensions, camera projection, frame number, pass index, and label. It returns ordinary render-pass
commands such as `setPipeline`, `setBindGroup`, and `draw`.

Keep custom effects within the renderer boundary:

- Sample `options.input.texture` through a texture view and bind group.
- Create or reuse WebGPU resources inside the effect object or a renderer-owned
  cache.
- Return JSON-safe diagnostics when resources cannot be prepared.
- Do not query ECS, mutate simulation state, or store game entities inside the
  effect.

The app frame report includes `postEffects` entries with effect id, label,
input, output target, readiness, draw-call count, and optional graph pass /
resource counts so agents can inspect the chain without raw GPU handles.
