# Aperture AI Tooling

Aperture apps can expose a local AI tooling surface during development through
the `@aperture-engine/cli` package. The tooling is intentionally dev-only:
production app bundles should not include the browser bridge unless the Vite
plugin is running in development with AI mode enabled.

## CLI Flow

Create an app:

```sh
npx @aperture-engine/cli create my-app
npx @aperture-engine/cli create viewer --template glb-viewer
npx @aperture-engine/cli create game --template game
```

Run a managed dev session from an Aperture app root:

```sh
pnpm exec aperture dev up --headless
pnpm exec aperture mcp stdio
pnpm exec aperture dev status
pnpm exec aperture dev down
```

Useful supporting commands:

```sh
pnpm exec aperture dev logs
pnpm exec aperture adapter sync
pnpm exec aperture reference warmup
pnpm exec aperture reference status
pnpm exec aperture reference search createSystem
```

`aperture reference warmup` downloads the versioned
`@aperture-engine/reference-assets` payload by default, then downloads the
pinned local Transformers.js model files used for query embeddings. In the
monorepo, build a local payload with
`pnpm run reference-assets:build-payload` and test it with
`pnpm exec aperture reference warmup --from packages/reference-assets/dist`.
Use `APERTURE_REFERENCE_ASSETS_BASE_URL` for unpublished hosted payloads.

`aperture dev up` starts Vite, launches a managed Playwright browser, and writes
`.aperture/runtime/session.json`. MCP tools use that session file rather than
hard-coded ports.

`aperture mcp stdio` is the agent-facing surface. It exposes shared intent-level
tools for both the managed browser slot and the warm headless slot:

- `app_status`, `app_start`, `app_stop`, `app_reset`
- `ecs_*`, `resource_*`, `asset_list`, `asset_inspect`
- `input_inject`, `input_get_state`, `input_reset`
- `camera_*`
- `frame_capture`, `render_diagnose`
- `logs_read`
- headless artifact tools: `render_bundle`, `session_snapshot_*`,
  `determinism_report`

Each stdio connection owns its headless session, warm renderer, and browser
client connections. On EOF, transport close, or stream error, Aperture drains
already received requests and waits for those resources to finish cleanup.
Managed dev daemons remain available across MCP reconnects; stop one explicitly
with `app_stop({ target: "headed" })` or `aperture dev down`.

The public MCP catalog intentionally avoids backend-mechanics names such as
`browser_screenshot` or `browser_canvas_status`; use `frame_capture` for image,
canvas, render-target, WebGPU, and sample metadata.

`aperture tool <name> [--json <object>]` remains a low-level direct devtools
bridge for manual debugging of an already running managed browser session. It is
not the public agent tool catalog.

### Smaller validation loop: `aperture headless` + `aperture render`

For a faster inner loop, the ECS/simulation layer can run in **pure Node** with
no browser. `aperture headless <config> --out <bundle.json>` loads a
`mode: "headless"` config and its `*.system.ts` (via native Node TypeScript
imports; Node 22.18+ on 22.x or 23.6+), steps a fixed timestep, optionally injects input, and writes a
self-contained `aperture.render-bundle` (the extracted `RenderSnapshot`, typed
asset closure, render target, schema metadata, diagnostics, and digest):

```sh
pnpm exec aperture headless aperture.headless.config.ts --frames 30 --out snapshot.json
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --json   # status report
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --inject input.json
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --asset-mode strict
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --determinism error
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --render-width 1280 --render-height 720
```

`--inject <file>` applies timed input steps before stepping, e.g.
`[{ "atFrame": 0, "pointer": { "position": [0.5, 0.5], "pressed": true } }]` or
`{ "actions": { "jump": true } }`.

`aperture codegen [config]` regenerates `.aperture/generated/aperture-env.d.ts`
(the typed `this.actions.*` and `this.signals.*` maps) outside of a vite
build, so the pure headless loop (`edit → codegen → tsc → serve`) keeps typed
actions and signals. The config is evaluated through the module loader, so
factory/shared configs (`aperture.shared-config.ts`) are seen.

For a tight iterate-and-inspect loop, `aperture headless serve <config>` boots
once and reads newline-delimited JSON commands from stdin
(`step` / `extract` / `inject` / `get-status` / `bundle` / `reset` /
`tool {name:"ecs_*" | "camera_*" | "asset_list" | "resource_*" | "input_*"}` /
`shutdown`), writing one response line per request — the boot-once-then-step
loop without rebooting per call. Stepping replays bit-identically given `--seed`
when systems use `context.random` / `context.time`.

Determinism diagnostics are opt-in. `--determinism warn` records and prints
system lifecycle calls to nondeterministic globals (`Math.random`, `Date.now`,
`new Date()`, `performance.now()`); `--determinism error` records them as errors
and fails one-shot `aperture headless` runs. Use `context.random` and
`context.time` for replayable systems. V1 wraps system `init`, `update`,
`fixedUpdate`, and queued effect callbacks.

Rendering stays out of the inner loop. When a picture is needed,
`aperture render <bundle.json> --out <frame.png>` boots a headless-friendly
browser on demand, rehydrates the bundle's source assets, applies the snapshot
through the WebGPU renderer, and writes one PNG — decoupled from any live
simulation. The render command preflights the bundle before launching the
browser: every referenced source asset, including transitive dependencies, must
be present and ready. Placeholder assets fail by default; pass
`--allow-placeholders` only when stubbed pixels are acceptable. Without
`--width`/`--height`, `aperture render` uses the bundle's recorded render
target. Pass `--json` to print renderer diagnostics including browser channel,
WebGPU adapter metadata where available, requested dimensions, actual PNG
dimensions, and the bundle digest:

```sh
pnpm exec aperture render snapshot.json --out frame.png
pnpm exec aperture render snapshot.json --out frame.png --width 1280 --height 720
pnpm exec aperture render snapshot.json --out frame.png --allow-placeholders
pnpm exec aperture render snapshot.json --out frame.png --json
```

Rendering many frames (an animation, a sweep, a montage)? `aperture render
serve` is the warm counterpart to `headless serve`: it boots the browser (and,
on GPU-less Linux, the Xvfb display) once and reads newline-delimited JSON
render requests from stdin (`render { in, out, width?, height?, allowBlank?,
allowPlaceholders? }` / `shutdown`), so only the first render pays the
multi-second boot. Each render still runs in a fresh page — no state leaks
between bundles. The MCP `frame_capture` tool reuses a warm render slot the
same way for the lifetime of the headless session.

Bundles carry the app's render/post configuration (`render.tonemap`,
`render.exposure`, `render.bloom`, `render.sampleCount`) in their
`renderTarget`, and the render harness applies it, so on-demand renders
reproduce the app's final look rather than a geometry+lighting preview.

Assets in Node: the default `hybrid` mode loads what Node supports and records
explicit placeholders for the rest; placeholder-loaded assets are marked with
`aperture.headless.assetPlaceholder`. `--asset-mode strict` loads supported
local assets with real bytes (GLB/glTF, WGSL shaders, audio bytes, PNG/JPEG
textures, RGBE HDR environment maps, and decoder-backed
Draco/meshopt/Basis-KTX2 GLBs when `--decoder-assets-dir` is supplied) and
fails unsupported assets. `--asset-mode placeholder` keeps boot fast and purely
structural (no real bytes; GLB-only scenes extract zero mesh draws). `aperture
render --allow-placeholders` is useful only for structural/layout inspection of
stubbed bundles. HTTP(S) asset reads remain off by default for reproducibility;
pass
`--allow-http-assets` only when the run is allowed to depend on network
responses.

Release gates for this loop:

```sh
pnpm run check:headless-boundaries     # no browser/WebGPU imports in headless paths
pnpm run check:render-bundles          # fixture bundles are closure-complete
pnpm run check:pack-cli                # packed CLI can run installed headless
pnpm run check:pack-cli:render         # optional browser-backed packed render smoke
pnpm run test:e2e:render-bundle        # browser render pixels/dimensions from fixture
```

### Frame an imported model or composed scene

Use `camera_frame_entities` when the size, origin, or child hierarchy of a
subject is not known in advance. It is a one-shot geometric fit, shared by
headless and headed sessions:

```json
{ "name": "camera_create_agent", "arguments": { "target": "headless" } }
{ "name": "camera_frame_entities", "arguments": {
  "target": "headless",
  "subjects": [{ "key": "product" }, { "key": "pedestal" }],
  "padding": 1.15,
  "yawDegrees": 35,
  "pitchDegrees": 20
} }
{ "name": "camera_get", "arguments": { "target": "headless", "key": "camera.agent" } }
```

Each subject is an exact ECS `{ "key": "…" }` selector or a current
`{ "index": 12, "generation": 0 }` reference from `ecs_find_entities`.
Descendant meshes are included by default, so selecting an imported GLB root
also frames its nested nodes. Overlapping selections are deduplicated. Set
`includeDescendants: false` to use only directly selected meshes.

The tool uses `camera.agent` unless `key` or `entity` explicitly selects an
unparented camera. It fits the existing perspective FOV or orthographic
projection and updates position, orientation, unit scale, near/far planes, and
orthographic height when applicable. Auto-aspect cameras use the current
session viewport; explicitly fixed-aspect and render-target cameras retain
their aspect. Authored camera fields are changed only after all subjects and
the prospective Float32 projection validate. Derived world transforms are
refreshed without advancing simulation, so `render_bundle` or `frame_capture`
can follow immediately. Camera systems may overwrite the pose on later steps;
use an independent agent camera for inspection.

The response retains the usual camera summary and adds `result.framing`:

- `subjects` and `meshes`: the resolved root and mesh references
- `bounds`, `center`, `translation`, `distance`: world-space framing evidence
- `projection`, `aspect`, `padding`, `near`, `far`, `orthographicHeight`: the
  projection used (`padding` is a factor ≥ 1; default 1.1)
- `projectionCheck`: maximum absolute X/Y NDC and minimum/maximum depth for all
  eight aggregate AABB corners, computed using the prospective Float32 camera
  matrices; X/Y fit within `1 / padding` plus the reported numeric tolerance
- `approximation: "static-mesh-bounds"`: this is geometric evidence, not pixel
  validation or proof that every mesh is visible

Source bounds are read independently of camera culling. Hidden meshes and
meshes on other render layers still contribute when selected. Bounds do not
include animated skinning, morph-target or shader displacement, nor sprites or
particles. Lighting, material readiness, occlusion and scissor cropping are
outside this fit: use `render_diagnose` and `frame_capture` for final output.
Refit after geometry, transforms, FOV, or viewport changes.

For a headless capture with custom dimensions, keep the same aspect ratio as
the session used for framing. To capture a different ratio, author an
independent camera with `camera: { autoAspect: false, aspect: width / height }`,
select its key for framing, and use matching capture dimensions. Supplying a
different ratio to `frame_capture` after fitting an auto-aspect camera changes
its projection and invalidates the earlier framing evidence.

Empty/point-only bounds, unavailable mesh assets, invalid hierarchies,
ambiguous/stale selectors, camera-dependent subjects, parented or jittered cameras, and precision-unsafe
world coordinates return actionable diagnostics. A precision error leaves
camera authoring unchanged; move geometry closer to the origin or rescale it.
The existing `camera_fit_entity` remains the origin-plus-explicit-radius tool;
its behavior is unchanged.

### Session snapshots

`@aperture-engine/app/headless` exposes `createApertureSessionSnapshot(runner)`
and `restoreApertureHeadlessRunnerFromSessionSnapshot(...)` for a first
simulation restore artifact. SessionSnapshot v1 is JSON-safe and captures the
bootstrap manifest, ECS scene document, component registry ids, configured
signal entries, resource entries, source assets, deterministic frame time,
fixed-step clock accumulator/index state, and built-in RNG state. The runtime
section records both `frame` and legacy `nextFrame`, plus `randomStreams` for
stream-oriented tooling. Restore creates a fresh headless runner, clears
app-created entities, loads the saved scene, mirrors source assets, restores
resources/signals, and resumes at the saved frame.

V1 also supports opt-in private system state through `snapshotState()`,
`restoreState(payload, ctx, remapEntityRef)`, and `afterRestore()` methods on
app systems. Hook payloads must be JSON-safe after typed-array encoding.
Tooling can attach a CLI-created render bundle at `inspection.renderBundle` for
pixel inspection of the saved frame; restore still treats that bundle as a
sidecar, not simulation authority.
SessionSnapshot v1 still does not serialize live callbacks, promises, DOM/GPU
handles, or warm physics backend internals. Physics is marked as
`rebuild-from-ecs-authoring`.

### Headless CI / dev containers

WebGPU is only exposed in a headed browser, so on a GPU-less Linux host
(CI runners, dev containers) run the managed browser under a **persistent**
virtual display with the software backend:

```sh
# One Xvfb for the whole session — do NOT wrap each command in its own
# `xvfb-run`, or the display tears down between commands and orphans the
# managed browser (its CDP endpoint then reports `browserConnectFailed`).
xvfb-run -a bash -lc '
  pnpm exec aperture dev up --software   # SwiftShader WebGPU, see --gpu
  pnpm exec aperture dev status
  pnpm exec aperture dev down
'
```

`--gpu auto` (the default) uses the hardware GPU when present and falls back to
SwiftShader on GPU-less hosts; `--software` / `APERTURE_GPU=software` force it.

## Cold-Start Proof

The whole loop above is CI-gated from a clean scaffold:
`scripts/cold-start-proof.sh` creates a fresh app in a temp directory from the
workspace-linked CLI, installs, typechecks, builds, starts a headless managed
dev session, exercises the MCP app/ECS/frame tools, and tears down. CI runs the
underlying spec (`test/e2e/cli-ai-tools.spec.ts`) in the sharded e2e matrix.

## State Ownership

The tools do not introduce a scene graph. ECS remains the source of truth,
rendering remains a derived view of ECS snapshots, and browser/WebGPU logic
stays in dev tooling paths.

Reference tools are read-only, backed by the same pinned local Transformers.js
embedding model used by IWSDK reference search
(`jinaai/jina-embeddings-v2-base-code`, revision
`516f4baf13dec4ddddda8631e019b5737c8bc250`, quantized `q8`, mean pooled and
normalized), and work without a running app after `aperture reference warmup`
has prepared the curated developer-facing corpus. The shipped reference payload
contains precomputed embeddings and allowed source snippets; model weights are
downloaded separately from pinned public URLs during warmup. The on-disk index
records the model contract and reports `aperture.reference.modelMismatch` when
an older hash-embedding corpus is stale. Shared MCP tools require a matching
started slot: headed browser tools need the managed browser slot, while
headless tools need the warm Node slot.

Useful inspection tools include:

- `app_status`: slot readiness, frame, asset summary, diagnostics, and WebGPU
  readiness for headed sessions.
- `frame_capture`: PNG plus canvas, viewport, render-target, frame, WebGPU, and
  optional pixel sample metadata.
- `asset_list`: configured asset ids, kind, URL, preload policy, readiness, and
  load errors.
- `ecs_find_entities`, `ecs_get_entity`, `ecs_get_hierarchy`: ECS lookup and
  derived hierarchy views.
- `render_get_frame_report`, `render_get_packets`, `render_get_diagnostics`:
  render extraction and WebGPU diagnostics.

## Discover an edit before applying it

MCP entity tools publish their argument shapes in `tools/list`, including exact
key/reference selectors, query filters, imported-source fields, checkpoint
selection and whole-field mutation values. Agents can use this contract without
reading the implementation.

A component schema describes storage, not permission to mutate every field.
`ecs_get_component_schema` preserves each schema's `id`, description and complete
`fields` object, and adds a sibling `mutation` object:

```json
{
  "tool": "ecs_set_component_field",
  "supported": true,
  "writableFields": ["rotation", "scale", "translation"],
  "readOnlyFields": [],
  "fieldPathSyntax": "literal-top-level-field"
}
```

These lists are derived from `listMutableComponentFields()`, the same registry
used by the write path. `readOnlyFields` means read-only through this developer
tool, not immutable to app systems. Custom components without allowlist entries
report `supported: false`. Only schemas present on active entities are returned;
this is not the global component catalog.

A minimal inspection/edit/read-back sequence:

```json
{ "name": "ecs_get_component_schema", "arguments": { "target": "headless", "component": "aperture.transform.local" } }
{ "name": "ecs_set_component_field", "arguments": { "target": "headless", "key": "product", "component": "aperture.transform.local", "field": "translation", "value": [2, 0, 1] } }
{ "name": "ecs_get_entity", "arguments": { "target": "headless", "key": "product" } }
```

Use a literal field from `mutation.writableFields`. A vector/quaternion/color is
written as a whole array: `translation.x` and `translation[0]` are not field
paths. The component must already exist on the selected entity. Storage schema
`type`, enum mappings and `default` values are preserved, but are not complete
mutation validators: finite-number/range requirements and nonzero quaternion
checks still run at write time. Defaults describe component initialization,
not an implicit value for an omitted mutation argument. Writes to unsupported
fields still return the existing structured rejection without changing state.

Selection details are intentional:

- Find/query accept flat filters or `query: { ... }`; a nested query replaces
  the flat filters. `tags` requires every tag; singular `tag` is merged with it
- Source `assetId`, `gltfNodeIndex`, and `gltfNodePath` match exactly;
  `namePattern` is a JavaScript regular-expression source, not a glob
- Get/mutate prefer explicit `entity` (or flat `index`/`generation`), then piped
  `summaries`, then key/name-pattern selection. Without a selector, the latest
  get result is used if it succeeded; otherwise the first last-find result is used. Prefer explicit selectors
  for reproducible edits; key plus namePattern means both filters must match
- Snapshot/diff use `tags`, not singular `tag`; `label` stays outside `query`.
  A nonempty `entities` list overrides filters and limit. Diff requires a prior
  snapshot and replaces that baseline; repeat the intended selector on each call
- Query limits default to 50 and positive fractions are floored. This is a
  result cap, not pagination

Use direct read-back for the field you changed. ECS summary diffs cover only the
fields present in entity summaries, so they are not a universal proof for every
allowlisted render/physics field. For rendering-sensitive edits, inspect the
appropriate tool output and capture a frame when supported.

## Mutating Tools

Most tools only inspect state. These tools intentionally change development
state:

- `ecs_set_component_field`: mutates allowlisted ECS component fields only.
  Unsupported components, unsupported fields, stale entity refs, missing
  components, and invalid value types return structured diagnostics. The
  allowlist below is generated from the registry
  (`listMutableComponentFields()` in
  `packages/app/src/entities/lookup/mutation.ts`); a unit test fails when this
  doc and the registry diverge:
  - `aperture.metadata.debug`: `tag`, `note`
  - `aperture.transform.local`: `translation`, `rotation`, `scale`
  - `aperture.physics.rigidBody`: `enabled`, `type`, `gravityScale`, `linearDamping`, `angularDamping`, `canSleep`, `ccdEnabled`, `lockTranslationX`, `lockTranslationY`, `lockTranslationZ`, `lockRotationX`, `lockRotationY`, `lockRotationZ`
  - `aperture.physics.collider`: `enabled`, `shapeKind`, `halfExtents`, `radius`, `halfHeight`, `axis`, `meshId`, `heightfieldAssetId`, `offsetTranslation`, `offsetRotation`, `sensor`, `density`, `friction`, `restitution`, `collisionGroups`, `solverGroups`
  - `aperture.physics.velocity`: `linear`, `angular`
  - `aperture.physics.externalForce`: `force`, `torque`
  - `aperture.physics.externalImpulse`: `impulse`, `angularImpulse`
  - `aperture.physics.kinematicTarget`: `enabled`, `translation`, `rotation`
  - `aperture.physics.gravity`: `gravity`
  - `aperture.physics.characterController`: `enabled`, `offset`, `up`, `slide`, `maxSlopeClimbAngleEnabled`, `maxSlopeClimbAngle`, `minSlopeSlideAngleEnabled`, `minSlopeSlideAngle`, `snapToGroundDistance`, `autostepEnabled`, `autostepMaxHeight`, `autostepMinWidth`, `autostepIncludeDynamicBodies`, `applyImpulsesToDynamicBodies`, `characterMassMode`, `characterMass`
  - `aperture.physics.material`: `friction`, `restitution`, `density`, `frictionCombine`, `restitutionCombine`
  - `aperture.physics.debug`: `colliderWireframes`, `contactNormals`, `bodyStateMarkers`, `broadphaseAabbs`, `jointFrames`
  - `aperture.physics.joint`: `enabled`, `kind`, `bodyARef`, `bodyBRef`, `anchorA`, `anchorB`, `frameA`, `frameB`, `axis`, `minLimit`, `maxLimit`, `motorMode`, `motorModel`, `motorTarget`, `motorVelocity`, `motorStiffness`, `motorDamping`, `motorFactor`, `motorMaxForce`, `contactsEnabled`, `breakForce`
  - `aperture.metadata.name`: `value`
  - `aperture.render.visibility`: `visible`
  - `aperture.render.layer`: `mask`
  - `aperture.render.instanceTint`: `color`
  - `aperture.render.light`: `color`, `intensity`, `range`, `innerConeAngle`, `outerConeAngle`, `width`, `height`, `layerMask`
  - `aperture.render.camera`: `priority`, `layerMask`, `near`, `far`, `fovYRadians`, `aspect`, `orthographicHeight`, `frustumCulling`, `renderTargetId`, `clearColor`

  Material parameters are deliberately NOT in this registry: material edits
  flow through the versioned `materials.set` patch path
  (`this.materials.set(handle, patch)` from app systems), which re-registers
  the asset so the GPU material is re-prepared. A `material_set` devtools tool
  over that path is a tracked follow-up.

- `ecs_pause`, `ecs_resume`, `ecs_step`: change simulation control state in the
  generated worker. For deterministic parity checks, pass
  `ecs_step` payload `{ "delta": 0.0166666667, "time": 0 }` so the worker uses
  the same fixed clock as headless.
- `input_key`, `input_pointer_move`, `input_pointer_click`, `input_drag`,
  `input_action_set`, `input_gamepad_set`, `input_get_state`, `input_reset`:
  drive or inspect the same generated input path used by real browser events.
- `camera_create_agent`, `camera_set_transform`, `camera_look_at`,
  `camera_orbit`, `camera_fit_entity`, `camera_frame_entities`,
  `camera_use_agent_view`: create or
  mutate ECS camera entities for inspection in either slot.
- `camera_save` and `camera_restore`: store and restore camera state in the
  devtools session.
- `app_reset`: reloads the headed experience or rebuilds the warm headless
  runner.

## Diagnostics Lookup

Every structured diagnostic the tools return carries a stable `code`. The
generated catalog `docs/DIAGNOSTICS_CATALOG.md` lists all engine diagnostic
codes with their message contracts, whether a `suggestedFix` accompanies them,
and the emitting source files. Regenerate it with
`node scripts/generate-diagnostics-catalog.mjs`; `pnpm run check:diagnostics`
fails CI when the committed catalog drifts from the source.

## Restoring State

For camera inspection, call `camera_save` before changing a camera and
`camera_restore` when finished. Prefer creating an agent camera with
`camera_create_agent` and switching the managed browser to it with
`camera_use_agent_view` instead of modifying a user-authored app camera.

For input inspection, call `input_get_state` to read resolved keyboard, pointer,
gamepad, and action state. Call `input_reset` after pointer, virtual action, or
gamepad experiments to release transient input state.

For ECS edits, use `ecs_snapshot` before mutation and `ecs_diff` after mutation
to make changes explicit. There is no broad ECS undo tool; use app systems or a
fresh dev session when a mutation should be discarded.
