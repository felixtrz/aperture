const { document, GPUTextureUsage, GPUBufferUsage, GPUMapMode, ImageData } =
  globalThis;
function firstSnapshotEnvironmentHandle(snapshot) {
  for (const environment of snapshot?.environments ?? []) {
    if (environment?.handle !== null && environment?.handle !== undefined) {
      return environment.handle;
    }
  }

  return null;
}

function bundleEnvironmentAssetInputs(sourceAssets) {
  return sourceAssets
    .list({ kind: "environment-map", status: "ready" })
    .map(environmentAssetInputFromEntry)
    .filter((input) => input !== null);
}

function environmentAssetInputFromEntry(entry) {
  if (entry?.asset === null || typeof entry?.asset !== "object") {
    return null;
  }

  const asset = entry.asset;
  const equirectSource = equirectSourceFromValue(asset.equirectSource);
  const diffuseSource = cubeSourceFromValue(asset.diffuseSource);
  const specularPmremSource = cubeSourceFromValue(asset.specularPmremSource);

  if (
    equirectSource === null &&
    diffuseSource === null &&
    specularPmremSource === null
  ) {
    return null;
  }

  return {
    handle: entry.handle,
    label:
      typeof asset.label === "string"
        ? asset.label
        : typeof entry.label === "string"
          ? entry.label
          : entry.handle.id,
    version: entry.version,
    diffuseResourceKey:
      typeof asset.diffuseResourceKey === "string"
        ? asset.diffuseResourceKey
        : `environment-map:${entry.handle.id}:diffuse`,
    specularResourceKey:
      typeof asset.specularResourceKey === "string"
        ? asset.specularResourceKey
        : `environment-map:${entry.handle.id}:specular`,
    ...(equirectSource === null ? {} : { equirectSource }),
    ...(diffuseSource === null ? {} : { diffuseSource }),
    ...(specularPmremSource === null ? {} : { specularPmremSource }),
    ...(Number.isInteger(asset.standardMaterialCount)
      ? { standardMaterialCount: asset.standardMaterialCount }
      : {}),
  };
}

function equirectSourceFromValue(value) {
  if (value === null || typeof value !== "object") {
    return null;
  }

  if (
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height) ||
    !(value.data instanceof Uint8Array)
  ) {
    return null;
  }

  return {
    width: value.width,
    height: value.height,
    data: value.data,
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.resourceKey === "string"
      ? { resourceKey: value.resourceKey }
      : {}),
    ...(Number.isInteger(value.faceSize) ? { faceSize: value.faceSize } : {}),
    ...(typeof value.format === "string" ? { format: value.format } : {}),
    ...(Number.isInteger(value.mipLevelCount)
      ? { mipLevelCount: value.mipLevelCount }
      : {}),
  };
}

function cubeSourceFromValue(value) {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const faces = Array.isArray(value.faces)
    ? value.faces.filter((face) => face instanceof Uint8Array)
    : [];

  if (!Number.isInteger(value.faceSize) || faces.length === 0) {
    return null;
  }

  return {
    faceSize: value.faceSize,
    faces,
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.resourceKey === "string"
      ? { resourceKey: value.resourceKey }
      : {}),
    ...(typeof value.sourceResourceKey === "string"
      ? { sourceResourceKey: value.sourceResourceKey }
      : {}),
    ...(typeof value.environmentMapResourceKey === "string"
      ? { environmentMapResourceKey: value.environmentMapResourceKey }
      : {}),
    ...(typeof value.format === "string" ? { format: value.format } : {}),
    ...(Number.isInteger(value.mipLevelCount)
      ? { mipLevelCount: value.mipLevelCount }
      : {}),
  };
}

import {
  createWebGpuApp,
  webGpuAppRenderReportToJsonValue,
  prepareWebGpuAppEnvironmentAssets,
} from "@aperture-engine/webgpu";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  decodeTypedArrayTree,
  renderSnapshotFromJsonValue,
} from "@aperture-engine/render";
import { mirrorSourceAssetRegistryFromMessage } from "@aperture-engine/app/asset-mirror";
try {
  const fixtures = await (await fetch("/fixture/fixture-data.json")).json(),
    canvas = document.getElementById("aperture-canvas");
  const sourceAssets = new AssetRegistry();
  mirrorSourceAssetRegistryFromMessage(sourceAssets, {
    sourceAssets: decodeTypedArrayTree({
      entries: fixtures[0].bundle.assets.entries,
    }),
  });
  const result = await createWebGpuApp({
    canvas,
    sourceAssets,
    msaaSampleCount: 1,
    outputColorSpace: "srgb",
    tonemap: "none",
    useFrameGraph: true,
    textureUsage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  if (!result.ok) throw Error(JSON.stringify(result.diagnostics));
  const device = result.initialization.device,
    context = result.initialization.context;
  const getTexture = context.getCurrentTexture.bind(context),
    submit = device.queue.submit.bind(device.queue);
  let activeTexture = null,
    readbackBuffer = null,
    copyDone = false;
  context.getCurrentTexture = () => {
    const texture = getTexture();
    activeTexture = texture;
    return texture;
  };
  device.queue.submit = (buffers) => {
    submit(buffers);
    if (activeTexture && readbackBuffer && !copyDone) {
      const encoder = device.createCommandEncoder({
        label: "fixture-readback",
      });
      encoder.copyTextureToBuffer(
        { texture: activeTexture },
        { buffer: readbackBuffer, bytesPerRow: 3328, rowsPerImage: 600 },
        [800, 600, 1],
      );
      submit([encoder.finish()]);
      copyDone = true;
    }
  };
  const outputs = [],
    images = new Map();
  for (let i = 0; i < fixtures.length; i++) {
    const { name, bundle } = fixtures[i],
      snapshot = renderSnapshotFromJsonValue(bundle.snapshot.value);
    mirrorSourceAssetRegistryFromMessage(sourceAssets, {
      sourceAssets: decodeTypedArrayTree({ entries: bundle.assets.entries }),
    });
    let renderOptions = {};
    const activeHandle = firstSnapshotEnvironmentHandle(snapshot);
    if (activeHandle !== null) {
      const prepared = prepareWebGpuAppEnvironmentAssets({
        app: result.app,
        assets: bundleEnvironmentAssetInputs(sourceAssets),
        activeHandle,
      });
      if (!prepared.active?.ready) throw Error("IBL preparation failed");
      renderOptions = {
        standardMaterialIblResources:
          prepared.active.standardMaterialIblResources,
      };
    }
    // Keep monotonic frame IDs but identical input for the explicit cache case.
    activeTexture = null;
    copyDone = false;
    readbackBuffer = device.createBuffer({
      size: 3328 * 600,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const report = await result.app.renderSnapshot(
      { ...snapshot, frame: i + 1 },
      renderOptions,
    );
    if (!copyDone) throw Error("No texture was copied for " + name);
    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(readbackBuffer.getMappedRange()),
      bytes = new Uint8ClampedArray(800 * 600 * 4);
    for (let y = 0; y < 600; y++)
      for (let x = 0; x < 800; x++) {
        const src = y * 3328 + x * 4,
          dst = (y * 800 + x) * 4;
        for (let c = 0; c < 4; c++)
          bytes[dst + c] =
            mapped[
              src +
                (result.initialization.format.startsWith("bgra") && c < 3
                  ? 2 - c
                  : c)
            ];
      }
    readbackBuffer.unmap();
    readbackBuffer.destroy();
    readbackBuffer = null;
    const copy = document.createElement("canvas");
    copy.width = 800;
    copy.height = 600;
    const ctx = copy.getContext("2d");
    ctx.putImageData(new ImageData(bytes, 800, 600), 0, 0);
    images.set(name, bytes);
    const display = document.createElement("div");
    display.className = "tile";
    const label = document.createElement("span");
    label.textContent = name;
    display.append(label, copy);
    document.getElementById("results").append(display);
    const matrix = snapshot.viewMatrices.subarray(
      snapshot.views[0].viewProjectionMatrixOffset,
      snapshot.views[0].viewProjectionMatrixOffset + 16,
    );
    const groundProbes = [-3, 0, 3].map((x) => {
      const world = [x, 0.001, -1.3, 1],
        clip = [0, 1, 2, 3].map((row) =>
          world.reduce((v, a, j) => v + matrix[j * 4 + row] * a, 0),
        );
      const px = Math.round(((clip[0] / clip[3]) * 0.5 + 0.5) * 800),
        py = Math.round((0.5 - (clip[1] / clip[3]) * 0.5) * 600);
      const rgb = [0, 0, 0];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          for (let c = 0; c < 3; c++)
            rgb[c] += bytes[((py + dy) * 800 + px + dx) * 4 + c] / 9;
      return { world: world.slice(0, 3), pixel: [px, py], rgb };
    });
    outputs.push({
      name,
      groundProbes,
      ok: report.ok,
      status: webGpuAppRenderReportToJsonValue(report, { detail: "full" }),
    });
  }
  const baseline = images.get("baseline");
  const baselineProbes = outputs[0].groundProbes;
  const checks = [];
  const check = (name, passed, actual) => checks.push({ name, passed, actual });
  for (let index = 0; index < 3; index++) {
    const value = outputs.find(
      (value) => value.name === "point-" + index + "-unshadowed",
    );
    const delta =
      value.groundProbes[index].rgb[index] - baselineProbes[index].rgb[index];
    check("point-" + index + "-ground-occlusion", delta >= 8, delta);
  }
  const differences = Object.fromEntries(
    [...images].map(([name, data]) => {
      let changed = 0,
        total = 0;
      const channels = [0, 0, 0],
        increase = [0, 0, 0],
        max = [0, 0, 0],
        location = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4) {
        let pixel = 0;
        for (let c = 0; c < 3; c++) {
          let d = data[i + c] - baseline[i + c];
          channels[c] += Math.abs(d);
          increase[c] += Math.max(0, d);
          total += Math.abs(d);
          pixel += Math.abs(d);
          if (d > max[c]) {
            max[c] = d;
            location[c] = i / 4;
          }
        }
        if (pixel > 6) changed++;
      }
      return [
        name,
        {
          changed,
          total,
          channels,
          increase,
          max,
          location: location.map((p) => [p % 800, Math.floor(p / 800)]),
        },
      ];
    }),
  );
  for (let index = 0; index < 3; index++) {
    const difference = differences["point-" + index + "-unshadowed"];
    check(
      "point-" + index + "-channel-isolation",
      difference.changed > 100 &&
        difference.channels[index] > 0 &&
        difference.channels.every(
          (value, channel) => channel === index || value === 0,
        ),
      difference,
    );
  }
  check(
    "sun-occlusion",
    differences["sun-unshadowed"].channels.every((value) => value > 0),
    differences["sun-unshadowed"],
  );
  check(
    "cached-pixels",
    differences.cached.total === 0,
    differences.cached.total,
  );
  check(
    "revisited-pixels",
    differences.revisit.total === 0,
    differences.revisit.total,
  );
  check(
    "moving-light-isolation",
    differences["light-moved"].channels[0] === 0 &&
      differences["light-moved"].channels[2] === 0 &&
      differences["light-moved"].channels[1] > 0,
    differences["light-moved"],
  );
  for (const name of ["caster-moved", "resized", "point-bias", "normal-bias"])
    check(
      name + "-pixel-response",
      differences[name].total > 0,
      differences[name],
    );
  for (const output of outputs) {
    const expected =
      output.name === "directional-only" || output.name === "spot-only"
        ? [1, 1]
        : output.name === "point-only"
          ? [1, 6]
          : output.name === "one-point"
            ? [2, 7]
            : [4, 19];
    check(
      output.name + "-shadow-accounting",
      output.status.shadow.requestCount === expected[0] &&
        output.status.shadow.passCount === expected[1],
      {
        requests: output.status.shadow.requestCount,
        passes: output.status.shadow.passCount,
      },
    );
    const warnings = output.status.diagnostics;
    check(
      output.name + "-diagnostics",
      output.name === "spot-mixed"
        ? warnings.some(
            (value) => value.code === "renderShadowFrame.omittedShadowRequest",
          )
        : warnings.length === 0,
      warnings,
    );
  }
  check(
    "cache-hit",
    outputs.find((value) => value.name === "cached").status.resourceReuse
      .autoShadowFramesReused === 1,
    outputs.find((value) => value.name === "cached").status.resourceReuse
      .autoShadowFramesReused,
  );

  // The original request universe survives composition, including omitted spots.
  for (const output of outputs) {
    const coverage = output.status.shadow.requestCoverage;
    check(
      output.name + "-request-coverage",
      coverage.requestedCount ===
        output.status.shadow.requestCount +
          (output.name === "spot-mixed" ? 1 : 0) &&
        coverage.servedCount === output.status.shadow.requestCount &&
        coverage.omittedCount === (output.name === "spot-mixed" ? 1 : 0),
      coverage,
    );
    const children = output.status.shadow.lightKindReports;
    if (children) {
      const submitted = children.map(
        (child) => child.casterCounts.submittedDrawCalls,
      );
      check(
        output.name + "-child-submitted-counts",
        submitted.reduce((a, b) => a + b, 0) ===
          output.status.shadow.casterCounts.submittedDrawCalls &&
          (output.name === "cached"
            ? submitted.every((value) => value === 0)
            : submitted.every(
                (value, index) => value === children[index].drawCalls,
              )),
        submitted,
      );
      check(
        output.name + "-graph-command-ownership",
        children.every(
          (child) =>
            child.commandBufferSubmission.submittedCommandBuffers === 0,
        ) &&
          output.status.shadow.commandBufferSubmission
            .submittedCommandBuffers === 0,
        children.map(
          (child) => child.commandBufferSubmission.submittedCommandBuffers,
        ),
      );
    }
  }
  const pairDifference = (a, b) => {
    const left = images.get(a),
      right = images.get(b),
      channels = [0, 0, 0];
    for (let i = 0; i < left.length; i += 4)
      for (let c = 0; c < 3; c++)
        channels[c] += Math.abs(left[i + c] - right[i + c]);
    return channels;
  };
  for (const suffix of ["", "-sun-off", "-soft-sun"]) {
    const channels = pairDifference(
      "fill-before" + suffix,
      "fill-after" + suffix,
    );
    check(
      "directional-owner-order" + suffix,
      channels.every((value) => value === 0),
      channels,
    );
  }
  for (const order of ["before", "after"]) {
    const full = pairDifference("fill-" + order, "fill-" + order + "-sun-off");
    const soft = pairDifference("fill-" + order, "fill-" + order + "-soft-sun");
    check(
      "directional-fill-unshadowed-" + order,
      full[0] > 1000 && full[1] === 0 && full[2] === 0,
      full,
    );
    check(
      "directional-owner-strength-" + order,
      soft[0] > 0 && soft[0] < full[0] && soft[1] === 0 && soft[2] === 0,
      soft,
    );
  }

  canvas.style.display = "none";
  globalThis.__APERTURE_RENDER_STATUS__ = {
    ok:
      outputs.every((value) => value.ok) &&
      checks.every((value) => value.passed),
    checks,
    outputs,
    differences,
  };
} catch (error) {
  globalThis.__APERTURE_RENDER_STATUS__ = {
    ok: false,
    error: String(error),
    stack: error.stack,
  };
}
