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
- \`pnpm exec aperture dev up --open\`: start the managed Aperture browser once AI tooling is available.
- \`pnpm exec aperture mcp stdio\`: expose Aperture tools over MCP once AI tooling is available.
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
