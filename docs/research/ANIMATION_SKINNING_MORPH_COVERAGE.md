# Animation, Skinning, Morph, And Playback Coverage

This note records the reference-engine coverage for `task-0023` and turns it into an Aperture MVP schema direction. It is a planning artifact only; it does not introduce runtime source changes.

## Scope

The goal is to define animation, skinning, and morph data without making the renderer own animated state or introducing object-path mutation as a hidden scene graph.

MVP coverage should include:

- Transform animation clip assets.
- Animation player component data.
- Clip handles and deterministic playback state.
- Skin and morph asset schemas that can be imported before rendering support exists.
- Bone palette and morph weight extraction paths.
- Explicit deferral boundaries for state graphs, blending, IK, baked vertex animation, and full character systems.

## Reference Engine Source Anchors

### three.js

Representative files inspected:

- `src/animation/AnimationClip.js`
- `src/animation/KeyframeTrack.js`
- `src/animation/tracks/NumberKeyframeTrack.js`
- `src/animation/tracks/VectorKeyframeTrack.js`
- `src/animation/tracks/QuaternionKeyframeTrack.js`
- `src/animation/AnimationMixer.js`
- `src/animation/AnimationAction.js`
- `src/animation/PropertyBinding.js`
- `src/animation/PropertyMixer.js`
- `src/math/Interpolant.js`
- `src/math/interpolants/LinearInterpolant.js`
- `src/math/interpolants/DiscreteInterpolant.js`
- `src/math/interpolants/CubicInterpolant.js`
- `src/math/interpolants/QuaternionLinearInterpolant.js`
- `src/objects/Bone.js`
- `src/objects/Skeleton.js`
- `src/objects/SkinnedMesh.js`
- `src/renderers/webgl/WebGLMorphtargets.js`
- `src/nodes/accessors/MorphNode.js`

Findings:

- `AnimationClip` is a reusable set of named keyframe tracks with duration, parsing, validation, optimization, trimming, and clone helpers.
- `KeyframeTrack` stores times and values and chooses discrete, linear, cubic, Bezier, or quaternion interpolation through typed track classes.
- `AnimationMixer` and `AnimationAction` evaluate clips, maintain action time, loop mode, fading, time scaling, warping, effective weight, and event dispatch.
- `PropertyBinding` resolves string track paths into object properties, skeleton bones, and morph target influence indices. This is useful for import compatibility but too implicit for Aperture's ECS runtime surface.
- `PropertyMixer` blends sampled values before applying them to bound object properties.
- `Skeleton` owns bones, inverse bind matrices, a flat `boneMatrices` array, and optional bone texture data. `SkinnedMesh` binds a skeleton with bind matrices and uses bone world matrices plus inverse bind matrices for skinning.
- Morph target animation is represented as tracks targeting `.morphTargetInfluences[...]`. Aperture should translate this into explicit morph weight channels instead of exposing mutable arrays by path.

### Babylon.js

Representative files inspected:

- `packages/dev/core/src/Animations/animation.ts`
- `packages/dev/core/src/Animations/runtimeAnimation.ts`
- `packages/dev/core/src/Animations/animatable.ts`
- `packages/dev/core/src/Animations/animationGroup.ts`
- `packages/dev/core/src/Animations/animationEvent.ts`
- `packages/dev/core/src/Animations/easing.ts`
- `packages/dev/core/src/Bones/bone.ts`
- `packages/dev/core/src/Bones/skeleton.ts`
- `packages/dev/core/src/Bones/boneIKController.ts`
- `packages/dev/core/src/Bones/boneLookController.ts`
- `packages/dev/core/src/Morph/morphTarget.ts`
- `packages/dev/core/src/Morph/morphTargetManager.ts`
- `packages/dev/core/src/BakedVertexAnimation/vertexAnimationBaker.ts`
- `packages/dev/core/src/BakedVertexAnimation/bakedVertexAnimationManager.ts`
- `packages/dev/core/src/ShadersWGSL/ShadersInclude/bonesDeclaration.fx`
- `packages/dev/core/src/ShadersWGSL/ShadersInclude/bonesVertex.fx`
- `packages/dev/core/src/ShadersWGSL/ShadersInclude/morphTargetsVertexDeclaration.fx`
- `packages/dev/core/src/ShadersWGSL/ShadersInclude/morphTargetsVertex.fx`

Findings:

- `Animation` targets a property path, has frame rate, data type, loop mode, keys, tangents/easing, parsing/serialization, interpolation by type, and constants for float/vector/quaternion/matrix/color data.
- `RuntimeAnimation` and `Animatable` execute animations over time against targets, including pause/restart/stop and frame control.
- `AnimationGroup` groups targeted animations, normalization, weights, masks, play/pause/restart/stop, and event observables. This is a later feature for Aperture after simple clip playback.
- Bones and skeletons manage bone hierarchies, bind poses, transform matrices, animation ranges, preparation for GPU skinning, and serialization.
- IK/look controllers are advanced runtime control systems and should be outside the MVP boundary.
- `MorphTarget` stores target vertex data plus influence and notifies when influence changes. `MorphTargetManager` manages targets, active target counts, influence arrays, texture storage, shader defines, and serialization.
- Baked vertex animation uses texture-based animation data and runtime parameters. This is a later performance feature, not an MVP schema requirement.

### PlayCanvas

Representative files inspected:

- `src/framework/anim/evaluator/anim-track.js`
- `src/framework/anim/evaluator/anim-curve.js`
- `src/framework/anim/evaluator/anim-data.js`
- `src/framework/anim/evaluator/anim-cache.js`
- `src/framework/anim/evaluator/anim-clip.js`
- `src/framework/anim/evaluator/anim-evaluator.js`
- `src/framework/anim/evaluator/anim-target.js`
- `src/framework/anim/evaluator/anim-target-value.js`
- `src/framework/anim/evaluator/anim-blend.js`
- `src/framework/anim/binder/anim-binder.js`
- `src/framework/anim/binder/default-anim-binder.js`
- `src/framework/anim/controller/anim-controller.js`
- `src/framework/anim/controller/anim-state.js`
- `src/framework/anim/controller/anim-transition.js`
- `src/framework/anim/controller/anim-blend-tree*.js`
- `src/framework/anim/state-graph/anim-state-graph.js`
- `src/framework/components/anim/component.js`
- `src/framework/components/anim/component-layer.js`
- `src/framework/components/anim/component-binder.js`
- `src/framework/components/anim/system.js`
- `src/framework/handlers/anim-clip.js`
- `src/framework/handlers/anim-state-graph.js`
- `src/framework/components/animation/component.js`
- `src/framework/components/animation/system.js`
- `src/framework/handlers/animation.js`
- `src/scene/animation/animation.js`
- `src/scene/animation/skeleton.js`
- `src/scene/skin.js`
- `src/scene/skin-instance.js`
- `src/scene/skin-instance-cache.js`
- `src/scene/morph.js`
- `src/scene/morph-target.js`
- `src/scene/morph-instance.js`
- `src/scene/shader-lib/wgsl/chunks/common/vert/skin.js`
- `src/scene/shader-lib/wgsl/chunks/internal/morph/vert/morph.js`

Findings:

- Modern PlayCanvas animation uses `AnimTrack`, curves, input/output data, clips, caches, binders, evaluators, target values, and blending. It separates sampling from target resolution more cleanly than object-path-only models.
- `AnimEvaluator` resolves curve paths through a binder, evaluates clips, blends outputs by target type, and applies results to animation targets.
- The anim component/layer/controller/state graph stack supports layers, masks, transitions, blend trees, parameters, and animation assignment. These are later Aperture features after the deterministic clip/player path.
- Legacy animation and skeleton classes directly update graph nodes from sampled animation data. Aperture should avoid making animation own a graph and instead write ECS `LocalTransform` where transform animation is intended.
- `Skin`, `SkinInstance`, and `SkinInstanceCache` represent inverse bind poses, bone names, bone nodes, matrices, and caches for per-instance skinning data.
- `Morph`, `MorphTarget`, and `MorphInstance` represent target deltas, weights, texture/buffer backing, and per-instance morph state.
- WGSL skin and morph chunks show the renderer-side data consumers. Aperture should feed these from extracted pose packets rather than renderer-authored animation state.

## Aperture MVP Schema Direction

### Handles And Assets

Use handles for reusable animation and deformation data:

```ts
type AnimationClipHandle = AssetHandle<"animation-clip">;
type SkinHandle = AssetHandle<"skin">;
type MorphTargetSetHandle = AssetHandle<"morph-target-set">;
```

Recommended clip asset:

```ts
interface AnimationClipAsset {
  handle: AnimationClipHandle;
  label?: string;
  durationSeconds: number;
  tracks: AnimationTrack[];
}

type AnimationTrack = TransformTrack | MorphWeightTrack;

interface TransformTrack {
  target: AnimationTarget;
  property: "translation" | "rotation" | "scale";
  interpolation: "step" | "linear" | "cubic-spline";
  times: Float32Array;
  values: Float32Array;
}

interface MorphWeightTrack {
  target: AnimationTarget;
  morphTarget: string | number;
  interpolation: "step" | "linear" | "cubic-spline";
  times: Float32Array;
  values: Float32Array;
}

interface AnimationTarget {
  importedNodeId?: string;
  entity?: Entity;
  path?: string;
}
```

MVP runtime should resolve imported node IDs or paths into entity IDs during scene instantiation. Runtime playback should not repeatedly parse object paths.

### Animation Player Component

Recommended first player component:

```ts
interface AnimationPlayer {
  clip: AnimationClipHandle;
  playing: boolean;
  timeSeconds: number;
  speed: number;
  loop: "once" | "repeat" | "clamp";
  weight: number;
}
```

Rules:

- Playback is deterministic and driven by an ECS system.
- Transform tracks write `LocalTransform` fields on target entities.
- A single player and one clip per entity is enough for the first implementation.
- Cross-fades, layers, masks, state graphs, blend trees, events, root motion extraction, animation groups, and retargeting are later features.

### Skin Asset And Binding

Recommended skin asset:

```ts
interface SkinAsset {
  handle: SkinHandle;
  label?: string;
  joints: SkinJoint[];
  inverseBindMatrices: Float32Array;
}

interface SkinJoint {
  index: number;
  name?: string;
  importedNodeId?: string;
}

interface SkinnedMeshBinding {
  skin: SkinHandle;
  jointEntities: Entity[];
}
```

Skin assets describe bind-pose data and imported joint identity. `SkinnedMeshBinding` belongs on the renderable ECS entity that uses the skin. The renderer consumes extracted joint matrices but does not own skeleton state.

### Morph Target Schema

Morph target geometry deltas belong to `MeshAsset` or a linked morph target set asset:

```ts
interface MorphTargetSetAsset {
  handle: MorphTargetSetHandle;
  targets: MorphTargetAsset[];
}

interface MorphTargetAsset {
  name?: string;
  positionDeltas?: Float32Array;
  normalDeltas?: Float32Array;
  tangentDeltas?: Float32Array;
}

interface MorphWeights {
  morphTargetSet: MorphTargetSetHandle;
  weights: Float32Array;
}
```

Animation systems can write `MorphWeights`. Extraction should emit the active morph weights with the mesh draw packet or an adjacent deformation packet.

### Pose And Extraction Packets

Transform animation writes ECS state before transform resolution. Skinning and morphing are derived at extraction:

```ts
interface SkinPalettePacket {
  entity: Entity;
  skin: SkinHandle;
  jointCount: number;
  matricesOffset: number;
}

interface MorphWeightsPacket {
  entity: Entity;
  morphTargetSet: MorphTargetSetHandle;
  weightsOffset: number;
  weightCount: number;
}
```

For skinning, extraction computes joint matrices from current `WorldTransform` values and skin inverse bind matrices into a flat matrix buffer. For morphing, extraction copies current `MorphWeights` into a flat weight buffer. The WebGPU backend uploads these buffers, but the source of truth remains ECS plus asset data.

### MVP, Soon, Later

MVP planning/import:

- Preserve animation clips from glTF import as `AnimationClipAsset`.
- Preserve skin and morph schemas in mesh/import assets.
- Define `AnimationPlayer`, `SkinnedMeshBinding`, and `MorphWeights` component shapes.
- Emit diagnostics for unsupported playback, skinning, or morph rendering when assets reference those features before implementation.

Soon:

- Implement transform clip playback that writes `LocalTransform`.
- Add deterministic sampling for step, linear, and quaternion interpolation.
- Add skin palette extraction for imported skeletons.
- Add morph weight extraction and material/pipeline feature flags for morph-capable meshes.

Later:

- State graphs, transitions, blend trees, layered masks, additive blending, animation events, root motion, retargeting, IK/look-at controllers, baked vertex animation textures, GPU morph target texture packing, animation compression, and animation authoring tools.

## Future Implementation Acceptance Tests

Use these as acceptance tests when animation moves from schema planning into runtime code:

- Imports a glTF transform animation into an `AnimationClipAsset` with translation, rotation, and scale tracks.
- Rejects an animation track with non-monotonic key times and emits a structured diagnostic.
- Resolves imported node IDs to ECS entities during scene instantiation without path parsing during playback.
- Advances an `AnimationPlayer` deterministically by fixed delta time.
- Samples linear translation and scale tracks into `LocalTransform`.
- Samples quaternion rotation tracks with normalized quaternion interpolation.
- Honors `once`, `repeat`, and `clamp` loop modes.
- Leaves renderer state untouched when animation writes `LocalTransform`.
- Imports a skin asset with joint list and inverse bind matrices.
- Extracts a `SkinPalettePacket` from joint entity `WorldTransform` values and inverse bind matrices.
- Imports morph target deltas and default weights from a mesh asset.
- Extracts a `MorphWeightsPacket` from a `MorphWeights` component.
- Emits diagnostics when a clip target cannot be resolved, a skin joint entity is missing, or morph weight count does not match the target set.
