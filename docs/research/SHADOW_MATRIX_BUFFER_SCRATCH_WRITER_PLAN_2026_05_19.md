# Shadow Matrix Buffer Scratch Writer Plan — 2026-05-19

## Task

`task-1826` reviewed shadow matrix-buffer descriptor planning against Decision 0009.

## Findings

`createShadowMatrixBufferDescriptorReport` currently allocates:

- an `entries` array from `viewProjection.plans.map`,
- one descriptor object,
- diagnostics when matrix upload is deferred, missing, or unsupported,
- cloned entries in the JSON helper.

Current usage is diagnostic/status-only through the GLTF scene example. It is
not yet part of live command encoding or GPU buffer upload.

## Recommendation

Do not implement a shadow matrix-buffer scratch writer before the first live
shadow resource slice. The higher-value next shadow work is to decide whether
matrix buffer allocation/upload or shadow texture allocation should land first.

If matrix upload is selected, add a writer at that time so descriptor planning
and upload planning can share caller-owned entries.

## Suggested Follow-Up

```md
### task-1828 — Plan first live shadow resource allocation slice

Category: `docs-tooling`
Package/write-scope: `docs/research`, backlog only.
Reference anchor: local `shadow-texture-resource`,
`shadow-matrix-buffer-descriptor`, and `shadow-caster-command-plan-readiness`.

Acceptance criteria:

- Compare shadow texture allocation, matrix-buffer allocation/upload, and
  command encoding as first live shadow-resource candidates.
- Select one implementation task with acceptance criteria and validation.
- Keep StandardMaterial shadow sampling deferred unless it is an explicit
  prerequisite.
```

## Result

No code change required.
