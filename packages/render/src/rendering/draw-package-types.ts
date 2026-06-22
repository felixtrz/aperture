import type { RenderWorldReadyDraw } from "./render-world.js";
import type { OpaqueRenderStateSortPressureReport } from "./render-state-sort.js";
import type { RenderDiagnostic } from "./snapshot.js";

export interface RenderWorldDrawPackage {
  readonly renderId: number;
  readonly packet: RenderWorldReadyDraw["packet"];
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly batchKey: RenderWorldReadyDraw["batchKey"];
  readonly sortKey: RenderWorldReadyDraw["packet"]["sortKey"];
  readonly transformPackedOffset: number;
}

export interface RenderWorldDrawPackagePlan {
  readonly packages: readonly RenderWorldDrawPackage[];
  readonly diagnostics: readonly RenderDiagnostic[];
  readonly summary: RenderWorldDrawPackageScratchSummary;
}

export interface RenderWorldDrawPackageDiagnosticSummary {
  readonly total: number;
  readonly byCode: Readonly<Record<string, number>>;
}

export interface RenderWorldDrawPackageScratchSummary {
  readonly readyDrawCount: number;
  readonly blockedDrawCount: number;
  readonly packageCount: number;
  readonly packagePoolSize: number;
  readonly packagePoolSizeBeforeWrite: number;
  readonly packageSlotsReused: number;
  readonly packageSlotsCreated: number;
  readonly missingPackedTransformCount: number;
  readonly diagnostics: RenderWorldDrawPackageDiagnosticSummary;
  readonly stateSort: OpaqueRenderStateSortPressureReport;
}

export interface RenderWorldDrawPackageScratch {
  readonly packages: RenderWorldDrawPackage[];
  readonly diagnostics: RenderDiagnostic[];
  readonly packagePool: RenderWorldDrawPackage[];
  readonly stableOrderScratch: RenderWorldDrawPackage[];
  readonly summary: RenderWorldDrawPackageScratchSummary;
  readonly plan: RenderWorldDrawPackagePlan;
}
