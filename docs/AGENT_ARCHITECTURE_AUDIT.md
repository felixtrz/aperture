# Agent usability and reliability architecture audit

Reviewed 2026-10-11–12 against Aperture commit `8b8275b` and the current
`facebook/immersive-web-sdk` main branch at
[`0778f518db51e9d1836977f3b6fed9b53f3f0c6f`](https://github.com/facebook/immersive-web-sdk/tree/0778f518db51e9d1836977f3b6fed9b53f3f0c6f).
This records the implemented repairs and the remaining architectural work. It
is not a claim that every reliability issue has been eliminated.

## Architectural assessment

Aperture's simulation/render separation is a strong foundation for agent use.
The authoritative ECS world, serializable extraction boundary, portable worker
systems, deterministic clock/random APIs, typed resources, and headless tooling
provide inspection and reproducibility that a mutable scene graph alone cannot
provide. Preserve these boundaries.

The Three.js usability target should mean that an agent can author an ordinary
scene with a short recipe, discover the available operations, inspect the actual
result, and recover from a mistake without learning backend internals. It does
not require changing the world model. Existing `spawn`, `mesh`, `material`,
hierarchy, camera framing, resource, and input facades already carry much of this
authoring burden. The weakest points are contracts across execution modes,
source iteration, failure cleanup, and reliable readiness evidence.

The review covered the app facade and spawn helpers; entity lookup and devtools;
headless boot/reset/restore and input; fixed-step scheduling; CLI/MCP dispatch,
schemas, transport, capture and session lifecycle; Vite discovery and worker
refresh; package boundaries; generated agent instructions; and validation
entrypoints. It did not establish GPU pixel equivalence for the new camera
behavior across headed/headless modes or exhaustively audit every
renderer/physics algorithm. Native CPU SwiftShader captures do establish the
corrected camera behavior in the headless MCP render path.

## Lessons from the current Immersive Web SDK

The reference SDK's [AI entrypoint](https://github.com/facebook/immersive-web-sdk/blob/0778f518db51e9d1836977f3b6fed9b53f3f0c6f/docs/ai/index.md),
[tool documentation](https://github.com/facebook/immersive-web-sdk/blob/0778f518db51e9d1836977f3b6fed9b53f3f0c6f/docs/ai/mcp-tools.md),
mode guidance, CLI guidance, and ECS debugger emphasize a small semantic tool
surface, bounded inspection, explicit mode support, actionable errors, and
freshness metadata. These are relevant to Aperture regardless of the SDK's
different Three.js rendering model.

| Reference pattern                                | Aperture application                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Discoverable capabilities and argument contracts | One public MCP catalog, target metadata, `app_capabilities`, complete semantic input/camera schemas. |
| Explicit execution modes                         | Advertise headless-only artifacts and headed-only frame reports; disclose source reload semantics.   |
| Small, bounded operations                        | Validate step budgets before work; retain compact structured capture metadata alongside images.      |
| Recoverable failures                             | Distinguish protocol errors from tool failures; carry diagnostics and set MCP `isError`.             |
| Freshness and generation evidence                | Keep generation-aware entity selectors; next add source/session revisions to all responses.          |
| File authoring followed by semantic inspection   | Retain ordinary TypeScript system authoring, then step/read ECS state and render only when needed.   |

Do not transplant the SDK's mutable Three.js scene model into Aperture or make
browser automation the authoritative inspection path.

## Repairs implemented

| Finding and consequence                                                                                                      | Change                                                                                                                                                        | Regression evidence                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devtools look-at duplicated camera math with the opposite forward convention, placing an intended subject behind the camera. | Use the authored transform helper and local -Z forward for look-at, orbit, and radius fitting.                                                                | Project a non-origin subject through extracted view-projection matrices; assert centered coordinates, positive clip W, and visible depth.                                         |
| Camera pose edits changed LocalTransform but left extraction reading the previous WorldTransform until a simulation step.    | Refresh derived transforms after creation, edits, and restore, and before reading a fit subject's world origin.                                               | Render an off-origin cube immediately after look-at, orbit, and radius fitting on native SwiftShader; assert center-versus-background pixels and unchanged simulation frame.      |
| `target` meant both session route and camera aim point, so MCP routing consumed the point.                                   | Use `lookAt` in the public camera schemas and payloads; retain vector `target` on the unrouted app bridge.                                                    | Start a real headless simulation and orbit around an off-origin aim point through MCP.                                                                                            |
| The public catalog hid camera/input arguments and omitted action/gamepad tools that the adapter taught agents to call.       | Extract `tools/catalog.ts`; add direct controls, target metadata, read-only hints, and `app_capabilities`.                                                    | Inspect schemas and capabilities without creating a session; verify the stdio tool list.                                                                                          |
| A misspelled target could route to a different session.                                                                      | Reject invalid supplied targets before dispatch.                                                                                                              | Assert an actionable diagnostic for `headles`.                                                                                                                                    |
| Empty or malformed composite input succeeded; a later invalid action could leave earlier headless events queued.             | Validate the composite shape and preflight the complete headless event batch before enqueueing. Validate action-kind fields in the shared app tool.           | Step after rejected pointer/action batches and verify input state remains unchanged.                                                                                              |
| Zero, fractional, nonfinite, or excessive frame counts could be ignored/coerced or occupy the server for an unbounded run.   | Validate finite step arguments and a 10,000-frame ceiling before work. Stop headed batches after a failed step.                                               | Invalid step calls leave session status unchanged.                                                                                                                                |
| Malformed JSON-RPC values could crash request handling; protocol codes and tool errors were ambiguous.                       | Validate envelopes and object arguments; support version negotiation and ping; return standard parse/request/method/params codes and MCP tool `isError`.      | Send malformed messages followed by valid requests on the same stream.                                                                                                            |
| Image-only content hid capture metadata from clients that consume content blocks.                                            | Send a small metadata text block and native image content; keep base64 out of structured metadata unless explicitly requested.                                | Existing mocked lifecycle/capture tests cover image envelopes and metadata.                                                                                                       |
| A rejecting controller disposer could skip warm-renderer cleanup.                                                            | Attempt both disposers and propagate failures afterward.                                                                                                      | Inject a cleanup rejection after safely disposing the controller and assert renderer disposal.                                                                                    |
| Overlapping system globs duplicated modules; regex discovery mistook comments for exports and missed default re-exports.     | Deduplicate files and use TypeScript syntax trees.                                                                                                            | Discover overlapping globs and true/false default exports.                                                                                                                        |
| Shared-config edits and newly added system files could miss generated-worker refreshes; refresh errors were swallowed.       | Share static config dependency discovery between manifest generation and HMR, watch dependencies, and report refresh failures.                                | Change shared globs and add systems; inspect regenerated worker entry and invalidated virtual modules.                                                                            |
| Checking each entity key registered a permanent value-predicate query, increasing query fanout for every future key edit.    | Reuse one component query and read current authoritative values.                                                                                              | Spawn 200 keyed groups, verify one registered query identity, then rename and retry keys.                                                                                         |
| Failed metadata/transform creation left entities behind; a later light-rig child failure leaked already created children.    | Preflight metadata, roll back ordinary entity initialization, and clean every owned rig entity on failure.                                                    | Duplicate/malformed spawns preserve entity counts; retry corrected keys and failed rigs successfully.                                                                             |
| Native imports survived headless reset/stop/start, and component identities were shared across sessions.                     | Own source loading and the world in fresh native Workers; pin the physical SDK graph, serialize requests, preflight restore schemas and observe cleanup/exit. | Reload edited imports and globs; isolate matching component IDs with different schemas; restore continuation; verify copied CLI/project SDK identity and bounded failure cleanup. |

Key uniqueness still scans the current keyed entities. This fixes retained-query
growth, not the asymptotic cost of spawning a very large keyed scene. A future
index must observe all ECS key edits and destruction, including direct component
writes; a private spawn-only map would violate that contract.

### Benchmark-driven repairs

The first house/road/car race exposed authoring and inspection gaps. The second
race retained three complete Three.js trials, but all three Aperture trials
failed when decimal geometry JSON exceeded the recorder's 64 MiB request limit.
Those failed trials remain ineligible; preview images and warmup timings cannot
replace official evidence. None of the first three rounds establishes a scored
winner.

The first repair batch adds explicit sRGB/linear color helpers, an indexed
rounded-box primitive, correct normal transforms under nonuniform scale, and a
public manual browser frame contract that acknowledges actual rendering. It
also bounds request queues, avoids unchanged asset resends, preserves diagnostic
causes across workers, and releases app-owned GPU resources after accepted work
drains. Native shader, tone-map, normal-transform and resource-lifetime probes
passed. Masked materials are explicitly omitted from the current depth-only
shadow path with a diagnostic; correct masked shadow rendering remains work.

The second repair batch adds opt-in inspection of geometry derived from actual
submitted static triangle-list draws. It records uploaded geometry versions,
draw ranges and submitted instance transforms rather than consulting a mutable
asset registry. Partial coverage, capture limits and unsupported draw routes
are explicit. The public browser recipe uses the worker/ECS path and detached
inspection results; custom worker messages are no longer required for this
supported scope. Inspection does not prove fragment visibility or cover every
deformation, particle, text or custom rendering path.

The additive version-two benchmark recorder uses bounded, checksummed binary
geometry chunks for both engines, independent decoding and native position
correlation. Geometry export follows all measured frames, so export failures
retain the completed timing samples without becoming eligible results. The
original recorder and historical trial bytes remain unchanged. The second batch's
complete repository gate and coverage passed 5,056 tests across 705 files, with 20 native
SwiftShader reports across the two suites. Separate native fixtures retained
1.5 million indexed vertices and more than 155 MB of equivalent decimal numeric
JSON for both engines. Deliberate export failures preserved all 120 measured
samples while remaining ineligible. A corrected disposal probe also verified
worker termination and destruction of all 20 buffers and seven textures; its
earlier incorrect post-disposal expectation remains a preserved failed attempt.
These fixtures validate the transport and lifecycle, not a scored scene pair.
Runtime comparisons require fresh trials using the same version-two recorder
for both engines. Current-source supplements are required after later edits.

The third round used fresh isolated authors and the same frozen reference,
controls, rubric and binary recorder for both engines. All six preselected
attempts completed and their evidence is sealed. Three.js completed all three
trials. Aperture completed all 60 warmup and 120 measured frames in each trial,
then geometry export rejected submitted meshes without prepared upload receipts.
The captured native uploads were complete and below their byte limit; this was
a resource-lifetime failure rather than the second round's decimal transport
limit. Formal scores remain null. Failed-trial timings are diagnostics and do
not establish a runtime winner.

An application-level regression reproduced the missing receipts at render
invocation 123, with both advancing and repeated simulation-frame numbers and
with cached shadows enabled or disabled. Cached frame resources kept using GPU
buffers without refreshing the prepared entries' last-use counters. Invocation
122 retired those entries and released inspection bindings even though later
draws still referenced the buffers. The repair records exact prepared mesh and
material dependencies on cached resources, validates their identities, and marks
them used when a cache hit actually reuses them. Retired or replaced dependencies
take the ordinary preparation path; genuinely idle entries still expire.
Cached shadow casters use the same dependency contract.

A separate first-frame regression found that the special shared-mesh,
multi-material unlit route bypassed prepared inspection and allocated new
buffers every frame. Those supported scenes now use the existing cached queued
renderer. Focused lifecycle checks cover standard, unlit, matcap and debug-normal
materials, inspection enabled and disabled, shared meshes, idle retirement,
reactivation, version replacement and disposal. Four native threshold cases
passed 184 serial frames each, covering standard and shared-mesh unlit scenes
with transferable and shared snapshot transport. All 736 rendered frames, 24
inspection checkpoints and 12 captured images passed. Geometry, uploaded bytes,
instance transforms and versions were independently checked; images matched
exactly within each scene across the threshold and transports. Disposal destroyed
all app-owned buffers and textures and terminated each worker once. The shared
transport check joins the public decoded renderer input and frame metadata; it
does not independently decode the raw shared packet.

The unchanged idle threshold retires preparation metadata and inspection
bindings; it does not destroy an idle GPU allocation. Final app disposal is the
separate ownership boundary verified by the probe. Neither cache repair is yet
a measured explanation for the third round's software-rendering cost. Focused
repair regressions and native probes are distinct from repository-wide results;
third-batch canonical and coverage receipts are recorded separately under
`.aperture-env/agent-house-race/validation/batch-003/repository-gate-002`.

The same round exposed an error-recovery gap: a component display label such as
`Camera` was mistaken for its writable component ID. Rejected mutations now list
bounded available IDs and fields and point to entity/schema inspection. Exact
component IDs remain required, and prototype-property selectors are rejected.

Additional shader composition checks exposed incomplete LTC binding metadata and
missing extension arguments when clearcoat, sheen, iridescence and clustered
lighting were combined. Standard shader metadata now declares all three LTC
bindings. Final assembly synchronizes punctual and area evaluator arguments
independently; clustered helpers receive the typed fragment-computed material
values rather than referring to locals outside their scope. The WGSL declaration
parser preserves UTF-16 source positions and ignores comments correctly.

A later stock shader failure exposed a nonclustered directional/point shadow
receiver calling its directional helper without the required fragment normal.
Declaration-coverage regressions also found a call to a spot helper that this
route never emits. The receiver now forwards the computed normal and composes
its actual directional and point helpers. Ordinary multi-shadow keeps its
original directional, spot and point expression and one-argument directional
helper contract.

At the receiver-repair stage, focused consumer checks and the build passed,
followed by native compilation of
all 94 shader cases on Google SwiftShader, with 38 WGSL byte controls for none/linear output.
The prior 82 cases remained byte-identical, including the original 54 cases; five
solo/base controls also retained their exact WGSL bytes. Twelve appended cases
covered nonclustered directional/point receivers with individual and combined
lobes, texture/normal/transmission features, output and motion-vector variants.
The earlier native attempt's 12 clustered scope errors and the later failed
parity probe remain preserved alongside their CPU regressions and repairs.
The verifier recorded a separate native canvas draw and submission with no
WebGL attempts, GPU errors or device loss. These are module-compilation checks,
not rendered pixel parity for 94 materials.

A general single-shadow helper now resolves the owner parameters together and
passes the resolved strength through the directional sampler. The existing
clustered single-spot wrapper and authored strength, bias and filter settings
remain intact. This adopts only the reviewed candidate-A patch; no other shader
optimization is included.

After adoption, a separate current-source native check (attempt 004) passed all
94 modules and 38 none/linear byte controls. Case names, ordering and settings
stayed unchanged. The helper changed 28 modules' WGSL; 66 modules remained
byte-identical, including 52 explicitly checked family/unshadowed controls.
This verifies module compilation with an independent native canvas submission;
it does not establish rendered pixel parity for all 94 material scenes.

The candidate's completed private comparison (attempt 009) passed all 32 raw image pairs:
64 full-shader frames matched exactly across 157,286,400 raw half-float bytes,
with finite channels and matching parameter oracles. The separate timing run
completed all 448 frames: 64 warmup and 384 measured samples across 12 blocks.
All 16 timing-run raw captures were finite and matched their paired baselines
exactly. Three opposite-order pairs of the common one-light workload improved
block minima by 9.9687%, 5.9363% and 7.7315%, each exceeding the frozen
`max(3% of baseline minimum, 0.25 ms)` criterion. Pair two's median was slightly
slower: 159.4625 ms for the candidate versus 158.920 ms for the baseline. The
32-light workload is a diagnostic stress case, not an application cost estimate.
Neither end-to-end application gain nor compiler/LLVM elimination of owner
scans has been established. These synthetic shader workloads do not establish
an engine ranking.

The earlier attempt 007 exceeded its 600-second work deadline during the final
stress block; its partial samples and failure remain preserved diagnostics.
Attempt 009 raised the aggregate work deadline to 900 seconds and the verifier
cap to 960 seconds; the 30-second queue deadline, workloads, frame counts,
orders and criteria stayed unchanged. It completed every planned block. Raw
evidence from prior attempts was not rewritten. Production adoption follows the
complete parity and timing review; focused checks and the repository-wide gate
have separate receipts.

## Remaining work, in priority order

### 1. Headless source isolation: implemented and CPU validated

File-based MCP sessions, headless serve, and one-shot commands now run source
loading, EliCS identities, world state, and the local controller in a fresh native
Node Worker. Reset and restore prepare a new source realm, drain accepted work,
retire and observe the old realm's actual exit, then boot the replacement world.
A project SDK anchor binds both authored and CLI controller runtime imports,
including EliCS; missing selected-project runtime bindings fail instead of mixing
physical copies from a global CLI installation. Tooling-only imports may resolve
from the CLI installation.

Responses carry execution/source revisions. Saved snapshots carry component
schemas, resource field kinds, and the ordered authored-system/state-hook
manifest. Known incompatibilities fail before old-world disposal; declarations
created by initialization are checked again before restoration. Legacy snapshots
remain supported with explicit unverified compatibility. Source hashes describe
loaded native file modules outside node_modules, plus physical SDK binding URLs;
they are not a full immutable transitive package inventory or a private-state
migration guarantee. The low-level in-process controller retains its original
module-cache semantics for callers that deliberately supply loaded functions.

CPU validation passes 19 native-Node/transport cases and 114 affected CLI cases
across 15 files. These cover actual edited-file reloads, isolated component IDs,
snapshot continuation and schema mismatches, copied installed CLI/project SDK
identity, failed boots, cancellation ordering, observed exit, asynchronous owner
cleanup, atomic snapshot writes, and preserved MCP source/cause diagnostics.
Existing in-process lifecycle assertions remain intact. This validation does not
claim browser/GPU parity; the complete repository gate is separate. See
[headless source realms](HEADLESS_SOURCE_REALMS.md) for the public contract and
remaining compatibility limits.

### 2. Add asynchronous readiness and predicate waits

`untilQuiescent` compares render content plus commands/loading flags in a
synchronous stepping loop. A system can keep changing non-render resources
while the render digest stays stable. Promise-based loaders cannot progress
during one synchronous loop, and command dispatch does not prove that a system
consumed the command.

Add an asynchronous, cancellable wait operation with explicit conditions:
assets ready, a resource/component predicate, a command acknowledgement, or
render stability. Separate simulation-frame and wall-clock budgets. Yield to
asset work between batches and report the last observed condition and timeout
reason. Preserve the existing render-stability report rather than relabeling it
as whole-app inactivity.

### 3. Make successful mutations explain their actual effect

An `ok: true` enqueue response is not proof of applied state. Keep the current
readback guidance, and evolve results toward requested/applied values, source
and session revisions, entity generations, and explicit approximations. ECS
component setters already carry useful field validation; resource, camera,
input, and material controls should meet the same standard.

The headed composite input path still performs browser pointer calls and worker
action/gamepad calls separately. Shape validation prevents malformed batches,
but a runtime/action error or disconnect can follow an already applied pointer
operation. A future single worker batch contract should preflight and acknowledge
semantic input; native DOM/pointer-lock input needs a separate, explicitly
nontransactional contract.

### 4. Finish moving contracts out of session orchestration

The public catalog is now separate, but routing, backend support, and dispatch
remain manually coordinated across `mcp-session-manager.ts`, the headless
controller, app devtools, and browser dispatch. The large orchestration modules
make it easy to expose a tool with an incomplete or inconsistent implementation.

Extend the catalog into typed handlers with argument validation, target
capabilities, effect classification, and response contracts. Generate discovery
and agent guidance from that registry. Add parity tests at the semantic boundary
with explicit exceptions for browser input, capture size, signals, and asset
support. Avoid a second independent tool backend.

### 5. Tighten lifecycle and authoring guarantees incrementally

Ordinary entity/light-rig failure cleanup is improved. Imported GLTF/prefab
replay, batch spawning, existing runtime-uniform mutation, and material override
assets still deserve transaction/rollback audits; the repairs here do not claim
general observer-safe or asset-registry transactions.

Fixed-step tasks also retain a misleading availability contract: the app facade
can expose registration while the runner is disabled unless physics or explicit
fixed-step options enable it. Registration emits a warning, but the callback
does not run. Make scheduler availability reflect execution capability and
provide a declarative clock independent of physics, with compatibility tests
for snapshots and generated worker boot.

Vite config discovery remains static. It follows relative import/re-export
graphs and literal `systems` arrays; computed factories, aliases, and ambiguous
multiple imported configs need either an evaluated config contract or explicit
diagnostics. Shared static config support is a repair, not a general JavaScript
evaluator.

### 6. Bound new reference embedding work and expose progress

The real CPU reference producer is much heavier than its mocked contract tests:
the initial full corpus build took about 24 minutes on the four-core CPU
allocation and used roughly 12 GB of resident memory during native ONNX
embedding. A real semantic query against the generated corpus completed in
1.18 seconds, so this measurement concerns generation rather than ordinary
search.

The first repair batch implements checksum-validated reuse of exact embedding
inputs under the same pinned model, finite-vector validation, lazy model
initialization, staged publication with rollback, and an exclusive build lock.
Its real refresh produced 3,889 chunks from 851 sources in 154.525 seconds,
reusing 3,725 embeddings and generating 164. An unchanged `--if-current` run
completed in 49.594 seconds without regeneration. The retained 5.30 GiB child
RSS measurement is cumulative since the orchestrator started; it is not an
isolated embedding-stage peak or an aggregate process-memory measurement.
Published archive and browser-search payload hashes were verified. These facts
measure incremental regeneration, not a fresh full-model build. The second
batch also uses TypeScript syntax trees to include public type re-exports and
adds the public geometry-inspection contract to reference-source curation.
Its real refresh produced 4,657 chunks from 919 sources in 344.881 seconds,
reusing 3,788 exact embeddings and generating 869 finite 768-dimensional vectors.
The official unchanged `--if-current` check completed in 54.725 seconds without
payload changes. Every source and all 920 archive entries were verified against
the current corpus; browser-search quantization was checked independently.
The retained 7.23 GiB child RSS value is cumulative, not an isolated model-stage
or aggregate process-memory peak. Later source edits require a new refresh
before packing another author SDK.

Unchanged builds now avoid model work. New embedding work still needs token
budgets, intermediate progress and resumable partial checkpoints.

`reference/corpus.ts` bounds source content to 2,000 characters but includes
unbounded metadata in each embedding input and batches eight inputs together.
Profile token lengths and padding before setting a total input/batch budget;
retain the full source and relationship metadata in the searchable corpus.
Expose progress and resumable generation. If input formatting changes, version
the embedding contract and regenerate the matching assets. Keep this producer
separate from ordinary use of the precomputed reference payload.

## Validation and limits

The latest complete gate before the third repair batch is
`.aperture-env/agent-house-race/validation/batch-002/repository-gate-002/latest-check-summary.json`.
The canonical check and separate V8 coverage gate each passed all 5,056 tests
across 705 files, with no failed or skipped cases. The original recorder passed
all 24 checks. Coverage thresholds remained 85% statements, 73.5% branches,
90% functions and 85% lines; actual coverage was 85.98%, 76.08%, 90.94% and
86.02%, respectively. Source and built-engine inventories were unchanged across
those runs. Registry additions and subsequent cache, recovery and shader
contract repairs are outside that earlier gate; it does not validate later
edits. Their focused checks and native probes have separate receipts. Third-batch
repository-wide canonical and unchanged-threshold coverage results belong to
`.aperture-env/agent-house-race/validation/batch-003/repository-gate-002/latest-check-summary.json`;
consult the completed receipt, when available, for its actual outcomes and counts.
The preserved first third-batch check passed 5,163 tests and failed four across
707 files. Those failures checked obsolete diagnostic wording or inspected the
legacy shadow wrapper instead of its shared implementation. Updated assertions
retain the rejection and PCSS algorithm checks; the focused suite passed all
456 tests across eight files. No dependent coverage ran on the failed attempt.

The second-batch gate passed package and headless boundaries, release configuration, all
package builds and test types, inspection of 14 publishable package archives,
the packed CLI, render-bundle fixtures, examples, docs site, showcases and
shadow-lab, lint and formatting. It also passed 58 Python checks, 42
cloud-renderer Node checks and the 1,468-code diagnostics catalog check.
The real second-batch reference producer and its official freshness check
completed separately after this gate.

All 20 native SwiftShader reports across the canonical and coverage suites used
the established `runVerifiedScene` route, exact approved flags, and adopted
cleanup lifecycle. Reports verified Google SwiftShader, native WebGPU
submissions, no WebGL fallback, no GPU errors or device loss, and completed
process cleanup. Shader compilation, tone-map numerics, normal transforms and
resource ownership have separate native evidence. These checks do not claim
physical-GPU parity or completion of the manual Playwright CI suite, which is
not an alternative launch route in this environment.

Formatting preserves 4,070 original historical files and 10,277 subsequently
frozen experiment files, including all three completed benchmark rounds. Exact
checksums and the original recorder freeze are verified independently. New
editable files stay in the formatting scope until their actual bytes are
reviewed and sealed. Failed trials, failed probes and their original public
operations remain retained. See [formatting and retained evidence](FORMATTING_AND_EVIDENCE.md).
