# Current Task

No active task is currently checked out.

Status: `task-3178` completed the developer API browser control/status panel.
The example now has a DOM panel outside the canvas that exercises generated
input and command forwarding and displays JSON-safe worker summaries.

Key findings:

- `examples/developer-api/index.html` now lays out the WebGPU canvas beside a
  compact developer panel with `Select` and `Request decal` controls.
- `examples/developer-api/src/dev-panel.ts` reads only
  `globalThis.__APERTURE_GENERATED_APP__` and renders app, input, command,
  entity, frame, and diagnostic summaries as JSON.
- The `Select` control dispatches the configured `Enter` keyboard action
  through the generated browser input forwarder; the `Request decal` control
  dispatches the existing `aperture:command` asset request.
- Browser/headless developer API configs now bind `select` to both primary
  pointer and `Enter`, keeping the original canvas pointer path intact.
- Playwright now clicks panel controls instead of dispatching raw custom events
  from the test body and asserts that the panel displays entity, input,
  command, and requested-asset status.

Recommended next task:

- `task-3179` — prove worker-side camera/spatial selection in the developer API
  example by deriving a ray from forwarded input through `this.cameras.main`,
  using `this.spatial.raycast(...)`, and surfacing the selected
  `{ index, generation }` summary through generated status.
