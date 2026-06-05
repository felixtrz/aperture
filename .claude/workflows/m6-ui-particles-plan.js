export const meta = {
  name: "m6-ui-particles-plan",
  description:
    "Study uikit, three.quarks, PlayCanvas, Bevy + aperture internals; design a comprehensive ECS/WebGPU M6 UI+particles plan",
  whenToUse:
    "Planning M6 (content layer: UI + particles) for aperture, grounded in 4 reference libraries and aperture's own architecture",
  phases: [
    { title: "Study", detail: "parallel deep-reads of 4 references + 3 aperture subsystems" },
    { title: "Design", detail: "independent UI and particles designs consuming all studies" },
    { title: "Integrate", detail: "merge into one coherent M6 plan" },
    { title: "Critique", detail: "adversarial completeness review" },
    { title: "Finalize", detail: "revise the plan against the critique" },
  ],
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const STUDY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "area",
    "oneLineSummary",
    "dataModel",
    "keyMechanisms",
    "rendererAgnosticCore",
    "rendererBridge",
    "reusableIdeas",
    "apertureAdaptation",
    "featureBaseline",
    "keyFiles",
  ],
  properties: {
    area: { type: "string" },
    oneLineSummary: { type: "string" },
    dataModel: {
      type: "string",
      description: "How it represents UI nodes / particles / sprites in memory",
    },
    keyMechanisms: {
      type: "array",
      items: { type: "string" },
      description: "Layout engine, instancing, GPU/CPU sim, batching, z-order, text shaping, etc.",
    },
    rendererAgnosticCore: {
      type: "string",
      description: "What part is headless/portable (no renderer types)",
    },
    rendererBridge: {
      type: "string",
      description: "What part is tied to the renderer (three/webgpu/GL)",
    },
    reusableIdeas: {
      type: "array",
      items: { type: "string" },
      description: "Specific, concrete ideas aperture should borrow",
    },
    apertureAdaptation: {
      type: "array",
      items: { type: "string" },
      description:
        "What MUST change to fit aperture: ECS-centric (no scene graph, components+systems, worker/main split, snapshot extraction) and WebGPU-only",
    },
    featureBaseline: {
      type: "array",
      items: { type: "string" },
      description: "Concrete features this lib offers — the baseline bar aperture must meet",
    },
    keyFiles: {
      type: "array",
      items: { type: "string" },
      description: "path:purpose for the most important files",
    },
  },
};

const DESIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "domain",
    "ecsComponents",
    "headlessCorePlan",
    "gpuOrLayoutPlan",
    "renderingPlan",
    "interactionPlan",
    "packageBoundaries",
    "m6TaskMapping",
    "changesVsReferenceLibs",
    "risks",
    "proofStrategy",
    "openQuestions",
  ],
  properties: {
    domain: { type: "string", enum: ["ui", "particles"] },
    ecsComponents: {
      type: "array",
      items: { type: "string" },
      description: "Proposed ECS authoring components + their fields (the user-facing API)",
    },
    headlessCorePlan: {
      type: "string",
      description:
        "What lives in packages/render or packages/simulation (worker-safe, no GPU types): layout solve, particle sim authoring, extraction packing",
    },
    gpuOrLayoutPlan: {
      type: "string",
      description:
        "UI: the layout algorithm (flexbox port vs simpler) + where it runs. Particles: the WGSL compute sim + ping-pong buffers as graph resources",
    },
    renderingPlan: {
      type: "string",
      description:
        "The webgpu pipeline(s), graph node(s), instanced-quad reuse of the sprite foundation, glyph/panel/particle batching",
    },
    interactionPlan: {
      type: "string",
      description: "UI: hit-testing via the M7 pointer-event/interaction layer. Particles: n/a or emitter triggers",
    },
    packageBoundaries: {
      type: "array",
      items: { type: "string" },
      description: "Which package each piece lives in (simulation vs render vs webgpu vs app) and why, respecting check:boundaries",
    },
    m6TaskMapping: {
      type: "array",
      items: { type: "string" },
      description: "How this maps to the current M6-T1..T5 tasks; which change/split/merge",
    },
    changesVsReferenceLibs: {
      type: "array",
      items: { type: "string" },
      description: "The concrete ECS+WebGPU delta vs uikit/three.quarks/three.js",
    },
    risks: { type: "array", items: { type: "string" } },
    proofStrategy: {
      type: "array",
      items: { type: "string" },
      description: "Worker-authored render-control routes + pixel/JSON assertions per the aperture proof convention",
    },
    openQuestions: { type: "array", items: { type: "string" } },
  },
};

const INTEGRATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "isThisM6",
    "sharedFoundation",
    "revisedTasks",
    "sequencing",
    "ecsWebgpuDelta",
    "risks",
    "proofPlan",
    "openDecisions",
  ],
  properties: {
    executiveSummary: { type: "string" },
    isThisM6: {
      type: "string",
      description: "Confirm/qualify whether this is M6 and how it revises the roadmap's M6 scope",
    },
    sharedFoundation: {
      type: "array",
      items: { type: "string" },
      description: "What the shared instanced-quad/2D foundation (M6-T1) must deliver for BOTH UI and particles",
    },
    revisedTasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "package", "effort", "dependsOn", "deliverable", "doneWhen"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          package: { type: "string" },
          effort: { type: "string", enum: ["S", "M", "L"] },
          dependsOn: { type: "array", items: { type: "string" } },
          deliverable: { type: "string" },
          doneWhen: { type: "array", items: { type: "string" } },
        },
      },
    },
    sequencing: { type: "string" },
    ecsWebgpuDelta: {
      type: "array",
      items: { type: "string" },
      description: "The consolidated 'lots has to change because we are ECS-centric + WebGPU-only' list",
    },
    risks: { type: "array", items: { type: "string" } },
    proofPlan: { type: "array", items: { type: "string" } },
    openDecisions: {
      type: "array",
      items: { type: "string" },
      description: "Decisions for the user (e.g. retained vs immediate UI, Yoga-wasm vs hand-rolled flex, CPU-fallback particle path)",
    },
  },
};

const CRITIQUE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "gaps",
    "handwavyAreas",
    "missedConstraints",
    "missedReferenceFeatures",
    "taskGraphIssues",
    "recommendedRevisions",
    "readiness",
  ],
  properties: {
    gaps: { type: "array", items: { type: "string" } },
    handwavyAreas: { type: "array", items: { type: "string" } },
    missedConstraints: {
      type: "array",
      items: { type: "string" },
      description: "ECS-authority / worker-safety / WebGPU / package-boundary constraints the plan glossed over",
    },
    missedReferenceFeatures: {
      type: "array",
      items: { type: "string" },
      description: "Baseline features from uikit/three.quarks the plan failed to account for",
    },
    taskGraphIssues: {
      type: "array",
      items: { type: "string" },
      description: "Dependency cycles, mis-sequencing, effort mis-estimates, foundation gaps",
    },
    recommendedRevisions: { type: "array", items: { type: "string" } },
    readiness: { type: "string", enum: ["ready", "minor-revision", "major-revision"] },
  },
};

// ---------------------------------------------------------------------------
// Phase 1 — Study (parallel; designs need ALL studies → barrier)
// ---------------------------------------------------------------------------
phase("Study");

const REF = "/Users/felixz/Projects/aperture/references";
const PKG = "/Users/felixz/Projects/aperture/packages";

const studySpecs = [
  {
    label: "study:uikit",
    prompt: `Study pmndrs/uikit — the user's chosen TEXT/UI baseline — to extract its architecture so aperture can match its feature set in an ECS/WebGPU engine.

Read deeply under ${REF}/uikit/packages/uikit/src:
- flex/ (node.ts, yoga.ts) — the Yoga/flexbox layout engine integration: how layout is solved, what runs where, is Yoga a WASM dep?
- panel/ (geometry.ts, index.ts) — how rectangles/panels are rendered (instanced? one geometry? rounded corners, borders, gradients?)
- text/ (font.ts, cache.ts, utils.ts) — MSDF text: font atlas format, glyph layout, line-breaking, alignment, caching. Also look at ${REF}/uikit/packages/msdfonts.
- properties/ (schema.ts, defaults.ts, inheritance.ts, conditional.ts, values.ts) — the styling/property system (how CSS-like props are declared, inherited, animated, conditional hover/active).
- components/ (container, image, input, text, textarea, content, custom) — the component model.
- events.ts, listeners.ts, hover.ts, active.ts, clipping.ts, scroll.ts — interaction, clipping, scrolling.
- allocation/sorted-buckets.ts, order.ts, transform.ts — instance allocation and z-ordering.

Focus on: what is renderer-AGNOSTIC (the layout + property + glyph-layout core) vs three.js-specific (the instanced mesh rendering). uikit is built ON three.js with instanced panels + MSDF glyph instances. Capture the exact data flow: properties → layout solve → instanced panel/glyph buffers → render. Note the FEATURE BASELINE (flexbox, text, images, inputs, scroll, clipping, borders/radius/gradients, hover/active, z-order) aperture must meet. For apertureAdaptation, note that aperture has no scene graph, uses ECS components + a worker→main snapshot extraction, and is WebGPU-only.

Return ONLY the StructuredOutput object.`,
  },
  {
    label: "study:three.quarks",
    prompt: `Study Alchemist0823/three.quarks — the user's chosen PARTICLES baseline — to extract its architecture so aperture can match its feature set with a GPU-compute, ECS-centric particle system.

Read deeply:
- ${REF}/three.quarks/packages/quarks.core/src — the renderer-agnostic particle simulation CORE: shape/ (emission shapes), behaviors/ (forces, color/size/rotation over life, noise, turbulence, etc.), sequencers/, functions/ (curves/gradients/value generators), math/. This is the headless model aperture should port.
- ${REF}/three.quarks/packages/three.quarks/src — materials/, shaders/, util/ — the three.js rendering bridge: how particles are rendered (instanced billboards? batched? trail rendering?), the ParticleSystem/Emitter object, batched particle renderer.
- ${REF}/three.quarks/packages/quarks.nodes — node-graph extension (note but do not over-index).

Capture: Is the simulation CPU or GPU? (three.quarks is primarily CPU-sim with batched GPU rendering — confirm and note where GPU-sim would differ.) The emitter data model (emission rate/bursts, lifetime, start speed/size/color/rotation, shapes, behaviors-over-life via curves, sub-emitters, trails). The behavior/sequencer system (how per-particle attributes evolve). The rendering (instanced quad billboards, billboard modes, texture atlas/sprite-sheet animation, blend modes, soft particles). FEATURE BASELINE list. For apertureAdaptation: aperture is ECS (emitter = component on an entity), worker/main split (sim authority headless; rendering on main), WebGPU-only with a render graph that HAS compute-pass nodes — so the big change is moving the per-particle sim from CPU into a WGSL compute pass with ping-pong buffers, while keeping emitter authoring ECS-authoritative.

Return ONLY the StructuredOutput object.`,
  },
  {
    label: "study:playcanvas",
    prompt: `Study PlayCanvas engine (the closest-to-aperture component-based engine) for BOTH UI and particles.

UI — read ${REF}/engine/src/framework/components/element (ElementComponent: text/image/group element types), ${REF}/engine/src/framework/components/screen (ScreenComponent: screen-space vs world-space, resolution/scale modes), ${REF}/engine/src/framework/components/layout-group and layout-child (flex-like layout groups). Capture PlayCanvas's component model for UI, screen-space vs world-space, anchoring/pivots, and how text/image elements render.

Particles — read ${REF}/engine/src/scene/particle-system (the simulation + emitter) and ${REF}/engine/src/framework/components/particle-system (the component). CRUCIALLY also read ${REF}/engine/src/scene/shader-lib/wgsl/chunks/particle — PlayCanvas has a WebGPU particle path. Capture: is PlayCanvas particle sim GPU (texture-based ping-pong) or CPU? How does it author emitters as components? Emission shapes, curves (over-time/over-distance), sub-frame emission, sorting, soft particles, lighting.

For both, emphasize what maps cleanly to aperture's ECS component model (PlayCanvas is entity+component, close to aperture) and what is renderer-agnostic vs GL/WebGPU-specific. Two areas in one study — be thorough on both. Note the FEATURE BASELINE for each.

Return ONLY the StructuredOutput object (use area="playcanvas-ui-and-particles").`,
  },
  {
    label: "study:bevy-ui",
    prompt: `Study Bevy's UI — the GOLD-STANDARD ECS-native UI with an extract-to-render-world pipeline that DIRECTLY mirrors aperture's worker→snapshot extraction model. This is the most architecturally relevant reference for aperture.

Read under ${REF}/bevy/crates:
- bevy_ui/src: ui_node.rs (Node/ComputedNode — the UI component data model), layout/ (taffy flexbox integration — how Bevy solves layout from ECS components), ui_transform.rs, measurement.rs, update.rs, focus.rs + interaction_states.rs + picking_backend.rs (UI interaction/hit-testing as an ECS system), widget/ (text, button, image, label).
- bevy_ui_render/src: the EXTRACTION model — how UI nodes are extracted from the main world into the render world as batched rect/text/image instances, the UI render pass, batching, z-ordering, clipping. THIS is the pattern aperture's extraction.ts should follow for UI.
- bevy_text/src: text layout/shaping (cosmic-text), font atlas, how glyphs become render primitives.

Capture: Bevy's Node component + Style data model, how taffy solves flexbox from components in a system, how the render-world extraction packs UI into instanced batches (rects + glyphs + images), clipping/scissor, z-order/stacking-context, and how UI picking is an ECS system. FEATURE BASELINE. For apertureAdaptation note the strong parallel: Bevy's main-world→render-world extract == aperture's worker→snapshot extract; aperture is WebGPU-only (Bevy is wgpu too, so the rendering maps well). Bevy core has NO particle system — focus entirely on UI + text.

Return ONLY the StructuredOutput object (use area="bevy-ui").`,
  },
  {
    label: "study:aperture-sprites",
    prompt: `Document aperture's EXISTING sprite/billboard path in full — it is the M6-T1 foundation and the instanced-quad pattern that UI panels, text glyphs, AND particles will all reuse. Trace the COMPLETE data flow ECS→pixels.

Read:
- ${PKG}/render/src/rendering/extraction-sprites.ts — how sprite instances are extracted from ECS into the snapshot.
- ${PKG}/render/src/rendering/extraction.ts — the orchestrator: how extraction-sprites plugs into the overall extract, snapshot packet shape, transfer-list.
- ${PKG}/webgpu/src/app/sprites.ts and ${PKG}/webgpu/src/app/sprite-frame.ts — the webgpu-side sprite frame/upload.
- ${PKG}/webgpu/src/render/sprites/sprite-pipeline.ts — the actual WGSL pipeline, vertex/instance layout, billboard math, blend.
- Find the sprite AUTHORING component(s): grep ${PKG}/render/src/rendering/authoring-components*.ts for sprite/withSprite, and the Sprite component definition + enums.

Capture the EXACT reusable pattern as keyMechanisms: (1) ECS authoring component → (2) extraction packing into a typed array + snapshot field → (3) renderSnapshotTransferList → (4) webgpu pipeline reads instance buffer → (5) instanced quad draw. Note current sprite LIMITATIONS (the roadmap says: spherical billboard only — no axis-lock/cylindrical, no screen-space px size, no rotation, no UV-atlas/sprite-sheet). For reusableIdeas, state precisely what a generalized "instanced textured quad" foundation must expose so UI/text/particles can share it. rendererAgnosticCore = the extraction+packing in packages/render; rendererBridge = the pipeline in packages/webgpu.

Return ONLY the StructuredOutput object (use area="aperture-sprites").`,
  },
  {
    label: "study:aperture-graph-compute",
    prompt: `Document aperture's render graph (M3) compute-pass capability and existing compute pipelines — the foundation for GPU particle simulation. CONFIRMED: the graph already supports compute-pass nodes.

Read:
- ${PKG}/webgpu/src/render/graph/frame-graph.ts — ComputePassNode (kind:"compute"), addComputePass(), the resource-handle model (buffers for compute outputs, history textures, depth), how a compute pass's outputs are consumed by a later render pass.
- ${PKG}/webgpu/src/render/passes/compute-pass-commands.ts — the ComputePassCommand shape (dispatch, bind groups, pipeline). What commands exist?
- ${PKG}/webgpu/src/render/graph/frame-graph-compile.ts and frame-graph-execute.ts — how compute nodes are scheduled/executed in a single encoder, resource lifetime/aliasing, barriers between compute and render.
- ${PKG}/webgpu/src/render/graph/frame-graph-history.ts — ping-pong / cross-frame history resources (directly relevant to double-buffered particle state).
- An existing compute pipeline as the creation pattern: ${PKG}/webgpu/src/lighting/pmrem-compute-pipeline.ts and ${PKG}/webgpu/src/lighting/equirect-to-cube-compute-pipeline.ts (capability gating, inline WGSL, workgroup size, bind group layout, diagnostic-coded failures).

Capture as keyMechanisms exactly HOW to: add a compute pass that simulates particles into a STORAGE buffer, ping-pong two particle-state buffers across frames (via history resources), and have the instanced-billboard render pass read the compute output buffer — all in one encoder. Note any GAPS (e.g. does addComputePass support persistent/imported buffers across frames? indirect dispatch? can a compute output buffer be both written by compute and read as a vertex/storage buffer in the same frame?). rendererAgnosticCore = none (all webgpu); rendererBridge = everything.

Return ONLY the StructuredOutput object (use area="aperture-graph-compute").`,
  },
  {
    label: "study:aperture-interaction-ecs",
    prompt: `Document aperture's ECS authoring conventions, the worker/main snapshot boundary, and the M7 interaction/pointer layer — the foundation for UI components, UI hit-testing, and the headless authoring of UI/particle emitters.

Read:
- ${PKG}/render/src/rendering/authoring-components-core.ts, authoring-components.ts, authoring-components-camera-light.ts, authoring-components-spatial.ts — HOW components are declared (elics component schema, enums-as-strings, Vec2/Vec3/Vec4/Entity fields, packed layouts) and how withX() authoring helpers are built. This is the template for new UI/particle components.
- ${PKG}/app/src/interaction/access.ts, system.ts, pointer-events.ts, index.ts — the M7 pointer-event/interaction layer: how pointer rays pick entities, the InteractionAccess/Runtime API, pickLayerMask, pointer-event emission. This is what UI hit-testing must integrate with (screen-space UI needs a 2D hit-test, not just a 3D raycast — note that gap).
- How the snapshot crosses the worker→main boundary: grep for renderSnapshotTransferList and the transfer-list builder; note how new packed buffers (UI instances, particle state) must be added to cross the boundary.
- Note the package-boundary rule (check:boundaries): packages/simulation + packages/render are headless/worker-safe (NO webgpu/GPU types); packages/webgpu is GPU; packages/app composes. Capture which package new UI/particle authoring vs sim vs rendering code must live in.

Capture as keyMechanisms the exact recipe to add a new ECS component + authoring helper + extraction + transfer. For UI, flag the screen-space-vs-world-space hit-testing requirement and whether M7's raycast picking can serve UI or a new 2D overlay hit-test is needed. rendererAgnosticCore = authoring + interaction (mostly headless/app); rendererBridge = n/a.

Return ONLY the StructuredOutput object (use area="aperture-interaction-ecs").`,
  },
];

const studies = (
  await parallel(
    studySpecs.map((s) => () => agent(s.prompt, { label: s.label, phase: "Study", schema: STUDY_SCHEMA })),
  )
).filter(Boolean);

log(`Study phase complete: ${studies.length}/${studySpecs.length} digests`);

const studiesJson = JSON.stringify(studies, null, 2);

// ---------------------------------------------------------------------------
// Phase 2 — Design (UI + particles, each consuming ALL studies; barrier)
// ---------------------------------------------------------------------------
phase("Design");

const designPrompts = [
  {
    label: "design:ui",
    domain: "ui",
    prompt: `You are designing aperture's UI system for milestone M6. Aperture is an ECS-native (elics), WebGPU-only, worker/main 3D runtime. UI must be authored as ECS components, solved headlessly (worker-safe, no GPU types in packages/render), extracted into the snapshot, and rendered on the main thread via the WebGPU render graph — hit-tested through the M7 interaction layer.

Here are the research digests from uikit (the user's UI baseline), Bevy UI (the ECS gold-standard extract model), PlayCanvas UI, and aperture's own sprite path / render-graph / interaction+ECS conventions:

${studiesJson}

Produce a comprehensive UI design. Decide and justify: (a) the ECS component data model for UI nodes + style (one Node component + Style, taffy/Bevy-style? or uikit-style property bags?); (b) the layout engine — port a flexbox solver headlessly into packages/render (hand-rolled vs a WASM Yoga dep — weigh worker-safety, bundle size, determinism), running as an ECS system; (c) MSDF text — font atlas loading + glyph layout headless, glyph quads via the shared instanced-quad foundation, borrowing uikit's msdfonts/text core; (d) rendering — instanced panels (rounded corners, borders, gradients, clipping/scissor) + glyph instances as a screen-space (and optional world-space) graph render node, z-ordering/stacking; (e) interaction — screen-space 2D hit-testing wired into M7 pointer events (note: M7 raycast is 3D — design the 2D overlay hit-test and how UI consumes pointer events to drive hover/active/click + buttons); (f) package boundaries (simulation/render headless vs webgpu vs app). Map to M6 tasks T1(sprites foundation), T3(text), T4(UI). State the concrete ECS+WebGPU CHANGES vs uikit/three.js. Give a proof strategy (worker-authored render-control routes + pixel + JSON assertions, e.g. a layout-driven HUD with buttons proven by simulated pointer events, text sharp at 2 scales). List risks + open questions.

Return ONLY the StructuredOutput object with domain="ui".`,
  },
  {
    label: "design:particles",
    domain: "particles",
    prompt: `You are designing aperture's particle system for milestone M6. Aperture is ECS-native (elics), WebGPU-only, worker/main. CONFIRMED foundation: the M3 render graph already supports COMPUTE-PASS nodes (addComputePass / ComputePassNode / ComputePassCommand) with buffer resource handles and cross-frame history resources — so GPU-compute particle simulation feeding an instanced-billboard render pass in one encoder is achievable today.

Here are the research digests from three.quarks (the user's particles baseline), PlayCanvas particles (which HAS a WebGPU particle path), and aperture's sprite path / render-graph+compute / ECS conventions:

${studiesJson}

Produce a comprehensive particles design. Decide and justify: (a) the ECS emitter component data model (emission rate/bursts, lifetime, start speed/size/color/rotation, emission shapes, behaviors-over-life via curves, sub-emitters, trails) — port three.quarks' behavior/sequencer/curve model into an ECS-authoritative form; (b) headless authoring vs GPU sim split — emitter state + curves are ECS-authoritative and packed headlessly in packages/render; the PER-PARTICLE simulation moves into a WGSL COMPUTE pass (three.quarks is CPU-sim — this is the big change). Specify the compute sim: particle-state STORAGE buffers, ping-pong via graph history resources, spawning (compute-side or CPU-seeded emission), forces/curves uploaded as uniforms, lifetime/recycle, optional indirect dispatch/draw for GPU-driven counts; (c) rendering — instanced billboards via the shared M6-T1 quad foundation (billboard modes, UV-atlas/sprite-sheet animation, blend modes, soft particles, sorting — note GPU sort vs CPU vs unsorted-additive); (d) a CPU-sim fallback path (capability/simplicity); (e) package boundaries. Map to M6 tasks T1(sprites foundation), T2(GPU particles), T5(volumetrics-adjacent, lightly). State the concrete ECS+WebGPU CHANGES vs three.quarks (CPU→compute, object model→packed ECS). Give a proof strategy (a route emitting 100k+ GPU-simulated particles at 60fps with frame-time + GPU-count JSON assertions + pixel proof). List risks + open questions.

Return ONLY the StructuredOutput object with domain="particles".`,
  },
];

const designs = (
  await parallel(
    designPrompts.map((d) => () => agent(d.prompt, { label: d.label, phase: "Design", schema: DESIGN_SCHEMA })),
  )
).filter(Boolean);

log(`Design phase complete: ${designs.length}/2 designs`);

const designsJson = JSON.stringify(designs, null, 2);

// ---------------------------------------------------------------------------
// Phase 3 — Integrate
// ---------------------------------------------------------------------------
phase("Integrate");

const integrated = await agent(
  `You are the lead architect synthesizing ONE coherent implementation plan for aperture's milestone M6 (content layer: UI + particles) from independent UI and particles designs, grounded in research on uikit, three.quarks, PlayCanvas, and Bevy.

The current roadmap M6 (docs/SOTA_ROADMAP.md) has 5 tasks: T1 richer sprites/billboards (M, no deps), T2 GPU-compute particles (L, deps T1+M3-T7), T3 MSDF text (L, deps T1), T4 UI/GUI layer (L, deps T3), T5 decals+volumetrics (L, deps M3-T7). It is marked "design-level (code does not exist yet)". M3 (render graph, INCLUDING compute-pass nodes) and M7 (pointer events/interaction) are COMPLETE. Sprites exist but are spherical-billboard-only.

Designs:
${designsJson}

Research digests (for cross-checking against the baselines):
${studiesJson}

Produce an integrated M6 plan. Specifically:
- executiveSummary: the shape of M6 UI+particles for an ECS/WebGPU engine in a few sentences.
- isThisM6: confirm this IS M6 and state how your plan revises the roadmap's M6 scope (it should — the roadmap M6 was design-level; you now have grounded detail and a shared foundation).
- sharedFoundation: precisely what the shared instanced-textured-quad / 2D-screen-space foundation (an expanded M6-T1) must deliver so BOTH UI (panels+glyphs) and particles (billboards) reuse it — this is the keystone that makes the milestone cohere.
- revisedTasks: a concrete, ordered task list (revise/split/merge the existing T1–T5). Each task: id, title, package (simulation/render/webgpu/app), effort (S/M/L), dependsOn, deliverable, doneWhen[] (proof-bearing, in the aperture render-control + pixel/JSON-assertion style). Honor check:boundaries (headless render/sim vs webgpu vs app).
- sequencing: critical path + what parallelizes.
- ecsWebgpuDelta: the consolidated "lots has to change because we are ECS-centric + WebGPU-only" list the user asked for (vs the three.js libraries): CPU-sim→WGSL compute, scene-graph→ECS-components+extraction, object-per-node→packed snapshot buffers, 3D-raycast→2D screen-space hit-test, etc.
- risks, proofPlan, openDecisions (decisions to surface to the user — e.g. retained vs immediate UI, WASM-Yoga vs hand-rolled flex, GPU vs CPU particle sim default, sorted vs additive particles).

Return ONLY the StructuredOutput object.`,
  { label: "integrate:m6-plan", phase: "Integrate", schema: INTEGRATION_SCHEMA },
);

// ---------------------------------------------------------------------------
// Phase 4 — Critique (adversarial completeness)
// ---------------------------------------------------------------------------
phase("Critique");

const critique = await agent(
  `You are an adversarial principal-engineer reviewer. Tear into this integrated M6 (UI + particles) plan for the aperture ECS/WebGPU engine. Be specific and harsh; your job is to find what's missing or wrong, not to praise.

The plan:
${JSON.stringify(integrated, null, 2)}

The baseline research it must honor (uikit, three.quarks, PlayCanvas, Bevy + aperture internals):
${studiesJson}

Check rigorously:
- gaps: features in the uikit/three.quarks BASELINE the plan silently drops (e.g. text inputs, scroll, clipping, gradients, sub-emitters, trails, soft particles, sprite-sheet animation, billboard modes).
- handwavyAreas: tasks whose doneWhen is not actually provable, or whose mechanism is unspecified (especially the layout solver choice, the compute-sim spawning/recycling, GPU particle sorting, 2D hit-testing).
- missedConstraints: ECS-authority, worker-safety (no GPU types in packages/render), the worker→snapshot transfer boundary, package-boundary (check:boundaries) violations, determinism (no Date.now/Math.random in sim), the render-graph compute→render resource-lifetime/barrier reality.
- missedReferenceFeatures: where aperture would fall short of the user's stated baseline libraries.
- taskGraphIssues: dependency cycles, foundation gaps (does the shared M6-T1 foundation actually provide everything T2/T3/T4 consume?), effort mis-estimates, mis-sequencing.
- recommendedRevisions: concrete fixes.
- readiness: ready | minor-revision | major-revision.

Return ONLY the StructuredOutput object.`,
  { label: "critique:m6-plan", phase: "Critique", schema: CRITIQUE_SCHEMA },
);

// ---------------------------------------------------------------------------
// Phase 5 — Finalize (revise plan against critique)
// ---------------------------------------------------------------------------
phase("Finalize");

const final = await agent(
  `Revise the integrated M6 (UI + particles) plan to address every valid point in the adversarial critique. Keep the same structured shape. Fold the critique's recommendedRevisions into the task list, sharedFoundation, ecsWebgpuDelta, risks, and openDecisions. Do not drop baseline features the critique flagged as missing — either add a task/doneWhen for them or explicitly scope them out in openDecisions with a reason. Tighten any handwavy doneWhen into provable assertions.

Original plan:
${JSON.stringify(integrated, null, 2)}

Critique to address:
${JSON.stringify(critique, null, 2)}

Return ONLY the StructuredOutput object (the final, revised INTEGRATION plan).`,
  { label: "finalize:m6-plan", phase: "Finalize", schema: INTEGRATION_SCHEMA },
);

return {
  studyCount: studies.length,
  studies,
  designs,
  integrated,
  critique,
  final,
};
