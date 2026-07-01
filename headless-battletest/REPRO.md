# Finding reproductions

Minimal repro for each finding. Run from `headless-battletest/` after the local
tarball install (see README). `app/` is Starfall (custom components); `viewer/`
is the scaffolded glb-viewer. Verified-fix findings note the patch that resolves
them.

| # | Sev | Reproduce | Expected-vs-actual | Verified fix |
|---|-----|-----------|--------------------|--------------|
| **F5** | HIGH | `cd app && node repro-reset.mjs` (or serve `{"cmd":"reset"}` / MCP `app_reset`) | boot #2 of a runner with a module-scope `defineComponent` → `Cannot read properties of null (reading 'id')` | ✅ elics `entity.js:20` guard → `if (!this.componentManager.hasComponent(component))` (repro then prints "no crash") |
| **F15** | HIGH | `cd app && aperture headless anim.headless.config.ts --frames 10 --asset-mode strict --out b10.json && aperture render b10.json --out f10.png` then same at `--frames 45`; compare PNGs | rigged Soldier.glb (scale 0.01) → frame10 == frame45 byte-identical, model stuck in T-pose; mixer advances + writes 156 joint channels but skin palette frozen at identity | ✅ math `EPSILON` 1e-6→1e-12 **or** spawn model at scale>0.01 (`det(meshWorld)>1e-6`) → palette varies, render animates (`artifacts/anim_compare.png`) |
| **F6** | MED | serve: `step`→`snapshot`→`restore` on `app` | restore payload `ok:false`, `unregisteredComponent` for `starfall.star/basket`, resource `starfall.director` missing | traced: `componentRegistryFromWorld(restoreWorld)` returns 48 vs 50 at save |
| **F8** | MED | serve `app`: step, then `tool ecs_get_component_schema {component:"starfall.star"}` with live stars | `componentSchemaNotFound` (but `ecs_query {withComponents:["starfall.star"]}` matches) | ✅ enumerate via `entityManager.indexLookup` instead of `registerQuery({required:[]})` (schema then found) |
| **F9** | MED | `cd viewer && aperture headless aperture.headless.config.ts --out b.json && aperture render b.json --allow-placeholders` | `meshDraws:0` → `webGpuApp.emptySnapshot`; `--asset-mode hybrid/strict` fixes it | traced |
| **F1** | MED | `aperture headless` on the `game` template + `aperture render` | config `render.clearColor` set, background renders black; `config/index.ts:387` never read | traced |
| **F2** | MED | build `app`, read `.aperture/generated/aperture-env.d.ts` | empty `ApertureGeneratedActionMap` though config has 2 actions (defined via factory) | traced |
| **F4** | MED | `aperture headless … --inject '[{"actions":{"move":true}}]'` | axis action → basketX 0, no warning (button/pointer work) | traced |
| **F7** | MED | MCP `frame_capture` on headed vs headless, `{width:480,height:320}` | headed → inline image 960×640 (dims ignored); headless → text+pngPath 480×320 | observed |
| **F10** | MED | serve/MCP headless `tool input_inject {actions:{move:true}}` | `toolUnavailable: not available in a headless session` (docs list it as shared) | observed |
| **F13** | MED | `app/multi.headless.config.ts` → headless → `aperture render` | 2 views extract; render is all-black (fractional viewport) | observed |
| **F14** | MED | `app/bloom.headless.config.ts` (bloom:true + emissive) → render | no bloom halo; bundle has no bloom/exposure keys | traced |
| **F3** | LOW | edit a signal in the config, `pnpm typecheck` | `this.signals.*` stays `unknown`/possibly-undefined; no regen outside vite | traced |
| **F11** | LOW | `aperture headless aperture.config.ts` (the browser config) | `Cannot read properties of undefined (reading 'BASE_URL')` (not a mode-mismatch message) | traced |
| **F12** | LOW | put a type-error system in `phys-src/`, `pnpm typecheck` | passes (scaffold tsconfig only includes `src/**`); same file in `src/systems/` errors | ✅ broaden `tsconfig.include` (this repo's `app/tsconfig.json` shows the fix) |

Observations O1–O13 and wins W1–W24 are in `FINDINGS.md`; the polished writeup is
`REPORT.md`.
