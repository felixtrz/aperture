# Starter-Kit-City-Builder → Aperture port

Porting Kenney's [Starter Kit City Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder)
(Godot 4.6) onto the Aperture engine. Reference checkout lives in
`../references/Starter-Kit-City-Builder`. The sibling `../platformer`, `../fps`,
and `../racing` ports are the primary pattern references — they already solve the
signals→DOM HUD bridge, the browser→sim command channel, glTF spawning, pooled
one-shot audio, and the isometric/orbit camera idioms reused here.

**Status: complete and verified.** Every control was exercised against a live
WebGPU dev session via the Aperture MCP/CLI (screenshots + ECS/signal
read-back). The port surfaced and fixed one real engine bug — `despawnRecursive`
leaked glTF subtrees at the origin (see `ENGINE_AND_TOOLING_FINDINGS.md` §E1).

## Source mechanics (from the Godot project)

| System | Source script | Behaviour |
|---|---|---|
| Builder | `scripts/builder.gd` | A `GridMap` (1×1 cells) on the `y=0` plane. A "selector" cursor snaps to `round(mouseRayOnGround)`; LMB places the current structure (charged only when the cell's id changes), DEL removes, RMB rotates the cursor 90°, Q/E cycle structures. Cash starts at `$10,000`. |
| Camera | `scripts/view.gd` | Orbit rig: focus glides over the ground (pos lerp ×8), WASD pans screen-relative (`input.rotated(UP, yaw)`), wheel zooms `[15,80]` step 5 (lerp ×8), middle-drag yaws (`-relative.x/10`, rot lerp ×6), F recentres. Camera child sits back `zoom` m at fov 20°, ~35.26° iso tilt. |
| Structures | `structures/*.tres` | 15 `Structure` resources (model + price). Order = the `Builder.structures` array. |
| Audio | `scripts/audio.gd` | 12-voice pool, random pitch 0.9–1.1; placement/removal/rotate/toggle one-shots + ambience loop (`-30 dB`, autoplay). |
| Save/Load | `builder.gd` F1/F2/F3 | Serialise used cells to a Godot `.res`. **Not ported** (Godot-binary, non-portable; out of scope). |

Structure table (id · price), in cycle order — mirrored verbatim in `src/lib/city-data.ts`:
`road-straight`·25, `road-straight-lightposts`·25, `road-corner`·25, `road-split`·25,
`road-intersection`·25, `pavement`·10, `pavement-fountain`·10, `building-small-a`·50,
`building-small-b`·60, `building-small-c`·70, `building-small-d`·70, `building-garage`·70,
`grass`·10, `grass-trees`·25, `grass-trees-tall`·25.

## Asset inventory (CC0, copied into `public/`)

- `models/*.glb` — the 15 structures + shared `models/Textures/colormap.png`
  (external URI, resolved relative to each glb). Every tile is authored **1×1 in
  XZ, centred on origin, base at y=0** (verified by reading POSITION accessor
  bounds), so placing a tile root at an integer `(x, 0, z)` tiles seamlessly with
  no offset.
- `sounds/*.ogg` — placement-a..d, removal-a..d, rotate, toggle, ambience.
- `sprites/coin.png` (HUD), `sprites/selector.png` (unused; the selector is a
  GPU-emissive tile instead). `fonts/lilita_one_regular.ttf` for the HUD.

## Aperture architecture

Pure ECS; no scene graph as app state. Four systems (`src/systems/*.system.ts`):

| System | Priority | Role |
|---|---|---|
| `setup` | 0 | Spawns the camera (`camera.main`), sun (shadow-casting directional) + ambient fill, and the ground box. |
| `camera` | 10 | Isometric orbit rig. Drains `citybuilder.camera` (wheel zoom, middle-drag yaw); reads `pan`/`center`/`zoomIn`/`zoomOut` actions; writes `camera.main`'s `LocalTransform` each frame. |
| `builder` | 20 | The grid. Drains `citybuilder.build` (pointer, build, rotate); reads `toggleNext`/`togglePrev`/`demolish`/`reset` actions; raycasts the cursor, places/removes glTF tiles, tracks cells, publishes HUD signals. |
| `audio` | 90 | Keeps the ambience loop alive. |

Key engine APIs leaned on (all worked first try):

- **Screen → world picking:** `this.cameras.main.rayFromPointer([x, y])` (x,y
  normalized 0..1) → world ray, intersected analytically with the `y=0` plane,
  rounded to a grid cell. This is the heart of the city builder and the engine
  provides it directly.
- **Demolish:** `this.hierarchy.despawnRecursive({ index, generation })` cleanly
  tears down a placed tile's whole glTF subtree.
- **Placement:** `this.spawn.gltf(handle, { key, transform })` returns an
  `Entity`; its `{ index, generation }` is stored per cell for later despawn.
- **Browser → sim:** non-standard input (canvas-relative pointer, wheel, RMB,
  middle-drag) is dispatched from `src/hud.ts` as `aperture:command` events on
  two channels and `drain()`ed by the systems. Standard keys (WASD/Q/E/Del/F/R/±)
  go through generated `input.actions`.
- **HUD:** `subscribeGeneratedSignals` mirrors `cash` / `structureName` /
  `structurePrice` / `cellCount` to the DOM overlay.
- **Audio:** bounded 12-voice one-shot pool (`city.sfx.${n % 12}` etc.) — reusing
  a fixed id set avoids the per-id emitter-entity growth the platformer port flagged.

## Controls

| Input | Action | Path |
|---|---|---|
| Mouse move | Move selector (raycast to grid) | HUD → `citybuilder.build` |
| Left click | Place current structure | HUD → `citybuilder.build` |
| Right click | Rotate piece 90° | HUD → `citybuilder.build` |
| `Del` / `Backspace` / `X` | Demolish cell under cursor | `demolish` action |
| `Q` / `E` | Cycle structure | `togglePrev` / `toggleNext` |
| `W` `A` `S` `D` | Pan camera focus | `pan` axis |
| Middle-drag | Orbit (yaw) | HUD → `citybuilder.camera` |
| Wheel / `+` `−` | Zoom `[15,80]` | HUD channel / `zoomIn`·`zoomOut` |
| `F` | Recenter focus | `center` action |
| `R` | Clear the city | `reset` action |

## Deviations from the source

- **Added** keyboard/gamepad zoom (`+`/`−`, triggers) — the source is wheel-only;
  this makes zoom usable without a wheel and driveable in headless tests.
- **Added** `R` to clear the whole city (handy for demos/tests).
- **Omitted** save/load (F1–F3): the source persists a Godot-binary `.res`, not
  portable to the web runtime. A `localStorage` JSON save would be the natural
  follow-up.
- Cash may go negative, matching the source (no affordability gate).

## Verification (Aperture MCP/CLI, live WebGPU session)

All confirmed against `docs/shots/`: raycast cursor-follow, build (cash −price,
cell tracked), Q/E cycle + preview swap, RMB rotate (visually perpendicular
roads), Del demolish (subtree removed, count drops), WASD pan, middle-drag orbit,
F recenter, `+`/`−` zoom (30→20→25, clamped/stepped), R reset (cash→$10,000,
all tiles despawned), and the live cash/selection HUD. Wheel-zoom (the one path
with no MCP input tool) was verified separately via vitexec dispatching real
`WheelEvent`s in-page: `cameraZoom 30 → 15 → 45`.

## Post-review fixes (live-review feedback)

1. **Road/ground z-fighting** — the ground box top sat at y=0, coplanar with the
   tiles' authored base (y=0). Dropped the ground so its top is at y=−0.05;
   sub-pixel at play distance, no z-fight. (`setup.system.ts`)
2. **Preview read as a placed piece** — the opaque preview sat flush on the cell,
   so cycling looked like it was editing an already-placed tile. The preview now
   floats ~0.35 above the cell with a gentle bob — an unmistakable "held" cursor
   over its cyan target tile. (`builder.system.ts`)
3. **Building/road face "strips"** — horizontal bands on buildings *and* roads at
   close zoom. **Measured to be the asset, not a bug**: the Kenney `colormap.png`
   is a palette of vertical *gradient* swatches (decoded green swatch fades
   RGB(90,196,135)→(31,136,107), ~24%); each floor/tile maps to one swatch, so
   the fade repeats per floor/tile. A pixel readback confirmed the lit face
   tracks that gradient faithfully (not amplified, not 8-bit banding). It only
   reads as stripes at close zoom on a hi-DPI window; the reference uses the same
   texture. We *did* soften the lighting (sun illuminance 4.5→2.2, ambient
   0.6→1.3) because a harsh sun cast hard shadows on the floor ledges that
   compounded it — now the buildings read as clean flat blocks like the
   reference. (`setup.system.ts`; see `ENGINE_AND_TOOLING_FINDINGS.md`)
