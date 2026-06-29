---
"@aperture-engine/cli": minor
"@aperture-engine/render": minor
"@aperture-engine/app": minor
---

Add a smaller agent validation loop: two new CLI commands.

`aperture headless <config> --out <bundle>` runs an app's ECS/simulation in
pure Node (no browser) via an in-process Vite SSR runner, steps a fixed
timestep with optional input injection, and writes a self-contained render
snapshot bundle (snapshot + serialized source-asset registry).

`aperture render <bundle> --out <png>` renders one image on demand from a saved
bundle by booting a headless-friendly browser, rehydrating the source assets,
and applying the snapshot through the WebGPU renderer — decoupled from any live
simulation.

Supporting public API: a typed-array-safe `RenderSnapshot` JSON codec
(`renderSnapshotToJsonValue` / `renderSnapshotFromJsonValue` and the generic
`encodeTypedArrayTree` / `decodeTypedArrayTree`) from `@aperture-engine/render`,
and a new `@aperture-engine/app/asset-mirror` entry point exposing
`serializeSourceAssetRegistry` / `mirrorSourceAssetRegistryFromMessage`.
