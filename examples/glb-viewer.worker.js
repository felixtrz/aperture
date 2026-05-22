/* eslint-disable no-unused-vars */
import {
  findSampleAssetById,
  getDefaultSampleAsset,
  sampleAssets,
} from "./glb-viewer-assets.js";

const document = globalThis.document ?? {
  querySelector() {
    return null;
  },
  createElement() {
    return {
      append() {},
      replaceChildren() {},
      addEventListener() {},
      setPointerCapture() {},
      releasePointerCapture() {},
    };
  },
};
const Element = globalThis.Element ?? class {};
const HTMLElement = globalThis.HTMLElement ?? class {};
const HTMLButtonElement = globalThis.HTMLButtonElement ?? class {};
const HTMLInputElement = globalThis.HTMLInputElement ?? class {};
const HTMLSelectElement = globalThis.HTMLSelectElement ?? class {};
const HTMLTextAreaElement = globalThis.HTMLTextAreaElement ?? class {};
const Option = globalThis.Option ?? class {};

const canvas = document.querySelector("#aperture-canvas");
const assetSelect = document.querySelector("#glb-asset-select");
const sceneSelectRow = document.querySelector("#glb-scene-select-row");
const sceneSelect = document.querySelector("#glb-scene-select");
const textureGalleryPreviousButton =
  document.querySelector("#glb-gallery-prev");
const textureGalleryNextButton = document.querySelector("#glb-gallery-next");
const customUrlForm = document.querySelector("#glb-url-form");
const customUrlInput = document.querySelector("#glb-url-input");
const cameraResetButton = document.querySelector("#glb-camera-reset");
const importedCameraSelect = document.querySelector(
  "#glb-imported-camera-select",
);
const importedCameraToggle = document.querySelector(
  "#glb-imported-camera-toggle",
);
const shadowReceiverToggle = document.querySelector(
  "#glb-shadow-receiver-toggle",
);
const shadowCasterToggle = document.querySelector("#glb-shadow-caster-toggle");
const iblToggle = document.querySelector("#glb-ibl-toggle");
const animationToggleButton = document.querySelector("#glb-animation-toggle");
const animationCrossFadeButton = document.querySelector(
  "#glb-animation-cross-fade",
);
const animationClipSelect = document.querySelector("#glb-animation-clip");
const animationLoopSelect = document.querySelector("#glb-animation-loop");
const animationDirectionSelect = document.querySelector(
  "#glb-animation-direction",
);
const animationScrubInput = document.querySelector("#glb-animation-scrub");
const animationSpeedInput = document.querySelector("#glb-animation-speed");
const morphWeight0Input = document.querySelector("#glb-morph-weight-0");
const morphWeight1Input = document.querySelector("#glb-morph-weight-1");
const pointLightIntensityInput = document.querySelector(
  "#glb-point-light-intensity",
);
const ambientIntensityInput = document.querySelector("#glb-ambient-intensity");
const importedLightToggle = document.querySelector(
  "#glb-imported-light-toggle",
);
const selectedAssetSummaryElement = document.querySelector(
  "#glb-selected-asset-summary",
);
const materialSlotSummaryElement = document.querySelector(
  "#glb-material-slot-summary",
);
const textureGallerySummaryElement = document.querySelector(
  "#glb-texture-gallery-summary",
);
const imageDecodeSummaryElement = document.querySelector(
  "#glb-image-decode-summary",
);
const unsupportedFeatureSummaryElement = document.querySelector(
  "#glb-unsupported-feature-summary",
);
const animationSummaryElement = document.querySelector(
  "#glb-animation-summary",
);
const animationClipSummaryElement = document.querySelector(
  "#glb-animation-clip-summary",
);
const animationNodeSummaryElement = document.querySelector(
  "#glb-animation-node-summary",
);
const animationChannelSummaryElement = document.querySelector(
  "#glb-animation-channel-summary",
);
const morphSummaryElement = document.querySelector("#glb-morph-summary");
const importedCameraSummaryElement = document.querySelector(
  "#glb-imported-camera-summary",
);
const importedCameraListSummaryElement = document.querySelector(
  "#glb-imported-camera-list-summary",
);
const lightSummaryElement = document.querySelector("#glb-light-summary");
const metadataSummaryElement = document.querySelector("#glb-metadata-summary");
const sceneSummaryElement = document.querySelector("#glb-scene-summary");
const orbitSummaryElement = document.querySelector("#glb-orbit-summary");
const shadowSummaryElement = document.querySelector("#glb-shadow-summary");
const shadowRequestSummaryElement = document.querySelector(
  "#glb-shadow-request-summary",
);
const iblSummaryElement = document.querySelector("#glb-ibl-summary");
const iblResourceSummaryElement = document.querySelector(
  "#glb-ibl-resource-summary",
);
const drawSummaryElement = document.querySelector("#glb-draw-summary");
const renderStateSummaryElement = document.querySelector(
  "#glb-render-state-summary",
);
const pipelineTokenSummaryElement = document.querySelector(
  "#glb-pipeline-token-summary",
);
const meshDrawSummaryElement = document.querySelector("#glb-mesh-draw-summary");
const preparedResourceReuseSummaryElement = document.querySelector(
  "#glb-prepared-resource-reuse-summary",
);
const renderDiagnosticSummaryElement = document.querySelector(
  "#glb-render-diagnostic-summary",
);
const extractionDiagnosticSummaryElement = document.querySelector(
  "#glb-extraction-diagnostic-summary",
);
const importedLightSummaryElement = document.querySelector(
  "#glb-imported-light-summary",
);
const importedLightListSummaryElement = document.querySelector(
  "#glb-imported-light-list-summary",
);
const primitiveMaterialSummaryElement = document.querySelector(
  "#glb-primitive-material-summary",
);
const materialFactorSummaryElement = document.querySelector(
  "#glb-material-factor-summary",
);
const materialAlphaSummaryElement = document.querySelector(
  "#glb-material-alpha-summary",
);
const primitiveTextureSlotSummaryElement = document.querySelector(
  "#glb-primitive-texture-slot-summary",
);
const textureHandleSummaryElement = document.querySelector(
  "#glb-texture-handle-summary",
);
const textureSamplerSummaryElement = document.querySelector(
  "#glb-texture-sampler-summary",
);
const textureTransformSummaryElement = document.querySelector(
  "#glb-texture-transform-summary",
);
const sourceLoaderSummaryElement = document.querySelector(
  "#glb-source-loader-summary",
);
const sourceOutputSummaryElement = document.querySelector(
  "#glb-source-output-summary",
);
const hierarchySummaryElement = document.querySelector(
  "#glb-hierarchy-summary",
);
const replayStageSummaryElement = document.querySelector(
  "#glb-replay-stage-summary",
);
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const exampleParams = new URLSearchParams(globalThis.location.search);
const clearColor = [0.015, 0.025, 0.035, 1];
const lightingControlDefaults = {
  ambientIntensity: 0.24,
  pointIntensity: 18,
};
const enableIblSampling = !exampleParams.has("disable-ibl-sampling");
const enableSpecularIblSampling = !exampleParams.has(
  "disable-specular-ibl-sampling",
);
const shadowControls = {
  receiverEnabled: !exampleParams.has("disable-shadow-receiver"),
  casterEnabled: !exampleParams.has("disable-shadow-caster"),
};
const iblControls = {
  enabled: enableIblSampling,
};
const enableImportedLights = !exampleParams.has("disable-imported-lights");
const importedLightControls = {
  enabled: enableImportedLights,
};
const shadowIntent = {
  mapSize: 512,
  depthBias: 0.0015,
  normalBias: 0.01,
};
const supportedMetadataExtensions = new Set([
  "KHR_materials_unlit",
  "KHR_texture_transform",
  "KHR_lights_punctual",
  "KHR_texture_basisu",
  "KHR_draco_mesh_compression",
  "EXT_meshopt_compression",
  "KHR_meshopt_compression",
]);
let basisKtx2TranscoderPromise = null;
let dracoMeshDecoderPromise = null;
let meshoptDecoderPromise = null;
let shadowDepthTextureResourceReport = null;
const realUriTextureGalleryAssetIds = [
  "all-slot-uri-textures",
  "alpha-mask-emissive-controls",
  "normal-occlusion-controls",
  "sampler-wrap-controls",
  "uv1-image-decode-controls",
];
const realUriTextureGalleryAssets = realUriTextureGalleryAssetIds
  .map((assetId) => findSampleAssetById(assetId))
  .filter((asset) => asset !== null);
const selectedAssetSummaryRows = [
  {
    key: "source",
    label: "source",
    value: (asset) => formatSummaryOptionalKey(asset.source),
  },
  {
    key: "loading",
    label: "loading",
    value: (asset) => String(asset.loading),
  },
  {
    key: "url",
    label: "url",
    value: (asset) => formatSummaryOptionalKey(asset.url),
  },
  {
    key: "materials",
    label: "materials",
    value: (asset) => formatMaterialFamilySummary(asset.materialFamilies),
  },
];
const materialSlotSummaryRows = [
  {
    key: "materials",
    label: "materials",
    value: (summary) =>
      `${summary.materialCount} total, ${summary.scalarOnlyMaterialCount} scalar`,
  },
  {
    key: "baseColorTexture",
    label: "base color",
    value: (summary) => formatTextureSlotSummary(summary, "baseColorTexture"),
  },
  {
    key: "metallicRoughnessTexture",
    label: "metal rough",
    value: (summary) =>
      formatTextureSlotSummary(summary, "metallicRoughnessTexture"),
  },
  {
    key: "normalTexture",
    label: "normal",
    value: (summary) => formatTextureSlotSummary(summary, "normalTexture"),
  },
  {
    key: "occlusionTexture",
    label: "occlusion",
    value: (summary) => formatTextureSlotSummary(summary, "occlusionTexture"),
  },
  {
    key: "emissiveTexture",
    label: "emissive",
    value: (summary) => formatTextureSlotSummary(summary, "emissiveTexture"),
  },
  {
    key: "alphaModes",
    label: "alpha",
    value: (summary) =>
      `opaque ${summary.alphaModes.opaque}, mask ${summary.alphaModes.mask}, blend ${summary.alphaModes.blend}`,
  },
  {
    key: "uv1Usage",
    label: "uv1",
    value: (summary) =>
      `materials ${summary.uv1Usage.materials}, slots ${summary.uv1Usage.textureSlots}`,
  },
];
const textureGallerySummaryRows = [
  {
    key: "state",
    label: "gallery",
    value: (gallery) => `active ${gallery.active}, count ${gallery.count}`,
  },
  {
    key: "position",
    label: "position",
    value: (gallery) =>
      `index ${formatSummaryOptionalKey(gallery.activeIndex)} / ${
        gallery.count
      }`,
  },
  {
    key: "asset",
    label: "asset",
    value: (gallery) => formatSummaryOptionalKey(gallery.activeAssetId),
  },
  {
    key: "samples",
    label: "samples",
    value: (gallery) => `${arrayEntries(gallery.sampleIds).length} available`,
  },
];
const animationSummaryRows = [
  {
    key: "clip",
    label: "clip",
    value: (animation) => animation.activeClipName ?? "none",
  },
  {
    key: "mode",
    label: "mode",
    value: (animation) =>
      `${animation.status}, ${animation.loopMode}, ${animation.direction}`,
  },
  {
    key: "time",
    label: "time",
    value: (animation) =>
      `${Number(animation.time.toFixed(3))} / ${animation.duration}`,
  },
  {
    key: "speed",
    label: "speed",
    value: (animation) => String(animation.speed),
  },
  {
    key: "channels",
    label: "channels",
    value: (animation) =>
      `${animation.channelCount} channels, ${animation.clipCount} clips`,
  },
];
const animationClipSummaryRows = [
  {
    key: (clip, index) => String(clip.index ?? index),
    label: (clip, index) => `clip ${clip.index ?? index}`,
    value: (clip, index) =>
      `#${clip.index ?? index}, ${formatSummaryOptionalKey(
        clip.name,
      )}, ${formatAnimationClipDuration(clip.duration)}s`,
  },
];
const morphSummaryRows = [
  {
    key: "status",
    label: "status",
    value: (morphing) => morphing.status,
  },
  {
    key: "targets",
    label: "targets",
    value: (morphing) =>
      `${morphing.targetCount} targets, ${morphing.morphedEntities} entities`,
  },
  {
    key: "weights",
    label: "weights",
    value: (morphing) => formatSummaryTuple(morphing.weights),
  },
];
const importedCameraSummaryRows = [
  {
    key: "camera",
    label: "camera",
    value: (importedCamera) =>
      importedCamera.selected.name ??
      importedCamera.selected.cameraName ??
      `camera ${importedCamera.selected.cameraIndex}`,
  },
  {
    key: "state",
    label: "state",
    value: (importedCamera) =>
      importedCamera.controls.enabled ? "imported" : "orbit",
  },
  {
    key: "fov",
    label: "fov/height",
    value: (importedCamera) =>
      importedCamera.selected.projection === "orthographic"
        ? String(importedCamera.selected.orthographicHeight)
        : String(importedCamera.selected.yfov),
  },
  {
    key: "range",
    label: "range",
    value: (importedCamera) =>
      `${importedCamera.selected.near} - ${importedCamera.selected.far}`,
  },
  {
    key: "aspect",
    label: "aspect",
    value: (importedCamera) =>
      String(Number((importedCamera.selected.aspect ?? 0).toFixed(3))),
  },
];
const lightingSummaryRows = [
  {
    key: "ambient",
    label: "ambient",
    value: ({ lighting }) =>
      `control ${lighting.controls.ambientIntensity}, ecs ${lighting.ecs.ambientIntensity}, extracted ${formatOptionalLightIntensity(
        lighting.extracted.ambientIntensity,
      )}`,
  },
  {
    key: "point",
    label: "point",
    value: ({ lighting }) =>
      `control ${lighting.controls.pointIntensity}, ecs ${lighting.ecs.pointIntensity}, extracted ${formatOptionalLightIntensity(
        lighting.extracted.pointIntensity,
      )}`,
  },
  {
    key: "lights",
    label: "lights",
    value: ({ extraction }) => `${extraction?.lights ?? 0} extracted`,
  },
];
const metadataSummaryRows = [
  {
    key: "scene",
    label: "scene",
    value: (metadata) =>
      `${metadata.counts.scenes} scenes, ${metadata.counts.nodes} nodes`,
  },
  {
    key: "mesh",
    label: "mesh",
    value: (metadata) =>
      `${metadata.counts.meshes} meshes, ${metadata.counts.primitives} primitives`,
  },
  {
    key: "material",
    label: "material",
    value: (metadata) => `${metadata.counts.materials} materials`,
  },
  {
    key: "animation",
    label: "animation",
    value: (metadata) => `${metadata.counts.animations} animations`,
  },
  {
    key: "extensions",
    label: "extensions",
    value: (metadata) =>
      `used ${metadata.extensions.used.length}, required ${metadata.extensions.required.length}`,
  },
];
const sceneSummaryRows = [
  {
    key: "default",
    label: "default",
    value: (scene) => formatSummaryOptionalKey(scene.defaultSceneIndex),
  },
  {
    key: "selected",
    label: "selected",
    value: (scene) =>
      formatSummaryOptionalKey(selectedSceneStatus(scene)?.sceneIndex),
  },
  {
    key: "roots",
    label: "roots",
    value: (scene) =>
      `${arrayEntries(selectedSceneStatus(scene)?.rootNodeIndices).length} roots`,
  },
  {
    key: "firstRoot",
    label: "first root",
    value: (scene) =>
      formatSummaryOptionalKey(
        arrayEntries(selectedSceneStatus(scene)?.rootNodeIndices)[0],
      ),
  },
];
const orbitSummaryRows = [
  {
    key: "status",
    label: "fit",
    value: (orbit) => orbit.fit.status,
  },
  {
    key: "center",
    label: "center",
    value: (orbit) => formatSummaryTuple(orbit.fit.center),
  },
  {
    key: "size",
    label: "size",
    value: (orbit) => formatSummaryTuple(orbit.fit.size),
  },
  {
    key: "distance",
    label: "distance",
    value: (orbit) => String(orbit.distance),
  },
  {
    key: "zoom",
    label: "zoom",
    value: (orbit) => `${orbit.fit.minDistance} - ${orbit.fit.maxDistance}`,
  },
];
const shadowSummaryRows = [
  {
    key: "controls",
    label: "controls",
    value: (shadow) =>
      `receiver ${shadow.controls.receiverEnabled}, caster ${shadow.controls.casterEnabled}`,
  },
  {
    key: "ecs",
    label: "ecs",
    value: (shadow) =>
      `receiver ${shadow.ecs.receiverEnabled}, caster ${shadow.ecs.casterEnabled}`,
  },
  {
    key: "authoring",
    label: "authoring",
    value: (shadow) =>
      `${shadow.authoring.casterCount} casters, ${shadow.authoring.receiverCount} receivers`,
  },
  {
    key: "drawList",
    label: "draw list",
    value: (shadow) =>
      isRecord(shadow.casterDrawList)
        ? `${shadow.casterDrawList.includedDrawCount} included, ${shadow.casterDrawList.skippedDrawCount} skipped`
        : "none",
  },
  {
    key: "rendering",
    label: "rendering",
    value: (shadow) =>
      `supported ${shadow.rendering.supported}, ${shadow.rendering.mode}`,
  },
  {
    key: "submission",
    label: "submit",
    value: (shadow) =>
      isRecord(shadow.commandBufferSubmission)
        ? shadow.commandBufferSubmission.status
        : "none",
  },
];
const iblSummaryRows = [
  {
    key: "controls",
    label: "controls",
    value: (ibl) =>
      `enabled ${ibl.controls.enabled}, available ${ibl.controls.available}`,
  },
  {
    key: "environment",
    label: "environment",
    value: (ibl) =>
      `${formatSummaryOptionalKey(
        ibl.ecs.environmentMapKey,
      )}, intensity ${formatSummaryOptionalKey(ibl.ecs.intensity)}`,
  },
  {
    key: "resources",
    label: "resources",
    value: (ibl) =>
      `diffuse ${formatSummaryOptionalKey(
        ibl.resources.diffuseTexture,
      )}, specular ${formatSummaryOptionalKey(
        ibl.resources.specularTexture,
      )}, sampler ${formatSummaryOptionalKey(ibl.resources.sampler)}`,
  },
  {
    key: "rendering",
    label: "rendering",
    value: (ibl) =>
      `supported ${ibl.rendering.supported}, specular ${ibl.specularProof}`,
  },
  {
    key: "pipelines",
    label: "pipelines",
    value: (ibl) =>
      `diffuse ${formatIblPipelineToken(
        ibl.rendering.diffusePipelineKey,
        "iblDiffuse",
      )}, specular ${formatIblPipelineToken(
        ibl.rendering.specularPipelineKey,
        "iblSpecularProof",
      )}`,
  },
];
const iblResourceSummaryRows = [
  {
    key: "state",
    label: "state",
    value: (ibl) =>
      `enabled ${ibl.enabled}, key ${formatSummaryOptionalKey(
        ibl.environmentMapKey,
      )}`,
  },
  {
    key: "diffuse",
    label: "diffuse",
    value: (ibl) => formatSummaryOptionalKey(ibl.resources.diffuseTexture),
  },
  {
    key: "specular",
    label: "specular",
    value: (ibl) => formatSummaryOptionalKey(ibl.resources.specularTexture),
  },
  {
    key: "sampler",
    label: "sampler",
    value: (ibl) => formatSummaryOptionalKey(ibl.resources.sampler),
  },
  {
    key: "pipelines",
    label: "pipelines",
    value: (ibl) =>
      arrayEntries(ibl.rendering.pipelineKeys).join(" | ") || "none",
  },
];
const drawSummaryRows = [
  {
    key: "extraction",
    label: "extraction",
    value: ({ extraction }) =>
      `${extraction.views} views, ${extraction.meshDraws} draws, ${extraction.lights} lights, ${extraction.environments} envs`,
  },
  {
    key: "draw",
    label: "draw",
    value: ({ draw }) => `${draw.packages} packages, ${draw.drawCalls} calls`,
  },
  {
    key: "materials",
    label: "materials",
    value: ({ selectedAsset }) =>
      formatMaterialFamilySummary(selectedAsset.materialFamilies),
  },
  {
    key: "queues",
    label: "queues",
    value: ({ renderState }) => formatCountSummary(renderState.queues),
  },
  {
    key: "pipelines",
    label: "pipelines",
    value: ({ renderState }) =>
      formatPipelineKeySummary(renderState.pipelineKeys),
  },
];
const renderStateSummaryRows = [
  {
    key: "queues",
    label: "queues",
    value: (renderState) => formatCountSummary(renderState.queues),
  },
  {
    key: "pipelineCount",
    label: "pipelines",
    value: (renderState) =>
      `${uniquePipelineKeys(renderState.pipelineKeys).length} unique`,
  },
  {
    key: "pipelineKeys",
    label: "keys",
    value: (renderState) =>
      uniquePipelineKeys(renderState.pipelineKeys).join(" | ") || "none",
  },
];
const importedLightSummaryRows = [
  {
    key: "controls",
    label: "controls",
    value: ({ importedLights }) =>
      `enabled ${importedLights.enabled}, available ${
        importedLights.declaredCount > 0
      }`,
  },
  {
    key: "counts",
    label: "counts",
    value: ({ importedLights }) =>
      `declared ${importedLights.declaredCount}, replayed ${importedLights.replayedCount}, extracted ${importedLights.extractedCount}`,
  },
  {
    key: "kinds",
    label: "kinds",
    value: ({ importedLights }) => formatImportedLightKinds(importedLights),
  },
  {
    key: "first",
    label: "first",
    value: ({ importedLights }) =>
      formatImportedLightDescriptor(importedLights.lights[0]),
  },
];
const sourceLoaderSummaryRows = [
  {
    key: "kind",
    label: "source",
    value: (source) => formatSourceKind(source),
  },
  {
    key: "bytes",
    label: "bytes",
    value: (source) => formatSourceByteLength(source),
  },
  {
    key: "loader",
    label: "loader",
    value: (source) => formatLoaderStatus(source),
  },
  {
    key: "imageDiagnostics",
    label: "image diag",
    value: (source) =>
      String(arrayEntries(source.imageDecode?.diagnostics).length),
  },
  {
    key: "sourceDiagnostics",
    label: "source diag",
    value: (source) => String(arrayEntries(source.diagnostics).length),
  },
];
const sourceOutputSummaryRows = [
  {
    key: "meshConstruction",
    label: "mesh",
    value: (summary) =>
      `${summary.meshConstruction.status}, meshes ${summary.meshConstruction.meshCount}, submeshes ${summary.meshConstruction.submeshCount}`,
  },
  {
    key: "sourceRegistration",
    label: "registration",
    value: (summary) =>
      `${summary.sourceRegistration.status}, written ${summary.sourceRegistration.writtenCount}, skipped ${summary.sourceRegistration.skippedCount}, diagnostics ${summary.sourceRegistration.diagnosticsCount}`,
  },
  {
    key: "commandPlan",
    label: "commands",
    value: (summary) =>
      `${summary.ecsCommandPlan.status}, commands ${summary.ecsCommandPlan.commandCount}, deps ${summary.ecsCommandPlan.dependencyCount}`,
  },
  {
    key: "replayReadiness",
    label: "readiness",
    value: (summary) =>
      `${summary.ecsReplayReadiness.status}, creates ${summary.ecsReplayReadiness.expectedCreateEntityCount}, adds ${summary.ecsReplayReadiness.expectedAddComponentCount}`,
  },
];
const hierarchySummaryRows = [
  {
    key: "nodes",
    label: "nodes",
    value: (hierarchy) => `${arrayEntries(hierarchy.nodes).length} replayed`,
  },
  {
    key: "parented",
    label: "parented",
    value: (hierarchy) =>
      `${hierarchyChildNodes(hierarchy).length} node${
        hierarchyChildNodes(hierarchy).length === 1 ? "" : "s"
      }`,
  },
  {
    key: "firstChild",
    label: "first child",
    value: (hierarchy) => formatFirstHierarchyChild(hierarchy),
  },
];
const replayStageSummaryRows = [
  {
    key: "registration",
    label: "registration",
    value: ({ registration }) =>
      `valid ${registration.valid}, diagnostics ${registration.diagnostics}`,
  },
  {
    key: "commandPlan",
    label: "command plan",
    value: ({ commandPlan }) =>
      `valid ${commandPlan.valid}, commands ${commandPlan.commands}, deps ${commandPlan.dependencies}`,
  },
  {
    key: "replay",
    label: "replay",
    value: ({ replay }) =>
      `valid ${replay.valid}, created ${replay.created}, diagnostics ${replay.diagnostics}`,
  },
];

try {
  startGlbViewerWorker();
} catch (error) {
  self.postMessage({
    type: "error",
    reason: "glb-viewer-worker-start-failed",
    message: error instanceof Error ? error.message : "GLB viewer failed.",
  });
}

let apertureModulePromise = null;
let workerScene = null;

function startGlbViewerWorker() {
  self.addEventListener("error", (event) => {
    self.postMessage({
      type: "error",
      reason: "worker-runtime-error",
      message: event.message || "The GLB viewer worker raised an error.",
      location: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
    event.preventDefault();
  });
  self.addEventListener("unhandledrejection", (event) => {
    self.postMessage({
      type: "error",
      reason: "worker-unhandled-rejection",
      message: messageFromError(event.reason),
    });
    event.preventDefault();
  });
  self.onmessage = (event) => {
    void handleGlbWorkerMessage(event.data);
  };
}

async function handleGlbWorkerMessage(data) {
  try {
    const aperture = await loadAperture();

    if (data?.type === "init") {
      const app = aperture.createExtractionApp({
        worldOptions: { entityCapacity: 256 },
      });
      const workerCanvas = createWorkerCanvas(data.canvas);

      workerScene = createGlbViewerScene(aperture, app, workerCanvas);
      workerScene.app = app;
      workerScene.cameraControls.bootstrap =
        data.initial?.importedCamera ?? workerScene.cameraControls.bootstrap;
      workerScene.sampleSelection =
        data.initial?.sampleSelection ?? workerScene.sampleSelection;
      await loadAsset(
        aperture,
        app,
        workerScene,
        deserializeViewerAsset(data.initial?.asset),
        {
          keyPrefix: data.initial?.keyPrefix,
          sceneIndex: data.initial?.sceneIndex,
        },
      );
      self.postMessage({
        type: "ready",
        scene: {
          assetId: workerScene.asset.id,
          keyPrefix: workerScene.active?.keyPrefix ?? null,
        },
      });
      return;
    }

    if (data?.type === "load-asset") {
      assertWorkerScene();
      await loadAsset(
        aperture,
        workerScene.app,
        workerScene,
        deserializeViewerAsset(data.asset),
        {
          keyPrefix: data.keyPrefix,
          sceneIndex: data.sceneIndex,
        },
      );
      workerScene.sampleSelection =
        data.sampleSelection ?? workerScene.sampleSelection;
      return;
    }

    if (data?.type === "command") {
      assertWorkerScene();
      handleGlbWorkerCommand(aperture, workerScene, data);
      return;
    }

    if (data?.type === "frame") {
      assertWorkerScene();
      const snapshotMessage = createGlbWorkerSnapshotMessage(
        aperture,
        workerScene,
        data,
      );
      self.postMessage(
        snapshotMessage,
        aperture.renderSnapshotTransferList(snapshotMessage.snapshot),
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-frame-failed",
      message: messageFromError(error),
    });
  }
}

function loadAperture() {
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function assertWorkerScene() {
  if (workerScene === null) {
    throw new Error("GLB viewer worker scene has not been initialized.");
  }
}

function createWorkerCanvas(size) {
  return {
    width: Number.isFinite(size?.width) ? size.width : 1280,
    height: Number.isFinite(size?.height) ? size.height : 720,
    addEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
  };
}

function deserializeViewerAsset(asset) {
  if (!isRecord(asset)) {
    return getDefaultSampleAsset();
  }

  return {
    id: typeof asset.id === "string" ? asset.id : "cube",
    label: typeof asset.label === "string" ? asset.label : "Mint cube",
    url: new URL(
      typeof asset.url === "string"
        ? asset.url
        : getDefaultSampleAsset().url.href,
      globalThis.location.href,
    ),
    source: asset.source === "custom" ? "custom" : "sample",
    ...(asset.format === undefined ? {} : { format: asset.format }),
  };
}

function handleGlbWorkerCommand(aperture, scene, data) {
  switch (data.command) {
    case "camera-reset":
      scene.cameraControls.importedEnabled = false;
      resetOrbitToFit(scene.orbit);
      updateViewerCamera(aperture, scene);
      return;
    case "imported-camera-select":
      selectImportedCameraByIndex(aperture, scene, data.value);
      return;
    case "imported-camera-toggle":
      scene.cameraControls.importedEnabled =
        data.value === true && scene.active?.importedCamera?.selected !== null;
      updateViewerCamera(aperture, scene);
      return;
    case "shadow-receiver":
      setSceneShadowReceiverEnabled(aperture, scene, data.value === true);
      return;
    case "shadow-caster":
      setSceneShadowCasterEnabled(aperture, scene, data.value === true);
      return;
    case "ibl":
      setSceneIblEnabled(aperture, scene, data.value === true);
      return;
    case "animation-clip":
      selectActiveAnimationClip(aperture, scene, data.value);
      return;
    case "animation-toggle":
      toggleActiveAnimationPlayback(aperture, scene);
      return;
    case "animation-cross-fade":
      startActiveAnimationCrossFade(aperture, scene);
      return;
    case "animation-loop":
      setActiveAnimationLoopMode(aperture, scene, data.value);
      return;
    case "animation-direction":
      setActiveAnimationDirection(aperture, scene, data.value);
      return;
    case "animation-scrub":
      scrubActiveAnimation(aperture, scene, Number(data.value));
      return;
    case "animation-speed":
      setActiveAnimationSpeed(aperture, scene, Number(data.value));
      return;
    case "morph-weight-0":
      setSceneMorphWeight(aperture, scene, 0, Number(data.value));
      return;
    case "morph-weight-1":
      setSceneMorphWeight(aperture, scene, 1, Number(data.value));
      return;
    case "imported-light":
      setSceneImportedLightsEnabled(aperture, scene, data.value === true);
      return;
    case "point-light-intensity":
      setScenePointLightIntensity(aperture, scene, Number(data.value));
      return;
    case "ambient-intensity":
      setSceneAmbientIntensity(aperture, scene, Number(data.value));
      return;
    case "orbit-start":
      scene.orbit.dragging = true;
      return;
    case "orbit-drag":
      scene.orbit.yaw = wrapRadians(
        scene.orbit.yaw - finiteNumber(data.value, 0) * 0.006,
      );
      return;
    case "orbit-end":
      scene.orbit.dragging = false;
      return;
    case "orbit-zoom":
      scene.orbit.distance = clamp(
        scene.orbit.distance + finiteNumber(data.value, 0) * 0.004,
        scene.orbit.minDistance,
        scene.orbit.maxDistance,
      );
      return;
    default:
      return;
  }
}

function selectImportedCameraByIndex(aperture, scene, value) {
  const cameraIndex = integerOrNull(Number(value));
  const importedCamera = scene.active?.importedCamera ?? null;
  const selected =
    cameraIndex === null || importedCamera === null
      ? null
      : (importedCamera.cameras.find(
          (camera) =>
            camera.status === "ready" && camera.cameraIndex === cameraIndex,
        ) ?? null);

  if (selected === null || importedCamera === null) {
    return;
  }

  importedCamera.selected = selected;
  updateViewerCamera(aperture, scene);
}

function createGlbWorkerSnapshotMessage(aperture, scene, data) {
  const frame = finiteInteger(data.frame, 0);
  const elapsedSeconds = finiteNumber(data.timestamp, frame * 1000) / 1000;

  updateActiveAnimation(aperture, scene.active?.animation ?? null, frame / 60);
  updateProceduralSkinningAnimation(
    aperture,
    scene.active?.skinning ?? null,
    frame / 60,
  );
  updateViewerCamera(aperture, scene);
  const step = scene.app.step(0, frame / 60);
  updateSkinningPalettesFromWorld(aperture, scene.active?.skinning ?? null);
  const snapshot = scene.app.extract(frame);
  const status = createWorkerFrameStatus(
    aperture,
    scene,
    step,
    snapshot,
    frame,
  );

  return {
    type: "snapshot",
    frame,
    snapshot,
    status,
    animation: status.animation,
    workerStep: {
      elapsedSeconds: Number(elapsedSeconds.toFixed(4)),
      transformDiagnostics: snapshot.diagnostics.length,
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
    },
  };
}

function createWorkerFrameStatus(aperture, scene, step, snapshot, frame) {
  const active = scene.active;

  return {
    example: "glb-viewer",
    ok: true,
    phase: "extract",
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
      materialFamilies: createMaterialFamilyStatus(aperture, scene.app, active),
      materialSlotSummary: createMaterialSlotSummary(
        aperture,
        scene.app,
        active,
      ),
    },
    selection: {
      ...scene.sampleSelection,
      activeAssetId: scene.asset.id,
    },
    assetRegistry: createAssetRegistryStatus(scene.app, active),
    textureGallery: createRealUriTextureGalleryStatus(scene),
    source: {
      url: formatAssetUrl(active?.asset.url ?? scene.asset.url),
      ok: active?.loaded.ok ?? false,
      byteLength: active?.loaded.byteLength ?? null,
      status: active?.loaded.loader?.status ?? null,
      outputSummary: active?.loaded.loader?.outputSummary ?? null,
      imageDecode: active?.loaded.imageDecode ?? emptyImageDecodeStatus(),
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
        families: createMaterialFamilyStatus(aperture, scene.app, active),
        resolutions: createPrimitiveMaterialResolutionStatus(
          aperture,
          scene.app,
          active,
        ),
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
      metadata: createGltfMetadataStatus(active),
      meshAttributes: createGltfMeshAttributeStatus(active),
    },
    orbit: {
      yaw: Number(scene.orbit.yaw.toFixed(4)),
      elevation: Number(scene.orbit.elevation.toFixed(4)),
      distance: Number(scene.orbit.distance.toFixed(3)),
      target: roundTuple(scene.orbit.target, 3),
      fit: scene.orbit.fit,
      resetAvailable: scene.orbit.fit.status === "ready",
      dragging: scene.orbit.dragging,
    },
    importedCamera: createImportedCameraStatus(scene),
    importedLights: createImportedLightsStatus(scene, snapshot),
    lighting: createLightingControlStatus(aperture, scene, snapshot),
    animation: createAnimationStatus(active?.animation ?? null),
    skinning: createSkinningStatus(active?.skinning ?? null),
    morphing: createMorphingStatus(active?.morphing ?? null),
    hierarchy: createHierarchyStatus(aperture, active),
    extraction: {
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      environments: snapshot.environments.length,
      shadowRequests: snapshot.shadowRequests.length,
      diagnostics: snapshot.diagnostics.length,
      diagnosticsList: renderDiagnosticsStatus(snapshot.diagnostics),
    },
    ibl: createWorkerIblStatus(aperture, active),
    shadow: createWorkerShadowStatus(aperture, active, snapshot.meshDraws),
    renderState: createRenderStateStatus(aperture, snapshot.meshDraws),
    draw: {
      packages: 0,
      drawCalls: 0,
    },
    step,
    canvas: {
      width: scene.targetCanvas.width,
      height: scene.targetCanvas.height,
    },
  };
}

function createWorkerIblStatus(aperture, active) {
  const iblScene = active?.iblScene ?? null;

  return {
    enabled:
      iblScene?.iblAvailable === true && iblScene.iblControls.enabled === true,
    controls: {
      enabled: iblScene?.iblControls.enabled ?? iblControls.enabled,
      available: iblScene?.iblAvailable === true,
    },
    ecs: createIblEcsStatus(aperture, iblScene),
    specularProof:
      iblScene?.specularIblAvailable === true &&
      iblScene.iblControls.enabled === true,
    environmentMapKey: iblScene?.environmentMapKey ?? null,
    resources: {
      diffuseTexture: null,
      specularTexture: null,
      sampler: null,
    },
    rendering: {
      supported: false,
      diffusePipelineKey: null,
      specularPipelineKey: null,
      pipelineKeys: [],
    },
  };
}

function createWorkerShadowStatus(aperture, active, meshDraws) {
  const shadowScene = active?.shadowScene ?? null;

  if (shadowScene === null) {
    return {
      enabled: false,
      controls: {
        receiverEnabled: shadowControls.receiverEnabled,
        casterEnabled: shadowControls.casterEnabled,
      },
      ecs: {
        casterEnabled: null,
        receiverEnabled: null,
        casterEntityCount: 0,
        receiverEntityCount: 0,
        enabledCasterEntityCount: 0,
        enabledReceiverEntityCount: 0,
      },
      authoring: createShadowAuthoringStatus(meshDraws),
      requests: [],
      rendering: {
        supported: false,
        mode: "absent",
        pipelineKey: null,
      },
    };
  }

  return {
    enabled: true,
    controls: {
      receiverEnabled: shadowScene.controls.receiverEnabled,
      casterEnabled: shadowScene.controls.casterEnabled,
    },
    ecs: createShadowEcsStatus(aperture, shadowScene),
    floor: {
      meshKey: shadowScene.floorMeshKey,
      materialKey: shadowScene.floorMaterialKey,
    },
    authoring: createShadowAuthoringStatus(meshDraws),
    requests: [],
    casterDrawList: null,
    commandBufferSubmission: null,
    rendering: {
      supported: false,
      mode: "directional-depth-compare",
      filter: "pcf-3x3",
      pipelineKey: null,
    },
  };
}

function createGlbViewerScene(aperture, app, targetCanvas) {
  const orbit = createOrbitControls(targetCanvas);
  const initialCustomUrl = readInitialCustomUrl();
  const initialSampleSelection = readInitialSampleSelection();
  const initialImportedCameraControls = readInitialImportedCameraControls();
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
  const ambientLightEntity = app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.48, 0.52, 0.58, 1],
      intensity: lightingControlDefaults.ambientIntensity,
      layerMask: 1,
    }),
  );
  const pointLightEntity = app.spawn(
    aperture.withTransform({ translation: [0.2, 1.2, 3.4] }),
    aperture.withLight({
      kind: aperture.LightKind.Point,
      color: [1, 0.92, 0.76, 1],
      intensity: lightingControlDefaults.pointIntensity,
      range: 8,
      layerMask: 1,
    }),
  );
  const lightControls = {
    ambientIntensity: lightingControlDefaults.ambientIntensity,
    pointIntensity: lightingControlDefaults.pointIntensity,
  };

  const scene = {
    asset: initialSampleSelection.asset,
    loadState: null,
    loadSequence: 0,
    initialCustomUrl,
    sampleSelection: initialSampleSelection.status,
    active: null,
    targetCanvas,
    orbit,
    cameraControls: {
      importedEnabled: false,
      bootstrap: initialImportedCameraControls,
    },
    cameraEntity,
    ambientLightEntity,
    pointLightEntity,
    lightControls,
  };

  setCameraResetEnabled(false);
  updateSceneSelectControl(scene);

  if (assetSelect !== null) {
    for (const asset of sampleAssets) {
      const option = document.createElement("option");
      option.value = asset.id;
      option.textContent = asset.label;
      assetSelect.append(option);
    }

    assetSelect.value = initialSampleSelection.asset.id;
    assetSelect.addEventListener("change", () => {
      loadSelectedAsset(aperture, app, scene).catch((error) => {
        scene.loadState = failure(
          "glb-viewer-load-failed",
          error instanceof Error ? error.message : "GLB asset load failed.",
        );
      });
    });
  }

  if (sceneSelect instanceof HTMLSelectElement) {
    sceneSelect.addEventListener("change", () => {
      loadSelectedScene(aperture, app, scene).catch((error) => {
        scene.loadState = failure(
          "glb-viewer-scene-load-failed",
          error instanceof Error ? error.message : "GLB scene load failed.",
        );
      });
    });
  }

  bindRealUriTextureGalleryKeyboard(aperture, app, scene);
  bindRealUriTextureGalleryButtons(aperture, app, scene);

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

  if (cameraResetButton instanceof HTMLButtonElement) {
    cameraResetButton.addEventListener("click", () => {
      scene.cameraControls.importedEnabled = false;
      resetOrbitToFit(scene.orbit);
      updateImportedCameraControlInputs(scene);
      updateViewerCamera(aperture, scene);
    });
  }

  bindImportedCameraControlInputs(aperture, scene);
  bindShadowControlInputs(aperture, scene);
  bindIblControlInputs(aperture, scene);
  bindAnimationControlInputs(aperture, scene);
  bindImportedLightControlInputs(aperture, scene);
  bindLightControlInputs(aperture, scene);
  updateShadowControlInputs(scene);
  updateIblControlInputs(scene);
  updateImportedCameraControlInputs(scene);
  updateAnimationControlInputs(scene);
  updateImportedLightControlInputs(scene);

  return scene;
}

async function loadInitialAsset(aperture, app, scene) {
  if (scene.initialCustomUrl !== null) {
    scene.sampleSelection = emptySampleSelectionStatus();
    await loadAsset(aperture, app, scene, {
      id: "custom-url",
      label: "Custom URL",
      url: scene.initialCustomUrl,
      source: "custom",
    });
    return;
  }

  await loadAsset(aperture, app, scene, scene.asset);
}

async function loadSelectedAsset(aperture, app, scene) {
  const asset =
    findSampleAssetById(assetSelect?.value ?? null) ?? getDefaultSampleAsset();

  await loadSampleAsset(aperture, app, scene, asset);
}

async function loadSampleAsset(aperture, app, scene, asset) {
  scene.sampleSelection = {
    requestedAssetId: asset.id,
    activeAssetId: asset.id,
    diagnostics: [],
  };
  persistSampleAssetSelection(asset.id);

  if (assetSelect instanceof HTMLSelectElement) {
    assetSelect.value = asset.id;
  }

  await loadAsset(aperture, app, scene, asset);
}

async function loadSelectedScene(aperture, app, scene) {
  if (!(sceneSelect instanceof HTMLSelectElement)) {
    return;
  }

  const sceneIndex = Number(sceneSelect.value);

  if (!Number.isInteger(sceneIndex)) {
    return;
  }

  await loadAsset(aperture, app, scene, scene.asset, { sceneIndex });
}

function updateSceneSelectControl(scene) {
  if (
    !(sceneSelect instanceof HTMLSelectElement) ||
    !(sceneSelectRow instanceof HTMLElement)
  ) {
    return;
  }

  sceneSelect.replaceChildren();
  const metadata = createGltfMetadataStatus(scene.active);
  const scenes = arrayEntries(metadata.scene?.scenes);

  if (scenes.length <= 1) {
    sceneSelect.disabled = true;
    sceneSelectRow.hidden = true;
    return;
  }

  sceneSelect.disabled = false;
  sceneSelectRow.hidden = false;

  for (const sceneEntry of scenes) {
    if (!isRecord(sceneEntry) || typeof sceneEntry.sceneIndex !== "number") {
      continue;
    }

    const option = document.createElement("option");
    const name =
      typeof sceneEntry.name === "string" && sceneEntry.name.length > 0
        ? sceneEntry.name
        : `Scene ${sceneEntry.sceneIndex}`;

    option.value = String(sceneEntry.sceneIndex);
    option.textContent =
      sceneEntry.sceneIndex === metadata.scene.defaultSceneIndex
        ? `${name} (default)`
        : name;
    sceneSelect.append(option);

    if (sceneEntry.selected === true) {
      sceneSelect.value = option.value;
    }
  }
}

function bindRealUriTextureGalleryKeyboard(aperture, app, scene) {
  globalThis.addEventListener("keydown", (event) => {
    if (isEditableKeyboardTarget(event.target)) {
      return;
    }

    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;

    loadRealUriTextureGalleryOffset(aperture, app, scene, direction).catch(
      (error) => {
        scene.loadState = failure(
          "glb-viewer-gallery-load-failed",
          error instanceof Error
            ? error.message
            : "GLB gallery asset load failed.",
        );
      },
    );
  });
}

function bindRealUriTextureGalleryButtons(aperture, app, scene) {
  bindRealUriTextureGalleryButton(
    textureGalleryPreviousButton,
    aperture,
    app,
    scene,
    -1,
  );
  bindRealUriTextureGalleryButton(
    textureGalleryNextButton,
    aperture,
    app,
    scene,
    1,
  );
}

function bindRealUriTextureGalleryButton(
  button,
  aperture,
  app,
  scene,
  direction,
) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    loadRealUriTextureGalleryOffset(aperture, app, scene, direction).catch(
      (error) => {
        scene.loadState = failure(
          "glb-viewer-gallery-load-failed",
          error instanceof Error
            ? error.message
            : "GLB gallery asset load failed.",
        );
      },
    );
  });
}

function isEditableKeyboardTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target instanceof HTMLInputElement) {
    return true;
  }

  if (target instanceof HTMLTextAreaElement) {
    return true;
  }

  if (target instanceof HTMLSelectElement) {
    return true;
  }

  return target.hasAttribute("contenteditable");
}

async function loadRealUriTextureGalleryOffset(
  aperture,
  app,
  scene,
  direction,
) {
  if (scene.asset.source !== "sample") {
    return;
  }

  const currentIndex = realUriTextureGalleryAssets.findIndex(
    (asset) => asset.id === scene.asset.id,
  );
  const nextIndex =
    currentIndex === -1
      ? 0
      : positiveModulo(
          currentIndex + direction,
          realUriTextureGalleryAssets.length,
        );
  const asset = realUriTextureGalleryAssets[nextIndex];

  if (asset === undefined) {
    return;
  }

  await loadSampleAsset(aperture, app, scene, asset);
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

  scene.sampleSelection = emptySampleSelectionStatus();
  await loadAsset(aperture, app, scene, {
    id: "custom-url",
    label: "Custom URL",
    url,
    source: "custom",
  });
}

async function loadAsset(aperture, app, scene, asset, options = {}) {
  const loadSequence = scene.loadSequence + 1;
  const keyPrefix =
    typeof options.keyPrefix === "string"
      ? options.keyPrefix
      : `viewer-${asset.id}-${loadSequence}`;
  const requestedSceneIndex = Number.isInteger(options.sceneIndex)
    ? options.sceneIndex
    : undefined;

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
  scene.cameraControls.importedEnabled = false;
  setCameraResetEnabled(false);
  destroyActiveScene(aperture, app, scene);
  updateSceneSelectControl(scene);

  const loaded = await loadViewerSourceAsset(
    aperture,
    asset,
    keyPrefix,
    requestedSceneIndex,
  );
  const importReport = loadedGltfImportReport(loaded);

  if (scene.loadSequence !== loadSequence) {
    return;
  }

  if (!loaded.ok || importReport === null) {
    throw new Error(
      loaded.diagnostics[0]?.message ?? "glTF asset did not load.",
    );
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new Error("glTF asset did not produce renderable source assets.");
  }

  markGlbViewerDecodedTexturesLoading({
    aperture,
    registry: app.assets,
    assetMapping: importReport.assetMapping,
    imageDecode: loaded.imageDecode,
  });
  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: app.assets,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });
  markGlbViewerDecodedTexturesReady({
    aperture,
    registry: app.assets,
    assetMapping: importReport.assetMapping,
    imageDecode: loaded.imageDecode,
  });
  const sourceRegistration = registration.sourceRegistration;
  const meshRegistration = registration.meshRegistration;

  if (sourceRegistration === null || meshRegistration === null) {
    throw new Error("glTF source registration was not produced.");
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
    root: loaded.root,
    binary: loaded.binary,
    keyPrefix,
    replay,
  });
  const importedCamera = createImportedCameraState({
    root: loaded.root,
    keyPrefix,
    targetCanvas: scene.targetCanvas,
  });
  applyImportedCameraBootstrap(scene, importedCamera);
  const importedLights = createImportedLightsState({
    aperture,
    root: loaded.root,
    keyPrefix,
    replay,
    enabled: importedLightControls.enabled,
  });
  const skinning = createGltfSkinningState({
    aperture,
    root: loaded.root,
    binary: loaded.binary,
    keyPrefix,
    replay,
    primitiveMaterials,
  });
  const morphing = createGltfMorphTargetState({
    aperture,
    root: loaded.root,
    keyPrefix,
    replay,
    primitiveMaterials,
  });

  updateActiveAnimation(aperture, animation, 0);
  updateProceduralSkinningAnimation(aperture, skinning, 0);
  aperture.resolveWorldTransforms(app.world);
  updateSkinningPalettesFromWorld(aperture, skinning);
  const fit = fitOrbitToReplayBounds(aperture, app, replay, scene.orbit);
  const shadowScene =
    asset.id === "brass"
      ? createBrassShadowScene(aperture, app, replay, fit)
      : null;
  const iblScene =
    shadowScene ??
    (asset.id === "roughness-ibl"
      ? createStandardIblScene(aperture, app)
      : null);

  scene.active = {
    asset,
    keyPrefix,
    sceneIndex: importReport.sceneTraversal.sceneIndex,
    loaded,
    registration,
    primitiveMaterials,
    commandPlan,
    replay,
    animation,
    skinning,
    morphing,
    importedCamera,
    importedLights,
    fit,
    shadowScene,
    iblScene,
    registeredAssetKeys: collectActiveRegisteredAssetKeys(
      registration,
      shadowScene,
      iblScene,
    ),
  };
  scene.loadState = null;
  setCameraResetEnabled(fit.status === "ready");
  updateSceneSelectControl(scene);
  updateShadowControlInputs(scene);
  updateIblControlInputs(scene);
  updateImportedCameraControlInputs(scene);
  updateAnimationControlInputs(scene);
  updateImportedLightControlInputs(scene);
}

function markGlbViewerDecodedTexturesLoading({
  aperture,
  registry,
  assetMapping,
  imageDecode,
}) {
  for (const texture of assetMapping.textures) {
    const decoded = decodedImageStatusForTexture(texture, imageDecode);

    if (decoded === null || texture.texture === null) {
      continue;
    }

    const handle = aperture.createTextureHandle(texture.handleKey);

    if (!registry.has(handle)) {
      registry.register(handle, {
        label: texture.texture.label,
      });
    }

    registry.markLoading(handle);
    decoded.textureHandleKey = aperture.assetHandleKey(handle);
    decoded.registryStatusBeforeRegistration = registry.getStatus(handle);
    decoded.assetStates = uniqueStrings([
      ...(Array.isArray(decoded.assetStates) ? decoded.assetStates : []),
      "loading",
    ]);
  }
}

function markGlbViewerDecodedTexturesReady({
  aperture,
  registry,
  assetMapping,
  imageDecode,
}) {
  for (const texture of assetMapping.textures) {
    const decoded = decodedImageStatusForTexture(texture, imageDecode);

    if (decoded === null) {
      continue;
    }

    const handle = aperture.createTextureHandle(texture.handleKey);
    const status = registry.getStatus(handle) ?? "missing";

    decoded.textureHandleKey = aperture.assetHandleKey(handle);
    decoded.registryStatusAfterRegistration = status;
    decoded.assetStates = uniqueStrings([
      ...(Array.isArray(decoded.assetStates) ? decoded.assetStates : []),
      status,
    ]);
  }
}

function collectActiveRegisteredAssetKeys(registration, shadowScene, iblScene) {
  return uniqueStrings([
    ...arrayEntries(registration.sourceRegistration?.written).map(
      (entry) => entry.registeredHandleKey,
    ),
    ...arrayEntries(registration.meshRegistration?.written).map(
      (entry) => entry.registeredHandleKey,
    ),
    ...arrayEntries(shadowScene?.registeredAssetKeys),
    ...arrayEntries(iblScene?.registeredAssetKeys),
  ]);
}

function decodedImageStatusForTexture(texture, imageDecode) {
  const imageIndex = texture.report.imageIndex;

  if (!Number.isInteger(imageIndex)) {
    return null;
  }

  return (
    imageDecode.decoded.find((entry) => entry.imageIndex === imageIndex) ?? null
  );
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string"))];
}

async function loadViewerSourceAsset(aperture, asset, keyPrefix, sceneIndex) {
  if (asset.format === "gltf") {
    return loadGltfViewerAsset(aperture, asset, keyPrefix, sceneIndex);
  }

  return loadGlbViewerAsset(aperture, asset, keyPrefix, sceneIndex);
}

async function loadGltfViewerAsset(aperture, asset, keyPrefix, sceneIndex) {
  const report = await aperture.loadGltfFromUri(asset.url.href, {
    keyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
    ...(sceneIndex === undefined ? {} : { sceneIndex }),
  });

  return {
    ok: report.ok,
    url: report.url,
    byteLength: report.byteLength,
    loader: report.loader,
    root: report.loader?.root ?? null,
    binary: null,
    imageDecode: emptyImageDecodeStatus(),
    diagnostics: report.diagnostics,
  };
}

function loadedGltfImportReport(loaded) {
  return (
    loaded.loader?.gltfImportReport ??
    loaded.loader?.glbImportReport?.importReport ??
    null
  );
}

async function loadGlbViewerAsset(aperture, asset, keyPrefix, sceneIndex) {
  const fetched = await fetchGlbViewerSourceBytes(asset.url);

  if (!fetched.ok) {
    return {
      ok: false,
      url: asset.url.href,
      byteLength: null,
      loader: null,
      root: null,
      binary: null,
      imageDecode: emptyImageDecodeStatus(),
      diagnostics: fetched.diagnostics,
    };
  }

  const preflight = aperture.createNoFetchGlbSourceLoaderReport({
    source: fetched.bytes,
  });
  const preflightContainer = preflight.glbImportReport.container.container;
  const imageDecode = await decodeSameOriginImages({
    aperture,
    root: preflightContainer?.json ?? null,
    binary: preflightContainer?.binaryChunk ?? null,
    assetUrl: asset.url,
  });
  const dracoDecoder = gltfUsesDraco(preflightContainer?.json)
    ? await getGlbViewerDracoMeshDecoder(aperture)
    : undefined;
  const meshoptDecoder = gltfUsesMeshopt(preflightContainer?.json)
    ? await getGlbViewerMeshoptDecoder(aperture)
    : undefined;
  const loader = aperture.createNoFetchGlbSourceLoaderReport({
    source: fetched.bytes,
    keyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
    ...(sceneIndex === undefined ? {} : { sceneIndex }),
    ...(dracoDecoder === undefined ? {} : { dracoDecoder }),
    ...(meshoptDecoder === undefined ? {} : { meshoptDecoder }),
    resolveImageData: createGlbViewerImageDataResolver({
      assetUrl: asset.url,
      decodedByUrl: imageDecode.decodedByUrl,
      decodedByBufferView: imageDecode.decodedByBufferView,
    }),
  });
  const loaderDiagnostics = loader.status.diagnostics.map((diagnostic) => ({
    code: "loadGlbFromUri.loaderDiagnostic",
    severity: "error",
    loaderCode: diagnostic.code,
    message: diagnostic.message,
  }));

  return {
    ok: loader.status.status === "loaded" && loaderDiagnostics.length === 0,
    url: asset.url.href,
    byteLength: fetched.bytes.byteLength,
    loader,
    root: loader.glbImportReport.container.container?.json ?? null,
    binary: loader.glbImportReport.container.container?.binaryChunk ?? null,
    imageDecode: {
      decoded: imageDecode.decoded,
      diagnostics: imageDecode.diagnostics,
    },
    diagnostics: loaderDiagnostics,
  };
}

async function fetchGlbViewerSourceBytes(url) {
  const fetcher = globalThis.fetch;

  if (fetcher === undefined) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "loadGlbFromUri.fetchUnavailable",
          severity: "error",
          message:
            "GLB URI loading requires globalThis.fetch or an explicit fetch option.",
        },
      ],
    };
  }

  let response;

  try {
    response = await fetcher(url.href);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "loadGlbFromUri.fetchFailed",
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : `Fetching GLB URI '${url.href}' failed.`,
        },
      ],
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "loadGlbFromUri.httpError",
          severity: "error",
          status: response.status,
          statusText: response.statusText,
          message: `Fetching GLB URI '${url.href}' failed with HTTP ${response.status}.`,
        },
      ],
    };
  }

  try {
    return { ok: true, bytes: await response.arrayBuffer(), diagnostics: [] };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "loadGlbFromUri.readFailed",
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : `Reading GLB URI '${url.href}' response bytes failed.`,
        },
      ],
    };
  }
}

async function decodeSameOriginImages({ aperture, root, binary, assetUrl }) {
  if (!isRecord(root)) {
    return {
      decodedByUrl: new Map(),
      decodedByBufferView: new Map(),
      ...emptyImageDecodeStatus(),
    };
  }

  const decodedByUrl = new Map();
  const decodedByBufferView = new Map();
  const decoded = [];
  const diagnostics = [];

  for (const [imageIndex, image] of arrayEntries(root.images).entries()) {
    if (!isRecord(image)) {
      continue;
    }

    if (typeof image.uri !== "string") {
      const decodedEntry = await decodeBufferViewImage({
        aperture,
        root,
        binary,
        imageIndex,
        image,
        assetUrl,
      });

      if (decodedEntry !== null) {
        decodedByBufferView.set(decodedEntry.bufferView, decodedEntry.image);
        decoded.push(decodedEntry.status);
        continue;
      }

      const fallbackEntry = decodeFallbackBufferViewImage(
        imageIndex,
        image,
        assetUrl,
      );

      if (fallbackEntry !== null) {
        decoded.push(fallbackEntry);
      }

      continue;
    }

    const resolved = sameOriginSupportedImageUrl(image, assetUrl);

    if (resolved === null) {
      continue;
    }

    const result = await decodeSameOriginImage(resolved.url);

    if (result === null) {
      continue;
    }

    if (result.ok) {
      decodedByUrl.set(resolved.url.href, result.image);
      decoded.push({
        imageIndex,
        sourceKind: "same-origin-uri",
        uri: image.uri,
        url: formatAssetUrl(resolved.url),
        mimeType: resolved.mimeType,
        width: result.image.width,
        height: result.image.height,
        byteLength: result.image.sourceData.bytes.byteLength,
      });
      continue;
    }

    diagnostics.push({
      code: "glbViewerImageDecode.failed",
      severity: "warning",
      imageIndex,
      uri: image.uri,
      url: formatAssetUrl(resolved.url),
      message: result.message,
    });
  }

  return { decodedByUrl, decodedByBufferView, decoded, diagnostics };
}

async function decodeBufferViewImage({
  aperture,
  root,
  binary,
  imageIndex,
  image,
  assetUrl,
}) {
  if (
    !Number.isInteger(image.bufferView) ||
    typeof image.mimeType !== "string"
  ) {
    return null;
  }

  const bufferViewIndex = image.bufferView;
  const bytes = bufferViewBytes(root, binary, bufferViewIndex);

  if (bytes === null) {
    return null;
  }

  const imageData = await aperture.loadGltfTextureAsync({
    source: {
      kind: "bufferView",
      bufferView: bufferViewIndex,
      mimeType: image.mimeType,
    },
    bytes,
    ...(image.mimeType === "image/ktx2"
      ? { decodeImageData: createGlbViewerKtx2ImageDecoder(aperture) }
      : {}),
  });

  return {
    bufferView: bufferViewIndex,
    image: imageData,
    status: {
      imageIndex,
      sourceKind: "buffer-view",
      decodeMode: "async-buffer-view",
      assetStates: ["loading", "ready"],
      uri: `bufferView:${bufferViewIndex}`,
      url: `${formatAssetUrl(assetUrl)}#bufferView=${bufferViewIndex}`,
      mimeType: image.mimeType,
      width: imageData.width,
      height: imageData.height,
      byteLength: imageData.sourceData.bytes.byteLength,
    },
  };
}

function createGlbViewerKtx2ImageDecoder(aperture) {
  return async (input) =>
    aperture.decodeKtx2TextureDataAsync(input.bytes, {
      basisTranscoder: await getGlbViewerBasisKtx2Transcoder(aperture),
    });
}

function getGlbViewerBasisKtx2Transcoder(aperture) {
  basisKtx2TranscoderPromise ??= aperture.createBasisUniversalKtx2Transcoder({
    jsUrl: new URL("./assets/basis/basis_transcoder.js", import.meta.url).href,
    wasmUrl: new URL("./assets/basis/basis_transcoder.wasm", import.meta.url)
      .href,
  });
  return basisKtx2TranscoderPromise;
}

function getGlbViewerDracoMeshDecoder(aperture) {
  dracoMeshDecoderPromise ??= aperture.createDracoMeshDecoder({
    jsUrl: new URL("./assets/draco/draco_wasm_wrapper.js", import.meta.url)
      .href,
    wasmUrl: new URL("./assets/draco/draco_decoder.wasm", import.meta.url).href,
  });
  return dracoMeshDecoderPromise;
}

function getGlbViewerMeshoptDecoder(aperture) {
  meshoptDecoderPromise ??= aperture.createMeshoptDecoder({
    jsUrl: new URL(
      "./assets/meshopt/meshopt_decoder.module.js",
      import.meta.url,
    ).href,
  });
  return meshoptDecoderPromise;
}

function gltfUsesDraco(root) {
  return (
    isRecord(root) &&
    (stringArray(root.extensionsUsed).includes("KHR_draco_mesh_compression") ||
      stringArray(root.extensionsRequired).includes(
        "KHR_draco_mesh_compression",
      ))
  );
}

function gltfUsesMeshopt(root) {
  if (!isRecord(root)) {
    return false;
  }

  const used = stringArray(root.extensionsUsed);
  const required = stringArray(root.extensionsRequired);

  return (
    used.includes("EXT_meshopt_compression") ||
    used.includes("KHR_meshopt_compression") ||
    required.includes("EXT_meshopt_compression") ||
    required.includes("KHR_meshopt_compression")
  );
}

function bufferViewBytes(root, binary, bufferViewIndex) {
  if (!(binary instanceof Uint8Array)) {
    return null;
  }

  const bufferView = arrayEntries(root.bufferViews)[bufferViewIndex];

  if (!isRecord(bufferView)) {
    return null;
  }

  const byteOffset = integerOrZero(bufferView.byteOffset);
  const byteLength = integerOrNull(bufferView.byteLength);

  if (
    byteLength === null ||
    byteOffset < 0 ||
    byteLength < 0 ||
    byteOffset + byteLength > binary.byteLength
  ) {
    return null;
  }

  return binary.slice(byteOffset, byteOffset + byteLength);
}

function decodeFallbackBufferViewImage(imageIndex, image, assetUrl) {
  if (!Number.isInteger(image.bufferView)) {
    return null;
  }

  const bufferViewIndex = image.bufferView;
  const mimeType =
    typeof image.mimeType === "string" ? image.mimeType : "unknown";
  const imageData = resolveGlbViewerFallbackImageData({
    image,
    source: {
      kind: "bufferView",
      bufferView: bufferViewIndex,
      mimeType,
    },
  });

  if (
    !isRecord(imageData) ||
    typeof imageData.width !== "number" ||
    typeof imageData.height !== "number" ||
    !isRecord(imageData.sourceData) ||
    !(imageData.sourceData.bytes instanceof Uint8Array)
  ) {
    return null;
  }

  return {
    imageIndex,
    sourceKind: "buffer-view",
    uri: `bufferView:${bufferViewIndex}`,
    url: `${formatAssetUrl(assetUrl)}#bufferView=${bufferViewIndex}`,
    mimeType,
    width: imageData.width,
    height: imageData.height,
    byteLength: imageData.sourceData.bytes.byteLength,
  };
}

function emptyImageDecodeStatus() {
  return {
    decoded: [],
    diagnostics: [],
  };
}

function sameOriginSupportedImageUrl(image, assetUrl) {
  const mimeType =
    typeof image.mimeType === "string" ? image.mimeType.toLowerCase() : null;

  if (
    mimeType !== null &&
    mimeType !== "image/png" &&
    mimeType !== "image/jpeg"
  ) {
    return null;
  }

  let imageUrl;

  try {
    imageUrl = new URL(image.uri, assetUrl.href);
  } catch {
    return null;
  }

  if (imageUrl.origin !== globalThis.location.origin) {
    return null;
  }

  const path = imageUrl.pathname.toLowerCase();
  const inferredMimeType = path.endsWith(".png")
    ? "image/png"
    : path.endsWith(".jpg") || path.endsWith(".jpeg")
      ? "image/jpeg"
      : null;

  if (mimeType === null && inferredMimeType === null) {
    return null;
  }

  return { url: imageUrl, mimeType: mimeType ?? inferredMimeType };
}

async function decodeSameOriginImage(imageUrl) {
  const fetcher = globalThis.fetch;
  const imageBitmapFactory = globalThis.createImageBitmap;
  let response;

  if (fetcher === undefined) {
    return {
      ok: false,
      message: "Decoding same-origin GLB image URIs requires globalThis.fetch.",
    };
  }

  if (imageBitmapFactory === undefined) {
    return {
      ok: false,
      message:
        "Decoding same-origin GLB image URIs requires globalThis.createImageBitmap.",
    };
  }

  try {
    response = await fetcher(imageUrl.href);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : `Fetching image URI '${imageUrl.href}' failed.`,
    };
  }

  if (!response.ok) {
    return null;
  }

  try {
    const blob = await response.blob();
    const bitmap = await imageBitmapFactory(blob);
    const canvasElement = createImageDecodeCanvas(bitmap.width, bitmap.height);

    if (canvasElement === null) {
      bitmap.close();
      return {
        ok: false,
        message: `Decoding image URI '${formatAssetUrl(
          imageUrl,
        )}' requires OffscreenCanvas or a document canvas.`,
      };
    }

    const context = canvasElement.getContext("2d", {
      willReadFrequently: true,
    });

    if (context === null) {
      bitmap.close();
      return {
        ok: false,
        message: `Could not create a 2D canvas context for image URI '${formatAssetUrl(
          imageUrl,
        )}'.`,
      };
    }

    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const image = {
      width: bitmap.width,
      height: bitmap.height,
      sourceData: {
        bytes: new Uint8Array(pixels.data),
        bytesPerRow: bitmap.width * 4,
        rowsPerImage: bitmap.height,
      },
    };

    bitmap.close();
    return { ok: true, image };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : `Decoding image URI '${imageUrl.href}' failed.`,
    };
  }
}

function createImageDecodeCanvas(width, height) {
  const OffscreenCanvasConstructor = globalThis.OffscreenCanvas;

  if (typeof OffscreenCanvasConstructor === "function") {
    return new OffscreenCanvasConstructor(width, height);
  }

  const documentRef = globalThis.document;

  if (
    documentRef === undefined ||
    typeof documentRef.createElement !== "function"
  ) {
    return null;
  }

  const canvasElement = documentRef.createElement("canvas");

  canvasElement.width = width;
  canvasElement.height = height;

  return canvasElement;
}

function createGlbViewerImageDataResolver({
  assetUrl,
  decodedByUrl,
  decodedByBufferView,
}) {
  return (input) => {
    if (input.source.kind === "uri") {
      const resolved = sameOriginSupportedImageUrl(input.source, assetUrl);
      const decoded =
        resolved === null
          ? null
          : (decodedByUrl.get(resolved.url.href) ?? null);

      if (decoded !== null) {
        return cloneDecodedImageData(decoded);
      }
    }

    if (input.source.kind === "bufferView") {
      const decoded = decodedByBufferView.get(input.source.bufferView) ?? null;

      if (decoded !== null) {
        return cloneDecodedImageData(decoded);
      }
    }

    return resolveGlbViewerFallbackImageData(input);
  };
}

function cloneDecodedImageData(image) {
  return {
    width: image.width,
    height: image.height,
    ...(image.format === undefined ? {} : { format: image.format }),
    sourceData: {
      bytes: new Uint8Array(image.sourceData.bytes),
      bytesPerRow: image.sourceData.bytesPerRow,
      rowsPerImage: image.sourceData.rowsPerImage,
    },
  };
}

function destroyActiveScene(aperture, app, scene) {
  if (scene.active === null) {
    return;
  }

  const destroyed = new Set();

  for (const entity of scene.active.replay.entitiesByKey.values()) {
    destroyed.add(entity);
    entity.destroy();
  }

  for (const entity of scene.active.shadowScene?.entities ?? []) {
    destroyed.add(entity);
    entity.destroy();
  }

  for (const entity of scene.active.iblScene?.entities ?? []) {
    if (destroyed.has(entity)) {
      continue;
    }

    entity.destroy();
  }

  unregisterActiveSceneAssets(aperture, app, scene.active);
  scene.active = null;
  updateShadowControlInputs(scene);
  updateIblControlInputs(scene);
  updateImportedCameraControlInputs(scene);
  updateAnimationControlInputs(scene);
  updateImportedLightControlInputs(scene);
}

function unregisterActiveSceneAssets(aperture, app, active) {
  for (const key of active.registeredAssetKeys ?? []) {
    const handle = assetHandleFromKey(aperture, key);

    if (handle === null) {
      continue;
    }

    app.assets.unregister(handle);
  }
}

function assetHandleFromKey(aperture, key) {
  const delimiter = key.indexOf(":");

  if (delimiter <= 0 || delimiter === key.length - 1) {
    return null;
  }

  try {
    return aperture.deserializeAssetHandle({
      kind: key.slice(0, delimiter),
      id: key.slice(delimiter + 1),
    });
  } catch {
    return null;
  }
}

function createStandardIblScene(aperture, app) {
  const environmentMap =
    aperture.createEnvironmentMapHandle("glb-viewer-studio");
  const iblResources = null;

  if (enableIblSampling) {
    app.assets.register(environmentMap, { label: "GLB viewer studio IBL" });
    app.assets.markReady(environmentMap, {
      label: "GLB viewer studio IBL",
      diffuseResourceKey: "glb-viewer-studio/diffuse",
      specularResourceKey: "glb-viewer-studio/specular-proof",
    });
  }

  const environmentEntity = enableIblSampling
    ? app.spawn(
        aperture.withEnvironmentMap(environmentMap, {
          color: [1, 1, 1, 1],
          intensity: iblControls.enabled ? 0.52 : 0,
          layerMask: 1,
        }),
      )
    : null;

  if (environmentEntity !== null) {
    setEnvironmentMapComponent(
      aperture,
      environmentEntity,
      aperture.assetHandleKey(environmentMap),
      iblControls.enabled,
    );
  }

  return {
    iblControls,
    iblAvailable: enableIblSampling,
    specularIblAvailable: enableIblSampling && enableSpecularIblSampling,
    environmentEntity,
    environmentMapKey: aperture.assetHandleKey(environmentMap),
    iblResources,
    entities: environmentEntity === null ? [] : [environmentEntity],
    registeredAssetKeys: enableIblSampling
      ? [aperture.assetHandleKey(environmentMap)]
      : [],
  };
}

function createBrassShadowScene(aperture, app, replay, fit) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const environmentMap =
    aperture.createEnvironmentMapHandle("glb-viewer-studio");
  const floorWidth = Math.max(2.4, fit.size[0] * 2.6);
  const floorDepth = Math.max(1.8, fit.size[2] * 2.4);
  const floorHeight = 0.12;
  const floorMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "GlbViewerShadowReceiverFloor",
      width: floorWidth,
      height: floorHeight,
      depth: floorDepth,
    }),
    { id: "glb-viewer-shadow-floor" },
  );
  const floorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "GlbViewerShadowReceiverFloorStandard",
      baseColorFactor: new Float32Array([0.82, 0.86, 0.78, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "glb-viewer-shadow-floor-standard" },
  );
  const context = { app, world: app.world, assets: app.assets };
  const replayMeshEntities = [];
  const iblResources = null;

  if (enableIblSampling) {
    app.assets.register(environmentMap, { label: "GLB viewer studio IBL" });
    app.assets.markReady(environmentMap, {
      label: "GLB viewer studio IBL",
      diffuseResourceKey: "glb-viewer-studio/diffuse",
      specularResourceKey: "glb-viewer-studio/specular-proof",
    });
  }

  for (const entity of replay.entitiesByKey.values()) {
    if (
      !entity.hasComponent(aperture.Mesh) ||
      !entity.hasComponent(aperture.Material)
    ) {
      continue;
    }

    replayMeshEntities.push(entity);

    if (entity.hasComponent(aperture.ShadowCaster)) {
      entity.setValue(
        aperture.ShadowCaster,
        "enabled",
        shadowControls.casterEnabled,
      );
    } else {
      aperture.withShadowCaster(shadowControls.casterEnabled)(entity, context);
    }

    if (entity.hasComponent(aperture.ShadowReceiver)) {
      entity.setValue(aperture.ShadowReceiver, "enabled", false);
    } else {
      aperture.withShadowReceiver(false)(entity, context);
    }
  }

  const floorEntity = app.spawn(
    aperture.withTransform({
      translation: [
        fit.center[0],
        fit.center[1] - Math.max(0.62, fit.size[1] * 0.62),
        fit.center[2] - 0.12,
      ],
    }),
    aperture.withMesh(floorMesh),
    aperture.withMaterial(floorMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withShadowCaster(false),
    aperture.withShadowReceiver(shadowControls.receiverEnabled),
  );
  const lightEntity = app.spawn(
    aperture.withTransform({
      rotation: [-0.330366, -0.24321, -0.088521, 0.907673],
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 1.8,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.depthBias,
      normalBias: shadowIntent.normalBias,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );
  const environmentEntity = enableIblSampling
    ? app.spawn(
        aperture.withEnvironmentMap(environmentMap, {
          color: [1, 1, 1, 1],
          intensity: iblControls.enabled ? 0.52 : 0,
          layerMask: 1,
        }),
      )
    : null;

  if (environmentEntity !== null) {
    setEnvironmentMapComponent(
      aperture,
      environmentEntity,
      aperture.assetHandleKey(environmentMap),
      iblControls.enabled,
    );
  }

  return {
    controls: shadowControls,
    casterEntities: replayMeshEntities,
    receiverEntities: [floorEntity],
    iblControls,
    iblAvailable: enableIblSampling,
    specularIblAvailable: enableIblSampling && enableSpecularIblSampling,
    environmentEntity,
    environmentMapKey: aperture.assetHandleKey(environmentMap),
    iblResources,
    floorMeshKey: aperture.assetHandleKey(floorMesh),
    floorMaterialKey: aperture.assetHandleKey(floorMaterial),
    casterCount: replayMeshEntities.length,
    registeredAssetKeys: [
      aperture.assetHandleKey(floorMesh),
      aperture.assetHandleKey(floorMaterial),
      ...(enableIblSampling ? [aperture.assetHandleKey(environmentMap)] : []),
    ],
    entities:
      environmentEntity === null
        ? [floorEntity, lightEntity]
        : [floorEntity, lightEntity, environmentEntity],
  };
}

function createGlbViewerIblResources(aperture, app) {
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const device = app.initialization.device;
  const diffuseResourceKey = "texture:glb-viewer-studio:diffuse:texture";
  const specularResourceKey =
    "texture:glb-viewer-studio:specular-proof:texture";
  const samplerResourceKey = "texture:glb-viewer-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let specularTexture = cache.specularTextures.get(specularResourceKey);
  let iblSampler = cache.samplers.get(samplerResourceKey);

  if (diffuseTexture === undefined) {
    diffuseTexture = createFaceColoredDiffuseCubeTexture(
      device,
      diffuseResourceKey,
    );
    cache.diffuseTextures.set(diffuseResourceKey, diffuseTexture);
  }

  if (enableSpecularIblSampling && specularTexture === undefined) {
    specularTexture = createFaceColoredSpecularCubeTexture(
      device,
      specularResourceKey,
    );
    cache.specularTextures.set(specularResourceKey, specularTexture);
  }

  if (iblSampler === undefined) {
    iblSampler = createDiffuseIblSampler(device, samplerResourceKey);
    cache.samplers.set(samplerResourceKey, iblSampler);
  }

  return {
    bindGroupResource: {
      ready: true,
      status: "available",
      standardMaterialCount: 1,
      group: 4,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 1,
      sections: {
        descriptorPlan: true,
        layoutResource: true,
        textureResources: true,
        samplerResource: true,
        bindGroupResource: true,
        shaderSampling: true,
      },
      resource: {
        group: 4,
        resourceKey: "bind-group:standard/ibl/group-4/glb-viewer-studio",
        layoutKey: "standard/ibl/group-4",
        bindGroup: { label: "standard/ibl/group-4/glb-viewer-studio" },
        entryResourceKeys:
          specularTexture === undefined
            ? [diffuseResourceKey, samplerResourceKey]
            : [diffuseResourceKey, specularResourceKey, samplerResourceKey],
      },
      diagnostics: [],
    },
    diffuseTextureResource: {
      ready: true,
      status: "available",
      textureSlotCount: 1,
      diffuseSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        diffuseTextureResource: true,
        gpuAllocation: true,
        specularPrefiltering: false,
        shaderSampling: true,
      },
      resources: [{ valid: true, resource: diffuseTexture, diagnostics: [] }],
      diagnostics: [],
    },
    ...(specularTexture === undefined
      ? {}
      : {
          specularTextureResource: {
            ready: true,
            status: "available",
            textureSlotCount: 1,
            specularSlotCount: 1,
            createdTextureCount: 1,
            reusedTextureCount: 0,
            sections: {
              texturePreparation: true,
              specularTextureResource: true,
              gpuAllocation: true,
              proofUpload: true,
              prefiltering: false,
              bindGroupResource: false,
              shaderSampling: true,
            },
            resources: [
              { valid: true, resource: specularTexture, diagnostics: [] },
            ],
            diagnostics: [
              {
                code: "iblTextureResource.specularPrefilteringDeferred",
                severity: "warning",
                message:
                  "Specular IBL texture resource uses a deterministic minimal mip chain; full PMREM/GGX prefiltering remains deferred.",
              },
            ],
          },
        }),
    samplerResource: {
      ready: true,
      status: "available",
      samplerDescriptorCount: 1,
      createdSamplerCount: 1,
      reusedSamplerCount: 0,
      sections: {
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: true,
        shaderSampling: true,
      },
      resources: [{ valid: true, resource: iblSampler, diagnostics: [] }],
      diagnostics: [],
    },
  };
}

function createFaceColoredDiffuseCubeTexture(device, resourceKey) {
  const texture = device.createTexture({
    label: "glb-viewer-studio:diffuse-ibl",
    size: [1, 1, 6],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount: 1,
  });
  const faceColors = [
    [238, 122, 56, 255],
    [48, 138, 230, 255],
    [235, 226, 126, 255],
    [38, 82, 74, 255],
    [198, 88, 218, 255],
    [72, 80, 126, 255],
  ];

  faceColors.forEach((color, face) => {
    const data = new Uint8Array(256);
    data.set(color, 0);
    device.queue.writeTexture(
      { texture, origin: [0, 0, face] },
      data,
      { bytesPerRow: 256, rowsPerImage: 1 },
      [1, 1, 1],
    );
  });

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "glb-viewer-studio:diffuse-ibl-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "glb-viewer-studio:diffuse-ibl",
      size: [1, 1, 6],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      mipLevelCount: 1,
    },
    viewDescriptor: { dimension: "cube" },
  };
}

function createFaceColoredSpecularCubeTexture(device, resourceKey) {
  const baseSize = 8;
  const mipLevelCount = 4;
  const texture = device.createTexture({
    label: "glb-viewer-studio:specular-ibl-minimal-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount,
  });
  const mipFaceColors = [
    [
      [255, 246, 214, 255],
      [82, 116, 168, 255],
      [245, 238, 184, 255],
      [28, 44, 56, 255],
      [248, 214, 255, 255],
      [44, 50, 76, 255],
    ],
    [
      [218, 202, 178, 255],
      [94, 118, 150, 255],
      [220, 212, 172, 255],
      [50, 66, 74, 255],
      [214, 184, 220, 255],
      [64, 70, 92, 255],
    ],
    [
      [118, 114, 106, 255],
      [84, 92, 106, 255],
      [118, 116, 106, 255],
      [62, 70, 76, 255],
      [114, 104, 120, 255],
      [68, 72, 84, 255],
    ],
    [
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
    ],
  ];

  mipFaceColors.forEach((faceColors, mipLevel) => {
    const mipSize = Math.max(1, baseSize >> mipLevel);

    faceColors.forEach((color, face) => {
      const data = new Uint8Array(256 * mipSize);

      for (let row = 0; row < mipSize; row += 1) {
        for (let column = 0; column < mipSize; column += 1) {
          data.set(color, row * 256 + column * 4);
        }
      }

      device.queue.writeTexture(
        { texture, mipLevel, origin: [0, 0, face] },
        data,
        { bytesPerRow: 256, rowsPerImage: mipSize },
        [mipSize, mipSize, 1],
      );
    });
  });

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "glb-viewer-studio:specular-ibl-minimal-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "glb-viewer-studio:specular-ibl-minimal-mip-chain",
      size: [baseSize, baseSize, 6],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      mipLevelCount,
    },
    viewDescriptor: { dimension: "cube" },
  };
}

function createDiffuseIblSampler(device, resourceKey) {
  const descriptor = {
    label: "glb-viewer-studio:diffuse-ibl-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 3,
    maxAnisotropy: 1,
  };

  return {
    resourceKey,
    sampler: device.createSampler(descriptor),
    descriptor,
  };
}

function startRendering(aperture, app, scene) {
  let frame = 0;
  let standardMaterialShadowReceiverResources = null;

  const render = async () => {
    try {
      frame += 1;
      updateActiveAnimation(
        aperture,
        scene.active?.animation ?? null,
        frame / 60,
      );
      updateAnimationControlInputs(scene);
      updateViewerCamera(aperture, scene);
      const step = app.step(0, frame / 60);
      const report = await app.render({
        frame,
        clearColor,
        label: "glb-viewer-app",
        ...(scene.active?.shadowScene?.controls.receiverEnabled !== true ||
        scene.active.shadowScene.controls.casterEnabled !== true ||
        standardMaterialShadowReceiverResources === null
          ? {}
          : { standardMaterialShadowReceiverResources }),
        ...(scene.active?.iblScene?.iblResources === null ||
        scene.active?.iblScene?.iblResources === undefined ||
        scene.active.iblScene.iblControls.enabled !== true
          ? {}
          : {
              standardMaterialIblResources: scene.active.iblScene.iblResources,
            }),
      });

      const nextFrameResources = await createStatus(
        aperture,
        app,
        scene,
        step,
        report,
        frame,
      );

      standardMaterialShadowReceiverResources =
        nextFrameResources.standardMaterialShadowReceiverResources;
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

async function createStatus(aperture, app, scene, step, report, frame) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const active = scene.active;
  const shadowFrame = await createViewerShadowFrame({
    aperture,
    app,
    report,
    reportJson,
    active,
  });

  publishStatus({
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
      materialSlotSummary: createMaterialSlotSummary(aperture, app, active),
    },
    selection: {
      ...scene.sampleSelection,
      activeAssetId: scene.asset.id,
    },
    assetRegistry: createAssetRegistryStatus(app, active),
    textureGallery: createRealUriTextureGalleryStatus(scene),
    source: {
      url: formatAssetUrl(active?.asset.url ?? scene.asset.url),
      ok: active?.loaded.ok ?? false,
      byteLength: active?.loaded.byteLength ?? null,
      status: active?.loaded.loader?.status ?? null,
      outputSummary: active?.loaded.loader?.outputSummary ?? null,
      imageDecode: active?.loaded.imageDecode ?? emptyImageDecodeStatus(),
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
        resolutions: createPrimitiveMaterialResolutionStatus(
          aperture,
          app,
          active,
        ),
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
      metadata: createGltfMetadataStatus(active),
      meshAttributes: createGltfMeshAttributeStatus(active),
    },
    orbit: {
      yaw: Number(scene.orbit.yaw.toFixed(4)),
      elevation: Number(scene.orbit.elevation.toFixed(4)),
      distance: Number(scene.orbit.distance.toFixed(3)),
      target: roundTuple(scene.orbit.target, 3),
      fit: scene.orbit.fit,
      resetAvailable: scene.orbit.fit.status === "ready",
      dragging: scene.orbit.dragging,
    },
    importedCamera: createImportedCameraStatus(scene),
    importedLights: createImportedLightsStatus(scene, report.snapshot),
    lighting: createLightingControlStatus(aperture, scene, report.snapshot),
    animation: createAnimationStatus(active?.animation ?? null),
    hierarchy: createHierarchyStatus(aperture, active),
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      environments: report.snapshot.environments.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
      diagnosticsList: renderDiagnosticsStatus(report.snapshot.diagnostics),
    },
    ibl: createIblStatus(aperture, active, reportJson),
    shadow: createShadowStatus(
      aperture,
      active,
      report.snapshot.meshDraws,
      shadowFrame,
    ),
    renderState: createRenderStateStatus(aperture, report.snapshot.meshDraws),
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
  });

  return {
    standardMaterialShadowReceiverResources:
      active?.shadowScene?.controls.receiverEnabled === true &&
      active.shadowScene.controls.casterEnabled === true &&
      shadowFrame !== null &&
      shadowFrame.receiverResources !== null
        ? shadowFrame.receiverResources
        : null,
  };
}

function createAssetRegistryStatus(app, active) {
  const manifest = app.assets.createManifestReport();
  const activeKeys = uniqueStrings(active?.registeredAssetKeys ?? []);

  return {
    total: manifest.total,
    activeRegistered: activeKeys.length,
    staleRegistered: Math.max(0, manifest.total - activeKeys.length),
    activeKeys,
  };
}

function renderDiagnosticsStatus(diagnostics) {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...diagnosticEntityStatus(diagnostic.entity),
    ...diagnosticOptionalString(diagnostic, "assetKey"),
    ...diagnosticOptionalString(diagnostic, "materialKey"),
    ...diagnosticOptionalString(diagnostic, "meshKey"),
    ...diagnosticOptionalString(diagnostic, "textureKey"),
    ...diagnosticOptionalString(diagnostic, "samplerKey"),
    ...diagnosticOptionalString(diagnostic, "field"),
    ...diagnosticOptionalNumber(diagnostic, "texCoord"),
  }));
}

function createRealUriTextureGalleryStatus(scene) {
  const activeIndex = realUriTextureGalleryAssets.findIndex(
    (asset) => asset.id === scene.asset.id,
  );
  const active = activeIndex >= 0 && scene.asset.source === "sample";

  return {
    id: "real-uri-textures",
    count: realUriTextureGalleryAssets.length,
    active,
    activeIndex: active ? activeIndex : null,
    activeAssetId: active ? scene.asset.id : null,
    sampleIds: realUriTextureGalleryAssets.map((asset) => asset.id),
  };
}

function diagnosticEntityStatus(entity) {
  if (entity === undefined || entity === null) {
    return {};
  }

  return {
    entity: {
      index: entity.index,
      generation: entity.generation,
    },
  };
}

function diagnosticOptionalString(diagnostic, field) {
  return typeof diagnostic[field] === "string"
    ? { [field]: diagnostic[field] }
    : {};
}

function diagnosticOptionalNumber(diagnostic, field) {
  return typeof diagnostic[field] === "number" &&
    Number.isFinite(diagnostic[field])
    ? { [field]: diagnostic[field] }
    : {};
}

async function createViewerShadowFrame({
  aperture,
  app,
  report,
  reportJson,
  active,
}) {
  const shadowScene = active?.shadowScene ?? null;

  if (shadowScene === null) {
    return null;
  }

  const shadowRequests = report.snapshot.shadowRequests.filter(
    (request) => request.lightKind === "directional",
  );
  const shadowDescriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests,
      descriptors: shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: shadowIntent.mapSize,
        depthBias: shadowIntent.depthBias,
        normalBias: shadowIntent.normalBias,
      })),
    }),
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    aperture.createShadowTextureResourceReport({
      descriptors: shadowDescriptor,
    }),
  );

  shadowDepthTextureResourceReport ??=
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
    });

  const shadowDepthTextureResources =
    aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowDepthTextureResourceReport,
    );
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:glb-viewer-directional",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowSamplerResource = aperture.shadowSamplerResourceReportToJsonValue(
    shadowSamplerResourceReport,
  );
  const shadowPassPlan = aperture.shadowPassPlanReportToJsonValue(
    aperture.createShadowPassPlanReport({
      shadowRequests,
      textures: shadowTextures,
      submission: "ready",
    }),
  );
  const shadowPassAttachments =
    aperture.shadowPassAttachmentDescriptorReportToJsonValue(
      aperture.createShadowPassAttachmentDescriptorReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
      }),
    );
  const shadowViewProjection =
    aperture.directionalShadowViewProjectionPlanReportToJsonValue(
      aperture.createDirectionalShadowViewProjectionPlanReport({
        shadowRequests,
        lights: report.snapshot.lights,
        shadowPassPlan,
        computation: "ready",
      }),
    );
  const shadowMatrixComputation =
    aperture.directionalShadowMatrixComputationReportToJsonValue(
      aperture.createDirectionalShadowMatrixComputationReport({
        viewProjection: shadowViewProjection,
        transforms: report.snapshot.transforms,
      }),
    );
  const shadowMatrixBuffer =
    aperture.shadowMatrixBufferDescriptorReportToJsonValue(
      aperture.createShadowMatrixBufferDescriptorReport({
        viewProjection: shadowViewProjection,
        upload: "ready",
        resourceKey: "shadow-matrix-buffer:glb-viewer-directional",
        label: "GlbViewerDirectionalShadowMatrices/storage",
      }),
    );
  const shadowMatrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: shadowMatrixBuffer,
      matrices: shadowMatrixComputation,
    });
  const shadowMatrixBufferResource =
    aperture.shadowMatrixBufferResourceReportToJsonValue(
      shadowMatrixBufferResourceReport,
    );
  const shadowCasterDrawList =
    aperture.shadowCasterDrawListPlanReportToJsonValue(
      aperture.createShadowCasterDrawListPlanReport({
        shadowRequests,
        meshDraws: report.snapshot.meshDraws,
        shadowPassPlan,
        commandEncoding: "ready",
      }),
    );
  const shadowCommandPlan =
    aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      aperture.createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan,
        viewProjection: shadowViewProjection,
        matrixBuffer: shadowMatrixBuffer,
        casterDrawList: shadowCasterDrawList,
        commandEncoding: "ready",
      }),
    );
  const shadowPassCommandEncoding =
    aperture.shadowPassCommandEncodingReportToJsonValue(
      aperture.createShadowPassCommandEncodingReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
        matrixBufferResource: shadowMatrixBufferResourceReport,
        casterDrawList: shadowCasterDrawList,
        commandPlan: shadowCommandPlan,
        commandEncoding: "ready",
      }),
    );
  const shadowCasterPipelineDescriptor =
    aperture.shadowCasterPipelineDescriptorReportToJsonValue(
      aperture.createShadowCasterPipelineDescriptorReport({
        commandEncoding: shadowPassCommandEncoding,
      }),
    );
  const shadowCasterPipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: shadowCasterPipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const shadowCasterPipelineResource =
    aperture.shadowCasterPipelineResourceReportToJsonValue(
      shadowCasterPipelineResourceReport,
    );
  const shadowCasterMatrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      layout:
        shadowCasterPipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const shadowCasterMatrixBindGroupResource =
    aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
      shadowCasterMatrixBindGroupResourceReport,
    );
  const shadowCasterFrameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      aperture.createShadowCasterFrameResourceReadinessReport({
        casterDrawList: shadowCasterDrawList,
        preparedMeshes: createShadowCasterPreparedMeshViews(report),
        matrixBufferResource: shadowMatrixBufferResourceReport,
        pipelineDescriptor: shadowCasterPipelineDescriptor,
      }),
    );
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources: shadowCasterFrameResources,
      commandPlan: shadowCommandPlan,
      pipelines:
        shadowCasterPipelineResourceReport.resource === null
          ? []
          : [
              {
                pipelineKey:
                  shadowCasterPipelineResourceReport.resource.pipelineKey,
                resourceKey:
                  shadowCasterPipelineResourceReport.resource.resourceKey,
                pipeline: shadowCasterPipelineResourceReport.resource.pipeline,
              },
            ],
      matrixBindGroups:
        shadowCasterMatrixBindGroupResourceReport.resource === null
          ? []
          : [
              {
                matrixResourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .matrixResourceKey,
                resourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .resourceKey,
                group: shadowCasterMatrixBindGroupResourceReport.resource.group,
                bindGroup:
                  shadowCasterMatrixBindGroupResourceReport.resource.bindGroup,
              },
            ],
      meshes: createShadowCasterExecutableMeshViews(report),
    });
  const shadowCasterCommandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(
      shadowCasterCommandRecordPlan,
    );
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: "shadow-pass:glb-viewer-directional",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: shadowPassAttachments,
      frameResources: shadowCasterFrameResources,
      commandEncoding: shadowPassCommandEncoding,
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        resolveShadowDepthView(shadowDepthTextureResourceReport, attachment),
    });
  const shadowPassEncoderAssembly =
    aperture.shadowPassEncoderAssemblyReportToJsonValue(
      shadowPassEncoderAssemblyReport,
    );
  const shadowPassCommandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: shadowPassEncoderAssemblyReport,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: "shadow-pass:glb-viewer-directional",
      submit: shadowScene.controls.casterEnabled,
    });
  const shadowPassCommandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowPassCommandBufferSubmissionReport,
    );
  const route = findDirectionalShadowRoute(reportJson);
  const receiverResources =
    shadowMatrixBufferResourceReport.resource !== null &&
    shadowDepthTextureResourceReport.resources.some(
      (resource) => resource.allocation.resource !== null,
    ) &&
    shadowSamplerResourceReport.resource !== null
      ? {
          shadowKind: "directional",
          matrixBufferResource: shadowMatrixBufferResourceReport,
          depthTextureResources: shadowDepthTextureResourceReport,
          samplerResource: shadowSamplerResourceReport,
        }
      : null;

  return {
    descriptor: shadowDescriptor,
    textures: shadowTextures,
    depthTextureResources: shadowDepthTextureResources,
    samplerResource: shadowSamplerResource,
    passPlan: shadowPassPlan,
    passAttachments: shadowPassAttachments,
    viewProjection: shadowViewProjection,
    matrixComputation: shadowMatrixComputation,
    matrixBuffer: shadowMatrixBuffer,
    matrixBufferResource: shadowMatrixBufferResource,
    casterDrawList: shadowCasterDrawList,
    commandPlan: shadowCommandPlan,
    commandEncoding: shadowPassCommandEncoding,
    pipelineDescriptor: shadowCasterPipelineDescriptor,
    pipelineResource: shadowCasterPipelineResource,
    matrixBindGroupResource: shadowCasterMatrixBindGroupResource,
    frameResources: shadowCasterFrameResources,
    commandRecords: shadowCasterCommandRecords,
    encoderAssembly: shadowPassEncoderAssembly,
    commandBufferSubmission: shadowPassCommandBufferSubmission,
    commandBufferSubmissionReport: shadowPassCommandBufferSubmissionReport,
    route,
    receiverResources,
  };
}

function createIblStatus(aperture, active, reportJson) {
  const iblScene = active?.iblScene ?? null;
  const resources = iblScene?.iblResources ?? null;
  const pipelineKeys = routedPipelineKeys(reportJson);
  const diffuseKey =
    resources?.diffuseTextureResource.resources[0]?.resource?.resourceKey ??
    null;
  const specularKey =
    resources?.specularTextureResource?.resources[0]?.resource?.resourceKey ??
    null;
  const samplerKey =
    resources?.samplerResource.resources[0]?.resource?.resourceKey ?? null;
  const diffuseRoute = pipelineKeys.find((key) => key.includes("iblDiffuse"));
  const specularRoute = pipelineKeys.find((key) =>
    key.includes("iblSpecularProof"),
  );

  return {
    enabled:
      iblScene?.iblAvailable === true && iblScene.iblControls.enabled === true,
    controls: {
      enabled: iblScene?.iblControls.enabled ?? iblControls.enabled,
      available: iblScene?.iblAvailable === true,
    },
    ecs: createIblEcsStatus(aperture, iblScene),
    specularProof:
      iblScene?.specularIblAvailable === true &&
      iblScene.iblControls.enabled === true,
    environmentMapKey: iblScene?.environmentMapKey ?? null,
    resources: {
      diffuseTexture: diffuseKey,
      specularTexture: specularKey,
      sampler: samplerKey,
    },
    rendering: {
      supported:
        iblScene?.iblAvailable === true &&
        iblScene.iblControls.enabled === true &&
        diffuseRoute !== undefined,
      diffusePipelineKey: diffuseRoute ?? null,
      specularPipelineKey: specularRoute ?? null,
      pipelineKeys,
    },
  };
}

function createIblEcsStatus(aperture, shadowScene) {
  const environmentEntity = shadowScene?.environmentEntity ?? null;

  if (environmentEntity === null) {
    return {
      environmentMapKey: null,
      intensity: null,
      environmentEntityCount: 0,
    };
  }

  const environmentMapId =
    environmentEntity.getValue(aperture.Light, "environmentMapId") ?? "";

  return {
    environmentMapKey: environmentMapId === "" ? null : environmentMapId,
    intensity: Number(
      (environmentEntity.getValue(aperture.Light, "intensity") ?? 0).toFixed(3),
    ),
    environmentEntityCount: 1,
  };
}

function createShadowStatus(aperture, active, meshDraws, shadowFrame) {
  const shadowScene = active?.shadowScene ?? null;

  if (shadowScene === null) {
    return {
      enabled: false,
      controls: {
        receiverEnabled: shadowControls.receiverEnabled,
        casterEnabled: shadowControls.casterEnabled,
      },
      ecs: {
        casterEnabled: null,
        receiverEnabled: null,
        casterEntityCount: 0,
        receiverEntityCount: 0,
        enabledCasterEntityCount: 0,
        enabledReceiverEntityCount: 0,
      },
      authoring: createShadowAuthoringStatus(meshDraws),
      requests: [],
      rendering: {
        supported: false,
        mode: "absent",
        pipelineKey: null,
      },
    };
  }

  return {
    enabled: true,
    controls: {
      receiverEnabled: shadowScene.controls.receiverEnabled,
      casterEnabled: shadowScene.controls.casterEnabled,
    },
    ecs: createShadowEcsStatus(aperture, shadowScene),
    floor: {
      meshKey: shadowScene.floorMeshKey,
      materialKey: shadowScene.floorMaterialKey,
    },
    authoring: createShadowAuthoringStatus(meshDraws),
    requests:
      shadowFrame?.passPlan.passes.map((pass) => ({
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        casterLayerMask: pass.casterLayerMask,
        receiverLayerMask: pass.receiverLayerMask,
      })) ?? [],
    descriptor: shadowFrame?.descriptor ?? null,
    depthTextureResources: shadowFrame?.depthTextureResources ?? null,
    samplerResource: shadowFrame?.samplerResource ?? null,
    passPlan: shadowFrame?.passPlan ?? null,
    viewProjection: shadowFrame?.viewProjection ?? null,
    matrixComputation: shadowFrame?.matrixComputation ?? null,
    casterDrawList: shadowFrame?.casterDrawList ?? null,
    commandEncoding: shadowFrame?.commandEncoding ?? null,
    pipelineResource: shadowFrame?.pipelineResource ?? null,
    frameResources: shadowFrame?.frameResources ?? null,
    encoderAssembly: shadowFrame?.encoderAssembly ?? null,
    commandBufferSubmission: shadowFrame?.commandBufferSubmission ?? null,
    rendering: {
      supported:
        shadowScene.controls.receiverEnabled &&
        shadowScene.controls.casterEnabled &&
        shadowFrame?.commandBufferSubmissionReport.status === "submitted" &&
        shadowFrame.route !== null,
      mode: "directional-depth-compare",
      filter: "pcf-3x3",
      pipelineKey: shadowFrame?.route?.pipelineKey ?? null,
    },
  };
}

function createShadowEcsStatus(aperture, shadowScene) {
  const casterValues = shadowScene.casterEntities.map((entity) =>
    entity.hasComponent(aperture.ShadowCaster)
      ? entity.getValue(aperture.ShadowCaster, "enabled") !== false
      : true,
  );
  const receiverValues = shadowScene.receiverEntities.map((entity) =>
    entity.hasComponent(aperture.ShadowReceiver)
      ? entity.getValue(aperture.ShadowReceiver, "enabled") !== false
      : true,
  );

  return {
    casterEnabled:
      casterValues.length > 0 && casterValues.every((enabled) => enabled),
    receiverEnabled:
      receiverValues.length > 0 && receiverValues.every((enabled) => enabled),
    casterEntityCount: casterValues.length,
    receiverEntityCount: receiverValues.length,
    enabledCasterEntityCount: casterValues.filter(Boolean).length,
    enabledReceiverEntityCount: receiverValues.filter(Boolean).length,
  };
}

function createLightingControlStatus(aperture, scene, snapshot) {
  const ambientPacket = snapshot.lights.find(
    (light) => light.kind === aperture.LightKind.Ambient,
  );
  const pointPacket = snapshot.lights.find(
    (light) => light.kind === aperture.LightKind.Point,
  );

  return {
    controls: {
      ambientIntensity: Number(scene.lightControls.ambientIntensity.toFixed(3)),
      pointIntensity: Number(scene.lightControls.pointIntensity.toFixed(3)),
    },
    ecs: {
      ambientIntensity: Number(
        (
          scene.ambientLightEntity.getValue(aperture.Light, "intensity") ?? 0
        ).toFixed(3),
      ),
      pointIntensity: Number(
        (
          scene.pointLightEntity.getValue(aperture.Light, "intensity") ?? 0
        ).toFixed(3),
      ),
    },
    extracted: {
      ambientIntensity:
        ambientPacket === undefined
          ? null
          : Number(ambientPacket.intensity.toFixed(3)),
      pointIntensity:
        pointPacket === undefined
          ? null
          : Number(pointPacket.intensity.toFixed(3)),
    },
  };
}

function bindShadowControlInputs(aperture, scene) {
  if (shadowReceiverToggle instanceof HTMLInputElement) {
    shadowReceiverToggle.checked = shadowControls.receiverEnabled;
    shadowReceiverToggle.addEventListener("change", () => {
      setSceneShadowReceiverEnabled(
        aperture,
        scene,
        shadowReceiverToggle.checked,
      );
    });
  }

  if (shadowCasterToggle instanceof HTMLInputElement) {
    shadowCasterToggle.checked = shadowControls.casterEnabled;
    shadowCasterToggle.addEventListener("change", () => {
      setSceneShadowCasterEnabled(aperture, scene, shadowCasterToggle.checked);
    });
  }
}

function updateShadowControlInputs(scene) {
  const shadowScene = scene.active?.shadowScene ?? null;
  const hasShadowScene = shadowScene !== null;
  const receiverEnabled =
    shadowScene?.controls.receiverEnabled ?? shadowControls.receiverEnabled;
  const casterEnabled =
    shadowScene?.controls.casterEnabled ?? shadowControls.casterEnabled;

  if (shadowReceiverToggle instanceof HTMLInputElement) {
    shadowReceiverToggle.checked = receiverEnabled;
    shadowReceiverToggle.disabled = !hasShadowScene;
  }

  if (shadowCasterToggle instanceof HTMLInputElement) {
    shadowCasterToggle.checked = casterEnabled;
    shadowCasterToggle.disabled = !hasShadowScene;
  }
}

function setSceneShadowReceiverEnabled(aperture, scene, enabled) {
  shadowControls.receiverEnabled = enabled;
  const shadowScene = scene.active?.shadowScene ?? null;

  if (shadowScene !== null) {
    shadowScene.controls.receiverEnabled = enabled;
    for (const entity of shadowScene.receiverEntities) {
      setShadowReceiverComponent(aperture, entity, enabled);
    }
  }

  updateShadowControlInputs(scene);
}

function setSceneShadowCasterEnabled(aperture, scene, enabled) {
  shadowControls.casterEnabled = enabled;
  const shadowScene = scene.active?.shadowScene ?? null;

  if (shadowScene !== null) {
    shadowScene.controls.casterEnabled = enabled;
    for (const entity of shadowScene.casterEntities) {
      setShadowCasterComponent(aperture, entity, enabled);
    }
  }

  updateShadowControlInputs(scene);
}

function setShadowCasterComponent(aperture, entity, enabled) {
  if (entity.hasComponent(aperture.ShadowCaster)) {
    entity.setValue(aperture.ShadowCaster, "enabled", enabled);
    return;
  }

  entity.addComponent(aperture.ShadowCaster, { enabled });
}

function setShadowReceiverComponent(aperture, entity, enabled) {
  if (entity.hasComponent(aperture.ShadowReceiver)) {
    entity.setValue(aperture.ShadowReceiver, "enabled", enabled);
    return;
  }

  entity.addComponent(aperture.ShadowReceiver, { enabled });
}

function bindImportedCameraControlInputs(aperture, scene) {
  if (importedCameraSelect instanceof HTMLSelectElement) {
    importedCameraSelect.addEventListener("change", () => {
      const cameraIndex = integerOrNull(Number(importedCameraSelect.value));
      const importedCamera = scene.active?.importedCamera ?? null;
      const selected =
        cameraIndex === null || importedCamera === null
          ? null
          : (importedCamera.cameras.find(
              (camera) =>
                camera.status === "ready" && camera.cameraIndex === cameraIndex,
            ) ?? null);

      if (selected === null || importedCamera === null) {
        updateImportedCameraControlInputs(scene);
        return;
      }

      importedCamera.selected = selected;
      updateViewerCamera(aperture, scene);
      updateImportedCameraControlInputs(scene);
    });
  }

  if (importedCameraToggle instanceof HTMLInputElement) {
    importedCameraToggle.addEventListener("change", () => {
      scene.cameraControls.importedEnabled =
        importedCameraToggle.checked &&
        scene.active?.importedCamera?.selected !== null;
      updateViewerCamera(aperture, scene);
      updateImportedCameraControlInputs(scene);
    });
  }
}

function applyImportedCameraBootstrap(scene, importedCamera) {
  const bootstrap = scene.cameraControls.bootstrap;

  if (bootstrap?.pending !== true) {
    return;
  }

  bootstrap.pending = false;

  if (bootstrap.selectedCameraIndex !== null) {
    const selected =
      importedCamera.cameras.find(
        (camera) =>
          camera.status === "ready" &&
          camera.cameraIndex === bootstrap.selectedCameraIndex,
      ) ?? null;

    if (selected !== null) {
      importedCamera.selected = selected;
    }
  }

  scene.cameraControls.importedEnabled =
    bootstrap.importedEnabled === true && importedCamera.selected !== null;
}

function updateImportedCameraControlInputs(scene) {
  const available = scene.active?.importedCamera?.selected !== null;

  updateImportedCameraSelectControl(scene);

  if (importedCameraToggle instanceof HTMLInputElement) {
    importedCameraToggle.disabled = !available;
    importedCameraToggle.checked =
      available && scene.cameraControls.importedEnabled;
  }
}

function updateImportedCameraSelectControl(scene) {
  if (!(importedCameraSelect instanceof HTMLSelectElement)) {
    return;
  }

  const importedCamera = scene.active?.importedCamera ?? null;
  const readyCameras =
    importedCamera?.cameras.filter((camera) => camera.status === "ready") ?? [];
  importedCameraSelect.replaceChildren();

  if (readyCameras.length === 0) {
    importedCameraSelect.disabled = true;
    importedCameraSelect.append(new Option("camera", ""));
    return;
  }

  importedCameraSelect.disabled = readyCameras.length < 2;

  for (const camera of readyCameras) {
    const label =
      camera.name ??
      camera.cameraName ??
      camera.nodeName ??
      `camera ${camera.cameraIndex}`;
    importedCameraSelect.append(new Option(label, String(camera.cameraIndex)));
  }

  importedCameraSelect.value = String(
    importedCamera?.selected?.cameraIndex ?? readyCameras[0].cameraIndex,
  );
}

function bindImportedLightControlInputs(aperture, scene) {
  if (importedLightToggle instanceof HTMLInputElement) {
    importedLightToggle.checked = importedLightControls.enabled;
    importedLightToggle.addEventListener("change", () => {
      setSceneImportedLightsEnabled(
        aperture,
        scene,
        importedLightToggle.checked,
      );
    });
  }
}

function updateImportedLightControlInputs(scene) {
  const importedLights = scene.active?.importedLights ?? null;
  const available = importedLights !== null && importedLights.declaredCount > 0;
  const enabled = importedLights?.enabled ?? importedLightControls.enabled;

  if (importedLightToggle instanceof HTMLInputElement) {
    importedLightToggle.disabled = !available;
    importedLightToggle.checked = enabled;
  }
}

function setSceneImportedLightsEnabled(aperture, scene, enabled) {
  importedLightControls.enabled = enabled;
  const active = scene.active;

  if (active !== null && active.importedLights.declaredCount > 0) {
    active.importedLights.enabled = enabled;

    for (const light of active.importedLights.lights) {
      if (light.status !== "ready") {
        continue;
      }

      const entity = active.replay.entitiesByKey.get(light.entityKey) ?? null;

      if (entity === null) {
        continue;
      }

      if (enabled) {
        setImportedLightComponent(aperture, entity, light);
      } else if (entity.hasComponent(aperture.Light)) {
        entity.removeComponent(aperture.Light);
      }
    }
  }

  updateImportedLightControlInputs(scene);
}

function bindIblControlInputs(aperture, scene) {
  if (iblToggle instanceof HTMLInputElement) {
    iblToggle.checked = iblControls.enabled;
    iblToggle.addEventListener("change", () => {
      setSceneIblEnabled(aperture, scene, iblToggle.checked);
    });
  }
}

function updateIblControlInputs(scene) {
  const iblScene = scene.active?.iblScene ?? null;
  const hasIblControls = iblScene?.iblAvailable === true;
  const enabled = iblScene?.iblControls.enabled ?? iblControls.enabled;

  if (iblToggle instanceof HTMLInputElement) {
    iblToggle.checked = enabled;
    iblToggle.disabled = !hasIblControls;
  }
}

function setSceneIblEnabled(aperture, scene, enabled) {
  iblControls.enabled = enabled;
  const iblScene = scene.active?.iblScene ?? null;

  if (iblScene !== null && iblScene.iblAvailable) {
    iblScene.iblControls.enabled = enabled;

    if (iblScene.environmentEntity !== null) {
      setEnvironmentMapComponent(
        aperture,
        iblScene.environmentEntity,
        iblScene.environmentMapKey,
        enabled,
      );
    }
  }

  updateIblControlInputs(scene);
}

function setEnvironmentMapComponent(
  aperture,
  entity,
  environmentMapKey,
  enabled,
) {
  entity.setValue(
    aperture.Light,
    "environmentMapId",
    enabled ? environmentMapKey : "",
  );
  entity.setValue(aperture.Light, "intensity", enabled ? 0.52 : 0);
}

function bindAnimationControlInputs(aperture, scene) {
  if (animationClipSelect instanceof HTMLSelectElement) {
    animationClipSelect.addEventListener("change", () => {
      selectActiveAnimationClip(
        aperture,
        scene,
        Number.parseInt(animationClipSelect.value, 10),
      );
    });
  }

  if (animationToggleButton instanceof HTMLButtonElement) {
    animationToggleButton.addEventListener("click", () => {
      toggleActiveAnimationPlayback(aperture, scene);
    });
  }

  if (animationLoopSelect instanceof HTMLSelectElement) {
    animationLoopSelect.addEventListener("change", () => {
      setActiveAnimationLoopMode(aperture, scene, animationLoopSelect.value);
    });
  }

  if (animationDirectionSelect instanceof HTMLSelectElement) {
    animationDirectionSelect.addEventListener("change", () => {
      setActiveAnimationDirection(
        aperture,
        scene,
        animationDirectionSelect.value,
      );
    });
  }

  if (animationScrubInput instanceof HTMLInputElement) {
    animationScrubInput.addEventListener("input", () => {
      scrubActiveAnimation(
        aperture,
        scene,
        numberInputValue(animationScrubInput, 0),
      );
    });
  }

  if (animationSpeedInput instanceof HTMLInputElement) {
    animationSpeedInput.addEventListener("input", () => {
      setActiveAnimationSpeed(
        aperture,
        scene,
        numberInputValue(animationSpeedInput, 1),
      );
    });
  }
}

function updateAnimationControlInputs(scene) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;
  const hasAnimation = animation !== null && clip !== null;

  if (animationClipSelect instanceof HTMLSelectElement) {
    animationClipSelect.disabled = !hasAnimation || animation.clips.length < 2;
    const nextClips = animation?.clips ?? [];
    const optionsCurrent =
      animationClipSelect.options.length === nextClips.length &&
      nextClips.every(
        (entry, index) =>
          animationClipSelect.options[index]?.textContent === entry.name,
      );

    if (!optionsCurrent) {
      animationClipSelect.replaceChildren(
        ...nextClips.map((entry, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = entry.name;
          return option;
        }),
      );
    }

    animationClipSelect.value = hasAnimation
      ? String(animation.activeClipIndex)
      : "";
  }

  if (animationToggleButton instanceof HTMLButtonElement) {
    animationToggleButton.disabled = !hasAnimation;
    animationToggleButton.textContent =
      animation?.status === "paused" ? "play" : "pause";
  }

  if (animationCrossFadeButton instanceof HTMLButtonElement) {
    animationCrossFadeButton.disabled =
      !hasAnimation || (animation?.clipCount ?? 0) < 2;
  }

  if (animationLoopSelect instanceof HTMLSelectElement) {
    animationLoopSelect.disabled = !hasAnimation;
    animationLoopSelect.value = animation?.loopMode ?? "repeat";
  }

  if (animationDirectionSelect instanceof HTMLSelectElement) {
    animationDirectionSelect.disabled = !hasAnimation;
    animationDirectionSelect.value = animation?.direction ?? "forward";
  }

  if (animationScrubInput instanceof HTMLInputElement) {
    animationScrubInput.disabled = !hasAnimation;
    animationScrubInput.max =
      clip === null ? "0" : String(Number(clip.duration.toFixed(3)));
    animationScrubInput.value =
      animation === null ? "0" : String(Number(animation.time.toFixed(3)));
  }

  if (animationSpeedInput instanceof HTMLInputElement) {
    animationSpeedInput.disabled = !hasAnimation;
    animationSpeedInput.value =
      animation === null ? "1" : String(Number(animation.speed.toFixed(2)));
  }
}

function selectActiveAnimationClip(aperture, scene, clipIndex) {
  const animation = scene.active?.animation ?? null;

  if (
    animation === null ||
    !Number.isInteger(clipIndex) ||
    clipIndex < 0 ||
    clipIndex >= animation.clips.length
  ) {
    updateAnimationControlInputs(scene);
    return;
  }

  animation.activeClipIndex = clipIndex;
  animation.activeClip = animation.clips[clipIndex];
  animation.activeClipWeights = createSingleActiveAnimationClipWeights(
    animation.clips,
    clipIndex,
  );
  animation.crossFade = null;
  animation.status = "playing";
  animation.time = 0;
  animation.clamped = false;
  animation.playbackOffset =
    animation.time -
    animation.lastElapsedSeconds * animationSignedSpeed(animation);
  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  updateAnimationControlInputs(scene);
}

function toggleActiveAnimationPlayback(aperture, scene) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    updateAnimationControlInputs(scene);
    return;
  }

  if (animation.status === "paused") {
    animation.status = "playing";
    animation.clamped = false;
    animation.playbackOffset =
      animation.time -
      animation.lastElapsedSeconds * animationSignedSpeed(animation);
  } else {
    animation.status = "paused";
    updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  }

  updateAnimationControlInputs(scene);
}

function scrubActiveAnimation(aperture, scene, time) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    updateAnimationControlInputs(scene);
    return;
  }

  const duration = Math.max(0, clip.duration);
  animation.status = "paused";
  animation.time = clamp(time, 0, duration);
  animation.clamped = false;
  animation.playbackOffset =
    animation.time -
    animation.lastElapsedSeconds * animationSignedSpeed(animation);
  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  updateAnimationControlInputs(scene);
}

function setActiveAnimationSpeed(aperture, scene, speed) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    updateAnimationControlInputs(scene);
    return;
  }

  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  animation.speed = clamp(speed, 0, 2);
  animation.playbackOffset =
    animation.time -
    animation.lastElapsedSeconds * animationSignedSpeed(animation);
  updateAnimationControlInputs(scene);
}

function setActiveAnimationDirection(aperture, scene, direction) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    updateAnimationControlInputs(scene);
    return;
  }

  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  animation.direction = direction === "reverse" ? "reverse" : "forward";
  animation.clamped = false;
  animation.playbackOffset =
    animation.time -
    animation.lastElapsedSeconds * animationSignedSpeed(animation);
  updateAnimationControlInputs(scene);
}

function setActiveAnimationLoopMode(aperture, scene, loopMode) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    updateAnimationControlInputs(scene);
    return;
  }

  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  animation.loopMode = loopMode === "once" ? "once" : "repeat";
  animation.playbackOffset =
    animation.time -
    animation.lastElapsedSeconds * animationSignedSpeed(animation);
  updateAnimationControlInputs(scene);
}

function bindLightControlInputs(aperture, scene) {
  if (pointLightIntensityInput instanceof HTMLInputElement) {
    pointLightIntensityInput.value = String(scene.lightControls.pointIntensity);
    pointLightIntensityInput.addEventListener("input", () => {
      setScenePointLightIntensity(
        aperture,
        scene,
        numberInputValue(
          pointLightIntensityInput,
          scene.lightControls.pointIntensity,
        ),
      );
    });
  }

  if (ambientIntensityInput instanceof HTMLInputElement) {
    ambientIntensityInput.value = String(scene.lightControls.ambientIntensity);
    ambientIntensityInput.addEventListener("input", () => {
      setSceneAmbientIntensity(
        aperture,
        scene,
        numberInputValue(
          ambientIntensityInput,
          scene.lightControls.ambientIntensity,
        ),
      );
    });
  }
}

function setScenePointLightIntensity(aperture, scene, value) {
  scene.lightControls.pointIntensity = clamp(value, 0, 36);
  scene.pointLightEntity.setValue(
    aperture.Light,
    "intensity",
    scene.lightControls.pointIntensity,
  );
}

function setSceneAmbientIntensity(aperture, scene, value) {
  scene.lightControls.ambientIntensity = clamp(value, 0, 1);
  scene.ambientLightEntity.setValue(
    aperture.Light,
    "intensity",
    scene.lightControls.ambientIntensity,
  );
}

function numberInputValue(input, fallback) {
  const value = Number(input.value);

  return Number.isFinite(value) ? value : fallback;
}

function routedPipelineKeys(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return pipelines.flatMap((pipeline) =>
    typeof pipeline.pipelineKey === "string" ? [pipeline.pipelineKey] : [],
  );
}

function createShadowAuthoringStatus(meshDraws) {
  const casterCount = meshDraws.filter(
    (draw) => draw.castsShadow !== false,
  ).length;
  const receiverCount = meshDraws.filter(
    (draw) => draw.receivesShadow !== false,
  ).length;

  return {
    drawCount: meshDraws.length,
    casterCount,
    receiverCount,
    disabledCasterCount: meshDraws.length - casterCount,
    disabledReceiverCount: meshDraws.length - receiverCount,
  };
}

function createShadowCasterPreparedMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBufferResourceKeys: resource.vertexBuffers.map(
        (buffer) => buffer.resourceKey,
      ),
      indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
    });
  }

  return [...meshResourceByKey.values()];
}

function createShadowCasterExecutableMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBuffers: resource.vertexBuffers.map((buffer) => ({
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer,
        vertexCount: buffer.vertexCount,
      })),
      indexBuffer:
        resource.indexBuffer === undefined
          ? null
          : {
              resourceKey: resource.indexBuffer.resourceKey,
              buffer: resource.indexBuffer.buffer,
              format: resource.indexBuffer.format,
              indexCount: resource.indexBuffer.indexCount,
            },
    });
  }

  return [...meshResourceByKey.values()];
}

function resolveShadowDepthView(depthTextureResourceReport, attachment) {
  for (const resource of depthTextureResourceReport.resources) {
    if (
      resource.shadowId !== attachment.shadowId ||
      resource.lightId !== attachment.lightId
    ) {
      continue;
    }

    const attachmentView = resource.attachmentViews.find(
      (view) => view.viewKey === attachment.viewKey,
    );

    if (attachmentView !== undefined) {
      return attachmentView.view;
    }

    return resource.allocation.resource?.view ?? null;
  }

  return null;
}

function findDirectionalShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find(
      (pipeline) =>
        pipeline.pipelineKey.includes("shadowMap") &&
        !pipeline.pipelineKey.includes("pointShadowMap"),
    ) ?? null
  );
}

function createGltfAnimationState(options) {
  const parsed = parseGltfAnimationClips(options);
  const clips = parsed.clips;
  const activeClip = clips[0] ?? null;

  return {
    status: activeClip === null ? "absent" : "playing",
    clipCount: clips.length,
    clips,
    activeClipIndex: activeClip === null ? -1 : 0,
    activeClip,
    activeClipWeights: createSingleActiveAnimationClipWeights(
      clips,
      activeClip === null ? -1 : 0,
    ),
    crossFade: null,
    time: 0,
    speed: 1,
    direction: "forward",
    loopMode: "repeat",
    clamped: false,
    playbackOffset: 0,
    lastElapsedSeconds: 0,
    animatedNodes: [],
    unsupportedChannels: parsed.unsupportedChannels,
  };
}

function createGltfSkinningState({
  aperture,
  root,
  binary,
  keyPrefix,
  replay,
  primitiveMaterials,
}) {
  if (!isRecord(root)) {
    return { status: "absent", skinCount: 0, jointCount: 0, entries: [] };
  }

  const skins = arrayEntries(root.skins);
  if (skins.length === 0) {
    return { status: "absent", skinCount: 0, jointCount: 0, entries: [] };
  }

  const nodes = arrayEntries(root.nodes);
  const entries = [];
  let jointCount = 0;

  nodes.forEach((node, nodeIndex) => {
    if (!isRecord(node)) {
      return;
    }

    const skinIndex = integerOrNull(node.skin);
    const meshIndex = integerOrNull(node.mesh);
    if (skinIndex === null || meshIndex === null) {
      return;
    }

    const skin = skins[skinIndex];
    if (!isRecord(skin)) {
      return;
    }

    const jointNodeIndices = arrayEntries(skin.joints).flatMap((value) => {
      const index = integerOrNull(value);
      return index === null ? [] : [index];
    });
    const inverseBindMatrices = readSkinInverseBindMatrices({
      root,
      binary,
      skin,
      jointCount: jointNodeIndices.length,
    });
    const meshEntityKey = `${keyPrefix}:node:${nodeIndex}`;
    const meshEntity = replay.entitiesByKey.get(meshEntityKey) ?? null;
    const jointEntities = jointNodeIndices.map(
      (jointNodeIndex) =>
        replay.entitiesByKey.get(`${keyPrefix}:node:${jointNodeIndex}`) ?? null,
    );
    const resolved = arrayEntries(primitiveMaterials.resolved).filter(
      (entry) => entry.meshIndex === meshIndex,
    );

    jointCount += jointNodeIndices.length;

    for (const primitive of resolved) {
      const entityKey = `${meshEntityKey}:mesh:${meshIndex}:primitive:${primitive.primitiveIndex}`;
      const entity = replay.entitiesByKey.get(entityKey) ?? null;

      if (
        entity === null ||
        meshEntity === null ||
        jointEntities.length === 0
      ) {
        continue;
      }

      const jointMatrices = new Float32Array(jointNodeIndices.length * 16);
      for (let index = 0; index < jointNodeIndices.length; index += 1) {
        jointMatrices.set(identityMatrix(), index * 16);
      }

      if (entity.hasComponent(aperture.Skin)) {
        entity.setValue(aperture.Skin, "jointCount", jointNodeIndices.length);
        entity.setValue(
          aperture.Skin,
          "jointMatricesJson",
          JSON.stringify(Array.from(jointMatrices)),
        );
      } else {
        entity.addComponent(
          aperture.Skin,
          aperture.createSkin({ jointMatrices }),
        );
      }

      entries.push({
        skinIndex,
        nodeIndex,
        meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        entityKey,
        entity,
        meshEntity,
        jointNodeIndices,
        jointEntities,
        inverseBindMatrices,
        jointMatrices,
      });
    }
  });

  return {
    status: entries.length > 0 ? "ready" : "unsupported",
    skinCount: skins.length,
    jointCount,
    entries,
    time: 0,
    animatedJointCount: 0,
  };
}

function readSkinInverseBindMatrices({ root, binary, skin, jointCount }) {
  const accessorIndex = integerOrNull(skin.inverseBindMatrices);
  const matrices =
    accessorIndex === null
      ? []
      : readGltfFloatAccessorTuples(root, binary, accessorIndex, "MAT4");

  return Array.from({ length: jointCount }, (_, index) => {
    const matrix = matrices[index];

    return Array.isArray(matrix) && matrix.length === 16
      ? Float32Array.from(matrix)
      : identityMatrix();
  });
}

function updateProceduralSkinningAnimation(aperture, skinning, elapsedSeconds) {
  if (skinning?.status !== "ready") {
    return;
  }

  const angle = Math.sin(elapsedSeconds * 2.25) * 0.82;
  const rotation = [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];
  let animatedJointCount = 0;

  for (const entry of skinning.entries) {
    const tipJoint = entry.jointEntities[1] ?? null;

    if (tipJoint === null || !tipJoint.hasComponent(aperture.LocalTransform)) {
      continue;
    }

    tipJoint.getVectorView(aperture.LocalTransform, "rotation").set(rotation);
    animatedJointCount += 1;
  }

  skinning.time = Number(elapsedSeconds.toFixed(3));
  skinning.animatedJointCount = animatedJointCount;
}

function updateSkinningPalettesFromWorld(aperture, skinning) {
  if (skinning?.status !== "ready") {
    return;
  }

  for (const entry of skinning.entries) {
    const meshWorld = readWorldMatrix(aperture, entry.entity);
    const inverseMeshWorld = aperture.invertMat4(meshWorld, aperture.mat4());

    if (inverseMeshWorld === null) {
      continue;
    }

    for (let index = 0; index < entry.jointEntities.length; index += 1) {
      const jointEntity = entry.jointEntities[index];
      const inverseBind = entry.inverseBindMatrices[index] ?? identityMatrix();

      if (
        jointEntity === null ||
        !jointEntity.hasComponent(aperture.WorldTransform)
      ) {
        entry.jointMatrices.set(identityMatrix(), index * 16);
        continue;
      }

      const jointWorld = readWorldMatrix(aperture, jointEntity);
      const jointLocal = aperture.multiplyMat4(
        inverseMeshWorld,
        jointWorld,
        aperture.mat4(),
      );
      const palette = aperture.multiplyMat4(
        jointLocal,
        inverseBind,
        aperture.mat4(),
      );

      entry.jointMatrices.set(palette, index * 16);
    }

    entry.entity.setValue(
      aperture.Skin,
      "jointCount",
      entry.jointEntities.length,
    );
    entry.entity.setValue(
      aperture.Skin,
      "jointMatricesJson",
      JSON.stringify(Array.from(entry.jointMatrices)),
    );
  }
}

function createGltfMorphTargetState({
  aperture,
  root,
  keyPrefix,
  replay,
  primitiveMaterials,
}) {
  if (!isRecord(root)) {
    return {
      status: "absent",
      targetCount: 0,
      entries: [],
      weights: [],
      targetNames: [],
    };
  }

  const meshes = arrayEntries(root.meshes);
  if (meshes.length === 0) {
    return {
      status: "absent",
      targetCount: 0,
      entries: [],
      weights: [],
      targetNames: [],
    };
  }

  const nodes = arrayEntries(root.nodes);
  const entries = [];
  let declaredTargetCount = 0;
  let firstTargetNames = [];
  let firstWeights = [];

  nodes.forEach((node, nodeIndex) => {
    if (!isRecord(node)) {
      return;
    }

    const meshIndex = integerOrNull(node.mesh);
    if (meshIndex === null) {
      return;
    }

    const mesh = meshes[meshIndex];
    if (!isRecord(mesh)) {
      return;
    }

    const primitives = arrayEntries(mesh.primitives);
    const meshTargetNames = morphTargetNames(mesh);
    const meshWeights = morphTargetWeights(mesh.weights);
    const resolved = arrayEntries(primitiveMaterials.resolved).filter(
      (entry) => entry.meshIndex === meshIndex,
    );

    for (const primitive of resolved) {
      const primitiveIndex = integerOrNull(primitive.primitiveIndex);
      if (primitiveIndex === null) {
        continue;
      }

      const primitiveRecord = primitives[primitiveIndex];
      if (!isRecord(primitiveRecord)) {
        continue;
      }

      const targets = arrayEntries(primitiveRecord.targets);
      if (targets.length === 0) {
        continue;
      }

      const supportedTargetCount = Math.min(targets.length, 2);
      const targetNames =
        meshTargetNames.length > 0
          ? meshTargetNames.slice(0, supportedTargetCount)
          : Array.from(
              { length: supportedTargetCount },
              (_, index) => `target ${index}`,
            );
      const weights = Array.from({ length: supportedTargetCount }, (_, index) =>
        clamp(meshWeights[index] ?? 0, 0, 1),
      );
      const entityKey = `${keyPrefix}:node:${nodeIndex}:mesh:${meshIndex}:primitive:${primitiveIndex}`;
      const entity = replay.entitiesByKey.get(entityKey) ?? null;

      declaredTargetCount = Math.max(declaredTargetCount, targets.length);

      if (firstTargetNames.length === 0) {
        firstTargetNames = targetNames;
        firstWeights = weights;
      }

      if (entity === null) {
        continue;
      }

      setEntityMorphTargetWeights(aperture, entity, weights);
      entries.push({
        nodeIndex,
        meshIndex,
        primitiveIndex,
        entityKey,
        entity,
        targetCount: supportedTargetCount,
        declaredTargetCount: targets.length,
        targetNames,
        weights,
      });
    }
  });

  return {
    status:
      declaredTargetCount === 0
        ? "absent"
        : entries.length > 0
          ? "ready"
          : "unsupported",
    targetCount: declaredTargetCount,
    supportedTargetCount: Math.min(declaredTargetCount, 2),
    entries,
    weights: firstWeights,
    targetNames: firstTargetNames,
  };
}

function setSceneMorphWeight(aperture, scene, index, value) {
  const morphing = scene.active?.morphing ?? null;

  if (morphing?.status !== "ready" || !Number.isInteger(index) || index < 0) {
    return;
  }

  if (index >= (morphing.supportedTargetCount ?? morphing.targetCount)) {
    return;
  }

  const weight = clamp(finiteNumber(value, 0), 0, 1);

  while (morphing.weights.length <= index) {
    morphing.weights.push(0);
  }

  morphing.weights[index] = Number(weight.toFixed(3));

  for (const entry of morphing.entries) {
    if (index >= entry.targetCount) {
      continue;
    }

    while (entry.weights.length <= index) {
      entry.weights.push(0);
    }

    entry.weights[index] = morphing.weights[index];
    setEntityMorphTargetWeights(aperture, entry.entity, entry.weights);
  }
}

function setEntityMorphTargetWeights(aperture, entity, weights) {
  const input = aperture.createMorphTargetWeights({ weights });

  if (!entity.hasComponent(aperture.MorphTargetWeights)) {
    entity.addComponent(aperture.MorphTargetWeights, input);
    return;
  }

  entity.setValue(
    aperture.MorphTargetWeights,
    "targetCount",
    input.targetCount,
  );
  entity.setValue(
    aperture.MorphTargetWeights,
    "weightsJson",
    input.weightsJson,
  );
}

function morphTargetNames(mesh) {
  const extras = isRecord(mesh.extras) ? mesh.extras : {};
  return arrayEntries(extras.targetNames).flatMap((name, index) =>
    typeof name === "string" && name.length > 0 ? [name] : [`target ${index}`],
  );
}

function morphTargetWeights(weights) {
  return arrayEntries(weights).flatMap((weight) => {
    const value = numberOrNull(weight);
    return value === null ? [] : [value];
  });
}

function createSkinningStatus(skinning) {
  if (skinning === null) {
    return {
      status: "absent",
      skinCount: 0,
      jointCount: 0,
      skinnedEntities: 0,
    };
  }

  return {
    status: skinning.status,
    skinCount: skinning.skinCount,
    jointCount: skinning.jointCount,
    skinnedEntities: skinning.entries.length,
    animatedJointCount: skinning.animatedJointCount ?? 0,
    time: skinning.time ?? 0,
    entries: skinning.entries.map((entry) => ({
      skinIndex: entry.skinIndex,
      nodeIndex: entry.nodeIndex,
      meshIndex: entry.meshIndex,
      primitiveIndex: entry.primitiveIndex,
      entityKey: entry.entityKey,
      jointNodeIndices: entry.jointNodeIndices,
    })),
  };
}

function createMorphingStatus(morphing) {
  if (morphing === null) {
    return {
      status: "absent",
      targetCount: 0,
      supportedTargetCount: 0,
      morphedEntities: 0,
      weights: [],
      targetNames: [],
      entries: [],
    };
  }

  return {
    status: morphing.status,
    targetCount: morphing.targetCount,
    supportedTargetCount: morphing.supportedTargetCount ?? morphing.targetCount,
    morphedEntities: morphing.entries.length,
    weights: roundTuple(morphing.weights, 3),
    targetNames: morphing.targetNames,
    entries: morphing.entries.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      meshIndex: entry.meshIndex,
      primitiveIndex: entry.primitiveIndex,
      entityKey: entry.entityKey,
      targetCount: entry.targetCount,
      declaredTargetCount: entry.declaredTargetCount,
      targetNames: entry.targetNames,
      weights: roundTuple(entry.weights, 3),
    })),
  };
}

function createImportedCameraState({ root, keyPrefix, targetCanvas }) {
  if (!isRecord(root)) {
    return {
      status: "absent",
      cameras: [],
      selected: null,
    };
  }

  const cameras = arrayEntries(root.cameras);
  const nodes = arrayEntries(root.nodes);
  const importedCameras = [];

  nodes.forEach((node, nodeIndex) => {
    if (!isRecord(node)) {
      return;
    }

    const cameraIndex = integerOrNull(node.camera);
    if (cameraIndex === null) {
      return;
    }

    const camera = cameras[cameraIndex];
    if (!isRecord(camera)) {
      importedCameras.push({
        status: "invalid",
        supported: false,
        nodeIndex,
        cameraIndex,
        entityKey: `${keyPrefix}:node:${nodeIndex}`,
        name: nodeNameOrNull(node),
        nodeName: nodeNameOrNull(node),
        cameraName: null,
        projection: "unknown",
        reason: "missing-camera",
      });
      return;
    }

    importedCameras.push(
      createImportedCameraDescriptor({
        node,
        nodeIndex,
        camera,
        cameraIndex,
        keyPrefix,
        targetCanvas,
      }),
    );
  });

  const selected =
    importedCameras.find((camera) => camera.status === "ready") ?? null;

  return {
    status:
      selected !== null
        ? "ready"
        : importedCameras.length > 0
          ? "unsupported"
          : "absent",
    cameras: importedCameras,
    selected,
  };
}

function createImportedCameraDescriptor({
  node,
  nodeIndex,
  camera,
  cameraIndex,
  keyPrefix,
  targetCanvas,
}) {
  const projection = typeof camera.type === "string" ? camera.type : "unknown";
  const cameraName = nodeNameOrNull(camera);
  const nodeName = nodeNameOrNull(node);
  const base = {
    nodeIndex,
    cameraIndex,
    entityKey: `${keyPrefix}:node:${nodeIndex}`,
    name: cameraName ?? nodeName,
    nodeName,
    cameraName,
    projection,
  };

  if (projection === "perspective") {
    return createPerspectiveImportedCameraDescriptor({
      base,
      node,
      perspective: camera.perspective,
      targetCanvas,
    });
  }

  if (projection === "orthographic") {
    return createOrthographicImportedCameraDescriptor({
      base,
      node,
      orthographic: camera.orthographic,
    });
  }

  return {
    ...base,
    status: "unsupported",
    supported: false,
    reason: "missing-perspective-parameters",
  };
}

function createPerspectiveImportedCameraDescriptor({
  base,
  node,
  perspective,
  targetCanvas,
}) {
  if (!isRecord(perspective)) {
    return {
      ...base,
      status: "unsupported",
      supported: false,
      reason: "missing-perspective-parameters",
    };
  }

  const fallbackAspect = Math.max(
    0.0001,
    targetCanvas.width / Math.max(1, targetCanvas.height),
  );
  const yfov = numberOrNull(perspective.yfov);
  const near = numberOrNull(perspective.znear);

  if (yfov === null || yfov <= 0 || yfov >= Math.PI || near === null) {
    return {
      ...base,
      status: "invalid",
      supported: false,
      reason: "invalid-perspective-parameters",
    };
  }

  const aspect = numberOrNull(perspective.aspectRatio) ?? fallbackAspect;
  const far = numberOrNull(perspective.zfar) ?? 1000;

  if (aspect <= 0 || far <= near) {
    return {
      ...base,
      status: "invalid",
      supported: false,
      reason: "invalid-perspective-clip",
    };
  }

  return {
    ...base,
    status: "ready",
    supported: true,
    yfov,
    aspect,
    near,
    far,
    ...createImportedCameraTransformDescriptor(node),
  };
}

function createOrthographicImportedCameraDescriptor({
  base,
  node,
  orthographic,
}) {
  if (!isRecord(orthographic)) {
    return {
      ...base,
      status: "unsupported",
      supported: false,
      reason: "missing-orthographic-parameters",
    };
  }

  const xmag = numberOrNull(orthographic.xmag);
  const ymag = numberOrNull(orthographic.ymag);
  const near = numberOrNull(orthographic.znear);
  const far = numberOrNull(orthographic.zfar);

  if (
    xmag === null ||
    xmag <= 0 ||
    ymag === null ||
    ymag <= 0 ||
    near === null ||
    far === null
  ) {
    return {
      ...base,
      status: "invalid",
      supported: false,
      reason: "invalid-orthographic-parameters",
    };
  }

  if (far <= near) {
    return {
      ...base,
      status: "invalid",
      supported: false,
      reason: "invalid-orthographic-clip",
    };
  }

  return {
    ...base,
    status: "ready",
    supported: true,
    xmag,
    ymag,
    aspect: xmag / ymag,
    orthographicHeight: ymag * 2,
    near,
    far,
    ...createImportedCameraTransformDescriptor(node),
  };
}

function createImportedCameraTransformDescriptor(node) {
  return {
    translation: roundTuple(tupleOrDefault(node.translation, [0, 0, 0]), 4),
    rotation: roundTuple(
      normalizeAnimationValue(
        "rotation",
        tupleOrDefault(node.rotation, [0, 0, 0, 1]),
      ),
      6,
    ),
  };
}

function createImportedLightsState({
  aperture,
  root,
  keyPrefix,
  replay,
  enabled,
}) {
  if (!isRecord(root)) {
    return {
      status: "absent",
      enabled,
      declaredCount: 0,
      lights: [],
    };
  }

  const rootExtensions = isRecord(root.extensions) ? root.extensions : {};
  const punctual = isRecord(rootExtensions.KHR_lights_punctual)
    ? rootExtensions.KHR_lights_punctual
    : null;
  const lightDefs = punctual === null ? [] : arrayEntries(punctual.lights);
  const nodes = arrayEntries(root.nodes);
  const lights = [];

  nodes.forEach((node, nodeIndex) => {
    if (!isRecord(node) || !isRecord(node.extensions)) {
      return;
    }

    const nodeLight = isRecord(node.extensions.KHR_lights_punctual)
      ? node.extensions.KHR_lights_punctual
      : null;
    const lightIndex = integerOrNull(nodeLight?.light);

    if (lightIndex === null) {
      return;
    }

    const light = lightDefs[lightIndex];
    const entityKey = `${keyPrefix}:node:${nodeIndex}`;
    const entity = replay.entitiesByKey.get(entityKey) ?? null;

    if (!isRecord(light)) {
      lights.push({
        status: "invalid",
        supported: false,
        nodeIndex,
        lightIndex,
        entityKey,
        name: nodeNameOrNull(node),
        nodeName: nodeNameOrNull(node),
        lightName: null,
        kind: "unknown",
        reason: "missing-light",
        extracted: false,
      });
      return;
    }

    const descriptor = createImportedLightDescriptor({
      node,
      nodeIndex,
      light,
      lightIndex,
      entityKey,
      entity,
    });

    if (enabled && descriptor.status === "ready" && entity !== null) {
      setImportedLightComponent(aperture, entity, descriptor);
    }

    lights.push(descriptor);
  });

  const readyCount = lights.filter((light) => light.status === "ready").length;

  return {
    status:
      readyCount > 0 ? "ready" : lights.length > 0 ? "unsupported" : "absent",
    enabled,
    declaredCount: lightDefs.length,
    lights,
  };
}

function createImportedLightDescriptor({
  node,
  nodeIndex,
  light,
  lightIndex,
  entityKey,
  entity,
}) {
  const kind = importedLightKind(light.type);
  const nodeName = nodeNameOrNull(node);
  const lightName = nodeNameOrNull(light);
  const base = {
    nodeIndex,
    lightIndex,
    entityKey,
    entity:
      entity === null
        ? null
        : { index: entity.index, generation: entity.generation },
    name: lightName ?? nodeName,
    nodeName,
    lightName,
    kind: typeof light.type === "string" ? light.type : "unknown",
  };

  if (kind === null) {
    return {
      ...base,
      status: "unsupported",
      supported: false,
      reason: "unsupported-light-kind",
      extracted: false,
    };
  }

  const rawIntensity = numberOrNull(light.intensity) ?? 1;
  const intensity =
    kind === "point" || kind === "spot"
      ? rawIntensity * Math.PI * 4
      : rawIntensity;
  const range =
    kind === "point" || kind === "spot"
      ? (numberOrNull(light.range) ?? 20)
      : (numberOrNull(light.range) ?? 10);
  const spot = isRecord(light.spot) ? light.spot : {};

  return {
    ...base,
    status: entity === null ? "missing-node" : "ready",
    supported: entity !== null,
    kind,
    color: [...tupleOrDefault(light.color, [1, 1, 1]), 1],
    rawIntensity: Number(rawIntensity.toFixed(3)),
    intensity: Number(intensity.toFixed(3)),
    range: Number(range.toFixed(3)),
    innerConeAngle: Number((numberOrNull(spot.innerConeAngle) ?? 0).toFixed(3)),
    outerConeAngle: Number(
      (numberOrNull(spot.outerConeAngle) ?? Math.PI / 4).toFixed(3),
    ),
    extracted: false,
  };
}

function setImportedLightComponent(aperture, entity, light) {
  const input = {
    kind: light.kind,
    color: light.color,
    intensity: light.intensity,
    range: light.range,
    innerConeAngle: light.innerConeAngle,
    outerConeAngle: light.outerConeAngle,
    layerMask: 1,
  };

  if (!entity.hasComponent(aperture.Light)) {
    entity.addComponent(aperture.Light, input);
    return;
  }

  entity.setValue(aperture.Light, "kind", input.kind);
  entity.getVectorView(aperture.Light, "color").set(input.color);
  entity.setValue(aperture.Light, "intensity", input.intensity);
  entity.setValue(aperture.Light, "range", input.range);
  entity.setValue(aperture.Light, "innerConeAngle", input.innerConeAngle);
  entity.setValue(aperture.Light, "outerConeAngle", input.outerConeAngle);
  entity.setValue(aperture.Light, "layerMask", input.layerMask);
}

function importedLightKind(value) {
  switch (value) {
    case "directional":
    case "point":
    case "spot":
      return value;
    default:
      return null;
  }
}

function parseGltfAnimationClips({
  aperture,
  root,
  binary,
  keyPrefix,
  replay,
}) {
  if (!isRecord(root) || !Array.isArray(root.animations)) {
    return {
      clips: [],
      unsupportedChannels: [],
    };
  }

  const clips = [];
  const unsupportedChannels = [];

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

    channels.forEach((channel, channelIndex) => {
      if (!isRecord(channel) || !isRecord(channel.target)) {
        return;
      }

      const samplerIndex = integerOrNull(channel.sampler);
      const nodeIndex = integerOrNull(channel.target.node);
      const path = channel.target.path;
      const accessorType = animationAccessorTypeForPath(path);

      if (
        samplerIndex === null ||
        nodeIndex === null ||
        accessorType === null
      ) {
        return;
      }

      const sampler = samplers[samplerIndex];
      if (!isRecord(sampler)) {
        return;
      }

      const interpolation =
        typeof sampler.interpolation === "string"
          ? sampler.interpolation
          : "LINEAR";

      if (interpolation !== "LINEAR" && interpolation !== "STEP") {
        unsupportedChannels.push({
          code: "gltfAnimation.unsupportedInterpolation",
          animationIndex,
          animationName:
            typeof animation.name === "string" && animation.name.length > 0
              ? animation.name
              : null,
          channelIndex,
          samplerIndex,
          nodeIndex,
          path,
          interpolation,
          message: `GLB viewer animation channel uses ${interpolation} interpolation, which is not replayed yet.`,
        });
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
      const values = readGltfFloatAccessorTuples(
        root,
        binary,
        outputAccessor,
        accessorType,
      );
      const entityKey = `${keyPrefix}:node:${nodeIndex}`;
      const entity = replay.entitiesByKey.get(entityKey) ?? null;

      if (
        times.length < 2 ||
        times.length !== values.length ||
        entity === null ||
        !entity.hasComponent(aperture.LocalTransform)
      ) {
        return;
      }

      parsedChannels.push({
        nodeIndex,
        entityKey,
        path,
        interpolation,
        times,
        values,
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

  return {
    clips,
    unsupportedChannels,
  };
}

function updateActiveAnimation(aperture, animation, elapsedSeconds) {
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    return;
  }

  const duration = Math.max(0, clip.duration);
  animation.lastElapsedSeconds = elapsedSeconds;
  const signedSpeed = animationSignedSpeed(animation);
  const unboundedTime = elapsedSeconds * signedSpeed + animation.playbackOffset;
  const clamped =
    animation.status !== "paused" &&
    animation.loopMode === "once" &&
    duration > 0 &&
    (signedSpeed >= 0 ? unboundedTime >= duration : unboundedTime <= 0);
  const localTime =
    animation.status === "paused"
      ? clamp(animation.time, 0, duration)
      : clamped
        ? signedSpeed >= 0
          ? duration
          : 0
        : duration > 0
          ? wrapTime(unboundedTime, duration)
          : 0;
  animation.clamped = clamped;
  updateAnimationCrossFadeWeights(aperture, animation, elapsedSeconds);
  applyAnimationAtTime(aperture, animation, clip, localTime);
}

function applyAnimationAtTime(aperture, animation, clip, localTime) {
  const animatedNodes = [];
  const samples = [];
  const channelsByKey = new Map();

  for (const clipWeight of activeAnimationClipWeights(animation)) {
    const weightedClip = animation.clips[clipWeight.clipIndex] ?? null;

    if (weightedClip === null || clipWeight.weight <= 0) {
      continue;
    }

    const clipTime =
      weightedClip === clip
        ? localTime
        : animationClipLocalTime(animation, weightedClip, localTime);

    for (const channel of weightedClip.channels) {
      const value = sampleAnimationChannel(channel, clipTime);
      const key = animationChannelKey(channel.entityKey, channel.path);

      channelsByKey.set(key, channelsByKey.get(key) ?? channel);
      samples.push({
        clipId: `${clipWeight.clipIndex}:${weightedClip.name}`,
        targetId: channel.entityKey,
        path: channel.path,
        weight: clipWeight.weight,
        value,
      });
    }
  }

  const blendedChannels = aperture.blendAnimationClipSamples(samples);

  for (const blendedChannel of blendedChannels) {
    const channel = channelsByKey.get(
      animationChannelKey(blendedChannel.targetId, blendedChannel.path),
    );

    if (channel === undefined) {
      continue;
    }

    channel.entity
      .getVectorView(aperture.LocalTransform, channel.path)
      .set(blendedChannel.value);
    animatedNodes.push({
      nodeIndex: channel.nodeIndex,
      entityKey: channel.entityKey,
      path: channel.path,
      interpolation:
        blendedChannel.contributors.length > 1
          ? "BLEND"
          : channel.interpolation,
      value: roundTuple(blendedChannel.value, 3),
      weight: blendedChannel.weight,
      contributors: blendedChannel.contributors,
    });
  }

  animation.time = Number(localTime.toFixed(3));
  animation.animatedNodes = animatedNodes;
}

function startActiveAnimationCrossFade(aperture, scene, durationSeconds = 1) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null || animation.clips.length < 2) {
    updateAnimationControlInputs(scene);
    return;
  }

  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  const fromClipIndex = animation.activeClipIndex;
  const toClipIndex = (fromClipIndex + 1) % animation.clips.length;

  animation.activeClipIndex = toClipIndex;
  animation.activeClip = animation.clips[toClipIndex];
  animation.crossFade = {
    fromClipIndex,
    toClipIndex,
    startedAt: animation.lastElapsedSeconds,
    durationSeconds,
    fade: aperture.crossFadeTo(
      String(fromClipIndex),
      String(toClipIndex),
      durationSeconds,
    ),
  };
  animation.status = "playing";
  animation.clamped = false;
  animation.playbackOffset =
    animation.time -
    animation.lastElapsedSeconds * animationSignedSpeed(animation);
  updateAnimationCrossFadeWeights(
    aperture,
    animation,
    animation.lastElapsedSeconds,
  );
  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  updateAnimationControlInputs(scene);
}

function updateAnimationCrossFadeWeights(aperture, animation, elapsedSeconds) {
  const crossFade = animation.crossFade;

  if (crossFade === null || crossFade === undefined) {
    return;
  }

  const weights = aperture.sampleAnimationCrossFade(
    crossFade.fade,
    elapsedSeconds - crossFade.startedAt,
  );
  animation.activeClipWeights = animation.clips.map((_clip, clipIndex) => {
    const weight = weights.find((entry) => entry.clipId === String(clipIndex));

    return weight?.weight ?? 0;
  });

  if (elapsedSeconds - crossFade.startedAt >= crossFade.durationSeconds) {
    animation.crossFade = null;
    animation.activeClipIndex = crossFade.toClipIndex;
    animation.activeClip = animation.clips[crossFade.toClipIndex];
    animation.activeClipWeights = createSingleActiveAnimationClipWeights(
      animation.clips,
      crossFade.toClipIndex,
    );
  }
}

function createSingleActiveAnimationClipWeights(clips, activeClipIndex) {
  return clips.map((_clip, index) => (index === activeClipIndex ? 1 : 0));
}

function activeAnimationClipWeights(animation) {
  const weights = Array.isArray(animation.activeClipWeights)
    ? animation.activeClipWeights
    : [];
  const weightedClips = [];

  weights.forEach((weight, clipIndex) => {
    if (Number.isFinite(weight) && weight > 0) {
      weightedClips.push({ clipIndex, weight });
    }
  });

  if (weightedClips.length > 0) {
    return weightedClips;
  }

  return animation.activeClipIndex >= 0
    ? [{ clipIndex: animation.activeClipIndex, weight: 1 }]
    : [];
}

function animationClipLocalTime(animation, clip, localTime) {
  const duration = Math.max(0, clip.duration);

  if (duration <= 0) {
    return 0;
  }

  if (
    animation.status === "paused" ||
    animation.loopMode === "once" ||
    animation.clamped
  ) {
    return clamp(localTime, 0, duration);
  }

  return wrapTime(localTime, duration);
}

function animationChannelKey(entityKey, path) {
  return `${entityKey}\u0000${path}`;
}

function wrapTime(time, duration) {
  return duration > 0 ? ((time % duration) + duration) % duration : 0;
}

function sampleAnimationChannel(channel, time) {
  if (time <= channel.times[0]) {
    return normalizeAnimationValue(channel.path, channel.values[0]);
  }

  for (let index = 1; index < channel.times.length; index += 1) {
    const nextTime = channel.times[index];

    if (time > nextTime) {
      continue;
    }

    const previousTime = channel.times[index - 1];
    const previous = channel.values[index - 1];
    const next = channel.values[index];
    const t =
      nextTime === previousTime
        ? 0
        : (time - previousTime) / (nextTime - previousTime);

    if (channel.interpolation === "STEP") {
      return normalizeAnimationValue(channel.path, previous);
    }

    return normalizeAnimationValue(
      channel.path,
      interpolateAnimationTuple(channel.path, previous, next, t),
    );
  }

  return normalizeAnimationValue(
    channel.path,
    channel.values.at(-1) ?? defaultAnimationValue(channel.path),
  );
}

function interpolateAnimationTuple(path, previous, next, t) {
  const adjustedNext =
    path === "rotation" && quaternionDot(previous, next) < 0
      ? next.map((component) => -component)
      : next;

  return previous.map(
    (component, index) => component + (adjustedNext[index] - component) * t,
  );
}

function normalizeAnimationValue(path, value) {
  if (path !== "rotation") {
    return value;
  }

  const length = Math.hypot(value[0], value[1], value[2], value[3]);

  if (length <= 0 || !Number.isFinite(length)) {
    return [0, 0, 0, 1];
  }

  return [
    value[0] / length,
    value[1] / length,
    value[2] / length,
    value[3] / length,
  ];
}

function quaternionDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

function defaultAnimationValue(path) {
  return path === "rotation"
    ? [0, 0, 0, 1]
    : path === "scale"
      ? [1, 1, 1]
      : [0, 0, 0];
}

function animationAccessorTypeForPath(path) {
  switch (path) {
    case "translation":
    case "scale":
      return "VEC3";
    case "rotation":
      return "VEC4";
    default:
      return null;
  }
}

function createAnimationStatus(animation) {
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    return {
      status: "absent",
      clipCount: 0,
      clips: [],
      activeClipIndex: -1,
      activeClipName: null,
      activeClipWeights: [],
      crossFade: null,
      time: 0,
      speed: 1,
      direction: "forward",
      loopMode: "repeat",
      clamped: false,
      duration: 0,
      channelCount: 0,
      animatedNodes: [],
      unsupportedChannelCount: animation?.unsupportedChannels?.length ?? 0,
      unsupportedChannels: animation?.unsupportedChannels ?? [],
    };
  }

  return {
    status: animation.status,
    clipCount: animation.clipCount,
    clips: animation.clips.map((entry, index) => ({
      index,
      name: entry.name,
      duration: Number(entry.duration.toFixed(3)),
    })),
    activeClipIndex: animation.activeClipIndex,
    activeClipName: clip.name,
    activeClipWeights: activeAnimationClipWeights(animation).map(
      ({ clipIndex, weight }) => ({
        index: clipIndex,
        name: animation.clips[clipIndex]?.name ?? `Animation${clipIndex}`,
        weight: Number(weight.toFixed(3)),
      }),
    ),
    crossFade:
      animation.crossFade === null || animation.crossFade === undefined
        ? null
        : {
            fromClipIndex: animation.crossFade.fromClipIndex,
            fromClipName:
              animation.clips[animation.crossFade.fromClipIndex]?.name ??
              `Animation${animation.crossFade.fromClipIndex}`,
            toClipIndex: animation.crossFade.toClipIndex,
            toClipName:
              animation.clips[animation.crossFade.toClipIndex]?.name ??
              `Animation${animation.crossFade.toClipIndex}`,
            elapsed: Number(
              Math.max(
                0,
                animation.lastElapsedSeconds - animation.crossFade.startedAt,
              ).toFixed(3),
            ),
            duration: Number(animation.crossFade.durationSeconds.toFixed(3)),
          },
    time: animation.time,
    speed: Number(animation.speed.toFixed(2)),
    direction: animation.direction,
    loopMode: animation.loopMode,
    clamped: animation.clamped,
    duration: Number(clip.duration.toFixed(3)),
    channelCount: clip.channels.length,
    animatedNodes: animation.animatedNodes,
    unsupportedChannelCount: animation.unsupportedChannels.length,
    unsupportedChannels: animation.unsupportedChannels,
  };
}

function animationSignedSpeed(animation) {
  return animation.speed * (animation.direction === "reverse" ? -1 : 1);
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
    case "VEC4":
      return 4;
    case "MAT4":
      return 16;
    default:
      return null;
  }
}

function createHierarchyStatus(aperture, active) {
  if (active === null) {
    return { nodes: [] };
  }

  const nodes =
    loadedGltfImportReport(active.loaded)?.sceneTraversal.nodes ?? [];

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

function createImportedCameraStatus(scene) {
  const importedCamera = scene.active?.importedCamera ?? {
    status: "absent",
    cameras: [],
    selected: null,
  };
  const available = importedCamera.selected !== null;
  const enabled = available && scene.cameraControls.importedEnabled;

  return {
    status: importedCamera.status,
    controls: {
      available,
      enabled,
      readyCount: importedCamera.cameras.filter(
        (camera) => camera.status === "ready",
      ).length,
      selectedCameraIndex: importedCamera.selected?.cameraIndex ?? null,
      selectedNodeIndex: importedCamera.selected?.nodeIndex ?? null,
    },
    selected: importedCamera.selected,
    cameras: importedCamera.cameras,
  };
}

function createImportedLightsStatus(scene, snapshot) {
  const importedLights = scene.active?.importedLights ?? {
    status: "absent",
    enabled: importedLightControls.enabled,
    declaredCount: 0,
    lights: [],
  };
  const extracted = new Set(
    snapshot.lights.map(
      (light) => `${light.entity.index}:${light.entity.generation}`,
    ),
  );
  const lights = importedLights.lights.map((light) => ({
    ...light,
    extracted:
      light.entity !== null &&
      extracted.has(`${light.entity.index}:${light.entity.generation}`),
  }));
  const kindCounts = new Map();

  for (const light of lights) {
    if (light.status !== "ready") {
      continue;
    }

    kindCounts.set(light.kind, (kindCounts.get(light.kind) ?? 0) + 1);
  }

  return {
    status: importedLights.status,
    enabled: importedLights.enabled,
    declaredCount: importedLights.declaredCount,
    replayedCount: lights.filter((light) => light.status === "ready").length,
    extractedCount: lights.filter((light) => light.extracted).length,
    kinds: Array.from(kindCounts.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    lights,
  };
}

function createGltfMetadataStatus(active) {
  const glbImportReport = active?.loaded.loader?.glbImportReport ?? null;
  const importReport =
    active == null ? null : loadedGltfImportReport(active.loaded);
  const root = active?.loaded.root ?? null;

  if (!isRecord(root)) {
    return {
      status: "absent",
      counts: {
        scenes: 0,
        nodes: 0,
        meshes: 0,
        primitives: 0,
        materials: 0,
        animations: 0,
      },
      extensions: {
        used: [],
        required: [],
      },
      unsupportedFeatureDiagnostics: [],
    };
  }

  const meshes = arrayEntries(root.meshes);
  const primitives = meshes.flatMap((mesh) =>
    isRecord(mesh) ? arrayEntries(mesh.primitives) : [],
  );
  const scenes = arrayEntries(root.scenes);
  const defaultSceneIndex =
    integerOrNull(root.scene) ?? (scenes.length > 0 ? 0 : null);
  const selectedSceneIndex =
    importReport?.sceneTraversal.sceneIndex ?? defaultSceneIndex;
  const extensionsUsed = stringArray(root.extensionsUsed);
  const extensionsRequired = stringArray(root.extensionsRequired);

  return {
    status: "ready",
    counts: {
      scenes: scenes.length,
      nodes: arrayEntries(root.nodes).length,
      meshes: meshes.length,
      primitives: primitives.length,
      materials: arrayEntries(root.materials).length,
      animations: arrayEntries(root.animations).length,
    },
    scene: {
      defaultSceneIndex,
      scenes: scenes.map((scene, sceneIndex) => ({
        sceneIndex,
        name: nodeNameOrNull(scene),
        selected: sceneIndex === selectedSceneIndex,
        rootNodeIndices: sceneRootNodeIndices(scene),
      })),
    },
    extensions: {
      used: extensionsUsed,
      required: extensionsRequired,
    },
    unsupportedFeatureDiagnostics: createGltfUnsupportedFeatureDiagnostics({
      root,
      primitives,
      extensionsUsed,
      extensionsRequired,
      importReport,
      glbImportReport,
    }),
  };
}

function createGltfMeshAttributeStatus(active) {
  const importReport =
    active == null ? null : loadedGltfImportReport(active.loaded);
  const meshes = importReport?.meshConstruction?.meshes ?? [];
  const diagnostics = importReport?.meshConstruction?.diagnostics ?? [];

  return meshes
    .map((mesh) => ({
      meshIndex: mesh.meshIndex,
      primitiveIndex: mesh.primitiveIndex,
      handleKey: mesh.handleKey,
      tangentPath: createMeshTangentPathStatus(mesh, diagnostics),
      streams:
        mesh.mesh?.vertexStreams.map((stream) => ({
          id: stream.id,
          arrayStride: stream.arrayStride,
          vertexCount: stream.vertexCount,
          attributes: stream.attributes.map((attribute) => ({
            semantic: attribute.semantic,
            format: attribute.format,
            offset: attribute.offset,
          })),
        })) ?? [],
      indexBuffer:
        mesh.mesh?.indexBuffer === undefined
          ? null
          : {
              format: mesh.mesh.indexBuffer.format,
              count: mesh.mesh.indexBuffer.data.length,
            },
    }))
    .sort(
      (a, b) =>
        a.meshIndex - b.meshIndex || a.primitiveIndex - b.primitiveIndex,
    );
}

function createMeshTangentPathStatus(mesh, diagnostics) {
  const generated = diagnostics.find(
    (diagnostic) =>
      diagnostic.meshIndex === mesh.meshIndex &&
      diagnostic.primitiveIndex === mesh.primitiveIndex &&
      diagnostic.code === "gltfMeshAsset.generatedTangents",
  );
  const skipped = diagnostics.find(
    (diagnostic) =>
      diagnostic.meshIndex === mesh.meshIndex &&
      diagnostic.primitiveIndex === mesh.primitiveIndex &&
      diagnostic.code === "gltfMeshAsset.tangentGenerationSkipped",
  );
  const hasTangents =
    mesh.mesh?.vertexStreams.some((stream) =>
      stream.attributes.some((attribute) => attribute.semantic === "TANGENT"),
    ) ?? false;

  if (generated !== undefined) {
    return {
      status: "generated",
      path: generated.tangentPath ?? "generated-mesh-attribute",
      reason: generated.reason ?? null,
      diagnosticCode: generated.code,
    };
  }

  if (skipped !== undefined) {
    return {
      status: "skipped",
      path: null,
      reason: skipped.reason ?? null,
      diagnosticCode: skipped.code,
    };
  }

  if (hasTangents) {
    return {
      status: "authored",
      path: "authored-mesh-attribute",
      reason: null,
      diagnosticCode: null,
    };
  }

  return {
    status: "absent",
    path: null,
    reason: null,
    diagnosticCode: null,
  };
}

function sceneRootNodeIndices(scene) {
  if (!isRecord(scene)) {
    return [];
  }

  return arrayEntries(scene.nodes).flatMap((nodeIndex) => {
    const index = integerOrNull(nodeIndex);
    return index === null ? [] : [index];
  });
}

function createGltfUnsupportedFeatureDiagnostics(input) {
  const diagnostics = [
    ...rootExtensionDiagnostics(input.extensionsUsed, input.extensionsRequired),
    ...rootFeatureDiagnostics(input.root, input.primitives),
    ...unsupportedImportDiagnostics(input.importReport),
    ...unsupportedGlbDiagnostics(input.glbImportReport),
  ];
  const seen = new Set();

  return diagnostics.filter((diagnostic) => {
    const key = JSON.stringify(diagnostic);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function rootExtensionDiagnostics(extensionsUsed, extensionsRequired) {
  const required = new Set(extensionsRequired);
  const diagnostics = [];

  for (const extensionName of extensionsUsed) {
    if (supportedMetadataExtensions.has(extensionName)) {
      continue;
    }

    diagnostics.push({
      code: required.has(extensionName)
        ? "gltfMetadata.unsupportedRequiredExtension"
        : "gltfMetadata.unsupportedOptionalExtension",
      severity: required.has(extensionName) ? "error" : "warning",
      extensionName,
      message: `glTF extension '${extensionName}' is not handled by the current GLB viewer import path.`,
    });
  }

  return diagnostics;
}

function rootFeatureDiagnostics(root, primitives) {
  const diagnostics = [];
  const morphTargetStats = countMorphTargetPrimitives(primitives);

  if (morphTargetStats.targetCount > 2) {
    diagnostics.push({
      code: "gltfMetadata.partiallySupportedMorphTargets",
      severity: "warning",
      count: morphTargetStats.targetCount,
      targetCount: morphTargetStats.targetCount,
      primitiveCount: morphTargetStats.primitiveCount,
      message: `GLB viewer metadata detected ${morphTargetStats.targetCount} morph target(s) across ${morphTargetStats.primitiveCount} primitive(s); the current standard material path renders the first two targets.`,
    });
  }

  return diagnostics;
}

function countSkinMetadata(root, skins) {
  const accessors = arrayEntries(root.accessors);
  let jointCount = 0;
  let inverseBindMatrixCount = 0;

  for (const skin of skins) {
    if (!isRecord(skin)) {
      continue;
    }

    jointCount += arrayEntries(skin.joints).length;

    const inverseBindAccessorIndex = integerOrNull(skin.inverseBindMatrices);
    const inverseBindAccessor =
      inverseBindAccessorIndex === null
        ? null
        : accessors[inverseBindAccessorIndex];

    if (isRecord(inverseBindAccessor)) {
      inverseBindMatrixCount += integerOrZero(inverseBindAccessor.count);
    }
  }

  return {
    skinCount: skins.length,
    jointCount,
    inverseBindMatrixCount,
  };
}

function countMorphTargetPrimitives(primitives) {
  let primitiveCount = 0;
  let targetCount = 0;

  for (const primitive of primitives) {
    if (!isRecord(primitive)) {
      continue;
    }

    const targets = arrayEntries(primitive.targets);
    if (targets.length === 0) {
      continue;
    }

    primitiveCount += 1;
    targetCount += targets.length;
  }

  return { primitiveCount, targetCount };
}

function unsupportedImportDiagnostics(importReport) {
  if (importReport === null) {
    return [];
  }

  return [
    ...filterUnsupportedDiagnostics(importReport.root?.diagnostics ?? []),
    ...filterUnsupportedDiagnostics(
      importReport.meshPrimitive?.diagnostics ?? [],
    ),
    ...filterUnsupportedDiagnostics(
      importReport.accessorValidation?.diagnostics ?? [],
    ),
    ...filterUnsupportedDiagnostics(importReport.sceneTraversal.diagnostics),
    ...filterUnsupportedDiagnostics(importReport.diagnostics),
  ];
}

function unsupportedGlbDiagnostics(glbImportReport) {
  if (glbImportReport === null) {
    return [];
  }

  return [
    ...filterUnsupportedDiagnostics(glbImportReport.container.diagnostics),
    ...filterUnsupportedDiagnostics(glbImportReport.diagnostics),
  ];
}

function filterUnsupportedDiagnostics(diagnostics) {
  return diagnostics
    .filter(
      (diagnostic) =>
        isRecord(diagnostic) &&
        typeof diagnostic.code === "string" &&
        diagnostic.code.toLowerCase().includes("unsupported"),
    )
    .map((diagnostic) => ({
      code: diagnostic.code,
      severity:
        diagnostic.severity === "error" || diagnostic.severity === "warning"
          ? diagnostic.severity
          : "warning",
      message: typeof diagnostic.message === "string" ? diagnostic.message : "",
      ...diagnosticField(diagnostic, "field"),
      ...diagnosticField(diagnostic, "extensionName"),
      ...diagnosticNumberField(diagnostic, "meshIndex"),
      ...diagnosticNumberField(diagnostic, "primitiveIndex"),
      ...diagnosticNumberField(diagnostic, "accessorIndex"),
      ...diagnosticNumberField(diagnostic, "mode"),
    }));
}

function diagnosticField(diagnostic, field) {
  return typeof diagnostic[field] === "string"
    ? { [field]: diagnostic[field] }
    : {};
}

function diagnosticNumberField(diagnostic, field) {
  return typeof diagnostic[field] === "number" &&
    Number.isFinite(diagnostic[field])
    ? { [field]: diagnostic[field] }
    : {};
}

function createMaterialFamilyStatus(aperture, app, active) {
  if (active === null) {
    return [];
  }

  const counts = new Map();

  for (const material of active.primitiveMaterials.resolved) {
    const family =
      materialAssetFromHandleKey(aperture, app, material.materialHandleKey)
        ?.kind ?? "missing";

    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, count]) => ({ family, count }));
}

const materialTextureSlotNames = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
];

function createMaterialSlotSummary(aperture, app, active) {
  const summary = emptyMaterialSlotSummary();

  if (active === null) {
    return summary;
  }

  summary.materialCount = active.primitiveMaterials.resolved.length;

  for (const resolution of active.primitiveMaterials.resolved) {
    const material = materialAssetFromHandleKey(
      aperture,
      app,
      resolution.materialHandleKey,
    );

    if (material === null) {
      summary.missingMaterialCount += 1;
      continue;
    }

    summary.registeredMaterialCount += 1;
    updateAlphaModeSummary(summary.alphaModes, material.renderState.alphaMode);

    let texturedSlotCount = 0;
    let materialUsesUv1 = false;

    for (const slotName of materialTextureSlotNames) {
      const binding = materialTextureBindingForSlot(material, slotName);

      if (binding === null || binding.texture === null) {
        continue;
      }

      texturedSlotCount += 1;

      const texCoord = binding.texCoord ?? 0;
      updateTextureSlotCount(summary.textureSlots[slotName], texCoord);

      if (texCoord === 1) {
        summary.uv1Usage.textureSlots += 1;
        materialUsesUv1 = true;
      }
    }

    if (texturedSlotCount === 0) {
      summary.scalarOnlyMaterialCount += 1;
    }

    if (materialUsesUv1) {
      summary.uv1Usage.materials += 1;
    }
  }

  return summary;
}

function emptyMaterialSlotSummary() {
  return {
    materialCount: 0,
    registeredMaterialCount: 0,
    missingMaterialCount: 0,
    scalarOnlyMaterialCount: 0,
    textureSlots: Object.fromEntries(
      materialTextureSlotNames.map((slotName) => [
        slotName,
        { count: 0, uv0: 0, uv1: 0, otherUv: 0 },
      ]),
    ),
    alphaModes: {
      opaque: 0,
      mask: 0,
      blend: 0,
    },
    uv1Usage: {
      materials: 0,
      textureSlots: 0,
    },
  };
}

function updateAlphaModeSummary(alphaModes, alphaMode) {
  if (alphaMode === "opaque" || alphaMode === "mask" || alphaMode === "blend") {
    alphaModes[alphaMode] += 1;
  }
}

function updateTextureSlotCount(slotSummary, texCoord) {
  slotSummary.count += 1;

  if (texCoord === 0) {
    slotSummary.uv0 += 1;
    return;
  }

  if (texCoord === 1) {
    slotSummary.uv1 += 1;
    return;
  }

  slotSummary.otherUv += 1;
}

function materialTextureBindingForSlot(material, slotName) {
  switch (slotName) {
    case "baseColorTexture":
      return material.baseColorTexture ?? null;
    case "metallicRoughnessTexture":
      return material.kind === "standard"
        ? material.metallicRoughnessTexture
        : null;
    case "normalTexture":
      return material.kind === "standard" ? material.normalTexture : null;
    case "occlusionTexture":
      return material.kind === "standard" ? material.occlusionTexture : null;
    case "emissiveTexture":
      return material.kind === "standard" ? material.emissiveTexture : null;
    default:
      return null;
  }
}

function createPrimitiveMaterialResolutionStatus(aperture, app, active) {
  if (active === null) {
    return [];
  }

  return active.primitiveMaterials.resolved
    .map((resolution) => {
      const material = materialAssetFromHandleKey(
        aperture,
        app,
        resolution.materialHandleKey,
      );
      const renderState = material?.renderState ?? null;

      return {
        meshIndex: resolution.meshIndex,
        primitiveIndex: resolution.primitiveIndex,
        materialIndex: resolution.materialIndex,
        materialHandleKey: resolution.materialHandleKey,
        family: material?.kind ?? "missing",
        alphaMode: renderState?.alphaMode ?? null,
        alphaCutoff: renderState?.alphaCutoff ?? null,
        blendPreset: renderState?.blend?.preset ?? null,
        depthWrite: renderState?.depth?.write ?? null,
        cullMode: renderState?.cullMode ?? null,
        pipelineKey: material === null ? null : materialPipelineKey(material),
        factors: material === null ? null : materialFactorStatus(material),
        textureSlots:
          material === null
            ? null
            : materialTextureSlotStatus(aperture, app, material),
      };
    })
    .sort(
      (a, b) =>
        a.meshIndex - b.meshIndex || a.primitiveIndex - b.primitiveIndex,
    );
}

function resolveGlbViewerFallbackImageData(input) {
  if (
    input.source.kind === "uri" &&
    input.source.uri === "aperture-base-color-checker.png"
  ) {
    return {
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      sourceData: {
        bytes: new Uint8Array([
          255, 94, 82, 255, 74, 194, 255, 255, 255, 216, 90, 255, 52, 214, 145,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    };
  }

  if (
    input.source.kind === "uri" &&
    input.source.uri === "aperture-alpha-mask-checker.png"
  ) {
    return {
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      sourceData: {
        bytes: new Uint8Array([
          255, 118, 64, 255, 80, 160, 255, 0, 255, 220, 80, 0, 58, 220, 142,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    };
  }

  if (
    input.source.kind === "uri" &&
    input.source.uri === "aperture-metallic-roughness-checker.png"
  ) {
    return {
      width: 2,
      height: 2,
      format: "rgba8unorm",
      sourceData: {
        bytes: new Uint8Array([
          0, 38, 18, 255, 0, 218, 96, 255, 0, 112, 48, 255, 0, 246, 12, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    };
  }

  if (
    input.source.kind === "uri" &&
    input.source.uri === "aperture-occlusion-checker.png"
  ) {
    return {
      width: 2,
      height: 2,
      format: "rgba8unorm",
      sourceData: {
        bytes: new Uint8Array([
          255, 180, 180, 255, 64, 180, 180, 255, 160, 180, 180, 255, 24, 180,
          180, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    };
  }

  if (
    input.source.kind === "uri" &&
    input.source.uri === "aperture-normal-checker.png"
  ) {
    return {
      width: 2,
      height: 2,
      format: "rgba8unorm",
      sourceData: {
        bytes: new Uint8Array([
          255, 0, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 128, 128, 255,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    };
  }

  if (
    input.source.kind === "bufferView" &&
    input.source.mimeType === "image/png" &&
    input.image.name === "EmbeddedBaseColorChecker"
  ) {
    return {
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      sourceData: {
        bytes: new Uint8Array([
          255, 74, 74, 255, 74, 176, 255, 255, 255, 222, 78, 255, 56, 220, 142,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    };
  }

  return {
    image: null,
    diagnostics: [
      {
        code: "gltfTexture.imageResolverFailed",
        severity: "warning",
        message: `GLB viewer image '${input.source.kind === "uri" ? input.source.uri : input.source.bufferView}' has no example-local decoded image data.`,
      },
    ],
  };
}

function materialFactorStatus(material) {
  return {
    baseColorFactor:
      material.baseColorFactor === undefined
        ? null
        : roundTuple(Array.from(material.baseColorFactor), 3),
    metallicFactor:
      material.kind === "standard"
        ? Number(material.metallicFactor.toFixed(3))
        : null,
    roughnessFactor:
      material.kind === "standard"
        ? Number(material.roughnessFactor.toFixed(3))
        : null,
    normalScale:
      material.kind === "standard"
        ? Number(material.normalScale.toFixed(3))
        : null,
    occlusionStrength:
      material.kind === "standard"
        ? Number(material.occlusionStrength.toFixed(3))
        : null,
    emissiveFactor:
      material.kind === "standard"
        ? roundTuple(Array.from(material.emissiveFactor), 3)
        : null,
  };
}

function materialTextureSlotStatus(aperture, app, material) {
  return {
    baseColorTexture: textureBindingStatus(
      aperture,
      app,
      material.baseColorTexture,
    ),
    metallicRoughnessTexture: textureBindingStatus(
      aperture,
      app,
      material.metallicRoughnessTexture,
    ),
    normalTexture: textureBindingStatus(aperture, app, material.normalTexture),
    occlusionTexture: textureBindingStatus(
      aperture,
      app,
      material.occlusionTexture,
    ),
    emissiveTexture: textureBindingStatus(
      aperture,
      app,
      material.emissiveTexture,
    ),
  };
}

function textureBindingStatus(aperture, app, binding) {
  if (binding === null || binding === undefined || binding.texture === null) {
    return null;
  }

  const sampler =
    binding.sampler === null ? null : samplerStatus(app, binding.sampler);

  return {
    textureKey: aperture.assetHandleKey(binding.texture),
    samplerKey:
      binding.sampler === null
        ? null
        : aperture.assetHandleKey(binding.sampler),
    sampler,
    texCoord: binding.texCoord ?? 0,
    hasTransform: binding.transform !== undefined,
    transform: textureTransformStatus(binding.transform),
  };
}

function textureTransformStatus(transform) {
  if (transform === undefined) {
    return null;
  }

  return {
    offset:
      transform.offset === undefined ? null : roundTuple(transform.offset, 3),
    scale:
      transform.scale === undefined ? null : roundTuple(transform.scale, 3),
    rotation:
      transform.rotation === undefined
        ? null
        : Number(transform.rotation.toFixed(3)),
  };
}

function samplerStatus(app, samplerHandle) {
  const sampler = app.assets.get(samplerHandle)?.asset ?? null;

  if (sampler === null) {
    return {
      status: "missing",
    };
  }

  return {
    status: "ready",
    addressModeU: sampler.addressModeU,
    addressModeV: sampler.addressModeV,
    addressModeW: sampler.addressModeW,
    magFilter: sampler.magFilter,
    minFilter: sampler.minFilter,
    mipmapFilter: sampler.mipmapFilter,
    maxAnisotropy: sampler.maxAnisotropy,
  };
}

function createRenderStateStatus(aperture, meshDraws) {
  return {
    queues: meshDraws.map((draw) => draw.sortKey.queue),
    pipelineKeys: meshDraws.map((draw) => draw.batchKey.pipelineKey),
    draws: meshDraws.map((draw) => ({
      renderId: draw.renderId,
      meshKey: aperture.assetHandleKey(draw.mesh),
      materialKey: aperture.assetHandleKey(draw.material),
      queue: draw.sortKey.queue,
      pipelineKey: draw.batchKey.pipelineKey,
      meshLayoutKey: draw.batchKey.meshLayoutKey,
    })),
  };
}

function materialAssetFromHandleKey(aperture, app, materialHandleKey) {
  const materialId = materialHandleKey.replace(/^material:/, "");

  return (
    app.assets.get(aperture.createMaterialHandle(materialId))?.asset ?? null
  );
}

function materialPipelineKey(material) {
  return [
    material.kind,
    ...materialPipelineFeatures(material),
    material.renderState.alphaMode,
    material.renderState.cullMode,
    material.renderState.depth.compare,
    material.renderState.blend.preset,
  ].join("|");
}

function materialPipelineFeatures(material) {
  const candidates = [
    ["baseColorTexture", material.baseColorTexture],
    ["metallicRoughnessTexture", material.metallicRoughnessTexture],
    ["normalTexture", material.normalTexture],
    ["occlusionTexture", material.occlusionTexture],
    ["emissiveTexture", material.emissiveTexture],
  ];
  const features = candidates
    .filter(
      ([, binding]) =>
        binding !== null && binding !== undefined && binding.texture !== null,
    )
    .map(([field]) => field);

  if (
    material.kind === "standard" &&
    candidates.some(
      ([, binding]) =>
        binding !== null &&
        binding !== undefined &&
        binding.texture !== null &&
        binding.texCoord === 1,
    )
  ) {
    features.push("uv1");
  }

  return features.sort();
}

function createOrbitControls(targetCanvas) {
  const state = {
    yaw: 0,
    elevation: 0.28,
    distance: 3.4,
    minDistance: 1.8,
    maxDistance: 6,
    target: [0, 0, 0],
    fit: {
      status: "default",
      center: [0, 0, 0],
      size: [1, 1, 1],
      yaw: 0,
      elevation: 0.28,
      distance: 3.4,
      minDistance: 1.8,
      maxDistance: 6,
    },
    dragging: false,
    lastX: 0,
    canvasWidth: targetCanvas.width,
    canvasHeight: targetCanvas.height,
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

function updateViewerCamera(aperture, scene) {
  const selectedImportedCamera = scene.active?.importedCamera?.selected ?? null;

  if (scene.cameraControls.importedEnabled && selectedImportedCamera !== null) {
    applyImportedCamera(aperture, scene.cameraEntity, selectedImportedCamera);
    return;
  }

  applyOrbitCamera(
    aperture,
    scene.cameraEntity,
    scene.orbit,
    scene.targetCanvas,
  );
}

function applyOrbitCamera(aperture, cameraEntity, orbit, targetCanvas) {
  setCameraProjection(aperture, cameraEntity, {
    projection: "perspective",
    fovYRadians: Math.PI / 3,
    aspect: targetCanvas.width / Math.max(1, targetCanvas.height),
    near: 0.1,
    far: 100,
  });
  updateOrbitCamera(aperture, cameraEntity, orbit);
}

function applyImportedCamera(aperture, cameraEntity, importedCamera) {
  if (importedCamera.projection === "orthographic") {
    setCameraProjection(aperture, cameraEntity, {
      projection: "orthographic",
      aspect: importedCamera.aspect,
      orthographicHeight: importedCamera.orthographicHeight,
      near: importedCamera.near,
      far: importedCamera.far,
    });
  } else {
    setCameraProjection(aperture, cameraEntity, {
      projection: "perspective",
      fovYRadians: importedCamera.yfov,
      aspect: importedCamera.aspect,
      near: importedCamera.near,
      far: importedCamera.far,
    });
  }
  cameraEntity
    .getVectorView(aperture.LocalTransform, "translation")
    .set(importedCamera.translation);
  cameraEntity
    .getVectorView(aperture.LocalTransform, "rotation")
    .set(importedCamera.rotation);
  cameraEntity.getVectorView(aperture.LocalTransform, "scale").set([1, 1, 1]);
}

function setCameraProjection(aperture, cameraEntity, projection) {
  cameraEntity.setValue(aperture.Camera, "projection", projection.projection);
  if (typeof projection.fovYRadians === "number") {
    cameraEntity.setValue(
      aperture.Camera,
      "fovYRadians",
      projection.fovYRadians,
    );
  }
  cameraEntity.setValue(aperture.Camera, "aspect", projection.aspect);
  if (typeof projection.orthographicHeight === "number") {
    cameraEntity.setValue(
      aperture.Camera,
      "orthographicHeight",
      projection.orthographicHeight,
    );
  }
  cameraEntity.setValue(aperture.Camera, "near", projection.near);
  cameraEntity.setValue(aperture.Camera, "far", projection.far);
}

function updateOrbitCamera(aperture, cameraEntity, orbit) {
  const elevation = orbit.elevation ?? 0;
  const elevationDistance = Math.cos(elevation) * orbit.distance;
  const x = orbit.target[0] + Math.sin(orbit.yaw) * elevationDistance;
  const y = orbit.target[1] + Math.sin(elevation) * orbit.distance;
  const z = orbit.target[2] + Math.cos(orbit.yaw) * elevationDistance;
  const halfYaw = orbit.yaw * 0.5;
  const halfPitch = -elevation * 0.5;
  const yawSin = Math.sin(halfYaw);
  const yawCos = Math.cos(halfYaw);
  const pitchSin = Math.sin(halfPitch);
  const pitchCos = Math.cos(halfPitch);

  cameraEntity
    .getVectorView(aperture.LocalTransform, "translation")
    .set([x, y, z]);
  cameraEntity
    .getVectorView(aperture.LocalTransform, "rotation")
    .set([
      yawCos * pitchSin,
      yawSin * pitchCos,
      -yawSin * pitchSin,
      yawCos * pitchCos,
    ]);
}

function resetOrbitToFit(orbit) {
  const fit = orbit.fit;

  if (fit.status !== "ready") {
    return false;
  }

  orbit.dragging = false;
  orbit.yaw = fit.yaw;
  orbit.elevation = fit.elevation;
  orbit.distance = fit.distance;
  orbit.minDistance = fit.minDistance;
  orbit.maxDistance = fit.maxDistance;
  orbit.target = [...fit.center];
  return true;
}

function fitOrbitToReplayBounds(aperture, app, replay, orbit) {
  const bounds = computeReplayWorldBounds(aperture, app, replay);

  if (bounds === null) {
    orbit.fit = {
      status: "missing-bounds",
      center: roundTuple(orbit.target, 3),
      size: [0, 0, 0],
      yaw: Number(orbit.yaw.toFixed(4)),
      elevation: Number(orbit.elevation.toFixed(4)),
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
  const aspect = Math.max(
    1,
    (orbit.canvasWidth ?? canvas?.width ?? 1) /
      (orbit.canvasHeight ?? canvas?.height ?? 1),
  );
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
    yaw: Number(orbit.yaw.toFixed(4)),
    elevation: Number(orbit.elevation.toFixed(4)),
    distance: Number(distance.toFixed(3)),
    minDistance: Number(orbit.minDistance.toFixed(3)),
    maxDistance: Number(orbit.maxDistance.toFixed(3)),
  };

  return orbit.fit;
}

function setCameraResetEnabled(enabled) {
  if (cameraResetButton instanceof HTMLButtonElement) {
    cameraResetButton.disabled = !enabled;
  }
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

function identityMatrix() {
  return Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
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

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function arrayEntries(value) {
  return Array.isArray(value) ? value : [];
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string").sort()
    : [];
}

function tupleOrDefault(value, fallback) {
  return Array.isArray(value) &&
    value.length === fallback.length &&
    value.every((component) => Number.isFinite(component))
    ? [...value]
    : [...fallback];
}

function nodeNameOrNull(value) {
  return typeof value.name === "string" && value.name.length > 0
    ? value.name
    : null;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
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

function readInitialSampleSelection() {
  const requestedAssetId = exampleParams.get("asset")?.trim() ?? null;

  if (requestedAssetId === null || requestedAssetId.length === 0) {
    const asset = getDefaultSampleAsset();

    return {
      asset,
      status: {
        requestedAssetId: null,
        activeAssetId: asset.id,
        diagnostics: [],
      },
    };
  }

  const asset = findSampleAssetById(requestedAssetId);

  if (asset !== null) {
    return {
      asset,
      status: {
        requestedAssetId,
        activeAssetId: asset.id,
        diagnostics: [],
      },
    };
  }

  const fallback = getDefaultSampleAsset();

  return {
    asset: fallback,
    status: {
      requestedAssetId,
      activeAssetId: fallback.id,
      diagnostics: [
        {
          code: "glbViewerSelection.unknownSampleAsset",
          severity: "warning",
          requestedAssetId,
          fallbackAssetId: fallback.id,
          message: `Sample asset '${requestedAssetId}' is not available; loaded '${fallback.id}'.`,
        },
      ],
    },
  };
}

function readInitialImportedCameraControls() {
  const rawCameraIndex = exampleParams.get("camera")?.trim() ?? "";
  const selectedCameraIndex =
    rawCameraIndex.length === 0 ? null : integerOrNull(Number(rawCameraIndex));

  return {
    pending: true,
    selectedCameraIndex,
    importedEnabled: queryFlagEnabled("imported-camera"),
  };
}

function queryFlagEnabled(name) {
  const rawValue = exampleParams.get(name);

  if (rawValue === null) {
    return false;
  }

  const value = rawValue.trim().toLowerCase();

  return (
    value.length === 0 ||
    value === "1" ||
    value === "true" ||
    value === "yes" ||
    value === "on"
  );
}

function emptySampleSelectionStatus() {
  return {
    requestedAssetId: null,
    activeAssetId: null,
    diagnostics: [],
  };
}

function persistSampleAssetSelection(assetId) {
  const params = new URLSearchParams(globalThis.location.search);
  params.delete("url");
  params.delete("camera");
  params.delete("imported-camera");
  params.set("asset", assetId);

  const query = params.toString();
  const nextUrl = `${globalThis.location.pathname}${
    query.length > 0 ? `?${query}` : ""
  }${globalThis.location.hash}`;

  globalThis.history.replaceState(null, "", nextUrl);
}

function formatAssetUrl(url) {
  if (url.origin === globalThis.location.origin) {
    return url.pathname;
  }

  return url.href;
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  updateSelectedAssetSummaryPanel(status.selectedAsset);
  updateTextureGallerySummaryPanel(status.textureGallery);
  updateMaterialSlotSummaryPanel(status.selectedAsset?.materialSlotSummary);
  updateImageDecodeSummaryPanel(status.source?.imageDecode?.decoded);
  updateUnsupportedFeatureSummaryPanel({
    diagnostics: status.gltf?.metadata?.unsupportedFeatureDiagnostics,
    importedCamera: status.importedCamera,
  });
  updateAnimationSummaryPanel(status.animation);
  updateAnimationClipSummaryPanel(status.animation);
  updateAnimationNodeSummaryPanel(status.animation);
  updateAnimationChannelSummaryPanel(status.animation);
  updateMorphSummaryPanel(status.morphing);
  updateImportedCameraSummaryPanel(status.importedCamera);
  updateImportedCameraListSummaryPanel(status.importedCamera);
  updateLightingSummaryPanel({
    lighting: status.lighting,
    extraction: status.extraction,
  });
  updateMetadataSummaryPanel(status.gltf?.metadata);
  updateSceneSummaryPanel(status.gltf?.metadata?.scene);
  updateOrbitSummaryPanel(status.orbit);
  updateShadowSummaryPanel(status.shadow);
  updateShadowRequestSummaryPanel(status.shadow);
  updateIblSummaryPanel(status.ibl);
  updateIblResourceSummaryPanel(status.ibl);
  updateDrawSummaryPanel({
    selectedAsset: status.selectedAsset,
    extraction: status.extraction,
    draw: status.draw,
    renderState: status.renderState,
  });
  updateRenderStateSummaryPanel(status.renderState);
  updatePipelineTokenSummaryPanel(status.gltf?.primitiveMaterials?.resolutions);
  updateMeshDrawSummaryPanel(status.renderState?.draws);
  updatePreparedResourceReuseSummaryPanel(status.report?.resourceReuse);
  updateRenderDiagnosticSummaryPanel(status.report?.diagnosticsSummary);
  updateExtractionDiagnosticSummaryPanel(status.extraction?.diagnosticsList);
  updateImportedLightSummaryPanel(status.importedLights);
  updateImportedLightListSummaryPanel(status.importedLights);
  updatePrimitiveMaterialSummaryPanel(
    status.gltf?.primitiveMaterials?.resolutions,
  );
  updateMaterialFactorSummaryPanel(
    status.gltf?.primitiveMaterials?.resolutions,
  );
  updateMaterialAlphaSummaryPanel(status.gltf?.primitiveMaterials?.resolutions);
  updatePrimitiveTextureSlotSummaryPanel(
    status.gltf?.primitiveMaterials?.resolutions,
  );
  updateTextureHandleSummaryPanel(status.gltf?.primitiveMaterials?.resolutions);
  updateTextureSamplerSummaryPanel(
    status.gltf?.primitiveMaterials?.resolutions,
  );
  updateTextureTransformSummaryPanel(
    status.gltf?.primitiveMaterials?.resolutions,
  );
  updateSourceLoaderSummaryPanel(status.source);
  updateSourceOutputSummaryPanel(status.source?.outputSummary);
  updateHierarchySummaryPanel(status.hierarchy);
  updateReplayStageSummaryPanel(status.gltf);

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function updateSelectedAssetSummaryPanel(asset) {
  if (!(selectedAssetSummaryElement instanceof HTMLElement)) {
    return;
  }

  selectedAssetSummaryElement.replaceChildren();

  if (!isRecord(asset)) {
    selectedAssetSummaryElement.hidden = true;
    return;
  }

  selectedAssetSummaryElement.hidden = false;

  for (const row of selectedAssetSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "selected-asset-summary-row";
    element.dataset.selectedAssetSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(asset);

    element.append(label, value);
    selectedAssetSummaryElement.append(element);
  }
}

function updateMaterialSlotSummaryPanel(summary) {
  if (!(materialSlotSummaryElement instanceof HTMLElement)) {
    return;
  }

  materialSlotSummaryElement.replaceChildren();

  if (summary === undefined || summary === null) {
    materialSlotSummaryElement.hidden = true;
    return;
  }

  materialSlotSummaryElement.hidden = false;

  for (const row of materialSlotSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "material-slot-summary-row";
    element.dataset.summaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(summary);

    element.append(label, value);
    materialSlotSummaryElement.append(element);
  }
}

function updateTextureGallerySummaryPanel(gallery) {
  if (!(textureGallerySummaryElement instanceof HTMLElement)) {
    return;
  }

  textureGallerySummaryElement.replaceChildren();

  if (!isRecord(gallery)) {
    textureGallerySummaryElement.hidden = true;
    return;
  }

  textureGallerySummaryElement.hidden = false;

  for (const row of textureGallerySummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "texture-gallery-summary-row";
    element.dataset.textureGallerySummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(gallery);

    element.append(label, value);
    textureGallerySummaryElement.append(element);
  }
}

function formatTextureSlotSummary(summary, slotName) {
  const slot = summary.textureSlots[slotName];

  return `${slot.count} total, uv0 ${slot.uv0}, uv1 ${slot.uv1}, other ${slot.otherUv}`;
}

function updateImageDecodeSummaryPanel(decodedImages) {
  if (!(imageDecodeSummaryElement instanceof HTMLElement)) {
    return;
  }

  imageDecodeSummaryElement.replaceChildren();

  if (!Array.isArray(decodedImages) || decodedImages.length === 0) {
    imageDecodeSummaryElement.hidden = true;
    return;
  }

  imageDecodeSummaryElement.hidden = false;

  for (const image of decodedImages) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "image-decode-summary-row";
    element.dataset.imageDecodeRow = String(image.imageIndex);
    element.dataset.imageDecodeUri = image.uri;
    label.textContent = `image ${image.imageIndex}`;
    value.textContent = `${image.sourceKind}, ${image.uri}, ${image.mimeType}, ${image.width}x${image.height}, ${image.byteLength} bytes`;

    element.append(label, value);
    imageDecodeSummaryElement.append(element);
  }
}

function updateUnsupportedFeatureSummaryPanel({ diagnostics, importedCamera }) {
  if (!(unsupportedFeatureSummaryElement instanceof HTMLElement)) {
    return;
  }

  unsupportedFeatureSummaryElement.replaceChildren();
  const rows = createUnsupportedFeatureRows({ diagnostics, importedCamera });

  if (rows.length === 0) {
    unsupportedFeatureSummaryElement.hidden = true;
    return;
  }

  unsupportedFeatureSummaryElement.hidden = false;

  for (const row of rows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "unsupported-feature-summary-row";
    element.dataset.unsupportedFeatureRow = row.key;
    element.dataset.unsupportedFeatureCode = row.code;
    label.textContent = row.label;
    value.textContent = row.value;

    element.append(label, value);
    unsupportedFeatureSummaryElement.append(element);
  }
}

function updateMorphSummaryPanel(morphing) {
  if (!(morphSummaryElement instanceof HTMLElement)) {
    return;
  }

  morphSummaryElement.replaceChildren();

  if (!isRecord(morphing) || morphing.status === "absent") {
    morphSummaryElement.hidden = true;
    return;
  }

  morphSummaryElement.hidden = false;

  for (const row of morphSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "morph-summary-row";
    element.dataset.morphSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(morphing);

    element.append(label, value);
    morphSummaryElement.append(element);
  }
}

function createUnsupportedFeatureRows({ diagnostics, importedCamera }) {
  const rows = [];

  for (const [index, diagnostic] of arrayEntries(diagnostics).entries()) {
    if (!isRecord(diagnostic) || typeof diagnostic.code !== "string") {
      continue;
    }

    rows.push({
      key: `diagnostic-${index}`,
      code: diagnostic.code,
      label: unsupportedFeatureLabel(diagnostic.code),
      value: formatUnsupportedFeatureDetail({
        code: diagnostic.code,
        severity:
          typeof diagnostic.severity === "string"
            ? diagnostic.severity
            : "warning",
        detail: formatUnsupportedFeatureDiagnostic(diagnostic),
      }),
    });
  }

  for (const [index, camera] of arrayEntries(
    importedCamera?.cameras,
  ).entries()) {
    if (!isRecord(camera) || camera.status !== "unsupported") {
      continue;
    }

    const reason =
      typeof camera.reason === "string" ? camera.reason : "unsupported-camera";
    const projection =
      typeof camera.projection === "string" ? camera.projection : "camera";
    const name =
      typeof camera.name === "string" ? camera.name : `camera ${index}`;

    rows.push({
      key: `camera-${index}`,
      code: "glbViewer.unsupportedImportedCamera",
      label: "camera",
      value: formatUnsupportedFeatureDetail({
        code: "glbViewer.unsupportedImportedCamera",
        severity: "warning",
        detail: `${name}: ${projection}, ${reason}`,
      }),
    });
  }

  return rows;
}

function formatUnsupportedFeatureDetail({ code, severity, detail }) {
  return `code ${code}, severity ${severity}, detail ${detail}`;
}

function unsupportedFeatureLabel(code) {
  switch (code) {
    case "gltfMetadata.partiallySupportedMorphTargets":
    case "gltfMetadata.unsupportedMorphTargets":
      return "morph";
    case "gltfMetadata.unsupportedSkins":
      return "skin";
    case "gltfMesh.unsupportedPrimitiveMode":
      return "primitive";
    default:
      return "unsupported";
  }
}

function formatUnsupportedFeatureDiagnostic(diagnostic) {
  switch (diagnostic.code) {
    case "gltfMetadata.partiallySupportedMorphTargets":
    case "gltfMetadata.unsupportedMorphTargets":
      return `${diagnostic.targetCount ?? 0} targets, ${
        diagnostic.primitiveCount ?? 0
      } primitives`;
    case "gltfMetadata.unsupportedSkins":
      return `${diagnostic.skinCount ?? 0} skins, ${
        diagnostic.jointCount ?? 0
      } joints, ${diagnostic.inverseBindMatrixCount ?? 0} inverse binds`;
    case "gltfMesh.unsupportedPrimitiveMode":
      return `mesh ${diagnostic.meshIndex ?? "?"}, primitive ${
        diagnostic.primitiveIndex ?? "?"
      }, mode ${diagnostic.mode ?? "?"}`;
    default:
      return typeof diagnostic.message === "string"
        ? diagnostic.message
        : diagnostic.code;
  }
}

function updateAnimationSummaryPanel(animation) {
  if (!(animationSummaryElement instanceof HTMLElement)) {
    return;
  }

  animationSummaryElement.replaceChildren();

  if (
    !isRecord(animation) ||
    animation.status === "absent" ||
    animation.activeClipName === null
  ) {
    animationSummaryElement.hidden = true;
    return;
  }

  animationSummaryElement.hidden = false;

  for (const row of animationSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "animation-summary-row";
    element.dataset.animationSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(animation);

    element.append(label, value);
    animationSummaryElement.append(element);
  }
}

function updateAnimationClipSummaryPanel(animation) {
  if (!(animationClipSummaryElement instanceof HTMLElement)) {
    return;
  }

  animationClipSummaryElement.replaceChildren();
  const clips = arrayEntries(animation?.clips);

  if (clips.length === 0) {
    animationClipSummaryElement.hidden = true;
    return;
  }

  animationClipSummaryElement.hidden = false;

  for (const [index, clip] of clips.entries()) {
    if (!isRecord(clip)) {
      continue;
    }

    for (const row of animationClipSummaryRows) {
      const element = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const key = row.key(clip, index);

      element.className = "animation-clip-summary-row";
      element.dataset.animationClipRow = key;
      label.textContent = row.label(clip, index);
      value.textContent = row.value(clip, index);

      element.append(label, value);
      animationClipSummaryElement.append(element);
    }
  }
}

function formatAnimationClipDuration(duration) {
  return typeof duration === "number" && Number.isFinite(duration)
    ? String(duration)
    : "unknown";
}

function updateAnimationNodeSummaryPanel(animation) {
  if (!(animationNodeSummaryElement instanceof HTMLElement)) {
    return;
  }

  animationNodeSummaryElement.replaceChildren();
  const nodes = arrayEntries(animation?.animatedNodes);

  if (nodes.length === 0) {
    animationNodeSummaryElement.hidden = true;
    return;
  }

  animationNodeSummaryElement.hidden = false;

  for (const [index, node] of nodes.entries()) {
    if (!isRecord(node)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    const nodeIndex =
      typeof node.nodeIndex === "number" ? node.nodeIndex : index;

    element.className = "animation-node-summary-row";
    element.dataset.animationNodeRow = `${nodeIndex}:${formatSummaryOptionalKey(
      node.path,
    )}`;
    label.textContent = `node ${nodeIndex}`;
    value.textContent = formatAnimationNodeDescriptor(node);

    element.append(label, value);
    animationNodeSummaryElement.append(element);
  }
}

function formatAnimationNodeDescriptor(node) {
  const path = formatSummaryOptionalKey(node.path);
  const interpolation = formatSummaryOptionalKey(node.interpolation);
  const value = formatSummaryTuple(node.value);

  return `${path}, ${interpolation}, ${value}`;
}

function updateAnimationChannelSummaryPanel(animation) {
  if (!(animationChannelSummaryElement instanceof HTMLElement)) {
    return;
  }

  animationChannelSummaryElement.replaceChildren();
  const unsupportedChannels = arrayEntries(animation?.unsupportedChannels);

  if (unsupportedChannels.length === 0) {
    animationChannelSummaryElement.hidden = true;
    return;
  }

  animationChannelSummaryElement.hidden = false;
  appendAnimationChannelSummaryRow({
    key: "count",
    label: "unsupported",
    value: `${unsupportedChannels.length} channel${
      unsupportedChannels.length === 1 ? "" : "s"
    }`,
  });

  for (const [index, channel] of unsupportedChannels.entries()) {
    if (!isRecord(channel)) {
      continue;
    }

    appendAnimationChannelSummaryRow({
      key: `channel-${index}`,
      label: `channel ${channel.channelIndex ?? index}`,
      value: formatUnsupportedAnimationChannel(channel),
      channelIndex: index,
      code: channel.code,
    });
  }
}

function appendAnimationChannelSummaryRow({
  key,
  label,
  value,
  channelIndex,
  code,
}) {
  const element = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  element.className = "animation-channel-summary-row";
  element.dataset.animationChannelSummaryRow = key;

  if (channelIndex !== undefined) {
    element.dataset.animationChannelRow = String(channelIndex);
  }

  if (typeof code === "string") {
    element.dataset.animationChannelCode = code;
  }

  labelElement.textContent = label;
  valueElement.textContent = value;

  element.append(labelElement, valueElement);
  animationChannelSummaryElement.append(element);
}

function formatUnsupportedAnimationChannel(channel) {
  const path = formatSummaryOptionalKey(channel.path);
  const interpolation = formatSummaryOptionalKey(channel.interpolation);
  const nodeIndex =
    typeof channel.nodeIndex === "number" ? channel.nodeIndex : "unknown";
  const samplerIndex =
    typeof channel.samplerIndex === "number" ? channel.samplerIndex : "unknown";

  return `${path}, ${interpolation}, node ${nodeIndex}, sampler ${samplerIndex}`;
}

function updateImportedCameraSummaryPanel(importedCamera) {
  if (!(importedCameraSummaryElement instanceof HTMLElement)) {
    return;
  }

  importedCameraSummaryElement.replaceChildren();

  if (!isRecord(importedCamera) || !isRecord(importedCamera.selected)) {
    importedCameraSummaryElement.hidden = true;
    return;
  }

  importedCameraSummaryElement.hidden = false;

  for (const row of importedCameraSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "imported-camera-summary-row";
    element.dataset.importedCameraSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(importedCamera);

    element.append(label, value);
    importedCameraSummaryElement.append(element);
  }
}

function updateImportedCameraListSummaryPanel(importedCamera) {
  if (!(importedCameraListSummaryElement instanceof HTMLElement)) {
    return;
  }

  importedCameraListSummaryElement.replaceChildren();
  const cameras = arrayEntries(importedCamera?.cameras);

  if (cameras.length === 0) {
    importedCameraListSummaryElement.hidden = true;
    return;
  }

  importedCameraListSummaryElement.hidden = false;

  for (const [index, camera] of cameras.entries()) {
    if (!isRecord(camera)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    const cameraIndex =
      typeof camera.cameraIndex === "number" ? camera.cameraIndex : index;

    element.className = "imported-camera-list-summary-row";
    element.dataset.importedCameraListRow = String(cameraIndex);
    label.textContent = `camera ${cameraIndex}`;
    value.textContent = formatImportedCameraListDescriptor(camera, index);

    element.append(label, value);
    importedCameraListSummaryElement.append(element);
  }
}

function formatImportedCameraListDescriptor(camera, index) {
  const cameraIndex =
    typeof camera.cameraIndex === "number" ? camera.cameraIndex : index;
  const nodeIndex =
    typeof camera.nodeIndex === "number" ? camera.nodeIndex : "unknown";
  const name = formatSummaryOptionalKey(
    camera.name ?? camera.cameraName ?? camera.nodeName,
  );
  const projection = formatSummaryOptionalKey(camera.projection);
  const status = formatSummaryOptionalKey(camera.status);
  const reason =
    typeof camera.reason === "string" && camera.reason.length > 0
      ? `, ${camera.reason}`
      : "";

  return `${name}, ${projection}, ${status}, node ${nodeIndex}, camera ${cameraIndex}${reason}`;
}

function updateLightingSummaryPanel(summary) {
  if (!(lightSummaryElement instanceof HTMLElement)) {
    return;
  }

  lightSummaryElement.replaceChildren();

  if (!isRecord(summary.lighting)) {
    lightSummaryElement.hidden = true;
    return;
  }

  lightSummaryElement.hidden = false;

  for (const row of lightingSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "light-summary-row";
    element.dataset.lightSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(summary);

    element.append(label, value);
    lightSummaryElement.append(element);
  }
}

function formatOptionalLightIntensity(value) {
  return typeof value === "number" ? String(value) : "none";
}

function updateMetadataSummaryPanel(metadata) {
  if (!(metadataSummaryElement instanceof HTMLElement)) {
    return;
  }

  metadataSummaryElement.replaceChildren();

  if (
    !isRecord(metadata) ||
    !isRecord(metadata.counts) ||
    !isRecord(metadata.extensions)
  ) {
    metadataSummaryElement.hidden = true;
    return;
  }

  metadataSummaryElement.hidden = false;

  for (const row of metadataSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "metadata-summary-row";
    element.dataset.metadataSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(metadata);

    element.append(label, value);
    metadataSummaryElement.append(element);
  }
}

function updateSceneSummaryPanel(scene) {
  if (!(sceneSummaryElement instanceof HTMLElement)) {
    return;
  }

  sceneSummaryElement.replaceChildren();

  if (!isRecord(scene) || !Array.isArray(scene.scenes)) {
    sceneSummaryElement.hidden = true;
    return;
  }

  sceneSummaryElement.hidden = false;

  for (const row of sceneSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "scene-summary-row";
    element.dataset.sceneSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(scene);

    element.append(label, value);
    sceneSummaryElement.append(element);
  }
}

function selectedSceneStatus(scene) {
  return arrayEntries(scene?.scenes).find(
    (candidate) => isRecord(candidate) && candidate.selected === true,
  );
}

function updateOrbitSummaryPanel(orbit) {
  if (!(orbitSummaryElement instanceof HTMLElement)) {
    return;
  }

  orbitSummaryElement.replaceChildren();

  if (!isRecord(orbit) || !isRecord(orbit.fit)) {
    orbitSummaryElement.hidden = true;
    return;
  }

  orbitSummaryElement.hidden = false;

  for (const row of orbitSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "orbit-summary-row";
    element.dataset.orbitSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(orbit);

    element.append(label, value);
    orbitSummaryElement.append(element);
  }
}

function formatSummaryTuple(values) {
  return Array.isArray(values)
    ? values.map((value) => Number(value.toFixed(3))).join(", ")
    : "none";
}

function updateShadowSummaryPanel(shadow) {
  if (!(shadowSummaryElement instanceof HTMLElement)) {
    return;
  }

  shadowSummaryElement.replaceChildren();

  if (
    !isRecord(shadow) ||
    shadow.enabled !== true ||
    !isRecord(shadow.controls) ||
    !isRecord(shadow.ecs) ||
    !isRecord(shadow.authoring) ||
    !isRecord(shadow.rendering)
  ) {
    shadowSummaryElement.hidden = true;
    return;
  }

  shadowSummaryElement.hidden = false;

  for (const row of shadowSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "shadow-summary-row";
    element.dataset.shadowSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(shadow);

    element.append(label, value);
    shadowSummaryElement.append(element);
  }
}

function updateShadowRequestSummaryPanel(shadow) {
  if (!(shadowRequestSummaryElement instanceof HTMLElement)) {
    return;
  }

  shadowRequestSummaryElement.replaceChildren();
  const requests = arrayEntries(shadow?.requests);

  if (!isRecord(shadow) || requests.length === 0) {
    shadowRequestSummaryElement.hidden = true;
    return;
  }

  shadowRequestSummaryElement.hidden = false;

  for (const [index, request] of requests.entries()) {
    if (!isRecord(request)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "shadow-request-summary-row";
    element.dataset.shadowRequestRow = String(index);
    label.textContent = `request ${index}`;
    value.textContent = formatShadowRequestDescriptor(shadow, request);

    element.append(label, value);
    shadowRequestSummaryElement.append(element);
  }
}

function formatShadowRequestDescriptor(shadow, request) {
  const mode = formatSummaryOptionalKey(shadow.rendering?.mode);
  const supported = shadow.rendering?.supported === true;
  const casters = shadow.authoring?.casterCount ?? 0;
  const receivers = shadow.authoring?.receiverCount ?? 0;
  const shadowId = formatSummaryOptionalKey(request.shadowId);
  const lightId = formatSummaryOptionalKey(request.lightId);

  return `${mode}, supported ${supported}, casters ${casters}, receivers ${receivers}, shadow ${shadowId}, light ${lightId}`;
}

function updateIblSummaryPanel(ibl) {
  if (!(iblSummaryElement instanceof HTMLElement)) {
    return;
  }

  iblSummaryElement.replaceChildren();

  if (
    !isRecord(ibl) ||
    !isRecord(ibl.controls) ||
    ibl.controls.available !== true ||
    !isRecord(ibl.ecs) ||
    !isRecord(ibl.resources) ||
    !isRecord(ibl.rendering)
  ) {
    iblSummaryElement.hidden = true;
    return;
  }

  iblSummaryElement.hidden = false;

  for (const row of iblSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "ibl-summary-row";
    element.dataset.iblSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(ibl);

    element.append(label, value);
    iblSummaryElement.append(element);
  }
}

function updateIblResourceSummaryPanel(ibl) {
  if (!(iblResourceSummaryElement instanceof HTMLElement)) {
    return;
  }

  iblResourceSummaryElement.replaceChildren();

  if (!isRecord(ibl) || !isRecord(ibl.resources) || !isRecord(ibl.rendering)) {
    iblResourceSummaryElement.hidden = true;
    return;
  }

  iblResourceSummaryElement.hidden = false;

  for (const row of iblResourceSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "ibl-resource-summary-row";
    element.dataset.iblResourceSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(ibl);

    element.append(label, value);
    iblResourceSummaryElement.append(element);
  }
}

function formatSummaryOptionalKey(value) {
  return value === null || value === undefined || value === ""
    ? "none"
    : String(value);
}

function formatIblPipelineToken(pipelineKey, token) {
  return typeof pipelineKey === "string" && pipelineKey.includes(token)
    ? token
    : "none";
}

function updateDrawSummaryPanel(summary) {
  if (!(drawSummaryElement instanceof HTMLElement)) {
    return;
  }

  drawSummaryElement.replaceChildren();

  if (
    !isRecord(summary.selectedAsset) ||
    !isRecord(summary.extraction) ||
    !isRecord(summary.draw) ||
    !isRecord(summary.renderState) ||
    !Array.isArray(summary.selectedAsset.materialFamilies) ||
    !Array.isArray(summary.renderState.queues) ||
    !Array.isArray(summary.renderState.pipelineKeys)
  ) {
    drawSummaryElement.hidden = true;
    return;
  }

  drawSummaryElement.hidden = false;

  for (const row of drawSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "draw-summary-row";
    element.dataset.drawSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(summary);

    element.append(label, value);
    drawSummaryElement.append(element);
  }
}

function formatMaterialFamilySummary(families) {
  const rows = arrayEntries(families)
    .filter((family) => isRecord(family) && typeof family.family === "string")
    .map((family) => `${family.family} ${family.count ?? 0}`);

  return rows.length === 0 ? "none" : rows.join(", ");
}

function formatCountSummary(values) {
  const counts = new Map();

  for (const value of arrayEntries(values)) {
    if (typeof value !== "string") {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts.size === 0
    ? "none"
    : Array.from(counts, ([key, count]) => `${key} ${count}`).join(", ");
}

function formatPipelineKeySummary(pipelineKeys) {
  const uniqueKeys = uniquePipelineKeys(pipelineKeys);

  return uniqueKeys.length === 0 ? "none" : uniqueKeys.join(" | ");
}

function updateRenderStateSummaryPanel(renderState) {
  if (!(renderStateSummaryElement instanceof HTMLElement)) {
    return;
  }

  renderStateSummaryElement.replaceChildren();

  if (
    !isRecord(renderState) ||
    !Array.isArray(renderState.queues) ||
    !Array.isArray(renderState.pipelineKeys)
  ) {
    renderStateSummaryElement.hidden = true;
    return;
  }

  renderStateSummaryElement.hidden = false;

  for (const row of renderStateSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "render-state-summary-row";
    element.dataset.renderStateSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(renderState);

    element.append(label, value);
    renderStateSummaryElement.append(element);
  }
}

function uniquePipelineKeys(pipelineKeys) {
  return Array.from(
    new Set(
      arrayEntries(pipelineKeys).filter((key) => typeof key === "string"),
    ),
  );
}

function updatePipelineTokenSummaryPanel(resolutions) {
  if (!(pipelineTokenSummaryElement instanceof HTMLElement)) {
    return;
  }

  pipelineTokenSummaryElement.replaceChildren();

  for (const resolution of arrayEntries(resolutions)) {
    if (!isRecord(resolution) || typeof resolution.pipelineKey !== "string") {
      continue;
    }

    const tokens = parsePipelineKeyTokens(resolution.pipelineKey);

    if (tokens === null) {
      continue;
    }

    const meshIndex = resolution.meshIndex ?? "?";
    const primitiveIndex = resolution.primitiveIndex ?? "?";
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "pipeline-token-summary-row";
    element.dataset.pipelineTokenRow = `${meshIndex}:${primitiveIndex}`;
    element.dataset.pipelineTokenFamily = tokens.family;
    label.textContent = `mesh ${meshIndex} prim ${primitiveIndex}`;
    value.textContent = formatPipelineTokenDescriptor(tokens);

    element.append(label, value);
    pipelineTokenSummaryElement.append(element);
  }

  pipelineTokenSummaryElement.hidden =
    pipelineTokenSummaryElement.childElementCount === 0;
}

function parsePipelineKeyTokens(pipelineKey) {
  const parts = pipelineKey.split("|");

  if (parts.length < 5) {
    return null;
  }

  return {
    family: parts[0],
    features: parts.slice(1, -4),
    alpha: parts.at(-4),
    cull: parts.at(-3),
    depth: parts.at(-2),
    blend: parts.at(-1),
  };
}

function formatPipelineTokenDescriptor(tokens) {
  const features =
    tokens.features.length === 0 ? "none" : tokens.features.join(",");

  return `family ${tokens.family}, features ${features}, alpha ${tokens.alpha}, cull ${tokens.cull}, depth ${tokens.depth}, blend ${tokens.blend}`;
}

function updateMeshDrawSummaryPanel(draws) {
  if (!(meshDrawSummaryElement instanceof HTMLElement)) {
    return;
  }

  meshDrawSummaryElement.replaceChildren();

  for (const draw of arrayEntries(draws)) {
    if (!isRecord(draw) || typeof draw.renderId !== "number") {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "mesh-draw-summary-row";
    element.dataset.meshDrawRow = String(draw.renderId);
    label.textContent = `draw ${draw.renderId}`;
    value.textContent = formatMeshDrawDescriptor(draw);

    element.append(label, value);
    meshDrawSummaryElement.append(element);
  }

  meshDrawSummaryElement.hidden =
    meshDrawSummaryElement.childElementCount === 0;
}

function formatMeshDrawDescriptor(draw) {
  return `render ${formatSummaryOptionalKey(
    draw.renderId,
  )}, mesh ${formatSummaryOptionalKey(
    draw.meshKey,
  )}, material ${formatSummaryOptionalKey(
    draw.materialKey,
  )}, queue ${formatSummaryOptionalKey(
    draw.queue,
  )}, pipeline ${formatSummaryOptionalKey(draw.pipelineKey)}`;
}

const preparedResourceReuseSummaryRows = [
  {
    key: "mesh-buffers",
    label: "mesh buffers",
    value: (reuse) =>
      `buffers ${formatReuseCount(reuse.meshBuffersCreated)}/${formatReuseCount(
        reuse.meshBuffersReused,
      )}, prepared ${formatReuseCount(
        reuse.preparedMeshBuffersCreated,
      )}/${formatReuseCount(
        reuse.preparedMeshBuffersReused,
      )}, facade ${arrayEntries(reuse.preparedMeshFacade?.entries).length}`,
  },
  {
    key: "material-buffers",
    label: "material buffers",
    value: (reuse) =>
      `buffers ${formatReuseCount(
        reuse.materialBuffersCreated,
      )}/${formatReuseCount(
        reuse.materialBuffersReused,
      )}, prepared ${formatReuseCount(
        reuse.preparedMaterialBuffersCreated,
      )}/${formatReuseCount(
        reuse.preparedMaterialBuffersReused,
      )}, facade ${arrayEntries(reuse.preparedMaterialFacade?.entries).length}`,
  },
  {
    key: "bind-groups",
    label: "bind groups",
    value: (reuse) =>
      `frame ${formatReuseCount(reuse.bindGroupsCreated)}/${formatReuseCount(
        reuse.bindGroupsReused,
      )}, material ${formatReuseCount(
        reuse.preparedMaterialBindGroupsCreated,
      )}/${formatReuseCount(reuse.preparedMaterialBindGroupsReused)}`,
  },
  {
    key: "textures",
    label: "textures",
    value: (reuse) =>
      `resources ${formatReuseCount(
        reuse.textureResourcesCreated,
      )}/${formatReuseCount(reuse.textureResourcesReused)}`,
  },
  {
    key: "samplers",
    label: "samplers",
    value: (reuse) =>
      `resources ${formatReuseCount(
        reuse.samplerResourcesCreated,
      )}/${formatReuseCount(reuse.samplerResourcesReused)}`,
  },
];

function updatePreparedResourceReuseSummaryPanel(reuse) {
  if (!(preparedResourceReuseSummaryElement instanceof HTMLElement)) {
    return;
  }

  preparedResourceReuseSummaryElement.replaceChildren();

  if (!isRecord(reuse)) {
    preparedResourceReuseSummaryElement.hidden = true;
    return;
  }

  preparedResourceReuseSummaryElement.hidden = false;

  for (const row of preparedResourceReuseSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "prepared-resource-reuse-summary-row";
    element.dataset.preparedResourceReuseRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(reuse);

    element.append(label, value);
    preparedResourceReuseSummaryElement.append(element);
  }
}

function formatReuseCount(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "0";
}

function updateRenderDiagnosticSummaryPanel(summary) {
  if (!(renderDiagnosticSummaryElement instanceof HTMLElement)) {
    return;
  }

  renderDiagnosticSummaryElement.replaceChildren();

  if (!isRecord(summary)) {
    renderDiagnosticSummaryElement.hidden = true;
    return;
  }

  if (isRecord(summary.materialQueue)) {
    appendRenderDiagnosticSummaryRow({
      key: "materialQueue",
      label: "material queue",
      value: formatMaterialQueueDiagnosticSummary(summary.materialQueue),
    });
  }

  if (isRecord(summary.routedResourceSet)) {
    appendRenderDiagnosticSummaryRow({
      key: "routedResourceSet",
      label: "routed resources",
      value: formatRoutedResourceDiagnosticSummary(summary.routedResourceSet),
    });
  }

  if (isRecord(summary.directLighting)) {
    appendRenderDiagnosticSummaryRow({
      key: "directLighting",
      label: "direct lighting",
      value: formatDirectLightingDiagnosticSummary(summary.directLighting),
    });
  }

  if (isRecord(summary.builtInAppResourceAdapters)) {
    appendRenderDiagnosticSummaryRow({
      key: "builtInAppResourceAdapters",
      label: "built-in adapters",
      value: formatBuiltInAdapterDiagnosticSummary(
        summary.builtInAppResourceAdapters,
      ),
    });
  }

  renderDiagnosticSummaryElement.hidden =
    renderDiagnosticSummaryElement.childElementCount === 0;
}

function appendRenderDiagnosticSummaryRow(row) {
  const element = document.createElement("div");
  const label = document.createElement("span");
  const value = document.createElement("strong");

  element.className = "render-diagnostic-summary-row";
  element.dataset.renderDiagnosticRow = row.key;
  label.textContent = row.label;
  value.textContent = row.value;

  element.append(label, value);
  renderDiagnosticSummaryElement.append(element);
}

function formatMaterialQueueDiagnosticSummary(queue) {
  return `${formatReuseCount(queue.itemCount)} items, phases ${formatBucketCounts(
    queue.byPhase,
    "phase",
  )}, families ${formatBucketCounts(queue.byFamily, "family")}`;
}

function formatRoutedResourceDiagnosticSummary(resources) {
  return `${formatReuseCount(
    resources.itemCount,
  )} items, families ${formatBucketCounts(
    resources.byFamily,
    "family",
  )}, pipelines ${arrayEntries(resources.byPipeline).length}`;
}

function formatDirectLightingDiagnosticSummary(lighting) {
  const counts = isRecord(lighting.lightCounts) ? lighting.lightCounts : {};
  const sections = isRecord(lighting.sections) ? lighting.sections : {};

  return `ready ${lighting.ready === true}, direct ${formatReuseCount(
    counts.direct,
  )}, ambient ${formatReuseCount(
    counts.ambient,
  )}, resources ${sections.lightGpuBuffers === true}/${
    sections.lightBindGroup === true
  }`;
}

function formatBuiltInAdapterDiagnosticSummary(adapters) {
  return `valid ${adapters.valid === true}, registered ${
    arrayEntries(adapters.registeredFamilies).length
  }, expected ${
    arrayEntries(adapters.expectedFamilies).length
  }, diagnostics ${arrayEntries(adapters.diagnostics).length}`;
}

function formatBucketCounts(buckets, key) {
  const rows = arrayEntries(buckets)
    .filter((bucket) => isRecord(bucket) && typeof bucket[key] === "string")
    .map((bucket) => `${bucket[key]} ${formatReuseCount(bucket.itemCount)}`);

  return rows.length === 0 ? "none" : rows.join(", ");
}

function updateExtractionDiagnosticSummaryPanel(diagnostics) {
  if (!(extractionDiagnosticSummaryElement instanceof HTMLElement)) {
    return;
  }

  extractionDiagnosticSummaryElement.replaceChildren();

  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    extractionDiagnosticSummaryElement.hidden = true;
    return;
  }

  extractionDiagnosticSummaryElement.hidden = false;

  for (const [index, diagnostic] of diagnostics.entries()) {
    if (!isRecord(diagnostic)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "extraction-diagnostic-summary-row";
    element.dataset.extractionDiagnosticRow = String(index);
    element.dataset.extractionDiagnosticCode = formatSummaryOptionalKey(
      diagnostic.code,
    );
    label.textContent = `diagnostic ${index + 1}`;
    value.textContent = formatExtractionDiagnostic(diagnostic);

    element.append(label, value);
    extractionDiagnosticSummaryElement.append(element);
  }

  if (extractionDiagnosticSummaryElement.childElementCount === 0) {
    extractionDiagnosticSummaryElement.hidden = true;
  }
}

function formatExtractionDiagnostic(diagnostic) {
  const code = formatSummaryOptionalKey(diagnostic.code);
  const field = formatSummaryOptionalKey(diagnostic.field);
  const texCoord = formatSummaryOptionalKey(diagnostic.texCoord);
  const material = formatDiagnosticContextKey(diagnostic.materialKey);
  const mesh = formatDiagnosticContextKey(diagnostic.meshKey);
  const texture = formatDiagnosticContextKey(diagnostic.textureKey);

  return `${code}, field ${field}, texCoord ${texCoord}, material ${material}, mesh ${mesh}, texture ${texture}`;
}

function formatDiagnosticContextKey(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "none";
  }

  const parts = value.split(":");

  return parts.slice(Math.max(0, parts.length - 2)).join(":");
}

function updateImportedLightSummaryPanel(importedLights) {
  if (!(importedLightSummaryElement instanceof HTMLElement)) {
    return;
  }

  importedLightSummaryElement.replaceChildren();

  if (
    !isRecord(importedLights) ||
    importedLights.declaredCount <= 0 ||
    !Array.isArray(importedLights.lights) ||
    !Array.isArray(importedLights.kinds)
  ) {
    importedLightSummaryElement.hidden = true;
    return;
  }

  importedLightSummaryElement.hidden = false;

  for (const row of importedLightSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "imported-light-summary-row";
    element.dataset.importedLightSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value({ importedLights });

    element.append(label, value);
    importedLightSummaryElement.append(element);
  }
}

function updateImportedLightListSummaryPanel(importedLights) {
  if (!(importedLightListSummaryElement instanceof HTMLElement)) {
    return;
  }

  importedLightListSummaryElement.replaceChildren();
  const lights = arrayEntries(importedLights?.lights);

  if (lights.length === 0) {
    importedLightListSummaryElement.hidden = true;
    return;
  }

  importedLightListSummaryElement.hidden = false;

  for (const [index, light] of lights.entries()) {
    if (!isRecord(light)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    const lightIndex =
      typeof light.lightIndex === "number" ? light.lightIndex : index;

    element.className = "imported-light-list-summary-row";
    element.dataset.importedLightListRow = String(lightIndex);
    label.textContent = `light ${lightIndex}`;
    value.textContent = formatImportedLightListDescriptor(light, index);

    element.append(label, value);
    importedLightListSummaryElement.append(element);
  }
}

function formatImportedLightKinds(importedLights) {
  const rows = arrayEntries(importedLights.kinds)
    .filter((entry) => isRecord(entry) && typeof entry.kind === "string")
    .map((entry) => `${entry.kind} ${entry.count ?? 0}`);

  return rows.length === 0 ? "none" : rows.join(", ");
}

function formatImportedLightDescriptor(light) {
  if (!isRecord(light)) {
    return "none";
  }

  const name = formatSummaryOptionalKey(light.name ?? light.nodeName);
  const kind = formatSummaryOptionalKey(light.kind);
  const extracted = light.extracted === true;
  const intensity =
    typeof light.rawIntensity === "number" ? light.rawIntensity : "none";
  const range = typeof light.range === "number" ? light.range : "none";

  return `${name}: ${kind}, extracted ${extracted}, intensity ${intensity}, range ${range}`;
}

function formatImportedLightListDescriptor(light, index) {
  const lightIndex =
    typeof light.lightIndex === "number" ? light.lightIndex : index;
  const nodeIndex =
    typeof light.nodeIndex === "number" ? light.nodeIndex : "unknown";
  const name = formatSummaryOptionalKey(
    light.name ?? light.lightName ?? light.nodeName,
  );
  const kind = formatSummaryOptionalKey(light.kind);
  const extracted = light.extracted === true;
  const intensity =
    typeof light.rawIntensity === "number" ? light.rawIntensity : "none";
  const range = typeof light.range === "number" ? light.range : "none";

  return `${name}: ${kind}, extracted ${extracted}, node ${nodeIndex}, light ${lightIndex}, intensity ${intensity}, range ${range}`;
}

function updatePrimitiveMaterialSummaryPanel(resolutions) {
  if (!(primitiveMaterialSummaryElement instanceof HTMLElement)) {
    return;
  }

  primitiveMaterialSummaryElement.replaceChildren();

  if (!Array.isArray(resolutions) || resolutions.length === 0) {
    primitiveMaterialSummaryElement.hidden = true;
    return;
  }

  primitiveMaterialSummaryElement.hidden = false;

  for (const resolution of resolutions) {
    if (!isRecord(resolution)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    const meshIndex = resolution.meshIndex ?? "?";
    const primitiveIndex = resolution.primitiveIndex ?? "?";

    element.className = "primitive-material-summary-row";
    element.dataset.primitiveMaterialRow = `${meshIndex}:${primitiveIndex}`;
    label.textContent = `mesh ${meshIndex} prim ${primitiveIndex}`;
    value.textContent = formatPrimitiveMaterialResolution(resolution);

    element.append(label, value);
    primitiveMaterialSummaryElement.append(element);
  }

  if (primitiveMaterialSummaryElement.childElementCount === 0) {
    primitiveMaterialSummaryElement.hidden = true;
  }
}

function formatPrimitiveMaterialResolution(resolution) {
  const materialIndex =
    typeof resolution.materialIndex === "number"
      ? resolution.materialIndex
      : "none";
  const family = formatSummaryOptionalKey(resolution.family);
  const alphaMode = formatSummaryOptionalKey(resolution.alphaMode);
  const pipelineKey = formatSummaryOptionalKey(resolution.pipelineKey);

  return `material ${materialIndex}, ${family}, ${alphaMode}, ${pipelineKey}`;
}

function updateMaterialFactorSummaryPanel(resolutions) {
  if (!(materialFactorSummaryElement instanceof HTMLElement)) {
    return;
  }

  materialFactorSummaryElement.replaceChildren();

  for (const resolution of arrayEntries(resolutions)) {
    if (!isRecord(resolution) || !isRecord(resolution.factors)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    const meshIndex = resolution.meshIndex ?? "?";
    const primitiveIndex = resolution.primitiveIndex ?? "?";

    element.className = "material-factor-summary-row";
    element.dataset.materialFactorRow = `${meshIndex}:${primitiveIndex}`;
    label.textContent = `mesh ${meshIndex} prim ${primitiveIndex}`;
    value.textContent = formatMaterialFactorDescriptor(resolution.factors);

    element.append(label, value);
    materialFactorSummaryElement.append(element);
  }

  if (materialFactorSummaryElement.childElementCount === 0) {
    materialFactorSummaryElement.hidden = true;
    return;
  }

  materialFactorSummaryElement.hidden = false;
}

function formatMaterialFactorDescriptor(factors) {
  return `base ${formatSummaryTuple(
    factors.baseColorFactor,
  )}, metal ${formatSummaryOptionalKey(
    factors.metallicFactor,
  )}, rough ${formatSummaryOptionalKey(
    factors.roughnessFactor,
  )}, normal ${formatSummaryOptionalKey(
    factors.normalScale,
  )}, occlusion ${formatSummaryOptionalKey(
    factors.occlusionStrength,
  )}, emissive ${formatSummaryTuple(factors.emissiveFactor)}`;
}

function updateMaterialAlphaSummaryPanel(resolutions) {
  if (!(materialAlphaSummaryElement instanceof HTMLElement)) {
    return;
  }

  materialAlphaSummaryElement.replaceChildren();

  for (const resolution of arrayEntries(resolutions)) {
    if (!isRecord(resolution)) {
      continue;
    }

    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    const meshIndex = resolution.meshIndex ?? "?";
    const primitiveIndex = resolution.primitiveIndex ?? "?";

    element.className = "material-alpha-summary-row";
    element.dataset.materialAlphaRow = `${meshIndex}:${primitiveIndex}`;
    label.textContent = `mesh ${meshIndex} prim ${primitiveIndex}`;
    value.textContent = formatMaterialAlphaDescriptor(resolution);

    element.append(label, value);
    materialAlphaSummaryElement.append(element);
  }

  materialAlphaSummaryElement.hidden =
    materialAlphaSummaryElement.childElementCount === 0;
}

function formatMaterialAlphaDescriptor(resolution) {
  return `mode ${formatSummaryOptionalKey(
    resolution.alphaMode,
  )}, cutoff ${formatSummaryOptionalKey(
    resolution.alphaCutoff,
  )}, blend ${formatSummaryOptionalKey(
    resolution.blendPreset,
  )}, depthWrite ${formatSummaryOptionalKey(
    resolution.depthWrite,
  )}, cull ${formatSummaryOptionalKey(resolution.cullMode)}`;
}

function updatePrimitiveTextureSlotSummaryPanel(resolutions) {
  if (!(primitiveTextureSlotSummaryElement instanceof HTMLElement)) {
    return;
  }

  primitiveTextureSlotSummaryElement.replaceChildren();

  for (const resolution of arrayEntries(resolutions)) {
    if (!isRecord(resolution) || !isRecord(resolution.textureSlots)) {
      continue;
    }

    for (const [slotName, slot] of Object.entries(resolution.textureSlots)) {
      if (!isRecord(slot)) {
        continue;
      }

      const meshIndex = resolution.meshIndex ?? "?";
      const primitiveIndex = resolution.primitiveIndex ?? "?";
      const element = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");

      element.className = "primitive-texture-slot-summary-row";
      element.dataset.primitiveTextureSlotRow = `${meshIndex}:${primitiveIndex}:${slotName}`;
      element.dataset.primitiveTextureSlotName = slotName;
      label.textContent = `mesh ${meshIndex} prim ${primitiveIndex} ${formatTextureSlotLabel(
        slotName,
      )}`;
      value.textContent = formatPrimitiveTextureSlot(slot);

      element.append(label, value);
      primitiveTextureSlotSummaryElement.append(element);
    }
  }

  primitiveTextureSlotSummaryElement.hidden =
    primitiveTextureSlotSummaryElement.childElementCount === 0;
}

function formatTextureSlotLabel(slotName) {
  return slotName.replace(/Texture$/, "").replace(/[A-Z]/g, (letter) => {
    return ` ${letter.toLowerCase()}`;
  });
}

function formatPrimitiveTextureSlot(slot) {
  const texCoord = formatSummaryOptionalKey(slot.texCoord);
  const hasTransform = slot.hasTransform === true;
  const sampler = isRecord(slot.sampler)
    ? formatSummaryOptionalKey(slot.sampler.status)
    : "none";

  return `texCoord ${texCoord}, transform ${hasTransform}, sampler ${sampler}`;
}

function updateTextureHandleSummaryPanel(resolutions) {
  if (!(textureHandleSummaryElement instanceof HTMLElement)) {
    return;
  }

  textureHandleSummaryElement.replaceChildren();

  for (const resolution of arrayEntries(resolutions)) {
    if (!isRecord(resolution) || !isRecord(resolution.textureSlots)) {
      continue;
    }

    for (const [slotName, slot] of Object.entries(resolution.textureSlots)) {
      if (!isRecord(slot)) {
        continue;
      }

      const meshIndex = resolution.meshIndex ?? "?";
      const primitiveIndex = resolution.primitiveIndex ?? "?";
      const element = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");

      element.className = "texture-handle-summary-row";
      element.dataset.textureHandleRow = `${meshIndex}:${primitiveIndex}:${slotName}`;
      element.dataset.textureHandleSlotName = slotName;
      label.textContent = `mesh ${meshIndex} prim ${primitiveIndex} ${formatTextureSlotLabel(
        slotName,
      )}`;
      value.textContent = formatTextureHandleDescriptor(slotName, slot);

      element.append(label, value);
      textureHandleSummaryElement.append(element);
    }
  }

  textureHandleSummaryElement.hidden =
    textureHandleSummaryElement.childElementCount === 0;
}

function formatTextureHandleDescriptor(slotName, slot) {
  return `slot ${formatTextureSlotLabel(
    slotName,
  )}, texture ${formatSummaryOptionalKey(
    slot.textureKey,
  )}, sampler ${formatSummaryOptionalKey(
    slot.samplerKey,
  )}, texCoord ${formatSummaryOptionalKey(slot.texCoord)}`;
}

function updateTextureSamplerSummaryPanel(resolutions) {
  if (!(textureSamplerSummaryElement instanceof HTMLElement)) {
    return;
  }

  textureSamplerSummaryElement.replaceChildren();

  for (const resolution of arrayEntries(resolutions)) {
    if (!isRecord(resolution) || !isRecord(resolution.textureSlots)) {
      continue;
    }

    for (const [slotName, slot] of Object.entries(resolution.textureSlots)) {
      if (!isRecord(slot)) {
        continue;
      }

      const meshIndex = resolution.meshIndex ?? "?";
      const primitiveIndex = resolution.primitiveIndex ?? "?";
      const element = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");

      element.className = "texture-sampler-summary-row";
      element.dataset.textureSamplerRow = `${meshIndex}:${primitiveIndex}:${slotName}`;
      element.dataset.textureSamplerSlotName = slotName;
      label.textContent = `mesh ${meshIndex} prim ${primitiveIndex} ${formatTextureSlotLabel(
        slotName,
      )}`;
      value.textContent = formatTextureSamplerDescriptor(slot);

      element.append(label, value);
      textureSamplerSummaryElement.append(element);
    }
  }

  textureSamplerSummaryElement.hidden =
    textureSamplerSummaryElement.childElementCount === 0;
}

function formatTextureSamplerDescriptor(slot) {
  const sampler = isRecord(slot.sampler) ? slot.sampler : null;

  return `address ${formatSummaryOptionalKey(
    sampler?.addressModeU,
  )}/${formatSummaryOptionalKey(
    sampler?.addressModeV,
  )}/${formatSummaryOptionalKey(
    sampler?.addressModeW,
  )}, filters ${formatSummaryOptionalKey(
    sampler?.magFilter,
  )}/${formatSummaryOptionalKey(sampler?.minFilter)}/${formatSummaryOptionalKey(
    sampler?.mipmapFilter,
  )}, anisotropy ${formatSummaryOptionalKey(sampler?.maxAnisotropy)}`;
}

function updateTextureTransformSummaryPanel(resolutions) {
  if (!(textureTransformSummaryElement instanceof HTMLElement)) {
    return;
  }

  textureTransformSummaryElement.replaceChildren();

  for (const resolution of arrayEntries(resolutions)) {
    if (!isRecord(resolution) || !isRecord(resolution.textureSlots)) {
      continue;
    }

    for (const [slotName, slot] of Object.entries(resolution.textureSlots)) {
      if (!isRecord(slot) || !isRecord(slot.transform)) {
        continue;
      }

      const meshIndex = resolution.meshIndex ?? "?";
      const primitiveIndex = resolution.primitiveIndex ?? "?";
      const element = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");

      element.className = "texture-transform-summary-row";
      element.dataset.textureTransformRow = `${meshIndex}:${primitiveIndex}:${slotName}`;
      element.dataset.textureTransformSlotName = slotName;
      label.textContent = `mesh ${meshIndex} prim ${primitiveIndex} ${formatTextureSlotLabel(
        slotName,
      )}`;
      value.textContent = formatTextureTransformDescriptor(slot.transform);

      element.append(label, value);
      textureTransformSummaryElement.append(element);
    }
  }

  textureTransformSummaryElement.hidden =
    textureTransformSummaryElement.childElementCount === 0;
}

function formatTextureTransformDescriptor(transform) {
  return `offset ${formatSummaryTuple(
    transform.offset,
  )}, scale ${formatSummaryTuple(
    transform.scale,
  )}, rotation ${formatSummaryOptionalKey(transform.rotation)}`;
}

function updateSourceLoaderSummaryPanel(source) {
  if (!(sourceLoaderSummaryElement instanceof HTMLElement)) {
    return;
  }

  sourceLoaderSummaryElement.replaceChildren();

  if (!isRecord(source)) {
    sourceLoaderSummaryElement.hidden = true;
    return;
  }

  sourceLoaderSummaryElement.hidden = false;

  for (const row of sourceLoaderSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "source-loader-summary-row";
    element.dataset.sourceLoaderSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(source);

    element.append(label, value);
    sourceLoaderSummaryElement.append(element);
  }
}

function formatSourceKind(source) {
  return isRecord(source.status)
    ? formatSummaryOptionalKey(source.status.sourceKind)
    : "none";
}

function formatSourceByteLength(source) {
  const byteLength =
    typeof source.byteLength === "number"
      ? source.byteLength
      : isRecord(source.status) && typeof source.status.byteLength === "number"
        ? source.status.byteLength
        : null;

  return byteLength === null ? "none" : `${byteLength} bytes`;
}

function formatLoaderStatus(source) {
  return isRecord(source.status)
    ? formatSummaryOptionalKey(source.status.status)
    : "none";
}

function updateSourceOutputSummaryPanel(summary) {
  if (!(sourceOutputSummaryElement instanceof HTMLElement)) {
    return;
  }

  sourceOutputSummaryElement.replaceChildren();

  if (
    !isRecord(summary) ||
    !isRecord(summary.meshConstruction) ||
    !isRecord(summary.sourceRegistration) ||
    !isRecord(summary.ecsCommandPlan) ||
    !isRecord(summary.ecsReplayReadiness)
  ) {
    sourceOutputSummaryElement.hidden = true;
    return;
  }

  sourceOutputSummaryElement.hidden = false;

  for (const row of sourceOutputSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "source-output-summary-row";
    element.dataset.sourceOutputSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(summary);

    element.append(label, value);
    sourceOutputSummaryElement.append(element);
  }
}

function updateHierarchySummaryPanel(hierarchy) {
  if (!(hierarchySummaryElement instanceof HTMLElement)) {
    return;
  }

  hierarchySummaryElement.replaceChildren();

  if (!isRecord(hierarchy) || !Array.isArray(hierarchy.nodes)) {
    hierarchySummaryElement.hidden = true;
    return;
  }

  hierarchySummaryElement.hidden = false;

  for (const row of hierarchySummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "hierarchy-summary-row";
    element.dataset.hierarchySummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(hierarchy);

    element.append(label, value);
    hierarchySummaryElement.append(element);
  }
}

function hierarchyChildNodes(hierarchy) {
  const entityKeys = new Set(
    arrayEntries(hierarchy.nodes)
      .filter((node) => isRecord(node) && typeof node.entityKey === "string")
      .map((node) => node.entityKey),
  );

  return arrayEntries(hierarchy.nodes).filter(
    (node) =>
      isRecord(node) &&
      typeof node.parentEntityKey === "string" &&
      entityKeys.has(node.parentEntityKey),
  );
}

function formatFirstHierarchyChild(hierarchy) {
  const child = hierarchyChildNodes(hierarchy)[0];

  if (!isRecord(child)) {
    return "none";
  }

  const nodeIndex =
    typeof child.nodeIndex === "number" ? child.nodeIndex : "unknown";

  return `node ${nodeIndex}: local ${formatSummaryTuple(
    child.localTranslation,
  )}, world ${formatSummaryTuple(child.worldTranslation)}`;
}

function updateReplayStageSummaryPanel(gltf) {
  if (!(replayStageSummaryElement instanceof HTMLElement)) {
    return;
  }

  replayStageSummaryElement.replaceChildren();

  if (
    !isRecord(gltf) ||
    !isRecord(gltf.registration) ||
    !isRecord(gltf.commandPlan) ||
    !isRecord(gltf.replay)
  ) {
    replayStageSummaryElement.hidden = true;
    return;
  }

  replayStageSummaryElement.hidden = false;

  for (const row of replayStageSummaryRows) {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    element.className = "replay-stage-summary-row";
    element.dataset.replayStageSummaryRow = row.key;
    label.textContent = row.label;
    value.textContent = row.value(gltf);

    element.append(label, value);
    replayStageSummaryElement.append(element);
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
