import { randomUUID } from "node:crypto";
import path from "node:path";
import { Worker } from "node:worker_threads";
import type { GeneratedDevtoolsToolResult } from "@aperture-engine/app/headless-tools";
import type {
  HeadlessBundleInput,
  HeadlessExtractInput,
  HeadlessPickInput,
  HeadlessPickResult,
  HeadlessResetInput,
  HeadlessSessionLogEntry,
  HeadlessStepInput,
  HeadlessToolInput,
} from "./session-controller.js";
import { ApertureCliError } from "../errors.js";
import {
  HEADLESS_REALM_PROTOCOL,
  DEFAULT_REALM_BOOT_TIMEOUT_MS,
  DEFAULT_REALM_DISPOSE_TIMEOUT_MS,
  DEFAULT_REALM_REQUEST_TIMEOUT_MS,
  DEFAULT_REALM_MAX_PENDING,
  DEFAULT_REALM_MAX_QUEUED_BYTES,
  DEFAULT_REALM_MAX_REPLY_BYTES,
  cloneRealmValue,
  combineRealmFailures,
  isRecord,
  positiveRealmLimit,
  type RealmAppOptions,
  type RealmCleanup,
  type RealmEvent,
  type RealmExit,
  type RealmLimits,
  type RealmMetadata,
  type RealmMethod,
  type RealmReply,
  type RealmSnapshot,
} from "./realm-protocol.js";
import type { ApertureGeneratedDiagnostic } from "@aperture-engine/app/diagnostics";

type Limits = Required<RealmLimits>;
export interface HeadlessSessionClientOptions
  extends RealmAppOptions, RealmLimits {
  readonly log?: ((entry: HeadlessSessionLogEntry) => void) | undefined;
}
export type HeadlessClientLifecycle =
  | "preparing"
  | "prepared"
  | "ready"
  | "replacing"
  | "failed"
  | "disposed";
export class HeadlessRealmError extends ApertureCliError {
  readonly diagnostic: ApertureGeneratedDiagnostic | undefined;
  readonly cleanupBlocked: boolean;
  constructor(
    message: string,
    diagnostic?: ApertureGeneratedDiagnostic,
    cleanupBlocked = false,
  ) {
    super(diagnostic?.code ?? "aperture.headless.realmFailure", message);
    this.diagnostic = diagnostic;
    this.cleanupBlocked = cleanupBlocked;
    if (diagnostic !== undefined)
      Object.assign(this, {
        source: diagnostic.source,
        detail: diagnostic.data,
        suggestedFix: diagnostic.suggestedFix,
      });
    if (diagnostic?.error !== undefined)
      Object.defineProperty(this, "cause", { value: diagnostic.error });
  }
}
interface Pending {
  resolve(value: unknown): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
}

/** One native JS isolate. Its owner must retire it and observe exit on every path. */
export class HeadlessRealmTransport {
  readonly executionRevision = randomUUID();
  readonly #worker: Worker;
  readonly #limits: Limits;
  readonly #log: (entry: HeadlessSessionLogEntry) => void;
  readonly #output:
    | ((value: { channel: "stdout" | "stderr"; text: string }) => void)
    | undefined;
  readonly #pending = new Map<number, Pending>();
  readonly #exited: Promise<number>;
  #exitCode: number | null = null;
  #exitObserved = false;
  #nextId = 1;
  #failure: unknown;
  #outputFailure: unknown;
  #retiring: Promise<RealmExit> | null = null;
  #forced = false;
  #cleanup: RealmCleanup = { graceful: false, cleanupFailures: [] };
  metadata: RealmMetadata | null = null;

  constructor(options: {
    readonly limits: Limits;
    readonly log: (entry: HeadlessSessionLogEntry) => void;
    readonly output?: (value: {
      channel: "stdout" | "stderr";
      text: string;
    }) => void;
    /** Internal transport injection for CPU/native protocol tests. */
    readonly workerEntry?: URL;
  }) {
    this.#limits = options.limits;
    this.#log = options.log;
    this.#output = options.output;
    this.#worker = new Worker(
      options.workerEntry ?? new URL("./realm-entry.js", import.meta.url),
      {
        workerData: {
          executionRevision: this.executionRevision,
          maxReplyBytes: this.#limits.maxReplyBytes,
        },
        stdout: true,
        stderr: true,
        execArgv: process.execArgv.filter(
          (argument) => !argument.startsWith("--input-type"),
        ),
      },
    );
    this.#exited = new Promise((resolve) => {
      this.#worker.once("exit", (code) => {
        this.#exitCode = code;
        this.#exitObserved = true;
        this.#rejectAll(
          new HeadlessRealmError(
            `Headless execution realm exited with code ${code}.`,
          ),
        );
        resolve(code);
      });
    });
    this.#worker.on("error", (error) => this.#fail(error));
    this.#worker.on("messageerror", (error) => this.#fail(error));
    this.#worker.on("message", (message: unknown) => {
      try {
        this.#message(message);
      } catch (error: unknown) {
        this.#fail(error);
      }
    });
    const capture = (
      source: "author.stdout" | "author.stderr",
      chunk: Buffer | string,
    ): void => {
      this.#emitLog({
        time: new Date().toISOString(),
        level: source === "author.stdout" ? "info" : "warn",
        source,
        message: chunk.toString().slice(0, 8192),
        data: { executionRevision: this.executionRevision },
      });
    };
    this.#worker.stdout?.on("data", (chunk: Buffer | string) =>
      capture("author.stdout", chunk),
    );
    this.#worker.stderr?.on("data", (chunk: Buffer | string) =>
      capture("author.stderr", chunk),
    );
  }
  get failed(): boolean {
    return this.#failure !== undefined || this.#exitObserved;
  }
  request(
    method: RealmMethod,
    input: unknown,
    timeoutMs = this.#limits.requestTimeoutMs,
  ): Promise<unknown> {
    if (this.#failure !== undefined || this.#exitObserved)
      return Promise.reject(
        this.#failure ??
          new HeadlessRealmError("Headless execution realm has exited."),
      );
    if (this.#pending.size >= this.#limits.maxPending)
      return Promise.reject(
        new ApertureCliError(
          "aperture.headless.requestLimit",
          "Too many pending headless realm requests.",
        ),
      );
    const id = this.#nextId++;
    let value: unknown;
    try {
      value = cloneRealmValue(
        {
          protocol: HEADLESS_REALM_PROTOCOL,
          executionRevision: this.executionRevision,
          id,
          method,
          input,
        },
        this.#limits.maxQueuedBytes,
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#fail(
          new HeadlessRealmError(
            `Headless '${method}' timed out after ${timeoutMs}ms. Its effects are unknown; the realm will be retired.`,
            undefined,
            true,
          ),
        );
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      try {
        this.#worker.postMessage(value);
      } catch (error: unknown) {
        this.#fail(error);
      }
    });
  }
  #emitLog(entry: HeadlessSessionLogEntry): void {
    try {
      this.#log(entry);
    } catch {
      /* Logging cannot replace the tool/cleanup error. */
    }
  }
  #message(value: unknown): void {
    if (
      !isRecord(value) ||
      value["protocol"] !== HEADLESS_REALM_PROTOCOL ||
      value["executionRevision"] !== this.executionRevision
    ) {
      this.#fail(
        new HeadlessRealmError(
          "Headless realm returned an invalid or mismatched response.",
        ),
      );
      return;
    }
    if (typeof value["event"] === "string") {
      const event = value as unknown as RealmEvent;
      if (event.event === "log" && isRecord(event.value)) {
        this.#emitLog({
          ...(event.value as unknown as HeadlessSessionLogEntry),
          data: {
            executionRevision: this.executionRevision,
            value: event.value["data"],
          },
        });
      } else if (
        event.event === "command-output" &&
        isRecord(event.value) &&
        (event.value["channel"] === "stdout" ||
          event.value["channel"] === "stderr") &&
        typeof event.value["text"] === "string"
      ) {
        try {
          this.#output?.({
            channel: event.value["channel"],
            text: event.value["text"],
          });
        } catch (error: unknown) {
          this.#outputFailure ??= error;
        }
      } else
        this.#fail(new HeadlessRealmError("Invalid headless realm event."));
      return;
    }
    if (
      !Number.isSafeInteger(value["id"]) ||
      typeof value["ok"] !== "boolean"
    ) {
      this.#fail(
        new HeadlessRealmError("Invalid headless realm reply envelope."),
      );
      return;
    }
    const reply = value as unknown as RealmReply;
    const pending = this.#pending.get(reply.id);
    // Late/duplicate/unknown replies cannot mutate cached current state.
    if (pending === undefined) return;
    if (reply.metadata !== undefined) {
      if (reply.metadata.executionRevision !== this.executionRevision)
        throw new HeadlessRealmError("Mismatched headless metadata revision.");
      this.metadata = cloneRealmValue(
        reply.metadata,
        this.#limits.maxReplyBytes,
      );
    }
    this.#pending.delete(reply.id);
    clearTimeout(pending.timer);
    if (reply.cleanup !== undefined) this.#cleanup = reply.cleanup;
    if (reply.ok && this.#outputFailure === undefined)
      pending.resolve(reply.result);
    else if (this.#outputFailure !== undefined)
      pending.reject(this.#outputFailure);
    else
      pending.reject(
        new HeadlessRealmError(
          reply.diagnostic?.message ?? "Headless realm operation failed.",
          reply.diagnostic,
          reply.cleanup?.graceful === false,
        ),
      );
  }
  #rejectAll(error: unknown): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }
  #fail(error: unknown): void {
    this.#failure ??= error;
    this.#rejectAll(this.#failure);
    // Timeout/error is terminal; stopping JS is not evidence of app-owner cleanup.
    this.#forced = true;
    void this.#worker.terminate().catch(() => undefined);
  }
  async #waitExit(timeoutMs: number): Promise<boolean> {
    if (this.#exitObserved) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.#exited.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  retire(): Promise<RealmExit> {
    this.#retiring ??= this.#retire();
    return this.#retiring;
  }
  async #retire(): Promise<RealmExit> {
    if (!this.failed) {
      try {
        await this.request("dispose", {}, this.#limits.disposeTimeoutMs);
      } catch (error: unknown) {
        this.#failure ??= error;
      }
    }
    if (!(await this.#waitExit(this.#limits.disposeTimeoutMs))) {
      this.#forced = true;
      void this.#worker.terminate().catch(() => undefined);
      await this.#waitExit(this.#limits.disposeTimeoutMs);
    }
    this.#rejectAll(
      new HeadlessRealmError("Headless execution realm was disposed."),
    );
    const outcome: RealmExit = {
      ...this.#cleanup,
      graceful:
        this.#cleanup.graceful &&
        !this.#forced &&
        this.#exitObserved &&
        this.#exitCode === 0,
      exitCode: this.#exitCode,
      exitObserved: this.#exitObserved,
      forcedTermination: this.#forced,
    };
    if (this.#exitObserved) {
      this.#worker.removeAllListeners();
      this.#worker.stdout?.removeAllListeners();
      this.#worker.stderr?.removeAllListeners();
    }
    return outcome;
  }
}

export interface HeadlessSessionLease {
  /** Host work must stop when this signal aborts; exported bundles remain detached. */
  readonly signal: AbortSignal;
  createBundle(input: HeadlessBundleInput): Promise<unknown>;
}
export class HeadlessSessionClient {
  readonly #options: HeadlessSessionClientOptions;
  readonly #limits: Limits;
  #current: HeadlessRealmTransport | null = null;
  #prepared: HeadlessRealmTransport | null = null;
  #state: HeadlessClientLifecycle = "preparing";
  #tail = Promise.resolve();
  #pendingCount = 0;
  #queuedBytes = 0;
  #replacement: Promise<unknown> | null = null;
  #closing = false;
  #disposePromise: Promise<void> | null = null;
  #failure: unknown;
  #cleanupBlocked = false;
  #hostCleanupPending = false;
  #hostCleanupFailure: unknown;
  #exit: RealmExit | null = null;
  #exits: Array<RealmExit & { executionRevision: string }> = [];
  #seed: number;

  constructor(options: HeadlessSessionClientOptions) {
    this.#limits = resolveLimits(options);
    this.#options = {
      ...options,
      configFile: path.resolve(options.configFile),
      root: path.resolve(options.root),
    };
    this.#seed = options.seed;
  }
  get lifecycle(): HeadlessClientLifecycle {
    return this.#closing ? "disposed" : this.#state;
  }
  get seed(): number {
    return this.#seed;
  }
  get cleanupBlocked(): boolean {
    return this.#cleanupBlocked;
  }
  get exitOutcome(): RealmExit | null {
    return this.#exit;
  }
  get exitHistory(): readonly (RealmExit & { executionRevision: string })[] {
    return this.#exits.slice();
  }
  get executionRevision(): string | null {
    return this.#current?.executionRevision ?? null;
  }
  get sourceRevision(): string | null {
    return this.#current?.metadata?.sourceRevision ?? null;
  }
  #newRealm(): HeadlessRealmTransport {
    return new HeadlessRealmTransport({
      limits: this.#limits,
      log: this.#options.log ?? (() => undefined),
    });
  }
  #appOptions(seed: number): RealmAppOptions {
    const {
      configFile,
      root,
      publicDir,
      decoderAssetsDir,
      allowHttpAssets,
      assetMode,
      determinism,
      renderWidth,
      renderHeight,
    } = this.#options;
    return {
      configFile,
      root,
      publicDir,
      allowHttpAssets,
      assetMode,
      determinism,
      seed,
      ...(decoderAssetsDir === undefined ? {} : { decoderAssetsDir }),
      ...(renderWidth === undefined ? {} : { renderWidth }),
      ...(renderHeight === undefined ? {} : { renderHeight }),
    };
  }
  async prepare(): Promise<void> {
    if (this.#state !== "preparing" || this.#prepared !== null || this.#closing)
      throw new HeadlessRealmError(
        "Headless client can be prepared only once.",
      );
    const candidate = this.#newRealm();
    this.#prepared = candidate;
    try {
      await candidate.request(
        "prepare",
        { options: this.#appOptions(this.#seed) },
        this.#limits.bootTimeoutMs,
      );
      if (this.#closing)
        throw new HeadlessRealmError(
          "Headless client was disposed during preparation.",
        );
      this.#state = "prepared";
    } catch (error: unknown) {
      this.#failure = error;
      this.#state = "failed";
      try {
        await this.#retire(candidate);
      } catch (cleanupError: unknown) {
        throw combineRealmFailures(
          error,
          cleanupError,
          "Headless initialization and cleanup failed.",
        );
      } finally {
        this.#prepared = null;
      }
      throw error;
    }
  }
  async activate(): Promise<void> {
    const candidate = this.#prepared;
    if (this.#state !== "prepared" || candidate === null || this.#closing)
      throw new HeadlessRealmError(
        "Headless client must be prepared before activation.",
      );
    try {
      await candidate.request("boot", {}, this.#limits.bootTimeoutMs);
      if (this.#closing)
        throw new HeadlessRealmError(
          "Headless client was disposed during activation.",
        );
      this.#current = candidate;
      this.#prepared = null;
      this.#state = "ready";
    } catch (error: unknown) {
      this.#failure = error;
      this.#state = "failed";
      try {
        await this.#retire(candidate);
      } catch (cleanupError: unknown) {
        throw combineRealmFailures(
          error,
          cleanupError,
          "Headless initialization and cleanup failed.",
        );
      } finally {
        this.#prepared = null;
      }
      throw error;
    }
  }
  cachedStatus(): unknown {
    if (this.lifecycle !== "ready" || this.#current?.failed === true)
      return {
        mode: "headless",
        lifecycle: this.lifecycle,
        running: false,
        seed: this.#seed,
        retryable:
          !this.#closing &&
          this.#replacement === null &&
          this.#state === "failed" &&
          !this.#cleanupBlocked &&
          !this.#hostCleanupPending,
        cleanupBlocked: this.#cleanupBlocked,
        hostCleanupPending: this.#hostCleanupPending,
        hostCleanupBlocked: this.#hostCleanupFailure !== undefined,
        exit: this.#exit,
        exits: this.exitHistory,
        ...(this.#failure === undefined
          ? {}
          : {
              error:
                this.#failure instanceof Error
                  ? this.#failure.message
                  : String(this.#failure),
            }),
      };
    return {
      ...(isRecord(this.#current?.metadata?.status)
        ? this.#current.metadata.status
        : {}),
      executionRevision: this.executionRevision,
      sourceRevision: this.sourceRevision,
      cached: true,
    };
  }
  async compactStatus(): Promise<unknown> {
    await this.status();
    return this.#stamp(
      this.#current?.metadata?.compactStatus ?? this.cachedStatus(),
      this.#current,
    );
  }
  status(input: { readonly digest?: boolean } = {}): Promise<unknown> {
    if (this.lifecycle !== "ready") return Promise.resolve(this.cachedStatus());
    return this.#invoke("status", input);
  }
  step(input: HeadlessStepInput = {}): Promise<unknown> {
    return this.#invoke("step", input);
  }
  extract(input: HeadlessExtractInput = {}): Promise<{ result: unknown }> {
    return this.#invoke("extract", input) as Promise<{ result: unknown }>;
  }
  inject(input: unknown): Promise<GeneratedDevtoolsToolResult> {
    return this.#invoke(
      "inject",
      input,
    ) as Promise<GeneratedDevtoolsToolResult>;
  }
  pick(input: HeadlessPickInput): Promise<HeadlessPickResult> {
    return this.#invoke("pick", input) as Promise<HeadlessPickResult>;
  }
  dispatchCommand(input: {
    readonly channel: string;
    readonly payload?: unknown;
  }): Promise<unknown> {
    return this.#invoke("dispatchCommand", input);
  }
  callTool(input: HeadlessToolInput): Promise<GeneratedDevtoolsToolResult> {
    return this.#invoke(
      "callTool",
      input,
    ) as Promise<GeneratedDevtoolsToolResult>;
  }
  createBundle(input: HeadlessBundleInput): Promise<unknown> {
    return this.#invoke("createBundle", input);
  }
  saveSessionSnapshot(input: { readonly out: string }): Promise<unknown> {
    return this.#invoke("saveSessionSnapshot", input);
  }
  determinismReport(): Promise<unknown> {
    return this.#invoke("determinismReport", {});
  }
  #stamp(value: unknown, realm: HeadlessRealmTransport | null): unknown {
    return isRecord(value)
      ? {
          ...value,
          executionRevision: realm?.executionRevision ?? null,
          sourceRevision: realm?.metadata?.sourceRevision ?? null,
        }
      : value;
  }
  #invoke(method: RealmMethod, input: unknown): Promise<unknown> {
    let detached: unknown;
    try {
      detached = cloneRealmValue(input, this.#limits.maxQueuedBytes);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
    return this.#enqueue(
      Buffer.byteLength(JSON.stringify(detached)),
      async (realm, remainingMs) => {
        const result = await realm.request(method, detached, remainingMs);
        return this.#stamp(result, realm);
      },
    );
  }
  #enqueue<T>(
    bytes: number,
    operation: (
      realm: HeadlessRealmTransport,
      remainingMs: number,
    ) => Promise<T>,
  ): Promise<T> {
    const realm = this.#current;
    if (
      this.#closing ||
      this.#state !== "ready" ||
      realm === null ||
      this.#cleanupBlocked
    )
      return Promise.reject(
        new HeadlessRealmError(
          `Headless session is ${this.lifecycle}.`,
          undefined,
          this.#cleanupBlocked,
        ),
      );
    if (
      this.#pendingCount >= this.#limits.maxPending ||
      this.#queuedBytes + bytes > this.#limits.maxQueuedBytes
    )
      return Promise.reject(
        new ApertureCliError(
          "aperture.headless.requestLimit",
          "Headless request queue exceeds its configured count or byte budget.",
        ),
      );
    this.#pendingCount += 1;
    this.#queuedBytes += bytes;
    const deadline = performance.now() + this.#limits.requestTimeoutMs;
    // Register before invocation: disposal/replacement sees synchronous/reentrant work.
    const accepted = this.#tail
      .then(() => {
        const remainingMs = Math.ceil(deadline - performance.now());
        if (remainingMs <= 0)
          throw new ApertureCliError(
            "aperture.headless.queueTimeout",
            "Headless request expired in the queue before dispatch; it was not applied.",
          );
        if (this.#cleanupBlocked || this.#hostCleanupPending || realm.failed)
          throw new HeadlessRealmError(
            "Headless accepted work cannot run after a failed cleanup or execution realm.",
            undefined,
            this.#cleanupBlocked,
          );
        return operation(realm, remainingMs);
      })
      .catch((error: unknown) => {
        if (realm.failed) {
          this.#state = "failed";
          this.#failure = error;
        }
        throw error;
      })
      .finally(() => {
        this.#pendingCount -= 1;
        this.#queuedBytes -= bytes;
      });
    this.#tail = accepted.then(
      () => undefined,
      () => undefined,
    );
    return accepted;
  }
  /** Keeps exported bundle + host rendering under the same accepted revision/drain barrier. */
  withLease<T>(
    operation: (lease: HeadlessSessionLease) => Promise<T>,
  ): Promise<T> {
    return this.#enqueue(0, async (realm, remainingMs) => {
      const abort = new AbortController();
      const deadline = performance.now() + remainingMs;
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancelTimer: ReturnType<typeof setTimeout> | undefined;
      const run = Promise.resolve().then(() =>
        operation({
          signal: abort.signal,
          createBundle: async (input) => {
            if (!active)
              throw new HeadlessRealmError(
                "The headless capture lease has expired or finished.",
              );
            const remaining = Math.ceil(deadline - performance.now());
            if (remaining <= 0)
              throw new HeadlessRealmError(
                "The headless capture lease deadline expired.",
              );
            return this.#stamp(
              await realm.request(
                "createBundle",
                cloneRealmValue(input, this.#limits.maxQueuedBytes),
                remaining,
              ),
              realm,
            );
          },
        }),
      );
      // Resolve tagged outcomes so both normal and abort-time failures are observed.
      const observed = run.then(
        (value) => ({ ok: true as const, value }),
        (error) => ({ ok: false as const, error: error as unknown }),
      );
      try {
        const first = await Promise.race([
          observed,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), remainingMs);
          }),
        ]);
        if (first !== null) {
          if (!first.ok) {
            if (
              isRecord(first.error) &&
              first.error["headlessHostCleanupFailed"] === true
            ) {
              this.#hostCleanupFailure = first.error;
              this.#cleanupBlocked = true;
              this.#state = "failed";
            }
            throw first.error;
          }
          return first.value;
        }
        active = false;
        this.#hostCleanupPending = true;
        const failure = new HeadlessRealmError(
          "The headless capture lease deadline expired; its host work was cancelled.",
        );
        this.#failure = failure;
        if (this.#replacement === null) this.#state = "failed";
        // Keep cancellation and its observed settlement INSIDE the FIFO barrier.
        abort.abort(failure);
        const settled = await Promise.race([
          observed,
          new Promise<null>((resolve) => {
            cancelTimer = setTimeout(
              () => resolve(null),
              this.#limits.disposeTimeoutMs,
            );
          }),
        ]);
        if (
          settled !== null &&
          !settled.ok &&
          isRecord(settled.error) &&
          settled.error["headlessHostCleanupFailed"] === true
        ) {
          this.#hostCleanupFailure = settled.error;
          this.#cleanupBlocked = true;
          this.#state = "failed";
          throw settled.error;
        }
        if (settled === null) {
          this.#hostCleanupFailure = new HeadlessRealmError(
            "Host capture cancellation did not settle within its cleanup deadline; cleanup remains blocked.",
            undefined,
            true,
          );
          this.#cleanupBlocked = true;
          this.#state = "failed";
          throw this.#hostCleanupFailure;
        }
        if (!this.#closing && !realm.failed && !this.#cleanupBlocked) {
          this.#state = this.#replacement === null ? "ready" : "replacing";
          this.#failure = undefined;
        }
        throw failure;
      } finally {
        active = false;
        this.#hostCleanupPending = false;
        if (timer !== undefined) clearTimeout(timer);
        if (cancelTimer !== undefined) clearTimeout(cancelTimer);
      }
    });
  }
  reset(input: HeadlessResetInput = {}): Promise<unknown> {
    const seed = input.seed ?? this.#options.seed;
    if (!Number.isFinite(seed))
      return Promise.reject(
        new ApertureCliError(
          "aperture.headless.invalidSeed",
          "Reset seed must be finite.",
        ),
      );
    return this.#replace(seed).then(() => ({
      reset: true,
      status: this.cachedStatus(),
    }));
  }
  restoreSessionSnapshot(input: {
    readonly snapshot: RealmSnapshot;
  }): Promise<unknown> {
    return this.#replace(
      this.#seed,
      cloneRealmValue(input.snapshot, this.#limits.maxReplyBytes),
    );
  }
  #replace(seed: number, snapshot?: RealmSnapshot): Promise<unknown> {
    if (
      this.#closing ||
      this.#replacement !== null ||
      this.#cleanupBlocked ||
      this.#hostCleanupPending ||
      !["ready", "failed"].includes(this.#state)
    )
      return Promise.reject(
        new HeadlessRealmError(
          "Headless replacement is unavailable: disposed, overlapping, or cleanup blocked.",
          undefined,
          this.#cleanupBlocked,
        ),
      );
    const previous = this.#current;
    const candidate = this.#newRealm();
    this.#state = "replacing";
    const drain = this.#tail;
    // Transition promise is assigned before invoking prepare/cleanup/boot bodies.
    this.#replacement = Promise.resolve()
      .then(async () => {
        let retiredPrevious = false;
        try {
          await candidate.request(
            "prepare",
            {
              options: this.#appOptions(seed),
              ...(snapshot === undefined ? {} : { snapshot }),
            },
            this.#limits.bootTimeoutMs,
          );
          await drain;
          if (this.#cleanupBlocked || this.#hostCleanupPending)
            throw new HeadlessRealmError(
              "Previous host cleanup is blocked; replacement cannot retire its revision.",
              undefined,
              true,
            );
          if (previous !== null) {
            await this.#retire(previous);
            retiredPrevious = true;
          }
          this.#current = null;
          if (this.#closing)
            throw new HeadlessRealmError(
              "Headless client was disposed during replacement.",
            );
          if (this.#cleanupBlocked || this.#hostCleanupPending)
            throw new HeadlessRealmError(
              "Previous cleanup became blocked before boot.",
              undefined,
              true,
            );
          const boot = await candidate.request(
            "boot",
            {},
            this.#limits.bootTimeoutMs,
          );
          if (this.#cleanupBlocked || this.#hostCleanupPending || this.#closing)
            throw new HeadlessRealmError(
              "Replacement cannot publish while cleanup is blocked or the client is disposed.",
              undefined,
              this.#cleanupBlocked,
            );
          this.#current = candidate;
          this.#seed = seed;
          this.#state = "ready";
          this.#failure = undefined;
          return this.#stamp(
            {
              ok: true,
              ...(isRecord(boot) ? boot : {}),
              status: this.cachedStatus(),
            },
            candidate,
          );
        } catch (error: unknown) {
          this.#failure = error;
          try {
            await this.#retire(candidate);
          } catch (cleanupError: unknown) {
            throw combineRealmFailures(
              error,
              cleanupError,
              "Headless candidate failed and could not be cleanly retired.",
            );
          } finally {
            this.#state =
              previous !== null &&
              !previous.failed &&
              !retiredPrevious &&
              !this.#cleanupBlocked
                ? "ready"
                : "failed";
            if (retiredPrevious) this.#current = null;
          }
          throw error;
        }
      })
      .finally(() => {
        this.#replacement = null;
      });
    return this.#replacement;
  }
  async #retire(realm: HeadlessRealmTransport): Promise<void> {
    const outcome = await realm.retire();
    if (
      !this.#exits.some(
        (entry) => entry.executionRevision === realm.executionRevision,
      )
    ) {
      this.#exits.push({
        ...outcome,
        executionRevision: realm.executionRevision,
      });
      if (this.#exits.length > 32) this.#exits.shift();
    }
    if (this.#exit === null || !this.#cleanupBlocked || !outcome.graceful)
      this.#exit = outcome;
    if (!outcome.graceful) {
      this.#cleanupBlocked = true;
      throw new HeadlessRealmError(
        `Headless realm cleanup did not complete gracefully (exitObserved=${outcome.exitObserved}, forced=${outcome.forcedTermination}). Cleanup remains blocked; inspect retained diagnostics before restarting the owning process.`,
        outcome.cleanupFailures[0],
        true,
      );
    }
  }
  dispose(): Promise<void> {
    if (this.#disposePromise === null) {
      this.#closing = true;
      const drain = this.#tail;
      this.#disposePromise = Promise.resolve().then(async () => {
        await drain;
        await this.#replacement?.catch(() => undefined);
        const owned = new Set(
          [this.#current, this.#prepared].filter(
            (realm): realm is HeadlessRealmTransport => realm !== null,
          ),
        );
        this.#current = null;
        this.#prepared = null;
        this.#state = "disposed";
        const results = await Promise.allSettled(
          [...owned].map((realm) => this.#retire(realm)),
        );
        const errors = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason as unknown] : [],
        );
        if (this.#hostCleanupFailure !== undefined)
          errors.push(this.#hostCleanupFailure);
        if (errors.length > 0)
          throw new AggregateError(errors, "Headless realm disposal failed.");
      });
    }
    return this.#disposePromise;
  }
}
export async function prepareHeadlessSessionClient(
  options: HeadlessSessionClientOptions,
): Promise<HeadlessSessionClient> {
  const client = new HeadlessSessionClient(options);
  try {
    await client.prepare();
    return client;
  } catch (error: unknown) {
    try {
      await client.dispose();
    } catch (cleanupError: unknown) {
      throw combineRealmFailures(
        error,
        cleanupError,
        "Headless preparation and cleanup failed.",
      );
    }
    throw error;
  }
}
export async function createHeadlessSessionClient(
  options: HeadlessSessionClientOptions,
): Promise<HeadlessSessionClient> {
  const client = await prepareHeadlessSessionClient(options);
  try {
    await client.activate();
    return client;
  } catch (error: unknown) {
    try {
      await client.dispose();
    } catch (cleanupError: unknown) {
      throw combineRealmFailures(
        error,
        cleanupError,
        "Headless boot and cleanup failed.",
      );
    }
    throw error;
  }
}
export async function runHeadlessCommandInRealm(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly configFile: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
}): Promise<number> {
  const realm = new HeadlessRealmTransport({
    limits: resolveLimits({}),
    log(entry) {
      options.stderr?.(`${entry.source}: ${entry.message}\n`);
    },
    output(value) {
      (value.channel === "stdout" ? options.stdout : options.stderr)?.(
        value.text,
      );
    },
  });
  let primary: unknown;
  let code: unknown;
  try {
    code = await realm.request(
      "oneShot",
      {
        argv: options.argv,
        cwd: path.resolve(options.cwd),
        configFile: path.resolve(options.configFile),
      },
      DEFAULT_REALM_BOOT_TIMEOUT_MS,
    );
  } catch (error: unknown) {
    primary = error;
  }
  const outcome = await realm.retire();
  if (primary !== undefined) throw primary;
  if (!outcome.graceful)
    throw new HeadlessRealmError(
      "Headless command realm cleanup failed.",
      outcome.cleanupFailures[0],
      true,
    );
  if (!Number.isInteger(code))
    throw new Error("Headless command returned an invalid exit code.");
  return code as number;
}
function resolveLimits(options: RealmLimits): Limits {
  return {
    requestTimeoutMs: positiveRealmLimit(
      options.requestTimeoutMs,
      DEFAULT_REALM_REQUEST_TIMEOUT_MS,
    ),
    bootTimeoutMs: positiveRealmLimit(
      options.bootTimeoutMs,
      DEFAULT_REALM_BOOT_TIMEOUT_MS,
    ),
    disposeTimeoutMs: positiveRealmLimit(
      options.disposeTimeoutMs,
      DEFAULT_REALM_DISPOSE_TIMEOUT_MS,
    ),
    maxPending: positiveRealmLimit(
      options.maxPending,
      DEFAULT_REALM_MAX_PENDING,
    ),
    maxQueuedBytes: positiveRealmLimit(
      options.maxQueuedBytes,
      DEFAULT_REALM_MAX_QUEUED_BYTES,
    ),
    maxReplyBytes: positiveRealmLimit(
      options.maxReplyBytes,
      DEFAULT_REALM_MAX_REPLY_BYTES,
    ),
  };
}
