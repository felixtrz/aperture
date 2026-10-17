# @aperture-engine/adapter-node

Direct Dawn-backed WebGPU for Aperture's Node tooling using pinned `webgpu@0.6.2`.
No vgpu, browser, DOM, canvas or Xvfb is required by this adapter.

```js
const native = await createNodeDevice({ adapter: "software" });
const output = createOffscreenOutput(native.device, {
  width: 385,
  height: 257,
});
// Use native.device and output with the shared renderer.
// Read output.readRgba(), then dispose the app, output and native device.
```

Import both functions from this package. Software policy requires a separately
provisioned driver; it never installs one. Devices expose capabilities, loss and
validation errors. Output readback supports aligned RGBA/BGRA and straight alpha.
Explicitly dispose devices to release Dawn's native event loop.

See [setup, qualification and metadata migration](https://github.com/felixtrz/aperture/blob/main/docs/DAWN_NODE_RENDERING.md).
