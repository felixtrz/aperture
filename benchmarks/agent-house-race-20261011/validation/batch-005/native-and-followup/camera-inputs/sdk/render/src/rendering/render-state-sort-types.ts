import type { BatchCompatibilityKey, RenderSortKey } from "./snapshot.js";

export const OPAQUE_STATE_SORT_POLICY_NAME =
  "opaque-state-resource-front-to-back-stable";

export interface RenderStateSortRecord {
  readonly renderId: number;
  readonly sortKey: RenderSortKey;
  readonly batchKey: BatchCompatibilityKey;
  readonly materialResourceKey: string;
  readonly meshResourceKey: string;
}

export interface RenderStateSwitchCounts {
  readonly pipeline: number;
  readonly materialResource: number;
  readonly meshLayout: number;
  readonly meshResource: number;
  readonly total: number;
}

export interface OpaqueRenderStateSortPressureReport {
  readonly phase: "opaque";
  readonly policy: typeof OPAQUE_STATE_SORT_POLICY_NAME;
  readonly recordCount: number;
  readonly stableOrder: RenderStateSwitchCounts;
  readonly stateAwareOrder: RenderStateSwitchCounts;
  readonly delta: RenderStateSwitchCounts;
}
