import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  MeshDrawPacket,
  ShadowRequestPacket,
} from "@aperture-engine/render";

import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type ShadowCasterDrawListStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "not-required";

export type ShadowCasterDrawListMode = "ready" | "deferred";

export type ShadowCasterDrawListDiagnosticCode =
  | "shadowCasterDrawList.missingPassPlan"
  | "shadowCasterDrawList.noCasters"
  | "shadowCasterDrawList.commandEncodingDeferred";

export interface ShadowCasterDrawRecord {
  readonly renderId: number;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly submesh: number;
  readonly layerMask: number;
}

export interface ShadowCasterDrawList {
  readonly shadowId: number;
  readonly lightId: number;
  readonly passKey: string;
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
  readonly includedDrawCount: number;
  readonly skippedDrawCount: number;
  readonly commandEncoding: ShadowCasterDrawListMode;
  readonly draws: readonly ShadowCasterDrawRecord[];
}

export interface ShadowCasterDrawListDiagnostic {
  readonly code: ShadowCasterDrawListDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId: number;
  readonly lightId: number;
  readonly message: string;
}

export interface ShadowCasterDrawListPlanReport {
  readonly ready: boolean;
  readonly status: ShadowCasterDrawListStatus;
  readonly requestCount: number;
  readonly meshDrawCount: number;
  readonly listCount: number;
  readonly includedDrawCount: number;
  readonly skippedDrawCount: number;
  readonly sections: {
    readonly shadowRequests: boolean;
    readonly passPlans: boolean;
    readonly casterFiltering: boolean;
    readonly commandEncoding: boolean;
  };
  readonly lists: readonly ShadowCasterDrawList[];
  readonly diagnostics: readonly ShadowCasterDrawListDiagnostic[];
}

export type ShadowCasterDrawListPlanReportJsonValue =
  ShadowCasterDrawListPlanReport;

export interface ShadowCasterDrawListPlanInput {
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  readonly shadowPassPlan: ShadowPassPlanReport;
  readonly commandEncoding?: ShadowCasterDrawListMode;
}

export function createShadowCasterDrawListPlanReport(
  input: ShadowCasterDrawListPlanInput,
): ShadowCasterDrawListPlanReport {
  const commandEncoding = input.commandEncoding ?? "deferred";

  if (input.shadowRequests.length === 0) {
    return {
      ready: true,
      status: "not-required",
      requestCount: 0,
      meshDrawCount: input.meshDraws.length,
      listCount: 0,
      includedDrawCount: 0,
      skippedDrawCount: 0,
      sections: {
        shadowRequests: true,
        passPlans: true,
        casterFiltering: true,
        commandEncoding: true,
      },
      lists: [],
      diagnostics: [],
    };
  }

  const diagnostics: ShadowCasterDrawListDiagnostic[] = [];
  const passesByKey = new Map(
    input.shadowPassPlan.passes.map((pass) => [
      `${pass.shadowId}:${pass.lightId}`,
      pass,
    ]),
  );
  const lists: ShadowCasterDrawList[] = [];

  for (const request of input.shadowRequests) {
    const pass = passesByKey.get(`${request.shadowId}:${request.lightId}`);

    if (pass === undefined) {
      diagnostics.push({
        code: "shadowCasterDrawList.missingPassPlan",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Shadow request '${request.shadowId}' has no pass plan for caster draw-list planning.`,
      });
      continue;
    }

    const included = input.meshDraws
      .filter((draw) => (draw.layerMask & request.casterLayerMask) !== 0)
      .map((draw) => ({
        renderId: draw.renderId,
        meshKey: assetHandleKey(draw.mesh),
        materialKey: assetHandleKey(draw.material),
        submesh: draw.submesh,
        layerMask: draw.layerMask,
      }));
    const skippedDrawCount = input.meshDraws.length - included.length;

    if (included.length === 0) {
      diagnostics.push({
        code: "shadowCasterDrawList.noCasters",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Shadow request '${request.shadowId}' has no mesh draws matching caster layer mask '${request.casterLayerMask}'.`,
      });
    }

    lists.push({
      shadowId: request.shadowId,
      lightId: request.lightId,
      passKey: pass.passKey,
      casterLayerMask: request.casterLayerMask,
      receiverLayerMask: request.receiverLayerMask,
      includedDrawCount: included.length,
      skippedDrawCount,
      commandEncoding,
      draws: included,
    });
  }

  if (
    lists.some((list) => list.includedDrawCount > 0) &&
    commandEncoding === "deferred"
  ) {
    const first = lists.find((list) => list.includedDrawCount > 0);
    diagnostics.push({
      code: "shadowCasterDrawList.commandEncodingDeferred",
      severity: "warning",
      shadowId: first?.shadowId ?? 0,
      lightId: first?.lightId ?? 0,
      message:
        "Shadow caster draw lists are planned, but shadow command encoding is not implemented yet.",
    });
  }

  const hasMissingPass = diagnostics.some(
    (diagnostic) => diagnostic.code === "shadowCasterDrawList.missingPassPlan",
  );
  const status = hasMissingPass
    ? "missing"
    : commandEncoding === "ready"
      ? "ready"
      : "deferred";
  const includedDrawCount = lists.reduce(
    (sum, list) => sum + list.includedDrawCount,
    0,
  );
  const skippedDrawCount = lists.reduce(
    (sum, list) => sum + list.skippedDrawCount,
    0,
  );

  return {
    ready: status === "ready",
    status,
    requestCount: input.shadowRequests.length,
    meshDrawCount: input.meshDraws.length,
    listCount: lists.length,
    includedDrawCount,
    skippedDrawCount,
    sections: {
      shadowRequests: true,
      passPlans: !hasMissingPass,
      casterFiltering: true,
      commandEncoding: status === "ready",
    },
    lists,
    diagnostics,
  };
}

export function shadowCasterDrawListPlanReportToJsonValue(
  report: ShadowCasterDrawListPlanReport,
): ShadowCasterDrawListPlanReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    requestCount: report.requestCount,
    meshDrawCount: report.meshDrawCount,
    listCount: report.listCount,
    includedDrawCount: report.includedDrawCount,
    skippedDrawCount: report.skippedDrawCount,
    sections: { ...report.sections },
    lists: report.lists.map((list) => ({
      ...list,
      draws: list.draws.map((draw) => ({ ...draw })),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowCasterDrawListPlanReportToJson(
  report: ShadowCasterDrawListPlanReport,
): string {
  return JSON.stringify(shadowCasterDrawListPlanReportToJsonValue(report));
}
