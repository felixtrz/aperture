import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  MeshDrawPacket,
  ShadowRequestPacket,
} from "@aperture-engine/render";

import { parseMaterialPipelineRenderStateTokens } from "../materials/core/material-render-state.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type ShadowCasterCullMode = "back" | "front" | "none";

// PlayCanvas parity: a caster renders the SAME faces as the forward pass (its
// light-facing FRONT faces), so a caster that punches up through a receiver
// still writes the depth of its protruding front geometry and casts correctly.
// (three.js renders the OPPOSITE/back faces, which loses thin/protruding-front
// shadows — a documented flaw aperture previously inherited.) Front-face
// rendering moves self-shadow acne onto the lit faces, so it MUST be paired with
// the slope-scaled rasterizer depth bias applied to every caster pipeline
// (shadow-caster-pipeline-descriptor.ts biasForCull) — exactly PlayCanvas's
// front-face + always-on slope/constant bias model. Double-sided ("none") stays
// two-sided so thin/open geometry casts from both faces.
function casterCullModeForForward(
  forwardCullMode: string | null,
): ShadowCasterCullMode {
  if (forwardCullMode === "none") {
    return "none";
  }
  if (forwardCullMode === "front") {
    return "front";
  }
  // forward "back" (single-sided) or unknown -> render FRONT faces (same as
  // the forward pass), so protruding front geometry casts correctly.
  return "back";
}

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
  readonly meshLayoutKey: string;
  /**
   * Cull mode for rendering this caster into the depth map. PlayCanvas parity:
   * the caster renders the SAME faces as the forward pass (single-sided -> render
   * front faces; double-sided -> "none"), so protruding geometry casts correctly;
   * acne is handled by the slope-scaled depth bias, not by back-face rendering.
   */
  readonly casterCullMode: ShadowCasterCullMode;
  readonly submesh: number;
  readonly layerMask: number;
  /** Float offset into `snapshot.transforms` for this caster's WORLD matrix (16 floats). */
  readonly worldTransformOffset: number;
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
  const requestsByKey = new Map(
    input.shadowRequests.map((request) => [
      `${request.shadowId}:${request.lightId}`,
      request,
    ]),
  );
  const plannedRequestKeys = new Set(
    input.shadowPassPlan.passes.map(
      (pass) => `${pass.shadowId}:${pass.lightId}`,
    ),
  );
  const lists: ShadowCasterDrawList[] = [];

  for (const request of input.shadowRequests) {
    if (plannedRequestKeys.has(`${request.shadowId}:${request.lightId}`)) {
      continue;
    }

    diagnostics.push({
      code: "shadowCasterDrawList.missingPassPlan",
      severity: "warning",
      shadowId: request.shadowId,
      lightId: request.lightId,
      message: `Shadow request '${request.shadowId}' has no planned shadow pass for caster draw-list planning.`,
    });
  }

  for (const pass of input.shadowPassPlan.passes) {
    const request = requestsByKey.get(`${pass.shadowId}:${pass.lightId}`);

    if (request === undefined) {
      diagnostics.push({
        code: "shadowCasterDrawList.missingPassPlan",
        severity: "warning",
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        message: `Shadow pass '${pass.passKey}' has no extracted shadow request for caster draw-list planning.`,
      });
      continue;
    }

    const included = input.meshDraws
      .filter(
        (draw) =>
          draw.castsShadow !== false &&
          (draw.layerMask & request.casterLayerMask) !== 0,
      )
      .map((draw) => ({
        renderId: draw.renderId,
        meshKey: assetHandleKey(draw.mesh),
        materialKey: assetHandleKey(draw.material),
        meshLayoutKey: draw.batchKey.meshLayoutKey,
        casterCullMode: casterCullModeForForward(
          parseMaterialPipelineRenderStateTokens(draw.batchKey.pipelineKey)
            .cullMode,
        ),
        submesh: draw.submesh,
        layerMask: draw.layerMask,
        worldTransformOffset: draw.worldTransformOffset,
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
