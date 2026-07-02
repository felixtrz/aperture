export type ManagedBlockStyle = "html" | "hash";

export interface AdapterTemplateFile {
  readonly path: string;
  readonly contents: string;
  readonly sync:
    | {
        readonly kind: "managedBlock";
        readonly style: ManagedBlockStyle;
      }
    | {
        readonly kind: "jsonMcpServer";
      };
}

const MANAGED_BLOCK_ID = "aperture-ai-tools";

export function adapterTemplateFiles(): readonly AdapterTemplateFile[] {
  return [
    {
      path: "AGENTS.md",
      contents: agentsMd(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: "CLAUDE.md",
      contents: claudeMd(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".claude/settings.json",
      contents: claudeSettingsJson(),
      sync: { kind: "jsonMcpServer" },
    },
    {
      path: ".cursor/rules/aperture.mdc",
      contents: cursorRule(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".github/copilot-instructions.md",
      contents: copilotInstructions(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".codex/config.toml",
      contents: codexConfigToml(),
      sync: { kind: "managedBlock", style: "hash" },
    },
    {
      path: ".mcp.json",
      contents: mcpJson(),
      sync: { kind: "jsonMcpServer" },
    },
  ];
}

function agentsMd(): string {
  return `# AGENTS.md

${managedBlock(
  "html",
  `You are working on an Aperture app.

## Runtime Model

- ECS is the source of truth.
- Systems live in \`src/systems/**/*.system.ts\` and run in the generated simulation worker.
- Rendering is derived from ECS state through Aperture render extraction.
- Do not introduce a mutable scene graph as app state.

## Why Headless-First

The headless (Node) runner and the browser worker execute the same simulation:
with a fixed clock and the sanctioned random/time APIs, both produce
bit-identical ECS state — this has been verified down to byte-identical
rendered frames. So verifying behavior headlessly is not testing an
approximation of the app; it IS the app. Prefer headless because it returns
machine-checkable state (signals, transforms, digests, diffs) instead of
pixels you would have to interpret, boots in under a second instead of tens of
seconds, and replays deterministically per seed. Use the headed browser as a
verification checkpoint, not as the iteration environment.

## Useful Commands

- \`pnpm run dev\`: start the Vite app.
- \`pnpm run typecheck\`: type-check the app.
- \`pnpm run build\`: build the app.
- \`pnpm exec aperture codegen\`: regenerate \`.aperture/generated\` typed
  action/signal maps without a vite build (headless-first loop).
- \`pnpm exec aperture headless serve aperture.headless.config.ts --seed 1\`:
  warm NDJSON loop (\`step\`/\`extract\`/\`inject\`/\`tool\`/\`bundle\`/
  \`snapshot\`/\`restore\`) when MCP is not available.
- \`pnpm exec aperture mcp stdio\`: expose Aperture tools over MCP once AI tooling is available.
- \`pnpm exec aperture dev up --open\`: start the managed Aperture browser when browser-specific validation is needed.

## Agent Happy Path

Default to the Aperture MCP warm headless slot for iteration. This project is
not a normal browser-first web app: simulation/ECS is authoritative, and the
browser is primarily a render/input host.

1. Start MCP from the app root with \`pnpm exec aperture mcp stdio\` or use the
   configured \`aperture\` MCP server.
2. Start the simulation slot first:
   \`app_start({ target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" })\`.
3. Iterate with shared tools: \`ecs_step\`, \`ecs_find_entities\`,
   \`ecs_get_entity\`, \`resource_get\`, \`asset_list\`, \`input_inject\`,
   \`input_get_state\`, and \`camera_*\`.
4. Verify with state, not screenshots: assert on signals and entity
   transforms from status/\`ecs_get_entity\`, and use
   \`ecs_step({ digest: true })\` digests for "did anything change?" checks.
5. When a visual is needed, call \`frame_capture({ target: "headless", width, height, samples })\`.
   It exports a render bundle and renders it on demand; do not call separate
   browser screenshot/canvas-status/readback tools for the normal workflow.
6. Use \`app_start({ target: "headed" })\` / \`frame_capture({ target: "headed" })\`
   only for browser-specific behavior, DOM/page integration, exact live WebGPU
   canvas behavior, or final parity checks.
7. Prefer \`app_reset\` over browser reload mechanics. Use \`logs_read\` for
   recent diagnostics on either slot.

Keep \`aperture.config.ts\` and \`aperture.headless.config.ts\` in sync through
\`aperture.shared-config.ts\`; the headless config is what agents should boot by
default.

## Determinism Discipline

Determinism is what makes the headless loop trustworthy. Protect it:

- In systems, use \`this.random\` (fork sub-streams with
  \`this.random.fork("label")\`) and the \`time\`/\`delta\` parameters or
  \`this.time\` — never \`Math.random()\`, \`Date.now()\`, \`new Date()\`, or
  \`performance.now()\`.
- Run \`aperture headless <config> --determinism error\` to fail the run on
  violations; the diagnostic names the offending system and API.
- Same seed + same stepped inputs replay bit-identically across processes and
  across headless/headed. If a replay diverges, treat it as a bug, not noise.

## Exact Tool Payload Shapes

Several input tools silently accept-and-ignore unknown fields (they return
\`ok: true\` while doing nothing). Use these exact shapes, and after any
mutating call, read state back (\`input_get_state\`, \`ecs_get_entity\`)
instead of trusting \`ok\`:

- Axis actions: \`input_action_set({ action: "move", x: 1, y: 0 })\`.
- Buttons: \`input_action_set({ action: "jump", pressed: true })\` or
  \`input_inject({ actions: { jump: true } })\`.
- Gamepad stick: \`input_gamepad_set({ left: { x: 1, y: 0 } })\` — NOT
  \`{ stick: "left", x: 1 }\`, which no-ops silently.
- Pixel probes: \`frame_capture({ width: 960, height: 640, samples: [{ x: 0.5, y: 0.5, coordinateSpace: "normalized" }] })\`
  — sample entries must be objects; bare \`[x, y]\` pairs silently sample the
  frame center.
- The one-shot CLI \`aperture headless --inject <file>\` drives buttons and
  pointer only; drive axis actions through the serve/MCP tools above.
- \`input_key\` (raw keyboard) works only against the headed slot; headlessly,
  drive the action layer or the gamepad path instead.

## Known Headless/Headed Gaps

Know these before making pixel- or parity-equivalence claims:

- **Camera aspect:** headless has no auto-aspect; cameras default to a square
  projection and non-square renders stretch. Spawn cameras with an explicit
  \`camera: { aspect: <width/height> }\` matching your render size, or set
  \`aperture.render.camera.aspect\` via \`ecs_set_component_field\` before
  bundling.
- **Multi-view bundles:** offline rendering draws the lowest-priority view;
  the live browser presents the highest-priority camera. Verify agent-camera
  views (\`camera_create_agent\` + \`camera_use_agent_view\`) in the headed
  slot, and pass an explicit \`key\` to \`camera_use_agent_view\` — with no
  arguments it mutates the main camera.
- **Fixed-step tasks:** \`this.fixedStep.register(...)\` only runs when
  physics is enabled in the config; \`fixedStep.available === true\` does not
  mean the task is scheduled.
- **Session restore:** private system fields do not survive
  \`session_snapshot_save\`/restore unless the system implements
  \`snapshotState()\`/\`restoreState()\`. Restore is semantically exact but
  not digest-identical (entity generations bump).
- **Headed slot timing:** the browser free-runs from page load. You can
  \`ecs_pause\` and then fixed-step it deterministically, but you cannot pause
  before frame zero — use headless for anything that needs a controlled
  history from boot.
- **Signals:** readable from headless status; the headed slot does not expose
  them. Mirror gameplay facts into ECS components or diagnostics if the headed
  slot must report them.

## When The Headed Slot Is Mandatory

Boundary-layer behavior is invisible from inside headless — a wrong camera
aspect or view selection looks self-consistently fine in every headless
artifact. Run a headed parity pass per feature (not per iteration) and
whenever work touches: keyboard-binding resolution, canvas/DPR/resize
behavior, WebGPU adapter or device specifics, audio output, or DOM/UI
integration.

## MCP Tooling Rules

- Treat \`target\` as optional for the normal headless loop. After the headless
  slot is running, shared state/model/presentation tools default to headless.
- Pass \`target\` explicitly for lifecycle operations and parity checks:
  \`app_start({ target: "headless", ... })\`,
  \`app_start({ target: "headed", ... })\`,
  \`ecs_step({ target: "headed", ... })\`.
- Prefer these shared tools:
  \`app_status\`, \`app_start\`, \`app_stop\`, \`app_reset\`, \`ecs_step\`,
  \`ecs_find_entities\`, \`ecs_get_entity\`, \`ecs_snapshot\`, \`ecs_diff\`,
  \`asset_list\`, \`resource_get\`, \`resource_set\`, \`input_inject\`,
  \`input_get_state\`, \`input_reset\`, \`camera_*\`, \`frame_capture\`,
  \`session_snapshot_save\`, \`determinism_report\`, and \`logs_read\`.
- \`ecs_step\` batches frames on the headless slot
  (\`ecs_step({ frames: 30 })\`); the headed slot steps one frame per call
  with \`{ delta, time }\` — pass \`time: frame / 60\` explicitly when parity
  with headless time-driven behavior matters.
- Do not reach first for browser-mechanics tools such as browser screenshot,
  browser reload, canvas status, WebGPU wait, or readback samples. In normal
  workflows, \`frame_capture\`, \`app_reset\`, \`app_status\`, and \`logs_read\`
  are the replacements.
- \`logs_read\` deduplicates repeated identical diagnostics — do not infer
  event counts from log entries; count via signals or ECS state instead.
- If assets are unsupported in Node, start with \`assetMode: "hybrid"\` and
  inspect placeholder provenance in \`asset_list\` / \`frame_capture\` before
  making pixel-equivalence claims. Use \`assetMode: "strict"\` when real asset
  loading is required. Placeholder GLBs extract zero draws, so their absence
  from a render is silent — check \`asset_list\` first.
`,
)}`;
}

function claudeMd(): string {
  return `# Claude Instructions

${managedBlock(
  "html",
  `This is an Aperture app. Prefer ECS systems, components, typed assets, and
structured diagnostics. Keep browser/WebGPU-specific logic out of simulation
systems unless an Aperture API explicitly provides it.

## Mental Model

The headless (Node) runner and the browser worker are the same simulation:
given a fixed clock and the sanctioned \`this.random\`/\`this.time\` APIs,
both step bit-identically (verified down to byte-identical rendered frames).
Iterate headlessly because it returns machine-checkable state — signals,
entity transforms, digests, ECS diffs — instead of screenshots to interpret,
and it boots in under a second. Verify with equality checks on state; render
pixels only when a human-visible artifact is the point. The headed browser is
a per-feature verification checkpoint, not the iteration environment.

## Default Tooling Loop

Use the Aperture MCP server as the default inspection loop. This is a
simulation-first app, not a browser-first web page.

1. Start the warm headless slot:
   \`app_start({ target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" })\`.
2. Iterate with shared tools: \`ecs_step\` (\`{ frames: N, digest: true }\`),
   \`ecs_find_entities\`, \`ecs_get_entity\`, \`ecs_snapshot\`/\`ecs_diff\`,
   \`resource_get\`, \`asset_list\`, \`input_inject\`, \`input_get_state\`,
   and \`camera_*\`.
3. Assert on signals and transforms from status/entity reads; use step
   digests to prove "changed" or "unchanged".
4. Use \`frame_capture({ target: "headless", width, height, samples })\` when
   pixels are needed. It renders from a bundle on demand.
5. Use \`app_reset\` for rebuild/reset and \`logs_read\` for recent diagnostics.
6. Start the headed browser slot only for browser-specific behavior,
   DOM/page integration, pointer-lock/native browser input, exact live WebGPU
   canvas behavior, or final parity checks.

After the headless slot is running, shared state/model/presentation tools
default to headless, so repeated calls do not need \`target\`. Pass \`target\`
explicitly for lifecycle operations and parity comparisons.

Do not default to browser screenshot/reload/canvas-status/WebGPU-wait/readback
mechanics. Use \`frame_capture\`, \`app_reset\`, \`app_status\`, and
\`logs_read\` instead. Keep \`aperture.config.ts\` and
\`aperture.headless.config.ts\` in sync through \`aperture.shared-config.ts\`.

## Rules That Keep The Loop Trustworthy

- In systems, use \`this.random\` and the \`time\`/\`delta\` parameters —
  never \`Math.random()\`/\`Date.now()\`/\`performance.now()\`. Gate with
  \`aperture headless <config> --determinism error\`.
- After any mutating tool call, read state back instead of trusting
  \`ok: true\` — some input tools silently ignore unknown payload fields.
  Exact shapes: \`input_action_set({ action, x, y })\` for axes,
  \`input_gamepad_set({ left: { x, y } })\` for sticks, and
  \`frame_capture\` samples as \`[{ x, y, coordinateSpace }]\` objects.
- Give cameras an explicit \`camera: { aspect: <width/height> }\` at spawn:
  headless has no auto-aspect, and default (square) projections stretch
  non-square renders.
- \`this.fixedStep.register(...)\` only runs with physics enabled in config.
- Systems with private fields need \`snapshotState()\`/\`restoreState()\` to
  survive session snapshot restore.
- \`logs_read\` deduplicates repeated diagnostics — count events via signals
  or ECS state, not log entries.
- Boundary bugs (aspect, view selection, input bindings, DPR) are invisible
  from inside headless: run one headed parity pass per feature.
`,
)}`;
}

function claudeSettingsJson(): string {
  return `{
  "mcpServers": {
    "aperture": {
      "command": "pnpm",
      "args": ["exec", "aperture", "mcp", "stdio"]
    }
  }
}
`;
}

function cursorRule(): string {
  return `---
description: Aperture app architecture
alwaysApply: true
---

${managedBlock(
  "html",
  `Use Aperture's ECS-first API. Author runtime behavior as systems under
\`src/systems/**/*.system.ts\`. Rendering is derived from ECS components and
assets; do not add a renderer-owned scene graph.

For agent/tooling iteration, use the Aperture MCP warm headless slot first:
\`app_start({ target: "headless", config: "aperture.headless.config.ts" })\`,
then shared tools such as \`ecs_step\`, \`asset_list\`, \`input_inject\`,
\`camera_*\`, and \`frame_capture({ target: "headless" })\`. Use the headed
browser slot only when browser-specific behavior must be verified.
`,
)}`;
}

function copilotInstructions(): string {
  return `# Copilot Instructions

${managedBlock(
  "html",
  `This project is an Aperture app. Keep changes ECS-first:

- Add behavior in \`*.system.ts\` files.
- Use \`@aperture-engine/app/config\` for app config.
- Use \`@aperture-engine/app/systems\` for system authoring.
- Preserve the worker-friendly ECS/render boundary.
- Prefer the Aperture MCP warm headless workflow for agent iteration:
  start \`aperture.headless.config.ts\`, inspect/step/mutate with shared MCP
  tools, and use \`frame_capture\` only when pixels are needed. Use the headed
  browser path for browser-specific or final validation.
`,
)}`;
}

function codexConfigToml(): string {
  return managedBlock(
    "hash",
    `[mcp_servers.aperture]
command = "pnpm"
args = ["exec", "aperture", "mcp", "stdio"]
`,
  );
}

function mcpJson(): string {
  return `{
  "mcpServers": {
    "aperture": {
      "command": "pnpm",
      "args": ["exec", "aperture", "mcp", "stdio"]
    }
  }
}
`;
}

function managedBlock(style: ManagedBlockStyle, contents: string): string {
  return `${managedBlockStart(style)}
${contents.trim()}
${managedBlockEnd(style)}
`;
}

function managedBlockStart(style: ManagedBlockStyle): string {
  return style === "hash"
    ? `# aperture-managed:start ${MANAGED_BLOCK_ID}`
    : `<!-- aperture-managed:start ${MANAGED_BLOCK_ID} -->`;
}

function managedBlockEnd(style: ManagedBlockStyle): string {
  return style === "hash"
    ? `# aperture-managed:end ${MANAGED_BLOCK_ID}`
    : `<!-- aperture-managed:end ${MANAGED_BLOCK_ID} -->`;
}
