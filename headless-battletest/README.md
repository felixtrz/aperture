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
| `app/` | The scaffolded `game` app, extended + verified headless-first |
| `app/src/systems/` | Game systems (setup, player+jump, spawner, hazard, camera-follow) |
| `app/boids/` | An original deterministic flocking sim, developed headless-first |
| `app/res/`, `app/hier/`, `app/audio/`, `app/edge/`, `app/stress/` | Focused probes (resources, hierarchy, audio, error/edge cases, scale) |
| `app/test/` | Reusable serve-protocol harness + gameplay/boids invariant suites + `all.mjs` runner |
| `app/artifacts/` | Render bundles + PNGs (headless-browser white vs xvfb correct) |
| `serve-driver.mjs` | NDJSON client for `aperture headless serve` |
| `mcp-driver.mjs` | Minimal MCP stdio client (`aperture mcp stdio`) |

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
