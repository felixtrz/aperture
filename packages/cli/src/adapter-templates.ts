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

## Useful Commands

- \`pnpm run dev\`: start the Vite app.
- \`pnpm run typecheck\`: type-check the app.
- \`pnpm run build\`: build the app.
- \`pnpm exec aperture codegen\`: regenerate \`.aperture/generated\` typed
  action/signal maps without a vite build (headless-first loop).
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
4. When a visual is needed, call \`frame_capture({ target: "headless", width, height, samples })\`.
   It exports a render bundle and renders it on demand; do not call separate
   browser screenshot/canvas-status/readback tools for the normal workflow.
5. Use \`app_start({ target: "headed" })\` / \`frame_capture({ target: "headed" })\`
   only for browser-specific behavior, DOM/page integration, exact live WebGPU
   canvas behavior, or final parity checks.
6. Prefer \`app_reset\` over browser reload mechanics. Use \`logs_read\` for
   recent diagnostics on either slot.

Keep \`aperture.config.ts\` and \`aperture.headless.config.ts\` in sync through
\`aperture.shared-config.ts\`; the headless config is what agents should boot by
default.

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
  and \`logs_read\`.
- Do not reach first for browser-mechanics tools such as browser screenshot,
  browser reload, canvas status, WebGPU wait, or readback samples. In normal
  workflows, \`frame_capture\`, \`app_reset\`, \`app_status\`, and \`logs_read\`
  are the replacements.
- For visual checks, request samples with \`frame_capture\`, for example:
  \`frame_capture({ width: 960, height: 640, samples: [{ x: 0.5, y: 0.5, coordinateSpace: "normalized" }] })\`.
- Use the headed slot only when validating browser-specific behavior, DOM/page
  integration, pointer-lock/native browser input, exact live WebGPU canvas
  behavior, or a final visual/parity pass.
- If assets are unsupported in Node, start with \`assetMode: "hybrid"\` and
  inspect placeholder provenance in \`asset_list\` / \`frame_capture\` before
  making pixel-equivalence claims. Use \`assetMode: "strict"\` when real asset
  loading is required.
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

## Default Tooling Loop

Use the Aperture MCP server as the default inspection loop. This is a
simulation-first app, not a browser-first web page.

1. Start the warm headless slot:
   \`app_start({ target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" })\`.
2. Iterate with shared tools: \`ecs_step\`, \`ecs_find_entities\`,
   \`ecs_get_entity\`, \`resource_get\`, \`asset_list\`, \`input_inject\`,
   \`input_get_state\`, and \`camera_*\`.
3. Use \`frame_capture({ target: "headless", width, height, samples })\` when
   pixels are needed. It renders from a bundle on demand.
4. Use \`app_reset\` for rebuild/reset and \`logs_read\` for recent diagnostics.
5. Start the headed browser slot only for browser-specific behavior,
   DOM/page integration, pointer-lock/native browser input, exact live WebGPU
   canvas behavior, or final parity checks.

After the headless slot is running, shared state/model/presentation tools
default to headless, so repeated calls do not need \`target\`. Pass \`target\`
explicitly for lifecycle operations and parity comparisons.

Do not default to browser screenshot/reload/canvas-status/WebGPU-wait/readback
mechanics. Use \`frame_capture\`, \`app_reset\`, \`app_status\`, and
\`logs_read\` instead. Keep \`aperture.config.ts\` and
\`aperture.headless.config.ts\` in sync through \`aperture.shared-config.ts\`.
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
