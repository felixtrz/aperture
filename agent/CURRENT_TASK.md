# Current Task

No active task is currently checked out.

Status: `task-3174` completed the Developer API generated command forwarding
slice. Browser/UI commands now flow into worker-owned `this.commands` queues,
and a worker system can request a manual config asset without loader or renderer
registration code.

Key findings:

- Generated browser code forwards `aperture:command` custom events to the
  simulation worker.
- Generated worker startup queues command messages before the app is ready and
  applies them to `this.commands` afterward.
- The developer API example now declares a manual `decal` texture asset and an
  `AssetCommandSystem` that drains `asset.request`.
- Browser status reports forwarded command counts, the last command, command
  drain counts, and requested asset readiness in JSON-safe form.

Recommended next task:

- `task-3175` — surface generated app diagnostics for config, system-manifest,
  worker, and asset-load failures through one JSON-safe browser/headless status
  shape.
