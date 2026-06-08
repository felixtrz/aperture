# Aperture RAG Reference Plan

Status: plan

## Summary

Aperture should replace the current lexical reference index with a full
retrieval-augmented generation reference system modeled on the IWSDK reference
tooling. The goal is not to ingest the entire repository. The corpus should
represent the developer-facing Aperture surface: public APIs, app authoring
patterns, scaffold templates, examples, diagnostics, and selected dependency
types that app authors or agents need to build Aperture apps.

The reference tools should stay owned by `@aperture-engine/cli`, so users keep
one command surface:

```sh
aperture reference warmup
aperture reference status
aperture reference search createSystem
aperture mcp stdio
```

The implementation may use a producer package for versioned reference assets,
but it should not introduce a second user-facing CLI package.

## IWSDK Reference Findings

IWSDK already has a real RAG reference implementation split across two
packages:

- `@iwsdk/reference-assets`: offline producer pipeline and versioned corpus
  payloads.
- `@iwsdk/reference`: runtime consumer, CLI, MCP tools, warmup, cache
  validation, and semantic search.

The important patterns to copy are architectural, not package names.

### Files Inspected

The IWSDK implementation worth using as the concrete reference is:

- `immersive-web-sdk/packages/reference-assets/README.md`
- `immersive-web-sdk/packages/reference-assets/package.json`
- `immersive-web-sdk/packages/reference-assets/tools/ingest.ts`
- `immersive-web-sdk/packages/reference-assets/tools/ingestion/parser.ts`
- `immersive-web-sdk/packages/reference-assets/tools/ingestion/chunker.ts`
- `immersive-web-sdk/packages/reference-assets/tools/generate-embeddings.ts`
- `immersive-web-sdk/packages/reference-assets/scripts/build-payload.mjs`
- `immersive-web-sdk/packages/reference-assets/scripts/build-model.mjs`
- `immersive-web-sdk/packages/reference/src/assets.ts`
- `immersive-web-sdk/packages/reference/src/embeddings.ts`
- `immersive-web-sdk/packages/reference/src/search.ts`
- `immersive-web-sdk/packages/reference/src/contract.ts`
- `immersive-web-sdk/packages/reference/src/query-handlers.ts`
- `immersive-web-sdk/packages/reference/src/files.ts`
- `immersive-web-sdk/packages/reference/src/cli.ts`

The useful separation is clear:

- producer-only code owns parsing, chunking, embedding, source copying, model
  packaging, tarball creation, and manifest generation.
- runtime code owns warmup, cache validation, query embedding, vector search,
  file reads from warmed sources, MCP contracts, and CLI rendering.
- operation contracts are shared between CLI and MCP so the same behavior is
  exposed through both surfaces.

### Producer Package

`packages/reference-assets` owns corpus creation:

- Uses `ts-morph` to parse TypeScript and emit semantic chunks.
- Chunks by API-shaped constructs instead of arbitrary text windows:
  classes, functions, interfaces, type aliases, enums, variables, and ECS
  factory patterns.
- Captures metadata such as source, file path, chunk type, symbol name, line
  range, class context, imports, calls, inheritance, implemented interfaces,
  WebXR usage, ECS component markers, and ECS system markers.
- Embeds chunk text with `@huggingface/transformers`.
- Copies source files into `data/sources`.
- Emits `data/embeddings.json`.
- Builds a deterministic `data.tgz` and `manifest.json` with hashes and model
  metadata.
- Publishes only the generated warmup payload and docs, while keeping the
  ingestion implementation producer-side.
- Uses package scripts for separate ingestion, payload building, model
  packaging, and optional "if ready" publishing paths.

### Runtime Package

`packages/reference` owns consumption:

- Provides the `iwsdk-reference` CLI and MCP server.
- Exposes shared operation contracts so CLI and MCP stay in parity.
- Has a `warmup` flow that downloads the corpus payload and pinned model.
- Stores state under a project-local runtime directory and a shared user cache.
- Validates manifests, hashes, model metadata, and payload integrity.
- Repairs corrupted caches.
- Loads embeddings from the warmed corpus.
- Embeds user queries locally with a pinned model.
- Computes cosine similarity over chunk embeddings.
- Supports exact relationship tools from metadata, not vector search alone.
- Reads file content from warmed `data/sources`, not from an arbitrary local
  repository checkout.
- Uses `@huggingface/transformers` at runtime against the warmed local model
  directory and refuses remote model loading.
- Defines one operation registry for semantic search, relationship search, API
  lookup, warmed file content, component listing, system listing, dependents,
  and usage examples.
- Applies deterministic post-search prioritization so public package/core
  results win over less relevant examples or support packages when names tie.

### Model And Corpus Contract

IWSDK pins an embedding model contract:

- model id and revision
- tokenizer/config files
- quantized ONNX model file
- dtype
- pooling
- normalization behavior
- embedding dimensions

That contract matters because it makes the corpus reproducible and prevents
silent query/corpus embedding mismatches.

### What Aperture Should Change From IWSDK

IWSDK indexes broad SDK and selected dependency sources. Aperture needs a
stricter corpus policy because much of the engine is internal WebGPU/render
implementation detail. Indexing every package source file would make the AI
tools overfit to implementation internals and encourage app code to depend on
private APIs.

The key Aperture difference: the corpus is an authoring reference, not an
engine implementation reference. If a file is not something an app author, AI
coding agent, generated adapter, diagnostic tool, or scaffolded example should
know about, it should stay out of the default corpus.

## Current Aperture Reference State

Aperture now uses `packages/cli/src/reference.ts` as the runtime and local
producer implementation for the first RAG-backed reference slice.

Current behavior:

- Warms a project-local corpus in `.aperture/runtime/reference`.
- Emits `data/embeddings.json`, copied allowed source files under
  `data/sources`, `model/model-contract.json`, `manifest.json`, `data.tgz`, and
  `state.json`.
- Uses a curated allowlist rather than scanning the whole repository.
- Uses TypeScript AST chunks, markdown heading chunks, example/template chunks,
  diagnostic chunks, selected EliCS dependency files, and deterministic local
  embeddings.
- Validates manifest hashes and model metadata through
  `aperture reference status`.
- Powers CLI and MCP reference tools without requiring a running dev session.

The current embedding model is a deterministic local hash-embedding contract.
It proves the RAG ingestion, payload, validation, search, and MCP integration
path without introducing hosted model distribution yet. A later slice can swap
the model contract to a hosted ONNX embedding model if higher semantic quality
is needed.

This state is enough to validate the shape of the toolchain, but it should be
treated as a bootstrap implementation. The production-quality path should split
producer and runtime concerns and replace the hash embedding contract with a
pinned semantic embedding model.

### Current Gaps Versus IWSDK

- Corpus production is still embedded in the CLI instead of a producer artifact
  package.
- The embedding implementation is deterministic but lexical/hash based, not a
  learned semantic model.
- The allowlist exists in code but is not yet documented as a first-class corpus
  policy artifact with fixtures.
- The warmup path can build from the local workspace, but hosted asset versioning
  is not yet the default operational path.
- Relationship tools exist by metadata shape, but the metadata should be
  strengthened for Aperture-specific concepts such as generated systems,
  `aperture.config.ts`, diagnostics, assets, render authoring, and MCP tools.
- The model and payload contract should be promoted to an explicit public
  compatibility boundary for reference assets.

## Corpus Policy

The Aperture RAG corpus should be allowlist-driven. The default answer to
"should this be indexed?" is no unless the file, export, or documentation page
touches the developer-facing API.

### Include

Public app-author APIs:

- Package entrypoints and subpath exports from app-facing packages.
- `@aperture-engine/app/config`.
- `@aperture-engine/app/systems`.
- `@aperture-engine/runtime` headless app facades that are still public.
- `@aperture-engine/simulation` public ECS, asset, transform, math, and
  diagnostic APIs.
- `@aperture-engine/render` public render authoring components, asset
  contracts, snapshot types, and diagnostics.
- `@aperture-engine/webgpu` public app facade and documented lower-level
  surfaces.
- `@aperture-engine/vite-plugin` public plugin function, options, generated
  module contracts, and diagnostics.
- `@aperture-engine/cli` public commands, MCP tool schemas, and adapter sync
  contracts.

Public package indexing should start from `package.json` export maps and then
walk only the files needed to describe those exports. A package source prefix is
not, by itself, enough reason to index every helper file under that prefix.

App authoring contracts:

- `aperture.config.ts` schema and examples.
- system discovery and `.system.ts` conventions.
- `createSystem` options, query configuration, config signals, and system
  priority rules.
- component creation and schema APIs.
- assets, mesh/material handles, cameras, lights, transforms, input, and
  diagnostics that app authors import directly.

Docs and examples:

- README and public getting-started docs.
- `docs/AI_TOOLING.md` and AI-facing app-author docs.
- `docs/AUTHORING.md`.
- focused concept docs that explain public APIs or user-observable behavior.
- examples that demonstrate current public APIs.
- scaffold templates and generated app adapter files.

Examples should be indexed as app-author recipes, not as every incidental file
under an examples directory. The chunk metadata should describe the scenario,
the public APIs demonstrated, and whether the example still matches the current
scaffold.

Diagnostics:

- diagnostic codes emitted to app authors.
- diagnostic messages and suggested fixes.
- WebGPU/browser startup diagnostics that generated apps or CLI users can see.
- render/extraction diagnostics surfaced through CLI or MCP tools.

Selected dependency references:

- EliCS public types and docs needed to explain Aperture system/component
  behavior.
- `wgpu-matrix` public types only where Aperture exposes tuple/array math
  expectations to users.
- WebGPU type references only where diagnostics or public WebGPU facade options
  require them.

### Exclude

Implementation internals:

- private WebGPU renderer implementation files.
- shader internals unless documented as public custom material authoring
  surface.
- render pipeline caches, bind group internals, queue internals, and command
  encoders unless directly documented as diagnostics.
- tests by default.
- `agent/` planning and handoff files.
- `references/` bulk checkouts.
- build output, generated output, cache directories, `dist`, and
  `node_modules`.
- internal helper modules that are not exported from package entrypoints.
- examples or fixtures that use private test-only APIs.
- local generated runtime/cache files such as `.aperture/`.
- generated browser/worker virtual module output unless represented through
  documented contracts or template sources.

### Borderline Rule

When a file contains both public and private code, ingest only the exported
public declarations and their local TSDoc, not the entire file. If a private
helper is necessary to understand a public API, summarize the behavior through
metadata or docs instead of exposing the helper as a searchable chunk.

When there is no clear public reason to expose a file, exclude it and add a doc
or template chunk that explains the public behavior instead.

## Proposed Architecture

```text
@aperture-engine/reference-assets (producer artifact)
  -> corpus policy + machine-readable allowlist
  -> package export discovery
  -> TypeScript/doc/example/template/diagnostic parsers
  -> semantic chunks + relationship metadata
  -> pinned model embedding generation
  -> copied allowed data/sources
  -> data/embeddings.json
  -> data.tgz + manifest.json + model contract

@aperture-engine/cli (runtime consumer)
  -> aperture reference warmup/status/search
  -> shared cache + project state
  -> warmed corpus/model validation
  -> semantic SearchService + metadata indexes
  -> MCP reference tools
```

### Package Shape

Use one user-facing CLI package:

- `@aperture-engine/cli` owns commands, MCP tools, warmup, status, search, and
  file reads.

Add one producer package only if needed:

- `@aperture-engine/reference-assets` can own corpus generation and published
  asset payloads.
- It should not expose a user-facing binary.
- It can stay a workspace/publish artifact analogous to IWSDK's
  `@iwsdk/reference-assets`.

This keeps `npx @aperture-engine/cli create` and `aperture reference ...` as
the only user-facing command story while still separating heavy offline corpus
production from runtime search.

### Runtime Cache

Use Aperture-specific cache locations:

- project state: `.aperture/runtime/reference`
- shared cache on macOS: `~/Library/Caches/aperture/reference`
- shared cache on Linux: `$XDG_CACHE_HOME/aperture/reference` or
  `~/.cache/aperture/reference`
- shared cache on Windows: local app data under `aperture/reference`

The project state should record:

- corpus version
- manifest schema version
- model contract version
- resolved asset source URL
- warmed data directory
- warmed model directory
- validation status
- last warmup and last validation timestamps

### Model Contract

Pin a model contract with:

- provider and model id
- exact revision
- expected files
- expected hashes and sizes
- dtype
- pooling
- normalization
- embedding dimensions
- query text formatting version

The CLI must refuse to query if corpus embeddings and query model metadata do
not match.

The likely first semantic model should follow IWSDK's shape:

- transformers.js feature-extraction pipeline
- local-only model loading after warmup
- mean pooling
- normalized output vectors
- quantized ONNX model artifact
- model files listed with exact hashes and sizes

The exact model can be chosen in implementation, but it must be pinned by
revision and must be treated as part of the corpus compatibility contract.

## Chunk Schema

Each chunk should include:

- stable chunk id
- source category: `api`, `docs`, `example`, `template`, `diagnostic`,
  `external`
- package name when applicable
- public entrypoint or subpath when applicable
- file path
- start and end line
- chunk type: `class`, `function`, `interface`, `type`, `enum`, `component`,
  `system`, `config`, `diagnostic`, `example`, `doc-section`, `template`
- symbol name
- exported name
- TSDoc or markdown heading context
- class/function context
- imports
- exports
- calls
- extends and implements
- uses types
- ECS component id when applicable
- ECS system name and priority when applicable
- diagnostic code when applicable
- example route or scaffold scenario when applicable
- semantic labels
- text used for embedding
- original content
- embedding

The embedding text should combine metadata and content, for example:

```text
# function: createSystem
source: api
package: @aperture-engine/app
entrypoint: @aperture-engine/app/systems
labels: ecs, system, priority, config, query
uses: EcsType, createComponent

<public declaration, TSDoc, and minimal relevant body or docs>
```

## Search And Tool Behavior

Semantic search should be hybrid, not vector-only.

Ranking should combine:

- cosine similarity over embeddings
- exact symbol/package/diagnostic matches
- source category boosts based on tool intent
- recency or current-public-api boosts for examples/templates
- metadata relationship matches for exact graph queries
- export-map priority so public entrypoints rank above internal source
  locations.
- scaffold-template priority when the query asks how to build or start an app.

Tool behavior:

- `reference_search`: semantic search across allowed chunks.
- `reference_api_lookup`: exact exported symbol/subpath lookup first, semantic
  fallback second.
- `reference_file_content`: reads warmed allowed sources and supports optional
  line ranges.
- `reference_find_examples`: searches example/template chunks and boosts
  scaffold-compatible usage.
- `reference_list_components`: uses component metadata, not text search.
- `reference_list_systems`: uses system metadata, including default and
  declared priority when known.
- `reference_find_dependents`: uses import/call/type metadata.
- `reference_explain_diagnostic`: exact diagnostic code lookup first, semantic
  fallback for message text.

Reference MCP tools should continue to work without a running Aperture dev
session.

The file-content tool must only read warmed allowed sources. It must not become
a general filesystem read primitive over the local checkout.

## Implementation Plan

### Phase 1: Corpus Policy And Manifest

Add a documented corpus policy and machine-readable allowlist.

Deliverables:

- `docs/RAG_REFERENCE_CORPUS.md` or equivalent.
- allowlist source next to the producer implementation, such as
  `packages/reference-assets/src/corpus-policy.ts` or
  `packages/cli/src/reference-corpus-policy.ts` for the bootstrap phase.
- manifest schema for corpus entries and source categories.
- allowlist rules based on package `exports`, docs allowlists, examples
  allowlists, template directories, diagnostic registries, and selected
  dependency packages.
- exclusion tests for `agent/`, `references/`, internal WebGPU implementation
  files, tests, generated files, and unexported private helpers.

Acceptance criteria:

- The policy clearly states that Aperture does not ingest the whole repo.
- Every included source category has a reason tied to app authors or AI agents.
- Every excluded source category has a clear rationale.
- A test fixture proves excluded internals do not enter the corpus.

### Phase 2: Reference Asset Producer

Create the offline producer pipeline.

Deliverables:

- `@aperture-engine/reference-assets` or an equivalent internal producer.
- TypeScript parser based on `ts-morph`.
- markdown parser for docs sections.
- example/template collector.
- diagnostic collector.
- selected dependency `.d.ts` collector.
- chunk JSON output before embeddings for easy inspection.
- copied-source builder that includes only files represented by allowed chunks.
- fixture corpus generator for fast unit tests.

Acceptance criteria:

- Public package exports are discovered from package export maps.
- Public declarations are chunked by symbol with line ranges.
- Docs are chunked by heading section.
- Examples are chunked by scenario and public API usage.
- Diagnostics are chunked by diagnostic code and suggested fix.
- Selected dependencies are limited to public `.d.ts` references.
- Private non-exported helpers are not indexed as standalone chunks.
- `agent/`, `references/`, tests, generated runtime files, and private WebGPU
  internals cannot appear in chunk JSON or copied sources.

### Phase 3: Embeddings And Payload Build

Add deterministic corpus embedding and payload generation.

Deliverables:

- pinned model contract.
- embedding generation command.
- deterministic `data/embeddings.json`.
- copied allowed source files under `data/sources`.
- `data.tgz`.
- `manifest.json` with hashes, sizes, schema version, model metadata, corpus
  stats, and generated timestamp.
- model archive or model file URL contract for warmup.

Acceptance criteria:

- Corpus and query model metadata must match before search runs.
- Payload build is deterministic for unchanged inputs except allowed timestamp
  fields.
- Manifest validation catches missing, corrupted, or mismatched payload files.
- The payload includes source content only for allowed files/chunks.
- Query embedding and corpus embedding use the same pinned model metadata.
- Runtime search does not fall back to remote model downloads.

### Phase 4: CLI Warmup And Cache Validation

Replace local ad hoc index build as the default runtime path with warmup-backed
assets.

Deliverables:

- `aperture reference warmup`.
- `aperture reference status`.
- shared cache resolution.
- project state resolution.
- asset base URL override for development and private hosting.
- corruption detection and repair.
- offline-after-warmup behavior.
- clear state file that records corpus version, model contract, source URL,
  warmed paths, and validation timestamps.

Acceptance criteria:

- Warmup downloads or resolves the corpus and model.
- Warmup validates every manifest hash and model file.
- Status reports ready, missing, corrupt, stale, and model mismatch states.
- Corrupted corpus or model files are repaired on the next warmup.
- Search works offline after a successful warmup.
- Hosted payload warmup and local-directory warmup share the same validation
  path.

### Phase 5: Semantic Search Service

Add the runtime search backend inside `@aperture-engine/cli`.

Deliverables:

- local embedding service using the pinned model.
- chunk loader.
- cosine similarity search.
- hybrid ranking layer.
- exact symbol, diagnostic, component, system, and relationship indexes.
- warmed file reader with line-range support.

Acceptance criteria:

- `aperture reference search` uses embeddings rather than substring matching.
- Exact API lookup remains deterministic for exported symbols.
- Relationship tools use metadata rather than vector guesses.
- Results cite chunk id, category, file, line range, symbol, score, and
  snippet.
- Search fails with actionable diagnostics when warmup is missing or corrupt.
- Semantic ranking is stable enough that queries for `createSystem`,
  `aperture.config.ts`, input actions, generated MCP tools, diagnostics, and
  GLB asset spawning return relevant public API or example chunks in the first
  page.

### Phase 6: MCP Integration

Keep existing reference MCP tool names and replace the backend.

Deliverables:

- MCP tool handlers backed by the semantic search service.
- shared operation contract for CLI and MCP parity.
- diagnostics for missing warmup.
- no dependency on a live browser session.

Acceptance criteria:

- MCP `reference_*` tools work with no dev server running.
- CLI and MCP expose equivalent search, API lookup, file, examples,
  components, systems, dependents, and diagnostic behavior.
- MCP responses cite files and line ranges.
- MCP tool tests run through a stdio client harness.

### Phase 7: Migration From Lexical Index

Deprecate the broad local lexical index path.

Deliverables:

- Keep a development-only `reference build-local` command if useful for corpus
  debugging.
- Replace `reference build` with either `warmup` or producer-only docs.
- Remove broad default corpus roots from runtime search.
- Update docs and help output.

Acceptance criteria:

- Runtime users are guided to `aperture reference warmup`.
- No default command indexes `agent/`, `references/`, tests, or private package
  internals.
- Existing MCP reference tools keep their names unless deliberately renamed in
  one documented breaking change.

### Phase 8: End-To-End Tests

Add tests that prove the full reference system works as shipped.

Deliverables:

- producer fixture tests.
- corpus policy inclusion/exclusion tests.
- model/embedding tests with a mock or tiny fixture backend where practical.
- warmup tests with a local fake asset server.
- corruption and repair tests.
- CLI search/API/file/examples/component/system/diagnostic tests.
- MCP parity tests.
- scaffolded app smoke test that uses reference tools.
- hosted-payload compatibility tests using a fixture `data.tgz` and
  `manifest.json`.
- negative tests proving file-content cannot read non-corpus files.

Acceptance criteria:

- Every CLI reference command has end-to-end coverage.
- Every MCP reference tool has end-to-end coverage.
- Tests prove the corpus excludes internal WebGPU/render implementation files.
- Tests prove public exports and current scaffold examples are searchable.
- Tests prove a generated app can use MCP reference tools without a running
  browser session.
- Tests cover both local producer fixtures and warmed runtime consumption.

## Risks And Mitigations

- Risk: indexing too much private engine code makes agents write against
  unstable internals.
  Mitigation: package-export discovery, explicit allowlists, copied-source
  restrictions, and exclusion tests for private renderer/WebGPU files.
- Risk: semantic model distribution adds large or brittle dependencies to app
  bundles.
  Mitigation: keep model, transformers.js, and tar/cache dependencies in CLI or
  producer tooling only.
- Risk: query/corpus embedding drift silently degrades search.
  Mitigation: require exact model contract match before search.
- Risk: reference tools become a general local-file reader.
  Mitigation: read only warmed `data/sources` files recorded in the manifest.
- Risk: examples go stale and mislead agents.
  Mitigation: include scaffold smoke tests and boost only current examples that
  pass typecheck/build.
- Risk: relationship tools hallucinate graph answers from vector results.
  Mitigation: build relationship indexes from parsed metadata and use vector
  search only as fallback.

## Global Acceptance Criteria

- Aperture has a true embedding-backed reference search path.
- The corpus is allowlist-driven and developer-facing.
- Public package exports are represented.
- `aperture.config.ts`, system discovery, system priority, config signals, ECS
  components, assets, render authoring, diagnostics, CLI commands, and MCP
  tools are represented where they are public.
- Internal renderer/WebGPU implementation files are excluded unless explicitly
  promoted to public documentation or diagnostics.
- Bulk local reference checkouts are excluded from the Aperture RAG corpus.
- Search results include source category, symbol, file path, line range, score,
  and snippet.
- API lookup favors exact exported symbols before semantic fallback.
- Relationship queries use parsed metadata.
- Diagnostic lookup is exact by code and includes suggested fixes when known.
- `aperture reference warmup` validates, caches, and repairs corpus/model
  assets.
- Search works offline after warmup.
- MCP reference tools work without a browser session.
- CLI and MCP reference behavior stay in parity through shared contracts.
- Heavy RAG dependencies stay in CLI/reference tooling and do not enter
  generated app bundles or production runtime packages.

## Recommended First Slice

Start with the corpus policy and a tiny producer fixture before adding model
downloads:

1. Add the allowlist/exclusion policy.
2. Add a `ts-morph` parser fixture that indexes one exported system API, one
   component API, one diagnostic, and one example.
3. Emit chunk JSON with line ranges and source categories.
4. Add tests proving private helpers, `agent/`, `references/`, and WebGPU
   internals are excluded.
5. Wire the current CLI reference tools to read fixture-like chunk metadata
   behind the existing tool names.

That first slice proves the most important design decision: Aperture's reference
corpus is a curated developer-facing API corpus, not a dump of the repository.
