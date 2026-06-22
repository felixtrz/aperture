const controlVersion = 1;
const webGpuWarnings = [];
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

console.warn = (...args) => {
  captureConsoleMessage("warning", args);
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  captureConsoleMessage("error", args);
  originalConsoleError(...args);
};

const baseCapabilities = Object.freeze({
  status: true,
  warnings: true,
  screenshot: true,
  pause: false,
  resume: false,
  step: false,
  scenario: false,
  snapshot: true,
  readback: false,
});

const controlState = {
  capabilities: { ...baseCapabilities },
  handlers: {},
};

const control = {
  version: controlVersion,
  get capabilities() {
    return { ...controlState.capabilities };
  },
  getStatus() {
    return callHandler("getStatus", defaultGetStatus);
  },
  getWarnings() {
    return callHandler("getWarnings", defaultGetWarnings);
  },
  pause() {
    return callRequiredCapability("pause", "pause", []);
  },
  resume() {
    return callRequiredCapability("resume", "resume", []);
  },
  step(frames = 1) {
    return callRequiredCapability("step", "step", [frames]);
  },
  setScenario(id, options = {}) {
    return callRequiredCapability("scenario", "setScenario", [id, options]);
  },
  snapshot(label = "snapshot") {
    return callHandler("snapshot", () => defaultSnapshot(label), [label]);
  },
  getFrameState() {
    return callHandler("getFrameState", defaultGetFrameState);
  },
};

globalThis.__APERTURE_EXAMPLE_CONTROL__ = control;
window.__APERTURE_EXAMPLE_CONTROL__ = control;

export function configureApertureExampleControl(options = {}) {
  if (isRecord(options.capabilities)) {
    controlState.capabilities = {
      ...controlState.capabilities,
      ...booleanCapabilityOverrides(options.capabilities),
    };
  }

  const handlers = options.handlers ?? options;

  for (const key of [
    "getStatus",
    "getWarnings",
    "pause",
    "resume",
    "step",
    "setScenario",
    "snapshot",
    "getFrameState",
  ]) {
    if (typeof handlers[key] === "function") {
      controlState.handlers[key] = handlers[key];
    }
  }

  return control;
}

export function getApertureExampleControl() {
  return control;
}

async function callHandler(key, fallback, args = []) {
  const handler = controlState.handlers[key];

  return toJsonSafe(await (handler ?? fallback)(...args));
}

async function callRequiredCapability(capability, handlerKey, args) {
  if (controlState.capabilities[capability] !== true) {
    return unsupportedCapability(capability);
  }

  const handler = controlState.handlers[handlerKey];

  if (typeof handler !== "function") {
    return unsupportedCapability(capability);
  }

  return toJsonSafe(await handler(...args));
}

function defaultGetStatus() {
  return globalThis.__APERTURE_EXAMPLE_STATUS__ ?? null;
}

function defaultGetWarnings() {
  return webGpuWarnings.slice();
}

function defaultGetFrameState() {
  const status = defaultGetStatus();

  return {
    status,
    frame: firstFiniteNumber([
      status?.frame,
      status?.animation?.frames,
      status?.extraction?.frame,
      status?.worker?.step?.frame,
      status?.worker?.snapshotsReceived,
      status?.worker?.receivedSnapshots,
    ]),
  };
}

async function defaultSnapshot(label) {
  return {
    label,
    capturedAt: new Date().toISOString(),
    url: globalThis.location.href,
    status: await callHandler("getStatus", defaultGetStatus),
    frameState: await callHandler("getFrameState", defaultGetFrameState),
    warnings: await callHandler("getWarnings", defaultGetWarnings),
  };
}

function unsupportedCapability(capability) {
  return {
    ok: false,
    reason: "unsupported-capability",
    message: `Example control capability '${capability}' is not supported by this route.`,
    capability,
    capabilities: { ...controlState.capabilities },
  };
}

function captureConsoleMessage(type, args) {
  const text = args.map(formatConsoleArg).join(" ");

  if (!isWebGpuValidationWarning(text)) {
    return;
  }

  webGpuWarnings.push({
    type,
    text,
    capturedAt: new Date().toISOString(),
  });
}

function isWebGpuValidationWarning(text) {
  return (
    text.includes("Invalid CommandBuffer") ||
    text.includes("created with a default layout") ||
    text.includes("While encoding [RenderPassEncoder") ||
    text.includes("While calling [Queue].Submit") ||
    (text.includes("WebGPU") && text.includes("validation"))
  );
}

function formatConsoleArg(arg) {
  if (typeof arg === "string") {
    return arg;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function booleanCapabilityOverrides(capabilities) {
  const overrides = {};

  for (const [key, value] of Object.entries(capabilities)) {
    if (typeof value === "boolean") {
      overrides[key] = value;
    }
  }

  return overrides;
}

function firstFiniteNumber(values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function toJsonSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (error) {
    return {
      ok: false,
      reason: "control-value-not-json-safe",
      message:
        error instanceof Error
          ? error.message
          : "Example control returned a non-JSON-safe value.",
    };
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

// Progressive shell enhancement: keep the harness chrome clean and gallery-ready
// by tucking the raw frame JSON into a collapsed drawer. The JSON element stays
// in the DOM (examples still write to `#example-json`), and automated checks read
// `window.__APERTURE_EXAMPLE_STATUS__`, so this is purely cosmetic.
function enhanceExampleShell() {
  const panel = document.querySelector(".status-panel");
  const json = document.querySelector("#example-json");

  if (panel === null || json === null) {
    return;
  }

  if (json.closest(".example-json-drawer") !== null) {
    return;
  }

  const drawer = document.createElement("details");
  drawer.className = "example-json-drawer";

  const summary = document.createElement("summary");
  summary.textContent = "Frame JSON";

  json.replaceWith(drawer);
  drawer.append(summary, json);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceExampleShell, {
      once: true,
    });
  } else {
    enhanceExampleShell();
  }
}
