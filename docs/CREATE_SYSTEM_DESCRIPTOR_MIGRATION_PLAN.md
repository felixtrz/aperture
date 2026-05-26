# `createSystem` Descriptor Migration Plan

## Goal

Migrate Aperture app systems from the current split shape:

```ts
export const schedule = { priority: 100 };

const SpinSystemBase = createSystem(
  {
    crates: { required: [Name, LocalTransform] },
  },
  {
    speed: { type: EcsType.Float32, default: 1 },
  },
);

export default class SpinSystem extends SpinSystemBase {}
```

to a single descriptor-shaped API:

```ts
export default class SpinSystem extends createSystem({
  priority: 100,
  queries: {
    crates: { required: [Name, LocalTransform] },
  },
  config: {
    speed: { type: EcsType.Float32, default: 1 },
  },
}) {}
```

The new API should be the only documented/default system authoring shape.

## Rationale

The current API spreads one system definition across:

- `export const schedule = { priority }`
- `createSystem(queries, schema)`
- the default-exported class

That is easy for humans and agents to miss during scaffolding. Since systems are
automatically discovered by the Vite plugin, system ordering metadata should
live with the discovered system class definition instead of in a side export.

The descriptor form makes each system self-contained:

- `priority`: static registration metadata.
- `queries`: ECS query definitions.
- `config`: runtime system config schema whose fields become signals on
  `this.config`.

This avoids treating priority as a runtime signal. System order is decided when
the ECS world registers systems; changing a signal named `priority` later would
not reorder systems and would create misleading behavior.

## Target API

### Setup-Only System

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({
  priority: 0,
}) {
  override init(): void {
    // ECS setup work
  }
}
```

### Query System

```ts
import {
  EcsType,
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinSystem extends createSystem({
  priority: 100,
  queries: {
    crates: {
      required: [Name, LocalTransform],
      where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
    },
  },
  config: {
    speed: { type: EcsType.Float32, default: 1 },
  },
}) {
  override update(_delta: number, time: number): void {
    const speed = this.config.speed.value;

    for (const entity of this.queries.crates.entities) {
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * speed));
    }
  }
}
```

## Semantics

- `priority` is optional and defaults to `0`.
- Lower numeric priority runs earlier.
- Equal priority uses the existing deterministic tie-breaker by resolved module
  id/class name.
- `queries` is optional and defaults to an empty query map.
- `config` is optional and defaults to an empty system config schema.
- `config` entries continue to become runtime signals available at
  `this.config.<key>.value`.
- `priority` is not exposed through `this.config` and is not runtime-editable.
- The generated main-thread manifest continues to contain serializable metadata
  only, not live system classes.

## Implementation Plan

### 1. Add Descriptor Types

In `packages/app/src/systems.ts`, add types similar to:

```ts
export interface ApertureSystemDescriptor<
  TQueries extends SystemQueries = Record<string, never>,
  TConfig extends SystemSchema = Record<string, never>,
> {
  readonly priority?: number;
  readonly queries?: TQueries;
  readonly config?: TConfig;
}
```

Extend `ApertureSystemConstructor` so returned classes expose static schedule
metadata:

```ts
readonly aperture?: {
  readonly schedule: {
    readonly priority: number;
  };
};
```

The exact static property name can be adjusted, but it should be namespaced to
avoid collisions with user-defined class members.

### 2. Replace The `createSystem` Signature

Change app-level `createSystem` from:

```ts
createSystem(queries?, schema?)
```

to:

```ts
createSystem(descriptor?)
```

Internally:

- Pass `descriptor?.queries ?? {}` to EliCS `createSystem`.
- Pass `descriptor?.config ?? {}` to EliCS `createSystem`.
- Normalize and attach `descriptor?.priority ?? 0` as static Aperture metadata
  on the returned base class.
- Reject non-finite priorities with an actionable `ApertureSystemError` or
  equivalent app diagnostic.

Because the library has not launched, do not preserve the old two-argument form
as a public compatibility path in the final state.

### 3. Resolve Priority From The System Class

Update `packages/app/src/advanced.ts`:

- Remove reliance on `module.schedule?.priority` as the primary path.
- Resolve priority from the default-exported system constructor's static
  Aperture metadata.
- Preserve default priority `0`.
- Keep deterministic ordering by priority and module id/class name.
- Decide whether programmatic `configData` remains supported as a top-level
  module field. Do not keep `schedule.configData` as the documented path.

Target conceptual resolution:

```ts
const priority = moduleValue.default.aperture?.schedule.priority ?? 0;
```

### 4. Update Vite System Manifest Discovery

Update `packages/vite-plugin/src/index.ts` so the source manifest parser reads
priority from the new descriptor shape:

```ts
createSystem({
  priority: 100,
  queries: { ... },
  config: { ... },
})
```

Requirements:

- Omitted priority resolves to `0`.
- Numeric literals, including negative and decimal values, are accepted.
- Invalid explicit priority, such as `priority: "late"`, produces a diagnostic.
- The parser must not treat `config: { priority: ... }` as system scheduling
  metadata.
- The generated main manifest remains JSON-safe and does not import live system
  classes on the main thread.

Prefer a small TypeScript AST parser over regex so top-level descriptor
properties can be distinguished from nested `config.priority` fields.

### 5. Update Generated Worker Module Shape

Update worker module generation so it no longer depends on `SystemModule.schedule`.

The generated worker can pass only module defaults, or pass serializable
manifest metadata separately if needed for diagnostics. Registration priority
should come from the system constructor metadata created by `createSystem()`.

### 6. Migrate App Example Systems

Update all `@aperture-engine/app/systems` authoring examples:

- `examples/developer-api/src/systems/*.system.ts`
- Any test fixtures under `test/fixtures`
- Docs snippets in `docs/AUTHORING.md`
- Snippets in `docs/DEVELOPER_API_PROPOSAL.md`
- Public tracker snippets in `docs/index.html` if present

Remove side exports like:

```ts
export const schedule = { priority: 100 };
```

Replace with:

```ts
export default class MySystem extends createSystem({
  priority: 100,
  queries: { ... },
  config: { ... },
}) {}
```

### 7. Migrate Tests

Update and add tests around:

- Descriptor typing for `queries` and `config`.
- `this.config.<key>` still exposes runtime signals.
- `priority` is not present in `this.config` unless explicitly declared under
  `config` by the user for unrelated runtime data.
- Default priority is `0`.
- Lower priority runs earlier.
- Equal priority remains deterministic.
- Vite manifest priority extraction works for descriptor-authored systems.
- Vite manifest diagnostics catch invalid explicit priority.
- Main manifest remains serializable and does not expose live classes.
- Generated worker registration uses constructor metadata.

### 8. Remove Old Schedule Documentation

Remove or rewrite docs that describe:

```ts
export const schedule = { priority };
```

Update docs to state:

- Systems are discovered from `aperture.config.ts` globs.
- Scheduling is declared in the `createSystem({ priority })` descriptor.
- Lower numeric priority runs earlier.
- Missing priority defaults to `0`.

### 9. Final Cleanup

- Remove dead `ApertureSystemSchedule` fields if no longer needed.
- Remove old regex-only schedule parsing helpers.
- Remove tests that assert `export const schedule` behavior.
- Keep low-level EliCS `world.registerSystem(SystemClass, { priority })`
  behavior unchanged for lower-layer code.

## Acceptance Criteria

- `@aperture-engine/app/systems` exports `createSystem(descriptor?)` as the
  documented system authoring API.
- The descriptor supports `priority`, `queries`, and `config` exactly as the
  public app-level concepts.
- `createSystem()` with no descriptor still works and creates a system with no
  queries, no config schema, and priority `0`.
- `createSystem({ priority: 100 })` creates a setup-capable system with
  priority `100`.
- `createSystem({ queries: { ... } })` preserves the current query behavior and
  defaults priority to `0`.
- `createSystem({ config: { ... } })` preserves the current runtime signal
  config behavior and defaults priority to `0`.
- `priority` is static registration metadata and does not become
  `this.config.priority`.
- Invalid non-finite priority values fail with a clear diagnostic or thrown
  app error before the system is registered.
- Automatically discovered Vite systems use priority from the
  `createSystem({ priority })` descriptor.
- Missing descriptor priority in discovered systems produces priority `0`
  without diagnostics.
- Invalid explicit descriptor priority in discovered systems produces a Vite
  manifest diagnostic with a suggested fix.
- The Vite manifest parser does not confuse nested runtime config fields with
  schedule metadata.
- Generated main-thread bootstrap still receives only serializable manifest
  metadata, not live system classes.
- Generated worker bootstrap still registers discovered systems in priority
  order.
- Equal-priority systems remain deterministically ordered.
- All current `export const schedule = { priority }` usages in current examples,
  tests, and active docs are removed or migrated.
- No active docs recommend `export const schedule`.
- `docs/AUTHORING.md` shows the descriptor API for setup systems, query systems,
  runtime config signals, and priorities.
- `docs/DEVELOPER_API_PROPOSAL.md` no longer describes the old
  `createSystem(queries?, schema?)` app authoring API as the recommended shape.
- Existing developer-api browser and headless examples continue to render and
  report the same JSON-safe status fields after migration.
- Existing app-level tests that verify lifecycle, effects, input, signals,
  asset access, entity lookup, and headless runner behavior still pass.
- Package boundaries remain unchanged: app system authoring stays worker-safe
  and does not import WebGPU or browser-only globals through app root/config/
  systems/advanced/headless paths.

## Required Validation

Run these before considering the migration complete:

```sh
pnpm run typecheck
pnpm run typecheck:test
pnpm run build
pnpm run check:boundaries
pnpm run check:examples
pnpm exec vitest run test/app/developer-api.test.ts
pnpm exec vitest run test/examples/navigation.test.mjs
pnpm exec playwright test --project=chrome-webgpu-headed --grep "developer API"
```

Run broader validation before merging the final cleanup:

```sh
pnpm test
pnpm run lint
pnpm exec playwright test --project=chrome-webgpu-headed
```

If full Playwright is too expensive during intermediate slices, each slice must
run targeted app/developer-api browser or headless validation for every migrated
example it touches.

## Risks And Mitigations

- Risk: Type inference regresses for `this.queries`.
  Mitigation: add compile-time and runtime tests that query names remain typed
  from `descriptor.queries`.
- Risk: Type inference regresses for `this.config`.
  Mitigation: add tests that `this.config.speed.value` is typed and backed by a
  signal created from `descriptor.config`.
- Risk: Vite priority extraction misses valid systems.
  Mitigation: parse the system file with TypeScript AST and add fixture tests
  for setup-only, query-only, query+config, omitted priority, negative priority,
  and invalid priority.
- Risk: Main-thread manifest accidentally imports live system classes.
  Mitigation: keep manifest tests that assert class names/default exports are
  not serialized to the browser manifest.
- Risk: Users think `priority` can change at runtime.
  Mitigation: document priority as registration-time metadata and keep runtime
  values under `config`.
