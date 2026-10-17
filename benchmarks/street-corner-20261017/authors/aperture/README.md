# Aperture street corner

A deterministic procedural low-poly street-corner diorama, authored through Aperture 0.3.0's public app facade and ECS worker route. All geometry, materials, lettering and foliage are authored in `src/systems/scene.system.ts`; no external image or mesh assets are used.

Final verified image: [final render](../../evidence/aperture/final/render.png). Capture label: **final**, 1200 × 900, DPR 1, time 0. The source scene matches the retained final capture snapshot. The final pass is frozen.

The composition includes the three-storey corner cafe, two-storey bookshop, wrapped striped awnings, pale paving, L-shaped street and crossing, two compact cars, two trees and lamps, a bench and cafe seating. Interior detail, typography, car contours and the curb corner are intentionally simplified. See `result.json` for full scope and limitations, and `journal.md` for iterations.

## Build

From this author directory:

```sh
node /workspace/aperture/node_modules/vite/bin/vite.js build
```

The generated browser app uses demand rendering, 4× MSAA, ACES, the default daylight environment, a warm shadow-casting sun, SSAO and subtle bloom. The orthographic camera has a 15.8-unit vertical span. The common harness selects and holds time 0 using the public exact-frame capture API.

## Reproduce through the approved route

From `/workspace/aperture`, in a fresh coordinator-managed verification evidence run:

```sh
node benchmarks/street-corner-20261017/shared/capture.mjs aperture reproduce-final
```

The judged author run consumed all six captures, including one early author-mesh validation failure. Later coordinator verification is separate from author iteration. Retained build, capture, timing and native WebGPU proof files live alongside the final image.
