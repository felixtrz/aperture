import { nestedRecord, renderPacketFamiliesArg, stringArg } from "./args.js";
import type { AperturePage } from "./browser.js";
import {
  RENDER_DIAGNOSTICS_PROPERTY,
  STATUS_GLOBAL,
  type GeneratedStatusLike,
} from "./types.js";
import { callGeneratedRuntimeTool } from "./runtime.js";

export async function renderFrameReport(
  page: AperturePage,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const summaryOnly = args["summaryOnly"] === true;
  const report = await page.evaluate(
    ({ statusGlobal, renderDiagnosticsProperty, summaryOnly }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as
        | (Record<string, unknown> & {
            readonly diagnostics?: {
              readonly lastFrame?: unknown;
            };
            readonly lastWorkerSummary?: {
              readonly particles?: unknown;
              readonly entities?: unknown;
            };
            readonly lastFrame?: number | null;
          })
        | null;
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const accessor = isRecord(status)
        ? (status[renderDiagnosticsProperty] as
            | { getDiagnostics?: (options?: unknown) => unknown }
            | undefined)
        : undefined;
      const diagnostics =
        typeof accessor?.getDiagnostics === "function"
          ? (accessor.getDiagnostics({ detail: "full" }) as {
              readonly lastFrame?: unknown;
            } | null)
          : status?.diagnostics;
      const lastFrame = diagnostics?.lastFrame ?? null;
      const frameRecord = isRecord(lastFrame) ? lastFrame : null;

      const summary = {
        frame:
          typeof frameRecord?.["frame"] === "number"
            ? frameRecord["frame"]
            : (status?.lastFrame ?? null),
        ok: typeof frameRecord?.["ok"] === "boolean" ? frameRecord["ok"] : null,
        counts: frameRecord?.["counts"] ?? null,
        particles: frameRecord?.["particles"] ?? null,
        particleQueue: status?.lastWorkerSummary?.particles ?? null,
        renderTargets: frameRecord?.["renderTargets"] ?? null,
        postEffects: frameRecord?.["postEffects"] ?? null,
        diagnostics: frameRecord?.["diagnostics"] ?? [],
      };

      if (summaryOnly) {
        return { summary };
      }

      return {
        summary,
        lastFrame,
        entities: status?.lastWorkerSummary?.entities ?? null,
      };
    },
    {
      statusGlobal: STATUS_GLOBAL,
      renderDiagnosticsProperty: RENDER_DIAGNOSTICS_PROPERTY,
      summaryOnly,
    },
  );

  return { ok: true, report };
}

export async function renderSnapshotSummary(
  page: AperturePage,
): Promise<unknown> {
  const summary = await page.evaluate(
    ({ statusGlobal, renderDiagnosticsProperty }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const accessor = isRecord(status)
        ? (status[renderDiagnosticsProperty] as
            | { getDiagnostics?: (options?: unknown) => unknown }
            | undefined)
        : undefined;
      const diagnostics =
        typeof accessor?.getDiagnostics === "function"
          ? (accessor.getDiagnostics({ detail: "full" }) as {
              readonly lastFrame?: unknown;
            } | null)
          : status?.diagnostics;
      const lastFrame = isRecord(diagnostics?.lastFrame)
        ? diagnostics.lastFrame
        : null;

      return {
        frame: status?.lastFrame ?? null,
        snapshots: status?.snapshots ?? 0,
        counts: lastFrame?.["counts"] ?? null,
        renderChangeSet: lastFrame?.["renderChangeSet"] ?? null,
        particleQueue: status?.lastWorkerSummary?.particles ?? null,
        entities: status?.lastWorkerSummary?.entities ?? null,
        diagnostics: lastFrame?.["diagnostics"] ?? [],
      };
    },
    {
      statusGlobal: STATUS_GLOBAL,
      renderDiagnosticsProperty: RENDER_DIAGNOSTICS_PROPERTY,
    },
  );

  return { ok: true, summary };
}

export async function renderDiagnostics(page: AperturePage): Promise<unknown> {
  const diagnostics = await page.evaluate(
    ({ statusGlobal, renderDiagnosticsProperty }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const accessor = isRecord(status)
        ? (status[renderDiagnosticsProperty] as
            | { getDiagnostics?: (options?: unknown) => unknown }
            | undefined)
        : undefined;
      const app =
        typeof accessor?.getDiagnostics === "function"
          ? accessor.getDiagnostics({ detail: "full" })
          : (status?.diagnostics ?? null);

      return {
        app,
        worker: status?.lastWorkerSummary?.diagnostics ?? [],
        failure: status?.lastFailure ?? null,
      };
    },
    {
      statusGlobal: STATUS_GLOBAL,
      renderDiagnosticsProperty: RENDER_DIAGNOSTICS_PROPERTY,
    },
  );

  return { ok: true, diagnostics };
}

export async function renderPackets(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const families = renderPacketFamiliesArg(args);
  const packets = await page.evaluate(
    ({ statusGlobal, renderDiagnosticsProperty, requestedFamilies }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const accessor = isRecord(status)
        ? (status[renderDiagnosticsProperty] as
            | { getDiagnostics?: (options?: unknown) => unknown }
            | undefined)
        : undefined;
      const diagnostics =
        typeof accessor?.getDiagnostics === "function"
          ? (accessor.getDiagnostics({ detail: "full" }) as {
              readonly lastFrame?: unknown;
            } | null)
          : status?.diagnostics;
      const lastFrame = isRecord(diagnostics?.lastFrame)
        ? diagnostics.lastFrame
        : null;
      const changeSet = isRecord(lastFrame?.["renderChangeSet"])
        ? lastFrame["renderChangeSet"]
        : null;
      const changeSetRecord = changeSet as Record<string, unknown> | undefined;
      const changeSetKeys = changeSet?.["keys"] as
        | Record<string, unknown>
        | undefined;
      const families: Record<string, unknown> = {};

      for (const family of requestedFamilies) {
        const changeSetFamily =
          family === "shadows" ? "shadowRequests" : family;
        const familyCounts = changeSetRecord?.[changeSetFamily] ?? null;

        families[family] = {
          family: changeSetFamily,
          counts:
            typeof familyCounts === "object" && familyCounts !== null
              ? familyCounts
              : null,
          keys: changeSetKeys?.[changeSetFamily] ?? null,
        };
      }

      return {
        frame: lastFrame?.["frame"] ?? null,
        counts: lastFrame?.["counts"] ?? null,
        keys: changeSet?.["keys"] ?? null,
        changes: changeSet?.["total"] ?? null,
        families,
      };
    },
    {
      statusGlobal: STATUS_GLOBAL,
      renderDiagnosticsProperty: RENDER_DIAGNOSTICS_PROPERTY,
      requestedFamilies: families,
    },
  );

  return { ok: true, packets };
}

export async function renderExplainEntity(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const key = stringArg(args, "key");
  const entity = nestedRecord(args, "entity") ?? undefined;
  const summary = await resolveRenderExplainEntitySummary(page, key, entity);
  const report = await page.evaluate(
    ({ statusGlobal, renderDiagnosticsProperty, summary }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const accessor = isRecord(status)
        ? (status[renderDiagnosticsProperty] as
            | { getDiagnostics?: (options?: unknown) => unknown }
            | undefined)
        : undefined;
      const diagnostics =
        typeof accessor?.getDiagnostics === "function"
          ? (accessor.getDiagnostics({ detail: "full" }) as {
              readonly lastFrame?: unknown;
            } | null)
          : status?.diagnostics;
      const lastFrame = isRecord(diagnostics?.lastFrame)
        ? diagnostics.lastFrame
        : null;
      const entitySummary = isRecord(summary) ? summary : null;
      const entityRef = isRecord(summary?.["entity"])
        ? summary["entity"]
        : null;
      const entityIndex =
        typeof entityRef?.["index"] === "number" ? entityRef["index"] : null;
      const entityGeneration =
        typeof entityRef?.["generation"] === "number"
          ? entityRef["generation"]
          : 0;
      const renderChangeSet = isRecord(lastFrame?.["renderChangeSet"])
        ? lastFrame["renderChangeSet"]
        : null;
      const keys = isRecord(renderChangeSet?.["keys"])
        ? renderChangeSet["keys"]
        : null;
      const meshDrawKeysRecord = isRecord(keys?.["meshDraws"])
        ? keys["meshDraws"]
        : null;
      const boundsKeysRecord = isRecord(keys?.["bounds"])
        ? keys["bounds"]
        : null;
      const meshDrawKeys = [
        ...(Array.isArray(meshDrawKeysRecord?.["changed"])
          ? meshDrawKeysRecord["changed"]
          : []),
        ...(Array.isArray(meshDrawKeysRecord?.["unchanged"])
          ? meshDrawKeysRecord["unchanged"]
          : []),
      ];
      const boundsKeys = [
        ...(Array.isArray(boundsKeysRecord?.["changed"])
          ? boundsKeysRecord["changed"]
          : []),
        ...(Array.isArray(boundsKeysRecord?.["unchanged"])
          ? boundsKeysRecord["unchanged"]
          : []),
      ];
      const renderKey =
        entityIndex === null ? null : `mesh-draw:${String(entityIndex)}`;
      const boundsKeyPrefix =
        entityIndex === null
          ? null
          : `bounds:${String(entityIndex)}:${String(entityGeneration)}:`;
      const legacyBoundsKey =
        entityIndex === null ? null : `bounds:${String(entityIndex)}:0`;
      const boundsKey =
        boundsKeyPrefix === null
          ? null
          : (boundsKeys.find(
              (key): key is string =>
                typeof key === "string" && key.startsWith(boundsKeyPrefix),
            ) ??
              boundsKeys.find(
                (key): key is string =>
                  typeof key === "string" && key === legacyBoundsKey,
              )) ||
            `${boundsKeyPrefix}0`;

      return {
        entity: entitySummary,
        rendered: renderKey === null ? false : meshDrawKeys.includes(renderKey),
        hasBounds:
          boundsKeyPrefix === null
            ? false
            : boundsKeys.some(
                (key) =>
                  typeof key === "string" &&
                  (key.startsWith(boundsKeyPrefix) || key === legacyBoundsKey),
              ),
        renderKey,
        boundsKey,
        frame: lastFrame?.["frame"] ?? null,
        counts: lastFrame?.["counts"] ?? null,
        diagnostics: lastFrame?.["diagnostics"] ?? [],
      };
    },
    {
      statusGlobal: STATUS_GLOBAL,
      renderDiagnosticsProperty: RENDER_DIAGNOSTICS_PROPERTY,
      summary,
    },
  );

  return { ok: true, report };
}

async function resolveRenderExplainEntitySummary(
  page: AperturePage,
  key: string | undefined,
  entity: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | null> {
  const runtimeSummary = await resolveRuntimeEntitySummary(page, key, entity);

  if (runtimeSummary !== null) {
    return runtimeSummary;
  }

  return resolveStatusEntitySummary(page, key, entity);
}

async function resolveRuntimeEntitySummary(
  page: AperturePage,
  key: string | undefined,
  entity: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | null> {
  if (key !== undefined && key.length > 0) {
    const response = await callGeneratedRuntimeTool(page, "ecs_find_entities", {
      key,
      limit: 1,
    });
    const result = isRecord(response) ? response["result"] : null;
    const summaries =
      isRecord(result) && Array.isArray(result["summaries"])
        ? result["summaries"]
        : [];
    const summary = summaries.find(isRecord);

    if (summary !== undefined) {
      return summary;
    }
  }

  if (entity !== undefined) {
    const response = await callGeneratedRuntimeTool(page, "ecs_get_entity", {
      entity,
    });
    const result = isRecord(response) ? response["result"] : null;
    const summary = isRecord(result) ? result["summary"] : null;

    if (isRecord(summary)) {
      return summary;
    }
  }

  return null;
}

async function resolveStatusEntitySummary(
  page: AperturePage,
  key: string | undefined,
  entity: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    ({ statusGlobal, key, entity }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const summaries =
        status?.lastWorkerSummary?.entities?.summaries?.filter(isRecord) ?? [];
      const requested = isRecord(entity) ? entity : null;

      return (
        summaries.find(
          (candidate) =>
            typeof key === "string" &&
            key.length > 0 &&
            candidate["key"] === key,
        ) ??
        summaries.find((candidate) => {
          const candidateEntity = isRecord(candidate["entity"])
            ? candidate["entity"]
            : null;

          return (
            requested !== null &&
            candidateEntity?.["index"] === requested["index"] &&
            candidateEntity?.["generation"] === requested["generation"]
          );
        }) ??
        null
      );
    },
    { statusGlobal: STATUS_GLOBAL, key, entity },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
