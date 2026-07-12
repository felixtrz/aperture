# Feature Audit — Aperture vs three.js

> **Scope.** A thorough, area-by-area audit of Aperture's feature surface
> against [three.js](https://github.com/mrdoob/three.js), the de-facto standard
> 3D library for the web. The goal is an honest parity map: what Aperture has,
> what is partial, what is missing, what is deliberately out of scope, and
> where Aperture is ahead of three.js. For a deeper cut on custom shaders,
> render targets/MRT, custom passes/compute, and other advanced game-dev use
> cases, see [`THREEJS_ADVANCED_RENDERING_AUDIT.md`](THREEJS_ADVANCED_RENDERING_AUDIT.md).
>
> **Versions compared.** Aperture `0.3.0` (this repo, commit `09168bc`) vs
> three.js **r184** (`v0.184.0`). The reference checkout used for this audit is
> the `super-three` fork (Meta/immersive-web) of r184; fork-only additions
> (OCULUS_multiview, compositor VR layers, post-processing in VR,
> `setPoseTarget`) are flagged separately in §23 and are not counted as
> baseline three.js features.
>
> **Method.** Aperture capabilities were inventoried directly from package
> source (`packages/*`), examples, and the e2e suite; negative claims (no XR,
> no LOD, no video textures, no hemisphere light, no wireframe, no stencil)
> were re-verified by repo-wide search. three.js capabilities were enumerated
> from its `src/` and `examples/jsm/` trees in the checkout above. Planned or
> documented-only work is never counted as implemented, on either side.
>
> **How to read the status column.**
>
> | Mark | Meaning                                                                 |
> | ---- | ----------------------------------------------------------------------- |
> | ✅   | Parity or functional equivalent exists in Aperture                      |
> | 🟡   | Partial: exists with meaningful limits vs three.js                      |
> | ❌   | Missing: no Aperture equivalent today                                   |
> | 🚫   | Deliberate non-goal per `docs/DECISIONS.md` (absence is by design)      |
> | ➕   | Aperture exceeds three.js core here (three.js needs addons/DIY/nothing) |

---

## 1. Executive summary

**The comparison is asymmetric by design.** three.js is a rendering _library_
with a mutable scene graph, two renderer backends (WebGL2 and WebGPU-with-
WebGL-fallback), a TSL shader-graph system, and a vast addon tree (~45 file
loaders, 9 camera controls, ~50 post passes, XR helpers, an editor). Aperture
is a WebGPU-only, ECS-native _runtime_: simulation is authoritative, rendering
is a derived view, and gameplay-facing subsystems that three.js leaves to the
ecosystem — physics, GPU particles, flexbox UI, text editing, a game-audio
mixer, input mapping, deterministic replay, headless/agent tooling — are
first-class packages.

**Where Aperture already stands on renderer features.** For a 0.3.0 engine the
renderer is far closer to three.js than its README suggests: PBR
metallic-roughness with clearcoat/sheen/transmission/volume/IOR/iridescence,
IBL (irradiance + PMREM specular + BRDF LUT), directional/spot/point shadows
with CSM (up to 4 cascades), PCF/PCSS filtering and a shadow atlas, clustered
forward local lights with cookies, LTC rect/disk/sphere area lights,
instancing, GPU skinning, storage-buffer morph targets (arbitrary target
counts), MSDF text, sprites, skybox + procedural sky, fog, HDR pipeline with
ACES/AgX/Neutral/Reinhard tone mapping, MSAA/FXAA/TAA, bloom/SSAO/SSR/DoF, a
frame graph with user render/compute passes, GPU picking, occlusion queries,
and glTF with Draco/Meshopt/KTX2-Basis. All of it is exercised by ~160
Playwright e2e specs.

**The biggest genuine gaps** (detail in §22): an open shader/material
extension model comparable to `ShaderMaterial`/TSL (Aperture's custom-WGSL
route is deliberately narrow), asset format breadth (glTF only; no
OBJ/FBX/USD/STL/…, no exporters), geometry primitive breadth (8 primitives vs
21+, no extrude/lathe/tube/text geometry), animation depth (single clip + one
crossfade lane vs three.js's N-action mixer with additive blending and
property tracks), mesh LOD, dedicated line/point rendering (fat lines,
point clouds), helpers/gizmos breadth, clipping planes/stencil, and the
ecosystem itself (three.js's community, docs, and examples corpus have no
Aperture equivalent). WebXR is absent as well, but by decision, not omission:
immersive use cases belong to IWSDK, the maintainer's dedicated WebXR
framework (§14, `DECISIONS.md 0023`).

**Where Aperture is ahead of three.js core:** deterministic fixed-step
simulation with record/replay and session snapshots, worker-by-default
simulation with transferable/SharedArrayBuffer snapshot transport, integrated
physics (Rapier behind a neutral contract, character controller, joints,
queries), Shuriken-style GPU particles, screen-space flexbox UI with real text
input, a game-grade audio engine (buses, ducking, virtualization, occlusion,
Doppler), typed input action mapping, clustered lighting, GPU occlusion
culling, and an agent/MCP/headless toolchain three.js has nothing like.

---

## 2. What each project is (scope & architecture)

| Axis         | three.js r184                                                                    | Aperture 0.3.0                                                                                                      |
| ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Kind         | Rendering library + addon ecosystem                                              | ECS game runtime (simulation-authoritative)                                                                         |
| World model  | Mutable `Object3D` scene graph                                                   | ECS components; no scene graph (🚫 by `DECISIONS.md 0004`)                                                          |
| Backends     | WebGL2; WebGPU renderer with automatic WebGL2 fallback                           | WebGPU only (🚫 fallback, `DECISIONS.md 0001`)                                                                      |
| Threading    | Main-thread by default; OffscreenCanvas demo in addons                           | Worker-by-default simulation; transferable or SharedArrayBuffer snapshots; main thread owns canvas/WebGPU/input/UI  |
| Shading      | GLSL `ShaderMaterial` (WebGL) and TSL node graphs compiled to WGSL/GLSL (WebGPU) | Closed built-in material union + data-only custom WGSL route (🚫 open plugin model, `DECISIONS.md 0010–0012, 0016`) |
| Math         | Class-based (`Vector3`, `Matrix4`, …)                                            | Array-first `Float32Array` kernel (wgpu-matrix conventions; 🚫 class math, `DECISIONS.md 0007`)                     |
| Determinism  | Not a goal                                                                       | First-class: seeded RNG, fixed-step clock, determinism diagnostics, session snapshots, replay                       |
| Distribution | One package + `examples/jsm` addons                                              | pnpm monorepo of 14 `@aperture-engine/*` packages + CLI/Vite plugin                                                 |
| Editor       | Full web editor (`editor/`), browser devtools extension, multi-language manual   | No visual editor; agent/MCP devtools, translate gizmo, docs-site                                                    |

The architectural rejections are load-bearing: any audit line below marked 🚫
is an absence Aperture chose on purpose and documents in `docs/DECISIONS.md`.

---

## 3. Capability scorecard

| Area                    | Standing | One-line takeaway                                                                                      |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Rendering core          | 🟡       | Frame graph, MSAA, instancing, culling, occlusion queries; no clipping planes/stencil/wireframe/LOD    |
| Materials & shading     | 🟡       | Strong PBR + extensions; 5 material families vs 18+, no open shader-graph system                       |
| Lights & shadows        | ✅/➕    | CSM + PCSS + clustered + LTC area lights in core beat three.js core; no hemisphere light/light probes  |
| Geometry & meshes       | 🟡       | Solid data model (morph/skin/multi-stream); 8 primitives vs 21+, no extrude/text/edges geometry        |
| Objects & scene         | 🟡       | Sprites/instancing/batching/fog/sky yes; LOD, fat lines, points materials, helpers no                  |
| Cameras & controls      | ✅/🟡    | Multi-camera/viewport/priority strong; 3 controllers vs 9, no cube/stereo camera                       |
| Animation               | 🟡       | glTF clips, CUBICSPLINE, crossfade, skinning, morphs; no N-clip mixing, additive layers, IK            |
| Asset I/O               | 🟡       | Deep glTF (Draco/Meshopt/KTX2) but glTF-only; no other formats, no exporters                           |
| Textures                | 🟡       | 2D/cube, BC/ETC2/ASTC, HDR/RGBE, mipmap gen; no video/3D/array/data textures                           |
| Post-processing & color | 🟡       | Tonemap/FXAA/TAA/bloom/SSAO/SSR/DoF + custom passes; three.js's pass library is far broader            |
| XR                      | 🚫       | Non-goal by decision — immersive is IWSDK's domain; three.js (esp. this fork) is the web-XR reference  |
| Audio                   | ➕       | Full game-audio engine vs three.js's five thin Web Audio wrappers                                      |
| Physics                 | ➕       | First-class ECS physics + character controller vs example-level wrappers in three.js                   |
| Particles               | ➕       | Built-in Shuriken-style GPU particles vs DIY `Points`/GPGPU in three.js                                |
| UI & text               | ➕/🟡    | Built-in flexbox UI + MSDF text + text input vs none in three.js core; screen-space only               |
| Math                    | 🟡       | Lean kernel covers engine needs; no curves/Mat3/Euler-class/SH/triangle utilities                      |
| Picking & spatial       | ✅/➕    | CPU raycast + BVH + overlap queries + GPU ID-buffer picking vs `Raycaster` (+ external three-mesh-bvh) |
| Tooling & ecosystem     | ➕/❌    | Agent/headless/MCP tooling is unique; but no editor and a tiny ecosystem vs three.js's                 |

---

## 4. Rendering core

| Feature                    | three.js                                                      | Aperture                                                                                   | Status |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| Render architecture        | Render lists/states; render bundles (WebGPU); no user graph   | Frame graph DAG (named passes/resources, clear/load intents), default-on, single encoder   | ➕     |
| Custom passes              | `EffectComposer` passes; TSL `PassNode`; `onBeforeRender`     | `addRenderPass`/`addComputePass` user passes on the app facade                             | ✅     |
| Compute                    | TSL `ComputeNode`, atomics, workgroups (WebGPU)               | Internal compute (IBL, mipmaps, particles, skinning palettes) + user compute passes        | 🟡     |
| Render targets / offscreen | 2D/3D/array/cube render targets, MRT                          | Render-target assets, camera `renderTargetId`, multi-render-target example; 2D color+depth | 🟡     |
| Readback                   | `readRenderTargetPixels`                                      | `gpu-readback` + frame-boundary readback samples + diagnostics                             | ✅     |
| MSAA                       | Antialias flag; sample counts per target (WebGPU)             | 1× or 4× (WebGPU-guaranteed set), MSAA-aware post depth sampling                           | ✅     |
| Instancing                 | `InstancedMesh`, instanced attributes                         | Automatic instanced draws for shared mesh+material, `InstanceTint`, custom instance data   | ✅     |
| Batching                   | `BatchedMesh` (multi-draw)                                    | Static mesh merge + render-queue batching                                                  | 🟡     |
| Frustum culling            | Per-object, sphere-based                                      | AABB vs 6 planes per view, per-camera toggle                                               | ✅     |
| Occlusion culling          | ❌ (manual)                                                   | GPU occlusion queries with feedback + fallback reasons                                     | ➕     |
| Sorting & transparency     | Opaque/transparent lists, `renderOrder`                       | Front-to-back opaque, stable back-to-front transparent, `RenderOrder` component            | ✅     |
| Layers / visibility        | `Layers` bitmask, `visible`                                   | `RenderLayer` masks on cameras/lights/shadows, `Visibility` component                      | ✅     |
| Clipping planes            | Global + per-material + `ClippingGroup`                       | None                                                                                       | ❌     |
| Stencil                    | Full stencil state per material                               | Explicitly unsupported (`unsupportedFeatures: "stencil"`)                                  | ❌     |
| Wireframe                  | `wireframe` flag on materials, `WireframeGeometry`            | None                                                                                       | ❌     |
| Fog                        | Linear + exponential-squared                                  | Linear, exp, exp2 (`Fog` component)                                                        | ✅     |
| Background / sky           | Scene background (color/texture/equirect + blur), `Sky` addon | Skybox (cube), procedural gradient sky with sun, per-camera clear                          | ✅     |
| LOD                        | `LOD` object                                                  | None                                                                                       | ❌     |
| Stats / profiling          | `WebGLRenderer.info`, TimestampQuery (WebGPU)                 | JSON frame reports (draw/pass/diagnostic counts), GPU timestamps, per-phase timing         | ➕     |

Notes: three.js render bundles and MRT on the node renderer have no direct
Aperture equivalent yet (Aperture has render bundles internally in
`packages/webgpu/src/render/draw/render-bundle.ts` but no MRT surface).
Aperture's diagnostics/reporting surface (readiness, dependency summaries,
`docs/DIAGNOSTICS_CATALOG.md`) is substantially deeper than `renderer.info`.

---

## 5. Materials & shading

### 5.1 Material families

| three.js material                            | Aperture equivalent                                                           | Status |
| -------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| `MeshBasicMaterial`                          | `unlit` (baseColor factor + texture, vertex colors)                           | ✅     |
| `MeshStandardMaterial`                       | `standard` (full metallic-roughness PBR)                                      | ✅     |
| `MeshPhysicalMaterial`                       | `standard` extensions: clearcoat, sheen, transmission+volume+IOR, iridescence | 🟡     |
| `MeshMatcapMaterial`                         | `matcap`                                                                      | ✅     |
| `MeshNormalMaterial`                         | `debug-normal`                                                                | ✅     |
| `MeshLambertMaterial` / `MeshPhongMaterial`  | — (use `standard`; no cheap legacy lighting models)                           | ❌     |
| `MeshToonMaterial`                           | —                                                                             | ❌     |
| `MeshDepthMaterial` / `MeshDistanceMaterial` | — (internal shadow pipelines cover the shadow use-case)                       | ✅\*   |
| `ShadowMaterial`                             | —                                                                             | ❌     |
| `SpriteMaterial`                             | `Sprite` component (billboard modes, blend modes, atlas frames)               | ✅     |
| `PointsMaterial`                             | — (point-list topology renders, but no size/attenuation material)             | 🟡     |
| `LineBasicMaterial` / `LineDashedMaterial`   | Line-list/strip topology + line-primitives example; no dashes/width           | 🟡     |
| `ShaderMaterial` / `RawShaderMaterial`       | Custom WGSL material (data-only: source asset, entry points, typed bindings)  | 🟡     |
| TSL node materials (`src/materials/nodes/`)  | — (🚫 open shader-graph model; closed union per `DECISIONS.md 0010`)          | 🚫     |

\* Aperture has no user-facing depth/distance materials, but its shadow caster
pipelines fill the role those materials exist for in three.js.

### 5.2 PBR parameter coverage (vs `MeshPhysicalMaterial`)

Present in Aperture `standard`: baseColor (factor+texture), metallic/roughness
(+texture), normal (+scale), occlusion (+strength), emissive (factor+texture),
clearcoat (+roughness, both textured), transmission (+texture), volume
(thickness, attenuation color/distance), IOR, sheen (color+roughness,
textured), iridescence (factor/texture/thickness range/IOR), alpha modes
opaque/mask/blend + cutoff, double-sided, vertex colors, TEXCOORD_1, texture
transforms. Runtime parameter patching without shader-variant recompiles. The
full factor set (including all the extension factors above) is authorable
directly on the app facade via `material.standard()` (parity plan A3).

Missing vs `MeshPhysicalMaterial`: **anisotropy**, **specular
color/intensity** (`KHR_materials_specular`), **emissive strength >1 surface**
(`KHR_materials_emissive_strength`), dispersion, attenuation for
non-transmissive paths, `envMapIntensity`-style per-material IBL scale.
`DECISIONS.md 0017` also scopes out multi-scatter energy compensation (the
live specular-IBL path uses an analytic Karis approximation; a GPU DFG LUT
exists).

### 5.3 Custom shading

three.js offers three tiers: `ShaderMaterial` (arbitrary GLSL + lib uniforms),
`onBeforeCompile` chunk patching, and the full TSL node graph (compiled to
WGSL or GLSL, with compute, MRT, custom lighting models, a GLSL→TSL
transpiler, and a node-graph inspector). Aperture deliberately ships a single
narrow route: custom WGSL as a _data-only asset_ (`sourceDiscriminator:
"custom-material-source"`) with typed uniform/texture/sampler bindings —
storage buffers are diagnosed as unsupported on the app route, and lighting/
environment integration for custom WGSL is deferred (`docs/AUTHORING.md`).
This is the widest expressiveness gap between the two projects, and it is
partly a policy choice (no live GPU objects in ECS, `DECISIONS.md 0016`)
rather than purely missing work.

---

## 6. Lights & shadows

| Feature                  | three.js core                                              | Aperture                                                                                           | Status |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------ |
| Ambient light            | `AmbientLight`                                             | `ambient` kind                                                                                     | ✅     |
| Directional light        | `DirectionalLight`                                         | `directional` kind                                                                                 | ✅     |
| Point light              | `PointLight`                                               | `point` kind (+range)                                                                              | ✅     |
| Spot light               | `SpotLight` (+map projection)                              | `spot` kind (+inner/outer cones) + `LightCookie` projected textures                                | ✅     |
| Rect area light          | `RectAreaLight` (LTC, rect only, no shadows)               | `rect-area` with **rect/disk/sphere** LTC shapes                                                   | ➕     |
| Hemisphere light         | `HemisphereLight`                                          | None                                                                                               | ❌     |
| Light probes / SH        | `LightProbe`, `SphericalHarmonics3`, probe generator addon | None                                                                                               | ❌     |
| IES profiles / projector | `IESSpotLight`, `ProjectorLight` (WebGPU)                  | Light cookies cover projector-style use; no IES                                                    | 🟡     |
| Environment/IBL          | `Scene.environment` + `PMREMGenerator`                     | `environment` light kind: equirect→cube, irradiance convolution, PMREM, BRDF LUT (all GPU compute) | ✅     |
| Many-light scaling       | Forward uniform arrays (limits); TSL tiled lights addon    | Clustered forward local lights, growable storage buffer, no hard cap                               | ➕     |
| Shadow types             | Basic / PCF / PCFSoft / VSM                                | Hard / PCF / PCSS (contact-hardening)                                                              | ✅     |
| Directional shadows      | Single ortho map; CSM only as addon (`examples/jsm/csm`)   | Single map **and CSM up to 4 cascades in core**, auto-fit or fixed bounds                          | ➕     |
| Spot shadows             | Perspective map                                            | Perspective map                                                                                    | ✅     |
| Point shadows            | Cube map                                                   | Cube map (6 faces)                                                                                 | ✅     |
| Shadow controls          | bias, normalBias, radius, mapSize                          | bias, normalBias, slopeBias, strength, filterRadius, mapSize, layer masks                          | ✅     |
| Shadow atlas             | ❌ (one texture per light)                                 | Atlas packing for multiple maps                                                                    | ➕     |
| Area-light shadows       | ❌                                                         | ❌ (clustered local-light shadows cover point/spot only)                                           | —      |

The `LIGHT_SHADER_WGSL_CONTRACT.md` "deferred: IBL, shadows" list is stale —
both are implemented and e2e-tested (`test/e2e/ibl-brdf.spec.ts`,
`csm-directional-shadow.spec.ts`, etc.).

---

## 7. Geometry & meshes

| Feature               | three.js                                                                                                                                                                   | Aperture                                                                                                                                  | Status |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Primitives            | 21: box, capsule, circle, cone, cylinder, dodeca/icosa/octa/tetrahedron, extrude, lathe, plane, polyhedron, ring, shape, sphere, torus, torus-knot, tube, edges, wireframe | 8: box, plane, sphere, cone, cylinder, capsule, torus, line-list                                                                          | 🟡     |
| Text geometry         | `TextGeometry` (+TTF/Font loaders) addon                                                                                                                                   | — (text is MSDF quads, not extruded geometry)                                                                                             | ❌     |
| Shape/curve extrusion | `Shape`/`ShapePath`/Earcut + extrude/lathe/tube                                                                                                                            | None                                                                                                                                      | ❌     |
| Vertex attributes     | Arbitrary `BufferAttribute`s, interleaved, instanced                                                                                                                       | Fixed semantic set: position, normal, tangent, uv0/uv1, color, joints0/1, weights0/1, morph slots; multi-stream; custom per-instance data | 🟡     |
| Index formats         | uint16/uint32                                                                                                                                                              | uint16/uint32                                                                                                                             | ✅     |
| Topologies            | Triangles (+strips via draw modes removed), lines, points objects                                                                                                          | triangle-list/strip, line-list/strip, point-list per submesh                                                                              | ✅     |
| Submeshes / groups    | `geometry.groups` + material array                                                                                                                                         | Submeshes with per-submesh material slots + topology (`MaterialSlots`)                                                                    | ✅     |
| Morph targets         | Position/normal/color targets, GPU textures                                                                                                                                | Storage-buffer deltas, arbitrary target counts (52-blendshape tested), named targets                                                      | ✅     |
| Skinning              | `SkinnedMesh`/`Skeleton`/`Bone`, GPU palettes                                                                                                                              | `Skin` component, 2 joint/weight sets, GPU storage-buffer palettes                                                                        | ✅     |
| Bounds                | Box + sphere, computed on demand                                                                                                                                           | Local AABB + bounding sphere on assets; merge/transform utilities                                                                         | ✅     |
| Tangent generation    | `computeTangents` (+mikktspace addon)                                                                                                                                      | glTF import-time tangent generation                                                                                                       | 🟡     |
| Geometry utils        | `BufferGeometryUtils` (merge/dedupe/simplify addons)                                                                                                                       | Mesh merge for static batching only                                                                                                       | 🟡     |
| Procedural normals    | `computeVertexNormals`                                                                                                                                                     | glTF import-time normal generation                                                                                                        | 🟡     |

Aperture's mesh _data model_ is near-parity; the gap is authoring breadth
(procedural primitives, shape/curve tooling) — three.js's curve/shape/extrude
stack simply has no counterpart.

---

## 8. Objects & scene features

| three.js object                                                  | Aperture                                                                        | Status |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| `Group` / hierarchy                                              | `Parent`/`Children` components, world-preserving `setParent`, recursive despawn | ✅     |
| `Mesh`                                                           | `Mesh` + `Material` components                                                  | ✅     |
| `SkinnedMesh`                                                    | `Skin` + animation driver                                                       | ✅     |
| `InstancedMesh`                                                  | Automatic instancing + `InstanceTint`/`InstanceData`                            | ✅     |
| `BatchedMesh`                                                    | Static mesh merging (no dynamic per-instance geometry batching)                 | 🟡     |
| `Sprite`                                                         | `Sprite` component (richer: billboard modes, screen/world sizing, atlases)      | ➕     |
| `Points` + `PointsMaterial`                                      | point-list topology only; no size attenuation/point sprites material            | 🟡     |
| `Line`/`LineSegments`/fat lines addon                            | line topology + `line-primitives` example; no width/dash                        | 🟡     |
| `LOD`                                                            | None                                                                            | ❌     |
| `ClippingGroup`                                                  | None (no clipping planes at all)                                                | ❌     |
| Helpers (13 core + addons)                                       | Physics debug geometry (wireframes/contacts/AABBs/joints), translate gizmo      | 🟡     |
| `Sky`, `Water`, `Reflector`, `Lensflare`, `MarchingCubes` addons | Procedural sky only; SSR pass covers some reflector use-cases                   | 🟡     |
| Scene `.environment`/`.background`                               | Environment light kind + skybox/procedural sky per camera                       | ✅     |
| `.overrideMaterial`                                              | None                                                                            | ❌     |

---

## 9. Cameras & controls

| Feature              | three.js                                                                                 | Aperture                                                                                        | Status |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| Perspective / ortho  | Both                                                                                     | Both (`projection`, fovY, orthographicHeight, near/far, autoAspect)                             | ✅     |
| Multi-camera         | Manual multi-pass; `ArrayCamera` for batched sub-views                                   | Priority-ordered cameras, per-camera viewport/scissor/clear/layer-mask/target                   | ➕     |
| Viewport / scissor   | Renderer-level state                                                                     | Per-camera normalized viewport + scissor components                                             | ✅     |
| `CubeCamera`         | 6-face environment capture                                                               | None (environment maps import; no live scene capture)                                           | ❌     |
| `StereoCamera`       | L/R eye pair (VR/anaglyph)                                                               | None                                                                                            | ❌     |
| TAA jitter           | Internal to TRAA/TAA passes                                                              | `temporalJitter` camera fields feeding TAA                                                      | ✅     |
| Controls             | 9 addons: Orbit, Map, Trackball, Arcball, Fly, FirstPerson, PointerLock, Drag, Transform | Orbit, fly/first-person, follow controllers + translate gizmo; ECS-authoritative, headless-safe | 🟡     |
| Screen-space framing | Manual                                                                                   | `ScreenSpaceFraming` component + camera fit/look-at APIs                                        | ➕     |

Aperture's controllers are input-agnostic and worker/headless-safe (a design
three.js controls can't offer), but the breadth gap is real: no
trackball/arcball/map/pointer-lock/drag equivalents, and only translation
gizmos (no rotate/scale transform gizmo).

---

## 10. Animation

| Feature             | three.js                                                                                   | Aperture                                                                                               | Status |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------ |
| Clip format         | `AnimationClip` + typed `KeyframeTrack`s (bool/color/number/quat/string/vector)            | `AnimationClip` channels: translation/rotation/scale/weights only                                      | 🟡     |
| Interpolation       | Linear, discrete, cubic, Bezier, quaternion-linear                                         | LINEAR (quat hemisphere-aware), STEP, CUBICSPLINE Hermite (glTF-parity)                                | ✅     |
| Mixer               | `AnimationMixer`: N simultaneous actions, weights, fade in/out, sync, time scaling, events | Single active clip + one crossfade lane; play/crossFade/pause/seek; once/repeat/pingpong; signed speed | 🟡     |
| Additive blending   | `makeClipAdditive`, additive blend mode                                                    | None (weighted blend only)                                                                             | ❌     |
| Property binding    | Animate any object property path                                                           | TRS + morph weights only (by design: ECS state is mutated by systems)                                  | 🟡     |
| Skeletal animation  | `SkinnedMesh` + tracks                                                                     | glTF skins + joint-palette system                                                                      | ✅     |
| Morph animation     | Weight tracks                                                                              | Weight channels → `MorphTargetWeights`                                                                 | ✅     |
| IK                  | `CCDIKSolver` addon                                                                        | None                                                                                                   | ❌     |
| Retargeting / utils | `SkeletonUtils.retargetClip`                                                               | None                                                                                                   | ❌     |
| Tweening / easing   | External (tween.js bundled in examples)                                                    | None (lerp/slerp primitives only)                                                                      | ❌     |

Aperture's sampler quality is high (allocation-light, matches three.js
`GLTFCubicSplineInterpolant` behavior), but the mixing model is one tier below
`AnimationMixer`: no layered N-clip blending, no additive layers, no
animation of arbitrary component fields.

---

## 11. Asset I/O (loaders & exporters)

| Feature             | three.js                                                                                                 | Aperture                                                                                                                                                                  | Status |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| glTF/GLB            | `GLTFLoader` + Draco/KTX2/meshopt plugins, huge extension coverage                                       | Report-driven importer: meshes, PBR materials, textures, samplers, skins, animations, morphs                                                                              | ✅     |
| glTF compression    | Draco, meshopt, quantization                                                                             | `KHR_draco_mesh_compression`, `EXT/KHR_meshopt_compression`, `KHR_mesh_quantization`                                                                                      | ✅     |
| glTF textures       | KTX2/Basis, WebP, AVIF, texture transform                                                                | `KHR_texture_basisu`, `EXT_texture_webp`, `EXT_texture_avif`, `KHR_texture_transform`                                                                                     | ✅     |
| glTF materials      | unlit, clearcoat, sheen, transmission, volume, IOR, iridescence, specular, emissive strength, anisotropy | unlit, clearcoat, sheen, transmission, volume, IOR, iridescence (no specular/emissive-strength/anisotropy)                                                                | 🟡     |
| glTF corner cases   | Sparse accessors etc.                                                                                    | Sparse accessors and zero-fill accessors diagnosed as unsupported                                                                                                         | 🟡     |
| Other 3D formats    | ~45 addon loaders: FBX, OBJ/MTL, Collada, USD/USDZ, PLY, STL, SVG, VOX, LDraw, 3DM, …                    | None — glTF only                                                                                                                                                          | ❌     |
| Image/texture       | Texture/Cube/HDR (RGBE, EXR, UltraHDR, KTX, DDS, TGA…) loaders                                           | Browser-decodable images, HDR RGBE, KTX2/Basis; no EXR/DDS/TGA                                                                                                            | 🟡     |
| Fonts               | TTF loader + `FontLoader`                                                                                | MSDF `font-atlas` asset kind (pre-baked atlases)                                                                                                                          | 🟡     |
| Audio               | `AudioLoader` (decode via Web Audio)                                                                     | `audio-clip` assets, buffered decode + `HTMLMediaElement` streaming                                                                                                       | ✅     |
| Exporters           | GLTF, USDZ, OBJ, PLY, STL, DRACO, EXR, KTX2                                                              | None                                                                                                                                                                      | ❌     |
| Loading manager     | `LoadingManager`, cache, progress                                                                        | `AssetRegistry`: lifecycle states, versioning, dependency graph + cycle diagnostics, manifest reports, preload policies (blocking/background/manual), provenance tracking | ➕     |
| Scene serialization | `ObjectLoader` / `toJSON` round-trip                                                                     | Scene document format v1 (pure ECS state, entity-ref remap) + prefab instantiation with overrides                                                                         | ✅     |

The deliberate bet is depth-over-breadth: one first-class format (glTF) with
compression and a real registry, vs three.js's long tail of importers. For
content pipelines that can standardize on glTF this is parity; for everything
else it is a hard gap.

---

## 12. Textures

| Feature                 | three.js                                                               | Aperture                                                            | Status |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ | --- |
| 2D / cube               | Yes                                                                    | Yes (`dimension: 2d                                                 | cube`) | ✅  |
| 3D / array textures     | `Data3DTexture`, `DataArrayTexture`, compressed variants               | None (internal shadow arrays only)                                  | ❌     |
| Video / canvas / HTML   | `VideoTexture`, `VideoFrameTexture`, `CanvasTexture`, `HTMLTexture`    | None                                                                | ❌     |
| Data / depth / external | `DataTexture`, `DepthTexture`, `ExternalTexture`, `FramebufferTexture` | Explicit mip `sourceData` uploads; no user depth/external textures  | 🟡     |
| Compressed              | BC/ETC2/ASTC via KTX2/DDS/PVR/KTX loaders                              | BC1/3/7, ETC2, ASTC-4x4 via KTX2/Basis with device-driven transcode | ✅     |
| HDR                     | RGBE/EXR/UltraHDR loaders, half/float                                  | RGBE parser + rgba16float pipeline                                  | 🟡     |
| Samplers                | Wrap/filter/anisotropy on texture                                      | Full sampler assets: address modes, filters, LOD clamps, anisotropy | ✅     |
| Mipmaps                 | Auto-generation                                                        | GPU mipmap generation                                               | ✅     |
| Color-space handling    | `ColorManagement` + per-texture colorSpace                             | Per-texture colorSpace (srgb/linear/data) + semantic validation     | ✅     |

---

## 13. Post-processing & color

| Feature          | three.js                                                                                                                                                   | Aperture                                                               | Status |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Tone mapping     | Linear, Reinhard, Cineon, ACESFilmic, AgX, Neutral, Custom                                                                                                 | none, linear, reinhard, aces, agx, neutral (three.js-faithful ports)   | ✅     |
| Color management | sRGB/Linear working spaces, P3 support                                                                                                                     | linear working space, sRGB output, applied across all built-in shaders | ✅     |
| HDR pipeline     | Renderer half-float targets                                                                                                                                | Opt-in rgba16float scene target + exposure                             | ✅     |
| AA passes        | FXAA, SMAA, SSAA, TAA/TRAA/TAAU, MSAA                                                                                                                      | MSAA (1/4×), FXAA, TAA (motion vectors + history)                      | 🟡     |
| Bloom            | `UnrealBloomPass` / `BloomNode`                                                                                                                            | Multi-level bloom (bright-pass, down/upsample chain)                   | ✅     |
| AO               | SSAO, SAO, GTAO                                                                                                                                            | SSAO (+ indirect variant)                                              | 🟡     |
| Reflections      | SSR pass/node, SSGI                                                                                                                                        | SSR                                                                    | ✅     |
| Depth of field   | Bokeh pass, DepthOfFieldNode                                                                                                                               | DoF                                                                    | ✅     |
| Everything else  | Outline, motion blur, god-rays, LUTs, film/glitch/halftone/pixelate/dot-screen/afterimage/lens-flare/sharpen/denoise/FSR/transition, ~40 TSL display nodes | None                                                                   | ❌     |
| Composer model   | `EffectComposer` pass chain / TSL `PostProcessing` graphs                                                                                                  | Ordered `WebGpuPostEffect[]` on the app + custom frame-graph passes    | ✅     |

The core pipeline effects a shipped game needs (AA, bloom, AO, SSR, DoF,
tonemap) all exist and are e2e-tested; the long tail of stylistic passes does
not. `docs/POST_EFFECTS.md` under-documents the shipped set (it omits
SSAO/SSR/TAA/DoF).

---

## 14. XR

**Aperture has no XR support, by design** (🚫, `DECISIONS.md 0023`) — no
`navigator.xr`, no session management, no controller/hand input, no reference
spaces (verified repo-wide). Immersive use cases are deliberately left to
**IWSDK**, the maintainer's dedicated WebXR framework; Aperture stays a
flat-screen WebGPU runtime so the two projects tell one story instead of
competing. The split also fits the architecture: XR pose/input loops are
main-thread browser APIs, which sits awkwardly with Aperture's
worker-authoritative simulation boundary.

For reference, three.js core ships `WebXRManager` (VR+AR sessions,
controllers, hand tracking, depth sensing, foveation) plus addon helpers
(VR/AR/XR buttons, controller/hand model factories, `XREstimatedLight`,
`XRPlanes`); the `super-three` fork this audit ran against adds multiview
rendering, compositor layers, and VR post-processing on top. For
VR/AR-adjacent work, the intended pairing is three.js/IWSDK — not Aperture.

---

## 15. Audio

three.js audio is five thin Web Audio wrappers: `AudioListener`, `Audio`,
`PositionalAudio` (PannerNode with cone/distance models), `AudioAnalyser`,
`AudioContext` (+ `PositionalAudioHelper` addon). Playback control, mixing,
prioritization, and lifecycle are left to the app.

Aperture ships a game-audio engine (`packages/audio`):

- Buffered (decode-once clip cache) and streaming (`HTMLMediaElement`)
  playback, loop windows with three.js-parity `loopStart`/`loopEnd`, one-shots.
- Spatialization: HRTF/equal-power panners, distance models, directional
  cones, per-voice low-pass **occlusion**, opt-in **Doppler** — plus the ECS
  authoring components (`AudioEmitter`/`AudioListener`) extracted through the
  same snapshot boundary as rendering.
- Mixer: five buses + master, per-bus analysers, **sidechain ducking**, game
  pause semantics, mono downmix, dual-bus music **crossfade**, master limiter
  (upgradeable to an AudioWorklet brickwall).
- **Voice virtualization**: pooled voices with priority and audibility radius
  that demote to node-less virtual voices and re-promote mid-loop.
- Deterministic settings commands, captions/a11y events, a standalone
  `SoundBoard`, and a fake backend for deviceless tests.

Status: ➕ — well beyond three.js core. three.js's only edge is its `Audio`
API ubiquity in examples; there is no capability it has that Aperture lacks
except trivially attaching arbitrary Web Audio node graphs per sound
(Aperture exposes biquad/convolver/compressor factories but does not wire a
user-facing insert-effect graph; convolver reverb is an unwired seam).

---

## 16. Physics

three.js has no physics; `examples/jsm/physics/` ships thin demo wrappers
(`AmmoPhysics`, `JoltPhysics`, `RapierPhysics`) that support boxes/spheres/
instanced meshes with positions — no joints, no character controller, no
query API, no events. Real projects integrate an external engine themselves.

Aperture ships physics as a first-class, backend-neutral subsystem
(`packages/physics` + `packages/physics-rapier`, Rapier 0.19.3):

- Bodies: static/dynamic/kinematic (position+velocity), damping, gravity
  scale, CCD, sleep, per-axis locks. Colliders: box/sphere/capsule/cylinder/
  cone/convex-hull/trimesh/heightfield, compound colliders, sensors,
  friction/restitution combine rules, collision/solver groups.
- Joints: fixed/spherical/revolute/prismatic/distance with motors and limits
  (generic joints, break forces, and joint impulse readback are diagnosed as
  unsupported).
- Kinematic character controller (slopes, autostep, snap-to-ground, impulse
  propagation), full query set (raycast first/all, overlap, shape-cast,
  project-point), rich event stream (collision/trigger/contact-force/
  sleep-wake), debug geometry, deterministic fixed-step clock with
  interpolation state, and a dedicated-physics-worker execution mode.
- A pure-TS reference backend and ~7,900 lines of physics tests.

Status: ➕. Known V1 limits (per `DECISIONS.md 0019` and diagnostics):
trimesh/heightfield are static-only, asset colliders reject non-unit scale,
convex/tri/heightfield shapes cannot be used for overlap/shape-cast queries.

---

## 17. Particles

three.js core has no particle system — the idiom is `Points` + custom
materials or `GPUComputationRenderer`/TSL compute, with third-party
`three.quarks` as the ecosystem's real answer.

Aperture ships a Shuriken-style system: schema/validation in
`packages/particles`, GPU compute simulation + rendering in
`packages/webgpu`. Full module set (emission with bursts + rate-over-distance,
10 emitter shapes, size/color/rotation/velocity/force/limit-velocity/noise/
orbital over lifetime, by-speed variants, texture-sheet animation, trails,
collision, sub-emitters), Unity-style curve/gradient value types baked to GPU
tables, composite multi-emitter effects, world/local simulation space, seeded
determinism, soft particles, four billboard modes + mesh + trail render modes.

Honest limits: several modules are continuous-emitter-only (burst variants
diagnosed), mesh render mode draws billboard impostors rather than instanced
meshes, trails are impostor ribbons, mesh-surface emission samples a bounds
proxy, and sub-emitter runtime spawning is schema-only. Unity/three.quarks
importers are mapped (`docs/PARTICLE_EFFECT_MAPPINGS.md`) but not implemented.

Status: ➕ vs three.js core by a wide margin; roughly comparable in intent to
`three.quarks` with a cleaner GPU/determinism story and a shorter feature
tail.

---

## 18. UI & text

three.js core has no UI or text system (text = `TextGeometry` extrusion or
canvas/`HTMLMesh`; the ecosystem answer is troika-three-text and
`pmndrs/uikit`). Aperture ships:

- **MSDF text** in-scene and in UI, with atlas assets, kerning, wrapping,
  alignment (near-parity with troika per `docs/UI_SYSTEM_AUDIT.md`).
- **Screen-space UI**: ECS-authored components, Yoga-backed **full flexbox**
  (grow/shrink/wrap/justify/align/gap/percent/aspect/absolute-inset),
  SDF-rendered rounded corners and per-side borders, conditional + responsive
  styling layers (hover/active/focus/dark + Tailwind-style breakpoints),
  scroll + synthesized scrollbars, **real text input** (deterministic editing
  reducer, caret/selection, password masking, hidden-DOM IME bridge), a
  declarative builder (`screen/box/row/column/text/image/button`), and a HUD
  kit. Deterministic and worker-safe.
- Interaction: unified pointer driver with UI hit-testing that blocks scene
  picking, click/drag discrimination, and wheel/drag scrolling.

Gaps vs the three.js ecosystem: **screen-space only** (world-space/3D UI is a
v1 non-goal), no CSS grid, no video/SVG primitives, live hover/active restyle
wiring incomplete, no React binding (deferred). Note `docs/UI_SYSTEM_AUDIT.md`
§verdicts predate the `packages/ui` flexbox/input work and now under-state the
system.

Status: ➕ vs three.js core (which has nothing); 🟡 vs `uikit` specifically.

---

## 19. Math

| three.js class                                | Aperture                                                             | Status |
| --------------------------------------------- | -------------------------------------------------------------------- | ------ |
| `Vector2/3/4`, `Quaternion`, `Matrix4`        | `Vec2/3/4`, `Quat`, `Mat4` (Float32Array kernel + ergonomic API)     | ✅     |
| `Matrix2/3`                                   | None                                                                 | ❌     |
| `Euler`                                       | Euler→quat conversions (all 6 orders); no Euler type                 | 🟡     |
| `Color` + `ColorManagement`                   | `Color` = Vec4 alias + `hexColor`; color-space logic lives in render | 🟡     |
| `Box2/3`, `Sphere`, `Plane`, `Frustum`, `Ray` | `Aabb`, `BoundingSphere`, `Plane`, `Frustum`, `Ray` interfaces + ops | ✅     |
| `Triangle`, `Line3`                           | None                                                                 | ❌     |
| `Spherical`, `Cylindrical`                    | None (orbit controller does its own spherical math)                  | ❌     |
| `SphericalHarmonics3`                         | None                                                                 | ❌     |
| Interpolants / easing / curves                | lerp/slerp/lerpAngle/expSmoothingAlpha only; no curve/spline classes | ❌     |
| `MathUtils` (clamp/lerp/damp/rand…)           | clamp/lerp/inverseLerp/remap + seeded RNG in app context             | ✅     |
| Noise (addons: simplex/improved)              | Particle-module noise only; no reusable noise utility                | 🟡     |

The kernel philosophy (array-first, wgpu-matrix conventions, Z 0..1) is a
deliberate divergence (`DECISIONS.md 0007`); the functional gaps that matter
in practice are curves/splines (needed for paths/camera rails/tube geometry)
and `Triangle`/`Line3`-style utilities.

---

## 20. Picking & spatial queries

| Feature         | three.js                                                            | Aperture                                                                            | Status |
| --------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| CPU raycasting  | `Raycaster` (recursive, per-object intersect, all object types)     | AABB raycast + triangle-precise `raycastFirst/All` over bounds/collider/visual-mesh | ✅     |
| Acceleration    | External `three-mesh-bvh` (🚫 rejected as dep, `DECISIONS.md 0015`) | Native typed-array mesh BVH + entity-bounds BVH (`MeshQueryAcceleration`)           | ✅     |
| Overlap queries | ❌ (physics engines / DIY)                                          | `overlapSphere/Box/Capsule`, `closestPoint` — plus the physics query set            | ➕     |
| GPU picking     | DIY render-target tricks                                            | ID-buffer `pick(x,y)` with `Pickable` precision modes (bounds/visual-mesh/collider) | ➕     |
| Pointer events  | DIY / `InteractionManager` addon                                    | Per-frame interaction driver: enter/leave/down/up/click/drag, UI-blocking, cursor   | ➕     |

---

## 21. Tooling, docs & ecosystem

| Axis             | three.js                                                                                | Aperture                                                                                                                             | Status |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Visual editor    | Full web editor, PWA                                                                    | None (translate gizmo + agent devtools)                                                                                              | ❌     |
| Debugging        | Browser devtools extension, Inspector UI (tabs, TSL graph editor), helpers              | Diagnostics-first architecture: 786 KB machine-readable diagnostics catalog, frame reports, GPU profiler example                     | 🟡     |
| Headless / CI    | Not a goal (node runs need mocks)                                                       | Headless Node runner, render bundles → PNG, session snapshots, determinism reports, golden-baseline e2e                              | ➕     |
| AI/agent tooling | None                                                                                    | CLI MCP server (app control, ECS inspect/mutate, frame capture, input injection, RAG reference search), Vite plugin, scaffolding CLI | ➕     |
| Docs             | Multi-language manual, full API docs, hundreds of live examples                         | Docs-site, ~25 docs, ~90 example pages, 4 showcase games                                                                             | 🟡     |
| Ecosystem        | Massive: R3F, drei, uikit, three.quarks, three-mesh-bvh, countless loaders/integrations | None yet (0.3.0, no-PR policy, AI-maintained)                                                                                        | ❌     |
| Test rigor       | Unit tests + example screenshots                                                        | `pnpm run check` gauntlet, shuffled vitest, 162 e2e specs, WebGPU golden baselines, benchmark suites                                 | ➕     |

Notably, Aperture already maintains its own three.js reference harness:
`shadow-lab/` vendors the three.js WebGPU build and renders the same scene
side-by-side (`?compare` on by default) to validate shadows, fog, and post
against three.js output — parity with three.js is an explicit internal
quality bar for those slices.

---

## 22. Ranked gap list & standing summary

> A phased closure roadmap with acceptance criteria for every item below
> lives in [`THREEJS_PARITY_PLAN.md`](THREEJS_PARITY_PLAN.md).

### 22.1 Top gaps (three.js has it, Aperture doesn't), ranked by impact

(WebXR is intentionally excluded from this list: its absence is a recorded
decision, not a gap — see §14 and `DECISIONS.md 0023`.)

1. **Open shading/material extensibility** — no `ShaderMaterial`/TSL
   equivalent; custom WGSL route lacks lighting integration, storage buffers
   (app route), and any node/graph tooling (§5.3). Partly policy (🚫).
2. **Asset format breadth + exporters** — glTF-only; no OBJ/FBX/USD/STL/PLY/
   EXR/…; no export of any kind (§11).
3. **Animation depth** — no N-clip mixing, additive layers, arbitrary property
   tracks, IK, or retargeting (§10).
4. **Geometry authoring** — 8 primitives; no shape/extrude/lathe/tube/text
   geometry, no platonic solids, no edges/wireframe derivation (§7).
5. **Lines & points as first-class renderables** — no fat lines, dashes, point
   size/attenuation materials (§8).
6. **Mesh LOD** — none (§4).
7. **Clipping planes & stencil** — none; stencil explicitly unsupported (§4).
8. **Camera/controls breadth** — no pointer-lock/trackball/arcball/map/drag
   controls; no rotate/scale gizmos; no CubeCamera/StereoCamera (§9).
9. **Post-processing tail** — no outline, motion blur, GTAO, SMAA, LUT,
   god-rays, stylistic passes (§13).
10. **Helpers & scene extras** — no axes/grid/light/camera/skeleton helpers,
    Sky/Water/Reflector/Lensflare objects (§8).
11. **Texture types** — no video/canvas/3D/array/data/depth/external textures
    (§12).
12. **Light probes / hemisphere light / IES** (§6).
13. **Math utilities** — curves/splines, Triangle/Line3, Spherical, SH,
    easing (§19).
14. **Visual editor & ecosystem** — no editor; no community ecosystem (§21).

### 22.2 Where Aperture is ahead of three.js core

- Deterministic simulation: seeded RNG, fixed-step + interpolation, session
  snapshots, determinism diagnostics, input replay.
- Worker-by-default architecture with transferable/SAB snapshot transport.
- Integrated physics (bodies/joints/character/queries/events) vs demo wrappers.
- Built-in Shuriken-style GPU particle system.
- Built-in flexbox UI with MSDF text and real text input.
- Game-audio engine: buses, ducking, virtualization, occlusion, Doppler,
  limiter, captions.
- Typed input action mapping (keyboard/pointer/wheel/gamepad) with
  edge-detection signals.
- Clustered forward lighting (uncapped local lights + cookies + shadows),
  in-core CSM, PCSS, shadow atlas, LTC disk/sphere area lights.
- GPU occlusion queries, GPU ID-buffer picking, overlap/closest-point queries.
- Frame-graph renderer with user compute passes and deep frame diagnostics.
- Headless/CI/agent tooling: MCP server, render bundles, golden baselines,
  RAG reference corpus.
- Asset registry with dependency graphs, preload policies, and provenance.

### 22.3 Deliberate non-goals (absences by decision, not omission)

Mutable `Object3D`/scene graph; WebGL fallback; class-based math; open
renderer plugin/material model; live GPU objects in ECS; three-mesh-bvh
dependency; dynamic trimesh/heightfield bodies (V1); render-thread-owned
state of any kind; **WebXR** (immersive use cases belong to IWSDK, the
maintainer's dedicated WebXR framework). See `docs/DECISIONS.md` 0001–0023.

---

## 23. Note on the comparison checkout (`super-three` fork)

The local `three.js` checkout is `super-three` v0.184.0 — Meta's
immersive-web fork of r184. Differences from upstream that affected this
audit: it **adds** OCULUS_multiview antialiased multiview, WebXR compositor
layers, VR post-processing, and `WebXRManager.setPoseTarget`; it **removes**
the MMD toolchain (MMDLoader/MMDPhysics). All §14 fork additions were counted
as fork extras, not baseline; MMD was counted as an upstream three.js feature
despite being absent from this checkout. Everything else audited matches
upstream r184.
