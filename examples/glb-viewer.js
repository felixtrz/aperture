const canvas = document.querySelector("#aperture-canvas");
const assetSelect = document.querySelector("#glb-asset-select");
const customUrlForm = document.querySelector("#glb-url-form");
const customUrlInput = document.querySelector("#glb-url-input");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const exampleParams = new URLSearchParams(globalThis.location.search);
const clearColor = [0.015, 0.025, 0.035, 1];
const sampleAssets = [
  {
    id: "cube",
    label: "Mint cube",
    url: new URL("./assets/cube.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "slab",
    label: "Amber slab",
    url: new URL("./assets/amber-slab.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "pillar",
    label: "Sapphire pillar",
    url: new URL("./assets/sapphire-pillar.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "brass",
    label: "Lit brass cube",
    url: new URL("./assets/lit-brass-cube.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "animated",
    label: "Animated cube",
    url: new URL("./assets/animated-cube.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "dual",
    label: "Dual primitive",
    url: new URL("./assets/dual-primitive.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "hierarchy",
    label: "Hierarchy cube",
    url: new URL("./assets/hierarchy-cube.glb", globalThis.location.href),
    source: "sample",
  },
];

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 16 },
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = createGlbViewerScene(aperture, created.app, canvas);

      await loadInitialAsset(aperture, created.app, scene);
      startRendering(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "glb-viewer-failed",
      error instanceof Error ? error.message : "GLB viewer failed.",
    ),
  );
}

function createGlbViewerScene(aperture, app, targetCanvas) {
  const orbit = createOrbitControls(targetCanvas);
  const initialCustomUrl = readInitialCustomUrl();
  const cameraEntity = app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.4] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  updateOrbitCamera(aperture, cameraEntity, orbit);
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.48, 0.52, 0.58, 1],
      intensity: 0.24,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.2, 1.2, 3.4] }),
    aperture.withLight({
      kind: aperture.LightKind.Point,
      color: [1, 0.92, 0.76, 1],
      intensity: 18,
      range: 8,
      layerMask: 1,
    }),
  );

  const scene = {
    asset: sampleAssets[0],
    loadState: null,
    loadSequence: 0,
    initialCustomUrl,
    active: null,
    orbit,
    cameraEntity,
  };

  if (assetSelect !== null) {
    for (const asset of sampleAssets) {
      const option = document.createElement("option");
      option.value = asset.id;
      option.textContent = asset.label;
      assetSelect.append(option);
    }

    assetSelect.addEventListener("change", () => {
      loadSelectedAsset(aperture, app, scene).catch((error) => {
        scene.loadState = failure(
          "glb-viewer-load-failed",
          error instanceof Error ? error.message : "GLB asset load failed.",
        );
      });
    });
  }

  if (customUrlForm !== null) {
    if (
      customUrlInput instanceof HTMLInputElement &&
      initialCustomUrl !== null
    ) {
      customUrlInput.value = initialCustomUrl.href;
    }

    customUrlForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loadCustomUrlAsset(aperture, app, scene).catch((error) => {
        scene.loadState = failure(
          "glb-viewer-load-failed",
          error instanceof Error ? error.message : "GLB URL load failed.",
        );
      });
    });
  }

  return scene;
}

async function loadInitialAsset(aperture, app, scene) {
  if (scene.initialCustomUrl !== null) {
    await loadAsset(aperture, app, scene, {
      id: "custom-url",
      label: "Custom URL",
      url: scene.initialCustomUrl,
      source: "custom",
    });
    return;
  }

  await loadSelectedAsset(aperture, app, scene);
}

async function loadSelectedAsset(aperture, app, scene) {
  const asset =
    sampleAssets.find((entry) => entry.id === assetSelect?.value) ??
    sampleAssets[0];

  await loadAsset(aperture, app, scene, asset);
}

async function loadCustomUrlAsset(aperture, app, scene) {
  if (!(customUrlInput instanceof HTMLInputElement)) {
    throw new Error("Custom GLB URL input is unavailable.");
  }

  const rawUrl = customUrlInput.value.trim();

  if (rawUrl.length === 0) {
    throw new Error("Custom GLB URL is empty.");
  }

  const url = new URL(rawUrl, globalThis.location.href);

  if (!url.pathname.toLowerCase().endsWith(".glb")) {
    throw new Error("Custom GLB URL must end in .glb.");
  }

  await loadAsset(aperture, app, scene, {
    id: "custom-url",
    label: "Custom URL",
    url,
    source: "custom",
  });
}

async function loadAsset(aperture, app, scene, asset) {
  const loadSequence = scene.loadSequence + 1;
  const keyPrefix = `viewer-${asset.id}-${loadSequence}`;

  scene.loadSequence = loadSequence;
  scene.asset = asset;
  scene.loadState = {
    ok: true,
    phase: "loading",
    asset: {
      id: asset.id,
      label: asset.label,
      source: asset.source,
      url: formatAssetUrl(asset.url),
    },
  };
  destroyActiveScene(scene);

  const loaded = await aperture.loadGlbFromUri(asset.url.href, {
    keyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
  });
  const importReport = loaded.loader?.glbImportReport.importReport ?? null;

  if (scene.loadSequence !== loadSequence) {
    return;
  }

  if (!loaded.ok || importReport === null) {
    throw new Error(loaded.diagnostics[0]?.message ?? "GLB did not load.");
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new Error("GLB did not produce renderable source assets.");
  }

  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: app.assets,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });
  const sourceRegistration = registration.sourceRegistration;
  const meshRegistration = registration.meshRegistration;

  if (sourceRegistration === null || meshRegistration === null) {
    throw new Error("GLB source registration was not produced.");
  }

  const primitiveMaterials =
    aperture.createGltfPrimitiveMaterialResolutionReport({
      primitiveReport: importReport.meshPrimitive,
      registrationReport: sourceRegistration,
      keyPrefix,
    });
  const commandPlan = aperture.createGltfEcsAuthoringCommandPlan({
    traversalReport: importReport.sceneTraversal,
    meshRegistrationReport: meshRegistration,
    primitiveMaterialReport: primitiveMaterials,
  });
  const replay = aperture.applyGltfEcsCommandPlanToApp({
    app,
    plan: commandPlan,
  });
  const animation = createGltfAnimationState({
    aperture,
    root: loaded.loader.glbImportReport.container.container.json,
    binary: loaded.loader.glbImportReport.container.container.binaryChunk,
    keyPrefix,
    replay,
  });

  updateActiveAnimation(aperture, animation, 0);
  aperture.resolveWorldTransforms(app.world);
  const fit = fitOrbitToReplayBounds(aperture, app, replay, scene.orbit);

  scene.active = {
    asset,
    keyPrefix,
    loaded,
    registration,
    primitiveMaterials,
    commandPlan,
    replay,
    animation,
    fit,
  };
  scene.loadState = null;
}

function destroyActiveScene(scene) {
  if (scene.active === null) {
    return;
  }

  for (const entity of scene.active.replay.entitiesByKey.values()) {
    entity.destroy();
  }

  scene.active = null;
}

function startRendering(aperture, app, scene) {
  let frame = 0;

  const render = async () => {
    try {
      frame += 1;
      updateActiveAnimation(
        aperture,
        scene.active?.animation ?? null,
        frame / 60,
      );
      updateOrbitCamera(aperture, scene.cameraEntity, scene.orbit);
      const step = app.step(0, frame / 60);
      const report = await app.render({
        frame,
        clearColor,
        label: "glb-viewer-app",
      });

      publishStatus(createStatus(aperture, app, scene, step, report, frame));
      requestAnimationFrame(render);
    } catch (error) {
      publishStatus(
        failure(
          "glb-viewer-render-failed",
          error instanceof Error ? error.message : "GLB viewer render failed.",
        ),
      );
    }
  };

  requestAnimationFrame(render);
}

function createStatus(aperture, app, scene, step, report, frame) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const active = scene.active;

  return {
    example: "glb-viewer",
    ok: report.ok,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    frame,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    selectedAsset: {
      id: scene.asset.id,
      label: scene.asset.label,
      source: scene.asset.source,
      url: formatAssetUrl(scene.asset.url),
      loading: scene.loadState?.phase === "loading",
      materialFamilies: createMaterialFamilyStatus(aperture, app, active),
    },
    source: {
      url: formatAssetUrl(active?.asset.url ?? scene.asset.url),
      ok: active?.loaded.ok ?? false,
      byteLength: active?.loaded.byteLength ?? null,
      status: active?.loaded.loader?.status ?? null,
      outputSummary: active?.loaded.loader?.outputSummary ?? null,
      diagnostics: active?.loaded.diagnostics ?? [],
    },
    gltf: {
      registration: {
        valid: active?.registration.valid ?? false,
        diagnostics: active?.registration.diagnostics.length ?? 0,
      },
      primitiveMaterials: {
        valid: active?.primitiveMaterials.valid ?? false,
        resolved: active?.primitiveMaterials.resolved.length ?? 0,
        diagnostics: active?.primitiveMaterials.diagnostics.length ?? 0,
        families: createMaterialFamilyStatus(aperture, app, active),
      },
      commandPlan: {
        valid: active?.commandPlan.valid ?? false,
        commands: active?.commandPlan.commands.length ?? 0,
        dependencies: active?.commandPlan.dependencies.length ?? 0,
      },
      replay: {
        valid: active?.replay.valid ?? false,
        created: active?.replay.created.length ?? 0,
        diagnostics: active?.replay.diagnostics.length ?? 0,
      },
    },
    orbit: {
      yaw: Number(scene.orbit.yaw.toFixed(4)),
      distance: Number(scene.orbit.distance.toFixed(3)),
      target: roundTuple(scene.orbit.target, 3),
      fit: scene.orbit.fit,
      dragging: scene.orbit.dragging,
    },
    animation: createAnimationStatus(active?.animation ?? null),
    hierarchy: createHierarchyStatus(aperture, active),
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    draw: {
      packages: report.counts.drawPackages,
      drawCalls: reportJson.counts.drawCalls,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    report: reportJson,
    step,
    canvas: {
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
    },
  };
}

function createGltfAnimationState(options) {
  const clips = parseGltfAnimationClips(options);
  const activeClip = clips[0] ?? null;

  return {
    status: activeClip === null ? "absent" : "playing",
    clipCount: clips.length,
    activeClip,
    time: 0,
    animatedNodes: [],
  };
}

function parseGltfAnimationClips({
  aperture,
  root,
  binary,
  keyPrefix,
  replay,
}) {
  if (!isRecord(root) || !Array.isArray(root.animations)) {
    return [];
  }

  const clips = [];

  root.animations.forEach((animation, animationIndex) => {
    if (!isRecord(animation)) {
      return;
    }

    const samplers = Array.isArray(animation.samplers)
      ? animation.samplers
      : [];
    const channels = Array.isArray(animation.channels)
      ? animation.channels
      : [];
    const parsedChannels = [];

    channels.forEach((channel) => {
      if (!isRecord(channel) || !isRecord(channel.target)) {
        return;
      }

      const samplerIndex = integerOrNull(channel.sampler);
      const nodeIndex = integerOrNull(channel.target.node);
      const path = channel.target.path;

      if (
        samplerIndex === null ||
        nodeIndex === null ||
        path !== "translation"
      ) {
        return;
      }

      const sampler = samplers[samplerIndex];
      if (!isRecord(sampler)) {
        return;
      }

      const inputAccessor = integerOrNull(sampler.input);
      const outputAccessor = integerOrNull(sampler.output);
      if (inputAccessor === null || outputAccessor === null) {
        return;
      }

      const times = readGltfFloatAccessorTuples(
        root,
        binary,
        inputAccessor,
        "SCALAR",
      ).map((tuple) => tuple[0]);
      const translations = readGltfFloatAccessorTuples(
        root,
        binary,
        outputAccessor,
        "VEC3",
      );
      const entityKey = `${keyPrefix}:node:${nodeIndex}`;
      const entity = replay.entitiesByKey.get(entityKey) ?? null;

      if (
        times.length < 2 ||
        times.length !== translations.length ||
        entity === null ||
        !entity.hasComponent(aperture.LocalTransform)
      ) {
        return;
      }

      parsedChannels.push({
        nodeIndex,
        entityKey,
        path,
        times,
        translations,
        entity,
      });
    });

    if (parsedChannels.length === 0) {
      return;
    }

    clips.push({
      name:
        typeof animation.name === "string" && animation.name.length > 0
          ? animation.name
          : `Animation${animationIndex}`,
      duration: Math.max(
        ...parsedChannels.map((channel) => channel.times.at(-1) ?? 0),
      ),
      channels: parsedChannels,
    });
  });

  return clips;
}

function updateActiveAnimation(aperture, animation, elapsedSeconds) {
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    return;
  }

  const duration = Math.max(0, clip.duration);
  const localTime =
    duration > 0 ? ((elapsedSeconds % duration) + duration) % duration : 0;
  const animatedNodes = [];

  for (const channel of clip.channels) {
    const translation = sampleTranslationChannel(channel, localTime);

    channel.entity
      .getVectorView(aperture.LocalTransform, "translation")
      .set(translation);
    animatedNodes.push({
      nodeIndex: channel.nodeIndex,
      entityKey: channel.entityKey,
      path: channel.path,
      value: roundTuple(translation, 3),
    });
  }

  animation.time = Number(localTime.toFixed(3));
  animation.animatedNodes = animatedNodes;
}

function sampleTranslationChannel(channel, time) {
  if (time <= channel.times[0]) {
    return channel.translations[0];
  }

  for (let index = 1; index < channel.times.length; index += 1) {
    const nextTime = channel.times[index];

    if (time > nextTime) {
      continue;
    }

    const previousTime = channel.times[index - 1];
    const previous = channel.translations[index - 1];
    const next = channel.translations[index];
    const t =
      nextTime === previousTime
        ? 0
        : (time - previousTime) / (nextTime - previousTime);

    return [
      previous[0] + (next[0] - previous[0]) * t,
      previous[1] + (next[1] - previous[1]) * t,
      previous[2] + (next[2] - previous[2]) * t,
    ];
  }

  return channel.translations.at(-1) ?? [0, 0, 0];
}

function createAnimationStatus(animation) {
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    return {
      status: "absent",
      clipCount: 0,
      activeClipName: null,
      time: 0,
      duration: 0,
      channelCount: 0,
      animatedNodes: [],
    };
  }

  return {
    status: animation.status,
    clipCount: animation.clipCount,
    activeClipName: clip.name,
    time: animation.time,
    duration: Number(clip.duration.toFixed(3)),
    channelCount: clip.channels.length,
    animatedNodes: animation.animatedNodes,
  };
}

function readGltfFloatAccessorTuples(
  root,
  binary,
  accessorIndex,
  expectedType,
) {
  if (binary === null || !isRecord(root) || !Array.isArray(root.accessors)) {
    return [];
  }

  const accessor = root.accessors[accessorIndex];
  const bufferViews = Array.isArray(root.bufferViews) ? root.bufferViews : [];

  if (!isRecord(accessor)) {
    return [];
  }

  const bufferViewIndex = integerOrNull(accessor.bufferView);
  const count = integerOrNull(accessor.count);
  const componentType = accessor.componentType;
  const type = accessor.type;
  const componentCount = componentCountForAccessorType(type);

  if (
    bufferViewIndex === null ||
    count === null ||
    count <= 0 ||
    componentType !== 5126 ||
    type !== expectedType ||
    componentCount === null
  ) {
    return [];
  }

  const bufferView = bufferViews[bufferViewIndex];
  if (!isRecord(bufferView)) {
    return [];
  }

  const viewOffset = integerOrZero(bufferView.byteOffset);
  const accessorOffset = integerOrZero(accessor.byteOffset);
  const viewLength = integerOrNull(bufferView.byteLength);
  const elementByteLength = componentCount * 4;
  const stride = integerOrNull(bufferView.byteStride) ?? elementByteLength;
  const start = viewOffset + accessorOffset;

  if (
    viewLength === null ||
    start < 0 ||
    stride < elementByteLength ||
    accessorOffset + (count - 1) * stride + elementByteLength > viewLength ||
    start + (count - 1) * stride + elementByteLength > binary.byteLength
  ) {
    return [];
  }

  const data = new DataView(
    binary.buffer,
    binary.byteOffset,
    binary.byteLength,
  );
  const tuples = [];

  for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
    const itemOffset = start + itemIndex * stride;
    const tuple = [];

    for (let component = 0; component < componentCount; component += 1) {
      tuple.push(data.getFloat32(itemOffset + component * 4, true));
    }

    if (tuple.every(Number.isFinite)) {
      tuples.push(tuple);
    }
  }

  return tuples;
}

function componentCountForAccessorType(type) {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC3":
      return 3;
    default:
      return null;
  }
}

function createHierarchyStatus(aperture, active) {
  if (active === null) {
    return { nodes: [] };
  }

  const nodes =
    active.loaded.loader?.glbImportReport.importReport?.sceneTraversal.nodes ??
    [];

  return {
    nodes: nodes.map((node) => {
      const entity = active.replay.entitiesByKey.get(node.entityKey) ?? null;
      const worldMatrix =
        entity === null || !entity.hasComponent(aperture.WorldTransform)
          ? null
          : readWorldMatrix(aperture, entity);

      return {
        nodeIndex: node.nodeIndex,
        entityKey: node.entityKey,
        parentEntityKey: node.parentEntityKey,
        localTranslation:
          entity === null || !entity.hasComponent(aperture.LocalTransform)
            ? null
            : roundTuple(
                Array.from(
                  entity.getVectorView(aperture.LocalTransform, "translation"),
                ),
                3,
              ),
        worldTranslation:
          worldMatrix === null
            ? null
            : roundTuple(
                [worldMatrix[12], worldMatrix[13], worldMatrix[14]],
                3,
              ),
      };
    }),
  };
}

function createMaterialFamilyStatus(aperture, app, active) {
  if (active === null) {
    return [];
  }

  const counts = new Map();

  for (const material of active.primitiveMaterials.resolved) {
    const materialId = material.materialHandleKey.replace(/^material:/, "");
    const entry = app.assets.get(aperture.createMaterialHandle(materialId));
    const family = entry?.asset?.kind ?? "missing";

    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, count]) => ({ family, count }));
}

function createOrbitControls(targetCanvas) {
  const state = {
    yaw: 0,
    distance: 3.4,
    minDistance: 1.8,
    maxDistance: 6,
    target: [0, 0, 0],
    fit: {
      status: "default",
      center: [0, 0, 0],
      size: [1, 1, 1],
      distance: 3.4,
      minDistance: 1.8,
      maxDistance: 6,
    },
    dragging: false,
    lastX: 0,
  };

  targetCanvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.lastX = event.clientX;
    targetCanvas.setPointerCapture(event.pointerId);
  });
  targetCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      return;
    }

    const deltaX = event.clientX - state.lastX;
    state.lastX = event.clientX;
    state.yaw = wrapRadians(state.yaw - deltaX * 0.006);
  });
  targetCanvas.addEventListener("pointerup", (event) => {
    state.dragging = false;
    targetCanvas.releasePointerCapture(event.pointerId);
  });
  targetCanvas.addEventListener("pointercancel", () => {
    state.dragging = false;
  });
  globalThis.addEventListener("pointerup", () => {
    state.dragging = false;
  });
  targetCanvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.distance = clamp(
        state.distance + event.deltaY * 0.004,
        state.minDistance,
        state.maxDistance,
      );
    },
    { passive: false },
  );

  return state;
}

function updateOrbitCamera(aperture, cameraEntity, orbit) {
  const x = orbit.target[0] + Math.sin(orbit.yaw) * orbit.distance;
  const y = orbit.target[1];
  const z = orbit.target[2] + Math.cos(orbit.yaw) * orbit.distance;
  const halfYaw = orbit.yaw * 0.5;

  cameraEntity
    .getVectorView(aperture.LocalTransform, "translation")
    .set([x, y, z]);
  cameraEntity
    .getVectorView(aperture.LocalTransform, "rotation")
    .set([0, Math.sin(halfYaw), 0, Math.cos(halfYaw)]);
}

function fitOrbitToReplayBounds(aperture, app, replay, orbit) {
  const bounds = computeReplayWorldBounds(aperture, app, replay);

  if (bounds === null) {
    orbit.fit = {
      status: "missing-bounds",
      center: roundTuple(orbit.target, 3),
      size: [0, 0, 0],
      distance: Number(orbit.distance.toFixed(3)),
      minDistance: Number(orbit.minDistance.toFixed(3)),
      maxDistance: Number(orbit.maxDistance.toFixed(3)),
    };
    return orbit.fit;
  }

  const center = [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ];
  const size = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const aspect = Math.max(1, (canvas?.width ?? 1) / (canvas?.height ?? 1));
  const fovY = Math.PI / 3;
  const fitOffset = 1.35;
  const fitHeightDistance = size[1] / (2 * Math.tan(fovY * 0.5));
  const fitWidthDistance = size[0] / (2 * Math.tan(fovY * 0.5) * aspect);
  const fitDepthDistance = size[2] * 1.2;
  const distance = Math.max(
    1.2,
    fitOffset * Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance),
  );

  orbit.target = center;
  orbit.distance = distance;
  orbit.minDistance = Math.max(0.25, distance * 0.25);
  orbit.maxDistance = Math.max(distance * 4, orbit.minDistance + 0.25);
  orbit.fit = {
    status: "ready",
    center: roundTuple(center, 3),
    size: roundTuple(size, 3),
    distance: Number(distance.toFixed(3)),
    minDistance: Number(orbit.minDistance.toFixed(3)),
    maxDistance: Number(orbit.maxDistance.toFixed(3)),
  };

  return orbit.fit;
}

function computeReplayWorldBounds(aperture, app, replay) {
  let bounds = null;

  for (const entity of replay.entitiesByKey.values()) {
    if (
      !entity.hasComponent(aperture.Mesh) ||
      !entity.hasComponent(aperture.WorldTransform)
    ) {
      continue;
    }

    const meshId = entity.getValue(aperture.Mesh, "meshId") ?? "";

    if (!meshId.startsWith("mesh:")) {
      continue;
    }

    const meshEntry = app.assets.get(
      aperture.createMeshHandle(meshId.slice(5)),
    );
    const mesh = meshEntry?.asset ?? null;

    if (meshEntry?.status !== "ready" || mesh?.localAabb === undefined) {
      continue;
    }

    const worldBounds = transformAabb(
      mesh.localAabb,
      readWorldMatrix(aperture, entity),
    );

    bounds = bounds === null ? worldBounds : unionAabb(bounds, worldBounds);
  }

  return bounds;
}

function readWorldMatrix(aperture, entity) {
  const matrix = new Float32Array(16);

  matrix.set(entity.getVectorView(aperture.WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(aperture.WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(aperture.WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(aperture.WorldTransform, "col3"), 12);
  return matrix;
}

function transformAabb(aabb, matrix) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const x of [aabb.min[0], aabb.max[0]]) {
    for (const y of [aabb.min[1], aabb.max[1]]) {
      for (const z of [aabb.min[2], aabb.max[2]]) {
        const tx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        const ty = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        const tz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];

        minX = Math.min(minX, tx);
        minY = Math.min(minY, ty);
        minZ = Math.min(minZ, tz);
        maxX = Math.max(maxX, tx);
        maxY = Math.max(maxY, ty);
        maxZ = Math.max(maxZ, tz);
      }
    }
  }

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function unionAabb(a, b) {
  return {
    min: [
      Math.min(a.min[0], b.min[0]),
      Math.min(a.min[1], b.min[1]),
      Math.min(a.min[2], b.min[2]),
    ],
    max: [
      Math.max(a.max[0], b.max[0]),
      Math.max(a.max[1], b.max[1]),
      Math.max(a.max[2], b.max[2]),
    ],
  };
}

function roundTuple(values, digits) {
  return values.map((value) => Number(value.toFixed(digits)));
}

function wrapRadians(value) {
  const twoPi = Math.PI * 2;
  return ((((value + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function integerOrNull(value) {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : null;
}

function integerOrZero(value) {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readInitialCustomUrl() {
  const rawUrl = exampleParams.get("url");

  if (rawUrl === null || rawUrl.trim().length === 0) {
    return null;
  }

  const url = new URL(rawUrl.trim(), globalThis.location.href);

  if (!url.pathname.toLowerCase().endsWith(".glb")) {
    return null;
  }

  return url;
}

function formatAssetUrl(url) {
  if (url.origin === globalThis.location.origin) {
    return url.pathname;
  }

  return url.href;
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return {
    example: "glb-viewer",
    ok: false,
    phase: "initialize",
    reason,
    message,
  };
}
