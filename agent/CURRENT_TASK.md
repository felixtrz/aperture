# Current Task

No active task is currently checked out.

Status: `task-3175` completed the Developer API generated diagnostics slice.
Generated/headless failure status can now report config/system-manifest,
worker-startup, and blocking asset-load failures with stable codes, messages,
source context, and suggested fixes.

Key findings:

- `@aperture-engine/app/diagnostics` normalizes thrown app errors and plugin
  diagnostics into JSON-safe status entries.
- Generated worker startup errors post normalized diagnostics to the main
  thread.
- Browser status records normalized worker failures instead of console-only
  error objects.
- Headless mode exposes `createApertureHeadlessFailureStatus(...)` for the same
  failure shape.
- Focused fixtures cover missing default exports, invalid schedule metadata,
  invalid GLB URLs, and generated worker startup failure.

Recommended next task:

- `task-3176` — restructure the beginner authoring docs so config plus
  worker-discovered systems are the first path and imperative
  `createApertureApp(...)`/snapshot transport wiring is clearly advanced.
