/** Frozen shared adapter/evidence contract. Do not edit after author admission.
 *
 * Before renderer/app/Worker creation:
 *   const tracking = installLiveEditTracking();
 * After boot: await runLiveEditHarness(adapter, { tracking });
 * Both functions are exported from /harness/client.mjs.
 *
 * adapter = {
 *   engine: 'aperture' | 'threejs', canvas: HTMLCanvasElement,
 *   getRuntimeHandles(): { renderer: object, scene: object, worker: Worker },
 *   async applyAndSubmit(state): {
 *     stateId: state.id, revision: state.index + 1,
 *     workerRevision: state.index + 1, submittedRevision: state.index + 1,
 *     nativeFrame: nonnegative integer, details: JSON
 *   },
 *   async readEvidence(state, receipt): {
 *     stateId, revision, parameters,
 *     camera: { position: [8,6.5,10], target: [0,1.4,0], verticalSpan: 10.5, ... },
 *     appearance: JSON (fixed within one engine/attempt),
 *     identity: {
 *       sceneId: string | integer, entityCount: integer, meshCount: integer,
 *       meshes: [{ name, entityId: string | integer, meshId: string | integer }]
 *     },
 *     resources: JSON (measured counters and their definitions),
 *     sourceGeometry: JSON (full current source, all arrays converted to arrays),
 *     nativeGeometry: { meshes: [{
 *       name, positions: number[] (flat xyz, decoded from actual native streams),
 *       indices: integer[] (actual native index contents), worldMatrix: number[16],
 *       streams: JSON[] (full actual stream descriptors AND array data), ...
 *     }], ... },
 *     nativeChecks: { ok: boolean, checks: JSON[] }
 *   }
 * }.
 *
 * applyAndSubmit must correlate the exact worker revision with the actual native
 * submitted frame before resolving. A queue submission increase alone is not
 * enough; details preserve the engine-specific frame correspondence. The scene
 * handle may be the persistent worker bridge for a worker-owned ECS world, but
 * sceneId must originate from that actual world. entityId and meshId must be
 * genuine native identities (ECS ID + stable asset handle, or Object3D/Mesh ID),
 * never freshly assigned names that conceal replacement. Geometry/buffer
 * replacements are separately counted, not concealed as stable mesh identity.
 * All full native/source geometry bytes survive in each state artifact.
 *
 * The harness owns sequencing, queue fence, presentation, canvas PNG capture,
 * stable runtime references and mesh IDs, reset equivalence and immutable POSTs.
 * READY is only set after all state artifacts and completion are acknowledged.
 * Blank or failed captures fail the attempt; no proxy raster is substituted.
 * This is exploratory, not a score or a GPU-memory/performance measurement.
 */
export const SCHEMA = 'aperture.crane-live-edits.v1';
export const READY_GLOBAL = '__CRANE_LIVE_READY__';
export const PROGRESS_GLOBAL = '__CRANE_LIVE_PROGRESS__';
export const LIMITS = Object.freeze({ jsonBytes: 16 * 1024 * 1024, pngBytes: 8 * 1024 * 1024 });
export const BASELINE = Object.freeze({ shoulder_deg: 50, elbow_deg: -35, hoist_length: 1.5, opening_width: 1.6, pipe_bend_radius: 0.8, top_tier_height: 0.18, assembly_yaw_deg: 0, assembly_dx: 0, assembly_dz: 0 });
export const EDITS = Object.freeze({ shoulder: Object.freeze({ shoulder_deg: 65 }), elbow: Object.freeze({ elbow_deg: -60 }), hoist: Object.freeze({ hoist_length: 1.9 }), arch: Object.freeze({ opening_width: 2.1 }), pipe: Object.freeze({ pipe_bend_radius: 1.1 }), tier: Object.freeze({ top_tier_height: 0.38 }), assembly: Object.freeze({ assembly_yaw_deg: 20, assembly_dx: 0.55, assembly_dz: 0.4 }) });
export const EDIT_ORDER = Object.freeze(['shoulder', 'elbow', 'hoist', 'arch', 'pipe', 'tier', 'assembly']);
const states = [{ index: 0, id: 's00-baseline', cycle: 0, edit: 'baseline', reset: false }];
for (const cycle of [1, 2]) for (const edit of EDIT_ORDER) {
  const index = states.length;
  states.push({ index, id: `s${String(index).padStart(2, '0')}-c${cycle}-${edit}`, cycle, edit, reset: false });
  states.push({ index: index + 1, id: `s${String(index + 1).padStart(2, '0')}-c${cycle}-reset-${edit}`, cycle, edit: 'baseline', reset: true });
}
export const STATES = Object.freeze(states.map(Object.freeze));
export const parametersFor = (edit) => {
  if (edit !== 'baseline' && !Object.hasOwn(EDITS, edit)) throw Error(`Unknown edit: ${edit}`);
  return { ...BASELINE, ...(EDITS[edit] ?? {}) };
};
