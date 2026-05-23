import {
  executeRenderPassCommands,
  type RenderPassCommandExecutionReport,
  type RenderPassEncoderLike,
} from "./render-pass-command-executor.js";
import type { RenderPassCommand } from "./render-pass-commands.js";

export type RenderBundleExecutionStatus =
  | "disabled"
  | "unsupported"
  | "created"
  | "reused"
  | "failed";

export type RenderBundleDiagnosticCode =
  | "renderBundle.createEncoderFailed"
  | "renderBundle.missingFinish"
  | "renderBundle.finishFailed"
  | "renderBundle.executeBundlesFailed";

export interface RenderBundleDiagnostic {
  readonly code: RenderBundleDiagnosticCode;
  readonly message: string;
}

export interface RenderBundleEncoderDescriptorLike {
  readonly label?: string;
  readonly colorFormats: readonly string[];
  readonly depthStencilFormat?: string;
  readonly sampleCount?: number;
}

export interface RenderBundleDeviceLike {
  createRenderBundleEncoder?: (
    descriptor: RenderBundleEncoderDescriptorLike,
  ) => RenderBundleEncoderLike;
}

export interface RenderBundleEncoderLike extends RenderPassEncoderLike {
  finish?: () => unknown;
}

export interface RenderBundleRenderPassLike extends RenderPassEncoderLike {
  executeBundles?: (bundles: readonly unknown[]) => void;
}

export interface RenderBundleCacheEntry {
  readonly key: string;
  readonly bundle: unknown;
  readonly commandCount: number;
  readonly drawCalls: number;
  readonly indexedDrawCalls: number;
  readonly nonIndexedDrawCalls: number;
}

export interface RenderBundleCache {
  readonly entries: Map<string, RenderBundleCacheEntry>;
  readonly objectIds: WeakMap<object, number>;
  nextObjectId: number;
}

export interface RenderBundleCommandKeyOptions {
  readonly targetKey: string;
  readonly colorFormats: readonly string[];
  readonly depthStencilFormat?: string | null;
  readonly sampleCount?: number;
  readonly commands: readonly RenderPassCommand[];
}

export interface RenderBundleExecutionReport {
  readonly valid: boolean;
  readonly status: RenderBundleExecutionStatus;
  readonly key: string | null;
  readonly commandCount: number;
  readonly encodedCommands: number;
  readonly executedBundles: number;
  readonly drawCalls: number;
  readonly indexedDrawCalls: number;
  readonly nonIndexedDrawCalls: number;
  readonly cacheSize: number;
  readonly diagnostics: readonly RenderBundleDiagnostic[];
}

export interface ExecuteRenderPassCommandsWithRenderBundleOptions {
  readonly pass: RenderBundleRenderPassLike;
  readonly device: RenderBundleDeviceLike;
  readonly commands: readonly RenderPassCommand[];
  readonly cache: RenderBundleCache;
  readonly key: string;
  readonly descriptor: RenderBundleEncoderDescriptorLike;
  readonly label?: string;
  readonly enabled?: boolean;
}

export interface RenderBundleCommandExecutionResult {
  readonly execution: RenderPassCommandExecutionReport;
  readonly renderBundle: RenderBundleExecutionReport;
}

export function createRenderBundleCache(): RenderBundleCache {
  return {
    entries: new Map(),
    objectIds: new WeakMap(),
    nextObjectId: 1,
  };
}

export function createRenderBundleCommandKey(
  options: RenderBundleCommandKeyOptions,
  cache: RenderBundleCache,
): string {
  const key = {
    targetKey: options.targetKey,
    colorFormats: [...options.colorFormats],
    depthStencilFormat: options.depthStencilFormat ?? null,
    sampleCount: options.sampleCount ?? 1,
    commands: options.commands.map((command) => commandKeyPart(command, cache)),
  };

  return JSON.stringify(key);
}

export function executeRenderPassCommandsWithRenderBundle(
  options: ExecuteRenderPassCommandsWithRenderBundleOptions,
): RenderBundleCommandExecutionResult {
  if (options.enabled === false) {
    const execution = executeRenderPassCommands({
      pass: options.pass,
      commands: options.commands,
    });

    return {
      execution,
      renderBundle: reportFromExecution({
        execution,
        status: "disabled",
        key: options.key,
        encodedCommands: execution.executedCommands,
        executedBundles: 0,
        cacheSize: options.cache.entries.size,
        diagnostics: [],
      }),
    };
  }

  if (
    options.pass.executeBundles === undefined ||
    options.device.createRenderBundleEncoder === undefined
  ) {
    const execution = executeRenderPassCommands({
      pass: options.pass,
      commands: options.commands,
    });

    return {
      execution,
      renderBundle: reportFromExecution({
        execution,
        status: "unsupported",
        key: options.key,
        encodedCommands: execution.executedCommands,
        executedBundles: 0,
        cacheSize: options.cache.entries.size,
        diagnostics: [],
      }),
    };
  }

  const cached = options.cache.entries.get(options.key);

  if (cached !== undefined) {
    try {
      options.pass.executeBundles([cached.bundle]);
    } catch (cause) {
      return fallbackAfterBundleFailure(
        options,
        "renderBundle.executeBundlesFailed",
        `WebGPU render bundle '${options.key}' could not be executed: ${messageFromCause(
          cause,
        )}`,
      );
    }

    const execution = executionReportFromCacheEntry(cached);

    return {
      execution,
      renderBundle: {
        valid: true,
        status: "reused",
        key: options.key,
        commandCount: cached.commandCount,
        encodedCommands: 0,
        executedBundles: 1,
        drawCalls: cached.drawCalls,
        indexedDrawCalls: cached.indexedDrawCalls,
        nonIndexedDrawCalls: cached.nonIndexedDrawCalls,
        cacheSize: options.cache.entries.size,
        diagnostics: [],
      },
    };
  }

  let bundleEncoder: RenderBundleEncoderLike;

  try {
    bundleEncoder = options.device.createRenderBundleEncoder({
      ...options.descriptor,
      label:
        options.descriptor.label ?? `${options.label ?? options.key}:bundle`,
    });
  } catch (cause) {
    return fallbackAfterBundleFailure(
      options,
      "renderBundle.createEncoderFailed",
      `WebGPU render bundle encoder '${options.key}' could not be created: ${messageFromCause(
        cause,
      )}`,
    );
  }

  if (bundleEncoder.finish === undefined) {
    return fallbackAfterBundleFailure(
      options,
      "renderBundle.missingFinish",
      `WebGPU render bundle encoder '${options.key}' cannot finish a bundle.`,
    );
  }

  const bundleExecution = executeRenderPassCommands({
    pass: bundleEncoder,
    commands: options.commands,
  });

  if (!bundleExecution.valid) {
    const directExecution = executeRenderPassCommands({
      pass: options.pass,
      commands: options.commands,
    });

    return {
      execution: directExecution,
      renderBundle: reportFromExecution({
        execution: directExecution,
        status: "failed",
        key: options.key,
        encodedCommands: bundleExecution.executedCommands,
        executedBundles: 0,
        cacheSize: options.cache.entries.size,
        diagnostics: bundleExecution.diagnostics.map((diagnostic) => ({
          code: "renderBundle.finishFailed",
          message: diagnostic.message,
        })),
      }),
    };
  }

  let bundle: unknown;

  try {
    bundle = bundleEncoder.finish();
  } catch (cause) {
    return fallbackAfterBundleFailure(
      options,
      "renderBundle.finishFailed",
      `WebGPU render bundle '${options.key}' could not be finished: ${messageFromCause(
        cause,
      )}`,
    );
  }

  try {
    options.pass.executeBundles([bundle]);
  } catch (cause) {
    return fallbackAfterBundleFailure(
      options,
      "renderBundle.executeBundlesFailed",
      `WebGPU render bundle '${options.key}' could not be executed: ${messageFromCause(
        cause,
      )}`,
    );
  }

  const entry: RenderBundleCacheEntry = {
    key: options.key,
    bundle,
    commandCount: bundleExecution.commandCount,
    drawCalls: bundleExecution.drawCalls,
    indexedDrawCalls: bundleExecution.indexedDrawCalls,
    nonIndexedDrawCalls: bundleExecution.nonIndexedDrawCalls,
  };
  options.cache.entries.set(options.key, entry);

  return {
    execution: bundleExecution,
    renderBundle: {
      valid: true,
      status: "created",
      key: options.key,
      commandCount: bundleExecution.commandCount,
      encodedCommands: bundleExecution.executedCommands,
      executedBundles: 1,
      drawCalls: bundleExecution.drawCalls,
      indexedDrawCalls: bundleExecution.indexedDrawCalls,
      nonIndexedDrawCalls: bundleExecution.nonIndexedDrawCalls,
      cacheSize: options.cache.entries.size,
      diagnostics: [],
    },
  };
}

function fallbackAfterBundleFailure(
  options: ExecuteRenderPassCommandsWithRenderBundleOptions,
  code: RenderBundleDiagnosticCode,
  message: string,
): RenderBundleCommandExecutionResult {
  const execution = executeRenderPassCommands({
    pass: options.pass,
    commands: options.commands,
  });

  return {
    execution,
    renderBundle: reportFromExecution({
      execution,
      status: "failed",
      key: options.key,
      encodedCommands: execution.executedCommands,
      executedBundles: 0,
      cacheSize: options.cache.entries.size,
      diagnostics: [{ code, message }],
    }),
  };
}

function reportFromExecution(options: {
  readonly execution: RenderPassCommandExecutionReport;
  readonly status: RenderBundleExecutionStatus;
  readonly key: string | null;
  readonly encodedCommands: number;
  readonly executedBundles: number;
  readonly cacheSize: number;
  readonly diagnostics: readonly RenderBundleDiagnostic[];
}): RenderBundleExecutionReport {
  return {
    valid: options.execution.valid,
    status: options.status,
    key: options.key,
    commandCount: options.execution.commandCount,
    encodedCommands: options.encodedCommands,
    executedBundles: options.executedBundles,
    drawCalls: options.execution.drawCalls,
    indexedDrawCalls: options.execution.indexedDrawCalls,
    nonIndexedDrawCalls: options.execution.nonIndexedDrawCalls,
    cacheSize: options.cacheSize,
    diagnostics: options.diagnostics,
  };
}

function executionReportFromCacheEntry(
  entry: RenderBundleCacheEntry,
): RenderPassCommandExecutionReport {
  return {
    valid: true,
    commandCount: entry.commandCount,
    executedCommands: entry.commandCount,
    skippedCommands: 0,
    drawCalls: entry.drawCalls,
    indexedDrawCalls: entry.indexedDrawCalls,
    nonIndexedDrawCalls: entry.nonIndexedDrawCalls,
    diagnostics: [],
  };
}

function commandKeyPart(
  command: RenderPassCommand,
  cache: RenderBundleCache,
): unknown {
  switch (command.kind) {
    case "setPipeline":
      return [
        "p",
        command.pipelineKey,
        resourceIdentity(command.pipeline, cache),
      ];
    case "setBindGroup":
      return ["bg", command.index, command.resourceKey];
    case "setVertexBuffer":
      return [
        "vb",
        command.slot,
        command.resourceKey,
        resourceIdentity(command.buffer, cache),
      ];
    case "setIndexBuffer":
      return [
        "ib",
        command.resourceKey,
        command.format,
        resourceIdentity(command.buffer, cache),
      ];
    case "beginOcclusionQuery":
      return ["oq-begin", command.queryIndex];
    case "endOcclusionQuery":
      return ["oq-end", command.queryIndex];
    case "draw":
      return [
        "d",
        command.vertexCount,
        command.instanceCount,
        command.firstVertex,
        command.firstInstance,
      ];
    case "drawIndexed":
      return [
        "di",
        command.indexCount,
        command.instanceCount,
        command.firstIndex,
        command.baseVertex,
        command.firstInstance,
      ];
    case "drawIndirect":
      return [
        "d-indirect",
        command.resourceKey,
        resourceIdentity(command.buffer, cache),
        command.offset,
      ];
    case "drawIndexedIndirect":
      return [
        "di-indirect",
        command.resourceKey,
        resourceIdentity(command.buffer, cache),
        command.offset,
      ];
  }
}

function resourceIdentity(value: unknown, cache: RenderBundleCache): string {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    return `${typeof value}:${String(value)}`;
  }

  const cached = cache.objectIds.get(value);

  if (cached !== undefined) {
    return `object:${cached}`;
  }

  const id = cache.nextObjectId;
  cache.nextObjectId += 1;
  cache.objectIds.set(value, id);

  return `object:${id}`;
}

function messageFromCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}
