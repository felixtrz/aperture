# Render Snapshots And Bundles

`RenderSnapshot` is the per-frame extraction product from ECS. It is structured
clone friendly and contains renderable facts for one frame: views, draws,
transforms, lights, bounds, diagnostics, and stable asset handles. It does not
own app state and it does not contain GPU objects.

`RenderBundle` is the renderer input artifact used by the headless workflow. It
contains a `RenderSnapshot` plus the source-asset registry entries needed to
turn that snapshot into pixels later. The renderer should not need app modules,
simulation systems, DOM state, network fetches, or source asset files when a
strict bundle is complete.

Current bundle files use the v1 `aperture.render-bundle` envelope. The CLI
preflights referenced assets, records engine/schema/render-target
requirements, closure/provenance metadata, diagnostics, and a deterministic
digest, rejects missing or unready assets, and fails placeholder assets unless
the renderer is explicitly run with `--allow-placeholders`. Referenced
environment maps must carry an embedded equirect, diffuse cube, or specular PMREM
payload; URL-only or externally prepared environment resources fail preflight.
The render harness prepares embedded environment payloads before calling
`renderSnapshot()`, so the bundle remains renderer-only.

The renderer still accepts the older `aperture-render-snapshot` shape as a
legacy input so existing artifacts fail with actionable diagnostics rather than
opaque schema errors. New writers must emit `aperture.render-bundle`.

Current `aperture render` support for bundle render targets is intentionally
strict: width and height are applied to the canvas, sampleCount `1` and `4` are
passed into the WebGPU app, and `srgb` output is honored. Unsupported target
requirements such as `display-p3` or non-core sample counts fail preflight
instead of being silently rendered through a different target. `--json` records
the renderer side of the run: browser channel, WebGPU adapter metadata where the
browser exposes it, requested dimensions, actual PNG dimensions, and bundle
digest.

Load-bearing rules:

- ECS remains authoritative.
- Rendering remains a derived view of extracted ECS state.
- Render extraction is the artifact boundary.
- Strict render bundles do not perform network fetches or read app asset files.
- Placeholder assets are visible metadata, not an accidental success state.

Related commands:

```sh
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --asset-mode strict
pnpm exec aperture render snapshot.json --out frame.png --width 1280 --height 720
```
