# Engine & tooling findings (city-builder port)

Findings from porting Kenney's City Builder onto Aperture. Produced with the
`aperture dev` session, the `aperture tool <name>` CLI, the Aperture MCP
(screenshots + ECS/signal read-back), and POSITION-accessor inspection of the
glbs. Graded by impact.

**Headline: one real engine bug found and fixed** (`despawnRecursive` leaked
glTF subtrees — see E1), surfaced by live review of the placement/cycling loop.
Everything else was tooling/DX feedback.

## E1. `despawnRecursive` leaks glTF subtrees as origin orphans — HIGH (FIXED)

**Symptom:** cycling the build piece (Q/E) or demolishing left a copy of the old
model "settled" at the world origin `[0,0,0]`, piling up over time.

**Root cause:** `spawn.gltf` builds its scene subtree by writing the `Parent`
component **directly** (via glTF command replay), never through `setParent`. But
`Children` is documented as *"a derived index kept consistent on `setParent`"* —
so glTF roots never get a `Children` index. `hierarchy.despawnRecursive` walked
**only** that index, so it destroyed the root and left the node/primitive
children parented to a now-dead entity → they fall back to detached roots at the
origin. Proven with `ecs_snapshot`→press→`ecs_diff`: before, pressing E showed
`removed: 1` (root) + `changed: 2` (children `parent→none`, `worldTransform→[0,0,0]`).

**Fix** (`packages/simulation/src/transform/hierarchy.ts`): make teardown follow
the **authoritative `Parent`** relation — build a parent→children map by scanning
`query({required:[Parent]})` once per call and union it with the `Children` index,
so subtrees parented outside `setParent` (glTF replay) are fully destroyed.
After: pressing E shows `removed: 3` (root+node+primitive), `changed: 0` orphans.
Regression test added (`test/transform/hierarchy.test.ts`); 41 spawn/despawn/
gltf/serialization tests still green. This bug affected **any** app that
despawns a glTF entity (demolish, pooling, hot-swap), so the fix is broad.

## Engine APIs that carried the port (positive findings)

- **`cameras.main.rayFromPointer([x,y])`** — exactly the primitive a city builder
  needs. Normalized screen coords → world ray; intersecting `y=0` analytically
  and `round()`-ing gives the grid cell. No manual unproject/matrix wrangling.
- **`hierarchy.despawnRecursive(ref)`** — demolish is a one-liner that tears down
  the placed tile's entire glTF subtree (root + nodes + primitives), generation-checked.
- **`spawn.gltf(handle, opts)` returning an `Entity`** — `{index, generation}` is
  a clean, serialisable cell→entity handle to keep in a `Map` for later despawn.
- **Command channel** (`aperture:command` → `this.commands.drain(channel)`) — the
  right escape hatch for input the generated `input.actions` can't express
  (canvas-relative pointer position, wheel deltas, middle-drag deltas, RMB with
  contextmenu suppression). Two channels (`citybuilder.build`, `citybuilder.camera`),
  each owned by one system, kept it clean.
- **Signals → DOM** (`subscribeGeneratedSignals`) — cash/selection HUD with no
  custom transport.

## Tooling / DX feedback

### T1. No wheel/scroll input primitive in MCP/CLI — MEDIUM
`packages/cli/src/tools/input.ts` exposes `input_pointer_move`, `input_pointer_click`,
`input_drag`, `input_key`, `input_action_set`, `input_gamepad_set` — but **no
wheel/scroll**. Any app that uses the scroll wheel (zoom here, the standard
city-builder idiom) can't be driven or regression-tested headlessly through the
standard tools. Playwright's `page.mouse.wheel()` already exists under the hood;
an `input_wheel { deltaX, deltaY }` tool would close the gap. *Mitigation: I added
keyboard/gamepad zoom bindings so zoom is both usable and testable.*

### T2. `aperture dev up` silently attached the browser to a FOREIGN dev server — MEDIUM/HIGH
A pre-existing `vite` server from another repo (`/Users/felixz/Projects/aperture/racing`)
was already listening on the default port `5173`. `aperture dev up --open` (with
the default `--strict-port`) reported **"Started Aperture dev session"** and a
healthy `webgpuOk:true`, but `ecs_list_systems` showed *racing's* systems and the
signals were racing's — the managed tab was showing the wrong app, while
`session.json.appRoot` still pointed at city-builder. Re-launching with an
explicit free `--port` fixed it. Whatever the internal cause (port reuse vs. the
browser navigating to a stale default URL), the observed behaviour is a sharp
gotcha: **a green dev session can be driving a different app than your `appRoot`.**
Worth either failing fast on a foreign server holding the port, or verifying the
served app's id matches `appRoot` before reporting success. *Sanity check after
`dev up`: confirm `ecs_list_systems` shows your own `src/systems/*` paths.*

### T3. Pointer tools default to NORMALIZED coords; pixels clamp silently — LOW
`input_pointer_move`/`_click` treat `x,y` as normalized `0..1` by default
(`coordinateSpace: auto`). Passing pixel values (e.g. `680,250`) silently clamps
to the canvas corner `(1,1)` with no warning — my first move appeared to "do
nothing." The returned `point` echo is the only tell. A warning when `x|y > 1`
under `auto` would save a debugging cycle.

### T4. Every input_* / browser_status call returns the full ~30 KB status — LOW/MEDIUM
`browser_status` and *each* `input_*` MCP call return the entire frame snapshot
(perf rolling windows, full render-graph diagnostics, light bind-group keys, …) —
~30 KB of JSON per call. In an agent loop that drives dozens of inputs this is
very expensive and crowds the context. A `verbosity`/`fields` option (or a
`signals`-only summary) would help. *Mitigation: I drove inputs via the
`aperture tool` CLI piped through `jq` to extract just signals/entities.*

### T5. `lastWorkerSummary` lags the dispatching call by 1–2 frames — LOW (expected)
Reading the status returned *by* an input call shows pre-update state (e.g. a just-
issued build still reads `cellCount:0`); re-reading after a short settle shows the
result. Same caveat the platformer port recorded. Test authors should read state
*after* a settle, not from the dispatch echo.

### T6. `lastWorkerSummary.entities.summaries` is capped — LOW
The entity summary list is truncated (~16 entries), so once a city has many tiles
you can't enumerate all cell roots from the worker summary alone — `ecs_query` /
`ecs_find_entities` are needed for the complete set. (Cash/`cellCount` signals
remained an accurate aggregate throughout.)

## Render note: the building/road "stripes" are the asset, not a render bug

Reported during live review: horizontal **stripes** on building faces *and* road
tiles at close zoom. Investigated to a measured conclusion (it is **not** a
placement/UV/pipeline bug, and **not** 8-bit output banding):

- The Kenney `colormap.png` is a palette atlas of **vertical gradient swatches**.
  Decoding the PNG, the green swatch fades **RGB(90,196,135)→(31,136,107)** top→
  bottom — a strong baked gradient (green −60 levels, ~24%).
- Every tile/floor UVs its surface to one swatch, so stacking floors (buildings)
  or tiling segments (roads) **repeats that fade → stripes**.
- `render_readback_samples` down a lit green face read g≈130→122→136→115 (a
  per-floor oscillation locked to geometry) — i.e. the texture gradient
  attenuated by lighting, faithfully rendered, not amplified.
- It only reads as "stripes" at close zoom on a hi-DPI window (here 1920×1280
  /2×); at the play/overview zoom (and Kenney's promo screenshot) it's soft
  shading. The reference uses the identical texture.

What we *did* change: a harsh sun additionally cast hard shadows on the buildings'
floor **ledges**, compounding the look. Matching the source's soft ambient GI
(`ambient_light_energy 0.75` + SDFGI) — gentle sun (`illuminance 4.5→2.2`) +
strong ambient (`0.6→1.3`) — removed that compounding; the residual is the
asset's own gradient. Takeaway for colormap-atlas ports: **don't out-contrast the
source's lighting**, and expect the baked swatch gradient to show on large flat
faces up close (it's intended soft shading, not banding).

## Lesson reused from sibling ports

`audio.playOneShot(id, …)` creates a persistent emitter entity keyed by `id`
(platformer finding A1). This port uses **bounded voice-pool ids**
(`city.sfx.${n % 12}`, `city.toggle.${n % 12}`, `city.rotate.${n % 12}`), so a
long building session reuses a fixed ≤12-emitter set instead of growing one
entity per click.
