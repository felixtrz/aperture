# @aperture-engine/cli

Project scaffolding and a managed dev CLI for [aperture](https://github.com/felixtrz/aperture) WebGPU games.

## Install

```sh
pnpm add @aperture-engine/cli
```

This package is part of the aperture engine and is normally used alongside the other
`@aperture-engine/*` packages. It also installs an `aperture` executable you can run with
`pnpm aperture <command>` or via `npx`.

## What it does

`@aperture-engine/cli` provides the `aperture` command-line tool for scaffolding new games,
running a managed AI-enabled dev browser session, calling individual browser/ECS/render tools,
exposing those tools over MCP (stdio), syncing AI coding-tool adapter files, and warming and
querying the aperture reference (RAG) corpus. Every command is also available programmatically
through the package's exported functions, so you can drive scaffolding and dev sessions from
your own scripts.

## CLI usage

```sh
aperture create <path>        # Scaffold an aperture app with AI tooling files
aperture dev <subcommand>     # Manage an AI-enabled dev browser session
aperture tool <name>          # Call one aperture browser/ECS/render tool
aperture mcp stdio            # Expose aperture tools over MCP stdio
aperture adapter sync         # Sync AI coding-tool adapter files
aperture reference <command>  # Warm and query the aperture reference corpus

aperture --help               # Show all commands
aperture --version            # Show the CLI version
```

## Programmatic usage

```ts
import { createApertureProject, runApertureCli } from "@aperture-engine/cli";

// Scaffold a new project from a script.
const report = await createApertureProject({
  cwd: process.cwd(),
  name: "my-game",
  template: "minimal", // "minimal" | "glb-viewer" | "game"
});
console.log(`Created ${report.packageName} at ${report.targetDir}`);

// Or run the CLI in-process.
const exitCode = await runApertureCli({
  argv: ["create", "my-game"],
  cwd: process.cwd(),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
```

Other exported helpers include `syncApertureAdapters`, the dev-session API
(`startApertureDevSession`, `stopApertureDevSession`, `readApertureDevStatus`, …),
`callApertureTool`, `runApertureMcpServer`, and the reference helpers
(`searchApertureReferences`, `ensureApertureReferenceIndex`, `warmApertureReferences`, …).

## Entry points

| Subpath                | Description                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `@aperture-engine/cli` | The full programmatic API (scaffolding, dev sessions, tool calls, MCP, reference). |

---

Part of the [aperture](https://github.com/felixtrz/aperture) monorepo. MIT licensed.
