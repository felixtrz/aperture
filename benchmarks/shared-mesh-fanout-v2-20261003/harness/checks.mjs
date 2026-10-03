export * from "./base-checks.mjs";
import * as base from "./base-checks.mjs";
import {
  validateFanoutGeometry,
  validateMirrorAndSnapshot,
  validateSubmittedFanout,
  validateFanoutTransition,
} from "../fanout-checks.mjs";
import { LIGHT } from "../contract.mjs";
export function validateTransport(t) {
  base.requireValue(
    t?.active === "shared-array-buffer" &&
      t.fallback === null &&
      t.sharedArrayBuffer?.supported === true,
    "Fallback snapshot transport",
  );
}
export function validateEvidence(e, state, receipt) {
  base.validateEvidence(e, state, receipt);
  base.requireValue(
    JSON.stringify(e.appearance.lights) === JSON.stringify([LIGHT]) &&
      e.appearance.config.cadence === "demand",
    "Fixed lighting/demand cadence changed",
  );
  validateTransport(e.transport);
  validateFanoutGeometry(e, state);
  validateMirrorAndSnapshot(e, receipt);
  validateSubmittedFanout(e, receipt);
  return e;
}
export function validateTransition(e, state, previous) {
  validateFanoutTransition(e, state, previous);
}
export function validateStateRecord(record, index, states) {
  base.validateStateRecord(record, index, states);
  validateEvidence(record.evidence, record.state, record.receipt);
  return record;
}
