# SharedArrayBuffer Snapshot Transport

Updated: 2026-05-21

The default browser transport remains transferable `postMessage` snapshots.
That path works in embedded pages and does not require special HTTP headers.

High-scale apps can opt into SharedArrayBuffer transport:

```js
const created = await createWebGpuApp({
  canvas,
  simulationWorker,
  sourceAssets,
  transport: "shared-array-buffer",
  sharedSnapshotTransport: {
    maxEntities: 16_384,
    maxViews: 8,
  },
});
```

In this mode, the WebGPU app allocates shared double-buffered snapshot storage
and passes it to the simulation worker during `app.start()`. The worker attaches
with `createSharedSnapshotTransportViews()`, writes transforms, view matrices,
optional instance tint floats, and fixed-stride packet words, then posts a small
frame message with the packet registry snapshot and diagnostics. The renderer
reads the latest complete frame through the SeqLock header and decodes packet
metadata with `decodeSnapshotPackets()`.

## Deployment Constraint

SharedArrayBuffer requires a cross-origin isolated page in browsers. Serve the
page and worker modules with:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

MDN documents this as the COOP+COEP combination required for
`crossOriginIsolated` browser features, including SharedArrayBuffer. Aperture's
example server already sends these headers, so `examples/sab-cube.html` can
exercise the mode directly.

When those requirements are not met, `createWebGpuApp({
transport: "shared-array-buffer" })` still initializes the renderer and reports
a typed transport diagnostic:

```json
{
  "requested": "shared-array-buffer",
  "active": "transferable",
  "fallback": "transferable",
  "sharedArrayBuffer": {
    "supported": false,
    "diagnostic": {
      "code": "webGpuApp.sharedSnapshotTransportUnsupported",
      "reason": "cross-origin-isolation-required"
    }
  }
}
```

The app or worker can then continue with the default transferable path if it
implements that fallback. `examples/sab-cube.html` intentionally requires SAB so
the browser proof stays explicit.

## Trade-Off

SAB transport removes per-frame ownership transfer for hot snapshot data. It is
most useful for large visible-entity counts where transforms and packet metadata
dominate frame transport. Smaller apps should stay on the default transferable
mode because it is simpler to host and works without COOP+COEP.
