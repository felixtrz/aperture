# Shadow Parity Investigation — Handoff

**Date:** 2026-06-15
**Repo:** `/Users/felixz/Projects/aperture` (monorepo) · lab app: `shadow-lab/`
**Branch:** `racing/render-checkpoint`

---

## 0. The standing goal (active `/goal`, Stop-hook enforced)

> "Do a clear audit of how shadow works in the WebGPU route of three.js and in
> PlayCanvas, clearly understand the delta of those implementations vs aperture.
> This is a very very critical area, we need to fix this properly. **DO NOT STOP
> until we at least have parity with those implementations.**"

A Stop hook blocks ending the turn until parity holds. Parity is **not** reached
yet — see §3 (the protrusion bug) and §6 (open camera-sync issue).

### Hard constraints (from the user, do not violate)
- **No hacky fallbacks / compat shims / magic-threshold branches.** The framework
  is very early; zero backward-compat concern through ~mid-2027. Always do the
  clean, principled thing. (See memory `no-hacky-fallbacks`.)
- **Do NOT touch the parked `racing/` app.** It is the reference port, frozen.
- **Felix does not use Chrome personally.** Every Chrome process on this machine
  is aperture-launched and safe to kill. VSCode is the only "real" app.
- Beware **vendored-tgz / npm cache propagation** — engine source edits do **not**
  reach the lab until rebuild → repack → `pnpm install --force` → dev restart
  (see §4.3). This has caused "my change isn't showing up" scares twice.

---

## 1. What we're actually investigating

We are bringing aperture's **WebGPU directional-shadow** rendering to parity with
three.js (WebGPU/TSL route) and PlayCanvas. The audit found three concrete
deltas, two already fixed, plus one unsolved bug:

| # | Delta vs references | Status |
|---|---------------------|--------|
| A | Authored `mapSize` was **ignored** (hardcoded 1024) | **FIXED** — wired through packet codec |
| B | `normalBias` was multiplied by `0.05` (≈20× too weak) | **FIXED** — now a raw world-space distance (three.js/PlayCanvas parity) |
| C | Shadow caster face culling | **CHANGED** — flipped from three.js back-face to **PlayCanvas front-face + always-on slope-scaled depth bias** |
| D | **PROTRUSION BUG (UNSOLVED):** a caster that intersects the ground casts **no ground shadow** | **OPEN** — see §3 |

### The reproduction that exposes everything (the "tree at Y = −2.1" case)
The lab scene is a **tree built from primitives** (a cylinder trunk + 3 stacked
cones, as a parent/child hierarchy, deliberately "exactly like a glTF would be")
standing on a flat ground box. When you lower the tree so its base sinks below
the ground but the **top cone still pokes through** (set tree `Y = −2.1`),
aperture renders **no shadow at all** on the ground. A correct renderer casts the
protruding cone's shadow. This is the crux bug.

---

## 2. What has been changed in the ENGINE (already built into the served tgz)

All of these are committed to `packages/` source and are live in the lab's
vendored build right now.

1. **`packages/webgpu/src/materials/standard/standard-shader-shadow-sampling.ts`**
   - `normalBias` is now a **raw world-space distance** (removed the
     `STANDARD_SHADOW_NORMAL_OFFSET_SCALE = 0.05` multiplier in both the cascaded
     and non-cascaded blocks). `biasedPosition = worldPosition + normal *
     shadowNormalBias(...)`.
   - Contains `shadowDepthFromClip()` helper and `STANDARD_SHADOW_DEPTH_BIAS =
     0.0004` (receiver-side constant compare bias).
   - **NOTE:** a temporary `directionalShadowFrustumViz()` diagnostic function was
     added then **reverted** — the file is clean. If you re-add a viz, the
     non-cascaded color line is assembled in the `.replace(...)` near the bottom
     of this file (search `let color = ambientDiffuse + direct`).

2. **mapSize plumbing** (packet stride bumped, encoding version bumped):
   - `packages/render/src/rendering/snapshot-packet-types.ts` — added
     `readonly mapSize?: number` to `ShadowRequestPacket`.
   - `packages/render/src/rendering/snapshot-packed-encoding-constants.ts` —
     `SHADOW_REQUEST_PACKET_WORDS = 13` (was 12); `SNAPSHOT_PACKET_ENCODING_VERSION
     = 8` (was 7); offset 12 = mapSize.
   - `packages/render/src/rendering/snapshot-packed-light-codec.ts` — write/read
     mapSize at word offset 12.
   - `packages/render/src/rendering/extraction-light-settings.ts` —
     `appendShadowRequest` includes `mapSize` (default 1024 omitted).
   - `packages/webgpu/src/shadows/render-shadow-frame.ts` — descriptor honors
     `options?.mapSize ?? request.mapSize ?? DEFAULT_SHADOW_MAP_SIZE (1024)`.
     Debug logs removed.

3. **`packages/webgpu/src/shadows/shadow-caster-draw-list-plan.ts`**
   - `casterCullModeForForward` flipped to **front-face (PlayCanvas)**:
     single-sided forward `"back"` → caster `"back"` (renders FRONT faces),
     `"none"` → `"none"`, `"front"` → `"front"`. (Was inverted, three.js-style.)

4. **`packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts`**
   - `SHADOW_CASTER_DEPTH_BIAS = 2`, `SHADOW_CASTER_SLOPE_SCALE = 2.75`, applied to
     **all** cull modes via `biasForCull` (`Math.max` with authored bias).
     PlayCanvas-style always-on slope-scaled bias to clear acne from front-face
     casting.

5. **Tests updated & green** (1803 passing as of the mapSize/normalBias work):
   - `test/webgpu/shadow-caster-pipeline-descriptor.test.ts`
   - `test/webgpu/shadow-caster-draw-list-plan.test.ts`

6. **`packages/webgpu/src/app/auto-shadow-frame.ts` — UNCHANGED, prime suspect.**
   `computeShadowSceneMatrix` / `computeCasterShadowBounds` build the directional
   shadow ortho by: union of caster-AABB corners + their ground projections +
   a "ceiling extension" of maxY to the receiver ceiling; then
   `center = AABB center`, `radius = half-diagonal`, `near = radius*0.3`,
   `far = radius*3`, `lightDist = radius*1.6`, `eye = center - lightDir*lightDist`.
   **This is where the protrusion bug almost certainly lives** (see §3).

---

## 3. The PROTRUSION BUG — what we know and what's ruled out

**Symptom:** tree at `Y = −2.1` (trunk + lower cones submerged, top cone pokes
through the ground) → **no ground shadow**.

**Ruled OUT by direct experiment (each was a rebuild + retest):**
- ❌ **Caster depth/slope bias** — set `SHADOW_CASTER_DEPTH_BIAS = 0` and
  `SHADOW_CASTER_SLOPE_SCALE = 0`; protrusion **still** cast no shadow. So it is
  not peter-panning from the bias.
- ❌ **Receiver `normalBias`** — set the lab sun's `normalBias = 0`; still no
  shadow. So it is not the normal-offset eating it.
- ❌ **Face culling** — flipping to front-face (PlayCanvas) did not fix it.

**Therefore:** the bug is in the **auto-shadow ortho fit**
(`auto-shadow-frame.ts`), i.e. the directional `lightViewProjection` used for the
caster bake and/or the receiver sample is degenerate when the caster's AABB
center drops **below** the receiver plane.

**Hand geometry analysis (for Y = −2.1) said the bug "shouldn't" happen:**
center ≈ (−1.19, −0.78, 0.44), radius ≈ 4.14, near ≈ 1.24, far ≈ 12.43,
lightDist ≈ 6.63, eye ≈ (2.66, 4.30, −1.35). The top cone apex is at NDC depth
≈ 0.27, the ground under it ≈ 0.35; the apex is *closer to the light* and *inside*
[near,far] and inside the XY footprint — so the receiver *should* read "shadowed".
It reads "lit". That mismatch means a **UV / frustum / depth misalignment**
between the caster-bake `lightVP` and the receiver-sample `lightVP` for
ground-intersecting casters — **not yet root-caused at the pixel level.**

**Recommended next diagnostic (was about to do this):** a colorized
**frustum/visibility viz** in the receiver WGSL (red = receiver UV outside
[0,1], orange = depth outside [0,1], grayscale = in-frustum PCF factor). That
distinguishes "ground is out-of-frustum" (ortho XY/footprint wrong) from
"in-frustum but compare says lit" (depth/UV-alignment wrong). The previous
submerged-caster bug was cracked with exactly this technique. **Even better /
complementary:** the split-screen three.js comparison (§5) gives ground truth —
three.js with a fixed ortho should cast the protrusion; the diff heatmap will
localize the divergence.

**Likely fix shape (Opus audit P0-3, not yet implemented):** tighten the ortho
`near`/`far` to the caster's actual depth-range along the light, and stop the
receiver-ceiling extension from collapsing/skewing the depth frustum — **while
preserving** the property that a *fully* submerged caster casts no shadow.

---

## 4. Tooling: shadow-lab setup (read this before touching anything)

### 4.1 What shadow-lab is
A permanent in-browser **debug harness** (a KEEP, not throwaway). It's a normal
aperture app that **vendors the engine as `.tgz` files** in `shadow-lab/vendor/`
and pins them via `package.json` `pnpm.overrides`. A framework-free **DOM debug
panel** drives the engine's in-browser devtools runtime.

### 4.2 Running it
```bash
cd /Users/felixz/Projects/aperture/shadow-lab
pnpm exec aperture dev down            # stop any running session
rm -rf node_modules/.vite              # clear vite cache (do this after engine rebuilds)
pnpm exec aperture dev up --port 8852 --open   # --open => VISIBLE window
```
- **`--open` gives a visible Chrome window. `--headed` is a NO-OP** (CLI bug —
  `dev/session.js` only drops `--headless` when `open===true`). See memory
  `aperture-dev-headed-flag`.
- Dev server: **http://127.0.0.1:8852** · CDP: **9852**.
- **Backgrounded/occluded headed Chrome blanks WebGPU readbacks** (all-zero
  pixels). Keep the window foreground, or rely on `browser_screenshot` (CDP page
  capture works regardless). See memory `e2e-runs-foreground-or-antithrottle`.
- If the dev session hangs / drops CDP / worker-errors: **restart it yourself**
  (`dev down` then `dev up --open`) and keep going. Memory
  `auto-restart-dev-session`.

### 4.3 Engine rebuild → lab propagation (CRITICAL — easy to get wrong)
Editing `packages/*/src` does **nothing** to the lab until you rebuild, repack,
force-install, and restart dev:
```bash
cd /Users/felixz/Projects/aperture
LAB=/Users/felixz/Projects/aperture/shadow-lab
# 1. build the package(s) you changed (webgpu and/or render)
pnpm --filter @aperture-engine/webgpu run build
pnpm --filter @aperture-engine/render run build      # if you touched render/
# 2. repack into the lab's vendor dir
(cd packages/webgpu && pnpm pack --pack-destination "$LAB/vendor")
(cd packages/render && pnpm pack --pack-destination "$LAB/vendor")
# 3. force-reinstall in the lab (pnpm store is keyed by tgz path)
(cd "$LAB" && rm -rf node_modules/.pnpm/@aperture-engine+webgpu@* \
   node_modules/@aperture-engine/webgpu && pnpm install --force)
# 4. restart dev (clears vite dep cache)
(cd "$LAB" && pnpm exec aperture dev down; rm -rf node_modules/.vite; \
   pnpm exec aperture dev up --port 8852 --open)
```
- **New app SOURCE files** (e.g. a new `src/**` module or `*.system.ts`) also
  need a **dev restart** — vite scans systems at server start; HMR alone won't
  pick them up.
- To **verify the served code is actually new** (not cached): fetch the module
  over the dev server `/@fs/...` URL and grep for your change, or use
  `/tmp/checkactive.mjs`. Memory `vendored-engine-rebuild-propagation`.

### 4.4 Driving the running app (in-page runtime + MCP)
- **In-page runtime** (preferred for setting component fields):
  `window.__APERTURE_MCP_RUNTIME__.callTool(tool, payload)` — same `callTool` the
  MCP server uses. Reach it via Playwright CDP (`connectOverCDP("http://127.0.0.1:9852")`).
  The debug panel uses `ecs_set_component_field` with `value: [x,y,z]` arrays.
- **MCP tools** `mcp__aperture__*` are available (`browser_screenshot`,
  `ecs_find_entities`, `ecs_get_entity`, `render_get_frame_report`, etc.).
  ⚠️ **`mcp__aperture__ecs_set_component_field` has an array-stringify bug** —
  for writes, use the **in-page runtime** `callTool` instead (Playwright script).
- The engine has a canvas-readback devtools module
  (`packages/app/dist/browser/devtools/canvas-readback.js`) — and we confirmed
  the **main thread CAN `drawImage` from the `#aperture` canvas** (it is *not*
  worker-transferred), which is what makes the in-app pixel diff possible.

### 4.5 Helper scripts (in `/tmp`, may need recreating)
- `/tmp/treeY.mjs <y>` — sets the "tree" entity translation to `[0, y, 0]` via the
  in-page runtime. Usage: `node /tmp/treeY.mjs -2.1`.
- `/tmp/checkactive.mjs` — confirms the served caster pipeline cull mode / that
  the browser is running the new engine.
- `/tmp/camcheck.mjs` — reads the live `main-camera` LocalTransform.
- `/tmp/console.mjs` — reloads the page and dumps console logs + a DOM probe.
- `/tmp/probe-canvas.mjs` — checks whether the main thread can read the aperture
  canvas pixels.
(They all use the Playwright at `node_modules/playwright`, CDP `9852`, page on
`8852`.)

### 4.6 The lab scene (what's spawned)
`shadow-lab/src/systems/setup.system.ts`:
- **Camera** `main-camera`: fov 40°, near 0.1, far 200.
- **Sun** `light.sun`: directional, color white, illuminance `DIR_LIGHT.intensity`
  (=3), `transform.translation = DIR_LIGHT.position = [11.4, 15, −5.3]`,
  `lookAt [0,0,0]`. Shadow: `mapSize 4096`, `cascadeCount 1`, `shadowType 1`,
  `filterRadius DIR_LIGHT.shadowRadius (4)`.
  - ⚠️ **`normalBias: 0` is a DIAGNOSTIC value** (was testing). Restore to an
    authored value (~0.02–0.05) once shadows are correct.
- **Ambient** `light.ambient`: sky-biased hemisphere color, **`intensity: 0.25` is
  a DIAGNOSTIC value** (racing uses `HEMI_LIGHT.intensity = 2`). 0.25 makes
  shadows dark so their SHAPE is unambiguous; restore to 2 for the racing look.
- **Ground**: box `size 1` scaled `[40,1,40]` at `[0,−0.5,0]` → top surface at
  `y=0`. `receiveShadow:true, castShadow:false`. baseColor `[0.45,0.7,0.45]`.
- **Tree** (glTF-style hierarchy):
  - root `tree` = trunk **cylinder** `r0.25, depth1.4` at `[0, 0.7, 0]`,
    `castShadow:true`. (cylinder/cone are centered at origin; `depth` = height.)
  - 3 child **cones** parented to root via `transform: { translation, parent }`:
    `cone0 r1.4 d1.6 localY1.0`, `cone1 r1.05 d1.5 localY1.85`,
    `cone2 r0.7 d1.4 localY2.65`. All `castShadow:true`.
  - Moving "tree" Y in the panel moves the whole hierarchy (and its shadow).
- `decorations.system.ts` is disabled (`init()` early-returns).
- `aperture.config.ts`: clearColor `0xadb2ba`, `tonemap: "aces"`, `exposure 1.0`,
  `sampleCount 4`, no bloom (post FX stripped for clean shadow reads).

---

## 5. The split-screen three.js comparison harness (JUST BUILT — partially working)

The user asked for: **left = aperture, right = three.js (WebGPU), with the right
side toggleable to a pixel-diff heatmap.** This is the gold-standard parity tool.

### Files added
- `shadow-lab/src/compare/three.webgpu.js` + `three.core.js` — **vendored three
  r184 WebGPU build**, copied verbatim from
  `references/three.js/build/three.webgpu.js` (and `.core.js`). No npm install.
- `shadow-lab/src/compare/three.webgpu.d.ts` — wildcard module decl
  (`declare module "*/three.webgpu.js"`) so the `.js` import types as `any`.
- `shadow-lab/src/compare/three-compare.ts` — **`installThreeCompare()`**:
  - **Layout**: shrinks `#aperture` to `left 50vw`; adds `#sl-three` (right 50vw)
    + `#sl-diff` overlay canvas (hidden) + center divider + pane labels +
    a bottom-center **"Diff heatmap: OFF/ON"** toggle button.
  - **`buildScene()`** mirrors `setup.system.ts` 1:1 (ground box, trunk cylinder +
    3 cones in a `THREE.Group`, sun `DirectionalLight` at `[11.4,15,−5.3]` →
    target origin with shadow ortho `±8, near 0.5, far 60, mapSize 4096`,
    sky-biased `AmbientLight` intensity 0.25). Material colors set via
    `setRGB(..., LinearSRGBColorSpace)`.
  - **Renderer**: `WebGPURenderer`, `ACESFilmicToneMapping`, exposure 1,
    `PCFSoftShadowMap`, clear `0xadb2ba`.
  - **Camera**: owns a shared orbit `{azimuth:0.8, elevation:1.15, distance:20}`
    (matches the old orbit-controls defaults); drag + wheel update it and drive
    **both** renderers. Pushes the aperture camera via the in-page runtime
    (`ecs_set_component_field` translation + rotation, rotation from
    `quatLookAt` in `src/lib/math.ts`).
  - **Tree-Y sync**: polls aperture's "tree" entity translation every 200ms and
    mirrors it onto the three `Group` (so the panel's tree slider moves both).
  - **Diff** (`makeDiffer`): `drawImage` both canvases into 480×640 2D canvases,
    per-pixel max-channel abs diff → heatmap (black = identical, red → yellow =
    larger diff), `putImageData` onto `#sl-diff`.
- Wired in `shadow-lab/src/main.ts` (`installThreeCompare()` after
  `installDebugPanel()`).
- `shadow-lab/src/systems/orbit-controls.system.ts` — `update()` now
  **early-returns** (the harness owns the camera). Re-enable by deleting that
  `return;` if you ever run the lab without the comparison.

### Current state of the harness
- ✅ Boots. Both WebGPU contexts initialize. Split layout renders. three.js draws
  the scene with a clear, strong tree shadow + inter-cone self-shadowing.
- ✅ Aperture camera push works (`camcheck.mjs` shows translation
  `[5.86, 18.26, 5.69]` + a set rotation quaternion).
- ⚠️ **OPEN: the two cameras are NOT frame-locked.** Despite identical eye
  position + look-at-origin, the aperture pane renders a steeper/more top-down
  framing while the three pane renders a shallower 3/4 framing. The user flagged
  this. See §6.
- ⚠️ three.js logs a deprecation: `renderAsync()` is deprecated — switch the loop
  to `render()` (after `await renderer.init()`).

---

## 6. OPEN ISSUE #1 (blocking the comparison): cameras not synced

**Observed:** at the default pose both eyes are `[5.86, 18.26, 5.69]` looking at
origin, yet the panes show different view angles / tree sizes.

**Suspects (in rough priority):**
1. **Rotation convention mismatch.** We compute the quaternion ourselves
   (`quatLookAt`, camera forward = −Z, up = +Y) and push it to aperture's
   `LocalTransform.rotation`. If aperture's camera applies the quaternion under a
   different convention, the orientation diverges. **Best fix:** don't hand-author
   the quaternion — drive the aperture camera through an **engine camera tool**
   that takes eye + target (e.g. `camera_look_at` / `camera_set_transform`) so the
   ENGINE computes orientation in its own convention. Load those tool schemas via
   ToolSearch and check what they accept.
2. **FOV axis.** three `PerspectiveCamera(40,...)` uses **vertical** FOV. If
   aperture's `fovYDegrees` is fit to a different axis (or the aspect is computed
   differently for the now-portrait 0.75 canvas), apparent zoom differs. Verify by
   comparing actual projection matrices.
3. **Residual look-at component.** The camera was spawned with `lookAt: [0,1.5,0]`
   — confirm the engine isn't re-deriving rotation from a stored look-at target
   each frame and overriding the pushed rotation.

**How to diagnose precisely:** pull aperture's **actual view + projection
matrices** from the render diagnostics (`render_get_frame_report` /
`render_get_packets`, or the in-page `__APERTURE_GENERATED_APP__.diagnostics`) and
compare element-by-element against three's `camera.matrixWorldInverse` and
`camera.projectionMatrix` for the same eye/target. They must match for the diff to
mean anything.

---

## 7. Suggested order of work for the next agent

1. **Fix camera sync** (§6) — without it the comparison + diff are not
   trustworthy. Prefer driving aperture's camera via an engine eye+target tool;
   verify by matching view/projection matrices. Switch three's loop to `render()`.
2. **Use the now-trustworthy split-screen** to look at the protrusion (set
   tree `Y = −2.1` via the panel or `/tmp/treeY.mjs`). Toggle the diff heatmap.
   Confirm three.js casts the protrusion shadow and localize where aperture
   diverges.
3. **Root-cause the ortho** (§3) — add the receiver frustum/visibility WGSL viz if
   needed; then implement the principled ortho fix in `auto-shadow-frame.ts`
   (tighten near/far to caster depth-range; stop ceiling-extension from skewing
   depth) **without** a hacky special-case. Preserve: fully-submerged caster casts
   no shadow; on-ground tree stays crisp; no acne on the truck/double-sided.
4. **Decide on the face-cull flip.** Run-1 of the audit recommended front-face;
   the careful Opus audit said back-face is already a fine hybrid and is at parity.
   The flip did **not** fix the protrusion. Re-evaluate once the ortho is fixed —
   keep whichever matches the references with the tuned bias.
5. **Restore diagnostic values** once shadows are correct: `setup.system.ts`
   ambient `0.25 → 2`, sun `normalBias 0 → ~0.02–0.05`. (Leave orbit-controls
   disabled while the comparison harness is in use.)
6. **Re-verify the full matrix:** cube flush/submerged, on-ground tree,
   protruding tree Y=−2.1, the racing static scene (truck = double-sided, watch
   acne/peter-pan). Run `test/rendering` + `test/webgpu`. Regenerate e2e shadow
   goldens deliberately.
7. **Update memory** with the final parity findings.

---

## 8. Relevant memory entries (auto-loaded each session)

- `no-hacky-fallbacks` — the hard constraint above.
- `consult-reference-engines` — study `references/` (three.js / PlayCanvas / Bevy)
  and match or beat the best.
- `shadow-rendering-fix-2026-06-14` — the 5 earlier WebGPU directional-shadow bugs
  that were fixed (caster world-transform, N·L sign, ambient zeroed, HDR-blit
  vertical flip, castShadow:false ignored). Context for this engine's shadow path.
- `shadow-lab-debug-harness` — shadow-lab is a permanent KEEP.
- `aperture-dev-headed-flag` — use `--open`, not `--headed`.
- `vendored-engine-rebuild-propagation` — the rebuild dance (§4.3).
- `auto-restart-dev-session`, `e2e-runs-foreground-or-antithrottle`,
  `offscreen-rendertarget-readback-swiftshader` — environment gotchas.
- `ai90-done-ai91-autolayout-blocker` — tonemap (agx/neutral/aces) made
  three.js-faithful; note `aces` was just made faithful to three.js
  `ACESFilmicToneMapping` (commit `adc363b7`), which matters for the color match in
  the comparison.

---

## 9. Quick reference — file map

**Engine (packages/):**
- `webgpu/src/app/auto-shadow-frame.ts` ← **ortho fit; protrusion bug lives here**
- `webgpu/src/shadows/shadow-caster-draw-list-plan.ts` ← caster cull (front-face)
- `webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts` ← caster bias 2 / 2.75
- `webgpu/src/shadows/render-shadow-frame.ts` ← mapSize → descriptor
- `webgpu/src/materials/standard/standard-shader-shadow-sampling.ts` ← receiver
  sampling, normalBias (raw), `STANDARD_SHADOW_DEPTH_BIAS`, `shadowDepthFromClip`
- `render/src/rendering/{snapshot-packet-types,snapshot-packed-encoding-constants,
  snapshot-packed-light-codec,extraction-light-settings}.ts` ← mapSize codec

**Lab (shadow-lab/):**
- `src/systems/setup.system.ts` ← scene (tree, ground, sun, ambient; diagnostics)
- `src/systems/orbit-controls.system.ts` ← DISABLED (harness owns camera)
- `src/compare/three-compare.ts` ← split-screen + diff harness
- `src/compare/three.webgpu.js` / `three.core.js` ← vendored three r184
- `src/lib/{math,tuning,track}.ts` ← quatLookAt, DIR_LIGHT/HEMI_LIGHT constants
- `src/debug-panel.ts` ← the DOM devtools panel
- `aperture.config.ts` ← render config (aces, clearColor, sampleCount)
