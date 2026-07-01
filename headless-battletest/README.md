# headless-battletest

A from-scratch battle-test of Aperture's **headless flow**: build every package
to a `.tgz`, install them into a fresh consumer project like an npm user, then
develop a real application headless and compare against the headed (browser)
flow.

- **[`REPORT.md`](./REPORT.md)** — the detailed report (start here): what works
  (25 wins), 15 findings ranked by severity (two HIGH: F5 reset crash, F15
  skinned-animation freeze — both root-caused with verified fixes), 14
  observations, the headless-vs-headed comparison, performance, and prioritized
  recommendations.
- **[`FINDINGS.md`](./FINDINGS.md)** — the raw chronological journal (every
  command + output that produced the report).
- **[`REPRO.md`](./REPRO.md)** — a minimal reproduction for each finding.

## Layout

| Path | What |
|---|---|
| `app/` | **Starfall** — the deterministic star-catcher developed headless (custom components, RNG spawning, input, spawn/despawn). Also holds isolated subsystem probes with their own headless configs: `phys-src/` (Rapier physics), `hier-src/` (hierarchy), `fx-src/` (particles), `scale-src/` (600 entities), `wgsl-src/` (custom shaders), `spatial-src/` (raycast/overlap), `glb-src/` (real GLB), `anim-src/` (skeletal animation — F15), `batch-src/` (instanced GLB — W25), and more. |
| `viewer/` | A scaffolded `glb-viewer` template used to test GLB asset loading. |
| `pack-all.mjs` | Packs all 12 code packages to `packs/*.tgz`. |
| `make-install-pkg.mjs` | Rewrites a project's `package.json` to install those tarballs via `pnpm.overrides` (`toolbox` or `app` mode). |
| `serve-play.mjs` | Autopilot vs passive comparison over the `headless serve` loop. |
| `serve-tools.mjs`, `serve-debug.mjs`, `serve-restore.mjs` | `headless serve` tool-surface probes. |
| `mcp-smoke.mjs`, `mcp-compare.mjs`, `mcp-sweep.mjs`, `mcp-reset.mjs`, `mcp-framecap.mjs` | MCP-stdio agent-surface probes (headless + headed). |
| `app/repro-reset.mjs` | Minimal in-process repro of the F5 reset crash. |
| `serve-anim.mjs`, `make-anim-compare.mjs` | F15 skinned-animation mixer probe + before/after montage. |
| `artifacts/*.png` | Rendered proof frames (game, physics stack, GLB, headed-vs-headless, `anim_compare` F15 before/after, `batch_grid` instanced W25). |

## Reproduce

`node_modules`, `packs/`, `tarballs.json`, and lockfiles are gitignored
(machine-specific). To rebuild the local tarball install:

```sh
node pack-all.mjs > tarballs.json
node make-install-pkg.mjs app app        # patch app/package.json → local tarballs
printf 'packages: []\n' > app/pnpm-workspace.yaml   # isolate from the monorepo
(cd app && pnpm install && pnpm run typecheck)
(cd app && pnpm exec aperture headless aperture.headless.config.ts --out ../artifacts/s.json --frames 300 --seed 1 --json)
```

The committed `package.json` files use portable `^0.2.0` specs; `make-install-pkg.mjs`
re-patches them to the local tarballs for offline testing.
