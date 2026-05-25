import { APERTURE_GENERATED_COMMAND_EVENT } from "@aperture-engine/app/commands";

type JsonRecord = Record<string, unknown>;

const SELECT_KEY = "Enter";
const ASSET_REQUEST_CHANNEL = "asset.request";
const SELECT_POINTER = [0.25, 0.5] as const;

const selectButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='select']",
);
const requestDecalButton = document.querySelector<HTMLButtonElement>(
  "[data-aperture-action='request-decal']",
);
const statusOutput = document.querySelector<HTMLElement>(
  "#aperture-dev-status",
);

selectButton?.addEventListener("click", () => {
  dispatchPointerMove(SELECT_POINTER);
  dispatchSelectKey("keydown");
  window.setTimeout(() => dispatchSelectKey("keyup"), 80);
});

requestDecalButton?.addEventListener("click", () => {
  window.dispatchEvent(
    new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, {
      detail: {
        channel: ASSET_REQUEST_CHANNEL,
        payload: { assetId: "decal" },
      },
    }),
  );
});

function renderStatus(): void {
  if (statusOutput !== null) {
    statusOutput.textContent = JSON.stringify(readPanelStatus(), null, 2);
  }

  requestAnimationFrame(renderStatus);
}

function readPanelStatus(): JsonRecord {
  const status = readRecord(
    (globalThis as { readonly __APERTURE_GENERATED_APP__?: unknown })
      .__APERTURE_GENERATED_APP__,
  );
  const worker = readRecord(status?.lastWorkerSummary);
  const entities = readRecord(worker?.entities);
  const diagnostics = readRecord(status?.diagnostics);
  const lastFrame = readRecord(diagnostics?.lastFrame);

  return {
    app: {
      status: status?.status ?? "starting",
      webgpuOk: status?.webgpuOk ?? null,
      snapshots: status?.snapshots ?? 0,
      forwardedInputEvents: status?.forwardedInputEvents ?? 0,
      forwardedCommandEvents: status?.forwardedCommandEvents ?? 0,
      lastFrame: status?.lastFrame ?? null,
      frameCounts: readRecord(lastFrame?.counts),
    },
    signals: readRecord(worker?.signals),
    input: readRecord(worker?.input),
    commands: readRecord(worker?.commands),
    entities: {
      total: entities?.total ?? 0,
      summaries: readEntitySummaries(entities?.summaries),
    },
    diagnostics: Array.isArray(worker?.diagnostics)
      ? worker.diagnostics
      : [],
  };
}

function dispatchPointerMove(position: readonly [number, number]): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
  const rect = canvas?.getBoundingClientRect();

  if (canvas === null || rect === undefined) {
    return;
  }

  canvas.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: rect.left + rect.width * position[0],
      clientY: rect.top + rect.height * position[1],
      pointerId: 1,
      pointerType: "mouse",
    }),
  );
}

function dispatchSelectKey(type: "keydown" | "keyup"): void {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      bubbles: true,
      code: SELECT_KEY,
      key: SELECT_KEY,
    }),
  );
}

function readEntitySummaries(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const summary = readRecord(entry);

    return {
      entity: summary?.entity ?? null,
      key: summary?.key ?? null,
      name: summary?.name ?? null,
      tags: summary?.tags ?? [],
      componentIds: summary?.componentIds ?? [],
      source: summary?.source ?? null,
    };
  });
}

function readRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

renderStatus();
