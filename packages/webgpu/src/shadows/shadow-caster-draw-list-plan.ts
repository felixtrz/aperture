import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  MeshDrawPacket,
  ShadowRequestPacket,
} from "@aperture-engine/render";

import {
  parseMaterialPipelineRenderStateTokens,
  type MaterialPipelineRenderStateTokens,
} from "../materials/core/material-render-state.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type ShadowCasterCullMode = "back" | "front" | "none";

// three.js shadowSide parity: regular shadow-map casters render the opposite
// side of single-sided materials by default (FrontSide -> BackSide,
// BackSide -> FrontSide). This keeps the stored depth on the far surface of a
// closed caster and avoids lit-face acne without forcing a global rasterizer
// bias. Double-sided materials remain two-sided.
function casterCullModeForForward(
  forwardCullMode: string | null,
): ShadowCasterCullMode {
  if (forwardCullMode === "none") {
    return "none";
  }
  if (forwardCullMode === "front") {
    return "back";
  }
  // forward "back" (single-sided) or unknown -> render BACK faces.
  return "front";
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
  | "shadowCasterDrawList.unsupportedAlphaBlendCaster"
  | "shadowCasterDrawList.unsupportedAlphaTestCaster"
  | "shadowCasterDrawList.commandEncodingDeferred";

export function isDepthOnlyShadowCasterDrawSupported(
  draw: Pick<MeshDrawPacket, "batchKey">,
): boolean {
  const tokens = parseMaterialPipelineRenderStateTokens(
    draw.batchKey.pipelineKey,
  );

  return areDepthOnlyShadowCasterTokensSupported(tokens);
}

function areDepthOnlyShadowCasterTokensSupported(
  tokens: Pick<MaterialPipelineRenderStateTokens, "alphaMode">,
): boolean {
  // The current caster pass writes depth only; it does not sample material
  // alpha. Alpha-blended visual helpers and alpha-tested cutouts would cast as
  // solid geometry until a caster material path can evaluate cutoff state.
  return tokens.alphaMode !== "blend" && tokens.alphaMode !== "alpha-test";
}

function shadowCasterRenderStateDecision(
  pipelineKey: string,
  cache: Map<string, ShadowCasterRenderStateDecision>,
): ShadowCasterRenderStateDecision {
  const cached = cache.get(pipelineKey);

  if (cached !== undefined) {
    return cached;
  }

  const tokens = parseMaterialPipelineRenderStateTokens(pipelineKey);
  const decision = {
    supported: areDepthOnlyShadowCasterTokensSupported(tokens),
    alphaMode: tokens.alphaMode,
    casterCullMode: casterCullModeForForward(tokens.cullMode),
  };

  cache.set(pipelineKey, decision);
  return decision;
}

function cachedAssetHandleKey(
  cache: Map<unknown, string>,
  handle: Parameters<typeof assetHandleKey>[0],
): string {
  const cached = cache.get(handle);

  if (cached !== undefined) {
    return cached;
  }

  const key = assetHandleKey(handle);

  cache.set(handle, key);
  return key;
}

export interface ShadowCasterDrawRecord {
  readonly renderId: number;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly meshLayoutKey: string;
  /**
   * Cull mode for rendering this caster into the depth map. three.js shadowSide
   * parity: single-sided casters render the opposite side by default;
   * double-sided casters stay "none".
   */
  readonly casterCullMode: ShadowCasterCullMode;
  readonly submesh: number;
  readonly vertexStart?: number;
  readonly vertexCount?: number;
  readonly indexStart?: number;
  readonly indexCount?: number;
  readonly layerMask: number;
  /** Index into `snapshot.bounds` for this caster's world bounds. */
  readonly boundsIndex: number;
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

interface ShadowCasterRenderStateDecision {
  readonly supported: boolean;
  readonly alphaMode: string | null;
  readonly casterCullMode: ShadowCasterCullMode;
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
  const renderStateByPipelineKey = new Map<
    string,
    ShadowCasterRenderStateDecision
  >();
  const meshKeys = new Map<unknown, string>();
  const materialKeys = new Map<unknown, string>();
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

    const included: ShadowCasterDrawRecord[] = [];

    for (const draw of input.meshDraws) {
      if (
        draw.castsShadow === false ||
        (draw.layerMask & request.casterLayerMask) === 0
      ) {
        continue;
      }

      const renderState = shadowCasterRenderStateDecision(
        draw.batchKey.pipelineKey,
        renderStateByPipelineKey,
      );

      if (!renderState.supported) {
        const alphaMode = renderState.alphaMode;
        const alphaTest = alphaMode === "alpha-test";

        diagnostics.push({
          code: alphaTest
            ? "shadowCasterDrawList.unsupportedAlphaTestCaster"
            : "shadowCasterDrawList.unsupportedAlphaBlendCaster",
          severity: "warning",
          shadowId: request.shadowId,
          lightId: request.lightId,
          message: alphaTest
            ? `Shadow request '${request.shadowId}' skipped alpha-tested render object '${draw.renderId}' because the depth-only shadow caster pass cannot evaluate material cutoff alpha.`
            : `Shadow request '${request.shadowId}' skipped alpha-blended render object '${draw.renderId}' because the depth-only shadow caster pass cannot evaluate material alpha.`,
        });
        continue;
      }

      included.push({
        renderId: draw.renderId,
        meshKey: cachedAssetHandleKey(meshKeys, draw.mesh),
        materialKey: cachedAssetHandleKey(materialKeys, draw.material),
        meshLayoutKey: draw.batchKey.meshLayoutKey,
        casterCullMode: renderState.casterCullMode,
        submesh: draw.submesh,
        ...(draw.vertexStart === undefined
          ? {}
          : { vertexStart: draw.vertexStart }),
        ...(draw.vertexCount === undefined
          ? {}
          : { vertexCount: draw.vertexCount }),
        ...(draw.indexStart === undefined
          ? {}
          : { indexStart: draw.indexStart }),
        ...(draw.indexCount === undefined
          ? {}
          : { indexCount: draw.indexCount }),
        layerMask: draw.layerMask,
        boundsIndex: draw.boundsIndex,
        worldTransformOffset: draw.worldTransformOffset,
      });
    }
    included.sort(compareShadowCasterDrawRecords);
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

function compareShadowCasterDrawRecords(
  a: ShadowCasterDrawRecord,
  b: ShadowCasterDrawRecord,
): number {
  return (
    compareStrings(a.meshKey, b.meshKey) ||
    compareStrings(a.materialKey, b.materialKey) ||
    compareStrings(a.meshLayoutKey, b.meshLayoutKey) ||
    compareStrings(a.casterCullMode, b.casterCullMode) ||
    compareNumbers(a.submesh, b.submesh) ||
    compareOptionalNumbers(a.vertexStart, b.vertexStart) ||
    compareOptionalNumbers(a.vertexCount, b.vertexCount) ||
    compareOptionalNumbers(a.indexStart, b.indexStart) ||
    compareOptionalNumbers(a.indexCount, b.indexCount) ||
    compareNumbers(a.layerMask, b.layerMask) ||
    a.renderId - b.renderId
  );
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function compareOptionalNumbers(
  a: number | undefined,
  b: number | undefined,
): number {
  return (a ?? -1) - (b ?? -1);
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
