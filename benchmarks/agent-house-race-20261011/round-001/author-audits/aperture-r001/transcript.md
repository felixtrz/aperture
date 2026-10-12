# Public operational transcript

Lane `aperture-r001` (aperture). Raw wall time 1125.482s; preview waiting 305.404s; active budget time 820.079s.

35 commands, 4 unsuccessful exits, 0 identical-command retries after failure.

This contains public tool operations only. Exact binary stdout/stderr survives beside each command record; text below decodes UTF-8 with non-UTF-8 bytes escaped and makes no inference about private model reasoning.

## Command 875dd05aac914938b209ea3c2f81add1

2026-10-11T23:39:14.409832+00:00 → 2026-10-11T23:39:14.528914+00:00; exit 0; duration 0.119s.

Command:

```sh
cat /reference/prompt.txt
```

Stdout:

````text
Assigned engine: Aperture, current working-tree SDK snapshot. Dependencies are preinstalled from /sdk/packages. Public docs and package sources are read-only at /sdk/docs, /sdk/docs-site-src and /sdk/source. CLI is installed. Follow the normal simulation worker, ECS, extraction snapshot and main-thread WebGPU design. Do not bypass this with a main-thread authoritative scene or another renderer.

Build a polished, moderately detailed, genuinely three-dimensional scene matching the supplied reference image. Author the house exterior with ivory stucco, terracotta tiled gable roof and chimney, dark framed inset windows, covered front porch with two posts and a door, stone path, low stone garden boundary, shrubs/trees, mailbox, curved asphalt road across the foreground and right side with curbs and broken white markings, and a blue hatchback with four wheels, body contour, glass windows, lights and trim. The distant landscape is optional. Match the warm daylight and composition. Details should remain convincing from other views. Geometry, materials, procedural textures, instancing and batching are allowed. Do not use the reference image as a texture, background or billboard; do not bake the scene into a picture. No external ready-made house/car scene or image-generation tool. You may use public assigned-engine docs and inspect its installed source.

Use only your assigned engine's actual native WebGPU renderer, with no WebGL fallback or third-party renderer. Use the common interface below. Do not alter native APIs, fake measurements or introduce timing delays. Real submitted geometry must be returned by inspectGeometry. Every visible mesh and instance must be represented. Do not add an animation loop after registration. Supply a buildable Vite application with `pnpm run build` producing /work/dist.

You have 1800 seconds of active authoring budget, beginning when you call start. Dependency installation has already been completed. The recorder separately retains raw wall time and renderer waiting time. You may request at most three previews using the recorder; the coordinator returns only your own canvas views or actual runtime errors, without implementation advice. Preview waiting is credited equally. When finished, stop all application processes, build the final app, record a public note describing your implementation and any limitations, and call finish. After finish, make no edits.

Isolation and operational transcript rules: You start with no inherited chat. Do not contact other agents, use collaboration tools, inspect other workspaces, history, root repository, benchmark results, private provider/session data, or environment credentials. All searches, reads, shell commands and edits MUST run through the exact recorder command below. It invokes your command inside your assigned container at /work. Do not call apply_patch or unrecorded host exec commands. Use ordinary Python/Node/heredocs inside that recorded command to edit files. You can inspect the supplied image and returned preview PNGs with view_image; log each image inspection with recorder note. Do not dump the process environment or access secrets. Tools are routed cooperatively; the command container enforces filesystem separation. No browser launches, dev servers left running, Playwright installs, sandbox/flag changes or alternate rendering routes. Preview is the available browser tool.

The only host command entrypoint is:
`python3 /workspace/aperture/tools/agent-benchmark/author-lane.py aperture-r001 ACTION [TEXT]`
Actions: start; note PUBLIC_TEXT; exec SHELL_SCRIPT; preview; finish. Quote each shell script as one argument. This records the exact script, stdout, stderr, timestamps and exit status. A command process group is stopped at command end, so a background server cannot persist between commands. You should use functions.exec -> tools.exec_command only with this entrypoint (including no extra shell operations). Capture all failures and retries. The prompt/reference hashes and source hashes are recorded. These are visible operational records, never private reasoning.

Reference image for view_image: /workspace/aperture/.aperture-env/agent-house-race/lanes/round-001/aperture/public/reference.png
Assigned container workspace /work. Common interface available /reference/contract.md. Reference is /reference/reference.png. Your own prompt is /reference/prompt.txt.

# Agent house benchmark contract

The editable harness lives here. Trial sources, reference images, authentic
visible author transcripts, raw measurements and images belong in separate,
append-only attempt directories under `benchmarks/agent-house-race-20261011/`.
Neither author receives the other author's work or benchmark scores.

## Application interface

The built application registers this object on `globalThis.__AGENT_BENCHMARK__`:

```ts
interface BenchmarkAdapter {
  engine: "three" | "aperture";
  canvas: HTMLCanvasElement;
  ready: Promise<void>;
  setCamera(camera: {
    position: number[];
    target: number[];
    fovYDegrees: number;
    near: number;
    far: number;
  }): Promise<void>;
  renderFrame(frame: {
    frame: number;
    deltaSeconds: number;
    timeSeconds: number;
  }): Promise<void>;
  inspectGeometry(): Promise<{
    meshes: {
      id: string;
      positions: number[] | Float32Array;
      indices?: number[] | Uint16Array | Uint32Array;
      normals?: number[] | Float32Array;
      worldMatrix: number[] | Float32Array; // column-major, 16 values
      instances?: (number[] | Float32Array)[]; // world matrices; replaces worldMatrix
    }[];
  }>;
  dispose(): Promise<void>;
}
```

There must be exactly one 1024 × 768 display canvas, with device pixel ratio 1.
The scene occupies approximately 24 × 24 world units. The house is near the
origin, the curved road runs across the foreground and right side, and the blue
car sits on that road. The canonical camera is `[14, 9, 19]`, looking at
`[0, 2.5, 1]`, with vertical FOV 37°, near 0.1 and far 200. Use ACES tonemapping,
exposure 1, 4× MSAA, a shadow-casting sun, an ambient fill and shadow receivers.
These settings and camera views apply equally to both applications.

Rendering is controlled by the harness. Do not run an animation loop after
registration. `renderFrame` resolves only after that requested frame has been
submitted to the native WebGPU queue. Do not add an artificial queue wait;
the harness owns queue fences. Camera updates must affect the next submitted
frame. Aperture keeps its normal simulation worker, ECS and extraction boundary;
the adapter waits for a worker snapshot before submitting that snapshot.
Three.js must use its WebGPU renderer without WebGL fallback.

`inspectGeometry` reads the actual scene mesh buffers, including all visible
objects and instance transforms. It must not return decorative estimates.
Avoid duplicated mesh entries for one rendered instance. The harness computes
counts, bounds, degeneracy and unique geometry from these arrays. It also attempts
to match position streams against native `writeBuffer`/mapped buffer uploads.
Unmatched streams remain explicitly lower-confidence; an independently audited
source and surviving geometry arrays are required before geometry claims.

The harness is injected before the app boots. Authors need only implement this
interface; they must not import the measurement client or modify native APIs.

````

Stderr:

```text

```

## Public note — 2026-10-11T23:39:17.472976+00:00

```
Inspecting the supplied visual reference before authoring.
```

## Command 9dbb0a97a25c4bf49726aff1274878a3

2026-10-11T23:39:21.569680+00:00 → 2026-10-11T23:39:21.687381+00:00; exit 0; duration 0.118s.

Command:

```sh
pwd; rg --files /work /sdk/docs /sdk/docs-site-src | head -80; cat /work/package.json
```

Stdout:

```text
/work
{
  "name": "house-aperture",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.12.1",
  "scripts": {
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "8.0.16",
    "typescript": "6.0.3",
    "prettier": "3.8.3"
  },
  "dependencies": {
    "@aperture-engine/app": "file:/sdk/packages/aperture-engine-app-0.3.0.tgz",
    "@aperture-engine/audio": "file:/sdk/packages/aperture-engine-audio-0.3.0.tgz",
    "@aperture-engine/cli": "file:/sdk/packages/aperture-engine-cli-0.3.0.tgz",
    "@aperture-engine/math": "file:/sdk/packages/aperture-engine-math-0.3.0.tgz",
    "@aperture-engine/particles": "file:/sdk/packages/aperture-engine-particles-0.3.0.tgz",
    "@aperture-engine/physics": "file:/sdk/packages/aperture-engine-physics-0.3.0.tgz",
    "@aperture-engine/physics-rapier": "file:/sdk/packages/aperture-engine-physics-rapier-0.3.0.tgz",
    "@aperture-engine/reference-assets": "file:/sdk/packages/aperture-engine-reference-assets-0.3.0.tgz",
    "@aperture-engine/render": "file:/sdk/packages/aperture-engine-render-0.3.0.tgz",
    "@aperture-engine/runtime": "file:/sdk/packages/aperture-engine-runtime-0.3.0.tgz",
    "@aperture-engine/simulation": "file:/sdk/packages/aperture-engine-simulation-0.3.0.tgz",
    "@aperture-engine/ui": "file:/sdk/packages/aperture-engine-ui-0.3.0.tgz",
    "@aperture-engine/vite-plugin": "file:/sdk/packages/aperture-engine-vite-plugin-0.3.0.tgz",
    "@aperture-engine/webgpu": "file:/sdk/packages/aperture-engine-webgpu-0.3.0.tgz"
  },
  "pnpm": {
    "overrides": {
      "@aperture-engine/app": "file:/sdk/packages/aperture-engine-app-0.3.0.tgz",
      "@aperture-engine/audio": "file:/sdk/packages/aperture-engine-audio-0.3.0.tgz",
      "@aperture-engine/cli": "file:/sdk/packages/aperture-engine-cli-0.3.0.tgz",
      "@aperture-engine/math": "file:/sdk/packages/aperture-engine-math-0.3.0.tgz",
      "@aperture-engine/particles": "file:/sdk/packages/aperture-engine-particles-0.3.0.tgz",
      "@aperture-engine/physics": "file:/sdk/packages/aperture-engine-physics-0.3.0.tgz",
      "@aperture-engine/physics-rapier": "file:/sdk/packages/aperture-engine-physics-rapier-0.3.0.tgz",
      "@aperture-engine/reference-assets": "file:/sdk/packages/aperture-engine-reference-assets-0.3.0.tgz",
      "@aperture-engine/render": "file:/sdk/packages/aperture-engine-render-0.3.0.tgz",
      "@aperture-engine/runtime": "file:/sdk/packages/aperture-engine-runtime-0.3.0.tgz",
      "@aperture-engine/simulation": "file:/sdk/packages/aperture-engine-simulation-0.3.0.tgz",
      "@aperture-engine/ui": "file:/sdk/packages/aperture-engine-ui-0.3.0.tgz",
      "@aperture-engine/vite-plugin": "file:/sdk/packages/aperture-engine-vite-plugin-0.3.0.tgz",
      "@aperture-engine/webgpu": "file:/sdk/packages/aperture-engine-webgpu-0.3.0.tgz"
    }
  }
}
```

Stderr:

```text
/bin/sh: 1: rg: not found
```

## Command 0beb025b135c4c2baae09a524fdbeaba

2026-10-11T23:39:25.352709+00:00 → 2026-10-11T23:39:25.470923+00:00; exit 2; duration 0.118s.

Command:

```sh
find /sdk/docs /sdk/docs-site-src -maxdepth 2 -type f | head -70; find /work -maxdepth 2 -type f; ls /sdk/source/packages
```

Stdout:

```text
/sdk/docs/AGENT_AUTHORING_BASELINE.md
/sdk/docs/VISUAL_QUALITY.md
/sdk/docs/AUTHORING.md
/sdk/docs/DECISIONS.md
/sdk/docs-site-src/components/ShowcaseCards.tsx
/sdk/docs-site-src/components/ApiPackageList.tsx
/sdk/docs-site-src/components/ReferenceSearch.tsx
/sdk/docs-site-src/components/ExampleGallery.tsx
/sdk/docs-site-src/systems/daynight.system.ts
/sdk/docs-site-src/systems/setup.system.ts
/sdk/docs-site-src/layouts/DocsLayout.astro
/sdk/docs-site-src/styles/docs.css
/sdk/docs-site-src/content/api.generated.json
/sdk/docs-site-src/content/examples.generated.json
/sdk/docs-site-src/content/docs.ts
/sdk/docs-site-src/content/showcases.ts
/sdk/docs-site-src/lib/city-layout.ts
/sdk/docs-site-src/lib/hero-story.ts
/sdk/docs-site-src/lib/hero-layout.ts
/sdk/docs-site-src/pages/index.astro
/work/src/main.js
/work/pnpm-lock.yaml
/work/node_modules/.modules.yaml
/work/node_modules/.pnpm-workspace-state.json
/work/package.json
/work/index.html
```

Stderr:

```text
ls: cannot access '/sdk/source/packages': No such file or directory
```

## Command 69584f06b7b149e38c3f62400b7a46e9

2026-10-11T23:39:28.614658+00:00 → 2026-10-11T23:39:28.733168+00:00; exit 0; duration 0.119s.

Command:

```sh
cat /sdk/docs/AGENT_AUTHORING_BASELINE.md /sdk/docs/AUTHORING.md /sdk/docs/VISUAL_QUALITY.md; cat /work/src/main.js; ls /sdk/source
```

Stdout:

````text
# Agent authoring baseline

This offline task suite measures concrete authoring outcomes through the existing
headless/tooling surface. It complements unit tests; it is not a model benchmark,
GPU screenshot test, or a claim about time saved by an agent.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run test/cli/agent-authoring-journeys.test.ts test/app/devtools-camera-framing.test.ts test/cli/camera-framing-tools.test.ts
```

The suite uses seed 42 for authoring journeys and a local committed GLB
(`examples/developer-api/public/assets/cube.glb`). It runs strict asset loading
with HTTP disabled and verifies that no asset placeholders were substituted.
Tests create fresh worlds and require no browser, embedding model, or account.
The repository's shuffled test order remains enabled.

## Journey contracts

| Journey                   | Required outcome                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| First scene               | Boot, settle, find a keyed mesh, read its transform, extract a mesh draw                         |
| GLB import and edit       | Inspect real imported mesh data, resolve the imported root, edit scale and verify the result     |
| Compose and revise        | Capture an ECS checkpoint, edit a transform, read it back and report exactly one changed entity  |
| Diagnose an edit          | Reject an unsupported field with an actionable diagnostic and preserve the authored transform    |
| Interaction and replay    | Inject a semantic button, move the subject through an authored system, reset the seed and replay |
| Frame unfamiliar geometry | Fit unknown dimensions and hierarchies, then verify bounds with actual extracted camera matrices |

The first five journeys already passed on the baseline implementation. They
protect existing strengths rather than implying those workflows were missing.

## Framing experiment

`camera_fit_entity` preserves its existing point-plus-radius contract. Without
an explicit radius, all six controlled shape cases place the camera five units
from the subject origin. The distance alone is sufficient for only two of the
six complete AABBs, even assuming an ideal orientation:

| Case                     | Dimensions         | Aspect | Fixed distance 5 contains bounds |
| ------------------------ | ------------------ | ------ | -------------------------------- |
| Unit cube                | 1 × 1 × 1          | 1      | Yes                              |
| Large cube               | 20 × 20 × 20       | 1      | No                               |
| Tall product             | 2 × 20 × 2         | 1.5    | No                               |
| Wide product in portrait | 20 × 2 × 2         | 0.5    | No                               |
| Tiny prop                | 0.01 × 0.01 × 0.01 | 1      | Yes                              |
| Deep assembly            | 2 × 2 × 20         | 1      | No                               |

This baseline intentionally isolates radius adequacy from legacy camera
orientation behavior. It is not a six-task agent success rate, nor a diagnosis
that a caller-supplied radius is incorrect.

The new `camera_frame_entities` succeeds on all six cases without caller-side
bounds calculations or radius guesses. The test projects all eight aggregate
bounds corners with the actual extracted Float32 view-projection matrix,
checking positive clip W, X/Y margin and WebGPU depth in [0, 1]. Additional
acceptance coverage includes:

- A real GLB root with nested meshes, rotated/nonuniform/negative scales
- Perspective and orthographic cameras, narrow portrait viewports and near-pole angles
- Overlapping and disjoint selections, exclusion of descendants, and repeat calls
- An initially offscreen subject with no extracted mesh draws
- Immediate extraction after framing, with no simulation step to refresh the camera
- Headless and generated-worker routing, including cameras created after viewport resize
- A deterministic 48-case size/aspect/angle grid for each projection
- Invalid selectors, ancestor hierarchies, empty/unavailable/invalid source bounds,
  and Float32 precision errors that preserve authored camera state

## Scope of evidence

The fit is based on static mesh-source AABBs. Selected hidden or differently
layered meshes still contribute; animated skin/morph/shader displacement is not
measured. Projection containment does not establish material correctness,
lighting, occlusion, scissor visibility, or rendered pixels. Final visual
acceptance still requires `render_diagnose`/`frame_capture` and a working WebGPU
browser.

See [AI tooling](AI_TOOLING.md#frame-an-imported-model-or-composed-scene) for the
public call contract and result fields.

## Editing-affordance experiment

`test/cli/entity-editing-affordances.test.ts` covers the inspection/edit/read-back
journey using published MCP argument shapes and runtime mutation metadata.
Previously the seven entity query/selection/schema/mutation/checkpoint tools
advertised only routing keys (`target`, `appRoot`). The component schema exposed
storage types but no machine-readable editing permissions.

The expanded contracts now describe selectors, nested queries, imported-source
filters, snapshot labels/references and complete mutation values. A camera
schema identifies its 10 allowlisted fields and 9 read-only fields directly from the
existing registry. Original type values, enum maps and defaults are unchanged.

Acceptance covers valid edits, readonly-field and nested-path rejections,
unchanged numeric/quaternion checks, runtime-spawned custom schema visibility,
source matching, selector-history fallback, and JSON-RPC serialization. Mutating
a returned metadata list does not grant any additional writing capability.
These are deterministic contract checks, not measured agent success rates or
claims of superiority over another library.

## Transform-group composition

`test/app/spawn-group.test.ts` compares `spawn.group` against the prior explicit
entity/metadata/transform-component construction recipe. The helper produces the
same ordinary ECS state while avoiding that low-level boilerplate. It allocates
no mesh, material or other rendering asset.

Acceptance checks nested local transforms, world-preserving reparenting through
the existing hierarchy API, sibling isolation after revision, recursive teardown,
failed-construction cleanup, and a real GLB plus procedural base surviving a
session snapshot/restore. The restored assembly is framed and extracted through
the existing tools. This is structural evidence; no new visual-parity claim is
made from it.

## Native procedural authoring loop

The cross-feature acceptance test runs the built Node CLI as a separate process,
so Vitest's source aliases cannot substitute for shipped package imports:

```sh
pnpm run build
pnpm exec vitest run test/cli/procedural-authoring-native.test.ts
```

It writes a temporary app configuration and TypeScript system, then talks to
`aperture mcp stdio` using JSON-RPC. The system authors a transform-only group,
a low-poly torus, a box, lights and a camera. Each independently parameterized
mesh has its own key, preserving the facade's existing asset-identity contract.

The test discovers tool schemas and writable transform fields, edits the group,
checks unchanged child-local transforms and updated world transforms, and compares
matching ECS checkpoint selectors. It frames the complete assembly, saves a session,
resets and restores it, then verifies authored state with remapped parent references.
Finally it exports a real-asset render bundle and checks both mesh draws, all four
mesh/material entries, and complete dependency closure without placeholders.

Build before running the test; it intentionally does not rebuild while parallel
test workers may be reading `dist`. Temporary app files and the exact child process
are cleaned up after the test. This closes the native module-loading and MCP
integration loop, but does not execute a WebGPU renderer or validate pixels.
# Authoring Aperture Apps

The default Aperture app is a Vite app with an `aperture.config.ts` file and
worker-discovered ECS systems. The Vite plugin owns browser bootstrap, worker
bundling, asset preload, render extraction, snapshot transport, WebGPU
submission, resize, input forwarding, command forwarding, and diagnostics.

You should be able to see a primitive mesh or GLB without calling
`createWebGpuApp()`, `createExtractionApp()`, `stepAndExtract()`, posting render
snapshots, registering renderer-side assets, or writing a main-thread scene
graph.

## First App Shape

Normal browser apps use this shape:

- `vite.config.ts`: installs the Aperture Vite plugin.
- `aperture.config.ts`: declares mode, canvas, systems, assets, render defaults,
  input actions, signals, and diagnostics.
- `src/systems/*.system.ts`: default-export ECS system classes that run in the
  simulation worker.
- `index.html`: contains the configured canvas.

`index.ts` is not required for the first scene.

```html
<canvas id="aperture"></canvas>
```

## CLI Templates

`@aperture-engine/cli` can scaffold app roots without a separate create package:

```sh
npx @aperture-engine/cli create my-app
npx @aperture-engine/cli create viewer --template glb-viewer
npx @aperture-engine/cli create game --template game
```

Available templates:

- `minimal`: primitive cube, setup/spin systems, input action, signal, AI
  adapter files, and render quality defaults.
- `glb-viewer`: local `public/assets/sample-cube.glb`, blocking GLB asset
  manifest entry, setup system, orbit system, stable `viewer.sampleCube` key,
  and deterministic priorities.
- `game`: local GLB collectible asset, player movement input actions, score and
  goal signals, camera follow, collectible/goal state, and deterministic
  priorities.

Generated apps include `.mcp.json`, `.codex/config.toml`, Claude/Cursor/Copilot
adapter files, and scripts for `dev`, `build`, and `typecheck`.

## Vite Config

```ts
import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [aperture()],
});
```

`@aperture-engine/vite-plugin` is the canonical plugin import. The root
`@aperture-engine/app` entry does not export the plugin because Vite plugin code
is Node/build-time code. `@aperture-engine/app/vite` re-exports the same plugin
as an optional convenience subpath, but this guide uses the canonical package.

## Aperture Config

```ts
import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/floor.png", { preload: "background" }),
    decal: asset.texture("/assets/decal.png", { preload: "manual" }),
  },
  signals: {
    selectedEntity: signal.ref(null),
    gameplayMode: signal.string("edit"),
  },
  input: {
    actions: {
      select: input.button([input.pointer("primary")]),
      jump: input.button([input.key("Space"), input.gamepadButton("south")]),
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["ArrowLeft", "KeyA"],
          positiveX: ["ArrowRight", "KeyD"],
        }),
        input.gamepadStick("left"),
      ]),
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "warn",
  },
});
```

Asset preload policies:

- `blocking`: loaded before the first simulation tick.
- `background`: starts immediately and exposes readiness signals to systems.
- `manual`: registered in the manifest and loaded when a system or command
  requests it.

Headless apps use the same config shape with `mode: "headless"` and no canvas.
The same system files can run in browser and headless mode.

Generated browser apps default to 4x MSAA when `render.sampleCount` is omitted.
Use `sampleCount: 1` to opt out for performance-sensitive apps. Canvas backing
size follows device pixel ratio capped by `render.maxPixelRatio`, which defaults
to `2`; use `render.pixelRatio` when an app needs an exact fixed backing-scale
policy. Generated diagnostics report the CSS size, backing size, effective pixel
ratio, aspect ratio, and MSAA state.

## Setup System

Scene setup is ECS startup work in a worker system, not mutation of a
main-thread app object.

```ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({
  priority: 0,
}) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 1.5, 5],
        lookAt: [0, 0.75, 0],
      },
      fovYDegrees: 60,
    });

    this.spawn.light({
      key: "light.key",
      name: "key-light",
      kind: "directional",
      intensity: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });

    this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      tags: ["interactive", "crate"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [1, 0.55, 0.25, 1],
        roughness: 0.55,
        metallic: 0.05,
      }),
      transform: { translation: [-1, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      tags: ["asset", "robot"],
      transform: { translation: [1, 0, 0] },
    });
  }
}
```

`name` is a debugging label. `key` is optional app-authored identity when a
globally unique stable lookup is useful. `tags` are optional discovery metadata
for tools and diagnostics. The canonical runtime identity remains
`{ index, generation }`.

## Primitive And GLB Spawning

Use `this.spawn.mesh(...)` for built-in primitives and
`this.spawn.gltf(...)` for config-declared GLB assets:

```ts
this.spawn.mesh({
  key: "level.floor",
  name: "floor",
  mesh: mesh.plane({ size: [6, 6] }),
  material: material.standard({ baseColor: [0.85, 0.88, 0.9, 1] }),
  transform: {
    rotationEulerDegrees: [-90, 0, 0],
  },
});

this.spawn.gltf(this.assets.gltf("robot"), {
  key: "level.robot",
  transform: { translation: [1, 0, 0] },
});
```

The high-level GLB path hides loader reports, source asset transfer packages,
renderer-side registration, primitive material resolution, ECS command planning,
and ECS replay. Systems consume typed config handles and the generated runtime
mirrors render assets to WebGPU.

### Subdivided planes

`mesh.plane({ size: [width, height], subdivisions: 8 })` creates an XY-plane
grid with eight cells along each axis. It has 81 shared vertices and 128
triangles, positive-Z normals and UVs spanning 0–1. Rotate the plane through
its entity transform to use it as a ground surface. Subdivision adds vertices;
it does not displace them or create terrain height automatically.

`subdivisions` defaults to 1. Finite values are floored and clamped to 1–128;
non-finite values use 1. The default preserves the original four-vertex plane.
For unequal grid dimensions, the lower-level `createPlaneMeshAsset` factory
accepts separate `widthSegments` and `heightSegments` options.

### Ring-shaped procedural parts

Use `mesh.torus` for a ring, tire, or handle without lower-level mesh-registry
plumbing. It routes directly to the existing `createTorusMeshAsset` factory:

```ts
this.spawn.mesh({
  key: "vehicle.frontWheel.ring",
  mesh: mesh.torus({
    label: "Low-poly wheel ring",
    majorRadius: 0.8,
    tubeRadius: 0.2,
    radialSegments: 12,
    tubeSegments: 6,
  }),
  material: material.standard({
    baseColor: [0.12, 0.13, 0.15, 1],
    roughness: 0.9,
  }),
  transform: {
    translation: [0, 1, 0],
    rotationEulerDegrees: [90, 0, 0],
  },
  castShadow: true,
  receiveShadow: true,
});
```

The default ring lies in the XZ plane around the Y axis; the example rotates it
upright. `majorRadius` measures from the center to the tube center, while
`tubeRadius` is the tube's cross-section radius. Choose `majorRadius > tubeRadius`
for an open center. `radialSegments` goes around the ring and `tubeSegments`
around its cross-section. Lower counts give controllable low-poly silhouettes.

Defaults match the underlying factory: `majorRadius: 0.75`, `tubeRadius: 0.25`,
`radialSegments: 32`, `tubeSegments: 12`, and label `"Torus"`. Nonpositive or
non-finite radii fall back to those defaults. Finite segment counts are floored
and clamped to 3–128; non-finite counts use 3. This is the existing factory's
normalization, not a new validation or geometry implementation.

Use unique entity keys for independently parameterized primitives. The app
facade retains key/name-based mesh-handle identity for explicitly keyed or
named spawns. If both are omitted, each spawned entity gets independent mesh
and material assets, so later anonymous primitives cannot change its geometry
or appearance. Anonymous asset IDs are deterministic for the same entity-creation
sequence and initial registry state;
use explicit handles when sharing assets is intentional. This does not introduce
content-addressed deduplication. Assets are registry-owned and remain available
after an entity is destroyed; for repeated spawn/despawn of identical parts,
reuse explicit mesh and material handles rather than allocating new descriptors.

`spawn.mesh` converts both descriptors and validates its ordinary metadata,
transform, and physics inputs before publishing descriptor assets. If those
steps throw, the partial entity is destroyed, existing registry entries stay
unchanged, and you can correct the input and retry the same key. Duplicate-key
failures also discard the new entity and leave the original entity intact.
Successful named/keyed spawns retain their existing asset-replacement behavior;
explicit handles are reused without republishing. Assets are ready when a
synchronous query requiring `Mesh` and `Material` observes the new entity.
This is input-failure recovery, not a general transaction: throwing user
accessors, query observers, or overridden registry methods can have side effects
that are not rolled back. Failed attempts may advance ECS entity generations.

`TorusMeshDescriptorOptions` is exported from
`@aperture-engine/app/systems`, and supports exactly the factory's options.
Tori can be children of `spawn.group`, included in snapshots and render bundles,
and inspected with the same mesh-bounds framing tools.

### Custom triangles for roofs, ramps, and irregular props

Use `mesh.triangleList` when primitives cannot express a part's silhouette.
Author local-space position tuples and optional indices; each consecutive triple
is one triangle. Counterclockwise winding is front-facing. For example, this
closed triangular roof uses six positions and eight outward-facing triangles:

```ts
import { mesh, material } from "@aperture-engine/app/systems";

this.spawn.mesh({
  key: "house.roof",
  mesh: mesh.triangleList({
    label: "Low-poly roof",
    positions: [
      [-1, 0, 1],
      [1, 0, 1],
      [0, 1, 1],
      [-1, 0, -1],
      [1, 0, -1],
      [0, 1, -1],
    ],
    indices: [
      0,
      1,
      2,
      3,
      5,
      4, // gables
      0,
      3,
      4,
      0,
      4,
      1, // underside
      0,
      2,
      5,
      0,
      5,
      3, // left slope
      1,
      4,
      5,
      1,
      5,
      2, // right slope
    ],
  }),
  material: material.standard({ baseColor: [0.6, 0.16, 0.07, 1] }),
  transform: { translation: [0, 2, 0] },
  castShadow: true,
  receiveShadow: true,
});
```

Keep the generated app's daylight environment, a shadow-casting sun and ground
receiver; see [Visual Quality](./VISUAL_QUALITY.md) for the lighting recipe.
This is ordinary ECS mesh authoring and uses the existing triangle-list render,
spatial-query, asset-mirror and snapshot paths.

The options are intentionally small:

- `positions`: required array of `[x, y, z]` tuples, at least three vertices
- `indices`: optional number array, `Uint16Array` or `Uint32Array`; zero-based
  integers referencing source positions. Without indices, positions are consumed
  in triples. The triangle corner count must be a positive multiple of three
- `normals`: optional `[nx, ny, nz]` tuples, exactly one per source position.
  Nonzero explicit normals are normalized and preserve the authored vertex/index
  layout. Omit normals for flat shading: the factory expands each face's three
  corners and computes its own normal, so shared positions keep crisp edges
- `uvs`: optional `[u, v]` tuples, exactly one per source position, remapped when
  flat faces expand. Missing UVs are `[0, 0]`; this helper does not unwrap a mesh
- `label`: optional string, default `"TriangleList"`

To share indexed vertices with authored smooth normals, a ramp surface can use
`positions: [[0,0,0], [2,1,0], [2,1,-1], [0,0,-1]]`,
`indices: [0,1,2, 0,2,3]` and four `[-1,2,0]` normals. Explicit normals are
not generated, welded or crease-angle averaged. Winding is unchanged even if
supplied normals face another direction. For two-sided surfaces, author both
sides or choose an appropriate material render state.

Every coordinate, normal and UV must be finite after conversion to float32.
Faces with zero-area after this conversion (including repeated indices or
positions that round together) are rejected with their triangle number and
source range. Normals must remain nonzero, all attribute counts must match, and
bounds must fit finite float32 storage. Invalid app inputs throw
`aperture.spawn.invalidTriangleListMesh` with `detail.path` and a suggested fix;
validation completes before mesh asset publication. Correct the input and retry
the same entity key; the failed attempt does not retain a partial mesh entity.

The resulting asset owns its buffers and bounds; later input mutation cannot
change it. Like other descriptors, `mesh.triangleList` shallow-copies its options
and reads nested arrays when spawned. Flat output is non-indexed. Explicit-normal
indexed output uses `uint16` up to maximum referenced index 65535 and `uint32`
above that, regardless of the input array type. Bounds use stored float32
positions; unused source positions are discarded during flat expansion, but
retained and included in bounds when explicit normals preserve the source layout.
There is one submesh and one material slot; use separate keyed entities for
multi-material parts or the lower-level `MeshAsset` schema for custom layouts.

`TriangleListMeshDescriptorOptions` is exported from
`@aperture-engine/app/systems`. Lower-level consumers can import
`createTriangleListMeshAsset`, `TriangleListMeshOptions`, `TriangleListPosition`,
`TriangleListNormal`, `TriangleListUv`, and `TriangleListMeshError` from
`@aperture-engine/render`; the factory throws the latter (a `RangeError` with a
`path` property). No change to existing primitive normalization is implied.

Repository verification, after `pnpm run build` with a Node version supporting
native TypeScript, can reproduce the roof/ramp scene and a real local GLB import:

```sh
node test/fixtures/triangle-authoring/verify.mjs /tmp/triangle-authoring.json
pnpm exec vitest run test/mesh/triangle-list.test.ts \
  test/app/triangle-list-spawn.test.ts test/cli/triangle-authoring-native.test.ts
```

The first command writes a closure-checked render bundle at the supplied path.
These checks establish source geometry, extraction, bounds, byte round-trips and
package-consumer behavior. They do not verify GPU pixels or measure agent success
against another engine.

### Compose reusable procedural groups

`this.spawn.group(...)` creates a transform-only ECS entity for an assembly.
It accepts the same `name`, unique `key`, `tags` and `transform` metadata as
other spawn helpers, and returns an ordinary `Entity`. It adds no mesh,
material, light, camera, or render asset.

Inside a system's `init`, parent authored parts to that entity:

```ts
const bench = this.spawn.group({
  key: "bench.west",
  name: "West bench",
  tags: ["assembly", "editable"],
  transform: {
    translation: [-2, 0, 0],
    rotationEulerDegrees: [0, 15, 0],
  },
});

this.spawn.mesh({
  key: "bench.west.seat",
  mesh: mesh.box({ size: [2, 0.2, 0.6] }),
  material: material.standard({ baseColor: [0.35, 0.16, 0.07, 1] }),
  transform: { parent: bench, translation: [0, 0.9, 0] },
  castShadow: true,
  receiveShadow: true,
});

for (const [index, x] of [-0.75, 0.75].entries()) {
  this.spawn.mesh({
    key: `bench.west.leg.${index}`,
    mesh: mesh.box({ size: [0.18, 0.8, 0.5] }),
    material: material.standard({ baseColor: [0.12, 0.13, 0.15, 1] }),
    transform: { parent: bench, translation: [x, 0.4, 0] },
    castShadow: true,
  });
}
```

Keep the normal scene lighting/default environment from the templates. This
snippet defines an assembly, not a replacement lighting or rendering setup.
Use a key prefix when building several instances so each entity key stays
unique. Groups can parent other groups, procedural parts, or imported GLB
roots using `transform: { parent: group, ... }`.

Transforms supplied at spawn are local to `transform.parent`; without a parent,
they are root transforms. The usual simulation transform-resolution phase
computes world matrices. Moving/scaling/rotating a group's `LocalTransform`
therefore changes the whole subtree while preserving each part's local values.
For an already-authored entity, `this.hierarchy.setParent(childRef, parentRef)`
is the separate world-preserving reparenting operation and reports unsupported
transform cases.

The authoritative relationship is the ECS `Parent` component. There is no
renderer-owned group object or parallel scene graph. Names/tags, materials,
visibility and other component values are not implicitly inherited by children.
Inspect the full tree through `ecs_get_hierarchy`; use
`this.hierarchy.despawnRecursive({ index: bench.index, generation: bench.generation })`
to remove an assembly and its descendants. A bare `Entity.destroy()` is not the
recursive teardown operation.

Groups participate in ordinary ECS snapshots/restores. Agent tools can find a
group by key, revise its allowlisted local transform, and frame its descendant
mesh bounds with `camera_frame_entities`. Unknown top-level options produce the
existing spawn warning; put `parent` inside `transform`. Failed group
construction does not leave a partial entity behind.

### Imported-model lighting and appearance

Use `spawn.lightRig` for deterministic ECS-owned presentation lighting:

```ts
this.spawn.lightRig({
  key: "lighting.presentation",
  preset: "studio-neutral",
  environmentMap: this.assets.hdr("studioEnvironment"),
  shadows: true,
});
```

The public presets are `studio-neutral`, `outdoor-neutral`, and `none`; their
inspectable definitions are exported as `LIGHT_RIG_PRESETS`. The returned rig
lists its root and light entities and has `remove()` to destroy everything it
owns. Override `environment`, `keyLight`, or `rimLight` without introducing
renderer-only state. `spawn.environment({ source, intensity })` is the direct
single-entity form.

Imported glTF materials use the source policy unless `materials` is provided.
The option accepts `StandardMaterialPatch` or
`material.preset("source" | "painted-stylized" | "matte" | "preview-safe",
overrides?)`. Patches apply to cloned/reused materials for the spawned subtree;
source assets are never mutated. See
[Spawn a glTF scene](recipes/spawn-gltf-scene.md) for the complete field list
and [Lighting imported models](recipes/lighting-imported-models.md) for the
physically faithful and stylized paths.

Light `intensity` is currently a unitless renderer scalar. `illuminance`
continues to work for compatibility but is deprecated because Aperture does
not perform lux conversion. When both are supplied, `intensity` wins and the
authoring diagnostics report the conflict.

Current primitive descriptors include:

- `mesh.box({ size })`
- `mesh.sphere({ radius, segments? })`
- `mesh.capsule({ radius, depth, segments? })`
- `mesh.plane({ size, subdivisions? })`
- `mesh.cylinder({ radius, depth, segments? })`
- `mesh.cone({ radius, depth, segments? })`

## Explicit Heightfield Terrain

Use `mesh.heightfield` for a small, explicit rectangular height grid. It creates
an ordinary open triangle surface with low-poly flat face normals. The same
options are available as `HeightfieldMeshOptions` and
`createHeightfieldMeshAsset` from `@aperture-engine/render`, and as
`HeightfieldMeshDescriptorOptions` from `@aperture-engine/app/systems`.

```ts
this.spawn.mesh({
  key: "terrain.surface",
  mesh: mesh.heightfield({
    width: 8,
    depth: 6,
    heights: [
      [0, 0.2, 0.4, 0],
      [0.1, 0.8, 1.6, 0.1],
      [0, 0.5, 1.1, -0.1],
    ],
  }),
  material: material.standard({ baseColor: [0.22, 0.38, 0.12, 1] }),
  castShadow: true,
  receiveShadow: true,
});
```

Coordinate and topology contract:

- `heights[row][column]` is the local Y coordinate, in scene units. Negative
  heights are allowed; values are not normalized, scaled, or recentered
- Rows advance +Z and columns advance +X. `width` is total X extent and `depth`
  total Z extent, both centered on zero and defaulting to 1
- The grid must have at least two rows and two columns, with equal row lengths.
  Rows and the outer grid are ordinary readonly arrays, not packed typed arrays
- Dimensions must be positive finite float32 values, and all samples must be
  finite after float32 conversion. Values round to float32; adjacent grid
  coordinates must remain distinct. Bounds too large for finite float32 storage
  are rejected. No rows, columns, heights, or dimensions are silently clamped
- Each cell's diagonal joins `(r, c)` to `(r+1, c+1)`. Its two triangles are
  `[(r,c), (r+1,c), (r+1,c+1)]` and `[(r,c), (r+1,c+1), (r,c+1)]`, with
  counterclockwise winding when viewed from above (+Y). The diagonal is fixed,
  so a nonplanar cell's shape is deterministic
- UVs are `[column / (columns - 1), row / (rows - 1)]`: U increases with X,
  V with Z, and the full grid spans `[0, 1]` on both axes
- Flat normals duplicate triangle corners: `6 * (rows - 1) * (columns - 1)`
  vertices, no index buffer. Keep explicit grids modest; this is not a streaming,
  LOD, or chunked-terrain system. No smoothing, skirts, closed underside,
  collision shape, random generation, or imported heightmap is added

The factory owns its output buffers, and the result works with existing mesh
validation, upload planning, spatial queries, extraction, and snapshot bundles.
The app descriptor shallow-copies its options, just like other mesh descriptors;
keep nested height arrays stable until spawning. Invalid grids throw
`HeightfieldMeshError` in the render factory, or
`aperture.spawn.invalidHeightfieldMesh` from the app facade, with a stable
`path` such as `heights[2][3]`, `heights[1]`, `width`, or `depth`.

For edits, keep one mesh handle and publish a rebuilt asset. This refreshes
normals, bounds, and the asset version; it does not add another entity. Do not
respawn the same entity key or mutate the published buffers in place.

```ts
import { createHeightfieldMeshAsset } from "@aperture-engine/render";

const heights = [
  [0, 0, 0],
  [0, 1, 0],
  [0, 0, 0],
];
const options = { heights, width: 8, depth: 6 };
const dynamic = this.meshes.dynamic("terrain.editable", {
  initial: createHeightfieldMeshAsset(options),
});
this.spawn.mesh({
  key: "terrain.surface",
  mesh: dynamic.handle,
  material: material.standard({ baseColor: [0.22, 0.38, 0.12, 1] }),
  castShadow: true,
  receiveShadow: true,
});

// Later, from the system that owns these samples and this handle:
heights[1]![1] = 2;
dynamic.publish(createHeightfieldMeshAsset(options));
```

`test/fixtures/heightfield-authoring/scene.ts` is a reproducible 4×5 hillside
with a camera, shadow-casting sun, standard material, and 24 triangles. The
native verifier retains the default daylight environment and subtle bloom,
raises one sample through the existing dynamic handle, verifies refreshed
bounds and an unchanged entity, and bundles the edited geometry:

```sh
pnpm run build
node test/fixtures/heightfield-authoring/verify.mjs /tmp/heightfield.json
```

The verifier checks built package exports, native app extraction, owned buffers,
bundle closure without placeholders, and deterministic reset. It does not claim
WebGPU pixel verification; a Blender geometry inspection is also a separate
check from native Aperture rendering.

## Profile-Revolved Lathe Meshes

Use `mesh.lathe({ profile, radialSegments?, label? })` for faceted columns,
bowls, rims, and other rotational parts. The render package exports the same
options as `LatheMeshOptions`, the `createLatheMeshAsset` factory, and
`LatheMeshError`; app/systems exports `LatheMeshDescriptorOptions`.

```ts
this.spawn.mesh({
  key: "bowl",
  mesh: mesh.lathe({
    radialSegments: 12,
    profile: [
      [0, 0],
      [1, 0],
      [1.2, 1],
      [1, 1],
      [0.8, 0.2],
      [0, 0.2],
    ],
  }),
  material: material.standard({ baseColor: [0.55, 0.2, 0.1, 1] }),
  castShadow: true,
  receiveShadow: true,
});
```

- `profile` is an ordinary readonly array of at least two exact `[radius, y]`
  tuples. Y is a local coordinate; radii are nonnegative. Values round to finite
  float32. Positive radii must remain positive after conversion
- The full 360-degree revolution is around Y. Positions are
  `[r * cos(theta), y, r * sin(theta)]`, starting at +X and turning toward +Z.
  `radialSegments` is an integer from 3 through 128, default 32
- Preserve profile order: outer walls ordered bottom-to-top face outward; inner
  walls ordered top-to-bottom face inward. An outward horizontal segment faces
  down; an inward horizontal segment faces up. Reversing the profile reverses
  winding. The bowl above explicitly describes underside, outside, rim, inside,
  and floor
- For adjacent profile points i/i+1 and angles j/j+1, let a=(i,j), b=(i+1,j),
  c=(i+1,j+1), d=(i,j+1). Triangles are `[a,b,d]` and `[d,b,c]`
- Radius zero is allowed only at the first or last point. Such a pole emits one
  triangle per angular segment, omitting only the analytically collapsed face.
  No automatic caps are added: positive-radius endpoints remain open. A closed
  positive-radius profile must explicitly repeat its first point at the end;
  there is no implicit last-to-first connection
- The duplicated angular seam has exactly equal positions at j=0 and j=N.
  UVs are `[j / radialSegments, i / (profile.length - 1)]`, including poles.
  V follows point order, not Y or arc length; U=0 and U=1 remain distinct
- Normals are flat per triangle, including across profile corners. Every
  triangle owns three corners in standard POSITION/NORMAL/TEXCOORD_0 buffers;
  no index buffer, smoothing, partial revolution, collider, or RNG is added
- All-axis profiles, interior axis points, consecutive points identical after
  float32 rounding, remaining zero-area triangles, and overflowing bounds are
  rejected. Nothing is silently clamped, repaired, or removed except the
  analytic pole face. Self-intersections, overlaps, and nonmanifold surfaces
  are not detected or repaired; arbitrary profiles are not guaranteed watertight

Errors carry an actionable input path such as `profile[2][0]`,
`profile[1..2].segments[3]`, or `radialSegments`. The app reports
`aperture.spawn.invalidLatheMesh`; invalid spawn leaves assets unchanged and
allows a corrected same-key retry. Unexpected accessor exceptions are preserved.
The descriptor shallow-copies options: keep nested arrays stable until spawn.
The factory owns all output buffers and does not retain input arrays.

Publish edits through a stable dynamic mesh handle, as with heightfields:

```ts
import { createLatheMeshAsset } from "@aperture-engine/render";

const dynamic = this.meshes.dynamic("bowl.mesh");
dynamic.publish(
  createLatheMeshAsset({
    radialSegments: 12,
    profile: [
      [0, 0],
      [1, 0],
      [1.4, 1.2],
      [1.2, 1.2],
      [0.8, 0.2],
      [0, 0.2],
    ],
  }),
);
```

`test/fixtures/lathe-authoring/scene.ts` authors a stepped column and thick bowl
with standard materials, a ground receiver, camera, and shadow-casting sun.
The native consumer retains daylight and subtle bloom, republishes the bowl,
checks extraction and bounds, and verifies exact mesh buffers through a bundle
round-trip and deterministic reset:

```sh
pnpm run build
node test/fixtures/lathe-authoring/verify.mjs /tmp/lathe.json
```

This verifies native geometry and built exports, not WebGPU pixel output.

## Prefabs

Prefabs are serialized `ApertureSceneDocument` blueprints. Author the source
subtree in an ECS world, serialize it with `saveScene(world)`, register the
document through `this.prefabs.register(document)`, then instantiate it with
`this.spawn.prefab(handle, options)`.

```ts
import { saveScene } from "@aperture-engine/simulation";

const document = saveScene(templateWorld);
const cratePrefab = this.prefabs.register(document, { id: "crate.prefab" });

this.spawn.prefab(cratePrefab, {
  key: "crate.instance.1",
  transform: { translation: [0, 0, 0] },
});
```

Prefab instances are ordinary ECS subtrees. Instance options can override the
root transform, and `overrides` can patch component fields by prefab-local id
without mutating the registered blueprint.

## Custom WGSL Materials

Generated browser apps can author a data-only custom WGSL material from config
assets and worker systems. Systems never create WebGPU objects; they declare
shader source, render state, binding layouts, and JSON-safe uniform values. The
main-thread WebGPU app mirrors the source assets, compiles WGSL, creates
renderer-owned buffers/bind groups/pipelines, and submits the final frame.

Declare path-loaded shader source in `aperture.config.ts`:

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    water: asset.shader("/shaders/water.wgsl", { preload: "blocking" }),
  },
});
```

Use the shader handle from a worker system:

```ts
import {
  EcsType,
  createSystem,
  material,
  mesh,
  shader,
} from "@aperture-engine/app/systems";

export default class WaterSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.mesh({
      key: "water",
      mesh: mesh.plane({ size: [6, 3] }),
      material: material.customWgsl({
        familyKey: "app/water",
        label: "Water",
        shader: shader.asset(this.assets.shader("water")),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: {
          cullMode: "none",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
          alphaMode: "blend",
        },
        bindings: [
          material.uniform("water", {
            binding: 0,
            visibility: ["fragment"],
            fields: {
              color: { type: EcsType.Vec4, default: [0.02, 0.46, 0.9, 1] },
              time: { type: EcsType.Float32, default: 0 },
            },
            values: {
              color: [0.02, 0.46, 0.9, 1],
              time: 0,
            },
          }),
        ],
      }),
    });
  }
}
```

Inline WGSL is available for tests and small demos:

```ts
material.customWgsl({
  familyKey: "example/tint",
  label: "Inline Tint",
  shader: shader.inlineWgsl(WGSL, { virtualPath: "inline-tint.wgsl" }),
  entryPoints: { vertex: "vs_main", fragment: "fs_main" },
});
```

V1 custom WGSL shaders use fixed renderer groups:

- `@group(0) @binding(0)`: view uniform, renderer-owned. The layout is
  `{ viewProjection: mat4x4f, cameraPosition: vec4f }`.
- `@group(1) @binding(0)`: read-only storage array of world transforms,
  renderer-owned. Index with `@builtin(instance_index)`.
- `@group(2)`: custom material bindings declared by `material.customWgsl(...)`.
- `@group(3)`: reserved for future renderer extensions.

Mesh vertex locations follow the built-in instance layout: `@location(0)`
position (`vec3f`), `@location(1)` normal (`vec3f`), and `@location(2)` UV
(`vec2f`). Use `runtimeUniformKey` on a group-2 uniform binding when per-frame
values should come from `this.spawn.runtimeUniform(...)`.

Current limitations: WGSL only; no shader imports; no user-supplied WebGPU
objects or callbacks; no arbitrary app-owned material adapter registration; and
lighting/environment integration is deferred. App-route custom WGSL supports
group-2 uniform buffers, texture bindings, sampler bindings, existing
instance-attribute layouts, and mixed built-in/custom frames through the normal
`createWebGpuApp()` path. Storage-buffer bindings are validated but reported as
unsupported until a renderer-independent buffer source asset exists.

See [`recipes/custom-wgsl-material.md`](./recipes/custom-wgsl-material.md) for
a complete shader and material setup.

## Runtime Systems

Systems map to EliCS systems and can query ECS components directly.

```ts
import {
  EcsType,
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinCrateSystem extends createSystem({
  priority: 100,
  queries: {
    crates: {
      required: [Name, LocalTransform],
      where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
    },
  },
  config: {
    speed: { type: EcsType.Float32, default: 1 },
  },
}) {
  override update(_delta: number, time: number): void {
    const speed = this.config.speed.value;

    for (const entity of this.queries.crates.entities) {
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * speed));
    }
  }
}
```

Lower numeric `priority` runs earlier. Omit it to default to `0`. `priority` is
static registration metadata from the `createSystem({ ... })` descriptor; it is
not a runtime signal and does not appear in `this.config`. Fields declared under
`config` become runtime signals such as `this.config.speed.value`. System
modules default-export the class; the generated worker registers discovered
systems in priority order. The main-thread generated bootstrap receives
serializable manifest metadata, not live system classes.

`this.queries.<name>.entities` is a `Set<Entity>`. Iterate it with `for...of`,
test membership with `.has(entity)`, and use `.size` for counts.

Use negative priorities only for very early setup, keep ordinary gameplay near
`0` to `100`, and reserve larger values for late reactions such as camera follow
or UI/status synchronization.

## System Context Facades

Inside a system, `this` exposes the whole authoring surface. Everything is typed
and discoverable by autocomplete — you rarely need to import the lower-level
runtime packages directly.

| Accessor                                       | What it gives you                                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `this.spawn`                                   | spawn cameras, lights, meshes, GLB, prefabs, particles, fog/sky, runtime uniforms, and non-rendered physics bodies; `this.spawn.animation(entity)` controls glTF animation |
| `this.queries`                                 | the ECS queries declared in `createSystem({ queries })` (`.entities` is a `Set<Entity>`)                                                                                   |
| `this.config`                                  | runtime signal fields declared in `createSystem({ config })` (`this.config.speed.value`)                                                                                   |
| `this.actions`                                 | typed input actions (narrow on `.kind`); `this.keyboard` / `this.gamepads` give raw edges                                                                                  |
| `this.signals`                                 | app signals declared in `aperture.config.ts`                                                                                                                               |
| `this.resources`                               | typed ECS resource store for non-entity state (`defineResource` + `resource.*`)                                                                                            |
| `this.assets`                                  | config-declared asset handles, readiness signals, and manual requests                                                                                                      |
| `this.commands`                                | worker-owned command channels (`drain`, `requestAsset`)                                                                                                                    |
| `this.spatial`                                 | synchronous raycast / overlap / closest-point queries over ECS data                                                                                                        |
| `this.cameras`                                 | camera access (`this.cameras.main.rayFromPointer(...)`)                                                                                                                    |
| `this.physics`                                 | rigid-body facade — see [Physics](#physics)                                                                                                                                |
| `this.audio`                                   | spatial audio (`loop`, `playOneShot`, `clip`)                                                                                                                              |
| `this.particles` / `this.trails`               | particle emitters / motion trails                                                                                                                                          |
| `this.hierarchy`                               | parent/child relationships                                                                                                                                                 |
| `this.materials` / `this.meshes` / `this.gltf` | runtime material / mesh / glTF-instance access                                                                                                                             |
| `this.prefabs`                                 | register and instantiate prefab blueprints                                                                                                                                 |
| `this.interaction` / `this.html`               | pointer interaction state / DOM HTML bridge                                                                                                                                |
| `this.fixedStep`                               | register fixed-step tasks                                                                                                                                                  |
| `this.effects`                                 | lifecycle-owned signal effects (`this.effects.watch(...)`)                                                                                                                 |
| `this.diagnostics`                             | structured diagnostics (`info` / `warn` / `error`)                                                                                                                         |

## Physics

Enable the Rapier rigid-body backend in `aperture.config.ts`. Setting `physics`
also turns on the fixed-step clock that drives it:

```ts
export default defineApertureConfig({
  // ...
  physics: { backend: "rapier", gravity: [0, -9.81, 0] },
  // or simply: physics: true
});
```

Author bodies inline on a spawned mesh, or spawn a non-rendered body with
`this.spawn.physics(...)`. You do **not** need to import
`@aperture-engine/physics`: the `physics` helper namespace from
`@aperture-engine/app/systems` builds the descriptors, and every `type`/`kind`
is a plain string union.

```ts
import {
  createSystem,
  mesh,
  material,
  physics,
} from "@aperture-engine/app/systems";

// A rendered dynamic body:
this.spawn.mesh({
  key: "crate",
  mesh: mesh.box({ size: [1, 1, 1] }),
  material: material.standard(),
  transform: { translation: [0, 4, 0] },
  physics: {
    rigidBody: { type: "dynamic" }, // "static" | "dynamic" | "kinematicPosition" | "kinematicVelocity"
    collider: { shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] } },
  },
});

// A static floor with the equivalent helper form:
this.spawn.physics({
  key: "floor",
  physics: physics.body({
    rigidBody: { type: "static" },
    collider: { shape: { kind: "box", halfExtents: [10, 0.5, 10] } },
  }),
});
```

### Who owns the transform

Physics is authoritative for the pose of any body it simulates, and writes that
pose back into `LocalTransform` every fixed step. This has one important
consequence:

> **Do not move a physics body by writing `LocalTransform` directly — the
> writeback overwrites it the same frame, with no error.**

- **Dynamic** bodies are driven by forces/impulses/velocity and gravity. Read
  their pose from `LocalTransform`; nudge them with `this.physics.applyImpulse`,
  `setLinearVelocity`, etc.
- **Kinematic** bodies are driven by _you_. Move them with
  `this.physics.setKinematicTarget(entity, { translation })` (rotation is
  optional — omit it to keep the current orientation). Spawn them with
  `rigidBody: { type: "kinematicPosition" }` and a `kinematicTarget`.

### Character controller

Drive a kinematic character with `this.physics.moveCharacter`, then commit the
collision-resolved result back to the body:

```ts
const result = this.physics.moveCharacter({
  entity: serializeEntityRef(body),
  desiredTranslation: [dx, dy, dz], // this frame's intended displacement
  settings: { snapToGroundDistance: 0.5, maxSlopeClimbAngle: Math.PI / 4 },
});
if (result !== null) {
  this.physics.setKinematicTarget(body, {
    translation: result.targetTranslation,
  });
  // result.grounded / result.collisions are available for jump + contact logic
}
```

`snapToGroundDistance` must exceed the rest gap between the collider and the
floor or `grounded` never latches; a small constant downward "stick" velocity
while grounded keeps the controller engaged.

## Input, Signals, And Effects

Use lifecycle-owned effects for ECS mutation driven by signals. Do not use raw
Preact `effect()` for arbitrary microtask-time ECS writes.

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class SelectSystem extends createSystem({
  priority: 50,
}) {
  override init(): void {
    const select = this.actions.select;
    if (select.kind !== "button") {
      return;
    }

    this.effects.watch(
      select.pressed,
      (pressed) => {
        if (!pressed) {
          return;
        }

        this.signals.gameplayMode.value = "select";
        this.diagnostics.info("select.pressed", {
          pointer: this.input.pointer.primary.position.value,
        });
      },
      { phase: "input" },
    );
  }
}
```

Effects registered in `init()` are disposed on system destroy and flushed in
explicit simulation phases: `input` before system updates, `update` after system
updates, and `postUpdate` after interaction processing. Input actions are
forwarded from the generated browser bootstrap into worker-owned signals before
system effects run.
Use `this.actions.jump.down()` for one-frame button presses, `this.actions.move.x`
and `this.actions.move.y` for axis2d actions, `this.keyboard.down("KeyP")` for
direct keyboard edges, and `this.gamepads.primary?.down("south")` for direct
standard gamepad reads. The Vite plugin writes `.aperture/generated/aperture-env.d.ts`
so configured `input.button`, `input.axis1d`, and `input.axis2d` actions receive
kind-specific system types.

## Spatial Queries

Spatial queries are synchronous helpers over ECS-owned data in the
logic/simulation context. Bounds raycasts use `this.spatial.setBounds(...)`;
exact visual mesh raycasts use `this.spatial.setMeshes(...)` with
renderer-independent CPU mesh data and an optional mesh BVH. Both paths return
canonical entity references, and gameplay systems do not await raycasts.

```ts
const ray = this.cameras.main.rayFromPointer(
  this.input.pointer.primary.position.value,
);

const hit = this.spatial.raycastFirst(ray, {
  source: "visual-mesh",
  fallback: "bounds",
  maxDistance: 20,
});

this.signals.selectedEntity.value = hit?.entity.ref ?? null;
```

Use spatial queries from systems; do not move picking state into the renderer as
the source of truth.

## Commands And Manual Assets

Commands are the worker-owned path for browser UI, tools, or MCP-style bridges
to request simulation work. Browser code dispatches a serializable command
event; the generated bootstrap forwards it to the worker.

```ts
window.dispatchEvent(
  new CustomEvent("aperture:command", {
    detail: {
      channel: "asset.request",
      payload: { assetId: "decal" },
    },
  }),
);
```

A system drains the channel and requests the manual asset:

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class AssetCommandSystem extends createSystem({
  priority: 75,
}) {
  override update(): void {
    for (const command of this.commands.drain<{ assetId?: unknown }>(
      "asset.request",
    )) {
      if (typeof command.assetId !== "string") {
        this.diagnostics.warn("command.assetRequest.invalid", {
          suggestedFix:
            "Send { assetId: 'decal' } on the asset.request command channel.",
        });
        continue;
      }

      void this.commands.requestAsset(command.assetId).then(() => {
        this.diagnostics.info("command.assetRequest.ready", {
          asset: command.assetId,
          ready: this.assets.readiness(command.assetId).value,
        });
      });
    }
  }
}
```

Runtime asset requests should be expressed through systems and commands. User
code should not touch loader reports, transfer packages, snapshot transport, or
renderer-side registration.

## Diagnostics And Entity Lookup

Generated browser, worker, and headless statuses are JSON-safe. Systems can
publish diagnostics with stable codes:

```ts
if (this.assets.gltf("robot").error.value) {
  this.diagnostics.error("asset.robot.failed", {
    asset: "robot",
    suggestedFix: "Check the URL in aperture.config.ts.",
  });
}
```

Entity summaries use ECS identity plus optional app metadata:

```ts
{
  entity: { index: 12, generation: 0 },
  key: "level.robot",
  name: "robot",
  tags: ["asset", "robot"],
  componentIds: ["Name", "LocalTransform", "Mesh"],
  source: { assetId: "robot", gltfNodeIndex: 0 }
}
```

Tools should use `{ index, generation }` for follow-up operations and rerun
entity lookup when a generation-mismatch diagnostic says the reference is
stale.

The generated browser bridge exposes the same inspection path through
JSON-safe command channels for developer panels and MCP-style tools:

- `aperture.devtools.entity.find`
- `aperture.devtools.entity.get`
- `aperture.devtools.entity.setComponent`
- `aperture.devtools.entity.snapshot`
- `aperture.devtools.entity.diff`

Those commands are handled inside the generated simulation worker before normal
system command queues. They read or mutate only worker-owned ECS state, and the
browser observes the result through generated status such as `entityTools` and
`lastFailure`.

## Headless Mode

Headless mode uses the same system authoring shape:

```ts
import { defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
});
```

Headless tests can step the app through advanced helpers without importing DOM,
canvas, `navigator.gpu`, or WebGPU presentation code.

Browser config asset URLs such as `/assets/robot.glb` are served by Vite or the
generated app host. In Node/headless tests, provide an `assetLoader` when those
URLs need to resolve, or mark the asset `preload: "manual"` and inject ready
source assets through `app.context.assetsRegistry`.

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

const app = await createApertureApp({
  config: defineApertureConfig({
    mode: "headless",
    assets: {
      robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    },
  }),
  assetLoader: {
    async load(assetHandle) {
      if (assetHandle.id !== "robot") {
        return;
      }

      // Load or register the test fixture, then mark the handle ready.
    },
  },
});
```

## Advanced APIs

Programmatic app creation, manual stepping, manual worker transport, direct
render snapshot inspection, source asset transfer packages, renderer-side
registration, custom render hosts, and custom WebGPU orchestration remain
available as advanced paths.

Use these only when you are building generated bootstrap internals, tests,
tools, render-only consumers, or nonstandard loops:

```ts
import { createApertureApp } from "@aperture-engine/app/advanced";
import { createExtractionApp } from "@aperture-engine/runtime";
import { createWebGpuApp } from "@aperture-engine/webgpu";
```

Start with [`ADVANCED_ORCHESTRATION.md`](./ADVANCED_ORCHESTRATION.md) when you
need the worker/main split, manual snapshot posting, source asset transfer
packages, or direct WebGPU presentation control.

### Polygon extrusion with openings

Use `mesh.extrude({ outline, holes?, depth, label? })` for one continuous wall,
facade, sign, or other straight solid. Points are `[x, y]` in local XY; the
solid extends from z=0 to positive `depth`. A doorway cut into an outer edge is
an outline notch, while an enclosed window is a hole:

```ts
this.spawn.mesh({
  key: "facade",
  mesh: mesh.extrude({
    outline: [
      [0, 0],
      [3, 0],
      [3, 2.5],
      [5, 2.5],
      [5, 0],
      [8, 0],
      [8, 5],
      [4, 7],
      [0, 5],
    ],
    holes: [
      [
        [0.5, 2],
        [2.5, 2],
        [2.5, 4],
        [0.5, 4],
      ],
    ],
    depth: 0.4,
  }),
  material: material.standard({ baseColor: [0.7, 0.5, 0.3, 1] }),
  castShadow: true,
  receiveShadow: true,
});
```

Both winding directions are accepted and normalized. Do not repeat the closing
point. Each ring needs at least three corners; redundant collinear corners,
self-intersections, repeated points, crossing or touching boundaries, holes
outside the outline, and overlapping/nested holes are rejected. Validation
uses the stored float32 coordinates and rejects collapsed or numerically
ambiguous geometry. The total boundary limit is 2048 vertices. Depth must
remain positive and finite in float32. There are no bevels, curved paths,
implicit geometry repairs, islands inside holes, or per-face materials.

Output is a closed indexed triangle mesh with POSITION, NORMAL and TEXCOORD_0.
Caps face -Z/+Z, and each wall edge has a flat outward normal (hole walls face
into the opening). Vertices are split at cap/wall and wall/wall hard edges.
Cap UVs normalize XY across the outline bounding box. Wall U is normalized
perimeter distance per ring, with its seam at the lexicographically first
point; V is z/depth. Input arrays are not mutated, output buffers are owned,
and identical input or reversed ring winding gives identical output.

`createExtrudeMeshAsset(options)` from `@aperture-engine/render` is the low-level
factory for custom registration or `dynamic.publish` updates. It throws
`ExtrudeMeshError` with an input path; spawning converts that into
`aperture.spawn.invalidExtrudeMesh` without registering partial assets.
Triangulation uses a local, ISC-licensed copy of Earcut 3.0.2, not Three. Its license
notice ships in the emitted module; no new browser import-map entry is needed.

`test/fixtures/extrude-authoring/scene.ts` authors a single cottage facade with
an open door notch and window hole. After building, run the native consumer
proof (validates extraction, dynamic edits, serialization, strict preflight,
and deterministic reset; it does not claim rendered-pixel verification):

```sh
node test/fixtures/extrude-authoring/verify.mjs /tmp/extrude.json
```

### Camera projection validation

`validateCameraInput` checks finite positive `aspect` and `near`, and finite
`far > near`, for both perspective and orthographic cameras. Perspective cameras
also require finite `0 < fovYRadians < PI`; orthographic cameras require finite
positive `orthographicHeight`. The inactive projection's size field is ignored,
so its zero sentinel remains valid. Omitted values retain the standard defaults.
`spawn.camera()` rejects invalid inputs before creating an entity, with a
structured `aperture.camera.invalidProjection` error whose `detail.diagnostics`
identifies the fields. Low-level ECS camera extraction skips invalid views with
`render.camera.*` diagnostics rather than throwing during matrix construction.
# Visual Quality

> **Doc status (2026-07-11): CURRENT.** Matches the generated-app render
> defaults (`tonemap`/`exposure`/`bloom`/`ssao`/`defaultEnvironment`) and the
> `aperture create` templates at 0.3.x.

How Aperture apps get their look, what a fresh app ships with, and which knobs
to reach for when a scene reads flat. This is the doc to read **before**
hand-rolling lighting, skies, or post effects — most of the polished baseline
is already on by default, and the rest is one config field away.

## The default look

A generated app (anything scaffolded by `aperture create`, or any app started
through `@aperture-engine/app`) gets this without configuration:

| Feature      | Default                                        | Where                            |
| ------------ | ---------------------------------------------- | -------------------------------- |
| Tone mapping | `"aces"` (filmic) through the HDR scene buffer | `render.tonemap`                 |
| Exposure     | `1` (enables the rgba16float HDR path)         | `render.exposure`                |
| MSAA         | 4x                                             | `render.sampleCount`             |
| Pixel ratio  | device DPR capped at 2                         | `render.maxPixelRatio`           |
| Environment  | daylight gradient sky + image-based lighting   | `render.defaultEnvironment`      |
| Bloom / SSAO | off (one config field each)                    | `render.bloom` / `render.ssao`   |
| Shadows      | off (opt-in per light)                         | `spawn.light({ shadow: {...} })` |

The templates additionally author a shadow-casting directional sun, a ground
plane that receives shadows, and a subtle bloom. Copy that recipe — it is the
same one the `showcase/` games use.

```ts
render: {
  tonemap: "aces",           // filmic roll-off; the showcase default
  exposure: 1,               // HDR scene buffer; required by bloom/SSAO
  bloom: { threshold: 0.75, intensity: 0.04, radiusPixels: 2 },
  sampleCount: 4,
  maxPixelRatio: 2,
},
```

## The default environment

Unlit scenes are the single biggest source of "why does my app look bad":
`StandardMaterial` is physically based, so with no lights and no environment
it renders black on a black clear color. To make the zero-config path look
intentional, every app gets a **default daylight environment** — a procedural
gradient sky (soft blue → pale horizon → warm ground) plus matching
image-based lighting fed through the PMREM/irradiance chain, so PBR materials
are lit and have plausible reflections immediately.

The default suppresses itself when the app authors any of:

- a `ProceduralSky` (`this.spawn.proceduralSky({...})`),
- a `Skybox` (`this.spawn.skybox({...})`),
- an environment light (`this.spawn.light({ kind: "environment", ... })`),

or when the config opts out:

```ts
render: {
  defaultEnvironment: false,
},
```

Plain directional/ambient/point lights do **not** suppress it — a sun plus
the default sky is the intended combination. The environment contributes the
ambient/fill term, so scenes generally do not need an `ambient` fill light on
top of it. The illumination gradient is deliberately dimmer than the visible
sky (`DEFAULT_ENVIRONMENT_IBL_INTENSITY`): it targets the ~0.35–0.45 ambient
fill the showcases were tuned around so it can sit under a directional sun
without washing the scene out.

When the app authors **no analytic lights at all**, the default rig also adds
a soft shadowless sun (`light.sun.default`, illuminance 2.2): the
standard-material light buffer requires at least one analytic light, so an
environment-only world would otherwise fail frame resource creation rather
than render. Author any light of your own and the default sun stays out.

To replace the look, author your own sky and keep IBL:
`spawn.proceduralSky` for a gradient (see `createProceduralSky` for the
tunables — colors, horizon position/softness, sun disk), `spawn.skybox` for a
cubemap background (see `showcase/fps` for a panorama-sourced example), and an
environment light for custom IBL. Custom HDR IBL in browser apps currently
requires registering equirect pixel data imperatively (see
`examples/ibl-equirect*` for the payload shape) — the config `asset.hdr(url)`
descriptor does not yet decode pixels in the browser worker.

## Tone mapping and exposure

Operators: `"aces"` (default, filmic), `"agx"`, `"neutral"`, `"reinhard"`,
`"linear"`, `"none"` — the named ones are faithful ports of the three.js
operators. Generated apps render into an rgba16float scene buffer and apply
tonemap + exposure + sRGB encode as the final post stage.

Opt out with `tonemap: "none"`: when neither `exposure` nor a post effect is
configured, that keeps the legacy byte-identical 8-bit path — this is the
setting golden-image baselines and byte-exact render tests should pin.

## Bloom and SSAO

Both are one config field and imply the HDR path:

```ts
render: {
  bloom: { threshold: 0.75, intensity: 0.04, radiusPixels: 2 },
  ssao: true, // or { radiusPixels, intensity, power, sampleCount }
},
```

Keep bloom subtle (the showcases use intensity 0.02–0.06); it should read as
glow on emissive/bright pixels, not haze. SSAO attenuates indirect light in
creases and contact regions — it grounds objects that otherwise look pasted
onto the scene. Further post effects (SSR, DoF, TAA, FXAA) exist at the
renderer level (`docs/POST_EFFECTS.md`) and are wired through
`createWebGpuApp({ postEffects })` or user passes.

## Shadows

Off by default; enable them on the light that acts as your sun, and mark
meshes:

```ts
this.spawn.light({
  key: "light.sun",
  kind: "directional",
  illuminance: 4,
  transform: { rotationEulerDegrees: [-45, 35, 0] },
  shadow: {
    mapSize: 2048,
    cascadeCount: 1,
    shadowType: 1,
    strength: 0.75,
    filterRadius: 2,
    normalBias: 0.04,
  },
});

this.spawn.mesh({ ..., castShadow: true, receiveShadow: true });
```

A scene with no shadow receiver under the objects (e.g. no ground plane)
will look like it floats regardless of light quality.

## Materials

`material.standard()` is metallic-roughness PBR:

- **`metallic` defaults to `0` (dielectric).** A metal has no diffuse
  response — it renders near-black without an environment map — so
  hand-authored materials are dielectric unless you say otherwise. Only set
  `metallic: 1` when the scene has IBL (the default environment counts).
- **glTF imports keep the glTF spec default** (`metallicFactor: 1`) — that is
  the asset author's contract, not a scene-authoring choice.
- `roughness` defaults to `1` (fully diffuse). Most surfaces read best
  between 0.4 and 0.9; mirrors and polished metal go low.
- `emissiveFactor` may exceed 1 — with bloom enabled that is how you make
  something glow.

## When a scene looks flat — checklist

1. **Everything near-black?** The default environment was suppressed (an
   authored `ProceduralSky`/`Skybox`/environment light exists, or
   `defaultEnvironment: false`) and no other lights were added — or a
   material sets `metallic: 1` with no IBL.
2. **Washed out / clipped highlights?** `tonemap` was set to `"none"` —
   remove the override or set `"aces"`.
3. **Objects float?** No shadow: enable `shadow` on the sun and set
   `castShadow`/`receiveShadow` on meshes, and give the scene a ground
   receiver.
4. **Everything grey and uniform?** Only ambient light — add a directional
   sun for direction and contrast; the environment supplies the fill.
5. **Glow missing?** Bloom is off — set `render.bloom` (and use emissive
   materials above 1).

## Reference configs

The showcase games are the proof points — copy their render blocks and setup
systems rather than inventing new baselines:

- `showcase/fps/aperture.config.ts` — ACES + bloom + skybox + shadow-casting
  sun + fog.
- `showcase/platformer/src/systems/setup.system.ts` — sun shadow settings +
  blob shadows.
- `showcase/city-builder/aperture.shared-config.ts` — device profiles with
  per-tier bloom.
- `packages/cli/src/create/templates/*.ts` — the scaffolded baseline
  (sun + shadows + ground + bloom over the default environment).
// Author the assigned scene and register the shared adapter.
app
audio
cli
math
particles
physics
physics-rapier
reference-assets
render
runtime
simulation
ui
vite-plugin
webgpu
````

Stderr:

```text

```

## Command 4c23a039196b447293984510fa46edd9

2026-10-11T23:39:32.816297+00:00 → 2026-10-11T23:39:32.987833+00:00; exit 0; duration 0.172s.

Command:

```sh
find /sdk/source/vite-plugin -maxdepth 3 -type f | head -50; find /sdk/source/app -maxdepth 2 -type f | head -45; sed -n "320,510p" /sdk/docs/AUTHORING.md; cat /work/index.html
```

Stdout:

````text
/sdk/source/vite-plugin/src/generated-action-types.ts
/sdk/source/vite-plugin/src/virtual-modules.ts
/sdk/source/vite-plugin/src/system-discovery.ts
/sdk/source/vite-plugin/src/system-graph-hmr.ts
/sdk/source/vite-plugin/src/index.ts
/sdk/source/vite-plugin/src/file-utils.ts
/sdk/source/vite-plugin/src/config-type-hmr.ts
/sdk/source/vite-plugin/src/typescript-ast.ts
/sdk/source/vite-plugin/src/dev-session.ts
/sdk/source/vite-plugin/src/config-type-evaluation.ts
/sdk/source/vite-plugin/README.md
/sdk/source/vite-plugin/package.json
/sdk/source/vite-plugin/dist/system-discovery.js
/sdk/source/vite-plugin/dist/system-discovery.d.ts
/sdk/source/vite-plugin/dist/dev-session.js.map
/sdk/source/vite-plugin/dist/typescript-ast.d.ts.map
/sdk/source/vite-plugin/dist/generated-action-types.d.ts
/sdk/source/vite-plugin/dist/index.js.map
/sdk/source/vite-plugin/dist/virtual-modules.d.ts
/sdk/source/vite-plugin/dist/config-type-evaluation.js.map
/sdk/source/vite-plugin/dist/system-graph-hmr.js.map
/sdk/source/vite-plugin/dist/generated-action-types.d.ts.map
/sdk/source/vite-plugin/dist/index.js
/sdk/source/vite-plugin/dist/system-discovery.d.ts.map
/sdk/source/vite-plugin/dist/system-graph-hmr.d.ts
/sdk/source/vite-plugin/dist/file-utils.js
/sdk/source/vite-plugin/dist/index.d.ts
/sdk/source/vite-plugin/dist/system-graph-hmr.js
/sdk/source/vite-plugin/dist/dev-session.js
/sdk/source/vite-plugin/dist/generated-action-types.js.map
/sdk/source/vite-plugin/dist/index.d.ts.map
/sdk/source/vite-plugin/dist/config-type-hmr.d.ts
/sdk/source/vite-plugin/dist/config-type-evaluation.d.ts
/sdk/source/vite-plugin/dist/system-discovery.js.map
/sdk/source/vite-plugin/dist/config-type-hmr.js.map
/sdk/source/vite-plugin/dist/dev-session.d.ts.map
/sdk/source/vite-plugin/dist/virtual-modules.js.map
/sdk/source/vite-plugin/dist/file-utils.js.map
/sdk/source/vite-plugin/dist/typescript-ast.d.ts
/sdk/source/vite-plugin/dist/file-utils.d.ts
/sdk/source/vite-plugin/dist/config-type-evaluation.js
/sdk/source/vite-plugin/dist/config-type-hmr.js
/sdk/source/vite-plugin/dist/virtual-modules.js
/sdk/source/vite-plugin/dist/virtual-modules.d.ts.map
/sdk/source/vite-plugin/dist/system-graph-hmr.d.ts.map
/sdk/source/vite-plugin/dist/generated-action-types.js
/sdk/source/vite-plugin/dist/config-type-hmr.d.ts.map
/sdk/source/vite-plugin/dist/config-type-evaluation.d.ts.map
/sdk/source/vite-plugin/dist/typescript-ast.js.map
/sdk/source/vite-plugin/dist/dev-session.d.ts
/sdk/source/app/src/input.ts
/sdk/source/app/src/physics-interpolation.ts
/sdk/source/app/src/advanced.ts
/sdk/source/app/src/entity-lookup.ts
/sdk/source/app/src/headless-tools.ts
/sdk/source/app/src/render-interpolation.ts
/sdk/source/app/src/physics-facade.ts
/sdk/source/app/src/browser.ts
/sdk/source/app/src/headless.ts
/sdk/source/app/src/default-environment.ts
/sdk/source/app/src/config-physics.ts
/sdk/source/app/src/snapshot-interpolation-bounds.ts
/sdk/source/app/src/config.ts
/sdk/source/app/src/commands.ts
/sdk/source/app/src/worker.ts
/sdk/source/app/src/physics-collider-geometry.ts
/sdk/source/app/src/features.ts
/sdk/source/app/src/index.ts
/sdk/source/app/src/physics-feature.ts
/sdk/source/app/src/vite.ts
/sdk/source/app/src/systems.ts
/sdk/source/app/src/asset-mirror.ts
/sdk/source/app/src/diagnostics.ts
/sdk/source/app/README.md
/sdk/source/app/package.json
/sdk/source/app/dist/entity-lookup.d.ts.map
/sdk/source/app/dist/config-physics.d.ts
/sdk/source/app/dist/advanced.d.ts
/sdk/source/app/dist/advanced.d.ts.map
/sdk/source/app/dist/worker.js.map
/sdk/source/app/dist/physics-collider-geometry.js
/sdk/source/app/dist/asset-mirror.d.ts.map
/sdk/source/app/dist/config-physics.js.map
/sdk/source/app/dist/features.js.map
/sdk/source/app/dist/headless-tools.js
/sdk/source/app/dist/index.js.map
/sdk/source/app/dist/commands.js
/sdk/source/app/dist/browser.d.ts
/sdk/source/app/dist/input.d.ts.map
/sdk/source/app/dist/commands.js.map
/sdk/source/app/dist/config.js.map
/sdk/source/app/dist/snapshot-interpolation-bounds.js.map
/sdk/source/app/dist/worker.d.ts
/sdk/source/app/dist/physics-facade.d.ts
/sdk/source/app/dist/index.js
      [1, 0, 1],
      [0, 1, 1],
      [-1, 0, -1],
      [1, 0, -1],
      [0, 1, -1],
    ],
    indices: [
      0,
      1,
      2,
      3,
      5,
      4, // gables
      0,
      3,
      4,
      0,
      4,
      1, // underside
      0,
      2,
      5,
      0,
      5,
      3, // left slope
      1,
      4,
      5,
      1,
      5,
      2, // right slope
    ],
  }),
  material: material.standard({ baseColor: [0.6, 0.16, 0.07, 1] }),
  transform: { translation: [0, 2, 0] },
  castShadow: true,
  receiveShadow: true,
});
```

Keep the generated app's daylight environment, a shadow-casting sun and ground
receiver; see [Visual Quality](./VISUAL_QUALITY.md) for the lighting recipe.
This is ordinary ECS mesh authoring and uses the existing triangle-list render,
spatial-query, asset-mirror and snapshot paths.

The options are intentionally small:

- `positions`: required array of `[x, y, z]` tuples, at least three vertices
- `indices`: optional number array, `Uint16Array` or `Uint32Array`; zero-based
  integers referencing source positions. Without indices, positions are consumed
  in triples. The triangle corner count must be a positive multiple of three
- `normals`: optional `[nx, ny, nz]` tuples, exactly one per source position.
  Nonzero explicit normals are normalized and preserve the authored vertex/index
  layout. Omit normals for flat shading: the factory expands each face's three
  corners and computes its own normal, so shared positions keep crisp edges
- `uvs`: optional `[u, v]` tuples, exactly one per source position, remapped when
  flat faces expand. Missing UVs are `[0, 0]`; this helper does not unwrap a mesh
- `label`: optional string, default `"TriangleList"`

To share indexed vertices with authored smooth normals, a ramp surface can use
`positions: [[0,0,0], [2,1,0], [2,1,-1], [0,0,-1]]`,
`indices: [0,1,2, 0,2,3]` and four `[-1,2,0]` normals. Explicit normals are
not generated, welded or crease-angle averaged. Winding is unchanged even if
supplied normals face another direction. For two-sided surfaces, author both
sides or choose an appropriate material render state.

Every coordinate, normal and UV must be finite after conversion to float32.
Faces with zero-area after this conversion (including repeated indices or
positions that round together) are rejected with their triangle number and
source range. Normals must remain nonzero, all attribute counts must match, and
bounds must fit finite float32 storage. Invalid app inputs throw
`aperture.spawn.invalidTriangleListMesh` with `detail.path` and a suggested fix;
validation completes before mesh asset publication. Correct the input and retry
the same entity key; the failed attempt does not retain a partial mesh entity.

The resulting asset owns its buffers and bounds; later input mutation cannot
change it. Like other descriptors, `mesh.triangleList` shallow-copies its options
and reads nested arrays when spawned. Flat output is non-indexed. Explicit-normal
indexed output uses `uint16` up to maximum referenced index 65535 and `uint32`
above that, regardless of the input array type. Bounds use stored float32
positions; unused source positions are discarded during flat expansion, but
retained and included in bounds when explicit normals preserve the source layout.
There is one submesh and one material slot; use separate keyed entities for
multi-material parts or the lower-level `MeshAsset` schema for custom layouts.

`TriangleListMeshDescriptorOptions` is exported from
`@aperture-engine/app/systems`. Lower-level consumers can import
`createTriangleListMeshAsset`, `TriangleListMeshOptions`, `TriangleListPosition`,
`TriangleListNormal`, `TriangleListUv`, and `TriangleListMeshError` from
`@aperture-engine/render`; the factory throws the latter (a `RangeError` with a
`path` property). No change to existing primitive normalization is implied.

Repository verification, after `pnpm run build` with a Node version supporting
native TypeScript, can reproduce the roof/ramp scene and a real local GLB import:

```sh
node test/fixtures/triangle-authoring/verify.mjs /tmp/triangle-authoring.json
pnpm exec vitest run test/mesh/triangle-list.test.ts \
  test/app/triangle-list-spawn.test.ts test/cli/triangle-authoring-native.test.ts
```

The first command writes a closure-checked render bundle at the supplied path.
These checks establish source geometry, extraction, bounds, byte round-trips and
package-consumer behavior. They do not verify GPU pixels or measure agent success
against another engine.

### Compose reusable procedural groups

`this.spawn.group(...)` creates a transform-only ECS entity for an assembly.
It accepts the same `name`, unique `key`, `tags` and `transform` metadata as
other spawn helpers, and returns an ordinary `Entity`. It adds no mesh,
material, light, camera, or render asset.

Inside a system's `init`, parent authored parts to that entity:

```ts
const bench = this.spawn.group({
  key: "bench.west",
  name: "West bench",
  tags: ["assembly", "editable"],
  transform: {
    translation: [-2, 0, 0],
    rotationEulerDegrees: [0, 15, 0],
  },
});

this.spawn.mesh({
  key: "bench.west.seat",
  mesh: mesh.box({ size: [2, 0.2, 0.6] }),
  material: material.standard({ baseColor: [0.35, 0.16, 0.07, 1] }),
  transform: { parent: bench, translation: [0, 0.9, 0] },
  castShadow: true,
  receiveShadow: true,
});

for (const [index, x] of [-0.75, 0.75].entries()) {
  this.spawn.mesh({
    key: `bench.west.leg.${index}`,
    mesh: mesh.box({ size: [0.18, 0.8, 0.5] }),
    material: material.standard({ baseColor: [0.12, 0.13, 0.15, 1] }),
    transform: { parent: bench, translation: [x, 0.4, 0] },
    castShadow: true,
  });
}
```

Keep the normal scene lighting/default environment from the templates. This
snippet defines an assembly, not a replacement lighting or rendering setup.
Use a key prefix when building several instances so each entity key stays
unique. Groups can parent other groups, procedural parts, or imported GLB
roots using `transform: { parent: group, ... }`.

Transforms supplied at spawn are local to `transform.parent`; without a parent,
they are root transforms. The usual simulation transform-resolution phase
computes world matrices. Moving/scaling/rotating a group's `LocalTransform`
therefore changes the whole subtree while preserving each part's local values.
For an already-authored entity, `this.hierarchy.setParent(childRef, parentRef)`
is the separate world-preserving reparenting operation and reports unsupported
transform cases.

The authoritative relationship is the ECS `Parent` component. There is no
renderer-owned group object or parallel scene graph. Names/tags, materials,
visibility and other component values are not implicitly inherited by children.
Inspect the full tree through `ecs_get_hierarchy`; use
`this.hierarchy.despawnRecursive({ index: bench.index, generation: bench.generation })`
to remove an assembly and its descendants. A bare `Entity.destroy()` is not the
recursive teardown operation.

Groups participate in ordinary ECS snapshots/restores. Agent tools can find a
group by key, revise its allowlisted local transform, and frame its descendant
mesh bounds with `camera_frame_entities`. Unknown top-level options produce the
existing spawn warning; put `parent` inside `transform`. Failed group
construction does not leave a partial entity behind.

### Imported-model lighting and appearance

Use `spawn.lightRig` for deterministic ECS-owned presentation lighting:

```ts
this.spawn.lightRig({
  key: "lighting.presentation",
  preset: "studio-neutral",
  environmentMap: this.assets.hdr("studioEnvironment"),
  shadows: true,
});
```

The public presets are `studio-neutral`, `outdoor-neutral`, and `none`; their
inspectable definitions are exported as `LIGHT_RIG_PRESETS`. The returned rig
lists its root and light entities and has `remove()` to destroy everything it
owns. Override `environment`, `keyLight`, or `rimLight` without introducing
<!doctype html>
<html><head><meta charset="UTF-8"><title>House scene</title></head><body style="margin:0"><script type="module" src="/src/main.js"></script></body></html>
````

Stderr:

```text

```

## Command 827ab1e62fb54ffdbd8c1e066ddc5afc

2026-10-11T23:39:36.616752+00:00 → 2026-10-11T23:39:36.736120+00:00; exit 0; duration 0.119s.

Command:

```sh
cat /sdk/source/app/src/browser.ts; cat /sdk/source/app/src/worker.ts; cat /sdk/source/app/src/advanced.ts; grep -n "requestAnimationFrame\|manual\|renderFrame\|snapshot\|createWebGpuApp" /sdk/source/vite-plugin/src/virtual-modules.ts | head -70
```

Stdout:

```text
export {
  DEFAULT_GENERATED_EXPOSURE,
  DEFAULT_GENERATED_MAX_PIXEL_RATIO,
  DEFAULT_GENERATED_MSAA_SAMPLE_COUNT,
  DEFAULT_GENERATED_TONEMAP,
  measureGeneratedCanvasResize,
  readGeneratedRenderProfileEnvironment,
  resolveGeneratedEffectiveRenderDefaults,
  resolveGeneratedRenderSettings,
  resolveGeneratedTonemapAndExposure,
} from "./browser/render.js";
export type {
  GeneratedBrowserEffectiveRenderDefaults,
  GeneratedBrowserRenderSettings,
  GeneratedBrowserRenderProfileEnvironment,
  GeneratedCanvasMeasurementSource,
  GeneratedCanvasMeasureElement,
  GeneratedCanvasResizeMeasurement,
  GeneratedCanvasResizeSource,
  GeneratedPixelRatioSource,
  GeneratedTonemapAndExposure,
} from "./browser/render.js";
export {
  APERTURE_GENERATED_VIRTUAL_INPUT_EVENT,
  dispatchApertureInputAction,
} from "./browser/input.js";
export type { ApertureVirtualActionInput } from "./browser/input.js";
export {
  dispatchApertureHtmlEvent,
  observeApertureHtmlSlots,
} from "./browser/html-bridge.js";
export type {
  ApertureHtmlSlotObserver,
  ApertureHtmlSlotObserverOptions,
} from "./browser/html-bridge.js";
export {
  APERTURE_MCP_MANAGED_GLOBAL,
  APERTURE_MCP_RUNTIME_GLOBAL,
} from "./browser/devtools/index.js";
export type { ApertureMcpRuntime } from "./browser/devtools/index.js";
export {
  APERTURE_GENERATED_RENDER_DIAGNOSTICS_PROPERTY,
  APERTURE_GENERATED_STATUS_GLOBAL,
  readGeneratedBrowserAppStatus,
  subscribeGeneratedBrowserAppStatus,
} from "./browser/status.js";
export type {
  GeneratedBrowserAppStatus,
  GeneratedBrowserRenderDiagnosticsAccessor,
  GeneratedBrowserStatusListener,
  GeneratedBrowserStatusSubscriptionOptions,
  GeneratedBrowserSystemManifestEntry,
} from "./browser/status.js";
export {
  readGeneratedSignal,
  readGeneratedSignals,
  subscribeGeneratedSignals,
} from "./browser/signals.js";
export type {
  GeneratedSignalSummary,
  GeneratedSignalsListener,
  GeneratedSignalsSubscriptionOptions,
} from "./browser/signals.js";
export {
  resolveGeneratedPostEffects,
  startGeneratedBrowserApp,
} from "./browser/app.js";
export type {
  GeneratedBrowserApp,
  StartGeneratedBrowserAppOptions,
} from "./browser/app.js";
// NOTE: installGeneratedAudio is intentionally NOT re-exported here — a static
// value re-export would force every consumer of @aperture-engine/app/browser to
// load @aperture-engine/audio. Audio is opt-in via startGeneratedBrowserApp({
// audio: true }), which imports it dynamically. Only the types are surfaced.
export type { GeneratedAudio, GeneratedAudioOptions } from "./browser/audio.js";
export { startGeneratedSimulationWorker } from "./worker/start.js";
export type { StartGeneratedSimulationWorkerOptions } from "./worker/start.js";
import {
  beginApertureSystemBootstrap,
  finishApertureSystemBootstrap,
  disposeApertureAppOwners,
} from "./internal/app-lifecycle.js";
import { assertApertureBootstrapAllowed } from "./internal/bootstrap-safety.js";
export { disposeApertureApp } from "./internal/app-lifecycle.js";
export {
  assertApertureBootstrapAllowed,
  getApertureCleanupFailures,
} from "./internal/bootstrap-safety.js";
import {
  createExtractionApp,
  type CreateExtractionAppOptions,
  type ExtractionApp,
  type SimulationFixedStepClockState,
  type SimulationStepResult,
} from "@aperture-engine/runtime";
import type { RenderExtractionFeatureOptions } from "@aperture-engine/render";
import type { SystemConstructor, SystemQueries, SystemSchema } from "elics";
import { resolveWorldTransforms } from "@aperture-engine/simulation";
import {
  advanceApertureFrameTime,
  createApertureSystemContext,
  flushApertureSystemEffects,
  type ApertureAssetLoader,
  type ApertureDeterminismDiagnosticsOptions,
  type ApertureRandom,
  type SystemGltfAssetDecoderProvider,
  type ApertureSystemConstructor,
  type ApertureSystemContext,
} from "./systems.js";
import {
  createSpatialIndexPopulationState,
  populateSpatialIndexFromWorld,
} from "./systems/spatial-index-population.js";
import { applyPhysicsSnapshotInterpolation } from "./physics-interpolation.js";
import {
  applyRenderSnapshotInterpolation,
  installRenderInterpolationFixedStep,
} from "./render-interpolation.js";
import { runInteractionFrame } from "./interaction/system.js";
import { runHtmlBridgeFrame } from "./systems/html-bridge.js";
import { runScreenSpaceFramingFrame } from "./systems/screen-space-framing.js";
import {
  defineApertureConfig,
  type ApertureConfig,
  type AssetPreloadPolicy,
} from "./config.js";
import {
  type AperturePhysicsConfig,
  type AperturePhysicsFacade,
} from "./physics-facade.js";
import { resolveConfigPhysicsOption } from "./config-physics.js";
import {
  ApertureFeatureError,
  installApertureWorkerFeatures,
  resolveApertureWorkerFeatureOrder,
  type InstalledApertureWorkerFeatures,
  type MaybePromise,
  type RegisterExtractor,
} from "./features.js";
import { createAperturePhysicsFeature } from "./physics-feature.js";
import { installDefaultEnvironment } from "./default-environment.js";

export {
  DEFAULT_ENVIRONMENT_ASSET_ID,
  DEFAULT_ENVIRONMENT_IBL_COLORS,
  DEFAULT_ENVIRONMENT_IBL_INTENSITY,
  DEFAULT_ENVIRONMENT_LIGHT_KEY,
  DEFAULT_ENVIRONMENT_SKY_COLORS,
  DEFAULT_ENVIRONMENT_SKY_KEY,
  DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE,
  DEFAULT_ENVIRONMENT_SUN_KEY,
  defaultEnvironmentEquirectRgba8,
  installDefaultEnvironment,
} from "./default-environment.js";

export interface ApertureSystemModule {
  readonly default?: ApertureSystemConstructor;
  readonly configData?: Record<string, unknown>;
}

export interface ApertureResolvedSystemModule {
  readonly moduleId: string;
  readonly System: ApertureSystemConstructor;
  readonly priority: number;
  readonly configData?: Record<string, unknown>;
}

export interface CreateApertureAppOptions {
  readonly config: ApertureConfig;
  readonly systems?: readonly ApertureSystemModule[];
  readonly assetLoader?: ApertureAssetLoader;
  readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
  readonly worldOptions?: CreateExtractionAppOptions["worldOptions"];
  readonly fixedStep?: CreateExtractionAppOptions["fixedStep"];
  readonly physics?: boolean | AperturePhysicsConfig;
  readonly physicsInterpolation?: boolean;
  readonly startOptions?: Readonly<Record<string, unknown>>;
  /** Seed for the deterministic RNG (default 0) or a prebuilt RNG instance. */
  readonly random?: number | ApertureRandom;
  readonly determinism?: ApertureDeterminismDiagnosticsOptions;
}

export interface AperturePreloadReport {
  readonly blocking: readonly string[];
  readonly background: readonly string[];
  readonly manual: readonly string[];
}

export interface ApertureAppStepResult {
  readonly transform: SimulationStepResult["transform"];
  readonly fixedStep: SimulationStepResult["fixedStep"];
  readonly timing: ApertureAppStepTimingReport;
}

export interface ApertureAppStepTimingReport {
  readonly totalMilliseconds: number;
  readonly preStepResolveSpatialMilliseconds: number;
  readonly inputEffectsMilliseconds: number;
  readonly lowLevelStepMilliseconds: number;
  readonly updateEffectsMilliseconds: number;
  readonly postStepSpatialMilliseconds: number;
  readonly interactionMilliseconds: number;
  readonly postUpdateEffectsMilliseconds: number;
  readonly preStepWorldChanged: boolean;
  readonly lowLevel: SimulationStepResult["timing"];
}

export interface ApertureApp {
  readonly mode: ApertureConfig["mode"];
  readonly config: ApertureConfig;
  readonly lowLevel: ExtractionApp;
  readonly context: ApertureSystemContext;
  readonly features: InstalledApertureWorkerFeatures;
  readonly physics: AperturePhysicsFacade | null;
  readonly preload: AperturePreloadReport;
  step(delta?: number, time?: number): ApertureAppStepResult;
  extract(frame?: number): ReturnType<ExtractionApp["extract"]>;
  registerFixedStepTask(
    task: Parameters<ExtractionApp["registerFixedStepTask"]>[0],
    options?: Parameters<ExtractionApp["registerFixedStepTask"]>[1],
  ): () => void;
  resetFixedStepClock(): void;
  snapshotFixedStepClock(): SimulationFixedStepClockState | null;
  restoreFixedStepClock(state: SimulationFixedStepClockState | null): boolean;
  dispose(): MaybePromise<void>;
  stepAndExtract(
    delta?: number,
    time?: number,
    frame?: number,
  ): ReturnType<ExtractionApp["stepAndExtract"]>;
}

export class ApertureAppError extends Error {
  readonly code: string;
  readonly suggestedFix: string;
  readonly detail: Readonly<Record<string, unknown>> | undefined;

  constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly suggestedFix: string;
    readonly detail?: Readonly<Record<string, unknown>>;
  }) {
    super(`${input.message} Suggested fix: ${input.suggestedFix}`);
    this.name = "ApertureAppError";
    this.code = input.code;
    this.suggestedFix = input.suggestedFix;
    this.detail = input.detail;
  }
}

/** Validate app configuration, feature dependencies, and modules without creating a world. */
export function preflightApertureApp(
  options: Pick<CreateApertureAppOptions, "config" | "systems" | "physics">,
): void {
  assertApertureBootstrapAllowed();
  const config = defineApertureConfig(options.config);
  const physicsConfig = normalizePhysicsConfig(
    options.physics ?? resolveConfigPhysicsOption(config.physics),
  );
  resolveApertureWorkerFeatureOrder(
    physicsConfig === null
      ? (config.features ?? [])
      : [...(config.features ?? []), { id: "physics" }],
  );
  resolveApertureSystemModules(options.systems ?? []);
}

export async function createApertureApp(
  options: CreateApertureAppOptions,
): Promise<ApertureApp> {
  preflightApertureApp(options);
  const config = defineApertureConfig(options.config);
  // Honor a declarative `config.physics` block when no imperative `physics`
  // option was passed. The worker/browser loop resolves this itself before
  // calling in; deriving it here as well means the headless runner, the
  // one-shot CLI, and any direct `createApertureApp` caller wire physics
  // identically from a shared config — closing the headless/browser gap (F12).
  const physicsConfig = normalizePhysicsConfig(
    options.physics ?? resolveConfigPhysicsOption(config.physics),
  );
  const featureExtractorRegistry = createFeatureExtractorRegistry(
    resolveRenderExtractionFeatures(config),
  );

  if (physicsConfig !== null && options.fixedStep === false) {
    throw new ApertureAppError({
      code: "aperture.physics.fixedStepDisabled",
      message: "Aperture physics requires an enabled fixed-step clock.",
      suggestedFix:
        "Omit fixedStep to use the default clock, pass fixedStep options, or disable the physics config.",
    });
  }

  const fixedStep =
    options.fixedStep === undefined && physicsConfig !== null
      ? {}
      : options.fixedStep;
  // Mirrors createSimulationFixedStepRunner's disabled condition.
  const fixedStepEnabled =
    fixedStep !== undefined &&
    fixedStep !== false &&
    fixedStep.enabled !== false;
  const lowLevel = createExtractionApp({
    ...(options.worldOptions === undefined
      ? {}
      : { worldOptions: options.worldOptions }),
    ...(fixedStep === undefined ? {} : { fixedStep }),
    renderFeatures: () => featureExtractorRegistry.renderFeatures(),
  });
  const context = createApertureSystemContext({
    world: lowLevel.world,
    assetsRegistry: lowLevel.assets,
    config,
    registerFixedStepTask: (task, taskOptions) => {
      if (!fixedStepEnabled) {
        // Registration against a disabled runner used to succeed silently
        // and the task simply never ran (battletest finding F16).
        context.diagnostics.warn(
          "aperture.fixedStep.taskWhileDisabled",
          { hasPhysicsConfig: physicsConfig !== null },
          "A fixed-step task was registered but the fixed-step runner is disabled, so it will never run. Enable physics in the app config or pass fixedStep options to schedule fixed-step tasks.",
        );
      }
      return lowLevel.registerFixedStepTask(task, taskOptions);
    },
    ...(options.startOptions === undefined
      ? {}
      : { startOptions: options.startOptions }),
    ...(options.assetLoader === undefined
      ? {}
      : { assetLoader: options.assetLoader }),
    ...(options.gltfAssetDecoders === undefined
      ? {}
      : { gltfAssetDecoders: options.gltfAssetDecoders }),
    ...(options.random === undefined ? {} : { random: options.random }),
    ...(options.determinism === undefined
      ? {}
      : { determinism: options.determinism }),
  });
  const preload = preloadReport(config);
  const spatialIndexPopulation = createSpatialIndexPopulationState();
  installRenderInterpolationFixedStep({
    world: lowLevel.world,
    registerFixedStepTask: (task, taskOptions) =>
      lowLevel.registerFixedStepTask(task, taskOptions),
  });
  const physicsInterpolation = options.physicsInterpolation === true;
  const physicsFeature =
    physicsConfig === null
      ? null
      : createAperturePhysicsFeature({
          config: physicsConfig,
          physics: context.physics,
        });
  const workerFeatures =
    physicsFeature === null
      ? (config.features ?? [])
      : [...(config.features ?? []), physicsFeature];
  let installedFeatures: InstalledApertureWorkerFeatures | null = null;
  let lastFixedStep: ReturnType<ExtractionApp["step"]>["fixedStep"] | null =
    null;
  const refreshSpatialIndex = () =>
    populateSpatialIndexFromWorld(
      {
        world: lowLevel.world,
        assetsRegistry: context.assetsRegistry,
        spatial: context.spatial,
      },
      spatialIndexPopulation,
    );

  beginApertureSystemBootstrap(lowLevel.world);
  try {
    installedFeatures = await installApertureWorkerFeatures({
      features: workerFeatures,
      world: lowLevel.world,
      assets: lowLevel.assets,
      registerFixedStepTask: (task, taskOptions) =>
        lowLevel.registerFixedStepTask(task, taskOptions),
      registerExtractor: featureExtractorRegistry.registerExtractor,
    });

    const physicsFacade = physicsFeature?.getFacade() ?? null;

    await preloadAssets(context, "blocking");
    startBackgroundPreloads(context);
    installRenderDefaults(config, context);
    registerApertureSystemModules(lowLevel, options.systems ?? []);
    // After user setup systems have initialized, so an authored sky, skybox,
    // or environment light suppresses the zero-config default environment.
    installDefaultEnvironment({ config, context, world: lowLevel.world });
    resolveWorldTransforms(lowLevel.world);
    refreshSpatialIndex();
    // AI-60 (cheap half): the pre-step resolve + spatial refresh only repeat
    // when the world actually changed since the post-step refresh (between-step
    // spawns, devtools writes, interaction or postUpdate effects). Steady-state
    // frames run exactly one resolve (inside lowLevel.step, after fixed-step
    // physics writeback) and one spatial refresh per step.
    let worldVersionAtRefresh = lowLevel.world.worldChangeVersion();

    const apertureApp: ApertureApp = {
      mode: config.mode,
      config,
      lowLevel,
      context,
      features: installedFeatures,
      physics: physicsFacade,
      preload,
      step(delta = 0, time = 0) {
        // Advance the sanctioned sim-clock before any system runs this frame.
        advanceApertureFrameTime(context.time, delta, time);
        const timingStartedAt = nowMilliseconds();
        let timingCursor = timingStartedAt;
        const markTiming = (): number => {
          const now = nowMilliseconds();
          const elapsed = Math.max(0, now - timingCursor);

          timingCursor = now;
          return elapsed;
        };
        const preStepWorldChanged =
          lowLevel.world.worldChangeVersion() !== worldVersionAtRefresh;

        runHtmlBridgeFrame({
          commands: context.commands,
          resources: context.resources,
        });

        if (preStepWorldChanged) {
          resolveWorldTransforms(lowLevel.world);
          refreshSpatialIndex();
        }
        const preStepResolveSpatialMilliseconds = markTiming();
        flushApertureSystemEffects(lowLevel.world, "input");
        const inputEffectsMilliseconds = markTiming();
        const result = lowLevel.step(delta, time);
        const lowLevelStepMilliseconds = markTiming();
        flushApertureSystemEffects(lowLevel.world, "update");
        const updateEffectsMilliseconds = markTiming();
        lastFixedStep = result.fixedStep;
        const framing = runScreenSpaceFramingFrame(context, delta);
        if (framing.updated > 0) {
          resolveWorldTransforms(lowLevel.world);
        }
        refreshSpatialIndex();
        const postStepSpatialMilliseconds = markTiming();
        worldVersionAtRefresh = lowLevel.world.worldChangeVersion();
        // Synthesize pointer-on-object events from post-update world state, after
        // fixed-step physics writeback has refreshed transforms and picking data.
        runInteractionFrame(context, time);
        const interactionMilliseconds = markTiming();
        flushApertureSystemEffects(lowLevel.world, "postUpdate");
        const postUpdateEffectsMilliseconds = markTiming();
        return {
          ...result,
          timing: {
            totalMilliseconds: Math.max(0, nowMilliseconds() - timingStartedAt),
            preStepResolveSpatialMilliseconds,
            inputEffectsMilliseconds,
            lowLevelStepMilliseconds,
            updateEffectsMilliseconds,
            postStepSpatialMilliseconds,
            interactionMilliseconds,
            postUpdateEffectsMilliseconds,
            preStepWorldChanged,
            lowLevel: result.timing,
          },
        };
      },
      extract(frame = 0) {
        const snapshot = lowLevel.extract(frame);

        if (physicsInterpolation && lastFixedStep !== null) {
          applyPhysicsSnapshotInterpolation({
            snapshot,
            world: lowLevel.world,
            alpha: lastFixedStep.overstepAlpha,
          });
        }

        if (lastFixedStep !== null) {
          applyRenderSnapshotInterpolation({
            snapshot,
            world: lowLevel.world,
            alpha: lastFixedStep.overstepAlpha,
          });
        }

        return snapshot;
      },
      registerFixedStepTask(task, taskOptions) {
        return lowLevel.registerFixedStepTask(task, taskOptions);
      },
      resetFixedStepClock() {
        lowLevel.resetFixedStepClock();
      },
      snapshotFixedStepClock() {
        return lowLevel.snapshotFixedStepClock();
      },
      restoreFixedStepClock(state) {
        return lowLevel.restoreFixedStepClock(state);
      },
      stepAndExtract(delta = 0, time = 0, frame = 0) {
        apertureApp.step(delta, time);
        return apertureApp.extract(frame);
      },
      dispose() {
        return installedFeatures?.dispose();
      },
    };

    finishApertureSystemBootstrap(lowLevel.world);
    return apertureApp;
  } catch (error) {
    // Preserve the startup failure. Cleanup evidence remains available even
    // when an initializer or a secondary disposer also fails.
    await disposeApertureAppOwners(lowLevel.world, () =>
      installedFeatures?.dispose(),
    );
    throw error;
  }
}

function normalizePhysicsConfig(
  config: CreateApertureAppOptions["physics"],
): AperturePhysicsConfig | null {
  if (config === undefined || config === false) {
    return null;
  }

  return config === true ? {} : config;
}

export function resolveApertureSystemModules(
  modules: readonly ApertureSystemModule[],
): ApertureResolvedSystemModule[] {
  return modules
    .map((moduleValue, index) => resolveSystemModule(moduleValue, index))
    .sort(
      (a, b) => a.priority - b.priority || a.moduleId.localeCompare(b.moduleId),
    );
}

export function registerApertureSystemModules(
  app: Pick<ExtractionApp, "world">,
  modules: readonly ApertureSystemModule[],
): readonly ApertureResolvedSystemModule[] {
  const resolved = resolveApertureSystemModules(modules);

  for (const moduleValue of resolved) {
    app.world.registerSystem(
      moduleValue.System as unknown as SystemConstructor<
        SystemSchema,
        SystemQueries
      >,
      {
        priority: moduleValue.priority,
        ...(moduleValue.configData === undefined
          ? {}
          : { configData: moduleValue.configData }),
      },
    );
  }

  return resolved;
}

function resolveSystemModule(
  moduleValue: ApertureSystemModule,
  index: number,
): ApertureResolvedSystemModule {
  if (moduleValue.default === undefined) {
    throw new ApertureAppError({
      code: "aperture.system.missingDefaultExport",
      message: `Discovered system module at index ${index} has no default export.`,
      suggestedFix:
        "Default-export a class that extends createSystem() from @aperture-engine/app/systems.",
      detail: { index },
    });
  }

  if (!isSystemConstructor(moduleValue.default)) {
    throw new ApertureAppError({
      code: "aperture.system.invalidDefaultExport",
      message: `Discovered system module at index ${index} does not export an EliCS system class.`,
      suggestedFix:
        "Use export default class MySystem extends createSystem(...) { ... }.",
      detail: { index },
    });
  }

  const priority = moduleValue.default.aperture?.schedule.priority ?? 0;

  if (!Number.isFinite(priority)) {
    throw new ApertureAppError({
      code: "aperture.system.invalidPriority",
      message: `Discovered system module at index ${index} has an invalid createSystem descriptor priority.`,
      suggestedFix: "Use createSystem({ priority: 0 }) or omit priority.",
      detail: { index, priority },
    });
  }

  return {
    moduleId: moduleValue.default.name || `system:${index}`,
    System: moduleValue.default,
    priority,
    ...(moduleValue.configData === undefined
      ? {}
      : { configData: moduleValue.configData }),
  };
}

function isSystemConstructor(
  value: unknown,
): value is ApertureSystemConstructor {
  return (
    typeof value === "function" &&
    "isSystem" in value &&
    (value as { readonly isSystem?: unknown }).isSystem === true
  );
}

async function preloadAssets(
  context: ApertureSystemContext,
  policy: AssetPreloadPolicy,
): Promise<void> {
  const matching = context.assets
    .list()
    .filter((asset) => asset.preload === policy);

  await Promise.all(matching.map((asset) => context.assets.request(asset)));
}

function startBackgroundPreloads(context: ApertureSystemContext): void {
  for (const asset of context.assets.list()) {
    if (asset.preload !== "background") {
      continue;
    }

    void context.assets.request(asset).catch(() => undefined);
  }
}

function preloadReport(config: ApertureConfig): AperturePreloadReport {
  const byPolicy: Record<AssetPreloadPolicy, string[]> = {
    blocking: [],
    background: [],
    manual: [],
  };

  for (const [id, descriptor] of Object.entries(config.assets ?? {})) {
    byPolicy[descriptor.preload].push(id);
  }

  return {
    blocking: byPolicy.blocking,
    background: byPolicy.background,
    manual: byPolicy.manual,
  };
}

function nowMilliseconds(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

type MutableRenderExtractionFeatureOptions = {
  -readonly [Key in keyof RenderExtractionFeatureOptions]?: RenderExtractionFeatureOptions[Key];
};

interface FeatureExtractorRegistry {
  readonly registerExtractor: RegisterExtractor;
  renderFeatures(): RenderExtractionFeatureOptions | undefined;
}

const RENDER_PACKET_FAMILY_FEATURES = new Map<
  string,
  keyof RenderExtractionFeatureOptions
>([
  ["particleEmitters", "particles"],
  ["uiNodes", "ui"],
  ["uiHitRegions", "ui"],
]);

function createFeatureExtractorRegistry(
  initialFeatures: RenderExtractionFeatureOptions | undefined,
): FeatureExtractorRegistry {
  const baseFeatures =
    initialFeatures === undefined ? undefined : { ...initialFeatures };
  const featureCounts = new Map<keyof RenderExtractionFeatureOptions, number>();

  const registerExtractor: RegisterExtractor = (hook) => {
    const featureKeys = new Set<keyof RenderExtractionFeatureOptions>();
    const unknownFamilies = hook.packetFamilies.filter(
      (packetFamily) => !RENDER_PACKET_FAMILY_FEATURES.has(packetFamily),
    );

    // An unknown family can never produce packets, so a successful-looking
    // registration would be a silent no-op. Fail the install instead.
    if (unknownFamilies.length > 0) {
      const message = `Feature '${hook.id}' registered an extractor for unknown packet ${unknownFamilies.length === 1 ? "family" : "families"}: ${unknownFamilies
        .map((family) => `'${family}'`)
        .join(", ")}.`;
      const suggestedFix = `Use a packet family the render extraction contract defines (${[
        ...RENDER_PACKET_FAMILY_FEATURES.keys(),
      ].join(", ")}) or extend the contract before registering the extractor.`;

      throw new ApertureFeatureError({
        code: "aperture.feature.unknownPacketFamily",
        message,
        suggestedFix,
        diagnostics: [
          {
            code: "aperture.feature.unknownPacketFamily",
            severity: "error",
            featureId: hook.id,
            message,
            suggestedFix,
            data: {
              packetFamilies: [...hook.packetFamilies],
              unknownFamilies,
            },
          },
        ],
      });
    }

    for (const packetFamily of hook.packetFamilies) {
      const featureKey = RENDER_PACKET_FAMILY_FEATURES.get(packetFamily);

      if (featureKey !== undefined) {
        featureKeys.add(featureKey);
      }
    }

    for (const featureKey of featureKeys) {
      featureCounts.set(featureKey, (featureCounts.get(featureKey) ?? 0) + 1);
    }

    let disposed = false;
    return () => {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const featureKey of featureKeys) {
        const next = (featureCounts.get(featureKey) ?? 0) - 1;

        if (next <= 0) {
          featureCounts.delete(featureKey);
        } else {
          featureCounts.set(featureKey, next);
        }
      }
    };
  };

  return {
    registerExtractor,
    renderFeatures() {
      if (baseFeatures === undefined && featureCounts.size === 0) {
        return undefined;
      }

      const resolved: MutableRenderExtractionFeatureOptions = {
        ...(baseFeatures ?? {}),
      };

      for (const [featureKey, count] of featureCounts) {
        if (count > 0) {
          resolved[featureKey] = true;
        }
      }

      return resolved;
    },
  };
}

function resolveRenderExtractionFeatures(
  config: ApertureConfig,
): RenderExtractionFeatureOptions | undefined {
  if (config.features === undefined) {
    return undefined;
  }

  const featureIds = new Set(config.features.map((feature) => feature.id));

  return {
    particles: featureIds.has("particles"),
    ui: featureIds.has("ui"),
  };
}

function installRenderDefaults(
  config: ApertureConfig,
  context: ApertureSystemContext,
): void {
  if (config.render?.defaultCamera === true) {
    context.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 1.5, 5],
        lookAt: [0, 0.75, 0],
      },
      fovYDegrees: 60,
    });
  }

  if (config.render?.defaultLight === true) {
    context.spawn.light({
      key: "light.default",
      name: "default-light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });
  }
}
```

Stderr:

```text

```

## Command a8b701c9ae1843e595b76060afc76922

2026-10-11T23:39:43.536138+00:00 → 2026-10-11T23:39:43.653174+00:00; exit 0; duration 0.117s.

Command:

```sh
sed -n "1,240p" /sdk/source/app/src/browser/app.ts; sed -n "1,200p" /sdk/source/app/src/worker/start.ts; grep -n "autoStart\|manual\|worker\|snapshot\|renderFrame\|stop" /sdk/source/app/src/browser/app.ts | head -70; cat /sdk/source/webgpu/dist/index.d.ts | head -60
```

Stdout:

```text
import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import { createApertureDevtoolsRequest } from "../commands.js";
import {
  createWebGpuApp,
  createWebGpuBloomPostEffect,
  createWebGpuSsaoPostEffect,
  type CreateWebGpuAppResult,
  type WebGpuAppComputePassDescriptor,
  type WebGpuAppRenderPassDescriptor,
  type WebGpuCanvasLike,
} from "@aperture-engine/webgpu";
import { defineApertureConfig, type ApertureConfig } from "../config.js";
// Type-only: the audio module is imported DYNAMICALLY below, only when audio is
// enabled, so a non-audio app (and every example whose import map omits
// @aperture-engine/audio) never loads it.
import type { GeneratedAudio, GeneratedAudioOptions } from "./audio.js";
import { mirrorSimulationWorkerSourceAssets } from "./assets.js";
import { resolveCanvas, installCanvasResizeSync } from "./canvas.js";
import { installGeneratedCommandForwarding } from "./commands.js";
import { syncGeneratedDiagnostics } from "./diagnostics.js";
import { installGeneratedDevtoolsRuntime } from "./devtools/index.js";
import { resolveUseFrameGraph } from "./frame-graph-route.js";
import { resolveGpuTimings } from "./gpu-timings-route.js";
import { installGeneratedInputForwarding } from "./input.js";
import {
  readGeneratedRenderProfileEnvironment,
  resolveGeneratedEffectiveRenderDefaults,
  resolveGeneratedRenderSettings,
  resolveGeneratedTonemapAndExposure,
} from "./render.js";
import {
  installGeneratedRenderDiagnosticsAccessor,
  installGeneratedStatus,
  type GeneratedBrowserSystemManifestEntry,
} from "./status.js";

export interface StartGeneratedBrowserAppOptions {
  readonly config: ApertureConfig;
  readonly workerEntry: SimulationWorkerEntry;
  readonly systemManifest?: readonly GeneratedBrowserSystemManifestEntry[];
  readonly devtools?: {
    readonly enabled?: boolean;
  };
  readonly workerFactory?: (
    entry: string | URL,
    options?: WorkerOptions,
  ) => Worker;
  /**
   * Extra fields forwarded verbatim to the simulation worker's start options
   * (SimulationWorkerStartOptions). The page URL only exists on the main thread,
   * so the generated browser bootstrap reads e.g. `?map=` from location.search
   * and threads the value here; app systems read filtered app-level fields
   * through `this.startOptions`. Merged into the worker `start` message.
   */
  readonly workerStartOptions?: Record<string, unknown>;
  /**
   * Opt into main-thread audio. `true` wires the engine with defaults; an
   * options object configures buses/ducking/clip resolution. Omitted ⇒ no audio
   * engine is created (zero cost). Audio is a sibling derived view of the same
   * worker snapshot the renderer consumes.
   */
  readonly audio?: boolean | GeneratedAudioOptions;
}

export interface GeneratedBrowserApp {
  readonly worker: SimulationWorker;
  readonly webgpu: CreateWebGpuAppResult;
  /** The wired audio engine + teardown, or null when audio was not enabled. */
  readonly audio: GeneratedAudio | null;
  // M3-T7: surface the user-pass insertion API through the generated app so a
  // developer can register custom render/compute passes without reaching into
  // `.webgpu.app`. No-ops (with a console warning) if WebGPU failed to start.
  addRenderPass(descriptor: WebGpuAppRenderPassDescriptor): void;
  addComputePass(descriptor: WebGpuAppComputePassDescriptor): void;
  removePass(name: string): boolean;
}

export async function startGeneratedBrowserApp(
  options: StartGeneratedBrowserAppOptions,
): Promise<GeneratedBrowserApp> {
  const config = defineApertureConfig(options.config);
  const canvas = resolveCanvas(config);
  const renderProfile = resolveGeneratedEffectiveRenderDefaults(
    config.render,
    readGeneratedRenderProfileEnvironment(canvas),
  );
  const render = renderProfile.render;
  const sourceAssets = new AssetRegistry();
  const status = installGeneratedStatus();
  status.render = resolveGeneratedRenderSettings(
    render,
    undefined,
    renderProfile.profile,
  );
  status.systems = options.systemManifest ?? [];
  const demandDriven = render?.cadence === "demand";
  let webgpuResult: CreateWebGpuAppResult | null = null;
  const worker = createSimulationWorker(options.workerEntry, {
    workerOptions: { type: "module" },
    ...(options.workerFactory === undefined
      ? {}
      : { workerFactory: options.workerFactory }),
  });
  const scheduleDemandStep = demandDriven
    ? createGeneratedDemandStepScheduler(worker)
    : null;

  installGeneratedInputForwarding(canvas, worker, status, config);
  installGeneratedCommandForwarding(worker, status, {
    ...(scheduleDemandStep === null
      ? {}
      : { afterForward: scheduleDemandStep }),
  });
  if (options.devtools?.enabled === true) {
    installGeneratedDevtoolsRuntime({
      worker,
      getWebGpuResult: () => webgpuResult,
    });
  }
  installCanvasResizeSync(canvas, worker, status, render, {
    renderProfile: renderProfile.profile,
    ...(scheduleDemandStep === null ? {} : { afterResize: scheduleDemandStep }),
  });

  const mirroredWorker = mirrorSimulationWorkerSourceAssets(
    worker,
    sourceAssets,
    status,
  );
  // M3-T4 / AI-25: the single-encoder FrameGraph route is the DEFAULT at
  // parity. render.frameGraph: false (or the ?graph=0 per-load override)
  // forces the legacy multi-submit route; the flag is passed explicitly so
  // `false` really forces legacy instead of deferring to the renderer default.
  const browserSearch =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const useFrameGraph = resolveUseFrameGraph(render, browserSearch);
  const gpuTimings = resolveGpuTimings(browserSearch);
  const postEffects = resolveGeneratedPostEffects(render);
  // Generated apps tonemap with ACES through the HDR path by default; post
  // effects (bloom/SSAO) always imply the HDR path. An explicit tonemap
  // "none" without them keeps the legacy byte-identical 8-bit path.
  const { tonemap, exposure } = resolveGeneratedTonemapAndExposure(
    render,
    postEffects.length > 0,
  );
  const audioOptions = resolveGeneratedAudioOptions(config, options.audio);
  const workerStartOptions = createGeneratedWorkerStartOptions({
    workerStartOptions: options.workerStartOptions,
    audioOptions,
    demandDriven,
    renderProfile: renderProfile.profile,
  });
  let applyAudioSnapshot: ((snapshot: RenderSnapshot) => void) | null = null;
  const webgpu = await createWebGpuApp({
    canvas: canvas as unknown as WebGpuCanvasLike,
    simulationWorker: mirroredWorker,
    sourceAssets,
    autoStart: false,
    msaaSampleCount: status.render.requestedSampleCount,
    useFrameGraph,
    presentationCadence: demandDriven ? "snapshot" : "continuous",
    onPresentationSnapshot(snapshot) {
      applyAudioSnapshot?.(snapshot);
    },
    ...(gpuTimings === undefined ? {} : { gpuTimings }),
    ...(workerStartOptions === undefined ? {} : { workerStartOptions }),
    tonemap,
    ...(exposure === undefined ? {} : { exposure }),
    ...(postEffects.length === 0 ? {} : { postEffects }),
  });
  webgpuResult = webgpu;

  status.webgpuOk = webgpu.ok;
  status.status = webgpu.ok ? "running" : "webgpu-failed";
  status.diagnostics = webgpu.ok ? webgpu.app.getDiagnostics() : webgpu;
  if (webgpu.ok) {
    installGeneratedRenderDiagnosticsAccessor(status, {
      getDiagnostics: webgpu.app.getDiagnostics,
    });
    syncGeneratedDiagnostics(webgpu.app.getDiagnostics, status);
  }

  // Audio is a sibling derived view: it subscribes to the same worker snapshots.
  // The renderer's asset-mirroring subscription is registered first (createWebGpuApp
  // autoStart, above), so by the time this raw-worker subscription fires each
  // frame, `sourceAssets` already holds the mirrored audio-clip bytes. The audio
  // module is imported dynamically only when enabled, so a non-audio app never
  // loads @aperture-engine/audio.
  let audio: GeneratedAudio | null = null;
  if (audioOptions !== undefined && audioOptions !== false) {
    const { installGeneratedAudio } = await import("./audio.js");
    audio = installGeneratedAudio(
      worker,
      sourceAssets,
      audioOptions === true
        ? { snapshotSource: "manual" }
        : { ...audioOptions, snapshotSource: "manual" },
    );
    applyAudioSnapshot = audio?.applySnapshot ?? null;
  }

  if (webgpu.ok) {
    webgpu.app.start();
    scheduleDemandStep?.();
  }

  return {
    worker,
    webgpu,
    audio,
    addRenderPass(descriptor) {
      if (webgpu.ok) {
        webgpu.app.addRenderPass(descriptor);
      }
    },
    addComputePass(descriptor) {
      if (webgpu.ok) {
        webgpu.app.addComputePass(descriptor);
      }
    },
    removePass(name) {
      return webgpu.ok ? webgpu.app.removePass(name) : false;
    },
  };
}

function createGeneratedWorkerStartOptions(options: {
  readonly workerStartOptions: Record<string, unknown> | undefined;
  readonly audioOptions: boolean | GeneratedAudioOptions | false | undefined;
  readonly demandDriven?: boolean;
  readonly renderProfile?: string | null;
}): Record<string, unknown> | undefined {
import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { ApertureApp, ApertureSystemModule } from "../advanced.js";
import type { ApertureConfig } from "../config.js";
import {
  isApertureDevtoolsRequest,
  isGeneratedCommandMessage,
  type ApertureDevtoolsRequest,
  type ApertureGeneratedCommandMessage,
} from "../commands.js";
import {
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEventMessage,
} from "../input.js";
import { applyGeneratedCommand } from "./commands.js";
import type { GeneratedDevtoolsBridge } from "./devtools/bridge.js";
import {
  createGeneratedEntityToolBridge,
  type GeneratedEntityToolBridge,
} from "../devtools/entities.js";
import { runGeneratedWorkerLoop } from "./loop.js";

export interface StartGeneratedSimulationWorkerOptions {
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly port?: SimulationMessagePort;
}

export function startGeneratedSimulationWorker(
  options: StartGeneratedSimulationWorkerOptions,
): void {
  if (options.port === undefined) {
    waitForWorkerPort((port) => {
      attachWorkerPort({ ...options, port });
    });
    return;
  }

  attachWorkerPort({ ...options, port: options.port });
}

function attachWorkerPort(
  options: StartGeneratedSimulationWorkerOptions & {
    readonly port: SimulationMessagePort;
  },
): void {
  const port = options.port;
  const pendingInput: ApertureGeneratedInputEventMessage[] = [];
  const pendingCommands: ApertureGeneratedCommandMessage[] = [];
  const pendingDevtools: ApertureDevtoolsRequest[] = [];
  let app: ApertureApp | null = null;
  let entityTools: GeneratedEntityToolBridge | null = null;
  let devtools: GeneratedDevtoolsBridge | null = null;

  port.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (isGeneratedInputEventMessage(message)) {
      pendingInput.push(message);
      return;
    }

    if (isGeneratedCommandMessage(message)) {
      if (app === null || entityTools === null) {
        pendingCommands.push(message);
      } else {
        applyGeneratedCommand(app, entityTools, message);
      }
      return;
    }

    if (isApertureDevtoolsRequest(message)) {
      if (devtools === null) {
        pendingDevtools.push(message);
      } else {
        devtools.handle(message);
      }
      return;
    }

    if (!isStartMessage(message)) {
      return;
    }

    const start = startOptionsFromMessage(message);

    void runGeneratedWorkerLoop({
      port,
      config: options.config,
      systems: options.systems,
      start,
      pendingInput,
      createEntityTools: createGeneratedEntityToolBridge,
      setApp(nextApp, nextEntityTools, nextDevtools) {
        app = nextApp;
        entityTools = nextEntityTools;
        devtools = nextDevtools;

        for (const pending of pendingCommands.splice(0)) {
          applyGeneratedCommand(nextApp, nextEntityTools, pending);
        }
        for (const pending of pendingDevtools.splice(0)) {
          nextDevtools.handle(pending);
        }
      },
    });
  });
  port.start?.();
}

function waitForWorkerPort(
  callback: (port: SimulationMessagePort) => void,
): void {
  const workerScope = globalThis as unknown as {
    addEventListener(
      type: "message",
      listener: (event: MessageEvent<unknown>) => void,
    ): void;
  };

  workerScope.addEventListener("message", (event) => {
    const message = event.data;
    if (
      typeof message === "object" &&
      message !== null &&
      (message as { readonly type?: unknown }).type ===
        SIMULATION_WORKER_PROTOCOL.connect
    ) {
      const port =
        (message as { readonly port?: SimulationMessagePort }).port ?? null;

      if (port !== null) {
        port.start?.();
        callback(port);
      }
    }
  });
}

function isStartMessage(value: unknown): value is SimulationWorkerStartOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.start
  );
}

function startOptionsFromMessage(
  message: SimulationWorkerStartOptions,
): SimulationWorkerStartOptions {
  const nested = message.options;

  if (nested === null || typeof nested !== "object" || Array.isArray(nested)) {
    return message;
  }

  return {
    ...message,
    ...(nested as Record<string, unknown>),
  };
}
45:  readonly workerEntry: SimulationWorkerEntry;
50:  readonly workerFactory?: (
55:   * Extra fields forwarded verbatim to the simulation worker's start options
59:   * through `this.startOptions`. Merged into the worker `start` message.
61:  readonly workerStartOptions?: Record<string, unknown>;
66:   * worker snapshot the renderer consumes.
72:  readonly worker: SimulationWorker;
104:  const worker = createSimulationWorker(options.workerEntry, {
105:    workerOptions: { type: "module" },
106:    ...(options.workerFactory === undefined
108:      : { workerFactory: options.workerFactory }),
111:    ? createGeneratedDemandStepScheduler(worker)
114:  installGeneratedInputForwarding(canvas, worker, status, config);
115:  installGeneratedCommandForwarding(worker, status, {
122:      worker,
126:  installCanvasResizeSync(canvas, worker, status, render, {
132:    worker,
155:  const workerStartOptions = createGeneratedWorkerStartOptions({
156:    workerStartOptions: options.workerStartOptions,
161:  let applyAudioSnapshot: ((snapshot: RenderSnapshot) => void) | null = null;
166:    autoStart: false,
169:    presentationCadence: demandDriven ? "snapshot" : "continuous",
170:    onPresentationSnapshot(snapshot) {
171:      applyAudioSnapshot?.(snapshot);
174:    ...(workerStartOptions === undefined ? {} : { workerStartOptions }),
191:  // Audio is a sibling derived view: it subscribes to the same worker snapshots.
193:  // autoStart, above), so by the time this raw-worker subscription fires each
201:      worker,
204:        ? { snapshotSource: "manual" }
205:        : { ...audioOptions, snapshotSource: "manual" },
216:    worker,
236:  readonly workerStartOptions: Record<string, unknown> | undefined;
243:      ? options.workerStartOptions
246:          ...(options.workerStartOptions ?? {}),
268:  worker: SimulationWorker,
282:      worker.postMessage(
export * from "./gpu/initialize-webgpu.js";
export * from "./app/app.js";
export * from "./app/app-environment-frame.js";
export * from "./app/app-environment-resources.js";
export * from "./app/shadow-caster-graph-pass.js";
export * from "./gpu/buffer.js";
export * from "./render/clear/clear.js";
export * from "./render/clear/clear-readback.js";
export * from "./gpu/command-buffer.js";
export * from "./gpu/command-encoder.js";
export * from "./materials/custom-wgsl/custom-wgsl-material.js";
export * from "./lighting/brdf-lut-compute-pipeline.js";
export * from "./lighting/brdf-lut-resource.js";
export * from "./lighting/irradiance-convolution-compute-pipeline.js";
export * from "./lighting/equirect-to-cube-compute-pipeline.js";
export * from "./lighting/equirect-to-cube-resource.js";
export * from "./lighting/diffuse-ibl-resource-summary.js";
export * from "./shadows/directional-shadow-matrix-computation.js";
export * from "./shadows/directional-shadow-view-projection-plan.js";
export * from "./lighting/environment-map-readiness.js";
export * from "./render/draw/draw-command.js";
export * from "./lighting/ibl-preparation-pass-plan.js";
export * from "./lighting/ibl-preparation-resource-summary.js";
export * from "./lighting/ibl-resource-descriptor.js";
export * from "./lighting/ibl-sampler-descriptor-readiness.js";
export * from "./lighting/ibl-sampler-resource.js";
export * from "./lighting/ibl-texture-preparation.js";
export * from "./lighting/ibl-texture-resource.js";
export * from "./resources/attributes/instance-attribute-buffer.js";
export * from "./render/frame/render-frame-plan.js";
export * from "./gpu/gpu-timing.js";
export * from "./materials/core/material-dependency-diagnostics-summary.js";
export * from "./lighting/lighting-resource-plan.js";
export * from "./lighting/local-light-atlas-slot-allocator.js";
export * from "./resources/meshes/mesh-buffer-descriptors.js";
export * from "./resources/meshes/mesh-buffer-resources.js";
export * from "./output/output-stage-tonemap.js";
export * from "./post/post-bloom.js";
export * from "./post/post-dof.js";
export * from "./post/post-fxaa.js";
export * from "./post/post-tonemap.js";
export * from "./app/user-pass.js";
export * from "./app/feature-command-groups.js";
export * from "./app/text.js";
export * from "./app/ui.js";
export * from "./app/particles.js";
export * from "./app/procedural-sky.js";
export * from "./post/post-pass.js";
export * from "./post/post-color-history.js";
export * from "./post/post-ssao.js";
export * from "./post/post-ssr.js";
export * from "./post/post-taa.js";
export * from "./shadows/point-shadow-matrix-computation.js";
export * from "./shadows/point-shadow-view-projection-plan.js";
export * from "./shadows/spot-shadow-matrix-computation.js";
export * from "./shadows/spot-shadow-view-projection-plan.js";
export * from "./resources/core/prepared-resource-app-reuse-alignment-summary.js";
export * from "./resources/core/prepared-resource-lifetime-alignment-summary.js";
export * from "./render/queues/queue-submit.js";
export { createInjectedRenderFrameSnapshotResourceBindingPlanScratch, planInjectedRenderFrameSnapshotResourceBindings, writeInjectedRenderFrameSnapshotResourceBindings, type InjectedRenderFrameSnapshotResourceBinding, type InjectedRenderFrameSnapshotResourceBindingPlan, type InjectedRenderFrameSnapshotResourceBindingPlanInput, type InjectedRenderFrameSnapshotResourceBindingPlanScratch, type InjectedRenderFrameSnapshotResourceKeyResolver, } from "./render/frame/renderer-frame-summary.js";
```

Stderr:

```text

```

## Command 246394d1edac4a3284ba865c6742da59

2026-10-11T23:39:47.700759+00:00 → 2026-10-11T23:39:47.819119+00:00; exit 0; duration 0.118s.

Command:

```sh
sed -n "1,230p" /sdk/source/webgpu/dist/app/app.d.ts; cat /sdk/source/runtime/dist/worker/simulation-worker.d.ts; cat /sdk/source/app/src/browser/assets.ts; sed -n "1,220p" /sdk/source/app/src/worker/loop.ts
```

Stdout:

```text
import type { AssetRegistry } from "@aperture-engine/simulation";
import type { RenderWorld, MaterialAssetDependencyReadinessReportJsonValue, PreparedMaterialStoreJsonValue, PreparedMeshStoreJsonValue, PackedSnapshotViewUniforms, RenderEntityRef, RenderSnapshot, RenderSnapshotChangeSet, RenderSnapshotUpdateSchedule, LightingHealthReport } from "@aperture-engine/render";
import { type AppTextureSamplerResourceCacheSummary } from "./app-texture-sampler-resources.js";
import type { PreparedAppMaterialCacheSummary } from "../materials/core/prepared-app-material-resource.js";
import type { PreparedBuiltInMaterialCacheEvictionReport } from "../materials/core/prepared-built-in-material-store.js";
import type { PreparedMeshGpuResourceCacheEvictionReport, PreparedMeshGpuResourceCacheSummary } from "../resources/meshes/prepared-mesh-cache.js";
import { type FrameBoundaryAssemblyReport, type FrameBoundaryReadbackResult, type FrameBoundaryReadbackSampleRequest } from "../render/frame/frame-boundary.js";
import { type RenderBundleExecutionReport } from "../render/draw/render-bundle.js";
import { type IndirectDrawCommandReport } from "../render/draw/indirect-draw-commands.js";
import { type GpuPassTimingReport } from "../gpu/gpu-timing.js";
import { type WebGpuAppRenderPhaseTimingReport, type WebGpuAppRenderPhaseTimingSamples } from "./app-phase-timing.js";
import { type GpuOcclusionFeedbackFallbackReason, type GpuOcclusionQueryDiagnostic } from "../gpu/occlusion-query.js";
import { type WebGpuMsaaConfig } from "../gpu/msaa.js";
import { type CreateDebugNormalAppFrameResourcesResult } from "../materials/debug-normal/debug-normal-app-frame-resources.js";
import { type CreateMatcapAppFrameResourcesResult } from "../materials/matcap/matcap-app-frame-resources.js";
import { type CreateQueuedBuiltInFrameResourcesResult, type QueuedBuiltInFrameResourceRouteDiagnostic } from "../render/queues/queued-built-in-frame-resource-set.js";
import { type WebGpuAppDiagnosticsSummary } from "./app-diagnostics-summary.js";
import { type WebGpuAppSharedSnapshotTransportOptions, type WebGpuAppSnapshotTransportDiagnostics, type WebGpuAppSnapshotTransportMode } from "./app-snapshot-transport.js";
import type { LocalLightClusterReport } from "../lighting/local-light-clusters.js";
import { type LocalLightClusterCookieAtlasUpdateReport } from "../lighting/local-light-cookie-resources.js";
import { type CreateStandardAppFrameResourcesResult } from "../materials/standard/standard-app-frame-resources.js";
import type { StandardFrameIblResources, StandardFrameShadowReceiverResources } from "../materials/standard/standard-frame-resources.js";
import { type TonemapOperator } from "../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../output/output-stage-color-space.js";
import { type CreateMultiMaterialUnlitFrameGpuResourcesResult } from "../materials/unlit/unlit-frame-resources.js";
import { type CreateUnlitAppFrameResourcesResult } from "../materials/unlit/unlit-app-frame-resources.js";
import { type CreateCustomWgslAppFrameResourcesResult } from "../materials/custom-wgsl/custom-wgsl-app-frame-resources.js";
import { type MixedCustomWgslAppFrameResourcesResult } from "./mixed-custom-wgsl-frame.js";
import type { RenderPassCommandPressureReport } from "../render/passes/render-pass-commands.js";
import { type WebGpuIdBufferPickReadbackResult } from "../picking/id-buffer-pick.js";
import { type WebGpuPostEffect } from "../post/post-pass.js";
import { type WebGpuAppComputePassDescriptor, type WebGpuAppRenderPassDescriptor, type WebGpuAppUserPassRegistry } from "./user-pass.js";
import { type InitializeWebGpuOptions, type WebGpuCanvasLike, type WebGpuFailure, type WebGpuInitializationSuccess } from "../gpu/initialize-webgpu.js";
import { type WebGpuAppPipelineResourceResult } from "./pipeline-resources.js";
import { type WebGpuAppMsaaReport } from "./attachments.js";
import type { RenderShadowFrameReport } from "../shadows/render-shadow-frame.js";
import type { ParticleFrameReport } from "./particles.js";
import type { WebGpuFeatureRealizer } from "./feature-command-groups.js";
export type { WebGpuAppMsaaReport };
export interface WebGpuAppFeatureRealizerInput {
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly snapshot: RenderSnapshot;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly reuse: WebGpuAppResourceReuseReport;
}
export type WebGpuAppFeatureRealizer = WebGpuFeatureRealizer<WebGpuAppFeatureRealizerInput>;
export interface WebGpuAppRenderOptions {
    readonly frame?: number;
    readonly snapshot?: RenderSnapshot;
    readonly snapshotChangeSet?: RenderSnapshotChangeSet;
    readonly clearColor?: readonly number[];
    readonly label?: string;
    readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
    /**
     * Collect GPU timestamp timings for this frame. This is intentionally opt-in:
     * reading timestamp buffers requires a queue drain, which serializes normal
     * rendering against the GPU.
     */
    readonly gpuTimings?: boolean;
    readonly autoStandardMaterialShadowReceiverResources?: boolean;
    readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources;
    readonly standardMaterialIblResources?: StandardFrameIblResources;
    readonly phaseTimingSamples?: WebGpuAppRenderPhaseTimingSamples;
}
export { createWebGpuAppRenderTargetAsset, type WebGpuAppRenderTargetAsset, type WebGpuAppRenderTargetAssetInput, } from "./render-target.js";
export { createWebGpuAppDrawResourceSetPlan, type WebGpuAppDrawResourceSet, type WebGpuAppDrawResourceSetPlan, } from "./draw-resource-set.js";
export { webGpuAppPickReportToJsonValue, webGpuAppRenderReportToJson, webGpuAppRenderReportToJsonValue, } from "./report.js";
export { createWebGpuApp } from "./create-webgpu-app.js";
export type { WebGpuAppPipelineResourceResult } from "./pipeline-resources.js";
export interface WebGpuAppRenderCounts {
    readonly views: number;
    readonly meshDraws: number;
    readonly shadowCasterDraws?: number;
    readonly spriteDraws: number;
    readonly particleEmitters: number;
    readonly quadInstances: number;
    readonly quadBatches: number;
    readonly uiNodes: number;
    readonly uiHitRegions: number;
    readonly skyboxes: number;
    readonly proceduralSkies: number;
    readonly runtimeUniforms: number;
    readonly fogs: number;
    readonly drawPackages: number;
    readonly drawCommands: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
}
export interface WebGpuAppDepthAttachmentReport {
    readonly format: string;
    readonly attached: boolean;
    readonly width: number;
    readonly height: number;
    readonly opaquePipelineDepthWriteCount: number;
}
export interface WebGpuAppUserPassReport {
    readonly name: string;
    readonly kind: "render" | "compute";
    readonly ran: boolean;
    readonly executedCommands: number;
}
export interface WebGpuAppPostGraphReport {
    readonly order: readonly string[];
    readonly userPasses: readonly WebGpuAppUserPassReport[];
}
export interface WebGpuAppRenderTargetSubmissionReport {
    readonly viewId: number;
    readonly source: "swapchain" | "offscreen";
    readonly renderTargetKey: string | null;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly ok: boolean;
    readonly drawCalls: number;
    readonly msaaSampleCount?: number;
    readonly graph?: WebGpuAppPostGraphReport;
}
export interface WebGpuAppPostEffectSubmissionReport {
    readonly effectId: string;
    readonly label: string;
    readonly viewId: number;
    readonly input: string;
    readonly output: "swapchain" | "offscreen";
    readonly ok: boolean;
    readonly drawCalls: number;
    readonly graph?: WebGpuAppPostEffectGraphSubmissionReport;
}
export interface WebGpuAppPostEffectGraphSubmissionReport {
    readonly topology: "single-pass" | "downsample-upsample" | "brightpass-downsample-upsample" | "unreal-bloom";
    readonly passCount: number;
    readonly resourceCount: number;
    readonly brightpassPasses?: number;
    readonly downsamplePasses: number;
    readonly upsamplePasses: number;
    readonly horizontalBlurPasses?: number;
    readonly verticalBlurPasses?: number;
    readonly compositePasses: number;
    readonly levels: readonly {
        readonly width: number;
        readonly height: number;
        readonly kernelSize?: number;
    }[];
}
export interface WebGpuAppTransmissionGrabPassReport {
    readonly enabled: boolean;
    readonly ok: boolean;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly commands: number;
    readonly drawCalls: number;
    readonly textureResourceKey: string;
    readonly samplerResourceKey: string;
}
export interface WebGpuAppResourceReuseReport {
    pipelineHits: number;
    pipelineMisses: number;
    meshBuffersCreated: number;
    meshBuffersReused: number;
    preparedMeshBuffersCreated: number;
    preparedMeshBuffersReused: number;
    preparedMeshCache: PreparedMeshGpuResourceCacheSummary;
    preparedMeshCacheEviction: PreparedMeshGpuResourceCacheEvictionReport;
    preparedMeshFacade: PreparedMeshStoreJsonValue;
    materialBuffersCreated: number;
    materialBuffersReused: number;
    preparedMaterialBuffersCreated: number;
    preparedMaterialBuffersReused: number;
    preparedMaterialBindGroupsCreated: number;
    preparedMaterialBindGroupsReused: number;
    preparedMaterialCache: PreparedAppMaterialCacheSummary;
    preparedMaterialCacheEviction: PreparedBuiltInMaterialCacheEvictionReport;
    preparedMaterialFacade: PreparedMaterialStoreJsonValue;
    textureResourcesCreated: number;
    textureResourcesReused: number;
    textureSamplerCache: AppTextureSamplerResourceCacheSummary;
    samplerResourcesCreated: number;
    samplerResourcesReused: number;
    bindGroupsCreated: number;
    bindGroupsReused: number;
    queuedBindGroupsCreated: number;
    queuedBindGroupsReused: number;
    queuedBindGroupCacheSize: number;
    lightBuffersCreated: number;
    lightBuffersReused: number;
    standardFrameResourceCacheHits: number;
    standardFrameResourceCacheMisses: number;
    standardFrameResourceCacheMissReasons: Record<string, number>;
    localLightClusterBuffersCreated: number;
    localLightClusterBuffersReused: number;
    localLightClusterBufferWrites: number;
    localLightClusterBufferWritesSkipped: number;
    autoShadowFramesCreated: number;
    autoShadowFramesReused: number;
    autoShadowFrameCache: WebGpuAppAutoShadowFrameCacheReport;
    dynamicBufferWrites: number;
}
export type WebGpuAppAutoShadowFrameCacheStatus = "not-evaluated" | "disabled" | "hit" | "miss";
export type WebGpuAppAutoShadowFrameCacheMissReason = "disabled-by-option" | "external-shadow-resources" | "no-auto-shadow-work" | "empty-cache" | "gpu-timings" | "no-previous-frame" | "input-key-changed";
export interface WebGpuAppAutoShadowFrameCacheReport {
    readonly status: WebGpuAppAutoShadowFrameCacheStatus;
    readonly reason?: WebGpuAppAutoShadowFrameCacheMissReason;
    readonly pipelineKind?: string | null;
    readonly cachedFrame?: number | null;
    readonly previousFrame?: number | null;
    readonly currentInputKeyHash?: string | null;
    readonly cachedInputKeyHash?: string | null;
    readonly currentInputKeyLength?: number | null;
    readonly cachedInputKeyLength?: number | null;
    readonly firstChangedInputSection?: string | null;
    readonly reuseSource?: "same-frame" | "change-set" | "input-key";
}
export type WebGpuAppFrameResourceRouteDiagnostic = QueuedBuiltInFrameResourceRouteDiagnostic;
export interface WebGpuAppMaterialDependencyDiagnostic {
    readonly code: "webGpuApp.materialDependenciesNotReady";
    readonly message: string;
    readonly materialDependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
}
export interface WebGpuAppSimulationWorkerSnapshotEvent {
    readonly snapshot: RenderSnapshot;
    readonly frame: number;
    readonly message?: unknown;
}
export interface WebGpuAppSimulationWorkerErrorEvent {
    readonly reason: string;
    readonly message: string;
    readonly source?: string;
    readonly raw?: unknown;
}
import {
  type SimulationWorker,
  type SimulationWorkerErrorEvent,
  type SimulationWorkerSnapshotEvent,
} from "@aperture-engine/runtime";
import type { AssetRegistry } from "@aperture-engine/simulation";
import { mirrorSourceAssetRegistryFromMessage } from "../asset-mirror.js";
import { createApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
import type {
  GeneratedBrowserAppStatus,
  GeneratedBrowserWorkerMessageStatus,
  GeneratedBrowserPerformanceStatus,
  GeneratedBrowserPerformanceTimingStats,
} from "./status.js";

export function mirrorSimulationWorkerSourceAssets(
  worker: SimulationWorker,
  sourceAssets: AssetRegistry,
  status: GeneratedBrowserAppStatus,
  options: MirrorSimulationWorkerSourceAssetsOptions = {},
): SimulationWorker {
  const performanceState = createGeneratedBrowserPerformanceState(
    options.performanceStatusIntervalMilliseconds,
  );
  const unsubscribeSidebandAssets = worker.onMessage((message) => {
    mirrorWorkerMessage({
      message,
      sourceAssets,
      status,
      performanceState,
      decisionBucket: "sideband",
    });
  });

  return {
    ...worker,
    onSnapshot(callback) {
      return worker.onSnapshot((event: SimulationWorkerSnapshotEvent) => {
        mirrorWorkerMessage({
          message: event.message,
          sourceAssets,
          status,
          performanceState,
          decisionBucket: "snapshot",
        });
        status.snapshots += 1;
        status.lastFrame = event.frame;
        callback(event);
      });
    },
    onError(callback) {
      return worker.onError((event: SimulationWorkerErrorEvent) => {
        status.status = "worker-error";
        status.lastFailure = createApertureGeneratedDiagnosticsStatus({
          status: "failed",
          diagnostics: event.diagnostics ?? [
            {
              code: event.reason,
              severity: "error",
              message: event.message,
              worker: event.source,
              suggestedFix:
                "Inspect generated worker diagnostics and restart the app after fixing the reported issue.",
            },
          ],
        });
        status.lastError = status.lastFailure;
        callback(event);
      });
    },
    terminate() {
      unsubscribeSidebandAssets();
      worker.terminate();
    },
  };
}

export interface MirrorSimulationWorkerSourceAssetsOptions {
  readonly performanceStatusIntervalMilliseconds?: number;
}

interface GeneratedBrowserPerformanceState {
  readonly sampleWindow: number;
  readonly statusIntervalMilliseconds: number;
  latest: GeneratedBrowserPerformanceStatus["latest"];
  lastPublishedStatusMilliseconds: number | null;
  cachedStatus: GeneratedBrowserPerformanceStatus | null;
  readonly publish: Map<string, TimingSampleState>;
  readonly step: Map<string, TimingSampleState>;
  readonly lowLevel: Map<string, TimingSampleState>;
}

interface TimingSampleState {
  readonly values: number[];
  total: number;
  latest: number | null;
}

const PERFORMANCE_SAMPLE_WINDOW = 240;
export const DEFAULT_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS = 250;
const MIN_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS = 16;

const PUBLISH_TIMING_FIELDS = [
  "totalMilliseconds",
  "inputMilliseconds",
  "stepMilliseconds",
  "extractMilliseconds",
  "sourceAssetsMilliseconds",
  "summaryMilliseconds",
  "transportMilliseconds",
  "postMessageMilliseconds",
  "commitMilliseconds",
] as const;

const STEP_TIMING_FIELDS = [
  "totalMilliseconds",
  "preStepResolveSpatialMilliseconds",
  "inputEffectsMilliseconds",
  "lowLevelStepMilliseconds",
  "updateEffectsMilliseconds",
  "postStepSpatialMilliseconds",
  "interactionMilliseconds",
  "postUpdateEffectsMilliseconds",
] as const;

const LOW_LEVEL_TIMING_FIELDS = [
  "totalMilliseconds",
  "worldUpdateMilliseconds",
  "animationMilliseconds",
  "fixedStepMilliseconds",
  "transformMilliseconds",
  "skeletonMilliseconds",
] as const;

function mirrorWorkerMessage(options: {
  readonly message: unknown;
  readonly sourceAssets: AssetRegistry;
  readonly status: GeneratedBrowserAppStatus;
  readonly performanceState: GeneratedBrowserPerformanceState;
  readonly decisionBucket: "snapshot" | "sideband";
}): void {
  const mirror = mirrorSourceAssetRegistryFromMessage(
    options.sourceAssets,
    options.message,
  );
  options.status.mirroredSourceAssets += mirror.mirrored;
  options.status.skippedSourceAssets += mirror.skipped;

  const workerSummary = readWorkerSummary(options.message);
  if (workerSummary !== null) {
    options.status.lastWorkerSummary = mergeWorkerSummary(
      options.status.lastWorkerSummary,
      workerSummary,
    );
  }
  recordWorkerPostMessageDecision(
    options.status.workerMessages,
    readPostMessageDecision(options.message, workerSummary),
    options.decisionBucket,
  );
  const performanceStatus = updateGeneratedBrowserPerformanceStatus(
    options.performanceState,
    workerSummary,
  );
  if (performanceStatus !== undefined) {
    options.status.performance = performanceStatus;
  }
}

function readWorkerSummary(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? ((message as { readonly workerSummary?: unknown }).workerSummary ?? null)
    : null;
}

function readPostMessageDecision(
  message: unknown,
  workerSummary: unknown,
): unknown {
  const messageDecision = readRecord(message)?.["postMessageDecision"];

  return messageDecision ?? readRecord(workerSummary)?.["postMessageDecision"];
}

// Fields that only appear on full-cadence summaries and should NOT be retained
// from a previous full summary once a lite summary arrives without them.
// `resources` and `physics` are intentionally excluded so they stay readable
// every frame (e.g. for a signals/resources-driven HUD); the `summaryCadence.full`
// flag still tells consumers when those values were last refreshed (see GH #29).
const TRANSIENT_FULL_WORKER_SUMMARY_FIELDS = [
  "startOptions",
  "assets",
  "entities",
] as const;

function createGeneratedBrowserPerformanceState(
  intervalMilliseconds: unknown,
): GeneratedBrowserPerformanceState {
  return {
    sampleWindow: PERFORMANCE_SAMPLE_WINDOW,
    statusIntervalMilliseconds:
      normalizePerformanceStatusInterval(intervalMilliseconds),
    latest: null,
    lastPublishedStatusMilliseconds: null,
    cachedStatus: null,
    publish: new Map(),
    step: new Map(),
    lowLevel: new Map(),
  };
}

function updateGeneratedBrowserPerformanceStatus(
  state: GeneratedBrowserPerformanceState,
  workerSummary: unknown,
): GeneratedBrowserPerformanceStatus | undefined {
  const timing = readRecord(workerSummary)?.["previousPublishTiming"];
  const timingRecord = readRecord(timing);

  if (timingRecord === null) {
    return undefined;
  }

  const stepTiming = readRecord(timingRecord["stepTiming"]);
  const lowLevelTiming = readRecord(stepTiming?.["lowLevel"]);
  const publish = numericFields(timingRecord, PUBLISH_TIMING_FIELDS);
  const step = numericFields(stepTiming, STEP_TIMING_FIELDS);
  const lowLevel = numericFields(lowLevelTiming, LOW_LEVEL_TIMING_FIELDS);
  const frame = readFiniteNumber(timingRecord["frame"]);
  const transport = readTransport(timingRecord["transport"]);
  const preStepWorldChanged =
    stepTiming?.["preStepWorldChanged"] === true ? true : false;

  if (frame !== null && transport !== null) {
    state.latest = {
      frame,
      transport,
      preStepWorldChanged,
      publish,
      step,
      lowLevel,
    };
  }

  recordTimingGroup(state.publish, state.sampleWindow, publish);
  recordTimingGroup(state.step, state.sampleWindow, step);
  recordTimingGroup(state.lowLevel, state.sampleWindow, lowLevel);
  return publishPerformanceStatusIfDue(state);
}

function publishPerformanceStatusIfDue(
  state: GeneratedBrowserPerformanceState,
): GeneratedBrowserPerformanceStatus | undefined {
  if (state.latest === null) {
    return undefined;
  }

  const now = nowMilliseconds();
  if (
    state.cachedStatus !== null &&
    state.lastPublishedStatusMilliseconds !== null &&
    now - state.lastPublishedStatusMilliseconds <
      state.statusIntervalMilliseconds
  ) {
    return undefined;
  }

  state.cachedStatus = performanceStatusFromState(state);
  state.lastPublishedStatusMilliseconds = now;
  return state.cachedStatus;
}

function performanceStatusFromState(
  state: GeneratedBrowserPerformanceState,
): GeneratedBrowserPerformanceStatus {
  if (state.latest === null) {
    return {
      sampleWindow: state.sampleWindow,
      latest: null,
      rolling: {
        publish: {},
        step: {},
        lowLevel: {},
      },
    };
  }

  return {
    sampleWindow: state.sampleWindow,
    latest: state.latest,
    rolling: {
      publish: timingStatsRecord(state.publish),
      step: timingStatsRecord(state.step),
      lowLevel: timingStatsRecord(state.lowLevel),
    },
  };
}

function normalizePerformanceStatusInterval(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS;
  }

  return Math.max(
    MIN_GENERATED_PERFORMANCE_STATUS_INTERVAL_MS,
    Math.floor(value),
  );
}

function numericFields(
  record: Readonly<Record<string, unknown>> | null,
  fields: readonly string[],
): Record<string, number> {
  const output: Record<string, number> = {};

  if (record === null) {
    return output;
  }

  for (const field of fields) {
    const value = readFiniteNumber(record[field]);

    if (value !== null) {
      output[field] = value;
    }
  }

  return output;
}

function recordTimingGroup(
  target: Map<string, TimingSampleState>,
  sampleWindow: number,
  values: Readonly<Record<string, number>>,
): void {
  for (const [key, value] of Object.entries(values)) {
    const state = timingSampleStateFor(target, key);

    state.latest = value;
    state.total += 1;
    state.values.push(value);
    while (state.values.length > sampleWindow) {
      state.values.shift();
    }
  }
}

function timingSampleStateFor(
  target: Map<string, TimingSampleState>,
  key: string,
): TimingSampleState {
  const existing = target.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const next: TimingSampleState = {
    values: [],
    total: 0,
    latest: null,
  };

  target.set(key, next);
  return next;
}

function timingStatsRecord(
  values: ReadonlyMap<string, TimingSampleState>,
): Record<string, GeneratedBrowserPerformanceTimingStats> {
  const output: Record<string, GeneratedBrowserPerformanceTimingStats> = {};

  for (const [key, state] of values) {
    output[key] = timingStats(state);
  }

  return output;
}

function timingStats(
  state: TimingSampleState,
): GeneratedBrowserPerformanceTimingStats {
  if (state.values.length === 0) {
    return {
      count: state.total,
      latest: state.latest,
      average: null,
      min: null,
      p50: null,
      p95: null,
      p99: null,
      max: null,
    };
  }

  const sorted = [...state.values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);

  return {
    count: state.total,
    latest: state.latest,
    average: sum / sorted.length,
    min: sorted[0] ?? null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? null,
  };
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) {
    return null;
  }

  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );

  return sorted[index] ?? null;
}

function mergeWorkerSummary(previous: unknown, next: unknown): unknown {
  if (!isRecord(next)) {
    return next;
  }

  if (!isRecord(previous)) {
    return next;
  }

  const merged: Record<string, unknown> = {
    ...previous,
    ...next,
    ...(next["entityTools"] === undefined &&
    previous["entityTools"] !== undefined
      ? { entityTools: previous["entityTools"] }
      : {}),
  };

  for (const field of TRANSIENT_FULL_WORKER_SUMMARY_FIELDS) {
    if (next[field] === undefined) {
      delete merged[field];
    }
  }

  return merged;
}

function recordWorkerPostMessageDecision(
  status: GeneratedBrowserWorkerMessageStatus,
  decision: unknown,
  bucketName: "snapshot" | "sideband",
): void {
  const decisionRecord = readRecord(decision);
  if (decisionRecord === null) {
    return;
  }

  const bucket =
    bucketName === "snapshot"
      ? status.snapshotDecisions
      : status.sidebandDecisions;
  bucket.total += 1;
  bucket.latest = decision;

  const postedMessage =
    typeof decisionRecord["postedMessage"] === "string"
      ? decisionRecord["postedMessage"]
      : "unknown";
  bucket.postedMessages[postedMessage] =
    (bucket.postedMessages[postedMessage] ?? 0) + 1;

  const reasons = Array.isArray(decisionRecord["postMessageReasons"])
    ? decisionRecord["postMessageReasons"]
    : [];
  if (reasons.length === 0) {
    bucket.postMessageReasons.none = (bucket.postMessageReasons.none ?? 0) + 1;
    return;
  }

  for (const reason of reasons) {
    const key = typeof reason === "string" ? reason : "unknown";
    bucket.postMessageReasons[key] = (bucket.postMessageReasons[key] ?? 0) + 1;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readTransport(
  value: unknown,
): "shared-array-buffer" | "transferable" | null {
  return value === "shared-array-buffer" || value === "transferable"
    ? value
    : null;
}

function nowMilliseconds(): number {
  return typeof performance === "undefined" ||
    typeof performance.now !== "function"
    ? Date.now()
    : performance.now();
}
import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationWorkerFixedStepOptions,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { Ktx2TextureCompressionSupport } from "@aperture-engine/render";
import { createApertureApp, type ApertureApp } from "../advanced.js";
import { resolveConfigPhysicsOption } from "../config-physics.js";
import { createDefaultSystemGltfAssetDecoderProvider } from "../systems.js";
import { createSourceAssetSerializationState } from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import { errorToApertureDiagnostic } from "../diagnostics.js";
import type {
  ApertureGeneratedInputEvent,
  ApertureGeneratedInputEventMessage,
} from "../input.js";
import type { ApertureSystemModule } from "../advanced.js";
import {
  createGeneratedDevtoolsBridge,
  type GeneratedDevtoolsBridge,
  type GeneratedDevtoolsStepInput,
} from "./devtools/bridge.js";
import type { GeneratedEntityToolBridge } from "../devtools/entities.js";
import {
  createGeneratedWorkerSnapshotTransport,
  createGeneratedWorkerSummaryCadence,
  publishGeneratedWorkerSnapshot,
  type GeneratedWorkerSnapshotPublishTiming,
  type GeneratedWorkerSnapshotPublishReport,
} from "./snapshot.js";

export async function runGeneratedWorkerLoop(options: {
  readonly port: SimulationMessagePort;
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly start: SimulationWorkerStartOptions;
  readonly pendingInput: ApertureGeneratedInputEventMessage[];
  readonly createEntityTools: (
    world: ApertureApp["lowLevel"]["world"],
  ) => GeneratedEntityToolBridge;
  readonly setApp: (
    app: ApertureApp,
    entityTools: GeneratedEntityToolBridge,
    devtools: GeneratedDevtoolsBridge,
  ) => void;
}): Promise<void> {
  try {
    const workerAssetDecoders = readWorkerAssetDecoderOptions(options.start);
    const fixedStep = readWorkerFixedStepOptions(options.start);
    const physicsInterpolation = readWorkerPhysicsInterpolationOption(
      options.start,
    );
    const snapshotTransport = createGeneratedWorkerSnapshotTransport(
      options.start,
    );
    const decoderBaseUrl =
      workerAssetDecoders?.baseUrl ?? options.config.assetDecoders?.baseUrl;
    const physicsOption = resolveConfigPhysicsOption(options.config.physics);
    const app = await createApertureApp({
      config: options.config,
      systems: options.systems,
      gltfAssetDecoders: createDefaultSystemGltfAssetDecoderProvider({
        ...(decoderBaseUrl === undefined ? {} : { baseUrl: decoderBaseUrl }),
        ...(workerAssetDecoders?.ktx2TextureCompression === undefined
          ? {}
          : {
              ktx2TextureCompression:
                workerAssetDecoders.ktx2TextureCompression,
            }),
      }),
      worldOptions:
        options.start.entityCapacity === undefined
          ? undefined
          : { entityCapacity: options.start.entityCapacity },
      ...(fixedStep === undefined ? {} : { fixedStep }),
      ...(physicsInterpolation === undefined ? {} : { physicsInterpolation }),
      ...(physicsOption === undefined ? {} : { physics: physicsOption }),
      startOptions: options.start,
    });
    // Legacy bridge: keep the raw `start` options visible on world globals for
    // older apps. New app systems should use the filtered public
    // `this.startOptions` accessor installed on ApertureSystemContext.
    publishWorkerStartOptions(app.lowLevel.world, options.start);
    const entityTools = options.createEntityTools(app.lowLevel.world);
    const sourceAssetState = createSourceAssetSerializationState();
    const workerFullSummaryIntervalMilliseconds =
      readWorkerFullSummaryIntervalMilliseconds(options.start);
    const workerSummaryCadence = createGeneratedWorkerSummaryCadence(
      workerFullSummaryIntervalMilliseconds === undefined
        ? {}
        : { intervalMilliseconds: workerFullSummaryIntervalMilliseconds },
    );
    let frame = 0;
    let running = true;
    let paused = readWorkerInitialPaused(options.start);
    let tickScheduled = false;
    let previousTime = performance.now();
    const pendingDevtoolsInput: ApertureGeneratedInputEvent[] = [];
    let previousPublishTiming: GeneratedWorkerSnapshotPublishTiming | null =
      null;
    const tickScheduler = createGeneratedWorkerTickScheduler({
      tickRateHz: readWorkerTickRateHz(options.start),
    });

    const publishSnapshot = (
      delta: number,
      time: number,
    ): GeneratedWorkerSnapshotPublishReport => {
      const immediateInputEvents = pendingDevtoolsInput.splice(0);
      const report = publishGeneratedWorkerSnapshot({
        app,
        config: options.config,
        port: options.port,
        transport: snapshotTransport,
        pendingInput: options.pendingInput,
        immediateInputEvents,
        sourceAssetState,
        entityTools,
        summaryCadence: workerSummaryCadence,
        delta,
        time,
        frame,
        previousPublishTiming,
      });
      frame = report.nextFrame;
      previousPublishTiming = report.timing;

      return report;
    };
    const devtools = createGeneratedDevtoolsBridge({
      app,
      entityTools,
      port: options.port,
      enqueueInputEvent(event) {
        pendingDevtoolsInput.push(event);
      },
      setPaused(nextPaused) {
        const wasPaused = paused;
        paused = nextPaused;
        if (wasPaused && !paused) {
          previousTime = performance.now();
          scheduleTick();
        }
      },
      step(input: GeneratedDevtoolsStepInput) {
        paused = true;
        const now = performance.now();
        previousTime = now;
        const report = publishSnapshot(input.delta, input.time ?? now / 1000);

        return {
          paused,
          frame,
          time: {
            delta: app.context.time.delta,
            elapsed: app.context.time.elapsed,
            frame: app.context.time.frame,
          },
          fixedStep: report.step.fixedStep,
          physics: app.context.physics.summary(),
        };
      },
      getSimulationState() {
        return { paused, running, frame };
      },
    });
    options.setApp(app, entityTools, devtools);

    const reportRuntimeFailure = (error: unknown): void => {
      const reason = "aperture.generatedWorker.tickFailed";
      const diagnostic = errorToApertureDiagnostic(error, {
        code: "aperture.generatedWorker.tickFailed",
        severity: "error",
        message:
          "Generated Aperture simulation worker threw during a frame tick.",
        suggestedFix:
          "Inspect the throwing app system or per-frame asset update, then restart the generated app.",
        source: { worker: "generated-simulation" },
      });

      options.port.postMessage({
        type: SIMULATION_WORKER_PROTOCOL.error,
        reason,
        message: diagnostic.message,
        diagnostics: [diagnostic],
      });
    };

    function scheduleTick(): void {
      if (!running || paused || tickScheduled) {
        return;
      }

      tickScheduled = true;
      tickScheduler.schedule(tick);
    }

    function tick(): void {
      tickScheduled = false;
      if (!running) {
        tickScheduler.dispose();
        return;
      }

      try {
        if (paused) {
          return;
        }

        const now = performance.now();
        const delta = Math.max(0, (now - previousTime) / 1000);
        previousTime = now;

        publishSnapshot(delta, now / 1000);
      } catch (error: unknown) {
        // A steady-state tick failure is otherwise uncaught (the reschedule
        // below never runs and the scheduler callback swallows it), leaving the
        // simulation frozen with no signal. Halt the loop and surface the
        // failure to the main thread instead.
```

Stderr:

```text
cat: /sdk/source/runtime/dist/worker/simulation-worker.d.ts: No such file or directory
```

## Command c9a5377f2ad6430487b081a89ba3a0b8

2026-10-11T23:39:56.542258+00:00 → 2026-10-11T23:39:56.662123+00:00; exit 0; duration 0.120s.

Command:

```sh
grep -n "interface WebGpuApp\|render(\|stop(\|assets\|snapshot\|RenderWorld" /sdk/source/webgpu/dist/app/app.d.ts | tail -65; cat /sdk/source/app/src/commands.ts | head -170; sed -n "1,170p" /sdk/source/app/src/browser/devtools/index.ts; find /sdk/source/runtime -name "*simulation-worker*"; grep -n "initialPaused\|publishSnapshot(0\|pause" /sdk/source/app/src/worker/loop.ts
```

Stdout:

```text
2:import type { RenderWorld, MaterialAssetDependencyReadinessReportJsonValue, PreparedMaterialStoreJsonValue, PreparedMeshStoreJsonValue, PackedSnapshotViewUniforms, RenderEntityRef, RenderSnapshot, RenderSnapshotChangeSet, RenderSnapshotUpdateSchedule, LightingHealthReport } from "@aperture-engine/render";
18:import { type WebGpuAppSharedSnapshotTransportOptions, type WebGpuAppSnapshotTransportDiagnostics, type WebGpuAppSnapshotTransportMode } from "./app-snapshot-transport.js";
40:export interface WebGpuAppFeatureRealizerInput {
42:    readonly assets: AssetRegistry;
43:    readonly snapshot: RenderSnapshot;
48:export interface WebGpuAppRenderOptions {
50:    readonly snapshot?: RenderSnapshot;
51:    readonly snapshotChangeSet?: RenderSnapshotChangeSet;
71:export interface WebGpuAppRenderCounts {
90:export interface WebGpuAppDepthAttachmentReport {
97:export interface WebGpuAppUserPassReport {
103:export interface WebGpuAppPostGraphReport {
107:export interface WebGpuAppRenderTargetSubmissionReport {
119:export interface WebGpuAppPostEffectSubmissionReport {
129:export interface WebGpuAppPostEffectGraphSubmissionReport {
145:export interface WebGpuAppTransmissionGrabPassReport {
156:export interface WebGpuAppResourceReuseReport {
201:export interface WebGpuAppAutoShadowFrameCacheReport {
215:export interface WebGpuAppMaterialDependencyDiagnostic {
220:export interface WebGpuAppSimulationWorkerSnapshotEvent {
221:    readonly snapshot: RenderSnapshot;
225:export interface WebGpuAppSimulationWorkerErrorEvent {
233:export interface WebGpuAppSimulationWorker {
239:export type WebGpuAppPresentationCadence = "continuous" | "snapshot";
240:export interface WebGpuAppWorkerRenderErrorDiagnostic {
245:export interface WebGpuAppCadenceCounterReport {
255:export interface WebGpuAppCadenceValueReport {
262:export interface WebGpuAppCadencePacingReport {
263:    readonly snapshotQueueAgeMilliseconds: WebGpuAppCadenceValueReport;
268:export interface WebGpuAppCadenceReport {
270:    readonly snapshotsReceived: WebGpuAppCadenceCounterReport;
285:export interface WebGpuAppDiagnostics {
292:export interface WebGpuAppDiagnosticsOptions {
295:export interface WebGpuAppPickReport {
306:export interface WebGpuAppPickReportJsonValue {
317:export interface WebGpuAppRenderReport {
320:    readonly snapshot: RenderSnapshot;
321:    readonly snapshotChangeSet?: RenderSnapshotChangeSet;
322:    readonly snapshotUpdateSchedule?: RenderSnapshotUpdateSchedule;
354:export interface WebGpuAppMotionVectorObjectTransformHistoryReport {
364:export interface WebGpuAppMotionVectorReport {
371:export interface WebGpuAppOcclusionQueryReport {
391:export interface WebGpuAppRenderReportJsonValue {
421:export interface WebGpuAppLocalLightCookieReport {
430:export interface WebGpuAppRenderBundleReport {
442:export interface WebGpuAppRenderBundleFrameReport {
456:export interface WebGpuApp {
459:    readonly renderWorld: RenderWorld;
469:    stop(): void;
479:    renderSnapshot(snapshot: RenderSnapshot, options?: Omit<WebGpuAppRenderOptions, "snapshot">): Promise<WebGpuAppRenderReport>;
485:     * Register a renderer-side feature realizer that converts extracted snapshot
503:     * "continuous" keeps a presentation callback alive even when no new snapshot
504:     * is pending. "snapshot" schedules presentation only when a worker snapshot
521:     * Called with the exact worker snapshot selected for a presentation tick.
523:     * SAB/transferable snapshot without requiring their own per-frame worker
526:    readonly onPresentationSnapshot?: (snapshot: RenderSnapshot) => void;
export const APERTURE_GENERATED_COMMAND_MESSAGE = "aperture.generated.command";
export const APERTURE_GENERATED_COMMAND_EVENT = "aperture:command";
export const APERTURE_ENTITY_FIND_COMMAND_CHANNEL =
  "aperture.devtools.entity.find";
export const APERTURE_ENTITY_GET_COMMAND_CHANNEL =
  "aperture.devtools.entity.get";
export const APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL =
  "aperture.devtools.entity.setComponent";
export const APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL =
  "aperture.devtools.entity.snapshot";
export const APERTURE_ENTITY_DIFF_COMMAND_CHANNEL =
  "aperture.devtools.entity.diff";
export const APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL =
  "aperture.devtools.entity.hierarchy";
export const APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL =
  "aperture.viewport.resize";
export const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
export const APERTURE_DEVTOOLS_REQUEST_MESSAGE = "aperture.devtools.request";
export const APERTURE_DEVTOOLS_RESPONSE_MESSAGE = "aperture.devtools.response";

export interface ApertureGeneratedCommand {
  readonly channel: string;
  readonly payload?: unknown;
}

export interface ApertureViewportResizeCommandPayload {
  readonly width: number;
  readonly height: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly pixelRatio: number;
  readonly aspect: number;
  readonly devicePixelRatio?: number;
  readonly maxPixelRatio?: number;
  readonly pixelRatioSource?: string;
  readonly resizeSource?: string;
  readonly measurementSource?: string;
}

export interface ApertureGeneratedCommandMessage {
  readonly type: typeof APERTURE_GENERATED_COMMAND_MESSAGE;
  readonly command: ApertureGeneratedCommand;
}

export interface ApertureDevtoolsRequest {
  readonly type: typeof APERTURE_DEVTOOLS_REQUEST_MESSAGE;
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tool: string;
  readonly payload?: unknown;
}

export interface ApertureDevtoolsResponse {
  readonly type: typeof APERTURE_DEVTOOLS_RESPONSE_MESSAGE;
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}

export function createGeneratedCommandMessage(
  command: ApertureGeneratedCommand,
): ApertureGeneratedCommandMessage {
  return {
    type: APERTURE_GENERATED_COMMAND_MESSAGE,
    command,
  };
}

export function isGeneratedCommandMessage(
  value: unknown,
): value is ApertureGeneratedCommandMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      APERTURE_GENERATED_COMMAND_MESSAGE &&
    isGeneratedCommand((value as { readonly command?: unknown }).command)
  );
}

export function createApertureDevtoolsRequest(input: {
  readonly requestId: string;
  readonly tool: string;
  readonly payload?: unknown;
}): ApertureDevtoolsRequest {
  return {
    type: APERTURE_DEVTOOLS_REQUEST_MESSAGE,
    version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    requestId: input.requestId,
    tool: input.tool,
    ...(Object.prototype.hasOwnProperty.call(input, "payload")
      ? { payload: input.payload }
      : {}),
  };
}

export function createApertureDevtoolsResponse(input: {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}): ApertureDevtoolsResponse {
  return {
    type: APERTURE_DEVTOOLS_RESPONSE_MESSAGE,
    version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    requestId: input.requestId,
    ok: input.ok,
    ...(Object.prototype.hasOwnProperty.call(input, "result")
      ? { result: input.result }
      : {}),
    ...(input.diagnostics === undefined
      ? {}
      : { diagnostics: input.diagnostics }),
  };
}

export function isApertureDevtoolsRequest(
  value: unknown,
): value is ApertureDevtoolsRequest {
  return (
    isRecord(value) &&
    value["type"] === APERTURE_DEVTOOLS_REQUEST_MESSAGE &&
    value["version"] === APERTURE_DEVTOOLS_PROTOCOL_VERSION &&
    typeof value["requestId"] === "string" &&
    value["requestId"].length > 0 &&
    typeof value["tool"] === "string" &&
    value["tool"].length > 0
  );
}

export function isApertureDevtoolsResponse(
  value: unknown,
): value is ApertureDevtoolsResponse {
  return (
    isRecord(value) &&
    value["type"] === APERTURE_DEVTOOLS_RESPONSE_MESSAGE &&
    value["version"] === APERTURE_DEVTOOLS_PROTOCOL_VERSION &&
    typeof value["requestId"] === "string" &&
    value["requestId"].length > 0 &&
    typeof value["ok"] === "boolean"
  );
}

export function parseGeneratedCommand(
  value: unknown,
): ApertureGeneratedCommand | null {
  if (!isRecord(value)) {
    return null;
  }

  const channel = value["channel"];

  if (typeof channel !== "string" || channel.length === 0) {
    return null;
  }

  return {
    channel,
    ...(Object.prototype.hasOwnProperty.call(value, "payload")
      ? { payload: value["payload"] }
      : {}),
  };
}

function isGeneratedCommand(value: unknown): value is ApertureGeneratedCommand {
  return parseGeneratedCommand(value) !== null;
}

export {
  APERTURE_MCP_MANAGED_GLOBAL,
  APERTURE_MCP_RUNTIME_GLOBAL,
  installGeneratedDevtoolsRuntime,
} from "./runtime.js";
export type { ApertureMcpRuntime } from "./runtime.js";
/sdk/source/runtime/src/simulation-worker.ts
/sdk/source/runtime/dist/simulation-worker.d.ts
/sdk/source/runtime/dist/simulation-worker.d.ts.map
/sdk/source/runtime/dist/simulation-worker.js
/sdk/source/runtime/dist/simulation-worker.js.map
96:    let paused = readWorkerInitialPaused(options.start);
139:        const wasPaused = paused;
140:        paused = nextPaused;
141:        if (wasPaused && !paused) {
147:        paused = true;
153:          paused,
165:        return { paused, running, frame };
191:      if (!running || paused || tickScheduled) {
207:        if (paused) {
231:    if (!paused) {
```

Stderr:

```text

```

## Command e970a2f32f264af6bba4304b0a4180b2

2026-10-11T23:40:01.318713+00:00 → 2026-10-11T23:40:01.436798+00:00; exit 0; duration 0.118s.

Command:

```sh
sed -n "450,570p" /sdk/source/webgpu/dist/app/app.d.ts; cat /sdk/source/runtime/dist/simulation-worker.d.ts | head -160; cat /sdk/source/app/src/worker/devtools/bridge.ts | head -200; cat /sdk/source/app/src/browser/devtools/runtime.ts | head -160; sed -n "230,240p" /sdk/source/app/src/worker/loop.ts; grep -n "readWorkerInitialPaused" /sdk/source/app/src/worker/loop.ts
```

Stdout:

```text
    readonly executedBundles: number;
    readonly drawCalls: number;
    readonly cacheSize: number;
    readonly diagnostics: readonly WebGpuAppJsonValue[];
}
export type WebGpuAppFrameResourcesResult = CreateUnlitAppFrameResourcesResult | CreateMultiMaterialUnlitFrameGpuResourcesResult | CreateMatcapAppFrameResourcesResult | CreateStandardAppFrameResourcesResult | CreateDebugNormalAppFrameResourcesResult | CreateQueuedBuiltInFrameResourcesResult | CreateCustomWgslAppFrameResourcesResult | MixedCustomWgslAppFrameResourcesResult;
export interface WebGpuApp {
    readonly canvas: WebGpuCanvasLike;
    readonly initialization: WebGpuInitializationSuccess;
    readonly renderWorld: RenderWorld;
    readonly tonemap: TonemapOperator;
    readonly outputColorSpace: OutputColorSpace;
    readonly exposure: number;
    readonly sceneRenderFormat: string;
    readonly msaa: WebGpuMsaaConfig;
    readonly postEffects: readonly WebGpuPostEffect[];
    readonly useFrameGraph: boolean;
    readonly userPassRegistry: WebGpuAppUserPassRegistry;
    start(options?: WebGpuAppStartOptions): void;
    stop(): void;
    /**
     * Stops the app and disposes every registered feature realizer (built-in
     * and user-registered) in reverse registration order. Realizers that
     * allocate GPU resources release them here without callers having to track
     * individual unregister handles.
     */
    dispose(): Promise<void>;
    getDiagnostics(options?: WebGpuAppDiagnosticsOptions): WebGpuAppDiagnostics;
    pick(x: number, y: number): Promise<RenderEntityRef | null>;
    renderSnapshot(snapshot: RenderSnapshot, options?: Omit<WebGpuAppRenderOptions, "snapshot">): Promise<WebGpuAppRenderReport>;
    addRenderPass(descriptor: WebGpuAppRenderPassDescriptor): void;
    addComputePass(descriptor: WebGpuAppComputePassDescriptor): void;
    /** Remove a user pass by name; returns true if one was registered. */
    removePass(name: string): boolean;
    /**
     * Register a renderer-side feature realizer that converts extracted snapshot
     * packets into ordered WebGPU render commands. The built-in ids
     * ('particles', 'ui') are registered at app creation, so re-registering one
     * throws synchronously here rather than failing later inside a frame.
     */
    registerFeatureRealizer(realizer: WebGpuAppFeatureRealizer): () => Promise<void>;
    /** Enable or disable a configured post effect by id; returns true if found. */
    setPostEffectEnabled(id: string, enabled: boolean): boolean;
}
export interface CreateWebGpuAppOptions extends Omit<InitializeWebGpuOptions, "canvas"> {
    readonly canvas: WebGpuCanvasLike;
    readonly simulationWorker: WebGpuAppSimulationWorker;
    readonly sourceAssets?: AssetRegistry;
    readonly autoStart?: boolean;
    readonly workerStartOptions?: WebGpuAppStartOptions;
    readonly transport?: WebGpuAppSnapshotTransportMode;
    readonly sharedSnapshotTransport?: WebGpuAppSharedSnapshotTransportOptions;
    /**
     * "continuous" keeps a presentation callback alive even when no new snapshot
     * is pending. "snapshot" schedules presentation only when a worker snapshot
     * arrives, which is useful for demand-driven generated apps.
     */
    readonly presentationCadence?: WebGpuAppPresentationCadence;
    readonly msaa?: number;
    readonly msaaSampleCount?: number;
    readonly tonemap?: TonemapOperator;
    readonly outputColorSpace?: OutputColorSpace;
    readonly exposure?: number;
    readonly postEffects?: readonly WebGpuPostEffect[];
    /**
     * Collect per-frame GPU timestamp timings by default. Leave this disabled for
     * normal apps; enable it only for diagnostics/profiling captures.
     */
    readonly gpuTimings?: boolean;
    readonly useFrameGraph?: boolean;
    /**
     * Called with the exact worker snapshot selected for a presentation tick.
     * Sibling main-thread systems such as audio can consume the same RAF-polled
     * SAB/transferable snapshot without requiring their own per-frame worker
     * message.
     */
    readonly onPresentationSnapshot?: (snapshot: RenderSnapshot) => void;
}
export interface CreateWebGpuAppSuccess {
    readonly ok: true;
    readonly app: WebGpuApp;
    readonly initialization: WebGpuInitializationSuccess;
}
export type CreateWebGpuAppResult = CreateWebGpuAppSuccess | WebGpuFailure;
//# sourceMappingURL=app.d.ts.mapimport type { RenderSnapshot } from "@aperture-engine/render";
import type { FixedStepClockOptions } from "@aperture-engine/physics";
export declare const SIMULATION_WORKER_PROTOCOL: {
    readonly connect: "aperture.simulation.connect";
    readonly start: "aperture.simulation.start";
    readonly ready: "aperture.simulation.ready";
    readonly snapshot: "aperture.simulation.snapshot";
    readonly audioSnapshot: "aperture.simulation.audioSnapshot";
    readonly sourceAssets: "aperture.simulation.sourceAssets";
    readonly error: "aperture.simulation.error";
};
export interface SimulationWorkerStartOptions {
    readonly entityCapacity?: number;
    readonly fixedStep?: false | SimulationWorkerFixedStepOptions;
    readonly physicsInterpolation?: boolean | SimulationWorkerPhysicsInterpolationOptions;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerFixedStepOptions extends FixedStepClockOptions {
    readonly enabled?: boolean;
}
export interface SimulationWorkerPhysicsInterpolationOptions {
    readonly enabled?: boolean;
}
export interface SimulationWorkerReadyMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.ready;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerSnapshotMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
    readonly snapshot: RenderSnapshot;
    readonly frame?: number;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerAudioSnapshotMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.audioSnapshot;
    readonly snapshot: RenderSnapshot;
    readonly frame?: number;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerSourceAssetsMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.sourceAssets;
    readonly frame?: number;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerErrorMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.error;
    readonly reason: string;
    readonly message: string;
    readonly [key: string]: unknown;
}
export interface SimulationWorkerSnapshotEvent {
    readonly snapshot: RenderSnapshot;
    readonly frame: number;
    readonly message: SimulationWorkerSnapshotMessage;
}
export interface SimulationWorkerErrorEvent {
    readonly reason: string;
    readonly message: string;
    readonly source: "worker" | "protocol";
    readonly diagnostics?: readonly unknown[];
    readonly raw?: unknown;
}
export type SimulationWorkerSnapshotCallback = (event: SimulationWorkerSnapshotEvent) => void;
export type SimulationWorkerErrorCallback = (event: SimulationWorkerErrorEvent) => void;
export type SimulationWorkerMessageCallback = (message: unknown) => void;
export interface SimulationWorker {
    readonly worker: SimulationWorkerTransport;
    start(options?: SimulationWorkerStartOptions): void;
    postMessage(message: unknown, transfer?: Transferable[]): void;
    onMessage(callback: SimulationWorkerMessageCallback): () => void;
    onSnapshot(callback: SimulationWorkerSnapshotCallback): () => void;
    onError(callback: SimulationWorkerErrorCallback): () => void;
    terminate(): void;
}
export interface SimulationWorkerTransport {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    terminate(): void;
    addEventListener?(type: "error", listener: (event: ErrorEvent) => void): void;
    removeEventListener?(type: "error", listener: (event: ErrorEvent) => void): void;
}
export interface SimulationMessagePort {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
    removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
    start?(): void;
    close?(): void;
}
export interface SimulationMessageChannel {
    readonly port1: SimulationMessagePort;
    readonly port2: SimulationMessagePort;
}
export type SimulationWorkerEntry = string | URL | SimulationWorkerTransport;
export type SimulationWorkerFactory = (entry: string | URL, options?: WorkerOptions) => SimulationWorkerTransport;
export interface CreateSimulationWorkerOptions extends SimulationWorkerStartOptions {
    readonly workerOptions?: WorkerOptions;
    readonly workerFactory?: SimulationWorkerFactory;
    readonly messageChannelFactory?: () => SimulationMessageChannel;
}
export interface SimulationWorkerConnectMessage {
    readonly type: typeof SIMULATION_WORKER_PROTOCOL.connect;
    readonly port: SimulationMessagePort;
}
export declare function createSimulationWorker(workerEntry: SimulationWorkerEntry, options?: CreateSimulationWorkerOptions): SimulationWorker;
export declare function renderSnapshotTransferList(snapshot: Pick<RenderSnapshot, "transforms" | "viewMatrices" | "bones" | "morphTargetWeights" | "morphTargetDeltas" | "morphInstanceDescriptors" | "instanceTints" | "instanceAttributes" | "quads">): Transferable[];
//# sourceMappingURL=simulation-worker.d.ts.mapimport type {
  PhysicsCharacterControllerSettings,
  PhysicsCharacterMove,
  PhysicsDebugOptions,
  PhysicsEvent,
  PhysicsQueryOptions,
  PhysicsRay,
  PhysicsShape,
  PhysicsShapeCast,
  PhysicsTransform,
  PhysicsJointDescriptor,
} from "@aperture-engine/physics";
import {
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsDebug,
  PhysicsJoint,
  collectUnsupportedPhysicsJointFeatures,
  createUnsupportedJointImpulseReadbackFeature,
  validatePhysicsCharacterMove,
} from "@aperture-engine/physics";
import type { SimulationMessagePort } from "@aperture-engine/runtime";
import {
  LocalTransform,
  serializeEntityRef,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import type { ApertureApp } from "../../advanced.js";
import {
  createApertureDevtoolsResponse,
  type ApertureDevtoolsRequest,
} from "../../commands.js";
import type { ApertureGeneratedInputEvent } from "../../input.js";
import { createAssetSummary, inspectGltfAsset } from "../../devtools/assets.js";
import { resolveActiveEntity } from "../../entities/lookup/resolve.js";
import { entityRefKey, entitySummary } from "../../entities/lookup/summary.js";
import type { AperturePhysicsJointSummary } from "../../entities/lookup/types.js";
import {
  booleanFromValue,
  isRecord,
  numberFromValue,
  stringFromValue,
  tuple3FromValue,
  tuple4FromValue,
} from "../../devtools/payload.js";
import { callCameraTool, type CameraToolState } from "../../devtools/camera.js";
import {
  entityRefFromValue,
  type GeneratedEntityToolBridge,
} from "../../devtools/entities.js";
import { callInputDevtoolsTool } from "../../devtools/input.js";
import { ApertureSystemError } from "../../systems/errors.js";
import { observedViewportAspect } from "../viewport.js";
import type { GeneratedDevtoolsToolResult } from "../../devtools/types.js";

type MutablePhysicsCharacterControllerSettings = {
  -readonly [Key in keyof PhysicsCharacterControllerSettings]?: PhysicsCharacterControllerSettings[Key];
};

type MutablePhysicsDebugOptions = {
  -readonly [Key in keyof PhysicsDebugOptions]?: PhysicsDebugOptions[Key];
};

export interface GeneratedDevtoolsBridge {
  handle(request: ApertureDevtoolsRequest): void;
}

export interface GeneratedDevtoolsStepInput {
  readonly delta: number;
  readonly time?: number;
}

export function createGeneratedDevtoolsBridge(options: {
  readonly app: ApertureApp;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly port: SimulationMessagePort;
  readonly enqueueInputEvent: (event: ApertureGeneratedInputEvent) => void;
  readonly setPaused: (paused: boolean) => void;
  readonly step: (
    input: GeneratedDevtoolsStepInput,
  ) => Readonly<Record<string, unknown>>;
  readonly getSimulationState: () => Readonly<Record<string, unknown>>;
}): GeneratedDevtoolsBridge {
  const savedCameraStates = new Map<string, CameraToolState>();

  return {
    handle(request) {
      try {
        const result = callGeneratedDevtoolsTool(
          options,
          request,
          savedCameraStates,
        );

        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: result.ok,
            ...(Object.prototype.hasOwnProperty.call(result, "result")
              ? { result: result.result }
              : {}),
            ...(result.diagnostics === undefined
              ? {}
              : { diagnostics: result.diagnostics }),
          }),
        );
      } catch (error: unknown) {
        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: false,
            diagnostics: [devtoolsErrorDiagnostic(error)],
          }),
        );
      }
    },
  };
}

function callGeneratedDevtoolsTool(
  bridge: {
    readonly app: ApertureApp;
    readonly entityTools: GeneratedEntityToolBridge;
    readonly enqueueInputEvent: (event: ApertureGeneratedInputEvent) => void;
    readonly setPaused: (paused: boolean) => void;
    readonly step: (
      input: GeneratedDevtoolsStepInput,
    ) => Readonly<Record<string, unknown>>;
    readonly getSimulationState: () => Readonly<Record<string, unknown>>;
  },
  request: ApertureDevtoolsRequest,
  savedCameraStates: Map<string, CameraToolState>,
): GeneratedDevtoolsToolResult {
  if (request.tool === "ecs_pause") {
    bridge.setPaused(true);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_resume") {
    bridge.setPaused(false);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_step") {
    return {
      ok: true,
      result: bridge.step(devtoolsStepInput(request.payload)),
    };
  }

  if (request.tool === "ecs_step_and_diff") {
    return callStepAndDiffTool(bridge, request.payload);
  }

  if (request.tool === "ecs_list_systems") {
    return callListSystemsTool(bridge.app);
  }

  if (request.tool.startsWith("input_")) {
    const result = callInputDevtoolsTool(
      bridge.app,
      request.tool,
      request.payload,
      { enqueueInputEvent: bridge.enqueueInputEvent },
    );

    if (result !== null) {
      return result;
    }
  }

  if (request.tool === "asset_list") {
    return {
      ok: true,
      result: {
        assets: createAssetSummary(bridge.app.context.assets.list()),
      },
    };
  }

  if (request.tool === "asset_inspect") {
    const payload = isRecord(request.payload) ? request.payload : {};
    const id = stringFromValue(payload["id"]);
    const handle = bridge.app.context.assets
      .list()
      .find((candidate) => candidate.id === id);

    if (id === undefined || handle === undefined || handle.kind !== "gltf") {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.assetInspect.gltfAssetNotFound",
            message:
              "asset_inspect requires the id of a configured glTF asset.",
          },
        ],
      };
    }
import type { SimulationWorker } from "@aperture-engine/runtime";
import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import {
  APERTURE_DEVTOOLS_PROTOCOL_VERSION,
  createApertureDevtoolsRequest,
  createApertureDevtoolsResponse,
  isApertureDevtoolsResponse,
  type ApertureDevtoolsResponse,
} from "../../commands.js";
import { callGeneratedBrowserDevtoolsTool } from "./dispatch.js";

export const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";

export interface ApertureMcpRuntime {
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  callTool(tool: string, payload?: unknown): Promise<ApertureDevtoolsResponse>;
}

export function installGeneratedDevtoolsRuntime(input: {
  readonly worker: SimulationWorker;
  readonly getWebGpuResult: () => CreateWebGpuAppResult | null;
}): void {
  const scope = globalThis as Record<string, unknown>;

  if (scope[APERTURE_MCP_MANAGED_GLOBAL] !== true) {
    return;
  }

  let nextRequestId = 0;
  const pending = new Map<
    string,
    {
      readonly resolve: (response: ApertureDevtoolsResponse) => void;
      readonly reject: (error: Error) => void;
      readonly timeout: ReturnType<typeof setTimeout>;
    }
  >();

  input.worker.onMessage((message) => {
    if (!isApertureDevtoolsResponse(message)) {
      return;
    }

    const request = pending.get(message.requestId);
    if (request === undefined) {
      return;
    }

    clearTimeout(request.timeout);
    pending.delete(message.requestId);
    request.resolve(message);
  });

  const runtime: ApertureMcpRuntime = {
    version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    async callTool(tool, payload) {
      nextRequestId += 1;
      const requestId = `browser-${Date.now()}-${nextRequestId}`;
      const browserResult = await callGeneratedBrowserDevtoolsTool({
        tool,
        payload,
        getWebGpuResult: input.getWebGpuResult,
      });

      if (browserResult !== null) {
        return createApertureDevtoolsResponse({
          requestId,
          ok: browserResult.ok,
          ...(Object.prototype.hasOwnProperty.call(browserResult, "result")
            ? { result: browserResult.result }
            : {}),
          ...(browserResult.diagnostics === undefined
            ? {}
            : { diagnostics: browserResult.diagnostics }),
        });
      }

      return new Promise<ApertureDevtoolsResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Aperture devtools request '${tool}' timed out.`));
        }, 10_000);

        pending.set(requestId, {
          resolve,
          reject,
          timeout,
        });
        input.worker.postMessage(
          createApertureDevtoolsRequest({
            requestId,
            tool,
            payload,
          }),
        );
      });
    },
  };

  scope[APERTURE_MCP_RUNTIME_GLOBAL] = runtime;
}
    options.port.postMessage({ type: SIMULATION_WORKER_PROTOCOL.ready });
    if (!paused) {
      tick();
    }

    if (typeof options.start["stop"] === "boolean" && options.start["stop"]) {
      running = false;
    }
  } catch (error: unknown) {
    const diagnostic = errorToApertureDiagnostic(error, {
      code: "aperture.generatedWorker.failed",
96:    let paused = readWorkerInitialPaused(options.start);
381:function readWorkerInitialPaused(start: SimulationWorkerStartOptions): boolean {
```

Stderr:

```text

```

## Command 9f2dbce18b444c8a87145b6d0a4db13d

2026-10-11T23:40:08.740691+00:00 → 2026-10-11T23:40:08.858485+00:00; exit 0; duration 0.118s.

Command:

```sh
sed -n "376,390p" /sdk/source/app/src/worker/loop.ts; grep -n "stop()\|function stop\|sourceAssets\|renderWorld" /sdk/source/webgpu/src/app/create-webgpu-app.ts | head -70; cat /sdk/source/render/dist/world/render-world.d.ts 2>/dev/null | head -150; grep -n "camera_set\|camera_look\|ecs_set_component" /sdk/source/app/src/devtools/camera.ts /sdk/source/app/src/worker/devtools/bridge.ts | head -40; cat /sdk/source/app/dist/asset-mirror.d.ts | head -70; cat /sdk/source/app/package.json | head -100; grep -n "interface StandardMaterial\|TriangleList\|sphere\|cylinder\|assetsRegistry" /sdk/source/app/src/systems.ts | head -45
```

Stdout:

```text

function readWorkerTickRateHz(start: SimulationWorkerStartOptions): number {
  return normalizeGeneratedWorkerTickRateHz(start["workerTickRateHz"]);
}

function readWorkerInitialPaused(start: SimulationWorkerStartOptions): boolean {
  const value = start["simulationPaused"];

  return value === true || value === "true";
}

function readWorkerFullSummaryIntervalMilliseconds(
  start: SimulationWorkerStartOptions,
): number | undefined {
  const value = start["workerFullSummaryIntervalMilliseconds"];
67:  const sourceAssets = options.sourceAssets ?? new AssetRegistry();
68:  const renderWorld = new RenderWorld();
291:    renderWorld,
381:      app.stop();
384:    stop() {
421:        { app, sourceAssets },
464:        { app, sourceAssets },
482:        (lightingHealthInputFingerprint(renderedReport.snapshot, sourceAssets) ^
494:          assets: sourceAssets,
520:        registry: sourceAssets,
554:    registry: sourceAssets,
947:        sourceAssetsMessageRateHz: 15,
/sdk/source/app/src/devtools/camera.ts:184:  if (request.tool === "camera_set_transform") {
/sdk/source/app/src/devtools/camera.ts:189:  if (request.tool === "camera_look_at") {
import { type AssetDiagnostic, type AssetProvenance, type AssetRegistry, type AssetStatus, type SerializedAssetHandle } from "@aperture-engine/simulation";
interface SerializedSourceAssetEntry {
    readonly handle: SerializedAssetHandle;
    readonly label: string;
    readonly status: AssetStatus;
    readonly version: number;
    readonly asset: unknown;
    readonly dependencies: readonly SerializedAssetHandle[];
    readonly diagnostics: readonly AssetDiagnostic[];
    readonly provenance?: AssetProvenance;
}
export interface SerializedSourceAssetRegistry {
    readonly entries: readonly SerializedSourceAssetEntry[];
}
export interface SourceAssetMirrorReport {
    readonly mirrored: number;
    readonly skipped: number;
}
export interface SourceAssetSerializationState {
    readonly versionsByHandle: Map<string, number>;
    readonly meshLayoutKeysByHandle: Map<string, string>;
}
export declare function createSourceAssetSerializationState(): SourceAssetSerializationState;
export declare function serializeSourceAssetRegistry(registry: AssetRegistry, options?: {
    readonly state?: SourceAssetSerializationState;
}): SerializedSourceAssetRegistry;
/**
 * Record the serialized entry versions as successfully delivered. Callers must
 * invoke this only after the message containing the entries was posted; if
 * posting throws (for example a structured-clone failure on an asset payload),
 * skipping the commit keeps the entries eligible for the next snapshot instead
 * of silently dropping them from the mirror forever.
 */
export declare function commitSerializedSourceAssets(state: SourceAssetSerializationState, serialized: SerializedSourceAssetRegistry): void;
export declare function mirrorSourceAssetRegistryFromMessage(registry: AssetRegistry, message: unknown): SourceAssetMirrorReport;
export {};
//# sourceMappingURL=asset-mirror.d.ts.map{
  "name": "@aperture-engine/app",
  "version": "0.3.0",
  "description": "Aperture metaframework app facade, config helpers, and worker-safe system authoring API.",
  "author": "Felix Zhang",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/felixtrz/aperture.git",
    "directory": "packages/app"
  },
  "homepage": "https://github.com/felixtrz/aperture/tree/main/packages/app#readme",
  "bugs": "https://github.com/felixtrz/aperture/issues",
  "keywords": [
    "aperture",
    "ecs",
    "webgpu",
    "game-engine",
    "typescript",
    "metaframework",
    "headless"
  ],
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./config": {
      "types": "./dist/config.d.ts",
      "import": "./dist/config.js"
    },
    "./systems": {
      "types": "./dist/systems.d.ts",
      "import": "./dist/systems.js"
    },
    "./advanced": {
      "types": "./dist/advanced.d.ts",
      "import": "./dist/advanced.js"
    },
    "./headless": {
      "types": "./dist/headless.d.ts",
      "import": "./dist/headless.js"
    },
    "./headless-tools": {
      "types": "./dist/headless-tools.d.ts",
      "import": "./dist/headless-tools.js"
    },
    "./input": {
      "types": "./dist/input.d.ts",
      "import": "./dist/input.js"
    },
    "./entity-lookup": {
      "types": "./dist/entity-lookup.d.ts",
      "import": "./dist/entity-lookup.js"
    },
    "./commands": {
      "types": "./dist/commands.d.ts",
      "import": "./dist/commands.js"
    },
    "./diagnostics": {
      "types": "./dist/diagnostics.d.ts",
      "import": "./dist/diagnostics.js"
    },
    "./features": {
      "types": "./dist/features.d.ts",
      "import": "./dist/features.js"
    },
    "./asset-mirror": {
      "types": "./dist/asset-mirror.d.ts",
      "import": "./dist/asset-mirror.js"
    },
    "./vite": {
      "types": "./dist/vite.d.ts",
      "import": "./dist/vite.js"
    },
    "./browser": {
      "types": "./dist/browser.d.ts",
      "import": "./dist/browser.js"
    },
    "./worker": {
      "types": "./dist/worker.d.ts",
      "import": "./dist/worker.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
497:  TriangleListMeshDescriptorOptions,
589:  readonly assetsRegistry: AssetRegistry;
747:    get assetsRegistry(): AssetRegistry {
748:      return this.#context.assetsRegistry;
```

Stderr:

```text

```

## Command ea766b5cc7114b6b9dbdd8c68ccf688f

2026-10-11T23:40:16.653224+00:00 → 2026-10-11T23:40:16.773627+00:00; exit 0; duration 0.120s.

Command:

```sh
sed -n "275,310p" /sdk/source/webgpu/src/app/create-webgpu-app.ts; sed -n "375,435p" /sdk/source/webgpu/src/app/create-webgpu-app.ts; find /sdk/source/render/dist -name "*mesh*asset*.d.ts" -o -name "*snapshot*.d.ts" | head -25; grep -n "interface MeshAsset\|interface RenderSnapshot\|interface MeshDraw" /sdk/source/render/src/*.ts /sdk/source/render/src/*/*.ts | head -40; grep -n "cameras\|setTransform\|lookAt" /sdk/source/app/src/systems/cameras.ts | head -65; find /sdk/source/app/src/systems -maxdepth 2 -type f | head -40
```

Stdout:

```text
          scheduleAutoRender();
        }
        return;
      }

      presentationMissedWhileInFlight = false;
      renderPendingSnapshot();
      if (hasNativePresentationFrame && continuousPresentation) {
        scheduleAutoRender();
      }
    });
  };

  const app: WebGpuApp = {
    canvas: options.canvas,
    initialization,
    renderWorld,
    tonemap,
    outputColorSpace,
    exposure,
    sceneRenderFormat,
    msaa,
    postEffects,
    // AI-25: the single-encoder FrameGraph route is the DEFAULT at parity (the
    // forward graph covers no-post / shadow / transmission-grab / user passes,
    // and the post graph falls back to legacy per-route for anything it does
    // not cover). Pass useFrameGraph: false to force the legacy multi-submit
    // route.
    useFrameGraph: options.useFrameGraph ?? true,
    userPassRegistry,
    addRenderPass(descriptor) {
      userPassRegistry.addRenderPass(descriptor);
    },
    addComputePass(descriptor) {
      userPassRegistry.addComputePass(descriptor);
    },
            ? undefined
            : { transport: transportStartPayload },
        ),
      );
    },
    async dispose() {
      app.stop();
      await resourceCache.featureRealizers.dispose();
    },
    stop() {
      if (!running) {
        return;
      }

      running = false;
      pendingSnapshotEvent = null;
      latestSharedSnapshotEvent = null;
      latestRenderedSharedSnapshotFrame = null;
      if (autoRenderRequest !== null) {
        cancelPresentationFrame(autoRenderRequest);
        autoRenderRequest = null;
      }
      autoRenderScheduled = false;
      presentationMissedWhileInFlight = false;
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      unsubscribeError?.();
      unsubscribeError = null;
    },
    getDiagnostics(options: WebGpuAppDiagnosticsOptions = {}) {
      return {
        lastFrame: readLatestRenderReportJson(options.detail ?? "status"),
        lastPick: latestPickReportJson,
        lastError: latestWorkerError,
        transport: snapshotTransport.diagnostics,
        cadence: cadence.report({
          pendingSnapshot: pendingSnapshotEvent !== null,
          pendingSnapshotReceivedAtMilliseconds:
            pendingSnapshotEvent?.receivedAtMilliseconds ?? null,
          scheduled: autoRenderScheduled,
          inFlight: autoRenderInFlight,
        }),
      };
    },
    async pick(x, y) {
      const report = await pickWebGpuAppEntity(
        { app, sourceAssets },
        resourceCache,
        latestReport,
        x,
        y,
        {
          adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
          getPipeline: ({ item, reuse }) =>
            getOrCreateWebGpuAppPipeline({
              app,
              cache: resourceCache,
              reuse,
              kind: item.adapter.kind,
              pipelineKey: item.draw.batchKey.pipelineKey,
              batchKey: item.draw.batchKey,
/sdk/source/render/dist/rendering/snapshot-packed-binary-utils.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-audio-codec.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-encoder.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-view-codec.d.ts
/sdk/source/render/dist/rendering/snapshot-inspection.d.ts
/sdk/source/render/dist/rendering/snapshot-core-types.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-registry.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-batch-flags.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-handle-utils.d.ts
/sdk/source/render/dist/rendering/snapshot-change-set.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-codec-utils.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-fog-codec.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-particle-codec.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-id-codecs.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-bounds-codec.d.ts
/sdk/source/render/dist/rendering/snapshot-change-set-types.d.ts
/sdk/source/render/dist/rendering/snapshot.d.ts
/sdk/source/render/dist/rendering/snapshot-update-scheduler.d.ts
/sdk/source/render/dist/rendering/snapshot-prepared-meshes.d.ts
/sdk/source/render/dist/rendering/snapshot-change-set-compare.d.ts
/sdk/source/render/dist/rendering/snapshot-change-set-packets.d.ts
/sdk/source/render/dist/rendering/snapshot-packet-types.d.ts
/sdk/source/render/dist/rendering/snapshot-types.d.ts
/sdk/source/render/dist/rendering/snapshot-packed-encoding.d.ts
/sdk/source/render/dist/rendering/snapshot-diagnostic-types.d.ts
/sdk/source/render/src/mesh/types.ts:113:export interface MeshAsset {
/sdk/source/render/src/rendering/extraction-mesh-draw-inputs.ts:20:export interface MeshDrawMorphInputs {
/sdk/source/render/src/rendering/extraction-mesh-draw-inputs.ts:27:export interface MeshDrawExtractionInputs {
/sdk/source/render/src/rendering/extraction-meshes.ts:46:export interface MeshDrawExtractionOptions {
/sdk/source/render/src/rendering/snapshot-change-set-types.ts:16:export interface RenderSnapshotFamilyChangeCounts {
/sdk/source/render/src/rendering/snapshot-change-set-types.ts:22:export interface RenderSnapshotFamilyChangeKeys {
/sdk/source/render/src/rendering/snapshot-change-set-types.ts:32:export interface RenderSnapshotChangeSet {
/sdk/source/render/src/rendering/snapshot-clone.ts:8:export interface RenderSnapshotCloneDiagnostic {
/sdk/source/render/src/rendering/snapshot-clone.ts:13:export interface RenderSnapshotCloneabilityResult {
/sdk/source/render/src/rendering/snapshot-clone.ts:18:export interface RenderSnapshotCloneabilityOptions {
/sdk/source/render/src/rendering/snapshot-core-types.ts:30:export interface RenderSnapshot {
/sdk/source/render/src/rendering/snapshot-diagnostic-types.ts:33:export interface RenderSnapshotReport {
/sdk/source/render/src/rendering/snapshot-diagnostics.ts:7:export interface RenderSnapshotDiagnosticSummaryReport {
/sdk/source/render/src/rendering/snapshot-inspection.ts:8:export interface RenderSnapshotInspectionCounts {
/sdk/source/render/src/rendering/snapshot-inspection.ts:23:export interface RenderSnapshotInspectionHandles {
/sdk/source/render/src/rendering/snapshot-inspection.ts:30:export interface RenderSnapshotInspectionReport {
/sdk/source/render/src/rendering/snapshot-inspection.ts:41:export interface RenderSnapshotEntityExplanation {
/sdk/source/render/src/rendering/snapshot-packet-types.ts:55:export interface MeshDrawPacket {
/sdk/source/render/src/rendering/snapshot-update-scheduler.ts:18:export interface RenderSnapshotFamilyUpdateSchedule extends RenderSnapshotFamilyChangeCounts {
/sdk/source/render/src/rendering/snapshot-update-scheduler.ts:31:export interface RenderSnapshotUpdateScheduleTotals {
/sdk/source/render/src/rendering/snapshot-update-scheduler.ts:44:export interface RenderSnapshotUpdateSchedule {
/sdk/source/app/src/systems/prefabs.ts
/sdk/source/app/src/systems/signals.ts
/sdk/source/app/src/systems/determinism.ts
/sdk/source/app/src/systems/trails.ts
/sdk/source/app/src/systems/resources.ts
/sdk/source/app/src/systems/json.ts
/sdk/source/app/src/systems/frame-time.ts
/sdk/source/app/src/systems/physics.ts
/sdk/source/app/src/systems/fixed-step.ts
/sdk/source/app/src/systems/html-bridge.ts
/sdk/source/app/src/systems/effects.ts
/sdk/source/app/src/systems/gltf.ts
/sdk/source/app/src/systems/meshes.ts
/sdk/source/app/src/systems/components.ts
/sdk/source/app/src/systems/errors.ts
/sdk/source/app/src/systems/spatial-index-population.ts
/sdk/source/app/src/systems/commands.ts
/sdk/source/app/src/systems/random.ts
/sdk/source/app/src/systems/assets.ts
/sdk/source/app/src/systems/hierarchy.ts
/sdk/source/app/src/systems/materials.ts
/sdk/source/app/src/systems/cameras.ts
/sdk/source/app/src/systems/particles.ts
/sdk/source/app/src/systems/screen-space-framing.ts
/sdk/source/app/src/systems/audio.ts
/sdk/source/app/src/systems/spawn/lathe.ts
/sdk/source/app/src/systems/spawn/material-presets.ts
/sdk/source/app/src/systems/spawn/physics.ts
/sdk/source/app/src/systems/spawn/types.ts
/sdk/source/app/src/systems/spawn/metadata.ts
/sdk/source/app/src/systems/spawn/heightfield.ts
/sdk/source/app/src/systems/spawn/gltf.ts
/sdk/source/app/src/systems/spawn/triangle-list.ts
/sdk/source/app/src/systems/spawn/transforms.ts
/sdk/source/app/src/systems/spawn/commands.ts
/sdk/source/app/src/systems/spawn/extrude.ts
/sdk/source/app/src/systems/spawn/assets.ts
/sdk/source/app/src/systems/spawn/index.ts
/sdk/source/app/src/systems/spawn/light-rig-presets.ts
/sdk/source/app/src/systems/spawn/descriptors.ts
```

Stderr:

```text

```

## Command 2f2f18bd5bf14b92b5bf2f1cdc7ce49a

2026-10-11T23:40:29.209604+00:00 → 2026-10-11T23:40:29.327618+00:00; exit 0; duration 0.118s.

Command:

```sh
cat /sdk/source/render/src/mesh/types.ts | head -170; cat /sdk/source/simulation/dist/assets/asset-registry.d.ts 2>/dev/null | head -100; cat /sdk/source/app/src/systems/spawn/descriptors.ts | head -150; cat /sdk/source/app/src/systems/spawn/material-presets.ts | head -100; cat /sdk/source/app/src/systems/cameras.ts | head -100; sed -n "1,120p" /sdk/source/render/src/rendering/snapshot-core-types.ts; sed -n "50,125p" /sdk/source/render/src/rendering/snapshot-packet-types.ts
```

Stdout:

```text
import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";

export type MeshTopology =
  | "triangle-list"
  | "triangle-strip"
  | "line-list"
  | "line-strip"
  | "point-list";

export type MeshVertexFormat =
  | "float32x2"
  | "float32x3"
  | "float32x4"
  | "unorm8x4"
  | "unorm16x4"
  | "uint16x4"
  | "uint8x4";

export type MeshVertexSemantic =
  | "POSITION"
  | "NORMAL"
  | "TANGENT"
  | "TEXCOORD_0"
  | "TEXCOORD_1"
  | "COLOR_0"
  | "JOINTS_0"
  | "WEIGHTS_0"
  | "JOINTS_1"
  | "WEIGHTS_1"
  | "MORPH_POSITION_0"
  | "MORPH_NORMAL_0"
  | "MORPH_POSITION_1"
  | "MORPH_NORMAL_1";

export type MeshIndexFormat = "uint16" | "uint32";

export interface MeshVertexAttributeDescriptor {
  readonly semantic: MeshVertexSemantic;
  readonly format: MeshVertexFormat;
  readonly offset: number;
}

export interface MeshBufferUpdateRange {
  readonly byteOffset: number;
  readonly byteLength: number;
}

export interface MeshVertexStreamDescriptor {
  readonly id: string;
  readonly arrayStride: number;
  readonly vertexCount: number;
  readonly attributes: readonly MeshVertexAttributeDescriptor[];
  readonly data: Float32Array | Uint16Array | Uint8Array;
  readonly updateRanges?: readonly MeshBufferUpdateRange[];
}

export interface MeshIndexBufferDescriptor {
  readonly format: MeshIndexFormat;
  readonly data: Uint16Array | Uint32Array;
  readonly indexCount?: number;
  readonly updateRanges?: readonly MeshBufferUpdateRange[];
}

export interface MeshSubmeshDescriptor {
  readonly label: string;
  readonly topology: MeshTopology;
  readonly materialSlot: number;
  readonly vertexStart: number;
  readonly vertexCount: number;
  readonly indexStart: number;
  readonly indexCount: number;
}

export interface MeshMaterialSlot {
  readonly index: number;
  readonly label: string;
}

export interface MeshSkinningSchema {
  readonly joints0?: MeshVertexSemantic;
  readonly weights0?: MeshVertexSemantic;
  readonly joints1?: MeshVertexSemantic;
  readonly weights1?: MeshVertexSemantic;
}

export interface MeshMorphTargetDescriptor {
  readonly label: string;
  readonly positionSemantic?: MeshVertexSemantic;
  readonly normalSemantic?: MeshVertexSemantic;
  readonly tangentSemantic?: MeshVertexSemantic;
}

/**
 * Engine-owned morph-target delta payload for the N-target GPU render path.
 *
 * Unlike {@link MeshMorphTargetDescriptor} (which names per-target vertex-stream
 * semantics and is structurally capped by the number of named slots), this
 * carries every target's deltas in a single target-major typed buffer so an
 * arbitrary target count (e.g. the 52 ARKit blendshapes) renders through a
 * storage buffer indexed by `(target, vertex)` rather than fixed vertex
 * attributes. For target `t`, vertex `v`, the position delta is at
 * `positionDeltas[(t * vertexCount + v) * 3 ..]` (likewise `normalDeltas`,
 * zero-filled where a target lacks NORMAL).
 */
export interface MeshMorphTargetData {
  readonly targetCount: number;
  readonly vertexCount: number;
  readonly hasNormals: boolean;
  readonly positionDeltas: Float32Array;
  readonly normalDeltas: Float32Array;
}

export interface MeshAsset {
  readonly kind: "mesh";
  readonly label: string;
  readonly vertexStreams: readonly MeshVertexStreamDescriptor[];
  readonly indexBuffer?: MeshIndexBufferDescriptor;
  readonly submeshes: readonly MeshSubmeshDescriptor[];
  readonly materialSlots: readonly MeshMaterialSlot[];
  readonly localAabb?: Aabb;
  readonly localSphere?: BoundingSphere;
  readonly skinning?: MeshSkinningSchema;
  readonly morphTargets?: readonly MeshMorphTargetDescriptor[];
  /**
   * All-N morph-target deltas for the storage-buffer GPU render path. When
   * present, the renderer morphs via this payload (indexed by target+vertex),
   * lifting the structural 2-target vertex-attribute cap.
   */
  readonly morphTargetData?: MeshMorphTargetData;
}

export type MeshDiagnosticCode =
  | "mesh.missingPosition"
  | "mesh.missingBounds"
  | "mesh.invalidSubmeshRange"
  | "mesh.unsupportedTopology"
  | "mesh.missingMaterialSlot";

export interface MeshValidationDiagnostic {
  readonly code: MeshDiagnosticCode;
  readonly message: string;
  readonly submesh?: number;
}

export interface MeshValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly MeshValidationDiagnostic[];
}

export interface BoxMeshOptions {
  readonly label?: string;
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
}

export interface PlaneMeshOptions {
  readonly label?: string;
  readonly width?: number;
  readonly height?: number;
  /** Horizontal cells, floored and clamped to 1–128. Defaults to 1. */
  readonly widthSegments?: number;
  /** Vertical cells, floored and clamped to 1–128. Defaults to 1. */
  readonly heightSegments?: number;
}

export type LineListPosition = readonly [number, number, number];

export interface LineListMeshSubmeshOptions {
  readonly label?: string;
import type {
  ColliderInput,
  ExternalForceInput,
  ExternalImpulseInput,
  KinematicTargetInput,
  PhysicsCharacterControllerInput,
  PhysicsDebugInput,
  PhysicsJointInput,
  PhysicsMaterialInput,
  PhysicsVelocityInput,
  RigidBodyInput,
} from "@aperture-engine/physics";
import type { ShaderHandle } from "@aperture-engine/simulation";
import type { StandardMaterialPatch } from "@aperture-engine/render";
import type {
  BoxMeshDescriptorOptions,
  CapsuleMeshDescriptorOptions,
  ConeMeshDescriptorOptions,
  CustomWgslMaterialDescriptor,
  CustomWgslSamplerBindingOptions,
  CustomWgslShaderDescriptor,
  CustomWgslTextureBindingOptions,
  CustomWgslUniformBindingOptions,
  CylinderMeshDescriptorOptions,
  LineListMeshDescriptorOptions,
  MaterialAppearancePresetName,
  PlaneMeshDescriptorOptions,
  PrimitiveMeshDescriptor,
  PhysicsSpawnDescriptor,
  SphereMeshDescriptorOptions,
  StandardMaterialDescriptor,
  StandardMaterialOptions,
  TorusMeshDescriptorOptions,
  TriangleListMeshDescriptorOptions,
  HeightfieldMeshDescriptorOptions,
  LatheMeshDescriptorOptions,
  ExtrudeMeshDescriptorOptions,
  ShaderAssetDescriptorInput,
  UnlitMaterialDescriptor,
  UnlitMaterialOptions,
} from "./types.js";
import { createMaterialAppearancePreset } from "./material-presets.js";

export const mesh = Object.freeze({
  /** Closed indexed XY outline and holes extruded from z=0 along +Z. */
  extrude(options: ExtrudeMeshDescriptorOptions): PrimitiveMeshDescriptor {
    return descriptor("extrude", options);
  },
  /** Full Y-axis revolution of explicit [radius, y] points, with flat normals. */
  lathe(options: LatheMeshDescriptorOptions): PrimitiveMeshDescriptor {
    return descriptor("lathe", options);
  },
  /** Y-up terrain: heights[row][column] advances +Z by row and +X by column. */
  heightfield(
    options: HeightfieldMeshDescriptorOptions,
  ): PrimitiveMeshDescriptor {
    return descriptor("heightfield", options);
  },
  /** Custom triangles with flat face normals unless explicit normals are supplied. */
  triangleList(
    options: TriangleListMeshDescriptorOptions,
  ): PrimitiveMeshDescriptor {
    return descriptor("triangle-list", options);
  },
  box(options: BoxMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("box", options);
  },
  sphere(options: SphereMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("sphere", options);
  },
  capsule(options: CapsuleMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("capsule", options);
  },
  plane(options: PlaneMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("plane", options);
  },
  cylinder(
    options: CylinderMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cylinder", options);
  },
  cone(options: ConeMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("cone", options);
  },
  /** A Y-up ring; reduce radial/tube segments for low-poly procedural parts. */
  torus(options: TorusMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("torus", options);
  },
  /**
   * Native GPU line-list mesh. Positions are consumed in pairs unless indices
   * are provided; indexed line lists consume indices in pairs.
   */
  lineList(options: LineListMeshDescriptorOptions): PrimitiveMeshDescriptor {
    return descriptor("line-list", options);
  },
});

export const material = Object.freeze({
  standard(options: StandardMaterialOptions = {}): StandardMaterialDescriptor {
    return Object.freeze({ kind: "standard", options: { ...options } });
  },
  unlit(options: UnlitMaterialOptions = {}): UnlitMaterialDescriptor {
    return Object.freeze({ kind: "unlit", options: { ...options } });
  },
  preset(
    name: MaterialAppearancePresetName,
    overrides: StandardMaterialPatch = {},
  ) {
    return createMaterialAppearancePreset(name, overrides);
  },
  customWgsl(
    options: Omit<CustomWgslMaterialDescriptor, "kind">,
  ): CustomWgslMaterialDescriptor {
    return Object.freeze({
      kind: "custom-wgsl",
      ...options,
      bindings: [...(options.bindings ?? [])],
      dependencies: [...(options.dependencies ?? [])],
    });
  },
  uniform(name: string, options: CustomWgslUniformBindingOptions) {
    return Object.freeze({
      kind: "uniform-buffer" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      fields: options.fields,
      ...(options.values === undefined ? {} : { values: options.values }),
      ...(options.runtimeUniformKey === undefined
        ? {}
        : { runtimeUniformKey: options.runtimeUniformKey }),
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
  texture(name: string, options: CustomWgslTextureBindingOptions) {
    return Object.freeze({
      kind: "texture" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      texture: options.texture,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
  sampler(name: string, options: CustomWgslSamplerBindingOptions) {
    return Object.freeze({
      kind: "sampler" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
import type { StandardMaterialPatch } from "@aperture-engine/render";
import type {
  MaterialAppearancePresetDescriptor,
  MaterialAppearancePresetName,
  SpawnGltfMaterialOverrides,
} from "./types.js";

export const MATERIAL_APPEARANCE_PRESET_VERSION = 1 as const;

/** Public, inspectable preset values. Presets only change uniform-level fields. */
export const MATERIAL_APPEARANCE_PRESETS: Readonly<
  Record<MaterialAppearancePresetName, Readonly<StandardMaterialPatch>>
> = Object.freeze({
  source: Object.freeze({}),
  "painted-stylized": Object.freeze({
    metallicFactor: 0.12,
    roughnessFactor: 0.72,
  }),
  matte: Object.freeze({
    metallicFactor: 0,
    roughnessFactor: 0.95,
  }),
  "preview-safe": Object.freeze({
    metallicFactor: 0.05,
    roughnessFactor: 0.65,
  }),
});

export function createMaterialAppearancePreset(
  name: MaterialAppearancePresetName,
  overrides: StandardMaterialPatch = {},
): MaterialAppearancePresetDescriptor {
  return Object.freeze({
    kind: "material-preset",
    name,
    version: MATERIAL_APPEARANCE_PRESET_VERSION,
    overrides: Object.freeze({ ...overrides }),
  });
}

export function resolveSpawnGltfMaterialOverrides(
  value: SpawnGltfMaterialOverrides | undefined,
): StandardMaterialPatch | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isMaterialAppearancePreset(value)) {
    return Object.freeze({
      ...MATERIAL_APPEARANCE_PRESETS[value.name],
      ...value.overrides,
    });
  }

  return value;
}

export function isMaterialAppearancePreset(
  value: SpawnGltfMaterialOverrides,
): value is MaterialAppearancePresetDescriptor {
  return (
    "kind" in value &&
    value.kind === "material-preset" &&
    "name" in value &&
    value.name in MATERIAL_APPEARANCE_PRESETS
  );
}
import {
  Camera,
  CameraProjection,
  validateCameraInput,
} from "@aperture-engine/render";
import {
  WorldTransform,
  identityMat4,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
  toVec3Tuple,
  transformPoint,
  type EcsWorld,
  type Entity,
  type Mat4,
  type Vec3Like,
} from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { RayInput } from "../spatial/index.js";
import { AppEntityKey } from "./components.js";
import { ApertureSystemError } from "./errors.js";

export interface CameraHandle {
  readonly entity: Entity;
  readonly ref: EcsEntityRef;
  rayFromPointer(position: readonly [number, number]): RayInput;
}

export interface CameraAccess {
  readonly main: CameraHandle;
  readonly active: readonly CameraHandle[];
  byKey(key: string): CameraHandle | null;
}

export function createCameraAccess(
  world: EcsWorld,
  options: {
    readonly contextKey?: string;
  } = {},
): CameraAccess {
  function handles(): CameraHandle[] {
    if (options.contextKey !== undefined) {
      const systemsContext = world.globals[options.contextKey];
      void systemsContext;
    }

    const entities = collectCameraEntities(world);
    return entities.map(cameraHandle);
  }

  const access: CameraAccess = {
    get main() {
      return access.byKey("camera.main") ?? handles()[0] ?? fallbackCamera();
    },
    get active() {
      return handles();
    },
    byKey(key) {
      for (const entity of collectCameraEntities(world)) {
        if (
          entity.hasComponent(AppEntityKey) &&
          entity.getValue(AppEntityKey, "value") === key
        ) {
          return cameraHandle(entity);
        }
      }

      return null;
    },
  };

  return access;
}

function collectCameraEntities(world: EcsWorld): Entity[] {
  return world
    .getSystems()
    .flatMap(() => [] as Entity[])
    .concat(collectEntitiesByComponents(world));
}

function collectEntitiesByComponents(world: EcsWorld): Entity[] {
  const query = world.queryManager.registerQuery({ required: [Camera] });
  return [...query.entities];
}

function cameraHandle(entity: Entity): CameraHandle {
  return {
    entity,
    ref: entityRef(entity),
    rayFromPointer(position) {
      return rayFromCamera(entity, position);
    },
  };
}

function rayFromCamera(
  entity: Entity,
import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  BoundsPacket,
  EnvironmentPacket,
  FogPacket,
  InstanceAttributePacket,
  LightPacket,
  MeshDrawPacket,
  ParticleEmitterPacket,
  ProceduralSkyPacket,
  QuadBatchPacket,
  RenderQueue,
  RuntimeUniformPacket,
  ShadowRequestPacket,
  SkyboxPacket,
  SpriteDrawPacket,
  UiHitRegionPacket,
  UiNodePacket,
  ViewPacket,
} from "./snapshot-packet-types.js";
import type { QuadSnapshotBuffers } from "./quad-snapshot.js";
import type {
  RenderDiagnostic,
  RenderSnapshotReport,
} from "./snapshot-diagnostic-types.js";

// RenderSnapshot is intentionally made of structured-clone-friendly packet arrays
// and packed numeric buffers so the same shape can cross a future Worker boundary.
export interface RenderSnapshot {
  readonly frame: number;
  /**
   * Simulation/extraction time in seconds. Older hand-built test snapshots may
   * omit this; render paths should fall back conservatively when absent.
   */
  readonly time?: number;
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  /**
   * Shadow-caster mesh packets extracted independently of main camera frustum
   * culling. Main rendering uses `meshDraws`; shadow passes use this family
   * when present so off-camera casters can still contribute to shadow maps.
   */
  readonly shadowCasterDraws?: readonly MeshDrawPacket[];
  readonly spriteDraws?: readonly SpriteDrawPacket[];
  readonly particleEmitters?: readonly ParticleEmitterPacket[];
  readonly audioEmitters?: readonly AudioEmitterPacket[];
  readonly audioListener?: AudioListenerPacket;
  readonly quads?: QuadSnapshotBuffers;
  readonly quadBatches?: readonly QuadBatchPacket[];
  readonly uiNodes?: readonly UiNodePacket[];
  readonly uiHitRegions?: readonly UiHitRegionPacket[];
  readonly skyboxes?: readonly SkyboxPacket[];
  readonly proceduralSkies?: readonly ProceduralSkyPacket[];
  readonly runtimeUniforms?: readonly RuntimeUniformPacket[];
  readonly fogs?: readonly FogPacket[];
  readonly lights: readonly LightPacket[];
  readonly environments: readonly EnvironmentPacket[];
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly bounds: readonly BoundsPacket[];
  readonly transforms: Float32Array;
  readonly bones?: Float32Array;
  readonly morphTargetWeights?: Float32Array;
  /**
   * Flat, target-major morph deltas for the N-target storage-buffer render path.
   * Each morphed draw's slice begins at its `morphDeltaOffset` and holds
   * `targetCount * vertexCount * 3` position floats followed by the same count of
   * normal floats.
   */
  readonly morphTargetDeltas?: Float32Array;
  /**
   * Per-instance morph descriptors, four `u32` per world-transform slot
   * (`weightOffset, targetCount, deltaOffset, vertexCount`) indexed by the
   * shader's `instance_index`. Zeroed for non-morphed instances.
   */
  readonly morphInstanceDescriptors?: Uint32Array;
  readonly instanceTints?: Float32Array;
  readonly instanceAttributes?: Float32Array;
  readonly instanceAttributePackets?: readonly InstanceAttributePacket[];
  readonly viewMatrices: Float32Array;
  readonly diagnostics: readonly RenderDiagnostic[];
  readonly report: RenderSnapshotReport;
}

export interface RenderSortKeyInput {
  readonly queue?: RenderQueue;
  readonly viewId?: number;
  readonly layer?: number;
  readonly order?: number;
  readonly pipelineKey?: string;
  readonly materialKey?: string;
  readonly meshKey?: string;
  readonly depth?: number;
  readonly stableId: number;
}
  readonly clearDepth: number;
  readonly clearStencil: number;
  readonly renderTarget: RenderTargetHandle | null;
}

export interface MeshDrawPacket {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
  readonly mesh: MeshHandle;
  readonly material: MaterialHandle;
  readonly submesh: number;
  readonly materialSlot: number;
  readonly vertexStart?: number;
  readonly vertexCount?: number;
  readonly indexStart?: number;
  readonly indexCount?: number;
  readonly worldTransformOffset: number;
  readonly instanceTintOffset?: number;
  readonly instanceAttributePacketIndex?: number;
  readonly boneMatrixOffset?: number;
  readonly boneMatrixCount?: number;
  /** Float offset into `snapshot.morphTargetDeltas` for this draw's mesh. */
  readonly morphDeltaOffset?: number;
  /** Number of morph targets blended for this draw (N, not capped). */
  readonly morphTargetCount?: number;
  /** Float offset into `snapshot.morphTargetWeights` for this draw's weights. */
  readonly morphWeightOffset?: number;
  /** Vertex count of the morphed mesh (delta indexing stride). */
  readonly morphVertexCount?: number;
  readonly boundsIndex: number;
  readonly layerMask: number;
  readonly castsShadow?: boolean;
  readonly receivesShadow?: boolean;
  readonly occlusionQuery?: boolean;
  readonly sortKey: RenderSortKey;
  readonly batchKey: BatchCompatibilityKey;
}

export interface SpriteDrawPacket {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly depthMode?: QuadDepthMode;
  readonly color: Vec4Like;
  readonly width: number;
  readonly height: number;
  readonly worldTransformOffset: number;
  readonly boundsIndex: number;
  readonly layerMask: number;
  readonly sortKey: RenderSortKey;
}

export interface QuadBatchPacket {
  readonly batchId: number;
  readonly kind: QuadBatchKind;
  readonly texture?: TextureHandle | null;
  readonly sampler?: SamplerHandle | null;
  readonly materialKey: string;
  readonly pipelineVariant: QuadPipelineVariant;
  readonly coordinateMode: QuadCoordinateMode;
  readonly billboardMode: QuadBillboardMode;
  readonly sizeMode: QuadSizeMode;
  readonly blendMode: QuadBlendMode;
  readonly depthMode?: QuadDepthMode;
  readonly firstInstance: number;
  readonly instanceCount: number;
  readonly layerMask: number;
  readonly sortKey: RenderSortKey;
}

export type ParticleSimulationSpacePacket = "world" | "local";
export type ParticleEmitterModePacket = "continuous" | "burst";

export interface ParticleBurstPacket {
  readonly burstId: number;
```

Stderr:

```text

```

## Command 19e0c21b925645e7b65045d093f7cdca

2026-10-11T23:40:45.621757+00:00 → 2026-10-11T23:40:45.740032+00:00; exit 2; duration 0.118s.

Command:

```sh
grep -n "interface StandardMaterialOptions\|interface SpawnCameraOptions\|interface SpawnLightOptions" /sdk/source/app/src/systems/spawn/types.ts; find /sdk/source/simulation/dist -iname "*registry*.d.ts" | head -15; sed -n "1,130p" /sdk/source/render/src/mesh/triangle-list.ts; sed -n "1,100p" /sdk/source/app/src/systems/spawn/materials.ts 2>/dev/null
```

Stdout:

```text
73:export interface SpawnCameraOptions extends SpawnMetadata {
85:export interface SpawnLightOptions extends SpawnMetadata {
288:export interface StandardMaterialOptions {
/sdk/source/simulation/dist/serialization/component-registry.d.ts
/sdk/source/simulation/dist/assets/registry.d.ts
```

Stderr:

```text
sed: can't read /sdk/source/render/src/mesh/triangle-list.ts: No such file or directory
```

## Command e84b225c50a14395b2f918c0c39dd414

2026-10-11T23:40:49.401213+00:00 → 2026-10-11T23:40:49.571733+00:00; exit 0; duration 0.171s.

Command:

```sh
sed -n "65,130p" /sdk/source/app/src/systems/spawn/types.ts; sed -n "285,360p" /sdk/source/app/src/systems/spawn/types.ts; sed -n "1,155p" /sdk/source/simulation/dist/assets/registry.d.ts; find /sdk/source/render/src -iname "*triangle-list*"
```

Stdout:

```text
  readonly translation?: Vec3Like;
  readonly rotation?: Vec4Like;
  readonly scale?: Vec3Like;
  readonly parent?: Entity | null;
  readonly lookAt?: Vec3Like;
  readonly rotationEulerDegrees?: Vec3Like;
}

export interface SpawnCameraOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly fovYDegrees?: number;
  readonly camera?: CameraInput;
}

/** A transform-only ECS parent for a reusable assembly of authored entities. */
export interface SpawnGroupOptions extends SpawnMetadata {
  /** Local transform relative to transform.parent, or world-root transform. */
  readonly transform?: SystemTransformInput;
}

export interface SpawnLightOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly kind?: LightInput["kind"];
  readonly color?: Vec4Like;
  /** @deprecated Use `intensity`; Aperture does not currently convert lux. */
  readonly illuminance?: number;
  readonly intensity?: number;
  readonly light?: LightInput;
  /**
   * Enable shadow casting for this light. `true` uses defaults; an object
   * customizes map size, cascades, PCF radius, bias, etc. Attaches a
   * `LightShadowSettings` component (enabled). Only meshes spawned with
   * `castShadow`/`receiveShadow` participate.
   */
  readonly shadow?: boolean | LightShadowSettingsInput;
}

export type EnvironmentAssetDescriptorInput =
  | EnvironmentMapHandle
  | SystemAssetHandle<"hdr">;

export interface SpawnEnvironmentOptions extends SpawnMetadata {
  readonly source: EnvironmentAssetDescriptorInput;
  readonly intensity?: number;
  readonly color?: Vec4Like;
  readonly layerMask?: number;
  readonly transform?: SystemTransformInput;
}

export type LightRigPresetName = "studio-neutral" | "outdoor-neutral" | "none";

export interface SpawnLightRigOptions extends SpawnMetadata {
  readonly preset: LightRigPresetName;
  readonly environmentMap?: EnvironmentAssetDescriptorInput;
  readonly shadows?: boolean | LightShadowSettingsInput;
  readonly transform?: SystemTransformInput;
  readonly environment?:
    | (Partial<Omit<SpawnEnvironmentOptions, "source">> & {
        readonly source?: EnvironmentAssetDescriptorInput;
      })
    | false;
  readonly keyLight?: Partial<SpawnLightOptions> | false;
  readonly rimLight?: Partial<SpawnLightOptions> | false;
}

export interface SpawnedLightRig {
  | UnlitMaterialDescriptor
  | CustomWgslMaterialDescriptor;

export interface StandardMaterialOptions {
  readonly baseColor?: Vec4Like;
  /** Perceptual roughness (0 mirror → 1 diffuse). Defaults to 1. */
  readonly roughness?: number;
  /**
   * Metalness (0 dielectric → 1 metal). Defaults to 0: hand-authored
   * materials are dielectric unless stated, unlike glTF imports which keep
   * the spec default of 1. A metal with no environment map renders
   * near-black, so only set 1 when the scene has image-based lighting.
   */
  readonly metallic?: number;
  /**
   * Additive linear emissive color. Values may exceed 1 for HDR/bloom probes.
   */
  readonly emissiveFactor?: Vec3Like;
  readonly label?: string;
}

export interface UnlitMaterialOptions {
  readonly baseColor?: Vec4Like;
  readonly label?: string;
  readonly renderState?: Partial<UnlitMaterialAsset["renderState"]>;
}

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: MaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
  readonly physics?: PhysicsSpawnDescriptor;
  /** Attach a `ShadowCaster` component so this mesh casts shadows. */
  readonly castShadow?: boolean;
  /** Attach a `ShadowReceiver` component so this mesh receives shadows. */
  readonly receiveShadow?: boolean;
}

export type ParticleEffectDescriptorInput =
  | ParticleEffectHandle
  | SystemParticleEffectAssetHandle;

export interface SpawnParticlesOptions
  extends SpawnMetadata, Omit<ParticleEmitterInput, "effect"> {
  readonly effect: ParticleEffectDescriptorInput;
  readonly transform?: SystemTransformInput;
}

export type PhysicsComponentDescriptor<TInput> = TInput | true;

export interface PhysicsSpawnDescriptor {
  readonly rigidBody?: PhysicsComponentDescriptor<RigidBodyInput>;
  readonly collider?: PhysicsComponentDescriptor<ColliderInput>;
  readonly velocity?: PhysicsComponentDescriptor<PhysicsVelocityInput>;
  readonly externalForce?: PhysicsComponentDescriptor<ExternalForceInput>;
  readonly externalImpulse?: PhysicsComponentDescriptor<ExternalImpulseInput>;
  readonly kinematicTarget?: PhysicsComponentDescriptor<KinematicTargetInput>;
  readonly gravity?: PhysicsComponentDescriptor<PhysicsGravityInput>;
  readonly characterController?: PhysicsComponentDescriptor<PhysicsCharacterControllerInput>;
  readonly material?: PhysicsComponentDescriptor<PhysicsMaterialInput>;
  readonly joint?: PhysicsComponentDescriptor<PhysicsJointInput>;
  readonly debug?: PhysicsComponentDescriptor<PhysicsDebugInput>;
}

export interface CustomWgslUniformBindingOptions {
  readonly binding: number;
  readonly visibility: CustomWgslMaterialAsset["bindings"][number]["visibility"];
  readonly fields: Extract<
    CustomWgslMaterialAsset["bindings"][number],
    { readonly kind: "uniform-buffer" }
  >["fields"];
  readonly values?: Extract<
    CustomWgslMaterialAsset["bindings"][number],
    { readonly kind: "uniform-buffer" }
  >["values"];
  readonly runtimeUniformKey?: Extract<
import type { AssetDependencyReport, AssetDiagnostic, AssetHandle, AssetKind, AssetListFilter, AssetManifestReport, AssetProvenance, AssetRegistryEntry, AssetStatus, RegisterAssetOptions } from "./types.js";
export declare class AssetRegistry {
    #private;
    register<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>, options?: RegisterAssetOptions): AssetRegistryEntry<TKind, TAsset>;
    unregister<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset> | undefined;
    has(handle: AssetHandle): boolean;
    get<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset> | undefined;
    getStatus(handle: AssetHandle): AssetStatus | undefined;
    markLoading<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset>;
    markReady<TKind extends AssetKind, TAsset>(handle: AssetHandle<TKind>, asset: TAsset, diagnostics?: readonly AssetDiagnostic[], provenance?: AssetProvenance): AssetRegistryEntry<TKind, TAsset>;
    markFailed<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>, diagnostics: readonly AssetDiagnostic[]): AssetRegistryEntry<TKind, TAsset>;
    list(filter?: AssetListFilter): AssetRegistryEntry[];
    collectDiagnostics(handle?: AssetHandle): AssetDiagnostic[];
    inspectDependencies(handle: AssetHandle): AssetDependencyReport;
    createManifestReport(): AssetManifestReport;
    private update;
    private collectDependencyDiagnostics;
}
//# sourceMappingURL=registry.d.ts.map/sdk/source/render/src/mesh/primitives-triangle-list.ts
/sdk/source/render/src/mesh/triangle-list-types.ts
```

Stderr:

```text

```

## Command adb3c5c16db14ae086188cebe02b6cdc

2026-10-11T23:42:53.387167+00:00 → 2026-10-11T23:42:53.505158+00:00; exit 0; duration 0.118s.

Command:

```sh
cat > /work/vite.config.js <<"EOF"
import { defineConfig } from "vite";
export default defineConfig({build:{target:"esnext"},worker:{format:"es"}});
EOF
cat > /work/src/config.js <<"EOF"
import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({mode:"browser",canvas:"#scene",render:{defaultCamera:false,defaultLight:false,defaultEnvironment:true,tonemap:"aces",exposure:1,sampleCount:4,pixelRatio:1,clearColor:[.55,.7,.86,1]},diagnostics:{level:"warn"}});
EOF
cat > /work/src/worker.js <<"EOF"
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import config from "./config.js";
import Scene from "./scene.js";
startGeneratedSimulationWorker({config,systems:[{default:Scene}]});
EOF
cat > /work/index.html <<"EOF"
<!doctype html><html><head><meta charset="UTF-8"><title>Casa di Sole</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#9cb9cf}canvas{width:1024px;height:768px;display:block}</style></head><body><canvas id="scene" width="1024" height="768"></canvas><script type="module" src="/src/main.js"></script></body></html>
EOF
cat > /work/src/main.js <<"EOF"
import {createSimulationWorker} from "@aperture-engine/runtime";
import {AssetRegistry} from "@aperture-engine/simulation";
import {mirrorSourceAssetRegistryFromMessage} from "@aperture-engine/app/asset-mirror";
import {createApertureDevtoolsRequest,createGeneratedCommandMessage} from "@aperture-engine/app/commands";
import {createWebGpuApp} from "@aperture-engine/webgpu";
const canvas=document.querySelector("canvas");
const assets=new AssetRegistry();
const worker=createSimulationWorker(new Worker(new URL("./worker.js",import.meta.url),{type:"module"}));
let gpu,latest,requestNumber=0;
const pending=new Map();
let snapshotWaiters=[];
worker.onMessage(msg=>{
 mirrorSourceAssetRegistryFromMessage(assets,msg);
 if(msg?.type==="aperture.devtools.response") {const p=pending.get(msg.requestId);if(p){pending.delete(msg.requestId);msg.ok?p.resolve(msg.result):p.reject(new Error(JSON.stringify(msg.diagnostics)));}}
});
worker.onSnapshot(event=>{mirrorSourceAssetRegistryFromMessage(assets,event.message);latest=event.snapshot;for(const p of snapshotWaiters.splice(0))p.resolve(latest);});
worker.onError(e=>{console.error(e);for(const p of pending.values())p.reject(new Error(e.message));for(const p of snapshotWaiters.splice(0))p.reject(new Error(e.message));});
function tool(name,payload){return new Promise((resolve,reject)=>{const requestId=`bench-${++requestNumber}`;pending.set(requestId,{resolve,reject});worker.postMessage(createApertureDevtoolsRequest({requestId,tool:name,payload}));});}
async function step(delta=0,time=0){const snap=new Promise((resolve,reject)=>snapshotWaiters.push({resolve,reject}));await tool("ecs_step",{delta,time});return await snap;}
const ready=(async()=>{
 const result=await createWebGpuApp({canvas,simulationWorker:worker,sourceAssets:assets,autoStart:false,msaaSampleCount:4,tonemap:"aces",exposure:1,useFrameGraph:true});
 if(!result.ok)throw new Error(JSON.stringify(result));gpu=result.app;
 const started=new Promise((resolve,reject)=>{const off=worker.onMessage(m=>{if(m?.type==="aperture.simulation.ready"){off();resolve();}});worker.onError(e=>reject(new Error(e.message)));});
 worker.start({simulationPaused:true,entityCapacity:2048,transport:{mode:"transferable"}});
 await started;await step(0,0);
})();
const I=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
globalThis.__AGENT_BENCHMARK__={engine:"aperture",canvas,ready,
 async setCamera(c){await ready;worker.postMessage(createGeneratedCommandMessage({channel:"bench.camera",payload:c}));},
 async renderFrame(f){await ready;const snapshot=await step(f.deltaSeconds,f.timeSeconds);await gpu.renderSnapshot(snapshot,{frame:f.frame});},
 async inspectGeometry(){await ready;const meshes=[];for(const entry of assets.list()){const m=entry.asset;if(m?.kind!=="mesh")continue;const p=m.vertexStreams.find(s=>s.attributes.some(a=>a.semantic==="POSITION"));if(!p)continue;const attr=p.attributes.find(a=>a.semantic==="POSITION");const n=p.attributes.find(a=>a.semantic==="NORMAL");const stride=p.arrayStride/4;const pos=new Float32Array(p.vertexCount*3),norm=new Float32Array(p.vertexCount*3);for(let i=0;i<p.vertexCount;i++){for(let k=0;k<3;k++){pos[i*3+k]=p.data[i*stride+attr.offset/4+k];if(n)norm[i*3+k]=p.data[i*stride+n.offset/4+k];}}meshes.push({id:entry.handle.id,positions:pos,normals:n?norm:undefined,indices:m.indexBuffer?.data,worldMatrix:I});}return {meshes};},
 async dispose(){worker.terminate();if(gpu)await gpu.dispose();}
};
EOF
cat > /work/src/scene.js <<"EOF"
import {createSystem,mesh,material} from "@aperture-engine/app/systems";
const PI=Math.PI;
let seed=12831;function rand(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const batches=new Map();
const palette={
 stucco:[.82,.73,.58],stone:[.59,.54,.43],mortar:[.40,.38,.32],trim:[.72,.66,.53],roof:[.58,.205,.075],roof2:[.70,.29,.10],roof3:[.48,.16,.055],timber:[.22,.15,.085],frame:[.085,.10,.11],glass:[.10,.17,.21],glass2:[.20,.29,.34],door:[.115,.145,.16],earth:[.29,.24,.14],grass:[.24,.32,.095],grass2:[.33,.40,.12],leaf:[.19,.28,.065],leaf2:[.30,.38,.115],leaf3:[.37,.42,.18],bark:[.28,.20,.115],asphalt:[.115,.13,.145],curb:[.57,.56,.49],white:[.81,.79,.69],blue:[.018,.15,.37],blue2:[.026,.21,.48],rubber:[.025,.028,.032],chrome:[.47,.53,.55],light:[.80,.84,.80],red:[.55,.028,.017],terra:[.46,.22,.10],lavender:[.36,.27,.43],yellow:[.76,.59,.17]
};
const props={glass:[.18,.25],glass2:[.23,.3],blue:[.25,.35],blue2:[.24,.3],chrome:[.29,.72],light:[.24,.15],rubber:[.95,0],asphalt:[.98,0]};
function batch(name){if(!batches.has(name))batches.set(name,[]);return batches.get(name);}
function tri(name,a,b,c){const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);const cr=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...cr)<1e-8)return;batch(name).push(a,b,c);}
function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d);}
let xf=p=>p;
function box(m,c,s,angle=0){let v=[];for(let i=0;i<8;i++){let x=(i&1?1:-1)*s[0]/2,y=(i&2?1:-1)*s[1]/2,z=(i&4?1:-1)*s[2]/2;v.push(xf([c[0]+x*Math.cos(angle)+z*Math.sin(angle),c[1]+y,c[2]-x*Math.sin(angle)+z*Math.cos(angle)]));}for(const f of [[0,2,3,1],[4,5,7,6],[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3]])quad(m,...f.map(i=>v[i]));}
function ellipsoid(m,c,s,seg=10,rings=6){let pts=[];for(let j=0;j<=rings;j++){const a=PI*j/rings;for(let k=0;k<seg;k++){const t=k*PI*2/seg;pts.push(xf([c[0]+s[0]*Math.sin(a)*Math.cos(t),c[1]+s[1]*Math.cos(a),c[2]+s[2]*Math.sin(a)*Math.sin(t)]));}}for(let j=0;j<rings;j++)for(let k=0;k<seg;k++){const l=(k+1)%seg,a=pts[j*seg+k],b=pts[j*seg+l],c2=pts[(j+1)*seg+l],d=pts[(j+1)*seg+k];quad(m,a,d,c2,b);}}
function tube(m,a,b,r1,r2=r1,seg=10){let axis=b.map((x,i)=>x-a[i]),len=Math.hypot(...axis);axis=axis.map(x=>x/len);let u=Math.abs(axis[1])<.95?[-axis[2],0,axis[0]]:[1,0,0];let ul=Math.hypot(...u);u=u.map(x=>x/ul);let v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];let points=[];for(let j=0;j<2;j++)for(let i=0;i<seg;i++){const t=i*2*PI/seg,r=j?r2:r1,c=j?b:a;points.push(xf(c.map((x,k)=>x+r*(u[k]*Math.cos(t)+v[k]*Math.sin(t)))));}for(let i=0;i<seg;i++){const k=(i+1)%seg;quad(m,points[i],points[k],points[seg+k],points[seg+i]);tri(m,xf(a),points[k],points[i]);tri(m,xf(b),points[seg+i],points[seg+k]);}}
function polygon(m,pts){for(let i=1;i<pts.length-1;i++)tri(m,xf(pts[0]),xf(pts[i]),xf(pts[i+1]));}
function ground(){box("earth",[0,-.25,0],[36,.4,36]);box("grass",[-1,.005,-1],[29,.1,28]);
 // Curving road, sidewalk and separate block curbs.
 const center=[-2,-4],R=14,start=-1.45,end=1.8,steps=135;
 const road=(t,r,y)=>[center[0]+r*Math.sin(t),y,center[1]+r*Math.cos(t)];
 for(let i=0;i<steps;i++){let a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;quad("asphalt",road(a,R-1.75,.065),road(a,R+1.75,.065),road(b,R+1.75,.065),road(b,R-1.75,.065));quad("curb",road(a,R-3.05,.14),road(a,R-1.9,.14),road(b,R-1.9,.14),road(b,R-3.05,.14));if(i%3===0){const t=(a+b)/2;box("trim",road(t,R-1.83,.17),[.65,.25,.24],-t);}if(i%8<4)quad("white",road(a,R-.055,.076),road(a,R+.055,.076),road(b,R+.055,.076),road(b,R-.055,.076));}
 // Asphalt aggregate as tiny geometric speckles.
 for(let i=0;i<1700;i++){let t=start+rand()*(end-start),r=R-1.65+rand()*3.3,p=road(t,r,.075);box(i%3?"asphalt":"mortar",p,[.018+rand()*.03,.006,.018+rand()*.03]);}
 // Garden turf detail.
 for(let i=0;i<900;i++){let x=-7+rand()*14,z=-4+rand()*11;if(Math.abs(x)<4.2&&z<3.6)continue;if(Math.abs(x)<.8&&z>3.3)continue;const h=.07+rand()*.14;tri(i%2?"grass2":"grass",[x,.09,z],[x+.025,.09+h,z],[x+.05,.09,z]);}
}
function facade(axis,pos,width,height,openings){let xs=[-width/2,width/2],ys=[.3,height];for(let o of openings){xs.push(o.x-o.w/2,o.x+o.w/2);ys.push(o.y-o.h/2,o.y+o.h/2);}xs=[...new Set(xs)].sort((a,b)=>a-b);ys=[...new Set(ys)].sort((a,b)=>a-b);for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){let x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;if(openings.some(o=>Math.abs(x-o.x)<o.w/2&&Math.abs(y-o.y)<o.h/2))continue;const w=xs[i+1]-xs[i],h=ys[j+1]-ys[j];if(axis==="z")box("stucco",[x,y,pos],[w,h,.3]);else box("stucco",[pos,y,x],[.3,h,w]);}}
function windowAt(c,w,h,side=0){const old=xf;xf=p=>old([c[0]+p[0]*Math.cos(side)+p[2]*Math.sin(side),c[1]+p[1],c[2]-p[0]*Math.sin(side)+p[2]*Math.cos(side)]);
 box("frame",[0,0,-.105],[w,h,.1]);box("glass",[0,0,-.043],[w-.14,h-.14,.025]);
 for(let x of [-w/2+.035,w/2-.035,0])box("frame",[x,0,.008],[.065,h,.055]);for(let y of [-h/2+.035,h/2-.035,0])box("frame",[0,y,.008],[w,.065,.055]);
 box("trim",[0,-h/2-.065,.045],[w+.2,.13,.30]);box("stone",[0,h/2+.052,.01],[w+.07,.07,.10]);
 // Interior curtains and a fine pale reflection strip.
 for(let x of [-w*.31,w*.31])box("trim",[x,0,-.025],[w*.18,h-.2,.011]);box("glass2",[-w*.17,0,-.02],[.025,h-.17,.013]);
 xf=old;
}
function house(){box("stone",[0,.23,0],[8.1,.45,6.6]);
 let front=[{x:-2.25,y:4.8,w:1.45,h:1.45},{x:2.25,y:4.8,w:1.45,h:1.45},{x:-2.7,y:1.65,w:1.2,h:1.5},{x:2.2,y:1.65,w:1.1,h:1.5},{x:0,y:1.5,w:1.1,h:2.4}];facade("z",3.2,8,6.2,front);
 for(const o of front){if(o.x!==0)windowAt([o.x,o.y,3.24],o.w,o.h);}
 let side=[{x:-1.8,y:4.8,w:.9,h:1.4},{x:1.55,y:4.8,w:.95,h:1.4},{x:-1.8,y:1.65,w:.85,h:1.5},{x:1.55,y:1.65,w:.95,h:1.5}];facade("x",4,6.4,6.2,side);facade("x",-4,6.4,6.2,side);for(const o of side){windowAt([4.04,o.y,o.x],o.w,o.h,PI/2);windowAt([-4.04,o.y,o.x],o.w,o.h,-PI/2);}
 facade("z",-3.2,8,6.2,[{x:-2,y:4.8,w:1.3,h:1.4},{x:2,y:4.8,w:1.3,h:1.4}]);windowAt([-2,4.8,-3.25],1.3,1.4,PI);windowAt([2,4.8,-3.25],1.3,1.4,PI);
 for(let x of [-4,4]){polygon("stucco",[[x,6.2,-3.2],[x,6.2,3.2],[x,8.15,0]]);polygon("stucco",[[x,6.2,-3.2],[x,8.15,0],[x,6.2,3.2]]);}
 box("door",[0,1.5,3.12],[1.1,2.4,.15]);for(let x of [-.255,.255])for(let y of [.87,1.76]){box("frame",[x,y,3.21],[.43,.66,.032]);box("door",[x,y,3.233],[.37,.58,.02]);}tube("chrome",[.4,1.36,3.26],[.4,1.6,3.26],.026);box("chrome",[.4,1.46,3.3],[.04,.035,.15]);
 // Main gable roof, bargeboards and individually curved overlapping tiles.
 roof(0,8.2,4.55,3.72,2.18);
 // Chimney with cap and louvred flue crown.
 box("stucco",[2.55,8.45,-.72],[.65,2.0,.66]);box("trim",[2.55,9.1,-.72],[.78,.1,.79]);box("frame",[2.55,9.24,-.72],[.51,.29,.49]);for(let x of [-.27,.27])for(let z of [-.28,.28])box("stucco",[2.55+x,9.28,-.72+z],[.12,.4,.12]);box("trim",[2.55,9.52,-.72],[.92,.12,.9]);box("roof2",[2.55,9.61,-.72],[.95,.08,.92]);
 // Porch limestone platform, two posts, lintel, tiled lean-to canopy.
 box("stone",[.15,.25,4.15],[5.15,.45,2.1]);for(let i=0;i<3;i++)box("trim",[.15,.08+i*.07,5.42-i*.22],[3.0,.14,.40]);
 for(let x of [-2.05,2.35]){box("stucco",[x,1.6,4.9],[.32,2.8,.32]);box("trim",[x,.3,4.9],[.46,.17,.46]);box("trim",[x,2.96,4.9],[.48,.2,.46]);}
 box("timber",[.15,3.18,4.87],[5.0,.27,.25]);box("trim",[.15,3.03,4.9],[4.9,.09,.23]);
 leanRoof(-2.45,2.75,3.13,5.13,3.65,3.2);
 // Gutters and downpipes.
 for(let z of [-3.7,3.7]){tube("frame",[-4.57,6.08,z],[4.57,6.08,z],.052);for(let x of [-4.08,4.08]){tube("frame",[x,6.09,z],[x,5.8,z*.86],.041);tube("frame",[x,5.8,z*.86],[x,.35,z*.86],.041);}}
 // Porch lantern.
 tube("frame",[-.94,2.33,3.4],[-.94,2.68,3.4],.018);box("light",[-.94,2.39,3.42],[.15,.25,.14]);for(let x of [-1.03,-.85])box("frame",[x,2.39,3.42],[.025,.3,.18]);box("frame",[-.94,2.57,3.42],[.25,.065,.24]);
}
function tile(m,x,y,z,direction,length=.5,width=.235){const s=direction[2]>0?1:-1,normal=[0,Math.abs(direction[2]),Math.abs(direction[1])*s];for(let i=0;i<6;i++){const a=PI*i/6,b=PI*(i+1)/6;const point=(theta,t)=>[x+width*.5*Math.cos(theta),y+direction[1]*t+normal[1]*.075*Math.sin(theta),z+direction[2]*t+normal[2]*.075*Math.sin(theta)];let q=[point(a,0),point(a,length),point(b,length),point(b,0)];if(s>0)q.reverse();quad(m,...q);}}
function roof(x0,ridge,halfX,halfZ,rise){for(let s of [-1,1]){const dir=[0,-rise/Math.hypot(halfZ,rise),s*halfZ/Math.hypot(halfZ,rise)],L=Math.hypot(halfZ,rise);const a=[x0-halfX,ridge,0],b=[x0+halfX,ridge,0],c=[x0+halfX,ridge-rise,s*halfZ],d=[x0-halfX,ridge-rise,s*halfZ];let q=[a,b,c,d];if(s>0)q.reverse();quad("roof3",...q);
 for(let i=0;i<39;i++)for(let j=0;j<11;j++){let x=x0-halfX+.115+i*(halfX*2-.23)/38,t=j*L/11;tile(j%4===0?"roof2":(i+j)%5===0?"roof3":"roof",x,ridge+dir[1]*t+.035,s*0+dir[2]*t,dir,L/11+.09);}
 tube("timber",[x0-halfX,ridge-rise-.1,s*halfZ],[x0+halfX,ridge-rise-.1,s*halfZ],.075);for(let x of [x0-halfX,x0+halfX])tube("timber",[x,ridge+.04,0],[x,ridge-rise-.1,s*halfZ],.085);
 }
 for(let i=0;i<38;i++)tube("roof2",[x0-halfX+i*.24,ridge+.06,0],[x0-halfX+i*.24+.26,ridge+.06,0],.14,.14,10);
}
function leanRoof(x1,x2,z1,z2,y1,y2){quad("roof3",[x1,y1,z1],[x1,y2,z2],[x2,y2,z2],[x2,y1,z1]);const L=Math.hypot(z2-z1,y2-y1),dir=[0,(y2-y1)/L,(z2-z1)/L];for(let i=0;i<23;i++)for(let j=0;j<5;j++){const t=j*L/5;tile((i+j)%4?"roof":"roof2",x1+.11+i*(x2-x1-.22)/22,y1+t*dir[1]+.025,z1+t*dir[2],dir,L/5+.1,.23);}tube("timber",[x1,y2-.06,z2],[x2,y2-.06,z2],.07);}
EOF
```

Stdout:

```text

```

Stderr:

```text

```

## Command 9a7d646b1ef249e79775ff469bb60acf

2026-10-11T23:44:32.824286+00:00 → 2026-10-11T23:44:34.101550+00:00; exit 0; duration 1.277s.

Command:

```sh
cat >> /work/src/scene.js <<"EOF"
function masonryWall(a,b,h=.85){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);box("mortar",[(a[0]+b[0])/2,h/2+.10,(a[1]+b[1])/2],[len,h,.33],angle);for(let row=0;row<3;row++){let count=Math.ceil(len/.6);for(let i=0;i<count;i++){let t=(i+.5+(row%2)*.32)/count;if(t>=1)continue;let c=[a[0]+(b[0]-a[0])*t,.10+(row+.5)*h/3,a[1]+(b[1]-a[1])*t];box((row+i)%4?"stone":"trim",c,[len/count-.028,h/3-.025,.38],angle);}}for(let i=0;i<Math.ceil(len/.75);i++){let t=(i+.5)/Math.ceil(len/.75);box("trim",[a[0]+(b[0]-a[0])*t,h+.13,a[1]+(b[1]-a[1])*t],[len/Math.ceil(len/.75)-.015,.12,.46],angle);}}
function gardens(){
 // Front path, with irregular polygon pavers over a sand bed.
 box("mortar",[0,.14,6],[1.45,.1,3.1]);for(let row=0;row<7;row++)for(let col=0;col<3;col++){let x=-.69+col*.48,z=4.5+row*.46;const pts=[[x+.03,.203,z+.04],[x+.42,.203,z+.015],[x+.46,.203,z+.32],[x+.30,.203,z+.43],[x+.025,.203,z+.39]];polygon(row%3?"stone":"trim",pts.slice().reverse());}
 // Side stone walk follows the east facade.
 box("mortar",[5.03,.105,0],[1.8,.12,8.6]);for(let i=0;i<16;i++)for(let j=0;j<3;j++)box((i+j)%3?"stone":"trim",[4.5+j*.52,.175,-3.9+i*.53],[.47,.08,.48],(rand()-.5)*.15);
 masonryWall([-8,6.55],[-1.0,6.55]);masonryWall([1.0,6.55],[2.2,6.5]);
 for(let i=0;i<17;i++){let t=.41+i*.06,u=t+.06;const r=10.75;masonryWall([-2+r*Math.sin(t),-4+r*Math.cos(t)],[-2+r*Math.sin(u),-4+r*Math.cos(u)],.78);}
 for(let x of [-1.0,1.0]){box("mortar",[x,.92,6.55],[.49,1.6,.49]);for(let j=0;j<5;j++)box(j%2?"stone":"trim",[x,.24+j*.29,6.55],[.53,.27,.53]);box("trim",[x,1.69,6.55],[.68,.14,.64]);}
 // Rear side fence with individual boards.
 for(let z=-3.3;z<0;z+=.19)box("timber",[6.1,.93,z],[.13,1.66,.16]);for(let y of [.5,1.3])box("bark",[6.03,y,-1.7],[.16,.1,3.5]);
 // Small mailbox by the path entrance.
 box("frame",[-1.7,.88,6.50],[.09,1.55,.09]);box("door",[-1.7,1.64,6.50],[.55,.46,.38]);tube("frame",[-1.99,1.80,6.31],[-1.42,1.8,6.31],.19,.19,12);box("trim",[-1.7,1.67,6.718],[.21,.015,.012]);box("chrome",[-1.7,1.54,6.72],[.11,.025,.015]);
 // Potted olive bushes on the porch.
 for(let p of [[-1.3,3.65],[2.9,4.5]]){tube("terra",[p[0],.24,p[1]],[p[0],.68,p[1]],.22,.30,16);tube("roof2",[p[0],.64,p[1]],[p[0],.73,p[1]],.31,.31,16);box("earth",[p[0],.72,p[1]],[.40,.025,.40]);bush(p[0],p[1],.75,.65);}
 for(let p of [[-3.4,4.6],[-4.8,3.5],[3.7,4.0],[4.8,3.0],[6.2,2.0],[-6.0,6],[-5.0,5.9],[4.6,5.3],[5.3,4.6],[-4.8,-1.6],[-6.5,1.2]])bush(p[0],p[1],.10,.70+rand()*.15);
 for(let i=0;i<26;i++){let x=i<14?-7.8+i*.45:2.0+(i-14)*.34,z=i<14?6.1:6.1-(i-14)*.23;bush(x,z,.12,.35+rand()*.25);}
 // Lavender and small flowers along the house edge.
 for(let i=0;i<65;i++){let x=-4.1+rand()*8.2,z=3.48+rand()*.47;if(Math.abs(x)<1.3)continue;let y=.45+rand()*.35;tube("leaf",[x,.1,z],[x,y,z],.014,.007,5);ellipsoid(i%4?"lavender":"yellow",[x,y,z],[.045,.11,.045],5,3);}
 tree(-6.3,3.8,3.45,1.85);tree(7.0,-1.0,3.15,1.45);tree(-6.1,-3.5,3.25,1.6);
 for(let p of [[-8,-2],[-7.3,-5.0],[7.5,-5.5],[-9.0,-4]]){tube("bark",[p[0],.1,p[1]],[p[0],2,p[1]],.12,.07,8);for(let i=0;i<8;i++){let y=1.2+i*.5;ellipsoid(i%2?"leaf":"leaf2",[p[0],y,p[1]],[.52*(1-i*.085),.8,.50*(1-i*.085)],8,5);}}
}
function bush(x,z,y,r){for(let i=0;i<11;i++){let a=rand()*PI*2,rad=rand()*r*.75,cy=y+.25+rand()*r*.65;ellipsoid(i%3===0?"leaf3":i%2?"leaf2":"leaf",[x+Math.cos(a)*rad,cy,z+Math.sin(a)*rad],[r*.38,.25+r*.22,r*.36],7,4);}}
function tree(x,z,h,r){tube("bark",[x,.1,z],[x+.15,h*.7,z],.20,.095,10);for(let i=0;i<9;i++){let a=i*2.4,by=h*.55+rand()*.35,end=[x+Math.cos(a)*r*.70,by+.70,z+Math.sin(a)*r*.65];tube("bark",[x+.1,h*.50,z],end,.06,.02,7);}
 for(let i=0;i<67;i++){let a=rand()*PI*2,rad=Math.sqrt(rand())*r;let yy=h+.55*(rand()-.5)-rad*.20;ellipsoid(i%3===0?"leaf3":i%2?"leaf2":"leaf",[x+Math.cos(a)*rad,yy,z+Math.sin(a)*rad],[.35+rand()*.24,.27+rand()*.23,.34+rand()*.25],7,4);}}
function car(){const old=xf,ang=.48;xf=p=>old([4.20+p[0]*Math.cos(ang)+p[2]*Math.sin(ang),.04+p[1],8.25-p[0]*Math.sin(ang)+p[2]*Math.cos(ang)]);
 // Smoothly faceted closed hatchback body from shaped transverse stations.
 const stations=[[-2.25,.72,.59],[-2.05,.85,.83],[-1.62,.93,.95],[-.85,.95,1.01],[.45,.95,1.00],[1.55,.91,.91],[2.03,.78,.79],[2.14,.70,.66]];
 const ring=(s)=>{const [x,w,y]=s;return [[x,.40,-w*.84],[x,.57,-w],[x,y-.13,-w],[x,y,-w*.78],[x,y, w*.78],[x,y-.13,w],[x,.57,w],[x,.40,w*.84]];};
 let rings=stations.map(ring);for(let j=0;j<rings.length-1;j++)for(let k=0;k<8;k++){let n=(k+1)%8;quad(k===3?"blue2":"blue",xf(rings[j][k]),xf(rings[j+1][k]),xf(rings[j+1][n]),xf(rings[j][n]));}polygon("blue",rings[0].slice().reverse());polygon("blue",rings.at(-1));
 // Hood crease and shoulder line.
 for(let z of [-.55,.55])tube("blue2",[-2.04,.87,z],[-.87,1.015,z*.93],.022,.017,6);
 box("rubber",[0,.38,0],[3.85,.12,1.78]);for(let z of [-.95,.95])box("blue2",[.05,.47,z],[3.75,.1,.085]);
 // Cabin pillars, roof and real inset glazing.
 const cabin=[[-.94,1.00,.82],[-.27,1.63,.67],[.83,1.65,.65],[1.68,1.03,.82]];
 const ct=(i,s)=>[cabin[i][0],cabin[i][1],s*cabin[i][2]];
 quad("glass",xf(ct(0,-1)),xf(ct(1,-1)),xf(ct(1,1)),xf(ct(0,1)));
 quad("blue2",xf(ct(1,-1)),xf(ct(2,-1)),xf(ct(2,1)),xf(ct(1,1)));
 quad("glass",xf(ct(2,-1)),xf(ct(3,-1)),xf(ct(3,1)),xf(ct(2,1)));
 for(let s of [-1,1]){
 const P=p=>[p[0],p[1],s*p[2]];
 const rear=[P([.54,1.06,.82]),P([.54,1.57,.674]),P([.84,1.58,.67]),P([1.48,1.08,.81])];
 const front=[P([-.76,1.065,.826]),P([-.20,1.56,.691]),P([.44,1.58,.674]),P([.44,1.065,.83])];
 if(s<0){rear.reverse();front.reverse();}polygon("glass",rear);polygon("glass2",front);
 for(let i=0;i<3;i++)tube("blue",ct(i,s),ct(i+1,s),.047,.047,7);tube("frame",P([.49,1.035,.843]),P([.49,1.60,.677]),.05,.05,6);tube("blue",P([-.86,1.015,.85]),P([1.66,1.025,.85]),.052,.052,8);
 // Side mirrors and door handles.
 tube("frame",[-.62,1.04,s*.85],[-.68,1.10,s*1.07],.045,.045,7);ellipsoid("blue",[-.73,1.13,s*1.08],[.18,.10,.10],10,5);box("glass2",[-.72,1.14,s*1.175],[.22,.09,.018]);
 for(let x of [.14,1.15])box("frame",[x,.945,s*.946],[.20,.032,.038]);
 // Door shut lines.
 for(let x of [.49,1.58])tube("frame",[x,.47,s*.94],[x,1.005,s*.95],.008,.008,5);
 }
 // Roof antenna and windshield wipers.
 tube("frame",[.92,1.66,0],[1.03,1.96,0],.014,.006,6);for(let z of [-.35,.35])tube("frame",[-.86,1.067,z],[-.45,1.22,z*.85],.012,.012,5);
 // Front grille, headlights, bumper inserts, registration plate.
 box("rubber",[-2.238,.67,0],[.035,.24,1.07]);for(let y of [.60,.65,.70,.75])box("chrome",[-2.258,y,0],[.025,.018,1.05]);
 for(let z of [-.61,.61]){ellipsoid("frame",[-2.06,.84,z],[.17,.12,.24],10,5);ellipsoid("light",[-2.10,.856,z],[.155,.083,.207],10,5);for(let dz of [-.08,.075])ellipsoid("white",[-2.20,.864,z+dz],[.018,.054,.053],8,4);}
 box("rubber",[-2.232,.43,0],[.05,.16,1.3]);box("chrome",[-2.27,.49,0],[.02,.018,1.08]);box("trim",[-2.287,.60,0],[.018,.12,.43]);
 for(let z of [-.65,.65])ellipsoid("light",[-2.18,.43,z],[.025,.046,.10],8,4);
 ellipsoid("chrome",[-2.275,.765,0],[.014,.10,.10],12,6);ellipsoid("frame",[-2.29,.765,0],[.008,.061,.062],10,5);
 for(let z of [-.63,.63])box("red",[2.05,.85,z],[.09,.18,.31]);box("frame",[2.17,.47,0],[.035,.14,1.25]);box("trim",[2.18,.69,0],[.03,.12,.43]);box("blue",[1.28,1.44,0],[.30,.10,1.37]);
 // Four complete wheels: rubber tire, alloy ring, hub, spokes, lug bolts.
 for(let x of [-1.39,1.36])for(let z of [-.91,.91]){const s=Math.sign(z),cy=.46; tube("rubber",[x,cy,z-.13],[x,cy,z+.13],.435,.435,28);tube("chrome",[x,cy,z+s*.135],[x,cy,z+s*.16],.31,.31,24);tube("frame",[x,cy,z+s*.163],[x,cy,z+s*.166],.255,.255,24);tube("chrome",[x,cy,z+s*.17],[x,cy,z+s*.19],.082,.082,16);
 for(let i=0;i<10;i++){let a=i*2*PI/10;const p1=[x+.08*Math.cos(a),cy+.08*Math.sin(a),z+s*.18],p2=[x+.29*Math.cos(a+.14),cy+.29*Math.sin(a+.14),z+s*.17];tube("chrome",p1,p2,.018,.016,5);}for(let i=0;i<5;i++){let a=i*2*PI/5;ellipsoid("frame",[x+.052*Math.cos(a),cy+.052*Math.sin(a),z+s*.194],[.013,.013,.007],6,3);}
 // Wheel arch upper lip follows the tire curve.
 for(let i=0;i<14;i++){let a=PI*i/14,b=PI*(i+1)/14;const p1=[x+.47*Math.cos(a),cy+.47*Math.sin(a),z+s*.145],p2=[x+.47*Math.cos(b),cy+.47*Math.sin(b),z+s*.145];tube("blue2",p1,p2,.026,.026,5);}
 }
 xf=old;
}
export default class HouseScene extends createSystem({priority:0}){
 init(){ground();house();gardens();car();for(const [name,positions]of batches){const c=palette[name]||[.5,.5,.5],pr=props[name]||[.87,0];this.spawn.mesh({key:`scene.${name}`,mesh:mesh.triangleList({label:name,positions}),material:material.standard({label:name,baseColor:[...c,1],roughness:pr[0],metallic:pr[1]}),castShadow:name!=="asphalt"&&name!=="grass",receiveShadow:true});}
 this.setView({position:[14,9,19],target:[0,2.5,1],fovYDegrees:37,near:.1,far:200});
 this.spawn.light({key:"sun",kind:"directional",intensity:3.2,color:[1,.88,.69,1],transform:{rotationEulerDegrees:[-42,-45,0]},shadow:{mapSize:2048,cascadeCount:1,shadowType:1,strength:.78,filterRadius:2,normalBias:.035}});
 this.spawn.light({key:"fill",kind:"ambient",intensity:.22,color:[.67,.78,1,1]});
 }
 setView(c){if(this.cameraEntity)this.cameraEntity.destroy();this.cameraEntity=this.spawn.camera({key:"camera.main",transform:{translation:c.position,lookAt:c.target},fovYDegrees:c.fovYDegrees,camera:{aspect:1024/768,near:c.near,far:c.far,clearColor:[.55,.70,.85,1]}});}
 update(){for(const command of this.commands.drain("bench.camera"))this.setView(command.payload);}
}
EOF
python3 - <<"PY"
p="/work/src/scene.js"
s=open(p).read().replace("quad(m,a,d,c2,b);","quad(m,a,b,c2,d);")
open(p,"w").write(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 799 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.37 kB │ gzip:   0.28 kB
dist/assets/worker-Qd23CaFc.js    867.71 kB
dist/assets/dist-XlihWdUn.js    2,261.38 kB
dist/assets/index-B285ODwG.js   1,390.89 kB │ gzip: 341.33 kB

✓ built in 674ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Public note — 2026-10-11T23:44:38.867128+00:00

```
Initial build succeeds. The scene uses worker-authored ECS triangle meshes batched by surface material, real curved roof tiles, inset window openings, stone paving and wall blocks, branched vegetation, and a multi-part hatchback. Requesting first native preview.
```

## Preview 1

Status: error; recorder-measured coordinator wait: 2.909s.

## Command 00fbb0d7389744699a17955d35698597

2026-10-11T23:44:50.562150+00:00 → 2026-10-11T23:44:50.730688+00:00; exit 0; duration 0.169s.

Command:

```sh
cat /reference/preview-01-error.txt; find /reference -maxdepth 2 -type f
```

Stdout:

```text
/reference/contract.md
/reference/prompt.txt
/reference/reference.png
```

Stderr:

```text
cat: /reference/preview-01-error.txt: No such file or directory
```

## Command 1d011dc782d54edc8ba175982a93d456

2026-10-11T23:44:54.791675+00:00 → 2026-10-11T23:44:54.910349+00:00; exit 0; duration 0.119s.

Command:

```sh
find /work -maxdepth 3 -type f | head -45; ls /
```

Stdout:

```text
/work/src/worker.js
/work/src/scene.js
/work/src/main.js
/work/src/config.js
/work/pnpm-lock.yaml
/work/node_modules/.modules.yaml
/work/node_modules/.pnpm/lock.yaml
/work/node_modules/.pnpm-workspace-state.json
/work/node_modules/.bin/prettier
/work/node_modules/.bin/tsserver
/work/node_modules/.bin/tsc
/work/node_modules/.bin/aperture
/work/node_modules/.bin/vite
/work/package.json
/work/vite.config.js
/work/index.html
/work/dist/index.html
/work/dist/assets/dist-XlihWdUn.js
/work/dist/assets/index-B285ODwG.js
/work/dist/assets/worker-Qd23CaFc.js
bin
boot
dev
etc
home
lib
lib64
media
mnt
opt
proc
reference
root
run
sbin
sdk
srv
sys
tmp
usr
var
work
```

Stderr:

```text

```

## Command 367cb39daff54e2da78bcd9148cacb6d

2026-10-11T23:45:02.416081+00:00 → 2026-10-11T23:45:02.586719+00:00; exit 0; duration 0.171s.

Command:

```sh
cat /workspace/aperture/benchmarks/agent-house-race-20261011/round-001/authors/aperture-r001/previews/01-artifacts/public-error.txt; cat /sdk/source/render/src/mesh/primitives-triangle-list.ts | head -140; grep -n "sourceAssets" /sdk/source/app/src/asset-mirror.ts | tail -15
```

Stdout:

```text
import type { MeshAsset, MeshIndexBufferDescriptor } from "./types.js";
import type {
  TriangleListMeshOptions,
  TriangleListPosition,
  TriangleListUv,
} from "./triangle-list-types.js";
import {
  PRIMITIVE_VERTEX_STRIDE_BYTES,
  boundsFromPositions,
  interleavePrimitiveVertexList,
  type PrimitiveVertex,
} from "./primitives-builders.js";

/** An invalid triangle-list input, with the offending field or face location. */
export class TriangleListMeshError extends RangeError {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path} ${reason}`);
    this.name = "TriangleListMeshError";
    this.path = path;
  }
}

/**
 * Construct a validated triangle-list asset using the standard POSITION,
 * NORMAL, TEXCOORD_0 layout. Zero-area faces after float32 conversion are
 * rejected rather than publishing NaN normals or silently removing faces.
 */
export function createTriangleListMeshAsset(
  options: TriangleListMeshOptions,
): MeshAsset {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TriangleListMeshError("options", "must be an object.");
  }
  if (options.label !== undefined && typeof options.label !== "string") {
    throw new TriangleListMeshError("label", "must be a string.");
  }

  const positions = readPositions(options.positions);
  const indices = readIndices(options.indices, positions.length);
  const cornerCount = indices?.length ?? positions.length;
  if (cornerCount < 3 || cornerCount % 3 !== 0) {
    throw new TriangleListMeshError(
      indices === undefined ? "positions" : "indices",
      "must contain a positive multiple of three entries (one triple per triangle).",
    );
  }
  const normals = readNormals(options.normals, positions.length);
  const uvs = readUvs(options.uvs, positions.length);
  const vertices: PrimitiveVertex[] = [];

  if (normals !== undefined) {
    for (let index = 0; index < positions.length; index += 1) {
      vertices.push({
        position: positions[index]!,
        normal: normals[index]!,
        uv: uvs?.[index] ?? [0, 0],
      });
    }
  }

  for (let corner = 0; corner < cornerCount; corner += 3) {
    const a = indices?.[corner] ?? corner;
    const b = indices?.[corner + 1] ?? corner + 1;
    const c = indices?.[corner + 2] ?? corner + 2;
    const normal = faceNormal(positions[a]!, positions[b]!, positions[c]!, {
      corner,
      indexed: indices !== undefined,
      a,
      b,
      c,
    });
    if (normals === undefined) {
      for (const index of [a, b, c]) {
        vertices.push({
          position: positions[index]!,
          normal,
          uv: uvs?.[index] ?? [0, 0],
        });
      }
    }
  }

  // Bounds cover the actual stored float32 positions, including unused source
  // vertices when explicit normals retain the authored indexed layout.
  const bounds = boundsFromPositions(vertices.map((vertex) => vertex.position));
  if (!Number.isFinite(Math.fround(bounds.sphere.radius))) {
    throw new TriangleListMeshError(
      "positions",
      "span a bounding sphere too large for finite float32 storage; use smaller local coordinates and a transform.",
    );
  }
  const indexBuffer =
    normals === undefined ? undefined : createIndexBuffer(indices);

  return {
    kind: "mesh",
    label: options.label ?? "TriangleList",
    vertexStreams: [
      {
        id: "triangle-list-interleaved",
        arrayStride: PRIMITIVE_VERTEX_STRIDE_BYTES,
        vertexCount: vertices.length,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: interleavePrimitiveVertexList(vertices),
      },
    ],
    ...(indexBuffer === undefined ? {} : { indexBuffer }),
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: vertices.length,
        indexStart: 0,
        indexCount: indexBuffer?.data.length ?? 0,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  };
}

function readPositions(value: unknown): TriangleListPosition[] {
  const source = readArray(value, "positions");
  if (source.length < 3) {
    throw new TriangleListMeshError(
      "positions",
      "must contain at least three vertices.",
133:  const sourceAssets = readSourceAssetRegistry(message);
135:  if (sourceAssets === null) {
142:  for (const entry of sourceAssets.entries) {
218:  const value = (message as { readonly sourceAssets?: unknown }).sourceAssets;
```

Stderr:

```text
cat: /workspace/aperture/benchmarks/agent-house-race-20261011/round-001/authors/aperture-r001/previews/01-artifacts/public-error.txt: No such file or directory
```

## Command 58925b2cb4bb4327a3f4dcac12e1548d

2026-10-11T23:45:11.138533+00:00 → 2026-10-11T23:45:11.858940+00:00; exit 0; duration 0.720s.

Command:

```sh
node --input-type=module <<"JS"
import {createApertureApp} from "@aperture-engine/app/advanced";
import Scene from "./src/scene.js";
try { const app=await createApertureApp({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}]}); const s=app.stepAndExtract(0,0,0);console.log(JSON.stringify({draws:s.meshDraws.length,vertices:app.context.assetsRegistry.list().filter(x=>x.asset?.kind==="mesh").reduce((n,e)=>n+e.asset.vertexStreams[0].vertexCount,0),views:s.views.length,lights:s.lights,diagnostics:s.diagnostics}));await app.dispose();}catch(e){console.error(e);process.exitCode=1;}
JS
```

Stdout:

```text
{"draws":31,"vertices":243345,"views":1,"lights":[{"lightId":32,"entity":{"index":32,"generation":0},"kind":"directional","shape":"rect","color":[1,0.8799999952316284,0.6899999976158142,1],"intensity":3.200000047683716,"range":10,"innerConeAngle":0.39269909262657166,"outerConeAngle":0.5235987901687622,"width":2,"height":2,"worldTransformOffset":0,"layerMask":1},{"lightId":33,"entity":{"index":33,"generation":0},"kind":"ambient","shape":"rect","color":[0.6700000166893005,0.7799999713897705,1,1],"intensity":0.2199999988079071,"range":10,"innerConeAngle":0.39269909262657166,"outerConeAngle":0.5235987901687622,"width":2,"height":2,"worldTransformOffset":16,"layerMask":1}],"diagnostics":[]}
```

Stderr:

```text

```

## Public note — 2026-10-11T23:45:23.706819+00:00

```
First preview returned errorPath in the host artifact directory, which is not readable inside the assigned container. Recorded attempts to read it failed. Headless SDK validation succeeds: 31 actual mesh draws, 243345 submitted mesh vertices, one camera, two lights and no extraction diagnostics. Need the actual returned runtime error to make a targeted correction.
```

## Command bef4624a51b147ec9e10eb73ef1c3993

2026-10-11T23:45:23.981885+00:00 → 2026-10-11T23:45:24.100049+00:00; exit 0; duration 0.118s.

Command:

```sh
sed -n "1,210p" /sdk/source/runtime/src/simulation-worker.ts; grep -n "devtoolsStepInput" /sdk/source/app/src/worker/devtools/bridge.ts; sed -n "243,290p" /sdk/source/app/src/browser/app.ts; grep -n "function resolveCameraInput\|aspect\|far\|camera" /sdk/source/app/src/systems/spawn/index.ts | head -45
```

Stdout:

```text
import type { RenderSnapshot } from "@aperture-engine/render";
import type { FixedStepClockOptions } from "@aperture-engine/physics";

export const SIMULATION_WORKER_PROTOCOL = {
  connect: "aperture.simulation.connect",
  start: "aperture.simulation.start",
  ready: "aperture.simulation.ready",
  snapshot: "aperture.simulation.snapshot",
  audioSnapshot: "aperture.simulation.audioSnapshot",
  sourceAssets: "aperture.simulation.sourceAssets",
  error: "aperture.simulation.error",
} as const;

export interface SimulationWorkerStartOptions {
  readonly entityCapacity?: number;
  readonly fixedStep?: false | SimulationWorkerFixedStepOptions;
  readonly physicsInterpolation?:
    | boolean
    | SimulationWorkerPhysicsInterpolationOptions;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerFixedStepOptions extends FixedStepClockOptions {
  readonly enabled?: boolean;
}

export interface SimulationWorkerPhysicsInterpolationOptions {
  readonly enabled?: boolean;
}

export interface SimulationWorkerReadyMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.ready;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerSnapshotMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
  readonly snapshot: RenderSnapshot;
  readonly frame?: number;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerAudioSnapshotMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.audioSnapshot;
  readonly snapshot: RenderSnapshot;
  readonly frame?: number;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerSourceAssetsMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.sourceAssets;
  readonly frame?: number;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerErrorMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.error;
  readonly reason: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerSnapshotEvent {
  readonly snapshot: RenderSnapshot;
  readonly frame: number;
  readonly message: SimulationWorkerSnapshotMessage;
}

export interface SimulationWorkerErrorEvent {
  readonly reason: string;
  readonly message: string;
  readonly source: "worker" | "protocol";
  readonly diagnostics?: readonly unknown[];
  readonly raw?: unknown;
}

export type SimulationWorkerSnapshotCallback = (
  event: SimulationWorkerSnapshotEvent,
) => void;

export type SimulationWorkerErrorCallback = (
  event: SimulationWorkerErrorEvent,
) => void;

export type SimulationWorkerMessageCallback = (message: unknown) => void;

export interface SimulationWorker {
  readonly worker: SimulationWorkerTransport;
  start(options?: SimulationWorkerStartOptions): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onMessage(callback: SimulationWorkerMessageCallback): () => void;
  onSnapshot(callback: SimulationWorkerSnapshotCallback): () => void;
  onError(callback: SimulationWorkerErrorCallback): () => void;
  terminate(): void;
}

export interface SimulationWorkerTransport {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  addEventListener?(type: "error", listener: (event: ErrorEvent) => void): void;
  removeEventListener?(
    type: "error",
    listener: (event: ErrorEvent) => void,
  ): void;
}

export interface SimulationMessagePort {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  start?(): void;
  close?(): void;
}

export interface SimulationMessageChannel {
  readonly port1: SimulationMessagePort;
  readonly port2: SimulationMessagePort;
}

export type SimulationWorkerEntry = string | URL | SimulationWorkerTransport;

export type SimulationWorkerFactory = (
  entry: string | URL,
  options?: WorkerOptions,
) => SimulationWorkerTransport;

export interface CreateSimulationWorkerOptions extends SimulationWorkerStartOptions {
  readonly workerOptions?: WorkerOptions;
  readonly workerFactory?: SimulationWorkerFactory;
  readonly messageChannelFactory?: () => SimulationMessageChannel;
}

export interface SimulationWorkerConnectMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.connect;
  readonly port: SimulationMessagePort;
}

export function createSimulationWorker(
  workerEntry: SimulationWorkerEntry,
  options: CreateSimulationWorkerOptions = {},
): SimulationWorker {
  const worker = resolveWorker(workerEntry, options);
  const channelFactory =
    options.messageChannelFactory ?? createDefaultMessageChannel;
  const channel = channelFactory();
  const snapshotCallbacks = new Set<SimulationWorkerSnapshotCallback>();
  const errorCallbacks = new Set<SimulationWorkerErrorCallback>();
  const messageCallbacks = new Set<SimulationWorkerMessageCallback>();
  let terminated = false;

  const handleMessage = (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (!isRecord(message)) {
      return;
    }

    if (message.type === SIMULATION_WORKER_PROTOCOL.snapshot) {
      if (!isSnapshotMessage(message)) {
        dispatchError({
          reason: "simulation-worker.invalid-snapshot",
          message:
            "Simulation worker sent a snapshot message without a valid RenderSnapshot.",
          source: "protocol",
          raw: message,
        });
        return;
      }

      const snapshotEvent: SimulationWorkerSnapshotEvent = {
        snapshot: message.snapshot,
        frame: message.frame ?? message.snapshot.frame,
        message,
      };

      for (const callback of snapshotCallbacks) {
        callback(snapshotEvent);
      }
      return;
    }

    if (message.type === SIMULATION_WORKER_PROTOCOL.error) {
      const diagnostics = Array.isArray(message.diagnostics)
        ? message.diagnostics
        : undefined;
      dispatchError({
        reason: readString(message.reason, "simulation-worker.error"),
        message: readString(
          message.message,
          "The simulation worker reported an error.",
        ),
        source: "worker",
        ...(diagnostics === undefined ? {} : { diagnostics }),
        raw: message,
      });
      return;
    }

    for (const callback of messageCallbacks) {
      callback(message);
    }
  };

  const handleWorkerError = (event: ErrorEvent) => {
148:      result: bridge.step(devtoolsStepInput(request.payload)),
367:  const step = bridge.step(devtoolsStepInput(payload));
382:function devtoolsStepInput(payload: unknown): GeneratedDevtoolsStepInput {
      ? options.workerStartOptions
      : {
          audioSnapshotMessageRateHz: 0,
          ...(options.workerStartOptions ?? {}),
        };

  const withRenderProfile =
    options.renderProfile === null || options.renderProfile === undefined
      ? base
      : {
          ...(base ?? {}),
          apertureRenderProfile: options.renderProfile,
        };

  if (options.demandDriven !== true) {
    return withRenderProfile;
  }

  return {
    ...(withRenderProfile ?? {}),
    simulationPaused: true,
  };
}

function createGeneratedDemandStepScheduler(
  worker: SimulationWorker,
): () => void {
  let scheduled = false;
  let nextRequestId = 0;

  return () => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    const step = () => {
      scheduled = false;
      nextRequestId += 1;
      worker.postMessage(
        createApertureDevtoolsRequest({
          requestId: `generated-demand-${Date.now()}-${nextRequestId}`,
          tool: "ecs_step",
          payload: { delta: 1 / 60 },
        }),
      );
    };

```

Stderr:

```text

```

## Command 9301fcaa46414bff9dd9f9492278530b

2026-10-11T23:45:44.270835+00:00 → 2026-10-11T23:45:45.041399+00:00; exit 0; duration 0.771s.

Command:

```sh
node --input-type=module <<"JS"
import {createApertureApp} from "@aperture-engine/app/advanced";
import Scene from "./src/scene.js";
const a=await createApertureApp({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}]});const s=a.stepAndExtract(0,0,0);console.log(JSON.stringify({assetKinds:a.context.assetsRegistry.list().map(x=>({kind:x.handle.kind,id:x.handle.id,label:x.asset?.label})),views:s.views,sky:s.proceduralSkies,env:s.environments}));await a.dispose();
JS
sed -n "55,115p" /sdk/source/webgpu/src/app/create-webgpu-app.ts; cat /sdk/source/render/src/lighting/light-types.ts 2>/dev/null | head -70
```

Stdout:

```text
{"assetKinds":[{"kind":"mesh","id":"scene.earth.mesh","label":"earth"},{"kind":"material","id":"scene.earth.material","label":"earth"},{"kind":"mesh","id":"scene.grass.mesh","label":"grass"},{"kind":"material","id":"scene.grass.material","label":"grass"},{"kind":"mesh","id":"scene.asphalt.mesh","label":"asphalt"},{"kind":"material","id":"scene.asphalt.material","label":"asphalt"},{"kind":"mesh","id":"scene.curb.mesh","label":"curb"},{"kind":"material","id":"scene.curb.material","label":"curb"},{"kind":"mesh","id":"scene.trim.mesh","label":"trim"},{"kind":"material","id":"scene.trim.material","label":"trim"},{"kind":"mesh","id":"scene.white.mesh","label":"white"},{"kind":"material","id":"scene.white.material","label":"white"},{"kind":"mesh","id":"scene.mortar.mesh","label":"mortar"},{"kind":"material","id":"scene.mortar.material","label":"mortar"},{"kind":"mesh","id":"scene.grass2.mesh","label":"grass2"},{"kind":"material","id":"scene.grass2.material","label":"grass2"},{"kind":"mesh","id":"scene.stone.mesh","label":"stone"},{"kind":"material","id":"scene.stone.material","label":"stone"},{"kind":"mesh","id":"scene.stucco.mesh","label":"stucco"},{"kind":"material","id":"scene.stucco.material","label":"stucco"},{"kind":"mesh","id":"scene.frame.mesh","label":"frame"},{"kind":"material","id":"scene.frame.material","label":"frame"},{"kind":"mesh","id":"scene.glass.mesh","label":"glass"},{"kind":"material","id":"scene.glass.material","label":"glass"},{"kind":"mesh","id":"scene.glass2.mesh","label":"glass2"},{"kind":"material","id":"scene.glass2.material","label":"glass2"},{"kind":"mesh","id":"scene.door.mesh","label":"door"},{"kind":"material","id":"scene.door.material","label":"door"},{"kind":"mesh","id":"scene.chrome.mesh","label":"chrome"},{"kind":"material","id":"scene.chrome.material","label":"chrome"},{"kind":"mesh","id":"scene.roof3.mesh","label":"roof3"},{"kind":"material","id":"scene.roof3.material","label":"roof3"},{"kind":"mesh","id":"scene.roof2.mesh","label":"roof2"},{"kind":"material","id":"scene.roof2.material","label":"roof2"},{"kind":"mesh","id":"scene.roof.mesh","label":"roof"},{"kind":"material","id":"scene.roof.material","label":"roof"},{"kind":"mesh","id":"scene.timber.mesh","label":"timber"},{"kind":"material","id":"scene.timber.material","label":"timber"},{"kind":"mesh","id":"scene.light.mesh","label":"light"},{"kind":"material","id":"scene.light.material","label":"light"},{"kind":"mesh","id":"scene.bark.mesh","label":"bark"},{"kind":"material","id":"scene.bark.material","label":"bark"},{"kind":"mesh","id":"scene.terra.mesh","label":"terra"},{"kind":"material","id":"scene.terra.material","label":"terra"},{"kind":"mesh","id":"scene.leaf3.mesh","label":"leaf3"},{"kind":"material","id":"scene.leaf3.material","label":"leaf3"},{"kind":"mesh","id":"scene.leaf2.mesh","label":"leaf2"},{"kind":"material","id":"scene.leaf2.material","label":"leaf2"},{"kind":"mesh","id":"scene.leaf.mesh","label":"leaf"},{"kind":"material","id":"scene.leaf.material","label":"leaf"},{"kind":"mesh","id":"scene.yellow.mesh","label":"yellow"},{"kind":"material","id":"scene.yellow.material","label":"yellow"},{"kind":"mesh","id":"scene.lavender.mesh","label":"lavender"},{"kind":"material","id":"scene.lavender.material","label":"lavender"},{"kind":"mesh","id":"scene.blue.mesh","label":"blue"},{"kind":"material","id":"scene.blue.material","label":"blue"},{"kind":"mesh","id":"scene.blue2.mesh","label":"blue2"},{"kind":"material","id":"scene.blue2.material","label":"blue2"},{"kind":"mesh","id":"scene.rubber.mesh","label":"rubber"},{"kind":"material","id":"scene.rubber.material","label":"rubber"},{"kind":"mesh","id":"scene.red.mesh","label":"red"},{"kind":"material","id":"scene.red.material","label":"red"},{"kind":"environment-map","id":"environment.default","label":"Default Environment"}],"views":[{"viewId":31,"camera":{"index":31,"generation":0},"priority":0,"layerMask":1,"viewMatrixOffset":0,"projectionMatrixOffset":16,"viewProjectionMatrixOffset":32,"viewport":[0,0,1,1],"scissor":[0,0,1,1],"clearColor":[0.550000011920929,0.699999988079071,0.8500000238418579,1],"clearDepth":1,"clearStencil":0,"renderTarget":null}],"sky":[{"skyId":34,"entity":{"index":34,"generation":0},"model":"gradient","priority":0,"topColor":[0.24230000376701355,0.6172000169754028,0.8307999968528748],"horizonColor":[0.6583999991416931,0.7084000110626221,0.7912999987602234],"bottomColor":[0.8069999814033508,0.7757999897003174,0.7454000115394592],"horizonPosition":0.4000000059604645,"horizonSoftness":0.23999999463558197,"intensity":1,"sunDirection":[-0.6000000238418579,0.4000000059604645,-0.699999988079071],"sunColor":[1,0.7200000286102295,0.3799999952316284],"sunRadius":0,"sunGlow":0,"ditherStrength":0.003000000026077032,"layerMask":1}],"env":[{"environmentId":35,"handle":{"kind":"environment-map","id":"environment.default"},"color":[1,1,1,1],"intensity":1,"layerMask":1}]}
  readonly receivedAtMilliseconds: number;
}

export async function createWebGpuApp(
  options: CreateWebGpuAppOptions,
): Promise<CreateWebGpuAppResult> {
  const initialization = await initializeWebGpu(options);

  if (!initialization.ok) {
    return initialization;
  }

  const sourceAssets = options.sourceAssets ?? new AssetRegistry();
  const renderWorld = new RenderWorld();
  const tonemap = resolveTonemapOperator(options.tonemap);
  const outputColorSpace = resolveOutputColorSpace(options.outputColorSpace);
  const msaa = resolveWebGpuMsaaConfig(options.msaa ?? options.msaaSampleCount);
  // Persistent HDR scene buffer (M5-T4): opting into `exposure` renders the lit
  // scene into rgba16float and moves tonemap+exposure+sRGB to a final post
  // stage. Default (no exposure) keeps the byte-identical 8-bit in-material path.
  const hdrSceneBuffer =
    options.exposure !== undefined && Number.isFinite(options.exposure);
  const exposure = hdrSceneBuffer ? (options.exposure as number) : 1;
  const sceneRenderFormat = hdrSceneBuffer
    ? "rgba16float"
    : initialization.format;
  const postEffects = [...(options.postEffects ?? [])];

  if (hdrSceneBuffer) {
    // The tonemap stage is the LAST post effect: it samples the rgba16float
    // scene/post output and writes the 8-bit swapchain with exposure applied.
    postEffects.push(
      createWebGpuTonemapPostEffect({
        operator: tonemap,
        exposure,
        outputColorSpace,
      }),
    );
  }
  const resourceCache = createWebGpuAppResourceCache();
  const userPassRegistry = createWebGpuAppUserPassRegistry();
  const snapshotTransport = createWebGpuAppSnapshotTransport({
    ...(options.transport === undefined ? {} : { mode: options.transport }),
    ...(options.sharedSnapshotTransport === undefined
      ? {}
      : { sharedSnapshotTransport: options.sharedSnapshotTransport }),
  });
  const assetDecoderStartOptions = {
    ktx2TextureCompression: createKtx2TextureCompressionSupportFromFeatures(
      initialization.device.features ?? initialization.adapter.features,
    ),
  };
  let running = false;
  let unsubscribeSnapshot: (() => void) | null = null;
  let unsubscribeError: (() => void) | null = null;
  let pendingSnapshotEvent: PendingSnapshotEventRecord | null = null;
  let latestSharedSnapshotEvent: PendingSnapshotEventRecord | null = null;
  let latestRenderedSharedSnapshotFrame: number | null = null;
  let autoRenderScheduled = false;
  let autoRenderInFlight = false;
  let presentationMissedWhileInFlight = false;
```

Stderr:

```text

```

## Command ebb2018327e94b008f6c238d5a21c02e

2026-10-11T23:46:09.102724+00:00 → 2026-10-11T23:46:10.224878+00:00; exit 0; duration 1.122s.

Command:

```sh
python3 - <<"PY"
p="/work/src/scene.js"
s=open(p).read()
s=s.replace("xf(rings[j][k]),xf(rings[j+1][k]),xf(rings[j+1][n]),xf(rings[j][n])","xf(rings[j][n]),xf(rings[j+1][n]),xf(rings[j+1][k]),xf(rings[j][k])")
s=s.replace("xf(ct(0,-1)),xf(ct(1,-1)),xf(ct(1,1)),xf(ct(0,1))","xf(ct(0,1)),xf(ct(1,1)),xf(ct(1,-1)),xf(ct(0,-1))")
s=s.replace("xf(ct(1,-1)),xf(ct(2,-1)),xf(ct(2,1)),xf(ct(1,1))","xf(ct(1,1)),xf(ct(2,1)),xf(ct(2,-1)),xf(ct(1,-1))")
s=s.replace("xf(ct(2,-1)),xf(ct(3,-1)),xf(ct(3,1)),xf(ct(2,1))","xf(ct(2,1)),xf(ct(3,1)),xf(ct(3,-1)),xf(ct(2,-1))")
s=s.replace("if(s<0){rear.reverse();front.reverse();}","if(s>0){rear.reverse();front.reverse();}")
open(p,"w").write(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 799 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.37 kB │ gzip:   0.28 kB
dist/assets/worker-lPRE9xvU.js    867.71 kB
dist/assets/dist-BWl2Uw50.js    2,261.38 kB
dist/assets/index-Dex1eLvX.js   1,390.89 kB │ gzip: 341.33 kB

✓ built in 588ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Preview 2

Status: error; recorder-measured coordinator wait: 2.424s.

## Public note — 2026-10-11T23:46:30.218221+00:00

```
Second preview also returned an error path without its text. The returned path is a host path, not mounted in /work or /reference, and isolation permits only recorder commands, so I cannot inspect that artifact directly. Runtime error text or a copy into /reference is needed for browser-specific repair. Continuing SDK-level verification and implementation corrections within the lane.
```

## Command ccda9320ba564e868ee26898bb398bdb

2026-10-11T23:46:30.479284+00:00 → 2026-10-11T23:46:31.255681+00:00; exit 0; duration 0.776s.

Command:

```sh
node --input-type=module <<"JS"
import {createApertureApp} from "@aperture-engine/app/advanced";
import Scene from "./src/scene.js";
import {serializeSourceAssetRegistry,mirrorSourceAssetRegistryFromMessage} from "@aperture-engine/app/asset-mirror";
import {AssetRegistry} from "@aperture-engine/simulation";
const a=await createApertureApp({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}]});const s=a.stepAndExtract(0,0,0),r=new AssetRegistry(); const msg=structuredClone({sourceAssets:serializeSourceAssetRegistry(a.context.assetsRegistry),snapshot:s});console.log(mirrorSourceAssetRegistryFromMessage(r,msg));console.log("Mirrored actual meshes",r.list().filter(x=>x.asset?.kind==="mesh").length);console.log("Snapshot views",s.views.length,"draws",s.meshDraws.length);console.log("Shadow requests",JSON.stringify(s.shadowRequests));await a.dispose();
JS
```

Stdout:

```text
{ mirrored: 63, skipped: 0 }
Mirrored actual meshes 31
Snapshot views 1 draws 31
Shadow requests [{"shadowId":32,"lightId":32,"lightKind":"directional","cascadeCount":1,"casterLayerMask":-1,"receiverLayerMask":-1,"strength":0.7799999713897705,"filterRadius":2,"normalBias":0.03500000014901161,"mapSize":2048}]
```

Stderr:

```text

```

## Command 9ecfd3c3d455402b8889721cbb3dfbc4

2026-10-11T23:46:44.481582+00:00 → 2026-10-11T23:46:45.251865+00:00; exit 0; duration 0.770s.

Command:

```sh
node --input-type=module <<"JS"
import {MessageChannel} from "node:worker_threads";
import {createSimulationWorker} from "@aperture-engine/runtime";
import {startGeneratedSimulationWorker} from "@aperture-engine/app/worker";
import {createApertureDevtoolsRequest,createGeneratedCommandMessage} from "@aperture-engine/app/commands";
import Scene from "./src/scene.js";
const transport={postMessage(m){startGeneratedSimulationWorker({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}],port:m.port});},terminate(){}};
const w=createSimulationWorker(transport,{messageChannelFactory:()=>new MessageChannel()});
w.onError(e=>{console.error(e);process.exit(1);});
w.onMessage(m=>{console.log("message",m.type,m.ok,m.diagnostics);if(m.type==="aperture.simulation.ready")w.postMessage(createApertureDevtoolsRequest({requestId:"test",tool:"ecs_step",payload:{delta:0,time:0}}));});
w.onSnapshot(s=>{console.log("Snapshot received",s.frame,s.snapshot.meshDraws.length);process.exit(0);});
w.start({simulationPaused:true,entityCapacity:2048,transport:{mode:"transferable"}});
JS
```

Stdout:

```text
message aperture.simulation.ready undefined undefined
Snapshot received 0 31
```

Stderr:

```text

```

## Command 1e17f320dc1e4bf6a0ef84f0829245e8

2026-10-11T23:47:12.207432+00:00 → 2026-10-11T23:47:13.553723+00:00; exit 0; duration 1.346s.

Command:

```sh
python3 - <<"PY"
p="/work/src/scene.js"
s=open(p).read().replace("tube(\"frame\",[-1.99,1.80,6.31],[-1.42,1.8,6.31],.19,.19,12)","tube(\"frame\",[-1.99,1.80,6.50],[-1.42,1.8,6.50],.19,.19,12)")
# Insert subtle dimensional stucco chips, stone course joints, and physical roof end caps.
s=s.replace("// Porch lantern.","""// Shallow facade relief gives the plaster warm irregular highlights.
 for(let i=0;i<420;i++){let x=-3.92+rand()*7.84,y=.48+rand()*5.58;if(front.some(o=>Math.abs(x-o.x)<o.w/2+.06&&Math.abs(y-o.y)<o.h/2+.06))continue;box(i%3?\"stucco\":\"trim\",[x,y,3.354],[.022+rand()*.035,.017+rand()*.028,.006]);}
 // Porch lantern.""")
open(p,"w").write(s)
PY
node --input-type=module <<"JS"
import {createApertureApp} from "@aperture-engine/app/advanced";
import Scene from "./src/scene.js";
const a=await createApertureApp({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}]});const s=a.stepAndExtract(0,0,0);let verts=0,bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const e of a.context.assetsRegistry.list()){if(e.asset?.kind!=="mesh")continue;const stream=e.asset.vertexStreams[0],d=stream.data,stride=stream.arrayStride/4;verts+=stream.vertexCount;for(let i=0;i<stream.vertexCount;i++)for(let k=0;k<3;k++){const v=d[i*stride+k];bounds[k]=Math.min(bounds[k],v);bounds[k+3]=Math.max(bounds[k+3],v);}}console.log({vertices:verts,bounds,diagnostics:s.diagnostics});await a.dispose();
JS
```

Stdout:

```text
{
  vertices: 255177,
  bounds: [ -18, -0.44999998807907104, -18, 18, 9.649999618530273, 18 ],
  diagnostics: []
}
```

Stderr:

```text

```

## Command 0a6771259cac4b729266d260d83ed46b

2026-10-11T23:48:05.414748+00:00 → 2026-10-11T23:48:40.148213+00:00; exit 130; duration 34.733s.

Command:

```sh
python3 - <<"PY"
p="/work/src/scene.js"
s=open(p).read().replace("[.65,.25,.24],-t)","[.65,.25,.24],t)")
s=s.replace("tri(i%2?\"grass2\":\"grass\",[x,.09,z],[x+.025,.09+h,z],[x+.05,.09,z]);", "tri(i%2?\"grass2\":\"grass\",[x,.09,z],[x+.025,.09+h,z],[x+.05,.09,z]);tri(i%2?\"grass2\":\"grass\",[x+.05,.09,z],[x+.025,.09+h,z],[x,.09,z]);")
open(p,"w").write(s)
PY
node --input-type=module <<"JS"
import {MessageChannel} from "node:worker_threads";
import {createSimulationWorker} from "@aperture-engine/runtime";
import {startGeneratedSimulationWorker} from "@aperture-engine/app/worker";
import {createApertureDevtoolsRequest,createGeneratedCommandMessage} from "@aperture-engine/app/commands";
import Scene from "./src/scene.js";
const transport={postMessage(m){startGeneratedSimulationWorker({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}],port:m.port});},terminate(){}};
const w=createSimulationWorker(transport,{messageChannelFactory:()=>new MessageChannel()});let count=0;
w.onError(e=>{console.error(e);process.exit(1);});w.onMessage(m=>{if(m.type==="aperture.simulation.ready")w.postMessage(createApertureDevtoolsRequest({requestId:"test",tool:"ecs_step",payload:{delta:0,time:0}}));});
w.onSnapshot(s=>{console.log("Snapshot",s.frame,"meshes",s.snapshot.meshDraws.length,"camera generation",s.snapshot.views[0].camera.generation,"camera matrix",Array.from(s.snapshot.viewMatrices.slice(0,4)));if(++count===2)process.exit(0);w.postMessage(createGeneratedCommandMessage({channel:"bench.camera",payload:{position:[-12,7,16],target:[0,2.5,1],fovYDegrees:40,near:.1,far:200}}));w.postMessage(createApertureDevtoolsRequest({requestId:"test2",tool:"ecs_step",payload:{delta:.016,time:.016}}));});w.start({simulationPaused:true,entityCapacity:2048,transport:{mode:"transferable"}});
JS
```

Stdout:

```text
Snapshot 0 meshes 31 camera generation 0 camera matrix [ 0.7893521785736084, -0.1682964563369751, 0.590423047542572, 0 ]
```

Stderr:

```text

```

## Command 623b1305903c44c0a9d65758495ad1ac

2026-10-11T23:48:52.665456+00:00 → 2026-10-11T23:48:52.834800+00:00; exit 0; duration 0.169s.

Command:

```sh
grep -n "RateHz\|postMessageReasons\|maxRate\|snapshotMessage\|renderSnapshot" /sdk/source/app/src/worker/snapshot.ts /sdk/source/app/src/worker/snapshot*.ts | head -90; sed -n "1,160p" /sdk/source/app/src/worker/snapshot.ts; date -u
```

Stdout:

```text
/sdk/source/app/src/worker/snapshot.ts:4:  renderSnapshotTransferList,
/sdk/source/app/src/worker/snapshot.ts:44:  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
/sdk/source/app/src/worker/snapshot.ts:77:  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
/sdk/source/app/src/worker/snapshot.ts:178:        start["sharedSnapshotMessageRateHz"],
/sdk/source/app/src/worker/snapshot.ts:183:        start["audioSnapshotMessageRateHz"],
/sdk/source/app/src/worker/snapshot.ts:188:        start["sourceAssetsMessageRateHz"],
/sdk/source/app/src/worker/snapshot.ts:395:      renderSnapshotTransferList(snapshot),
/sdk/source/app/src/worker/snapshot.ts:405:    postMessageDecision.postMessageReasons.includes("sourceAssetsChanged")
/sdk/source/app/src/worker/snapshot.ts:414:    postMessageReasons: postMessageDecision.postMessageReasons,
/sdk/source/app/src/worker/snapshot.ts:604:      postMessageReasons: withSourceAssetReason(
/sdk/source/app/src/worker/snapshot.ts:616:      postMessageReasons: withSourceAssetReason(
/sdk/source/app/src/worker/snapshot.ts:628:      postMessageReasons: withSourceAssetReason(
/sdk/source/app/src/worker/snapshot.ts:640:      postMessageReasons: ["sourceAssetsChanged"],
/sdk/source/app/src/worker/snapshot.ts:648:    postMessageReasons: [],
/sdk/source/app/src/worker/snapshot.ts:733:  defaultRateHz: number,
/sdk/source/app/src/worker/snapshot.ts:735:  const rateHz = readGeneratedWorkerMessageRateHz(value, defaultRateHz);
/sdk/source/app/src/worker/snapshot.ts:740:function readGeneratedWorkerMessageRateHz(
/sdk/source/app/src/worker/snapshot.ts:742:  defaultRateHz: number,
/sdk/source/app/src/worker/snapshot.ts:745:    return defaultRateHz;
/sdk/source/app/src/worker/snapshot.ts:768:      ? normalizeGeneratedWorkerMessageRateHz(parsed, defaultRateHz)
/sdk/source/app/src/worker/snapshot.ts:769:      : defaultRateHz;
/sdk/source/app/src/worker/snapshot.ts:773:    return normalizeGeneratedWorkerMessageRateHz(value, defaultRateHz);
/sdk/source/app/src/worker/snapshot.ts:776:  return defaultRateHz;
/sdk/source/app/src/worker/snapshot.ts:779:function normalizeGeneratedWorkerMessageRateHz(
/sdk/source/app/src/worker/snapshot.ts:781:  defaultRateHz: number,
/sdk/source/app/src/worker/snapshot.ts:784:    return defaultRateHz;
/sdk/source/app/src/worker/snapshot.ts:4:  renderSnapshotTransferList,
/sdk/source/app/src/worker/snapshot.ts:44:  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
/sdk/source/app/src/worker/snapshot.ts:77:  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
/sdk/source/app/src/worker/snapshot.ts:178:        start["sharedSnapshotMessageRateHz"],
/sdk/source/app/src/worker/snapshot.ts:183:        start["audioSnapshotMessageRateHz"],
/sdk/source/app/src/worker/snapshot.ts:188:        start["sourceAssetsMessageRateHz"],
/sdk/source/app/src/worker/snapshot.ts:395:      renderSnapshotTransferList(snapshot),
/sdk/source/app/src/worker/snapshot.ts:405:    postMessageDecision.postMessageReasons.includes("sourceAssetsChanged")
/sdk/source/app/src/worker/snapshot.ts:414:    postMessageReasons: postMessageDecision.postMessageReasons,
/sdk/source/app/src/worker/snapshot.ts:604:      postMessageReasons: withSourceAssetReason(
/sdk/source/app/src/worker/snapshot.ts:616:      postMessageReasons: withSourceAssetReason(
/sdk/source/app/src/worker/snapshot.ts:628:      postMessageReasons: withSourceAssetReason(
/sdk/source/app/src/worker/snapshot.ts:640:      postMessageReasons: ["sourceAssetsChanged"],
/sdk/source/app/src/worker/snapshot.ts:648:    postMessageReasons: [],
/sdk/source/app/src/worker/snapshot.ts:733:  defaultRateHz: number,
/sdk/source/app/src/worker/snapshot.ts:735:  const rateHz = readGeneratedWorkerMessageRateHz(value, defaultRateHz);
/sdk/source/app/src/worker/snapshot.ts:740:function readGeneratedWorkerMessageRateHz(
/sdk/source/app/src/worker/snapshot.ts:742:  defaultRateHz: number,
/sdk/source/app/src/worker/snapshot.ts:745:    return defaultRateHz;
/sdk/source/app/src/worker/snapshot.ts:768:      ? normalizeGeneratedWorkerMessageRateHz(parsed, defaultRateHz)
/sdk/source/app/src/worker/snapshot.ts:769:      : defaultRateHz;
/sdk/source/app/src/worker/snapshot.ts:773:    return normalizeGeneratedWorkerMessageRateHz(value, defaultRateHz);
/sdk/source/app/src/worker/snapshot.ts:776:  return defaultRateHz;
/sdk/source/app/src/worker/snapshot.ts:779:function normalizeGeneratedWorkerMessageRateHz(
/sdk/source/app/src/worker/snapshot.ts:781:  defaultRateHz: number,
/sdk/source/app/src/worker/snapshot.ts:784:    return defaultRateHz;
import {
  SIMULATION_WORKER_PROTOCOL,
  createSharedSnapshotTransportViews,
  renderSnapshotTransferList,
  type SimulationMessagePort,
  type SharedSnapshotTransport,
  type SharedSnapshotTransportBuffers,
} from "@aperture-engine/runtime";
import {
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  type RenderSnapshot,
  type SnapshotPacketEncodingRegistry,
} from "@aperture-engine/render";
import {
  commitSerializedSourceAssets,
  serializeSourceAssetRegistry,
  type SerializedSourceAssetRegistry,
  type SourceAssetSerializationState,
} from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import {
  advanceGeneratedInputFrame,
  createInputSummary,
  drainGeneratedInputEventMessagesForFrame,
  type ApertureGeneratedInputEvent,
  type ApertureGeneratedInputEventMessage,
} from "../input.js";
import { createSignalSummary } from "../systems.js";
import type { ApertureApp } from "../advanced.js";
import { createAssetSummary } from "../devtools/assets.js";
import type { GeneratedEntityToolBridge } from "../devtools/entities.js";

export interface GeneratedWorkerSnapshotPublishReport {
  readonly nextFrame: number;
  readonly step: ReturnType<ApertureApp["step"]>;
  readonly timing: GeneratedWorkerSnapshotPublishTiming;
}

export interface GeneratedWorkerSnapshotPublishTiming {
  readonly frame: number;
  readonly transport: "shared-array-buffer" | "transferable";
  readonly postedMessage: GeneratedWorkerPostMessageKind;
  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
  readonly totalMilliseconds: number;
  readonly inputMilliseconds: number;
  readonly stepMilliseconds: number;
  readonly extractMilliseconds: number;
  readonly sourceAssetsMilliseconds: number;
  readonly summaryMilliseconds: number;
  readonly transportMilliseconds: number;
  readonly postMessageMilliseconds: number;
  readonly commitMilliseconds: number;
  readonly stepTiming: ReturnType<ApertureApp["step"]>["timing"];
}

export type GeneratedWorkerPostMessageKind =
  | "snapshot"
  | "audioSnapshot"
  | "sourceAssets"
  | "none"
  | "transferableSnapshot";

export type GeneratedWorkerPostMessageReason =
  | "sharedInitial"
  | "sharedRegistryChanged"
  | "sourceAssetsChanged"
  | "snapshotDiagnostics"
  | "fullSummary"
  | "sharedHeartbeat"
  | "sharedAudio"
  | "transferableSnapshot";

export interface GeneratedWorkerPostMessageDecision {
  readonly frame: number;
  readonly postedMessage: GeneratedWorkerPostMessageKind;
  readonly postMessageReasons: readonly GeneratedWorkerPostMessageReason[];
  readonly sourceAssetChanges?: {
    readonly count: number;
    readonly samples: readonly {
      readonly kind: string;
      readonly id: string;
      readonly label: string;
      readonly status: string;
      readonly version: number;
    }[];
  };
}

interface GeneratedWorkerSummaryOptions {
  readonly app: ApertureApp;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly frame: number;
  readonly time: number;
  readonly summaryCadence?: GeneratedWorkerSummaryCadence;
  readonly previousPublishTiming?: GeneratedWorkerSnapshotPublishTiming | null;
}

export type GeneratedWorkerSnapshotTransport =
  | {
      readonly mode: "transferable";
    }
  | {
      readonly mode: "shared-array-buffer";
      readonly shared: SharedSnapshotTransport;
      readonly registry: SnapshotPacketEncodingRegistry;
      readonly sharedSnapshotMessageIntervalMilliseconds: number | null;
      readonly audioSnapshotMessageIntervalMilliseconds: number | null;
      readonly sourceAssetsMessageIntervalMilliseconds: number | null;
      lastPostedMessageTimeMilliseconds: number | null;
      lastPostedAudioMessageTimeMilliseconds: number | null;
      lastPostedSourceAssetsMessageTimeMilliseconds: number | null;
      lastPostedRegistryHandles: number;
      lastPostedRegistryStrings: number;
    };

export interface GeneratedWorkerSummaryCadence {
  readonly intervalMilliseconds: number;
  shouldPublishFull(frame: number, timeSeconds: number): boolean;
}

export interface GeneratedWorkerSummaryCadenceOptions {
  readonly intervalMilliseconds?: number;
}

export const DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 500;
export const DEFAULT_GENERATED_WORKER_SHARED_SNAPSHOT_MESSAGE_RATE_HZ = 30;
export const DEFAULT_GENERATED_WORKER_AUDIO_SNAPSHOT_MESSAGE_RATE_HZ = 60;
export const DEFAULT_GENERATED_WORKER_SOURCE_ASSETS_MESSAGE_RATE_HZ = 15;
const MIN_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS = 16;
const MAX_GENERATED_WORKER_SIDE_BAND_MESSAGE_RATE_HZ = 240;

export function createGeneratedWorkerSummaryCadence(
  options: GeneratedWorkerSummaryCadenceOptions = {},
): GeneratedWorkerSummaryCadence {
  const intervalMilliseconds =
    normalizeGeneratedWorkerFullSummaryIntervalMilliseconds(
      options.intervalMilliseconds,
    );
  let lastFullSummaryTimeMilliseconds: number | null = null;

  return {
    intervalMilliseconds,
    shouldPublishFull(frame, timeSeconds) {
      const timeMilliseconds = Math.max(0, timeSeconds * 1000);

      if (
        frame === 0 ||
        lastFullSummaryTimeMilliseconds === null ||
        timeMilliseconds < lastFullSummaryTimeMilliseconds ||
        timeMilliseconds - lastFullSummaryTimeMilliseconds >=
          intervalMilliseconds
      ) {
        lastFullSummaryTimeMilliseconds = timeMilliseconds;
        return true;
      }

      return false;
    },
  };
Sun Oct 11 23:48:52 UTC 2026
```

Stderr:

```text

```

## Command 78b14da5bd02437487b285156636d5e0

2026-10-11T23:49:05.264132+00:00 → 2026-10-11T23:49:06.251547+00:00; exit 2; duration 0.987s.

Command:

```sh
node --input-type=module <<"JS"
import {MessageChannel} from "node:worker_threads";
import {createSimulationWorker} from "@aperture-engine/runtime";
import {startGeneratedSimulationWorker} from "@aperture-engine/app/worker";
import {createApertureDevtoolsRequest,createGeneratedCommandMessage} from "@aperture-engine/app/commands";
import Scene from "./src/scene.js";
const transport={postMessage(m){startGeneratedSimulationWorker({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}],port:m.port});},terminate(){}};
const w=createSimulationWorker(transport,{messageChannelFactory:()=>new MessageChannel()});let count=0;
w.onError(e=>{console.error(e);process.exit(1);});w.onMessage(m=>{console.log(JSON.stringify(m));if(m.type==="aperture.simulation.ready")w.postMessage(createApertureDevtoolsRequest({requestId:"test",tool:"ecs_step",payload:{delta:0,time:0}}));if(m.requestId==="test2"&&!m.ok)process.exit(2);});
w.onSnapshot(s=>{console.log("Snapshot",s.frame,"meshes",s.snapshot.meshDraws.length);if(++count===2)process.exit(0);w.postMessage(createGeneratedCommandMessage({channel:"bench.camera",payload:{position:[-12,7,16],target:[0,2.5,1],fovYDegrees:40,near:.1,far:200}}));w.postMessage(createApertureDevtoolsRequest({requestId:"test2",tool:"ecs_step",payload:{delta:.016,time:.016}}));});w.start({simulationPaused:true,entityCapacity:2048,transport:{mode:"transferable"}});
JS
```

Stdout:

```text
{"type":"aperture.simulation.ready"}
Snapshot 0 meshes 31
{"type":"aperture.devtools.response","version":1,"requestId":"test","ok":true,"result":{"paused":true,"frame":1,"time":{"delta":0,"elapsed":0,"frame":1},"fixedStep":{"enabled":false,"substeps":0,"fixedDelta":0,"fixedStepStart":0,"fixedStepEnd":0,"overstepAlpha":0,"consumedTime":0,"droppedTime":0,"clamped":false},"physics":{"backend":null,"sync":null,"step":null,"readback":null,"writeback":null,"unsupportedFeatureCount":0,"unsupportedFeatures":[],"eventCount":0,"eventKinds":{},"eventFamilies":{"contacts":0,"collisions":0,"triggers":0,"sleepWake":0,"contactForces":0,"controllerGroundedChanged":0,"jointBreaks":0},"events":[]}}}
{"type":"aperture.devtools.response","version":1,"requestId":"test2","ok":false,"diagnostics":[{"code":"aperture.system.lifecycleFailed","severity":"error","message":"System 'HouseScene' threw during update(): Cannot read properties of undefined (reading 'position') Suggested fix: Fix the exception raised in HouseScene.update(); the original stack is preserved below.","suggestedFix":"Fix the exception raised in HouseScene.update(); the original stack is preserved below.","data":{"system":"HouseScene","phase":"update"}}]}
```

Stderr:

```text

```

## Command 0ae434a19ecd460abeb2c417dac141b5

2026-10-11T23:49:22.209592+00:00 → 2026-10-11T23:49:26.171297+00:00; exit 0; duration 3.962s.

Command:

```sh
python3 - <<"PY"
p="/work/src/scene.js";s=open(p).read().replace("this.setView(command.payload)","this.setView(command)");open(p,"w").write(s)
PY
node --input-type=module <<"JS"
import {MessageChannel} from "node:worker_threads";
import {createSimulationWorker} from "@aperture-engine/runtime";
import {startGeneratedSimulationWorker} from "@aperture-engine/app/worker";
import {createApertureDevtoolsRequest,createGeneratedCommandMessage} from "@aperture-engine/app/commands";
import Scene from "./src/scene.js";
const transport={postMessage(m){startGeneratedSimulationWorker({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}],port:m.port});},terminate(){}};
const w=createSimulationWorker(transport,{messageChannelFactory:()=>new MessageChannel()});let count=0;
w.onError(e=>{console.error(e);process.exit(1);});w.onMessage(m=>{if(m.type==="aperture.simulation.ready")w.postMessage(createApertureDevtoolsRequest({requestId:"test",tool:"ecs_step",payload:{delta:0,time:0}}));if(m.ok===false){console.error(m);process.exit(2);}});
w.onSnapshot(s=>{console.log("Snapshot",s.frame,"meshes",s.snapshot.meshDraws.length,"camera generation",s.snapshot.views[0].camera.generation,"camera matrix",Array.from(s.snapshot.viewMatrices.slice(0,4)));if(++count===2)process.exit(0);w.postMessage(createGeneratedCommandMessage({channel:"bench.camera",payload:{position:[-12,7,16],target:[0,2.5,1],fovYDegrees:40,near:.1,far:200}}));w.postMessage(createApertureDevtoolsRequest({requestId:"test2",tool:"ecs_step",payload:{delta:.016,time:.016}}));});w.start({simulationPaused:true,entityCapacity:2048,transport:{mode:"transferable"}});
JS
pnpm run build
```

Stdout:

```text
Snapshot 0 meshes 31 camera generation 0 camera matrix [ 0.7893521785736084, -0.1682964563369751, 0.590423047542572, 0 ]
Snapshot 1 meshes 31 camera generation 1 camera matrix [ 0.7808688282966614, 0.14248405396938324, -0.6082287430763245, 0 ]

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 799 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.37 kB │ gzip:   0.28 kB
dist/assets/worker-xeO5vgEX.js    867.96 kB
dist/assets/dist-DLpo6GFp.js    2,261.38 kB
dist/assets/index-CS9T4HaB.js   1,390.89 kB │ gzip: 341.33 kB

✓ built in 1.42s
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Public preview 2 feedback

Status: error.

```text
{"schema":"aperture.agent-house-benchmark.v1","engine":"aperture","warmup":[],"samples":[],"views":[],"artifacts":[],"observations":{"submissions":0,"drawCalls":0,"submittedTriangles":0,"indirectDrawCalls":0,"nonTriangleDrawCalls":0,"unknownTopologyDrawCalls":0,"unknownCommandBuffers":0,"renderPasses":0,"computePasses":0,"buffersCreated":0,"buffersDestroyed":0,"requestedBufferBytes":0,"texturesCreated":0,"texturesDestroyed":0,"renderPipelinesCreated":0,"workerTerminationCalls":0,"lastSubmitAt":null,"workersCreated":1,"deviceCount":1,"canvasCount":1,"liveRequestedBufferBytes":0,"capturedUploadBytes":0,"submittedVertexBufferIds":[],"workerEvidence":[{"id":0,"url":"http://127.0.0.1:45433/assets/worker-lPRE9xvU.js","name":"","connected":true,"started":true,"terminated":false,"snapshotMessages":1,"snapshotPayloadObserved":true,"lastSnapshotFrame":0,"lastSnapshotAt":366.6650000009686,"errors":0,"sharedFrame":null,"sharedSequence":null}]},"nativeProof":{"native":true,"adapters":[{"vendor":"google","architecture":"swiftshader","device":"","description":""}],"devices":[{"adapter":{"vendor":"google","architecture":"swiftshader","device":"","description":""},"label":""}],"canvasWebGPU":1,"webglAttempts":0,"submissions":0,"draws":0,"errors":[],"deviceLost":[]},"error":{"message":"[{\"code\":\"aperture.system.lifecycleFailed\",\"severity\":\"error\",\"message\":\"System 'default' threw during update(): Cannot read properties of undefined (reading 'position') Suggested fix: Fix the exception raised in default.update(); the original stack is preserved below.\",\"suggestedFix\":\"Fix the exception raised in default.update(); the original stack is preserved below.\",\"data\":{\"system\":\"default\",\"phase\":\"update\"}}]","stack":"Error: [{\"code\":\"aperture.system.lifecycleFailed\",\"severity\":\"error\",\"message\":\"System 'default' threw during update(): Cannot read properties of undefined (reading 'position') Suggested fix: Fix the exception raised in default.update(); the original stack is preserved below.\",\"suggestedFix\":\"Fix the exception raised in default.update(); the original stack is preserved below.\",\"data\":{\"system\":\"default\",\"phase\":\"update\"}}]\n    at http://127.0.0.1:45433/assets/index-Dex1eLvX.js:5077:138055\n    at MessagePort.c (http://127.0.0.1:45433/assets/index-Dex1eLvX.js:3:82863)"}}
```

## Public note — 2026-10-11T23:49:36.722102+00:00

```
Actual preview diagnostic confirms the camera command payload exception found independently through the normal worker protocol. Fixed command draining to pass the payload directly. A two-step worker test now verifies changed camera matrices and generation with 31 extracted mesh draws. Requesting final allowed native preview.
```

## Preview 3

Status: timeout; recorder-measured coordinator wait: 300.071s.

## Public note — 2026-10-11T23:55:00.282526+00:00

```
Final allowed preview reached the fixed 300-second coordinator deadline without capture paths. No new runtime diagnostic was returned. Camera commands and normal worker snapshots now validate after the earlier fix. Reducing small vegetation tessellation to improve rendering cost while preserving the authored assemblies; final capture status remains unverified.
```

## Command 9d7e4c0859314c6b9ca57e18f61b8065

2026-10-11T23:55:00.599557+00:00 → 2026-10-11T23:55:03.161329+00:00; exit 0; duration 2.562s.

Command:

```sh
python3 - <<"PY"
p="/work/src/scene.js";s=open(p).read().replace("for(let i=0;i<11;i++){let a=rand()", "for(let i=0;i<9;i++){let a=rand()").replace("for(let i=0;i<67;i++){let a=rand()", "for(let i=0;i<48;i++){let a=rand()").replace("],7,4)","],6,3)");open(p,"w").write(s)
PY
node --input-type=module <<"JS"
import {createApertureApp} from "@aperture-engine/app/advanced";
import Scene from "./src/scene.js";
const a=await createApertureApp({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}]});const s=a.stepAndExtract(0,0,0);const ms=a.context.assetsRegistry.list().filter(e=>e.asset?.kind==="mesh");console.log({meshes:ms.length,vertices:ms.reduce((n,e)=>n+e.asset.vertexStreams[0].vertexCount,0),triangles:ms.reduce((n,e)=>n+e.asset.vertexStreams[0].vertexCount/3,0),diagnostics:s.diagnostics});await a.dispose();
JS
pnpm run build
```

Stdout:

```text
{ meshes: 31, vertices: 212121, triangles: 70707, diagnostics: [] }

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 799 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.37 kB │ gzip:   0.28 kB
dist/assets/worker-XZEP6Uzi.js    867.96 kB
dist/assets/dist-CsQo9LfB.js    2,261.38 kB
dist/assets/index-DNzHdKtD.js   1,390.89 kB │ gzip: 341.33 kB

✓ built in 887ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command 284b338de9824106a242f7f42ac5a394

2026-10-11T23:56:12.330151+00:00 → 2026-10-11T23:56:14.861650+00:00; exit 0; duration 2.532s.

Command:

```sh
python3 - <<"PY"
p="/work/src/scene.js";s=open(p).read()
s=s.replace("asphalt:[.115,.13,.145]", "asphalt:[.115,.13,.145],aggregate:[.19,.19,.18]")
s=s.replace("box(i%3?\"asphalt\":\"mortar\",p,[.018+rand()*.03,.006,.018+rand()*.03]);", "const w=.008+rand()*.028,d=.008+rand()*.028;quad(i%3?\"asphalt\":\"aggregate\",[p[0]-w,p[1],p[2]-d],[p[0]-w,p[1],p[2]+d],[p[0]+w,p[1],p[2]+d],[p[0]+w,p[1],p[2]-d]);")
s=s.replace("mapSize:2048,cascadeCount:1", "mapSize:1024,cascadeCount:1").replace("strength:.78,filterRadius:2", "strength:.78,filterRadius:1")
open(p,"w").write(s)
PY
pnpm run build
node --input-type=module <<"JS"
import {createApertureApp} from "@aperture-engine/app/advanced";
import Scene from "./src/scene.js";
const a=await createApertureApp({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}]});const s=a.stepAndExtract(0,0,0);const ms=a.context.assetsRegistry.list().filter(e=>e.asset?.kind==="mesh");let degenerate=0;for(const e of ms){const d=e.asset.vertexStreams[0].data;for(let i=0;i<d.length;i+=24){const a=[d[i],d[i+1],d[i+2]],b=[d[i+8],d[i+9],d[i+10]],c=[d[i+16],d[i+17],d[i+18]],u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-10)degenerate++;}}console.log({meshes:ms.length,vertices:ms.reduce((n,e)=>n+e.asset.vertexStreams[0].vertexCount,0),triangles:ms.reduce((n,e)=>n+e.asset.vertexStreams[0].vertexCount/3,0),degenerate,diagnostics:s.diagnostics,shadowRequests:s.shadowRequests.length});await a.dispose();
JS
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 799 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.37 kB │ gzip:   0.28 kB
dist/assets/worker-WfcDpOH-.js    868.07 kB
dist/assets/dist-CPNsSphI.js    2,261.38 kB
dist/assets/index-DirLc4-a.js   1,390.89 kB │ gzip: 341.33 kB

✓ built in 898ms
{
  meshes: 32,
  vertices: 161121,
  triangles: 53707,
  degenerate: 0,
  diagnostics: [],
  shadowRequests: 1
}
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command b0f485ea8dbe44a58504b82413b5d011

2026-10-11T23:56:36.623789+00:00 → 2026-10-11T23:56:38.998799+00:00; exit 0; duration 2.375s.

Command:

```sh
python3 - <<"PY"
p="/work/src/scene.js";s=open(p).read().replace("castShadow:name!==\"asphalt\"&&name!==\"grass\"", "castShadow:name!==\"asphalt\"&&name!==\"aggregate\"&&name!==\"grass\"");open(p,"w").write(s)
PY
pnpm exec prettier --write src/main.js src/scene.js src/worker.js src/config.js vite.config.js index.html
pnpm run build
```

Stdout:

```text
src/main.js 72ms
src/scene.js 200ms
src/worker.js 2ms
src/config.js 3ms
vite.config.js 4ms
index.html 58ms

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 799 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.53 kB │ gzip:   0.31 kB
dist/assets/worker-CxOWK8Tz.js    868.09 kB
dist/assets/dist-CBxSVNkv.js    2,261.38 kB
dist/assets/index-t7eMSa6O.js   1,390.89 kB │ gzip: 341.33 kB

✓ built in 822ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command 2c49c165e68b49048040e92e30dc0851

2026-10-11T23:57:28.434534+00:00 → 2026-10-11T23:57:31.573113+00:00; exit 0; duration 3.139s.

Command:

```sh
python3 - <<"PY"
p="/work/src/main.js";s=open(p).read();s=s.replace("const pending = new Map();", "const pending = new Map();\nconst meshWorldMatrices = new Map();")
s=s.replace("latest = event.snapshot;", "latest = event.snapshot;\n  for (const draw of [...latest.meshDraws, ...(latest.shadowCasterDraws ?? [])]) {\n    meshWorldMatrices.set(draw.mesh.id, latest.transforms.slice(draw.worldTransformOffset, draw.worldTransformOffset + 16));\n  }")
s=s.replace("worldMatrix: I,", "worldMatrix: meshWorldMatrices.get(entry.handle.id),")
s=s.replace("const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);", "")
open(p,"w").write(s)
PY
pnpm exec prettier --write src/main.js
node --input-type=module <<"JS"
import {createApertureApp} from "@aperture-engine/app/advanced";
import Scene from "./src/scene.js";
const a=await createApertureApp({config:{mode:"headless",render:{defaultEnvironment:true}},systems:[{default:Scene}]});const s=a.stepAndExtract(0,0,0);const ids=new Map([...s.meshDraws,...s.shadowCasterDraws].map(d=>[d.mesh.id,Array.from(s.transforms.slice(d.worldTransformOffset,d.worldTransformOffset+16))]));const ms=a.context.assetsRegistry.list().filter(e=>e.asset?.kind==="mesh");console.log({meshes:ms.length,observedTransforms:ids.size,missingTransforms:ms.filter(e=>!ids.has(e.handle.id)).map(e=>e.handle.id),sampleWorldMatrix:ids.values().next().value});await a.dispose();
JS
pnpm run build
```

Stdout:

```text
src/main.js 86ms
{
  meshes: 32,
  observedTransforms: 32,
  missingTransforms: [],
  sampleWorldMatrix: [
    1, 0, 0, 0, 0, 1,
    0, 0, 0, 0, 1, 0,
    0, 0, 0, 1
  ]
}

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 799 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.53 kB │ gzip:   0.31 kB
dist/assets/worker-CxOWK8Tz.js    868.09 kB
dist/assets/dist-CBxSVNkv.js    2,261.38 kB
dist/assets/index-B55jFJiQ.js   1,391.01 kB │ gzip: 341.37 kB

✓ built in 972ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Public note — 2026-10-11T23:57:55.721212+00:00

```
Completed source in /work/src/scene.js, /work/src/main.js, /work/src/worker.js and /work/src/config.js; final Vite build is /work/dist. The authored scene contains ivory stucco walls with actual openings and inset dark-framed windows, barrel-tiled gable and porch roofs, chimney, two-post porch and paneled door, block stone boundaries and paving, planted shrubs and branched trees, mailbox, curved asphalt road with segmented curbs and broken white markings, and a blue hatchback with contoured body, glazing, four alloy wheels, lights and trim. Rendering uses the SDK native WebGPU renderer with ACES, exposure 1, 4x MSAA, warm shadow sun, ambient fill and the normal simulation worker/ECS/extraction boundary. No animation loop is registered. inspectGeometry reads actual mirrored mesh buffers and world matrices extracted by the worker. Final headless validation: 32 meshes, 161121 vertices, 53707 triangles, zero degeneracies, no extraction diagnostics, and all 32 transforms observed. Build passes. All author command process groups have ended; no dev server or browser was launched by the author. Captured limitations: the first two preview attempts failed on a camera payload exception, which was fixed and verified through two real worker snapshots; the third and final preview reached the fixed 300-second coordinator deadline without images, and its feedback remained unavailable. Final visual appearance is unverified. Foliage is deliberately faceted and distant mountains are omitted. Small aggregate and foliage geometry and shadow map cost were reduced after the timed-out preview.
```

