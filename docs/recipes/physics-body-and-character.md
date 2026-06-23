# Recipe: Physics Body and Character Controller

**Status:** reference

## Goal

Give a rendered mesh a physics body with a single `spawn.mesh` descriptor
(`physics: { rigidBody, collider, velocity }`), spawn non-rendered bodies with
`spawn.physics`, and drive a kinematic character with
`context.physics.moveCharacter`. Verify through the physics summary, pose
writeback, and the character move report.

> **App authoring uses string unions, not enum imports.** In a generated app you
> only depend on `@aperture-engine/app`, so author rigid bodies with the plain
> string `type` (`"static" | "dynamic" | "kinematicPosition" |
> "kinematicVelocity"`) or the `physics.*` helper namespace exported from
> `@aperture-engine/app/systems`. The `PhysicsRigidBodyType.*` enum below is the
> equivalent value from `@aperture-engine/physics`; the snippets use the string
> form so they compile in an app without adding that package.

## Code

### 1. Rendered mesh with a physics descriptor

```ts
// A rendered, physics-driven body: the deterministic test backend
// integrates its velocity each fixed step and writes the pose back, so
// physics motion is part of every frame hash.
this.spawn.mesh({
  key: "physics.replay",
  mesh: mesh.box({ size: 0.5 }),
  material: material.standard(),
  transform: { translation: [0, 3, 0] },
  physics: {
    rigidBody: { type: "dynamic" },
    collider: { shape: { kind: "sphere", radius: 0.25 } },
    velocity: { linear: [0.4, 0, 0] },
  },
});
```

Source: `test/determinism/replay.test.ts` (`createReplaySystem` → `init`; part
of the committed determinism replay gate, so this exact body is hashed for 300
frames on CI).

The app installs a backend via the same options object used to create the app:

```ts
const app = await createApertureApp({
  config: APP_CONFIG,
  systems: [{ default: createReplaySystem() }],
  physics: { backend: () => createTestPhysicsBackend() },
});
```

Source: `test/determinism/replay.test.ts` (`runReplay`). Passing
`physics: true` installs Rapier instead (next block).

### 2. Dynamic body + static ground via `spawn.physics` (Rapier)

```ts
const runner = await createPhysicsRunner({ physics: true });
const context = runner.app.context;
const body = context.spawn.physics({
  key: "physics.facade.dynamic",
  transform: { translation: [0, 2, 0] },
  physics: {
    rigidBody: { type: "dynamic" },
    collider: { shape: { kind: "sphere", radius: 0.25 } },
  },
});

context.spawn.physics({
  key: "physics.facade.ground",
  transform: { translation: [0, -0.25, 0] },
  physics: {
    rigidBody: { type: "static" },
    collider: { shape: { kind: "box", halfExtents: [4, 0.25, 4] } },
  },
});
```

Source: `test/app/physics-facade.test.ts` ("installs Rapier through
createApertureApp physics config and steps settling bodies").

### 3. Character controller

Mark the body as a kinematic character in the spawn descriptor, then move it
through the physics facade:

```ts
const character = context.spawn.physics({
  key: "physics.facade.character",
  transform: { translation: [0, 1, 0] },
  physics: {
    rigidBody: { type: "kinematicPosition" },
    collider: { shape: { kind: "sphere", radius: 0.5 } },
    characterController: true,
  },
});

runner.step(1 / 60, 0);

expect(runner.app.physics?.backend.kind).toBe("test");
expect(
  context.physics.moveCharacter({
    entity: character,
    desiredTranslation: [0, 0, 0],
    settings: { snapToGroundDistance: 0.05 },
  }),
).toMatchObject({
  entity: serializeEntityRef(character),
  grounded: true,
});
```

Source: `test/app/physics-facade.test.ts` ("installs custom backends through
the same facade and supports character movement"; excerpt).

The full Rapier character settings (slopes, autostep, ground snap) and their
effect are exercised at the backend level:

```ts
const result = backend.moveCharacter?.({
  entity: "character",
  desiredTranslation: [1, -0.02, 0.65],
  settings: {
    snapToGroundDistance: 0.12,
    maxSlopeClimbAngle: Math.PI / 4,
    minSlopeSlideAngle: Math.PI / 3,
    autostep: false,
  },
});
```

Source: `test/physics/character-controller.test.ts` ("uses Rapier to walk a
grounded kinematic capsule and slide along a wall"). Autostep settings take
`{ maxHeight, minWidth }` (see "uses Rapier autostep to climb a configured low
obstacle" in the same file). Invalid settings return structured diagnostics
such as `aperture.physics.invalid.snapToGroundDistance` ("validates finite
character movement settings", same file).

## Verify

1. The backend and body counts, via the physics summary:

```ts
const summary = context.physics.summary();

expect(runner.app.physics?.backend.kind).toBe("rapier");
expect(summary.backend).toMatchObject({
  kind: "rapier",
  execution: "simulation-worker",
});
expect(summary.step).toMatchObject({
  enabled: true,
  bodyCount: 2,
  colliderCount: 2,
});
expect(readY(body)).toBeLessThan(beforeY);
```

Source: `test/app/physics-facade.test.ts` ("installs Rapier through
createApertureApp physics config and steps settling bodies"). The last line is
the pose-writeback proof: gravity pulled the dynamic body's
`LocalTransform.translation[1]` down after 40 fixed steps.

2. The character move report fields:

```ts
expect(result).toMatchObject({
  entity: "character",
  desiredTranslation: [2, 0, 1],
  movement: [0, 0, 1],
  targetTranslation: [0, 1, 1],
  grounded: true,
});
expect(result?.collisions).toHaveLength(1);
expect(result?.collisions[0]).toMatchObject({
  entity: "wall",
  normal: [-1, 0, 0],
});
```

Source: `test/physics/character-controller.test.ts` ("moves and slides
deterministically in the test backend"). `movement` is the slid translation
actually applied, `targetTranslation` the resulting pose, and `collisions`
lists blocking contacts with normals.

3. From tooling, entity summaries expose the authored physics state:
   `ecs_get_entity` / `ecs_find_entities` summaries carry `physicsRigidBody`,
   `physicsCollider`, `physicsVelocity`, `physicsCharacterController`, and
   `physicsBodyState` fields, and `ecs_diff` tracks changes to all of them
   (field list in
   `packages/app/src/entities/lookup/snapshot.ts` `changedSummaryFields`;
   summary shapes in `packages/app/src/entities/lookup/types.ts`).

## Revert / cleanup

Physics component fields are in the `ecs_set_component_field` registry —
`aperture.physics.rigidBody`, `.collider`, `.velocity`,
`.characterController`, and friends are all writable with structured
rejections for bad values:

```ts
{
  component: PhysicsVelocity.id,
  field: "linear",
  value: [1, 2, 3],
  kind: "vector",
},
```

Source: `test/app/entity-component-field-mutation.test.ts` (`successCases`
excerpt; the suite writes and reads back every whitelisted physics field).

Use the snapshot/diff loop in
[inspect-mutate-verify-revert.md](./inspect-mutate-verify-revert.md) to capture
the prior values and restore them. To remove a body entirely, delete the spawn
call (authoring-time) — destroying entities from tooling is not part of the
mutation surface.
