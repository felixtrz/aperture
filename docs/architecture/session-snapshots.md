# Session Snapshots

`SessionSnapshot` is a simulation/app restore artifact. It is different from a
render bundle: a render bundle is renderer-only and answers "can this frame
produce pixels?", while a session snapshot answers "can a fresh app resume this
simulation state?"

SessionSnapshot v1 captures:

- A bootstrap manifest: Aperture/app package version, app config digest,
  headless mode, system module manifest, startup/world/fixed-step/physics
  options, asset loader kind, and explicit v1 limitations.
- ECS scene state through `saveScene`.
- Component registry ids used by the saved scene.
- Serialized resource entries and configured signal entries.
- Source asset registry entries.
- Deterministic frame-time state.
- Fixed-step clock accumulator/index state.
- Built-in RNG state, including a `randomStreams` array for stream-oriented
  restore tools.
- Opt-in private system state.
- Physics policy metadata.
- Optional inspection sidecars such as a CLI-created render bundle.

Restore always creates or uses a fresh headless runner, clears app-created
entities, loads the saved scene, mirrors source assets, restores
resources/signals, restores frame/time/fixed-step/RNG state, restores
hook-backed system state, and then runs `afterRestore()` hooks.

Resource and signal data in v1 is JSON-safe descriptor data, not live JS
objects. Resources are written as entries with ids, versions, field metadata,
and values. Signals are written as `{ name, kind, value }` entries so tooling can
inspect them without recreating the whole app first.

Systems can opt into private state serialization:

```ts
class MySystem extends createSystem() {
  #counter = 0;

  override update(): void {
    this.#counter += 1;
  }

  override snapshotState(): unknown {
    return { counter: this.#counter };
  }

  override restoreState(payload: unknown): void {
    if (typeof payload === "object" && payload !== null) {
      const counter = (payload as { counter?: unknown }).counter;
      if (typeof counter === "number") {
        this.#counter = counter;
      }
    }
  }

  override afterRestore(): void {
    // Optional post-restore reconciliation.
  }
}
```

Hook payloads must be JSON-safe after typed-array encoding. Do not include
functions, promises, DOM handles, GPU objects, cyclic graphs, or backend-native
physics handles. If a hook returns non-serializable state, snapshot creation
throws `aperture.session.invalidSystemState`.

V1 physics policy is `rebuild-from-ecs-authoring`: restore rebuilds from
authored ECS collider, rigid-body, transform, and velocity state. It does not
promise bit-for-bit warm restoration of backend-native physics internals.

`inspection.renderBundle` is an optional JSON sidecar. It lets tooling attach a
renderer-only bundle for the saved frame without making `@aperture-engine/app`
depend on the CLI-owned RenderBundle schema. Restoring a session snapshot uses
simulation/runtime state; render bundles remain inspection artifacts, not
simulation authority.
