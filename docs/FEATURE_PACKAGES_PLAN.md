# Feature Packages Plan

Status: proposed, implementation-gated

This plan defines a feature-package architecture for Aperture that can support
features that are purely simulation-side, features that cross the extraction and
rendering boundary, and features that live on the browser/main-thread side.

The goal is not to turn `@aperture-engine/render` into a generic plugin host.
The goal is to make engine capabilities installable and owned by focused
packages while preserving the core invariants:

- ECS is the source of truth.
- Rendering is a derived view of ECS state.
- `RenderSnapshot` remains the explicit serializable worker boundary.
- WebGPU remains the only rendering backend.
- The default browser shape remains worker-first: simulation, systems, and
  extraction run in the worker; canvas, WebGPU, browser input, and browser-only
  resources live on the main thread.

## Problem

Some Aperture capabilities already have clean package boundaries:

- `@aperture-engine/physics` owns backend-neutral physics contracts.
- `@aperture-engine/physics-rapier` owns the Rapier backend.
- `@aperture-engine/app` composes the feature into the generated app.

Other capabilities do not yet have the same clarity:

- Particles are spread across `render`, `app`, and `webgpu`.
- UI has a real package, `@aperture-engine/ui`, but base UI components and
  fallback extraction still live in `render`, builder helpers depend on
  `runtime`, and app interaction code imports UI hit-test/scroll pieces from
  render-side modules.

The tempting abstraction is a render plugin model. That is too narrow:

- Physics does not touch rendering.
- Audio realizes browser resources from snapshot intent.
- UI and particles straddle simulation, extraction, packet encoding, and WebGPU
  realization.

The better abstraction is a feature-package model with optional phase hooks.
Render-facing features can register extraction and WebGPU realization hooks, but
the feature model must also work for packages that never produce render
commands.

## Design Judgment

Feature packages should be application/runtime composition units, not arbitrary
renderer plugins.

A renderer plugin API would pressure `@aperture-engine/render` or
`@aperture-engine/webgpu` to become the center of the engine. That conflicts
with Aperture's current data flow:

```text
ECS World
-> Transform/System Resolution
-> Render Extraction
-> Render Snapshot
-> Render World
-> WebGPU Render Graph
-> GPU Submission
```

The feature contract should respect that flow:

- Simulation features install components and systems.
- Extraction features read ECS state and emit typed snapshot packets.
- Main-thread features realize browser resources from packets or app commands.
- WebGPU features consume snapshots and assets to produce ordered render work.

`@aperture-engine/app` is the composition layer. Lower packages should expose
domain contracts and hooks, not import the app facade.

## Definitions

### Feature Package

A feature package is an installable engine capability. It may contribute:

- ECS components.
- Asset types, asset helpers, and validation.
- Runtime systems or fixed-step hooks.
- Extraction hooks.
- Typed snapshot packet families.
- Browser/main-thread hooks.
- WebGPU realization hooks.
- Diagnostics and test support.

A feature package only participates in the phases it needs.

### Feature Module

A feature module is the object a package exposes to app composition. A logical
feature may have multiple phase modules that share the same id:

- a worker/headless module for components, assets, runtime hooks, and extraction
- a browser module for DOM or other main-thread browser resources
- a WebGPU module for GPU realization

This split is required for the worker import graph. A headless worker module
must not import DOM or WebGPU context types just because the same logical feature
also has browser or WebGPU hooks.

```ts
export type MaybePromise<T> = T | Promise<T>;

export type FeatureDisposer = () => MaybePromise<void>;

export interface FeatureInstallHandle {
  dispose(): MaybePromise<void>;
}

export type FeatureInstallResult =
  | void
  | FeatureDisposer
  | FeatureInstallHandle;

export interface ApertureFeatureDescriptor {
  readonly id: string;
  readonly requires?: readonly string[];
  readonly optional?: readonly string[];
  readonly conflictsWith?: readonly string[];
}

export interface ApertureWorkerFeature extends ApertureFeatureDescriptor {
  registerComponents?(context: FeatureComponentContext): void;
  registerAssets?(context: FeatureAssetContext): void;
  installRuntime?(
    context: FeatureRuntimeContext,
  ): MaybePromise<FeatureInstallResult>;
  installExtraction?(
    context: FeatureExtractionContext,
  ): MaybePromise<FeatureInstallResult>;
}

export interface ApertureBrowserFeature extends ApertureFeatureDescriptor {
  installBrowser?(
    context: FeatureBrowserContext,
  ): MaybePromise<FeatureInstallResult>;
}

export interface ApertureWebGpuFeature extends ApertureFeatureDescriptor {
  installWebGpu?(
    context: FeatureWebGpuContext,
  ): MaybePromise<FeatureInstallResult>;
}

export type ApertureFeature =
  | ApertureWorkerFeature
  | ApertureBrowserFeature
  | ApertureWebGpuFeature;
```

The exact TypeScript names can change. The load-bearing details are:

- Every install hook that can allocate resources may return a disposer.
- Component and asset registration are idempotent setup steps. Aperture does not
  currently have component-type unregistration, so those hooks should not be the
  primary cleanup mechanism.
- The resolver owns reverse-order cleanup.
- Dependencies are feature ids, not semver ranges, until Aperture has real
  out-of-lockstep feature consumers.
- There is no `kind` field. A feature's shape is derivable from the hooks it
  implements.

### Feature, Subsystem, and Preset

Not every app capability should become a decomposable feature.

- A feature is optional or independently installable.
- A mandatory app subsystem is part of the app loop and not feature-resolved.
- A preset is a config shortcut that expands to a list of features and subsystem
  defaults.

For example, browser input and render basics are currently app subsystems. UI,
particles, physics, and audio can be treated as features or feature families.

### Realizer

A realizer consumes extracted snapshot data and produces backend work. The
primary first backend is WebGPU.

```ts
export interface WebGpuFeatureRealizer {
  readonly id: string;
  readonly packetFamilies: readonly string[];

  prepareFrame(
    input: WebGpuFeatureFrameInput,
  ): MaybePromise<WebGpuFeatureFrameResult>;

  dispose?(): MaybePromise<void>;
}
```

Physics does not need a WebGPU realizer. UI and particles do.

## Non-Goals

- Do not let arbitrary packages mutate renderer internals.
- Do not let arbitrary packages push opaque JavaScript objects into snapshots.
- Do not make lower packages import `@aperture-engine/app`.
- Do not make `@aperture-engine/render` import feature implementations such as
  `@aperture-engine/ui`.
- Do not move live GPU resources into headless packages.
- Do not move the authoritative simulation state out of ECS.
- Do not make feature packages a second public engine API wider than the app
  facade.

## Package Taxonomy

Feature packages should be classified by the phases they use.

### Simulation Feature

Simulation features own ECS components, systems, fixed-step behavior, queries,
events, or deterministic runtime state.

Examples:

- Physics.
- AI/navigation in the future.
- Gameplay helper packages in the future.

### Extraction Feature

Extraction features read ECS state and emit serializable snapshot data.

Examples:

- UI layout extraction.
- Particle emitter extraction.
- Audio emitter/listener extraction.
- Trails, decals, or debug visualization in the future.

### Render Feature

Render features consume snapshot packets and assets to produce backend commands.

Examples:

- UI quads and MSDF text.
- Particle pipelines and particle frame resources.
- Decals or debug draw in the future.

### Main-Thread Feature

Main-thread features own browser APIs or other non-worker resources.

Examples:

- Web Audio realization.
- Hidden DOM input and IME bridge.
- HTML bridge.

Many features are mixed. UI and particles are mixed features. Physics is not a
render feature.

## Dependency Rules

These rules should be enforced by scripts, TypeScript project references, and
package manifests.

```text
@aperture-engine/math
  may import: nothing from Aperture lower than itself

@aperture-engine/simulation
  may import: math
  must not import: render, runtime, app, webgpu, feature packages, browser globals

@aperture-engine/physics
  may import: simulation, math
  must not import: render, runtime, app, webgpu, physics-rapier, browser globals

@aperture-engine/physics-rapier
  may import: physics, simulation, math
  must not import: render, runtime, app, webgpu, browser globals

@aperture-engine/particles
  may import: simulation, math
  must not import: render, runtime, app, webgpu, browser globals

@aperture-engine/render
  may import: simulation, math, pure feature-domain packages such as particles
  must not import: app, webgpu, browser globals, feature implementations that depend on render

@aperture-engine/ui
  may import: simulation, render packet/extractor contracts, math
  must not import: app, webgpu, browser globals from the root entry

@aperture-engine/ui/browser
  may import: ui root
  may reference: DOM/browser globals

@aperture-engine/runtime
  may import: simulation, render, pure feature contracts needed for authoring compatibility
  must not import: webgpu or browser globals

@aperture-engine/webgpu
  may import: simulation, render, runtime where currently required, pure feature-domain packages
  may reference: WebGPU globals

@aperture-engine/audio
  may import: render snapshot contracts
  may reference: Web Audio globals

@aperture-engine/app
  may import and compose all first-party features
```

`@aperture-engine/app` is allowed to be broad because it is the composition
layer. Lower layers should remain narrow.

The planned `render -> particles` edge is acceptable only after particle domain
types are severed from render-owned enums and helpers. The first particle
migration step must prevent `particles -> render` before any component/schema
move happens.

The current `runtime -> physics` wholesale re-export should be treated as legacy
compatibility, not the desired shape. Runtime should avoid becoming a second
composition layer; if it needs clock or fixed-step types, those contracts should
be scoped narrowly instead of re-exporting whole feature packages indefinitely.

## Recommended Package Shapes

### UI

```text
@aperture-engine/ui
  UI ECS components
  createUi* helpers
  builder APIs
  Yoga layout
  retained layout tree
  style resolution
  extraction implementation
  hit testing
  scroll semantics
  input ECS state

@aperture-engine/ui/browser
  hidden DOM input
  IME bridge
  DOM-specific input helpers

@aperture-engine/render
  UiNodePacket
  UiHitRegionPacket
  RenderSnapshot.uiNodes
  RenderSnapshot.uiHitRegions
  extractor registration contract
  fallback UI extraction as a rollback path

@aperture-engine/webgpu
  UI quad/text pipelines
  UI frame resource preparation
```

`render` keeps the wire contract. `ui` owns everything above the wire. `webgpu`
owns GPU realization.

Important current-state correction: `@aperture-engine/ui/browser` does not exist
today. The DOM bridge is currently re-exported through the UI root barrel, so
creating the browser subpath requires barrel surgery, not only moving a file.

The render fallback layout should not be removed as part of the first UI
migration. It should become a loud diagnosable fallback path and remain available
until a separate reversible follow-up removes it behind explicit stability
gates.

### Particles

```text
@aperture-engine/particles
  ParticleEmitter ECS component
  ParticleEmitterInput
  createParticleEmitter
  particle effect schema
  particle effect validation
  particle effect normalization
  runtime feature analysis
  burst queue

@aperture-engine/render
  ParticleEmitterPacket
  RenderSnapshot.particleEmitters
  particle packet codecs
  particle extraction to render packets
  bounds, culling, sort keys
  composite expansion to leaf packets

@aperture-engine/webgpu
  particle pipelines
  WGSL
  live particle CPU/GPU state
  buffers, bind groups, resource cache entries
  soft particle depth bindings
  particle render commands
```

The headless particles package should not own live particle buffers. Live
particle state is a derived renderer resource.

Composite expansion stays render-owned for the first migration because it
produces render packets, bounds, and sort keys. Private helpers inside that
render expansion path should stay private unless a concrete public particle
domain use appears.

Hard precondition: move particle domain enums and value constants, including
`ParticleSimulationSpace`, out of render before moving the component/schema into
`@aperture-engine/particles`. Compatibility re-exports must exist in all current
public entry points that expose those values, including `render`, `runtime`, and
`@aperture-engine/app/systems`. Generated worker code that reaches enums through
the app namespace must continue to work for the migration window.

### Physics

```text
@aperture-engine/physics
  physics ECS components
  validation
  fixed-step contracts
  backend command/result contracts
  query/event contracts
  test backend

@aperture-engine/physics-rapier
  Rapier-backed backend adapter

@aperture-engine/app
  feature installation and backend selection
```

Physics is a feature package, but not a render feature. It has no snapshot
packet family unless a future debug visualization feature opts into render
packets separately.

Physics should be converted after the feature lifecycle contract exists. It is a
good conformance test for teardown because current physics installation already
returns an `unregister()` handle and `dispose()` method.

### Audio

Audio is also a feature, but it is main-thread realization of snapshot intent:

```text
@aperture-engine/render
  AudioEmitter / AudioListener packet contracts
  audio extraction

@aperture-engine/audio
  Web Audio backend
  mixer
  voice manager
  applySnapshot(snapshot, frameDelta)

@aperture-engine/app
  browser app wiring
```

Audio is a useful reminder that not every feature with runtime realization is a
render feature.

## Load-Bearing Contract Requirements

The feature contract must be designed before migration starts. Three items are
blockers, not polish.

### Teardown

Every install hook may allocate resources:

- fixed-step tasks
- ECS/system registrations
- async layout engines such as Yoga
- browser input bridges
- Web Audio state
- WebGPU buffers, pipelines, bind groups, and caches

The resolver must collect every disposer returned from feature hooks. Disposal
order must be the reverse of successful installation order.

```text
startup:
  install A
  install B
  install C

dispose:
  dispose C
  dispose B
  dispose A
```

If startup fails after partial installation, rollback uses the same reverse
order and app creation rejects. This avoids half-installed apps and makes
scene-switching, tests, HMR, and live reconfiguration possible.

WebGPU realizer disposal has one owner: the disposer returned by
`registerRealizer`. That disposer must unregister the realizer and invoke
`realizer.dispose()` exactly once when present. The disposer returned directly
from `installWebGpu` covers only resources the install hook allocated outside
the registered realizer.

### Command Ordering

Independent WebGPU realizers cannot return loose command arrays with no merge
metadata. UI and particles can appear in the same frame, and transparent
particles may need to interleave with other transparent scene draws.

Each WebGPU command group must declare where it belongs:

```ts
export type WebGpuFeatureCommandPhase =
  | "opaque"
  | "alpha-test"
  | "transparent"
  | "overlay";

export interface WebGpuFeatureCommandGroup {
  readonly featureId: string;
  readonly phase: WebGpuFeatureCommandPhase;
  readonly sortKey?: RenderSortKey;
  readonly ordinal: number;
  readonly commands: readonly RenderPassCommand[];
}
```

Rules:

- Total submit order is `opaque -> alpha-test -> transparent -> overlay`.
  (A dedicated `post` feature phase was cut: tonemap/post-processing is an
  app-owned fixed stage; reintroduce a phase only when a real feature needs
  it.)
- `opaque`, `alpha-test`, and `transparent` groups that interleave with scene
  draws must provide the existing render sort key. A scene-phase group whose
  sort key cannot be resolved degrades to the end of the merged sequence with
  a `webGpuFeatureCommandGroup.missingSortKey` diagnostic — it never unsorts
  commands it does not own, and never fails the frame.
- `overlay` groups render after post-processing in ascending `ordinal` order.
  The built-in ordinals are reserved and exported as
  `BUILT_IN_OVERLAY_ORDINALS` (`particles: 1_000`, `ui: 2_000`); third-party
  overlay groups order against them: below `1_000` renders under both
  built-ins, between `1_000` and `2_000` renders above particles but under
  UI, above `2_000` renders on top of everything. Equal ordinals tie-break by
  registration order, which is deterministic because built-ins register at
  resource-cache creation.
- An empty command group is a legal no-op (a feature with no work this
  frame), not an error.

The WebGPU app remains responsible for the final merge and pass submission.
Feature realizers do not submit GPU work directly.

`WebGpuFeatureCommandGroup` should either generalize the existing internal
WebGPU render-pass command group shape or replace it deliberately. Do not create
two unrelated command-group concepts with overlapping responsibilities.

### Error and Abort Semantics

Startup errors and per-frame errors need explicit behavior.

Startup policy:

- Missing required feature: emit a scoped diagnostic and reject app creation.
- Conflicting features: emit diagnostics for both sides and reject app creation.
- Install hook rejection: emit a scoped diagnostic, run reverse-order rollback,
  and reject app creation.
- Optional feature install failure: either reject if configured as required, or
  disable the feature with an explicit diagnostic if configured as optional.

Frame policy:

- Extractor throw: catch, emit a feature-scoped diagnostic, drop that feature's
  output for the frame, and keep the app loop alive unless the error is marked
  fatal.
- Realizer throw: catch, emit a feature-scoped diagnostic, drop that feature's
  command groups for the frame, and keep already-owned resources valid until
  dispose.
- Device loss or backend fatal state remains an app/WebGPU fatal path, not a
  recoverable feature warning.

Diagnostics must use typed shapes and dotted diagnostic codes that can be added
to the diagnostics catalog. Avoid `unknown[]` report payloads in public feature
results.

## Feature Lifecycle

Feature installation should happen in deterministic phases.

```text
1. Resolve configured feature list and compatibility sugar.
2. Produce a stable total feature order.
3. Validate duplicate ids, dependencies, and conflicts.
4. Register ECS components.
5. Register asset helpers/loaders/collections.
6. Install runtime, systems, fixed-step hooks, and worker-side async state.
7. Install extraction hooks after any async state they need is ready.
8. Start worker-side extraction runner.
9. Start browser/main-thread features.
10. Start WebGPU realizers.
11. Begin frame loop.
12. On app.dispose(), dispose all feature handles in reverse order.
```

Async setup must complete before any phase that depends on it. For example,
Yoga layout must be loaded before the Yoga UI extractor is registered. If a
feature's extraction hook needs async state, that work must be awaited inside
the worker install path before `registerExtractor` is called.

Feature order must not depend on object key iteration, `Set` iteration, or async
completion order. The resolver should use a deterministic declared order, with
stable tie-breaking by feature id where dependency sorting is needed.

## Feature Contexts

Feature hooks should receive narrow contexts instead of app internals.

```ts
export interface FeatureDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly featureId: string;
  readonly message: string;
  readonly details?: JsonValue;
}

export interface FeatureDiagnosticsSink {
  report(diagnostic: FeatureDiagnostic): void;
  scoped(featureId: string): FeatureDiagnosticsSink;
}

export interface FeatureComponentContext {
  readonly world: EcsWorld;
}

export interface FeatureAssetContext {
  readonly registry: AssetRegistry;
}

export interface FeatureRuntimeContext {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly registerFixedStepTask: FixedStepTaskRegistrar;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export type RegisterExtractor = (hook: ExtractionHook) => FeatureDisposer;

export interface FeatureExtractionContext {
  readonly registerExtractor: RegisterExtractor;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface FeatureBrowserContext {
  readonly canvas: HTMLCanvasElement;
  readonly commandBus: BrowserCommandBus;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface FeatureWebGpuContext {
  /**
   * Registers a realizer and returns the owner disposer. The disposer unregisters
   * the realizer and invokes realizer.dispose() once when present.
   */
  readonly registerRealizer: (
    realizer: WebGpuFeatureRealizer,
  ) => FeatureDisposer;
  readonly diagnostics: FeatureDiagnosticsSink;
}
```

Runtime hooks can mutate ECS because systems are authoritative simulation code.
Extraction hooks should not receive mutable ECS and asset objects at frame time.
They should receive read-only views plus narrow writer APIs for snapshot output.

The current implementation may bridge through existing mutable objects
internally during migration, but the public feature contract should not promise
mutation access in extraction or WebGPU realization.

Browser and WebGPU context types should live behind phase-specific app or
backend subpaths. Headless feature roots should not need to import DOM or WebGPU
types merely to expose their simulation, asset, or extraction hooks.

### Existing and Net-New Types

Some names in the proposed interfaces already exist; others are part of the
contract work.

Existing types to reuse:

- `EcsWorld`
- `AssetRegistry`
- `FixedStepTaskRegistrar`
- `RenderSnapshot`
- `RenderSortKey`
- `ViewPacket`
- `PackedSnapshotViewUniforms`
- `RenderPassCommand`

Net-new types that must be designed before the contract is frozen:

- `FeatureDiagnosticsSink`
- `RegisterExtractor`
- `ReadonlyEcsWorldView`
- `ReadonlyAssetRegistryView`
- `SnapshotPacketWriter`
- `SnapshotTransformWriter`
- `BoundsWriter`
- `RenderSortKeyBuilder`
- `WebGpuFeatureResourceContext`
- `BrowserCommandBus` or a better browser command-channel abstraction matching
  the current event/postMessage bridge

`RegisterExtractor` must wire install-time registration to the frame extraction
runner:

```ts
export type RegisterExtractor = (hook: ExtractionHook) => FeatureDisposer;
```

The extraction runner owns per-frame invocation, deterministic ordering,
exception isolation, diagnostics, and unregister handling. The returned disposer
removes the hook from future frames.

The read-only view types must be type-enforced. If `ReadonlyEcsWorldView` or
`ReadonlyAssetRegistryView` expose mutating methods, they do not satisfy the
feature boundary.

## Feature Dependencies

Features should declare dependencies explicitly by id.

```ts
type FeatureDependencyFields = Pick<
  ApertureFeatureDescriptor,
  "id" | "requires" | "optional" | "conflictsWith"
>;
```

Equivalent excerpt:

```ts
interface FeatureDependencyFields {
  readonly id: string;
  readonly requires?: readonly string[];
  readonly optional?: readonly string[];
  readonly conflictsWith?: readonly string[];
}
```

Examples:

- A future `physics-rapier` backend feature would require `physics`.
- `ui/webgpu` requires `ui` and the WebGPU app.
- `ui/browser` requires `ui`.
- `particles/webgpu` requires `particles`.

Do not add semver range negotiation now. Aperture packages are currently
developed and consumed in lockstep through workspace dependencies, so a range
field would be complexity without a use case.

This id-only model also does not express capability cardinality such as
"`physics` requires exactly one backend provider." For the first physics
migration, keep backend selection as a physics feature config slot and perform
missing/invalid backend diagnostics inside the physics feature. If Aperture later
wants independent backend features, add an explicit `provides` plus
`requiresExactlyOne` capability model before moving backend cardinality into the
generic resolver.

## Snapshot Extension Model

The snapshot boundary must stay typed, serializable, inspectable, and packable.

There are two acceptable approaches:

1. First-party named fields for important built-ins.
2. A typed packet-family registry for future features.

Aperture should keep first-party named fields for current high-throughput
features:

```ts
snapshot.uiNodes;
snapshot.uiHitRegions;
snapshot.particleEmitters;
snapshot.audioEmitters;
snapshot.audioListener;
```

For future extensibility, add a packet-family registry only when needed:

```ts
export interface RenderPacketFamily<TPacket, TReport = PacketInspectionReport> {
  readonly id: string;
  readonly version: number;
  readonly encode?: PacketEncoder<TPacket>;
  readonly decode?: PacketDecoder<TPacket>;
  readonly inspect?: (packets: readonly TPacket[]) => TReport;
  readonly toJson?: (packets: readonly TPacket[]) => JsonValue;
}
```

Do not allow opaque packet payloads in the default path. Every packet family
needs:

- stable id
- version
- structured-clone semantics
- JSON inspection support
- packed/shared snapshot encoding support or an explicit transferable fallback
- diagnostics

Current UI packets are a transport decision point. Apps with UI packets
currently cannot use the packed shared snapshot path for those packets. Making
UI default would therefore add Yoga weight and keep such apps on transferable
snapshots until packed UI encoding exists. Treat UI default/preset behavior as
an explicit product and transport decision, not an incidental default.

## Extraction Contract

Extraction hooks should be registered by packet family or feature id.

```ts
export interface ExtractionHook {
  readonly id: string;
  readonly packetFamilies: readonly string[];
  extract(input: FeatureExtractionInput): FeatureExtractionResult;
}
```

Extraction input should provide read-only ECS/render context data and narrow
writers:

```ts
export interface FeatureExtractionInput {
  readonly world: ReadonlyEcsWorldView;
  readonly assets: ReadonlyAssetRegistryView;
  readonly frame: number;
  readonly time: number;
  readonly cameraLayerMask: number;
  readonly views: readonly ViewPacket[];
  readonly transforms: SnapshotTransformWriter;
  readonly bounds: BoundsWriter;
  readonly packetWriter: SnapshotPacketWriter;
  readonly sortKeys: RenderSortKeyBuilder;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface FeatureExtractionResult {
  readonly valid: boolean;
  readonly diagnostics: readonly FeatureDiagnostic[];
}
```

Render-owned concerns should stay in render:

- camera layer masks
- view culling context
- sort-key construction
- transform packing
- bounds packing
- packet encoding

Feature-owned extraction can call narrow writer APIs for these concerns.

## WebGPU Realization Contract

WebGPU feature realization should consume snapshots and assets, not ECS.

```ts
export interface WebGpuFeatureFrameInput {
  readonly snapshot: RenderSnapshot;
  readonly assets: ReadonlyAssetRegistryView;
  readonly resources: WebGpuFeatureResourceContext;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly frameDelta: number;
  readonly time: number;
  readonly diagnostics: FeatureDiagnosticsSink;
}

export interface WebGpuFeatureFrameResult<
  TReport extends WebGpuFeatureReport = WebGpuFeatureReport,
> {
  readonly valid: boolean;
  readonly commandGroups: readonly WebGpuFeatureCommandGroup[];
  readonly diagnostics: readonly FeatureDiagnostic[];
  readonly report?: TReport;
}
```

`WebGpuFeatureResourceContext` should be a narrow facade, not the full
`WebGpuAppResourceCache`. If that facade cannot be made small and stable, keep
the realizer registry internal to `@aperture-engine/webgpu` until the right
public surface is clear.

Feature reports should be typed. Do not expose `unknown` diagnostics or opaque
reports from the feature API.

## App Composition API

Feature composition should be available through app config and direct app
creation, but this is net-new API. The current entry point is
`defineApertureConfig`; there is no generic `defineConfig` helper for Aperture.

Proposed shape:

```ts
import { defineApertureConfig } from "@aperture-engine/app";
import { physicsFeature } from "@aperture-engine/physics/app";
import { particlesFeature } from "@aperture-engine/particles/app";
import { uiFeature } from "@aperture-engine/ui/app";

export default defineApertureConfig({
  features: [
    uiFeature(),
    particlesFeature(),
    physicsFeature({ backend: "rapier" }),
  ],
});
```

Existing compatibility sugar should continue while the feature API is adopted:

```ts
export default defineApertureConfig({
  physics: true,
  audio: true,
});
```

Default behavior is an open decision. Do not assume all first-party features are
default. A conservative starting point:

```text
mandatory app subsystems:
  render basics
  input

compatibility feature sugar:
  physics only when configured
  audio only when configured

candidate preset features:
  UI
  particles
  browser bridges
```

If UI becomes part of a default preset before packed UI encoding exists, that
preset must explicitly accept transferable snapshot fallback for UI packets.

## Resolver Dispatch Model

The `features` array is a logical app config surface. It must not imply that one
flat feature object with worker, browser, and WebGPU hooks is imported in every
environment.

Use phase-specific resolver inputs:

```text
worker/headless resolver
  imports feature root or /worker modules
  sees components, assets, runtime, extraction
  must not import DOM or WebGPU context types

browser resolver
  imports /browser modules
  sees DOM, input bridge, Web Audio bridge, browser commands

WebGPU resolver
  imports internal webgpu realizers first
  may later import /webgpu modules if the public resource facade is stable
```

The app composition layer or generated worker entry is responsible for mapping
logical features to the phase modules available in that environment. The worker
resolver must never import `installBrowser`, `installWebGpu`,
`FeatureBrowserContext`, or `FeatureWebGpuContext`.

## Migration Plan

The migration should not begin by converting physics and letting physics define
the interface. Physics is useful, but it exercises only runtime/fixed-step
installation. The hard parts are extraction, packet ownership, command ordering,
WebGPU resource scoping, and transport.

### Cross-Cutting Acceptance Criteria

These gates apply to every target below, not only to the initial resolver work:

- Existing headless CLI/MCP tooling must continue to create, step, extract, and
  report app status after feature composition is introduced.
- Headless CLI/MCP tooling must not import DOM, browser-only UI bridge modules,
  WebGPU app modules, Web Audio modules, or live GPU resource code through the
  feature contract.
- Feature-disabled and feature-enabled headless paths must both remain covered
  by tests so regressions are caught when UI, particles, physics, or future
  features move behind the resolver.
- Existing examples, showcase apps, documentation builds, and e2e smoke tests
  must keep passing during each migration target unless a target explicitly
  updates them in the same change.

### Target 1: Contract and Resolver

Implementation work:

1. Add internal feature interfaces with disposers, command ordering, and typed
   diagnostics.
2. Pin total WebGPU command phase order, including `alpha-test`, `post`, and
   `overlay`.
3. Design the net-new context/view/writer types before exposing the contract.
4. Add phase-specific worker, browser, and WebGPU resolver dispatch.
5. Add deterministic feature resolution by declared order and dependency graph.
6. Add reverse-order rollback on startup failure.
7. Add `app.dispose()` integration for all collected feature disposers.
8. Add typed diagnostics sink integration with dotted diagnostic codes.
9. Keep the first implementation internal or explicitly provisional until UI and
   particles have been designed against it.

Acceptance criteria:

- Startup failure after a partially installed feature rolls back prior hooks.
- Disposal runs in reverse order.
- Async install completion cannot change feature order.
- Duplicate, missing, and conflicting feature diagnostics are deterministic.
- Worker resolver imports no browser or WebGPU phase modules.
- Existing headless CLI/MCP tooling can still create, step, and extract an app
  through the feature resolver without importing DOM or WebGPU-only modules.

### Target 2: Boundary Checks

Implementation work:

1. Extend the package dependency checker for package-to-package import rules.
2. Extend the headless/global checker for DOM/WebGPU/Web Audio globals.
3. Add net-new rules for `render` not importing UI implementations.
4. Add net-new rules for feature packages not importing `@aperture-engine/app`.
5. Add `ui` and future `particles` only after the root entries are actually
   headless-clean.

Acceptance criteria:

- `@aperture-engine/ui` root fails CI if it references DOM globals.
- `@aperture-engine/ui/browser` may reference DOM globals.
- `@aperture-engine/particles` fails CI if it imports render, app, webgpu, or
  browser globals.
- `@aperture-engine/render` fails CI if it imports UI implementation modules.
- Headless CLI/MCP entry points stay covered by boundary checks and do not gain
  browser or WebGPU globals through feature composition.

### Target 3: Physics Conformance

Physics should validate the runtime and teardown parts of the contract, not
define the whole contract.

Target API:

```ts
import { defineApertureConfig } from "@aperture-engine/app";
import { physicsFeature } from "@aperture-engine/physics/app";

export default defineApertureConfig({
  features: [physicsFeature({ backend: "rapier" })],
});
```

Implementation work:

1. Wrap current `installApertureAppPhysics` behavior in a feature module.
2. Preserve `physics: true` config as compatibility sugar.
3. Preserve current backend `dispose()` and fixed-step `unregister()` behavior.
4. Add a dispose test proving the fixed-step task is unregistered and backend
   state is cleared.
5. Keep `@aperture-engine/physics` free of render/WebGPU/app imports.
6. Add physics-feature validation tests for missing or invalid backend config.
   Do not add duplicate-backend resolver tests unless backend providers become
   independent feature modules with a capability cardinality model.

### Target 4: UI

UI has the most ownership cleanup.

Target API:

```ts
import { defineApertureConfig } from "@aperture-engine/app";
import { uiFeature } from "@aperture-engine/ui/app";
import { uiBrowserFeature } from "@aperture-engine/ui/browser";

export default defineApertureConfig({
  features: [uiFeature(), uiBrowserFeature()],
});
```

Implementation work:

1. Split DOM input bridge into `@aperture-engine/ui/browser`.
2. Remove DOM bridge exports from the UI root barrel.
3. Add `@aperture-engine/ui` to app composition through the feature resolver.
4. Install Yoga UI before the first extraction.
5. Move base UI components and remaining `createUi*` helpers from `render` to
   `ui`.
6. Leave deprecated re-exports in `render`, `runtime`, and app-facing barrels
   for one migration window where needed.
7. Move hit testing into `ui`.
8. Move scroll semantics from `app` into `ui` or expose a UI runtime hook that
   app installs.
9. Wire style resolution into extraction.
10. Decide UI transport behavior:
    - add packed UI packet encoding, or
    - explicitly fall back to transferable snapshots when UI packets are
      present.
11. Make absent UI extractor state loud and diagnosable.
12. Keep render fallback layout as a rollback path until a separate removal
    decision has clear stability gates.
13. Define fallback removal gates before deletion: at least one migration window
    where e2e, examples, and showcase coverage emit zero fallback diagnostics
    except in tests that intentionally exercise the fallback.

Acceptance criteria:

- App-authored UI works without manual `installYogaUiLayout`.
- Headless checks include `packages/ui` root after root barrel cleanup.
- `@aperture-engine/ui` root has no DOM globals.
- WebGPU still consumes only snapshot packets.
- UI disabled emits zero `uiNodes` and zero `uiHitRegions`.
- Packed snapshot behavior for UI is tested or the transferable fallback is
  explicitly tested.
- Existing UI e2e tests pass.

### Target 5: Particles

Particles need a new package, but GPU realization should stay in WebGPU first.

Target API:

```ts
import { defineApertureConfig } from "@aperture-engine/app";
import { particlesFeature } from "@aperture-engine/particles/app";

export default defineApertureConfig({
  features: [particlesFeature()],
});
```

Implementation work:

1. Add `packages/particles`.
2. First, move particle domain enums/value constants out of render and add
   compatibility re-exports by value in render, runtime, and
   `@aperture-engine/app/systems`.
3. Update generated worker/app namespace usage so existing
   `aperture.ParticleSimulationSpace` access still works during the migration
   window.
4. Land the enum/value move and by-value compatibility re-exports in one change
   so public value identity does not split across releases.
5. Move pure particle schema, validation, normalization, feature analysis, ECS
   component, `createParticleEmitter`, and burst queue.
6. Update `render` extraction to import particle domain types from particles.
7. Keep `ParticleEmitterPacket`, snapshot fields, packet codecs, bounds, culling,
   sort keys, and composite expansion in render.
8. Update `webgpu` particle frame resources to import particle asset/runtime
   types from particles and packet types from render.
9. Keep deprecated public re-exports for one migration window.
10. Update app config and system asset loaders.
11. Add package boundary checks for the particles root.

Acceptance criteria:

- `@aperture-engine/particles` imports no render/WebGPU/app/browser modules.
- Particle extraction output is snapshot-compatible with the current packet ABI.
- Feature-disabled mode emits zero particle packets.
- Same seed and same inputs produce a bit-identical particle snapshot digest
  before and after the package move.
- Particle packet packed encoding tests still pass.
- Particle e2e tests still pass.
- Public import migration is documented.

### Target 6: WebGPU Feature Realizer Registry

Do not start by moving WebGPU UI or particle code into `ui/webgpu` or
`particles/webgpu`. First, make the WebGPU app consume feature realizers through
an internal registry while keeping implementations in `@aperture-engine/webgpu`.

Implementation work:

1. Register built-in UI and particle realizers internally.
2. Return ordered command groups, not loose command arrays.
3. Validate command group phase/sort-key requirements.
4. Add `dispose()` for realizer-owned resources.
5. Keep resource access behind a narrow facade.

Later, if package boundaries remain clean, first-party packages may expose
backend subpaths:

```text
@aperture-engine/ui/webgpu
@aperture-engine/particles/webgpu
```

That later move is only worthwhile if it reduces coupling without leaking
renderer internals as API.

## Boundary Checks

There are two distinct checker concerns today:

- Package dependency boundaries.
- Headless/global API usage boundaries.

Add or extend checks for:

- Headless root packages must not import `@aperture-engine/webgpu`.
- Headless root packages must not reference WebGPU globals.
- Headless root packages must not reference DOM/Web Audio globals unless
  explicitly exempt.
- Browser subpaths may reference DOM globals.
- WebGPU subpaths may reference WebGPU globals.
- Feature packages must not import `@aperture-engine/app`.
- `render` must not import `ui` implementation modules.
- `particles` must not import `render`.
- `render` may import `particles` pure domain types only after the particle
  domain package is render-free.

Adding `ui` or `particles` to a single existing headless package list is not
enough. The package checker and headless/global checker need separate coverage,
and the new feature/app/render rules need new logic.

## Testing Plan

### Unit Tests

- Feature resolution order.
- Stable feature order across config key permutations.
- Feature dependency validation.
- Duplicate feature detection.
- Missing required feature diagnostics.
- Conflict diagnostics.
- Install rollback after mid-sequence failure.
- Reverse-order dispose.
- `registerRealizer` disposer invokes `realizer.dispose()` once.
- Async worker setup completes before extraction hooks are registered.
- Component registration idempotency.
- Asset registration idempotency.
- Fixed-step unregister on physics dispose.
- UI extraction install before first extraction.
- Particle burst queue migration.

### Integration Tests

- `createApertureApp` with compatibility config.
- `createApertureApp` with proposed feature config.
- `createApertureApp` with UI disabled emits zero UI packets.
- `createApertureApp` with particles disabled emits zero particle packets.
- Physics feature with Rapier backend.
- Physics feature missing backend diagnostic.
- UI plus particles in the same frame.
- Realizer throw is isolated and diagnosed.
- Extractor throw is isolated and diagnosed.
- Worker resolver can compose worker feature modules without importing browser
  or WebGPU phase modules.
- Headless CLI/MCP tooling can create, step, extract, and report status with the
  feature resolver enabled.

### Render and Snapshot Tests

- Snapshot inspection includes feature packet counts.
- Packed snapshot behavior is explicit for each feature packet family.
- UI packets remain JSON-safe.
- UI packed encoding exists or transferable fallback is asserted.
- Particle packet ABI remains stable.
- Particle packet packed encoding remains stable.
- WebGPU feature realizers do not access ECS.
- WebGPU command groups validate phase and sort-key requirements.
- WebGPU command merge order is
  `opaque -> alpha-test -> transparent -> post -> overlay`.
- Feature `post` groups remain internal/provisional until a real use case is
  accepted.

### Boundary and Size Tests

- Boundary checker rejects `particles -> render`.
- Boundary checker rejects `feature -> app`.
- Boundary checker rejects `render -> ui implementation`.
- UI root rejects DOM globals.
- UI/browser permits DOM globals.
- Yoga bundle-weight impact is measured before default/preset decisions.
- Diagnostics catalog generation passes with all new feature diagnostic codes.
- Read-only ECS and asset view types expose no mutating methods.

### E2E Tests

- UI HUD.
- UI interaction.
- GPU particles.
- Particle bursts.
- Physics worker mode.
- A mixed scene with UI, particles, and physics.

## Documentation Updates

Update or add:

- `docs/ARCHITECTURE.md`: package taxonomy and feature lifecycle.
- `docs/DECISIONS.md`: accepted decision once this architecture is implemented.
- `docs/UI_PACKAGE_PLAN.md`: current state and migration steps.
- `docs/particles-shuriken-alignment-plan.md`: package ownership update.
- `docs/AUTHORING.md`: feature config examples.
- `docs/DIAGNOSTICS_CATALOG.md`: new feature diagnostics after catalog
  generation.
- Package READMEs for `ui`, `particles`, `physics`, `physics-rapier`, and
  `app`.

## Open Decisions

- Whether UI is opt-in, preset-only, or part of a default preset before packed
  UI snapshot encoding exists.
- Whether feature-provided `post` command groups should ever be public, or stay
  internal until a concrete feature needs them.
- Whether physics backends remain a physics config slot, or become independent
  features after a capability cardinality model exists.
- Whether `runtime -> physics` compatibility re-exports are removed, narrowed to
  neutral fixed-step/clock contracts, or kept as a documented legacy surface.
- When the render fallback UI extractor and legacy re-exports can be removed.
  Removal requires an explicit migration window and passing fallback-diagnostic
  gates.

## Risks

### Over-Generalization

A feature system can become a second engine API if it exposes too much. Keep
contexts narrow and phase-specific.

### Missing Teardown

Install-only features break tests, scene reload, HMR, live reconfiguration, and
backend cleanup. Teardown is part of the core contract.

### Command Ordering Bugs

Loose command concatenation is not enough once multiple realizers produce
transparent or overlay work. Command groups need explicit phase and sort-key
metadata.

### Snapshot Drift

If feature packets are too dynamic, `RenderSnapshot` becomes hard to inspect,
pack, test, and transport. Packet families must be typed and versioned.

### Async Setup

Features such as Yoga need async initialization. The app must not allow first
extraction to run before required async feature setup completes.

### Backward Compatibility

Existing users may import UI and particle APIs through `render`, `runtime`, or
app-facing barrels. Use temporary re-exports and deprecation notes before
deleting old paths.

### WebGPU API Leakage

WebGPU feature realizers can easily become renderer-internals-as-public-API.
Start with first-party realizers and keep the public contract small.

### Default Bundle and Transport Cost

Installing UI by default may add Yoga/WASM weight to default apps. UI also
affects snapshot transport until packed UI encoding exists. Decide whether UI is
default, opt-in, or preset-only with those costs visible.

## Recommended Sequence

1. Finalize the feature contract with teardown, deterministic ordering, typed
   diagnostics, rollback, phase-specific resolver dispatch, and command-group
   ordering.
2. Co-design that contract against UI and particles on paper before treating it
   as stable.
3. Build the resolver, worker/browser/WebGPU dispatch split, and new
   boundary-check logic.
4. Convert physics as a conformance test of runtime installation and teardown.
5. Split `@aperture-engine/ui/browser` and clean the UI root barrel.
6. Install UI through the feature path while keeping render fallback layout as a
   diagnosable rollback path.
7. Move UI authoring ownership from render to UI with compatibility re-exports.
8. Create `@aperture-engine/particles`.
9. Move particle domain enums/value constants first, then move particle domain
   ownership from render to particles with compatibility re-exports.
10. Introduce WebGPU feature realizer registration internally.
11. Convert UI and particles WebGPU preparation to ordered first-party
    realizers.
12. Decide whether to externalize `ui/webgpu` and `particles/webgpu`.
13. Decide UI default/preset behavior after bundle and transport measurements.
14. Remove legacy fallback/re-export paths only after a separate migration
    window and explicit stability gates.

## Decision Summary

Use feature packages as app/runtime composition units.

Do not use a broad render plugin model.

Make teardown, deterministic ordering, typed diagnostics, and rollback part of
the first contract.

Keep the wire contract explicit in `@aperture-engine/render`.

Keep live GPU resources in `@aperture-engine/webgpu`.

Let focused feature packages own their domain logic.

Let `@aperture-engine/app` compose the features.
