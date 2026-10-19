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
aperture headless <config>    # Run ECS/sim in pure Node, write a render bundle
aperture render <bundle>      # Render one PNG on demand from a render bundle
aperture camera project <job.json> # Project named world landmarks to pixels on CPU
aperture camera fit <job.json> # Fit explicit bounded camera parameters on CPU
aperture camera unproject <job.json> # Place named pixels on an explicit world plane
aperture camera inspect-local <headless-config> --request-resource <id> # Fresh CPU inspection from source-owned request
aperture tool <name>          # Call one aperture browser/ECS/render tool
aperture mcp stdio            # Expose aperture tools over MCP stdio
aperture adapter sync         # Sync AI coding-tool adapter files
aperture reference <command>  # Warm and query the aperture reference corpus

aperture --help               # Show all commands
aperture --version            # Show the CLI version
```

`aperture render` validates a bundle's referenced source-asset closure before
launching the browser renderer. Missing, unready, or placeholder assets fail by
default; use `--allow-placeholders` only when stubbed pixels are acceptable.
When `--width`/`--height` are omitted, render uses the bundle's recorded render
target. Use `--json` to print a machine-readable report with renderer
diagnostics: browser channel, WebGPU adapter metadata when the browser exposes
it, requested dimensions, actual PNG dimensions, and bundle digest.
`aperture headless` defaults to `--asset-mode placeholder`; use
`--asset-mode strict` for supported real local assets (GLB/glTF, WGSL, audio,
PNG/JPEG textures, RGBE HDR environment maps, plus Draco/meshopt/Basis-KTX2
GLBs when `--decoder-assets-dir` points at local decoder files) or
`--asset-mode hybrid` to load supported assets and record placeholders for the
rest. HTTP(S) asset reads stay disabled unless `--allow-http-assets` is passed.
Use `--determinism warn` or `--determinism error` to report app systems that
call nondeterministic globals during `init`, `update`, or `fixedUpdate`;
`error` mode fails one-shot runs so CI can enforce use of `context.random` and
`context.time`.

The monorepo gates this flow with `pnpm run check:headless-boundaries`,
`pnpm run check:render-bundles`, and `pnpm run check:pack-cli`. Use
`pnpm run check:pack-cli:render` when you also want to prove a packed install
can drive the browser render harness.

For composition at blockout, `aperture camera project` reports named landmark
pixels, signed residuals, depth and frustum validity without a browser.
`aperture camera fit` fits a camera to explicit world/pixel pairs while keeping
geometry fixed. Every camera parameter is explicitly fixed or bounded; the
report separates optimizer convergence from acceptable pixel error and checks
Float32 engine precision. `aperture camera unproject` intersects named pixel rays
with a caller-defined plane for perspective or orthographic cameras. It reports
world points, unit rays, clip/frustum flags and engine reprojection residuals;
offscreen pixels extrapolate, while invalid intersections return exit 2.
All three commands print JSON and accept atomic `--out report.json`.
`aperture camera inspect-local <headless-config> --request-resource <id>` boots
a CPU app, reads source-owned `values.request`, and performs fresh local geometry
inspection without stepping or editing the camera. Alternatively use
`--request <args.json>` with the exact tool arguments. It defaults to strict
assets and seed 0, prints the full tool envelope, and accepts atomic `--out`.
Handled failures return exit 2; bootstrap/I/O/cleanup errors return exit 1. See
[local inspection](../../docs/CAMERA_LOCAL_INSPECTION.md) for the shared-dimension
recipe, explicit viewport/seed, completeness checks and asset-readiness limits.
Start with `aperture camera --help` for the installed schema or the
[runnable camera landmark guide](../../docs/CAMERA_LANDMARKS.md) for examples,
metric definitions, and limitations. For automatic mesh-bounds framing in an
existing ECS session, use `camera_frame_entities` instead.

## Reference corpus

`aperture reference warmup` downloads the versioned
`@aperture-engine/reference-assets` payload from the package CDN by default and
then downloads the pinned local Transformers.js model files needed for query
embeddings. The payload ships precomputed embeddings and allowed source
snippets; model weights are kept out of the assets package.

For local corpus development inside the monorepo:

```sh
pnpm run reference-assets:build-payload
pnpm exec aperture reference warmup --from packages/reference-assets/dist
```

For unpublished/private payloads, set `APERTURE_REFERENCE_ASSETS_BASE_URL` to a
hosted `dist` directory containing `manifest.json` and `data.tgz`.

## Programmatic usage

```ts
import { createApertureProject, runApertureCli } from "@aperture-engine/cli";

// Scaffold a new project from a script.
const report = await createApertureProject({
  cwd: process.cwd(),
  name: "my-game",
  template: "minimal", // "minimal" | "glb-viewer" | "game" | "diorama"
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

For procedural low-poly authoring, `aperture create my-scene --template diorama` includes shared browser/Node scene setup, editable blockout masses, lit materials, planar reflections, and a compiled WGSL water library. See the generated `DIORAMA.md` and [agent visual workflow](../../docs/AGENT_VISUAL_WORKFLOW.md).
