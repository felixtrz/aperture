# AGENTS.md

Guidance for human contributors and AI coding assistants working in the Aperture
repository. Read this before making changes.

## What Aperture Is

Aperture is a WebGPU-only, ECS-native 3D runtime where simulation is
authoritative and rendering is a derived view of simulation state. It is a pnpm
monorepo of focused TypeScript packages plus a documentation site, browser
examples, and showcase games.

The intended data flow is one direction:

```text
ECS World
-> Transform/System Resolution
-> Render Extraction
-> Render Snapshot
-> Render World
-> WebGPU Render Graph
-> GPU Submission
```

## Architectural Invariants

These are load-bearing. Do not violate them, and do not introduce code paths
that erode them.

- **ECS is the source of truth.** Gameplay and scene state live in the ECS
  world. Nothing else owns authoritative state.
- **Rendering is a derived view.** The renderer consumes data extracted from
  ECS and never mutates gameplay state. There is no central mutable
  `Object3D`/scene graph acting as the renderer's source of truth.
- **WebGPU is the only rendering backend.** There is no WebGL fallback in the
  core renderer.
- **Render extraction is a first-class boundary.** Simulation produces a
  `RenderSnapshot`; the render world is built from that snapshot. Keep this
  boundary explicit and serializable.
- **Worker-by-default.** The default browser shape runs simulation, ECS, and
  extraction on a worker thread that posts transferable `RenderSnapshot` typed
  arrays; the main thread owns the canvas, WebGPU, input, and UI, and consumes
  snapshots. Keep simulation portable to a worker.

If a change requires altering one of these invariants, update
`docs/DECISIONS.md` as part of the same change.

## Repository Layout

- `packages/math` — vector/matrix/quaternion math primitives.
- `packages/simulation` — ECS world, components, systems, asset registry.
- `packages/physics` — engine-agnostic physics interfaces and integration.
- `packages/physics-rapier` — Rapier-backed physics implementation.
- `packages/render` — render assets (meshes, materials) and extraction types.
- `packages/runtime` — authoring helpers, systems, and the worker/extraction app.
- `packages/webgpu` — WebGPU device, render graph, and GPU submission.
- `packages/audio` — audio subsystem.
- `packages/vite-plugin` — the Aperture Vite plugin for app builds.
- `packages/app` — `@aperture-engine/app`, the default application facade.
- `packages/cli` — `@aperture-engine/cli`, the `create` scaffolder and dev tooling.
- `docs-site/` — public documentation site (built by Cloudflare Pages from source).
- `docs/` — architecture, authoring, and decision documents.
- `examples/` — browser examples served from the built packages.
- `showcase/*` — showcase games and larger proof-point applications.

Each package keeps its concern. Do not reach across package boundaries or add
dependencies that point the wrong way down the data flow above; the boundary
checker enforces this.

## Build, Test, and Lint

Install dependencies first:

```sh
pnpm install
```

Run the full validation suite before committing changes:

```sh
pnpm run check
```

`pnpm run check` covers package boundary checks, release and publish-readiness
checks, TypeScript type checks (including tests), example harness checks,
docs-site build checks, the diagnostics catalog check, lint, formatting, and the
Vitest suite.

Individual steps:

```sh
pnpm run build        # tsc -b across all packages; output goes to dist/
pnpm test             # run the Vitest suite
pnpm run lint         # ESLint
pnpm run format:check # Prettier (use `pnpm run format` to apply fixes)
```

### Examples

```sh
pnpm run examples:build   # builds the packages the examples consume
pnpm run examples:serve   # serves examples + dist on http://127.0.0.1:4173/
```

The local server uses Node built-ins only. New user-facing examples should use
the app facade (`createWebGpuApp`), ECS-authored entities, typed assets,
systems, and the worker/main split.

### Docs Site

```sh
pnpm run docs:dev   # run the docs site locally
```

Do not commit generated docs-site output (`docs-site/dist`) or generated static
site files under `docs/` to `main`.

### Browser Verification

```sh
pnpm run test:e2e   # Playwright Chromium with WebGPU enabled
```

If Chromium cannot expose WebGPU on the current machine, the smoke test reports
the unsupported-WebGPU reason from Aperture's initialization helper.

## Contribution Conventions

- **Releases use Changesets.** Add a changeset (`pnpm run changeset`) for any
  user-facing or published-package change describing the affected packages and
  the bump.
- **Formatting and lint are enforced.** Code is formatted with Prettier and
  linted with ESLint. Run `pnpm run format` and `pnpm run lint` before pushing;
  `pnpm run check` will fail otherwise.
- **Commit messages are conventional-ish.** Use a concise, imperative,
  type-prefixed subject (e.g. `feat: …`, `fix: …`, `chore: …`, `docs: …`).
- **Respect package boundaries.** Keep each package focused on its concern and
  let dependencies flow with the architecture; the boundary checker is part of
  `pnpm run check`.
- **Tests live near implementation.** Add or update tests for changed behavior.
- **TypeScript-first with explicit types**, small modules, deterministic
  systems, data-driven schemas, and actionable error messages.

## Test Reliability Conventions

- **Relative-speed claims live in `*.bench.ts`**, which report timings without
  gating. The gating unit suite may keep absolute catastrophic-regression
  budgets (generous, like the 250ms extraction budget) but any relative
  wall-clock comparison must use a min-based estimator (min of several
  samples/attempts — immune to GC and scheduler excursions) **and** an
  additive allowance (e.g. `max(baseline * 1.3, baseline + 8ms)`) so timer
  noise on near-zero measurements cannot flip the comparison. Prove
  optimizations structurally (draw counts, cache counters, key identity);
  treat timing gates as backstops only.
- **Waits are deadlines, not estimates.** Polling helpers that wait on real
  async work must use generous caps (≥ 10s; they return as soon as the
  condition holds) — never a "should be fast" guess. Tests that boot real
  runners set an explicit vitest timeout (see `test/cli/reference.test.ts`)
  instead of riding the 5s default, which coverage instrumentation routinely
  blows through. Use the shared helpers in `test/helpers/` (`waitFor`,
  `waitForFile`, `readEventually`, `TestGeneratedWorkerPort`) instead of
  re-implementing per file — per-file copies drift and flake fixes miss them.
- **Every test file passes in isolation and in any order.** The vitest suite
  runs shuffled on every invocation (seed printed; reproduce with
  `--sequence.shuffle --sequence.seed=<seed>`). Never rely on a sibling test's
  side effects — elics component registration in particular lives on
  module-global singletons, so register the components your test needs
  yourself.
- **Tests never write inside the checkout.** Use `mkdtemp` under `os.tmpdir()`
  (or under the gitignored `tmp/` when the file must resolve imports through
  the repo's node_modules) and clean up in `afterEach`/`finally`. Committed
  fixtures are read-only inputs: copy-on-use before mutating. Product code
  that tests poll must write atomically (temp + rename).
- **No sleeps in e2e specs.** `page.waitForTimeout` is banned by
  `pnpm run check:e2e-hygiene`; use `waitForPresentedFrames`
  (test/e2e/webgpu-status.ts) before canvas screenshots, or `expect.poll` on
  the real condition. The same check rejects `waitForFunction(fn, { … })`
  (options belong in the third slot) and per-test timeouts below the 240s
  config default.
- **Fixed ports only for fakes that never bind.** Anything that actually
  listens allocates an ephemeral port (`listen(0)`) per run — a fixed port is
  a collision with the previous crashed run waiting to happen.

## Visual Quality Defaults

Read [`docs/VISUAL_QUALITY.md`](docs/VISUAL_QUALITY.md) before authoring
scenes, examples, templates, or anything else a user will look at. The short
version:

- Generated apps default to a **filmic, lit baseline**: ACES tonemapping
  through the HDR path (`exposure: 1`), 4x MSAA, capped device pixel ratio,
  and a **default daylight environment** (gradient sky + image-based
  lighting, plus a soft sun when the app authors no lights at all) that
  installs unless the app authors its own sky, skybox, or environment light —
  or sets `render.defaultEnvironment: false`.
- When building a scene: keep the default environment (it supplies the
  ambient/fill term and PBR reflections), add a **shadow-casting directional
  sun** with `castShadow`/`receiveShadow` on meshes, give shadows a ground
  receiver, and enable a **subtle bloom**. The `showcase/` configs and the
  `aperture create` templates are the reference recipes — copy them instead
  of inventing new baselines.
- `material.standard()` defaults to a **dielectric** (`metallic: 0`,
  `roughness: 1`); only set `metallic: 1` when the scene has image-based
  lighting. glTF imports keep the glTF spec default.
- `tonemap: "none"` (with no exposure/bloom) keeps the raw byte-identical
  8-bit path — use it for golden-image baselines and byte-exact render
  tests, not for user-facing scenes.
- Do not ship a user-facing example, template, or showcase that renders
  unlit geometry on a black background; that is the failure mode these
  defaults exist to prevent.

## Preferred Implementation Style

- Explicit types over inference at public API boundaries.
- Small, single-purpose modules.
- Minimal dependencies; justify any large addition.
- Clear, documented public APIs that are friendly to both humans and tools.
- Comments that explain architectural boundaries, not restate code.

## Hard Constraints

Do not:

- Create a hidden scene graph as the renderer's source of truth.
- Make a WebGL fallback part of the core renderer.
- Change the core architecture without updating `docs/DECISIONS.md`.
- Modify secrets or credentials.
- Add large dependencies without justification.
- Rewrite unrelated code or mix unrelated changes into one diff.
- Commit generated docs/site output to `main`.
