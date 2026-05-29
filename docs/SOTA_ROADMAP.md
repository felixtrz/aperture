# Aperture → SOTA Web 3D Engine — Execution Roadmap

_Generated 2026-05-28. Working execution guide; supersede freely as work lands._

## 📋 Status — agent progress log

<!--
  AGENTS, READ FIRST. This block is the single source of truth for roadmap progress.
  RULES:
    1. Update this block in the SAME change-set as any roadmap work, and ALWAYS before you stop.
    2. Keep every field and every "> _What to write:_" line — those are PERMANENT instructions, never content to overwrite or delete.
    3. Edit only the value lines, the tables, and the logs. Never remove a field.
    4. Work ONE task at a time. Pull only from the current wave. A task/milestone is "done" only when its proof passes AND `pnpm run check` is green.
    5. Use absolute dates (YYYY-MM-DD [HH:MM TZ]) everywhere — never "today"/"now".
-->

**Last updated:** `2026-05-28 23:37 PDT — codex/gpt-5`

> _What to write:_ Absolute date + time + timezone, then `— <your agent/author id>` (e.g. `2026-06-02 14:30 PDT — claude/opus`). Update on every edit to this block.

**Current wave:** `0`

> _What to write:_ The single lowest-numbered wave (0–4) that still has an incomplete milestone — the ONLY wave to pull work from. Bump it only once every milestone in the current wave is `done`.

**Active task:** `none`

> _What to write:_ Exactly ONE task id (`M#-T#`) you are mid-implementation on, or `none` when between tasks. Never two at once. Reset to `none` after you record the result in the completion log below.

**Next recommended task:** `M1-T3 — enables truthful shadow shaderSampling status now that auto receiver sampling is wired`

> _What to write:_ The next `todo` task whose `dependsOn` are all `done`, lowest milestone/task number within the current wave. One line: `M#-T# — <why it's next / what it unblocks>`.

**Gate status:** `pnpm run check = pass; auto-shadow / csm / point / spot / multi-light focused E2E = pass; webgpu auto-shadow Vitest = pass; pnpm run check:progress = pass; git diff --check = pass`

> _What to write:_ Result of the project gate at your last stop: `pnpm run check = pass|fail` plus any task-specific proofs you ran (e.g. `test/e2e/auto-shadow.spec.ts = pass`). If fail, name the failing check. Never mark a task `done` on a red gate.

**Blockers / open decisions:** `none`

> _What to write:_ Anything preventing progress (missing decision, external dep, ambiguous acceptance criterion). Format: `[B#] <description> — needs: <who/what>`. Remove on resolution and note it in the completion log.

### Milestone progress

> _What to write:_ One row per milestone. `Status` ∈ {`not-started`, `in-progress`, `done`}. `Done/Total` = tasks marked `✅ done` ÷ total. `Proof` is fixed (the milestone's §"Proof"); flip its trailing flag to `✅` only when that verification passes. Update the row the instant any task status changes. A milestone is `done` only when every task is `done` AND its proof passes.

| Milestone   | Wave | Status      | Done/Total | Proof (route/spec)                                                               | Notes                                                                             |
| ----------- | ---- | ----------- | ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [M1](#m1)   | 0    | in-progress | 2/11       | `auto-shadow` route + compressed-GLB load + picking + `npm publish --dry-run` ⬜ | M1-T2 auto-shadow frame-loop wiring complete; shaderSampling status remains M1-T3 |
| [M2](#m2)   | 1    | not-started | 0/9        | skinned+animated GLB route (M2-T9) ⬜                                            | —                                                                                 |
| [M3](#m3)   | 2    | not-started | 0/7        | post+forward+shadow ported under graph + custom-pass example (M3-T7) ⬜          | —                                                                                 |
| [M4](#m4)   | 1    | not-started | 0/9        | frustum-fit / PCSS / alpha-test shadow routes ⬜                                 | —                                                                                 |
| [M5](#m5)   | 1    | not-started | 0/6        | DFG / irradiance / transmission correctness routes ⬜                            | —                                                                                 |
| [M6](#m6)   | 3    | not-started | 0/5        | content-showcase routes (sprites/particles/text/UI) ⬜                           | —                                                                                 |
| [M7](#m7)   | 3    | not-started | 0/9        | scene round-trip E2E + pointer-event route ⬜                                    | —                                                                                 |
| [M8](#m8)   | 3    | not-started | 0/9        | GPU-driven scale route (compute cull → indirect) ⬜                              | —                                                                                 |
| [M9](#m9)   | 4    | not-started | 0/4        | multi-zone reflection + irradiance routes ⬜                                     | —                                                                                 |
| [M10](#m10) | 4    | not-started | 0/4        | physics settle test + XR stereo route ⬜                                         | —                                                                                 |
| [M11](#m11) | 4    | not-started | 0/5        | editor open→edit→save→reload E2E ⬜                                              | —                                                                                 |

### Task status & completion log

> _What to write:_ TWO things, every time a task changes state:
>
> 1. **Inline marker** — append a tag to that task's `#### \`M#-T#\``heading lower in this doc:` — 🟡 in-progress`·` — ⛔ blocked (B#)`·` — ✅ done (YYYY-MM-DD · <commit>)`. And flip its `Done when`boxes`- [ ]`→`- [x]` as each criterion is met.
> 2. **Log line** — append (never rewrite) one row to the table below.
>
> Mark a task `✅ done` ONLY when: every `Done when` box is checked, the named proof (Playwright / render-control / vitest) passes, and `pnpm run check` is green. Partial work stays `🟡 in-progress` and is described in "Resume notes".

| Date                             | Task  | → Status | Commit   | Proof run                                                                                                                                                                                                                                                                                                                              | Notes                                                                                                                                                                                                                                                        |
| -------------------------------- | ----- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _append rows below; newest last_ |       |          |          |                                                                                                                                                                                                                                                                                                                                        |                                                                                                                                                                                                                                                              |
| 2026-05-28 22:06 PDT             | M1-T1 | ✅ done  | 20b53817 | `pnpm run check`; `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/app-environment-resources.test.ts test/webgpu/shadow-depth-texture-resource.test.ts`                                                                                                                                               | Extracted `createRenderShadowFrame()` and caster mesh helpers into `packages/webgpu/src/shadows`, added renderer-owned cache slots, and proved submitted cascaded directional shadow frames plus cache reuse.                                                |
| 2026-05-28 23:37 PDT             | M1-T2 | ✅ done  | pending  | `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "auto-renders directional shadow resources\|renders the standard material queue path"`; `CI=true pnpm exec playwright test test/e2e/auto-shadow.spec.ts --reporter=list --timeout=90000`; focused CSM/point/spot/multi-light shadow E2E specs; `pnpm run check` | Wired automatic StandardMaterial shadow receiver resources through the queued and mixed app frame routes, added `examples/auto-shadow.*`, preserved explicit shadow-resource override examples, and proved receiver darkening plus JSON-safe shadow reports. |

### Resume notes (for the next agent)

> _What to write:_ If you stop mid-task, state exactly what is done, what remains, which files are dirty, and the next concrete step — enough for a cold agent to resume without re-reading the whole task. OVERWRITE this section on each hand-off (it is current-state, not a log). Write `clean — no in-flight work` when you finish a task cleanly.

`clean — no in-flight work`

---

This roadmap is the output of a deep, source-grounded audit of all 16 Aperture subsystems against three.js (r184 WebGPU+TSL), PlayCanvas 2.20, and Bevy. Every "current state" and entry point below was verified by reading the actual source — claims of "missing" were adversarially checked to avoid false negatives. Milestones **M1–M5, M7, M8** carry file-level task breakdowns (verified hook sites); **M6, M9–M11** are design-level (the code doesn't exist yet, so entry points are directional).

**How to use this:** work top-to-bottom by wave. Within a milestone, tasks are dependency-ordered. Each task has a category, effort (S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks), the exact files to touch, and testable "Done when" criteria in the project's render-control/Playwright/vitest convention.

## 0. Where Aperture stands today

> Aperture is a genuinely impressive rendering-research codebase with deep, real shading breadth (clustered Forward+, LTC area lights, PMREM, glTF PBR-next subset, a clean command-reified frame plan, world-class CPU mesh BVH, and best-in-class AI-agent tooling/diagnostics), but it is NOT close to being a SOTA web 3D engine you could ship a product on today. The gap is less about exotic features and more about foundational completeness: several headline subsystems are built but not wired into the live app (shadows are never encoded/submitted; Draco/Meshopt/KTX2 decoders are never connected so compressed glTF fails out of the box; CPU picking/raycast index is never populated), and entire pillars that define a usable 2026 engine are simply absent (no animation clip/skeleton import despite GPU skinning existing, no physics, no WebXR, no particles/text/UI, no scene serialization, no editor, no GPU-driven pipeline). The most defensible SOTA claim it could make right now is narrow and architectural: "the most AI-agent-controllable, most inspectable WebGPU ECS renderer" and "SOTA-competitive analytic lighting/area-light/clustering math for the web." A credible general-purpose "SOTA web 3D engine" claim is realistically 18-30 months of focused work away, and the first ~6 months of that is unglamorous wiring and publishing, not new rendering.

### Already SOTA-competitive (protect these)

- AI-agent-native tooling and control surface: a ~55-tool MCP stdio server (ecs_query, render_explain_entity, render_get_packets, camera_orbit, browser_pick_pixel), self-driving Playwright dev session, auto-wired agent adapters (CLAUDE.md/.cursor/.codex/.mcp.json), and a reference RAG CLI. No mainstream web engine (three.js/Babylon/PlayCanvas) ships anything comparable.
- Structured, machine-readable diagnostics with stable codes, severity, source location, and a mandatory suggestedFix on every diagnostic, plus render_explain_entity ('why did/didn't this entity render') - materially ahead of three.js's console.warn culture.
- Analytic lighting math: full LTC area lights for rect AND disk AND sphere (ahead of three.js which only ships rect), correct Cook-Torrance GGX direct lighting, and clustered Forward+ froxel local-light binning with view-depth clusters, cookies (incl. cube + atlas) for point/spot, and clustered local shadows - architecturally on par with PlayCanvas.
- CPU mesh BVH (mesh-bvh.ts, ~3000 lines): SAH/binned build, shapecast/raycast/closestPoint/bvhcast, serialize/deserialize, versioned cache with static/refit/rebuild policy - matches or exceeds three-mesh-bvh and exceeds three.js core (which has no BVH).
- Frame architecture as inspectable data: a deterministic 6-phase frame plan with per-phase diagnostics, render commands reified as a flat serializable command list with record/replay split, render-bundle caching, redundant-state elision, indirect-draw plumbing, hardware occlusion-query feedback culling, and per-pass GPU timestamp timing - more inspectable and allocation-conscious than most engines' opaque draw loops.
- Worker-authoritative ECS-vs-derived-render-snapshot split with typed transport, generational entity refs, cycle/stale-parent transform diagnostics, and incremental change detection - a clean Bevy-style architecture that is the correct foundation for the things still missing.
- Tonemapping/output color management: none/linear/reinhard/aces/agx/neutral with correct AgX and Khronos PBR Neutral implementations and a piecewise-accurate sRGB OETF - matches three.js's modern defaults and many engines still lack AgX.
- Asset format breadth on the decode side: correct KTX2/BasisU transcode target selection (ASTC/BC7/ETC2 with DFD transfer-function parsing), Draco and both EXT*/KHR* meshopt with all modes/filters, and an HDR/RGBE loader - SOTA-competitive transcoding (the gap is wiring, not the decoders).

### The cross-cutting themes that define the gap

- **Built-but-unwired: major subsystems exist in the render/webgpu packages but are never connected to the live createWebGpuApp/app path** — This is the single most damaging pattern. Shadows have full matrix/texture/caster modules but the frame loop never encodes or submits a depth-caster pass (shaderSampling stays permanently false; app layer has zero shadow references). Draco/Meshopt/KTX2 decoders are fully implemented and the URI loaders accept factories, but the only app-layer caller never passes them, and no package depends on the decoders, so any compressed glTF fails out of the box. The CPU mesh BVH raycaster is world-class but the spatial index is never populated by any system and CameraHandle.rayFromPointer is a stub returning a fixed ray. The engine looks far more complete than it functions; bridging these is high-leverage, comparatively low-effort, and must precede any SOTA claim.
- **No real render graph / no GPU-driven pipeline** — The frame is an if/else route dispatcher (renderWebGpuAppFrame, 994 lines) with pass order encoded in imperative call sites - no FrameGraph, PassNode, resource-dependency DAG, transient aliasing, or cross-pass command-buffer batching (each pass submits its own encoder). Culling, indirect-draw arg generation, and instance selection are all CPU-side; 'indirect draw' is CPU-authored so it gives no scalability win, and there is no compute culling, Hi-Z, multi-draw-indirect, bindless, or LOD. This caps both extensibility (users cannot insert custom geometry/compute passes - only fixed screen-space post effects) and scalability (draw submission is O(objects) on the JS thread). Modern engines (Bevy, Unreal-on-web aspirations, three.js WebGPU node graph) are increasingly GPU-driven; this is the deepest architectural distance from SOTA.
- **Authoring/runtime abstractions missing on top of working low-level data paths** — Repeatedly, the GPU/data layer works but the user-facing authoring layer that makes it a 'engine' rather than a 'renderer' is absent. GPU skinning + morph shaders work, but there is no animation clip/keyframe sampler, no skeleton/skin import, no state machine/blend tree/IK - the glb-viewer EXAMPLE hand-rolls all of it. Materials are immutable frozen assets with no setters/uniform mutation. Joint/morph data is transported as re-parsed JSON strings. There is no scene serialization, no working prefab system (the type is a dead stub), no Children component, no setParent-preserving-world helper. The engine gives you primitives but not the ergonomic runtime layer users expect.
- **No content-creation or human-in-the-loop surface (editor, UI, particles, text)** — Aperture is optimized for AI agents and headless verification, but a SOTA general engine needs human authoring and rich on-screen content. There is no visual scene editor, no human devtools/inspector panel (devtools are agent-gated), no on-screen stats overlay, no gizmos/orbit controls (every app hand-rolls camera control), no framework integration (React/R3F/Vue). On the content side there are no particles, no text/SDF, no 2D/3D UI/GUI, no decals, no volumetrics, and only spherical-billboard sprites. These are not feature-checklist trivia - they are what 90% of real apps need.
- **Unconsumable as a dependency / no ecosystem** — All 7 packages are private:true, version 0.0.0, license UNLICENSED, with no LICENSE, no CI/release pipeline, no exports polish for publish, and the scaffolder emits workspace:\* deps that are non-installable externally. There is no npm presence, CDN, docs site, generated API reference, hosted example gallery (examples are an internal harness), or HMR for systems. No third party can currently consume or extend the engine at all - a hard precondition for any 'SOTA engine' positioning regardless of technical merit.
- **Shading correctness shortcuts undercut the otherwise-strong PBR** — The lighting breadth is real but several core terms are admitted approximations rather than physically based: specular IBL is a hand-tuned 'iblSpecularProof' with no split-sum DFG/BRDF LUT and no energy conservation; diffuse IBL convolution is planned but inert (raw cube sampled by normal); transmission is a screen-space grab-blur hack with no IOR/thickness/Beer-Lambert; SSAO darkens direct light too; SSR is color-buffer-only with a hardcoded screen-Y receiver mask; shadows can never be fully dark (0.45-0.5 visibility floor) and use fixed bias with authored bias/normalBias as dead data. Individually minor-to-major, collectively they mean output is stylized-plausible, not reference-correct - a credibility gap for a SOTA claim.

### Architectural invariants (do not violate while closing gaps)

- ECS is the source of truth; **no public mutable scene graph**, ever.
- Rendering is a derived view of extracted snapshots; transforms/hierarchy belong to ECS.
- GPU resources are renderer-owned and WebGPU-only (no WebGL fallback).
- Simulation + extraction stay headless-safe and worker-safe.
- Assets are referenced by stable typed handles.
- Every visible feature ships with a worker-authored route + pixel/JSON proof.

## 1. Milestone map & waves

| Wave | Milestone                                                                        | Theme                     | Gate  |
| ---- | -------------------------------------------------------------------------------- | ------------------------- | ----- |
| 0    | [M1](#m1) — Wire the built-but-dark subsystems + make the engine publishable     | Unblock & publish         | —     |
| 1    | [M2](#m2) — End-to-end animation                                                 | Animation runtime         | M1    |
| 1    | [M4](#m4) — Production-quality shadows                                           | Shadow quality            | M1    |
| 1    | [M5](#m5) — Close core PBR/IBL correctness gaps                                  | PBR/IBL correctness       | —     |
| 2    | [M3](#m3) — A real render graph                                                  | Render graph (keystone)   | —     |
| 3    | [M6](#m6) — Content layer                                                        | Content layer             | M3    |
| 3    | [M7](#m7) — Scene persistence + runtime authoring layer                          | Scene + authoring         | —     |
| 3    | [M8](#m8) — Go GPU-driven                                                        | GPU-driven rendering      | M3    |
| 4    | [M9](#m9) — Positional indirect lighting                                         | Positional indirect light | M3+M5 |
| 4    | [M10](#m10) — Physics + WebXR on the prepared boundaries                         | Physics + WebXR           | M2+M7 |
| 4    | [M11](#m11) — Editor, framework integrations, on-screen tooling, HMR & ecosystem | Editor + ecosystem        | M1+M7 |

**Wave 0 — Unblock (now):** M1. Turns finished-but-dark code into a working, installable engine. Highest ROI in the whole plan.
**Wave 1 — Correctness on the wired base (parallel after M1):** M2 (animation), M4 (shadow quality), M5 (PBR/IBL correctness).
**Wave 2 — Architectural keystone:** M3 (render graph). The fork in the road; everything advanced is gated on it.
**Wave 3 — Scale, content & authoring (after M3):** M6 (content), M7 (scene/authoring), M8 (GPU-driven).
**Wave 4 — Realism & reach:** M9 (indirect light), M10 (physics + XR), M11 (editor + ecosystem).

```
M1 ──┬─> M2 ───────────────────────────────> M10 (physics+XR)
     ├─> M4 (shadow quality)                 ^
     ├─> M5 (PBR/IBL) ──┐                     │
     ├─> M7 (scene) ────┼──> M11 (editor) ────┘
     └─> M3 (graph) ─┬──┼──> M6 (content)
                     ├──┴──> M9 (indirect light)
                     └─────> M8 (GPU-driven)
```

> The single most important judgment call: **M1 is non-negotiable and comes first** (it's mostly wiring + publishing, days-to-weeks), and **M3 (render graph) is the one hard architectural bet** that unlocks M6/M8/M9/XR. If you do one big thing, do M3.

## 2. Milestones

---

## M1 — Wire the built-but-dark subsystems + make the engine publishable <a id="m1"></a>

**Wave 0** · **Depends on:** none · 11 tasks (3×L, 6×M, 2×S)

> **Goal.** After this milestone, a standard-material scene rendered through createWebGpuApp/createApp casts shadows automatically (engine produces depth maps, computes/uploads shadow matrices, and feeds receiver resources into the standard lighting bind group with shaderSampling enabled) without the consumer hand-orchestrating 17 shadow stages; a .glb declaring KHR_draco_mesh_compression / EXT_meshopt_compression / KHR_texture_basisu / KHR_mesh_quantization loaded via the app loader decodes and uploads compressed-GPU-format textures with mip chains out of the box; CameraHandle.rayFromPointer produces a real screen-to-world ray and a live engine system populates the spatial index so context.spatial.raycastFirst returns the picked entity from a pointer; and every package is publishable (real version, license, exports/files/publishConfig, CI/release) with the CLI scaffolder emitting installable semver deps instead of workspace:\*.

**Current state (verified against source).** Every subsystem in scope is FULLY BUILT but UNWIRED. (1) Shadows: the entire caster/matrix/encode/submit/receiver-bind-group chain exists and is proven end-to-end inside examples/csm-directional-shadow.main.js:336-607 (createCsmShadowFrame hand-orchestrates 17 stages and feeds receiverResources back into the next app.renderSnapshot). The frame loop (packages/webgpu/src/app/frame-loop.ts) ONLY consumes options.standardMaterialShadowReceiverResources as a pass-through (lines 132-140, 379-383, 513-517, 726-730) and never produces depth maps; create-webgpu-app.ts has zero shadow references. The receiver bind-group builder createLightShadowBindGroup is complete (standard-frame-resources.ts:697-807). shaderSampling is a hard-coded literal `false` everywhere (shadow-pass-plan.ts:63,178; shadow-pass-command-buffer-submission-report.ts:53,278; shadow-pass-encoder-assembly-report.ts:113,491). shadow-pass-command-buffer-submission-report.ts:163-216 already finishes+submits when submit===true; shadow-depth-texture-resource.ts already does live GPU allocation. (2) Assets: app/src/systems/assets.ts:390-403 calls loadGltfFromUri/loadGlbFromUri with only {cache,keyPrefix,createAssetMapping,createMeshAssets} — never the createDracoDecoder/createMeshoptDecoder/createBasisKtx2Transcoder/ktx2TextureCompression factories that glb-uri-loader-types.ts:86-95 accept. createKtx2TextureCompressionSupportFromFeatures (ktx2-decoder.ts:103-115) has ZERO callers. KHR_mesh_quantization is absent from SUPPORTED_ROOT_EXTENSIONS (gltf-root.ts:35-42) so meshopt assets hard-fail at root validation. createTextureGpuResource does a single queue.writeTexture with no mip loop (texture-resources.ts:191-202). (3) Picking: CameraHandle.rayFromPointer (cameras.ts:76-81) is a stub returning origin:[x,y,1],direction:[0,0,-1] ignoring camera transform/projection; createSpatialQueries (spatial/index.ts:19-77) starts empty and the only non-test setMeshes/setBounds caller is examples/developer-api setup.system.ts:55 (hand-hardcoded AABB). The MeshSpatial adapter (render/src/mesh/spatial-adapter.ts) is test-only. (4) Publishing: all package.json are private:true/version:0.0.0/license:UNLICENSED, no files/publishConfig, no LICENSE/.github/.changeset; CLI create/package-json.ts:4,20,29 hardcodes CLI_VERSION="0.0.0" so scaffolded deps resolve to non-installable workspace:\*.

### Key entry points

| File / symbol                                                                 | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/webgpu/src/app/frame-loop.ts`                                       | The render frame entry (renderWebGpuAppFrame). Consumes options.standardMaterialShadowReceiverResources at lines 132-140/379-383/513-517/726-730 but never produces it. This is where the engine-side shadow orchestrator must be invoked (after source-asset facades are prepared so caster mesh GPU buffers exist) and the resulting receiver resources injected into the standard route.                                                                                                                                                                                                      |
| `examples/csm-directional-shadow.main.js`                                     | The complete, working blueprint (createCsmShadowFrame, lines 336-607) for the orchestrator: descriptor->textures->depthTextureResource->sampler->passPlan->attachments->viewProjection->matrixComputation->matrixBuffer->matrixBufferResource->casterDrawList->commandPlan->commandEncoding->pipelineDescriptor->pipelineResource->matrixBindGroup->frameResources->commandRecordPlan->encoderAssembly->submission->receiverResources. Lift this into packages/webgpu/src/shadows as a reusable per-frame coordinator. Also shows the caster-mesh GPU-buffer extraction helpers (lines 626-692). |
| `packages/webgpu/src/materials/standard/standard-frame-resources.ts`          | createLightShadowBindGroup / createLightIblBindGroup (lines 697-807) — the COMPLETE receiver bind-group machinery that consumes StandardFrameShadowReceiverResources (type at lines 230-250). No changes needed beyond ensuring the orchestrator hands it real depth/matrix/sampler reports; the shaderSampling literal-false report sections are downstream of these and must be flipped to true once submission succeeds.                                                                                                                                                                      |
| `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts` | Already finishes+submits the shadow command buffer when submit===true (lines 163-216). Its sections.shaderSampling:false (line 53/278) and the parallel literals in shadow-pass-plan.ts and shadow-pass-encoder-assembly-report.ts are the 'shaderSampling never enabled' markers to retype/flip to a real boolean reflecting that receiver sampling is wired.                                                                                                                                                                                                                                   |
| `packages/app/src/systems/assets.ts`                                          | loadSystemGltfAsset (lines 365-419) — the single app-layer glTF/GLB load site. Decoder factories + ktx2TextureCompression support must be threaded here, derived from device features captured at createWebGpuApp time.                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/render/src/assets/ktx2-decoder.ts`                                  | createKtx2TextureCompressionSupportFromFeatures (lines 103-115) — the zero-caller bridge from GPUSupportedFeatures to {astc,bc,etc2}. Wire it at the app layer using app.initialization.device.features.                                                                                                                                                                                                                                                                                                                                                                                         |
| `packages/render/src/assets/gltf-root.ts`                                     | SUPPORTED_ROOT_EXTENSIONS (lines 35-42) + validateRequiredExtensions (149-168). Add KHR_mesh_quantization so meshopt/quantized assets stop hard-failing; this also requires accessor decode to honor quantized normalized formats.                                                                                                                                                                                                                                                                                                                                                               |
| `packages/app/src/systems/cameras.ts`                                         | CameraHandle.rayFromPointer stub (lines 76-81). Replace with real unprojection using the Camera component (authoring-components-camera-light.ts:10-37: projection/fovYRadians/aspect/near/far/orthographicHeight) + the camera world transform, via simulation math (invertMat4, makePerspective/makeOrthographic, transformPoint).                                                                                                                                                                                                                                                              |
| `packages/app/src/spatial/index.ts`                                           | createSpatialQueries (19-77) — holds empty bounds/meshes; needs an engine system that calls setMeshes/setBounds each frame from live ECS mesh + world transforms. The adapter render/src/mesh/spatial-adapter.ts:36 (createSpatialTriangleMeshFromMeshAsset) converts a MeshAsset to a SpatialTriangleMesh.                                                                                                                                                                                                                                                                                      |
| `packages/app/src/systems/context.ts`                                         | createApertureSystemContext (65-109) — where spatial + cameras are constructed; the new spatial-population system must be registered into the simulation schedule here (or via a built-in system) so the index reflects the authoritative ECS world each frame.                                                                                                                                                                                                                                                                                                                                  |
| `packages/cli/src/create/package-json.ts`                                     | defaultApertureDependencySpec (19-21) + packageJsonFile (23-54). CLI_VERSION literal '0.0.0' (line 4) forces workspace:\* and version 0.0.0 in scaffolded projects — must derive the real published version and emit ^semver + a real project version.                                                                                                                                                                                                                                                                                                                                           |
| `package.json`                                                                | Root workspace manifest (private/UNLICENSED, build/test/check scripts). Reference for adding release/CI scripts and where a changesets/publish pipeline plugs in. All per-package package.json need private/version/license/files/publishConfig fixes.                                                                                                                                                                                                                                                                                                                                           |

### Tasks

#### `M1-T1` · Extract a reusable per-frame shadow orchestrator from the CSM example into the shadows package — ✅ done (2026-05-28 · 20b53817)

`webgpu-render` · effort **L** · depends: none

Lift the 17-stage hand-orchestration in examples/csm-directional-shadow.main.js:createCsmShadowFrame (lines 336-607) into a new engine module that, given a RenderSnapshot (shadowRequests + lights + transforms + meshDraws), the device, and the per-frame prepared caster mesh GPU buffers, produces (a) allocated/cached depth textures, (b) computed+uploaded shadow matrices, (c) an assembled+submitted caster depth pass, and (d) a StandardFrameShadowReceiverResources object (directional first; spot/point/multi reusing the existing matrix-computation modules). Reuse the existing pure modules unchanged: createShadowMapDescriptorReport, createShadowTextureResourceReport, createShadowDepthTextureResourceReport, createShadowSamplerResourceReport, createShadowPassPlanReport (submission:'ready'), createShadowPassAttachmentDescriptorReport, the {directional,spot,point}-shadow-view-projection-plan + matrix-computation modules, createShadowMatrixBufferDescriptorReport/ResourceReport, createShadowCasterDrawListPlanReport, createShadowCasterCommandPlanReadinessReport, createShadowPassCommandEncodingReport, createShadowCasterPipelineDescriptorReport/ResourceReport, createShadowCasterMatrixBindGroupResourceReport, createShadowCasterFrameResourceReadinessReport, createShadowCasterCommandRecordPlanReport, createCommandEncoderResource, createShadowPassEncoderAssemblyReport (with resolveShadowDepthTextureAttachmentView), createShadowPassCommandBufferSubmissionReport (submit:true). Cache the depth texture + sampler + pipeline + matrix-bind-group resources across frames via the existing app environment resource cache (registerWebGpuAppEnvironmentResourceCache / getOrCreateWebGpuAppEnvironmentResourceCache) keyed by shadow descriptor + light id, exactly as the example caches shadowDepthTextureResourceReport. Return a JSON-safe sub-report (status, submitted pass count, draw calls, depthTextureKeys) for diagnostics. Do NOT wire into the frame loop yet (that is M1-T2). Keep this headless-safe: no DOM, device passed in.

**Touch:**

- `packages/webgpu/src/shadows/render-shadow-frame.ts (new): orchestrator createRenderShadowFrame({device,snapshot,casterMeshViews,cache,label}) returning {receiverResources,report}`
- `packages/webgpu/src/shadows/render-shadow-frame-caster-meshes.ts (new): port createShadowCasterPreparedMeshViews + createShadowCasterExecutableMeshViews (example lines 626-692) to build caster mesh GPU-buffer views from the frame's prepared mesh resources`
- `packages/webgpu/src/app/resource-cache.ts (modify): add shadow orchestrator cache slots if not already present on the environment cache`

**Done when:**

- [x] A new Vitest unit (test/webgpu/shadows/render-shadow-frame.spec.ts) drives createRenderShadowFrame with a fake device + a directional shadowRequest + caster meshDraws and asserts the returned report.commandBufferSubmission.status === 'submitted', passCount/drawCalls > 0, and receiverResources.shadowKind === 'directional-cascaded' with a non-null matrixBufferResource.resource and at least one depth texture resource.
- [x] Calling the orchestrator twice with identical input reuses cached depth-texture/sampler/pipeline resources (assert createdTextureCount on the second call is 0 / reusedTextureCount > 0).
- [x] No literal 'deferred'/'not implemented yet' diagnostic appears in the returned report when submission:'ready' and inputs are valid.

**Study:** examples/csm-directional-shadow.main.js (createCsmShadowFrame, lines 336-607); references/bevy (bevy_pbr shadow prepass node) for SOTA per-light pass scheduling shape

**Watch out:** The orchestrator must run AFTER the frame's prepared mesh GPU buffers exist (prepareWebGpuAppSourceAssetFacades), because caster command records need real vertex/index GPU buffers (example builds them from report.resources/resourceReuse). Do not duplicate mesh uploads — read from the same prepared-mesh facade the main pass uses. Keep ECS authority intact: the orchestrator only reads the snapshot, never mutates scene/render-world state.

#### `M1-T2` · Drive the shadow orchestrator from the frame loop and inject receiver resources automatically — ✅ done (2026-05-28 · pending)

`webgpu-render` · effort **M** · depends: M1-T1

Invoke createRenderShadowFrame from inside renderWebGpuAppFrame (packages/webgpu/src/app/frame-loop.ts) whenever the snapshot has shadowRequests.length > 0 and the standard route is selected, BEFORE the standard frame resources are built. Replace the current behavior where standardMaterialShadowReceiverResources arrives only via options pass-through: when the caller did not supply it, the engine now produces it. Feed the orchestrator's receiverResources into the existing withStandardShadowPipelineKeys path (line 132-140) and into the createFrameResources call (lines 726-730) so createLightShadowBindGroup (standard-frame-resources.ts:697-807) binds real depth/matrix/sampler resources. Preserve the explicit-override escape hatch: if options.standardMaterialShadowReceiverResources is provided, use it verbatim (back-compat with the examples). Thread the orchestrator report into WebGpuAppRenderReport (new optional field shadow?: ...) so render-control statuses and E2E can assert it.

**Touch:**

- `packages/webgpu/src/app/frame-loop.ts (modify): compute engineShadow = options.standardMaterialShadowReceiverResources ?? (snapshot.shadowRequests.length>0 ? createRenderShadowFrame(...).receiverResources : undefined) after prepareWebGpuAppSourceAssetFacades; pass it through shadowSnapshot + all createFrameResources/route calls`
- `packages/webgpu/src/app/app.ts (modify): add WebGpuAppRenderReport.shadow optional field + JSON projection in report.ts`
- `packages/webgpu/src/app/queued-built-in-frame.ts / mixed-custom-wgsl-frame.ts (modify): accept and forward the engine-produced receiver resources the same way they already forward the option`

**Done when:**

- [x] A new render-control route (examples/auto-shadow.\* + examples/auto-shadow.worker.js) that does NOT hand-build any shadow resources (calls app.renderSnapshot with NO standardMaterialShadowReceiverResources) still produces a frame whose report.shadow.commandBufferSubmission.status === 'submitted' and whose pipelineKey contains 'shadowMap' or 'cascadedShadowMap'.
- [x] A Playwright E2E (test/e2e/auto-shadow.spec.ts) compares a shadow-disabled baseline screenshot to the auto-shadow screenshot and asserts a receiver-region luminance delta > 10 (same pixel-delta technique as csm-directional-shadow.spec.ts:expectCsmShadowActivation).
- [x] The existing csm-directional-shadow.spec.ts and multi/spot/point shadow specs still pass (explicit-override path unchanged).
- [x] No webgpu validation console warnings (attachWebGpuValidationConsoleGuard.expectNoWarnings()).

**Study:** examples/csm-directional-shadow.main.js:handleWorkerMessage (lines 126-183, shows option threading + feeding receiverResources back into renderSnapshot); packages/webgpu/src/app/frame-loop.ts:132-192,726-730

**Watch out:** Ordering: caster depth pass must be encoded+submitted before the main color pass samples it, but with WebGPU these are separate command buffers submitted to the same queue in order — submit shadow buffer first. Do not regress the sprite-only / custom-wgsl / multi-unlit early-return branches (lines 203-441) which must skip shadow orchestration. Guard against orchestration cost when there are zero standard draws.

#### `M1-T3` · Enable shaderSampling status and make full shadow darkness reachable end-to-end

`webgpu-render` · effort **S** · depends: M1-T2

Now that receiver sampling is actually wired (M1-T2), retype the hard-coded `shaderSampling: false` literals so they report the true wired state. Change ShadowPassPlanReport.sections.gpuCommands and the shaderSampling fields in shadow-pass-plan.ts (line 63 type, line 178 value), shadow-pass-command-buffer-submission-report.ts (line 53 type, line 278 value), and shadow-pass-encoder-assembly-report.ts (line 113 type, line 491 value) from the literal `false` to `boolean`, and set them true on the success path (status 'submitted'/'ready' with a real receiver bind group present). Remove/soften the now-stale 'shaderSamplingDeferred' diagnostics on the submitted path. Drop the shaderSamplingDeferredDiagnostic() push at submission-report.ts:215 when submission succeeds AND the orchestrator reports a bound receiver. This is a status-correctness slice, not a new feature; do NOT change the WGSL min-visibility floor here (that is a separate quality gap out of M1 scope).

**Touch:**

- `packages/webgpu/src/shadows/shadow-pass-plan.ts (modify): sections.gpuCommands type widen + value`
- `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts (modify): sections.shaderSampling type widen, set true on 'submitted', drop deferred diagnostic`
- `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts (modify): sections.shaderSampling type widen + drop deferred diagnostic on assembled path`
- `packages/webgpu/src/shadows/render-shadow-frame.ts (modify): propagate shaderSampling=true into the report`

**Done when:**

- [ ] Update the stale webgpu validation/shadow Vitest expectations (the ones touched by recent commit '05e7311f test: update stale webgpu validation expectations') so shadow report fixtures assert sections.shaderSampling === true on the submitted path.
- [ ] The auto-shadow render-control status (M1-T2) reports shadow.commandBufferSubmission.sections.shaderSampling === true and no diagnostic with code endsWith 'shaderSamplingDeferred'.
- [ ] Existing shadow E2E specs that previously asserted commandBufferSubmission.status==='submitted' still pass and additionally tolerate the new shaderSampling:true field.

**Study:** packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts:53,215,278

**Watch out:** These literal-false types are referenced in JSON projection functions and tests; widening to boolean is a public-surface change guarded by the 'test: guard app and cli public surfaces' tests — update those snapshots. Keep the not-required/missing paths reporting false.

#### `M1-T4` · Add KHR_mesh_quantization support at root validation + accessor decode

`render-bridge` · effort **M** · depends: none

Add 'KHR_mesh_quantization' to SUPPORTED_ROOT_EXTENSIONS (packages/render/src/assets/gltf-root.ts:35-42) so glTF/GLB that REQUIRE it (most meshopt-compressed assets) stop hard-failing at validateRequiredExtensions (lines 149-168). Then make the accessor/attribute decode path honor quantized component types + the accessor.normalized flag for POSITION/NORMAL/TANGENT/TEXCOORD (byte/ubyte/short/ushort normalized -> float), so quantized geometry produces correct float32 vertex streams feeding the existing mesh asset construction and tangent generation. This unblocks the already-implemented EXT_meshopt_compression / KHR_meshopt_compression decoders (which the auditor confirmed work) for the common real-world asset class that pairs meshopt with quantization.

**Touch:**

- `packages/render/src/assets/gltf-root.ts (modify): add KHR_mesh_quantization to SUPPORTED_ROOT_EXTENSIONS`
- `packages/render/src/assets/* accessor-decode module (modify): the accessor decoder that currently assumes float32 attributes — honor normalized integer component types for vertex attributes`
- `packages/render/src/assets/gltf-mesh-* (verify): ensure quantized streams flow into MeshAsset packed vertex streams`

**Done when:**

- [ ] A Vitest unit loads a small fixture .gltf marking KHR_mesh_quantization as required and asserts validateGltfRootForAssetMapping(...).valid === true (no gltfRoot.unsupportedRequiredExtension diagnostic).
- [ ] A unit decodes a quantized (e.g. short-normalized) POSITION/NORMAL accessor and asserts the resulting float32 stream values match the expected dequantized range within tolerance.
- [ ] An existing meshopt decode test (gltf-report-driven-import-meshopt-extension) extended with a quantization-required header now succeeds instead of erroring at root validation.

**Study:** references/three.js (GLTFLoader KHR_mesh_quantization + accessor normalization in examples/jsm/loaders/GLTFLoader.js); packages/render/src/assets/gltf-root.ts:149-168

**Watch out:** normalized=true vs raw integer attributes change interpretation; UV/TANGENT need normalized signed/unsigned handling. Tangent generation (gltf-mesh-tangent-calculation.ts) must run AFTER dequantization. Keep this decode-only and report-driven; emit a structured diagnostic if an unsupported quantized component type appears rather than throwing.

#### `M1-T5` · Thread Draco/Meshopt/KTX2 decoder factories + GPU texture-compression support through the app glTF loader

`render-bridge` · effort **L** · depends: M1-T4

Wire the compressed-asset decoders into the only app-layer load site (packages/app/src/systems/assets.ts:loadSystemGltfAsset, lines 390-403) so createWebGpuApp/createApp decode KHR_draco_mesh_compression / EXT_meshopt_compression / KHR_texture_basisu out of the box. (1) Add a decoder-provider seam to the app/system asset access so createWebGpuApp can supply createDracoDecoder/createMeshoptDecoder/createBasisKtx2Transcoder factories and a ktx2TextureCompression support object; pass them into loadGltfFromUri/loadGlbFromUri options (the loader already resolves them lazily only when the extension is declared, per glb-uri-loader.ts:96-164). (2) Build the ktx2TextureCompression support by calling the zero-caller bridge createKtx2TextureCompressionSupportFromFeatures (ktx2-decoder.ts:103-115) with app.initialization.device.features (features are requested in initialize-webgpu.ts:96-98). (3) Provide default decoder factories that resolve jsUrl/wasmUrl/jsSource (draco-module-loader.ts:41-49, meshopt-decoder.ts, ktx2-basis-module) — the CLI scaffolder must vend the decoder asset files or the app must reference a configurable decoderPath (default to bundled copies under the package). Add draco3d/meshoptimizer/basis bundle assets (or a documented decoderPath config) so the default path works without the consumer hand-registering anything (parity with three.js/PlayCanvas auto-registration).

**Touch:**

- `packages/app/src/systems/assets.ts (modify): pass createDracoDecoder/createMeshoptDecoder/createBasisKtx2Transcoder/ktx2TextureCompression into loadGltf/GlbFromUri`
- `packages/app/src/systems/context.ts / config.ts (modify): add optional decoderPath / decoder-provider config + plumb device features into the asset access`
- `packages/webgpu/src/app/create-webgpu-app.ts (modify): capture initialization.device.features and build the Ktx2TextureCompressionSupport via createKtx2TextureCompressionSupportFromFeatures, expose to the app/system asset loader`
- `packages/cli/src/create/* (modify): vend decoder wasm/js assets (or document decoderPath) in scaffolded projects`

**Done when:**

- [ ] A render-control route (examples/compressed-gltf.\*) loads a GLB declaring KHR_draco_mesh_compression and renders a non-empty frame (report.ok===true, meshDraws>0) without the route registering any decoder — the engine supplies it.
- [ ] A second route loads a KTX2/Basis-textured GLB; its status reports the chosen transcode target is a compressed GPU format (astc/bc/etc2), not rgba32, on a device that advertises a texture-compression feature (assert the ktx2 target field via the loader report).
- [ ] A Vitest unit asserts createWebGpuApp builds a non-empty Ktx2TextureCompressionSupport from a fake device.features set containing 'texture-compression-bc' (i.e. createKtx2TextureCompressionSupportFromFeatures now has a caller).
- [ ] If the device lacks all compression features, the same KTX2 asset still loads via rgba32 fallback (graceful, no throw).

**Study:** packages/render/src/assets/glb-uri-loader.ts:96-164 (lazy decoder resolution); packages/render/src/assets/ktx2-decoder.ts:103-115; references/three.js (GLTFLoader.setDRACOLoader/setKTX2Loader/setMeshoptDecoder one-liner wiring + KTX2Loader.detectSupport)

**Watch out:** Decoder assets are large WASM blobs — must be lazy (only fetched when the extension appears) to keep base bundle small, which the loader already does. Decoders run on the render-world thread (no worker offload yet) — acceptable for M1. ktx2TextureCompression MUST be passed alongside the transcoder factory or it silently falls back to rgba32 (gap #2). Keep render package free of app-layer assumptions: the factories are injected, not imported by render.

#### `M1-T6` · Generate GPU mipmaps for material textures + upload KTX2 precomputed mip chains

`webgpu-render` · effort **M** · depends: M1-T5

Stop discarding mip data. (1) Add a WebGPU mipmap-generation pass (render-bundle or blit-based downsample compute/render) for uncompressed material textures whose mipLevelCount would otherwise be 1, invoked from the texture resource creation path. (2) When a KTX2/Basis asset provides multiple levels, transcode and upload ALL levels (loop queue.writeTexture per mipLevel) instead of only level 0. Today createTextureGpuResource issues a single queue.writeTexture with no mipLevel (texture-resources.ts:191-202), mipLevelCount defaults to 1 (factories.ts:137, app-texture-sampler-resources.ts:447), and the KTX2 path reads only levels[0] (ktx2-decoder.ts:48-51) / image(0,0,0) (ktx2-basis-transcoder.ts:93-113). This task removes the engine's own 'standardMaterialSampler.mipmapFilterWithoutMips' warning (standard-sampler-fidelity-inspection.ts:152-167) by actually producing mips. Compressed-format mips come from the KTX2 chain (cannot be GPU-generated for BC/ASTC), uncompressed mips are GPU-generated.

**Touch:**

- `packages/webgpu/src/resources/textures/texture-resources.ts (modify): loop writeTexture over mip levels; integrate generateMipmaps for uncompressed formats`
- `packages/webgpu/src/resources/textures/generate-mipmaps.ts (new): WGSL blit/downsample mip generation pass (inline template string, no .wgsl files)`
- `packages/render/src/assets/ktx2-decoder.ts + ktx2-basis-transcoder.ts (modify): expose all levels / transcode each level, not just level 0`
- `packages/webgpu/src/materials/standard/standard-sampler-fidelity-inspection.ts (verify): warning no longer fires once mipLevelCount>1`

**Done when:**

- [ ] A Vitest unit creates a 256x256 uncompressed texture resource with mip filtering and asserts mipLevelCount === expected full chain (9) and that writeTexture was called per level (or the generate-mipmaps pass recorded the expected number of downsample passes).
- [ ] A render-control route with a mip-filtered standard material no longer emits the standardMaterialSampler.mipmapFilterWithoutMips diagnostic in its report.
- [ ] A KTX2 asset with N>1 precomputed levels uploads all N levels (assert via the loader/decoder report level count and the texture resource mipLevelCount).

**Study:** references/three.js (WebGPURenderer/WebGPUTextureUtils generateMipmaps + KTX2 mip upload); packages/webgpu/src/lighting/pmrem-compute-pipeline.ts (existing in-engine mip-chain generation pattern to mirror)

**Watch out:** Mip generation needs the texture created with the right usage flags (RENDER_ATTACHMENT or STORAGE) and the chosen format must be renderable/filterable — compressed formats cannot be GPU-mip-generated, so branch on format. Must not double-generate when KTX2 already supplies the chain. Keep this WebGPU-only and renderer-owned (no WebGL fallback).

#### `M1-T7` · Implement CameraHandle.rayFromPointer with real unprojection

`simulation` · effort **M** · depends: none

Replace the rayFromPointer stub (packages/app/src/systems/cameras.ts:76-81) with a correct screen-to-world ray. Read the Camera component (authoring-components-camera-light.ts:10-37: projection enum, fovYRadians, aspect/autoAspect, near, far, orthographicHeight) and the camera entity's world transform; build the view matrix (inverse of camera world transform) and projection matrix (makePerspective / makeOrthographic from simulation math), invert view\*projection (invertMat4), and unproject the pointer position (normalized [0,1] -> NDC [-1,1], note Y flip) at near and far planes to produce origin+direction (perspective: origin=camera world position, direction=normalize(farPoint-nearPoint); orthographic: origin=nearPoint, direction=camera forward). Use the existing simulation math (invertMat4, makePerspective, makeOrthographic, transformPoint, multiplyMat4) — all confirmed exported from packages/simulation/src/math. The pointer position is the engine's normalized [0,1] (browser/input.ts pointerPosition), so handle the [0,1]->NDC mapping here.

**Touch:**

- `packages/app/src/systems/cameras.ts (modify): cameraHandle.rayFromPointer real implementation reading Camera component + world transform`
- `packages/app/src/spatial/ (verify): RayInput shape {origin,direction} already matches raycaster input`
- `packages/simulation/src/math/projection.ts (verify/extend): ensure makePerspective/makeOrthographic match the renderer's view-uniform convention used by the snapshot (avoid handedness mismatch)`

**Done when:**

- [ ] A Vitest unit constructs a camera at a known world position looking down -Z with a known perspective fov/aspect/near/far, calls rayFromPointer([0.5,0.5]) and asserts the ray origin equals the camera world position and direction is ~camera forward (within 1e-4); rayFromPointer at a corner produces a direction offset consistent with the fov.
- [ ] An orthographic camera unit asserts the ray direction is parallel to camera forward for all pointer positions and origin shifts across the ortho frustum.
- [ ] The ray feeds context.spatial.raycastFirst against a manually-set bounds AABB (developer-api style) and returns the expected entity for a center pointer over the object and null for an off-object pointer.

**Study:** references/three.js (Raycaster.setFromCamera unprojection for Perspective/Orthographic cameras); packages/simulation/src/math/matrix.ts:95 (invertMat4),106 (transformPoint); authoring-components-camera-light.ts:10-37

**Watch out:** Handedness/Y-flip MUST match the renderer's projection (the snapshot's view uniforms are produced by writePackedSnapshotViewUniforms) or picking rays will be mirrored. Validate against the same projection convention the renderer uses, not a fresh one. autoAspect:true means aspect must be derived from the active viewport — thread the canvas/viewport aspect or read the camera's resolved aspect. This runs in the simulation/system context (worker-safe), so do not touch GPU state.

#### `M1-T8` · Populate the spatial index from the live ECS scene via an engine system

`simulation` · effort **L** · depends: M1-T7

Add a built-in engine system that each frame extracts pickable ECS entities (those with a renderable mesh + world transform, honoring the Pickable component in render/src/rendering/authoring-components-spatial.ts:10) and calls context.spatial.setMeshes/setBounds so context.spatial.raycastFirst/raycastAll work out of the box — removing the requirement that every app hand-call setBounds (today only examples/developer-api setup.system.ts:55 does). For each pickable entity: resolve its MeshAsset, convert to a SpatialTriangleMesh via createSpatialTriangleMeshFromMeshAsset (render/src/mesh/spatial-adapter.ts:36), build/cache a MeshBvh (simulation/src/spatial/mesh-bvh.ts MeshBvhCache, content-addressed by meshKey+version), compute worldFromMesh/meshFromWorld from the entity's world transform, and push a SpatialRaycastableMesh; also push a coarse worldAabb bounds entry for the bounds source. Cache BVHs across frames (only rebuild on mesh version change); recompute transforms each frame for moving entities. Register the system in the simulation schedule (context.ts) so it runs on the authoritative world.

**Touch:**

- `packages/app/src/systems/spatial-index-population.system.ts (new): per-frame system reading mesh + world transform + Pickable, calling spatial.setMeshes/setBounds`
- `packages/app/src/systems/context.ts (modify): register the spatial-population system into the default schedule`
- `packages/render/src/mesh/spatial-adapter.ts (consume): createSpatialTriangleMeshFromMeshAsset becomes used by non-test source for the first time`
- `packages/simulation/src/spatial/mesh-bvh.ts (consume): MeshBvhCache wired for live BVH reuse`

**Done when:**

- [ ] A Playwright/render-control route spawns a few standard-material meshes and, via the system context, calls context.spatial.raycastFirst on a ray from CameraHandle.rayFromPointer over an object; the status asserts hit.entity matches the spawned entity and source is 'mesh-bvh'.
- [ ] A Vitest integration drives the population system over a small ECS world (2 meshes at known transforms) and asserts setMeshes received 2 SpatialRaycastableMesh entries with non-null bvh and correct meshFromWorld; a ray through one returns the right entity with face/uv/normal populated.
- [ ] Moving an entity between frames updates its worldFromMesh (raycast hit point moves) WITHOUT rebuilding the BVH (assert BVH instance identity reused via the cache); changing the mesh version triggers a rebuild.
- [ ] Entities with Pickable.enabled===false or a non-matching layerMask are excluded from results.

**Study:** references/three-mesh-bvh (MeshBVH lifecycle + acceleratedRaycast worker/cache patterns); examples/developer-api/src/systems/setup.system.ts:55 (the hand-rolled setBounds it replaces); packages/simulation/src/spatial/mesh-bvh.ts (MeshBvhCache, refit/rebuild dynamicPolicy)

**Watch out:** BVH build is O(triangles) — must cache and skip rebuild for static meshes (use mesh version + the existing content-addressed MeshBvhCache key) or this stalls the sim thread. This system runs in the authoritative ECS/sim context and must stay headless/worker-safe (no GPU). The MeshAsset positions must already be dequantized (depends on M1-T4 for quantized assets). Respect ECS authority: read-only over the world; do not create a parallel mutable scene graph — the index is a derived per-frame view.

#### `M1-T9` · Make all packages publishable: version/license/exports/files/publishConfig + LICENSE

`docs-tooling` · effort **M** · depends: none

Flip every package from un-publishable to publishable. For each of packages/{simulation,render,runtime,webgpu,app,cli,vite-plugin}/package.json and root package.json: set a real version (single source via changesets or a shared version), choose and set a real license (e.g. MIT) replacing UNLICENSED, remove private:true from the publishable libs (keep root private), add a `files` field (['dist']) so only built output ships, add `publishConfig` ({access:'public'}), and verify each subpath in the exports map resolves to an emitted dist file (app/package.json already has good conditional exports — replicate that completeness for webgpu/render/runtime/simulation which currently expose only '.'). Add a top-level LICENSE file. Add the inter-package workspace:_ deps replacement strategy for publish (pnpm publish converts workspace:_ to the resolved version automatically — verify and document).

**Touch:**

- `packages/*/package.json (modify all 7): version, license, drop private (libs), add files+publishConfig, expand exports where only '.' exists`
- `package.json (modify): keep private:true (workspace root) but add release scripts`
- `LICENSE (new): chosen OSS license text`
- `packages/render/package.json, packages/webgpu/package.json (modify): add per-subpath exports for the public surfaces the dist already emits (e.g. webgpu/dist/webgpu/* barrels)`

**Done when:**

- [ ] `pnpm -r exec npm pack --dry-run` (or equivalent) succeeds for every publishable package and the tarball contains dist + LICENSE + package.json and EXCLUDES src/test.
- [ ] A Vitest/Node check (extend the existing 'test: guard app and cli public surfaces' guard) asserts no publishable package has private:true, version!=='0.0.0', license!=='UNLICENSED', and every exports subpath points to a path that exists under dist after build.
- [ ] LICENSE file exists at repo root and the SPDX id matches every package.json license field.
- [ ] Root `pnpm build` then a publish dry-run resolves all @aperture-engine/_ workspace:_ deps to the concrete version (no workspace: spec leaks into the packed manifest).

**Study:** packages/app/package.json (the already-polished conditional exports map to replicate); root package.json:10 (build order for tsc -b)

**Watch out:** Removing private:true on a package that accidentally ships src or has unresolved workspace deps will publish a broken tarball — gate with npm pack --dry-run in CI. The exports map must match the actual tsc -b emit layout (some packages emit under dist/<pkg>/_ — verify, app uses dist/_ directly). License choice is a product decision; pick MIT unless instructed otherwise and keep it consistent across all manifests + LICENSE.

#### `M1-T10` · Make the CLI scaffolder emit installable semver deps and a real project version

`docs-tooling` · effort **S** · depends: M1-T9

Fix packages/cli/src/create/package-json.ts so scaffolded projects are installable. CLI_VERSION is hardcoded '0.0.0' (line 4), so defaultApertureDependencySpec (lines 19-21) returns 'workspace:\*' and packageJsonFile (line 29) sets the generated project's version to '0.0.0'. Derive the real CLI version at build time (read the cli package.json version, e.g. via a generated constant or import.meta) so defaultApertureDependencySpec returns `^<version>` for external consumers; set the generated project's version to a sensible default like '0.1.0' (not 0.0.0); and ensure the generated devDependency on @aperture-engine/cli also uses the real semver. Keep a workspace-mode escape (env flag) for in-repo example generation so internal scaffolds still link to local packages.

**Touch:**

- `packages/cli/src/create/package-json.ts (modify): replace literal CLI_VERSION with the real published version (build-time injected or read from package.json), fix defaultApertureDependencySpec + generated version`
- `packages/cli/src/create/* (verify): any other place referencing the dependency spec`
- `packages/cli/package.json (verify): version becomes the single source of truth post-M1-T9`

**Done when:**

- [ ] A Vitest unit (extend the cli public-surface guard) asserts defaultApertureDependencySpec() returns a `^x.y.z` semver matching the cli package.json version (not 'workspace:_') when CLI_VERSION is non-0.0.0, and packageJsonFile(...) emits a generated project version !== '0.0.0' with @aperture-engine/_ deps as ^semver.
- [ ] An end-to-end scaffold test (or the existing create test) generates a project and asserts its package.json dependencies contain no 'workspace:\*' specs.
- [ ] A documented APERTURE_LOCAL/workspace flag still produces workspace:\* for in-repo generation (so example/playground scaffolds keep linking locally).

**Study:** packages/cli/src/create/package-json.ts:4,19-21,29; packages/cli/package.json (version source after M1-T9)

**Watch out:** The version must be injected at build, not read at runtime from a path that won't exist in the published npm layout — prefer a generated constant emitted during cli build, or read from the bundled package.json with a path that survives publish (dist-relative). Coordinate with M1-T9 so the version is consistent across all manifests.

#### `M1-T11` · Add CI + release pipeline (build/test/publish gates)

`docs-tooling` · effort **M** · depends: M1-T9, M1-T10

Add the missing automation that gates publication. Create .github/workflows for CI (run `pnpm run check`: boundaries, typecheck, examples node --check, lint, format:check, vitest) on PRs, plus a release workflow that builds all packages, runs npm pack --dry-run guards (from M1-T9), and publishes on a tag or via changesets. Add .changeset (or a chosen versioning tool) for coordinated version bumps across the 7 packages, and an .npmrc/.npmignore as needed. Wire the publish-readiness Vitest guards (M1-T9/T10) into the CI job so a regression to private/0.0.0/workspace:\* fails the build.

**Touch:**

- `.github/workflows/ci.yml (new): pnpm install + pnpm run check on PR/push`
- `.github/workflows/release.yml (new): build + pack-dry-run guard + publish on tag/changeset`
- `.changeset/config.json (new): changesets config for the @aperture-engine/* packages`
- `package.json (modify): add 'release'/'changeset' scripts; .npmrc/.npmignore as needed`

**Done when:**

- [ ] CI workflow runs `pnpm run check` and passes on a clean tree (the same gate used locally).
- [ ] The release workflow, run in dry-run mode, builds every package and the npm pack --dry-run guard from M1-T9 passes for all 7 publishable packages.
- [ ] A deliberately-regressed package (set private:true or version 0.0.0) makes the publish-readiness guard fail CI (proves the gate works).
- [ ] Changesets config lists the 7 publishable packages with access:public and excludes root/examples/playground.

**Study:** root package.json:9-31 (existing check/test/render-control scripts the CI must invoke); packages/app/package.json (publishable surface)

**Watch out:** render-control / Playwright E2E need WebGPU (--enable-unsafe-webgpu Chromium) which may be unavailable on default CI runners — gate GPU-dependent jobs separately (skipIfUnsupportedWebGpu already exists) so the publish gate does not falsely block on headless-GPU absence. Do not auto-publish from PRs; publish only on tag/changeset with explicit token.

**Sequencing.** Four independent tracks can start in parallel: SHADOWS (M1-T1 -> M1-T2 -> M1-T3, strictly sequential), ASSETS (M1-T4 -> M1-T5 -> M1-T6, sequential; T4 unblocks meshopt+quantized geometry needed by T8), PICKING (M1-T7 -> M1-T8, sequential; T8 also depends on T4 for quantized meshes), and PUBLISHING (M1-T9 -> M1-T10 -> M1-T11, sequential). M1-T1 is the longest pole (lifting the 17-stage orchestrator) — start it first. M1-T4 is small and unblocks both the asset track and the picking track's geometry, so prioritize it early. The publishing track has no engine dependencies and can be done by a separate person immediately. Within shadows, do NOT attempt M1-T3 (shaderSampling status flip) before M1-T2 actually wires receiver sampling, or the status would lie.

**Proof.** Each wiring task ends in a concrete proof using existing harnesses: (1) Shadows proven by a NEW render-control route examples/auto-shadow._ that builds NO shadow resources by hand, plus test/e2e/auto-shadow.spec.ts asserting a receiver-region luminance delta vs a shadow-disabled baseline (mirroring csm-directional-shadow.spec.ts:expectCsmShadowActivation lines 370-405) and the report.shadow.commandBufferSubmission.status==='submitted' + sections.shaderSampling===true; existing shadow specs (csm/spot/point/multi) must keep passing via the explicit-override path. (2) Assets proven by examples/compressed-gltf._ render-control routes (draco + ktx2 GLBs) asserting report.ok and a compressed transcode target, plus Vitest units for KHR_mesh_quantization root validation, quantized accessor dequant, the createKtx2TextureCompressionSupportFromFeatures caller, and per-mip-level upload. (3) Picking proven by Vitest units for rayFromPointer perspective/orthographic unprojection and the spatial-population system (BVH cache reuse + correct hit entity), plus a render-control route that does CameraHandle.rayFromPointer -> context.spatial.raycastFirst over a spawned mesh and asserts the picked entity. (4) Publishing proven by `pnpm -r npm pack --dry-run` tarball inspection, an extended public-surface guard Vitest asserting no private/0.0.0/UNLICENSED/workspace:\* leaks, a LICENSE file, and a CI workflow running `pnpm run check`. Run `pnpm run check` (root) after every track to keep boundaries/typecheck/lint/format/tests green.

**SOTA bar (when to stop).** Good-enough for M1 is WIRING, not novelty — stop when finished code is connected and provable, not when it is best-in-class. Shadows: stop once directional CSM casts automatically with receiver sampling on and submission==='submitted'; do NOT attempt PCSS/VSM, cascade blending, frustum-fit CSM, slope/normal bias threading, or removing the WGSL min-visibility floor (those are separate quality gaps explicitly out of M1). Spot/point auto-wiring is a bonus if the directional path generalizes cheaply via the existing matrix-computation modules; otherwise ship directional and follow up. Assets: stop at default Draco/Meshopt/KTX2 decode + KHR_mesh_quantization + GPU mips + KTX2 mip-chain upload reaching three.js/PlayCanvas auto-registration parity; do NOT add USDZ/FBX/OBJ/PLY/VRM/gsplat, KHR_lights_punctual import, webp/avif, PBR-next extensions, streaming/LOD, or async worker decode (all separate gaps). Picking: stop at a working CPU ray -> BVH pick of triangle-list meshes out of the box; do NOT build hover/enter/leave/click/drag event layer, multi-touch/wheel, marquee select, or point/line/sprite threshold picking (separate gaps). Publishing: stop when packages install from npm and the scaffolder emits installable deps with CI gating; a full docs site, framework adapters, visual editor, and HMR are out of scope.

---

## M2 — End-to-end animation: glTF skin + clip import, keyframe sampler, time driver, public play/crossfade API <a id="m2"></a>

**Wave 1** · **Depends on:** M1 · 9 tasks (3×L, 6×M, 0×S)

> **Goal.** A GLB containing skins, joint hierarchies, morph targets, and keyframed animation clips imports through the standard engine loader (no hand-rolled worker code), and a user calls a public play/crossfade API on the app/spawn surface to drive it. Each frame the engine samples clips (LINEAR/STEP/CUBICSPLINE) on a headless-safe time driver, writes joint LocalTransforms into the ECS, computes the joint palette from resolved world transforms + inverse-bind matrices, packs joint matrices and unlimited morph weights into the snapshot via typed buffers (no per-frame JSON parse), and the GPU skinning/morph shaders render the deformed, animating mesh. Proven by a new render-control/Playwright route that imports a skinned+animated GLB end-to-end through createWebGpuApp and asserts the rendered pixels change over time and that the skeleton/clip data is engine-owned, plus vitest unit coverage of the sampler, time driver, and crossfade.

**Current state (verified against source).** GPU skinning and 2-target morph shaders work end-to-end (packages/webgpu/src/materials/standard/standard-skinning-shader.ts injects a 4-influence apertureSkinMatrix backed by a mat4x4f storage buffer at group(1) binding(1); standard-morph-target-shader.ts morphs-then-skins matching glTF order). The snapshot transport (RenderSnapshot.bones / RenderSnapshot.morphTargetWeights Float32Arrays in snapshot-core-types.ts, packed via createSkinningJointBufferDescriptor / createMorphTargetWeightBufferDescriptor) and batch keys (skinned/morphed in snapshot-packet-types.ts BatchCompatibilityKey) are sound. The geometry side imports JOINTS_0/WEIGHTS_0 and morph POSITION/NORMAL. BUT: (1) there is NO clip/keyframe/sampler/time-driver/skeleton type anywhere — packages/runtime/src/animation-blending.ts only has stateless blendAnimationClipSamples + a 2-clip crossFadeTo/sampleAnimationCrossFade weight ramp; AnimationClipHandle/SkinHandle/MorphTargetSetHandle are bare brand strings in packages/simulation/src/assets/types.ts. (2) The glTF importer ignores gltf.animations and gltf.skins entirely — gltf-root.ts MAPPER_ARRAY_FIELDS is only materials/textures/images/samplers; gltf-ecs-command-replay-components.ts only handles Name/LocalTransform/Parent/WorldTransform/Mesh/Material/Visibility (GltfEcsAuthoringComponentName in gltf-ecs-authoring-command-plan-types.ts has no Skin/animation); gltf-scene-traversal-nodes.ts records meshIndex but not node.skin. (3) Joint matrices transport as a re-parsed JSON string: Skin.jointMatricesJson (EcsType.String) is JSON.stringify'd in authoring-create-mesh-data.ts:58 and JSON.parsed every extraction in extraction-mesh-deformation.ts:32-66; MorphTargetWeights.weightsJson is the same. (4) Morph hard-capped at 2 targets (POSITION/NORMAL only, no TANGENT) at fixed @location 10-13; readMorphTargetWeights clamps exactly 4 floats to [-1,1]. (5) KHR_lights_punctual / node.camera not parsed (out of scope but adjacent). (6) No public withAnimation/playClip/crossFade — the spawn gltf() command (packages/app/src/systems/spawn/commands.ts:82) returns only the root entity and discards replay.entitiesByKey, which is exactly the joint-node→entity map a skeleton needs. The ENTIRE real animation runtime exists only as hand-rolled application code in examples/glb-viewer.worker.js (parseGltfAnimationClips:5141, sampleAnimationChannel:5494, interpolateAnimationTuple:5530, updateActiveAnimation:5280, applyAnimationAtTime:5311, updateSkinningPalettesFromWorld:4407, readSkinInverseBindMatrices:4367, readGltfFloatAccessorTuples:5663) — this is the spec to extract into the engine.

### Key entry points

| File / symbol                                                            | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/runtime/src/animation-blending.ts`                             | Existing stateless blend/crossfade helpers (blendAnimationClipSamples, crossFadeTo, sampleAnimationCrossFade). The new keyframe sampler + time driver + mixer should live alongside these in the runtime package (headless/worker-safe) and reuse blendAnimationClipSamples for multi-clip weighting.                                                                                                                                                                                      |
| `examples/glb-viewer.worker.js`                                          | Hand-rolled reference runtime to extract verbatim into the engine: parseGltfAnimationClips (5141), sampleAnimationChannel (5494, LINEAR/STEP), interpolateAnimationTuple (5530, quaternion hemisphere flip), updateActiveAnimation/applyAnimationAtTime/animationClipLocalTime (5280-5484, loop/once/clamp/speed/scrub/wrapTime), updateSkinningPalettesFromWorld (4407, inverseMeshWorld*jointWorld*inverseBind), readSkinInverseBindMatrices (4367), readGltfFloatAccessorTuples (5663). |
| `packages/render/src/assets/gltf-root.ts`                                | MAPPER_ARRAY_FIELDS (line 28) and SUPPORTED_ROOT_EXTENSIONS (line 35) — must add animations/skins awareness; validateRequiredExtensions emits the hard-fail for unsupported required extensions.                                                                                                                                                                                                                                                                                           |
| `packages/render/src/assets/gltf-scene-traversal-nodes.ts`               | Node traversal that builds the entity-key hierarchy but only records meshIndex (line 89). Add node.skin index capture so skin/joint-node→entity-key mapping is available to the command plan.                                                                                                                                                                                                                                                                                              |
| `packages/render/src/assets/gltf-ecs-authoring-command-plan-types.ts`    | GltfEcsAuthoringComponentName union + command value types — must grow Skin (and animation-target reference) commands; GltfEcsAuthoringCommandPlan is what the app replays.                                                                                                                                                                                                                                                                                                                 |
| `packages/render/src/assets/gltf-ecs-command-replay-components.ts`       | applyGltfEcsReplayComponent switch (lines 45-193) — add a 'Skin' case that resolves joint entity keys to entities and writes inverse-bind data; this is the import→ECS write site.                                                                                                                                                                                                                                                                                                         |
| `packages/render/src/rendering/authoring-components-core.ts`             | Skin (line 117, jointMatricesJson String) and MorphTargetWeights (line 126, weightsJson String) component definitions — the JSON-transport stubs to replace with a skeleton-reference + typed-handle design.                                                                                                                                                                                                                                                                               |
| `packages/render/src/rendering/extraction-mesh-deformation.ts`           | readSkinning (JSON.parse at 32-66) / readMorphTargetWeights (JSON.parse + 4-float clamp at 79-127) / pushBoneMatrices / pushMorphTargetWeights — the per-frame parse to eliminate; called from extraction-mesh-draw-inputs.ts:49-82.                                                                                                                                                                                                                                                       |
| `packages/render/src/assets/gltf-mesh-primitive-morph-targets.ts`        | Hard-coded 2-target/4-field morph attribute mapper (targets[0]/targets[1], POSITION/NORMAL only) — must become N-target.                                                                                                                                                                                                                                                                                                                                                                   |
| `packages/webgpu/src/materials/standard/standard-morph-target-shader.ts` | WGSL morph shader hardwired to 2 targets at @location 10-13, weights.x/.y only — must support N targets (data-texture or expanded weight array).                                                                                                                                                                                                                                                                                                                                           |
| `packages/webgpu/src/resources/attributes/morph-target-weight-buffer.ts` | MORPH_TARGET_WEIGHT_FLOATS=4 packing of snapshot.morphTargetWeights into the storage buffer — the GPU consumption side of the 4-weight cap.                                                                                                                                                                                                                                                                                                                                                |
| `packages/app/src/systems/spawn/commands.ts`                             | The gltf() spawn command (line 82) returns only the root entity and throws away replay.entitiesByKey — the exact site to surface a skeleton/animation handle and a play/crossFade API.                                                                                                                                                                                                                                                                                                     |
| `packages/app/src/systems/spawn/gltf.ts`                                 | replayGltfLoadedScene / firstReplayRootEntity — owns the GltfEcsCommandReplayReport (entitiesByKey) needed to bind clip targets and joints to live entities.                                                                                                                                                                                                                                                                                                                               |
| `packages/app/src/systems/assets.ts`                                     | loadSystemGltfAsset (365-515) builds the SystemGltfLoadedScene (commandPlan etc.) from import reports — the site to also parse+register clip/skin assets and carry them on the loaded scene.                                                                                                                                                                                                                                                                                               |
| `packages/runtime/src/index.ts`                                          | Public spawn helpers (withSkin/withMorphTargetWeights at 450-464, JSON-backed) + createExtractionApp.stepAndExtract (211-228, drives world.update then extract) + registerRuntimeComponents — where the animation time-driver system and withAnimation helper register.                                                                                                                                                                                                                    |
| `packages/simulation/src/transform/resolution.ts`                        | TransformResolutionSystem + resolveWorldTransforms (line 63) — joint-palette compute MUST run after this each step; defines the system-ordering invariant for skinning.                                                                                                                                                                                                                                                                                                                    |
| `packages/render/src/assets/gltf-accessor-decoding.ts`                   | decodeGltfPrimitiveAccessors (line 32) — existing engine accessor decoder to reuse for animation sampler input/output and inverse-bind MAT4 accessors instead of re-implementing readGltfFloatAccessorTuples.                                                                                                                                                                                                                                                                              |
| `test/e2e/glb-viewer.spec.ts`                                            | Existing app-level animation assertions (animatedNodes value changes 1200-1310, pause/scrub 1721-1812) — the behavioral bar to reproduce against an engine-owned route, and the proof that these behaviors are currently only example code.                                                                                                                                                                                                                                                |

### Tasks

#### `M2-T1` · Engine AnimationClip asset: keyframe channels + LINEAR/STEP/CUBICSPLINE sampler (headless)

`simulation` · effort **M** · depends: none

Create an engine-level AnimationClip data type and a pure keyframe sampler in the runtime package, extracting the logic from examples/glb-viewer.worker.js sampleAnimationChannel (5494) and interpolateAnimationTuple (5530) but ADDING the CUBICSPLINE interpolant the worker explicitly rejects (worker 5199). Define an AnimationClip { name, duration, channels: { targetId, path: 'translation'|'rotation'|'scale'|'weights', interpolation: 'LINEAR'|'STEP'|'CUBICSPLINE', times: Float32Array, values: Float32Array, componentCount } } in a new packages/runtime/src/animation-clip.ts. Implement sampleAnimationChannel(channel, time) returning a tuple: LINEAR (vector lerp; for rotation do the quaternion-hemisphere sign flip via quaternionDot then renormalize, mirroring worker interpolateAnimationTuple/normalizeAnimationValue); STEP (return previous keyframe); CUBICSPLINE (in/out tangent Hermite: values laid out as inTangent,value,outTangent triples per keyframe, p(t)=(2t^3-3t^2+1)p0 + (t^3-2t^2+t)dt*m0 + (-2t^3+3t^2)p1 + (t^3-t^2)dt*m1, with rotation result renormalized). Clamp time at endpoints. Keep it dependency-free (use packages/simulation math quaternion helpers only). Export from packages/runtime/src/index.ts.

**Touch:**

- `packages/runtime/src/animation-clip.ts (new: AnimationClip/KeyframeChannel types + sampleAnimationChannel + interpolant helpers)`
- `packages/runtime/src/index.ts (re-export the new clip types/sampler; existing export * from ./animation-blending.js pattern at line 90)`

**Done when:**

- [ ] A vitest unit at test/runtime/animation-clip.spec.ts samples a 2-keyframe LINEAR translation channel at t=0, t=mid, t=end and asserts exact lerped tuples
- [ ] A STEP rotation channel returns the previous keyframe's (renormalized) quaternion before the next time and the next at/after it
- [ ] A CUBICSPLINE scalar channel with known in/out tangents matches a hand-computed Hermite value at t=0.5 within 1e-6 (the interpolant the glb-viewer worker rejects)
- [ ] A rotation LINEAR channel crossing a hemisphere boundary (dot<0) returns a shortest-path-blended unit quaternion (|q|==1 within 1e-6)

**Study:** examples/glb-viewer.worker.js:5494-5558 (sampleAnimationChannel, interpolateAnimationTuple, normalizeAnimationValue) and references/three.js src/animation (KeyframeTrack / CubicInterpolant for CUBICSPLINE)

**Watch out:** glTF CUBICSPLINE output layout interleaves in-tangent/value/out-tangent per keyframe (3x stride) — values array length is 3x a LINEAR channel; do not confuse stride. Rotation tangents must NOT be normalized before Hermite, only the final result. Keep sampler pure/allocation-light (reuse scratch tuples) since it runs per-channel per-frame.

#### `M2-T2` · AnimationMixer time driver + crossfade over engine clips (headless)

`runtime-orchestration` · effort **M** · depends: M2-T1

Create an engine AnimationMixer in packages/runtime/src/animation-mixer.ts that owns playback state and produces per-target blended TRS samples, extracting updateActiveAnimation (worker 5280), applyAnimationAtTime (5311), animationClipLocalTime (5468), wrapTime (5490) and the crossfade weight bookkeeping (startActiveAnimationCrossFade 5375 / updateAnimationCrossFadeWeights 5415). The mixer takes resolved clips (from M2-T1) and exposes: play(clipId, { loop:'once'|'repeat'|'pingpong', speed, startTime }), pause()/resume(), seek(time), crossFadeTo(clipId, durationSeconds), and update(deltaSeconds) which advances time (loop/clamp/pingpong + signed speed), samples all active clips, and calls the EXISTING blendAnimationClipSamples (animation-blending.ts:58) for multi-clip weighting during crossfade. update() returns BlendedAnimationChannel[] keyed by targetId+path (no ECS dependency — pure data). Reuse crossFadeTo/sampleAnimationCrossFade from animation-blending.ts for the weight ramp. Export from runtime index.

**Touch:**

- `packages/runtime/src/animation-mixer.ts (new: AnimationMixer class, play/pause/seek/crossFadeTo/update; reuses blendAnimationClipSamples + sampleAnimationCrossFade)`
- `packages/runtime/src/index.ts (export AnimationMixer + state types)`

**Done when:**

- [ ] vitest at test/runtime/animation-mixer.spec.ts: a mixer playing a looping clip of duration D, advanced by update(D\*0.25) four times, returns samples whose local time wraps to ~0 (loop) and matches the clip value at 0
- [ ] pause() freezes returned samples across subsequent update() calls; seek(t) makes update(0) return the clip value at t
- [ ] loop:'once' clamps at duration and reports a clamped/finished flag; speed<0 plays backward and clamps at 0
- [ ] crossFadeTo(B, 1.0) then update(0.5) returns samples that are a normalized blend of clip A and clip B for shared targets (per-target weight sums to ~1), and after update past the duration only clip B contributes (weight 1)

**Study:** examples/glb-viewer.worker.js:5280-5466 (updateActiveAnimation/applyAnimationAtTime/crossfade) and references/three.js src/animation/AnimationMixer.js + AnimationAction.js (clampWhenFinished, crossFadeTo, timeScale)

**Watch out:** The worker conflates app-elapsed time with clip time via playbackOffset (5290/5403) for scrub correctness — replicate carefully or use an internal accumulator instead of recomputing from elapsed. pingpong is new (worker only had once/repeat). Mixer must stay pure (return samples) so it is reusable by both the headless test and the ECS driver system in M2-T6; do NOT write to entities here.

#### `M2-T3` · glTF skin import: parse gltf.skins, inverse-bind matrices, joint hierarchy into an engine skeleton/Skin component

`render-bridge` · effort **L** · depends: none

Wire gltf.skins through the engine import pipeline so a skinned GLB produces an engine-owned skeleton instead of failing or importing static. (1) In gltf-scene-traversal-nodes.ts capture node.skin (mapOptionalIndex) into the traversed node record (alongside meshIndex at line 89) and surface it in gltf-scene-traversal-types.ts. (2) Add a skin parser packages/render/src/assets/gltf-skin-import.ts that reads root.skins[].joints (node indices), root.skins[].skeleton, and decodes the inverseBindMatrices accessor via the EXISTING decodeGltfPrimitiveAccessors / accessor-decoding path (gltf-accessor-decoding.ts) — NOT a re-implementation of worker readSkinInverseBindMatrices (4367). (3) Extend GltfEcsAuthoringComponentName (gltf-ecs-authoring-command-plan-types.ts:5) and the command plan (gltf-ecs-authoring-command-plan-primitives.ts) to emit a 'Skin' addComponent command carrying jointEntityKeys (resolved from joint node indices via the keyPrefix:node:N convention) + inverse-bind Float32Array + skeleton root key. (4) Add the 'Skin' case to applyGltfEcsReplayComponent (gltf-ecs-command-replay-components.ts:45 switch) that resolves jointEntityKeys to live Entity refs and writes them into a redesigned Skin component (see M2-T5 for storage). Add 'KHR_skin'/skins handling is not an extension — skins is a core root array, so add it to MAPPER_ARRAY_FIELDS awareness/validation in gltf-root.ts so it is not treated as unknown.

**Touch:**

- `packages/render/src/assets/gltf-scene-traversal-nodes.ts (capture node.skin at line ~89)`
- `packages/render/src/assets/gltf-scene-traversal-types.ts (add skinIndex to traversed node type)`
- `packages/render/src/assets/gltf-skin-import.ts (new: parse joints + decode inverse-bind via decodeGltfPrimitiveAccessors)`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan-types.ts (add 'Skin' to GltfEcsAuthoringComponentName + GltfSkinCommandValue)`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan-primitives.ts (emit Skin command on skinned mesh entities)`
- `packages/render/src/assets/gltf-ecs-command-replay-components.ts (add Skin case resolving joint entity keys)`
- `packages/render/src/assets/gltf-root.ts (recognize 'skins' root array)`

**Done when:**

- [ ] vitest at test/render/gltf-skin-import.spec.ts loads a fixture GLB with a 2+ joint skin and asserts the parsed skin has correct jointCount, joint node indices, and inverse-bind matrices matching the accessor (decoded via the engine accessor path)
- [ ] Replaying the command plan produces a mesh entity with a Skin component whose joint entity references resolve to the joint node entities created from the same scene (entitiesByKey)
- [ ] A required gltf with skins no longer hard-fails gltf-root validation; gltfRoot diagnostics contain no 'unsupportedRequired' for skins
- [ ] The skinned import path matches examples/glb-viewer.worker.js skeleton wiring (jointEntities + inverseBindMatrices) but is produced entirely by replayGltfEcsAuthoringCommands

**Study:** examples/glb-viewer.worker.js:4280-4381 (skin entry build + readSkinInverseBindMatrices) and references/bevy crates gltf loader skin handling

**Watch out:** Joint node entities and the skinned mesh entity are created by the same command plan but joints may be processed AFTER the mesh — Skin command must resolve joint keys from entitiesByKey at replay time (deferred like the existing Parent case at 79-114), not at plan time. skin.skeleton root may be null (joints rooted at scene). Do not double-build per primitive: the worker builds one skin per (node,primitive) — store the skeleton once per skin and reference it from mesh-primitive entities.

#### `M2-T4` · glTF animation import: parse gltf.animations into engine AnimationClip assets bound to scene targets

`render-bridge` · effort **M** · depends: M2-T1, M2-T3

Parse gltf.animations into engine AnimationClip assets, extracting parseGltfAnimationClips (worker 5141) but using the engine accessor decoder (gltf-accessor-decoding.ts) for sampler input/output and supporting all three interpolations (the worker rejects CUBICSPLINE at 5199; do not reject it). Add packages/render/src/assets/gltf-animation-import.ts that for each animation reads channels (target.node, target.path translation/rotation/scale/weights, sampler input times + output values + interpolation) and resolves target.node to the keyPrefix:node:N entity key (the same convention used in spawn/gltf.ts:93 and worker 5235). Produce AnimationClip data (M2-T1 shape) with channel targetId = the resolved entity key. Register each clip in the AssetRegistry under an AnimationClipHandle (createAnimationClipHandle already exists, packages/simulation/src/assets/handles.ts:61). Carry the parsed clips + skin onto SystemGltfLoadedScene in app/src/systems/assets.ts:503 (loadSystemGltfAsset return). Emit a structured 'gltfAnimation.\*' diagnostic report (channel count, unsupported target paths) consistent with the project's report-driven import style.

**Touch:**

- `packages/render/src/assets/gltf-animation-import.ts (new: parse animations -> AnimationClip[] using decodeGltfPrimitiveAccessors)`
- `packages/render/src/assets/gltf-animation-import-report.ts (new: structured diagnostics)`
- `packages/app/src/systems/assets.ts (loadSystemGltfAsset: parse clips, register AnimationClipHandle, attach to SystemGltfLoadedScene at ~503)`
- `packages/app/src/systems/assets.ts (SystemGltfLoadedScene interface ~64: add clips + skin fields)`

**Done when:**

- [ ] vitest at test/render/gltf-animation-import.spec.ts loads a fixture GLB with a keyframed clip and asserts clip.name, clip.duration (max channel end time), and per-channel times/values/interpolation match the accessors
- [ ] A CUBICSPLINE channel imports successfully (no 'unsupportedInterpolation' diagnostic) and its sampler values triple-stride is preserved for M2-T1
- [ ] Channel targetIds equal the entity keys produced by the scene command plan (resolvable via the replay entitiesByKey)
- [ ] SystemGltfLoadedScene returned by loadSystemGltfAsset exposes the registered AnimationClipHandles and skeleton, and the clips are present in the AssetRegistry as 'animation-clip' kind

**Study:** examples/glb-viewer.worker.js:5141-5278 (parseGltfAnimationClips) and references/three.js src/loaders/GLTFLoader.js (loadAnimation, GLTFCubicSplineInterpolant)

**Watch out:** morph 'weights' target path produces a channel whose value count == number of morph targets (variable), not 3/4 — keep componentCount dynamic and route it to morph weights not TRS (depends on M2-T7 for >2 morph support to be visible). target.node may be undefined for some channels (skip with diagnostic). Reuse the engine accessor decoder rather than the worker's readGltfFloatAccessorTuples to avoid a second accessor implementation drifting from validation.

#### `M2-T5` · Typed (non-JSON) joint-matrix snapshot transport replacing jointMatricesJson

`render-bridge` · effort **M** · depends: none

Eliminate the per-frame JSON.parse of joint matrices. Redesign the Skin authoring component (authoring-components-core.ts:117) so the joint palette is no longer an EcsType.String. Store joint matrices in a typed flat buffer reachable without JSON: either a Vec/Float32 ECS field array sized jointCount\*16, or a per-skeleton shared Float32Array referenced by a stable skin id (preferred — matches the SoA snapshot.bones layout). Update createSkin (authoring-create-mesh-data.ts:51) to stop calling JSON.stringify, and rewrite readSkinning (extraction-mesh-deformation.ts:12-67) to read the typed palette directly (drop JSON.parse + parseFiniteNumberArray + the %16 revalidation, keep bounds/jointCount checks). pushBoneMatrices already packs into snapshot.bones — keep that path. Keep withSkin (runtime/src/index.ts:450) working with a typed input. This is a pure transport refactor; rendered output and the existing skinned snapshot codecs (snapshot-packed-mesh-codec.ts boneMatrixOffset/Count) must be byte-identical.

**Touch:**

- `packages/render/src/rendering/authoring-components-core.ts (Skin: replace jointMatricesJson String with typed joint-matrix storage)`
- `packages/render/src/rendering/authoring-create-mesh-data.ts (createSkin: write typed buffer, no JSON.stringify at 58)`
- `packages/render/src/rendering/extraction-mesh-deformation.ts (readSkinning: read typed palette, remove JSON.parse 32-66)`
- `packages/runtime/src/index.ts (withSkin keeps typed SkinInput at 450-455)`

**Done when:**

- [ ] grep for JSON.parse/JSON.stringify in extraction-mesh-deformation.ts and authoring-create-mesh-data.ts (skin path) returns zero hits
- [ ] An existing-style vitest comparing extractRenderSnapshot.bones for a skinned entity before/after the refactor produces identical Float32Array contents and identical boneMatrixOffset/boneMatrixCount on the MeshDrawPacket
- [ ] A perf microbench (or assertion) shows readSkinning performs no allocation proportional to a JSON string per extract for a 50-joint skin
- [ ] Existing skinned-mesh render route still produces the same pixels (no visual regression)

**Study:** packages/render/src/rendering/extraction-mesh-deformation.ts:12-77 and packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts (createSkinningJointBufferDescriptor)

**Watch out:** elics components store fixed-shape schemas; a variable-length per-entity matrix array may need a side table keyed by entity/skin id rather than an ECS field. Whatever storage is chosen must remain structured-clone/worker-safe AND headless-safe (no GPU types). Do not change snapshot.bones layout or the GPU buffer descriptor — only the authoring->extraction source. Keep diagnostic codes (render.skinning.\*) so existing tests asserting them still pass or are intentionally updated.

#### `M2-T6` · Joint-palette compute system: world-transform-driven skin update each step (headless)

`simulation` · effort **M** · depends: M2-T3, M2-T5

Add an engine system that computes the joint palette from resolved world transforms + inverse-bind matrices, extracting updateSkinningPalettesFromWorld (worker 4407): for each skinned entity, inverseMeshWorld = inverse(meshWorldTransform); for each joint i, palette*i = inverseMeshWorld * jointWorld*i * inverseBind_i; write into the typed Skin palette (M2-T5). Register it as a runtime system (packages/runtime/src/index.ts registerRuntimeComponents/SpinSystem area) with a priority guaranteeing it runs AFTER TransformResolutionSystem (simulation/src/transform/resolution.ts) but before extraction. Use the engine math (invertMat4 packages/simulation/src/math/matrix.ts:95, multiplyMat4 :43). The system reads the Skin component's joint entity refs (from M2-T3) and inverse-bind data and updates the palette in place — no JSON.

**Touch:**

- `packages/runtime/src/skinning-palette-system.ts (new: SkeletonPaletteSystem extracting worker updateSkinningPalettesFromWorld)`
- `packages/runtime/src/index.ts (register the system; ensure priority after transform resolution)`
- `packages/simulation/src/transform/resolution.ts (reference TransformResolutionSystem priority to order the new system)`

**Done when:**

- [ ] vitest at test/runtime/skinning-palette-system.spec.ts: a 2-joint skeleton with a known joint LocalTransform, after world-transform resolution + the palette system, has Skin palette matrices equal to hand-computed inverseMeshWorld*jointWorld*inverseBind within 1e-5
- [ ] With all joints at bind pose (jointWorld == inverse(inverseBind) relative to mesh) the palette is identity within 1e-5
- [ ] Rotating a joint's LocalTransform and re-stepping changes only that joint's palette block
- [ ] The system runs after TransformResolutionSystem in a full createExtractionApp.step() (assert ordering via a sentinel or by checking palette reflects the same-frame transform, not last frame)

**Study:** examples/glb-viewer.worker.js:4407-4458 (updateSkinningPalettesFromWorld) and references/bevy skinned mesh joint matrix computation

**Watch out:** Ordering is the core invariant: if the palette system runs before resolveWorldTransforms it uses stale joint worlds (one-frame lag). createSimulationApp.step() (runtime/src/index.ts:202) calls world.update then resolveWorldTransforms imperatively — confirm whether the palette compute belongs inside step() after resolveWorldTransforms or as a high-priority system; the worker did it imperatively post-resolve in createGlbWorkerSnapshotMessage (1111). invertMat4 can return null (degenerate mesh world) — fall back to identity per joint like the worker (4416).

#### `M2-T7` · Unlimited morph targets: N-target import, typed weight transport, and N-target WGSL

`webgpu-render` · effort **L** · depends: M2-T5

Lift the 2-target morph cap end to end. (1) Import: rewrite gltf-mesh-primitive-morph-targets.ts (currently targets[0]/targets[1], 4 fixed fields, POSITION/NORMAL only) to map all targets[] with POSITION/NORMAL (and optionally TANGENT) into indexed morph vertex streams or a morph-target data texture; surface targetCount. (2) Transport: replace MorphTargetWeights.weightsJson (authoring-components-core.ts:126) with a typed weight array; rewrite readMorphTargetWeights (extraction-mesh-deformation.ts:79-127) to drop JSON.parse and the fixed 4-float [-1,1] clamp and pack targetCount weights into snapshot.morphTargetWeights; update morph-target-weight-buffer.ts (MORPH_TARGET_WEIGHT_FLOATS=4) to a per-instance variable stride or a weights texture. (3) Shader: rewrite standard-morph-target-shader.ts (hardwired @location 10-13, weights.x/.y) to accumulate over N targets — preferred SOTA path is a morph-target data texture sampled by (vertexIndex, targetIndex) with a per-instance weight storage buffer, matching three.js WebGPURenderer morph handling, rather than fixed vertex attributes. Keep the morph-then-skin order (the existing shader composes correctly).

**Touch:**

- `packages/render/src/assets/gltf-mesh-primitive-morph-targets.ts (N-target mapping, drop fixed 4-field interface)`
- `packages/render/src/rendering/authoring-components-core.ts (MorphTargetWeights: typed weights, drop weightsJson String)`
- `packages/render/src/rendering/extraction-mesh-deformation.ts (readMorphTargetWeights: typed, N weights, no JSON, no 4-cap clamp)`
- `packages/webgpu/src/resources/attributes/morph-target-weight-buffer.ts (variable weight count)`
- `packages/webgpu/src/materials/standard/standard-morph-target-shader.ts (N-target accumulation via data texture or expanded buffer)`

**Done when:**

- [ ] vitest: a GLB with 4+ morph targets imports all targets (targetCount>=4), not just 2
- [ ] extractRenderSnapshot packs all N weights for an entity into snapshot.morphTargetWeights with no [-1,1] clamp truncating beyond 2
- [ ] A render-control route morphs a mesh with 3+ targets and pixel readback differs from the 2-target-only result (proving target>=3 contributes)
- [ ] grep for JSON.parse in readMorphTargetWeights returns zero hits; the 52-blendshape ARKit case is representable (targetCount==52 imports without dropping targets)

**Study:** packages/webgpu/src/materials/standard/standard-morph-target-shader.ts (current 2-target WGSL) and references/three.js src/nodes (morph node / morphTargetsTexture) for the data-texture approach

**Watch out:** Largest task. Fixed vertex attributes cannot scale to 52 targets (vertex attribute limit) — must move to a morph-target data texture or storage buffer indexed by vertex+target, which is a new GPU resource + bind group. This touches batch-key/bind-group-layout keys (STANDARD\_\*\_BIND_GROUP_LAYOUT_KEY). Coordinate with the skinned-morph compose path (lines 91-104). If full N-target texture is too large for this milestone, an acceptable SOTA-bar intermediate is raising the cap to 8 targets via expanded storage buffer + per-target weight array (still removes the structural 2-cap and JSON), with the data-texture path noted as follow-up.

#### `M2-T8` · Public play/crossfade API on app + spawn: drive imported clips via an engine ECS animation system

`runtime-orchestration` · effort **L** · depends: M2-T2, M2-T4, M2-T6

Expose a high-level animation API and an ECS driver system so imported clips animate without any user-authored runtime. (1) Add an Animation authoring component + an engine AnimationDriverSystem (in runtime) that, per entity holding an animation handle, owns an AnimationMixer (M2-T2), advances it by delta in update(), and writes the blended TRS samples (M2-T2 output, keyed by target entity key) into the corresponding joint/node LocalTransforms — the engine equivalent of applyAnimationAtTime (worker 5311) but writing to entities resolved from the clip targetIds. Register so it runs BEFORE TransformResolutionSystem and the palette system (M2-T6). (2) Public surface: make the spawn gltf() command (app/src/systems/spawn/commands.ts:82) return (or attach to) a handle exposing the imported clips, joints, and mixer controls; add commands.animation(entity)/an AnimationAccess with playClip(clipId, opts), crossFade(fromId,toId,duration), pause/seek. The gltf() command currently discards replay.entitiesByKey (commands.ts:108-118) — thread it through so clip targetIds bind to live entities. (3) Add a withAnimation helper to runtime/src/index.ts alongside withSkin. This replaces the entire hand-rolled glb-viewer runtime with engine calls.

**Touch:**

- `packages/runtime/src/animation-driver-system.ts (new: per-entity AnimationMixer, writes LocalTransform from samples)`
- `packages/runtime/src/index.ts (withAnimation helper; register AnimationDriverSystem with correct priority)`
- `packages/app/src/systems/spawn/commands.ts (gltf(): surface clips+joints+mixer; thread replay.entitiesByKey)`
- `packages/app/src/systems/spawn/gltf.ts (return entitiesByKey / animation bindings from replay)`
- `packages/app/src/systems/spawn/types.ts (SpawnGltfOptions + returned animation handle types)`
- `packages/app/src/systems.ts (export the new animation access types)`

**Done when:**

- [ ] A user calls app.spawn.gltf(handle) then handle.animation.playClip('Walk') (no hand-rolled sampler) and after stepping the world the targeted joint LocalTransforms change to the sampled clip values
- [ ] crossFade('Walk','Run',0.5) blends both clips for 0.5s then settles on 'Run' (per-target weight 1) — asserted via entity LocalTransform values, mirroring glb-viewer.spec.ts:1200-1310 expectations but against engine API
- [ ] pause()/seek(t) on the engine API freeze/scrub the animation as in glb-viewer.spec.ts:1721-1812
- [ ] grep of examples/glb-viewer.worker.js-equivalent NEW engine route shows it uses only engine API (no parseGltfAnimationClips/sampleAnimationChannel/updateActiveAnimation reimplementation)

**Study:** examples/glb-viewer.worker.js:5280-5466 + 4407 (the full hand-rolled control loop being replaced) and references/three.js AnimationMixer.clipAction(...).play()/crossFadeTo()

**Watch out:** System ordering: animation-driver (writes joint LocalTransforms) -> TransformResolutionSystem (resolves world) -> palette system (M2-T6). Get priorities right or you get one-frame lag or a static pose. The mixer must be owned per animated root, not global — store it keyed by entity. Binding clip targetIds (entity keys) to live entities requires the replay entitiesByKey that gltf() currently throws away; this is the load-bearing wiring fix. Keep the API worker-safe (mixer lives in the simulation worker), with controls marshaled across the transport if the app drives from the main thread.

#### `M2-T9` · End-to-end skinned + animated GLB route: render-control + Playwright proof through createWebGpuApp

`docs-tooling` · effort **M** · depends: M2-T6, M2-T7, M2-T8

Author a new worker-authored example route + Playwright spec that imports a skinned + morphed + keyframed GLB entirely through createWebGpuApp/spawn (no glb-viewer hand-rolled code) and proves the full pipeline. Follow the existing examples/_.worker.js + _.main.js + _.html pattern (e.g. examples/gltf-scene._) and the render-control harness (scripts/render-control.mjs) for JSON-safe status + pixel readback. The route: loads a skinned+animated fixture GLB, spawns it, calls the public playClip API (M2-T8), steps several frames, and publishes status (clip name, current time, sampled joint values, morph weights, skin jointCount) + captures pixels at two distinct times. Add a reusable skinned+animated fixture under examples/assets if one does not exist (a 2-joint bend + 1 morph + a LINEAR clip is sufficient; a CUBICSPLINE clip variant exercises M2-T1). Add test/e2e/animation-skinning.spec.ts asserting pixels differ between the two captured times and that engine-owned status (not example state) reflects the active clip.

**Touch:**

- `examples/animation-skinning.worker.js (new: import + playClip via engine API)`
- `examples/animation-skinning.main.js (new: render-control bridge)`
- `examples/animation-skinning.html (new)`
- `examples/assets/* (new skinned+animated GLB fixture if absent)`
- `test/e2e/animation-skinning.spec.ts (new: pixel-diff over time + engine status assertions)`

**Done when:**

- [ ] The Playwright spec loads the route, plays a clip, and asserts the rendered pixels at frame A differ from frame B by a meaningful threshold (animation visibly moves the mesh)
- [ ] The route's JSON status exposes engine-owned animation state (active clip, time, jointCount, morph targetCount) sourced from the engine API — not a hand-rolled sampler
- [ ] A second assertion confirms a CUBICSPLINE clip plays (proving M2-T1) and a >2-target morph contributes (proving M2-T7)
- [ ] render-control snapshot of the route is reproducible/stable (volatile fields filtered) and the spec passes headless in CI

**Study:** examples/gltf-scene.worker.js + test/e2e/gltf-scene.spec.ts (route+spec pattern) and test/e2e/glb-viewer.spec.ts:1200-1310,1721-1812 (the animation-behavior assertions to reproduce against the engine API)

**Watch out:** Need a real skinned+animated GLB fixture; if none exists, generate a minimal one (could be authored via the Blender MCP or checked in). Pixel-diff thresholds must tolerate AA/timing jitter — capture at clearly different clip phases. Shadow caster path for skinned meshes is known-broken (shadow-caster uses rest pose); keep this route's lighting such that the deformation is visible in the lit pass, and note the skinned-shadow gap as out-of-scope for M2 to avoid a false failure.

**Sequencing.** Two independent foundations can start in parallel: the headless animation core (M2-T1 sampler -> M2-T2 mixer) and the import/transport refactors (M2-T3 skin import and M2-T5 typed joint transport are independent; M2-T7 morph is independent of skin but depends on the typed-transport pattern from M2-T5). M2-T4 (animation import) needs both M2-T1 (clip shape) and M2-T3 (target entity keys). M2-T6 (palette compute) needs M2-T3 + M2-T5. The integration task M2-T8 (public API + ECS driver) needs M2-T2 + M2-T4 + M2-T6. The proof route M2-T9 needs M2-T6 + M2-T7 + M2-T8. Critical path: T1 -> T2 -> T8 -> T9 and T3 -> T4/T6 -> T8 -> T9. Land T5 early since both T6 and T7 build on the typed-transport pattern.

**Proof.** Layered: (1) Vitest units for each pure layer — sampler interpolants incl. CUBICSPLINE (test/runtime/animation-clip.spec.ts), mixer loop/clamp/pingpong/speed/crossfade (test/runtime/animation-mixer.spec.ts), palette math vs hand-computed inverseMeshWorld*jointWorld*inverseBind (test/runtime/skinning-palette-system.spec.ts), skin + animation import vs accessor data (test/render/gltf-skin-import.spec.ts, test/render/gltf-animation-import.spec.ts), and a before/after snapshot.bones equality test for the JSON->typed transport refactor. (2) extractRenderSnapshot-level assertions that bones/morphTargetWeights are populated with no JSON parse and >2 morph weights survive. (3) An engine-owned end-to-end render-control + Playwright route (test/e2e/animation-skinning.spec.ts) that imports a skinned+morphed+animated GLB through createWebGpuApp, plays a clip via the public API, and asserts rendered pixels change across two clip phases plus engine-sourced status (active clip, jointCount, morph targetCount). The bar is that the behaviors currently asserted only in glb-viewer.spec.ts (animatedNodes value drift at 1200-1310, pause/scrub at 1721-1812) are reproduced against the engine API with zero hand-rolled sampling code.

**SOTA bar (when to stop).** Good-enough for M2 = a SOTA-comparable but minimal skeletal/morph/clip system: glTF skins + animations import through the standard loader producing engine-owned AnimationClip/skeleton assets; LINEAR/STEP/CUBICSPLINE sampling (matching three.js KeyframeTrack interpolants); an AnimationMixer-equivalent time driver with loop/once/pingpong + speed + scrub + a single crossfade (three.js clipAction/crossFadeTo parity); joint palette computed from resolved world transforms; typed (zero per-frame JSON) joint + N-target morph snapshot transport; and a public playClip/crossFade API on the app/spawn surface. STOP THERE for this milestone — explicitly OUT of scope (deferred, already cataloged as separate gaps): animation state machine/blend trees/additive layers/masking, IK, retargeting, root motion, timeline events, GPU-compute skinning, and the skinned-mesh shadow-caster rest-pose bug. For morph, the SOTA target is a morph-target data texture (three.js WebGPURenderer style) to reach 52 ARKit blendshapes; if that GPU work overruns, an 8-target expanded-buffer intermediate that removes the structural 2-cap + JSON is an acceptable milestone exit with the data-texture path as documented follow-up. Do not gold-plate the mixer with multi-layer blending — one crossfade lane is the bar.

---

## M4 — Production-quality shadows: frustum-fit stabilized CSM, cascade blending, real bias, soft shadows, alpha-tested casters <a id="m4"></a>

**Wave 1** · **Depends on:** M1 · 9 tasks (4×L, 4×M, 1×S)

> **Goal.** A user authoring a directional CSM light with LightShadowSettings (bias/normalBias/cascadeCount, plus new shadowType/strength/filterRadius fields) gets shadows that: stay sharp and stable as the camera moves (frustum-fit + texel-snapped cascade matrices derived from the camera view, not a fixed [0,0,0] center), reach full darkness (no 0.45/0.5 visibility floor; authored strength controls it), use the authored depth/normal bias (slope-scaled pipeline depthBias + normal-offset receiver position, not dead constants), blend smoothly across cascade splits (no hard seams), can be softened with PCSS contact-hardening as an authored shadowType, and correctly silhouette alpha-tested foliage (caster fragment shader does alpha-test discard with UV+baseColor, not an empty depth-only pass). Each behavior is proven by a render-control worker/main route that asserts JSON-safe status plus pixel deltas, gated by an extended Playwright spec built on the existing csm-directional-shadow harness.

**Current state (verified against source).** The full caster->depth->submit->sample chain is ALREADY WIRED end-to-end in the render-control harness (M1 done): examples/csm-directional-shadow.main.js createCsmShadowFrame() builds descriptor->textures->depthTextureResource(live GPU alloc)->passPlan->viewProjection->matrixComputation->matrixBuffer->casterDrawList->commandEncoding->pipeline->submit, and test/e2e/csm-directional-shadow.spec.ts asserts commandBufferSubmission.status==='submitted', mode 'directional-csm-depth-array-compare', 4 cascades, and real pixel luminance deltas vs a no-shadow baseline. The ALGORITHM is below SOTA. CONFIRMED gaps with evidence: (1) directional-shadow-matrix-computation.ts uses DEFAULT_CENTER=[0,0,0] (line 85), a single global orthographicSize (line 86 DEFAULT 20) scaled only by plan.cascadeFar fraction (lines 258-260), fixed near/far 0.1/100 (lines 87-88) — the input interface (lines 75-83) takes only center/orthographicSize/near/far/lightDistance, NO camera frustum, NO texel snapping. Examples pass static center (csm scene: [0,0,-3.4], glb-viewer: orbit.target hack). (2) cascadeSplit() in directional-shadow-view-projection-plan.ts (lines 279-288) is purely LINEAR for the MATRIX projection, while light-packing.ts directionalCascadeFarBounds() (lines 728-752) uses a practical linear+log average for SHADER SELECTION — two disagreeing schemes. (3) MIN_VISIBILITY floor: STANDARD_SHADOW_MIN_VISIBILITY=0.45 / STANDARD_POINT_SHADOW_MIN_VISIBILITY=0.5 are baked WGSL consts in standard-shader-shadow-sampling.ts (lines 10,144,396,508,510), applied via mix(MIN_VIS,1.0,visibility) at 6 sites (130,227,341,383,612,660). No strength/intensity authoring field. (4) bias is fixed const STANDARD_SHADOW_DEPTH_BIAS=0.002 (lines 11,145,509) / STANDARD_POINT_SHADOW_DEPTH_BIAS=0.0001 (397,511); ShadowMapDescriptor carries depthBias/normalBias (shadow-map-descriptor.ts lines 42-43,161-162) but they are NEVER threaded to the shader; normalBias has ZERO consumers; caster pipeline depthStencil has only {format,depthWriteEnabled,depthCompare} (shadow-caster-pipeline-resource.ts lines 323-327, descriptor lines 51-55) — no depthBias/depthBiasSlopeScale. (5) Only fixed 3x3 box PCF; the CASCADED path's sampleDirectionalShadowPcf3x3 (line 49) doesn't even take filterRadiusTexels (hardcoded 1/9), while the non-cascaded/multi paths do (lines 147,540). No PCSS/VSM/ESM; LightShadowSettingsInput (authoring-types.ts lines 123-131) has no shadowType/filter field. (6) selectDirectionalShadowCascade (lines 32-47) returns first containing cascade with no overlap/blend; sampleDirectionalShadowFactor (76-131) samples only that one cascade — hard seams. (7) SHADOW_CASTER_DEPTH_ONLY_WGSL (shadow-caster-pipeline-resource.ts lines 26-46) binds only @location(0) position and has an empty fs_main(); pipeline vertex.buffers ['POSITION'] (descriptor line 38,222), cullMode 'none' — alpha-tested casters render solid silhouettes. (8) No atlas packer/scheduler/update policy — ShadowAtlasRegion is only a validated descriptor field. The available knobs filterRadiusTexels (shadow-map-descriptor.ts, clamped 0..16 line 226) ARE threaded to non-cascaded shader paths but not authored. ViewPacket (snapshot-packet-types.ts lines 22-36) exposes viewMatrixOffset/projectionMatrixOffset into snapshot.transforms — the camera frustum data needed for frustum-fit IS available in the snapshot.

### Key entry points

| File / symbol                                                                                               | Role                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/directional-shadow-matrix-computation.ts`      | Computes per-cascade ortho view/projection matrices. The frustum-fit hook: replace DEFAULT_CENTER=[0,0,0] (line 85) + global orthographicSize scaled by cascadeFar (lines 258-260) with camera-frustum-corner fit + texel snapping. Input interface (lines 75-83) must gain camera view/projection + per-cascade near/far.                           |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/directional-shadow-view-projection-plan.ts`    | Plans per-cascade keys and cascadeNear/cascadeFar via linear cascadeSplit() (lines 279-288). Must switch to a practical (linear/log blended) split matching light-packing.ts directionalCascadeFarBounds, and carry world-space near/far distances for the matrix computation to consume.                                                            |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/materials/standard/standard-shader-shadow-sampling.ts` | All shadow WGSL. Holds the MIN_VISIBILITY floor consts (lines 10,144,396,508,510), fixed bias consts (11,145,397,509,511), the 3x3 PCF (cascaded path line 49 has NO filterRadius), single-cascade selection (lines 32-47,76-131). Hook site for: strength uniform, real bias from descriptor, cascade blend, PCSS variant, normal-offset.           |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts`            | SHADOW_CASTER_DEPTH_ONLY_WGSL (lines 26-46): empty fs_main, POSITION-only vertex. createBrowserShadowCasterPipelineDescriptor (lines 298-329) builds the GPU pipeline with depthStencil missing depthBias/depthBiasSlopeScale. Hook site for alpha-test caster shader + slope-scaled bias.                                                           |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts`          | Caster pipeline metadata: vertex.buffers ['POSITION'] (line 38,222), cullMode 'none' (line 48,233), depthStencil (51-55,236-240). Must add optional alphaTest variant (TEXCOORD_0+baseColor binding) and depthBias fields.                                                                                                                           |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-map-descriptor.ts`                      | ShadowMapDescriptor carries depthBias/normalBias/filterRadiusTexels (lines 42-44) but they are dead beyond JSON. The carrier to thread authored params into the shadow uniform buffer that the shader reads. normalizeFilterRadiusTexels clamps 0..16 (line 226). ShadowAtlasRegion + normalizeAtlasRegion (lines 257-285) is the atlas-packer seed. |
| `/Users/felixz/Projects/aperture/packages/render/src/rendering/authoring-types.ts`                          | LightShadowSettingsInput (lines 123-131) — the public authoring surface. Add shadowType ('hard'\|'pcf'\|'pcss'), strength, filterRadius, slopeBias fields here.                                                                                                                                                                                      |
| `/Users/felixz/Projects/aperture/packages/render/src/rendering/authoring-components-camera-light.ts`        | LightShadowSettings ECS component (lines 92-104) — add matching EcsType fields (Int32 shadowType enum, Float32 strength/filterRadius/slopeBias). Source of truth per invariants.                                                                                                                                                                     |
| `/Users/felixz/Projects/aperture/packages/render/src/rendering/extraction-light-settings.ts`                | readShadowSettings (lines 27-56) reads component->LightShadowSettingsInput; appendShadowRequest (lines 115-143) builds ShadowRequestPacket. Must extract + validate the new fields and put them on the ShadowRequestPacket so the renderer descriptor can consume them.                                                                              |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/lighting/light-packing.ts`                             | Packs per-light floats incl. cascade far-bounds at offset+6 via directionalCascadeFarBounds (lines 270-290,728-752) and matrixBaseIndex at offset+10 (line 291). The slot to also pack shadow strength/bias/filterRadius/shadowType so the shader reads them per-light without a new binding.                                                        |
| `/Users/felixz/Projects/aperture/examples/csm-directional-shadow.main.js`                                   | createCsmShadowFrame() (lines 336+) — the render-thread orchestration that calls createDirectionalShadowMatrixComputationReport with center:shadowIntent.center (lines 413-417). Where frustum-fit input (camera view/proj from snapshot.transforms) gets threaded; where new descriptor fields get passed.                                          |
| `/Users/felixz/Projects/aperture/test/e2e/csm-directional-shadow.spec.ts`                                   | The existing CSM proof spec — asserts status JSON shape + pixel deltas vs baseline (expectCsmShadowActivation, lines 370-405). The template all M4 pixel/JSON proofs extend (add full-darkness, stability-under-camera-motion, soft-vs-hard, alpha-test silhouette assertions).                                                                      |
| `/Users/felixz/Projects/aperture/references/bevy/crates/bevy_light/src/cascade.rs`                          | SOTA reference: calculate_cascade (lines 263-329) frustum-corner light-space AABB fit + cascade_texel_size texel snapping (lines 286-299); calculate_cascade_bounds (lines 41-56) exponential split. Study, do not copy.                                                                                                                             |

### Tasks

#### `M4-T1` · Frustum-fit + texel-stabilized directional cascade matrices from the camera view

`webgpu-render` · effort **L** · depends: none

Replace the fixed-center / globally-scaled ortho fit in directional-shadow-matrix-computation.ts with a per-cascade frustum-fit. Extend DirectionalShadowMatrixComputationInput (lines 75-83) to accept camera viewMatrix + projectionMatrix (or inverseViewProjection) and per-cascade world-space near/far split distances (sourced from the plan, see M4-T2). In computeDirectionalShadowMatrix (lines 211-298), for each cascade: derive the 8 frustum corners for that cascade's [near,far] slice in world space, transform into light view space (look-along light direction), compute the light-space AABB, derive cascade_diameter = ceil of the max of body/far-plane diagonals (bevy cascade.rs lines 277-291), set the ortho extent to that diameter, and snap the cascade center to integer texel multiples using texelSize = diameter / mapSize (bevy lines 292-299). Keep DEFAULT_CENTER as a fallback only when no camera frustum is supplied (preserve current static-center behavior for existing examples). Thread mapSize (from plan.mapSize) into the texel-snap. Do NOT introduce a mutable scene graph; consume camera matrices read-only from the snapshot transforms passed by the orchestration layer. Keep the function pure/headless (no GPU, no globals) so the existing Vitest unit tests still run.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/directional-shadow-matrix-computation.ts (extend input interface lines 75-83; rewrite center/size derivation lines 251-273; add frustum-corner + texel-snap helpers)`

**Done when:**

- [ ] A Vitest unit asserts that with a moving camera (two distinct camera view matrices) the per-cascade ortho extent (orthographicSize) is IDENTICAL frame-to-frame (size depends only on frustum shape, not position) while the snapped center changes by integer multiples of diameter/mapSize
- [ ] A Vitest unit asserts the near cascade's orthographicSize is strictly smaller than the far cascade's (tighter fit) for a perspective camera, vs the current behavior where all cascades share one scaled size
- [ ] When no camera frustum is supplied, output matrices are byte-identical to current behavior (existing csm matrixComputation unit tests unchanged)
- [ ] matrixComputation.status stays 'ready' and matrixCount equals cascadeCount in the csm-directional-shadow render-control route

**Study:** /Users/felixz/Projects/aperture/references/bevy/crates/bevy_light/src/cascade.rs (calculate_cascade lines 263-329)

**Watch out:** Frustum corners must be reconstructed in the SAME coordinate convention as makeOrthographic/makeLookAt already used here (right-handed, z into screen); the existing shader does shadowClip.z\*0.5+0.5 remap (sampling lines 97-101) so do not silently switch to reverse-Z. Texel snapping must use the FINAL ortho diameter and the actual mapSize or shadows will swim. The light up-vector degeneracy fallback (makeLookAt lines 333-335) must be preserved when light dir is near-vertical.

#### `M4-T2` · Practical (linear/log blended) cascade splits feeding the matrix fit

`webgpu-render` · effort **S** · depends: none

Replace the pure-linear cascadeSplit() in directional-shadow-view-projection-plan.ts (lines 279-288) so the plan emits world-space near/far split distances using a practical scheme (linear/log blend, identical formula to light-packing.ts directionalCascadeFarBounds lines 728-752) instead of normalized index fractions. The plan must carry both the normalized fraction (for back-compat fields cascadeNear/cascadeFar) and the absolute world-space near/far distances so M4-T1 can build the frustum slice. This unifies the SELECTION far-bounds (already practical, packed at lightFloats offset+6) with the MATRIX projection bounds (currently linear) so the cascade the shader picks matches the cascade the matrix was fit for. Take cameraNear/cameraFar/shadowMaxDistance + cascadeCount as plan inputs (defaulted to current behavior when absent).

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/directional-shadow-view-projection-plan.ts (cascadeSplit lines 279-288; add absolute near/far to DirectionalShadowViewProjectionPlan interface lines 23-42; thread new input fields lines 72-77)`

**Done when:**

- [ ] A Vitest unit asserts that for cascadeCount=4 with shadowMaxDistance=100 the emitted absolute far distances match the same practical formula as light-packing.ts directionalCascadeFarBounds (no longer index/count linear)
- [ ] A Vitest unit asserts the per-cascade absolute near of cascade N equals (or overlaps) the absolute far of cascade N-1 (contiguous coverage)
- [ ] The csm-directional-shadow render-control route's viewProjection.plans still report cascadeIndex [0,1,2,3] and status 'ready' (existing spec assertion lines 274-275 unchanged)

**Study:** /Users/felixz/Projects/aperture/references/bevy/crates/bevy_light/src/cascade.rs (calculate_cascade_bounds lines 41-56)

**Watch out:** The shader-side selection bounds (light-packing.ts directionalCascadeFarBounds) and these matrix-side splits MUST use the same minimum_distance and maximum_distance or selection picks a cascade whose matrix doesn't cover the fragment, producing black/edge artifacts. Keep both reading the same shadowMaxDistance source.

#### `M4-T3` · Author + extract shadowType, strength, filterRadius, slopeBias on LightShadowSettings

`render-bridge` · effort **M** · depends: none

Extend the authoring surface so the dead/missing knobs become real authored data flowing to the renderer. Add to LightShadowSettings ECS component (authoring-components-camera-light.ts lines 92-104): shadowType (Int32 enum: 0=hard,1=pcf,2=pcss), strength (Float32, default 1, 1=fully dark capable), filterRadius (Float32, default 1, texels), slopeBias (Float32, default 0). Mirror them in LightShadowSettingsInput (authoring-types.ts lines 123-131), readShadowSettings (extraction-light-settings.ts lines 35-45), and validateLightShadowSettingsInput (authoring-validation-lights.ts lines 106-152, add range checks: strength in [0,1], filterRadius>=0, shadowType in {0,1,2}). Put the extracted values onto ShadowRequestPacket in appendShadowRequest (extraction-light-settings.ts lines 133-142) so the renderer descriptor pipeline can read them headlessly. Add a withLightShadowSettings authoring helper passthrough if one exists (csm worker line 165 already calls aperture.withLightShadowSettings). No renderer consumption yet — this task only makes the data exist and validate end-to-end.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/render/src/rendering/authoring-components-camera-light.ts (LightShadowSettings lines 92-104)`
- `/Users/felixz/Projects/aperture/packages/render/src/rendering/authoring-types.ts (LightShadowSettingsInput lines 123-131)`
- `/Users/felixz/Projects/aperture/packages/render/src/rendering/extraction-light-settings.ts (readShadowSettings lines 35-45; appendShadowRequest lines 133-142)`
- `/Users/felixz/Projects/aperture/packages/render/src/rendering/authoring-validation-lights.ts (validateLightShadowSettingsInput lines 106-152)`
- `/Users/felixz/Projects/aperture/packages/render/src/rendering/snapshot.ts (ShadowRequestPacket type — add optional shadowType/strength/filterRadius/slopeBias)`

**Done when:**

- [ ] A Vitest extraction unit sets LightShadowSettings with shadowType=2, strength=0.7, filterRadius=4, slopeBias=2 and asserts the produced ShadowRequestPacket carries those exact values
- [ ] validateLightShadowSettingsInput emits a diagnostic for strength=1.5 and shadowType=5 (out of range) and accepts strength=0, filterRadius=8
- [ ] The csm-directional-shadow render-control status (shadow.requests[]) reports the authored shadowType/strength when set on the light, JSON-safe
- [ ] Existing extraction tests guarding LightShadowSettings public surface still pass (no breaking of default-omitted fields)

**Study:** /Users/felixz/Projects/aperture/references/three.js/docs/pages/CSMShadowNode.html.md

**Watch out:** This is the ECS-is-source-of-truth boundary — values must round-trip through the worker snapshot codec. ShadowRequestPacket is encoded in snapshot-packed codecs for cross-worker transport; if shadowType/strength are added to the packet they must be added to the packed encoder/decoder or they will be dropped across the worker boundary. Confirm whether ShadowRequestPacket is packed-codec'd or change-set only before adding fields.

#### `M4-T4` · Authored shadow strength replaces the hard-coded MIN_VISIBILITY floor

`webgpu-render` · effort **M** · depends: M4-T3

Make shadows reach full darkness and obey authored strength. Pack per-light shadow strength into the light float buffer in light-packing.ts (use a currently-unused slot; offsets +6..+10 are cascade bounds/matrixBaseIndex for directional, but there are free metadata/float slots — verify the PACKED_LIGHT_FLOAT_STRIDE and pick an unused index, mirroring how directionalShadow data is conditionally packed at lines 270-291). In standard-shader-shadow-sampling.ts, replace the baked STANDARD_SHADOW_MIN_VISIBILITY=0.45 and STANDARD_POINT_SHADOW_MIN_VISIBILITY=0.5 consts (lines 10,144,396,508,510) and all 6 mix(MIN_VIS,1.0,visibility) sites (130,227,341,383,612,660) with mix(1.0 - shadowStrength(lightIndex), 1.0, visibility) where shadowStrength reads the packed per-light float (default 1.0 -> full darkness reachable, 0.0 -> no shadow). Add a shadowStrength(lightIndex) WGSL helper alongside directionalShadowCascadeFarBound (lines 22-25). Keep NaN-guards intact.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/materials/standard/standard-shader-shadow-sampling.ts (remove MIN_VISIBILITY consts; rewrite 6 mix sites; add shadowStrength helper)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/lighting/light-packing.ts (pack strength into a light float slot; thread from ShadowRequestPacket via directionalShadows map lines 266-291)`

**Done when:**

- [ ] A new render-control route (or extended csm route) authors a directional shadow with strength=1.0 and the spec asserts the shadowed receiver region luminance drops to within a small epsilon of the fully-occluded floor (much darker than the current ~0.45-clamped result vs baseline)
- [ ] Same route with strength=0.0 produces a frame pixel-identical (within tolerance) to the no-shadow baseline
- [ ] A Vitest WGSL-generation unit asserts the emitted shader no longer contains the literal 0.45 / 0.5 MIN_VISIBILITY constants and instead references a shadowStrength(...) read
- [ ] Existing csm spek expectCsmShadowActivation maxDelta>10 assertion still passes (shadow still visibly changes pixels)

**Study:** /Users/felixz/Projects/aperture/references/bevy/crates/bevy_light/src/cascade.rs

**Watch out:** Picking a float-buffer slot that collides with directional cascade far-bounds (offset+6..+9) or matrixBaseIndex (offset+10) will silently corrupt CSM selection. Audit PACKED_LIGHT_FLOAT_STRIDE first. The multi-shadow shader (applyStandardMultiShadowMapSampling) and single/point shaders each declare their own copies of the const — all must be updated consistently or the variants diverge.

#### `M4-T5` · Thread authored depth bias + slope-scaled pipeline bias + normal-offset bias

`webgpu-render` · effort **M** · depends: M4-T3

Make authored bias/normalBias/slopeBias actually affect sampling and the caster pipeline. (a) Pipeline slope-scaled bias: add depthBias (int) and depthBiasSlopeScale (float) to ShadowCasterPipelineDescriptorMetadata.depthStencil (shadow-caster-pipeline-descriptor.ts lines 51-55, populated lines 236-240) and emit them in createBrowserShadowCasterPipelineDescriptor depthStencil (shadow-caster-pipeline-resource.ts lines 323-327), sourced from the descriptor's depthBias/slopeBias. (b) Shader receiver depth bias: replace the fixed STANDARD_SHADOW_DEPTH_BIAS=0.002 const (sampling lines 11,145,509) used at receiverDepth = clampedShadowDepth - BIAS (lines 114-118,211-215,596-600,644-648) with a per-light authored depthBias read from the packed float buffer (like M4-T4's helper). (c) Normal-offset bias: currently normalBias has ZERO consumers; offset the receiver world position along its surface normal by normalBias*texelWorldSize before the shadow-matrix projection (in sampleDirectionalShadowFactor before line 90 shadowPosition = matrix * worldPosition). Thread normalBias from the packed float buffer; the surface normal is already available in the lit shader.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts (depthStencil metadata lines 51-55,236-240)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts (createBrowserShadowCasterPipelineDescriptor depthStencil lines 323-327)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/materials/standard/standard-shader-shadow-sampling.ts (replace fixed bias consts; add normal-offset to receiver position before projection)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/lighting/light-packing.ts (pack depthBias/normalBias into light floats)`

**Done when:**

- [ ] A render-control route authoring a flat receiver under a grazing-angle directional light shows shadow ACNE (self-shadow stripes) with bias=0/slopeBias=0 and clean shadows with authored bias/slopeBias>0, and the spec asserts the acne-region pixel variance drops below a threshold after bias is applied
- [ ] A Vitest WGSL-generation unit asserts the shader reads a per-light depthBias rather than the literal 0.002 const, and that a normalBias offset term is applied to the receiver position before the shadow matrix multiply
- [ ] A pipeline-descriptor Vitest unit asserts the produced GPU pipeline depthStencil includes depthBias and depthBiasSlopeScale matching the descriptor
- [ ] Peter-panning check: with very large bias the spec asserts the contact shadow detaches (caster base region brightens) — proving bias is live, not dead

**Study:** /Users/felixz/Projects/aperture/references/three.js/src/renderers/webgl/WebGLShadowMap.js

**Watch out:** WebGPU depthBias is in depth-buffer units (depth24plus) and slope scale interacts with the existing 'less-equal' depthCompare; over-biasing causes peter-panning, which the test must distinguish from correct behavior. Normal-offset must use the GEOMETRIC normal in world space and a texel-world-size derived from the cascade extent (mapSize-dependent) or it will be cascade-inconsistent. Do not double-apply bias (pipeline slope bias + shader receiver bias are complementary, keep magnitudes small).

#### `M4-T6` · Cascade blending across CSM split boundaries

`webgpu-render` · effort **M** · depends: M4-T1, M4-T2

Eliminate hard cascade seams. In standard-shader-shadow-sampling.ts cascaded path, change selectDirectionalShadowCascade (lines 32-47) + sampleDirectionalShadowFactor (lines 76-131) so that within a configurable blend band near each cascade's far bound the shader samples BOTH the current and next cascade and lerps between them by the normalized distance into the band (mix(factorN, factorN+1, t)). Reuse the practical far-bounds already packed at lightFloats offset+6 (directionalShadowCascadeFarBound lines 22-25) to compute the band. Refactor the per-cascade sampling into a helper that takes an explicit cascadeIndex so both cascades can be sampled. Skip blending when the next cascade is out of range (return current). Make the blend-band width derive from the cascade overlap (relate to bevy overlap_proportion) so it is stable.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/materials/standard/standard-shader-shadow-sampling.ts (selectDirectionalShadowCascade lines 32-47; sampleDirectionalShadowFactor lines 76-131; extract a sampleSingleCascade(lightIndex,cascadeIndex,worldPosition) helper)`

**Done when:**

- [ ] A render-control route positions a large receiver spanning a cascade boundary and the spec asserts that across the boundary line the luminance gradient is continuous (no step > threshold between adjacent horizontal pixel samples) — vs current behavior where a hard seam step exists
- [ ] A Vitest WGSL-generation unit asserts the cascaded shader contains a mix(...) blending two distinct cascade indices (not a single-cascade return)
- [ ] The csm-directional-shadow spec's existing 4-cascade assertions (cascadeIndex [0,1,2,3], matrixCount 4) still pass
- [ ] Performance guard: blending only doubles taps inside the band; the spec status reports rendering.supported true and no WebGPU validation warnings

**Study:** /Users/felixz/Projects/aperture/references/three.js/docs/pages/module-CSMShader.html.md

**Watch out:** The two blended cascades have DIFFERENT projection matrices and resolutions (post M4-T1), so the blend must sample each cascade with its own matrix/layer and only mix the resulting factors, never the UVs. The blend band must lie inside both cascades' coverage; using disagreeing select vs matrix bounds (the bug M4-T2 fixes) will make the far cascade sample land out of frustum and early-out to 1.0, producing a bright seam instead of smooth — hence the dependency on M4-T2.

#### `M4-T7` · PCSS contact-hardening soft shadows as an authored shadowType

`webgpu-render` · effort **L** · depends: M4-T3, M4-T4

Add a PCSS (percentage-closer soft shadows) path selectable via authored shadowType=2. Add a feature flag (e.g. features.softShadows / shadowFilter) threaded into standard-shader.ts where applyStandardShadowMapSampling is invoked (lines 681-684) and the multi path (674-679), driven by the authored shadowType. In standard-shader-shadow-sampling.ts add a PCSS variant of the directional sampler that: (1) does a blocker search (average occluder depth over a search kernel using textureSampleLevel against a NON-comparison view or via gathering compare results), (2) estimates penumbra width = (receiverDepth - avgBlockerDepth)/avgBlockerDepth \* lightSize, (3) does a variable-radius PCF whose radius = penumbra width, scaled by the authored filterRadius. Also fix the cascaded 3x3 PCF (line 49) to honor filterRadiusTexels like the non-cascaded path (line 147) — currently the cascaded path ignores it. Keep hard (shadowType=0) and fixed-PCF (shadowType=1) paths as cheaper variants.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/materials/standard/standard-shader-shadow-sampling.ts (add PCSS blocker-search + variable-radius PCF; make cascaded sampleDirectionalShadowPcf3x3 honor filterRadiusTexels, line 49)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/materials/standard/standard-shader.ts (thread shadowType->feature flag at the apply* call sites lines 674-688)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/lighting/light-packing.ts (pack filterRadius + shadowType + lightSize into light floats for the shader to branch on)`

**Done when:**

- [ ] A render-control route with a caster floating above a receiver, authored shadowType=2 (PCSS), shows a HARD-edged contact shadow near the caster contact point and a SOFTER/wider penumbra farther from the contact — the spec asserts the shadow-edge transition width measured near the contact is smaller than the width measured far from contact (contact hardening)
- [ ] Switching the same scene to shadowType=1 (fixed PCF) produces a uniform-width penumbra everywhere (spec asserts near-edge width approximately equals far-edge width), distinguishing PCSS from PCF
- [ ] A Vitest WGSL-generation unit asserts the PCSS variant emits a blocker-search loop and a penumbra-width computation, and that the cascaded PCF now multiplies the kernel offset by filterRadiusTexels
- [ ] No WebGPU validation warnings; rendering.supported true in status

**Study:** /Users/felixz/Projects/aperture/references/three.js/src/nodes/lighting (PCSS-style soft shadow node patterns)

**Watch out:** WGSL comparison samplers (textureSampleCompareLevel) cannot directly return raw depth for a blocker search; the blocker search needs either a second non-comparison sampler/view of the same depth texture or a manual compare against multiple taps. This may require a second sampler binding or a depth-as-texture view — verify the shadow-depth-texture-resource binding layout supports it before designing the WGSL. Variable-radius PCF inside a dynamic loop can hit WGSL uniform-control-flow constraints with textureSampleCompareLevel (must use Level, already the case). Keep sample counts bounded to avoid perf cliffs; gate PCSS behind the explicit shadowType so default scenes stay cheap.

#### `M4-T8` · Alpha-tested shadow casters (UV + baseColor + discard) for foliage silhouettes

`webgpu-render` · effort **L** · depends: none

Replace the position-only depth caster with an alpha-test-capable variant. Add an alpha-test pipeline variant in shadow-caster-pipeline-descriptor.ts: when a caster material has alphaMode=MASK (and a baseColor texture), produce a descriptor variant whose vertex.buffers include TEXCOORD_0 (the parser shadowCasterMeshLayoutTokenFormat in shadow-caster-pipeline-resource.ts lines 509-542 already understands TEXCOORD_0) and whose pipeline binds the material baseColor texture+sampler+alphaCutoff. Author a second WGSL string alongside SHADOW_CASTER_DEPTH_ONLY_WGSL (shadow-caster-pipeline-resource.ts lines 26-46): vs_main outputs UV; fs_main samples baseColor.a and `if (a < cutoff) { discard; }`. Select the variant per draw in the caster draw-list/command plan so opaque casters keep the cheap position-only pipeline. Consider switching cullMode for alpha-test casters (foliage is double-sided; cullMode 'none' is already correct, keep). Thread the material's alphaCutoff and baseColor handle through the caster draw packet (MeshDrawPacket already carries material/castsShadow, snapshot-packet-types.ts lines 41,56).

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts (add SHADOW_CASTER_ALPHA_TEST_WGSL; bind baseColor texture/sampler/cutoff; variant pipeline creation around lines 235-264)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts (alpha-test descriptor variant: vertex.buffers add TEXCOORD_0, colorTargets stays [], add alphaTest metadata; createDescriptor lines 206-243)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-draw-list-plan.ts (select alpha-test vs opaque pipeline per draw based on material alphaMode)`

**Done when:**

- [ ] A render-control route with a quad caster using a checkerboard/alpha-cutout baseColor texture, lit by a directional shadow, casts a PERFORATED shadow (holes where alpha<cutoff) on the receiver — the spec asserts both lit and shadowed samples exist within the caster's shadow footprint (proving holes), vs the opaque path which produces a solid rectangle
- [ ] A Vitest WGSL-generation/descriptor unit asserts the alpha-test caster pipeline binds a baseColor texture and its fs_main contains a discard, while the opaque caster pipeline remains empty-fragment position-only
- [ ] An opaque caster in the same scene still uses the position-only pipeline (descriptor pipelineKey differs); spec asserts both pipeline variants coexist without WebGPU validation warnings
- [ ] commandBufferSubmission.status stays 'submitted' and depth pass still produces a valid shadow map (existing csm spec passes)

**Study:** /Users/felixz/Projects/aperture/references/bevy (prepass / alpha-mask shadow caster patterns in bevy_pbr)

**Watch out:** The caster bind group currently has only group(0)=shadow matrices (shadow-caster-matrix-bind-group-resource.ts); an alpha-test variant needs a SECOND bind group for the material baseColor texture+sampler+cutoff, which changes the pipeline layout — must not break the existing position-only pipeline's explicit layout. The vertex stride parser (parseShadowCasterPositionLayout lines 432-501) currently extracts only POSITION; the alpha variant must extract TEXCOORD_0 offset too. Material alphaCutoff/baseColor must reach the shadow pass without the renderer owning material state (read from the snapshot material handle resolution, not a cached mutable material).

#### `M4-T9` · Shadow atlas packer + per-light update policy (static/realtime) scaffold-to-behavior

`webgpu-render` · effort **L** · depends: M4-T3

Turn the inert ShadowAtlasRegion descriptor field into a real packer + update scheduler so multiple shadow-casting lights share a budgeted atlas and static shadows skip re-rendering. Add a deterministic packer that, given N shadow requests with per-light mapSize/priority, assigns non-overlapping ShadowAtlasRegions (shadow-map-descriptor.ts ShadowAtlasRegion lines 26-31; normalizeAtlasRegion already validates bounds lines 257-285) into one or few atlas textures — a simple shelf/quadtree pack is sufficient. Add an authored updateMode per light (extend LightShadowSettings from M4-T3: realtime|once|interval) and a per-frame scheduler that marks which shadow passes need re-encoding this frame; 'once' shadows render on first ready frame then are skipped (the depth texture cache in shadow-depth-texture-resource.ts ShadowDepthTextureResourceCache lines 40-48 already persists, so skipping the caster pass for static lights is the change). Wire the assigned atlasRegion into the pass attachment viewport so multiple lights render into sub-rects of the shared texture.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/ (new shadow-atlas-packer.ts producing ShadowAtlasRegion assignments)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-map-descriptor.ts (consume packer-assigned atlasRegion; lines 144-148,172)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-pass-attachment-descriptor.ts (apply atlasRegion as render-pass viewport/scissor)`
- `/Users/felixz/Projects/aperture/packages/render/src/rendering/authoring-components-camera-light.ts (add updateMode to LightShadowSettings)`

**Done when:**

- [ ] A Vitest packer unit asserts that given 4 lights (mapSize 512) into a 1024x1024 atlas, all 4 get non-overlapping regions that pass normalizeAtlasRegion bounds validation, and a 5th over-budget light is dropped/flagged deterministically
- [ ] A render-control route with two shadow-casting lights renders both shadows from a single atlas texture; the spec asserts both lights' shadows are visible on the receiver and the depthTextureResources status reports one shared atlas texture with 2 sub-regions
- [ ] An 'once' (static) light's caster pass is encoded on the first frame and SKIPPED on subsequent frames — the spec asserts commandEncoding.records count for that light drops to 0 after the first ready frame while its shadow remains visible (served from cache)
- [ ] The multi-light-shadow.spec.ts existing assertions still pass (no regression for the non-atlas path)

**Study:** /Users/felixz/Projects/aperture/references/engine (PlayCanvas clustered lighting + shadow atlas allocation)

**Watch out:** Rendering multiple lights into atlas sub-rects requires viewport/scissor per pass within ONE render pass OR separate passes targeting sub-views; depth24plus does not support arbitrary sub-view rendering the way color does — verify whether the existing shadow-pass-encoder writes full-texture or supports viewport. The 'once' skip must invalidate the cache when the light transform or scene casters change, or static shadows go stale; tie invalidation to a content hash. This task is the largest and most independent — sequence it last and keep it behind the new authoring fields so default single-light scenes are unaffected.

**Sequencing.** M4-T1 (frustum-fit) and M4-T2 (practical splits) are the foundation and should land first; T1 is independent but T6 (cascade blend) and T7 (PCSS, depends on correct cascades) both build on T1+T2. M4-T3 (authoring fields) is independent and unblocks the consumption tasks T4 (strength), T5 (bias), T7 (PCSS shadowType), and T9 (updateMode) — land T3 early and in parallel with T1/T2. T4 (strength floor removal) and T5 (real bias) are independent of each other and of the cascade work — they can parallelize once T3 lands. T8 (alpha-test casters) is fully independent of the CSM-fit work (touches caster pipeline only) and can run anytime in parallel. T9 (atlas/scheduler) is the largest, most isolated, and should land last. Recommended order: T1+T2+T3 (parallel) -> T4,T5,T8 (parallel) -> T6 -> T7 -> T9.

**Proof.** Build every behavior on the EXISTING proof harness rather than new infra: the render-control worker/main routes (examples/csm-directional-shadow.{worker,main}.js + createCsmShadowFrame) already drive the full caster->submit->sample chain and publish JSON-safe status, and test/e2e/csm-directional-shadow.spec.ts already does baseline-vs-shadowed pixel-delta comparison (expectCsmShadowActivation) plus deep status shape matching. For each task add (a) a focused Vitest unit on the pure planning/WGSL-generation function (matrix size invariance, split formula, shader contains/omits specific tokens, packer non-overlap, descriptor depthBias presence) and (b) a render-control route + Playwright pixel assertion: full-darkness (strength=1 luminance floor vs strength=0 baseline-identical), camera-motion stability (no shadow swim across two camera positions via per-cascade ortho-size invariance reported in status + low inter-frame pixel delta in the static-shadow region), cascade-seam continuity (no luminance step across a boundary-spanning receiver), acne/peter-panning (variance drop with bias, contact detach with over-bias), contact-hardening (near-contact edge width < far edge width for PCSS vs uniform for PCF), and perforated alpha-test silhouette (lit+shadowed samples coexist inside the caster footprint). New example routes should follow the single-light-shadow-assets.js / csm-directional-shadow-scene.js pattern and reuse webgpu-status.js helpers (expectStatusJsonSafeForGpu, attachWebGpuValidationConsoleGuard). Gate the whole milestone on: all four existing shadow specs (csm-directional, multi-light, point, spot) still green + the new assertions, with zero WebGPU validation warnings.

**SOTA bar (when to stop).** Good-enough SOTA bar for M4: directional CSM with per-cascade frustum-fit + texel snapping (shadows do not swim under camera motion; resolution scales with frustum slice), practical log/linear split that agrees between selection and projection, smooth cascade blending (no visible seam), authored bias (slope-scaled pipeline + receiver depth bias + normal-offset) that eliminates acne without peter-panning at default tunings, full-darkness-capable shadows with authored strength, PCSS contact-hardening as an opt-in shadowType (hard/PCF/PCSS), and alpha-tested caster silhouettes. This matches three.js CSMShadowNode + bevy's calculate_cascade and is competitive with mainstream real-time engines. STOP SHORT of (defer to later milestones): VSM/ESM moment-based filters, ray-traced shadows, contact shadows via screen-space ray march, and a full LRU/priority atlas eviction policy with cross-frame temporal reprojection — M4-T9 only needs deterministic packing + static/realtime/interval update modes, not a production virtual-shadow-map system. Point/spot shadows should inherit the strength-floor removal and real-bias fixes (T4/T5 touch all variants) but do NOT need their own frustum-fit (spot/point already derive near/far from range per the gap audit) — keep point/spot scope to the shared shader fixes."

---

## M5 — Close core PBR/IBL correctness gaps: split-sum DFG, real irradiance, equirect->cube auto-IBL, HDR scene buffer + exposure, refractive transmission <a id="m5"></a>

**Wave 1** · **Depends on:** none _(soft: M3)_ · 6 tasks (2×L, 3×M, 1×S)

> **Goal.** A single environment HDR can be assigned to a scene and is automatically converted to a filtered cubemap, convolved into a true cosine irradiance map for diffuse IBL, GGX-prefiltered for specular IBL, and combined with a split-sum environment-BRDF (DFG) term so a metal/rough sweep shows physically-correct, energy-conserving reflections instead of the hand-tuned 'iblSpecularProof'. The lit scene is rendered into a persistent rgba16float linear HDR buffer, a user-/auto-driven exposure scalar is applied, and tonemap+sRGB encode run as the final stage over that HDR buffer (so bloom/SSR/DOF operate on linear HDR). Transmission refracts through the grabbed scene with real IOR/thickness/Beer-Lambert attenuation, and SSAO only darkens indirect/ambient/IBL, not direct light. Every term is proven by a render-control example route asserting GPU-readback pixel deltas plus JSON-safe diagnostics, backed by Playwright specs and Vitest unit coverage.

**Current state (verified against source).** Lighting breadth is strong but the core IBL/HDR terms are admitted approximations, confirmed by reading source. (1) Specular IBL: standard-shader-ibl-sampling.ts:39-65 applyStandardSpecularIblProofSampling computes `prefilteredColor * fresnelSchlick(NdotV, F0) * (1.0 - roughness*0.5)` — no DFG/environment-BRDF scale+bias. There is NO brdfLut binding anywhere; the IBL bind group is group-4 metadata (standard-material-ibl-bind-group-layout.ts: diffuseIrradianceTexture/specularPrefilterTexture/iblSampler) but the live shader bindings are group 3, bindings 5(diffuse tex)/6(sampler)/7(specular tex) in standard-shader-variant-bindings.ts:333-361. (2) Diffuse IBL: standard-shader-ibl-sampling.ts:1-37 raw textureSample(...normal); ibl-texture-resource-diffuse.ts uploads 6 faces verbatim with mipLevelCount:1; ibl-preparation-pass-plan.ts only PLANS operation 'irradiance-convolution' and emits iblPreparationPass.submissionDeferred ('GPU submission is not implemented yet', lines 119-126). No real convolution compute pass and no SH. (3) Equirect->cube: absent; validateDiffuseCubeSource/validateSpecularPmremSource (ibl-texture-resource-diffuse.ts:244, ibl-texture-resource-specular.ts:338) require faces.length===6, so a single equirect HDR cannot drive IBL — the user must pre-facet 6 cubes. A real GGX PMREM compute pipeline DOES exist (pmrem-compute-pipeline.ts + ibl-texture-resource-specular.ts dispatch) but roughnessFromMipLevel hardcodes mip/5.0 and always samples source mip 0. (4) Tonemap/HDR: applyOutputTonemapToStandardShader (output-stage-tonemap.ts:118-156) rewrites the standard fragment return and is invoked at pipeline build (standard-pipeline.ts:113); the scene post texture is allocated at options.target.format (8-bit swapchain) in post-processing.ts:72-81. So color is tonemapped+sRGB-encoded BEFORE post runs. No exposure scalar exists anywhere (ViewProjectionUniform in standard-shader-source.ts:12-18 has no exposure; tonemap WGSL fns take only color). No rgba16float scene buffer, no auto-exposure/histogram. (5) Transmission: applyStandardTransmissionSampling (standard-shader-extension-sampling.ts:473-531) is a screen-grab + 8-tap blur with hardcoded offsets (0.045, roughness*0.02, +/-0.08, roughness^2*96px) — no IOR, thickness, attenuationColor/Distance, or Beer-Lambert. StandardMaterialAsset (render types.ts:141-169) has no ior/thickness/attenuation fields. (6) SSAO: post-ssao.ts:561 returns source.rgb\*visibility, darkening direct+emissive too. Proof harness already models this exactly: examples/tonemap-showcase.{main,worker}.js + tonemap-showcase-environment.js build IBL cube faces from loadHdrFromUri, publish JSON status, and the spec asserts GPU-readback highlight-probe pixel deltas across operators.

### Key entry points

| File / symbol                                                                       | Role                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/webgpu/src/materials/standard/standard-shader-ibl-sampling.ts`            | The IBL term injectors. applyStandardDiffuseIblSampling (raw normal lookup) and applyStandardSpecularIblProofSampling (the 'proof' heuristic, lines 39-65). This is where the split-sum DFG term replaces the *(1.0-roughness*0.5) fudge and where a cosine-convolved irradiance lookup replaces the raw cube sample.                                                                                       |
| `packages/webgpu/src/materials/standard/standard-shader-variant-bindings.ts`        | WGSL binding declarations for IBL. Lines 333-361 declare standardDiffuseIblTexture/standardIblSampler/standardSpecularIblTexture on group 3 bindings 5/6/7. A new brdfLut texture binding (e.g. binding 8) is added here, gated on a new iblSpecularBrdf feature flag.                                                                                                                                      |
| `packages/webgpu/src/materials/standard/standard-shader.ts`                         | Assembles shader variants. Lines 691-696 gate iblDiffuse/iblSpecularProof feature flags. New iblSpecularBrdf flag wires the DFG sample here.                                                                                                                                                                                                                                                                |
| `packages/webgpu/src/lighting/pmrem-compute-pipeline.ts`                            | The proven WebGPU compute-pass model: cube-face dispatch over a 2d-array storage texture with Hammersley GGX importance sampling. Copy its STRUCTURE (not code) for (a) a real irradiance-convolution compute pass, (b) a BRDF-LUT integration compute pass, (c) an equirect->cube projection compute pass. Also fix roughnessFromMipLevel (mip/5.0 hardcode, line 287) and source-mip sampling (line 313). |
| `packages/webgpu/src/lighting/ibl-texture-resource-diffuse.ts`                      | Builds the diffuse cube GPU resource. Currently uploads 6 faces verbatim (mipLevelCount:1). The irradiance-convolution dispatch hooks here, analogous to how ibl-texture-resource-specular.ts dispatches PMREM.                                                                                                                                                                                             |
| `packages/webgpu/src/lighting/ibl-texture-resource-specular.ts`                     | Model for compute-dispatch-on-resource-creation (createSpecularIblPmremTextureResource lines 88-315). Reuse this exact pattern for irradiance + BRDF-LUT + equirect passes. Also emits specularProofUploadPlaceholder/specularPrefilteringDeferred diagnostics (524-546) that the new BRDF path should clear.                                                                                               |
| `packages/webgpu/src/lighting/ibl-preparation-pass-plan.ts`                         | The inert plan stage. operation 'irradiance-convolution' (line 211) and submissionDeferred diagnostic (lines 119-126) must flip to executed/ready once the convolution compute pass runs.                                                                                                                                                                                                                   |
| `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts` | IBL bind-group-4 metadata (createStandardMaterialIblBindGroupLayoutMetadata, lines 92-105): diffuseIrradianceTexture/specularPrefilterTexture/iblSampler. Add a brdfLutTexture binding here for the DFG LUT.                                                                                                                                                                                                |
| `packages/webgpu/src/output/output-stage-tonemap.ts`                                | Tonemap operators + applyOutputTonemapToStandardShader (lines 118-156) which bakes tonemap into the material fragment return. Must be refactored into a standalone HDR-buffer post stage that also applies exposure; createOutputTonemapWgsl needs an exposure multiply.                                                                                                                                    |
| `packages/webgpu/src/output/output-stage-color-space.ts`                            | sRGB OETF encode (createOutputColorSpaceWgsl). Pairs with tonemap in the new final HDR->LDR stage.                                                                                                                                                                                                                                                                                                          |
| `packages/webgpu/src/app/post-processing.ts`                                        | Post chain orchestrator. Scene texture allocated at options.target.format (8-bit) on lines 72-81 — must become rgba16float for the HDR buffer; a final tonemap+exposure+encode stage is appended before swapchain.                                                                                                                                                                                          |
| `packages/webgpu/src/post/post-pass.ts`                                             | WebGpuPostEffect contract (prepare()->WebGpuPreparedPostEffectPass) and createOrReuseWebGpuPostPassTexture. Model for implementing a new createWebGpuTonemapPostEffect (exposure+tonemap+encode full-screen pass).                                                                                                                                                                                          |
| `packages/webgpu/src/app/transmission-grab.ts`                                      | The transmission grab pass (already renders non-transmission draws into a scene-color texture). The refraction sampling consuming it lives in standard-shader-extension-sampling.ts; depth attachment is plumbed here for thickness.                                                                                                                                                                        |
| `packages/webgpu/src/materials/standard/standard-shader-extension-sampling.ts`      | applyStandardTransmissionSampling (lines 473-531): the screen-grab refraction hack. IOR-driven refraction vector + thickness + Beer-Lambert replaces the hardcoded normal.xy offset + magic blur.                                                                                                                                                                                                           |
| `packages/render/src/materials/types.ts`                                            | StandardMaterialAsset (lines 141-169). Add ior/thickness/attenuationColor/attenuationDistance fields (KHR_materials_volume/ior) consumed by the new transmission model and packed into StandardMaterialUniform.                                                                                                                                                                                             |
| `packages/webgpu/src/app/app-environment-resources.ts`                              | Auto-wires IBL from environment assets (diffuseSourcesForAsset/specularSourcesForAsset lines 624-668; WebGpuAppEnvironmentAssetInput line 121 with diffuseSource/specularPmremSource). New equirectSource path lands here to auto-derive both cube sources from one HDR.                                                                                                                                    |
| `packages/render/src/assets/hdr-rgbe-loader.ts`                                     | Re-exports parseHdrRgbe/loadHdrFromUri. Decodes equirect HDR float pixels; feeds the new equirect->cube projection pass.                                                                                                                                                                                                                                                                                    |
| `examples/tonemap-showcase.main.js`                                                 | Reference proof route: builds IBL resources, publishes JSON status with extraction/environment/tonemap/readback blocks, GPU readback highlight-probe. The template for new ibl-brdf / hdr-exposure / transmission-ior example routes.                                                                                                                                                                       |
| `test/e2e/tonemap-showcase.spec.ts`                                                 | Reference Playwright spec asserting pixelDistance() between readback samples and JSON status shape. Template for new specs.                                                                                                                                                                                                                                                                                 |

### Tasks

#### `M5-T1` · Split-sum environment-BRDF (DFG) LUT compute pass + bind it into specular IBL

`webgpu-render` · effort **M** · depends: none

Generate a 2-channel (scale,bias) GGX environment-BRDF LUT on the GPU once and sample it in the specular IBL term so reflections obey the split-sum approximation with energy conservation instead of the hand-tuned proof. Create createBrdfLutComputePipeline (model exactly on pmrem-compute-pipeline.ts structure: bind-group-layout + compute pipeline + Hammersley/VNDF helpers already present there) that writes an NxN (default 256, rg16float) storage texture where each texel integrates the GGX BRDF over NdotV (x) and roughness (y), outputting (A,B) = the Karis scale/bias. Create a one-time resource builder createBrdfIntegrationLutResource (model on createSpecularIblPmremTextureResource in ibl-texture-resource-specular.ts: createTexture STORAGE*BINDING|TEXTURE_BINDING, beginComputePass, dispatch, submit, return a TextureGpuResource with a 2d view). Add brdfLutTexture as binding 8 (group 3) in standard-shader-variant-bindings.ts plus a clamp sampler reuse, gated on a new feature flag iblSpecularBrdf. Add applyStandardSpecularIblBrdfSampling in standard-shader-ibl-sampling.ts that replaces the proof term: sample brdfLut at (NdotV, roughness) -> (A,B); specularIbl = prefilteredColor * (F0 \_ A + F90 \* B). Wire the new flag in standard-shader.ts (alongside lines 691-696) so iblSpecularBrdf supersedes iblSpecularProof when the LUT is ready. Add the brdfLutTexture binding to standard-material-ibl-bind-group-layout.ts metadata.

**Touch:**

- `packages/webgpu/src/lighting/brdf-lut-compute-pipeline.ts (new: GGX DFG integration compute shader, model on pmrem-compute-pipeline.ts)`
- `packages/webgpu/src/lighting/brdf-lut-resource.ts (new: one-time dispatch+texture, model on ibl-texture-resource-specular.ts createSpecularIblPmremTextureResource)`
- `packages/webgpu/src/materials/standard/standard-shader-ibl-sampling.ts (add applyStandardSpecularIblBrdfSampling; keep proof as fallback)`
- `packages/webgpu/src/materials/standard/standard-shader-variant-bindings.ts (add brdfLutTexture group3 binding 8 under iblSpecularBrdf)`
- `packages/webgpu/src/materials/standard/standard-shader.ts (gate iblSpecularBrdf near lines 691-696)`
- `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts (add brdfLutTexture binding to metadata)`
- `packages/webgpu/src/materials/standard/standard-shader-features.ts (add iblSpecularBrdf feature + variant key)`

**Done when:**

- [ ] A Vitest unit test renders the BRDF LUT compute shader output (or validates the WGSL integral against known reference points) and asserts the corner values: near NdotV=1,roughness=0 -> A~1,B~0; mid-roughness grazing -> B>0 (Fresnel edge brightening present).
- [ ] A new render-control example route examples/ibl-brdf.{html,main.js,worker.js} renders a metal sphere under a known environment with iblSpecularBrdf enabled and publishes JSON status including environment.brdfLut:{ready:true,size,format} and a grazing-vs-facing GPU readback: pixelDistance(grazingProbe, facingProbe) is greater than a threshold (grazing edge is brighter), proving the B/F90 horizon term, whereas the same scene with the old proof term yields a smaller delta.
- [ ] The pipeline cacheKey in status contains 'iblSpecularBrdf' (not 'iblSpecularProof') when the LUT is bound, asserted by a Playwright spec test/e2e/ibl-brdf.spec.ts.
- [ ] Status is JSON-safe (passes expectStatusJsonSafeForGpu) and the specularDiagnosticCodes array no longer contains iblTextureResource.specularProofUploadPlaceholder for the BRDF path.

**Study:** references/three.js/src/nodes/functions/BSDF/EnvironmentBRDF.js (split-sum specularColor*fab.x + specularF90*fab.y) and src/nodes/functions/BSDF/DFGLUT.js

**Watch out:** The live IBL textures bind on group 3 (bindings 5/6/7 in standard-shader-variant-bindings.ts), NOT the group-4 metadata in standard-material-ibl-bind-group-layout.ts — add binding 8 on group 3 and keep the group-4 metadata in sync only as descriptor metadata. The bind group is built in standard-material-ibl-bind-group.ts; the new LUT view must be threaded there too. Do not break the existing iblSpecularProof variant (tonemap-showcase relies on it) — make iblSpecularBrdf a superseding variant, not a removal. LUT must be linear (rg16float, no sRGB) and sampled clamp-to-edge to avoid wrap artifacts at the LUT borders.

#### `M5-T2` · Real cosine irradiance-convolution compute pass for diffuse IBL

`webgpu-render` · effort **M** · depends: none

Replace the verbatim 6-face diffuse cube upload with a true cosine-weighted hemisphere convolution executed on the GPU, so diffuse IBL is irradiance, not raw radiance sampled by the normal. Create createIrradianceConvolutionComputePipeline (model on pmrem-compute-pipeline.ts: same cube-face dispatch over a 2d-array storage texture, but the kernel integrates incoming radiance over the cosine-weighted hemisphere around the texel's cube direction using a Hammersley sequence and cosine-weighted sampling, producing irradiance/PI). Wire it into ibl-texture-resource-diffuse.ts: when device supports compute (mirror hasSpecularPmremDeviceSupport in ibl-texture-resource-specular.ts), upload the source faces to a temporary cube and dispatch the convolution into the diffuse cube resource (a small target, e.g. 32x32 faces, is sufficient and matches SOTA). Flip ibl-preparation-pass-plan.ts so the 'irradiance-convolution' operation reports submission 'ready'/executed instead of emitting iblPreparationPass.submissionDeferred when the pass runs. Keep applyStandardDiffuseIblSampling sampling by normal (correct once the cube IS irradiance), but optionally divide-by-PI is folded into the convolution.

**Touch:**

- `packages/webgpu/src/lighting/irradiance-convolution-compute-pipeline.ts (new: cosine-hemisphere convolution compute shader)`
- `packages/webgpu/src/lighting/ibl-texture-resource-diffuse.ts (dispatch convolution instead of verbatim upload; add hasIrradianceConvolutionDeviceSupport)`
- `packages/webgpu/src/lighting/ibl-preparation-pass-plan.ts (report convolution executed, clear submissionDeferred for diffuse)`
- `packages/webgpu/src/lighting/ibl-texture-resource-utils.ts (reuse createPaddedCubeFaceUpload / mip helpers)`

**Done when:**

- [ ] A render-control example route examples/ibl-irradiance.{html,main.js,worker.js} loads an environment with a strongly directional bright face (e.g. one face white, rest dark) and renders a fully-rough non-metal sphere; the GPU-readback probe facing the bright direction is brighter than the probe facing a dark direction, but BOTH are softened (the dark-facing probe is non-zero due to hemisphere bleed) — pixelDistance between a convolved-IBL run and a raw-cube-sample run exceeds a threshold, proving convolution occurred.
- [ ] JSON status includes environment.diffuse:{convolved:true,faceSize} and environment.diagnosticCodes does NOT contain iblPreparationPass.submissionDeferred for the diffuse pass.
- [ ] A Vitest unit test asserts the convolution WGSL integrates a constant white environment to a constant irradiance (energy preserved within tolerance) and a single-direction delta environment to a clamped-cosine lobe.
- [ ] A Playwright spec test/e2e/ibl-irradiance.spec.ts asserts the directional-vs-dark probe delta and the convolved:true status flag.

**Study:** references/bevy diffuse irradiance / references/three.js PMREMGenerator irradiance handling; pmrem-compute-pipeline.ts as the dispatch structure model

**Watch out:** Keep the convolution headless/worker-safe: device support must be feature-detected exactly like hasSpecularPmremDeviceSupport (ibl-texture-resource-specular.ts:374-393) so test devices without compute degrade gracefully (fall back to verbatim upload + keep the deferred diagnostic). Do not change the bind-group layout — the diffuse cube stays one texture. Small target face size (16-32) is correct for irradiance; oversizing wastes time. Ensure mipLevelCount stays 1 and the cube view dimension is preserved.

#### `M5-T3` · Equirectangular HDR -> cubemap projection pass; auto-wire single-asset IBL

`render-bridge` · effort **L** · depends: M5-T2

Add an equirect->cube projection compute pass so a single equirectangular HDR (the common environment delivery format from loadHdrFromUri) auto-derives the 6 cube faces feeding both diffuse-convolution and specular-PMREM, removing the requirement that users pre-facet 6 faces. Create createEquirectToCubeComputePipeline (model on pmrem-compute-pipeline.ts: per-cube-face dispatch over a 2d-array storage texture; the kernel maps each output cube direction to equirect UV via atan2/asin lat-long sampling of an input equirect texture). Add an equirectSource option to WebGpuAppEnvironmentAssetInput (app-environment-resources.ts:121) carrying the decoded equirect float/byte data + dimensions. In app-environment-resources.ts, when equirectSource is present and diffuseSource/specularPmremSource are not, run the projection to produce an internal cube, then feed that cube into the existing diffuse (T2) and specular (PMREM) resource builders — i.e. one HDR drives the full chain. Relax the consumers: validateDiffuseCubeSource/validateSpecularPmremSource still require 6 faces (keep), but the projection produces those 6 faces internally so the public surface accepts equirect.

**Touch:**

- `packages/webgpu/src/lighting/equirect-to-cube-compute-pipeline.ts (new: lat-long projection compute shader)`
- `packages/webgpu/src/lighting/equirect-to-cube-resource.ts (new: dispatch equirect->cube, returns the 6 faces or a cube TextureGpuResource)`
- `packages/webgpu/src/app/app-environment-resources.ts (add equirectSource to WebGpuAppEnvironmentAssetInput; derive diffuse/specular sources when equirect provided)`
- `packages/render/src/assets/hdr-rgbe-loader.ts (optionally export a helper to surface equirect dimensions/data for the projection input)`

**Done when:**

- [ ] A render-control example route examples/ibl-equirect.{html,main.js,worker.js} loads a real equirect .hdr via loadHdrFromUri, assigns it as a single equirectSource (no pre-faceted faces), and renders a mirror-metal sphere; JSON status includes environment.source:{loader:'loadHdrFromUri',projection:'equirect-to-cube',faceCount:6} and environment.specularPrefiltering:true, proving the full auto chain ran from one asset.
- [ ] A GPU-readback probe on the reflective sphere matches the expected environment direction color within tolerance (e.g. a known-bright region of the equirect appears in the corresponding reflection probe), with pixelDistance from a flat-clear baseline above threshold.
- [ ] A Vitest unit test asserts the equirect projection WGSL maps the +Z cube-face center direction to equirect UV (0.5, 0.5)-equivalent and that a horizontally-varying equirect produces direction-varying cube faces.
- [ ] A Playwright spec test/e2e/ibl-equirect.spec.ts asserts the projection:'equirect-to-cube' status and the reflective-probe color.

**Study:** references/three.js/src/nodes/utils/EquirectUV.js and src/renderers/shaders/ShaderLib/equirect.glsl.js (equirect<->direction mapping); CubeRenderTarget.fromEquirectangularTexture pattern

**Watch out:** Keep the projection worker/headless-safe with the same compute feature-detection as T2/PMREM; without compute, fall back to requiring pre-faceted faces and emit a clear diagnostic rather than crashing. Cube face orientation must match cubeDirection() conventions already used in pmrem-compute-pipeline.ts (lines 220-243) or reflections will be mirrored/rotated — reuse that exact face mapping. Equirect seam at the +/-Z wrap and pole singularities need clamped sampling. Do NOT introduce a public mutable scene graph — equirectSource is a typed asset input; the derived cube stays renderer-owned.

#### `M5-T4` · Persistent rgba16float HDR scene buffer; move tonemap+exposure+encode to a final post stage

`webgpu-render` · effort **L** · depends: none

Stop baking tonemap+sRGB into the material fragment (8-bit) and instead render the lit scene into a persistent rgba16float linear HDR buffer, then apply exposure + tonemap + sRGB-encode as the final full-screen stage over that HDR buffer so all intermediate post (bloom/SSR/DOF) sees linear HDR. (1) Allocate the scene post texture as rgba16float (post-processing.ts:72-81 currently uses options.target.format) and route the lit pass into it. (2) Add an exposure scalar: extend ViewProjectionUniform (standard-shader-source.ts:12-18) OR pass exposure as a tonemap-stage uniform; add exposure to createTonemapWgsl (output-stage-tonemap.ts) as `color * exposure` before the operator. (3) Implement createWebGpuTonemapPostEffect (model on the WebGpuPostEffect contract in post-pass.ts) that samples the HDR buffer, applies exposure+tonemap+encode, and writes to the swapchain (LDR 8-bit) as the last stage. (4) Gate applyOutputTonemapToStandardShader (standard-pipeline.ts:113) so the material fragment NO LONGER tonemaps when the HDR-buffer path is active (return linear HDR color instead). Surface an `exposure` option on CreateWebGpuAppOptions (app.ts:457-474) and WebGpuApp. NOTE: this pairs with M3 (render graph) — coordinate the scene-target format and final-stage ordering with the render-graph work; if M3 lands first, register the tonemap stage as a graph node, otherwise append it in post-processing.ts.

**Touch:**

- `packages/webgpu/src/app/post-processing.ts (allocate scene texture rgba16float; append final tonemap stage)`
- `packages/webgpu/src/post/post-tonemap.ts (new: createWebGpuTonemapPostEffect with exposure+tonemap+encode)`
- `packages/webgpu/src/output/output-stage-tonemap.ts (add exposure multiply to createOutputTonemapWgsl; refactor applyOutputTonemapToStandardShader to be opt-out)`
- `packages/webgpu/src/materials/standard/standard-pipeline.ts (skip in-material tonemap when HDR buffer path active, line 113)`
- `packages/webgpu/src/app/app.ts (add exposure option on CreateWebGpuAppOptions + WebGpuApp, lines 457-474)`
- `packages/webgpu/src/materials/standard/standard-shader-source.ts (optional: exposure field if threaded via view uniform)`

**Done when:**

- [ ] A render-control example route examples/hdr-exposure.{html,main.js,worker.js} renders a scene with a bright (HDR > 1.0) highlight into the rgba16float buffer and sweeps exposure (e.g. 0.25, 1.0, 4.0); GPU-readback of the highlight probe shows monotonic brightening with exposure AND a mid-gray probe shows the expected exposure response — pixelDistance(exposure=0.25, exposure=4.0) exceeds a large threshold, proving exposure is applied over HDR not clamped 8-bit.
- [ ] JSON status includes output:{sceneBufferFormat:'rgba16float',tonemapStage:'post',exposure:<value>} and the pipeline cacheKey for the material no longer contains 'tonemap:' when the HDR path is active.
- [ ] An existing-behavior regression check: tonemap-showcase still switches operators with the expected per-operator pixel deltas (operators now applied in the post stage), proven by the updated tonemap-showcase spec OR a port of it.
- [ ] A Vitest unit test asserts createOutputTonemapWgsl emits a `* exposure` term and that exposure=0 yields black, exposure=1 is identity pre-operator.

**Study:** references/three.js/src/nodes/display/ToneMappingNode.js (toneMappingExposure applied before operator over linear HDR)

**Watch out:** This touches the hottest path. The scene buffer becoming rgba16float means every post effect and the readback path (gpu-readback.ts / FrameBoundaryReadbackSampleRequest) must handle 16-float intermediates while the final swapchain stays 8-bit; readback samples in existing specs assume LDR — keep the FINAL stage output at the swapchain format so readback semantics are preserved. Bloom's hard min(...,1.0) clamp (post-bloom.ts:873) will now clip HDR energy — out of M5 scope but note it; do not silently re-clamp the HDR buffer. Coordinate explicitly with M3: the gap dump flags the scene target + pass ordering as render-graph concerns. Ensure tonemap is applied exactly once (remove the in-material path when the post stage is active) to avoid double-encode.

#### `M5-T5` · Refractive transmission: IOR-driven refraction + thickness + Beer-Lambert attenuation

`render-bridge` · effort **M** · depends: M5-T4

Replace the screen-grab + magic-blur transmission hack with a physically-grounded refraction model. (1) Add material fields ior, thickness, attenuationColor, attenuationDistance to StandardMaterialAsset (render types.ts:141-169) and parse KHR_materials_volume/KHR_materials_ior in gltf-material-extensions.ts; pack them into StandardMaterialUniform (standard-shader-source.ts struct + standard-material-buffer.ts). (2) Rewrite applyStandardTransmissionSampling (standard-shader-extension-sampling.ts:473-531): compute a refraction vector via refract(-viewDir, normal, 1.0/ior), project the thickness-scaled refracted ray to a screen offset (using the grabbed scene-color buffer from transmission-grab.ts), and apply Beer-Lambert attenuation exp(-attenuationCoeff * thickness) using attenuationColor/attenuationDistance instead of the hardcoded normal.xy offset and roughness^2*96px blur. Roughness still drives a mip/blur read but scaled physically (LOD from roughness), not a magic constant. (3) The transmission buffer is now linear HDR (from T4) so the refracted color is energy-correct.

**Touch:**

- `packages/render/src/materials/types.ts (add ior/thickness/attenuationColor/attenuationDistance to StandardMaterialAsset)`
- `packages/render/src/materials/factories.ts (defaults: ior=1.5, thickness=0, attenuationDistance=Infinity/large)`
- `packages/render/src/materials/gltf-material-extensions.ts (parse KHR_materials_volume + KHR_materials_ior)`
- `packages/webgpu/src/materials/standard/standard-shader-extension-sampling.ts (rewrite applyStandardTransmissionSampling: refract + thickness + Beer-Lambert)`
- `packages/webgpu/src/materials/standard/standard-shader-source.ts (add ior/thickness/attenuation to StandardMaterialUniform)`
- `packages/webgpu/src/materials/standard/standard-material-buffer.ts (pack new scalars)`

**Done when:**

- [ ] The existing transmission example (examples/transmission.worker.js + transmission.main.js) is extended (or a new examples/transmission-ior route added) to render glass spheres at ior=1.0 vs ior=1.5 vs ior=2.0 with a textured background; GPU-readback probes behind the sphere show the refracted background SHIFTING with ior (pixelDistance(ior=1.0, ior=2.0) exceeds a threshold), proving real refraction rather than a fixed normal.xy offset.
- [ ] A thickness/attenuation probe: a thick colored-attenuation sphere tints the transmitted background toward attenuationColor more than a thin one — GPU-readback delta proves Beer-Lambert (thickness=0 -> no tint; thickness large -> attenuationColor dominates).
- [ ] JSON status includes material.transmission:{ior,thickness,attenuationColor,attenuationDistance} and extraction reports the parsed KHR_materials_volume/ior values for a glTF asset.
- [ ] A Vitest unit test asserts gltf-material-extensions.ts parses KHR_materials_ior.ior and KHR_materials_volume.thicknessFactor/attenuationColor/attenuationDistance into the StandardMaterialAsset with correct defaults (ior=1.5 when absent).
- [ ] A Playwright spec test/e2e/transmission-ior.spec.ts asserts the ior-shift and thickness-tint probe deltas.

**Study:** references/three.js MeshPhysicalMaterial transmission/volume (PhysicalLightingModel.js + transmission/IOR handling); glTF KHR_materials_volume & KHR_materials_ior spec

**Watch out:** Transmission draws are excluded from the grab pass (transmission-grab.ts commandsWithoutTransmissionDraws) — preserve that ordering so refraction reads the opaque scene. The refract() vector projected to screen space is still an approximation (no true volumetric path), but it must be ior-responsive — verify the screen offset scales with (ior-1) and thickness. Beer-Lambert needs attenuationDistance>0 guarding (avoid divide-by-zero; treat absent/Infinite as no attenuation). Depends on T4 so the grabbed buffer is linear HDR; if T4 not yet merged, the refracted color will be tonemapped (acceptable interim but note it). Adding uniform fields shifts StandardMaterialUniform layout — update std140/wgsl struct + buffer packing together or bindings silently corrupt.

#### `M5-T6` · SSAO applies to indirect/ambient/IBL only, not direct light

`webgpu-render` · effort **S** · depends: none

Stop SSAO from darkening direct lighting and emissive. Currently post-ssao.ts:561 returns source.rgb \* visibility over the whole composited color. The correct behavior is to attenuate only the indirect/ambient/IBL contribution. Two acceptable approaches: (A) have the standard shader output indirect (ambient+diffuseIbl+specularIbl) into a separate channel/attachment so SSAO multiplies only that, or (B) the simpler, SOTA-acceptable approach for a forward renderer: multiply screen-space AO into the IBL/ambient terms in-shader using a sampled SSAO texture (bind the AO result as an input) so direct lighting is untouched. Given the forward architecture and the existing texture-AO occlusion plumbing in standard-shader-source.ts (occlusion already multiplies ambient on line ~695), the cleanest slice is (B): produce the SSAO visibility texture as today, then bind it into the standard shader and fold it into the ambient/IBL occlusion factor (combine with the existing occlusionTexture term) rather than post-multiplying the final image. Keep the SSAO pass producing visibility; change its consumption.

**Touch:**

- `packages/webgpu/src/post/post-ssao.ts (stop final-color multiply at line 561; output visibility for consumption)`
- `packages/webgpu/src/materials/standard/standard-shader-source.ts (fold sampled SSAO into ambient+IBL occlusion, NOT direct — near the ambient/occlusion application ~line 695)`
- `packages/webgpu/src/materials/standard/standard-shader-ibl-sampling.ts (multiply diffuseIbl/specularIbl by AO occlusion)`
- `packages/webgpu/src/materials/standard/standard-shader-variant-bindings.ts (bind SSAO visibility texture if approach B requires a new binding)`

**Done when:**

- [ ] A render-control example route examples/ssao-indirect.{html,main.js,worker.js} (or extend examples/ssao) renders a creased surface lit by ONE strong direct light plus ambient/IBL; with SSAO on, the crease GPU-readback probe darkens relative to a flat probe, BUT a probe in a region dominated by direct light shows negligible darkening compared to SSAO-off — pixelDistance(direct-lit probe, ssao-off vs ssao-on) is below a small threshold while pixelDistance(crease probe) exceeds a larger threshold, proving direct light is preserved.
- [ ] JSON status includes ssao:{appliesTo:'indirect'} and the existing ssao spec still proves the crease darkening.
- [ ] A Playwright spec (extend test/e2e/ssao.spec.ts) asserts the direct-light-preserved probe and the indirect-darkened probe deltas.
- [ ] No regression in the existing post-effects chain: bloom/DOF/FXAA composition still passes their specs.

**Study:** references/bevy SSAO applied to ambient/diffuse-indirect only; references/engine (PlayCanvas) AO-to-ambient application

**Watch out:** If approach B is chosen, the SSAO texture must be available to the FORWARD lit pass, which means SSAO is computed from a depth/normal prepass BEFORE the lit pass — the current architecture runs SSAO as a screen-space POST effect AFTER the lit pass, so feeding it back into shading requires either a depth-prepass (larger, M3-ish) or accepting one-frame-latency AO. The pragmatic in-scope slice: keep SSAO as post but split the lit output so AO multiplies only the indirect channel (approach A via an additional color target) — verify the additional attachment does not break MSAA/motion-vector attachment logic in post-processing.ts. Whichever path, the invariant is: direct + emissive must be untouched by AO. Do not regress the existing single-channel ssao example beyond the documented behavior change.

**Sequencing.** T1 (DFG LUT), T2 (irradiance convolution), T4 (HDR buffer + exposure), and T6 (SSAO) are independent and can run in parallel — each is a self-contained vertical slice with its own example route. T3 (equirect->cube) depends on T2 because the projected cube must feed the convolution to prove the full single-asset auto chain. T5 (refractive transmission) depends on T4 so the grabbed scene color it refracts is the linear HDR buffer (correct energy); T5 can begin in parallel and rebase once T4's buffer lands. Recommended order: start T1+T2+T4+T6 together; land T2 then T3; land T4 then T5. T4 explicitly pairs with M3 (render graph) — coordinate scene-target format and final-stage ordering; if M3 is in flight, register the tonemap stage as a graph node rather than appending in post-processing.ts.

**Proof.** Each task ships a dedicated render-control example route (examples/<name>.{html,worker.js,main.js}) modeled exactly on examples/tonemap-showcase.{main,worker}.js + tonemap-showcase-environment.js: build the GPU resources, publish a JSON-safe status object (passing expectStatusJsonSafeForGpu) carrying extraction/environment/output/material diagnostics, and expose GPU-readback pixel probes via FrameBoundaryReadbackSampleRequest. A matching Playwright spec under test/e2e/ (modeled on tonemap-showcase.spec.ts, using pixelDistance from test/e2e/png.js) asserts the load-bearing pixel deltas: T1 grazing-vs-facing specular brightening + 'iblSpecularBrdf' in cacheKey; T2 directional-vs-dark irradiance softening + convolved:true; T3 reflective-probe matches projected equirect direction + projection:'equirect-to-cube'; T4 monotonic exposure response over HDR + sceneBufferFormat:'rgba16float'; T5 ior-shift + thickness-tint of refracted background; T6 direct-light preserved while creases darken. WGSL math (DFG integral corners, cosine convolution energy conservation, equirect UV mapping, exposure term, KHR_materials_ior/volume parsing) is covered by Vitest unit tests under test/\*\*. The existing tonemap-showcase, transmission, ssao, post-effects, and post-pass specs are run as regression guards (especially after T4 moves tonemap to a post stage and T6 changes SSAO application).

**SOTA bar (when to stop).** 'Good enough' for this milestone is glTF/three.js parity on the standard PBR path, NOT a research renderer. Stop at: a 2-channel GGX DFG LUT (256x256 rg16float is plenty; an analytic Karis DFGApprox is an acceptable LUT-free alternative if the LUT proves flaky) — multi-scatter energy compensation is OUT of scope. Irradiance via brute-force cosine convolution at 16-32px faces is sufficient; SH9 projection is a nice-to-have, not required. Equirect->cube + the existing PMREM is the auto-IBL bar; reflection probes / parallax correction / DDGI are explicitly out (separate milestone). HDR buffer at rgba16float with a single exposure scalar applied in a post tonemap stage is the bar; auto-exposure/histogram eye-adaptation is a follow-up (the scalar plumbing here is the prerequisite). Refractive transmission only needs ior-responsive screen-space refraction + thickness + Beer-Lambert (matching glTF KHR_materials_volume on a screen-space approximation) — true volumetric path tracing and dispersion are out. SSAO-to-indirect-only is a correctness fix, not a GTAO upgrade (bent normals/HBAO+ are out). The line to hold: every term must be physically motivated and provable by a pixel delta, but breadth (probes, SSGI, auto-exposure, multi-scatter) is deferred.

---

## M3 — A real render graph: named passes, declared resource dependencies, user-insertable render/compute nodes, single-encoder batching <a id="m3"></a>

**Wave 2** · **Depends on:** none _(soft: M1)_ · 7 tasks (3×L, 4×M, 0×S)

> **Goal.** After this milestone, an Aperture frame is assembled as a declarative FrameGraph: a list of named PassNodes (render AND compute) that declare read/write resource handles (transient color/depth/history textures plus the swapchain), are topologically ordered into a single GPUCommandEncoder, and have their colorLoadOp/depthLoadOp/storeOp inferred globally from a renderTargetMap-style dependency scan. Every current route (sprite-only, custom-WGSL, mixed-custom, queued-built-in, single-built-in), the 6-phase diagnostics, render-bundle caching, redundant-state elision, occlusion-query feedback, MSAA resolve, motion-vector history, and the full post stack (bloom/DOF/FXAA/SSAO/SSR/TAA) run unchanged through the graph and produce byte-identical reports — but the frame now submits ONE command buffer instead of N+1. A user can call app.addRenderPass(node) / app.addComputePass(node) to inject a depth-tested geometry pass or a compute dispatch that reads scene G-buffers/history and writes a graph resource, proven by a new render-control example asserting pixels + JSON-safe status.

**Current state (verified against source).** Confirmed against source: there is no FrameGraph/PassNode/renderTargetMap anywhere in packages/webgpu/src. The frame is an if/else dispatcher: renderWebGpuAppFrame in frame-loop.ts (994 lines) picks one of 5 routes by inspecting material kind/snapshot shape (renderSpriteOnlyWebGpuAppFrame, renderMixedCustomWgslWebGpuAppFrame, renderCustomWgslWebGpuAppFrame, renderQueuedBuiltInWebGpuAppFrame, and the inline single-built-in path at lines 529-952). Pass order is imperative: frame-loop.ts:847-850 concatenates sprite commands into the opaque command list; view-commands.ts writeCommandsForView merges skybox prefixCommands + opaque draws into ONE target array; shadows submit via their own path (shadows/shadow-pass-command-buffer-submission-report.ts, submission defaults to "deferred" in shadow-pass-plan.ts). The single GPU-execution primitive is assembleFrameBoundary (render/frame/frame-boundary.ts:287) which creates a fresh encoder (createCommandEncoderResource, line 333), begins ONE render pass, executes a flat RenderPassCommand[] list (render-pass-command-executor.ts, with render-bundle caching + redundant-state elision already inside it), ends, finishes, and submits a single-element array (submitCommandBuffers, lines 414-420). It is called 9 times across the tree: post-processing.ts (scene/motion/effect/graph-pass at 158/212/347/504/516), frame-boundaries.ts:419 (per render target), transmission-grab.ts:146, picking-frame.ts:318, frame-execution-report.ts:272. So a scene + N effects + extra targets = N+1+ separate encoders and submit() calls. Load/store inference exists but is LOCAL: frame-boundaries.ts builds submittedTargetCounts (line 153) and computes loadExistingTarget = previousTargetSubmissions > 0 per-target (lines 261-274); depth always clears on first submission. Transient post textures are fixed cached slots (resource-cache.ts WebGpuAppPostPassCache: scene/ping/pong/motionVector/transmissionGrab) chosen by (effectIndex+frame)%2 — no lifetime aliasing. Compute is not a frame node (RenderPassCommand union has no compute kind; only offline IBL/PMREM/shadow-depth-probe use beginComputePass). History buffers are hand-threaded (previousViewProjectionByViewId, previousWorldTransformsByRenderId in postPasses cache). The only user extension point is WebGpuPostEffect.prepare() (post-pass.ts:120-129) over screen-space textures; postEffects is readonly on the app (app.ts:447/473) and not even surfaced by createApertureApp. NOTABLE: PlayCanvas references/engine/src/scene/frame-graph.js is the near-exact SOTA target — it owns the renderTargetMap, does compile-time store-on-no-clear inference, pass merging via \_skipStart/\_skipEnd, and beforePasses/afterPasses for user insertion; FramePass/RenderPass (frame-pass.js, render-pass.js) is the node base with explicit ColorAttachmentOps/DepthStencilAttachmentOps load/store/resolve. three.js PassNode (\_previousTextures/getPreviousTexture, src/nodes/display/PassNode.js:610) is the SOTA history-resource model.

### Key entry points

| File / symbol                                                                               | Role                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/app/frame-loop.ts`                     | The 994-line route dispatcher (renderWebGpuAppFrame). The 5 route branches (211/362/406/497/529-952) and the command-concatenation at 847-850 are what the graph builder replaces as the single frame entry point.                                                                      |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/render/frame/frame-boundary.ts`        | assembleFrameBoundary (line 287): the ONE place that creates an encoder, begins/ends a render pass, finishes and submits. Must be refactored so it can encode INTO a shared encoder without finishing/submitting — this is the keystone single-encoder change.                          |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/app/frame-boundaries.ts`               | Multi-target loop (assembleWebGpuAppFrameBoundaries). Owns submittedTargetCounts local load/store inference (153,261-274), MSAA resolve, occlusion-query feedback, render-bundle keys, per-target boundary at 419. The graph compiler subsumes this loop's ordering + load/store logic. |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/app/post-processing.ts`                | Post-effect orchestrator. 5 assembleFrameBoundary calls (158/212/347/504/516) for scene/motion/effect/graph-pass. Each becomes a render PassNode; the ping/pong slot heuristic (254-257) becomes graph transient resources.                                                             |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/post/post-pass.ts`                     | WebGpuPostEffect.prepare() contract (120-129) — today's only user hook. The new addRenderPass/addComputePass API generalizes this; PassNode read/write declarations replace requiresMotionVectors/requiresDepthTexture booleans.                                                        |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/render/passes/render-pass-commands.ts` | RenderPassCommand union (119-129) — draw-level commands executed inside a pass. Needs a sibling ComputePassCommand union (setComputePipeline/setBindGroup/dispatchWorkgroups) for first-class compute nodes.                                                                            |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/gpu/command-encoder.ts`                | createCommandEncoderResource — the per-frame encoder factory. The graph executor calls this ONCE per frame instead of per boundary.                                                                                                                                                     |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/render/queues/queue-submit.ts`         | submitCommandBuffers — invoked once per frame after the graph finishes its single encoder, accepting the multi-element array (it already supports arrays).                                                                                                                              |
| `/Users/felixz/Projects/aperture/packages/webgpu/src/app/resource-cache.ts`                 | WebGpuAppResourceCache.postPasses (147-161) holds the transient slots + hand-managed history maps. New graph transient-resource pool + history-resource lifecycle live here.                                                                                                            |
| `/Users/felixz/Projects/aperture/references/engine/src/scene/frame-graph.js`                | SOTA reference to STUDY: renderTargetMap, compile() store-on-no-clear inference, pass merging, addRenderPass + beforePasses/afterPasses. Mirror its semantics, do not copy.                                                                                                             |
| `/Users/felixz/Projects/aperture/references/three.js/src/nodes/display/PassNode.js`         | SOTA reference to STUDY: \_previousTextures/getPreviousTexture history-resource model (610-686) for multi-frame graph resources (TAA history).                                                                                                                                          |
| `/Users/felixz/Projects/aperture/scripts/render-control.mjs`                                | Proof harness: status/pixels/screenshot/scenario commands read globalThis.**APERTURE_EXAMPLE_STATUS**. New graph examples publish JSON-safe graph reports asserted here and in E2E specs.                                                                                               |

### Tasks

#### `M3-T1` · Scaffold FrameGraph types: PassNode (render|compute), resource handles, and a JSON-safe compile report

`webgpu-render` · effort **M** · depends: none

Create the pure, headless-safe graph data model with NO GPU side effects. Define ResourceHandle (a stable id + descriptor: kind 'color-texture'|'depth-texture'|'history-texture'|'swapchain'|'buffer', width/height/format/sampleCount, transient vs persistent vs imported, history double-buffer flag). Define PassNode as a union: RenderPassNode { name, kind:'render', reads: ResourceHandle[], writes: ResourceHandle[] (with per-write attachment intent clear|load + clearColor/clearDepth), commands: RenderPassCommand[], viewport/scissor, enabled } and ComputePassNode { name, kind:'compute', reads, writes, commands: ComputePassCommand[], enabled }. Define FrameGraph { addRenderPass, addComputePass, declareTransient, declareHistory, importSwapchain, importDepth, reset } accumulating nodes + a renderTargetMap-keyed handle map (mirror references/engine/src/scene/frame-graph.js renderTargetMap and references/three.js PassNode \_previousTextures semantics — study, do not copy). Build compileFrameGraph(graph): a PURE function returning a deterministic CompiledFrameGraph { orderedNodes, perNodeLoadStoreOps, aliasing assignments, diagnostics } via topological sort over read/write edges + a global renderTargetMap store-on-no-clear pass (replicating references/engine frame-graph.js compile()). Emit a FrameGraphCompileReportJsonValue { nodeCount, edgeCount, order: name[], passes: { name, kind, reads, writes, colorLoadOp, depthLoadOp, storeOps, aliasedFrom }[], cycles, diagnostics } usable from render-control status. Add a sibling ComputePassCommand union (setComputePipeline/setComputeBindGroup/dispatchWorkgroups/dispatchWorkgroupsIndirect) next to render-pass-commands.ts. Export from packages/webgpu/src/index.ts and test-support.ts.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/render/graph/frame-graph.ts (new: FrameGraph builder + handle/PassNode types)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/render/graph/frame-graph-compile.ts (new: pure topo-sort + renderTargetMap load/store inference + report)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/render/passes/compute-pass-commands.ts (new: ComputePassCommand union mirroring render-pass-commands.ts)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/index.ts (export graph barrel)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/test-support.ts (export graph types for vitest)`

**Done when:**

- [ ] A vitest unit test (test/webgpu/frame-graph-compile.test.ts) builds a graph of {shadow->opaque->bloom-down->bloom-up->composite->swapchain}, calls compileFrameGraph, and asserts orderedNodes match the declared dependency order
- [ ] compileFrameGraph infers colorLoadOp 'load' (not 'clear') for the second write to a shared handle and sets storeOp 'store' on the producing node when a later node reads it without clearing — asserted byte-for-byte against an expected report object (mirrors references/engine frame-graph.js \_compilePasses)
- [ ] A declared cycle produces a diagnostic with code 'frameGraph.cyclicDependency' and compile returns ok:false with empty orderedNodes (no throw)
- [ ] FrameGraphCompileReportJsonValue round-trips through JSON.stringify with no functions/GPU handles (JSON-safe), verified by a test asserting JSON.parse(JSON.stringify(report)) deep-equals report
- [ ] compileFrameGraph is a pure function: calling it twice on the same graph yields deep-equal reports, and it runs with no WebGPU device present (headless-safe)

**Study:** /Users/felixz/Projects/aperture/references/engine/src/scene/frame-graph.js

**Watch out:** Keep this layer 100% GPU-free and synchronous so it stays worker/headless-safe (an architectural invariant). Do NOT import device/encoder types here. The handle id scheme must be stable across frames so history/aliasing decisions are deterministic for golden-file tests. Resist over-generalizing buffers in v1 — color/depth/history/swapchain textures are the load-bearing cases.

#### `M3-T2` · Single-encoder graph executor: encode all ordered nodes into ONE GPUCommandEncoder, submit once

`webgpu-render` · effort **M** · depends: M3-T1

Build executeFrameGraph(device, queue, compiled, resources) that creates exactly ONE encoder via createCommandEncoderResource (gpu/command-encoder.ts), walks compiled.orderedNodes, and for each render node begins a render pass with the compiled load/store ops + resolves the node's write handles to concrete texture views, executes its RenderPassCommand[] through the EXISTING render-pass-command-executor.ts (preserving render-bundle caching + redundant-state elision verbatim), ends the pass; for each compute node begins a compute pass and runs ComputePassCommand[]; then finishes the encoder ONCE and calls submitCommandBuffers with a single-element array. To do this without rewriting all 9 call sites at once, REFACTOR frame-boundary.ts: split assembleFrameBoundary into (a) encodeFrameBoundaryInto(encoder, options) that does begin->execute->end on a CALLER-PROVIDED encoder (no create/finish/submit), and (b) keep the existing assembleFrameBoundary as a thin wrapper that creates+finishes+submits around encodeFrameBoundaryInto so ALL existing tests (test/webgpu/frame-boundary.test.ts asserts events ['begin','draw','end','finish','submit:1']) still pass unchanged. The executor uses encodeFrameBoundaryInto. Preserve per-pass GPU timing, occlusion-query resolve, and readback copy by threading them as node attributes encoded into the shared encoder before finish.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/render/graph/frame-graph-execute.ts (new: one-encoder walk + submit-once)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/render/frame/frame-boundary.ts (refactor: extract encodeFrameBoundaryInto; assembleFrameBoundary becomes wrapper)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/render/passes/render-pass-command-executor.ts (reuse as-is for bundle caching/elision)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/gpu/command-submission-metrics.ts (extend to count multi-pass single-buffer frames)`

**Done when:**

- [ ] A vitest test (test/webgpu/frame-graph-execute.test.ts) with a fake device records the event order for a 3-render-node + 1-compute-node graph and asserts a SINGLE createCommandEncoder, a SINGLE finish, and a SINGLE submit with all passes' begin/draw/dispatch/end interleaved in compiled order
- [ ] The existing test/webgpu/frame-boundary.test.ts passes UNCHANGED (assembleFrameBoundary still emits ['begin','draw','end','finish','submit:1']), proving the wrapper preserves the legacy single-pass path
- [ ] CommandSubmissionMetricsReport.counts.commandBuffers === 1 and submittedCommandBuffers === 1 for a multi-pass frame; executedCommands/drawCalls sum across all nodes
- [ ] Compute node path executes setComputePipeline+dispatchWorkgroups against the fake device with a recorded 'beginComputePass'/'dispatchWorkgroups'/'end' sequence inside the same encoder

**Study:** /Users/felixz/Projects/aperture/references/engine/src/platform/graphics/render-pass.js

**Watch out:** WebGPU forbids beginning a new pass while one is open — the executor MUST end each pass before beginning the next on the shared encoder. Readback copyTextureToBuffer must be encoded AFTER the producing pass ends but BEFORE finish. Do not break the occlusion-query resolve ordering (resolveQuerySet must run outside any render pass). The wrapper-preserves-legacy invariant is the safety net for the whole migration — get it green before touching any route.

#### `M3-T3` · Port the post stack to graph nodes behind a flag; prove byte-identical post reports + fewer submits

`webgpu-render` · effort **L** · depends: M3-T2

Convert assembleWebGpuAppPostProcessedSwapchainTarget (post-processing.ts) to BUILD a FrameGraph instead of calling assembleFrameBoundary 5x: scene node (writes transient scene-color + optional motion-vector handle, depth load/clear inferred), optional motion-vector clear node, one render node per WebGpuPostEffect (input=prior write handle, output=ping/pong transient or swapchain), and expand each prepared sub-graph pass (downsample/upsample/composite) into its own graph node. Map the (effectIndex+frame)%2 ping/pong heuristic onto declareTransient handles so the compiler's aliasing replaces the fixed scene/ping/pong slots in resource-cache.ts WebGpuAppPostPassCache. Gate behind a per-app boolean useFrameGraph (default false in v1) threaded from frame-boundaries.ts so the legacy path stays the fallback. The graph path must reproduce WebGpuAppPostEffectSubmissionReport[] (effectId/label/viewId/input/output/ok/drawCalls/graph) and WebGpuAppRenderTargetSubmissionReport identically. Run the existing examples/dof and examples/post-effects through the graph path under the flag.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/post-processing.ts (build graph; emit identical postEffects/renderTarget reports)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/frame-boundaries.ts (thread useFrameGraph; route post target through executeFrameGraph)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/resource-cache.ts (transient texture pool keyed by graph handle, replacing fixed ping/pong slots)`
- `/Users/felixz/Projects/aperture/examples/dof.worker.js (opt into useFrameGraph for proof)`

**Done when:**

- [ ] test/e2e/dof.spec.ts passes with the graph flag ON: status still matches { dof: { ok:true, postEffects:[{effectId:'dof',output:'swapchain',ok:true}] } } and the 512x512 dof canvas screenshot is produced
- [ ] A new render-control/vitest proof asserts that under the graph path a scene+bloom(down/up/composite) frame submits exactly ONE command buffer (CommandSubmissionMetricsReport.commandBuffers===1) vs the legacy path's >=4 — measured via the fake-device event recorder
- [ ] WebGpuAppPostEffectSubmissionReport[] from the graph path is deep-equal to the legacy path's for the post-effects example (golden comparison in a vitest test feeding the same prepared effects through both paths)
- [ ] examples/post-effects FXAA+bloom toggle still produces correct pixels via render-control pixels assertion at the published readback grid points
- [ ] webgpu validation console guard reports no warnings (attachWebGpuValidationConsoleGuard) for the graph-path dof run

**Study:** /Users/felixz/Projects/aperture/packages/webgpu/src/app/post-processing.ts

**Watch out:** The motion-vector attachment is sometimes a SECOND color target on the scene pass (useSceneMotionVectorAttachment) and sometimes a separate clear pass — both must map to graph writes or TAA breaks. The last-effect-to-swapchain detection (isLast) becomes 'write handle == swapchain handle'; getting this wrong double-renders or drops the final blit. Readback must still attach to the last swapchain-writing node. Keep the flag default OFF until E2E is green so main stays shippable.

#### `M3-T4` · Port the main forward route + multi-target loop to the graph; subsume submittedTargetCounts load/store inference

`webgpu-render` · effort **L** · depends: M3-T3

Make assembleWebGpuAppFrameBoundaries (frame-boundaries.ts) build ONE FrameGraph spanning all render targets instead of looping assembleFrameBoundary per target. Each render target becomes a render node writing the swapchain-or-offscreen handle; skybox prefix commands + opaque + sprite commands stay in the node's command list (preserving view-commands.ts writeCommandsForView merge — do NOT split them into separate passes in v1, just move them under a node). Replace the local submittedTargetCounts/loadExistingTarget logic (lines 153/261-274) with the compiler's global renderTargetMap inference so colorLoadOp/depthLoadOp/storeOp come from compileFrameGraph, and verify it produces the SAME load/store decisions the local logic did (this is the regression-proof). Make the transmission-grab pass (transmission-grab.ts) and per-target MSAA resolve declared graph writes rather than special-cased branches. Keep occlusion-query feedback, GPU timing, and render-bundle keys attached as node attributes. Flip useFrameGraph default ON for the queued-built-in route once green; keep legacy reachable via flag for one release.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/frame-boundaries.ts (build multi-target graph; delete local load/store loop in favor of compiler)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/view-commands.ts (keep skybox+opaque+sprite merge inside a node)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/transmission-grab.ts (becomes a declared graph node, not a boolean branch)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/frame-loop.ts (queued-built-in + single-built-in routes feed the graph builder)`

**Done when:**

- [ ] test/e2e/camera-clear-load-matrix.spec.ts (the load-vs-clear matrix proof) passes with graph ON, proving compiler-inferred load/store matches the previous submittedTargetCounts behavior
- [ ] test/e2e/split-screen-multi-camera + camera-viewport-grid specs pass with graph ON: all targets render to correct viewports/scissors and report ok:true
- [ ] A vitest golden test feeds a 3-target snapshot (two offscreen sharing a handle + swapchain) through compileFrameGraph and asserts the per-target colorLoadOp/depthLoadOp sequence equals the legacy submittedTargetCounts output exactly
- [ ] clustered-lights, csm-directional-shadow, transmission/glb-viewer E2E specs pass with graph ON (no regression in forward+ clustering, shadows-as-receiver, transmission grab)
- [ ] Frame submits ONE command buffer for a multi-target + transmission-grab frame (CommandSubmissionMetricsReport.commandBuffers===1), down from the prior per-target+grab count

**Study:** /Users/felixz/Projects/aperture/packages/webgpu/src/app/frame-boundaries.ts

**Watch out:** submittedTargetCounts is keyed by webGpuAppFrameBoundaryTargetSubmissionKey including render-target identity — the graph handle ids must encode the same identity or load/clear flips and a camera overlay clears the previous camera's pixels. occlusionRenderIds>0 disables render bundles (frame-boundaries.ts:452-454) — preserve that node-attribute gate. Sprites are appended to opaque commands (frame-loop.ts:847-850); keeping them in one node avoids a transparency-ordering regression. Do not reorder shadow-prep relative to opaque.

#### `M3-T5` · Bring the shadow caster pass into the single frame encoder as graph render nodes

`webgpu-render` · effort **L** · depends: M3-T4

Today shadow-pass-plan.ts marks submission 'deferred' and shadow caster command buffers are submitted via the separate shadows/shadow-pass-command-buffer-submission-report.ts path, producing StandardFrameShadowReceiverResources consumed by the forward route. Wire shadow caster passes as render PassNodes that run BEFORE the opaque node in the same FrameGraph: one node per ShadowPassPlan (directional cascade / point face / spot) writing its shadow depth-texture handle, reusing the existing shadow-caster-command-record-plan.ts RenderPassCommand lists and depthLoadOp/depthStoreOp from the plan. Declare the opaque/forward node as READING the shadow depth handles so the compiler orders shadows first and the receiver bind group samples a freshly-written, single-encoder-consistent depth map. Flip shadow-pass-plan submission to 'ready' once nodes execute in-graph. This eliminates the separate shadow submit and proves the read/write dependency edge drives ordering (not imperative call order).

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-pass-plan.ts (submission 'ready'; expose per-pass graph node descriptors)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts (RenderPassCommand lists feed shadow render nodes)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/frame-boundaries.ts (add shadow nodes + declare opaque reads shadow handles)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/app-environment-resources.ts (shadow depth resources become imported/transient graph handles)`

**Done when:**

- [ ] test/e2e/csm-directional-shadow.spec.ts, multi-light-shadow.spec.ts, point-shadow.spec.ts, spot-shadow.spec.ts pass with graph ON and visually-correct shadows (existing pixel/status assertions unchanged)
- [ ] Frame with shadows + opaque + post submits ONE command buffer (CommandSubmissionMetricsReport.commandBuffers===1); the separate shadow submitCommandBuffers path is no longer invoked in the graph path (asserted via fake-device submit count)
- [ ] compileFrameGraph report shows shadow node names ordered strictly before the opaque node BECAUSE the opaque node declares the shadow depth handles as reads (assert order in a vitest test by removing the edge and observing reorder)
- [ ] ShadowPassPlanReport.status === 'ready' and sections.passSubmission === true for a shadow-casting snapshot under the graph path
- [ ] No WebGPU validation warnings for shadow depth-texture read-after-write within the single encoder (validation console guard clean)

**Study:** /Users/felixz/Projects/aperture/references/engine/src/scene/renderer/render-pass-shadow-directional.js

**Watch out:** Sampling a depth texture in the opaque pass that was written earlier in the SAME encoder requires the shadow pass's depthStoreOp='store' and a usage including TEXTURE_BINDING — the compiler must set store on the shadow node because opaque reads it (this is exactly the renderTargetMap store-on-no-clear rule). Cube/point shadows render 6 faces (faceCount) — each face is a node; do not regress the per-face depthLoadOp from shadow-pass-plan.ts:135-141. Keep the legacy deferred path behind the flag until all four shadow specs are green.

#### `M3-T6` · Multi-frame/temporal resources as first-class history graph handles (TAA history through the graph)

`webgpu-render` · effort **M** · depends: M3-T3

Replace the hand-threaded history state (resource-cache.ts WebGpuAppPostPassCache.previousViewProjectionByViewId / previousWorldTransformsByRenderId / previousWorldTransformResource and the previousSnapshotForUpdate threading in create-webgpu-app.ts/frame-loop.ts) for the TAA color history with a declareHistory() graph resource: a double-buffered texture handle where this-frame writes buffer A and a node reading 'previous' transparently sees last frame's buffer B, with the graph swapping them at frame end (mirror references/three.js PassNode \_previousTextures/getPreviousTexture, src/nodes/display/PassNode.js:610-686 — study, do not copy). The TAA effect (post-taa.ts) declares a read of the history handle's previous view and a write of its current view; the executor binds the correct buffer per frame. Keep motion-vector geometry history as-is for v1 (out of scope), but route TAA's color history through the graph so adding a future temporal technique no longer requires hand-wiring cross-frame cache maps.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/render/graph/frame-graph.ts (declareHistory + per-frame double-buffer swap)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/post/post-taa.ts (declare history read 'previous' + write 'current' instead of fixed ping/pong)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/resource-cache.ts (history-resource pool replaces per-effect previous* maps for TAA color)`
- `/Users/felixz/Projects/aperture/examples/taa.worker.js or post-effects.worker.js (enable TAA over graph history for proof)`

**Done when:**

- [ ] A vitest test runs compileFrameGraph over two consecutive frames and asserts the TAA node's 'previous' read resolves to frame N-1's written buffer and 'current' write targets a different physical texture (buffers swap, no read-write aliasing of the same texture)
- [ ] An E2E/render-control TAA proof: with a static scene + camera jitter, the TAA output converges (consecutive-frame pixel delta at sampled readback points decreases below a threshold), demonstrating history is correctly carried across frames through the graph
- [ ] TAA still correctly falls back (motion-vectors.ts msaa/sprite/skybox reasons) under the graph path — status reports the same WebGpuAppMotionVectorFallbackReason values
- [ ] No leaked/duplicated history textures across N frames: history pool size is stable (asserted via resource-reuse report counts over 10 frames)

**Study:** /Users/felixz/Projects/aperture/references/three.js/src/nodes/display/PassNode.js

**Watch out:** History double-buffering must survive canvas resize (reallocate both buffers, drop stale history that frame) — a resize that reuses stale history shows ghosting. The swap must happen exactly once per frame at end-of-execute, not per node, or a frame that references history twice reads inconsistent data. Do not change motion-vector geometry-history wiring in this task; scope it to TAA color history to keep the slice small and provable.

#### `M3-T7` · Public addRenderPass/addComputePass API + a custom-pass example proving G-buffer read and compute dispatch

`runtime-orchestration` · effort **M** · depends: M3-T4, M3-T2

Expose the user-facing insertion API on WebGpuApp (and surface it through packages/app createApertureApp, which today does not even pass postEffects per the gap report). Add app.addRenderPass(node)/app.addComputePass(node)/app.removePass(name) that register user PassNode factories invoked each frame during graph build, with declared reads (e.g. scene-color, depth, motion-vector, or a named transient/history handle) and writes (a transient or the swapchain). The user node receives resolved input texture views + a place to push RenderPassCommand[]/ComputePassCommand[] — generalizing today's WebGpuPostEffect.prepare() (post-pass.ts:120-129) to also allow depth-tested geometry and compute. Provide an adapter so existing WebGpuPostEffect[] are auto-wrapped as render nodes (back-compat). Document insertion points (before/after named built-in nodes like 'opaque','post:bloom','swapchain', mirroring references/engine FramePass beforePasses/afterPasses). Ship a render-control example: a compute pass that reads the scene-color handle and writes a luminance histogram buffer, plus a custom depth-tested wireframe overlay render pass inserted after 'opaque', asserting both pixels and a JSON-safe graph report.

**Touch:**

- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/app.ts (WebGpuApp.addRenderPass/addComputePass/removePass on the interface)`
- `/Users/felixz/Projects/aperture/packages/webgpu/src/app/create-webgpu-app.ts (store user passes; feed graph builder each frame)`
- `/Users/felixz/Projects/aperture/packages/app/src/browser/app.ts (surface addRenderPass/addComputePass through createApertureApp)`
- `/Users/felixz/Projects/aperture/examples/custom-graph-pass.worker.js + .main.js + .html (new: compute histogram read + wireframe overlay node)`
- `/Users/felixz/Projects/aperture/test/e2e/custom-graph-pass.spec.ts (new: assert pixels + graph report)`

**Done when:**

- [ ] A new test/e2e/custom-graph-pass.spec.ts: an inserted depth-tested wireframe render node added AFTER 'opaque' draws over the scene — render-control pixels at sampled points show the overlay color where expected and the scene elsewhere; status.graph.order lists the custom node between 'opaque' and the first post node
- [ ] A custom compute node that reads scene-color and writes a histogram buffer executes in-frame: status reports the compute node ran (executedCommands>0 for it) and the frame still submits ONE command buffer including the compute dispatch
- [ ] app.addRenderPass with declared reads:['depth'] causes compileFrameGraph to order it after the depth-producing opaque node (assert ordering in a vitest test); removePass('name') removes it from the next frame's compiled order
- [ ] Existing WebGpuPostEffect[] passed to createWebGpuApp({postEffects}) still work via the auto-wrap adapter (examples/post-effects E2E unchanged), proving back-compat
- [ ] createApertureApp (packages/app) can register a custom pass end-to-end (a developer-api E2E or the new example launched through the app package), closing the 'users cannot insert custom passes' blocker

**Study:** /Users/felixz/Projects/aperture/references/engine/src/platform/graphics/frame-pass.js

**Watch out:** A user node that writes the swapchain mid-frame must not clobber the final post output — validate that user writes target transient handles unless explicitly inserted last; emit a diagnostic on conflicting swapchain writes. Compute nodes need their own bind-group/pipeline layout path (none exists per the compute-not-first-class gap) — the example must create its compute pipeline via device.createComputePipeline guarded by capability. Keep the node API JSON-describable enough that the graph report stays JSON-safe (commands carry opaque GPU handles but the REPORT must not serialize them — only names/counts). This is the keystone deliverable; ensure the API shape is reviewed before broad adoption since it is hard to change later.

**Sequencing.** Strict spine: M3-T1 (pure graph model) -> M3-T2 (single-encoder executor + the assembleFrameBoundary wrapper that preserves all legacy tests) are the non-negotiable foundation and must land first and green. After T2, three ports can proceed largely in parallel against the flag: M3-T3 (post stack) is the easiest first port and the cleanest proof of fewer submits; M3-T4 (forward + multi-target, which subsumes submittedTargetCounts) depends on T3 because the post target is built inside the multi-target loop; M3-T5 (shadows into the encoder) depends on T4 since opaque must already be a node to declare the shadow read edge. M3-T6 (TAA history) only needs T3 and can run alongside T4/T5. M3-T7 (public API + custom-pass example) is the milestone capstone and needs T4 (opaque node to insert after) and T2 (executor); land it last. Keep useFrameGraph default OFF through T3, flip ON for the queued-built-in route in T4 once camera-clear-load-matrix + multi-camera specs are green, and keep the legacy path reachable behind the flag until all shadow specs (T5) pass.

**Proof.** Layered proof matching project conventions. (1) Vitest golden/unit: frame-graph-compile.test.ts asserts deterministic topo order + renderTargetMap load/store inference matches an expected report and matches the legacy submittedTargetCounts decisions byte-for-byte; frame-graph-execute.test.ts uses a fake device event recorder to prove ONE createCommandEncoder/finish/submit for multi-pass frames; the existing test/webgpu/frame-boundary.test.ts (events ['begin','draw','end','finish','submit:1']) must stay green throughout, proving the legacy wrapper is preserved. (2) Regression E2E with the flag ON: dof.spec.ts, post-effects, camera-clear-load-matrix.spec.ts (the load/clear matrix), split-screen-multi-camera, camera-viewport-grid, clustered-lights, csm-directional-shadow/multi-light-shadow/point-shadow/spot-shadow, glb-viewer — all must pass unchanged, with attachWebGpuValidationConsoleGuard reporting zero validation warnings. (3) New capability proofs: a render-control + E2E custom-graph-pass.spec.ts asserting an inserted depth-tested overlay node's pixels and an in-frame compute dispatch, plus status.graph.order showing dependency-driven ordering; a TAA-history convergence proof showing consecutive-frame pixel deltas shrink. (4) Single-encoder metric: CommandSubmissionMetricsReport.commandBuffers===1 / submittedCommandBuffers===1 for scene+post+shadows+multi-target frames, asserted both in vitest (fake device) and surfaced JSON-safe to render-control status. Every graph report consumed by render-control must pass expectStatusJsonSafeForGpu.

**SOTA bar (when to stop).** Good-enough for this milestone is a CORRECT, declarative, single-encoder graph that preserves 100% of current behavior + diagnostics and adds first-class compute nodes, declared dependency-driven ordering, global load/store inference (matching PlayCanvas frame-graph.js renderTargetMap compile semantics), transient aliasing, history resources for TAA, and a documented addRenderPass/addComputePass API closing both render-graph blockers. Match PlayCanvas FrameGraph (store-on-no-clear, pass-merge skip-start/skip-end, before/after insertion) and three.js PassNode history — those ARE the SOTA bar for a web engine and the local references prove the target shape. STOP SHORT of: a fully automatic GPU-memory transient allocator with optimal lifetime packing (a simple per-frame pool keyed by descriptor is sufficient v1); deferred/visibility-buffer/clustered-forward selectable topologies (M3 only needs the graph to MAKE them expressible, not ship them); barrier insertion beyond load/store + read-after-write ordering (WebGPU handles most synchronization implicitly within an encoder); and full GPU-driven culling compute stages. Do NOT pursue automatic pass parallelization across queues — WebGPU has a single queue. The line to hold: every existing route, report field, render-bundle/elision optimization, occlusion-query feedback, MSAA resolve, and pixel output is identical before and after; the win is one encoder, declared dependencies, and a real user extension point — not a rewrite of the renderer's capabilities.

---

## M6 — Content layer: particles, text (SDF/MSDF), UI/GUI, decals, richer sprites, volumetrics <a id="m6"></a>

**Wave 3** · **Depends on:** M3 · 5 tasks (4×L, 1×M, 0×S) · _design-level (code does not exist yet — entry points are directional)_

> **Goal.** The engine can put the things real apps need on screen without users dropping to raw WGSL: a GPU-compute particle system, crisp resolution-independent text, a screen-space/world-space UI layer, projected decals, and richer billboards. These are largely independent of each other but share a 2D/screen-space + instanced foundation, and several (particles, UI overlay) want the render graph (M3) to host their compute/screen-space passes cleanly.

**Current state (verified against source).** Confirmed absent across the source: no particle system (CPU or GPU-compute), no text rendering of any kind (no SDF/MSDF, no font loading, no 3D text), no 2D/3D UI/GUI system, no decals, no volumetric VFX (height/volume fog, god rays, clouds). Sprites/billboards DO exist (packages/webgpu/src/app/sprites.ts, sprite-frame.ts, ~29 files) but are spherical-only: no axis-lock/cylindrical billboards, no screen-space size, no rotation, no UV atlas/sprite-sheet animation.

### Key entry points

| File / symbol                                                                            | Role                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/webgpu/src/app/sprites.ts, sprite-frame.ts; render/sprites/sprite-pipeline.ts` | Existing sprite/billboard implementation to extend (axis lock, screen size, rotation, UV atlas) and to reuse as the instanced-quad foundation for text glyphs and UI. |
| `packages/render/src/rendering/extraction-sprites.ts`                                    | Sprite extraction path — the model for extracting particle/text/UI instance data from ECS into the snapshot.                                                          |
| `M3 FrameGraph (once it exists)`                                                         | Host compute-particle simulation passes and the screen-space UI/text overlay pass as graph nodes.                                                                     |

### Tasks

#### `M6-T1` · Richer sprites/billboards

`webgpu-render` · effort **M** · depends: none

Extend the existing sprite path with cylindrical/axis-locked billboards, screen-space (pixel) sizing, per-sprite rotation, and UV-atlas/sprite-sheet frame selection + animation.

**Touch:**

- `packages/webgpu/src/app/sprites.ts`
- `packages/render/src/rendering/extraction-sprites.ts`

**Done when:**

- [ ] A render-control route shows axis-locked, screen-sized, rotated, and atlas-animated sprites with pixel assertions
- [ ] Sprite authoring components expose billboardMode/screenSize/rotation/atlasFrame

**Study:** references/three.js Sprite + references/engine sprite

**Watch out:** Keep extraction snapshot-packed; do not add per-sprite objects on the hot path.

#### `M6-T2` · GPU-compute particle system

`webgpu-render` · effort **L** · depends: M6-T1, M3-T7

Data-driven particle emitter components (rate, lifetime, velocity, forces, color/size-over-life curves) simulated in a WGSL compute pass, rendered as instanced billboards. Persistent particle buffers as graph-managed resources.

**Touch:**

- `new packages/render/src/<particles> authoring+extraction`
- `new packages/webgpu/src/<particles> compute+render passes`

**Done when:**

- [ ] A route emits 100k+ GPU-simulated particles at 60fps with a frame-time assertion
- [ ] Particle count/sim-pass timing reported in JSON-safe status

**Study:** references/engine particle system; modern WebGPU compute-particle patterns

**Watch out:** Needs M3 to host the compute pass + ping-pong buffers cleanly; emitter state stays ECS-authoritative.

#### `M6-T3` · Text rendering (MSDF)

`webgpu-render` · effort **L** · depends: M6-T1

MSDF font atlas loading + glyph layout (line breaking, alignment, kerning) producing instanced glyph quads for both world-space 3D text and screen-space labels. Build/ship a default font atlas.

**Touch:**

- `new font/atlas loader in packages/render/src/assets`
- `new text layout + glyph pipeline in packages/webgpu`

**Done when:**

- [ ] A route renders crisp world-space and screen-space text that stays sharp under zoom (pixel assertion at two scales)
- [ ] Font atlas + layout metrics reported in status

**Study:** Troika-three-text / MSDF approach; references/three.js text examples

**Watch out:** Resolution independence is the point — validate sharpness at multiple scales, not just one.

#### `M6-T4` · UI / GUI layer

`render-bridge` · effort **L** · depends: M6-T3

Screen-space (and optional world-space) UI: panels, fl. layout (flex-like), text, images, and pointer interaction (depends on M1 picking + M7 pointer events). Either a retained ECS-component UI tree or an immediate-mode overlay.

**Touch:**

- `new UI authoring components`
- `new screen-space UI pass (graph node)`

**Done when:**

- [ ] A route builds a layout-driven HUD with interactive buttons proven by simulated pointer events
- [ ] UI hit-testing integrates with the M7 pointer-event layer

**Study:** references/engine PlayCanvas UI; Babylon GUI

**Watch out:** Decide retained-vs-immediate early; keep UI state in ECS to preserve the no-scene-graph invariant.

#### `M6-T5` · Decals + volumetrics (stretch)

`webgpu-render` · effort **L** · depends: M3-T7

Projected/deferred decals onto existing surfaces, and volumetric height/volume fog + light shafts as graph post/compute nodes.

**Touch:**

- `new decal projection pass`
- `new volumetric pass (graph node)`

**Done when:**

- [ ] A route shows a decal conforming to mesh surfaces and a volumetric fog volume with light shafts, both pixel-asserted

**Study:** references/engine decals; standard froxel volumetric-fog technique

**Watch out:** Volumetrics want the clustered froxel data you already build — reuse it.

**Sequencing.** T1 first (foundation + immediate value). T3 (text) and T4 (UI) form one track; T2 (particles) and T5 (decals/volumetrics) another. T2/T4/T5 want M3 in place; T1/T3 do not.

**Proof.** One worker-authored render-control route per feature with pixel assertions + JSON-safe counts, plus a combined 'content showcase' route.

**SOTA bar (when to stop).** Good enough = particles + crisp text + an interactive HUD that real apps can ship. Full node-based VFX graphs, rich-text markup, and a complete widget toolkit are explicitly beyond this milestone.

---

## M7 — Scene persistence + runtime authoring layer: scene/prefab serialization, hierarchy ergonomics, material mutation, camera controls/gizmos, pointer-on-object events <a id="m7"></a>

**Wave 3** · **Depends on:** none _(soft: M1)_ · 9 tasks (2×L, 6×M, 1×S)

> **Goal.** An author can save a live ECS world to a JSON-safe scene document and reload it into a fresh world with entities, components, transforms, and parent links round-tripping exactly; register a reusable prefab once and instantiate it many times with per-instance transform/field overrides; query/enumerate children, recursively despawn, and reparent an entity while preserving its world transform; mutate a material's parameters at runtime (e.g. base color, roughness) and see the change on screen within a few frames without re-authoring the scene; drop in a shipped orbit camera controller and a translate gizmo instead of hand-rolling camera math; and receive hover/enter/leave/down/up/click/drag events on entities driven by real screen-to-world picking. All of this respects the ECS-authoritative invariant — serialization is of ECS world state, the renderer stays a derived snapshot consumer, and material mutation flows through the existing versioned asset-registry/mirror path rather than mutating renderer-owned GPU state directly.

**Current state (verified against source).** Verified by reading source. HIERARCHY: only `Parent` exists (packages/simulation/src/transform/components.ts:53, field `entity: EcsType.Entity`); there is no `Children` component and no `setParent`/`reparent`. `createParent` (components.ts:107) only writes the parent reference, no world-preserving local recompute. `resolveWorldTransforms` (transform/resolution.ts:63) topologically resolves and rewrites every transform entity each tick (sorts all entities line 71, always composes+multiplies). `createApertureEntityHierarchy` (app/src/entities/lookup/hierarchy.ts) builds an ephemeral tree by scanning ALL active entities and bucketing by parent — diagnostic only, no ECS Children data. Math helpers `invertMat4`, `multiplyMat4`, `decomposeTrsMatrix`, `transformPoint`, `composeTrsMatrix`, `makePerspective`, `makeOrthographic` all exist (simulation/src/math/matrix.ts, projection.ts). PREFAB/SCENE: `PrefabHandle`/`SceneHandle` are dead branded-type stubs (simulation/src/assets/types.ts:33-34), 'prefab' is in ASSET_KINDS (types.ts:8) but `createPrefabHandle` is never consumed. No toJSON/fromJSON over ECS components anywhere. Spawn commands (app/src/systems/spawn/commands.ts) only do camera/light/mesh/gltf, one entity each. Generic component introspection IS available: `entity.getComponents()` returns components with `.id` and `.schema` (elics createComponent, ecs/index.ts:13), values read via getValue/getVectorView (proven in app/src/entities/lookup/summary.ts), entities created via `world.createEntity().addComponent(component, data)`. MATERIAL MUTATION: materials are frozen plain descriptor objects from factories.ts (createStandardMaterialAsset etc.), all fields readonly (materials/types.ts). The renderer prepares materials by handle from the asset registry (render/src/rendering/snapshot-prepared-materials.ts:62 `materials.prepare({registry, handle})`), and the registry is version-keyed: `AssetRegistry.markReady` bumps `version+1` (simulation/src/assets/registry.ts:184) and `mirrorSourceAssetRegistryFromMessage` skips when `current.version >= entry.version` (app/src/asset-mirror.ts:74) — so re-registering an updated asset propagates to the GPU. There is NO Material instance with setters and no app-level material edit surface (grep setUniform/editMaterial/updateMaterial = 0 hits). CAMERA/PICKING: `CameraHandle.rayFromPointer` (app/src/systems/cameras.ts:76-81) is a non-functional STUB returning origin:[x,y,1], direction:[0,0,-1], ignoring camera transform/projection. `createSpatialQueries` (app/src/spatial/index.ts) exposes setBounds/setMeshes but the ONLY non-test caller is examples/developer-api/src/systems/setup.system.ts:55 (hand-coded AABB). `Pickable` (render/src/rendering/authoring-components-spatial.ts:10) and `createSpatialTriangleMeshFromMeshAsset` (render/src/mesh/spatial-adapter.ts:36) exist but no runtime system consumes them. `app.pick(x,y)` (webgpu/src/app/app.ts:451) is invoked only from devtools (app/src/browser/devtools/picking.ts:83). POINTER EVENTS: input resource only has `pointer.primary.{position,pressed}` (app/src/input/state.ts:72-77); grep hover/onClick/onEnter/onLeave/dragStart = 0 hits in app+render. WIRING: app systems run in the worker via `registerSystem` with priority ordering (app/src/advanced.ts:144); TransformResolutionSystem runs as a registered system; the system context (app/src/systems/context.ts) is the single injection point exposing world/spatial/cameras/input/spawn/assetsRegistry/effects/signals to systems.

### Key entry points

| File / symbol                                         | Role                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/simulation/src/transform/components.ts`     | Defines Parent/LocalTransform/WorldTransform components and createParent. Add a Children component here and a world-preserving setParent helper (uses decomposeTrsMatrix/invertMat4/multiplyMat4). registerTransformComponents must also register Children.                                       |
| `packages/simulation/src/transform/resolution.ts`     | resolveWorldTransforms is where world matrices become available; setParent and Children maintenance must stay consistent with the topological resolver and its stale-parent/cycle diagnostics.                                                                                                    |
| `packages/simulation/src/assets/types.ts`             | PrefabHandle/SceneHandle dead stubs (lines 33-34) and ASSET_KINDS. Prefab/scene documents become asset payloads (TAsset) keyed by these handles.                                                                                                                                                  |
| `packages/app/src/entities/lookup/summary.ts`         | Reference read pattern for generic component introspection (getComponents/getValue/getVectorView). The scene serializer's component-read codec mirrors this; collectActiveEntities is the entity enumeration source.                                                                              |
| `packages/app/src/systems/spawn/commands.ts`          | SpawnCommands factory (camera/light/mesh/gltf). Add spawn.prefab(handle, overrides) and the scene-instantiate path here; replayGltfLoadedScene is the existing multi-entity instantiation precedent to mirror.                                                                                    |
| `packages/app/src/systems/context.ts`                 | ApertureSystemContext — the central per-system injection surface. Add `scene` (save/load), `prefabs` (register/instantiate), `hierarchy` (children/setParent/despawnRecursive), `materials` (mutate), and `interaction` (pointer-on-object events) accessors here, wired to world+assetsRegistry. |
| `packages/app/src/systems/cameras.ts`                 | CameraHandle.rayFromPointer is a stub (lines 76-81). Replace with real unprojection using the Camera component (fovYRadians/aspect/near/far/orthographicHeight) + the camera entity WorldTransform via makePerspective/invertMat4.                                                                |
| `packages/app/src/spatial/index.ts`                   | createSpatialQueries holds setBounds/setMeshes. A new per-frame system must populate this index from ECS (Pickable + Mesh + WorldTransform) so picking works out of the box instead of hand-wired.                                                                                                |
| `packages/render/src/materials/factories.ts`          | Immutable material asset factories. Material mutation builds a new asset by patching the previous one and re-registers it via AssetRegistry.markReady (version bump), the engine's existing change-propagation path.                                                                              |
| `packages/app/src/asset-mirror.ts`                    | Version-keyed registry mirror (line 74). Confirms re-registered material assets with a bumped version propagate across the worker boundary to trigger GPU re-preparation — the mechanism material mutation rides on.                                                                              |
| `packages/app/src/input/state.ts`                     | InputResourceImpl.pointer.primary.{position,pressed} (lines 72-77) is the raw pointer signal the pointer-on-object event layer consumes to synthesize hover/enter/leave/down/up/click/drag.                                                                                                       |
| `packages/app/src/advanced.ts`                        | registerSystem + priority ordering (line 144). New interaction/picking-index/hierarchy-maintenance systems register here with priorities ordered after TransformResolutionSystem.                                                                                                                 |
| `packages/webgpu/src/app/app.ts`                      | app.pick(x,y):Promise<RenderEntityRef\|null> (line 451) — GPU ID-buffer pick. Optional alternate picking source for the pointer-event layer when CPU BVH picking is unavailable.                                                                                                                  |
| `examples/developer-api/src/systems/select.system.ts` | The existing manual select flow (rayFromPointer -> spatial.raycastFirst). Becomes the migration reference: it should collapse to interaction.onClick(entity, ...) once the pointer-event layer ships.                                                                                             |

### Tasks

#### `M7-T1` · Bidirectional hierarchy: Children component + world-preserving setParent + recursive despawn

`simulation` · effort **M** · depends: none

Add a `Children` ECS component (ordered child entity list) to packages/simulation/src/transform/components.ts and maintain it whenever Parent changes. Implement `setParent(world, child, parent | null)` that (a) reads the child's current WorldTransform and the new parent's WorldTransform, (b) recomputes the child's LocalTransform via decomposeTrsMatrix(multiplyMat4(invertMat4(parentWorld), childWorld)) so the entity stays put in world space, (c) updates both Parent and the old/new parents' Children lists, and (d) rejects cycles (reuse the diagnostic vocabulary from resolution.ts). Implement `getChildren(world, entity)`, `despawnRecursive(world, entity)` (depth-first destroy of subtree). Since elics stores entity refs as Int32 and there is no list type, store Children as a JSON string field (mirror the AppEntityTags valuesJson pattern in summary.ts:27) OR a fixed-cap packed list — choose JSON-string to stay schema-simple and worker-safe. Register Children in registerTransformComponents.

**Touch:**

- `packages/simulation/src/transform/components.ts (add Children component, setParent, getChildren, despawnRecursive)`
- `packages/simulation/src/transform/resolution.ts (ensure resolver tolerates Children; no new full-scan)`
- `packages/simulation/src/transform/index.ts (export new symbols)`
- `packages/simulation/test/transform-hierarchy.test.ts (new vitest)`

**Done when:**

- [ ] Vitest: setParent(child, parent) leaves the child's WorldTransform numerically unchanged (within 1e-5) after the next resolveWorldTransforms while its Parent.entity now points at parent
- [ ] Vitest: setParent(child, null) detaches and the child's LocalTransform now equals its prior WorldTransform (decomposed)
- [ ] Vitest: getChildren returns the ordered list and reflects add/remove after setParent on both old and new parent
- [ ] Vitest: despawnRecursive on a 3-deep subtree destroys all descendants (all entity.active === false) and leaves no entity with a stale Parent pointing at a destroyed parent
- [ ] Vitest: setParent that would create a cycle is rejected (no Parent write, returns a structured diagnostic) and resolveWorldTransforms emits no 'cycle' diagnostic afterward

**Study:** references/bevy/crates/bevy_scene/src/scene.rs (parent/child reconstruction) and references/bevy hierarchy (Children/Parent dual components, world-preserving reparent semantics)

**Watch out:** resolveWorldTransforms re-resolves every entity each frame; do NOT make Children authoritative for resolution — Parent stays the single source of truth for the resolver, Children is a derived convenience index that must be kept consistent on every Parent mutation or it silently rots. Keep all hierarchy mutation headless/worker-safe (no DOM). Entity generation must be encoded in the Children JSON so stale refs are detectable, matching resolveActiveEntity semantics.

#### `M7-T2` · Hierarchy ergonomics surfaced on the system context (children/setParent/despawnRecursive)

`runtime-orchestration` · effort **S** · depends: M7-T1

Expose the M7-T1 helpers to app systems by adding a `hierarchy` accessor to ApertureSystemContext (packages/app/src/systems/context.ts) with children(ref)/setParent(child, parent)/despawnRecursive(ref), resolving EcsEntityRef -> Entity through the existing resolveActiveEntity generation-checked path (entities/lookup/mutation.ts). Make createApertureEntityHierarchy (entities/lookup/hierarchy.ts) prefer the new Children component when present (O(subtree)) and fall back to the full-scan bucketing only when Children is absent, so the devtools hierarchy view stops being a full ALL-entities scan.

**Touch:**

- `packages/app/src/systems/context.ts (add hierarchy accessor + type)`
- `packages/app/src/systems/hierarchy.ts (new accessor impl)`
- `packages/app/src/entities/lookup/hierarchy.ts (consume Children when present)`
- `packages/app/src/systems.ts (re-export)`

**Done when:**

- [ ] A worker-authored example route calls this.hierarchy.setParent on a spawned child and the published snapshot/entity summary shows the child's parent ref updated and its world transform preserved
- [ ] createApertureEntityHierarchy on a world with Children present produces an identical tree to the legacy full-scan path (vitest equivalence test) but does not call collectActiveEntities
- [ ] this.hierarchy.despawnRecursive removes a spawned subtree and the next snapshot's meshDraws count drops by exactly the descendant mesh count

**Study:** packages/app/src/entities/lookup/mutation.ts (resolveActiveEntity generation-checked ref resolution)

**Watch out:** Must not break the existing devtools hierarchy/diff tooling that consumes createApertureEntityHierarchy. The fallback path must remain for entities authored without Children (e.g. raw glTF replay subtrees) until M7-T1 maintenance covers them.

#### `M7-T3` · Generic ECS component (de)serialization codec keyed off component schema

`simulation` · effort **M** · depends: none

Build a generic, headless-safe codec in packages/simulation that serializes a single entity's registered components to a JSON-safe record and reconstructs them. Read field types from `component.schema` (elics createComponent exposes `.id` and `.schema`) and read values via getValue (scalars/strings/enums/booleans) and getVectorView (Vec2/3/4/Color), mirroring the proven introspection in app/src/entities/lookup/summary.ts. Provide a registry mapping component.id -> component (built from world's registered components) so deserialize can call entity.addComponent(component, data). Handle the Entity-typed field specially (Parent.entity, Children refs) by emitting a stable serialized entity id (index:generation) to be remapped at instantiation time. Exclude derived components (WorldTransform) from serialization since they are recomputed by the resolver.

**Touch:**

- `packages/simulation/src/serialization/component-codec.ts (new: serializeEntityComponents/deserializeEntityComponents)`
- `packages/simulation/src/serialization/component-registry.ts (new: id->component map from world.registeredComponents)`
- `packages/simulation/src/serialization/index.ts (new)`
- `packages/simulation/src/index.ts (export)`
- `packages/simulation/test/component-codec.test.ts (new vitest)`

**Done when:**

- [ ] Vitest: serialize then deserialize an entity carrying LocalTransform+Name+Parent reproduces every field value bit-for-bit (Float32 equality) into a freshly created entity
- [ ] Vitest: Entity-typed fields (Parent.entity) round-trip as serialized id:generation tokens and are NOT written as raw numeric indices
- [ ] Vitest: WorldTransform is omitted from the serialized record (derived), and an unregistered component.id on deserialize yields a structured diagnostic rather than a throw
- [ ] Vitest: enum/boolean/string/Vec3/Vec4/Color field kinds each round-trip via the schema-driven read/write

**Study:** packages/app/src/entities/lookup/summary.ts (component enumeration + getValue/getVectorView read pattern) and references/bevy/crates/bevy_scene/src/scene_component.rs (reflection-driven component serialization)

**Watch out:** elics enum fields store an int but author with an enum object — the codec must serialize the stable enum value, not the index, or reloads break on enum reordering. Do not attempt to serialize renderer/GPU state. Keep the codec free of any app-layer or render-layer imports so it stays in the simulation package and worker-safe. The serialized id:generation token scheme must be deterministic so a multi-entity scene can cross-reference parents.

#### `M7-T4` · Scene document save/load: round-trip a live ECS world

`simulation` · effort **M** · depends: M7-T3, M7-T1

Compose M7-T3 into a whole-world scene document. `saveScene(world)` enumerates active entities (collectActiveEntities pattern), assigns each a stable serialized id, serializes each entity's components, and emits a versioned JSON-safe ApertureSceneDocument { formatVersion, entities: [{ id, components }] }. `loadScene(world, document)` creates one entity per record, builds an oldId->newEntity map, deserializes components, then performs a second pass to remap all Entity-typed fields (Parent.entity, Children) through that map so hierarchy survives the round-trip. Realize ApertureSceneDocument as the payload (TAsset) for the previously-dead SceneHandle (simulation/src/assets/types.ts:33). loadScene must call resolveWorldTransforms after instantiation so WorldTransform is regenerated.

**Touch:**

- `packages/simulation/src/serialization/scene-document.ts (new: ApertureSceneDocument type, saveScene, loadScene)`
- `packages/simulation/src/serialization/index.ts (export)`
- `packages/simulation/src/assets/types.ts (document scene payload shape on SceneHandle)`
- `packages/simulation/test/scene-roundtrip.test.ts (new vitest)`

**Done when:**

- [ ] Vitest: build a world with a parent + 2 children + a camera + transforms, saveScene -> JSON.stringify -> JSON.parse -> loadScene into a FRESH world reproduces entity count, every component field, and parent/child links (after resolveWorldTransforms) within 1e-5
- [ ] Vitest: parent references in the reloaded world point at the reloaded parent entities (remapped), never at original indices
- [ ] Vitest: the document is structurally JSON-safe (JSON.parse(JSON.stringify(doc)) deep-equals doc) and carries a formatVersion
- [ ] Vitest: loading a document whose formatVersion is unknown returns a structured diagnostic and instantiates nothing

**Study:** references/bevy/crates/bevy_scene/src/scene.rs (write_to_world / entity id remapping) and resolved_scene.rs

**Watch out:** Entity index reuse: a fresh world will allocate different indices, so the remap pass is mandatory and must run before any Parent write is trusted by the resolver. Cyclic Parent links in a corrupt document must be caught (reuse resolution.ts cycle diagnostics) rather than infinite-looping. Keep saveScene/loadScene in the simulation package — they operate on ECS state only, never on snapshots or GPU resources (invariant).

#### `M7-T5` · Prefab register + instantiate with per-instance transform/field overrides

`render-bridge` · effort **M** · depends: M7-T3, M7-T1

Turn the dead PrefabHandle stub (simulation/src/assets/types.ts:34, createPrefabHandle handles.ts:57) into a working blueprint. A prefab's payload is an ApertureSceneDocument-shaped subtree (reuse M7-T3/T4 codec) registered in the AssetRegistry under a PrefabHandle. `instantiatePrefab(world, document, overrides)` clones the subtree into the live world (same remap logic as loadScene), returns the root entity, and applies overrides: a transform override on the root (translation/rotation/scale) and optional component-field overrides addressed by the prefab-local serialized id. Surface this through SpawnCommands as `spawn.prefab(handle, { transform, overrides })` in packages/app/src/systems/spawn/commands.ts, mirroring the existing replayGltfLoadedScene multi-entity path (commands.ts:108) and applySpawnMetadata/writeTransform usage.

**Touch:**

- `packages/simulation/src/serialization/prefab.ts (new: instantiatePrefab on top of scene-document codec)`
- `packages/app/src/systems/spawn/commands.ts (add prefab command)`
- `packages/app/src/systems/spawn/types.ts (extend SpawnCommands type)`
- `packages/app/src/systems/context.ts (prefabs accessor: register(document)->PrefabHandle)`
- `packages/app/test or packages/simulation/test/prefab-instantiate.test.ts (new vitest)`

**Done when:**

- [ ] Vitest: register a 3-entity prefab once, instantiate it twice; the world gains 6 new entities, each instance is an independent subtree (mutating one instance's component does not affect the other)
- [ ] Vitest: spawn.prefab with a transform override places the instance root at the override translation while internal child local transforms match the prefab
- [ ] Vitest: a per-id field override (e.g. a child's Name) is applied to that instance only
- [ ] An E2E or render-control route spawns 2 prefab instances and the snapshot shows the expected meshDraws count and distinct world positions

**Study:** references/bevy/crates/bevy_scene/src/spawn.rs and scene_patch.rs (instance spawning + per-instance patch/override), packages/app/src/systems/spawn/gltf.ts (existing multi-entity replay precedent)

**Watch out:** Instantiation must deep-clone (independent entities), not share component data — verify no aliasing of the prefab document's arrays into live entity storage. Asset references inside a prefab (mesh/material handles) must stay as stable typed handles (invariant: assets referenced by handle), so the codec serializes handle keys, not asset bytes. Overrides addressed by prefab-local id must fail loudly (diagnostic) on an unknown id rather than silently no-op.

#### `M7-T6` · Runtime material parameter mutation via versioned asset re-registration

`render-bridge` · effort **M** · depends: none

Add a material-mutation surface that flows through the engine's existing versioned asset path rather than touching GPU state. Implement `patchStandardMaterial(prev, patch)` (and unlit/matcap equivalents) in packages/render/src/materials that returns a NEW frozen asset with the patched fields merged over prev (e.g. baseColorFactor, roughnessFactor, metallicFactor, emissiveFactor), reusing the factory defaults. Surface `materials.set(handle, patch)` on ApertureSystemContext (packages/app/src/systems/context.ts) that reads the current asset from assetsRegistry.get(handle), applies the patch, and calls assetsRegistry.markReady(handle, nextAsset) — which bumps version+1 (registry.ts:184) and rides the version-keyed asset mirror (asset-mirror.ts:74) so prepareSnapshotMaterials re-prepares the GPU material (snapshot-prepared-materials.ts:62). No re-extraction of the mesh and no new handle are needed.

**Touch:**

- `packages/render/src/materials/factories.ts (add patchStandardMaterial/patchUnlitMaterial/patchMatcapMaterial)`
- `packages/render/src/materials/index.ts (export)`
- `packages/app/src/systems/context.ts (materials accessor with set/get)`
- `packages/app/src/systems/materials.ts (new accessor impl using assetsRegistry.markReady)`
- `packages/app/test or render test (vitest) + an E2E/render-control route`

**Done when:**

- [ ] Vitest: patchStandardMaterial(prev, { baseColorFactor:[1,0,0,1] }) returns a new asset whose baseColorFactor is red and all other fields equal prev (prev is unmutated/frozen)
- [ ] Vitest: materials.set bumps the registry entry version by exactly 1 and the asset-mirror serializes the new version (sentVersion check)
- [ ] E2E/render-control: a route renders a quad, reads back its center pixel, calls materials.set(handle,{baseColorFactor:[1,0,0,1]}), steps a few frames, and the center pixel readback transitions from the original color to red (pixel-proven mutation with no new mesh/material handle)
- [ ] render-control: snapshot status reports the prepared-material entry action as 'updated' for that material key after the mutation

**Study:** packages/render/src/rendering/snapshot-prepared-materials.ts (handle->prepare with action 'updated') and packages/app/src/asset-mirror.ts:74 (version-gated mirror)

**Watch out:** Must NOT mutate the existing frozen asset object in place — extraction caches and the mirror compare by version, and the renderer treats assets as immutable; return a fresh object. Changing a field that flips a shader VARIANT (e.g. enabling clearcoat from 0) selects a different prebuilt pipeline and is heavier — scope this task to scalar/color uniform-level fields that stay within the same variant; document variant-changing fields as a follow-up. Material mutation must remain in the worker/ECS authoring side; never call into webgpu directly (invariant).

#### `M7-T7` · Real camera screen-to-world ray (replace rayFromPointer stub) + auto-populated picking index

`simulation` · effort **M** · depends: none

Replace the CameraHandle.rayFromPointer stub (packages/app/src/systems/cameras.ts:76-81) with correct unprojection: read the camera entity's Camera component (projection/fovYRadians/aspect/near/far/orthographicHeight) and its WorldTransform, build the projection matrix (makePerspective/makeOrthographic) and the view matrix (invertMat4 of the camera world), invert viewProjection, and unproject a [0,1] pointer position (NDC = position\*2-1, flip Y) at near and far planes into a world-space origin+direction. Separately, add a worker-side system (registered after TransformResolutionSystem) that each frame extracts entities with Pickable + Mesh + WorldTransform (and uses createSpatialTriangleMeshFromMeshAsset for mesh precision, bounds otherwise) and calls spatial.setMeshes/setBounds — so spatial.raycastFirst works out of the box without the hand-wired setBounds in examples/developer-api/src/systems/setup.system.ts:55.

**Touch:**

- `packages/app/src/systems/cameras.ts (real unprojection in rayFromPointer)`
- `packages/app/src/spatial/picking-index-system.ts (new system: ECS -> spatial.setMeshes/setBounds per frame)`
- `packages/app/src/advanced.ts (register the picking-index system with priority after transform resolution)`
- `packages/app/src/systems/cameras.ts test + packages/app/test spatial test (vitest)`

**Done when:**

- [ ] Vitest: a camera at [0,1.5,5] looking at origin with 60deg fov produces, for pointer center [0.5,0.5], a ray whose direction (normalized) points from the camera toward the look target within 1e-3, and whose origin lies on the near plane
- [ ] Vitest: corner pointer positions ([0,0],[1,1]) produce rays whose directions differ from center by the expected half-fov/aspect angles (sign of NDC Y is flipped correctly)
- [ ] E2E/render-control: a route spawns a single Pickable mesh, the picking-index system auto-populates spatial, and this.cameras.main.rayFromPointer over the mesh center -> spatial.raycastFirst returns a hit on that entity with no manual setBounds/setMeshes call
- [ ] Vitest: orthographic camera produces parallel rays (direction constant across pointer positions, origin varies)

**Study:** packages/simulation/src/math/projection.ts (makePerspective/makeOrthographic) + matrix.ts (invertMat4/transformPoint); references/three.js Raycaster.setFromCamera for unprojection convention

**Watch out:** NDC Y must be flipped (screen y-down vs clip y-up) — the existing pointer position is [0,1] top-left; getting this wrong inverts vertical picking silently. The picking-index system must run AFTER WorldTransform is resolved (priority ordering, advanced.ts) or it reads stale matrices. Keep this in simulation/app and headless-safe; do NOT use app.pick (GPU) here — that is a separate optional source. Mesh-precision picking is gated by Pickable.precision and the triangle-list-only adapter (spatial-adapter.ts), so fall back to bounds for unsupported meshes.

#### `M7-T8` · Pointer-on-object event layer: hover/enter/leave/down/up/click/drag on entities

`runtime-orchestration` · effort **L** · depends: M7-T7

Add an `interaction` accessor to ApertureSystemContext plus a worker-side system that, each frame, casts a ray from the primary pointer (cameras.main.rayFromPointer + spatial.raycastFirst from M7-T7) and synthesizes per-entity events with cross-frame state tracking: hovered-entity (enter when the hit entity changes to a new one, leave when it changes away), down (pointer pressed transitions to true over a hit), up, click (down then up over the same entity within a small movement+time threshold, distinguishing from drag), and drag (down + movement past threshold; emit dragStart/drag/dragEnd with world-space delta along the picking plane). Expose registration like interaction.onClick(filter, cb)/onEnter/onLeave/onDrag where filter selects entities (by query, tag, or ref). Drive callbacks through the existing effects/signals scheduling (effects.watch pattern) so they run in system update order. Migrate examples/developer-api/src/systems/select.system.ts to use interaction.onClick to prove the ergonomics.

**Touch:**

- `packages/app/src/interaction/pointer-events.ts (new: hover/enter/leave/click/drag state machine + thresholds)`
- `packages/app/src/interaction/system.ts (new worker system, priority after picking-index)`
- `packages/app/src/systems/context.ts (interaction accessor + types)`
- `packages/app/src/advanced.ts (register interaction system)`
- `examples/developer-api/src/systems/select.system.ts (migrate to interaction.onClick)`
- `examples/pointer-events.worker.js + pointer-events.main.js + pointer-events.html (new render-control route)`

**Done when:**

- [ ] render-control/E2E: a route spawns a Pickable mesh; forwarding a pointer move to the mesh center fires exactly one enter for that entity; moving off fires exactly one leave; the route reports JSON-safe enter/leave/hovered-entity counts that match
- [ ] render-control/E2E: a pointer down+up over the same entity within threshold fires one click event carrying the hit entity ref and world hit point; a down+move-past-threshold+up fires dragStart/drag/dragEnd (and NOT click)
- [ ] Vitest: the pointer-event state machine unit test asserts click-vs-drag discrimination by movement threshold and that enter/leave are not re-emitted while the same entity stays hovered across frames
- [ ] developer-api.spec.ts (or its successor) passes with select.system.ts rewritten to interaction.onClick, proving the public ergonomics replace the manual rayFromPointer+raycastFirst flow

**Study:** references/three.js examples (pointer/raycaster interaction loop), references/engine (PlayCanvas ElementInput/pointer events) for enter/leave/click/drag semantics; packages/app/src/input/state.ts (pointer.primary signal source)

**Watch out:** All event synthesis must be headless/worker-safe (no DOM listeners) — it consumes the already-forwarded pointer.primary signal, it must not add browser event listeners in the worker. Click-vs-drag thresholds must be in normalized pointer space and frame-rate independent (use time, not frame counts). Enter/leave must be edge-triggered against the previous frame's hovered entity, robust to entity destruction (generation check via resolveActiveEntity). This layer is gameplay/interaction state and belongs in ECS/app, NOT the renderer. No bubbling/propagation is required for this milestone (flat per-entity events); document propagation as future work.

#### `M7-T9` · Shipped orbit camera controller + translate gizmo as reusable app systems

`runtime-orchestration` · effort **L** · depends: M7-T7, M7-T8

Ship two reusable, ECS-authoritative authoring helpers so examples stop hand-rolling camera math. (1) An orbit camera controller system: given a target point and a camera entity, maintain azimuth/elevation/distance driven by pointer drag (from M7-T8 drag deltas or raw pointer.primary delta) and wheel/zoom, writing the camera's LocalTransform each frame (lookAt composition). Expose as createOrbitCameraController({ camera, target, ... }) registerable as an app system or callable from a setup system. (2) A translate gizmo: spawn 3 axis-handle entities (Pickable meshes) parented to a selected entity; on drag of a handle (M7-T8), project pointer motion onto that axis and write the selected entity's LocalTransform translation, using world-preserving setParent-style math (M7-T1) so the gizmo tracks the target. Both must be pure ECS authoring — they mutate LocalTransform via the normal component path; the renderer just sees the resulting snapshot.

**Touch:**

- `packages/app/src/controllers/orbit-camera.ts (new)`
- `packages/app/src/controllers/translate-gizmo.ts (new)`
- `packages/app/src/controllers/index.ts (new export) + packages/app/src/index.ts`
- `examples/orbit-camera.worker.js + .main.js + .html (new render-control route)`
- `examples/translate-gizmo.worker.js + .main.js + .html (new render-control route)`

**Done when:**

- [ ] render-control/E2E: orbit route — forwarding a horizontal pointer drag rotates the camera around the target; two pixel readbacks (before/after drag) differ in the expected direction, and the camera LocalTransform azimuth changed while distance to target stayed constant (within 1e-3)
- [ ] render-control/E2E: orbit route — a wheel/zoom input changes camera distance to target and the rendered object scales in screen size (pixel coverage of the object increases/decreases)
- [ ] render-control/E2E: gizmo route — dragging the X-axis handle translates the selected entity along world X only (its WorldTransform translation Y/Z unchanged within 1e-4) and the gizmo handles follow the entity
- [ ] Vitest: orbit controller math maps a given drag delta to the expected azimuth/elevation change and clamps elevation to avoid gimbal flip

**Study:** references/three.js examples/jsm/controls/OrbitControls.js and TransformControls.js (orbit + gizmo interaction model); references/engine camera scripts

**Watch out:** Controllers must write ONLY LocalTransform/Parent through the ECS component path — never cache a renderer scene-graph node (no public mutable scene graph invariant). The gizmo handles are real ECS entities (Pickable meshes), not renderer overlays, to stay within the architecture; they should be tagged/layer-masked so they do not interfere with normal scene picking. Drag-to-world projection needs the picking plane/axis math to be stable when the camera looks nearly down an axis (degenerate projection) — clamp/guard. Keep controllers headless-constructible (no DOM) so they run in the worker.

**Sequencing.** Three independent roots can start in parallel: M7-T1 (hierarchy), M7-T3 (component codec), M7-T6 (material mutation), and M7-T7 (camera ray + picking index) have no cross-dependencies and unblock the rest. M7-T2 follows T1. M7-T4 (scene save/load) and M7-T5 (prefab) both build on T3+T1. M7-T8 (pointer events) requires T7. M7-T9 (orbit/gizmo) requires T7+T8 (and uses T1 math for the gizmo). Recommended critical path: T7 -> T8 -> T9 (interaction stack) running alongside T1 -> {T2, T4, T5} (persistence/hierarchy stack), with T6 (materials) slotting in anywhere. Land T6 and T7 early since each independently produces a pixel-proven user-facing win and de-risks the harness.

**Proof.** Layered proof matching project conventions. UNIT (vitest, headless, in packages/simulation/test and packages/app/test): hierarchy world-preserving setParent + cycle rejection (T1), component codec round-trip across all field kinds incl. Entity refs (T3), whole-world scene round-trip with parent remap into a fresh world (T4), prefab independent-clone + overrides (T5), patchStandardMaterial immutability + version bump (T6), unprojection ray correctness for perspective+orthographic with NDC-Y flip (T7), click-vs-drag state machine + edge-triggered enter/leave (T8), orbit azimuth/elevation math (T9). PIXEL/RENDER-CONTROL + E2E (worker-authored examples/_.worker.js + _.main.js routes asserting JSON-safe status and pixel readback): material mutation flips a readback pixel from original to red with no new handle (T6); auto-populated picking index lets rayFromPointer->raycastFirst hit a spawned mesh with no manual setBounds (T7); pointer move over an entity fires exactly one enter/leave and a same-entity down+up fires one click while drag does not (T8); orbit drag rotates the camera (two differing readbacks, constant target distance) and zoom changes object screen coverage, gizmo X-drag translates along world X only (T9). REGRESSION: the existing developer-api.spec.ts is migrated so select.system.ts uses interaction.onClick, proving the new ergonomics subsume the old manual flow without losing the asserted selectedEntity/hitPoint diagnostics.

**SOTA bar (when to stop).** Good-enough for this milestone: scene/prefab persistence that losslessly round-trips ECS component state (transforms, names, parent/child, asset handle refs) as JSON — NOT a binary format, NOT partial/streaming scenes, NOT scene diff/patch/merge (Bevy's scene_patch is a stretch goal, skip). Hierarchy: bidirectional Children + world-preserving setParent + recursive despawn — do NOT chase per-subtree dirty-flag transform propagation here (that is a separate perf milestone; the existing full-resolve resolver is acceptable). Materials: scalar/color uniform-level live mutation within the same shader variant via versioned re-registration — do NOT build a material instance class with GPU-side hot-patching or variant-changing live edits (re-extraction is acceptable for variant flips). Picking/pointer events: correct CPU-ray + flat per-entity hover/enter/leave/down/up/click/drag — do NOT implement DOM-style bubbling/propagation/stopPropagation, multi-touch gestures, or marquee/multi-select (defer). Camera/gizmo: one solid orbit controller + one translate gizmo as copyable ECS-authoring helpers — do NOT ship a full editor with rotate/scale gizmos, snapping, multi-axis planes, or undo (translate-only proves the pattern). Stop when each slice has a vitest + a pixel/JSON-proven route and the developer-api example is migrated; resist gold-plating into a full editor or a reflection framework.

---

## M8 — Go GPU-driven: compute culling + compaction feeding real indirect draws, Hi-Z occlusion, bindless, mesh LOD <a id="m8"></a>

**Wave 3** · **Depends on:** M3 · 9 tasks (4×L, 5×M, 0×S)

> **Goal.** When this milestone is done, the engine can scale to large object counts without the JS thread doing per-object culling/draw-record work: a per-frame WebGPU compute pass reads per-instance world bounds (already carried in the snapshot's BoundsPacket worldAabb/worldSphere) plus the camera frustum, writes a compacted instance-index buffer and an atomically-counted indirect-argument buffer, and the render pass issues GPU-authored drawIndexedIndirect calls whose instanceCount originates from a GPU counter (not a CPU DrawCommand field). A Hi-Z depth pyramid built from the previous/early-phase depth feeds two-phase occlusion culling in the same compute pass. A pragmatic bindless layer (large texture-array + buffer-indexed material table) removes per-draw setBindGroup churn for a fixed material family so a single multi-draw / draw-count submission covers many batches. Discrete mesh LOD selection runs in the compute cull pass (screen-space-error metric) choosing per-instance index ranges. Each capability lands as a render-control/Playwright-provable example whose status JSON reports GPU-origin counts (e.g. computeCull.visibleInstances, indirectDraws.drawCount from a GPU count buffer, hiZ.culledInstances, lod.levelHistogram) and pixel readback proving correctness (off-screen/occluded objects absent, LOD swaps at distance).

**Current state (verified against source).** Verified by reading source. Culling, instance selection and indirect-arg authoring are ALL CPU-side: extraction-culling.ts:93-108 aabbIntersectsFrustum is a pure-JS per-plane test called per object from isVisibleInAnyMatchingView (30-62); indirect-draw-commands.ts writeIndirectArguments (288-317) copies instanceCount/indexCount/firstIndex/baseVertex/firstInstance straight from CPU DrawCommand objects into a Uint32Array uploaded via queue.writeBuffer (196-202), and writeIndirectCommandList (336-359) emits one drawIndirect/drawIndexedIndirect RenderPassCommand per CPU candidate — so the JS thread still records O(draws) commands and instanceCount NEVER comes from a GPU counter. There is NO drawIndexedIndirectCount/draw-count buffer (RenderPassCommandKind union in render-pass-commands.ts:3-13 has no count variant; executor render-pass-command-executor.ts supports only drawIndirect/drawIndexedIndirect at lines 172-191). The ONLY compute pipelines in the whole codebase are PMREM (pmrem-compute-pipeline.ts) and shadow-depth-probe.ts — there is no compute cull pass, no Hi-Z/depth pyramid (grep found zero), no bindless (only storage-array `array<mat4x4f> worldTransforms` at matcap-shader.ts:39 / standard-shader.ts:113,228, NOT WebGPU binding_array), and no mesh LOD (only texture lodMaxClamp). Occlusion culling exists but is hardware-query + CPU mapAsync readback (occlusion-query.ts, app/occlusion-culling.ts) gated behind `await waitForSubmittedWork` (frame-loop.ts:877) — at least one frame stale and O(draws) query slots. CRITICAL DEPENDENCY: there is NO render graph yet (M3). frame-loop.ts:201-952 is a 5-route if/else dispatcher; there is no PassNode/compute-pass node type, no transient resource scheduler, and assembleFrameBoundary creates one encoder per pass. Compute culling and Hi-Z MUST be scheduled as graph compute nodes feeding the indirect-arg buffer, so every task here is gated on M3 delivering: (a) a compute-pass node kind, (b) cross-pass resource handles surviving into the render pass, (c) single-encoder batching so the cull dispatch and the indirect draw share one command buffer. GOOD NEWS that de-risks the work: the snapshot already packs per-instance world bounds (BoundsPacket.worldAabb/worldSphere, snapshot-packet-types.ts:133-140, referenced by MeshDrawPacket.boundsIndex:54) and per-instance transforms in a single storage buffer (worldTransforms array indexed by @builtin(instance_index)); coalesceRenderQueueRecords already guarantees contiguous packed transform offsets (render-queue-batching.ts:99-100). The render report already surfaces an indirectDraws JSON block consumed by examples (instancing.main.js:180, instancing.spec.ts), giving a ready-made status surface to extend.

### Key entry points

| File / symbol                                                                        | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/webgpu/src/render/draw/indirect-draw-commands.ts`                          | CPU indirect-arg authoring to be SUPERSEDED. prepareIndirectDrawCommands (101-229) + writeIndirectArguments (288-317) define the 5-uint drawIndexedIndirect arg layout (indexCount/instanceCount/firstIndex/baseVertex/firstInstance) and the INDIRECT\|COPY_DST buffer (ensureIndirectDrawBuffer 242-286). A GPU path must produce an arg buffer in this exact layout but with INDIRECT\|STORAGE usage and instanceCount written by compute, not CPU. |
| `packages/webgpu/src/app/frame-boundary-support.ts`                                  | Single hook site. prepareWebGpuAppIndirectDrawCommands (line 44) is called from all 4 frame routes (frame-loop.ts:851, custom-wgsl-frame.ts:275, mixed-custom-wgsl-frame.ts:391, queued-built-in-frame.ts:325). The GPU-driven path is introduced here behind a capability flag; createGpuOcclusionQueryResources (imported line 3) is the pattern for allocating per-frame GPU resources by capacity.                                                 |
| `packages/render/src/rendering/extraction-culling.ts`                                | CPU frustum cull to be made OPTIONAL/bypassed when GPU culling is active. aabbIntersectsFrustum (93-108), createFrustumPlanes (110-136), computeViewDepth (77-91). The frustum-plane derivation must move to a GPU-uploadable per-view uniform; the per-object JS loop must be skippable so extraction just packs all candidate bounds.                                                                                                                |
| `packages/render/src/rendering/snapshot-packet-types.ts`                             | Data source for GPU culling. BoundsPacket (133-140) carries worldAabb + worldSphere per instance; MeshDrawPacket.boundsIndex (54) links draw->bounds. Extraction must pack these into a GPU storage buffer (center+radius or center+half-extents) parallel to the existing worldTransforms buffer.                                                                                                                                                     |
| `packages/webgpu/src/render/passes/render-pass-commands.ts`                          | Command union to EXTEND. RenderPassCommandKind (3-13) and the RenderPassCommand union (lines ~119-129) need a drawIndexedIndirectCount kind (count buffer + maxDrawCount). render-pass-command-executor.ts (172-191) needs the matching execution branch.                                                                                                                                                                                              |
| `packages/webgpu/src/materials/standard/standard-shader.ts`                          | Vertex shader instance addressing to be REDIRECTED. worldTransforms storage array (113,228) is indexed by @builtin(instance_index) (314,321,389...). For GPU compaction the shader must index transforms (and material slot for bindless) through a GPU-written compacted instance-index buffer instead of the raw instance_index. matcap-shader.ts:39-47 is the simpler first target.                                                                 |
| `packages/webgpu/src/lighting/pmrem-compute-pipeline.ts`                             | Reference pattern for compute pipeline creation in this codebase: PmremComputeDeviceLike capability gating (createShaderModule/createComputePipeline undefined checks 60-86), inline WGSL template, WORKGROUP_SIZE const, diagnostic-coded failure results. The cull compute pipeline mirrors this exact shape.                                                                                                                                        |
| `packages/webgpu/src/gpu/pipeline-cache.ts`                                          | Render pipeline cache keyed on bindGroupLayoutKeys/materialPipelineKey (44-51). A parallel compute-pipeline cache (or extension) is needed for cull/Hi-Z pipelines, and the bindless task removes per-material bindGroupLayoutKeys variance for a fixed family.                                                                                                                                                                                        |
| `packages/webgpu/src/gpu/initialize-webgpu.ts`                                       | WebGPU feature negotiation (205-238 requests timestamp-query/texture-compression/indirect-first-instance). Add optional negotiation for chromium-experimental-multi-draw-indirect with graceful capability flag + fallback to one-drawIndirect-per-batch.                                                                                                                                                                                              |
| `packages/webgpu/src/app/occlusion-culling.ts`                                       | Existing CPU-readback occlusion feedback (normalizeOcclusionQueryCommands 124-148, one query slot per draw). Hi-Z occlusion REPLACES this for the GPU-driven path; keep the report shape (WebGpuAppOcclusionCullingReport) for status-JSON continuity.                                                                                                                                                                                                 |
| `references/bevy/crates/bevy_pbr/src/render/mesh_preprocess.wgsl`                    | SOTA design anchor for the compute cull/preprocess pass: MeshCullingData (aabb_center/aabb_half_extents), two-phase early/late occlusion with depth_pyramid binding, FRUSTUM_CULLING/OCCLUSION_CULLING ifdef structure, PreprocessWorkItem indirection.                                                                                                                                                                                                |
| `references/bevy/crates/bevy_pbr/src/render/build_indirect_params.wgsl`              | SOTA anchor for GPU indirect-arg generation: atomicAdd into indirect_batch_sets to reserve a draw slot, writing instance_count/first_instance/base_vertex/index_count/first_index — exactly the multi-draw-count pattern this milestone needs.                                                                                                                                                                                                         |
| `references/bevy/crates/bevy_core_pipeline/src/mip_generation/downsample_depth.wgsl` | SOTA anchor for the Hi-Z depth-pyramid downsample compute shader (min-reduction mip chain).                                                                                                                                                                                                                                                                                                                                                            |
| `examples/instancing.main.js`                                                        | Proof-surface template. statusFromReport (160) emits indirectDraws (180) from webGpuAppRenderReportToJsonValue; instancing.worker.js builds a 1000-box grid. New examples (gpu-cull, hi-z-occlusion, mesh-lod) clone this triplet (.html/.main.js/.worker.js) + .spec.ts.                                                                                                                                                                              |

### Tasks

#### `M8-T1` · Pack per-instance GPU cull bounds into the snapshot and a GPU storage buffer

`render-bridge` · effort **M** · depends: none

Extend extraction so that, in addition to the existing CPU frustum path, every mesh-draw candidate's world bounds are packed into a contiguous typed array aligned 1:1 with the existing worldTransforms packing order (one record per instance, vec4 center.xyz+radius and vec4 halfExtents.xyz+pad, matching the order coalesceRenderQueueRecords guarantees via transformPackedOffset). Source the data from the already-extracted BoundsPacket.worldAabb/worldSphere (snapshot-packet-types.ts:133-140) keyed by MeshDrawPacket.boundsIndex (54). Add a packed-bounds codec next to the transform packing (transform-pack-instances.ts) and a snapshot field + transfer-list entry so it crosses the worker boundary. Upload it to a STORAGE buffer on the webgpu side parallel to worldTransforms. No culling behavior change yet — this is the data substrate.

**Touch:**

- `packages/render/src/rendering/transform-pack-instances.ts (add packSnapshotInstanceBoundsForCompute alongside transform packing)`
- `packages/render/src/rendering/snapshot-packet-types.ts (no shape change; consume BoundsPacket)`
- `packages/render/src/rendering/snapshot.ts + the transfer-list builder used by renderSnapshotTransferList (add packed-bounds typed array)`
- `packages/render/src/rendering/snapshot-packed-mesh-codec.ts (encode/decode the bounds buffer)`
- `packages/webgpu/src/resources/transforms (add a parallel instance-bounds storage buffer resource)`

**Done when:**

- [ ] A new vitest under test/rendering/ asserts that for a 3-instance coalesced draw the packed bounds buffer has length instanceCount\*8 floats and each record's center/radius equals the source BoundsPacket.worldSphere within 1e-5
- [ ] The bounds buffer survives renderSnapshotTransferList round-trip (structured-clone) verified by an existing snapshot-transport-style test
- [ ] A render-control status field reports instanceBounds.packedFloats > 0 for the instancing example without changing its pixel output (instancing.spec.ts still passes unchanged)

**Study:** references/bevy/crates/bevy_pbr/src/render/mesh_preprocess.wgsl (MeshCullingData aabb_center/aabb_half_extents layout)

**Watch out:** Packing order MUST match worldTransforms exactly or GPU indexing by instance_index breaks. Skinned/instance-attribute draws share the transform buffer — keep boundsIndex resolution consistent with worldTransformOffset. Keep extraction headless/worker-safe (no GPU types in packages/render).

#### `M8-T2` · Add a compute-pass node kind to the render graph and a cull compute pipeline cache

`webgpu-render` · effort **M** · depends: M8-T1

Gated on M3. Introduce a compute pass as a first-class node the graph can schedule before the opaque render pass, with its dispatched buffers exposed as resource handles consumable by the render pass within the same command encoder. Add a compute-pipeline creation+cache helper mirroring pmrem-compute-pipeline.ts (capability gating on createComputePipeline/createShaderModule, inline WGSL, diagnostic-coded failures) and extend pipeline-cache.ts (or a sibling compute-pipeline-cache.ts) to key/reuse cull pipelines. No culling logic yet — land an identity compute pass that copies CPU instanceCount into a STORAGE|INDIRECT arg buffer and have the render pass draw from it, proving the GPU-buffer-feeds-indirect-draw wiring end to end.

**Touch:**

- `packages/webgpu/src/render/passes/ (new compute-pass node type wired into the M3 graph scheduler)`
- `packages/webgpu/src/gpu/compute-pipeline-cache.ts (new; mirror pipeline-cache.ts structure)`
- `packages/webgpu/src/render/draw/gpu-indirect-arg-pipeline.ts (new; compute shader writing the 5-uint arg layout from indirect-draw-commands.ts)`
- `packages/webgpu/src/gpu/buffer.ts (allow INDIRECT|STORAGE|COPY_DST usage combo)`

**Done when:**

- [ ] A render-control example (gpu-indirect-identity) renders the 1000-box instancing scene where the indirect arg buffer is written by a compute dispatch (not queue.writeBuffer), and its status JSON reports computePass.dispatched:true and argBuffer.usage includes STORAGE — pixels match the existing CPU-indirect instancing pixel assertions
- [ ] webGpu validation console guard reports zero validation errors (attachWebGpuValidationConsoleGuard) confirming the STORAGE+INDIRECT buffer is bound and drawn correctly
- [ ] A vitest asserts the compute-pipeline cache returns hit on the second identical request and miss on a workgroup-size change

**Study:** packages/webgpu/src/lighting/pmrem-compute-pipeline.ts (pipeline creation/gating shape) + references/bevy/crates/bevy_pbr/src/render/build_indirect_params.wgsl

**Watch out:** Hard-gated on M3 delivering compute-node scheduling + single-encoder batching + cross-pass resource handles; if M3 only gives render passes, this task stalls. The arg buffer needs INDIRECT|STORAGE simultaneously — verify the device allows it. Do not regress the existing CPU prepareIndirectDrawCommands path; the GPU path must be selectable, with CPU as fallback.

#### `M8-T3` · GPU compute frustum culling + instance compaction feeding indirect draws

`webgpu-render` · effort **L** · depends: M8-T2

Replace the identity compute pass with real frustum culling. The compute shader reads the per-instance bounds buffer (M8-T1), the camera frustum planes (derived from view-proj, uploaded as a per-view uniform — port createFrustumPlanes math from extraction-culling.ts:110-136 into WGSL like meshlet_cull_shared.wgsl aabb_in_frustum), tests each instance, atomicAdd-compacts visible instance indices into a compacted-index storage buffer, and atomically accumulates per-batch instanceCount into the indirect arg buffer. Redirect the vertex shader to index worldTransforms through the compacted index buffer (start with matcap-shader.ts:39-47, then standard-shader.ts:113/228) so only visible instances draw. Make extraction's CPU frustum loop bypassable (isVisibleInAnyMatchingView short-circuit) when GPU culling is active, so the JS thread stops doing per-object work.

**Touch:**

- `packages/webgpu/src/render/draw/gpu-cull-pipeline.ts (new; frustum cull + compaction compute WGSL)`
- `packages/webgpu/src/materials/matcap/matcap-shader.ts (index worldTransforms via compacted index buffer)`
- `packages/webgpu/src/materials/standard/standard-shader.ts (same redirection, all instance_index sites 314-440)`
- `packages/render/src/rendering/extraction-culling.ts (add gpuCullingActive bypass of the per-object JS test)`
- `packages/webgpu/src/app/frame-boundary-support.ts (route prepareWebGpuAppIndirectDrawCommands to the GPU path when enabled)`

**Done when:**

- [ ] A render-control example (gpu-cull) places a grid of instances spanning on- and off-screen; status JSON reports computeCull.totalInstances, computeCull.visibleInstances (from the GPU atomic counter) and computeCull.visibleInstances < totalInstances, and pixel readback at off-screen-mapped sample points shows clear-color (culled) while on-screen points show the mesh color
- [ ] A Playwright spec asserts the visible count from the GPU counter matches the count of on-screen instances for a known camera, and that rotating the camera 180deg flips which instances are counted visible
- [ ] With GPU culling enabled, the CPU cull stats (MutableViewCullStats.tested) report 0 tested objects, proving the JS per-object loop was bypassed

**Study:** references/bevy/crates/bevy_pbr/src/meshlet/meshlet_cull_shared.wgsl (aabb_in_frustum) + mesh_preprocess.wgsl (FRUSTUM_CULLING + compaction)

**Watch out:** WGSL frustum math must match the CPU normalizePlane sign convention exactly or visible/culled inverts. atomicAdd compaction makes draw order non-deterministic within a batch — fine for opaque depth-tested, but transparent sorting must stay on the CPU path (gate GPU culling to opaque+depth-tested batches). Multi-view (shadow + main) needs per-view compacted buffers; scope this task to the single main view and defer multi-view culling.

#### `M8-T4` · Multi-draw-indirect / draw-count buffer so one submission covers many batches

`webgpu-render` · effort **M** · depends: M8-T3

Add a drawIndexedIndirectCount command kind (count buffer + maxDrawCount + arg-buffer stride) to RenderPassCommandKind/RenderPassCommand (render-pass-commands.ts:3-13) and the matching execution branch in render-pass-command-executor.ts (after the drawIndexedIndirect branch at 183-191). Negotiate the chromium-experimental-multi-draw-indirect feature in initialize-webgpu.ts (alongside indirect-first-instance) with a capability flag; when present, the compute pass writes a GPU draw-count and the render pass issues a single multiDrawIndexedIndirect spanning all batches; when absent, fall back to the current one-drawIndirect-per-batch loop. The compute cull pass (M8-T3) writes the count via atomicAdd over surviving batches (port build_indirect_params.wgsl indirect_batch_sets pattern).

**Touch:**

- `packages/webgpu/src/render/passes/render-pass-commands.ts (add DrawIndexedIndirectCountCommand to union + kind)`
- `packages/webgpu/src/render/passes/render-pass-command-executor.ts (add multiDrawIndexedIndirect/drawIndexedIndirectCount branch)`
- `packages/webgpu/src/gpu/initialize-webgpu.ts (negotiate multi-draw-indirect feature + flag)`
- `packages/webgpu/src/render/draw/gpu-cull-pipeline.ts (write GPU draw-count buffer)`

**Done when:**

- [ ] On a device with multi-draw-indirect, a render-control example (gpu-multidraw) renders N distinct mesh+material batches with ONE drawIndexedIndirectCount command; status JSON reports indirectDraws.drawCommandsRecorded:1 and indirectDraws.gpuDrawCount equal to the number of non-empty batches, with pixels matching the per-batch baseline
- [ ] On a device WITHOUT the feature, the same example reports indirectDraws.fallbackReason:'multi-draw-unsupported' and renders identical pixels via the per-batch loop (capability fallback proven)
- [ ] Vitest asserts the executor calls multiDrawIndexedIndirect once with the count buffer when the command kind is drawIndexedIndirectCount, and falls back to a per-batch drawIndexedIndirect list otherwise

**Study:** references/bevy/crates/bevy_pbr/src/render/build_indirect_params.wgsl (atomicAdd into indirect_batch_sets, MULTI_DRAW_INDIRECT_COUNT_SUPPORTED branch)

**Watch out:** chromium-experimental-multi-draw-indirect is behind a flag (launch arg --enable-unsafe-webgpu already present in render-control.mjs) and may be unavailable in headless CI — the fallback path MUST be the tested-by-default path with multi-draw as the enhancement. Arg-buffer stride and count-buffer offset alignment (4 bytes) must match the spec or draws are silently dropped.

#### `M8-T5` · Hi-Z depth pyramid build pass

`webgpu-render` · effort **M** · depends: M8-T2

Gated on M3. Add a depth-pyramid (Hi-Z) compute build pass that takes the scene depth texture and produces a min-reduction mip chain in a single-channel storage texture, scheduled after the opaque depth is available. Port the downsample min-reduction from references/.../downsample_depth.wgsl. Expose the pyramid as a graph resource handle (and as cross-frame history for the early/late two-phase scheme). This is the data substrate for occlusion culling; no culling decision yet.

**Touch:**

- `packages/webgpu/src/render/passes/hi-z-pyramid-pass.ts (new; min-reduction downsample compute WGSL + mip-chain dispatch)`
- `packages/webgpu/src/resources/textures (add a storage depth-pyramid texture resource with full mip chain)`
- `packages/webgpu/src/gpu/compute-pipeline-cache.ts (cache the downsample pipeline; reuse from M8-T2)`

**Done when:**

- [ ] A render-control example (hi-z-pyramid) renders a scene then reads back selected texels of the depth pyramid; status JSON reports hiZ.mipLevels = ceil(log2(max(w,h)))+1 and a coarse mip texel equals the min of its 2x2 footprint within tolerance
- [ ] WebGPU validation guard reports zero errors for the storage-texture mip writes
- [ ] Vitest asserts the dispatch count per mip level equals ceil(dim/workgroupSize) for a 1024x1024 input

**Study:** references/bevy/crates/bevy_core_pipeline/src/mip_generation/downsample_depth.wgsl

**Watch out:** Reversed-Z vs standard depth changes whether min or max reduction is conservative — match the engine's existing depthCompare convention. Storage-texture writes per mip need either per-mip bind groups or a single-pass SPD-style shader; start with per-mip dispatches for correctness, optimize later. Requires the scene depth texture to be readable (sampled) — confirm M3 declares depth as a graph resource, not transient/discarded.

#### `M8-T6` · Two-phase Hi-Z occlusion culling integrated into the compute cull pass

`webgpu-render` · effort **L** · depends: M8-T3, M8-T5

Extend the frustum cull compute shader (M8-T3) to additionally project each instance's world AABB to screen, sample the Hi-Z pyramid (M8-T5) at the appropriate mip, and cull instances whose closest depth is behind the pyramid's far depth. Implement the standard two-phase scheme: early phase culls using last frame's pyramid + last-frame-visible set; render those; rebuild the pyramid; late phase tests the remaining (previously-invisible) instances and appends newly-visible ones to a second indirect batch. This REPLACES the CPU-readback hardware-occlusion path (app/occlusion-culling.ts) for the GPU-driven route while preserving the WebGpuAppOcclusionCullingReport JSON shape for status continuity. Remove the frame-loop.ts:877 `await waitForSubmittedWork` stall for this route (no CPU readback dependency).

**Touch:**

- `packages/webgpu/src/render/draw/gpu-cull-pipeline.ts (add OCCLUSION_CULLING early/late phases + screen-space AABB + pyramid sample)`
- `packages/webgpu/src/app/occlusion-culling.ts (map GPU occlusion counts into WebGpuAppOcclusionCullingReport)`
- `packages/webgpu/src/app/frame-loop.ts (skip waitForSubmittedWork when GPU occlusion active)`
- `packages/webgpu/src/resources/textures (double-buffer the Hi-Z pyramid across frames for early phase)`

**Done when:**

- [ ] A render-control example (hi-z-occlusion) places a large occluder fully covering smaller objects behind it; status JSON reports occlusion.gpuCulledInstances > 0 and occlusion.method:'hi-z' (not 'hardware-query'), and pixel samples behind the occluder show the occluder color while the occluded objects contribute zero draws (verified by occlusion.visibleInstances dropping when the occluder is in front)
- [ ] Moving the occluder aside in a subsequent frame re-admits the previously-occluded objects within one frame (late-phase appends them) — proven by a 2-frame Playwright sequence asserting visibleInstances rises and the previously-hidden pixel sample changes color
- [ ] The frame report no longer depends on occlusion-query mapAsync for this route (no occlusionQueryReadbacks consumed); existing occlusion-feedback.spec.ts still passes on the legacy hardware-query route

**Study:** references/bevy/crates/bevy_pbr/src/render/mesh_preprocess.wgsl (EARLY_PHASE/LATE_PHASE occlusion + depth_pyramid sampling) and meshlet_cull_shared.wgsl (screen AABB)

**Watch out:** One-frame popping if the early phase uses a stale pyramid without a late correction — the late phase is mandatory for correctness, do not ship early-only. Conservative depth test must use the AABB's nearest depth and the pyramid mip whose texel covers the screen footprint, else over-culling drops visible objects (a hard visual bug). Two-phase requires two indirect batches + two render-pass submissions sharing the encoder — confirm M3 single-encoder batching supports interleaved compute/render/compute/render.

#### `M8-T7` · Pragmatic bindless: texture-array + buffer-indexed material table for a fixed material family

`webgpu-render` · effort **L** · depends: M8-T4

Remove the per-draw setBindGroup churn that structurally blocks true GPU-driven submission. WebGPU lacks general bindless, so implement the pragmatic path: (a) a large 2D texture array holding all textures of a material family with a per-instance texture-layer index, and (b) a single material-parameter storage buffer indexed by a per-instance materialSlot (already present as MeshDrawPacket.materialSlot:44). The compute cull pass writes per-visible-instance the materialSlot + texture-layer into the compacted instance record; the standard/unlit shaders read material params and sample the texture array by that index instead of binding a per-material group. This lets many materials draw under ONE pipeline + ONE bind group, so the multi-draw (M8-T4) submission spans heterogeneous materials. Scope to the unlit family first, then standard.

**Touch:**

- `packages/webgpu/src/materials/unlit/ (texture-array sampling + buffer-indexed params; first target)`
- `packages/webgpu/src/materials/standard/standard-shader.ts (material storage table indexed by instance materialSlot)`
- `packages/webgpu/src/resources/textures (allocate the shared material texture array; pack member textures into layers)`
- `packages/webgpu/src/gpu/pipeline-cache.ts (collapse bindGroupLayoutKeys variance for the bindless family so one pipeline serves many materials)`
- `packages/render/src/rendering/ (extract material->slot/layer mapping into the snapshot for the bindless family)`

**Done when:**

- [ ] A render-control example (bindless-materials) draws 100 boxes with 8 distinct unlit textures/colors under ONE pipeline and ONE setBindGroup; status JSON reports bindless.materialFamily:'unlit', bindless.distinctMaterials:8, and setBindGroup pressure (RenderPassCommandPressureReport.setBindGroup.emitted) == a small constant independent of distinctMaterials
- [ ] Pixel readback confirms each box shows its correct texture/color (8 distinct sample points match 8 expected colors), proving per-instance material indexing works
- [ ] A vitest asserts that for the bindless family the pipeline cache returns the same pipeline key for materials differing only in texture/color (variance collapsed)

**Study:** references/three.js/src/renderers/common (WebGPU texture-array + storage-indexed material patterns) and references/bevy bindless material docs

**Watch out:** All textures in one array must share format+size — needs an atlas/array-packing step and a fallback for mismatched textures (keep them on the legacy per-material path). Texture-array layer count is capped (maxTextureArrayLayers); design for spillover into multiple arrays. This is the riskiest task: do NOT attempt WebGPU binding_array (unsupported); the buffer-indexed approach is the only portable path in 2026. Keep the legacy per-material bind path intact as fallback.

#### `M8-T8` · Discrete mesh LOD selection in the compute cull pass

`render-bridge` · effort **M** · depends: M8-T3

Add a mesh-LOD authoring component and snapshot representation: a LOD group binds N (indexRange, screenError-or-distance-threshold) levels for one logical mesh. Extraction packs the per-level index ranges + thresholds into a GPU-readable table keyed by the draw, plus the per-instance world-space LOD sphere (reuse worldSphere from BoundsPacket). The compute cull pass computes a per-instance screen-space-error metric (port the perspective branch of meshlet_cull_shared.wgsl lod_error_is_imperceptible) and selects the LOD level, writing the chosen indexCount/firstIndex into that instance's indirect arg slot. Visible instances of different LODs of the same mesh accumulate into per-LOD indirect batches. Discrete only; continuous/morph LOD is out of scope for this milestone.

**Touch:**

- `packages/render/src/rendering/authoring-components-spatial.ts (add a MeshLodGroup authoring component next to Pickable/MeshQueryAcceleration)`
- `packages/render/src/rendering/extraction-meshes.ts (emit per-level index ranges + thresholds into the snapshot)`
- `packages/webgpu/src/render/draw/gpu-cull-pipeline.ts (screen-error LOD selection writing per-instance index range into arg buffer)`
- `packages/render/src/rendering/snapshot-packet-types.ts (add LOD level table to MeshDrawPacket or a sibling packet)`

**Done when:**

- [ ] A render-control example (mesh-lod) places identical instances at increasing camera distance with a 3-level LOD group (high/med/low index counts); status JSON reports lod.levelHistogram (count per level) showing near instances at level 0 and far instances at level 2, and the GPU arg buffer's indexCount per instance matches the selected level
- [ ] Moving the camera closer in a 2-frame Playwright sequence shifts the histogram toward level 0 and the rendered silhouette gains detail (pixel diff at a silhouette edge between near and far frames)
- [ ] A vitest asserts the screen-error->level mapping picks the expected level for a known distance/threshold set

**Study:** references/bevy/crates/bevy_pbr/src/meshlet/meshlet_cull_shared.wgsl (lod_error_is_imperceptible perspective branch) and references/engine LOD component patterns

**Watch out:** Per-instance index ranges mean instances of the same mesh-LOD must share the same index/vertex buffer with offset ranges — the LOD levels must be uploaded into one shared index buffer (or the arg buffer's firstIndex/baseVertex must address distinct buffers, which multi-draw cannot span). Constrain LOD levels of one group to one index buffer. Without per-instance metric the existing computeViewDepth (extraction-culling.ts:77-91) is depth-for-sort only and insufficient — the screen-error must come from the projection matrix in WGSL.

#### `M8-T9` · Optional deferred / visibility-buffer path selectable via the render graph

`webgpu-render` · effort **L** · depends: M8-T4, M8-T6

Gated on M3. Expose a graph-level lighting-topology selection so an app can opt into a deferred (G-buffer) or visibility-buffer path instead of the default forward route, leveraging the now-GPU-driven draw submission. Implement at least the deferred path: a geometry pass writes a G-buffer (albedo/normal/material-id) via GPU-driven indirect draws, then a full-screen lighting compute/render pass resolves it (reuse the existing clustered local-light resources referenced by withStandardClusteredLocalLightPipelineKeys). The path is chosen as a graph composition, not an if/else in frame-loop.ts. Visibility-buffer is a stretch goal documented but may be deferred to a later milestone.

**Touch:**

- `packages/webgpu/src/render/passes/ (deferred g-buffer pass node + deferred lighting resolve node, scheduled by M3 graph)`
- `packages/webgpu/src/render/draw/ (route GPU-driven indirect draws into the g-buffer pass)`
- `packages/webgpu/src/app/ (expose lightingTopology:'forward'|'deferred' option threaded into graph construction)`
- `packages/webgpu/src/lighting/ (reuse clustered local-light binning in the deferred resolve)`

**Done when:**

- [ ] A render-control example (deferred-pipeline) renders a multi-light scene via the deferred path; status JSON reports renderGraph.lightingTopology:'deferred', renderGraph.passes includes 'g-buffer' and 'deferred-lighting', and pixels match the forward-rendered baseline of the same scene within a tolerance (parity test)
- [ ] Switching the same scene to lightingTopology:'forward' produces the existing forward pixels and the status reports the forward pass set — proving the topology is graph-selectable, not hardcoded
- [ ] The g-buffer geometry pass uses the GPU-driven indirect draw count from M8-T4 (status reports gBuffer.indirectDraws.gpuDrawCount), not CPU-recorded per-draw commands

**Study:** references/bevy/crates/bevy_pbr deferred + references/engine clustered deferred; references/three.js WebGPU node post for the resolve pass

**Watch out:** Highest-dependency task: needs M3 graph composition, GPU-driven draws (T4), and ideally Hi-Z (T6). Deferred transparency still needs a forward pass — the graph must compose deferred-opaque + forward-transparent, do not assume a single topology covers the whole frame. MSAA + deferred is costly; scope to non-MSAA deferred first. Parity tolerance must account for clustered-light binning differences between forward+ and deferred.

**Sequencing.** Everything is gated on M3 (render graph) delivering a compute-pass node kind, cross-pass resource handles, and single-encoder batching — confirmed absent today (frame-loop.ts is a 5-route if/else with no PassNode/compute node; assembleFrameBoundary creates one encoder per pass). Critical path: M8-T1 (data substrate, the ONLY task with no M3 dependency — start immediately and in parallel with M3) -> M8-T2 (compute-node + identity GPU arg buffer, proves the wiring) -> M8-T3 (real frustum cull + compaction, the core scalability win). Two independent branches fork after T2/T3: (a) submission scaling M8-T4 (multi-draw) -> M8-T7 (bindless) -> M8-T9 (deferred); (b) occlusion M8-T5 (Hi-Z build) -> M8-T6 (two-phase occlusion). M8-T5 depends only on T2 so it can run in parallel with T3. M8-T8 (mesh LOD) depends only on T3 and can run in parallel with the T4/T5 branches. M8-T9 is the capstone needing T4 + T6. If M3 slips, only M8-T1 can proceed; mark T2-T9 blocked.

**Proof.** Each task ships a render-control/Playwright example triplet (examples/<name>.html + .main.js + .worker.js) plus test/e2e/<name>.spec.ts, cloning the proven instancing.main.js -> statusFromReport -> webGpuAppRenderReportToJsonValue -> status JSON pattern (instancing.spec.ts is the template; it already round-trips an indirectDraws block). The status JSON is extended with GPU-origin counters that a CPU path cannot fake: computeCull.visibleInstances (from a GPU atomic counter), indirectDraws.gpuDrawCount (from a GPU count buffer), hiZ.mipLevels / occlusion.gpuCulledInstances, lod.levelHistogram, bindless.distinctMaterials with setBindGroup pressure held constant. Correctness is proven by pixel readback at known sample points (off-screen/occluded objects absent = clear color; on-screen present; LOD silhouette diffs; 8 distinct bindless colors) using readPngPixel/pixelDistance from test/e2e/png.js, and every spec runs attachWebGpuValidationConsoleGuard to assert zero WebGPU validation errors. Cross-thread data integrity (T1) and pure logic (frustum WGSL parity, LOD level mapping, executor command branches, pipeline-cache hit/miss) are covered by Vitest under test/rendering and test/. Capability fallbacks (multi-draw-indirect absent, bindless texture-array mismatch) are asserted to render identical pixels via the legacy path so CI without the experimental flag stays green.

**SOTA bar (when to stop).** SOTA here is Bevy/Nanite-class GPU-driven rendering (compute cull + two-phase Hi-Z + multi-draw-count + meshlets + virtual geometry). For Aperture in 2026 the pragmatic 'good enough' bar is: (1) draw submission cost decoupled from object count for opaque depth-tested geometry — the JS thread stops per-object culling and stops recording O(draws) commands (CPU cull stats read 0 tested); (2) GPU frustum + two-phase Hi-Z occlusion replacing the stale CPU-readback hardware-query path; (3) one multi-draw submission per material family where the feature exists, with a clean per-batch fallback where it does not (this is the realistic 2026 WebGPU ceiling — chromium-experimental-multi-draw-indirect is flag-gated); (4) discrete mesh LOD via screen-error. STOP SHORT OF: software-rasterized meshlets / visibility-buffer virtual geometry (the [minor] meshlet gap) and true bindless binding_array (genuinely unsupported in WebGPU 2026) — the buffer-indexed + texture-array approach is the correct portable substitute and should be explicitly documented as the deliberate, not deficient, choice. Continuous/morph LOD and mesh simplification/decimation generation are out of scope for M8 (they belong to a geometry-pipeline milestone). Deferred path (T9) is worth landing for the graph-selectability proof but visibility-buffer can be a documented stretch goal. The win to optimize for is the scalability inflection (10k+ instances at constant JS cost), not feature-checklist parity with Nanite.

---

## M9 — Positional indirect lighting: reflection probes + light/irradiance probes <a id="m9"></a>

**Wave 4** · **Depends on:** M3, M5 · 4 tasks (3×L, 1×M, 0×S) · _design-level (code does not exist yet — entry points are directional)_

> **Goal.** Indirect light becomes spatially varying instead of a single global environment: parallax-corrected local reflection probes and SH-based light/irradiance probes (DDGI-style volumes) let interiors and multi-room scenes light correctly. Capture passes are hosted by the render graph (M3); the IBL math they feed is the corrected split-sum/irradiance pipeline from M5.

**Current state (verified against source).** Confirmed absent: no light probes / irradiance volumes (SH-based local indirect), no local or parallax-corrected reflection probes (only a single global specular env via PMREM), no screen-space GI (SSGI/RTGI), no baked lightmaps / lightmapper and no UV2 lightmap channel, no hemisphere (sky/ground) light. The existing PMREM + clustered froxel infrastructure is the right substrate to build on.

### Key entry points

| File / symbol                                                      | Role                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `packages/webgpu/src/lighting/ibl-*.ts, pmrem-compute-pipeline.ts` | Existing environment-capture/prefilter machinery to generalize from one global probe to N positioned probes. |
| `packages/webgpu/src/lighting/local-light-clusters.ts`             | The froxel/cluster grid — the natural place to also bin reflection/light probes per view region.             |
| `M5 corrected IBL pipeline + M3 FrameGraph`                        | Probes need correct split-sum/irradiance evaluation (M5) and graph-hosted capture/relight passes (M3).       |

### Tasks

#### `M9-T1` · Hemisphere/ambient light + cheap global SH

`webgpu-render` · effort **M** · depends: M5-T2

Add a hemisphere (sky/ground) light and a global SH ambient term as the cheapest rung of indirect light before full probes.

**Touch:**

- `packages/webgpu/src/lighting`
- `packages/render/src/rendering/extraction-lights.ts`

**Done when:**

- [ ] A route shows correct sky/ground ambient gradient on a neutral sphere (pixel assertion)

**Study:** references/three.js HemisphereLight; SH ambient

**Watch out:** Cheap win; do first to de-risk the SH plumbing probes will reuse.

#### `M9-T2` · Parallax-corrected reflection probes

`webgpu-render` · effort **L** · depends: M3-T7, M5-T1

Author probe volumes (box/sphere proxy), capture cubemaps via graph render passes, prefilter with the existing PMREM pipeline, and blend per-fragment with parallax correction + probe selection.

**Touch:**

- `new probe authoring components`
- `generalize pmrem-compute-pipeline.ts to N probes`
- `probe selection/blend in standard-shader-ibl-sampling.ts`

**Done when:**

- [ ] A two-room route shows distinct, correctly-parallaxed local reflections per room (pixel assertion in each room)

**Study:** references/engine reflection probes; box-projected cubemap technique

**Watch out:** Capture cost — support static bake-once + update-frequency policy from the start.

#### `M9-T3` · Irradiance volumes (SH light probes / DDGI-lite)

`webgpu-render` · effort **L** · depends: M9-T1, M3-T7

Grid of SH irradiance probes baked (or updated) from the scene, sampled trilinearly for diffuse indirect on dynamic objects.

**Touch:**

- `new probe-volume authoring + bake/update passes`
- `SH sampling in the standard diffuse-IBL path`

**Done when:**

- [ ] A route shows a dynamic object picking up bounced color as it moves between differently-lit zones (pixel assertion at two positions)

**Study:** DDGI / irradiance-volume technique; references/engine

**Watch out:** Decide baked vs runtime-updated; leakage control (visibility/depth) is the hard part.

#### `M9-T4` · Lightmaps + UV2 (stretch)

`render-bridge` · effort **L** · depends: none

Import baked lightmaps + a UV2 channel from glTF and apply in the standard material.

**Touch:**

- `glTF UV2 import`
- `standard material lightmap sampling`

**Done when:**

- [ ] A glTF with a baked lightmap renders with the baked GI (pixel assertion vs unlit)

**Study:** glTF lightmap conventions; references/three.js

**Watch out:** Mostly an import + sampling slice; independent of probes.

**Sequencing.** T1 first (cheap, de-risks SH). T2 and T3 are the core, both gated on M3 + M5. T4 is an independent import slice that can land anytime.

**Proof.** Multi-zone routes (two-room reflections, gradient-lit irradiance) with per-zone pixel assertions; probe counts + capture timing in status.

**SOTA bar (when to stop).** Good enough = local reflections + diffuse irradiance volumes that make interiors believable. Real-time RTGI/SSGI and a full lightmapper/baker are beyond this milestone.

---

## M10 — Physics + WebXR on the prepared boundaries <a id="m10"></a>

**Wave 4** · **Depends on:** M2, M7 · 4 tasks (2×L, 2×M, 0×S) · _design-level (code does not exist yet — entry points are directional)_

> **Goal.** Two large, well-isolated pillars the architecture was deliberately reserved for. Physics: a worker-side physics engine (Rapier/Jolt) driving rigidbodies/colliders with contact/trigger events on a fixed-timestep substep, feeding ECS transforms. WebXR: enter VR/AR, render stereo through the already-view-indexed snapshot, and route controller/hand input — the load-bearing capability for the IWSDK-replacement North Star.

**Current state (verified against source).** Both confirmed entirely absent and documented as current-version non-goals. No physics engine/rigidbody/real collider/contact events and no fixed-timestep substepping (the 'collider' hits are spatial-query types, not physics). No WebXR session management, no stereo/multi-view execution despite the view-indexed snapshot layout, no XR input (xr-standard gamepads are actively dropped today), and the Camera cannot accept XR-supplied per-eye projection/view matrices. The worker-authoritative sim + multi-view snapshot model is a genuine head start for both.

### Key entry points

| File / symbol                                                                       | Role                                                                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/runtime/src (simulation-worker.ts, shared-snapshot-transport.ts)`         | Worker boundary + SAB transport — where a fixed-timestep physics step and XR-late-pose application hook in. |
| `packages/render/src/rendering snapshot view-pack (multi-view layout)`              | Snapshot is already view-indexed — the substrate for per-eye stereo without a redesign.                     |
| `packages/app/src/input (gamepads.ts drops xr-standard today) + systems/cameras.ts` | XR input routing + per-eye camera matrix injection.                                                         |

### Tasks

#### `M10-T1` · Physics integration point + colliders/rigidbodies

`simulation` · effort **L** · depends: none

Choose Rapier (WASM, worker-friendly) or Jolt; add Collider/RigidBody ECS components and a fixed-timestep substep system that writes resolved transforms back to ECS.

**Touch:**

- `new physics resource + system in simulation/runtime`
- `Collider/RigidBody authoring components`

**Done when:**

- [ ] A headless test simulates a falling/bouncing body deterministically across N fixed steps
- [ ] A render-control route shows stacked bodies settling under gravity

**Study:** references/engine (Ammo) physics component model; Rapier docs; references/bevy Avian/Rapier patterns

**Watch out:** Keep physics worker-authoritative and fixed-timestep, decoupled from render framerate; transforms stay ECS-owned.

#### `M10-T2` · Collision/trigger events + physics raycast

`simulation` · effort **M** · depends: M10-T1

Surface contact-begin/stay/end and trigger events into the ECS event stream; expose physics raycasts (reuse the picking/ray API shape).

**Touch:**

- `physics event bridge`
- `raycast API`

**Done when:**

- [ ] A test asserts trigger enter/exit events and a physics raycast hit

**Study:** references/engine collision events

**Watch out:** Event ordering vs substeps must be deterministic.

#### `M10-T3` · WebXR session + stereo execution

`webgpu-render` · effort **L** · depends: M3-T1

XR session lifecycle (enter/exit VR & AR), an XR frame loop driving the existing view-indexed snapshot for two eyes, and feeding XRView per-eye projection/view matrices into the camera path.

**Touch:**

- `new XR session module in app/webgpu`
- `per-eye matrix injection into systems/cameras.ts + view-pack`

**Done when:**

- [ ] An XR route enters an immersive session and renders correct stereo (verified via the XR emulator / device)
- [ ] Per-eye matrices flow from XRView, not authored cameras

**Study:** references/three.js WebXRManager; Wonderland/Babylon WebXR

**Watch out:** Late head-pose application for low latency; the render-graph (M3) should own the per-eye pass structure.

#### `M10-T4` · XR input: controllers + hands

`render-bridge` · effort **M** · depends: M10-T3

Stop dropping xr-standard gamepads; expose controller poses/buttons and hand-tracking joints as ECS-readable input, plus transient pointer select.

**Touch:**

- `packages/app/src/input/gamepads.ts (currently drops xr-standard)`
- `new XR input source mapping`

**Done when:**

- [ ] An XR route shows tracked controllers/hands and a select-driven interaction

**Study:** references/three.js XRControllerModelFactory / hand input; WebXR input profiles

**Watch out:** Hand-tracking joint volume is large — keep it snapshot-packed.

**Sequencing.** Physics (T1→T2) and XR (T3→T4) are independent tracks. XR depends on M3 owning the per-eye pass structure. Both are sequenced late (after animation/scene/interaction stabilize) but the boundaries should be protected now.

**Proof.** Headless deterministic physics tests + a settling-bodies route; XR routes validated via the WebXR emulator in Playwright where possible, plus device smoke.

**SOTA bar (when to stop).** Good enough physics = rigidbodies, colliders, triggers, raycasts on a worker fixed-timestep. Good enough XR = stereo VR + AR passthrough with controller/hand input. Character controllers, vehicles, joints, foveation, anchors, and depth sensing are follow-ons.

---

## M11 — Editor, framework integrations, on-screen tooling, HMR & ecosystem <a id="m11"></a>

**Wave 4** · **Depends on:** M1, M7 · 5 tasks (3×L, 1×M, 1×S) · _design-level (code does not exist yet — entry points are directional)_

> **Goal.** The capstone that converts a powerful runtime into an adoptable engine: a visual scene editor/inspector, React/Vue bindings, an on-screen stats overlay, state-preserving HMR for systems, a generated API reference, and a hosted, learning-oriented example gallery. The existing agent-native MCP tooling is a unique asset to build the editor's backend on.

**Current state (verified against source).** Confirmed absent: no visual scene editor/inspector application, no end-user (non-agent) in-browser devtools panel (devtools are agent-gated), no framework integration (React/R3F-style, Vue, Svelte), no on-screen stats/FPS/profiler overlay, no true HMR for systems (editing a system requires a full page reload), no hosted learning-oriented example gallery (examples are an internal debug harness), thin user-facing docs / no generated API reference, and no community distribution surface (CDN, addon registry, examples site). Note: the ~55-tool MCP server + structured diagnostics are a genuine, reusable backend for the editor.

### Key entry points

| File / symbol                                                  | Role                                                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/cli/src (MCP server, dev session, reference RAG)`    | Reuse the agent control surface as the editor's runtime backend (query/mutate ECS, pick, camera control). |
| `packages/app/src/browser/devtools (agent-gated)`              | Generalize the agent-gated devtools into an end-user inspector panel.                                     |
| `packages/vite-plugin/src (system-discovery, virtual-modules)` | Foundation for true system HMR.                                                                           |
| `M7 serialization + M1 published packages`                     | An editor needs scene save/load (M7) and installable packages (M1) to exist first.                        |

### Tasks

#### `M11-T1` · On-screen stats/profiler overlay

`runtime-orchestration` · effort **S** · depends: none

A stats.js-equivalent overlay surfacing FPS, frame-phase timings, draw counts, and GPU timestamps you already collect.

**Touch:**

- `new overlay reading existing app/browser status + GPU timing`

**Done when:**

- [ ] An opt-in overlay shows live FPS/draw/phase timings on any route

**Study:** stats.js; references/engine mini-stats

**Watch out:** Cheap, immediate DX win; do first.

#### `M11-T2` · Framework bindings (React first)

`runtime-orchestration` · effort **L** · depends: M1-T11

An R3F-style declarative React binding over the ECS/app surface (and a lean Vue/vanilla story), so the engine is reachable from the dominant web stack.

**Touch:**

- `new @aperture-engine/react package`

**Done when:**

- [ ] A React app declaratively spawns/updates ECS entities and renders, proven by an example + test

**Study:** @react-three/fiber reconciler model

**Watch out:** Map declarative props to ECS commands without smuggling in a mutable scene graph.

#### `M11-T3` · System HMR

`docs-tooling` · effort **M** · depends: none

State-preserving hot reload of systems/config via the vite-plugin so editing a system does not require a full page reload.

**Touch:**

- `packages/vite-plugin/src/system-discovery.ts, virtual-modules.ts, dev-session.ts`

**Done when:**

- [ ] Editing a system updates the running app while preserving ECS world state

**Study:** Vite HMR API

**Watch out:** Preserving world state across reload is the hard part.

#### `M11-T4` · Visual editor / inspector

`docs-tooling` · effort **L** · depends: M7-T1, M11-T2

A browser editor that lists/inspects/mutates entities, drives the camera, picks in-viewport (M1), and saves/loads scenes (M7), built on the MCP/devtools backend.

**Touch:**

- `new editor app on cli MCP + devtools backend`

**Done when:**

- [ ] The editor can open a scene, select an entity by clicking the viewport, edit a component, and save/reload it

**Study:** references/engine PlayCanvas editor model; Babylon inspector

**Watch out:** Lean on the existing agent tooling rather than building a new backend.

#### `M11-T5` · Docs site, generated API reference, hosted example gallery

`docs-tooling` · effort **L** · depends: M1-T11

Turn the internal example harness into a public learning gallery, generate an API reference from the typed surface, and publish a docs site.

**Touch:**

- `docs site build`
- `API ref generation`
- `public example gallery from examples/`

**Done when:**

- [ ] A public site hosts runnable examples + generated API docs for the published packages

**Study:** three.js docs/examples site; PlayCanvas developer site

**Watch out:** Depends on M1 publishing; keep examples runnable, not screenshots.

**Sequencing.** T1 (overlay) and T3 (HMR) are immediate, independent DX wins. T2 (React) unlocks adoption and feeds T4 (editor). T4 needs M7 serialization + M1 publish. T5 is the public-facing finish.

**Proof.** Each tool gets an example/route or test; the editor gets an E2E that opens→edits→saves→reloads a scene.

**SOTA bar (when to stop).** Good enough = installable packages, a React binding, a stats overlay, HMR, a docs/example site, and a basic but real scene editor. A full node-graph material editor and asset-store/marketplace are beyond this milestone.

---

## Appendix — provenance

Built from two source-grounded audit passes (33-agent subsystem audit + adversarial verification, then a 7-agent file-level detail pass). The full verified per-subsystem gap inventory (strengths, confirmed gaps with file/line evidence, and disproven false-positives) is preserved in the workflow outputs and can be re-mined for any subsystem not detailed here (physics, XR, text/UI, DX all have deeper findings than summarized above).
