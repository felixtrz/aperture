export * from '../contract.mjs';
import { statesFor } from '../contract.mjs';
// The runner substitutes this one literal for both page and worker; records it.
export const SESSION_ID = 'rear-quarter-baseline';
export const STATES = statesFor(SESSION_ID);
export const INITIAL_EDIT = STATES[0].edit;
export const VIEW_NAME = STATES[0].view;
