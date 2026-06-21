# HTML Bridge And Screen-Space Framing Plan

Updated: 2026-06-21

## Context

Aperture is intentionally 3D-first: ECS owns simulation state, render extraction
derives snapshots, and the WebGPU backend owns GPU resources. Modern web apps
still need to compose 3D content with normal HTML: landing pages, product
visualizers, configurators, editors, docs, and dashboards often need a 3D
subject to stay visually contained by a CSS layout slot while HTML controls
drive application state.

This should be a first-class app-layer feature, not a project-local landing page
hack, but it must preserve Aperture's architecture:

- DOM elements never become ECS entities or renderer-owned scene graph nodes.
- Browser objects do not cross the worker boundary.
- Systems observe serializable state and commands.
- Rendering still consumes derived camera transforms and render snapshots.

## Reference Anchors

- Bevy camera APIs model viewport rectangles and world/viewport conversion on
  camera data, not DOM nodes:
  `references/bevy/crates/bevy_camera/src/camera.rs`.
- three.js exposes `PerspectiveCamera.setViewOffset(...)` and CSS2D/CSS3D
  renderers, but those CSS renderers wrap DOM elements into scene graph objects;
  Aperture should avoid that scene-graph direction:
  `references/three.js/src/cameras/PerspectiveCamera.js`,
  `references/three.js/examples/jsm/renderers/CSS2DRenderer.js`, and
  `references/three.js/examples/jsm/renderers/CSS3DRenderer.js`.
- PlayCanvas keeps browser input attachment separate from camera
  screen/world conversion and engine components:
  `references/engine/src/framework/input/element-input.js`,
  `references/engine/src/framework/components/camera/component.js`, and
  `references/engine/src/scene/camera.js`.

## Decision

Build an Aperture app-layer HTML bridge:

1. Browser helpers observe or dispatch HTML-side state.
2. The generated browser bridge forwards serializable commands to the worker.
3. A built-in app bridge step materializes durable HTML state in a worker-safe
   resource.
4. User and built-in systems read that resource or drain event commands.
5. Systems can publish signals or resources back to HTML; existing generated
   signal subscription remains the browser-facing read path.

Then build screen-space framing as an attachable camera constraint:

- A `ScreenSpaceFraming` component is attached to an ordinary camera entity.
- It names a subject entity, a browser-observed slot id, fit/padding/alignment,
  and smoothing parameters.
- The built-in framing step reads the latest slot rect and subject bounds, then
  solves the camera transform so the subject fits the target CSS slot.
- Framing can be detached by removing the component or disabled by setting
  `enabled = false`.

## Public API Shape

Browser side:

```ts
import {
  observeApertureHtmlSlots,
  dispatchApertureHtmlEvent,
} from "@aperture-engine/app/browser";

observeApertureHtmlSlots({ viewportElement: "#aperture" });

button.addEventListener("click", () => {
  dispatchApertureHtmlEvent("product.viewer", {
    kind: "selectVariant",
    variant: "red",
  });
});
```

HTML slot:

```html
<div data-aperture-slot="product-stage"></div>
```

System side:

```ts
import {
  ScreenSpaceFraming,
  createScreenSpaceFraming,
} from "@aperture-engine/app/systems";

camera.addComponent(
  ScreenSpaceFraming,
  createScreenSpaceFraming({
    subject: product,
    slot: "product-stage",
    paddingPx: 48,
    smoothingRate: 5.5,
  }),
);
```

## Implementation Plan

1. Add typed HTML bridge contracts and browser helpers:
   - `APERTURE_HTML_BRIDGE_COMMAND_CHANNEL`
   - `observeApertureHtmlSlots(...)`
   - `dispatchApertureHtmlEvent(...)`
   - serializable `HtmlSlotSnapshot` and `HtmlBridgeEventCommand`.
   - optional viewport-element-relative measurement for non-fullscreen
     canvases.
2. Add worker-safe HTML bridge access:
   - `HtmlBridgeStateResource`
   - `createHtmlBridgeAccess(...)`
   - `runHtmlBridgeFrame(...)` to drain bridge commands into the resource.
3. Add app-context exposure:
   - systems can use `this.html.slot("...")`
   - systems can drain semantic HTML events through the existing command queue.
4. Add `ScreenSpaceFraming` component:
   - subject entity ref fields
   - slot id
   - fit mode, padding, alignment
   - view yaw/pitch and focus offset controls
   - smoothing state.
5. Add `runScreenSpaceFramingFrame(...)`:
   - reads `HtmlBridgeStateResource`
   - resolves subject bounds from `ScreenSpaceFraming` AABB fields plus
     subject world transform
   - solves camera distance and focus/lateral offset against the target slot
   - smooths transform changes with exponential smoothing
   - writes `LocalTransform` on the camera.
6. Wire the generated app step:
   - apply HTML bridge commands before user systems run
   - solve framing after user systems and transform resolution
   - rerun transform resolution only if a camera transform was changed.
7. Replace the landing scene's hand-written card anchoring with an observed
   slot plus `ScreenSpaceFraming`, keeping story phase commands as semantic
   HTML events until a later story-specific API is needed.
8. Add focused tests:
   - worker bridge stores latest slot state
   - screen-space framing changes camera distance/translation when the slot
     changes and converges under smoothing
   - detaching or disabling the component stops the built-in solver.

## Non-Goals For This Slice

- Do not build DOM-as-scene-object CSS2D/CSS3D rendering.
- Do not add a renderer-level scene graph.
- Do not require HTML observation in headless apps.
- Do not implement arbitrary mesh-accurate bounds extraction yet; start with an
  explicit subject AABB that works for landing scenes and product viewers.
