# WebXR Implementation Plan

Last updated: 2026-06-06
Status: plan

This plan lays out how Aperture should add WebXR while preserving the project
direction in `docs/NORTH_STAR.md`: ECS is the source of truth, rendering is a
derived view, WebGPU is the only backend, and worker-thread simulation must stay
viable.

The short version: implement WebXR as a browser presentation and input mode over
the existing ECS/render snapshot boundary. Do not create a second runtime, do
not introduce a scene graph, and do not send WebXR browser objects into the
simulation worker.

## Reference Review

### Immersive Web SDK

IWSDK is the best reference for product shape, developer ergonomics, and
agent-friendly XR tooling.

Useful source landmarks:

- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/init/xr.ts`
  defines structured session feature flags, required/optional negotiation,
  depth preferences, request/offer session flows, and reference-space fallback.
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/ecs/world.ts`
  centralizes world creation and persistent XR-space entities such as player,
  camera, left/right ray, grip, and index-tip entities.
- `/Users/felixz/Projects/immersive-web-sdk/packages/xr-input/src/xr-input-manager.ts`
  maps `XRInputSource` objects into stable ray, grip, hand, gamepad, and pointer
  state.
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/environment-raycast/environment-raycast.ts`
  implements WebXR hit-test sources and results.
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/scene-understanding/scene-understanding-system.ts`
  handles planes, meshes, and cleanup on session end.
- `/Users/felixz/Projects/immersive-web-sdk/packages/core/src/depth/depth-sensing-system.ts`
  shows the breadth and complexity of depth sensing and occlusion.
- `/Users/felixz/Projects/immersive-web-sdk/docs/ai/mcp-tools.md` is a strong
  model for agent-driven XR development and test tooling.

What Aperture should borrow:

- A structured XR config object instead of ad hoc `requiredFeatures` arrays in
  examples.
- Persistent ECS-visible concepts for head, controller ray, controller grip,
  hands, and index tips.
- Explicit session offer/request helpers with reference-space fallback.
- Agent-operable XR debugging and fake-session tools.
- Data models for hit tests, anchors, planes, meshes, depth, and camera access.

What Aperture should not copy directly:

- IWSDK is built around Three objects and a mutable scene/camera/renderer owned
  by the world. Aperture must keep renderer state derived from ECS snapshots.
- IWSDK depth, layers, and scene-understanding code contain WebGL/Three-specific
  assumptions. Aperture needs WebGPU-only equivalents.
- Many IWSDK systems mutate visual objects during update. Aperture should
  mutate ECS data and let extraction/rendering derive pixels from that state.

### PlayCanvas Engine

PlayCanvas is the best breadth checklist and the best backend-bridge reference.

Useful source landmarks:

- `references/engine/src/framework/xr/xr-manager.js` owns session lifecycle,
  feature negotiation, availability, visibility, target frame rate, and per-frame
  update.
- `references/engine/src/framework/xr/xr-views.js` and
  `references/engine/src/framework/xr/xr-view.js` model per-eye view lifetimes,
  viewports, projection matrices, view matrices, color textures, and depth data.
- `references/engine/src/framework/xr/xr-input.js` and
  `references/engine/src/framework/xr/xr-input-source.js` handle select,
  squeeze, target-ray pose, grip pose, and gamepad state.
- `references/engine/src/framework/xr/xr-hand.js` and
  `references/engine/src/framework/xr/xr-joint.js` cover hand joints and
  synthetic pointer/squeeze behavior.
- `references/engine/src/framework/xr/xr-hit-test.js`,
  `xr-anchors.js`, `xr-plane-detection.js`, `xr-mesh-detection.js`,
  `xr-light-estimation.js`, and `xr-image-tracking.js` are the feature
  inventory Aperture should expect over time. Depth and camera access are not
  standalone files in this checkout; they are integrated through `xr-views.js`,
  `xr-view.js`, and the WebGPU XR bridge.
- `references/engine/src/platform/graphics/xr-bridge.js` and
  `references/engine/src/platform/graphics/webgpu/webgpu-xr-bridge.js` separate
  XR presentation from the renderer and show the WebGPU projection-layer path.

What Aperture should borrow:

- A dedicated WebGPU XR bridge that hides `XRGPUBinding`, projection layers,
  subimages, device loss, and frame-bound GPU texture lifetimes.
- Per-view records with eye, viewport, projection matrix, view matrix, and
  transient color/depth targets.
- A feature manager split for hit test, anchors, planes, meshes, depth, camera,
  light estimation, image tracking, and DOM overlay.
- Runtime diagnostics for unsupported features, visibility changes, target frame
  rate, and fixed foveation.

What Aperture should not copy directly:

- PlayCanvas stores XR state in manager maps/lists, not ECS resources and
  components.
- The WebGPU bridge still has limitations. Its WebGPU depth path warns that GPU
  depth is not implemented, and stereo WebGPU rendering is not a complete
  multiview implementation.
- PlayCanvas has a broader legacy rendering architecture. Aperture should avoid
  importing those compatibility layers.

### three.js

three.js is the best minimal renderer integration reference, especially for
session cleanup and per-view camera updates. It is less useful as an ECS model.

Useful source landmarks:

- `references/three.js/src/renderers/common/XRManager.js` contains the newer
  common/WebGPU-aware manager. It creates `XRGPUBinding`, requires the `webgpu`
  session feature for WebGPU sessions, creates projection layers, sets per-view
  subimages and viewports, and disables multiview in the current path.
- `references/three.js/src/renderers/webxr/WebXRManager.js` is the older WebGL
  manager and still useful for lifecycle shape.
- `references/three.js/src/renderers/webxr/WebXRController.js` updates target
  ray, grip, hand joint, velocity, and pinch/select state.
- `references/three.js/examples/jsm/webxr/VRButton.js`,
  `ARButton.js`, and `XRButton.js` show a simple user-facing session-entry
  surface.
- `references/three.js/examples/jsm/webxr/XRPlanes.js` and
  `XREstimatedLight.js` show optional AR feature helpers.

What Aperture should borrow:

- Keep session entry helpers small and optional.
- Treat `XRFrame` and `XRView` as frame-local objects.
- On session end, fully restore presentation state and clear controller/input
  state.
- Create per-eye render views from `XRView.transform.inverse.matrix` and
  `XRView.projectionMatrix`.

What Aperture should not copy directly:

- three.js is scene graph and Object3D centered.
- The older manager is WebGL biased. The newer WebGPU path is useful, but it is
  still an adapter around three.js camera and render-target assumptions.
- Example code often reaches directly into browser XR APIs. Aperture should
  expose a structured API and diagnostics layer.

## Aperture Readiness

Current Aperture implementation already has several WebXR-friendly seams:

- `packages/render/src/rendering/snapshot-core-types.ts` defines
  `RenderSnapshot` as structured-clone-friendly typed arrays plus view packets.
- `packages/render/src/rendering/snapshot-packet-types.ts` defines `ViewPacket`
  with viewport, scissor, render target, layer mask, priority, clear color, and
  offsets into `RenderSnapshot.viewMatrices` for view/projection matrices.
- `packages/render/src/rendering/extraction-views.ts` extracts one render view
  per ECS camera. This is the natural place to add logical XR camera metadata,
  but not browser XR objects.
- `packages/runtime/src/shared-snapshot-transport.ts` and
  `packages/webgpu/src/app/app-snapshot-transport.ts` already transport view
  matrices across the worker boundary.
- `packages/app/src/input/types.ts` already reserves `input.xr.active`, which
  can grow into an XR input resource.

Important gaps:

- `packages/app/src/config/index.ts` has no XR configuration surface.
- `packages/webgpu/src/gpu/initialize-webgpu.ts` assumes a canvas
  `GPUCanvasContext`; XR projection layers need frame-bound textures from
  `XRGPUBinding`.
- `packages/webgpu/src/app/frame-target.ts`,
  `packages/webgpu/src/app/frame-boundaries.ts`, and
  `packages/webgpu/src/render/frame/frame-boundary.ts` only understand
  swapchain/offscreen targets.
- `packages/webgpu/src/app/create-webgpu-app.ts` renders when simulation worker
  snapshots arrive. XR rendering must be driven by `XRSession.requestAnimationFrame`
  while still consuming the latest simulation snapshot.
- `packages/render/src/rendering/extraction-views.ts` derives matrices from ECS
  cameras. XR needs late main-thread matrix overrides from the XR frame.
- `packages/render/src/rendering/snapshot-packed-view-codec.ts` and
  `packages/runtime/src/shared-snapshot-transport.ts` do not carry eye,
  view-group, or XR view metadata.
- `packages/app/src/browser/input.ts` forwards pointer, keyboard, and browser
  gamepad state, but not XR input sources.
- `packages/app/src/input/gamepads.ts` rejects unsupported mappings. XR
  controllers often expose `xr-standard`, so they should not be handled only via
  `navigator.getGamepads()`.

## Design Principles

1. WebXR is a view and input mode, not a separate runtime.
2. ECS remains the source of truth for app state, entities, gameplay, and
   persistent spatial data.
3. `XRSession`, `XRFrame`, `XRView`, `XRInputSource`, `XRSpace`, and GPU texture
   handles are browser/main-thread objects. They must not enter the simulation
   worker or durable ECS state.
4. The simulation worker receives serializable XR state: actions, poses,
   button/axis values, hand-joint packets, hit-test results, anchors, detected
   planes, detected meshes, and capability flags.
5. Rendering consumes the latest simulation snapshot, then applies frame-local
   XR view overrides on the main thread immediately before rendering.
6. WebGPU XR support must fail clearly when unavailable. Do not add WebGL
   fallback to core rendering.
7. Prefer conservative correctness before cleverness: serial per-eye rendering
   before multiview, no XR MSAA before native resolve support, and conservative
   culling before late-pose culling.
8. Every public XR feature should be testable through fake XR sessions and
   agent-readable ECS diffs.
9. XR poses need an explicit world-space policy. Aperture should map
   reference-space poses through a durable ECS XR origin, not through hidden
   renderer nodes.

## Target Architecture

### Package Responsibilities

`@aperture-engine/app`

- Own user-facing XR config in `CreateAppConfig`.
- Provide browser-only session request helpers.
- Forward serializable XR input and session events to the worker.
- Provide fake XR test harness hooks for examples and automated tests.

`@aperture-engine/webgpu`

- Own WebGPU XR presentation.
- Create and manage `XRGPUBinding`.
- Create `XRProjectionLayer` with the required `webgpu` session feature.
- Expose frame-bound XR color/depth targets to the render frame boundary.
- Drive XR frames with `XRSession.requestAnimationFrame`.
- Restore normal canvas presentation on session end.

`@aperture-engine/render`

- Stay browser-neutral.
- Add view metadata needed for stereo and XR view grouping.
- Add helpers to clone or override a logical camera view into per-eye render
  views using serializable matrices and viewport data.
- Avoid importing WebXR or DOM globals.

`@aperture-engine/runtime`

- Extend worker snapshot transport only with serializable view metadata.
- Preserve SharedArrayBuffer compatibility.
- Avoid browser XR imports.

`@aperture-engine/simulation`

- Store persistent XR semantic state as resources/components when useful:
  sources, actions, hit-test results, anchors, planes, meshes, and depth
  metadata.
- Never store `XRFrame`, `XRView`, `XRSpace`, or GPU objects.

### XR Origin And World Space

Aperture needs an explicit equivalent to IWSDK's player/head/ray/grip entities
and PlayCanvas' camera-parent composition, but expressed as ECS data.

Recommended model:

- Add an `XrOrigin` component or singleton resource that maps WebXR reference
  space into Aperture world space.
- Default `metersPerUnit` to `1`.
- For VR, head, controller, and hand poses are computed as
  `worldFromXrOrigin * referenceSpacePose`.
- Recenter, snap turn, locomotion, and teleport mutate the ECS XR origin or its
  parent transform, not the renderer camera directly.
- For AR, the XR origin starts aligned to the real-world reference space; placed
  anchors and hit-test results become world-space ECS poses through that origin.
- The logical ECS camera remains the authoring handle for layers, clear state,
  near/far policy, and render settings; the XR frame supplies the late per-eye
  matrices.

### Frame Flow

Normal rendering currently works like this:

1. Simulation worker runs ECS.
2. Render extraction produces a `RenderSnapshot`.
3. The main thread receives the snapshot.
4. WebGPU renders to canvas or offscreen targets.

XR rendering should work like this:

1. Browser code requests an XR session and reference space.
2. WebGPU creates an XR projection layer through `XRGPUBinding`.
3. The simulation worker continues producing logical ECS snapshots.
4. The XR session drives frames through `XRSession.requestAnimationFrame`.
5. On each XR frame, the main thread reads the latest available snapshot.
6. The main thread gets `XRViewerPose` and `XRView` data for the reference
   space.
7. A logical ECS camera view is expanded into one render view per XR eye.
8. Each XR render view receives the frame-local projection matrix, view matrix,
   viewport, eye, and XR target texture.
9. WebGPU renders serial per-eye passes into the XR projection-layer subimages.
10. XR input source changes and poses are converted into serializable events and
    forwarded to the simulation worker.

This keeps late head pose on the main thread without making the worker depend on
browser-only frame objects.

## Implementation Plan

### Phase 0 - Decisions And Guardrails

Add a short decision record that WebXR is implemented as a view/input mode over
render snapshots.

Acceptance criteria:

- `docs/DECISIONS.md` records the WebXR boundary decision.
- Boundary tests or lint checks prevent WebXR browser globals from being
  imported by runtime, render extraction, or simulation core modules.
- `docs/SOTA_ROADMAP.md` links to this implementation plan under the WebXR
  milestone.

### Phase 1 - XR Config And Session Shell

Add browser-facing XR session configuration without rendering into XR yet.

Proposed public shape:

```ts
type XrSessionMode = "immersive-vr" | "immersive-ar" | "inline";
type XrReferenceSpaceType =
  | "local"
  | "local-floor"
  | "bounded-floor"
  | "unbounded"
  | "viewer";

interface XrFeatureConfig {
  required?: string[];
  optional?: string[];
  depth?: {
    usagePreference?: Array<"cpu-optimized" | "gpu-optimized">;
    dataFormatPreference?: Array<"luminance-alpha" | "float32">;
  };
  domOverlay?: { root?: Element };
}

interface XrConfig {
  enabled?: boolean;
  mode?: XrSessionMode;
  referenceSpace?: XrReferenceSpaceType;
  referenceSpaceFallbacks?: XrReferenceSpaceType[];
  features?: XrFeatureConfig;
}
```

Implementation notes:

- Build `XRSessionInit` from structured config, following IWSDK's
  `buildSessionInit` pattern.
- Add `webgpu` as a required feature for WebGPU XR presentation.
- Add availability probes and clear unsupported diagnostics.
- Add lifecycle events: requested, started, ended, visibility changed, failed.
- Keep DOM-specific types in browser-facing modules only.
- Add WebXR TypeScript types only to browser-facing app/webgpu code. If
  `@types/webxr` is added, keep those types out of runtime, render extraction,
  and simulation public declarations by converting browser objects into
  serializable local types at the boundary.

Acceptance criteria:

- A simple example can show "XR supported", "XR unavailable", and session start
  failure reasons.
- Session start/end works without rendering to the XR layer.
- Unit tests cover feature negotiation and reference-space fallback.

### Phase 2 - XR View Metadata And Late View Overrides

Extend render snapshots so a logical ECS camera can produce multiple XR views.

Proposed data additions:

- `viewKind`: `"camera" | "xr-eye" | "reflection" | "shadow"` or an equivalent
  numeric enum in packed transport.
- `eye`: `"none" | "left" | "right"` or numeric equivalent.
- `viewGroupId`: stable id connecting left/right eyes to the logical camera.
- Optional `sourceViewId`: the logical camera view that was expanded.

Implementation notes:

- Add a render-package helper that accepts serializable XR view data and returns
  an expanded snapshot or expanded view list.
- Preserve layer masks, clear state, priority, and logical camera settings from
  the source view.
- Override projection matrices and view matrices from frame-local XR data.
- Keep the helper free of `XRFrame`, `XRView`, and DOM types.
- Update SharedArrayBuffer and packed snapshot view codecs.

Culling policy:

- V1 should use conservative XR culling. The easiest safe path is to disable
  per-eye frustum culling for the logical XR camera or use the worker's logical
  camera as a broad culling proxy.
- V2 can add main-thread snapshot culling against extracted bounds after XR view
  overrides.
- Do not use late XR head pose to mutate ECS transforms in the worker.

Sorting policy:

- V1 should treat worker-side transparent depth sorting as a limitation in XR,
  because extraction sorts before the frame-local XR pose is known.
- The first XR example should use opaque and alpha-mask content, or emit a clear
  diagnostic when transparent per-eye sorting is requested.
- V2 can add per-eye main-thread queue sorting from extracted draw bounds, or
  require worker-side predicted pose input if that becomes necessary.

Acceptance criteria:

- Unit tests expand one logical camera view into left/right views.
- Matrix and viewport overrides are deterministic.
- Packed and SharedArrayBuffer transports round-trip XR view metadata.
- Render package tests prove no browser/WebXR globals are imported.

### Phase 3 - WebGPU XR Projection Target

Add a WebGPU XR frame target alongside swapchain/current-texture and offscreen
targets.

Implementation notes:

- Add the XR path deliberately at both target layers:
  - app-level frame targets should gain an XR source beside `"swapchain"` and
    `"offscreen"`.
  - lower frame-boundary color targets should gain an XR projection source
    beside `"current-texture"` and `"offscreen-target"`.
- Add a `WebGpuXrBridge` that owns:
  - `XRGPUBinding`
  - `XRProjectionLayer`
  - per-frame `getViewSubImage(layer, view)` calls
  - color texture view descriptors
  - optional depth texture information
  - session end and device loss cleanup
- Use the `XRGPUBinding` instance's `getPreferredColorFormat()` for XR
  projection layers instead of assuming the canvas preferred format from
  `navigator.gpu.getPreferredCanvasFormat()`. Pipelines and frame reports need
  to distinguish canvas color format from XR projection-layer color format.
- Start with serial per-eye rendering. Do not require multiview.
- Disable or reject XR MSAA initially unless the projection layer path can
  guarantee correct resolve behavior.
- Avoid `GPUCanvasContext.getCurrentTexture()` while rendering an XR frame.

Acceptance criteria:

- A fake XR bridge unit test can supply two frame-bound target textures.
- The frame-boundary code can render without a canvas current texture.
- Session cleanup restores normal canvas rendering.

### Phase 4 - First Stereo Rendering Example

Build the first XR rendering vertical slice.

Example target:

- `examples/webxr-stereo.html`
- A simple world with a cube, a floor grid, and a non-symmetric reference object
  so stereo orientation is obvious.
- A small browser UI button outside the engine canvas can request VR.

Implementation notes:

- Use the latest worker snapshot during XR rAF.
- Expand a logical ECS camera into two eye views on the main thread.
- Render serial per-eye passes into XR projection-layer subimages.
- Keep normal canvas rendering available when no XR session is active.
- Disable or explicitly reject swapchain-specific post effects, readback paths,
  and frame-boundary branches until they are audited for XR projection targets.

Acceptance criteria:

- Non-XR rendering still works.
- XR session renders both left and right views.
- A fake XR browser test verifies two eye render calls with distinct matrices.
- A manual device smoke checklist is documented for real headset testing.

### Phase 5 - XR Input Sources And Actions

Add XR controller input as serializable input state.

Data to forward from the browser/main thread:

- Session active and visibility state.
- Input source id, handedness, target-ray mode, profiles.
- Target-ray pose and grip pose as position, rotation, and matrix packets.
- Select and squeeze pressed/started/ended edges.
- Button and axis state from `XRInputSource.gamepad`, including `xr-standard`.
- Optional velocities when available.

Worker-side model:

- Extend `input.xr.active` into a structured resource.
- Provide stable source lookup by id and handedness.
- Add action binding helpers for select, squeeze, trigger, thumbstick, and grip.
- Represent controller rays and grips as ECS-readable poses, not renderer
  objects.

Acceptance criteria:

- Fake XR tests can inject left/right controllers and select/squeeze events.
- Worker pause, step, and ECS diff tests show controller state changes
  deterministically.
- A controller debug-ray example renders rays and button state from ECS data.
- Existing pointer, keyboard, and gamepad input tests continue to pass.

### Phase 6 - Hands, Near Interaction, And Pointer Semantics

Add hand tracking and higher-level interaction primitives.

Implementation notes:

- Pack hand joints as typed arrays or compact serializable arrays.
- Track at least wrist, palm, index-tip, thumb-tip, and full joint set when
  available.
- Expose pinch/select semantics separately from raw joint poses.
- Add near/far pointer components that systems can consume without knowing
  whether the source is mouse, touch, controller, or hand.

Acceptance criteria:

- Fake XR tests can inject hand joints and pinch state.
- ECS diff tests verify deterministic hand-pose updates across pause/step.
- A hand debug example renders joint markers and pinch state.

### Phase 7 - AR Hit Tests, Anchors, Planes, And Meshes

Add the first AR world-understanding features as data-only ECS resources.

Implementation notes:

- Add hit-test source creation and cleanup.
- Convert hit-test results into serializable poses and optional entity ids.
- Add anchor handles and session-end cleanup.
- Add detected plane and mesh components with ids, transforms, semantic labels
  when available, and geometry update revisions.
- Keep generated mesh geometry data in ECS/render assets rather than direct
  renderer objects.

Acceptance criteria:

- A reticle example uses hit-test results to place an entity.
- A plane/mesh debug example shows detected geometry.
- Session end removes or invalidates session-owned anchors and detected
  surfaces predictably.
- Fake XR tests cover creation, update, removal, and ECS diffs.

### Phase 8 - Depth, Camera Access, Light Estimation, Image Tracking, And Layers

Implement advanced AR features after the core rendering/input path is stable.

Depth:

- Start with capability reporting and CPU depth packets where supported.
- Add GPU depth only after confirming browser WebGPU XR support. PlayCanvas'
  WebGPU bridge currently warns that GPU depth is not implemented, so this is a
  known risk area.
- Keep occlusion as a render feature that consumes explicit depth resources.

Camera access:

- Treat camera textures as permissioned, session-scoped resources.
- Do not assume raw camera image access is available on all browsers/devices.

Light estimation:

- Store estimates as ECS resources: direction, intensity, spherical harmonics,
  and reflection data where available.

Image tracking:

- Store tracked-image ids, poses, and tracking state as ECS data.

Layers and DOM overlay:

- Support DOM overlay through explicit session config.
- Add native XR layers only after base projection-layer rendering is stable.

Acceptance criteria:

- Each feature has capability diagnostics and negative tests.
- Examples degrade clearly when the device or browser does not support the
  feature.
- No feature stores browser WebXR objects in ECS state.

### Phase 9 - Performance And Hardening

After the feature path works, optimize and harden.

Topics:

- Main-thread late-pose timing and snapshot staleness diagnostics.
- Main-thread XR-aware culling against extracted bounds.
- Fixed foveation where browser support exists.
- Target frame rate selection and reporting.
- Device loss and session recovery.
- Post-processing compatibility.
- Motion vectors and previous-view matrices per eye.
- Transparent sorting and UI in stereo.
- Multiview rendering when WebGPU XR support and Aperture render pipelines can
  use it cleanly.
- Native layer support for HUDs or video surfaces.

Acceptance criteria:

- XR diagnostics report frame time, snapshot age, view count, feature flags, and
  input source count.
- Performance tests cover large scene stereo rendering.
- Stereo examples do not regress mono rendering.

## Testing Strategy

Automated tests:

- Session config to `XRSessionInit` conversion.
- Reference-space fallback order.
- Logical camera to left/right XR view expansion.
- Packed and SharedArrayBuffer view metadata round-trips.
- XR frame target selection without canvas current texture.
- XR input source event conversion.
- Worker pause, step, and ECS diff verification for XR inputs.
- Boundary tests that prevent WebXR globals in runtime, render extraction, and
  simulation core.

Browser/fake XR tests:

- Start and end fake session.
- Render two eyes with distinct matrices.
- Inject controller select/squeeze.
- Inject hand joints and pinch.
- Inject hit-test results, anchors, planes, and meshes.
- Verify session cleanup removes session-owned state.

Manual device smoke tests:

- VR stereo render on a WebGPU-capable headset/browser.
- Controller rays and select/squeeze.
- AR hit-test reticle.
- Plane or mesh detection where supported.
- Session end and re-entry.
- Unsupported-feature diagnostics on browsers without WebGPU XR.

Agent workflow tests:

- Add commands or test harness APIs to pause simulation, step one frame, inject
  fake XR input, and diff ECS resource/component state.
- This should mirror the physics testing strategy: agents should be able to
  prove behavior from deterministic ECS state, not only screenshots.
- Keep screenshot or canvas checks for final render validation, but use ECS diffs
  for logic correctness.

## Recommended First Milestones

1. Decision record and config shell.
2. XR view metadata plus late view override unit tests.
3. WebGPU XR projection frame target with fake bridge tests.
4. First stereo rendering example.
5. XR controller input and ECS diff tests.
6. Hit-test reticle example.
7. Planes/meshes and hand tracking.
8. Depth, camera, light estimation, image tracking, DOM overlay, and native
   layers.

This order makes the highest-risk architectural boundary visible early: WebGPU
XR projection-layer rendering with late per-eye view overrides, while simulation
continues to run through the existing worker/snapshot model.

## Risks And Open Questions

- Browser support for WebGPU WebXR is still the largest external risk. Aperture
  should fail clearly instead of adding WebGL fallback.
- `XRGPUBinding` and `XRProjectionLayer` availability may differ across devices.
- Main-thread late-pose overrides can conflict with worker-side frustum culling.
  Start conservative, then add XR-aware culling against extracted bounds.
- Main-thread late-pose overrides can also make worker-side transparent sorting
  wrong for one or both eyes. Keep XR V1 opaque/alpha-mask first or add per-eye
  main-thread sorting before supporting transparent-heavy scenes.
- XR projection-layer color format can differ from the normal canvas format.
  Pipeline cache keys, frame reports, and attachment setup must handle that
  explicitly.
- XR depth, raw camera access, and GPU occlusion are device- and browser-sensitive
  and should not block the initial stereo/input milestone.
- Stereo post-processing needs explicit review. Effects that assume one camera
  or one color target should be disabled in XR until made per-eye safe.
- WebXR TypeScript types should be isolated to browser-facing packages so DOM
  and WebXR globals do not leak into worker-safe packages.
- XR controller gamepads should be handled through `XRInputSource.gamepad`, not
  only through browser gamepad polling.
- Session-scoped state needs strict cleanup on session end, visibility changes,
  reference-space loss, and device loss.

## Unbiased Recommendation

Use IWSDK as the primary API and developer-experience reference, PlayCanvas as
the feature-completeness and WebGPU bridge reference, and three.js as the compact
session/render lifecycle reference.

For Aperture specifically, the right implementation is not a direct port of any
one of them. The core design should be:

- IWSDK-like structured session config and agent-friendly XR tooling.
- PlayCanvas-like backend bridge and feature manager decomposition.
- three.js-like small session helpers and rigorous cleanup.
- Aperture-native ECS resources, render snapshots, worker transport, and
  WebGPU-only frame targets.
