# Agent authoring gap: three.js vs Aperture

A paired experiment (2026-10-26): independent AI coding agents authored the
same two 3D environments, once with three.js r186 and once with Aperture, then
logged every lookup, error and workaround as they went. This document records
the method, the measured gap, the root causes, and the Aperture changes made in
response. Like [the authoring baseline](AGENT_AUTHORING_BASELINE.md) it is
evidence about concrete workflows, not a general model benchmark.

## Method

- **Briefs.** Two scenes with 12 scored requirements each: a lakeside
  low-poly campsite at dusk (terrain, lake, 40+ trees of two kinds, rocks,
  tent, campfire with flickering light, dusk sky and fog, animation) and a
  sunny town plaza (street grid, 12+ buildings with windows and roof details,
  two-tier translucent fountain, furniture, glowing lamps, parked and moving
  cars, a flag, afternoon sun).
- **Agents.** One fresh agent per (engine × brief), identical prompts apart
  from the engine section, no knowledge of the other runs. The three.js agents
  started from an empty package with `three@0.186.1`; the Aperture agents
  started from a fresh `aperture create` scaffold linked to the local build,
  with the repository docs, examples and package sources readable.
- **Verification.** The sandbox forbids launching a browser, so both engines
  were previewed by the same CPU rasterizer (Lambert + hemisphere ambient +
  point/spot falloff + one sun shadow map + fog + alpha blending + ACES; no
  textures, IBL specular or bloom), fed by a three.js scene graph or an
  `aperture headless` render bundle. Pixels are composition evidence only.
- **Measures.** Requirements met, tool calls, tokens and wall time (from the
  agent runtime), plus self-reported lookup calls, errors and preview
  iterations from each agent's friction log.

## Round 1 results

| Run               | Reqs  | Tool calls | Tokens | Minutes | Lookups | Errors | Scene LOC |
| ----------------- | ----- | ---------: | -----: | ------: | ------: | -----: | --------: |
| three.js campsite | 12/12 |         51 |   207k |      20 |      ~7 |      0 |     1,394 |
| Aperture campsite | 12/12 |        127 |   332k |      25 |     ~68 |      1 |     2,194 |
| three.js plaza    | 12/12 |         63 |   210k |      20 |     ~10 |      0 |     1,292 |
| Aperture plaza    | 12/12 |        133 |   341k |      30 |     ~40 |      2 |     2,296 |

Visual results were comparable: all four scenes met every requirement and
read as intentional, cohesive low-poly scenes. The gap was cost: Aperture runs
used about 2.2× the tool calls, 1.6× the tokens, and 5–10× the lookups, and
needed ~60% more scene code. Most lookups were into engine **source**, not
docs, to work around facade gaps; typecheck and runtime errors were rare on
both engines.

## Root causes (both Aperture agents, independently)

| Gap                                                                                                                                                                                                       | Evidence                                                                                                                | three.js equivalent                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `material.standard()` had no transparency or double-sided option; translucent `baseColor` alpha was silently ignored. Blending needs `alphaMode`, the `alpha` blend preset and depth writes off together. | Both agents reverse-engineered render state from showcases and validation code, then patched it after spawning.         | `transparent`, `opacity`, `side`                                                    |
| No public way to create a shareable material or mesh handle; handle types and constructors were not exported from `@aperture-engine/app/systems`.                                                         | Both relied on the internal `${key}.material` / `${key}.mesh` id convention.                                            | reuse one `Material` / `BufferGeometry` object                                      |
| Authoring a sky dropped all image-based lighting.                                                                                                                                                         | Both copied `default-environment.ts` internals (or hacked the default entities at runtime) to get fill light back.      | `PMREMGenerator.fromScene(sky)` (manual)                                            |
| `ProceduralSky.horizonPosition` is ~75% screen-space and undocumented; `priority` was ignored by the renderer.                                                                                            | Both read the WGSL shader; one found the priority bug.                                                                  | —                                                                                   |
| No vertex colors, merge or flat shading on the facade; tapered cylinders hidden behind a single `radius`.                                                                                                 | Both wrote frustum builders, triangle mergers and face-normal code (~650 lines in one run); one built raw `MeshAsset`s. | `CylinderGeometry(rTop, rBottom)`, `mergeGeometries`, `vertexColors`, `flatShading` |
| Docs imported `@aperture-engine/render`, which a scaffolded app cannot resolve.                                                                                                                           | Both hit unresolvable imports in AUTHORING.md examples.                                                                 | —                                                                                   |
| `hexColor()` returns unconverted sRGB channels.                                                                                                                                                           | One agent wrote its own sRGB-to-linear `hex()`.                                                                         | `new Color(0xff8800)` linearizes                                                    |

Friction both engines shared (left as is): seeded scatter/noise helpers,
browser-free visual verification, and three.js-specific deprecations
(`PCFSoftShadowMap`, `Clock`) that only surface as console warnings.

## Changes

| Gap                         | Change                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transparency / double-sided | `material.standard()` and `material.unlit()` take `opacity` and `doubleSided`; standard also takes `alphaMode`, `alphaCutoff` and `renderState`. Opacity (or `baseColor` alpha) below 1 implies alpha blending with a valid render state. Invalid values throw `aperture.spawn.invalidMaterialSurface`. |
| Shared assets               | `this.materials.create(id, descriptor)` and `this.meshes.create(id, descriptor)` return handles; `meshes.publish()` / `meshes.dynamic().publish()` accept primitive descriptors; handle and `MeshAsset` types are re-exported from `@aperture-engine/app/systems`.                                      |
| Sky lighting                | An authored `ProceduralSky` without an environment or ambient light gets a sky-matched IBL (`environment.sky`) derived from its own colors; the highest-priority sky wins. Sky plus `ambient` keeps the previous behavior.                                                                              |
| Sky semantics               | The WebGPU renderer draws the highest-`priority` sky; `ProceduralSkyInput` fields are documented, including the screen-space horizon.                                                                                                                                                                   |
| Geometry                    | `mesh.merge(parts, { flatShading })` (render: `createMergedMeshAsset`), per-vertex `colors` on `mesh.triangleList` / `mesh.heightfield`, `radiusTop` / `radiusBottom` / `height` / `heightSegments` on `mesh.cylinder`, `height` on cone and capsule.                                                   |
| Colors                      | `color.hex()` / `color.srgb()` return linear tuples accepted by every color option; `hexColor()` documents that it does not linearize.                                                                                                                                                                  |
| Discoverability             | AUTHORING.md opens with a three.js-to-Aperture mapping and its examples no longer import render internals; scaffolded AGENTS.md / CLAUDE.md carry a compact version.                                                                                                                                    |

The second-tier fixes from round 2 (below) are part of the same change.

Tests: `test/app/three-parity-authoring.test.ts`,
`test/cli/headless-command.test.ts`,
`test/mesh/vertex-colors-merge.test.ts`,
`test/webgpu/procedural-sky-selection.test.ts`, and updated
`test/app/default-environment.test.ts`.

## Round 2 (after the changes)

Two fresh Aperture agents repeated both briefs on the changed build with the
same prompts (new scaffolds, which now carry the three.js mapping). Neither
saw round 1.

| Run                  | Reqs  | Tool calls | Tokens | Minutes | Lookups | Errors | Scene LOC |
| -------------------- | ----- | ---------: | -----: | ------: | ------: | -----: | --------: |
| Aperture campsite R1 | 12/12 |        127 |   332k |      25 |     ~68 |      1 |     2,194 |
| Aperture campsite R2 | 12/12 |        109 |   267k |      21 |     ~45 |      1 |     1,982 |
| Aperture plaza R1    | 12/12 |        133 |   341k |      30 |     ~40 |      2 |     2,296 |
| Aperture plaza R2    | 12/12 |         95 |   273k |      23 |     ~32 |      2 |     2,377 |

Against the three.js runs (51/63 tool calls, ~207–210k tokens, ~20 minutes),
the Aperture overhead fell from about 2.1–2.5× to 1.5–2.1× in tool calls, from
1.6× to 1.3× in tokens, and from 1.3–1.5× to 1.04–1.14× in wall time. Visual
results stayed at parity (the round-2 campsite was the strongest of all six
runs). Both round-2 errors were CLI usage, not scene code: both scenes
type-checked and ran on the first attempt.

The round-1 workarounds disappeared entirely. Counting occurrences in each
run's `src/`:

| Pattern                                      | R1 campsite | R1 plaza | R2 campsite | R2 plaza |
| -------------------------------------------- | ----------: | -------: | ----------: | -------: |
| internal `${key}.material` / handle literals |           7 |        8 |           0 |        0 |
| `assetsRegistry` reach-ins                   |           2 |        2 |           0 |        0 |
| copied `environment-map` asset internals     |           0 |        5 |           0 |        0 |
| raw `renderState` patches                    |           1 |        2 |           0 |        0 |
| hand-written frustum builders                |          13 |       32 |           0 |        0 |
| `mesh.merge(` / `.create(` uses              |       0 / 0 |    0 / 0 |     14 / 31 |   4 / 12 |
| `opacity:` / `color.hex(` uses               |       0 / 0 |    0 / 0 |       3 / 5 |   2 / 66 |

Round 2 surfaced a smaller second tier, also addressed in this change:

- Per-entity color/fade on shared materials → `spawn.mesh({ tint })`, with
  `InstanceTint` exported for runtime changes.
- `aperture headless --determinism error` demanded `--out` (hit by three of the
  four Aperture agents) → `--json` runs no longer require a bundle path; the
  help now states the real `hybrid` asset default.
- Undocumented Euler order, light falloff/range and spot-cone units → JSDoc on
  the options and an "Animate lights, colors and geometry at runtime" section.
- `render_diagnose` listed as a headless-loop tool but unavailable in
  `headless serve` → scaffold guidance says it renders a frame (MCP plus a
  WebGPU browser).
- Seeded fixed layouts → `createApertureRandom(seed)` documented; stale
  primitive list and an over-regular "quick rock" recipe fixed.

Still open: the procedural sky gradient is screen-anchored by design (agents
retune it per camera); animated water/cloth republish whole meshes each frame
(no vertex-displacement material); `--json` status truncates entity
summaries; and there is no browser-free lighting-health check. Lookup counts
remain 3–5× three.js — prior training exposure to three.js is a gap docs can
narrow but not erase.

## Scope of evidence

Two briefs, one agent per cell, one model family: a directional signal, not
a statistically powered comparison. Lookup and error counts are agent
self-reports; tool calls, tokens and wall time come from the agent runtime.
Previews are a shared CPU approximation, so material gloss, IBL reflections,
bloom and the real sky shader were never seen in either engine — final visual
acceptance still needs the WebGPU renderer.
