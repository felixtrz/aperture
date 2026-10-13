import {
  compareRenderSortKeys,
  type RenderSnapshot,
  type RenderSortKey,
} from "@aperture-engine/render";
import {
  runDisposersInReverse,
  type MaybePromise,
} from "@aperture-engine/simulation";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

export type WebGpuFeatureCommandPhase =
  | "opaque"
  | "alpha-test"
  | "transparent"
  | "overlay";

export interface WebGpuFeatureCommandGroup {
  readonly featureId: string;
  readonly phase: WebGpuFeatureCommandPhase;
  readonly sortKey?: RenderSortKey;
  readonly ordinal: number;
  readonly commands: readonly RenderPassCommand[];
}

export interface WebGpuFeatureCommandGroupDiagnostic {
  readonly code: "webGpuFeatureCommandGroup.missingSortKey";
  readonly featureId: string;
  readonly phase: WebGpuFeatureCommandPhase;
  readonly message: string;
}

export interface WebGpuFeatureFrameResult<TReport = unknown> {
  readonly valid: boolean;
  readonly commandGroups: readonly WebGpuFeatureCommandGroup[];
  readonly diagnostics?: readonly unknown[];
  readonly report?: TReport;
}

export interface WebGpuFeatureRealizer<TInput = unknown, TReport = unknown> {
  readonly id: string;
  readonly packetFamilies: readonly string[];
  prepareFrame(input: TInput): MaybePromise<WebGpuFeatureFrameResult<TReport>>;
  dispose?(): MaybePromise<void>;
}

export interface WebGpuFeatureRegistryFrameResult {
  /** Logical AND of every realizer's declared `valid` flag — and nothing else. */
  readonly valid: boolean;
  /**
   * Non-empty opaque/alpha-test/transparent groups in realizer order, sort
   * keys preserved. Interleave them with scene commands through
   * `mergeSnapshotSortedRenderPassCommands`.
   */
  readonly sceneGroups: readonly WebGpuFeatureCommandGroup[];
  /** Overlay-phase commands flattened in ascending group-ordinal order. */
  readonly overlayCommands: readonly RenderPassCommand[];
  /** Per-feature frame reports keyed by realizer id. */
  readonly reports: ReadonlyMap<string, unknown>;
  /** Realizer-reported diagnostics. Advisory: never gates frame submission. */
  readonly diagnostics: readonly unknown[];
}

export interface WebGpuFeatureRealizerRegistry<TInput = unknown> {
  register(realizer: WebGpuFeatureRealizer<TInput>): () => Promise<void>;
  list(): readonly WebGpuFeatureRealizer<TInput>[];
  prepareFrame(input: TInput): Promise<WebGpuFeatureRegistryFrameResult>;
  dispose(): Promise<void>;
}

export function createWebGpuFeatureRealizerRegistry<
  TInput = unknown,
>(): WebGpuFeatureRealizerRegistry<TInput> {
  const realizers: WebGpuFeatureRealizer<TInput>[] = [];
  const disposers: (() => Promise<void>)[] = [];

  return {
    register(realizer) {
      if (realizers.some((candidate) => candidate.id === realizer.id)) {
        throw new Error(
          `WebGPU feature realizer '${realizer.id}' is already registered.`,
        );
      }

      let disposed = false;
      realizers.push(realizer);

      const dispose = async (): Promise<void> => {
        if (disposed) {
          return;
        }

        disposed = true;
        const index = realizers.indexOf(realizer);
        if (index >= 0) {
          realizers.splice(index, 1);
        }
        await realizer.dispose?.();
      };

      disposers.push(dispose);
      return dispose;
    },
    list() {
      return realizers.slice();
    },
    // Realizer exceptions intentionally propagate: a throwing prepareFrame
    // must reject the frame loudly (with its stack) instead of degrading into
    // a silent ok:false report.
    async prepareFrame(input) {
      const sceneGroups: WebGpuFeatureCommandGroup[] = [];
      const overlayGroups: WebGpuFeatureCommandGroup[] = [];
      const reports = new Map<string, unknown>();
      const diagnostics: unknown[] = [];
      let valid = true;

      for (const realizer of realizers.slice()) {
        const result = await realizer.prepareFrame(input);

        valid = valid && result.valid;
        if (result.report !== undefined) {
          reports.set(realizer.id, result.report);
        }
        if (result.diagnostics !== undefined) {
          diagnostics.push(...result.diagnostics);
        }
        for (const group of result.commandGroups) {
          // An empty group is a legal no-op (a feature with no work this
          // frame), not a contract violation.
          if (group.commands.length === 0) {
            continue;
          }

          if (group.phase === "overlay") {
            overlayGroups.push(group);
          } else {
            sceneGroups.push(group);
          }
        }
      }

      overlayGroups.sort((a, b) => a.ordinal - b.ordinal);
      const overlayCommands: RenderPassCommand[] = [];
      for (const group of overlayGroups) {
        overlayCommands.push(...group.commands);
      }

      return { valid, sceneGroups, overlayCommands, reports, diagnostics };
    },
    async dispose() {
      await runDisposersInReverse({
        disposers,
        failureMessage: "One or more WebGPU feature realizer disposers failed.",
      });
    },
  };
}

export function createWebGpuFeatureCommandGroupsFromCommands(options: {
  readonly featureId: string;
  readonly phase: WebGpuFeatureCommandPhase;
  readonly commands: readonly RenderPassCommand[];
  readonly startingOrdinal?: number;
  /** Explicit render-sort-key lookup by renderId. */
  readonly sortKeys?: ReadonlyMap<number, RenderSortKey>;
  /** Snapshot to derive the sort-key lookup from when `sortKeys` is omitted. */
  readonly snapshot?: RenderSnapshot;
}): readonly WebGpuFeatureCommandGroup[] {
  if (options.commands.length === 0) {
    return [];
  }

  const sortKeys =
    options.sortKeys ??
    (options.snapshot === undefined
      ? undefined
      : snapshotRenderSortKeysByRenderId(options.snapshot));
  const groups: WebGpuFeatureCommandGroup[] = [];
  let current:
    | {
        readonly featureId: string;
        readonly phase: WebGpuFeatureCommandPhase;
        readonly sortKey?: RenderSortKey;
        readonly ordinal: number;
        readonly commands: RenderPassCommand[];
      }
    | undefined;

  for (const command of options.commands) {
    if (
      current === undefined ||
      current.commands[0]?.renderId !== command.renderId
    ) {
      const sortKey = sortKeys?.get(command.renderId);
      current = {
        featureId: options.featureId,
        phase: options.phase,
        ordinal: (options.startingOrdinal ?? 0) + groups.length,
        commands: [],
        ...(sortKey === undefined ? {} : { sortKey }),
      };
      groups.push(current);
    }

    current.commands.push(command);
  }

  return groups;
}

export function validateWebGpuFeatureCommandGroups(
  groups: readonly WebGpuFeatureCommandGroup[],
): readonly WebGpuFeatureCommandGroupDiagnostic[] {
  const diagnostics: WebGpuFeatureCommandGroupDiagnostic[] = [];

  for (const group of groups) {
    if (requiresRenderSortKey(group.phase) && group.sortKey === undefined) {
      diagnostics.push({
        code: "webGpuFeatureCommandGroup.missingSortKey",
        featureId: group.featureId,
        phase: group.phase,
        message: `WebGPU feature '${group.featureId}' returned a '${group.phase}' command group without a render sort key.`,
      });
    }
  }

  return diagnostics;
}

export function orderWebGpuFeatureCommandGroups(
  groups: readonly WebGpuFeatureCommandGroup[],
): readonly WebGpuFeatureCommandGroup[] {
  return [...groups].sort((a, b) => {
    const phaseOrder = phaseOrdinal(a.phase) - phaseOrdinal(b.phase);

    if (phaseOrder !== 0) {
      return phaseOrder;
    }

    if (
      requiresRenderSortKey(a.phase) &&
      a.sortKey !== undefined &&
      b.sortKey !== undefined
    ) {
      return (
        compareRenderSortKeys(a.sortKey, b.sortKey) || a.ordinal - b.ordinal
      );
    }

    return a.ordinal - b.ordinal;
  });
}

export interface MergedSnapshotSortedRenderPassCommands {
  readonly commands: readonly RenderPassCommand[];
  /**
   * One diagnostic per scene-phase group whose render sort key could not be
   * resolved. Such a group degrades to the end of the merged sequence; groups
   * with keys keep exact snapshot-sorted interleaving.
   */
  readonly diagnostics: readonly WebGpuFeatureCommandGroupDiagnostic[];
}

export function mergeSnapshotSortedRenderPassCommands(options: {
  readonly snapshot: RenderSnapshot;
  readonly baseCommands: readonly RenderPassCommand[];
  readonly overlayCommands: readonly RenderPassCommand[];
  readonly featureGroups?: readonly WebGpuFeatureCommandGroup[];
}): MergedSnapshotSortedRenderPassCommands {
  const featureGroups = options.featureGroups ?? [];

  if (options.overlayCommands.length === 0 && featureGroups.length === 0) {
    return { commands: options.baseCommands, diagnostics: [] };
  }

  const sortKeys = snapshotRenderSortKeysByRenderId(options.snapshot);
  const sorted: WebGpuFeatureCommandGroup[] = [];
  const keyless: WebGpuFeatureCommandGroup[] = [];
  const push = (group: WebGpuFeatureCommandGroup): void => {
    (group.sortKey === undefined ? keyless : sorted).push(group);
  };

  for (const group of createWebGpuFeatureCommandGroupsFromCommands({
    featureId: "snapshot-overlay",
    phase: "transparent",
    commands: [...options.baseCommands, ...options.overlayCommands],
    sortKeys,
  })) {
    push(group);
  }
  for (const group of featureGroups) {
    if (group.commands.length === 0) {
      continue;
    }

    if (group.sortKey !== undefined) {
      push(group);
      continue;
    }

    const derived = sortKeys.get(group.commands[0]?.renderId ?? -1);
    push(derived === undefined ? group : { ...group, sortKey: derived });
  }

  sorted.sort(
    (a, b) =>
      compareRenderSortKeys(
        a.sortKey as RenderSortKey,
        b.sortKey as RenderSortKey,
      ) || a.ordinal - b.ordinal,
  );

  const commands: RenderPassCommand[] = [];
  for (const group of sorted) {
    commands.push(...group.commands);
  }
  for (const group of keyless) {
    commands.push(...group.commands);
  }

  return { commands, diagnostics: validateWebGpuFeatureCommandGroups(keyless) };
}

function requiresRenderSortKey(phase: WebGpuFeatureCommandPhase): boolean {
  return (
    phase === "opaque" || phase === "alpha-test" || phase === "transparent"
  );
}

function phaseOrdinal(phase: WebGpuFeatureCommandPhase): number {
  switch (phase) {
    case "opaque":
      return 0;
    case "alpha-test":
      return 1;
    case "transparent":
      return 2;
    case "overlay":
      return 3;
  }
}

function snapshotRenderSortKeysByRenderId(
  snapshot: RenderSnapshot,
): Map<number, RenderSortKey> {
  const sortKeys = new Map<number, RenderSortKey>();

  for (const draw of snapshot.meshDraws) {
    sortKeys.set(draw.renderId, draw.sortKey);
  }
  for (const draw of snapshot.spriteDraws ?? []) {
    sortKeys.set(draw.renderId, draw.sortKey);
  }
  for (const batch of snapshot.quadBatches ?? []) {
    sortKeys.set(batch.batchId, batch.sortKey);
  }
  for (const emitter of snapshot.particleEmitters ?? []) {
    sortKeys.set(emitter.emitterId, emitter.sortKey);
  }

  return sortKeys;
}
