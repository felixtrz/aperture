/** Post-author derived regression. The only new experimental axis is composition. */
export const SCHEMA = "aperture.crane-combined-edits.v1";
export const ENGINE_SOURCE = "d0333acdd4443ed9a4a0239d24184755b812b447";
export const ENGINE_VERSION = "0.3.0";
export const THREE_REVISION = "185dev";
export const READY_GLOBAL = "__CRANE_LIVE_READY__";
export const PROGRESS_GLOBAL = "__CRANE_LIVE_PROGRESS__";
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
export const EDITS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      baseline: {},
      shoulder: { shoulder_deg: 65 },
      elbow: { elbow_deg: -60 },
      hoist: { hoist_length: 1.9 },
      arch: { opening_width: 2.1 },
      pipe: { pipe_bend_radius: 1.1 },
      tier: { top_tier_height: 0.38 },
      assembly: { assembly_yaw_deg: 20, assembly_dx: 0.55, assembly_dz: 0.4 },
    }).map(([key, value]) => [key, Object.freeze(value)]),
  ),
);
export const COMPOSITIONS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      baseline: [],
      articulation: ["shoulder", "elbow", "hoist"],
      all: ["shoulder", "elbow", "hoist", "arch", "pipe", "tier", "assembly"],
      "shape-assembly": ["arch", "pipe", "tier", "assembly"],
    }).map(([key, value]) => [key, Object.freeze(value)]),
  ),
);
export const PARAMETERS = Object.freeze(
  Object.fromEntries(
    [
      ...Object.keys(EDITS),
      ...Object.keys(COMPOSITIONS).filter((key) => key !== "baseline"),
    ].map((key) => [
      key,
      Object.freeze(
        Object.assign(
          {},
          BASELINE,
          ...(COMPOSITIONS[key] ?? [key]).map((edit) => EDITS[edit]),
        ),
      ),
    ]),
  ),
);
export function parametersFor(edit = "baseline") {
  if (typeof edit !== "string" || !Object.hasOwn(PARAMETERS, edit))
    throw Error(`Unknown edit: ${String(edit)}`);
  return { ...PARAMETERS[edit] };
}
const sequence = [
  "baseline",
  "baseline",
  "articulation",
  "articulation",
  "all",
  "all",
  "shape-assembly",
  "shape-assembly",
  "baseline",
  "baseline",
  "all",
  "all",
  "baseline",
  "baseline",
];
export const LIVE_STATES = Object.freeze(
  sequence.map((edit, index) =>
    Object.freeze({
      index,
      id: `s${String(index).padStart(2, "0")}-${edit}${index % 2 ? "--noop" : ""}`,
      edit,
      reset: edit === "baseline" && index > 1,
      noop: index > 0 && sequence[index - 1] === edit,
    }),
  ),
);
export const SESSION_IDS = Object.freeze([
  "live",
  ...Object.keys(COMPOSITIONS).map((edit) => `fresh-${edit}`),
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
  perEngineSessions: 5,
  perEngineStates: 18,
  totalSessions: 10,
  totalStates: 36,
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
  angles: "degrees; elbow relative to shoulder",
  lengths: "world units",
  assembly:
    "positive yaw maps local +X toward world -Z; pivot [-2.15,0,0.15]; then world dx/dz; applies crane and platform only",
  tier: "top tier bottom stays y=0.32; crane lift is height-0.18 before assembly",
  hoist:
    "world-vertical cable; requested length from boom tip; load center cable end minus [0,0.83,0]",
  geometry:
    "opening width and pipe bend radius affect static wall and pipe only",
  controls:
    "absolute parameters each state, never accumulated numeric deltas; fresh constructors start directly at selected composition before GPU resources exist",
});
