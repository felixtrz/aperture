# Current Task

No active task is currently checked out.

Status: `task-3181` completed the constrained entity component mutation helper
for developer tooling.

Key findings:

- `@aperture-engine/app/entity-lookup` now exposes
  `ApertureEntitySetComponentFieldRequest`,
  `ApertureEntitySetComponentFieldReport`, and
  `setApertureEntityComponentField(...)`.
- The lookup facade now has `setComponentField(...)`.
- Mutations are whitelisted; the initial safe surface supports
  `DebugMetadata.tag` and `DebugMetadata.note` string fields.
- Unknown components, unknown fields, missing components, invalid value types,
  invalid refs, and stale generations return actionable diagnostics.
- Focused headless coverage mutates `DebugMetadata.note` through the helper and
  verifies unsupported component, unsupported field, and stale-generation
  failures.

Recommended next task:

- `task-3182` — expose a typed generated browser status reader helper for
  browser tooling so examples do not need to hard-code the generated status
  global name.
