# Developer-Facing App API Proposal

Date: 2026-05-23

Status: proposal

## Purpose

This proposal turns the developer feedback in
`docs/DEVELOPER_API_FEEDBACK.md` into a concrete API direction for Aperture.
The goal is a default metaframework path where a developer creates an Aperture
app with `aperture.config.ts`, authors ECS systems in `*.system.ts` files, and
lets the Aperture Vite plugin own browser bootstrap, worker bundling, asset
preload, render extraction, snapshot transport, and WebGPU submission.

The proposal preserves Aperture's architecture:

- ECS remains the source of truth.
- Rendering remains a derived view of extracted ECS state.
- WebGPU remains the only rendering backend.
- Aperture apps use Vite and the Aperture Vite plugin by default.
- Developer-authored runtime logic lives in ECS systems that run in the
  simulation worker by default.
- Main-thread code is presentation, DOM/UI integration, event forwarding,
  diagnostics, and tooling. It does not own authoritative simulation state.
- Advanced low-level APIs remain available for custom orchestration, tests,
  tools, headless simulation, and render-only consumers.

## Reference Audit

### Bevy

Reference files:

- `references/bevy/examples/3d/3d_scene.rs`
- `references/bevy/examples/3d/3d_shapes.rs`
- `references/bevy/examples/asset/asset_loading.rs`
- `references/bevy/examples/app/headless.rs`
- `references/bevy/examples/app/custom_loop.rs`
- `references/bevy/examples/app/externally_driven_headless_renderer.rs`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

Bevy's main lesson is that an ECS-first engine can have a very small default
app shape:

```rust
App::new()
    .add_plugins(DefaultPlugins)
    .add_systems(Startup, setup)
    .run();
```

Important patterns to borrow:

- Defaults are explicit and grouped. `DefaultPlugins` gives the common runtime,
  renderer, asset server, input, windowing, diagnostics, and loop behavior, but
  advanced users can customize or replace pieces.
- Startup and update logic are schedule concepts, not manual calls to
  `step()` or `extract()` from normal app code.
- Assets are typed handles. User code asks for `asset_server.load(...)` and
  stores a handle in ECS state instead of registering render-side resources
  manually.
- glTF import is high-level. The loader internally turns nodes, transforms,
  meshes, materials, cameras, and lights into ECS-facing data.
- Headless, custom-loop, and externally driven renderer paths still exist.
  They are advanced paths, not the first tutorial path.

Constraint for Aperture:

- Do not copy a scene graph as the runtime source of truth. Copy the default
  app ergonomics, schedule ergonomics, typed asset handles, and advanced escape
  hatches.

### Immersive Web SDK

Reference files:

- `/Users/felixz/Projects/immersive-web-sdk/README.md`
- `/Users/felixz/Projects/immersive-web-sdk/docs/index.md`
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/README.md`
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/ecs/world.ts`
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/init/world-initializer.ts`
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/asset/asset-manager.ts`
- `/Users/felixz/Projects/immersive-web-sdk/docs/guides/04-external-assets.md`
- `/Users/felixz/Projects/immersive-web-sdk/docs/concepts/ecs/world.md`

IWSDK's strongest reference value is the browser-facing facade:

```ts
const world = await World.create(container, {
  xr: { sessionMode: SessionMode.ImmersiveVR },
  features: { locomotion: true, grabbing: true },
  level: "/glxf/Composition.glxf",
});
```

Important patterns to borrow:

- One async factory owns runtime setup.
- Options are grouped by concern: `assets`, `level`, `xr`, `render`, `input`,
  and `features`.
- Default systems are installed automatically, while feature flags let users
  opt into larger behavior.
- Critical assets can be preloaded before the returned world begins normal
  logic; background assets can continue loading later.
- Runtime loading is simple: `loadGLTF`, `loadTexture`, `getGLTF`,
  `getTexture`, and related helpers hide loader internals.
- The high-level world still exposes ECS-style authoring helpers such as
  entity creation, transform entity creation, components, and systems.

Constraint for Aperture:

- IWSDK uses Three.js object state as part of its runtime model. Aperture should
  borrow the `World.create` ergonomics and asset manifest behavior, not the
  renderer-owned scene graph.

### PlayCanvas

Reference files:

- `references/engine/src/framework/application.js`
- `references/engine/src/framework/app-base.js`
- `references/engine/src/framework/app-options.js`
- `references/engine/src/framework/entity.js`
- `references/engine/src/framework/asset/asset-list-loader.js`
- `references/engine/src/framework/handlers/container.js`
- `references/engine/src/framework/scene-registry.js`
- `references/engine/examples/src/examples/loaders/glb.example.mjs`
- `references/engine/examples/src/examples/xr/ar-basic.example.mjs`
- `references/engine/examples/src/examples/loaders/draco-glb.example.mjs`

PlayCanvas is not a model for Aperture's ECS architecture, but it is useful for
developer ergonomics:

- `Application` is the convenience path. It registers the common component
  systems and resource handlers, creates the app, and starts the main loop with
  `app.start()`.
- `AppBase` is the advanced path. It lets users manually choose component
  systems and resource handlers for custom bundles and tree-shaking.
- `app.preload()` loads registry assets marked `preload: true` before normal
  startup.
- `AssetListLoader` loads a group of assets and reports completion.
- glTF/GLB is a single container asset type. User code can instantiate a loaded
  GLB into renderable entities with one call.
- The main loop owns update, render, resize, and frame events. Normal user code
  subscribes to update events rather than driving renderer internals.

Constraint for Aperture:

- PlayCanvas's entity hierarchy and scene graph must not become Aperture's
  authoritative world model. The useful part is the split between a friendly
  default app and a configurable advanced base app.

## Proposed Direction

Aperture should be a Vite-powered metaframework, not a rendering library with
optional Vite support. The default developer contract should be:

- Aperture apps are Vite apps.
- `aperture.config.ts` is the product-level source of truth for runtime mode,
  systems, assets, render defaults, input, diagnostics, and tool hooks.
- `vite.config.ts` installs the Aperture Vite plugin. It should stay thin by
  default.
- The plugin discovers and bundles worker-authored ECS systems.
- Systems are the normal authoring unit. They run in the simulation worker by
  default.
- The generated browser bootstrap owns the app shell, worker startup, asset
  preload, render extraction, snapshot transport, WebGPU submission, resize,
  input forwarding, and diagnostics.

The primary tutorial entry should therefore be:

```ts
// aperture.config.ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/floor.png", { preload: "background" }),
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
  },
});
```

`createApertureApp` should still exist, but it should be treated as generated
bootstrap infrastructure and an advanced programmatic API for tests,
nonstandard hosts, and lower-level tooling. It should not be the default
authoring path in docs.

Current `@aperture-engine/core` is a headless-safe umbrella over simulation,
render, and runtime packages. It is not the default app facade because it does
not own browser/WebGPU/worker orchestration. With no backward compatibility
constraint, the proposal should not expose both `core` and `app` as competing
first-touch concepts. The least-friction direction is:

- `@aperture-engine/app/config`: config helpers such as
  `defineApertureConfig` and `asset`.
- `@aperture-engine/app/systems`: worker-safe system authoring helpers such as
  `createSystem`, `mesh`, `material`, component re-exports, and spawn/query
  utilities available inside systems.
- `@aperture-engine/vite-plugin`: required default build/runtime integration.
- Headless mode lives in `aperture.config.ts` as `mode: "headless"`, not as an
  imperative switch in `index.ts`.
- The current `core` role is folded under `app`, renamed to an internal
  package, or kept only as a lower-layer workspace detail.
- Advanced users can still import focused lower layers when they need custom
  orchestration.

Suggested layers:

| Layer                          | Audience                             | Responsibility                                                                                 |
| ------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `aperture.config.ts`           | New app developers, agents, examples | Product-level app declaration: mode, systems, assets, render defaults, input, diagnostics      |
| `@aperture-engine/vite-plugin` | All normal Aperture apps             | Required Vite integration: config loading, system discovery, worker build, generated bootstrap |
| `@aperture-engine/app/config`  | Config authors                       | Typed config helpers and asset manifest declarations                                           |
| `@aperture-engine/app/systems` | System authors                       | Worker-safe ECS components, system helpers, primitive descriptors, materials, spatial helpers  |
| `@aperture-engine/runtime`     | Advanced simulation authors, tests   | Low-level ECS simulation/extraction app primitives                                             |
| `@aperture-engine/render`      | Renderer tooling and tests           | Render snapshot schema, extracted render data, render asset contracts                          |
| `@aperture-engine/webgpu`      | Advanced render hosts                | WebGPU device/app setup, render snapshot consumption                                           |

The metaframework must not hide architecture by creating a separate
authoritative scene model. It should hide wiring, not ownership. Runtime state
belongs to ECS systems in the worker. Config and main-thread APIs declare
resources, route commands/events, and observe diagnostics; they do not become a
mutable scene graph.

## EliCS Grounding Rules

Aperture currently uses `elics@3.4.2` through
`@aperture-engine/simulation`. Any app-facing system API should map cleanly to
the real EliCS surface:

- Components are created with `createComponent` / Aperture's
  `defineComponent` re-export.
- Entities are EliCS `Entity` objects with `index`, `generation`, `active`,
  `addComponent`, `removeComponent`, `hasComponent`, `getValue`, `setValue`,
  `getVectorView`, `getComponents`, and `destroy`.
- Serializable entity references should use `{ index, generation }`, matching
  Aperture's current `RenderEntityRef`.
- Systems are classes created by extending `createSystem(queries, schema)`.
- A system instance has `init()`, `update(delta, time)`, `destroy()`, `play()`,
  `stop()`, `isPaused`, `priority`, `config`, `queries`, `globals`, and
  `createEntity()`.
- Aperture's worker-safe system wrapper should prefer typed `this.signals`
  over raw `globals`. `globals` may remain as a lower-level EliCS/IWSDK-style
  escape hatch, but it should not be the recommended app state model.
- `world.registerSystem(SystemClass, { priority, configData })` is the known
  registration API. Lower numeric priority runs earlier.
- EliCS does not currently provide `fixedUpdate`, `postUpdate`, `before`,
  `after`, or app-level callback scheduling. Those would require an Aperture
  wrapper/scheduler and should not appear in examples as if EliCS already
  supports them.
- EliCS queries support `required`, `excluded`, and `where` value predicates.
  Query results are read through `query.entities`, a `Set<Entity>`.
- EliCS value predicates are exact/comparison predicates, not regex queries.
  MCP-style `namePattern` search should use a broad `Name` query plus a regex
  filter, or maintain a separate name index. It should not depend on EliCS
  private internals.

## First-App Experience

The target first app should be config plus systems, not an imperative
`index.ts` that mutates an app object.

```ts
// aperture.config.ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/floor.png", { preload: "background" }),
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
  },
});
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [aperture()],
});
```

```ts
// src/systems/setup.system.ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export const schedule = { priority: 0 };

export default class SetupSystem extends createSystem() {
  override init(): void {
    this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [1, 0.55, 0.25, 1],
        roughness: 0.55,
        metallic: 0.05,
      }),
      transform: { translation: [0, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      transform: { translation: [1.5, 0, 0] },
    });
  }
}
```

```ts
// src/systems/spin-crate.system.ts
import {
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export const schedule = { priority: 100 };

const SpinCrateSystemBase = createSystem({
  crates: {
    required: [Name, LocalTransform],
    where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
  },
});

export default class SpinCrateSystem extends SpinCrateSystemBase {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.crates.entities) {
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time));
    }
  }
}
```

What this should do automatically:

- Load `aperture.config.ts`.
- Generate or configure the browser entry.
- Initialize WebGPU for browser mode.
- Build the discovered systems into the simulation worker.
- Register system modules in worker priority order.
- Preload blocking assets before the first simulation tick.
- Mirror render assets to the renderer without user code touching transport.
- Forward input, UI, MCP/tool commands, and diagnostics across the worker
  boundary.
- Run EliCS systems, extraction, snapshot transport, and render submission each
  frame.
- Resize the canvas by default.
- Support `mode: "headless"` from the same config shape without DOM/WebGPU
  presentation imports at runtime.

## Config And Vite Plugin

`aperture.config.ts` should be the app source of truth:

```ts
import {
  asset,
  defineApertureConfig,
  signal,
} from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
  },
  signals: {
    selectedEntity: signal.ref<EcsEntityRef | null>(null),
    gameplayMode: signal.string("edit"),
  },
  input: {
    actions: {
      select: [{ pointer: "primary" }],
      jump: [{ keyboard: "Space" }],
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
  },
  diagnostics: {
    level: "warn",
  },
});
```

`vite.config.ts` should install the plugin and stay mostly build-oriented:

```ts
import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [aperture()],
});
```

The canonical plugin package should be separate:

- `@aperture-engine/vite-plugin` is the documented import for Vite.
- `@aperture-engine/app/vite` may re-export the plugin as a convenience.
- The root `@aperture-engine/app` entry should not export the plugin, because
  Vite/plugin code is Node/build-time code and should not blur the worker-safe
  runtime boundary.

The plugin should:

- discover configured system globs;
- generate a system manifest with module URLs, default/named exports, and
  schedule metadata;
- build the simulation worker bundle;
- generate or inject the browser bootstrap;
- load config-defined asset manifests;
- emit typed config metadata for systems;
- wire input/event forwarding from main thread to worker;
- expose dev diagnostics and MCP/tool bridges.

Headless mode belongs in `aperture.config.ts`:

```ts
export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
});
```

This keeps browser/headless selection in the app declaration instead of
scattering it across `index.ts` entry code.

## System Authoring Surface

The system interface should become the main public API. It should be richer
than raw EliCS while still mapping to EliCS systems under the hood.

Recommended worker-side system context:

```ts
export interface ApertureSystemContext {
  readonly signals: SignalStore;
  readonly input: InputSignals;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
}
```

Recommended rules:

- Prefer `this.signals` over IWSDK-style untyped `this.globals`.
- `this.signals` should be a typed store of Preact-compatible signals derived
  from config, input, assets, tools, and runtime resources.
- `this.input` should expose action, pointer, keyboard, gamepad, and XR state
  as signals.
- `this.assets` should expose typed asset handles plus readiness/error signals.
- `this.commands` should expose UI/MCP/tool commands forwarded from the main
  thread.
- `this.spawn` should be worker-local ECS spawn helpers. These helpers wrap
  `this.createEntity()` and normal component/resource writes; they are not a
  main-thread scene graph API.
- `this.spatial` should own raycast, overlap, bounds, and related ECS spatial
  queries.
- Prefer `this.cameras.main`, `this.cameras.active`, and
  `this.cameras.byKey(key)` over a singular `this.camera`, because Aperture
  needs to support multiple cameras, XR views, render targets, editor cameras,
  and headless mode.
- Prefer `this.spatial.raycast(...)` over `this.raycast(...)`, because raycast
  is one spatial query among several.

Reactive systems should be first-class:

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class SelectSystem extends createSystem({
  selectable: { required: [Selectable, WorldBounds] },
}) {
  override init(): void {
    this.effects.watch(this.input.actions.select.pressed, (pressed) => {
      if (!pressed) {
        return;
      }

      const ray = this.cameras.main.rayFromPointer(
        this.input.pointer.primary.position.value,
      );
      const hit = this.spatial.raycast(ray, {
        query: this.queries.selectable,
      });

      this.signals.selectedEntity.value = hit?.entity.ref ?? null;
    });
  }
}
```

This system does not need an `update()` method. It reacts to scheduled signal
changes and ECS query state.

Important scheduler rule: systems should not use raw Preact `effect()` to
mutate ECS at arbitrary microtask timing. Aperture should provide
lifecycle-owned effects:

```ts
this.effects.watch(signal, callback, {
  phase: "input",
  priority: 100,
});

this.effects.onQueryEnter(this.queries.selectable, (entity) => {
  this.diagnostics.info("selectable.joined", { entity: entity.index });
});
```

Those effects should be:

- registered in `init()`;
- automatically disposed in `destroy()`;
- batched with forwarded main-thread events;
- flushed in explicit simulation phases;
- ordered by priority;
- safe for deterministic ECS mutation.

This keeps the reactive authoring model without weakening Aperture's ECS-first
and worker-owned simulation boundary.

## Scene Initialization, Primitives, And GLTF

Scene setup should be an ECS startup system, not app-level mutation:

```ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export const schedule = { priority: 0 };

export default class SetupSceneSystem extends createSystem() {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 1.5, 5],
        lookAt: [0, 0.75, 0],
      },
      fovYDegrees: 60,
    });

    this.spawn.light({
      key: "light.key",
      name: "key-light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });

    this.spawn.mesh({
      key: "level.cube",
      name: "cube",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({ baseColor: [0.9, 0.2, 0.1, 1] }),
      transform: { translation: [0, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      transform: { translation: [1.5, 0, 0] },
    });
  }
}
```

Initial primitive descriptors:

- `mesh.box({ size })`
- `mesh.sphere({ radius, segments? })`
- `mesh.capsule({ radius, depth, segments? })`
- `mesh.plane({ size, subdivisions? })`
- `mesh.cylinder({ radius, depth, segments? })`
- `mesh.cone({ radius, depth, segments? })`

High-level loading must still hide the current low-level sequence:

- source loader report;
- asset mapping report;
- source asset transfer package;
- renderer-side registration;
- primitive material resolution;
- ECS command plan creation;
- ECS command replay.

The difference is that assets are declared in config and consumed from systems:

```ts
// aperture.config.ts
assets: {
  robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
  floorColor: asset.texture("/assets/floor.png", { preload: "background" }),
}
```

```ts
// setup.system.ts
this.spawn.gltf(this.assets.gltf("robot"), { key: "level.robot" });
```

Recommended preload policy:

```ts
type AssetPreloadPolicy = "blocking" | "background" | "manual";
```

- `blocking`: must finish before the first simulation tick.
- `background`: starts loading immediately but does not block startup.
- `manual`: registered in the manifest but loaded only when requested by a
  system or command.

Runtime loading should be expressed as a command or system request, then
observed through `this.assets` readiness signals. It should not require main
thread code to understand snapshot transport or renderer-side registration.

## Identity And Metadata

Spawn names should remain part of ECS metadata. A `name` helps debugging,
diagnostics, editor inspection, agent workflows, and ergonomic queries. It
should not be treated as identity.

Recommended metadata shape:

```ts
export interface SpawnMetadata {
  name?: string;
  key?: string;
  tags?: readonly string[];
}
```

Recommended semantics:

- Every entity should have a display name internally.
- User-provided `name` should be optional at spawn boundaries.
- When `name` is omitted, the runtime should generate a useful nonunique
  fallback.
- `name` should not be globally unique.
- `key` should be optional, user-authored, and globally unique within the app
  when provided.
- The EliCS `{ index, generation }` reference remains the canonical runtime and
  MCP identity.

Current Aperture metadata already includes `Name`, `Enabled`, and
`DebugMetadata` (`tag`, `note`) EliCS components. The proposed `key` and
multi-value `tags` fields would require new ECS metadata components or a
separate app-level lookup registry; they should not be documented as existing
EliCS or current Aperture component fields until that is implemented.

## Advanced APIs To Preserve

The following low-level capabilities should remain public and documented as
advanced paths:

- Programmatic `createApertureApp` used by generated bootstrap, tests,
  nonstandard hosts, and lower-level tools.
- Render-only front end that consumes a `RenderSnapshot`.
- Low-level simulation-only or extraction-only primitives for tests, workers,
  tools, and custom headless orchestration.
- Manual `step`, `extract`, and `stepAndExtract`.
- Manual worker creation and custom message transport.
- Manual source asset loading, mapping reports, transfer packages, and renderer
  registration.
- Direct render snapshot inspection.
- Custom material route registration and WGSL source management.
- Custom render hosts that own the WebGPU device.

Possible package/documentation split:

```ts
// Default metaframework path.
import { defineApertureConfig } from "@aperture-engine/app/config";
import { aperture } from "@aperture-engine/vite-plugin";

// System authoring.
import { createSystem } from "@aperture-engine/app/systems";

// Advanced orchestration.
import { createApertureApp } from "@aperture-engine/app/advanced";
import { createExtractionApp } from "@aperture-engine/runtime";
import { createWebGpuApp } from "@aperture-engine/webgpu";
```

Docs should present this as a layered model:

1. Use `aperture.config.ts` plus the Vite plugin for normal browser and
   headless apps.
2. Author all simulation logic in worker-discovered systems.
3. Drop to advanced app/runtime/webgpu APIs only for generated bootstrap,
   custom hosts, tests, or nonstandard loops.

## Diagnostics For Humans And Agents

The API should make failure states easy to read and easy for agents to repair.

Recommendations:

- Every thrown app error should include a stable code, short message, and
  suggested fix.
- Asset reports should identify URL, asset kind, dependency, phase, and whether
  the failure blocks startup.
- Config and Vite plugin failures should identify the file, system module,
  glob, export, or generated worker entry that failed.
- Worker and WebGPU initialization failures should say whether the configured
  mode permits a fallback, which fallback was used, or why no fallback is
  possible.
- Runtime diagnostics should be available to systems through
  `this.diagnostics` and to tooling through generated dev/MCP bridges.
- Spawn helpers inside systems should validate common mistakes, such as
  spawning an unloaded glTF or creating a mesh without a material.

Example:

```ts
if (this.assets.gltf("scene").error.value) {
  this.diagnostics.error("asset.scene.failed", {
    asset: "scene",
    suggestedFix: "Check the URL in aperture.config.ts.",
  });
}
```

## MCP Entity Lookup

IWSDK and Aperture both use EliCS, so Aperture should not invent a separate
entity identity model for MCP tooling. IWSDK's runtime tools use names as
discovery context and `entityIndex` as the actual target for ECS query,
mutation, snapshot, and diff tools. Aperture should follow the same separation
between discovery labels and ECS identity, while carrying `generation` too
because Aperture already serializes render entities as `{ index, generation }`
and uses that pair for extraction/cache identity.

Recommended runtime inspection contract:

```ts
interface EntitySummary {
  entity: EcsEntityRef;
  key?: string;
  name: string;
  componentIds: readonly string[];
  tags?: readonly string[];
  source?: {
    assetId?: string;
    gltfNodeIndex?: number;
    gltfNodePath?: string;
  };
}
```

Recommended MCP-style tools:

- `aperture_entity_find({ key?, namePattern?, withComponents?, tags?, source?, limit? })`
- `aperture_entity_get({ entity, components? })`
- `aperture_entity_set_component({ entity, component, field, value })`
- `aperture_entity_snapshot({ label? })`
- `aperture_entity_diff({ from, to })`

Rules:

- Tools should return `entity: { index, generation }` for follow-up calls.
- Tools may accept `index` alone as a convenience only when there is no
  ambiguity, but diagnostics should prefer and print the full pair.
- Follow-up tools should resolve by `world.entityManager.getEntityByIndex(index)`
  and reject the reference when the active entity's generation does not match.
- `namePattern` search can be implemented by registering/querying entities with
  the Aperture `Name` component, then filtering `Name.value` with a regex.
- `key` lookup should be exact and unique when present.
- `namePattern` lookup should be allowed to return multiple matches.
- Entity summaries should include enough component/source metadata for agents
  to choose the right entity without relying on name uniqueness.
- Destroyed or generation-mismatched entity references should fail with
  actionable diagnostics that suggest re-running `aperture_entity_find`.

## Implementation Plan

### Phase 1: Config And Vite Plugin Skeleton

Add:

- `@aperture-engine/app/config`.
- `defineApertureConfig`.
- `asset.gltf`, `asset.texture`, `asset.hdr`.
- `@aperture-engine/vite-plugin`.
- default `aperture.config.ts` discovery from the plugin.
- generated browser bootstrap that can load config and start the existing
  low-level app layers.

Acceptance criteria:

- A browser example has a minimal `vite.config.ts` with
  `plugins: [aperture()]`.
- A browser example has `aperture.config.ts` with `mode: "browser"`, `canvas`,
  assets, render defaults, and system globs.
- User code does not call `createWebGpuApp`, `createExtractionApp`,
  `stepAndExtract`, or render snapshot posting directly.
- `@aperture-engine/app` root does not import Vite/plugin code.

### Phase 2: System Discovery And Worker Registration

Add:

- configured system glob discovery;
- generated system manifest;
- support for default exported system classes;
- schedule metadata such as `export const schedule = { priority }`;
- worker-side registration of discovered systems;
- actionable diagnostics for missing exports, invalid schedules, or
  non-worker-safe imports.

Acceptance criteria:

- A `src/systems/spin-crate.system.ts` file runs in the simulation worker
  without manual worker setup.
- System priority is applied from module metadata.
- The main-thread generated bootstrap never receives live system classes.

### Phase 3: Worker-Safe System Interface

Add system-side helpers:

- `this.signals`.
- `this.input`.
- `this.assets`.
- `this.commands`.
- `this.spawn`.
- `this.spatial`.
- `this.cameras`.
- `this.diagnostics`.
- `this.effects`.

Acceptance criteria:

- A setup system spawns a camera, light, primitive mesh, and config-declared
  glTF asset from `init()`.
- A reactive system uses `this.effects.watch(...)` without an `update()`
  method.
- Reactive effects are disposed on system destroy and flushed in a documented
  simulation phase.
- Raw Preact `effect()` is not the recommended mutation path.

### Phase 4: Asset Preload And Runtime Asset Requests

Add:

- blocking/background/manual preload policies from config;
- worker-visible asset handles and readiness/error signals;
- renderer asset mirroring hidden behind the generated runtime;
- system-side runtime asset request commands.

Acceptance criteria:

- Blocking assets complete before the first simulation tick.
- Background assets expose readiness signals to systems.
- Runtime asset loading can be requested from a system or forwarded command.
- User code does not touch loader reports or renderer registration.

### Phase 5: Headless Mode From Config

Add:

- `mode: "headless"` in `aperture.config.ts`.
- Node-safe config loading.
- headless runner entry generated or exposed by the plugin/CLI.
- manual stepping for tests through advanced APIs.

Acceptance criteria:

- A headless example uses the same system files as the browser example.
- Importing config/system helpers for headless mode does not load DOM,
  `navigator.gpu`, canvas, or WebGPU presentation code.
- Tests can step the headless app without browser presentation.

### Phase 6: Documentation Restructure

Update docs so the main learning path is:

1. Create `aperture.config.ts`.
2. Install the Aperture Vite plugin in `vite.config.ts`.
3. Write a setup system.
4. Spawn primitives from the setup system.
5. Declare and spawn a GLB.
6. Add runtime/reactive systems.
7. Use signals, input, spatial queries, and commands.
8. Advanced: programmatic app/runtime/render split.

`docs/AUTHORING.md` should stop leading with worker/main split wiring or
imperative app mutation. That material should move to an advanced
orchestration page.

## Non-Goals

- Do not add a WebGL fallback.
- Do not create a hidden mutable scene graph as the source of truth.
- Do not make the generated app facade the primary authoring model.
- Do not support non-Vite default app builds in the metaframework path.
- Do not hide diagnostics so deeply that asset and frame failures become
  impossible to debug.

## Recommended Short API

The proposed beginner-facing surface is intentionally small:

- `defineApertureConfig(options)`.
- `asset.gltf(url, options?)`.
- `asset.texture(url, options?)`.
- `asset.hdr(url, options?)`.
- `aperture()` Vite plugin from `@aperture-engine/vite-plugin`.
- `createSystem(queries?, schema?)`.
- system files discovered by `systems: ["src/systems/**/*.system.ts"]`.
- `export const schedule = { priority }`.
- `this.signals`.
- `this.input`.
- `this.assets`.
- `this.commands`.
- `this.spawn.camera(options)`.
- `this.spawn.light(options)`.
- `this.spawn.mesh(options)`.
- `this.spawn.gltf(handle, options?)`.
- `this.spatial.raycast(ray, options?)`.
- `this.cameras.main`, `this.cameras.active`, `this.cameras.byKey(key)`.
- `this.effects.watch(signal, callback, options?)`.
- `this.effects.onQueryEnter(query, callback, options?)`.
- `mesh.box`, `mesh.sphere`, `mesh.plane`.
- `material.standard`.

Everything else can remain in advanced packages until a real workflow requires
it.

## Design Test

This proposal should be considered successful only if the default answer to
"How do I initialize a scene, create primitive objects, and load a GLTF file?"
is config plus one setup system:

```ts
// aperture.config.ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
  },
  render: {
    defaultCamera: true,
    defaultLight: true,
  },
});
```

```ts
// src/systems/setup.system.ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem() {
  override init(): void {
    this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({ baseColor: [1, 0.4, 0.2, 1] }),
      transform: { translation: [-1, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      transform: { translation: [1, 0, 0] },
    });
  }
}
```

If the recommended docs still require the user to understand
`createApertureApp`, `stepAndExtract`, source asset transfer packages,
renderer-side registration, or snapshot transport before they see a cube or
GLB, the API has not solved the feedback.
