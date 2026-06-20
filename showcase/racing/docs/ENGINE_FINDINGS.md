# Aperture Engine Findings — from the Racing Port (2026-06-14)

Bugs and gaps discovered porting `references/Starter-Kit-Racing` to Aperture. The
port is a release proof-point; these are first-release-relevant engine issues.

## Engine bugs FIXED (in `packages/*`, rebuilt + repacked to `racing/vendor`)

1. **Managed-browser used SwiftShader → intermittent full-screen magenta.**
   `packages/cli/src/dev/browser.ts` launched Playwright's **bundled Chromium** with
   `--enable-unsafe-webgpu`, which let WebGPU fall back to the software (SwiftShader)
   adapter on ~half of loads → garbage magenta frames. Fixed: launch the user's real
   Google Chrome (`channel: "chrome"`), drop `--enable-unsafe-webgpu` and
   `--use-angle=metal`; keep only the benign anti-backgrounding flags. Now matches a
   normal Chrome (hardware Metal adapter, never magenta).

2. **ECS entity-capacity hard cap (1000) with a cryptic crash.**
   The ECS storage layer **elics** (`elics@^3.4.2`, dep of `packages/simulation`)
   allocates each component column densely at `entityCapacity` ONCE and **never grows**;
   exceeding it throws `RangeError: offset is out of bounds`, surfaced as
   `aperture.spawn.gltfReplayFailed: gltfEcsReplay.componentApplyFailed: offset is out of
bounds`. elics' default is only **1000** — a decorated track (~1000+ entities, each
   glTF expands to several) crashes the worker. Fixed: `createWorld` in
   `packages/simulation/src/ecs/index.ts` now defaults `entityCapacity` to
   `DEFAULT_ENTITY_CAPACITY = 16384` (overridable via `worldOptions.entityCapacity`).
   **Deeper fixes still needed (first-release):** elics should grow storage dynamically,
   OR aperture should pre-check capacity and emit a clear diagnostic ("entity capacity N
   exceeded — raise worldOptions.entityCapacity") instead of "offset is out of bounds";
   and `entityCapacity` should be exposed in the public app config.

(App-side fix, for the record: `quatLookAt` in the port's `src/lib/math.ts` returned the
conjugate rotation — that was app code, not the engine; see PORT_PROGRESS.md.)

## Engine GAPS / LIMITATIONS discovered (first-release punch list)

3. **No `LightKind.Hemisphere`** (engine has Ambient/Environment/Directional/Point/Spot/
   RectArea — `packages/render/src/rendering/authoring*.ts`). three.js's HemisphereLight
   (sky color to up-facing, ground to down-facing) is the standard soft outdoor fill; the
   only stand-in is a flat ambient, which has no normal dependence, so a bright sun's
   specular reads as a glossy sheen on matte surfaces (the "reflective road"). Worked
   around app-side by biasing the flat ambient toward the sky color. Proper fix: add a
   Hemisphere light kind (authoring component + shader term), or document the Environment
   light as the intended hemispheric/IBL fill path.

4. **GPU particle pipeline is a procedural placeholder — not production-usable.**
   The subsystem is wired end-to-end (`ParticleEmitter` component, `createParticleEffectAsset`,
   extraction, WebGPU frame submit) BUT `packages/webgpu/src/render/particles/particle-pipeline.ts`:
   - fragment shader is `return input.color;` — **no texture sampling** (effect's
     `texture`/`sampler`/`atlasFrameCount` are accepted but ignored) → can't render sprites;
   - compute/vertex spawn in the world **XY plane with Z hardcoded to 0** (`packages/webgpu/src/app/particles.ts:589-590` forwards only origin[0]/[1], drops world Z) → wrong plane for a 3D ground game;
   - **no billboarding** (quad expanded in world XY, not camera-facing);
   - **additive blend + depthCompare 'always'** only → grey smoke brightens the scene, ignores occlusion;
   - **procedural looping life** (`fract(time/lifetime)`), not emission/burst/gravity driven.
     Plus app-surface gaps: `spawn` facade has **no `particles()`/`sprite()`** command
     (`packages/app/src/systems/spawn/commands.ts`); `@aperture-engine/app` doesn't re-export
     the particle authoring APIs; and there's **no public path to register a `particle-effect`
     asset** (config asset kinds are only gltf|texture|hdr|shader; the `AssetRegistry` isn't
     exposed on the system instance). → Smoke trails need a real textured/billboarded particle
     pass + an app-facing spawn/asset surface.
     **Port workaround (DONE):** `particles.system.ts` (p125) sidesteps the GPU particle pass
     entirely — renders smoke as app-built **textured billboard quads** (dynamic unlit mesh, same
     path as drift marks; pool 1280, camera-facing, `/sprites/smoke.png`). Works app-only. The
     GPU pipeline still needs the above fixes to be usable for real particle effects.

5. **Config `asset.texture(url)` registers a handle but NEVER decodes pixels** — only the glTF
   path decodes images; the bootstrap's texture `request()` just `markReady`s a `{id,kind,url}`
   stub, so a config-declared texture is never sampleable. The smoke system had to fetch +
   decode the PNG itself in the worker (`createImageBitmap`/`OffscreenCanvas`) and `markReady` a
   real `TextureAsset` + `SamplerAsset`. Also `decodeImageBytesWithBrowserCanvas` (the engine's
   own decoder) is NOT re-exported from `@aperture-engine/render` (internal to the glTF path), so
   ~30 lines had to be inlined. First-release fixes: make config `asset.texture` actually decode,
   and re-export the image decoder.

6. **Drift marks — IMPLEMENTED (`drift-marks.system.ts`, p135), but via a non-public
   registry path.** The engine DOES support app-built dynamic vertex-color unlit meshes:
   `UNLIT_VERTEX_COLOR_MESH_WGSL` (auto-selected when the MeshAsset's vertex layout has a
   COLOR_0 attribute — `packages/webgpu/src/materials/unlit/unlit-pipeline.ts`), plus
   `createUnlitMaterialAsset` + render state (alphaMode "blend" → depthWrite off, cullMode
   "none" → double-sided — `packages/render/src/materials/factories.ts`). System loads and
   runs without error; marks render when driftIntensity>0.5. TWO gaps surfaced:
   (a) **AssetRegistry is not exposed on the system context** — see #7;
   (b) **`polygonOffset` is not wired** — `DepthStateDescriptor` has `bias`/`biasSlopeScale`
   (`packages/render/src/materials/types.ts`) but they're NOT threaded into the WebGPU
   depthStencil descriptor (`material-render-state.ts` ignores them; only light-shadow
   depthBias is wired). Worked around with a 0.05 Y-offset; wiring depth bias is a polish
   follow-up.

7. **No public way for an app system to register a dynamic asset.** Creating a runtime
   mesh/material/particle-effect requires the `AssetRegistry`, but it is NOT on
   `ApertureSystemInstance` (its `world` is typed `unknown`; no `assetsRegistry`/registry
   field; `MaterialAccess` only get/sets existing handles). The drift-marks system reaches
   it via `this.world.globals.<context>.assetsRegistry` (a cast hack). This blocks the
   clean implementation of drift marks AND particles (both need to publish runtime assets).
   First-release fix: expose the asset registry (or a `spawn.mesh`/material registration
   path for dynamic, mutable assets) on the public system surface. Also: config asset kinds
   are only gltf|texture|hdr|shader — add particle-effect / audio kinds.

(App config also doesn't expose `@aperture-engine/render`/`/simulation` as dependencies by
default — the port had to add them to import the mesh/material factories; the public
`@aperture-engine/app` surface should re-export what app systems need.)

6. **Audio — DONE app-side, but the high-level `AudioEngine` has no imperative voice API.**
   `createApertureApp` accepts `physics?` but has **no `audio?` option**, and
   `@aperture-engine/audio`'s `AudioEngine` only drives sound via
   `applySnapshot(renderSnapshot, dt)` reconciling `AudioEmitterPacket[]` produced by the
   ECS — there is no `engine.playLoop(buffer)` / `setVoicePlaybackRate(...)`. The racing
   port therefore drives audio from the **main thread** (`src/audio.ts`, wired from
   `hud.ts`) by building voices directly on the _lower_ public seams
   `createWebAudioBackend` + `createAudioMixer` (+ backend `createSource/createGain/
createBiquad`, `busInput`), reading the `speed`/`throttle`/`driftIntensity` signals.
   This works with NO engine patch, but the first-release gaps are: (a) no `config.audio`
   enablement / app-facing audio surface (you must drop to the backend/mixer); (b)
   `AudioEmitterPacket` can't express the per-gear lowpass/RPM model, so even the snapshot
   path couldn't reproduce a vehicle engine sound; (c) the `speed` signal is normalized
   0..1 while the reference's skid-pitch formula assumes raw 1..3 (adapted app-side).

## Tooling note

- The `mcp__aperture__ecs_get_entity` / `ecs_find_entities` MCP tools ignored my
  `key`/`keyPattern`/`tags`/`limit` params (returned entity 0 or the full untruncated
  set). Worked around by reading the saved JSON with `jq`. Worth checking the MCP arg
  schema/forwarding.
- `input_action_set` (virtual action) does NOT reach the simulation worker; only real
  `input_key` events forward. Worth documenting or unifying.
- **Occluded-window WebGPU renders BLACK (hard e2e/screenshot limitation).** When the
  managed Chrome window is occluded by other apps, the WebGPU `<canvas>` composites pure
  black (verified: Playwright `page.screenshot` = 99% `(0,0,0)` + only the HTML HUD panel
  visible) — even though `document.visibilityState === "visible"`, the sim worker is
  healthy, and `--disable-features=CalculateNativeWinOcclusion` + the backgrounding flags
  are set. So it's an **OS-compositor / GPU-surface** drop, not rAF/visibility throttling.
  Exhausted fixes: page reload, session restart, `osascript activate`, CDP
  `Browser.setWindowBounds`+`bringToFront`, and patching `requestAnimationFrame`→`setTimeout`
  — none restore compositing. The only reliable fix is a genuinely on-screen (non-occluded)
  window. This blocks headless/occluded visual verification + screenshot parity in the
  managed browser; viewing in a foreground tab works. First-release: either an offscreen
  render-target → readback path that survives occlusion, or document the foreground
  requirement for visual e2e.
