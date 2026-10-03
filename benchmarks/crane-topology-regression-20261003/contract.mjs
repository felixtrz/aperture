/** Exploratory post-author topology regression, never an original author score. */
export const SCHEMA = "aperture.crane-topology-regression.v1";
export const ENGINE_SOURCE = "d0333acdd4443ed9a4a0239d24184755b812b447";
export const ENGINE_VERSION = "0.3.0",
  THREE_REVISION = "185dev";
export const READY_GLOBAL = "__CRANE_LIVE_READY__",
  PROGRESS_GLOBAL = "__CRANE_LIVE_PROGRESS__";
export const LIMITS = Object.freeze({
  jsonBytes: 16 * 1024 * 1024,
  pngBytes: 8 * 1024 * 1024,
});
export const BASELINE = Object.freeze({
  shoulder_deg: 50,
  elbow_deg: -35,
  hoist_length: 1.5,
  opening_width: 1.6,
  pipe_bend_radius: 0.8,
  top_tier_height: 0.18,
  assembly_yaw_deg: 0,
  assembly_dx: 0,
  assembly_dz: 0,
});
export const TOPOLOGIES = Object.freeze(
  Object.fromEntries(
    Object.entries({
      baseline: { curveSegments: 12, radialSegments: 12 },
      grow: { curveSegments: 24, radialSegments: 16 },
      shrink: { curveSegments: 6, radialSegments: 8 },
    }).map(([k, v]) => [k, Object.freeze(v)]),
  ),
);
// Physical parameters are unchanged; topology is a separate discrete axis.
export const PARAMETERS = Object.freeze(
  Object.fromEntries(Object.keys(TOPOLOGIES).map((k) => [k, BASELINE])),
);
export function topologyFor(edit = "baseline") {
  if (typeof edit !== "string" || !Object.hasOwn(TOPOLOGIES, edit))
    throw Error(`Unknown edit: ${String(edit)}`);
  return { ...TOPOLOGIES[edit] };
}
export function parametersFor(edit = "baseline") {
  topologyFor(edit);
  return { ...BASELINE };
}
export const COMPOSITIONS = TOPOLOGIES;
const sequence = [
  "baseline",
  "baseline",
  "grow",
  "grow",
  "shrink",
  "baseline",
  "grow",
  "baseline",
];
export const LIVE_STATES = Object.freeze(
  sequence.map((edit, index) =>
    Object.freeze({
      index,
      id: `s${String(index).padStart(2, "0")}-${edit}${index > 0 && sequence[index - 1] === edit ? "--noop" : ""}`,
      edit,
      reset: edit === "baseline" && index > 1,
      noop: index > 0 && sequence[index - 1] === edit,
    }),
  ),
);
export const SESSION_IDS = Object.freeze([
  "live",
  "fresh-baseline",
  "fresh-grow",
  "fresh-shrink",
]);
export function statesFor(session = "live") {
  if (!SESSION_IDS.includes(session))
    throw Error(`Unknown session: ${session}`);
  return session === "live"
    ? LIVE_STATES
    : Object.freeze([
        Object.freeze({
          index: 0,
          id: `s00-${session}`,
          edit: session.slice(6),
          reset: false,
          noop: false,
        }),
      ]);
}
export const BUDGETS = Object.freeze({
  width: 1024,
  height: 1024,
  liveTimeoutMs: 900000,
  freshTimeoutMs: 240000,
  perStateDeadlineMs: 180000,
  perEngineSessions: 4,
  perEngineStates: 11,
  totalSessions: 8,
  totalStates: 22,
  allowedNativeAttemptsPerSession: 1,
});
export const WORKER_SETTINGS = Object.freeze({
  sharedSnapshotMessageRateHz: 240,
  sourceAssetsMessageRateHz: 240,
  workerFullSummaryIntervalMilliseconds: 16,
});
export const VIEW = Object.freeze({
  name: "front-quarter",
  position: Object.freeze([8, 6.5, 10]),
  target: Object.freeze([0, 1.4, 0]),
  verticalSpan: 10.5,
});
export const SEMANTICS = Object.freeze({
  axis: "hollow-pipe tessellation cardinality only",
  curve: "quarter-circle; fixed bend radius .8; 12/24/6 intervals",
  radial: "fixed outer radius .24 and inner radius .175; 12/16/8 sides",
  unchanged:
    "baseline pose, all analytic dimensions, all nonpipe source/native geometry, palette, materials, camera, lighting and rendering settings",
  replacement:
    "stable ECS entities/mesh handles or THREE.Mesh objects; real asset/geometry/attribute/GPU allocations may change",
  controls:
    "exact within-engine live/fresh/reset bytes and decoded RGB; baseline also equals retained control",
  limits:
    "CPU operations and native allocation counters are not GPU-memory, residency or performance measurements",
});
