import {
  type SimulationWorker,
  type SimulationWorkerErrorEvent,
  type SimulationWorkerSnapshotEvent,
} from "@aperture-engine/runtime";
import type { AssetRegistry } from "@aperture-engine/simulation";
import { mirrorSourceAssetRegistryFromMessage } from "../asset-mirror.js";
import { createApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
import type { GeneratedBrowserAppStatus } from "./status.js";

export function mirrorSimulationWorkerSourceAssets(
  worker: SimulationWorker,
  sourceAssets: AssetRegistry,
  status: GeneratedBrowserAppStatus,
): SimulationWorker {
  return {
    ...worker,
    onSnapshot(callback) {
      return worker.onSnapshot((event: SimulationWorkerSnapshotEvent) => {
        const mirror = mirrorSourceAssetRegistryFromMessage(
          sourceAssets,
          event.message,
        );
        status.snapshots += 1;
        status.lastFrame = event.frame;
        status.mirroredSourceAssets += mirror.mirrored;
        status.skippedSourceAssets += mirror.skipped;
        status.lastWorkerSummary =
          typeof event.message === "object" && event.message !== null
            ? ((event.message as { readonly workerSummary?: unknown })
                .workerSummary ?? null)
            : null;
        callback(event);
      });
    },
    onError(callback) {
      return worker.onError((event: SimulationWorkerErrorEvent) => {
        status.status = "worker-error";
        status.lastFailure = createApertureGeneratedDiagnosticsStatus({
          status: "failed",
          diagnostics: event.diagnostics ?? [
            {
              code: event.reason,
              severity: "error",
              message: event.message,
              worker: event.source,
              suggestedFix:
                "Inspect generated worker diagnostics and restart the app after fixing the reported issue.",
            },
          ],
        });
        status.lastError = status.lastFailure;
        callback(event);
      });
    },
  };
}
