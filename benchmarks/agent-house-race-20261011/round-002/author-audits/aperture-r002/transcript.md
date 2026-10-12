# Public operational transcript

Lane `aperture-r002` (aperture). Raw wall time 1198.240s; preview waiting 120.286s; active budget time 1077.954s.

24 commands, 0 unsuccessful exits, 0 identical-command retries after failure.

This contains public tool operations only. Exact binary stdout/stderr survives beside each command record; text below decodes UTF-8 with non-UTF-8 bytes escaped and makes no inference about private model reasoning.

## Command f407e3dc91a044cf8fe6a656cf350b6d

2026-10-12T02:23:44.239241+00:00 → 2026-10-12T02:23:44.357131+00:00; exit 0; duration 0.118s.

Command:

```sh
cat /reference/prompt.txt
```

Stdout:

````text
Assigned engine: Aperture, current working-tree SDK snapshot. Dependencies are preinstalled from /sdk/packages. Public docs and package sources are read-only at /sdk/docs, /sdk/docs-site-src and /sdk/source. CLI is installed. Follow the normal simulation worker, ECS, extraction snapshot and main-thread WebGPU design. Do not bypass this with a main-thread authoritative scene or another renderer.

Build a polished, moderately detailed, genuinely three-dimensional scene matching the supplied reference image. Author the house exterior with ivory stucco, terracotta tiled gable roof and chimney, dark framed inset windows, covered front porch with two posts and a door, stone path, low stone garden boundary, shrubs/trees, mailbox, curved asphalt road across the foreground and right side with curbs and broken white markings, and a blue hatchback with four wheels, body contour, glass windows, lights and trim. The distant landscape is optional. Match the warm daylight and composition. Details should remain convincing from other views. Geometry, materials, procedural textures, instancing and batching are allowed. Do not use the reference image as a texture, background or billboard; do not bake the scene into a picture. No external ready-made house/car scene or image-generation tool. You may use public assigned-engine docs and inspect its installed source.

Use only your assigned engine's actual native WebGPU renderer, with no WebGL fallback or third-party renderer. Use the common interface below. Do not alter native APIs, fake measurements or introduce timing delays. Real submitted geometry must be returned by inspectGeometry. Every visible mesh and instance must be represented. Use deterministic scene generation. If you use procedural randomness, use a fixed seed; fresh browser instances must reproduce the same geometry. Do not add an animation loop after registration. Supply a buildable Vite application with `pnpm run build` producing /work/dist.

You have 1800 seconds of active authoring budget, beginning when you call start. Dependency installation has already been completed. The recorder separately retains raw wall time and renderer waiting time. You may request at most three previews using the recorder; the coordinator returns only your own canvas views or actual runtime errors, without implementation advice. Preview waiting is credited equally. Each preview freezes your existing /work/dist at request time, then queues that exact build. Build before requesting a preview. Previews contain three short diagnostic frames and the same three fixed camera views; full scoring uses separate final-build trials. A preview wait deadline can expire while the coordinator is still working. Use feedback with that preview number to retrieve its existing response; this spends no additional preview. Runtime error text is returned inline with its full artifact hash. When finished, stop all application processes, build the final app, record a public note describing your implementation and any limitations, and call finish. After finish, make no edits.

Isolation and operational transcript rules: You start with no inherited chat. Do not contact other agents, use collaboration tools, inspect other workspaces, history, root repository, benchmark results, private provider/session data, or environment credentials. All searches, reads, shell commands and edits MUST run through the exact recorder command below. It invokes your command inside your assigned container at /work. Do not call apply_patch or unrecorded host exec commands. Use ordinary Python/Node/heredocs inside that recorded command to edit files. You can inspect the supplied image and returned preview PNGs with view_image; log each image inspection with recorder note. Do not dump the process environment or access secrets. Tools are routed cooperatively; the command container enforces filesystem separation. No browser launches, dev servers left running, Playwright installs, sandbox/flag changes or alternate rendering routes. Preview is the available browser tool.

The only host command entrypoint is:
`python3 -B /workspace/aperture/tools/agent-benchmark/author-lane.py aperture-r002 ACTION [TEXT]`
Actions: start; note PUBLIC_TEXT; exec SHELL_SCRIPT; preview; feedback PREVIEW_NUMBER; finish. Quote each shell script as one argument. This records the exact script, stdout, stderr, timestamps and exit status. A command process group is stopped at command end, so a background server cannot persist between commands. You should use functions.exec -> tools.exec_command only with this entrypoint (including no extra shell operations). Capture all failures and retries. The prompt/reference hashes and source hashes are recorded. These are visible operational records, never private reasoning.

Reference image for view_image: /workspace/aperture/.aperture-env/agent-house-race/lanes/round-002/aperture/public/reference.png
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

## Public note — 2026-10-12T02:23:51.170930+00:00

```
Inspecting the assigned reference image to plan scene geometry, materials and composition.
```

## Command 7d77bf5c0809437ab2ffba256aba377f

2026-10-12T02:23:57.585122+00:00 → 2026-10-12T02:23:57.703130+00:00; exit 0; duration 0.118s.

Command:

```sh
pwd; rg --files /work /sdk/docs | head -100
```

Stdout:

```text
/work
```

Stderr:

```text
/bin/sh: 1: rg: not found
```

## Command f20e63de52b94443bd54d76d44da4a0e

2026-10-12T02:24:04.810117+00:00 → 2026-10-12T02:24:04.978484+00:00; exit 0; duration 0.168s.

Command:

```sh
ls -la /work; find /sdk/docs -maxdepth 3 -type f | head -70; ls /sdk/packages
```

Stdout:

```text
total 80
drwx------  4 node node  4096 Oct 12 02:18 .
drwxr-xr-x 20 root root  4096 Oct 12 02:18 ..
-rw-------  1 node node    35 Oct 12 02:18 .npmrc
-rw-------  1 node node   171 Oct 12 02:18 index.html
drwxr-xr-x  5 root root  4096 Oct 12 02:18 node_modules
-rw-------  1 node node  2852 Oct 12 02:18 package.json
-rw-r--r--  1 root root 53177 Oct 12 02:18 pnpm-lock.yaml
drwx------  2 node node  4096 Oct 12 02:18 src
/sdk/docs/BROWSER_FRAME_CONTROL.md
/sdk/docs/AGENT_AUTHORING_BASELINE.md
/sdk/docs/MIXED_SHADOWS.md
/sdk/docs/VISUAL_QUALITY.md
/sdk/docs/AI_TOOLING.md
/sdk/docs/AUTHORING.md
/sdk/docs/DECISIONS.md
/sdk/docs/ARCHITECTURE.md
aperture-engine-app-0.3.0.tgz
aperture-engine-audio-0.3.0.tgz
aperture-engine-cli-0.3.0.tgz
aperture-engine-math-0.3.0.tgz
aperture-engine-particles-0.3.0.tgz
aperture-engine-physics-0.3.0.tgz
aperture-engine-physics-rapier-0.3.0.tgz
aperture-engine-reference-assets-0.3.0.tgz
aperture-engine-render-0.3.0.tgz
aperture-engine-runtime-0.3.0.tgz
aperture-engine-simulation-0.3.0.tgz
aperture-engine-ui-0.3.0.tgz
aperture-engine-vite-plugin-0.3.0.tgz
aperture-engine-webgpu-0.3.0.tgz
```

Stderr:

```text

```

## Command 16dd5d935b364e25bd41495814089f7f

2026-10-12T02:24:10.787744+00:00 → 2026-10-12T02:24:10.955754+00:00; exit 0; duration 0.168s.

Command:

```sh
cat /sdk/docs/BROWSER_FRAME_CONTROL.md /sdk/docs/AGENT_AUTHORING_BASELINE.md /sdk/docs/AUTHORING.md; cat /work/package.json; find /work/src -type f
```

Stdout:

````text
# Browser frame control

`startGeneratedBrowserApp` wires the simulation worker, source asset mirror,
WebGPU renderer and browser input. Its returned app exposes semantic requests,
readiness, frame inspection and disposal. A manual cadence supports editors,
embeddings, deterministic playback and application-controlled rendering.

```ts
import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import config from "./aperture.config.js";

const app = await startGeneratedBrowserApp({
  config: {
    ...config,
    render: { ...config.render, cadence: "manual" },
  },
  workerEntry: new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  }),
});

await app.ready;
await app.request("camera_look_at", {
  key: "camera.main",
  translation: [8, 4, 12],
  lookAt: [0, 1, 0],
});
const frame = await app.renderFrame({ deltaSeconds: 0, timeSeconds: 0 });
console.log(frame.snapshotFrame, frame.report.counts);
console.log(app.inspectRenderedFrame());
await app.dispose();
```

The worker entry uses the normal `startGeneratedSimulationWorker` bootstrap and
ECS-authored systems. Simulation and scene state remain in that worker; the main
thread receives extracted snapshots and mirrored source assets.

`ready` resolves after GPU and worker initialization. Configured asynchronous
assets may still be loading; `request("asset_list")` reports their current state.
Initialization failures reject readiness with diagnostics. Requests made through
the returned app await readiness.

The typed `request` method supports entity queries/lookups, asset listing, camera
inspection/pose edits and pause. It returns the tool's typed result and rejects
failed semantic operations with `ApertureBrowserControlError.diagnostics`.
`requestRaw` exposes other existing semantic tools through their normal
`{ ok, result, diagnostics }` response. Both use the same worker bridge as managed
MCP tooling. Requests default to a 10-second deadline, support an `AbortSignal`
and `timeoutMilliseconds`, and have a bounded pending queue.

Manual cadence starts paused and submits no initial frame. Input and resize
events update queued state without advancing its clock. `renderFrame` advances
one worker step, extracts its actual frame, mirrors the corresponding assets and
submits that frame through native WebGPU. Its Promise resolves after submission;
GPU queue completion is a separate operation owned by the caller. The returned
report is detached JSON data using the existing renderer report type.

`deltaSeconds` defaults to zero. Delta and optional time must be finite and
non-negative. Concurrent frame calls are serialized through submission, with a
bounded queue. A frame cannot be fulfilled by an initial, duplicate, unrelated
or stale snapshot. Shared frames verify the published sequence as well as the
frame number, so a later refresh at the same frame cannot silently replace the
requested data. Controlled frames send source-asset deltas against successfully
mirrored producer versions: the first frame receives current assets, unchanged
assets send no payload, and missed updates are resent. Changed mesh entries use
complete payloads so a skipped patch base cannot corrupt geometry.
Transferable and shared-buffer transports retain the same
worker/extraction boundary. A missing frame, worker failure, aborted request or
render failure rejects with its diagnostic rather than appearing successful.

Manual cadence owns the worker clock: public `requestRaw` and managed MCP reject
`ecs_step`, `ecs_step_and_diff` and `ecs_resume` with guidance to use `renderFrame`.
The exposed `worker` handle remains an advanced transport escape hatch; do not
mix direct clock messages with manual frame control. Continuous and demand
cadences keep their existing automatic behavior.

`inspectRenderedFrame` returns detached existing snapshot inspection data for
the last submitted frame, or `null` before a frame. It reports actual packet
counts, referenced asset handles and diagnostics. It exposes neither a mutable
asset registry nor shared snapshot buffers.

`dispose` is idempotent. It rejects pending requests and frames, removes browser
listeners and resize observers, stops diagnostics/audio, terminates the worker
and releases renderer feature resources plus all app-owned GPU buffers,
textures and query sets. Rendering and picking already in progress drain before
those resources are released. Borrowed source assets, caller-created GPU objects
and the public device remain with their owners. Every cleanup is attempted even
when a feature disposer or resource destruction fails; disposal then rejects
with the collected errors. New rendering, picking, start and registration calls
are rejected once disposal begins, without introducing a GPU queue fence.

Vite's `virtual:aperture/browser-entry` exports `appPromise` for integrations that
consume the generated bootstrap. After awaiting that Promise, await `app.ready`
before using semantic tools or requesting manual frames.
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

Numeric material colors use linear RGB. For CSS palette colors, use
`color.srgbHex` or pass a hex string directly to the material factory:

```ts
import { color, material } from "@aperture-engine/app/systems";

const opaque = material.standard({ baseColor: "#808080" });
const rgba = material.standard({ baseColor: color.srgbHex("#80808080") });
const linear = material.standard({ baseColor: color.linear(0.5, 0.25, 0.125) });
```

The supported forms are `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, in either
case. Their RGB channels are converted to linear values; alpha is unchanged and
RGB remains unpremultiplied. Both color helpers return typed `Vec4` values.
`material.unlit` accepts the same inputs. Numeric descriptors and low-level
materials retain their existing linear semantics; only explicit hex input is
decoded. For typed factory options use `StandardMaterialInputOptions` or
`UnlitMaterialInputOptions`; returned descriptor options remain numeric.

Texture color spaces are declared independently of material constants:

```ts
asset.texture("/assets/base-color.png", {
  colorSpace: "srgb",
  semantic: "base-color",
});
asset.texture("/assets/normal.png", { colorSpace: "data", semantic: "normal" });
```

See [Visual Quality](VISUAL_QUALITY.md) for the complete lighting and color recipe.

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
- `mesh.roundedBox({ halfExtents?, radius?, bevelSegments?, label? })`
- `mesh.sphere({ radius, segments? })`
- `mesh.capsule({ radius, depth, segments? })`
- `mesh.plane({ size, subdivisions? })`
- `mesh.cylinder({ radius, depth, segments? })`
- `mesh.cone({ radius, depth, segments? })`

### Rounded boxes

Use `mesh.roundedBox` for a single closed part that needs softened edges. Its
`halfExtents` are half-width, half-height and half-depth, so `[1, 0.5, 0.25]`
produces a part measuring `2 × 1 × 0.5` before its ECS transform. The geometry
has indexed triangles, circular edge bevels, spherical corners, supplied smooth
normals and independent face UVs:

```ts
this.spawn.mesh({
  key: "part.rounded",
  mesh: mesh.roundedBox({
    halfExtents: [1, 0.5, 0.25],
    radius: 0.1,
    bevelSegments: 3,
  }),
  material: material.standard({ baseColor: "#808080", roughness: 0.6 }),
  castShadow: true,
  receiveShadow: true,
});
```

Defaults are `halfExtents: [0.5, 0.5, 0.5]`, radius 10% of the smallest
half-extent, and `bevelSegments: 3`. Extents must be positive and finite; radius
must be finite, nonnegative and no larger than the smallest half-extent. A fully
rounded axis is supported. `bevelSegments` must be an integer from 1 through 32;
it subdivides each half of an edge bevel. Increasing it improves the silhouette
without changing the one-submesh layout. Radius zero returns the existing flat
box geometry, including its face normals and UVs.

Parameters are checked when creating the descriptor, and float32 triangle
collapse is checked before publishing assets or spawning an entity. For tiny
bevels on very large local coordinates, increase radius relative to the extents,
reduce segments, or use a smaller local mesh with a transform. Reuse explicit
mesh/material handles for repeated parts rather than republishing identical
geometry. The same factory and options are exposed as `createRoundedBoxMeshAsset`
and `RoundedBoxMeshOptions` from `@aperture-engine/render`; the facade exports
`RoundedBoxMeshDescriptorOptions`.

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
/work/src/main.js
````

Stderr:

```text

```

## Command 16286228bf6f4f43b534bf40217b36b3

2026-10-12T02:24:16.350936+00:00 → 2026-10-12T02:24:16.469381+00:00; exit 0; duration 0.118s.

Command:

```sh
cat src/main.js; sed -n "150,470p" /sdk/docs/AUTHORING.md; cat /sdk/docs/VISUAL_QUALITY.md; find /sdk/source -maxdepth 3 -type f | head -50
```

Stdout:

````text
// Build the assigned scene and register the benchmark adapter here.
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

Numeric material colors use linear RGB. For CSS palette colors, use
`color.srgbHex` or pass a hex string directly to the material factory:

```ts
import { color, material } from "@aperture-engine/app/systems";

const opaque = material.standard({ baseColor: "#808080" });
const rgba = material.standard({ baseColor: color.srgbHex("#80808080") });
const linear = material.standard({ baseColor: color.linear(0.5, 0.25, 0.125) });
```

The supported forms are `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, in either
case. Their RGB channels are converted to linear values; alpha is unchanged and
RGB remains unpremultiplied. Both color helpers return typed `Vec4` values.
`material.unlit` accepts the same inputs. Numeric descriptors and low-level
materials retain their existing linear semantics; only explicit hex input is
decoded. For typed factory options use `StandardMaterialInputOptions` or
`UnlitMaterialInputOptions`; returned descriptor options remain numeric.

Texture color spaces are declared independently of material constants:

```ts
asset.texture("/assets/base-color.png", {
  colorSpace: "srgb",
  semantic: "base-color",
});
asset.texture("/assets/normal.png", { colorSpace: "data", semantic: "normal" });
```

See [Visual Quality](VISUAL_QUALITY.md) for the complete lighting and color recipe.

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

Material numeric colors are **linear RGB**. CSS hex palette colors are sRGB:
`color.srgbHex` decodes their RGB channels with the standard sRGB transfer,
while alpha remains straight opacity. Short and long RGB/RGBA hex forms work;
the material factories also accept them directly:

```ts
import { color, material } from "@aperture-engine/app/systems";

material.standard({ baseColor: "#808080" });
material.standard({ baseColor: color.srgbHex("#80808080") });
material.unlit({ baseColor: color.linear(0.5, 0.25, 0.125, 0.5) });
```

Hex strings are converted once at descriptor creation, before render assets are
created. Numeric arrays and `color.linear(r, g, b, a?)` keep their linear meaning;
the helper permits finite HDR values, defaults alpha to 1 and applies no gamma,
clamping or premultiplication. The existing numeric `hexColor(0x...)` retains its
raw normalized-channel behavior for compatibility. Material defaults, lighting,
exposure and low-level numeric render contracts remain the same.

Image declarations use explicit texture color spaces: base-color/emissive images
use `colorSpace: "srgb"`, while normal, roughness and other data maps use
`colorSpace: "data"` or `"linear"` according to their source. glTF texture semantics
continue to follow the glTF contract. Do not manually gamma-decode texture pixels
already tagged as sRGB.

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
/sdk/source/physics/src/collider-scale.ts
/sdk/source/physics/src/testing.ts
/sdk/source/physics/src/ecs-sync.ts
/sdk/source/physics/src/math.ts
/sdk/source/physics/src/benchmark.ts
/sdk/source/physics/src/worker-protocol.ts
/sdk/source/physics/src/collider-geometry.ts
/sdk/source/physics/src/backend.ts
/sdk/source/physics/src/fixed-step.ts
/sdk/source/physics/src/components.ts
/sdk/source/physics/src/validation.ts
/sdk/source/physics/src/index.ts
/sdk/source/physics/src/stable-order.ts
/sdk/source/physics/src/worker-transfer.ts
/sdk/source/physics/README.md
/sdk/source/physics/tsconfig.json
/sdk/source/physics/CHANGELOG.md
/sdk/source/physics/LICENSE
/sdk/source/physics/package.json
/sdk/source/physics/dist/worker-protocol.js.map
/sdk/source/physics/dist/collider-scale.js.map
/sdk/source/physics/dist/worker-protocol.d.ts.map
/sdk/source/physics/dist/components.d.ts.map
/sdk/source/physics/dist/index.js.map
/sdk/source/physics/dist/ecs-sync.js
/sdk/source/physics/dist/validation.d.ts.map
/sdk/source/physics/dist/index.js
/sdk/source/physics/dist/collider-geometry.js
/sdk/source/physics/dist/testing.js.map
/sdk/source/physics/dist/validation.js.map
/sdk/source/physics/dist/benchmark.d.ts.map
/sdk/source/physics/dist/stable-order.js
/sdk/source/physics/dist/components.js.map
/sdk/source/physics/dist/math.d.ts.map
/sdk/source/physics/dist/fixed-step.js
/sdk/source/physics/dist/stable-order.d.ts
/sdk/source/physics/dist/index.d.ts
/sdk/source/physics/dist/components.d.ts
/sdk/source/physics/dist/worker-transfer.d.ts.map
/sdk/source/physics/dist/worker-transfer.d.ts
/sdk/source/physics/dist/backend.d.ts
/sdk/source/physics/dist/validation.js
/sdk/source/physics/dist/index.d.ts.map
/sdk/source/physics/dist/math.js.map
/sdk/source/physics/dist/ecs-sync.js.map
/sdk/source/physics/dist/components.js
/sdk/source/physics/dist/validation.d.ts
/sdk/source/physics/dist/worker-protocol.d.ts
/sdk/source/physics/dist/collider-geometry.js.map
/sdk/source/physics/dist/worker-transfer.js
````

Stderr:

```text

```

## Command b4c2c2847b9c42c7b2ab930095eaf6a8

2026-10-12T02:24:28.132861+00:00 → 2026-10-12T02:24:28.301395+00:00; exit 0; duration 0.169s.

Command:

```sh
find /sdk/source/app/src -maxdepth 3 -type f | head -100; grep -R -n "inspectRenderedFrame\|startGeneratedSimulationWorker\|camera_look_at\|render_bundle" /sdk/source/app/src | head -65; cat /work/index.html
```

Stdout:

```text
/sdk/source/app/src/input.ts
/sdk/source/app/src/physics-interpolation.ts
/sdk/source/app/src/entities/lookup/summary.ts
/sdk/source/app/src/entities/lookup/types.ts
/sdk/source/app/src/entities/lookup/mutation.ts
/sdk/source/app/src/entities/lookup/snapshot.ts
/sdk/source/app/src/entities/lookup/hierarchy.ts
/sdk/source/app/src/entities/lookup/query.ts
/sdk/source/app/src/entities/lookup/index.ts
/sdk/source/app/src/entities/lookup/resolve.ts
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
/sdk/source/app/src/systems/color.ts
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
/sdk/source/app/src/systems/spawn/rounded-box.ts
/sdk/source/app/src/systems/spawn/descriptors.ts
/sdk/source/app/src/systems/context.ts
/sdk/source/app/src/systems/diagnostics.ts
/sdk/source/app/src/systems/start-options.ts
/sdk/source/app/src/internal/app-lifecycle.ts
/sdk/source/app/src/internal/bootstrap-safety.ts
/sdk/source/app/src/internal/json-safe.ts
/sdk/source/app/src/internal/diagnostic-error.ts
/sdk/source/app/src/advanced.ts
/sdk/source/app/src/entity-lookup.ts
/sdk/source/app/src/headless-tools.ts
/sdk/source/app/src/devtools/payload.ts
/sdk/source/app/src/devtools/input.ts
/sdk/source/app/src/devtools/types.ts
/sdk/source/app/src/devtools/camera-framing.ts
/sdk/source/app/src/devtools/entities.ts
/sdk/source/app/src/devtools/assets.ts
/sdk/source/app/src/devtools/camera.ts
/sdk/source/app/src/browser/control.ts
/sdk/source/app/src/browser/input.ts
/sdk/source/app/src/browser/signals.ts
/sdk/source/app/src/browser/canvas.ts
/sdk/source/app/src/browser/devtools/dispatch.ts
/sdk/source/app/src/browser/devtools/picking.ts
/sdk/source/app/src/browser/devtools/runtime.ts
/sdk/source/app/src/browser/devtools/types.ts
/sdk/source/app/src/browser/devtools/payloads.ts
/sdk/source/app/src/browser/devtools/canvas-readback.ts
/sdk/source/app/src/browser/devtools/index.ts
/sdk/source/app/src/browser/devtools/webgpu-diagnostics.ts
/sdk/source/app/src/browser/render.ts
/sdk/source/app/src/browser/html-bridge.ts
/sdk/source/app/src/browser/status.ts
/sdk/source/app/src/browser/commands.ts
/sdk/source/app/src/browser/assets.ts
/sdk/source/app/src/browser/request.ts
/sdk/source/app/src/browser/audio.ts
/sdk/source/app/src/browser/gpu-timings-route.ts
/sdk/source/app/src/browser/app.ts
/sdk/source/app/src/browser/frame-graph-route.ts
/sdk/source/app/src/browser/diagnostics.ts
/sdk/source/app/src/render-interpolation.ts
/sdk/source/app/src/physics-facade.ts
/sdk/source/app/src/browser.ts
/sdk/source/app/src/config/validation.ts
/sdk/source/app/src/config/errors.ts
/sdk/source/app/src/config/index.ts
/sdk/source/app/src/headless.ts
/sdk/source/app/src/default-environment.ts
/sdk/source/app/src/devtools/camera-framing.ts:484:  // Extraction and render_bundle can follow immediately, without running user
/sdk/source/app/src/devtools/camera.ts:189:  if (request.tool === "camera_look_at") {
/sdk/source/app/src/browser/control.ts:62:  readonly camera_look_at: {
/sdk/source/app/src/browser/control.ts:307:    inspectRenderedFrame(): GeneratedBrowserFrameInspection | null {
/sdk/source/app/src/browser/app.ts:113:  inspectRenderedFrame(): GeneratedBrowserFrameInspection | null;
/sdk/source/app/src/browser/app.ts:394:    inspectRenderedFrame: controls.inspectRenderedFrame,
/sdk/source/app/src/worker.ts:1:export { startGeneratedSimulationWorker } from "./worker/start.js";
/sdk/source/app/src/worker/start.ts:32:export function startGeneratedSimulationWorker(
<!doctype html>
<html><head><meta charset="UTF-8"><title>House scene</title></head><body style="margin:0"><script type="module" src="/src/main.js"></script></body></html>
```

Stderr:

```text

```

## Command 5978724637574721afe650b511796704

2026-10-12T02:24:34.249049+00:00 → 2026-10-12T02:24:34.366982+00:00; exit 0; duration 0.118s.

Command:

```sh
cat /sdk/source/app/src/worker/start.ts; sed -n "1,240p" /sdk/source/app/src/browser/app.ts; cat /sdk/source/app/src/systems/meshes.ts; cat /sdk/source/app/src/systems/spawn/descriptors.ts; cat /sdk/source/app/src/systems/spawn/rounded-box.ts
```

Stdout:

```text
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
import { readMirroredSourceAssetVersions } from "../asset-mirror.js";
import { resolveCanvas, installCanvasResizeSync } from "./canvas.js";
import {
  createGeneratedBrowserFrameControl,
  type GeneratedBrowserFrameOptions,
  type GeneratedBrowserRenderedFrame,
  type GeneratedBrowserFrameInspection,
  type GeneratedBrowserToolContracts,
} from "./control.js";
import {
  ApertureBrowserControlError,
  createGeneratedBrowserRequestClient,
  type GeneratedBrowserRequestOptions,
} from "./request.js";
import type { ApertureDevtoolsResponse } from "../commands.js";
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
  /** GPU and worker initialization; assets may still load asynchronously. */
  readonly ready: Promise<void>;
  request<Key extends keyof GeneratedBrowserToolContracts>(
    tool: Key,
    ...args: undefined extends GeneratedBrowserToolContracts[Key]["payload"]
      ? [
          payload?: GeneratedBrowserToolContracts[Key]["payload"],
          options?: GeneratedBrowserRequestOptions,
        ]
      : [
          payload: GeneratedBrowserToolContracts[Key]["payload"],
          options?: GeneratedBrowserRequestOptions,
        ]
  ): Promise<GeneratedBrowserToolContracts[Key]["result"]>;
  requestRaw(
    tool: string,
    payload?: unknown,
    options?: GeneratedBrowserRequestOptions,
  ): Promise<ApertureDevtoolsResponse>;
  /** One worker step/extraction and matching native submission; manual cadence only. No GPU fence. */
  renderFrame(
    options?: GeneratedBrowserFrameOptions,
  ): Promise<GeneratedBrowserRenderedFrame>;
  inspectRenderedFrame(): GeneratedBrowserFrameInspection | null;
  dispose(): Promise<void>;
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
  const manual = render?.cadence === "manual";
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
  const lifetime = new AbortController();
  const teardown: (() => void)[] = [];
  if (scheduleDemandStep !== null) teardown.push(scheduleDemandStep.dispose);
  let frames: ReturnType<typeof createGeneratedBrowserFrameControl> | null =
    null;
  const requests = createGeneratedBrowserRequestClient({
    worker,
    getWebGpuResult: () => webgpuResult,
    onRequestPosted(tool, requestId) {
      if (tool === "ecs_step") frames?.requested(requestId);
    },
    onFailure(error) {
      frames?.failed(error);
    },
  });
  const requestRaw = async (
    tool: string,
    payload?: unknown,
    requestOptions?: GeneratedBrowserRequestOptions,
  ): Promise<ApertureDevtoolsResponse> => {
    if (
      manual &&
      (tool === "ecs_step" ||
        tool === "ecs_step_and_diff" ||
        tool === "ecs_resume")
    ) {
      throw new ApertureBrowserControlError(
        "Manual frame control owns the worker clock; use renderFrame instead of step/resume tools.",
      );
    }
    return requests.requestRaw(tool, payload, requestOptions);
  };

  installGeneratedInputForwarding(canvas, worker, status, config, {
    signal: lifetime.signal,
    pollGamepads: !manual,
  });
  teardown.push(
    installGeneratedCommandForwarding(worker, status, {
      ...(scheduleDemandStep === null
        ? {}
        : { afterForward: scheduleDemandStep }),
    }),
  );
  if (options.devtools?.enabled === true) {
    teardown.push(
      installGeneratedDevtoolsRuntime({
        worker,
        getWebGpuResult: () => webgpuResult,
        requests: { ...requests, requestRaw },
      }),
    );
  }
  teardown.push(
    installCanvasResizeSync(canvas, worker, status, render, {
      renderProfile: renderProfile.profile,
      ...(scheduleDemandStep === null
        ? {}
        : { afterResize: scheduleDemandStep }),
    }),
  );

  const renderWorker: SimulationWorker = manual
    ? {
        ...worker,
        onSnapshot(callback) {
          return worker.onSnapshot((event) => {
            if (frames?.acceptSnapshot(event.frame, event.message) === true)
              callback(event);
          });
        },
      }
    : worker;
  const mirroredWorker = mirrorSimulationWorkerSourceAssets(
    renderWorker,
    sourceAssets,
    status,
    { sidebandAssets: !manual },
  );
  let audio: GeneratedAudio | null = null;
  let stopped = false;
  const stopBrowser = (): unknown[] => {
    if (stopped) return [];
    stopped = true;
    const errors: unknown[] = [];
    for (const stop of [
      () => requests.dispose(),
      () => lifetime.abort(),
import type { MeshAsset } from "@aperture-engine/render";
import {
  assetHandleKey,
  createMeshHandle,
  type AssetDiagnostic,
  type AssetRegistry,
  type MeshHandle,
} from "@aperture-engine/simulation";

export interface DynamicMeshOptions {
  readonly label?: string;
  readonly initial?: MeshAsset;
  readonly diagnostics?: readonly AssetDiagnostic[];
}

export interface MeshPublishOptions {
  readonly label?: string;
  readonly diagnostics?: readonly AssetDiagnostic[];
}

export interface MeshPublishResult {
  readonly handle: MeshHandle;
  readonly key: string;
  readonly version: number;
}

export interface DynamicMesh {
  readonly handle: MeshHandle;
  readonly key: string;
  get(): MeshAsset | undefined;
  publish(mesh: MeshAsset, options?: MeshPublishOptions): MeshPublishResult;
}

export interface MeshAccess {
  dynamic(id: string | MeshHandle, options?: DynamicMeshOptions): DynamicMesh;
  get(handle: MeshHandle): MeshAsset | undefined;
  publish(
    id: string | MeshHandle,
    mesh: MeshAsset,
    options?: MeshPublishOptions,
  ): MeshPublishResult;
}

export function createMeshAccess(registry: AssetRegistry): MeshAccess {
  const access: MeshAccess = {
    dynamic(id, options = {}) {
      const handle = meshHandleFrom(id);
      ensureRegistered(registry, handle, options.label);

      if (options.initial !== undefined) {
        publishMesh(registry, handle, options.initial, {
          ...(options.label === undefined ? {} : { label: options.label }),
          ...(options.diagnostics === undefined
            ? {}
            : { diagnostics: options.diagnostics }),
        });
      }

      return {
        handle,
        key: assetHandleKey(handle),
        get() {
          return access.get(handle);
        },
        publish(mesh, publishOptions = {}) {
          return access.publish(handle, mesh, publishOptions);
        },
      };
    },
    get(handle) {
      return registry.get<"mesh", MeshAsset>(handle)?.asset ?? undefined;
    },
    publish(id, mesh, options = {}) {
      const handle = meshHandleFrom(id);
      ensureRegistered(registry, handle, options.label ?? mesh.label);
      return publishMesh(registry, handle, mesh, options);
    },
  };

  return access;
}

function meshHandleFrom(id: string | MeshHandle): MeshHandle {
  return typeof id === "string" ? createMeshHandle(id) : id;
}

function ensureRegistered(
  registry: AssetRegistry,
  handle: MeshHandle,
  label: string | undefined,
): void {
  if (registry.has(handle)) {
    return;
  }

  registry.register(handle, {
    ...(label === undefined ? {} : { label }),
  });
}

function publishMesh(
  registry: AssetRegistry,
  handle: MeshHandle,
  mesh: MeshAsset,
  options: MeshPublishOptions,
): MeshPublishResult {
  const entry = registry.markReady(handle, mesh, options.diagnostics ?? []);

  return {
    handle,
    key: assetHandleKey(handle),
    version: entry.version,
  };
}
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
import type { ShaderHandle, Vec4Like } from "@aperture-engine/simulation";
import type { StandardMaterialPatch } from "@aperture-engine/render";
import type {
  BoxMeshDescriptorOptions,
  RoundedBoxMeshDescriptorOptions,
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
  StandardMaterialInputOptions,
  TorusMeshDescriptorOptions,
  TriangleListMeshDescriptorOptions,
  HeightfieldMeshDescriptorOptions,
  LatheMeshDescriptorOptions,
  ExtrudeMeshDescriptorOptions,
  ShaderAssetDescriptorInput,
  UnlitMaterialDescriptor,
  UnlitMaterialInputOptions,
} from "./types.js";
import { createMaterialAppearancePreset } from "./material-presets.js";
import { color } from "../color.js";
import { validateRoundedBoxDescriptor } from "./rounded-box.js";

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
  /** Centered rounded box: positive halfExtents, fitting radius and 1–32 bevelSegments. */
  roundedBox(
    options: RoundedBoxMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    validateRoundedBoxDescriptor(options);
    return descriptor("rounded-box", options);
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
  standard(
    options: StandardMaterialInputOptions = {},
  ): StandardMaterialDescriptor {
    return Object.freeze({
      kind: "standard",
      options: linearMaterialOptions(options),
    });
  },
  unlit(options: UnlitMaterialInputOptions = {}): UnlitMaterialDescriptor {
    return Object.freeze({
      kind: "unlit",
      options: linearMaterialOptions(options),
    });
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
      sampler: options.sampler,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
});

function linearMaterialOptions<
  TOptions extends { readonly baseColor?: Vec4Like | string },
>(
  options: TOptions,
): Omit<TOptions, "baseColor"> & { readonly baseColor?: Vec4Like } {
  const { baseColor, ...rest } = options;
  return {
    ...rest,
    ...(Object.prototype.hasOwnProperty.call(options, "baseColor")
      ? {
          baseColor:
            typeof baseColor === "string"
              ? color.srgbHex(baseColor)
              : baseColor,
        }
      : {}),
  };
}

export const shader = Object.freeze({
  asset(input: ShaderAssetDescriptorInput): CustomWgslShaderDescriptor {
    return Object.freeze({
      kind: "shader-asset",
      handle: readShaderHandle(input),
    });
  },
  inlineWgsl(
    code: string,
    options: { readonly virtualPath?: string } = {},
  ): CustomWgslShaderDescriptor {
    return Object.freeze({
      kind: "inline-wgsl",
      code,
      ...(options.virtualPath === undefined
        ? {}
        : { virtualPath: options.virtualPath }),
    });
  },
});

export const physics = Object.freeze({
  rigidBody(input: RigidBodyInput = {}): RigidBodyInput {
    return Object.freeze({ ...input });
  },
  collider(input: ColliderInput = {}): ColliderInput {
    return Object.freeze({ ...input });
  },
  velocity(input: PhysicsVelocityInput = {}): PhysicsVelocityInput {
    return Object.freeze({ ...input });
  },
  externalForce(input: ExternalForceInput = {}): ExternalForceInput {
    return Object.freeze({ ...input });
  },
  externalImpulse(input: ExternalImpulseInput = {}): ExternalImpulseInput {
    return Object.freeze({ ...input });
  },
  kinematicTarget(input: KinematicTargetInput = {}): KinematicTargetInput {
    return Object.freeze({ ...input });
  },
  characterController(
    input: PhysicsCharacterControllerInput = {},
  ): PhysicsCharacterControllerInput {
    return Object.freeze({ ...input });
  },
  material(input: PhysicsMaterialInput = {}): PhysicsMaterialInput {
    return Object.freeze({ ...input });
  },
  joint(input: PhysicsJointInput = {}): PhysicsJointInput {
    return Object.freeze({ ...input });
  },
  debug(input: PhysicsDebugInput = {}): PhysicsDebugInput {
    return Object.freeze({ ...input });
  },
  body(input: PhysicsSpawnDescriptor = {}): PhysicsSpawnDescriptor {
    return Object.freeze({ ...input });
  },
});

function descriptor(
  kind: "extrude",
  options: ExtrudeMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "extrude" }>;
function descriptor(
  kind: "lathe",
  options: LatheMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "lathe" }>;
function descriptor(
  kind: "heightfield",
  options: HeightfieldMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "heightfield" }>;
function descriptor(
  kind: "box",
  options: BoxMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "box" }>;
function descriptor(
  kind: "rounded-box",
  options: RoundedBoxMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "rounded-box" }>;
function descriptor(
  kind: "sphere",
  options: SphereMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "sphere" }>;
function descriptor(
  kind: "capsule",
  options: CapsuleMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "capsule" }>;
function descriptor(
  kind: "plane",
  options: PlaneMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "plane" }>;
function descriptor(
  kind: "cylinder",
  options: CylinderMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "cylinder" }>;
function descriptor(
  kind: "cone",
  options: ConeMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "cone" }>;
function descriptor(
  kind: "torus",
  options: TorusMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "torus" }>;
function descriptor(
  kind: "line-list",
  options: LineListMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "line-list" }>;
function descriptor(
  kind: "triangle-list",
  options: TriangleListMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "triangle-list" }>;
function descriptor(
  kind: PrimitiveMeshDescriptor["kind"],
  options: object,
): PrimitiveMeshDescriptor {
  return Object.freeze({
    kind,
    options: { ...options },
  }) as PrimitiveMeshDescriptor;
}

function readShaderHandle(input: ShaderAssetDescriptorInput): ShaderHandle {
  if ("renderHandle" in input) {
    return input.renderHandle;
  }

  return input;
}
import {
  createRoundedBoxMeshAsset,
  RoundedBoxMeshError,
  validateRoundedBoxMeshOptions,
  type MeshAsset,
  type RoundedBoxMeshOptions,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function validateRoundedBoxDescriptor(
  options: RoundedBoxMeshOptions,
): void {
  withRoundedBoxDiagnostic(() => validateRoundedBoxMeshOptions(options));
}

export function createRoundedBoxPrimitiveMeshAsset(
  options: RoundedBoxMeshOptions,
): MeshAsset {
  return withRoundedBoxDiagnostic(() => createRoundedBoxMeshAsset(options));
}

function withRoundedBoxDiagnostic<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (!(error instanceof RoundedBoxMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidRoundedBoxMesh",
      message: `mesh.roundedBox() ${error.message}`,
      suggestedFix:
        "Provide three positive finite halfExtents, radius from 0 through the smallest half-extent, and integer bevelSegments from 1 through 32. For tiny bevels, increase radius relative to the extents or reduce segments; use radius 0 for an exact flat box.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
      { cause: error },
    );
  }
}
```

Stderr:

```text

```

## Command bc69d73a83b74b0782b101230b8bb786

2026-10-12T02:24:48.929986+00:00 → 2026-10-12T02:24:49.099355+00:00; exit 0; duration 0.169s.

Command:

```sh
cat /sdk/source/render/src/assets/mesh.ts 2>/dev/null; find /sdk/source/render/src -iname "*triangle*" -o -iname "*mesh*" | head -30; sed -n "1,130p" /sdk/source/app/src/systems/spawn/types.ts; sed -n "1,170p" /sdk/source/app/src/devtools/camera.ts; sed -n "1,180p" /sdk/source/app/src/systems/spawn/assets.ts; grep -n "type.*Material\|createStandardMaterial\|this.material" /sdk/source/app/src/systems/materials.ts | head -30
```

Stdout:

```text
/sdk/source/render/src/mesh
/sdk/source/render/src/mesh/primitives-triangle-list.ts
/sdk/source/render/src/mesh/triangle-list-types.ts
/sdk/source/render/src/rendering/mesh-merge-types.ts
/sdk/source/render/src/rendering/extraction-mesh-materials.ts
/sdk/source/render/src/rendering/authoring-create-mesh-data.ts
/sdk/source/render/src/rendering/prepared-mesh-queue-resolver.ts
/sdk/source/render/src/rendering/snapshot-packed-mesh-codec.ts
/sdk/source/render/src/rendering/mesh-merge-assembly.ts
/sdk/source/render/src/rendering/extraction-mesh-submeshes.ts
/sdk/source/render/src/rendering/extraction-mesh-instances.ts
/sdk/source/render/src/rendering/extraction-mesh-entity-state.ts
/sdk/source/render/src/rendering/extraction-meshes.ts
/sdk/source/render/src/rendering/mesh-merge-validation.ts
/sdk/source/render/src/rendering/extraction-mesh-draw-inputs.ts
/sdk/source/render/src/rendering/extraction-mesh-bounds.ts
/sdk/source/render/src/rendering/render-world-prepared-meshes.ts
/sdk/source/render/src/rendering/extraction-mesh-cache-writeback.ts
/sdk/source/render/src/rendering/extraction-mesh-cache.ts
/sdk/source/render/src/rendering/extraction-mesh-layout.ts
/sdk/source/render/src/rendering/extraction-mesh-deformation.ts
/sdk/source/render/src/rendering/mesh-merge-bounds.ts
/sdk/source/render/src/rendering/mesh-merge.ts
/sdk/source/render/src/rendering/mesh-merge-utils.ts
/sdk/source/render/src/rendering/snapshot-prepared-meshes.ts
/sdk/source/render/src/assets/gltf-mesh-primitive.ts
/sdk/source/render/src/assets/meshopt-decoder.ts
/sdk/source/render/src/assets/preparation-mesh.ts
/sdk/source/render/src/assets/gltf-mesh-primitive-report.ts
/sdk/source/render/src/assets/gltf-mesh-normals.ts
import type {
  CameraInput,
  CustomWgslMaterialAsset,
  FogInput,
  LineListMeshOptions,
  LightInput,
  LightShadowSettingsInput,
  ParticleEmitterInput,
  ProceduralSkyInput,
  RuntimeUniformInput,
  SkyboxInput,
  StandardMaterialPatch,
  TorusMeshOptions,
  TriangleListMeshOptions,
  HeightfieldMeshOptions,
  LatheMeshOptions,
  ExtrudeMeshOptions,
  RoundedBoxMeshOptions,
  UnlitMaterialAsset,
} from "@aperture-engine/render";
import type {
  ColliderInput,
  ExternalForceInput,
  ExternalImpulseInput,
  KinematicTargetInput,
  PhysicsCharacterControllerInput,
  PhysicsDebugInput,
  PhysicsGravityInput,
  PhysicsJointInput,
  PhysicsMaterialInput,
  PhysicsVelocityInput,
  RigidBodyInput,
} from "@aperture-engine/physics";
import type { AnimationAccess } from "@aperture-engine/runtime";
import type {
  Entity,
  EnvironmentMapHandle,
  LocalTransformInput,
  MaterialHandle,
  MeshHandle,
  ParticleEffectHandle,
  PrefabFieldOverride,
  PrefabHandle,
  PrefabTransformOverride,
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import type {
  SystemGltfAssetHandle,
  SystemAssetHandle,
  SystemParticleEffectAssetHandle,
  SystemShaderAssetHandle,
  SystemTextureAssetHandle,
} from "../assets.js";

export interface SpawnMetadata {
  readonly name?: string;
  readonly key?: string;
  readonly tags?: readonly string[];
}

export interface SystemTransformInput extends LocalTransformInput {
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

import {
  resolveWorldTransforms,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import { Camera } from "@aperture-engine/render";
import type { ApertureApp } from "../advanced.js";
import type { ApertureDevtoolsRequest } from "../commands.js";
import type { EcsEntityRef } from "../config.js";
import type { ApertureEntityLookupDiagnostic } from "../entity-lookup.js";
import {
  AppEntityKey,
  LocalTransform,
  Name,
  WorldTransform,
} from "../systems.js";
import { entityRefFromValue } from "./entities.js";
import { frameCameraEntities } from "./camera-framing.js";
import { quatLookAt } from "../systems/spawn/transforms.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";
import {
  degreesToRadians,
  isRecord,
  jsonSafeRecord,
  numberFromValue,
  stringFromValue,
  tuple3FromValue,
  tuple3FromView,
  tuple4FromValue,
  tuple4FromView,
} from "./payload.js";

export interface CameraToolState {
  readonly entity: EcsEntityRef;
  readonly camera: Readonly<Record<string, unknown>>;
  readonly localTransform: {
    readonly translation: readonly [number, number, number];
    readonly rotation: readonly [number, number, number, number];
    readonly scale: readonly [number, number, number];
  } | null;
}

export function callCameraTool(
  app: ApertureApp,
  request: ApertureDevtoolsRequest,
  savedCameraStates: Map<string, CameraToolState>,
  viewportAspect?: number,
): GeneratedDevtoolsToolResult {
  const payload = isRecord(request.payload) ? request.payload : {};

  if (request.tool === "camera_frame_entities") {
    const hasKey = Object.hasOwn(payload, "key");
    const hasEntity = Object.hasOwn(payload, "entity");
    const ref = entityRefFromValue(payload["entity"]);
    if (
      (hasKey && hasEntity) ||
      (hasKey &&
        (typeof payload["key"] !== "string" || payload["key"].length === 0)) ||
      (hasEntity &&
        (ref === null ||
          !Number.isInteger(ref.index) ||
          !Number.isInteger(ref.generation) ||
          ref.index < 0 ||
          ref.generation < 0))
    ) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.camera.framing.invalidCameraSelector",
            severity: "error",
            message: "The framing camera selector is invalid or ambiguous.",
            suggestedFix:
              "Pass one camera key or integer { index, generation } entity reference; omit both to use camera.agent.",
          },
        ],
      };
    }
  }

  if (request.tool === "camera_list") {
    return {
      ok: true,
      result: cameraEntities(app.lowLevel.world).map(cameraSummary),
    };
  }

  if (request.tool === "camera_create_agent") {
    const key = stringFromValue(payload["key"]) ?? "camera.agent";
    const existing = cameraEntityByKey(app.lowLevel.world, key);
    const entity =
      existing ??
      app.context.spawn.camera({
        key,
        name: "Agent Camera",
        transform: {
          translation: tuple3FromValue(payload["translation"]) ?? [0, 1.5, 5],
          lookAt: tuple3FromValue(payload["lookAt"]) ?? [0, 0, 0],
        },
        camera: {
          priority: 10_000,
          clearColor: [0.03, 0.035, 0.04, 1],
        },
      });

    resolveWorldTransforms(app.lowLevel.world);
    return { ok: true, result: cameraSummary(entity) };
  }

  // camera_use_agent_view is a mutating tool; with no explicit selector it
  // must target the agent camera (the key camera_create_agent defaults to),
  // never fall back to the first camera — that silently promoted the
  // user-authored main camera (battletest finding F9).
  const resolvePayload =
    (request.tool === "camera_use_agent_view" ||
      request.tool === "camera_frame_entities") &&
    stringFromValue(payload["key"]) === undefined &&
    entityRefFromValue(payload["entity"] ?? null) === null
      ? { ...payload, key: "camera.agent" }
      : payload;

  const entity = resolveCameraEntity(app.lowLevel.world, resolvePayload);
  if (entity === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.camera.notFound",
          severity: "error",
          message: "No matching camera entity was found.",
          data: jsonSafeRecord(payload),
          suggestedFix:
            "Pass a camera key/entity reference, or call camera_create_agent first.",
        },
      ],
    };
  }

  if (request.tool === "camera_frame_entities") {
    const framed = frameCameraEntities(app, entity, payload, viewportAspect);
    return framed.ok
      ? {
          ok: true,
          result: { ...cameraSummary(entity), framing: framed.result },
        }
      : framed;
  }

  if (request.tool === "camera_get") {
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_save") {
    const slot = stringFromValue(payload["slot"]) ?? "default";
    const state = cameraState(entity);
    savedCameraStates.set(slot, state);

    return { ok: true, result: { slot, state } };
  }

  if (request.tool === "camera_restore") {
    const slot = stringFromValue(payload["slot"]) ?? "default";
    const state = savedCameraStates.get(slot);

    if (state === undefined) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.camera.savedStateMissing",
import {
  createBoxMeshAsset,
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createCustomWgslMaterialAsset,
  createLineListMeshAsset,
  createPlaneMeshAsset,
  createSphereMeshAsset,
  createTorusMeshAsset,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  materialAssetDependencies,
  validateCustomMaterialSource,
  validateMeshAsset,
  type CustomWgslUniformFieldType,
  type LineListMeshOptions,
  type LineListMeshSubmeshOptions,
  type LineListPosition,
  type MeshAsset,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  vec4,
  type AssetHandle,
  type AssetRegistry,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";
import type {
  PrimitiveMeshDescriptor,
  SpawnMeshOptions,
  MaterialDescriptor,
} from "./types.js";
import { createTriangleListPrimitiveMeshAsset } from "./triangle-list.js";
import { createHeightfieldPrimitiveMeshAsset } from "./heightfield.js";
import { createExtrudePrimitiveMeshAsset } from "./extrude.js";
import { createLathePrimitiveMeshAsset } from "./lathe.js";
import { createRoundedBoxPrimitiveMeshAsset } from "./rounded-box.js";
import { ApertureSystemError } from "../errors.js";

interface PreparedSpawnMeshAssets {
  readonly meshHandle: MeshHandle;
  readonly materialHandle: MaterialHandle;
  publish(registry: AssetRegistry): void;
}

/** Convert and validate both descriptors without changing the registry. */
export function prepareSpawnMeshAssets(
  input: SpawnMeshOptions,
  fallbackAssetId: string,
): PreparedSpawnMeshAssets {
  const id = input.key ?? input.name ?? fallbackAssetId;
  const preparedMesh =
    input.mesh.kind !== "mesh"
      ? {
          handle: createMeshHandle(`${id}.mesh`),
          asset: primitiveToMeshAsset(input.mesh),
        }
      : { handle: input.mesh };
  const preparedMaterial =
    input.material.kind !== "material"
      ? {
          handle: createMaterialHandle(`${id}.material`),
          asset: materialDescriptorToAsset(input.material),
        }
      : { handle: input.material };
  const materialOptions =
    preparedMaterial.asset === undefined
      ? undefined
      : {
          label: preparedMaterial.asset.label,
          dependencies: materialAssetDependencies(preparedMaterial.asset),
        };

  return {
    meshHandle: preparedMesh.handle,
    materialHandle: preparedMaterial.handle,
    publish(registry) {
      if (preparedMesh.asset !== undefined) {
        registerReadyAsset(registry, preparedMesh.handle, preparedMesh.asset);
      }
      if (preparedMaterial.asset !== undefined) {
        registerReadyAsset(
          registry,
          preparedMaterial.handle,
          preparedMaterial.asset,
          materialOptions,
        );
      }
    },
  };
}

function registerReadyAsset<TAsset>(
  registry: AssetRegistry,
  handle: MeshHandle | MaterialHandle,
  assetValue: TAsset,
  options: {
    readonly dependencies?: readonly AssetHandle[];
    readonly label?: string;
  } = {},
): void {
  if (!registry.has(handle)) {
    registry.register(handle, {
      ...(options.label === undefined ? {} : { label: options.label }),
      ...(options.dependencies === undefined
        ? {}
        : { dependencies: options.dependencies }),
    });
  }

  registry.markReady(handle, assetValue);
}

function primitiveToMeshAsset(
  descriptorValue: PrimitiveMeshDescriptor,
): MeshAsset {
  switch (descriptorValue.kind) {
    case "extrude":
      return createExtrudePrimitiveMeshAsset(descriptorValue.options);
    case "lathe":
      return createLathePrimitiveMeshAsset(descriptorValue.options);
    case "heightfield":
      return createHeightfieldPrimitiveMeshAsset(descriptorValue.options);
    case "rounded-box":
      return createRoundedBoxPrimitiveMeshAsset(descriptorValue.options);
    case "box": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size, size]
          : Array.isArray(size)
            ? size
            : [1, 1, 1];
      return createBoxMeshAsset({
        width: read3(tuple, 0),
        height: read3(tuple, 1),
        depth: read3(tuple, 2),
      });
    }
    case "sphere":
      return createSphereMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        widthSegments: numberOption(descriptorValue.options.segments, 32),
        heightSegments: numberOption(descriptorValue.options.segments, 16),
      });
    case "capsule":
      return createCapsuleMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 2),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "plane": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size]
          : Array.isArray(size)
            ? size
            : [1, 1];
      return createPlaneMeshAsset({
        width: read2(tuple, 0),
        height: read2(tuple, 1),
        widthSegments: numberOption(descriptorValue.options.subdivisions, 1),
        heightSegments: numberOption(descriptorValue.options.subdivisions, 1),
      });
    }
    case "cylinder":
      return createCylinderMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "cone":
      return createConeMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
5:  type MaterialAsset,
6:  type StandardMaterialPatch,
25:export type MaterialSetResult =
31:export type MaterialPatch = StandardMaterialPatch;
```

Stderr:

```text

```

## Command 794b7a7f319345beab67b264ceb28f28

2026-10-12T02:24:54.666152+00:00 → 2026-10-12T02:24:54.835416+00:00; exit 0; duration 0.169s.

Command:

```sh
cat /sdk/source/render/src/mesh/primitives-triangle-list.ts | head -130; grep -R -n "interface MeshAsset\|interface MeshVertex" /sdk/source/render/src | head -20; sed -n "180,270p" /sdk/source/app/src/devtools/camera.ts; cat /sdk/source/app/src/systems/components.ts | head -100; cat /sdk/source/app/src/systems/context.ts | head -180
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
/sdk/source/render/src/mesh/upload-plan.ts:24:export interface MeshVertexUploadDescriptor {
/sdk/source/render/src/mesh/types.ts:37:export interface MeshVertexAttributeDescriptor {
/sdk/source/render/src/mesh/types.ts:48:export interface MeshVertexStreamDescriptor {
/sdk/source/render/src/mesh/types.ts:113:export interface MeshAsset {
    restoreCameraState(app.lowLevel.world, entity, state);
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_set_transform") {
    setCameraTransform(app.lowLevel.world, entity, payload);
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_look_at") {
    const translation = tuple3FromValue(payload["translation"]) ??
      cameraState(entity).localTransform?.translation ?? [0, 1.5, 5];
    const target = tuple3FromValue(payload["lookAt"] ?? payload["target"]) ?? [
      0, 0, 0,
    ];
    setCameraTransform(app.lowLevel.world, entity, {
      translation,
      rotation: quatLookAt(translation, target),
    });
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_orbit" || request.tool === "camera_fit_entity") {
    // An entity selected as the subject may have been edited since the last
    // simulation step. Resolve derived poses before reading its world origin.
    resolveWorldTransforms(app.lowLevel.world);
    const targetReport =
      request.tool === "camera_fit_entity"
        ? cameraFitTarget(app.lowLevel.world, payload)
        : {
            ok: true as const,
            target: cameraOrbitTarget(app.lowLevel.world, payload),
          };

    if (!targetReport.ok) {
      return targetReport;
    }

    const target = targetReport.target;
    const radius = numberFromValue(payload["radius"]) ?? 5;
    const yaw = degreesToRadians(numberFromValue(payload["yawDegrees"]) ?? 35);
    const pitch = degreesToRadians(
      numberFromValue(payload["pitchDegrees"]) ?? 20,
    );
    const translation = orbitPosition(target, radius, yaw, pitch);

    setCameraTransform(app.lowLevel.world, entity, {
      translation,
      rotation: quatLookAt(translation, target),
    });
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_use_agent_view") {
    entity.setValue(Camera, "priority", 10_000);
    entity.setValue(Camera, "renderTargetId", "");
    entity.getVectorView(Camera, "viewport").set([0, 0, 1, 1]);
    entity.getVectorView(Camera, "scissor").set([0, 0, 1, 1]);
    return { ok: true, result: cameraSummary(entity) };
  }

  return {
    ok: false,
    diagnostics: [
      {
        code: "aperture.camera.unsupportedTool",
        severity: "error",
        message: `Unsupported camera tool '${request.tool}'.`,
        data: { tool: request.tool },
        suggestedFix: "Use one of the registered Aperture camera tools.",
      },
    ],
  };
}

function cameraEntities(world: EcsWorld): Entity[] {
  return [...world.queryManager.registerQuery({ required: [Camera] }).entities]
    .filter((entity) => entity.active)
    .sort((a, b) => a.index - b.index || a.generation - b.generation);
}

function cameraEntityByKey(world: EcsWorld, key: string): Entity | null {
  return (
    cameraEntities(world).find(
      (entity) =>
        entity.hasComponent(AppEntityKey) &&
        entity.getValue(AppEntityKey, "value") === key,
    ) ?? null
  );
}

import { registerRenderAuthoringComponents } from "@aperture-engine/render";
import {
  EcsType,
  defineComponent,
  registerMetadataComponents,
  registerTransformComponents,
  type EcsWorld,
} from "@aperture-engine/simulation";
import { ScreenSpaceFraming } from "./screen-space-framing.js";

export const AppEntityKey = defineComponent(
  "aperture.app.entityKey",
  {
    value: { type: EcsType.String, default: "" },
  },
  "Optional globally unique app-authored entity key for tooling and diagnostics.",
);

export const AppEntityTags = defineComponent(
  "aperture.app.entityTags",
  {
    valuesJson: { type: EcsType.String, default: "[]" },
  },
  "Optional app-authored entity tags serialized for tooling and diagnostics.",
);

export const AppEntitySource = defineComponent(
  "aperture.app.entitySource",
  {
    kind: { type: EcsType.String, default: "" },
    assetId: { type: EcsType.String, default: "" },
    gltfNodeIndex: { type: EcsType.Int32, default: -1 },
    gltfNodePath: { type: EcsType.String, default: "" },
  },
  "Optional app-authored or loader-authored source metadata for tooling and diagnostics.",
);

export const RenderInterpolation = defineComponent(
  "aperture.render.interpolation",
  {
    enabled: { type: EcsType.Boolean, default: true },
    initialized: { type: EcsType.Boolean, default: false },
    previousTranslation: { type: EcsType.Vec3, default: [0, 0, 0] },
    previousRotation: { type: EcsType.Vec4, default: [0, 0, 0, 1] },
    previousScale: { type: EcsType.Vec3, default: [1, 1, 1] },
    currentTranslation: { type: EcsType.Vec3, default: [0, 0, 0] },
    currentRotation: { type: EcsType.Vec4, default: [0, 0, 0, 1] },
    currentScale: { type: EcsType.Vec3, default: [1, 1, 1] },
  },
  "Opt-in fixed-step render interpolation state for non-physics LocalTransform entities.",
);

export function registerApertureAppComponents(world: EcsWorld): EcsWorld {
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  world.registerComponent(AppEntityKey);
  world.registerComponent(AppEntityTags);
  world.registerComponent(AppEntitySource);
  world.registerComponent(RenderInterpolation);
  world.registerComponent(ScreenSpaceFraming);
  return world;
}
import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import type { ApertureConfig } from "../config.js";
import {
  createInputResource,
  type InputAction,
  type InputResourceBase,
} from "../input/state.js";
import { createSpatialQueries, type SpatialQueries } from "../spatial/index.js";
import { createDiagnostics, type SystemDiagnostics } from "./diagnostics.js";
import { createScheduledEffects, type ScheduledEffects } from "./effects.js";
import { ApertureSystemError } from "./errors.js";
import { createCommandAccess, type CommandAccess } from "./commands.js";
import {
  createSystemAssetAccess,
  type ApertureAssetLoader,
  type SystemGltfAssetDecoderProvider,
  type SystemAssetAccess,
} from "./assets.js";
import { registerApertureAppComponents } from "./components.js";
import { createApertureRandom, type ApertureRandom } from "./random.js";
import {
  createApertureFrameTime,
  type ApertureFrameTime,
} from "./frame-time.js";
import {
  createApertureDeterminismDiagnostics,
  type ApertureDeterminismDiagnostics,
  type ApertureDeterminismDiagnosticsOptions,
} from "./determinism.js";
import { createCameraAccess, type CameraAccess } from "./cameras.js";
import { createGltfInstanceAccess, type GltfInstanceAccess } from "./gltf.js";
import { createHierarchyAccess, type HierarchyAccess } from "./hierarchy.js";
import {
  createInteractionAccess,
  type InteractionAccess,
} from "../interaction/access.js";
import { createMaterialAccess, type MaterialAccess } from "./materials.js";
import { createMeshAccess, type MeshAccess } from "./meshes.js";
import { createPhysicsAccess, type PhysicsAccess } from "./physics.js";
import { createPrefabAccess, type PrefabAccess } from "./prefabs.js";
import { createParticleAccess, type ParticleAccess } from "./particles.js";
import { createAudioAccess, type AudioAccess } from "./audio.js";
import { createTrailAccess, type TrailAccess } from "./trails.js";
import { createSignalStore, type SignalStore } from "./signals.js";
import { createResourceStore, type ResourceStore } from "./resources.js";
import {
  createStartOptionsAccess,
  type StartOptionsAccess,
} from "./start-options.js";
import { createSpawnCommands, type SpawnCommands } from "./spawn/index.js";
import {
  createFixedStepAccess,
  type FixedStepAccess,
  type FixedStepTaskRegistrar,
} from "./fixed-step.js";
import {
  createHtmlBridgeAccess,
  type HtmlBridgeAccess,
} from "./html-bridge.js";

// This interface is intentionally empty so generated app-local declarations can
// augment it with kind-specific action properties.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApertureGeneratedActionMap {}

export type InputActions = ApertureGeneratedActionMap &
  Record<string, InputAction>;

export type InputSignals = Omit<InputResourceBase, "actions"> & {
  readonly actions: InputActions;
};

export interface ApertureSystemContext {
  readonly world: unknown;
  readonly assetsRegistry: AssetRegistry;
  /** Deterministic seeded RNG — use instead of Math.random() for replayability. */
  readonly random: ApertureRandom;
  /** Sanctioned sim-time — use instead of Date.now()/performance.now(). */
  readonly time: ApertureFrameTime;
  readonly signals: SignalStore;
  readonly resources: ResourceStore;
  readonly startOptions: StartOptionsAccess;
  readonly input: InputSignals;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly gltf: GltfInstanceAccess;
  readonly hierarchy: HierarchyAccess;
  readonly prefabs: PrefabAccess;
  readonly particles: ParticleAccess;
  readonly audio: AudioAccess;
  readonly materials: MaterialAccess;
  readonly meshes: MeshAccess;
  readonly trails: TrailAccess;
  readonly physics: PhysicsAccess;
  readonly fixedStep: FixedStepAccess;
  readonly interaction: InteractionAccess;
  readonly html: HtmlBridgeAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
  readonly determinism: ApertureDeterminismDiagnostics;
}

export interface CreateApertureSystemContextOptions {
  readonly world: EcsWorld;
  readonly assetsRegistry: AssetRegistry;
  readonly config?: ApertureConfig;
  readonly startOptions?: Readonly<Record<string, unknown>>;
  readonly assetLoader?: ApertureAssetLoader;
  readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
  readonly registerFixedStepTask?: FixedStepTaskRegistrar;
  /** Seed for the deterministic RNG (default 0) or a prebuilt RNG instance. */
  readonly random?: number | ApertureRandom;
  readonly determinism?: ApertureDeterminismDiagnosticsOptions;
}

const APERTURE_SYSTEM_CONTEXT_KEY = "aperture.systemContext";

export function installApertureSystemContext(
  world: EcsWorld,
  context: ApertureSystemContext,
): void {
  world.globals[APERTURE_SYSTEM_CONTEXT_KEY] = context;
}

export function createApertureSystemContext(
  options: CreateApertureSystemContextOptions,
): ApertureSystemContext {
  registerApertureAppComponents(options.world);

  const diagnostics = createDiagnostics();
  const signals = createSignalStore(options.config?.signals ?? {});
  const resources = createResourceStore();
  const startOptions = createStartOptionsAccess(options.startOptions);
  const input = createInputSignals(options.config);
  const assets = createSystemAssetAccess({
    config: options.config,
    registry: options.assetsRegistry,
    diagnostics,
    loader: options.assetLoader,
    ...(options.gltfAssetDecoders === undefined
      ? {}
      : { gltfAssetDecoders: options.gltfAssetDecoders }),
  });
  const commands = createCommandAccess(assets);
  const physics = createPhysicsAccess({ world: options.world });
  const spatial = createSpatialQueries({
    colliders: {
      world: options.world,
      getPhysicsBackend: () => physics.getBackend(),
    },
  });
  const spawn = createSpawnCommands({
    world: options.world,
    registry: options.assetsRegistry,
    diagnostics,
    get assets() {
      return assets;
    },
    // Wire config.render defaults into spawns so render.clearColor is the
    // app-wide default camera background instead of a dead config knob (#67).
    ...(options.config?.render?.clearColor === undefined
      ? {}
      : {
          renderDefaults: { clearColor: options.config.render.clearColor },
        }),
  });
  const cameras = createCameraAccess(options.world, {
    contextKey: APERTURE_SYSTEM_CONTEXT_KEY,
  });
  const gltf = createGltfInstanceAccess(options.world);
  const hierarchy = createHierarchyAccess(options.world);
  const prefabs = createPrefabAccess(options.assetsRegistry);
  const particles = createParticleAccess({ world: options.world, assets });
  const audio = createAudioAccess({ world: options.world, assets });
  const materials = createMaterialAccess(options.assetsRegistry);
  const meshes = createMeshAccess(options.assetsRegistry);
  const trails = createTrailAccess({
```

Stderr:

```text

```

## Command 9d4c12fe4bca46a2995ed0b20830cdf2

2026-10-12T02:25:05.465680+00:00 → 2026-10-12T02:25:05.646328+00:00; exit 0; duration 0.181s.

Command:

```sh
sed -n "1,145p" /sdk/source/app/src/browser/control.ts; cat /sdk/source/app/src/systems/cameras.ts | head -145; sed -n "32,143p" /sdk/source/render/src/mesh/types.ts; sed -n "1,100p" /sdk/source/app/src/worker/devtools/bridge.ts; grep -n "system" /sdk/source/app/src/worker/loop.ts | head -25
```

Stdout:

```text
import {
  decodeTypedArrayTree,
  encodeTypedArrayTree,
  inspectRenderSnapshot,
  type RenderSnapshotInspectionReport,
} from "@aperture-engine/render";
import {
  webGpuAppRenderReportToJsonValue,
  type WebGpuAppRenderReport,
  type WebGpuAppRenderReportJsonValue,
} from "@aperture-engine/webgpu";
import type { EcsEntityRef } from "../config.js";
import type {
  ApertureEntityFindQuery,
  ApertureEntityFindReport,
  ApertureEntityGetReport,
} from "../entity-lookup.js";
import type { CameraToolState } from "../devtools/camera.js";
import type { createAssetSummary } from "../devtools/assets.js";
import {
  ApertureBrowserControlError,
  type GeneratedBrowserRequestClient,
  type GeneratedBrowserRequestOptions,
} from "./request.js";

export interface GeneratedBrowserEntitySelector {
  readonly key?: string;
  readonly entity?: EcsEntityRef;
}

export interface GeneratedBrowserCameraSummary extends CameraToolState {
  readonly key: string | null;
  readonly name: string;
}

/** Typed core tools share the existing semantic worker bridge. Other tools use requestRaw. */
export interface GeneratedBrowserToolContracts {
  readonly ecs_query: {
    readonly payload: ApertureEntityFindQuery | undefined;
    readonly result: ApertureEntityFindReport;
  };
  readonly ecs_get_entity: {
    readonly payload: GeneratedBrowserEntitySelector;
    readonly result: ApertureEntityGetReport;
  };
  readonly ecs_pause: {
    readonly payload: undefined;
    readonly result: Readonly<Record<string, unknown>>;
  };
  readonly asset_list: {
    readonly payload: undefined;
    readonly result: { readonly assets: ReturnType<typeof createAssetSummary> };
  };
  readonly camera_list: {
    readonly payload: undefined;
    readonly result: readonly GeneratedBrowserCameraSummary[];
  };
  readonly camera_get: {
    readonly payload: GeneratedBrowserEntitySelector;
    readonly result: GeneratedBrowserCameraSummary;
  };
  readonly camera_look_at: {
    readonly payload: GeneratedBrowserEntitySelector & {
      readonly translation?: readonly [number, number, number];
      readonly lookAt: readonly [number, number, number];
    };
    readonly result: GeneratedBrowserCameraSummary;
  };
  readonly camera_set_transform: {
    readonly payload: GeneratedBrowserEntitySelector & {
      readonly translation?: readonly [number, number, number];
      readonly rotation?: readonly [number, number, number, number];
      readonly scale?: readonly [number, number, number];
    };
    readonly result: GeneratedBrowserCameraSummary;
  };
}

export interface GeneratedBrowserFrameOptions extends GeneratedBrowserRequestOptions {
  readonly deltaSeconds?: number;
  readonly timeSeconds?: number;
}

export interface GeneratedBrowserRenderedFrame {
  readonly snapshotFrame: number;
  /** Detached existing report data; excludes renderer resources and shared snapshot buffers. */
  readonly report: WebGpuAppRenderReportJsonValue;
}

export interface GeneratedBrowserFrameInspection extends RenderSnapshotInspectionReport {
  readonly frame: number;
}

export function createGeneratedBrowserFrameControl(input: {
  readonly requests: GeneratedBrowserRequestClient;
  readonly manual: boolean;
  readonly getSourceAssetVersions?: () => readonly (readonly [
    string,
    number,
  ])[];
}) {
  let disposed = false;
  let tail = Promise.resolve();
  let queued = 0;
  let lastReport: WebGpuAppRenderReport | null = null;
  const completed = new Map<number, WebGpuAppRenderReport>();
  let active: {
    requestId: string | null;
    receivedFrame: number | null;
    expectedFrame: number | null;
    resolve(frame: GeneratedBrowserRenderedFrame): void;
    reject(error: Error): void;
  } | null = null;

  const settle = (): void => {
    if (active?.expectedFrame === null || active === null) return;
    const report = completed.get(active.expectedFrame);
    if (report === undefined) return;
    completed.delete(active.expectedFrame);
    if (report.ok)
      active.resolve({
        snapshotFrame: active.expectedFrame,
        report: decodeTypedArrayTree(
          encodeTypedArrayTree(webGpuAppRenderReportToJsonValue(report)),
        ) as WebGpuAppRenderReportJsonValue,
      });
    else
      active.reject(
        new ApertureBrowserControlError(
          "Aperture failed to render the requested frame.",
          report.diagnostics,
        ),
      );
  };

  return {
    renderFrame(
      options: GeneratedBrowserFrameOptions = {},
    ): Promise<GeneratedBrowserRenderedFrame> {
      if (!input.manual)
        return Promise.reject(
          new ApertureBrowserControlError(
            'renderFrame requires render.cadence: "manual".',
          ),
        );
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
  position: readonly [number, number],
): RayInput {
  if (!entity.hasComponent(WorldTransform)) {
    throw new ApertureSystemError(
      "aperture.camera.missingTransform",
      "Camera ray construction requires a WorldTransform component.",
      "Add a transform to the camera entity before calling rayFromPointer().",
    );
  }

  const worldMatrix = readWorldMatrix(entity);
  const viewMatrix = invertMat4(worldMatrix);

  if (viewMatrix === null) {
    throw new ApertureSystemError(
      "aperture.camera.invalidTransform",
      "Camera ray construction requires an invertible world transform.",
      "Use a camera transform with non-zero scale before calling rayFromPointer().",
    );
  }

  const projection = entity.getValue(Camera, "projection");

  // Validate the projection parameters before building the matrix so an invalid
  // camera surfaces the structured camera error rather than a raw RangeError from
  // makeOrthographic/makePerspective (which the inverse-matrix guard below would
  // never reach).
  const near = readCameraNumber(entity, "near");
  const far = readCameraNumber(entity, "far");
  const aspect = readCameraNumber(entity, "aspect");
  const validation = validateCameraInput({
    projection:
      projection === CameraProjection.Orthographic
        ? CameraProjection.Orthographic
        : CameraProjection.Perspective,
    near,
    far,
    aspect,
    fovYRadians: readCameraNumber(entity, "fovYRadians"),
    orthographicHeight: readCameraNumber(entity, "orthographicHeight"),
  });

  if (!validation.valid) {
    throw new ApertureSystemError(
      "aperture.camera.invalidProjection",
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
import type {
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
import {
  errorToApertureDiagnostic,
  type ApertureGeneratedDiagnostic,
} from "../../diagnostics.js";

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
  readonly requestId?: string;
  readonly sourceAssetVersions?: readonly (readonly [string, number])[];
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
10:import { createDefaultSystemGltfAssetDecoderProvider } from "../systems.js";
36:  readonly systems: readonly ApertureSystemModule[];
62:      systems: options.systems,
82:    // older apps. New app systems should use the filtered public
197:          "Inspect the throwing app system or per-frame asset update, then restart the generated app.",
263:        "Inspect aperture.config.ts and discovered system modules, then restart the generated app.",
444: * published on the ECS world. Prefer `this.startOptions` in app systems; this
```

Stderr:

```text

```

## Command eb119e059ed04900a23782aa20d5c78b

2026-10-12T02:25:17.920623+00:00 → 2026-10-12T02:25:18.088640+00:00; exit 0; duration 0.168s.

Command:

```sh
grep -R -n "ApertureSystemModule\|module.default\|systems: \[" /sdk/source/app/src /sdk/source/vite-plugin/src | head -45; grep -n "ecs_set_component" /sdk/source/app/src/worker/devtools/bridge.ts /sdk/source/app/src/devtools/entities.ts; sed -n "170,240p" /sdk/source/app/src/devtools/entities.ts; cat /sdk/source/app/src/systems/spawn/transforms.ts | head -105; sed -n "1,130p" /sdk/source/app/src/config/index.ts
```

Stdout:

```text
/sdk/source/app/src/advanced.ts:79:export interface ApertureSystemModule {
/sdk/source/app/src/advanced.ts:93:  readonly systems?: readonly ApertureSystemModule[];
/sdk/source/app/src/advanced.ts:189:  resolveApertureSystemModules(options.systems ?? []);
/sdk/source/app/src/advanced.ts:312:    registerApertureSystemModules(lowLevel, options.systems ?? []);
/sdk/source/app/src/advanced.ts:458:export function resolveApertureSystemModules(
/sdk/source/app/src/advanced.ts:459:  modules: readonly ApertureSystemModule[],
/sdk/source/app/src/advanced.ts:468:export function registerApertureSystemModules(
/sdk/source/app/src/advanced.ts:470:  modules: readonly ApertureSystemModule[],
/sdk/source/app/src/advanced.ts:472:  const resolved = resolveApertureSystemModules(modules);
/sdk/source/app/src/advanced.ts:493:  moduleValue: ApertureSystemModule,
/sdk/source/app/src/browser/status.ts:171:    systems: [],
/sdk/source/app/src/worker/loop.ts:18:import type { ApertureSystemModule } from "../advanced.js";
/sdk/source/app/src/worker/loop.ts:36:  readonly systems: readonly ApertureSystemModule[];
/sdk/source/app/src/worker/start.ts:6:import type { ApertureApp, ApertureSystemModule } from "../advanced.js";
/sdk/source/app/src/worker/start.ts:28:  readonly systems: readonly ApertureSystemModule[];
/sdk/source/app/src/devtools/entities.ts:71:  readonly tool: "ecs_set_component_field";
/sdk/source/app/src/devtools/entities.ts:298:      if (tool === "ecs_set_component_field") {
/sdk/source/app/src/devtools/entities.ts:498:          tool: "ecs_set_component_field",
        diagnostics = report.ok ? [] : [report.diagnostic];
        return true;
      }

      if (command.channel === APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL) {
        const snapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            command.payload,
            `generated-snapshot-${snapshots + 1}`,
          ),
        );

        snapshots += 1;
        lastRequest = entityToolRequest(command);
        lastSnapshot = snapshot;
        lastDiff = null;
        diagnostics = snapshot.diagnostics;
        return true;
      }

      if (command.channel === APERTURE_ENTITY_DIFF_COMMAND_CHANNEL) {
        lastRequest = entityToolRequest(command);

        if (lastSnapshot === null) {
          diagnostics = [
            {
              code: "aperture.entityTools.diffMissingSnapshot",
              severity: "error",
              message:
                "Entity diff requires a previous generated entity snapshot.",
              data: { channel: command.channel },
              suggestedFix:
                "Request aperture.devtools.entity.snapshot before requesting aperture.devtools.entity.diff.",
            },
          ];
          lastDiff = null;
          return true;
        }

        const nextSnapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            command.payload,
            `generated-diff-${diffs + 1}`,
          ),
        );
        const diff = diffApertureEntityLookupSnapshots(
          lastSnapshot,
          nextSnapshot,
        );

        snapshots += 1;
        diffs += 1;
        lastSnapshot = nextSnapshot;
        lastDiff = diff;
        diagnostics = diff.diagnostics;
        return true;
      }

      if (command.channel === APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL) {
        const hierarchy = createApertureEntityHierarchy(world);

        hierarchies += 1;
        lastRequest = entityToolRequest(command);
        lastHierarchy = hierarchy;
        diagnostics = hierarchy.diagnostics;
        return true;
      }

      return false;
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createRootTransform,
  type Entity,
  type LocalTransformInput,
  type Vec3Like,
} from "@aperture-engine/simulation";
import type { SystemTransformInput } from "./types.js";

export function addTransform(
  entity: Entity,
  input: SystemTransformInput = {},
): void {
  writeTransform(entity, input);
}

export function writeTransform(
  entity: Entity,
  input: SystemTransformInput = {},
): void {
  const resolvedRotation = input.rotation ?? rotationFromTransformInput(input);
  const localInput: LocalTransformInput = {
    ...(input.translation === undefined
      ? {}
      : { translation: input.translation }),
    ...(resolvedRotation === undefined ? {} : { rotation: resolvedRotation }),
    ...(input.scale === undefined ? {} : { scale: input.scale }),
  };
  const root = createRootTransform(localInput);
  const parent = createParentInput(input.parent ?? null);
  const local = {
    translation: root.local.translation ?? [0, 0, 0],
    rotation: root.local.rotation ?? [0, 0, 0, 1],
    scale: root.local.scale ?? [1, 1, 1],
  } as const;
  const world = {
    col0: root.world.col0 ?? [1, 0, 0, 0],
    col1: root.world.col1 ?? [0, 1, 0, 0],
    col2: root.world.col2 ?? [0, 0, 1, 0],
    col3: root.world.col3 ?? [0, 0, 0, 1],
  } as const;

  if (entity.hasComponent(LocalTransform)) {
    entity.getVectorView(LocalTransform, "translation").set(local.translation);
    entity.getVectorView(LocalTransform, "rotation").set(local.rotation);
    entity.getVectorView(LocalTransform, "scale").set(local.scale);
  } else {
    entity.addComponent(LocalTransform, local);
  }

  if (entity.hasComponent(Parent)) {
    entity.setValue(Parent, "entity", parent.entity);
  } else {
    entity.addComponent(Parent, parent);
  }

  if (entity.hasComponent(WorldTransform)) {
    entity.getVectorView(WorldTransform, "col0").set(world.col0);
    entity.getVectorView(WorldTransform, "col1").set(world.col1);
    entity.getVectorView(WorldTransform, "col2").set(world.col2);
    entity.getVectorView(WorldTransform, "col3").set(world.col3);
  } else {
    entity.addComponent(WorldTransform, world);
  }
}

function createParentInput(parent: Entity | null): {
  readonly entity: Entity | null;
} {
  return { entity: parent };
}

function rotationFromTransformInput(
  input: SystemTransformInput,
): readonly [number, number, number, number] | undefined {
  if (input.rotationEulerDegrees !== undefined) {
    return quatFromEulerDegrees(input.rotationEulerDegrees);
  }

  if (input.lookAt !== undefined && input.translation !== undefined) {
    return quatLookAt(input.translation, input.lookAt);
  }

  return undefined;
}

function quatFromEulerDegrees(
  degrees: Vec3Like,
): readonly [number, number, number, number] {
  const x = (read3(degrees, 0) * Math.PI) / 180;
  const y = (read3(degrees, 1) * Math.PI) / 180;
  const z = (read3(degrees, 2) * Math.PI) / 180;
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
import type {
  AudioClipHandle,
  EnvironmentMapHandle,
  SceneHandle,
  ShaderHandle,
  TextureHandle,
} from "@aperture-engine/simulation";
import type {
  ParticleCompositeEmitterTransformInput,
  ParticleEmitterEffectAssetInput,
  ParticleRendererModuleInput,
  ParticleSourceMetadata,
  TextureColorSpace,
  TextureSemantic,
} from "@aperture-engine/render";
import type { ApertureWorkerFeature } from "../features.js";
import { ApertureConfigError } from "./errors.js";
import { isPreloadPolicy, validateApertureConfig } from "./validation.js";

export { ApertureConfigError } from "./errors.js";
export { validateApertureConfig } from "./validation.js";

export type ApertureAppMode = "browser" | "headless";
export type AssetPreloadPolicy = "blocking" | "background" | "manual";
export type ConfigAssetKind =
  | "gltf"
  | "texture"
  | "hdr"
  | "shader"
  | "audio"
  | "particle-effect";
export type ConfigUrlAssetKind = Exclude<ConfigAssetKind, "particle-effect">;
export type DiagnosticsLevel = "debug" | "info" | "warn" | "error" | "silent";

export type EcsEntityRef = {
  readonly index: number;
  readonly generation: number;
};

export interface ApertureAssetOptions {
  readonly preload?: AssetPreloadPolicy;
  readonly label?: string;
}

export interface ApertureAudioAssetOptions extends ApertureAssetOptions {
  readonly streaming?: boolean;
  readonly durationHint?: number;
  readonly channels?: number;
  readonly captionTrackId?: string;
}

export interface ApertureTextureAssetOptions extends ApertureAssetOptions {
  readonly colorSpace?: TextureColorSpace;
  readonly semantic?: TextureSemantic;
  readonly mimeType?: string;
}

export interface ApertureParticleEmitterEffectAssetOptions
  extends
    ApertureAssetOptions,
    Omit<
      ParticleEmitterEffectAssetInput,
      "label" | "renderer" | "version" | "type"
    > {
  readonly version?: 2;
  readonly type?: "emitter";
  readonly renderer?: Omit<
    ParticleRendererModuleInput,
    "texture" | "sampler"
  > & {
    readonly texture?: string | null;
    readonly sampler?: string | null;
  };
}

/** A composite-effect child emitter authored against a string effect id. */
export interface ApertureParticleCompositeEmitterOptions {
  readonly label?: string;
  readonly effect: string;
  readonly delay?: number;
  readonly duration?: number;
  readonly timeScale?: number;
  readonly transform?: ParticleCompositeEmitterTransformInput;
}

export interface ApertureParticleCompositeEffectAssetOptions extends ApertureAssetOptions {
  readonly version?: 2;
  readonly type: "composite";
  readonly label?: string;
  readonly emitters: readonly ApertureParticleCompositeEmitterOptions[];
  readonly source?: ParticleSourceMetadata;
}

export type ApertureParticleEffectAssetOptions =
  | ApertureParticleEmitterEffectAssetOptions
  | ApertureParticleCompositeEffectAssetOptions;

export interface ApertureConfigAssetDescriptor<
  TKind extends ConfigUrlAssetKind = ConfigUrlAssetKind,
> {
  readonly kind: TKind;
  readonly url: string;
  readonly preload: AssetPreloadPolicy;
  readonly label?: string;
}

export type ApertureGltfAssetDescriptor = ApertureConfigAssetDescriptor<"gltf">;
export interface ApertureTextureAssetDescriptor extends ApertureConfigAssetDescriptor<"texture"> {
  readonly colorSpace?: TextureColorSpace;
  readonly semantic?: TextureSemantic;
  readonly mimeType?: string;
}
export type ApertureHdrAssetDescriptor = ApertureConfigAssetDescriptor<"hdr">;
export type ApertureShaderAssetDescriptor =
  ApertureConfigAssetDescriptor<"shader">;
export interface ApertureAudioAssetDescriptor extends ApertureConfigAssetDescriptor<"audio"> {
  readonly streaming?: boolean;
  readonly durationHint?: number;
  readonly channels?: number;
  readonly captionTrackId?: string;
}
export interface ApertureParticleEmitterEffectAssetDescriptor extends Omit<
  ApertureParticleEmitterEffectAssetOptions,
  "preload" | "version"
> {
  readonly kind: "particle-effect";
  readonly preload: AssetPreloadPolicy;
  readonly version: 2;
  readonly type?: "emitter";
}
```

Stderr:

```text

```

## Command b63b08262eff4372a75de108a8a33a69

2026-10-12T02:25:25.702695+00:00 → 2026-10-12T02:25:25.874692+00:00; exit 0; duration 0.172s.

Command:

```sh
sed -n "75,94p" /sdk/source/app/src/advanced.ts; sed -n "458,526p" /sdk/source/app/src/advanced.ts; sed -n "45,80p" /sdk/source/app/src/devtools/entities.ts; sed -n "292,326p" /sdk/source/app/src/devtools/entities.ts; grep -n "fovYRadians\|clearColor" /sdk/source/render/src/components/camera.ts 2>/dev/null; find /sdk/source/render/src -iname "*camera*" | head -10; grep -n "defaultCamera\|defaultLight\|pixelRatio" /sdk/source/app/src/config/index.ts | head -20
```

Stdout:

```text
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


interface GeneratedEntityToolStatus {
  readonly finds: number;
  readonly gets: number;
  readonly mutations: number;
  readonly snapshots: number;
  readonly diffs: number;
  readonly hierarchies: number;
  readonly lastRequest: GeneratedEntityToolRequest | null;
  readonly lastFind: ApertureEntityFindReport | null;
  readonly lastGet: ApertureEntityGetReport | null;
  readonly lastMutation: ApertureEntitySetComponentFieldReport | null;
  readonly lastSnapshot: ApertureEntityLookupSnapshot | null;
  readonly lastDiff: ApertureEntitySnapshotDiff | null;
  readonly lastHierarchy: ApertureEntityHierarchyReport | null;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface GeneratedEntityToolBridge {
  handle(command: ApertureGeneratedCommand): boolean;
  call(tool: string, payload: unknown): GeneratedDevtoolsToolResult;
  summary(): GeneratedEntityToolStatus;
}

/** Editing support through devtools only; this is not general ECS immutability. */
export interface GeneratedComponentMutationAffordance {
  readonly tool: "ecs_set_component_field";
  readonly supported: boolean;
  readonly writableFields: readonly string[];
  readonly readOnlyFields: readonly string[];
  readonly fieldPathSyntax: "literal-top-level-field";
}

export interface GeneratedComponentSchema {
  readonly id: string;
  readonly description?: string;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return report.ok
          ? { ok: true, result: report }
          : { ok: false, diagnostics: [report.diagnostic], result: report };
      }

      if (tool === "ecs_set_component_field") {
        const request = setComponentRequestFromPayload(
          world,
          payload,
          lastFind,
          lastGet,
        );
        const report =
          "diagnostic" in request
            ? {
                ok: false as const,
                diagnostic: request.diagnostic,
              }
            : setApertureEntityComponentField(world, request);

        mutations += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastMutation = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return report.ok
          ? { ok: true, result: report }
          : { ok: false, diagnostics: [report.diagnostic], result: report };
      }

      if (tool === "ecs_snapshot") {
        const snapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            payload,
/sdk/source/render/src/rendering/authoring-validation-camera.ts
/sdk/source/render/src/rendering/authoring-components-camera-light.ts
/sdk/source/render/src/rendering/authoring-create-camera-light.ts
392:  readonly pixelRatio?: number;
401:  readonly defaultCamera?: boolean;
402:  readonly defaultLight?: boolean;
412:  readonly pixelRatio?: number;
```

Stderr:

```text

```

## Command fe0bc503ed3f41d3a38e83918164555f

2026-10-12T02:25:51.209508+00:00 → 2026-10-12T02:25:51.382318+00:00; exit 0; duration 0.173s.

Command:

```sh
sed -n "610,660p" /sdk/source/app/src/devtools/entities.ts; grep -n "function setComponentRequest" /sdk/source/app/src/devtools/entities.ts; sed -n "1,100p" /sdk/source/render/src/rendering/authoring-components-camera-light.ts; grep -n "shadow.*far\|cascade" /sdk/source/render/src/rendering/authoring-components-camera-light.ts | head -20; sed -n "1,130p" /sdk/source/render/src/rendering/authoring-create-camera-light.ts
```

Stdout:

```text
/**
 * Resolve the entity an entity-tool command should act on. Precedence:
 *
 * 1. An explicit `{ index, generation }` reference (top-level or under `entity`).
 * 2. A piped find-report payload (`{ summaries: [{ entity }] }`).
 * 3. A `{ key }` / `{ namePattern }` selector — resolved directly against the
 *    world. If the selector matches nothing we return a precise diagnostic and
 *    deliberately do NOT fall back to the last query's result: that returned a
 *    different, wrong entity (finding F3).
 * 4. No selector at all — operate on the last found/gotten entity, the
 *    documented convenience for chained calls.
 */
function resolveEntityRefFromPayload(
  world: EcsWorld,
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
  channel: string,
): ResolvedEntityRef {
  const record = isRecord(payload) ? payload : {};
  const explicit = entityRefFromValue(record["entity"] ?? record);

  if (explicit !== null) {
    return { ref: explicit };
  }

  const queryRef = firstEntityFromFindReportPayload(payload);
  if (queryRef !== null) {
    return { ref: queryRef };
  }

  const key = stringFromValue(record["key"]);
  const namePattern = stringFromValue(record["namePattern"]);
  if (key !== undefined || namePattern !== undefined) {
    const report = findApertureEntities(world, {
      ...(key === undefined ? {} : { key }),
      ...(namePattern === undefined ? {} : { namePattern }),
      limit: 1,
    });
    const ref = report.summaries[0]?.entity ?? null;

    if (ref !== null) {
      return { ref };
    }

    return {
      diagnostic: {
        code: "aperture.entityTools.entitySelectorNotFound",
        severity: "error",
        message: `No entity matched the requested ${
          key !== undefined
699:function setComponentRequestFromPayload(
import { EcsType, defineComponent } from "@aperture-engine/simulation";

import {
  AreaLightShape,
  CameraProjection,
  LightKind,
} from "./authoring-types.js";
import { tuple4 } from "./authoring-utils.js";

export const Camera = defineComponent(
  "aperture.render.camera",
  {
    projection: {
      type: EcsType.Enum,
      enum: CameraProjection,
      default: CameraProjection.Perspective,
    },
    fovYRadians: { type: EcsType.Float32, default: Math.PI / 3 },
    aspect: { type: EcsType.Float32, default: 1 },
    autoAspect: { type: EcsType.Boolean, default: true },
    near: { type: EcsType.Float32, default: 0.1 },
    far: { type: EcsType.Float32, default: 1000 },
    orthographicHeight: { type: EcsType.Float32, default: 10 },
    viewport: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
    scissor: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
    clearColor: { type: EcsType.Color, default: tuple4(0, 0, 0, 1) },
    clearDepth: { type: EcsType.Float32, default: 1 },
    clearStencil: { type: EcsType.Int32, default: 0 },
    clearFlags: { type: EcsType.Int32, default: 3 },
    layerMask: { type: EcsType.Int32, default: 1 },
    priority: { type: EcsType.Int32, default: 0 },
    renderTargetId: { type: EcsType.String, default: "" },
    frustumCulling: { type: EcsType.Boolean, default: true },
    temporalJitterX: { type: EcsType.Float32, default: 0 },
    temporalJitterY: { type: EcsType.Float32, default: 0 },
  },
  "Renderer-independent camera authoring component.",
);

export const Light = defineComponent(
  "aperture.render.light",
  {
    kind: {
      type: EcsType.Enum,
      enum: LightKind,
      default: LightKind.Directional,
    },
    shape: {
      type: EcsType.Enum,
      enum: AreaLightShape,
      default: AreaLightShape.Rect,
    },
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
    intensity: { type: EcsType.Float32, default: 1 },
    range: { type: EcsType.Float32, default: 10 },
    innerConeAngle: { type: EcsType.Float32, default: Math.PI / 8 },
    outerConeAngle: { type: EcsType.Float32, default: Math.PI / 6 },
    width: { type: EcsType.Float32, default: 2 },
    height: { type: EcsType.Float32, default: 2 },
    layerMask: { type: EcsType.Int32, default: 1 },
    environmentMapId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent light authoring component.",
);

export const LightCookie = defineComponent(
  "aperture.render.lightCookie",
  {
    textureId: { type: EcsType.String, default: "" },
    samplerId: { type: EcsType.String, default: "" },
    intensity: { type: EcsType.Float32, default: 1 },
  },
  "Renderer-independent local-light cookie request component.",
);

export const ShadowCaster = defineComponent(
  "aperture.render.shadowCaster",
  {
    enabled: { type: EcsType.Boolean, default: true },
  },
  "Marks an entity as eligible to cast shadows.",
);

export const ShadowReceiver = defineComponent(
  "aperture.render.shadowReceiver",
  {
    enabled: { type: EcsType.Boolean, default: true },
  },
  "Marks an entity as eligible to receive shadows.",
);

export const LightShadowSettings = defineComponent(
  "aperture.render.lightShadowSettings",
  {
    enabled: { type: EcsType.Boolean, default: false },
    mapSize: { type: EcsType.Int32, default: 1024 },
    bias: { type: EcsType.Float32, default: 0 },
    normalBias: { type: EcsType.Float32, default: 0 },
    cascadeCount: { type: EcsType.Int32, default: 1 },
    casterLayerMask: { type: EcsType.Int32, default: -1 },
99:    cascadeCount: { type: EcsType.Int32, default: 1 },
import {
  assetHandleKey,
  toVec4Tuple,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import {
  AreaLightShape,
  CameraProjection,
  LightKind,
  type CameraInput,
  type LightCookieInput,
  type LightInput,
  type LightShadowSettingsInput,
} from "./authoring-types.js";
import type {
  Camera,
  Light,
  LightCookie,
  LightShadowSettings,
} from "./authoring-components.js";

export function createCamera(
  input: CameraInput = {},
): ComponentInitialData<typeof Camera> {
  return {
    projection: input.projection ?? CameraProjection.Perspective,
    fovYRadians: input.fovYRadians ?? Math.PI / 3,
    aspect: input.aspect ?? 1,
    autoAspect: input.autoAspect ?? input.aspect === undefined,
    near: input.near ?? 0.1,
    far: input.far ?? 1000,
    orthographicHeight: input.orthographicHeight ?? 10,
    viewport: toVec4Tuple(input.viewport ?? [0, 0, 1, 1]),
    scissor: toVec4Tuple(input.scissor ?? [0, 0, 1, 1]),
    clearColor: toVec4Tuple(input.clearColor ?? [0, 0, 0, 1]),
    clearDepth: input.clearDepth ?? 1,
    clearStencil: input.clearStencil ?? 0,
    clearFlags: input.clearFlags ?? 3,
    layerMask: input.layerMask ?? 1,
    priority: input.priority ?? 0,
    renderTargetId: input.renderTargetId ?? "",
    frustumCulling: input.frustumCulling ?? true,
    temporalJitterX: input.temporalJitter?.[0] ?? 0,
    temporalJitterY: input.temporalJitter?.[1] ?? 0,
  };
}

export function createLight(
  input: LightInput = {},
): ComponentInitialData<typeof Light> {
  return {
    kind: input.kind ?? LightKind.Directional,
    shape: input.shape ?? AreaLightShape.Rect,
    color: toVec4Tuple(input.color ?? [1, 1, 1, 1]),
    intensity: input.intensity ?? 1,
    range: input.range ?? 10,
    innerConeAngle: input.innerConeAngle ?? Math.PI / 8,
    outerConeAngle: input.outerConeAngle ?? Math.PI / 6,
    width: input.width ?? 2,
    height: input.height ?? 2,
    layerMask: input.layerMask ?? 1,
    environmentMapId:
      input.environmentMap === undefined || input.environmentMap === null
        ? ""
        : assetHandleKey(input.environmentMap),
  };
}

export function createLightCookie(
  input: LightCookieInput,
): ComponentInitialData<typeof LightCookie> {
  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    intensity: input.intensity ?? 1,
  };
}

export function createLightShadowSettings(
  input: LightShadowSettingsInput = {},
): ComponentInitialData<typeof LightShadowSettings> {
  const center = input.center ?? [0, 0, 0];
  return {
    enabled: input.enabled ?? false,
    mapSize: input.mapSize ?? 1024,
    bias: input.bias ?? 0,
    normalBias: input.normalBias ?? 0,
    cascadeCount: input.cascadeCount ?? 1,
    casterLayerMask: input.casterLayerMask ?? -1,
    receiverLayerMask: input.receiverLayerMask ?? -1,
    shadowType: input.shadowType ?? 1,
    strength: input.strength ?? 1,
    filterRadius: input.filterRadius ?? 1,
    slopeBias: input.slopeBias ?? 0,
    centerX: center[0] ?? 0,
    centerY: center[1] ?? 0,
    centerZ: center[2] ?? 0,
    orthographicSize: input.orthographicSize ?? 0,
    near: input.near ?? 0,
    far: input.far ?? 0,
    lightDistance: input.lightDistance ?? 0,
  };
}
```

Stderr:

```text

```

## Command 2faa6305982b465980fefa8ea30e4063

2026-10-12T02:25:58.030870+00:00 → 2026-10-12T02:25:58.151149+00:00; exit 0; duration 0.120s.

Command:

```sh
sed -n "699,735p" /sdk/source/app/src/devtools/entities.ts; sed -n "100,125p" /sdk/source/render/src/rendering/authoring-components-camera-light.ts
```

Stdout:

```text
function setComponentRequestFromPayload(
  world: EcsWorld,
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
):
  | ApertureEntitySetComponentFieldRequest
  | { readonly diagnostic: ApertureEntityLookupDiagnostic } {
  const record = isRecord(payload) ? payload : {};
  const resolved = resolveEntityRefFromPayload(
    world,
    payload,
    lastFind,
    lastGet,
    APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
  );
  const component = stringFromValue(record["component"]);
  const field = stringFromValue(record["field"]);

  if ("diagnostic" in resolved) {
    return { diagnostic: resolved.diagnostic };
  }

  const entity = resolved.ref;

  if (component === undefined || field === undefined) {
    return {
      diagnostic: {
        code: "aperture.entityTools.invalidMutationRequest",
        severity: "error",
        message: "Entity mutation requires component and field string values.",
        data: {
          channel: APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
          hasComponent: component !== undefined,
          hasField: field !== undefined,
        },
        suggestedFix:
    casterLayerMask: { type: EcsType.Int32, default: -1 },
    receiverLayerMask: { type: EcsType.Int32, default: -1 },
    // Filtering mode: 0 = hard, 1 = PCF (default, matches the existing 3x3 box
    // filter), 2 = PCSS contact-hardening (consumed in M4-T7).
    shadowType: { type: EcsType.Int32, default: 1 },
    // Authored shadow opacity in [0,1]; 1 = fully dark capable (consumed in
    // M4-T4, replacing the hard-coded MIN_VISIBILITY floor).
    strength: { type: EcsType.Float32, default: 1 },
    // PCF/PCSS filter radius in texels (consumed in M4-T5/T7).
    filterRadius: { type: EcsType.Float32, default: 1 },
    // Slope-scaled depth bias for the caster pipeline (consumed in M4-T5).
    slopeBias: { type: EcsType.Float32, default: 0 },
    // Fixed directional shadow-camera center. Active when orthographicSize > 0.
    centerX: { type: EcsType.Float32, default: 0 },
    centerY: { type: EcsType.Float32, default: 0 },
    centerZ: { type: EcsType.Float32, default: 0 },
    // Fixed directional shadow-camera span. 0 keeps renderer auto-fit enabled.
    orthographicSize: { type: EcsType.Float32, default: 0 },
    // Fixed directional shadow-camera clip/depth placement. 0 means default.
    near: { type: EcsType.Float32, default: 0 },
    far: { type: EcsType.Float32, default: 0 },
    lightDistance: { type: EcsType.Float32, default: 0 },
  },
  "Renderer-independent per-light shadow request authoring component.",
);
```

Stderr:

```text

```

## Command 210ec7a99de4414c99c969744837536e

2026-10-12T02:26:12.525183+00:00 → 2026-10-12T02:26:12.694612+00:00; exit 0; duration 0.169s.

Command:

```sh
grep -R -n "baseColorTexture\|baseColorUv" /sdk/source/render/src/material | head -25; cat /sdk/source/app/src/systems/assets.ts | grep -n "texture(" | head -8; find /sdk/source/render/src -iname "*standard*" | head -10
```

Stdout:

```text
180:  texture(id: string): SystemTextureAssetHandle;
442:    texture(id) {
448:          "Use this.assets.texture() only with asset.texture() declarations.",
871:    "Check the asset.texture() colorSpace and semantic options in aperture.config.ts.",
/sdk/source/render/src/rendering/extraction-standard-material-validation.ts
/sdk/source/render/src/materials/standard-texture-readiness-expectations.ts
/sdk/source/render/src/materials/standard-texture-readiness-texture.ts
/sdk/source/render/src/materials/standard-sampler-fidelity-types.ts
/sdk/source/render/src/materials/standard-texture-sampler-alignment.ts
/sdk/source/render/src/materials/standard-texture-readiness-report.ts
/sdk/source/render/src/materials/standard-sampler-fidelity.ts
/sdk/source/render/src/materials/gltf-material-standard-fields.ts
/sdk/source/render/src/materials/standard-texture-readiness-inspection.ts
/sdk/source/render/src/materials/standard-sampler-fidelity-inspection.ts
```

Stderr:

```text
grep: /sdk/source/render/src/material: No such file or directory
```

## Command 979a670aba83417bb075721d0e26faa6

2026-10-12T02:30:23.646648+00:00 → 2026-10-12T02:30:25.124657+00:00; exit 0; duration 1.478s.

Command:

```sh
cat > /work/aperture.config.ts <<'EOF'
import { defineApertureConfig } from '@aperture-engine/app/config';
export default defineApertureConfig({
 mode:'browser',canvas:'#aperture',systems:[],
 render:{cadence:'manual',tonemap:'aces',exposure:1,sampleCount:4,pixelRatio:1,maxPixelRatio:1,defaultCamera:false,defaultLight:false,defaultEnvironment:true,clearColor:[0.63,0.75,0.88,1]},
 diagnostics:{level:'warn'}
});
EOF
cat > /work/src/main.js <<'EOF'
import { startGeneratedBrowserApp } from '@aperture-engine/app/browser';
import config from '../aperture.config.ts';
const canvas=document.createElement('canvas'); canvas.id='aperture'; canvas.width=1024;canvas.height=768;canvas.style.width='1024px';canvas.style.height='768px';document.body.append(canvas);
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
let geometryResolve;const geometryReady=new Promise(r=>geometryResolve=r);
worker.addEventListener('message',e=>{if(e.data?.type==='authored-geometry')geometryResolve(e.data.meshes);});
const appPromise=startGeneratedBrowserApp({config,workerEntry:worker});
const ready=appPromise.then(async app=>{await app.ready;await geometryReady;});
globalThis.__AGENT_BENCHMARK__={
 engine:'aperture',canvas,ready,
 async setCamera(c){await ready;const app=await appPromise;await app.request('camera_look_at',{key:'camera.main',translation:c.position,lookAt:c.target});for(const [field,value] of [['fovYRadians',c.fovYDegrees*Math.PI/180],['near',c.near],['far',c.far]]){const r=await app.requestRaw('ecs_set_component_field',{key:'camera.main',component:'aperture.render.camera',field,value});if(!r.ok)throw new Error(JSON.stringify(r.diagnostics));}},
 async renderFrame(f){await ready;await (await appPromise).renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds});},
 async inspectGeometry(){await ready;return {meshes:await geometryReady};},
 async dispose(){await (await appPromise).dispose();}
};
EOF
cat > /work/src/worker.ts <<'EOF'
import { startGeneratedSimulationWorker } from '@aperture-engine/app/worker';
import config from '../aperture.config';
import Setup from './scene';
startGeneratedSimulationWorker({config,systems:[{default:Setup}]});
EOF
cat > /work/src/scene.ts <<'EOF'
import {createSystem,material} from '@aperture-engine/app/systems';
import {createTriangleListMeshAsset} from '@aperture-engine/render';
type V=number[];
const add=(a:V,b:V)=>a.map((v,i)=>v+b[i]);
const sub=(a:V,b:V)=>a.map((v,i)=>v-b[i]);
const mul=(a:V,s:number)=>a.map(v=>v*s);
const cross=(a:V,b:V)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V)=>mul(a,1/Math.hypot(...a));
let seed=44129;function rand(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const batches=new Map<string,{p:V[],n:V[],uv:V[],col:string,rough:number,metal:number}>();
function mat(id:string,col:string,rough=.85,metal=0){batches.set(id,{p:[],n:[],uv:[],col,rough,metal});}
function tri(id:string,a:V,b:V,c:V,n?:V[],uv?:V[]){const m=batches.get(id)!;const norm=unit(cross(sub(b,a),sub(c,a)));if(!Number.isFinite(norm[0]))throw Error('degenerate '+id);m.p.push(a,b,c);m.n.push(...(n??[norm,norm,norm]));m.uv.push(...(uv??[[0,0],[1,0],[1,1]]));}
function quad(id:string,a:V,b:V,c:V,d:V){tri(id,a,b,c);tri(id,a,c,d);}
function box(id:string,c:V,s:V,fn?:(v:V)=>V){
 const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>{const p=v.map((x,i)=>x*s[i]/2+c[i]);return fn?fn(p):p;});
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(id,...f.map(i=>v[i]) as [V,V,V,V]);
}
function ellipsoid(id:string,c:V,r:V,seg=10,rows=7){
 const p=(a:number,b:number)=>add(c,[r[0]*Math.sin(b)*Math.cos(a),r[1]*Math.cos(b),r[2]*Math.sin(b)*Math.sin(a)]);
 const n=(a:number,b:number)=>unit([Math.sin(b)*Math.cos(a)/r[0],Math.cos(b)/r[1],Math.sin(b)*Math.sin(a)/r[2]]);
 for(let j=0;j<rows;j++)for(let i=0;i<seg;i++){const a=i*2*Math.PI/seg,A=(i+1)*2*Math.PI/seg,b=j*Math.PI/rows,B=(j+1)*Math.PI/rows;const vs=[p(a,b),p(a,B),p(A,B),p(A,b)],ns=[n(a,b),n(a,B),n(A,B),n(A,b)];if(j>0)tri(id,vs[0],vs[1],vs[3],[ns[0],ns[1],ns[3]]);if(j<rows-1)tri(id,vs[1],vs[2],vs[3],[ns[1],ns[2],ns[3]]);}
}
function rod(id:string,a:V,b:V,r:number,R=r,seg=10){
 const y=unit(sub(b,a)),x=unit(cross(y,Math.abs(y[1])<.9?[0,1,0]:[1,0,0])),z=cross(x,y);
 const circle=(c:V,rr:number,t:number)=>add(c,add(mul(x,rr*Math.cos(t)),mul(z,rr*Math.sin(t))));
 for(let i=0;i<seg;i++){let t=i*2*Math.PI/seg,T=(i+1)*2*Math.PI/seg,p=circle(a,r,t),q=circle(a,r,T),s=circle(b,R,T),v=circle(b,R,t);quad(id,p,q,s,v);tri(id,a,q,p);tri(id,b,v,s);}
}
function beam(id:string,a:V,b:V,w:number,d=w){
 const y=unit(sub(b,a)),x=unit(cross(y,Math.abs(y[1])<.9?[0,1,0]:[1,0,0])),z=cross(x,y),c=mul(add(a,b),.5);
 box(id,[0,0,0],[w,Math.hypot(...sub(b,a)),d],p=>add(c,add(mul(x,p[0]),add(mul(y,p[1]),mul(z,p[2])))));
}
function tile(id:string,x:number,z0:number,z1:number,y0:number,y1:number,width=.28){
 const r=width*.5,th=.022,axis=unit([0,y1-y0,z1-z0]),normal=unit(cross([1,0,0],axis)),center0=[x,y0,z0],center1=[x,y1,z1];
 const p=(c:V,t:number,R:number)=>add(c,add([R*Math.cos(t),0,0],mul(normal,R*Math.sin(t))));
 for(let s=0;s<6;s++){const t=s*Math.PI/6,T=(s+1)*Math.PI/6;const a=p(center0,t,r),b=p(center0,T,r),c=p(center1,T,r),d=p(center1,t,r);quad(id,a,b,c,d);quad(id,p(center0,t,r-th),p(center1,t,r-th),p(center1,T,r-th),p(center0,T,r-th));quad(id,b,a,p(center0,t,r-th),p(center0,T,r-th));quad(id,d,c,p(center1,T,r-th),p(center1,t,r-th));}
}
function wallFace(u0:number,u1:number,y0:number,y1:number,holes:number[][],fn:(p:V)=>V){
 const xs=[u0,u1,...holes.flatMap(h=>[h[0],h[1]])].sort((a,b)=>a-b),ys=[y0,y1,...holes.flatMap(h=>[h[2],h[3]])].sort((a,b)=>a-b);
 const X=[...new Set(xs)],Y=[...new Set(ys)];
 for(let i=0;i<X.length-1;i++)for(let j=0;j<Y.length-1;j++){const x=(X[i]+X[i+1])/2,y=(Y[j]+Y[j+1])/2;if(holes.some(h=>x>h[0]&&x<h[1]&&y>h[2]&&y<h[3]))continue;box('stucco',[x,y,-.14],[X[i+1]-X[i],Y[j+1]-Y[j],.28],fn);}
}
function windowPart(u:number,y:number,w:number,h:number,fn:(p:V)=>V){
 box('inside',[u,y,-.21],[w,h,.075],fn);
 box('glass',[u,y,-.14],[w-.14,h-.14,.025],fn);
 for(const [x,Y,W,H] of [[u-w/2+.045,y,.09,h],[u+w/2-.045,y,.09,h],[u,y-h/2+.045,w,.09],[u,y+h/2-.045,w,.09],[u,y,.055,h],[u,y-.06,w,.045]])box('frame',[x,Y,-.015],[W,H,.09],fn);
 box('sill',[u,y-h/2-.11,.035],[w+.24,.16,.33],fn);
 // Interior curtains behind the glazing and small planter silhouettes.
 for(const x of [u-w*.34,u+w*.34])box('curtain',[x,y,-.16],[w*.12,h-.21,.025],fn);
 box('pot',[u-.26,y-h/2+.11,-.085],[.2,.23,.09],fn);
 ellipsoid('leaf2',fn([u-.26,y-h/2+.36,-.05]),[.13,.2,.05],8,5);
}
function roofSurface(x0:number,x1:number,z0:number,z1:number,y0:number,y1:number,step=.29){
 quad('roofbase',[x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1]);
 const rows=Math.ceil(Math.abs(z1-z0)/.4);for(let i=0;i<Math.ceil((x1-x0)/step);i++)for(let j=0;j<rows;j++){const t=j/rows,T=Math.min(1,(j+1.08)/rows),z=z0+(z1-z0)*t,Z=z0+(z1-z0)*T;tile('tile'+((i*5+j*3)%5),x0+step*.5+i*step,z,Z,y0+(y1-y0)*t+.045,y0+(y1-y0)*T+.045,step*.96);}
}
function bush(x:number,z:number,r=.6,height=.7){
 for(let k=0;k<10;k++){const a=rand()*Math.PI*2,rr=rand()*r,c=[x+Math.cos(a)*rr,.35+height*(.45+rand()*.4),z+Math.sin(a)*rr];ellipsoid('leaf'+(k%4),c,[r*(.32+rand()*.18),height*(.3+rand()*.2),r*(.32+rand()*.18)],9,6);}
}
function tree(x:number,z:number,size=1){
 rod('bark',[x,.22,z],[x+.16*size,2.15*size,z],.16*size,.09*size,10);
 for(let j=0;j<7;j++){const a=j*2.4,tip=[x+Math.cos(a)*.95*size,(2.4+rand()*.6)*size,z+Math.sin(a)*.9*size];rod('bark',[x+.12*size,1.3*size,z],tip,.07*size,.025*size,8);}
 for(let k=0;k<32;k++){const a=rand()*6.283,b=rand()*Math.PI,r=1.25*size;ellipsoid('leaf'+(k%4),[x+Math.cos(a)*Math.sin(b)*r,(2.6+Math.cos(b)*.65)*size,z+Math.sin(a)*Math.sin(b)*r],[.46*size,.35*size,.43*size],9,6);}
}
function cypress(x:number,z:number,h=4){
 rod('bark',[x,.2,z],[x,h*.7,z],.09,.055,8);
 for(let i=0;i<9;i++)ellipsoid('leaf'+(i%3),[x+.05*Math.sin(i),.5+h*(i+.4)/10,z],[.55*(1-i/11),h*.19,.48*(1-i/11)],9,6);
}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export default class Setup extends createSystem({priority:0}){
 init(){
 mat('stucco','#ead9b5');mat('sill','#baad91');mat('inside','#171e21');mat('frame','#323c40',.47,.15);mat('glass','#547082',.16,.35);mat('curtain','#c6bda1');mat('roofbase','#714022');
 ['#b76630','#aa5528','#c77b3e','#b95e2b','#ce8044'].forEach((c,i)=>mat('tile'+i,c,.75));
 mat('wood','#67533d');mat('door','#424d53',.62);mat('pot','#ab6438');mat('bark','#756044');
 ['#4b602a','#687a38','#7c843e','#435729'].forEach((c,i)=>mat('leaf'+i,c,.97));
 mat('grass','#7c813e');mat('grass2','#96984e');mat('dirt','#89775a');mat('asphalt','#4d5052');
 mat('mortar','#9b947e');['#bab296','#c9c0a5','#aca68d','#d1c5a6','#bcb29d'].forEach((c,i)=>mat('stone'+i,c));
 mat('paver','#c3bea9');mat('paver2','#b1ad99');mat('white','#d7d7c4');mat('lavender','#8c7eac');mat('flower','#c7ba6b');
 mat('blue','#1f5c97',.24,.32);mat('blue2','#336dac',.23,.3);mat('black','#151b21',.65);
 mat('chrome','#aeb4b5',.22,.8);mat('carGlass','#2f485a',.13,.45);mat('headlight','#e5e1c2',.22,.18);mat('red','#a82721',.27);mat('seat','#756e60');mat('plate','#c4c4b7');
 // Sun and normal ECS camera. Environment provides soft sky fill.
 this.spawn.camera({key:'camera.main',transform:{translation:[14,9,19],lookAt:[0,2.5,1]},fovYDegrees:37,camera:{near:.1,far:200,aspect:4/3,autoAspect:false}});
 this.spawn.light({key:'light.sun',kind:'directional',color:[1,.86,.68,1],intensity:3.1,transform:{rotationEulerDegrees:[-49,-43,0]},shadow:{enabled:true,mapSize:2048,cascadeCount:1,shadowType:1,strength:.84,filterRadius:1.8,normalBias:.02,center:[0,3,0],orthographicSize:32,near:.1,far:65,lightDistance:30}});
 this.spawn.light({key:'light.fill',kind:'ambient',color:[.68,.79,1,1],intensity:.16});
 box('dirt',[0,-.3,0],[40,.5,40]);box('grass',[-1,.02,-1],[21,.12,21]);
 // Road: a smooth bend from the front to the right of the house.
 const path:V[]=[];for(let i=0;i<=60;i++){const t=i/60;let x,z;if(t<.5){const u=t*2;x=-16+22*u;z=9-.25*Math.sin(u*Math.PI);}else{const u=(t-.5)*2;x=6+7.3*Math.sin(u*Math.PI/2);z=9-25*(1-Math.cos(u*Math.PI/2));}path.push([x,.04,z]);}
 const edge=(i:number,off:number)=>{const d=unit(sub(path[Math.min(i+1,60)],path[Math.max(i-1,0)]));return add(path[i],[d[2]*off,0,-d[0]*off]);};
 for(let i=0;i<60;i++){
   const a=edge(i,-2.2),b=edge(i+1,-2.2),c=edge(i+1,2.2),d=edge(i,2.2);quad('asphalt',a,d,c,b);
   const A=edge(i,2.24),B=edge(i+1,2.24),C=edge(i+1,3.14),D=edge(i,3.14);A[1]=B[1]=C[1]=D[1]=.19;quad('paver',A,D,C,B);quad('stone1',edge(i,2.24),A,B,edge(i+1,2.24));
 }
 // Curbstones, sidewalk seams, and broken center markings.
 for(let i=0;i<60;i++){const a=edge(i,2.17),b=edge(i+1,2.17);a[1]=b[1]=.15;beam('stone'+(i%5),a,b,.17,.22);if(i%3===0){const A=edge(i,-.18),B=edge(Math.min(i+1,60),-.18),C=edge(Math.min(i+1,60),.18),D=edge(i,.18);for(const p of [A,B,C,D])p[1]=.047;quad('white',A,D,C,B);}}
 // Asphalt aggregate flecks.
 for(let i=0;i<2700;i++){const k=Math.floor(rand()*59),o=-2.1+rand()*4.1,p=edge(k,o);p[0]+=rand()*.3;p[1]=.047;const s=.007+rand()*.017;tri(i%2?'stone2':'black',[p[0]-s,p[1],p[2]],[p[0],p[1],p[2]+s],[p[0]+s,p[1],p[2]]);}
 // Inset house walls, with genuine openings and deep reveals.
 const front=(p:V)=>[p[0],p[1],3.06+p[2]],back=(p:V)=>[-p[0],p[1],-3.06-p[2]],right=(p:V)=>[4.04+p[2],p[1],-p[0]],left=(p:V)=>[-4.04-p[2],p[1],p[0]];
 const holes=[[-2.92,-1.62,.86,2.35],[1.54,2.84,.86,2.35],[-2.8,-1.35,4.12,5.65],[1.48,2.93,4.12,5.65],[-.53,.63,.3,2.53]];
 wallFace(-4,4,.28,6.3,holes,front);
 for(const h of holes.slice(0,4))windowPart((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],front);
 for(const f of [right,left]){const hs=[[-2.08,-1.05,.92,2.35],[1.25,2.25,.92,2.35],[-2.06,-1.12,4.17,5.55],[1.22,2.16,4.17,5.55]];wallFace(-3.06,3.06,.28,6.3,hs,f);for(const h of hs)windowPart((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],f);tri('stucco',f([-3.06,6.3,0]),f([3.06,6.3,0]),f([0,8.22,0]));}
 const bh=[[-2.9,-1.5,4.15,5.65],[1.5,2.9,4.15,5.65],[-2.7,-1.3,1.15,2.5],[1.4,2.7,1.15,2.5]];wallFace(-4,4,.28,6.3,bh,back);for(const h of bh)windowPart((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],back);
 box('sill',[0,.23,0],[8.16,.3,6.2]);
 box('door',[.05,1.4,2.91],[1.1,2.24,.15]);for(const x of [-.24,.32])for(const y of [.86,1.95])box('frame',[x,y,3.0],[.41,.7,.035]);rod('chrome',[-.36,1.25,3.04],[-.36,1.4,3.04],.027,.027,8);
 // Main terracotta roof and timber fascia.
 roofSurface(-4.46,4.46,3.49,0,6.31,8.25);roofSurface(-4.46,4.46,0,-3.49,8.25,6.31);
 for(const z of [-3.49,3.49])box('wood',[0,6.25,z],[9.05,.19,.15]);
 for(const x of [-4.46,4.46]){beam('wood',[x,6.3,-3.5],[x,8.24,0],.15);beam('wood',[x,8.24,0],[x,6.3,3.5],.15);}
 for(let i=0;i<28;i++)rod('tile2',[-4.45+i*.32,8.28,0],[-4.12+i*.32,8.28,0],.17,.17,10);
 for(const x of [-3.92,3.92]){rod('frame',[x,6.19,3.43],[x,5.92,3.38],.055);rod('frame',[x,5.92,3.38],[x,.3,3.2],.055);}
 // Chimney with an open cap and roof-tile lid.
 box('stucco',[2.5,8.4,-.85],[.72,1.7,.65]);box('sill',[2.5,9.13,-.85],[.9,.16,.83]);for(const x of [2.19,2.81])for(const z of [-1.13,-.57])box('stucco',[x,9.32,z],[.13,.36,.13]);box('inside',[2.5,9.17,-.85],[.59,.03,.49]);box('tile2',[2.5,9.52,-.85],[1.03,.13,.94]);
 // Covered porch, two posts, stone steps and light.
 box('paver',[0,.31,3.92],[5.4,.28,1.94]);box('paver2',[0,.17,4.96],[3.35,.2,.44]);box('paver',[0,.08,5.26],[2.85,.16,.38]);
 for(const x of [-2.22,2.22]){box('stucco',[x,1.64,4.51],[.29,2.65,.34]);box('sill',[x,.4,4.51],[.42,.16,.47]);box('sill',[x,2.92,4.51],[.44,.16,.47]);}
 box('wood',[0,2.97,4.52],[5.3,.22,.2]);box('wood',[0,3.17,3.18],[5.3,.18,.18]);roofSurface(-2.65,2.65,4.8,3.1,3.07,3.67,.28);box('wood',[0,3.01,4.82],[5.5,.12,.12]);
 box('frame',[-.96,2.15,3.18],[.06,.44,.06]);box('headlight',[-.96,2.14,3.22],[.14,.22,.15]);box('frame',[-.96,2.32,3.22],[.21,.045,.21]);
 // Low stone garden boundary with a front entry.
 const masonry=(a:V,b:V,h=.86)=>{const len=Math.hypot(...sub(b,a)),d=unit(sub(b,a)),n=[-d[2],0,d[0]],mid=mul(add(a,b),.5);box('mortar',[mid[0],h*.5+.17,mid[2]],[len,h,.33],p=>[mid[0]+(p[0]-mid[0])*d[0]+(p[2]-mid[2])*n[0],p[1],mid[2]+(p[0]-mid[0])*d[2]+(p[2]-mid[2])*n[2]]);
 for(let row=0;row<3;row++){const count=Math.ceil(len/.61);for(let j=0;j<count;j++){const t=(j+.5)/count,pos=add(a,mul(sub(b,a),t));box('stone'+((j+row*2)%5),[0,.18+(row+.5)*h/3,0],[len/count-.045,h/3-.035,.38],p=>[pos[0]+p[0]*d[0]+p[2]*n[0],p[1],pos[2]+p[0]*d[2]+p[2]*n[2]]);}}beam('stone1',[a[0],h+.2,a[2]],[b[0],h+.2,b[2]],.42,.13);};
 masonry([-9,.2,6.52],[-1.4,.2,6.52]);masonry([1.4,.2,6.52],[6.5,.2,6.52]);masonry([6.5,.2,6.52],[8.2,.2,4.9]);masonry([8.2,.2,4.9],[9.1,.2,1.1]);masonry([9.1,.2,1.1],[9.1,.2,-7]);
 for(const x of [-1.55,1.55]){for(let j=0;j<5;j++)box('stone'+j%5,[x,.17+(j+.5)*.27,6.52],[.51,.245,.52]);box('stone1',[x,1.57,6.52],[.68,.15,.67]);}
 // Irregular stone path from the garden gate to the porch.
 for(let row=0;row<8;row++)for(let j=0;j<4;j++){const x=-1.06+j*.55+(row%2?.09:-.04),z=5.1+row*.25;box((row+j)%2?'paver':'paver2',[x,.145,z],[.49+rand()*.05,.12,.22]);}
 // Right driveway, individual pavers.
 for(let i=0;i<8;i++)for(let j=0;j<16;j++)box((i+j)%3?'paver':'paver2',[4.3+i*.43,.13,5.8-j*.6],[.4,.13,.55]);
 // Mailbox: arched top, opening, post and flag.
 box('wood',[-1.93,.62,6.84],[.1,1.1,.11]);box('frame',[-1.93,1.25,6.84],[.42,.28,.56]);ellipsoid('frame',[-1.93,1.39,6.84],[.21,.14,.28],12,6);box('inside',[-1.93,1.24,7.135],[.29,.035,.01]);box('plate',[-1.93,1.31,7.141],[.15,.07,.01]);box('red',[-1.69,1.42,6.84],[.022,.18,.035]);
 // Terracotta pots and plants around the door.
 for(const [x,z,r] of [[-1.25,4.05,.26],[.92,4.02,.23],[3.19,3.91,.31]]){
 rod('pot',[x,.35,z],[x,.79,z],r*.75,r,14);rod('pot',[x,.78,z],[x,.84,z],r*1.08,r*1.08,14);rod('dirt',[x,.837,z],[x,.85,z],r*.9,r*.9,12);bush(x,z,r*1.6,.75);
 }
 // Garden clusters, olive trees, narrow cypresses and lavender borders.
 tree(-6.4,3.95,1.34);tree(7.5,-3.9,1.05);tree(-7,-5.3,1.3);
 cypress(-7.7,-2.2,5.7);cypress(-6.0,-6.9,4.8);cypress(6.0,-7.5,4.5);
 for(const [x,z,r] of [[-8.2,5.8,.7],[-5.8,6,.7],[-3.7,5.9,.55],[3.3,5.9,.55],[6.3,5.8,.7],[7.9,4.3,.6],[8.7,2.1,.7],[-3.4,3.8,.5],[3.5,3.65,.6],[4.7,-1.8,.5]])bush(x,z,r,.73);
 for(let j=0;j<20;j++){const x=-4.8+rand()*9.6,z=3.5+rand()*2.35;if(Math.abs(x)<1.3)continue;for(let k=0;k<4;k++){const xx=x+(rand()-.5)*.25,zz=z+(rand()-.5)*.25;rod('leaf1',[xx,.16,zz],[xx,.62,zz],.022,.012,5);ellipsoid('lavender',[xx,.62,zz],[.065,.16,.065],6,5);}}
 for(let i=0;i<1800;i++){const x=-9.1+rand()*18,z=-7.8+rand()*14;if(Math.abs(x)<4.2&&Math.abs(z)<3.3||Math.abs(x)<1.3&&z>3||x>4&&z>1)continue;const h=.035+rand()*.1;tri(i%4?'grass':'grass2',[x-.013,.095,z],[x,.095+h,z],[x+.013,.095,z+.01]);}
 // Blue hatchback; all components are authored geometry.
 this.car();
 const meshes:any[]=[];
 for(const [id,b] of batches){if(!b.p.length)continue;const asset=createTriangleListMeshAsset({label:id,positions:b.p as any,normals:b.n as any,uvs:b.uv as any});const handle=this.meshes.publish('scene.'+id,asset).handle;this.spawn.mesh({key:'scene.'+id,mesh:handle,material:material.standard({baseColor:b.col,roughness:b.rough,metallic:b.metal}),castShadow:!['asphalt','grass','grass2'].includes(id),receiveShadow:true});
 const s=asset.vertexStreams[0],data=s.data as Float32Array,step=s.arrayStride/4,positions=new Float32Array(s.vertexCount*3),normals=new Float32Array(s.vertexCount*3);for(let i=0;i<s.vertexCount;i++){positions.set(data.subarray(i*step,i*step+3),i*3);normals.set(data.subarray(i*step+3,i*step+6),i*3);}meshes.push({id,positions,normals,worldMatrix:identity,...(asset.indexBuffer?{indices:asset.indexBuffer.data}:{})});}
 globalThis.postMessage({type:'authored-geometry',meshes});
 }
 car(){
 const C=[3.45,.15,8.62],angle=-.12;
 const F=(p:V)=>[C[0]+p[0]*Math.cos(angle)+p[2]*Math.sin(angle),C[1]+p[1],C[2]-p[0]*Math.sin(angle)+p[2]*Math.cos(angle)];
 const B=(id:string,c:V,s:V)=>box(id,c,s,F),Q=(id:string,a:V,b:V,c:V,d:V)=>quad(id,F(a),F(b),F(c),F(d)),R=(id:string,a:V,b:V,r:number,r2=r,seg=12)=>rod(id,F(a),F(b),r,r2,seg);
 // A body loft with rounded front/rear corners and a sculpted hood.
 const sections=[[-2.2,.75,.44,.68],[-2.02,.91,.38,.91],[-1.4,.95,.37,1.0],[-.65,.96,.38,1.02],[.65,.97,.38,1.03],[1.66,.92,.4,1.03],[2.1,.82,.45,.93]];
 const ring=(s:V)=>{const [x,w,lo,hi]=s;return [[x,lo,-w*.83],[x,lo+.14,-w],[x,hi-.15,-w],[x,hi,-w*.77],[x,hi,w*.77],[x,hi-.15,w],[x,lo+.14,w],[x,lo,w*.83]];};
 for(let i=0;i<sections.length-1;i++){const a=ring(sections[i]),b=ring(sections[i+1]);for(let j=0;j<8;j++)Q(j===3?'blue2':'blue',a[j],a[(j+1)%8],b[(j+1)%8],b[j]);}
 const a=ring(sections[0]),b=ring(sections[sections.length-1]);for(let j=1;j<a.length-1;j++){tri('blue',F(a[0]),F(a[j+1]),F(a[j]));tri('blue',F(b[0]),F(b[j]),F(b[j+1]));}
 // Cabin silhouette, roof, front windscreen and rear hatch glass.
 const cab=[[-.76,1.02,-.82],[-.05,1.72,-.73],[1.26,1.73,-.73],[1.87,1.06,-.83],[-.76,1.02,.82],[-.05,1.72,.73],[1.26,1.73,.73],[1.87,1.06,.83]];
 for(const face of [[0,1,2,3],[4,7,6,5],[1,5,6,2],[0,4,5,1],[2,6,7,3]])Q('blue',...face.map(i=>cab[i]) as [V,V,V,V]);
 Q('carGlass',[-.735,1.055,-.745],[-.04,1.68,-.67],[-.04,1.68,.67],[-.735,1.055,.745]);
 Q('carGlass',[1.29,1.68,-.66],[1.835,1.09,-.745],[1.835,1.09,.745],[1.29,1.68,.66]);
 for(const s of [-1,1]){
 Q('carGlass',[-.63,1.075,s*.829],[-.04,1.665,s*.75],[.52,1.67,s*.75],[.53,1.073,s*.935]);
 Q('carGlass',[.64,1.073,s*.935],[.64,1.67,s*.75],[1.23,1.67,s*.75],[1.71,1.073,s*.84]);
 B('black',[.58,1.4,s*.847],[.065,.62,.035]);B('blue',[.13,.9,s*.967],[.97,.07,.015]);B('blue',[1.15,.91,s*.94],[.93,.07,.015]);
 R('black',[.57,.46,s*.982],[.57,1.04,s*.982],.012,.012,6);R('black',[-.66,.48,s*.962],[-.66,1.04,s*.962],.009,.009,6);
 R('black',[1.73,.49,s*.924],[1.73,1.07,s*.924],.01,.01,6);
 B('black',[.25,.995,s*.989],[.18,.035,.04]);B('black',[1.28,.995,s*.958],[.17,.035,.04]);
 R('black',[-.55,1.15,s*.88],[-.52,1.16,s*1.085],.038);ellipsoid('blue',F([-.51,1.2,s*1.11]),[.17,.075,.1],12,6);
 B('black',[0,.42,s*.952],[3.47,.09,.04]);
 }
 B('seat',[.14,1.14,0],[.25,.58,1.12]);B('seat',[1.13,1.15,0],[.18,.48,1.1]);
 // Four tires, alloy rims, lug centers and ten thin spokes per wheel.
 for(const x of [-1.36,1.4])for(const z of [-.98,.98]){
 const s=Math.sign(z),w=.19,y=.48;
 const profile=[[.32,-w*.55],[.42,-w*.5],[.49,-w*.24],[.49,w*.24],[.43,w*.5],[.32,w*.55]];
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<32;i++){const t=i*2*Math.PI/32,T=(i+1)*2*Math.PI/32,p=(k:number,a:number)=>[x+profile[k][0]*Math.cos(a),y+profile[k][0]*Math.sin(a),z+profile[k][1]];Q('black',p(j,t),p(j,T),p(j+1,T),p(j+1,t));}
 R('black',[x,y,z-w*.45],[x,y,z+w*.45],.34,.34,24);
 R('chrome',[x,y,z+s*.08],[x,y,z+s*.104],.33,.33,24);R('black',[x,y,z+s*.109],[x,y,z+s*.116],.27,.27,24);
 for(let i=0;i<10;i++){const t=i*6.283/10;R('chrome',[x+.07*Math.cos(t),y+.07*Math.sin(t),z+s*.13],[x+.30*Math.cos(t+.12),y+.30*Math.sin(t+.12),z+s*.13],.019,.014,7);}
 R('chrome',[x,y,z+s*.13],[x,y,z+s*.145],.076,.076,12);
 // Painted wheel arch lip above each tire.
 for(let i=0;i<16;i++){let t=i*Math.PI/16,T=(i+1)*Math.PI/16;Q('blue',[x+.53*Math.cos(t),y+.53*Math.sin(t),z-s*.02],[x+.56*Math.cos(t),y+.56*Math.sin(t),z-s*.02],[x+.56*Math.cos(T),y+.56*Math.sin(T),z-s*.02],[x+.53*Math.cos(T),y+.53*Math.sin(T),z-s*.02]);}
 }
 // Front grille, headlamps, bumper intake and badge.
 B('black',[-2.21,.69,0],[.025,.17,1.13]);B('chrome',[-2.23,.79,0],[.027,.035,1.19]);
 for(const y of [.64,.69,.74])B('chrome',[-2.235,y,0],[.025,.011,1.08]);
 B('black',[-2.202,.46,0],[.035,.16,1.17]);B('plate',[-2.245,.55,0],[.029,.1,.52]);
 for(const z of [-.66,.66]){B('headlight',[-2.145,.77,z],[.045,.18,.38]);B('chrome',[-2.172,.72,z],[.021,.027,.39]);B('black',[-2.17,.46,z],[.05,.16,.25]);B('headlight',[-2.2,.46,z],[.023,.065,.10]);B('red',[2.094,.9,z],[.06,.24,.25]);}
 R('chrome',[-2.25,.74,0],[-2.26,.74,0],.065,.065,16);
 B('black',[2.107,.49,0],[.027,.12,1.28]);B('plate',[2.14,.74,0],[.022,.11,.49]);
 B('blue',[1.4,1.75,0],[.21,.065,1.55]);R('black',[.77,1.78,0],[.93,2.08,0],.011,.006,7);
 // Wipers on glass.
 R('black',[-.719,1.069,-.49],[-.52,1.24,-.10],.009,.009,6);R('black',[-.719,1.069,.10],[-.52,1.24,.51],.009,.009,6);
 }
}
EOF
cat > /work/index.html <<'EOF'
<!doctype html><html><head><meta charset="UTF-8"><title>Ivory villa at the bend</title><style>html,body{margin:0;width:1024px;height:768px;overflow:hidden;background:#a8bfd3}canvas{display:block}</style></head><body><script type="module" src="/src/main.js"></script></body></html>
EOF
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 855 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.30 kB │ gzip:   0.25 kB
dist/assets/worker-DpRzAScX.js  3,140.80 kB
dist/assets/audio-CadhuYPU.js      18.89 kB │ gzip:   7.07 kB
dist/assets/index-BHBYIXkW.js   1,511.05 kB │ gzip: 376.48 kB

✓ built in 852ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Preview 1

Status: ok; recorder-measured coordinator wait: 36.956s.

## Public preview 1 feedback

Status: ok.

## Public note — 2026-10-12T02:31:20.119707+00:00

```
Inspecting preview 1 canonical, left-orbit and rear-orbit views for framing, lighting and geometry correctness.
```

## Command 3c8e63d306fb449faaecc667806350cc

2026-10-12T02:32:30.481885+00:00 → 2026-10-12T02:32:30.651798+00:00; exit 0; duration 0.170s.

Command:

```sh
grep -R -n "baseColorTexture\|baseColorUv" /sdk/source/render/src/materials | head -35; sed -n "160,195p" /sdk/source/app/src/systems/assets.ts; grep -n "interface SystemTexture" /sdk/source/app/src/systems/assets.ts; grep -R -n "StandardMaterialPatch" /sdk/source/render/src/materials/types* | head -10; find /sdk/source/render/src/materials -maxdepth 1 -type f | head -25
```

Stdout:

```text
/sdk/source/render/src/materials/standard-texture-readiness-expectations.ts:5:    field: "baseColorTexture",
/sdk/source/render/src/materials/standard-texture-sampler-alignment.ts:30:  "baseColorTexture",
/sdk/source/render/src/materials/factories.ts:54:    baseColorTexture: input.baseColorTexture ?? null,
/sdk/source/render/src/materials/factories.ts:98:    baseColorTexture: input.baseColorTexture ?? null,
/sdk/source/render/src/materials/types.ts:140:  readonly baseColorTexture: MaterialTextureBinding | null;
/sdk/source/render/src/materials/types.ts:152:  readonly baseColorTexture: MaterialTextureBinding | null;
/sdk/source/render/src/materials/gltf-texture-result.ts:133:    case "baseColorTexture":
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:34:  | "baseColorTexture"
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:46:    baseColorTexture: mapTextureBinding({
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:48:      slot: "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:49:      field: "pbrMetallicRoughness.baseColorTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:50:      value: input.pbrSource.baseColorTexture,
/sdk/source/render/src/materials/unlit-packing.ts:29:  readonly baseColorTextureKey: string | null;
/sdk/source/render/src/materials/unlit-packing.ts:64:    material.baseColorTexture,
/sdk/source/render/src/materials/unlit-packing.ts:90:    return { baseColorTextureKey: null, baseColorSamplerKey: null };
/sdk/source/render/src/materials/unlit-packing.ts:96:      field: "baseColorTexture.texture",
/sdk/source/render/src/materials/unlit-packing.ts:104:      field: "baseColorTexture.sampler",
/sdk/source/render/src/materials/unlit-packing.ts:110:    baseColorTextureKey:
/sdk/source/render/src/materials/standard-sampler-fidelity-inspection.ts:19:  "baseColorTexture",
/sdk/source/render/src/materials/standard-proof-point.ts:5:  | "baseColorTexture"
/sdk/source/render/src/materials/standard-proof-point.ts:42:    "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-types.ts:8:  | "baseColorTexture"
/sdk/source/render/src/materials/gltf-material-builders.ts:51:    baseColorTexture: mapTextureBinding({
/sdk/source/render/src/materials/gltf-material-builders.ts:53:      slot: "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-builders.ts:54:      field: "pbrMetallicRoughness.baseColorTexture",
/sdk/source/render/src/materials/gltf-material-builders.ts:55:      value: input.pbrSource.baseColorTexture,
/sdk/source/render/src/materials/gltf-material-utils.ts:99:    (slot === "baseColorTexture" ||
/sdk/source/render/src/materials/standard-texture-readiness-types.ts:15:  | "baseColorTexture"
/sdk/source/render/src/materials/bindings.ts:9:        ["baseColorTexture", material.baseColorTexture],
/sdk/source/render/src/materials/bindings.ts:20:        ["baseColorTexture", material.baseColorTexture],
/sdk/source/render/src/materials/standard-texture-readiness-utils.ts:30:    (input.field === "baseColorTexture" ||
    readonly primitiveCount: number;
    readonly materialCount: number;
    readonly textureCount: number;
    readonly imageCount: number;
  };
  readonly importReport: GltfReportDrivenImportReport;
  readonly sourceRegistration: GltfSourceAssetRegistrationReport;
  readonly meshRegistration: GltfMeshSourceAssetRegistrationReport;
  readonly primitiveMaterials: GltfPrimitiveMaterialResolutionReport;
  readonly commandPlan: GltfEcsAuthoringCommandPlan;
  readonly defaultMaterialHandleKey: string;
  /** Engine-owned skeletons parsed from gltf.skins (M2-T3). */
  readonly skin: GltfSkinImportReport;
  /** Engine AnimationClips registered under AnimationClipHandles (M2-T4). */
  readonly clips: readonly SystemGltfAnimationClip[];
  readonly animationReport: GltfAnimationImportReport;
}

export interface SystemAssetAccess {
  gltf(id: string): SystemGltfAssetHandle;
  texture(id: string): SystemTextureAssetHandle;
  hdr(id: string): SystemAssetHandle<"hdr">;
  shader(id: string): SystemShaderAssetHandle;
  audio(id: string): SystemAudioAssetHandle;
  particleEffect(id: string): SystemParticleEffectAssetHandle;
  request(
    idOrHandle: string | SystemAssetHandle<SystemAssetKind>,
  ): Promise<void>;
  readiness(id: string): Signal<boolean>;
  error(id: string): Signal<ApertureSystemDiagnostic | null>;
  list(): readonly SystemAssetHandle<SystemAssetKind>[];
}

export interface ApertureAssetLoadResult {
  /** Return false to let the built-in asset loader handle this asset. */
  readonly handled?: boolean;
/sdk/source/render/src/materials/prepared-resource-dependencies.ts
/sdk/source/render/src/materials/gltf-texture-report.ts
/sdk/source/render/src/materials/gltf-material.ts
/sdk/source/render/src/materials/family-key.ts
/sdk/source/render/src/materials/gltf-sampler.ts
/sdk/source/render/src/materials/gltf-material-texture-transform.ts
/sdk/source/render/src/materials/gltf-material-textures.ts
/sdk/source/render/src/materials/standard-texture-readiness-expectations.ts
/sdk/source/render/src/materials/standard-texture-readiness-texture.ts
/sdk/source/render/src/materials/gltf-texture-resolution.ts
/sdk/source/render/src/materials/standard-sampler-fidelity-types.ts
/sdk/source/render/src/materials/standard-texture-sampler-alignment.ts
/sdk/source/render/src/materials/gltf-texture.ts
/sdk/source/render/src/materials/gltf-material-texture-info.ts
/sdk/source/render/src/materials/gltf-texture-browser-decoder.ts
/sdk/source/render/src/materials/gltf-material-render-state.ts
/sdk/source/render/src/materials/factories.ts
/sdk/source/render/src/materials/gltf-material-scalars.ts
/sdk/source/render/src/materials/types.ts
/sdk/source/render/src/materials/gltf-sampler-json.ts
/sdk/source/render/src/materials/standard-texture-readiness-report.ts
/sdk/source/render/src/materials/gltf-sampler-types.ts
/sdk/source/render/src/materials/gltf-texture-create.ts
/sdk/source/render/src/materials/gltf-texture-result.ts
/sdk/source/render/src/materials/standard-sampler-fidelity.ts
```

Stderr:

```text

```

## Command ff4abc125fea439abc47784c5a9c31ce

2026-10-12T02:32:45.528645+00:00 → 2026-10-12T02:32:45.647038+00:00; exit 0; duration 0.118s.

Command:

```sh
sed -n "1,95p" /sdk/source/render/src/materials/types.ts; sed -n "30,88p" /sdk/source/app/src/systems/assets.ts; sed -n "1,75p" /sdk/source/render/src/materials/factories.ts; grep -n "proceduralSky" /sdk/source/app/src/systems/spawn/types.ts; grep -R -n "interface ProceduralSkyInput" /sdk/source/render/src | head -5; date -u
```

Stdout:

```text
import type {
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
} from "@aperture-engine/simulation";
import type { Color } from "@aperture-engine/simulation";
import type { InstanceAttributeLayoutInput } from "./instance-attributes.js";

export type MaterialKind = "unlit" | "matcap" | "standard" | "debug-normal";
export const BUILT_IN_MATERIAL_KINDS = [
  "unlit",
  "matcap",
  "standard",
  "debug-normal",
] as const satisfies readonly MaterialKind[];

export type MaterialFamilyKey = MaterialKind | (string & {});
export type MaterialAlphaMode = "opaque" | "mask" | "blend";
export type MaterialCullMode = "back" | "front" | "none";
export type MaterialFrontFace = "ccw" | "cw";
export type DepthCompare =
  | "never"
  | "less"
  | "equal"
  | "less-equal"
  | "greater"
  | "not-equal"
  | "greater-equal"
  | "always";
export type BlendPreset = "none" | "alpha" | "premultiplied-alpha" | "additive";
export type ColorWriteMask = "all" | "none" | "rgb" | "alpha";

export type TextureDimension = "2d" | "cube";
export type TextureColorSpace = "srgb" | "linear" | "data";
export type TextureSemantic =
  | "base-color"
  | "emissive"
  | "clearcoat-roughness"
  | "sheen-color"
  | "sheen-roughness"
  | "iridescence"
  | "iridescence-thickness"
  | "metallic-roughness"
  | "normal"
  | "occlusion"
  | "data";
export type TextureFormat =
  | "rgba8unorm"
  | "rgba8unorm-srgb"
  | "bgra8unorm"
  | "bgra8unorm-srgb"
  | "r8unorm"
  | "rg8unorm"
  | "rgba16float"
  | "bc1-rgba-unorm"
  | "bc1-rgba-unorm-srgb"
  | "bc3-rgba-unorm"
  | "bc3-rgba-unorm-srgb"
  | "bc7-rgba-unorm"
  | "bc7-rgba-unorm-srgb"
  | "etc2-rgb8unorm"
  | "etc2-rgb8unorm-srgb"
  | "etc2-rgba8unorm"
  | "etc2-rgba8unorm-srgb"
  | "astc-4x4-unorm"
  | "astc-4x4-unorm-srgb";
export type TextureUsage = "sampled" | "copy-dst" | "render-attachment";
export type SamplerAddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";
export type SamplerFilterMode = "nearest" | "linear";

export interface DepthStateDescriptor {
  readonly test: boolean;
  readonly write: boolean;
  readonly compare: DepthCompare;
  readonly bias?: number;
  readonly biasSlopeScale?: number;
}

export interface BlendStateDescriptor {
  readonly preset: BlendPreset;
}

export interface RenderStateDescriptor {
  readonly alphaMode: MaterialAlphaMode;
  readonly alphaCutoff: number;
  readonly cullMode: MaterialCullMode;
  readonly frontFace: MaterialFrontFace;
  readonly depth: DepthStateDescriptor;
  readonly blend: BlendStateDescriptor;
  readonly colorWriteMask: ColorWriteMask;
}

export interface MaterialTextureBinding {
  readonly texture: TextureHandle | null;
  readonly sampler: SamplerHandle | null;
  type GltfSkinImportReport,
  type GltfSourceAssetRegistrationReport,
  type Ktx2BasisTranscoder,
  type Ktx2TextureCompressionSupport,
  type MeshoptBufferDecoder,
  type ParticleEffectAsset,
  type ParticleRendererModuleInput,
  type TextureAsset,
  type TextureColorSpace,
  type TextureSemantic,
} from "@aperture-engine/render";
import {
  assetHandleKey,
  createAnimationClipHandle,
  createAudioClipHandle,
  createEnvironmentMapHandle,
  createMaterialHandle,
  createParticleEffectHandle,
  createSamplerHandle,
  createSceneHandle,
  createShaderHandle,
  createTextureHandle,
  type AnimationClip,
  type AnimationClipHandle,
  type AudioClipHandle,
  type EnvironmentMapHandle,
  type AssetRegistry,
  type AssetHandle,
  type ParticleEffectHandle,
  type SamplerHandle,
  type SceneHandle,
  type ShaderHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type {
  ApertureConfig,
  ApertureAudioAssetDescriptor,
  ApertureConfigAsset,
  ApertureParticleCompositeEffectAssetDescriptor,
  ApertureParticleEffectAssetDescriptor,
  ApertureParticleEmitterEffectAssetDescriptor,
  ApertureTextureAssetDescriptor,
  AssetPreloadPolicy,
  ConfigAssetKind,
} from "../config.js";
import {
  formatReportDiagnostics,
  type ApertureSystemDiagnostic,
  type SystemDiagnostics,
} from "./diagnostics.js";
import { ApertureSystemError } from "./errors.js";

export type SystemAssetKind = ConfigAssetKind;

export interface SystemAssetHandle<TKind extends SystemAssetKind> {
  readonly id: string;
  readonly kind: TKind;
  readonly url?: string;
  readonly label?: string;
import { vec4 } from "@aperture-engine/simulation";
import type { Vec3Like, Vec4, Vec4Like } from "@aperture-engine/simulation";
import type {
  DebugNormalMaterialAsset,
  CustomMaterialDependencyDeclaration,
  CustomWgslMaterialAsset,
  CustomWgslMaterialPipelineKeyInput,
  CustomWgslShaderRef,
  MaterialUnsupportedFeature,
  MatcapMaterialAsset,
  RenderStateDescriptor,
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
  UnlitMaterialAsset,
  WgslShaderAsset,
} from "./types.js";

export function createDefaultRenderState(
  overrides: Partial<RenderStateDescriptor> = {},
): RenderStateDescriptor {
  return {
    alphaMode: overrides.alphaMode ?? "opaque",
    alphaCutoff: overrides.alphaCutoff ?? 0.5,
    cullMode: overrides.cullMode ?? "back",
    frontFace: overrides.frontFace ?? "ccw",
    depth: overrides.depth ?? {
      test: true,
      write: true,
      compare: "less",
    },
    blend: overrides.blend ?? { preset: "none" },
    colorWriteMask: overrides.colorWriteMask ?? "all",
  };
}

export function createUnlitMaterialAsset(
  input: Partial<
    Omit<
      UnlitMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): UnlitMaterialAsset {
  return {
    kind: "unlit",
    label: input.label ?? "Unlit Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
    baseColorTexture: input.baseColorTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createMatcapMaterialAsset(
  input: Partial<
    Omit<
      MatcapMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): MatcapMaterialAsset {
  return {
    kind: "matcap",
    label: input.label ?? "Matcap Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
483:  proceduralSky(options?: SpawnProceduralSkyOptions): Entity;
/sdk/source/render/src/rendering/authoring-types.ts:394:export interface ProceduralSkyInput {
Mon Oct 12 02:32:45 UTC 2026
```

Stderr:

```text

```

## Command 3d7d599aa3784f63a8cff8e880687346

2026-10-12T02:33:03.490764+00:00 → 2026-10-12T02:33:03.660088+00:00; exit 0; duration 0.169s.

Command:

```sh
sed -n "90,119p" /sdk/source/render/src/materials/types.ts; sed -n "94,130p" /sdk/source/app/src/systems/assets.ts; sed -n "380,439p" /sdk/source/render/src/rendering/authoring-types.ts; grep -n "sampler" /sdk/source/app/src/systems/assets.ts | head -24; grep -n "baseColorTexture" /sdk/source/render/src/rendering/authoring-types.ts | head -10; cat /sdk/source/app/src/default-environment.ts | head -105
```

Stdout:

```text
  readonly colorWriteMask: ColorWriteMask;
}

export interface MaterialTextureBinding {
  readonly texture: TextureHandle | null;
  readonly sampler: SamplerHandle | null;
  readonly texCoord?: number;
  readonly transform?: MaterialTextureTransform;
}

export interface MaterialTextureTransform {
  readonly offset?: readonly [number, number];
  readonly scale?: readonly [number, number];
  readonly rotation?: number;
}

export interface TextureMipLevelSourceData {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage?: number;
  readonly width: number;
  readonly height: number;
}

export interface TextureSourceData {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage?: number;
  readonly mipLevels?: readonly TextureMipLevelSourceData[];
}
    : TKind extends "shader"
      ? ShaderHandle
      : TKind extends "audio"
        ? AudioClipHandle
        : TKind extends "texture"
          ? TextureHandle
          : TKind extends "hdr"
            ? EnvironmentMapHandle
            : TKind extends "particle-effect"
              ? ParticleEffectHandle
              : unknown;
}

export type SystemGltfAssetHandle = SystemAssetHandle<"gltf"> & {
  readonly url: string;
  readonly renderHandle: SceneHandle;
  readonly scene: Signal<SystemGltfLoadedScene | null>;
};

export type SystemShaderAssetHandle = SystemAssetHandle<"shader"> & {
  readonly url: string;
  readonly renderHandle: ShaderHandle;
};

export type SystemAudioAssetHandle = SystemAssetHandle<"audio"> & {
  readonly url: string;
  readonly renderHandle: AudioClipHandle;
  readonly streaming: boolean;
  readonly durationHint?: number;
  readonly channels?: number;
  readonly captionTrackId?: string;
};

export type SystemTextureAssetHandle = SystemAssetHandle<"texture"> & {
  readonly url: string;
  readonly renderHandle: TextureHandle;
  readonly colorSpace: TextureColorSpace;
  readonly priority?: number;
}

export interface UiScrollInput {
  readonly enabled?: boolean;
  readonly offset?: Vec2Like;
}

export interface SkyboxInput {
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly intensity?: number;
}

export interface ProceduralSkyInput {
  readonly model?: ProceduralSkyModel;
  readonly priority?: number;
  readonly topColor?: Vec3Like;
  readonly horizonColor?: Vec3Like;
  readonly bottomColor?: Vec3Like;
  readonly horizonPosition?: number;
  readonly horizonSoftness?: number;
  readonly intensity?: number;
  readonly sunDirection?: Vec3Like;
  readonly sunColor?: Vec3Like;
  readonly sunRadius?: number;
  readonly sunGlow?: number;
  readonly ditherStrength?: number;
}

export type RuntimeUniformValue = JsonPrimitive | readonly number[];

export type RuntimeUniformValues = Readonly<
  Record<string, RuntimeUniformValue>
>;

export interface RuntimeUniformInput {
  readonly key: string;
  readonly values: RuntimeUniformValues;
  readonly version?: number;
}

export interface FogInput {
  readonly mode?: FogMode;
  readonly color?: Vec4Like;
  readonly density?: number;
  readonly start?: number;
  readonly end?: number;
}

export interface PickableInput {
  readonly enabled?: boolean;
  readonly layerMask?: number;
  readonly precision?: PickablePrecision;
  readonly blocksLower?: boolean;
  readonly priority?: number;
}

export interface MeshQueryAccelerationInput {
  readonly mode?: MeshQueryAccelerationMode;
140:    readonly sampler?: SamplerHandle | null;
555:  if (particleEffect.sampler !== undefined && particleEffect.sampler !== null) {
556:    dependencies.push(particleEffect.sampler);
640:      ...(leafRenderer?.sampler === undefined
643:            sampler:
644:              leafRenderer.sampler === null
646:                : createSamplerHandle(leafRenderer.sampler),
794:    ...(handle.sampler === undefined ? {} : { sampler: handle.sampler }),
// Zero-config default environment: a daylight gradient sky plus matching
// image-based lighting, installed unless the app authors its own sky or
// environment light (or opts out via render.defaultEnvironment: false).
//
// This is the difference between a new scene that renders lit against a sky
// and one that renders near-black: StandardMaterial needs an environment (or
// authored lights) to look like anything, and camera clearColor defaults to
// black. The installer runs after user setup systems have initialized, so an
// authored ProceduralSky, Skybox, or environment Light suppresses it.
//
// The IBL half synthesizes a small LDR equirect gradient (the equirect→cube
// source format is rgba8unorm) and registers it as a ready environment-map
// asset; the renderer's PMREM/irradiance chain derives specular and diffuse
// IBL from it. The visible half is a ProceduralSky with matching colors. The
// two are tuned together: the illumination gradient is deliberately brighter
// and less saturated than the visible sky so materials read neutral, not
// blue-tinted.

import { createEnvironmentMapHandle } from "@aperture-engine/simulation";
import {
  Light,
  LightKind,
  ProceduralSky,
  Skybox,
} from "@aperture-engine/render";
import type { ApertureConfig } from "./config.js";
import type { ApertureSystemContext } from "./systems/context.js";

/** Visible sky gradient (linear RGB): soft blue → pale horizon → warm ground. */
export const DEFAULT_ENVIRONMENT_SKY_COLORS = {
  top: [0.2423, 0.6172, 0.8308],
  horizon: [0.6584, 0.7084, 0.7913],
  bottom: [0.807, 0.7758, 0.7454],
} as const;

/** Illumination gradient (linear RGB): brighter sky term tuned for lighting. */
export const DEFAULT_ENVIRONMENT_IBL_COLORS = {
  top: [0.6902, 0.749, 0.7843],
  horizon: [0.6584, 0.7084, 0.7913],
  bottom: [0.807, 0.7758, 0.7454],
} as const;

/**
 * Scale applied to the illumination gradient before it feeds the irradiance
 * convolution. The convolution stores irradiance/π, so an unscaled ~0.75
 * gradient would contribute ~0.75 × albedo of ambient diffuse — tuned for an
 * IBL-only rig. The default environment is designed to sit UNDER a directional
 * sun (the template/showcase recipe), so it targets the ~0.35–0.45 ambient
 * fill the showcases were tuned around while keeping the sky's tint.
 */
export const DEFAULT_ENVIRONMENT_IBL_INTENSITY = 0.55;

export const DEFAULT_ENVIRONMENT_ASSET_ID = "environment.default";
export const DEFAULT_ENVIRONMENT_SKY_KEY = "sky.default";
export const DEFAULT_ENVIRONMENT_LIGHT_KEY = "light.environment.default";
export const DEFAULT_ENVIRONMENT_SUN_KEY = "light.sun.default";

/**
 * Illuminance of the soft default sun added when the app authors no analytic
 * lights at all. Matches the showcase/template tuning (the city-builder sun)
 * so a zero-config scene reads directional without washing out under ACES.
 */
export const DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE = 2.2;

const EQUIRECT_WIDTH = 64;
const EQUIRECT_HEIGHT = 32;
const CUBE_FACE_SIZE = 64;
const SPECULAR_MIP_LEVEL_COUNT = 4;

export interface InstallDefaultEnvironmentOptions {
  readonly config: ApertureConfig;
  readonly context: ApertureSystemContext;
  readonly world: {
    readonly queryManager: {
      registerQuery(config: { readonly required: readonly unknown[] }): {
        readonly entities: Iterable<unknown>;
      };
    };
  };
}

export function installDefaultEnvironment(
  options: InstallDefaultEnvironmentOptions,
): boolean {
  if (options.config.render?.defaultEnvironment === false) {
    return false;
  }

  const authored = readAuthoredEnvironmentState(options.world);

  if (authored.hasEnvironment) {
    return false;
  }

  const handle = createEnvironmentMapHandle(DEFAULT_ENVIRONMENT_ASSET_ID);
  const registry = options.context.assetsRegistry;

  if (registry.get(handle) === undefined) {
    registry.register(handle, { label: "Default Environment" });
    registry.markReady(handle, {
      kind: "environment-map",
      label: "Default Environment",
      diffuseResourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:diffuse`,
      specularResourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:specular`,
      equirectSource: {
```

Stderr:

```text

```

## Command 1a2a0f8c08f14b9f892215bc52ff7458

2026-10-12T02:33:11.169765+00:00 → 2026-10-12T02:33:11.288030+00:00; exit 0; duration 0.118s.

Command:

```sh
sed -n "101,178p" /sdk/source/app/src/default-environment.ts; grep -n "assetsRegistry" /sdk/source/app/src/systems.ts | head -20; sed -n "1,130p" /sdk/source/app/src/systems.ts; sed -n "430,445p" /sdk/source/app/src/systems/spawn/types.ts; grep -n "spawn.proceduralSky\|SpawnProceduralSky" /sdk/source/app/src/systems/spawn/types.ts
```

Stdout:

```text
      kind: "environment-map",
      label: "Default Environment",
      diffuseResourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:diffuse`,
      specularResourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:specular`,
      equirectSource: {
        label: DEFAULT_ENVIRONMENT_ASSET_ID,
        resourceKey: `environment-map:${DEFAULT_ENVIRONMENT_ASSET_ID}:equirect-cube`,
        width: EQUIRECT_WIDTH,
        height: EQUIRECT_HEIGHT,
        data: defaultEnvironmentEquirectRgba8(EQUIRECT_WIDTH, EQUIRECT_HEIGHT),
        faceSize: CUBE_FACE_SIZE,
        format: "rgba8unorm",
        mipLevelCount: SPECULAR_MIP_LEVEL_COUNT,
      },
      standardMaterialCount: 1,
    });
  }

  options.context.spawn.proceduralSky({
    key: DEFAULT_ENVIRONMENT_SKY_KEY,
    name: "default-sky",
    topColor: DEFAULT_ENVIRONMENT_SKY_COLORS.top,
    horizonColor: DEFAULT_ENVIRONMENT_SKY_COLORS.horizon,
    bottomColor: DEFAULT_ENVIRONMENT_SKY_COLORS.bottom,
    // A clean gradient with no sun disk: the default look is neutral studio
    // daylight, not a time of day.
    sunRadius: 0,
    sunGlow: 0,
  });

  options.context.spawn.light({
    key: DEFAULT_ENVIRONMENT_LIGHT_KEY,
    name: "default-environment-light",
    kind: "environment",
    light: { environmentMap: handle },
  });

  // The standard-material light buffer requires at least one analytic light —
  // an environment-only world fails frame resource creation. When the app
  // authored no lights at all, complete the daylight rig with a soft sun
  // (no shadows; the templates author the shadow-casting sun).
  if (!authored.hasAnalyticLight) {
    options.context.spawn.light({
      key: DEFAULT_ENVIRONMENT_SUN_KEY,
      name: "default-sun",
      kind: "directional",
      illuminance: DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });
  }

  return true;
}

/**
 * Synthesize the LDR equirect gradient feeding the IBL chain. The projection
 * convention puts the north pole at v=1 (see
 * equirect-to-cube-compute-pipeline.ts), so row 0 is the ground and the last
 * row is the sky.
 */
export function defaultEnvironmentEquirectRgba8(
  width: number,
  height: number,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  const { top, horizon, bottom } = DEFAULT_ENVIRONMENT_IBL_COLORS;

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const elevation = 2 * v - 1;
    const shaping = Math.pow(Math.abs(elevation), 0.75);
    const color =
      elevation >= 0
        ? mix3(horizon, top, shaping)
        : mix3(horizon, bottom, shaping);
    const r = channelToByte(color[0] * DEFAULT_ENVIRONMENT_IBL_INTENSITY);
593:  readonly assetsRegistry: AssetRegistry;
751:    get assetsRegistry(): AssetRegistry {
752:      return this.#context.assetsRegistry;
import { trackApertureSystemOwner } from "./internal/app-lifecycle.js";
import {
  computed,
  signal as createSignal,
  type Signal,
} from "@preact/signals-core";
import type {
  Query,
  SystemQueries,
  SystemSchema,
  TypeValueToType,
} from "elics";
import {
  Children,
  DebugMetadata,
  EcsType,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  clamp,
  clamp01,
  createSystem as createElicsSystem,
  defineComponent,
  expSmoothingAlpha,
  hexColor,
  inverseLerp,
  lerp,
  lerpAngle,
  quatFromEuler,
  quatFromEulerYXZ,
  quatFromAxisAngle,
  quatLookAt,
  quatMultiply,
  quatNormalize,
  remap,
  remapClamped,
  rotateVec3ByQuat,
  serializeEntityRef,
  vec3Add,
  vec3AddScaled,
  vec3Cross,
  vec3Distance,
  vec3Dot,
  vec3Length,
  vec3LengthSq,
  vec3Normalize,
  vec3ProjectOnPlane,
  vec3Scale,
  vec3Subtract,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import type { SimulationFixedStepContext } from "@aperture-engine/runtime";
import type { SpatialQueries } from "./spatial/index.js";
import {
  type StatefulGamepadsState,
  type StatefulKeyboardState,
} from "./input/state.js";
import {
  createScheduledEffects,
  registerSystemEffects,
  type ScheduledEffects,
} from "./systems/effects.js";
import { type SystemDiagnostics } from "./systems/diagnostics.js";
import { ApertureSystemError } from "./systems/errors.js";
import type { CommandAccess } from "./systems/commands.js";
import type { SystemAssetAccess } from "./systems/assets.js";
import type { CameraAccess } from "./systems/cameras.js";
import type { GltfInstanceAccess } from "./systems/gltf.js";
import type { HierarchyAccess } from "./systems/hierarchy.js";
import type { HtmlBridgeAccess } from "./systems/html-bridge.js";
import type { InteractionAccess } from "./interaction/access.js";
import type { MaterialAccess } from "./systems/materials.js";
import type { MeshAccess } from "./systems/meshes.js";
import type { ParticleAccess } from "./systems/particles.js";
import type { AudioAccess } from "./systems/audio.js";
import type { TrailAccess } from "./systems/trails.js";
import type { PhysicsAccess } from "./systems/physics.js";
import type { FixedStepAccess } from "./systems/fixed-step.js";
import type { PrefabAccess } from "./systems/prefabs.js";
import type { ResourceStore } from "./systems/resources.js";
import type { SignalStore } from "./systems/signals.js";
import type { StartOptionsAccess } from "./systems/start-options.js";
import type { SpawnCommands } from "./systems/spawn/index.js";
import {
  getApertureSystemContext,
  type ApertureSystemContext,
  type InputActions,
  type InputSignals,
} from "./systems/context.js";
import type { ApertureRandom } from "./systems/random.js";
import type { ApertureFrameTime } from "./systems/frame-time.js";
export {
  createFollowCameraController,
  writeFollowCameraPose,
} from "./controllers/follow-camera.js";
export type {
  FollowCameraController,
  FollowCameraControllerOptions,
  FollowCameraPose,
  FollowCameraUpdateInput,
} from "./controllers/follow-camera.js";

export { createSpatialQueries } from "./spatial/index.js";
export type {
  SimulationFixedStepContext,
  SimulationFixedStepTaskOptions,
} from "@aperture-engine/runtime";
export type {
  RayInput,
  SpatialClosestPointHit,
  SpatialClosestPointOptions,
  SpatialOverlapHit,
  SpatialOverlapOptions,
  SpatialPickableState,
  SpatialQueries,
  SpatialRaycastHit,
  SpatialRaycastOptions,
  SpatialRaycastableBounds,
  SpatialRaycastableMesh,
} from "./spatial/index.js";

export {
  Children,
  DebugMetadata,
  Enabled,
  EcsType,
   * Tags applied to every spawned root. Instance tags are appended and
   * de-duplicated.
   */
  readonly tags?: readonly string[];
  readonly materials?: SpawnGltfMaterialOverrides;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly instances: readonly SpawnGltfBatchInstance[];
}

export type MaterialAppearancePresetName =
  | "source"
  | "painted-stylized"
  | "matte"
  | "preview-safe";

154:export interface SpawnProceduralSkyOptions
483:  proceduralSky(options?: SpawnProceduralSkyOptions): Entity;
```

Stderr:

```text

```

## Command 87e6e7cc40104deabbec75c559674ebb

2026-10-12T02:34:15.221085+00:00 → 2026-10-12T02:34:17.350172+00:00; exit 0; duration 2.129s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.ts')
s=p.read_text()
s=s.replace("import {createTriangleListMeshAsset}","import {createTriangleListMeshAsset,createSamplerAsset}")
s=s.replace("type V=number[];","import {createSamplerHandle} from '@aperture-engine/simulation';\ntype V=number[];")
s=s.replace("tri(id,vs[0],vs[1],vs[3],[ns[0],ns[1],ns[3]])","tri(id,vs[0],vs[3],vs[1],[ns[0],ns[3],ns[1]])")
s=s.replace("tri(id,vs[1],vs[2],vs[3],[ns[1],ns[2],ns[3]])","tri(id,vs[1],vs[3],vs[2],[ns[1],ns[3],ns[2]])")
s=s.replace("quad(id,p,q,s,v);tri(id,a,q,p);tri(id,b,v,s);","quad(id,p,v,s,q);tri(id,a,p,q);tri(id,b,s,v);")
s=s.replace("quad(id,a,b,c,d);quad(id,p(center0,t,r-th),p(center1,t,r-th),p(center1,T,r-th),p(center0,T,r-th));","quad(id,a,d,c,b);quad(id,p(center0,t,r-th),p(center0,T,r-th),p(center1,T,r-th),p(center1,t,r-th));")
s=s.replace("quad('asphalt',a,d,c,b)","quad('asphalt',a,b,c,d)")
s=s.replace("quad('paver',A,D,C,B)","quad('paver',A,B,C,D)")
s=s.replace("quad('white',A,D,C,B)","quad('white',A,B,C,D)")
s=s.replace("const C=[3.45,.15,8.62],angle=-.12;","const C=[7.05,.15,8.25],angle=Math.PI+.28;")
s=s.replace("Q('carGlass',[-.735,1.055,-.745],[-.04,1.68,-.67],[-.04,1.68,.67],[-.735,1.055,.745]);","Q('carGlass',[-.735,1.055,.745],[-.04,1.68,.67],[-.04,1.68,-.67],[-.735,1.055,-.745]);")
s=s.replace("Q('carGlass',[1.29,1.68,-.66],[1.835,1.09,-.745],[1.835,1.09,.745],[1.29,1.68,.66]);","Q('carGlass',[1.29,1.68,.66],[1.835,1.09,.745],[1.835,1.09,-.745],[1.29,1.68,-.66]);")
s=s.replace("Q('carGlass',[-.63,1.075,s*.829],[-.04,1.665,s*.75],[.52,1.67,s*.75],[.53,1.073,s*.935]);","const sideQ=(a:V,b:V,c:V,d:V)=>s>0?Q('carGlass',d,c,b,a):Q('carGlass',a,b,c,d);\n sideQ([-.63,1.075,s*.829],[-.04,1.665,s*.75],[.52,1.67,s*.75],[.53,1.073,s*.935]);")
s=s.replace("Q('carGlass',[.64,1.073,s*.935],[.64,1.67,s*.75],[1.23,1.67,s*.75],[1.71,1.073,s*.84]);","sideQ([.64,1.073,s*.935],[.64,1.67,s*.75],[1.23,1.67,s*.75],[1.71,1.073,s*.84]);")
s=s.replace("for(const [id,b] of batches){if(!b.p.length)continue;const asset=createTriangleListMeshAsset({label:id,positions:b.p as any,normals:b.n as any,uvs:b.uv as any});",
"""const sampler=createSamplerHandle('surface.repeat');this.assetsRegistry.register(sampler);this.assetsRegistry.markReady(sampler,createSamplerAsset({addressModeU:'repeat',addressModeV:'repeat',magFilter:'linear',minFilter:'linear',mipmapFilter:'linear'}));
 for(const [id,b] of batches){if(!b.p.length)continue;
 const textureId=id==='stucco'?'stucco':id.startsWith('stone')||id.startsWith('paver')?'stone':id==='asphalt'?'asphalt':id.startsWith('grass')?'grass':null;
 const positionsAuthored=b.p.map(p=>p.map(v=>v*.87));
 const uvs=b.p.map((p,i)=>{const n=b.n[i],a=n.map(Math.abs),axis=a.indexOf(Math.max(...a));return axis===1?[p[0]*.8,p[2]*.8]:axis===0?[p[2]*1.1,p[1]*1.1]:[p[0]*1.1,p[1]*1.1];});
 const asset=createTriangleListMeshAsset({label:id,positions:positionsAuthored as any,normals:b.n as any,uvs:uvs as any});""")
s=s.replace("metallic:b.metal}),castShadow","metallic:b.metal,...(textureId?{baseColorTexture:{texture:this.assets.texture(textureId).renderHandle,sampler}}:{})}),castShadow")
p.write_text(s)
p=Path('/work/aperture.config.ts');s=p.read_text().replace("defineApertureConfig }","defineApertureConfig,asset }").replace("systems:[],","systems:[],assets:Object.fromEntries(['stucco','stone','asphalt','grass'].map(id=>[id,asset.texture('/textures/'+id+'.png',{preload:'blocking',colorSpace:'srgb',semantic:'base-color'})])),")
p.write_text(s)
PY
mkdir -p /work/public/textures
python3 - <<'PY'
import random,struct,zlib,math
from pathlib import Path
rng=random.Random(424)
size=256
def png(path,fn):
 data=bytearray()
 for y in range(size):
  data.append(0)
  for x in range(size):
   rgb=fn(x,y)
   data.extend([max(0,min(255,int(a))) for a in rgb]+[255])
 def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
 Path(path).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(data),9))+chunk(b'IEND',b''))
def stucco(x,y):
 a=235+rng.gauss(0,9)+6*math.sin(x*.16)*math.sin(y*.14)
 if rng.random()<.04:a-=25
 return [a,a,a]
def stone(x,y):
 a=224+rng.gauss(0,12)+10*math.sin(x*.035+y*.024)+4*math.sin(x*.2-y*.13)
 return[a,a,a]
def asphalt(x,y):
 a=201+rng.gauss(0,22)
 if rng.random()<.1:a+=25
 return[a,a,a]
def grass(x,y):
 a=198+rng.gauss(0,25)+15*math.sin(x*.07)*math.sin(y*.049)
 return [a-7,a+4,a-12]
for n,fn in [('stucco',stucco),('stone',stone),('asphalt',asphalt),('grass',grass)]:png('/work/public/textures/'+n+'.png',fn)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 855 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.30 kB │ gzip:   0.25 kB
dist/assets/worker-D1ZtsR-Z.js  3,141.61 kB
dist/assets/audio-DOUzoiuG.js      18.89 kB │ gzip:   7.07 kB
dist/assets/index-BrODYWNz.js   1,511.23 kB │ gzip: 376.56 kB

✓ built in 1.03s
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

Status: ok; recorder-measured coordinator wait: 33.938s.

## Public preview 2 feedback

Status: ok.

## Public note — 2026-10-12T02:35:28.603762+00:00

```
Inspecting preview 2 canonical and left orbit to confirm face corrections, textures, foliage, road and car placement.
```

## Command 472c108a36d748e899e3962bf680805e

2026-10-12T02:37:40.625402+00:00 → 2026-10-12T02:37:41.998547+00:00; exit 0; duration 1.373s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.ts');s=p.read_text()
s=s.replace("createTriangleListMeshAsset,createSamplerAsset","createTriangleListMeshAsset,createSamplerAsset,createRoundedBoxMeshAsset")
s=s.replace("box('grass',[-1,.02,-1],[21,.12,21]);","box('grass',[-1,.02,-2],[20,.12,17.0]);")
s=s.replace("'tile'+((i*5+j*3)%5)","'tile'+Math.floor(rand()*5)")
s=s.replace("['#4b602a','#687a38','#7c843e','#435729']","['#506234','#728044','#899053','#5a6c37']")
# Use native beveled box geometry as part of the same material batch.
s=s.replace("function ellipsoid(id:string", """function bevelBox(id:string,c:V,size:V,fn?:(v:V)=>V){
 const asset=createRoundedBoxMeshAsset({halfExtents:size.map(v=>v/2) as any,radius:Math.min(.035,...size.map(v=>v*.2)),bevelSegments:1});
 const stream=asset.vertexStreams[0],stride=stream.arrayStride/4,data=stream.data as Float32Array,idx=asset.indexBuffer?.data;
 const outP:V[]=[],outN:V[]=[];for(let i=0;i<stream.vertexCount;i++){const a=i*stride,p=[data[a]+c[0],data[a+1]+c[1],data[a+2]+c[2]],n=[data[a+3],data[a+4],data[a+5]];outP.push(fn?fn(p):p);outN.push(fn?unit(sub(fn(add(p,n)),fn(p))):n);}
 const count=idx?.length??outP.length;for(let i=0;i<count;i+=3){const ids=[idx?idx[i]:i,idx?idx[i+1]:i+1,idx?idx[i+2]:i+2];tri(id,outP[ids[0]],outP[ids[1]],outP[ids[2]],ids.map(j=>outN[j]));}
}
function leafCloud(c:V,r:V,count=140,slender=1){
 for(let i=0;i<count;i++){
 const a=rand()*6.283,b=Math.acos(2*rand()-1),radius=Math.cbrt(rand()),pos=add(c,[Math.cos(a)*Math.sin(b)*radius*r[0],Math.cos(b)*radius*r[1],Math.sin(a)*Math.sin(b)*radius*r[2]]);
 const yaw=rand()*6.283,tilt=(rand()-.5)*1.2,U=[Math.cos(yaw)*Math.cos(tilt),Math.sin(tilt),Math.sin(yaw)*Math.cos(tilt)],Vv=[-Math.sin(yaw),0,Math.cos(yaw)];
 const len=(.075+rand()*.07)*slender,w=.025+rand()*.015,tip1=add(pos,mul(U,len)),tip2=add(pos,mul(U,-len)),e1=add(pos,mul(Vv,w)),e2=add(pos,mul(Vv,-w)),ridge=add(pos,[0,.018,0]),id='leaf'+Math.floor(rand()*4);
 for(const [aa,bb] of [[tip1,e1],[e1,tip2],[tip2,e2],[e2,tip1]]){tri(id,aa,ridge,bb);tri(id,bb,ridge,aa);}
 }
}
function slab(id:string,c:V,w:number,d:number){
 const n=6,rings:V[]=[];for(let i=0;i<n;i++){const t=i*6.283/n,rr=.87+rand()*.15;rings.push([c[0]+Math.cos(t)*w*.5*rr,c[1],c[2]+Math.sin(t)*d*.5*rr]);}
 for(let i=0;i<n;i++){const a=rings[i],b=rings[(i+1)%n];tri(id,c,b,a);const A=[a[0],a[1]-.08,a[2]],B=[b[0],b[1]-.08,b[2]];quad(id,a,A,B,b);}
}
function ellipsoid(id:string""")
# Replace shrubby puff balls with closely layered leaves.
s=s.replace("ellipsoid('leaf'+(k%4),c,[r*(.32+rand()*.18),height*(.3+rand()*.2),r*(.32+rand()*.18)],9,6);","leafCloud(c,[r*(.32+rand()*.18),height*(.3+rand()*.2),r*(.32+rand()*.18)],85,.9);")
s=s.replace("ellipsoid('leaf'+(k%4),[x+Math.cos(a)*Math.sin(b)*r,(2.6+Math.cos(b)*.65)*size,z+Math.sin(a)*Math.sin(b)*r],[.46*size,.35*size,.43*size],9,6);","leafCloud([x+Math.cos(a)*Math.sin(b)*r,(2.6+Math.cos(b)*.65)*size,z+Math.sin(a)*Math.sin(b)*r],[.55*size,.44*size,.54*size],170,1.0);")
s=s.replace("for(let i=0;i<9;i++)ellipsoid('leaf'+(i%3),[x+.05*Math.sin(i),.5+h*(i+.4)/10,z],[.55*(1-i/11),h*.19,.48*(1-i/11)],9,6);","for(let i=0;i<14;i++)leafCloud([x+.03*Math.sin(i),.5+h*(i+.4)/15,z],[.53*(1-i/16),h*.1,.47*(1-i/16)],260,.65);")
# Masonry edge bevels and course offsets.
s=s.replace("box('stone'+((j+row*2)%5),[0,.18+(row+.5)*h/3,0],[len/count-.045,h/3-.035,.38],p=>","bevelBox('stone'+((j+row*2)%5),[0,.18+(row+.5)*h/3,0],[len/count-.035,h/3-.02,.38],p=>")
s=s.replace("box('stone'+j%5,[x,.17+(j+.5)*.27,6.52],[.51,.245,.52])","bevelBox('stone'+j%5,[x,.17+(j+.5)*.27,6.52],[.51,.245,.52])")
s=s.replace("box((row+j)%2?'paver':'paver2',[x,.145,z],[.49+rand()*.05,.12,.22]);","slab((row+j)%2?'paver':'paver2',[x,.2,z],.6,.34);")
s=s.replace("box((i+j)%3?'paver':'paver2',[4.3+i*.43,.13,5.8-j*.6],[.4,.13,.55]);","slab((i+j)%3?'paver':'paver2',[4.3+i*.43+(j%2?.08:0),.195,5.8-j*.6],.54,.71);")
# Slate porch steps with softer edges.
s=s.replace("box('paver',[0,.31,3.92],[5.4,.28,1.94]);box('paver2',[0,.17,4.96],[3.35,.2,.44]);box('paver',[0,.08,5.26],[2.85,.16,.38]);","bevelBox('paver',[0,.31,3.92],[5.4,.28,1.94]);bevelBox('paver2',[0,.17,4.96],[3.35,.2,.44]);bevelBox('paver',[0,.08,5.26],[2.85,.16,.38]);")
# More rounded lamps instead of abrupt rectangular front lights.
s=s.replace("B('headlight',[-2.145,.77,z],[.045,.18,.38])","bevelBox('headlight',[-2.145,.77,z],[.07,.18,.38],F)")
p.write_text(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 855 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.30 kB │ gzip:   0.25 kB
dist/assets/worker-ohquXjvg.js  3,142.86 kB
dist/assets/audio-C_tkKdQk.js      18.89 kB │ gzip:   7.07 kB
dist/assets/index-qWIvmTp1.js   1,511.23 kB │ gzip: 376.56 kB

✓ built in 763ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command b8a629b104794a5499e56b90a0c1d5cd

2026-10-12T02:39:07.003577+00:00 → 2026-10-12T02:39:08.330376+00:00; exit 0; duration 1.327s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.ts');s=p.read_text().replace("createSamplerHandle}","createSamplerHandle,createEnvironmentMapHandle}")
s=s.replace("mat('grass','#7c813e');","mat('meadow','#85936a');mat('hills','#697e73');mat('hills2','#819494');mat('grass','#7c813e');")
s=s.replace("// Sun and normal ECS camera. Environment provides soft sky fill.","""// Native sky plus matching source environment illumination.
 const env=createEnvironmentMapHandle('daylight');this.assetsRegistry.register(env);
 const pixels=new Uint8Array(64*32*4);for(let y=0;y<32;y++)for(let x=0;x<64;x++){const t=y/31,base=[.61+.05*t,.64+.04*t,.65+.09*t];for(let c=0;c<3;c++)pixels[(y*64+x)*4+c]=Math.round(base[c]*.53*255);pixels[(y*64+x)*4+3]=255;}
 this.assetsRegistry.markReady(env,{kind:'environment-map',label:'Soft daylight',diffuseResourceKey:'environment-map:daylight:diffuse',specularResourceKey:'environment-map:daylight:specular',equirectSource:{label:'daylight',resourceKey:'environment-map:daylight:equirect-cube',width:64,height:32,data:pixels,faceSize:64,format:'rgba8unorm',mipLevelCount:4},standardMaterialCount:1});
 this.spawn.proceduralSky({key:'sky.daylight',topColor:[.15,.29,.49],horizonColor:[.57,.63,.72],bottomColor:[.72,.70,.61],horizonPosition:0,horizonSoftness:.35,sunRadius:0,sunGlow:0});
 this.spawn.light({key:'light.environment',kind:'environment',light:{environmentMap:env}});
 // Sun and normal ECS camera.""")
s=s.replace("box('dirt',[0,-.3,0],[40,.5,40]);","""box('meadow',[0,-.3,0],[50,.5,50]);
 ellipsoid('hills2',[-16,-.4,-21],[13,4.3,7],32,12);ellipsoid('hills',[0,-.4,-23],[17,3.6,6],32,12);ellipsoid('hills2',[19,-.4,-22],[13,5.7,7],32,12);""")
s=s.replace("id.startsWith('grass')?'grass':null","id.startsWith('grass')||id==='meadow'?'grass':null")
# Add window interior visual cues and sill beveling.
s=s.replace("box('sill',[u,y-h/2-.11,.035],[w+.24,.16,.33],fn)","bevelBox('sill',[u,y-h/2-.11,.035],[w+.24,.16,.33],fn)")
# Car contour creases and trim.
s=s.replace("// Wipers on glass.","""// Subtle hood creases and painted side contours.
 for(const z of [-.48,.48])R('blue2',[-2.0,.925,z],[-.78,1.055,z*.88],.008,.008,6);
 for(const z of [-.954,.954])R('blue2',[-1.12,.73,z],[1.34,.75,z],.006,.006,6);
 // Wipers on glass.""")
p.write_text(s)
p=Path('/work/aperture.config.ts');s=p.read_text().replace("exposure:1,sampleCount:4","exposure:1,ssao:{radiusPixels:10,intensity:.55,power:1.2,sampleCount:8},sampleCount:4");p.write_text(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 855 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.30 kB │ gzip:   0.25 kB
dist/assets/worker-DAfCI7ea.js  3,144.18 kB
dist/assets/audio-DQYz-QBO.js      18.89 kB │ gzip:   7.07 kB
dist/assets/index-BLBki4J0.js   1,511.29 kB │ gzip: 376.59 kB

✓ built in 807ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Preview 3

Status: ok; recorder-measured coordinator wait: 49.392s.

## Public preview 3 feedback

Status: ok.

## Public note — 2026-10-12T02:40:23.959050+00:00

```
Inspecting preview 3 canonical, left and rear orbit views as the final available visual check.
```

## Command 28bf8ac03e3449edab8cd71770ca630b

2026-10-12T02:42:37.380057+00:00 → 2026-10-12T02:42:39.056405+00:00; exit 0; duration 1.676s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.ts');s=p.read_text()
s=s.replace("const a=edge(i,-2.2),b=edge(i+1,-2.2)","const a=edge(i,-4.2),b=edge(i+1,-4.2)")
s=s.replace("edge(i,-.18)","edge(i,-1.07)").replace("edge(Math.min(i+1,60),-.18)","edge(Math.min(i+1,60),-1.07)").replace("edge(Math.min(i+1,60),.18)","edge(Math.min(i+1,60),-.93)").replace("edge(i,.18)","edge(i,-.93)")
s=s.replace("o=-2.1+rand()*4.1","o=-4.1+rand()*6.2")
s=s.replace("const C=[7.05,.15,8.25],angle=Math.PI+.28;","const C=[9.2,.15,6.4],angle=1.05;")
s=s.replace("// Irregular stone path from the garden gate to the porch.","// Irregular stone path from the garden gate to the porch.\n box('mortar',[0,.11,6.0],[2.36,.08,1.93]);")
s=s.replace("// Right driveway, individual pavers.","// Right driveway, individual pavers.\n box('mortar',[5.87,.13,1.3],[3.75,.1,9.8]);")
p.write_text(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 855 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.30 kB │ gzip:   0.25 kB
dist/assets/worker-DzCrzb8w.js  3,144.26 kB
dist/assets/audio-Dw2GJUcm.js      18.89 kB │ gzip:   7.07 kB
dist/assets/index-3nXFqUOD.js   1,511.29 kB │ gzip: 376.59 kB

✓ built in 1.10s
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Public note — 2026-10-12T02:43:31.925552+00:00

```
Final implementation: deterministic native Aperture WebGPU scene authored entirely in an ECS simulation-worker setup system. Material-batched, actual triangle-list and native beveled-box geometry forms ivory stucco walls with inset openings, windows and sills, tiled terracotta gable roof, chimney, two-post porch, door, stone steps and paths, masonry boundary and entry pillars, mailbox, terracotta planters, individual-leaf olive trees/cypresses/shrubs, lavender, a curved asphalt road with curbs and broken white markings, and a blue four-wheel hatchback with body loft, cabin, glass, lights, alloy spokes and trim. Procedural PNG surface textures, warm shadow-casting sunlight, ambient/environment fill, ACES exposure 1, 4x MSAA and native SSAO are used. The adapter uses manual worker snapshot submission and returns positions/normals parsed directly from each submitted native MeshAsset buffer. Three recorded previews were inspected; all rendered successfully. The final build additionally widens the foreground asphalt, narrows markings, aligns the car with the bend and adds mortar beds beneath pavers. Limitations: stylized car/body contours and simplified distant hills; these final small composition adjustments were built after the third available preview. pnpm run build succeeded; no development server or application process was started or left running.
```

