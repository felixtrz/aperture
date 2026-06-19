# Engine & tooling findings (platformer port)

Every gap hit while porting Kenney's 3D Platformer onto Aperture, investigated to
a conclusion and graded. This is a **findings/feedback** document — nothing here
is fixed in the engine; app-side mitigations are noted where they exist.

## Methodology & a correctness caveat

Findings were produced with: vitexec logic runs (drive input via
`@aperture-engine/app/browser`, read signals), the `aperture tool <name>` CLI
(talks directly to the dev session), in-app A/B experiments, and ECS/render
introspection.

**Caveat that bit me:** several "bugs" I first noted came from a *messy
accumulated session state* plus reading a tool's **immediate return** (a
pre-dispatch snapshot) instead of re-reading state afterward. On clean
re-verification they did **not** reproduce (see *Retracted* below). Lesson:
verify tooling findings from a fresh `input_reset`ed state and confirm via
`input_get_state`, not the dispatch call's echo.

---

## A. Confirmed engine findings

### A1. `audio.playOneShot` leaks emitter entities with unique ids — MEDIUM
Each `playOneShot(id, …)` creates a **persistent `aperture.render.audioEmitter`
ECS entity keyed by `id`, never reclaimed**. The fps reference (and my first
draft) use `` `…${Math.random()}` `` ids → a *new* emitter entity every shot →
unbounded growth over a session.

- Evidence: after gameplay the world holds exactly 12 audio emitters —
  `audio.loop.platformer.walking` + `audio.oneshot.platformer.player.0‑7` +
  coin/hazard slots — because I switched to a **bounded voice pool** (reuse 8
  ids). With unique ids this set would instead grow without bound.
- This is the most likely root cause of the user-reported **"audio stops after
  respawn"**: emitter/voice budget exhaustion after enough one-shots, with the
  respawn `fall` shot being the one that tips it over.
- App mitigation (applied): reuse a fixed pool of ids (Godot's `audio.gd` does
  the same with 12 players). **Engine improvement worth considering:** auto-reclaim
  finished non-looping one-shot emitters.

### A2. `RAPIER.init({})` triggers a deprecation warning — COSMETIC
`packages/physics-rapier/src/backend.ts:122` calls `RAPIER.init({})`;
`@dimforge/rapier3d-compat@0.19.3` logs *"using deprecated parameters for the
initialization function; pass a single object instead"* once per physics-world
init (so once per page load / HMR). Harmless, but noisy.

### A3. "render produced 0 draws for an active camera view" spams during load — LOW
Fires repeatedly while assets are still loading (no renderable meshes yet → 0
draws), then **stops at steady state** (confirmed: warnings clustered only in the
session's first ~50 s; at frame 75k the single view renders 15 mesh + 39 shadow
draws). Not a render bug — but the message **misattributes the cause** ("camera
aimed away / frustum-culled / nothing renderable") when the real reason is
"meshes not ready yet." Suggest suppressing during the known asset-load phase or
wording it for that case.

---

## B. Confirmed tooling (MCP/CLI) findings

### B1. `ecs_find_entities` `components` filter is ignored — MEDIUM
`{components:["aperture.physics.collider"]}` returned **all 171 entities**, while
`{key:"brick.0"}` → 1 and `{tags:["brick"]}` → 6 filtered correctly. So the
`components` filter is silently a no-op.

### B2. Status/query tools emit ~100k-char payloads — HIGH (for agent use)
`browser_status`, `browser_wait_for_webgpu`, `input_key`, `input_reset`, and
unfiltered `ecs_find_entities` each return the full diagnostics+render snapshot
(~100k chars) and overflow an agent's context — every call had to be `jq`/`node`-
extracted from a temp file. `render_get_frame_report` already supports
`summaryOnly`; extending that (or field projection) to the rest would fix it.

---

## C. Retracted findings (did NOT reproduce on clean re-test)

Documented so they aren't re-reported as bugs:

- **`input_action_set` axis mapping** — first looked like `(0,1)`→`(-1,-1)`. The
  tool's *return* is a pre-dispatch snapshot; the value **does** apply
  (`input_action_set move x=1` → `input_get_state` `move.x == 1`). The earlier
  `(-1,-1)` was leftover stuck state from prior calls. **Not a bug.**
- **`input_reset` leaves keys stuck** — clean test: `KeyD` down (`move.x=1`) →
  `input_reset` → `move.x=0`, `pressed=[]`. **Not reproducible.**
- **`ecs_get_entity` rejects `key`** — clean test: `{key:"brick.0"}` → ok.
  **Not reproducible** (earlier rejection was during a degraded session).

---

## D. Physics — investigated, NOT a library bug

The user suspected the physics library re: falling platforms. **Disproven by an
in-app A/B:** a falling platform placed next to spawn, driven onto with its
collider as **kinematic** vs **static**, gave identical `groundedOverFalling
Platform=true` trajectories — the rapier KCC collides with kinematic *and* static
bodies (its query only excludes sensors). Root cause was an app-side **premature
fall trigger** (loose footprint fired while the player was on an adjacent
surface). Fixed in-app with precise ground-contact detection.

---

## E. Verification gaps (port behaviors I could not confirm end-to-end)

Not known bugs — just unverified with the available headless tooling:

- **Audio output**: headless SwiftShader has no audio device, so whether sound
  *audibly* stops on respawn can't be measured — needs an ear in the live session
  (the A1 emitter mechanism is the evidence-based fix).
- **Animation clip playback**: ✅ CONFIRMED working — sampling the character's
  node rotations over time shows the idle clip animating (`torso` x
  0.02→0.038→0.042, `antenna` 0.048→0.012→0.002 across snapshots); the
  `aperture.runtime.animation` driver writes node TRS each frame. Walk/jump clip
  transitions are wired via crossFade but weren't isolated in a moving capture.
- **Model facing direction** (`MODEL_YAW_OFFSET=0`): logic runs; visual heading
  not confirmed.
- **Falling-platform full sequence** (land → grace → drop → visual falls away) on
  a *real* level platform: only the mechanism (groundKey trigger + static
  collider collision) is verified.
- **Brick break end-to-end** (jump up into it → breaks): collider geometry is
  verified; the break event isn't.
- **Camera zoom** (Q/E): camera *rotate* is confirmed via screenshot; zoom isn't.
