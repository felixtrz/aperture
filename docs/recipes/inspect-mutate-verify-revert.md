# Recipe: Inspect → Mutate → Verify → Revert

**Status:** reference

## Goal

The core agent editing loop against a running app, using only the dev tools:
find an entity (`ecs_find_entities`), capture its state (`ecs_snapshot`),
mutate one whitelisted component field (`ecs_set_component_field`), prove the
change (`ecs_diff`), and revert by re-setting the prior value taken from the
snapshot.

**Scope contract:** there is no broad ECS undo tool, and none is planned —
the snapshot/diff pair _is_ the revert contract. Per `docs/AI_TOOLING.md`
("Restoring State"): "For ECS edits, use `ecs_snapshot` before mutation and
`ecs_diff` after mutation to make changes explicit. There is no broad ECS undo
tool; use app systems or a fresh dev session when a mutation should be
discarded."

## Code (the loop, step by step)

Start a managed dev session from the app root (the playground works as-is):

```sh
pnpm exec aperture dev up --headless
pnpm exec aperture dev status
```

Source: `docs/AI_TOOLING.md` (CLI Flow); the session lifecycle is exercised by
`test/e2e/cli-ai-tools.spec.ts` ("Aperture CLI manages a browser session and
exposes browser/ECS tools over MCP").

### 1. Find the entity

```ts
const find = await callMcpTool("ecs_find_entities", {
  key: "level.crate.primary",
  limit: 5,
});
expect(find.structuredContent).toMatchObject({
  ok: true,
  result: {
    total: 1,
    summaries: [
      expect.objectContaining({
        key: "level.crate.primary",
      }),
    ],
  },
});
const primaryEntity = firstEntityRef(find.structuredContent);
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test). The entity reference is
`result.summaries[0].entity` — an `{ index, generation }` pair — and is what
every later call uses.

### 2. Snapshot before mutating

```ts
const snapshot = await callMcpTool("ecs_snapshot", {
  key: "level.robot",
  label: "e2e-before",
});
expect(snapshot.structuredContent).toMatchObject({
  ok: true,
  result: {
    label: "e2e-before",
    summaries: expect.any(Array),
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test). Each summary carries the
revert payload: `key`, `name`, `componentIds`, `tags`, `source`, `parent`,
`localTransform` (`{ translation, rotation, scale }`), `worldTransform`, and
every physics component summary (contract:
`packages/app/src/entities/lookup/types.ts`, `ApertureEntitySummary`). Keep
the `before` values you intend to restore. The snapshot is also stored
worker-side as the baseline for the next `ecs_diff`.

### 3. Mutate one whitelisted field

```ts
const mutation = await callMcpTool("ecs_set_component_field", {
  entity: debugEntity,
  component: "aperture.metadata.debug",
  field: "note",
  value: "updated by cli ai tools e2e",
});
expect(mutation.structuredContent).toMatchObject({
  ok: true,
  result: {
    component: "aperture.metadata.debug",
    field: "note",
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test). The success report also
returns the written `value` and the refreshed entity `summary`
(`test/app/entity-component-field-mutation.test.ts`, "returns the refreshed
entity summary alongside the written value").

The mutation registry covers far more than debug metadata — local transforms,
all authored physics components, and the render-side authoring components
(`Name`, `Visibility`, `RenderLayer`, `InstanceTint`, `Light`, `Camera`) are
writable; `docs/AI_TOOLING.md` enumerates the exact allowlist and a doc-sync
test keeps it honest (`test/app/entity-mutation-render-components.test.ts`,
"keeps the AI_TOOLING doc allowlist in lockstep with the registry"). For a
transform edit, the committed registry test writes:

```ts
{
  component: LocalTransform.id,
  field: "translation",
  value: [1, 2, 3],
  kind: "vector",
},
```

Source: `test/app/entity-component-field-mutation.test.ts` (`successCases`
excerpt; `LocalTransform.id` is `"aperture.transform.local"`, confirmed by the
`ecs_get_component_schema` assertion in `test/e2e/cli-ai-tools.spec.ts`).

The whole loop — mutate, observe the effect, revert with the prior value — is
pinned end to end for `Visibility.visible`, including the render-side proof
that the draw disappears and comes back:

```ts
expect(app.extract(1).meshDraws).toHaveLength(1);

const report = setApertureEntityComponentField(app.lowLevel.world, {
  entity: entityRef(target),
  component: Visibility.id,
  field: "visible",
  value: false,
});

expect(report.ok).toBe(true);
expect(target.getValue(Visibility, "visible")).toBe(false);

app.step(1 / 60, 1 / 60);
expect(app.extract(2).meshDraws).toHaveLength(0);

// And back: the loop is reversible from the prior snapshot value.
setApertureEntityComponentField(app.lowLevel.world, {
  entity: entityRef(target),
  component: Visibility.id,
  field: "visible",
  value: true,
});
app.step(1 / 60, 2 / 60);
expect(app.extract(3).meshDraws).toHaveLength(1);
```

Source: `test/app/entity-mutation-render-components.test.ts` ("disabling
Visibility through the write path removes the draw from extraction").
`setApertureEntityComponentField` is the in-worker function behind the
`ecs_set_component_field` tool
(`packages/app/src/worker/devtools/entities.ts`).

Everything outside the whitelist is rejected with a structured diagnostic and
no state change:

```ts
const unsupportedComponentMutation = await callMcpTool(
  "ecs_set_component_field",
  {
    entity: debugEntity,
    component: "aperture.render.mesh",
    field: "handle",
    value: "unsafe",
  },
);
expect(unsupportedComponentMutation.structuredContent).toMatchObject({
  ok: false,
  diagnostics: [
    expect.objectContaining({
      code: "aperture.entityLookup.componentMutationUnsupported",
    }),
  ],
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test). The other rejection
families — `componentFieldUnsupported`, `invalidComponentFieldValue` (bad
type/shape, with the prior value left intact), `componentMissing`,
`invalidRef`, `generationMismatch` (stale ref), `notFound` (destroyed entity)
— are each pinned in `test/app/entity-component-field-mutation.test.ts`.

### 4. Verify with a diff

```ts
const diff = await callMcpTool("ecs_diff", {
  key: "level.robot",
  label: "e2e-after",
});
expect(diff.structuredContent).toMatchObject({
  ok: true,
  result: {
    counts: expect.any(Object),
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test). The diff result is
`{ fromLabel, toLabel, counts: { added, removed, changed, unchanged }, added,
removed, changed, unchanged, diagnostics }`, where each `changed` entry is
`{ entity, fields, before, after }` — `before`/`after` are full summaries, so
the prior value is recoverable from the diff as well as from your step-2
snapshot. Watched fields include `localTransform`, `worldTransform`, and all
physics summaries (contract:
`packages/app/src/entities/lookup/snapshot.ts`
`diffApertureEntityLookupSnapshots` / `changedSummaryFields`;
`packages/app/src/entities/lookup/types.ts`).

Two behaviors to plan around (both from
`packages/app/src/worker/devtools/entities.ts`):

- `ecs_diff` without a prior `ecs_snapshot` fails with
  `aperture.entityTools.diffMissingSnapshot` and `suggestedFix: "Call
ecs_snapshot before requesting ecs_diff."`.
- Each `ecs_diff` replaces the stored baseline with the snapshot it just took,
  so the next diff is relative to the post-edit state.

### 5. Revert by re-setting the prior value

Re-issue `ecs_set_component_field` with the `before` value from your step-2
snapshot (or the diff's `changed[].before`). It is the same call as step 3
with the old value — there is no separate undo tool. A final `ecs_diff` then
shows the field changing back (one `changed` entry relative to the post-edit
baseline), and a fresh `ecs_get_entity` summary should equal the step-2
snapshot summary for the watched fields.

## Verbatim playground transcript

This sequence runs as-is from `playground/` (entity values from
`playground/src/systems/setup.system.ts`: `backdrop.ground-shadow` is spawned
at translation `[0.8, -0.44, -0.38]` and no system rewrites it after `init`,
so the edit and revert are observable). The `--json` argument form is the one
the e2e suite drives (`runCli(["tool", "input_key", "--json", ...])` in
`test/e2e/cli-ai-tools.spec.ts`).

```sh
pnpm exec aperture dev up --headless
pnpm exec aperture tool ecs_find_entities --json '{"key":"backdrop.ground-shadow","limit":1}'
pnpm exec aperture tool ecs_snapshot --json '{"key":"backdrop.ground-shadow","label":"before-edit"}'
pnpm exec aperture tool ecs_set_component_field --json '{"component":"aperture.transform.local","field":"translation","value":[1,2,3]}'
pnpm exec aperture tool ecs_diff --json '{"key":"backdrop.ground-shadow","label":"after-edit"}'
pnpm exec aperture tool ecs_set_component_field --json '{"component":"aperture.transform.local","field":"translation","value":[0.8,-0.44,-0.38]}'
pnpm exec aperture tool ecs_diff --json '{"key":"backdrop.ground-shadow","label":"after-revert"}'
pnpm exec aperture dev down
```

Sources: command surface `docs/AI_TOOLING.md` (CLI Flow) and
`test/e2e/cli-ai-tools.spec.ts`; mutation payload values
`test/app/entity-component-field-mutation.test.ts` (`[1, 2, 3]` translation
success case) and `playground/src/systems/setup.system.ts` (the spawn
translation `[0.8, -0.44, -0.38]` being restored).

Expected reports along the way:

- `ecs_find_entities` → `ok: true`, `result.total: 1`,
  `result.summaries[0].key: "backdrop.ground-shadow"` with
  `summaries[0].entity: { index, generation }`.
- `ecs_snapshot` → `ok: true`, `result.label: "before-edit"`,
  `result.summaries[0].localTransform.translation: [0.8, -0.44, -0.38]`.
- first `ecs_diff` → `ok: true`, `result.counts.changed: 1`, and the changed
  entry's `fields` containing `"localTransform"` (plus `"worldTransform"`
  once transform resolution has run), `before`/`after` carrying both values.
- second `ecs_diff` → `result.counts.changed: 1` again (the revert, relative
  to the post-edit baseline), after which the entity matches the
  `before-edit` snapshot.

The `ecs_set_component_field` calls above omit `entity`: the worker bridge
falls back to the most recent find/get result
(`packages/app/src/worker/devtools/entities.ts`, `entityRefFromPayload`:
explicit ref → payload summaries → last get → last find). When scripting
anything non-trivial, pass the explicit
`"entity":{"index":<n>,"generation":<n>}` from the find result instead — that
is the form the committed e2e test uses, and it is immune to interleaved
finds.

## Revert / cleanup

The revert _is_ step 5. Afterwards:

```sh
pnpm exec aperture dev down
```

Source: `docs/AI_TOOLING.md` (CLI Flow). If a mutation should be discarded
wholesale (or you mutated something you cannot cheaply restore), restart the
dev session — a reload re-runs the authored systems, which are the source of
truth. Broad ECS undo is explicitly out of scope; do not look for an undo
tool, and do not build agent flows that depend on one.
