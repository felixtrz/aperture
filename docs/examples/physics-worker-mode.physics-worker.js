let apertureModulePromise = null;
let backend = null;
let endpoint = null;

self.addEventListener("error", (event) => {
  void postPhysicsError(
    "physics-worker-runtime-error",
    event.message || "The physics backend worker raised an error.",
  );
  event.preventDefault();
});

self.addEventListener("unhandledrejection", (event) => {
  void postPhysicsError(
    "physics-worker-unhandled-rejection",
    messageFromError(event.reason),
  );
  event.preventDefault();
});

self.onmessage = (event) => {
  void handleMessage(event.data);
};

async function handleMessage(message) {
  const aperture = await loadAperture();

  if (message?.type === aperture.PHYSICS_WORKER_PROTOCOL.init) {
    await initializeBackend(aperture, message);
    return;
  }

  if (message?.type === aperture.PHYSICS_WORKER_PROTOCOL.step) {
    if (endpoint === null) {
      postPhysicsError(
        "physics-worker-not-initialized",
        "Physics worker received a step before initialization.",
      );
      return;
    }

    const response = await endpoint.step({ message, transfer: [] });
    self.postMessage(response.message, response.transfer);
    return;
  }

  if (message?.type === aperture.PHYSICS_WORKER_PROTOCOL.action) {
    if (endpoint === null || typeof endpoint.action !== "function") {
      postPhysicsError(
        "physics-worker-not-initialized",
        "Physics worker received an action before initialization.",
        message.requestId,
      );
      return;
    }

    const response = await endpoint.action({ message, transfer: [] });
    self.postMessage(response.message, response.transfer);
    return;
  }

  if (message?.type === aperture.PHYSICS_WORKER_PROTOCOL.dispose) {
    backend?.dispose();
    backend = null;
    endpoint = null;
  }
}

function loadAperture() {
  apertureModulePromise ??= Promise.all([
    import("@aperture-engine/physics"),
    import("@aperture-engine/physics-rapier"),
  ]).then(([physics, rapier]) => ({
    ...physics,
    ...rapier,
  }));
  return apertureModulePromise;
}

async function initializeBackend(aperture, message) {
  if (message.backend !== "rapier") {
    postPhysicsError(
      "physics-worker-unsupported-backend",
      `Physics worker only supports the Rapier backend, received '${String(
        message.backend,
      )}'.`,
    );
    return;
  }

  backend?.dispose();
  backend = aperture.createRapierPhysicsBackend({
    gravity: message.gravity,
    execution: message.execution,
  });
  await backend.init({
    gravity: message.gravity,
    execution: message.execution,
  });
  endpoint = aperture.createPhysicsWorkerBackendEndpoint(backend);
  self.postMessage({
    type: "ready",
    backend: backend.kind,
    backendVersion: backend.version,
    backendBuild: backend.build,
    execution: backend.execution,
  });
}

async function postPhysicsError(reason, message, requestId) {
  const aperture = await loadAperture();
  self.postMessage({
    type: aperture.PHYSICS_WORKER_PROTOCOL.error,
    reason,
    message,
    ...(requestId === undefined ? {} : { requestId }),
  });
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
