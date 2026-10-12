import { parentPort, workerData } from "node:worker_threads";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { ApertureCliError } from "../errors.js";
import { captureHeadlessRealmSource } from "./realm-source.js";
import {
  HEADLESS_REALM_PROTOCOL,
  REALM_METHODS,
  cloneRealmValue,
  isRecord,
  type RealmAppOptions,
  type RealmCleanup,
  type RealmEvent,
  type RealmMetadata,
  type RealmReply,
  type RealmRequest,
  type RealmSnapshot,
} from "./realm-protocol.js";
import type * as AppDiagnosticModule from "@aperture-engine/app/diagnostics";
import type * as AppAdvancedModule from "@aperture-engine/app/advanced";
import type { ApertureGeneratedDiagnostic } from "@aperture-engine/app/diagnostics";
import type { HeadlessSessionController } from "./session-controller.js";
import type { LoadedApertureHeadlessApp } from "./config-loader.js";

// No app/EliCS runtime imports above this line: native hooks bind one project
// SDK before either the CLI controller or authored modules are evaluated.
if (
  parentPort === null ||
  !isRecord(workerData) ||
  typeof workerData["executionRevision"] !== "string"
)
  throw new Error(
    "A headless execution realm requires its owning worker transport.",
  );
const port = parentPort;
const executionRevision = workerData["executionRevision"];
const maxReplyBytes = workerData["maxReplyBytes"] as number;
let source: ReturnType<typeof captureHeadlessRealmSource> | null = null;
let loaded: LoadedApertureHeadlessApp | null = null;
let controller: HeadlessSessionController | null = null;
let appOptions: RealmAppOptions | null = null;
let preparedSnapshot: RealmSnapshot | undefined;
let disposed = false;
let closing = false;
let chain = Promise.resolve();
let diagnostics: typeof AppDiagnosticModule | null = null;
let advanced: typeof AppAdvancedModule | null = null;

function post(value: RealmReply | RealmEvent): void {
  port.postMessage(cloneRealmValue(value, maxReplyBytes));
}
function event(name: RealmEvent["event"], value: unknown): void {
  post({
    protocol: HEADLESS_REALM_PROTOCOL,
    executionRevision,
    event: name,
    value,
  });
}
async function loadRuntime(parentUrl: string): Promise<void> {
  source = captureHeadlessRealmSource(parentUrl);
  diagnostics = await import("@aperture-engine/app/diagnostics");
  advanced = await import("@aperture-engine/app/advanced");
  if (
    typeof diagnostics.errorToApertureDiagnostic !== "function" ||
    typeof advanced.createApertureApp !== "function" ||
    typeof advanced.getApertureCleanupFailures !== "function" ||
    typeof advanced.findDefinedResource !== "function"
  )
    throw new ApertureCliError(
      "aperture.headless.incompatibleSdk",
      "Selected project SDK does not provide the headless realm/source compatibility APIs required by this CLI. Align the installed CLI and project SDK release versions.",
    );
}
function metadata(): RealmMetadata | undefined {
  if (source === null) return undefined;
  const manifest = source.manifest();
  return {
    executionRevision,
    sourceRevision: manifest.revision,
    sourceManifest: manifest,
    status: controller?.status() ?? {
      lifecycle: closing ? "disposed" : "prepared",
      running: false,
    },
    compactStatus: controller?.compactStatus() ?? {
      lifecycle: "prepared",
      running: false,
    },
  };
}
function cleanupOutcome(): RealmCleanup {
  const failures =
    typeof advanced?.getApertureCleanupFailures === "function"
      ? advanced.getApertureCleanupFailures()
      : [];
  return {
    graceful: failures.length === 0,
    cleanupFailures: failures.map((error) =>
      diagnostic(error, "aperture.headless.runnerDisposeFailed"),
    ),
  };
}
function diagnostic(
  error: unknown,
  code = "aperture.headless.realmFailure",
): ApertureGeneratedDiagnostic {
  if (typeof diagnostics?.errorToApertureDiagnostic === "function")
    return diagnostics.errorToApertureDiagnostic(error, {
      code,
      severity: "error",
      message:
        error instanceof Error
          ? error.message
          : "Headless realm operation failed.",
      suggestedFix:
        "Inspect the original diagnostic stack/cause, correct the source or request, and retry in a fresh realm when cleanup succeeded.",
    });
  // Bootstrap failures before the app diagnostics module can load remain DTOs.
  return {
    code:
      isRecord(error) && typeof error["code"] === "string"
        ? error["code"].slice(0, 512)
        : code,
    severity: "error" as const,
    message: (error instanceof Error ? error.message : String(error)).slice(
      0,
      4096,
    ),
    suggestedFix:
      "Use supported Node and align the project and CLI Aperture package versions.",
    ...(error instanceof Error ? { error: boundedError(error) } : {}),
  };
}
interface BoundedRealmError {
  name: string;
  message: string;
  stack?: string;
  cause?: BoundedRealmError;
}
function boundedError(error: unknown, depth = 0): BoundedRealmError {
  const value = isRecord(error) ? error : {};
  return {
    name: (typeof value["name"] === "string" ? value["name"] : "Error").slice(
      0,
      256,
    ),
    message: (typeof value["message"] === "string"
      ? value["message"]
      : String(error)
    ).slice(0, 4096),
    ...(typeof value["stack"] === "string"
      ? { stack: value["stack"].slice(0, 8192) }
      : {}),
    ...(depth < 3 && value["cause"] !== undefined
      ? { cause: boundedError(value["cause"], depth + 1) }
      : {}),
  };
}
function requireController(): HeadlessSessionController {
  if (closing || controller === null || controller.lifecycle !== "ready")
    throw new ApertureCliError(
      "aperture.headless.sessionUnavailable",
      "The headless realm is not ready for runtime requests.",
    );
  return controller;
}
async function execute(request: RealmRequest): Promise<unknown> {
  const input = isRecord(request.input) ? request.input : {};
  switch (request.method) {
    case "prepare": {
      if (source !== null)
        throw new Error("A headless realm can be prepared only once.");
      const options = input["options"];
      if (
        !isRecord(options) ||
        typeof options["configFile"] !== "string" ||
        typeof options["root"] !== "string" ||
        typeof options["seed"] !== "number" ||
        !Number.isFinite(options["seed"]) ||
        typeof options["publicDir"] !== "string" ||
        typeof options["allowHttpAssets"] !== "boolean" ||
        !["strict", "placeholder", "hybrid"].includes(
          options["assetMode"] as string,
        ) ||
        !["off", "warn", "error"].includes(options["determinism"] as string)
      )
        throw new ApertureCliError(
          "aperture.headless.invalidRealmInput",
          "Realm prepare requires valid file/root/seed/asset/determinism options.",
        );
      appOptions = options as unknown as RealmAppOptions;
      preparedSnapshot = input["snapshot"] as RealmSnapshot | undefined;
      await loadRuntime(pathToFileURL(appOptions.configFile).href);
      const { loadApertureHeadlessApp } = await import("./config-loader.js");
      const { preflightHeadlessSessionController } =
        await import("./session-controller.js");
      loaded = await loadApertureHeadlessApp({
        configFile: appOptions.configFile,
        root: appOptions.root,
      });
      preflightHeadlessSessionController(loaded);
      for (const entry of loaded.diagnostics)
        event("log", {
          time: new Date().toISOString(),
          level: "warn",
          source: "config-loader",
          ...entry,
        });
      if (preparedSnapshot !== undefined) {
        const { assertSupportedSessionSnapshot } =
          await import("@aperture-engine/app/headless");
        assertSupportedSessionSnapshot(preparedSnapshot);
        const { preflightRealmSnapshot } =
          await import("./realm-compatibility.js");
        preflightRealmSnapshot(preparedSnapshot, loaded.systems, false);
      }
      return { prepared: true };
    }
    case "boot": {
      if (loaded === null || appOptions === null || controller !== null)
        throw new Error(
          "A headless realm must be prepared before its single world is booted.",
        );
      const { createHeadlessSessionController } =
        await import("./session-controller.js");
      const { preflightRealmSnapshot } =
        await import("./realm-compatibility.js");
      const systems = loaded.systems;
      controller = await createHeadlessSessionController({
        ...appOptions,
        config: loaded.config,
        systems,
        ...(preparedSnapshot === undefined
          ? {}
          : { initialSnapshot: preparedSnapshot }),
        validateSnapshot(snapshot) {
          preflightRealmSnapshot(snapshot as RealmSnapshot, systems, true);
        },
        log(entry) {
          event("log", entry);
        },
      });
      if (controller.lifecycle !== "ready")
        throw new ApertureCliError(
          "aperture.headless.restoreIncomplete",
          "Fresh-realm snapshot restoration was incomplete; the candidate was disposed.",
        );
      const compatibility =
        preparedSnapshot === undefined
          ? "not-restoring"
          : preflightRealmSnapshot(preparedSnapshot, systems, true);
      if (compatibility === "legacy-unverified")
        event("log", {
          time: new Date().toISOString(),
          level: "warn",
          source: "session-restore",
          code: "aperture.headless.legacySnapshotCompatibility",
          message:
            "Legacy snapshot lacks source schema metadata; compatibility is unverified.",
        });
      return {
        ready: true,
        restore: controller.initialRestoreReport,
        compatibility,
        sourceChanged:
          preparedSnapshot?.headlessExecution !== undefined &&
          preparedSnapshot.headlessExecution.source.revision !==
            source?.manifest().revision,
      };
    }
    case "status":
      return requireController().status(input);
    case "step":
      return requireController().step(input);
    case "extract":
      return { result: requireController().extract(input).result };
    case "inject":
      return requireController().inject(request.input);
    case "pick":
      return requireController().pick(input as never);
    case "dispatchCommand":
      return requireController().dispatchCommand(input as never);
    case "callTool":
      return requireController().callTool(input as never);
    case "createBundle":
      return requireController().createBundle(input as never);
    case "determinismReport":
      return requireController().determinismReport();
    case "saveSessionSnapshot": {
      const active = requireController();
      const { createApertureSessionSnapshot } =
        await import("@aperture-engine/app/headless");
      const { describeRealmCompatibility } =
        await import("./realm-compatibility.js");
      const snapshot = createApertureSessionSnapshot(active.runner);
      const saved: RealmSnapshot = {
        ...snapshot,
        headlessExecution: {
          schema: "aperture.headless-execution.v1",
          executionRevision,
          source: source!.manifest(),
          compatibility: describeRealmCompatibility(snapshot, loaded!.systems),
        },
      };
      const out = input["out"];
      if (typeof out !== "string" || out.length === 0)
        throw new Error("Snapshot output must be a non-empty path.");
      const encoded = cloneRealmValue(saved, maxReplyBytes);
      await mkdir(path.dirname(out), { recursive: true });
      const temporary = `${out}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, `${JSON.stringify(encoded)}\n`, {
          encoding: "utf8",
          flag: "wx",
        });
        await rename(temporary, out);
      } finally {
        await rm(temporary, { force: true });
      }
      return {
        path: out,
        frame: snapshot.runtime.frame,
        systems: snapshot.runtime.systems.length,
        resources: snapshot.simulation.resources.length,
        signals: snapshot.simulation.signals.length,
        executionRevision,
        sourceRevision: source!.manifest().revision,
      };
    }
    case "oneShot": {
      if (source !== null)
        throw new Error("A one-shot headless realm runs only one command.");
      if (
        !Array.isArray(input["argv"]) ||
        input["argv"].some(
          (argument: unknown) => typeof argument !== "string",
        ) ||
        typeof input["cwd"] !== "string" ||
        typeof input["configFile"] !== "string"
      )
        throw new ApertureCliError(
          "aperture.headless.invalidRealmInput",
          "Realm one-shot requires string argv and cwd.",
        );
      const argv = input["argv"] as string[];
      const cwd = input["cwd"];
      await loadRuntime(pathToFileURL(input["configFile"] as string).href);
      const { runHeadlessCommandLocal } =
        await import("../commands/headless.js");
      return runHeadlessCommandLocal({
        argv,
        cwd,
        stdout(text) {
          event("command-output", { channel: "stdout", text });
        },
        stderr(text) {
          event("command-output", { channel: "stderr", text });
        },
      });
    }
    case "dispose": {
      closing = true;
      await controller?.dispose();
      disposed = true;
      return cleanupOutcome();
    }
  }
}
port.on("message", (value: unknown) => {
  if (
    !isRecord(value) ||
    value["protocol"] !== HEADLESS_REALM_PROTOCOL ||
    value["executionRevision"] !== executionRevision ||
    !Number.isSafeInteger(value["id"]) ||
    !REALM_METHODS.includes(value["method"] as never)
  ) {
    port.close();
    throw new Error("Invalid headless realm request envelope.");
  }
  const request = value as unknown as RealmRequest;
  chain = chain
    .then(async () => {
      try {
        if (disposed) throw new Error("The headless realm has been disposed.");
        const result = await execute(request);
        const info = metadata();
        post({
          protocol: HEADLESS_REALM_PROTOCOL,
          executionRevision,
          id: request.id,
          ok: true,
          result,
          ...(info === undefined ? {} : { metadata: info }),
          ...(request.method === "dispose"
            ? { cleanup: cleanupOutcome() }
            : {}),
        });
      } catch (error: unknown) {
        const info = metadata();
        const failure = diagnostic(error);
        const cleanup = cleanupOutcome();
        try {
          post({
            protocol: HEADLESS_REALM_PROTOCOL,
            executionRevision,
            id: request.id,
            ok: false,
            diagnostic: failure,
            cleanup,
            ...(info === undefined ? {} : { metadata: info }),
          });
        } catch {
          // A result/status/custom error detail may itself violate the DTO budget.
          // Still settle the request with bounded original stack/cause, without it.
          const { data: _omitted, ...boundedFailure } = failure;
          post({
            protocol: HEADLESS_REALM_PROTOCOL,
            executionRevision,
            id: request.id,
            ok: false,
            diagnostic: {
              ...boundedFailure,
              data: { responseDetailOmitted: true },
            },
            cleanup: {
              ...cleanup,
              cleanupFailures: cleanup.cleanupFailures.map(
                ({ data: _detail, ...entry }) => entry,
              ),
            },
          });
        }
      } finally {
        if (request.method === "dispose") {
          source?.dispose();
          port.close();
        }
      }
    })
    .catch((error: unknown) => {
      // A failed post/serialization channel cannot leave a silently live realm.
      console.error("Headless realm response transport failed:", error);
      port.close();
      process.exitCode = 1;
    });
});
