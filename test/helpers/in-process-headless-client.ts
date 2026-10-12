import {
  assertApertureBootstrapAllowed,
  getApertureCleanupFailures,
} from "@aperture-engine/app/advanced";
import { loadApertureHeadlessApp } from "../../packages/cli/src/headless/config-loader.js";
import {
  createHeadlessSessionController,
  preflightHeadlessSessionController,
} from "../../packages/cli/src/headless/session-controller.js";
import type {
  HeadlessSessionClient,
  HeadlessSessionClientOptions,
  HeadlessSessionLease,
} from "../../packages/cli/src/headless/realm-client.js";

/** Only closure-based local-controller unit fixtures use this adapter. Native
 * realm tests separately prove import/cache/EliCS isolation and actual exit. */
export async function prepareHeadlessSessionClient(
  options: HeadlessSessionClientOptions,
): Promise<HeadlessSessionClient> {
  assertApertureBootstrapAllowed();
  const loaded = await loadApertureHeadlessApp(options);
  preflightHeadlessSessionController(loaded);
  let controller:
    | Awaited<ReturnType<typeof createHeadlessSessionController>>
    | undefined;
  let disposed = false;
  const unavailable = () => {
    if (controller === undefined)
      throw new Error("Fixture controller is not activated.");
    return controller;
  };
  const fixture = {
    get lifecycle() {
      return disposed ? "disposed" : (controller?.lifecycle ?? "prepared");
    },
    get cleanupBlocked() {
      return getApertureCleanupFailures().length > 0;
    },
    async activate() {
      const { log, ...localOptions } = options;
      controller = await createHeadlessSessionController({
        ...localOptions,
        ...(log === undefined ? {} : { log }),
        config: loaded.config,
        systems: loaded.systems,
      });
    },
    cachedStatus() {
      return unavailable().status();
    },
    async status(
      input: Parameters<NonNullable<typeof controller>["status"]>[0],
    ) {
      return unavailable().status(input);
    },
    async compactStatus() {
      return unavailable().compactStatus();
    },
    step: (input: Parameters<NonNullable<typeof controller>["step"]>[0]) =>
      Promise.resolve(unavailable().step(input)),
    extract: (
      input: Parameters<NonNullable<typeof controller>["extract"]>[0],
    ) => Promise.resolve(unavailable().extract(input)),
    inject: (input: unknown) => Promise.resolve(unavailable().inject(input)),
    pick: (input: Parameters<NonNullable<typeof controller>["pick"]>[0]) =>
      Promise.resolve(unavailable().pick(input)),
    callTool: (
      input: Parameters<NonNullable<typeof controller>["callTool"]>[0],
    ) => Promise.resolve(unavailable().callTool(input)),
    reset: (input: Parameters<NonNullable<typeof controller>["reset"]>[0]) =>
      unavailable().reset(input),
    dispatchCommand: (
      input: Parameters<NonNullable<typeof controller>["dispatchCommand"]>[0],
    ) => Promise.resolve(unavailable().dispatchCommand(input)),
    createBundle: (
      input: Parameters<NonNullable<typeof controller>["createBundle"]>[0],
    ) => unavailable().createBundle(input),
    saveSessionSnapshot: (
      input: Parameters<
        NonNullable<typeof controller>["saveSessionSnapshot"]
      >[0],
    ) => unavailable().saveSessionSnapshot(input),
    restoreSessionSnapshot: (
      input: Parameters<
        NonNullable<typeof controller>["restoreSessionSnapshot"]
      >[0],
    ) => unavailable().restoreSessionSnapshot(input),
    determinismReport: () => Promise.resolve(unavailable().determinismReport()),
    withLease<T>(run: (lease: HeadlessSessionLease) => Promise<T>) {
      return run({
        signal: new AbortController().signal,
        createBundle: (input) => unavailable().createBundle(input),
      });
    },
    async dispose() {
      disposed = true;
      await controller?.dispose();
    },
  };
  return fixture as unknown as HeadlessSessionClient;
}
