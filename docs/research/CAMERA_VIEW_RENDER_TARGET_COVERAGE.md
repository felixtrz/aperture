# Camera, View, Layer, And Render-Target Coverage

This note records the reference-engine coverage for `task-0020` and turns it into an Aperture MVP schema direction. It is a planning artifact only; it does not introduce runtime source changes.

## Scope

The goal is to define camera and view data that can be extracted from ECS into renderer-owned WebGPU work without creating a scene graph or making the renderer authoritative for camera state.

MVP coverage should include:

- Perspective and orthographic camera authoring data.
- View and projection matrix extraction from `WorldTransform`.
- Viewport and scissor rectangles.
- Clear color/depth/stencil authoring.
- Layer masks.
- Camera priority and stable ordering.
- Optional render target handles.
- Structured diagnostics for invalid or unsupported camera/view state.

## Reference Engine Source Anchors

### three.js

Representative files inspected:

- `src/cameras/Camera.js`
- `src/cameras/PerspectiveCamera.js`
- `src/cameras/OrthographicCamera.js`
- `src/cameras/ArrayCamera.js`
- `src/cameras/StereoCamera.js`
- `src/cameras/CubeCamera.js`
- `src/core/Layers.js`
- `src/core/RenderTarget.js`
- `src/core/RenderTarget3D.js`
- `src/renderers/WebGLRenderTarget.js`
- `src/renderers/WebGLCubeRenderTarget.js`
- `src/renderers/common/Renderer.js`
- `src/renderers/common/RenderContext.js`
- `src/renderers/common/RenderContexts.js`
- `src/renderers/common/RenderList.js`
- `src/renderers/common/RenderLists.js`
- `src/renderers/webgpu/WebGPURenderer.js`

Findings:

- Base `Camera` stores `matrixWorldInverse`, `projectionMatrix`, and `projectionMatrixInverse`; view matrix update excludes scale when needed for glTF-conformant camera transforms.
- `PerspectiveCamera` covers vertical FOV, aspect, near/far, zoom, film gauge/offset, view offsets, projection updates, and projection inverse updates.
- `OrthographicCamera` covers left/right/top/bottom, near/far, zoom, view offsets, projection updates, and projection inverse updates.
- `ArrayCamera`, `StereoCamera`, and `CubeCamera` show common later pressures: sub-cameras with viewports, stereo eye projection offsets, and cube render-target faces. These are not MVP requirements.
- `Layers` is a simple 32-bit bitmask with set/enable/disable/test behavior; renderer culling checks object layers against camera layers.
- `RenderTarget` carries width, height, viewport, scissor, color textures/MRT, depth/stencil flags, depth texture, sample count, and resize/dispose behavior.
- The common renderer builds `RenderContext` data from render target, camera, clear settings, viewport/scissor, depth/stencil presence, sample count, and active cube face. Render lists are keyed by scene/camera pairs.

### Babylon.js

Representative files inspected:

- `packages/dev/core/src/Cameras/camera.ts`
- `packages/dev/core/src/Cameras/targetCamera.ts`
- `packages/dev/core/src/Cameras/freeCamera.ts`
- `packages/dev/core/src/Cameras/arcRotateCamera.ts`
- `packages/dev/core/src/Cameras/followCamera.ts`
- `packages/dev/core/src/Cameras/flyCamera.ts`
- `packages/dev/core/src/Cameras/universalCamera.ts`
- `packages/dev/core/src/Cameras/RigModes/*`
- `packages/dev/core/src/Cameras/Stereoscopic/*`
- `packages/dev/core/src/Cameras/VR/*`
- `packages/dev/core/src/Materials/Textures/renderTargetTexture.ts`
- `packages/dev/core/src/Engines/renderTargetWrapper.ts`
- `packages/dev/core/src/Engines/Extensions/engine.renderTarget.ts`
- `packages/dev/core/src/Engines/WebGPU/Extensions/engine.renderTarget.ts`
- `packages/dev/core/src/Rendering/renderingManager.ts`
- `packages/dev/core/src/Rendering/renderingGroup.ts`
- `packages/dev/core/src/Layers/layer.ts`
- `packages/dev/core/src/Layers/layerSceneComponent.ts`
- `packages/dev/core/src/PostProcesses/postProcessManager.ts`
- `packages/dev/core/src/PostProcesses/postProcess.ts`

Findings:

- Base `Camera` supports perspective/orthographic modes, FOV mode, orthographic extents, near/far, viewport, layer mask, output render target, render pass id, global position, cached projection/view synchronization, rig cameras, and active-mesh checks.
- `TargetCamera`, `FreeCamera`, and `ArcRotateCamera` are control/view-authoring conveniences. Aperture should not put camera controls in the core rendering MVP.
- Render targets are full resources with render lists, active camera hooks, clear color, samples, depth/stencil texture creation, resize, post processes, cube support, refresh rate, and render execution.
- `RenderTargetWrapper` and engine render-target extensions separate public render target texture concepts from backend allocation, sample counts, depth/stencil attachments, shared depth, and WebGPU setup.
- `RenderingManager` and `RenderingGroup` dispatch submeshes into opaque, alpha test, transparent, and depth-only queues, sorted by rendering group and active camera.
- `Layer` and `LayerSceneComponent` show layer masks applying to both cameras and render targets, including background/foreground layers and post-process participation.
- Post-process managers and camera rig modes are important later but should be explicit non-MVP scope.

### PlayCanvas

Representative files inspected:

- `src/scene/camera.js`
- `src/framework/components/camera/component.js`
- `src/framework/components/camera/data.js`
- `src/framework/components/camera/system.js`
- `src/framework/components/camera/post-effect-queue.js`
- `src/scene/layer.js`
- `src/scene/composition/layer-composition.js`
- `src/scene/composition/render-action.js`
- `src/platform/graphics/render-target.js`
- `src/platform/graphics/render-pass.js`
- `src/platform/graphics/webgpu/webgpu-render-target.js`
- `src/scene/renderer/renderer.js`
- `src/scene/renderer/render-pass-forward.js`
- `src/scene/renderer/frame-pass-postprocessing.js`
- `src/scene/renderer/frame-pass-multi-view.js`

Findings:

- `Camera` stores aspect mode, projection callbacks, clear color/depth/stencil values and flags, far/near clips, FOV, frustum culling, layers, projection type, viewport rect, render target, scissor rect, view/projection history, and WebGPU depth-range projection transform helpers.
- `CameraComponent` exposes projection, FOV, near/far, orthographic height, clear flags, layers, priority, render target, rect, scissor rect, post effects, world/screen conversion helpers, and XR entry points.
- `CameraComponentSystem` copies camera component data into engine camera instances and includes the same core field list Aperture needs for extraction.
- `Layer` stores mesh instances, lights, cameras, clear flags, sorting modes, and visible instances per camera.
- `LayerComposition` builds the final render-action sequence from sorted cameras and layers. Cameras are sorted by priority, then each camera/layer/sublayer combination becomes a render action.
- `RenderAction` is a compact view-pass record: camera, layer, transparent flag, render target, clear flags, first/last camera use, postprocess trigger, and view bind groups.
- `RenderTarget`, `RenderPass`, and WebGPU render-target code cover color/depth/stencil attachments, samples, resize, mipmaps, cube faces, MRT, clear/load/store operations, and WebGPU depth/stencil attachment allocation.

## Aperture MVP Schema Direction

### Components And Handles

Use an ECS `Camera` component and renderer/resource handles:

```ts
type RenderTargetHandle = ResourceHandle<"render-target">;

interface Camera {
  enabled: boolean;
  projection: CameraProjection;
  viewport?: NormalizedRect;
  scissor?: NormalizedRect;
  clear?: CameraClearState;
  layerMask: number;
  priority: number;
  renderTarget?: RenderTargetHandle;
}
```

The camera component should not contain GPU resources, render passes, post effects, or controls. Camera controls are input systems that write transforms or camera component fields.

### Projection Data

Use an explicit projection union:

```ts
type CameraProjection =
  | {
      kind: "perspective";
      verticalFovRadians: number;
      near: number;
      far: number;
      aspect?: "auto" | number;
    }
  | {
      kind: "orthographic";
      verticalSize: number;
      near: number;
      far: number;
      aspect?: "auto" | number;
    };
```

MVP should use WebGPU-compatible projection matrices through the Aperture math wrapper. The implementation should document its clip-space convention and test it directly. Reverse-depth, oblique projection, view offsets, film gauge/lens metadata, jitter, stereo, and cube cameras are later features.

### Viewport And Scissor

Use normalized target-relative rectangles in ECS-facing data:

```ts
interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

The renderer converts normalized rectangles to physical pixels using the resolved target size. This keeps camera packets stable across worker boundaries and canvas resizes.

MVP defaults:

- `viewport`: full target, `{ x: 0, y: 0, width: 1, height: 1 }`.
- `scissor`: omitted means no scissor. If present, it must be clamped or rejected by validation.
- A view with an empty viewport or scissor should be skipped with a diagnostic.

### Clear State

```ts
interface CameraClearState {
  color?: [number, number, number, number] | null;
  depth?: number | null;
  stencil?: number | null;
}
```

MVP defaults:

- Clear color to `[0, 0, 0, 1]`.
- Clear depth to `1`.
- Do not clear stencil unless a stencil attachment exists and stencil support is enabled.
- `null` means load/preserve that attachment.

### Layers And Ordering

Use a 32-bit layer mask, matching the practical shape in three.js and Babylon.js:

- Camera packet has `layerMask`.
- Renderable packets have `layerMask`.
- Extraction includes a renderable for a camera only when `(camera.layerMask & renderable.layerMask) !== 0`.

MVP camera ordering:

- Extract all enabled cameras.
- Sort by `priority` ascending.
- Break ties by stable entity id.
- Emit one `ViewPacket` per camera.

The project can add an explicit `PrimaryCamera` or `ActiveCamera` resource for API convenience, but rendering should still be able to consume a sorted `ViewPacket[]`.

### Render Target Assets

Render targets are resource assets, not ECS components:

```ts
interface RenderTargetAsset {
  name?: string;
  size: RenderTargetSize;
  colorAttachments: RenderTargetColorAttachment[];
  depthStencil?: RenderTargetDepthStencilAttachment;
  sampleCount?: 1 | 2 | 4 | 8;
}

type RenderTargetSize =
  | { kind: "canvas" }
  | { kind: "fixed"; width: number; height: number }
  | { kind: "scale"; source: "canvas"; scale: number };
```

MVP should support the default canvas target and fixed-size 2D color targets with optional depth. Defer MRT, cube render targets, array layers, 3D render targets, render-target textures as public material inputs, post-process ping-pong chains, shared depth targets, and automatic mipmap render targets.

### View Packets

Extraction should produce plain data:

```ts
interface ViewPacket {
  cameraEntity: Entity;
  priority: number;
  layerMask: number;
  viewMatrix: Mat4Columns;
  projectionMatrix: Mat4Columns;
  viewProjectionMatrix: Mat4Columns;
  inverseViewProjectionMatrix?: Mat4Columns;
  viewport: NormalizedRect;
  scissor?: NormalizedRect;
  clear: CameraClearState;
  renderTarget?: RenderTargetHandle;
}
```

The render world resolves `renderTarget` to WebGPU attachments and converts clear/load/store behavior into render pass descriptors. ECS remains the source of authoring truth.

## Validation And Diagnostics

Camera/view validation should emit structured diagnostics with camera entity, field path, severity, and message. MVP diagnostics should cover:

- No enabled camera found.
- Camera has no `WorldTransform`.
- Perspective FOV is not finite or outside `(0, pi)`.
- Near/far are invalid, non-finite, or not ordered.
- Orthographic vertical size is non-positive or non-finite.
- Aspect is invalid when explicit.
- Viewport or scissor values are non-finite, negative size, or outside target bounds.
- Viewport/scissor resolves to zero pixels.
- Layer mask is zero.
- Render target handle is missing or not ready.
- Render target size is zero or unsupported.
- Render target sample count exceeds device limits.
- Clear stencil requested without stencil attachment/support.
- Multiple cameras target the same color/depth attachments with ambiguous clear/load ordering.
- Camera uses unsupported MVP features such as stereo, cube faces, XR, post effects, or custom projection callbacks.

Diagnostics should be emitted during camera extraction or render-target validation, not as console-only side effects.

## Deferred Features

Keep these outside the MVP:

- Camera controls: orbit, arc rotate, free/fly, follow, touch/gamepad/device orientation.
- Stereo, multiview, WebXR, cube cameras, reflection probe cameras, and array cameras.
- Post-processing queues, frame graphs, camera stacks, temporal jitter, motion vectors, and exposure/physical camera settings.
- Oblique projections, film gauge/lens metadata, view offsets, reverse-depth policy, and custom projection callbacks.
- Render target MRT, cube targets, array/3D targets, shared depth, render target textures as public material inputs, auto mipmap targets, and readback APIs.
- Editor camera semantics and viewport gizmo integration.

## Future Implementation Tests

When implementation begins, add tests around these behaviors:

1. Perspective camera projection packets are deterministic and use the documented WebGPU clip convention.
2. Orthographic camera projection packets are deterministic for vertical size, aspect, near, and far.
3. Camera extraction uses `WorldTransform` to produce view and view-projection matrices.
4. Enabled cameras are sorted by priority and then stable entity id.
5. Layer masks filter renderables with `(cameraMask & renderableMask) !== 0`.
6. Viewport and scissor defaults cover the full target, and explicit normalized rects are preserved in packets.
7. Invalid FOV, near/far, orthographic size, or aspect emits structured diagnostics and skips the view.
8. A missing render target handle emits a diagnostic and skips or redirects the view according to the documented policy.
9. Clear state serializes color/depth/stencil load-clear choices without GPU access.
10. Render target validation rejects zero-size fixed targets and unsupported sample counts.
11. A zero layer mask camera emits a warning or error before extraction.
12. Unsupported stereo/XR/custom projection data is rejected by MVP validation with an actionable diagnostic.
