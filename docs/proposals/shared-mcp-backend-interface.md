# Shared MCP Backend Interface

## Goal

Redesign the Aperture MCP surface so agents use the same intent-level tools for
headed browser sessions and warm headless sessions. Backend differences should
be explicit in response metadata, not in duplicated tool names.

Aperture is still early, so backward compatibility is not a design constraint
for this change. Prefer the cleaner public surface even when that means
renaming, removing, or reshaping existing MCP tools.

The target v1 model has two server-owned session slots:

- `headed`: the managed browser/WebGPU dev session.
- `headless`: the warm Node simulation session.

There are no opaque session ids in v1. Tools accept an optional
`target: "headed" | "headless"` when the target is ambiguous. Defaults should be
predictable:

- State/model tools default to `headless` when it is running, otherwise
  `headed`.
- Presentation tools such as `frame_capture` default to `headless` when it is
  running, otherwise `headed`.
- Lifecycle tools require a target when starting/stopping/resetting both would
  be surprising.

Every response must include `target`, `mode`, `frame` when applicable, and
structured diagnostics.

## Design Principle

Expose tools by agent intent:

- "Advance the app."
- "Find entities."
- "Move the camera."
- "Show me the current frame."
- "Read logs."

Do not expose backend mechanics as the primary tool choice. Headed and headless
should share a tool when they operate on the same authoritative app model.
Tools diverge only when the capability is genuinely not meaningful in one
backend.

## Public Tool Surface

### Shared Tools

These are the primary tools agents should see.

| Tool                      | Purpose                                                                                  | Headed implementation                                                                | Headless implementation                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `app_status`              | Report running slots, readiness, frame, diagnostics, asset summary, and recent failures. | Reads managed browser/app status. Optional readiness wait includes WebGPU readiness. | Reads warm runner status. Optional readiness wait means runner booted and preload completed. |
| `app_start`               | Start one or both slots.                                                                 | Existing `aperture dev up`/managed browser path.                                     | Create or reuse a warm headless runner.                                                      |
| `app_stop`                | Stop one or both slots.                                                                  | Existing dev session teardown.                                                       | Dispose warm headless runner/subprocess.                                                     |
| `app_reset`               | Rebuild the experience.                                                                  | Reload page and wait for app status.                                                 | Reboot the warm headless runner with optional seed.                                          |
| `ecs_step`                | Advance authoritative simulation by fixed frame(s).                                      | Existing generated `ecs_step`.                                                       | Warm runner `step`.                                                                          |
| `ecs_find_entities`       | Find entities by key/name/tags/components.                                               | Existing runtime tool.                                                               | In-process entity tool bridge.                                                               |
| `ecs_get_entity`          | Read one entity summary.                                                                 | Existing runtime tool.                                                               | In-process entity tool bridge.                                                               |
| `ecs_query`               | Structured ECS query.                                                                    | Existing runtime tool.                                                               | In-process entity tool bridge.                                                               |
| `ecs_snapshot`            | Save normalized ECS summary for later diff.                                              | Existing runtime tool.                                                               | In-process entity tool bridge.                                                               |
| `ecs_diff`                | Diff against prior snapshot.                                                             | Existing runtime tool.                                                               | In-process entity tool bridge.                                                               |
| `ecs_set_component_field` | Mutate allowlisted ECS fields.                                                           | Existing runtime tool.                                                               | In-process entity tool bridge.                                                               |
| `ecs_get_hierarchy`       | Derived parent/child hierarchy.                                                          | Existing runtime tool.                                                               | In-process entity tool bridge.                                                               |
| `ecs_list_systems`        | List systems and schedule metadata.                                                      | Existing runtime tool.                                                               | Expose runner system list.                                                                   |
| `resource_get`            | Read initialized resources.                                                              | Existing runtime tool.                                                               | Headless context resources.                                                                  |
| `resource_set`            | Patch initialized resources.                                                             | Existing runtime tool.                                                               | Headless context resources.                                                                  |
| `asset_list`              | List asset readiness and placeholders.                                                   | Existing runtime tool.                                                               | Headless asset manifest report.                                                              |
| `input_inject`            | Apply semantic input actions/pointers/gamepad state.                                     | Map to generated input tools or runtime input bridge.                                | Queue generated headless input events.                                                       |
| `input_get_state`         | Read generated input state.                                                              | Existing runtime tool.                                                               | Headless input summary.                                                                      |
| `input_reset`             | Clear generated input state.                                                             | Existing runtime tool plus pointer release.                                          | Queue/reset headless input state.                                                            |
| `camera_list`             | List ECS camera entities.                                                                | Existing camera tool.                                                                | Same camera tool against runner app.                                                         |
| `camera_get`              | Read ECS camera component and transform.                                                 | Existing camera tool.                                                                | Same camera tool against runner app.                                                         |
| `camera_create_agent`     | Create/reuse ECS agent camera.                                                           | Existing camera tool; creates real ECS camera.                                       | Same camera tool against runner app.                                                         |
| `camera_set_transform`    | Mutate ECS camera transform.                                                             | Existing camera tool.                                                                | Same camera tool against runner app.                                                         |
| `camera_look_at`          | Aim ECS camera at target.                                                                | Existing camera tool.                                                                | Same camera tool against runner app.                                                         |
| `camera_orbit`            | Place ECS camera around target.                                                          | Existing camera tool.                                                                | Same camera tool against runner app.                                                         |
| `camera_fit_entity`       | Fit ECS camera to entity/world target.                                                   | Existing camera tool.                                                                | Same camera tool against runner app.                                                         |
| `camera_use_agent_view`   | Promote a camera to primary full-viewport render camera.                                 | Existing camera tool; mutates ECS `Camera` fields.                                   | Same camera tool against runner app.                                                         |
| `camera_save`             | Save camera state in the current session slot.                                           | Existing saved-camera map.                                                           | Headless saved-camera map.                                                                   |
| `camera_restore`          | Restore camera state from the current slot.                                              | Existing saved-camera map.                                                           | Headless saved-camera map.                                                                   |
| `frame_capture`           | Produce a PNG plus frame/canvas/render-target/WebGPU metadata.                           | Capture live browser canvas/page.                                                    | Extract bundle, render it on demand, return PNG and bundle metadata.                         |
| `logs_read`               | Read recent logs/diagnostics for a slot.                                                 | Browser console/dev server/app diagnostics.                                          | Headless stdout/stderr ring buffer plus command diagnostics.                                 |

### Headless-Specific Tools

These are artifact and determinism tools. They should be public, but not the
default way to "see" the app.

| Tool                       | Purpose                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `render_bundle`            | Export the current headless frame as an `aperture.render-bundle`.                    |
| `session_snapshot_save`    | Export a restorable `SessionSnapshot`.                                               |
| `session_snapshot_restore` | Restore a `SessionSnapshot` into the headless slot.                                  |
| `determinism_report`       | Report seed, runtime digests, nondeterministic global diagnostics, and replay hints. |

### Removed Backend-Mechanics Tools

These should not be listed in the primary agent tool catalog after the redesign.
They should not be kept as hidden public aliases unless a local test harness
needs a private helper. Existing clients should migrate to the shared tools.

| Existing tool             | Replacement                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `browser_canvas_status`   | `frame_capture` metadata.                                                            |
| `browser_screenshot`      | `frame_capture`.                                                                     |
| `browser_reload`          | `app_reset`.                                                                         |
| `browser_wait_for_webgpu` | `app_status({ waitUntilReady: true })` or `frame_capture({ waitUntilReady: true })`. |
| `browser_console_logs`    | `logs_read`.                                                                         |
| `browser_pick_pixel`      | `frame_capture({ samples: [...] })`.                                                 |
| `render_readback_samples` | `frame_capture({ samples: [...] })`.                                                 |

## `frame_capture`

`frame_capture` is the most important convergence point. It should answer:
"What does this app look like now?"

Input:

```ts
interface FrameCaptureInput {
  target?: "headed" | "headless";
  out?: string;
  includeData?: boolean;
  width?: number;
  height?: number;
  waitUntilReady?: boolean;
  timeoutMs?: number;
  region?: "canvas" | "viewport";
  samples?: readonly Array<{
    x: number;
    y: number;
    coordinateSpace?: "normalized" | "pixel";
  }>;
}
```

Headed behavior:

1. Ensure the headed slot exists.
2. Optionally wait until app status is `running` and `webgpuOk === true`.
3. Capture the canvas by default, or viewport when requested.
4. Return PNG path/data plus current browser canvas, render target, frame, and
   diagnostics metadata.

Headless behavior:

1. Ensure the headless slot exists.
2. Extract the current frame.
3. Write a temporary or requested render bundle.
4. Render that bundle through the existing on-demand Chromium/WebGPU harness.
5. Return PNG path/data plus bundle path, render target, WebGPU metadata, frame,
   asset provenance, and diagnostics.

Output:

```ts
interface FrameCaptureOutput {
  ok: boolean;
  target: "headed" | "headless";
  source: "live-browser-canvas" | "render-bundle";
  frame: number | null;
  pngPath?: string;
  bundlePath?: string;
  mimeType: "image/png";
  byteLength: number;
  dimensions: { width: number; height: number };
  canvas?: unknown;
  renderTarget?: unknown;
  webgpu?: unknown;
  assetProvenance?: unknown;
  samples?: readonly unknown[];
  diagnostics: readonly unknown[];
}
```

The agent should not need to call a separate canvas-status tool to understand
the image it just received.

## MCP Server Architecture

### Session Manager

Add a shared `ApertureMcpSessionManager` inside `@aperture-engine/cli`.

Responsibilities:

- Track the `headed` and `headless` slots.
- Enforce at most one active session per slot.
- Own lifecycle, logs, artifacts, and readiness state.
- Normalize tool responses.
- Keep a small ring buffer per slot for `logs_read`.
- Allocate artifact paths under `.aperture/artifacts/`.

### Headed Slot

Use the existing dev session plumbing:

- `aperture dev up/down/status`
- managed Playwright browser connection
- generated runtime tools
- browser screenshot/render diagnostics helpers

Do not route headed state through a new abstraction until the shared tool
adapter requires it.

### Headless Slot

Do not make MCP shell out to the human-oriented `aperture headless serve`
protocol long-term. Refactor the reusable core into a library controller and
make both `headless serve` and MCP use it.

Suggested internal type:

```ts
interface HeadlessSessionController {
  readonly status: ApertureHeadlessStatus;
  step(input: StepInput): Promise<StepOutput>;
  extract(input?: ExtractInput): Promise<ExtractOutput>;
  reset(input?: ResetInput): Promise<ResetOutput>;
  inject(input: InputInjectInput): Promise<InputInjectOutput>;
  callTool(name: string, args: unknown): Promise<GeneratedDevtoolsToolResult>;
  createBundle(input: BundleInput): Promise<BundleOutput>;
  saveSessionSnapshot(input: SnapshotSaveInput): Promise<SnapshotSaveOutput>;
  restoreSessionSnapshot(
    input: SnapshotRestoreInput,
  ): Promise<SnapshotRestoreOutput>;
  dispose(): Promise<void>;
}
```

`aperture headless serve` remains as a low-level CLI transport, but the MCP
server should not need to parse its own subprocess protocol.

### Shared Tool Routing

Each public MCP tool should:

1. Resolve target.
2. Validate capability.
3. Dispatch to headed/headless adapter.
4. Normalize the result shape.
5. Attach `target`, `mode`, `frame`, diagnostics, and digests where applicable.

Capability errors should be explicit and actionable:

```json
{
  "ok": false,
  "target": "headless",
  "diagnostics": [
    {
      "code": "aperture.mcp.capabilityUnavailable",
      "message": "Pointer lock status is only available for the headed browser slot."
    }
  ]
}
```

## Implementation Phases

### Phase 1: Tool Catalog And Breaking Public Surface

- Add the new public tool definitions to `packages/cli/src/mcp.ts`.
- Remove backend-mechanics tool names from `tools/list`.
- Add target parsing and default target resolution.
- Add `app_status`, `app_start`, `app_stop`, and `app_reset`.
- Update docs so agents are taught the shared tools first.

Acceptance:

- `tools/list` shows the shared surface, not the backend-mechanics surface.
- Browser-backed tests use shared public tool names.
- `app_status` reports both slots and their readiness.

### Phase 2: Headless Session Controller

- Extract the core of `packages/cli/src/commands/headless-serve.ts` into a
  reusable controller.
- Adapt the NDJSON CLI to the controller. Its command contract can break where
  needed to match shared MCP semantics.
- Add lifecycle tests for start/reset/stop.
- Add per-slot log buffers.

Acceptance:

- `aperture headless serve` remains persistent and maps to the same controller
  behavior as MCP.
- MCP can start and reset a warm headless session without launching a browser.
- `logs_read({ target: "headless" })` returns boot warnings, asset placeholder
  warnings, command failures, and determinism diagnostics.

### Phase 3: Shared ECS, Resource, Asset, Input, And Camera Tools

- Route all current `ecs_*` tools to both slots.
- Add headless implementations for `resource_get`, `resource_set`,
  `asset_list`, `input_get_state`, and `input_reset`.
- Route semantic `input_inject` to headed generated input tools and headless
  queued input events.
- Export the camera devtools bridge through `@aperture-engine/app/headless-tools`
  and route all current `camera_*` tools to both slots.
- Maintain a saved-camera-state map per slot.

Acceptance:

- Camera tools work identically against headed and headless for ECS cameras.
- Shared tools return normalized `ok`, `target`, `frame`, `result`, and
  `diagnostics`.
- Current browser-specific MCP tests are updated to run through shared tool
  names.

### Phase 4: Unified Frame Capture

- Implement `frame_capture` for headed using the current screenshot plus
  canvas/render metadata path.
- Implement `frame_capture` for headless using bundle export plus the existing
  on-demand render harness.
- Include dimensions, render target, WebGPU metadata, frame, source, asset
  provenance, optional samples, and diagnostics in one response.
- Hide `browser_canvas_status`, `browser_screenshot`,
  `browser_wait_for_webgpu`, and `render_readback_samples` from the primary
  catalog.

Acceptance:

- Agents can call `frame_capture` for either target and receive a PNG plus
  enough metadata to interpret it.
- No separate canvas-status call is needed for normal workflows.
- Headless capture writes both PNG and bundle artifacts when requested.

### Phase 5: Session Snapshot And Determinism Tools

- Add `render_bundle` for explicit bundle export.
- Add `session_snapshot_save` and `session_snapshot_restore` for the headless
  slot.
- Add `determinism_report` with seed, fixed-step state, ECS/status/render
  digests, and nondeterministic-global diagnostics.

Acceptance:

- A snapshot can be saved, restored into a fresh headless slot, stepped, and
  compared against uninterrupted digests.
- Determinism report explains replay preconditions and known violations.

### Phase 6: Docs And Migration

- Update `docs/AI_TOOLING.md` with the redesigned MCP surface.
- Add a replacement table from old browser-mechanics tools to shared tools, with
  no guarantee that old public names remain callable.
- Keep low-level CLI docs for `aperture headless`, `aperture headless serve`,
  and `aperture render`.
- Update MCP tests to assert the primary tool list is not overloaded with
  backend-specific duplicates.

Acceptance:

- New users see shared tools first.
- Removed tools are documented only as historical names with shared-tool
  replacements.

## Showcase Parity Test

Use `showcase/city-builder` as the first parity showcase.

Reasons:

- It is a real showcase app, not a toy fixture.
- It has GLB and audio assets.
- It has signals/resources, input actions, camera systems, ECS-authored render
  state, and UI-facing state.
- It avoids the extra nondeterminism and tolerance questions of a physics-heavy
  first parity gate.

### Required Test Fixture

Add a headless companion config for the showcase parity test. Options:

1. Preferred: refactor `showcase/city-builder/aperture.config.ts` to share a
   config factory and add `aperture.headless.config.ts` with
   `mode: "headless"`.
2. Acceptable: add a test-only config under `test/e2e/fixtures/showcase-city-builder`
   that imports the same systems/assets and switches only `mode`/`canvas`.

The fixture must use the same systems and assets as the headed showcase. The
test can run headless asset mode `strict` once supported assets are sufficient;
otherwise it must assert placeholder provenance explicitly and avoid pixel
equivalence claims for placeholder assets.

### Test Script

Add an E2E parity spec, for example:

```text
test/e2e/mcp-shared-backend-parity.spec.ts
```

The spec starts both slots through MCP:

1. `app_start({ target: "headed", appRoot: "showcase/city-builder" })`
2. `app_start({ target: "headless", config: "showcase/city-builder/aperture.headless.config.ts", seed: 7, assetMode: "strict" })`
3. `app_status({ target: "headed", waitUntilReady: true })`
4. `app_status({ target: "headless", waitUntilReady: true })`

Then it runs the same shared-tool script against both targets:

```ts
const script = [
  ["app_reset", { seed: 7 }],
  ["ecs_step", { frames: 1, delta: 1 / 60, time: 0, digest: true }],
  ["asset_list", {}],
  ["resource_get", {}],
  ["ecs_find_entities", { query: { components: ["aperture.metadata.name"] } }],
  [
    "camera_create_agent",
    { key: "camera.agent", translation: [12, 14, 18], lookAt: [0, 0, 0] },
  ],
  ["camera_use_agent_view", { key: "camera.agent" }],
  [
    "camera_fit_entity",
    {
      key: "camera.agent",
      target: [0, 0, 0],
      radius: 32,
      yawDegrees: 35,
      pitchDegrees: 28,
    },
  ],
  ["input_inject", { actions: { toggleNext: true } }],
  ["ecs_step", { frames: 2, delta: 1 / 60, digest: true }],
  ["resource_get", {}],
  [
    "frame_capture",
    {
      width: 960,
      height: 640,
      samples: [{ x: 0.5, y: 0.5, coordinateSpace: "normalized" }],
    },
  ],
  ["logs_read", { lines: 100 }],
];
```

### Parity Assertions

For each shared tool, compare normalized results. Do not require raw backend
metadata to be byte-identical.

Must match:

- `ok` success/failure for each command.
- Entity query counts for stable query categories.
- Camera summary after camera mutations:
  - key
  - camera priority
  - viewport/scissor
  - local transform within numeric tolerance.
- Resource ids and JSON-safe values after deterministic steps.
- Asset ids, kinds, and readiness categories.
- ECS/status digests after fixed-step deterministic operations, once both
  backends are paused and stepped by the same fixed clock.
- `frame_capture.ok`, frame number, requested dimensions, and nonblank pixel
  samples.

May differ but must be reported:

- Backend source: `live-browser-canvas` vs `render-bundle`.
- Browser/WebGPU adapter metadata.
- PNG byte length.
- Exact PNG bytes.
- Timing fields.
- File paths.
- Diagnostic ordering when severities and codes are the same.

Failure output must include:

- Target.
- Command.
- Normalized headed result.
- Normalized headless result.
- Digests if available.
- Artifact paths for both captures.

### Pixel Parity

The first gate should assert broad visual equivalence, not exact PNG identity:

- Both captures are nonblank.
- Dimensions match requested dimensions.
- Center and quadrant samples are within a tolerance, or the perceptual image
  diff is below a conservative threshold.
- If headless uses placeholder assets, the test must not compare final pixels;
  it should only assert structural capture success and placeholder diagnostics.

After strict real asset loading is stable for the showcase, add a stronger
threshold-based image diff.

## Risks And Open Decisions

- **Live browser timing:** The headed app must be paused/reset and stepped
  deterministically before parity comparisons. Otherwise the browser animation
  loop can drift from headless.
- **Asset parity:** Headed loads from Vite/public URLs; headless loads from the
  Node asset loader. The test must prove both resolve the same asset ids and
  readiness categories.
- **Audio:** Audio assets should appear in asset parity, but frame parity should
  not depend on audio playback.
- **Physics:** City Builder avoids physics for the first gate. Add Racing or
  Platformer later for physics-backed parity once the shared interface is
  stable.
- **Breaking tool removal:** Removing old browser-specific public tools can
  break early clients, but it materially improves agent tool choice. Because the
  project is pre-stable, this is the preferred tradeoff.
- **Multiple sessions:** One headed plus one headless slot is enough for v1.
  Later A/B workflows can extend `target` to named slots without changing the
  shared tool semantics.

## Definition Of Done

- MCP exposes the shared tool surface.
- Headed and headless slots can be started, reset, stepped, inspected, captured,
  and stopped through the same tool names.
- Browser-backed MCP workflows use the shared tool names directly.
- `showcase/city-builder` parity E2E passes for the shared tool script.
- `frame_capture` replaces separate screenshot/canvas-status/readback calls for
  normal agent workflows.
- Docs teach agents to choose intent-level tools, not backend-specific tools.

## Current Validation

The first shared-backend parity gate is implemented as
`test/e2e/city-builder-mcp-parity.spec.ts`. It starts one headed slot and one
headless slot through one MCP server, then compares shared-tool behavior for
status, `ecs_list_systems`, `ecs_step`, entity lookup, camera readback,
asset listing, semantic input, input state, and `frame_capture` with
center/quadrant pixel samples asserted nonblank on both backends.

Focused MCP coverage in `test/cli/dev-session.test.ts` also verifies the
contract-level pieces that the showcase parity test does not exhaustively cover:
both-slot `app_status`, expected-error tool envelopes, headless diagnostic log
capture, determinism report replay metadata, and SessionSnapshot restore into a
fresh warm slot with continuation digest comparison.

Run it with:

```sh
APERTURE_GPU=software pnpm exec playwright test test/e2e/city-builder-mcp-parity.spec.ts --project=chrome-webgpu-headed
```
