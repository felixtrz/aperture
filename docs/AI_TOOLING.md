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
pnpm exec aperture dev status
pnpm exec aperture tool browser_canvas_status
pnpm exec aperture tool asset_list
pnpm exec aperture mcp stdio
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

`aperture dev up` starts Vite, launches a managed Playwright browser, and writes
`.aperture/runtime/session.json`. MCP tools use that session file rather than
hard-coded ports.

`aperture tool <name> [--json <object>]` calls the same browser, ECS, asset,
input, camera, render, and reference tool contracts exposed over MCP. Browser
backed tools require an active managed dev session. Reference tools can run
after the reference corpus has been warmed.

## Cold-Start Proof

The whole loop above is CI-gated from a clean scaffold:
`scripts/cold-start-proof.sh` creates a fresh app in a temp directory from the
workspace-linked CLI, installs, typechecks, builds, starts a headless managed
dev session, exercises the MCP browser/ECS tools, and tears down. CI runs the
underlying spec (`test/e2e/cli-ai-tools.spec.ts`) in the sharded e2e matrix.

## State Ownership

The tools do not introduce a scene graph. ECS remains the source of truth,
rendering remains a derived view of ECS snapshots, and browser/WebGPU logic
stays in dev tooling paths.

Reference tools are read-only, backed by lexical (hashed bag-of-words) keyword
search — not learned/semantic embeddings — and work without a running app after
`aperture reference warmup` has prepared the curated developer-facing corpus. The
on-disk index records this honestly as the `aperture-reference-hash-embedding`
model (`hashed-token-sum` pooling) compared by cosine similarity; swapping in a
real local ONNX/transformers.js embedding model behind the same `cosineSimilarity`
interface is a tracked follow-up (AI-82). Browser, ECS, input, camera, and render tools require an active managed
dev session.

Useful inspection tools include:

- `browser_canvas_status`: CSS size, backing size, effective DPR, aspect, and
  render target size.
- `asset_list`: configured asset ids, kind, URL, preload policy, readiness, and
  load errors.
- `ecs_find_entities`, `ecs_get_entity`, `ecs_get_hierarchy`: ECS lookup and
  derived hierarchy views.
- `render_get_frame_report`, `render_get_packets`, `render_get_diagnostics`:
  render extraction and WebGPU diagnostics.

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
  generated worker.
- `input_key`, `input_pointer_move`, `input_pointer_click`, `input_drag`,
  `input_action_set`, `input_gamepad_set`, `input_get_state`, `input_reset`:
  drive or inspect the same generated input path used by real browser events.
- `camera_create_agent`, `camera_set_transform`, `camera_look_at`,
  `camera_orbit`, `camera_fit_entity`, `camera_use_agent_view`: create or
  mutate camera entities for inspection in the managed browser.
- `camera_save` and `camera_restore`: store and restore camera state in the
  devtools session.
- `browser_reload`: reloads the managed page but does not directly mutate ECS.

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
