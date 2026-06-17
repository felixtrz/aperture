import { nestedRecord, renderPacketFamiliesArg, stringArg } from "./args.js";
import type { AperturePage } from "./browser.js";
import { STATUS_GLOBAL, type GeneratedStatusLike } from "./types.js";

export async function renderFrameReport(
  page: AperturePage,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const summaryOnly = args["summaryOnly"] === true;
  const report = await page.evaluate(
    ({ statusGlobal, summaryOnly }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as {
        readonly diagnostics?: {
          readonly lastFrame?: unknown;
        };
        readonly lastWorkerSummary?: {
          readonly particles?: unknown;
          readonly entities?: unknown;
        };
        readonly lastFrame?: number | null;
      } | null;
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const lastFrame = status?.diagnostics?.lastFrame ?? null;
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
    { statusGlobal: STATUS_GLOBAL, summaryOnly },
  );

  return { ok: true, report };
}

export async function renderSnapshotSummary(
  page: AperturePage,
): Promise<unknown> {
  const summary = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const lastFrame = status?.diagnostics?.lastFrame;

      return {
        frame: status?.lastFrame ?? null,
        snapshots: status?.snapshots ?? 0,
        counts: lastFrame?.counts ?? null,
        renderChangeSet: lastFrame?.renderChangeSet ?? null,
        particleQueue: status?.lastWorkerSummary?.particles ?? null,
        entities: status?.lastWorkerSummary?.entities ?? null,
        diagnostics: lastFrame?.diagnostics ?? [],
      };
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, summary };
}

export async function renderDiagnostics(page: AperturePage): Promise<unknown> {
  const diagnostics = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;

      return {
        app: status?.diagnostics ?? null,
        worker: status?.lastWorkerSummary?.diagnostics ?? [],
        failure: status?.lastFailure ?? null,
      };
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, diagnostics };
}

export async function renderPackets(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const families = renderPacketFamiliesArg(args);
  const packets = await page.evaluate(
    ({ statusGlobal, requestedFamilies }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const lastFrame = status?.diagnostics?.lastFrame;
      const changeSet = lastFrame?.renderChangeSet;
      const changeSetRecord = changeSet as Record<string, unknown> | undefined;
      const changeSetKeys = changeSet?.keys as
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
        frame: lastFrame?.frame ?? null,
        counts: lastFrame?.counts ?? null,
        keys: changeSet?.keys ?? null,
        changes: changeSet?.total ?? null,
        families,
      };
    },
    { statusGlobal: STATUS_GLOBAL, requestedFamilies: families },
  );

  return { ok: true, packets };
}

export async function renderExplainEntity(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const report = await page.evaluate(
    ({ statusGlobal, key, entity }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const summaries =
        status?.lastWorkerSummary?.entities?.summaries?.filter(isRecord) ?? [];
      const requested = isRecord(entity) ? entity : null;
      const summary =
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
        null;
      const entityRef = isRecord(summary?.["entity"])
        ? summary["entity"]
        : null;
      const entityIndex =
        typeof entityRef?.["index"] === "number" ? entityRef["index"] : null;
      const keys = status?.diagnostics?.lastFrame?.renderChangeSet?.keys;
      const meshDrawKeys = [
        ...(keys?.meshDraws?.changed ?? []),
        ...(keys?.meshDraws?.unchanged ?? []),
      ];
      const boundsKeys = [
        ...(keys?.bounds?.changed ?? []),
        ...(keys?.bounds?.unchanged ?? []),
      ];
      const renderKey =
        entityIndex === null ? null : `mesh-draw:${String(entityIndex)}`;
      const boundsKey =
        entityIndex === null ? null : `bounds:${String(entityIndex)}:0`;

      return {
        entity: summary,
        rendered: renderKey === null ? false : meshDrawKeys.includes(renderKey),
        hasBounds: boundsKey === null ? false : boundsKeys.includes(boundsKey),
        renderKey,
        boundsKey,
        frame: status?.diagnostics?.lastFrame?.frame ?? null,
        counts: status?.diagnostics?.lastFrame?.counts ?? null,
        diagnostics: status?.diagnostics?.lastFrame?.diagnostics ?? [],
      };
    },
    {
      statusGlobal: STATUS_GLOBAL,
      key: stringArg(args, "key"),
      entity: nestedRecord(args, "entity"),
    },
  );

  return { ok: true, report };
}
