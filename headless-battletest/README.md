# headless-battletest

A from-tarballs dogfood of Aperture's **headless mode**: build the engine to
`.tgz`, install like a published consumer, develop two apps entirely through the
headless loop, and compare headless vs the headed (browser) flow.

**Read [`REPORT.md`](./REPORT.md)** for the full write-up and severity-ranked
findings. [`FINDINGS.md`](./FINDINGS.md) is the raw running log.

## Layout

| Path | What it is |
|------|------------|
| `REPORT.md` | The detailed battle-test report (start here) |
| `FINDINGS.md` | Raw chronological findings log |
| `packs/` | The 12 engine `.tgz` tarballs (gitignored; regenerate — see below) |
| `overrides.json` | Maps each `@aperture-engine/*` → its tarball (`pnpm.overrides`) |
| `toolbox/` | Minimal install of the packed CLI used to scaffold the app |
| `app/` | The scaffolded `game` app + 3 more apps, all developed headless-first |
| `app/src/systems/` | **App 1 — game:** setup, player (move/jump/double-jump/dash), spawner, hazard, camera-follow |
| `app/boids/` | **App 2 — boids:** deterministic O(N²) flocking sim |
| `app/life/` | **App 3 — Game of Life:** non-3D grid cellular automaton |
| `app/platformer/` | **App 4 — platformer:** complete level (platforms, pit + fall-death, traversal, goal) |
| `app/{res,hier,audio,anim,wgsl,spatial,pick,multicam,authoring,hdr,edge,stress}/` | Focused feature probes (resources, hierarchy, audio, animation/skinning, custom WGSL, spatial queries, picking, multi-camera, render features, HDR, errors, scale) |
| `app/test/` | Reusable serve harness + invariant suites (game/boids/life/platformer/double-jump/dash) + capability probes + `all.mjs` runner (9/9, 38 assertions) |
| `app/artifacts/` | Render bundles + PNGs (incl. `F1-side-by-side.png`: headless-white vs xvfb-correct) |
| `serve-driver.mjs` | NDJSON client for `aperture headless serve` |
| `mcp-driver.mjs` | Minimal MCP stdio client (`aperture mcp stdio`) |
| `detect-blank-render.mjs` | Drop-in CI guard for the F1/F2 blank-render false-positive (flags near-uniform frames) |
| `determinism-regression.mjs` | Runs all 4 apps twice and asserts bit-identical bundle digests (4/4 ✓) |

## Reproduce

```sh
# 1) build + pack the engine (from the repo root)
pnpm run build
for p in math simulation render physics physics-rapier runtime webgpu audio ui vite-plugin app cli; do
  pnpm --filter "@aperture-engine/$p" pack --pack-destination headless-battletest/packs
done

# 2) install the app from tarballs
cd headless-battletest/app && pnpm install --ignore-workspace

# 3) run the full headless validation suite (no browser)
node test/all.mjs

# 4) headed render (blank-white headless-browser here; correct under xvfb — see REPORT F1)
APERTURE_RENDER_HEADLESS=1 node_modules/.bin/aperture render artifacts/midfield.bundle.json --out /tmp/x.png
xvfb-run -a node_modules/.bin/aperture render artifacts/midfield.bundle.json --out /tmp/x.xvfb.png
```

`overrides.json` and the `app/package.json` `pnpm.overrides` use absolute
`file:` paths to `packs/`; regenerate them if you move the directory.
