/** Exploratory post-author topology regression, never an original author score. */
export const SCHEMA = "aperture.indexed-shared-mesh-fanout.v1";
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
  "shared-baseline",
  "shared-grow",
  "shared-shrink",
  "unshared-baseline",
  "unshared-grow",
  "unshared-shrink",
]);
export function sharingFor(session = "live") {
  if (!SESSION_IDS.includes(session)) throw Error("Unknown session");
  return !session.startsWith("unshared-");
}
export function statesFor(session = "live") {
  if (!SESSION_IDS.includes(session)) throw Error("Unknown session");
  return session === "live"
    ? LIVE_STATES
    : [
        {
          index: 0,
          id: "s00-" + session,
          edit: session.split("-")[1],
          reset: false,
          noop: false,
        },
      ];
}
export const BUDGETS = Object.freeze({
  width: 1024,
  height: 1024,
  liveTimeoutMs: 900000,
  freshTimeoutMs: 240000,
  perStateDeadlineMs: 180000,
  perEngineSessions: 7,
  perEngineStates: 14,
  totalSessions: 7,
  totalStates: 14,
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
  axis: "indexed shared-mesh fan-out and actual three-instance drawIndexedIndirect coalescing",
  physical:
    "Existing .8 bend radius, .24 outer radius and .175 inner radius; exact original corner streams plus identity Uint16 indices; no deduplication",
  unchanged:
    "eleven fixed transforms, one directional shadow light, receiver, sentinel, camera, appearance, demand/SAB transport",
  controls:
    "eight live/shared-cold and three shared/unshared exact decoded RGB controls plus raw geometry and visible mutations",
  limits:
    "Exploratory engineering only; no memory/performance, cross-engine, score, original-author or model-identity claim",
});
export const INSTANCE_TRANSLATIONS = Object.freeze(
  [
    [-3.5, 0, -1],
    [-1.2, 0, -1],
    [1.1, 0, -1],
  ].map((v) => Object.freeze(v.map(Math.fround))),
);
export const PIPE_PARTS = Object.freeze(["outer", "inner", "rims"]);
export const LIGHT = Object.freeze({
  kind: "directional",
  color: [1, 0.89, 0.72, 1],
  intensity: 2.65,
  position: [-4, 7, 5],
  target: [0, 0, 0],
  shadow: {
    mapSize: 1024,
    cascadeCount: 1,
    shadowType: 2,
    strength: 0.82,
    filterRadius: 16,
    normalBias: 0.02,
    bias: 0.0006,
    slopeBias: 1,
    center: [0, 1.4, 0],
    orthographicSize: 12,
    near: 0.1,
    far: 35,
    lightDistance: 15,
  },
});
