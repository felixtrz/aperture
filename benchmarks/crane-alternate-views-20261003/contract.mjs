/** One new axis: catalog camera selection. Geometry/pose contract is byte-retained. */
export { ENGINE_SOURCE, ENGINE_VERSION, THREE_REVISION, READY_GLOBAL, PROGRESS_GLOBAL, LIMITS, BASELINE, EDITS, COMPOSITIONS, PARAMETERS, parametersFor, WORKER_SETTINGS, SEMANTICS } from './pose-contract.mjs';
export const SCHEMA = 'aperture.crane-alternate-views.v1';
export const VIEWS = Object.freeze(Object.fromEntries(Object.entries({
  'front-quarter': [8, 6.5, 10],
  'rear-quarter': [-8, 5, -9],
  'high-oblique': [6, 11, 5],
}).map(([name, position]) => [name, Object.freeze({ name, position: Object.freeze(position), target: Object.freeze([0, 1.4, 0]), verticalSpan: 10.5 })])));
export const ALTERNATE_VIEWS = Object.freeze(['rear-quarter', 'high-oblique']);
export const POSES = Object.freeze(['baseline', 'all']);
export const SESSION_IDS = Object.freeze(ALTERNATE_VIEWS.flatMap(view => POSES.map(pose => `${view}-${pose}`)));
export function statesFor(session = 'rear-quarter-baseline') {
  if (!SESSION_IDS.includes(session)) throw Error(`Unknown session: ${session}`);
  const view = ALTERNATE_VIEWS.find(name => session.startsWith(name + '-'));
  return Object.freeze([Object.freeze({ index: 0, id: `s00-${session}`, edit: session.slice(view.length + 1), view, reset: false, noop: false })]);
}
export function viewFor(state) {
  if (!state || !ALTERNATE_VIEWS.includes(state.view) || !POSES.includes(state.edit)) throw Error('Unknown alternate camera/pose');
  return VIEWS[state.view];
}
export const BUDGETS = Object.freeze({ width: 1024, height: 1024, freshTimeoutMs: 240000, perStateDeadlineMs: 180000, perEngineSessions: 4, perEngineStates: 4, totalSessions: 8, totalStates: 8, allowedNativeAttemptsPerSession: 1 });
