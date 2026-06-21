# Docs Site Plan

Status: implemented baseline
Last updated: 2026-06-19

Implementation note: the root-level `docs-site/` package now owns the public
site source. The guarded Pages publisher is implemented and dry-run checked,
including static builds for the four showcase apps under `/showcase/<id>/`, but
the destructive cutover copy to `docs/` remains an explicit
`pnpm run docs:publish` action.

## Purpose

Build a public Aperture docs site that is more than the current project-status
dashboard:

- Keep the current Hero City front page experience intact.
- Move the Hero City source out of `showcase/hero-city` and make it the
  root-level docs-site app source.
- Add a Showcases section that links to the four actual showcase apps.
- Add an Examples section that exposes the runnable example harness as a public
  learning gallery.
- Add actual human-facing documentation and generated API reference pages.
- Use the local Lumin design system for docs, showcase index, example index,
  and supporting product pages without redesigning the front page.

This is the concrete implementation plan for the roadmap item tracked as
AI-80 / SOTA M11-T5.

## Non-Goals

- Do not redesign the current front page, Hero City scene, card behavior, or
  mobile treatment.
- Do not turn Hero City back into a showcase entry. It becomes the site home.
- Do not rewrite all examples before making the gallery useful.
- Do not replace the engine architecture or introduce scene-graph concepts.
- Do not make the current `docs/index.html` status dashboard disappear without
  giving it a stable replacement route.

## Current State

- `showcase/hero-city` is acting like the public front page, but it lives under
  the showcase directory.
- The real showcase apps are:
  - `showcase/city-builder`
  - `showcase/fps`
  - `showcase/platformer`
  - `showcase/racing`
- `examples/` contains many runnable engine examples and an internal
  `examples/index.html`, but that index is not a polished public gallery.
- `docs/index.html` is the static project dashboard used by GitHub Pages.
- `docs/` also contains internal architecture, roadmap, and planning Markdown.
- The local Lumin package exists at `../lumin` with package name `lumin` and
  exports:
  - `lumin`
  - `lumin/styles.css`
  - `lumin/fonts.css`
  - `lumin/tokens.css`
  - `lumin/global.css`

## Reference Anchors

- `references/three.js/docs/index.html`
- `references/three.js/manual/index.html`
- `references/three.js/examples/index.html`
- `references/engine/examples`
- `docs/ACTIONABLE_ROADMAP.md` AI-80
- `docs/SOTA_ROADMAP.md` M11-T5
- `../lumin/README.md`
- `../lumin/CONVENTIONS.md`

The three.js reference is useful because it separates docs/manual/API/examples
while keeping examples runnable. The PlayCanvas reference is useful for a
product-oriented engine docs/examples shape. Lumin is the visual system for the
new docs surfaces.

## Framework Choice

Use Astro with React islands.

Reasons:

- The docs site should be mostly static and GitHub Pages friendly.
- Markdown/MDX docs and content collections are first-class in Astro.
- React islands let us use Lumin's React components where interactivity matters.
- The existing Hero City front page can remain a focused client-side Aperture
  experience instead of being rewritten into a React app.
- This avoids Next.js-style server/runtime assumptions that do not help this
  static docs target.

## Proposed Source Layout

Create a root-level `docs-site/` package:

```text
docs-site/
  package.json
  astro.config.mjs
  tsconfig.json
  src/
    pages/
      index.astro
      docs/
      examples/
      showcases/
      api/
      status.astro
    components/
      front-page/
      docs-shell/
      examples/
      showcases/
    content/
      docs/
      examples/
      showcases/
    styles/
      front-page.css
      docs-overrides.css
  scripts/
    generate-example-manifest.mjs
    generate-showcase-manifest.mjs
    check-docs-site.mjs
```

Migration target:

```text
showcase/hero-city/ -> docs-site/
```

The front page source should move, but the user-facing front page should remain
visually equivalent unless a future task explicitly requests design changes.

## Lumin Integration

Add Lumin as a docs-site dependency:

```json
{
  "dependencies": {
    "lumin": "file:../lumin"
  }
}
```

Use Lumin for:

- Docs typography and layout primitives.
- Buttons, badges, tabs, cards, inputs, and filters.
- Code-copy controls and CLI command blocks.
- Showcases and examples index cards.
- Callouts, checkpoints, status labels, and structured content sections.

Keep Lumin out of the preserved front page route unless a specific component is
needed and can be adopted without changing the current look. Prefer route-level
or layout-level CSS imports:

```ts
import "lumin/styles.css";
import "lumin/fonts.css";
```

Avoid `lumin/global.css` on the home route if its reset changes the existing
front page.

## Site Information Architecture

### Home

Route: `/`

Source: migrated Hero City front page.

Requirements:

- Preserve the current front page design and interaction model.
- Keep the Hero City scene and scroll-driven story behavior intact.
- Keep the mobile layout decisions already tuned.
- Add links into Docs, Examples, Showcases, GitHub, and install/scaffold flows
  only where they fit the current design.

### Docs

Route: `/docs/`

Initial docs sections:

- Getting Started
  - Install and scaffold.
  - `npx @aperture-engine/cli` command.
  - Project structure.
  - Running locally.
- Core Concepts
  - ECS is authoritative.
  - Rendering is a derived snapshot.
  - Systems and resources.
  - Worker/main-thread boundary.
- Authoring
  - Entities and components.
  - Transforms and hierarchy.
  - Meshes and materials.
  - Cameras.
  - Lights, shadows, and environment.
  - GLB assets.
- Runtime
  - `aperture.config.ts`.
  - Generated Vite app path.
  - Fixed-step logic.
  - Input and picking.
  - Physics basics.
- Rendering
  - StandardMaterial.
  - IBL and HDR.
  - Post effects.
  - Render targets.
  - Performance knobs.
- Agent Tooling
  - MCP inspection.
  - Structured diagnostics.
  - Pause, step, snapshot, diff workflows.
- Deployment
  - Static build.
  - GitHub Pages.
  - Asset paths and base URLs.

Docs should be written for external users first. Internal roadmap and agent
handoff docs can be linked from a status/archive area, but should not be the
main docs narrative.

### Showcases

Route: `/showcases/`

Showcase entries:

- City Builder: `showcase/city-builder`
- FPS: `showcase/fps`
- Platformer: `showcase/platformer`
- Racing: `showcase/racing`

Hero City is not listed as a showcase after migration; it is the site home.

Each showcase card should include:

- Name.
- Short description.
- Capabilities demonstrated.
- Run/open action.
- Source link.
- Build/deploy status if available.

The manifest should be checked in or generated from a small typed source file,
not inferred from arbitrary directory names at render time.

### Examples

Route: `/examples/`

Turn the current `examples/*.html` harness into a public gallery.

Requirements:

- Generate a manifest from the current example set.
- Categorize examples by capability:
  - Basics
  - Materials
  - Lighting and shadows
  - Assets and GLB
  - Cameras and render targets
  - Post processing
  - Particles and UI
  - Physics
  - Interaction
  - Diagnostics and performance
- Keep examples runnable, not screenshots.
- Link to source files.
- Surface WebGPU/browser requirements clearly.
- Add a check that fails when an `examples/*.html` page is missing from the
  gallery manifest.

The public gallery should reuse or extend `scripts/check-example-gallery.mjs`
instead of inventing a separate untested listing path.

### API Reference

Route: `/api/`

Generate API reference from the typed public package surface.

Candidate tooling:

- TypeDoc for a fast first pass.
- API Extractor if package boundary reports and stable API review files become
  important.

The API reference should cover the public entry points of:

- `@aperture-engine/app`
- `@aperture-engine/simulation`
- `@aperture-engine/render`
- `@aperture-engine/webgpu`
- `@aperture-engine/runtime`
- `@aperture-engine/physics`
- `@aperture-engine/vite-plugin`

The docs-site check should assert that generated output exists for each public
package and that key public symbols are discoverable.

### Status / Archive

Route: `/status/`

Preserve the current project dashboard currently served from `docs/index.html`.
On cutover, either:

- Move the dashboard to `docs/status/index.html`, or
- Rebuild it as a static docs-site page while keeping equivalent content.

Do not silently remove the status dashboard; it is still useful for project
orientation.

## Deployment Model

Use a staged deployment model.

Phase 1 output:

- `docs-site/dist/`
- No GitHub Pages cutover.
- Validate the site independently.

Phase 2 output:

- Publish the docs site into the Pages-served `docs/` tree with a controlled
  copy script.
- Do not use an unguarded `--emptyOutDir ../../docs` because `docs/` contains
  important tracked Markdown and dashboard files.
- Preserve or redirect old `/hero-city/` URLs after Hero City becomes `/`.
- Preserve the project dashboard at `/status/`.

The publish script should be explicit about what it removes and what it copies.

## Package And Script Changes

Expected workspace changes:

- Add `docs-site` to `pnpm-workspace.yaml`.
- Add root scripts:
  - `docs:dev`
  - `docs:build`
  - `docs:api`
  - `check:docs`
- Keep existing `check:progress` unless/until the status dashboard is migrated.
- Add a docs-site package with Astro, React, Lumin, and API-doc tooling.

The first implementation should avoid large unrelated dependency churn. Astro,
React, and TypeDoc are justified by the docs-site role; anything else should be
added only when the feature needs it.

## Implementation Phases

### Phase 1 - Source Move And Preserved Home

Move `showcase/hero-city` to `docs-site` and make it build as the docs-site
home page.

Acceptance criteria:

- `pnpm --dir docs-site run build` succeeds.
- The homepage looks equivalent to the current front page at desktop and mobile
  sizes.
- The current Hero City runtime behavior still works.
- The four real showcases remain under `showcase/`.
- Existing staged Hero City/runtime changes are not mixed with unrelated docs
  implementation commits unless intentionally committed together.

### Phase 2 - Docs Shell With Lumin

Add the docs layout, navigation, and first content pages using Lumin.

Acceptance criteria:

- `/docs/` renders a usable docs shell.
- Lumin styles are visible on docs pages.
- The home page remains visually unchanged.
- Mobile navigation is usable.
- Docs content is authored as MDX or typed content collections.

### Phase 3 - Showcases Section

Add `/showcases/` with a typed manifest for the four real showcase apps.

Acceptance criteria:

- All four showcase apps are listed.
- Hero City is not listed as a showcase.
- Cards include descriptions, capabilities, launch links, and source links.
- The manifest is typed and checked.

### Phase 4 - Examples Gallery

Add `/examples/` backed by a generated or checked manifest.

Acceptance criteria:

- Every `examples/*.html` page appears in the manifest or has an explicit
  exclusion reason.
- A check fails when a runnable example is missing.
- Examples remain runnable from the hosted site or from a documented local
  dev-server path.
- Each example has category, title, source links, and WebGPU requirement copy.

### Phase 5 - API Reference

Generate typed API docs and integrate them under `/api/`.

Acceptance criteria:

- `pnpm run docs:api` emits reference output for each public package.
- `pnpm run check:docs` asserts expected package pages and key public symbols.
- API pages link back to conceptual docs.

### Phase 6 - Pages Cutover

Publish the new docs site to GitHub Pages.

Acceptance criteria:

- The site serves at the repository Pages root.
- The current front page appears at `/`.
- The old Hero City Pages path redirects or remains usable.
- The status dashboard remains reachable at `/status/`.
- Examples and showcases links work after base-path deployment.

## Validation Plan

Run validation appropriate to each phase:

- `pnpm --dir docs-site run typecheck`
- `pnpm --dir docs-site run build`
- `pnpm run docs:api`
- `pnpm run check:docs`
- `pnpm run check:progress` while the old dashboard remains active.
- Targeted Playwright checks for:
  - Home desktop.
  - Home mobile.
  - Docs navigation.
  - Showcases index.
  - Examples index.
  - A runnable example launch.
- Visual screenshot checks before and after the Hero City move to prove the home
  page did not drift.

## Risks And Mitigations

- Risk: Lumin global CSS changes the tuned home page.
  - Mitigation: import Lumin CSS only in docs/showcase/example layouts at first.
- Risk: Building into `docs/` deletes internal Markdown or status files.
  - Mitigation: use `docs-site/dist` first and a guarded publish script later.
- Risk: Examples rely on local dev-server transforms and break as static files.
  - Mitigation: make static hosting support explicit and test one representative
    example before declaring the gallery hosted.
- Risk: The docs site becomes a second source of truth for API behavior.
  - Mitigation: generate API reference from package exports and keep conceptual
    docs short, linked, and version-aware.
- Risk: The migration mixes with current Hero City/runtime performance changes.
  - Mitigation: commit or isolate the current coherent work before starting the
    larger docs-site move.

## Recommended First Slice

Start with a minimal, reviewable slice:

1. Create `docs-site/` as an Astro package.
2. Move the Hero City front page source into `docs-site/` without redesigning
   it.
3. Add Lumin as a dependency but use it only on a placeholder `/docs/` page.
4. Add root scripts for `docs:dev` and `docs:build`.
5. Validate with desktop and mobile screenshots against the current front page.

Do not build the examples gallery, API reference, and Pages cutover in the same
first slice.
