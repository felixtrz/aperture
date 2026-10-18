import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createNodeDevice,
  createOffscreenOutput,
} from "../packages/adapter-node/dist/index.js";
import { createApertureHeadlessRunner } from "../packages/app/dist/headless.js";
import { disposeApertureApp } from "../packages/app/dist/advanced.js";
import { createSystem, material, mesh } from "../packages/app/dist/systems.js";
import { createWebGpuApp } from "../packages/webgpu/dist/index.js";
import { createUnlitMaterialAsset } from "../packages/render/dist/index.js";
import { multiplyMat4 } from "../packages/simulation/dist/index.js";
import { encodeRenderPng } from "../packages/cli/dist/render/png.js";

let native;
const liveResources = new Set();
const evidence = process.env.APERTURE_GPU_EVIDENCE;
const width = 320,
  height = 240;
before(async () => {
  native = await createNodeDevice({ adapter: "software" });
  for (const method of ["createTexture", "createBuffer"]) {
    const original = native.device[method].bind(native.device);
    native.device[method] = (descriptor) => {
      const resource = original(descriptor);
      liveResources.add(resource);
      const destroy = resource.destroy.bind(resource);
      resource.destroy = () => {
        liveResources.delete(resource);
        destroy();
      };
      return resource;
    };
  }
  if (evidence) await mkdir(evidence, { recursive: true });
});
after(async () => {
  await native?.dispose();
});
async function scene(projection) {
  const runner = await createApertureHeadlessRunner({
    config: {
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    },
    systems: [
      {
        default: class extends createSystem({ priority: 0 }) {
          init() {
            this.spawn.camera({
              key: "camera",
              transform: { translation: [0, 4, 7], lookAt: [0, 0, 0] },
              camera: {
                projection,
                orthographicHeight: 7,
                aspect: width / height,
                autoAspect: false,
                near: 0.1,
                far: 60,
                frustumCulling: false,
                clearColor: [0.12, 0.12, 0.12, 1],
              },
            });
            this.spawn.mesh({
              key: "receiver",
              mesh: mesh.plane({ size: [12, 12] }),
              material: material.unlit({ baseColor: [0.15, 0.15, 0.15, 1] }),
              transform: { rotationEulerDegrees: [-90, 0, 0] },
            });
            this.spawn.mesh({
              key: "marker",
              mesh: mesh.box({ size: [1, 1, 1] }),
              material: material.unlit({ baseColor: [1, 0.01, 0.01, 1] }),
              transform: { translation: [-0.8, 1.2, 0] },
            });
            this.spawn.mesh({
              key: "below",
              mesh: mesh.box({ size: [1, 1, 1] }),
              material: material.unlit({ baseColor: [0.01, 1, 0.01, 1] }),
              transform: { translation: [1, -2, 0] },
            });
          }
        },
      },
    ],
  });
  return { runner, snapshot: runner.step(0, 0).snapshot };
}
function redRegion(pixels, w, h, channel = 0) {
  let count = 0,
    sumX = 0;
  for (let y = Math.floor(h * 0.52); y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (
        pixels[p + channel] > pixels[p + ((channel + 1) % 3)] * 1.6 &&
        pixels[p + channel] > pixels[p + ((channel + 2) % 3)] * 1.6 &&
        pixels[p + channel] > 100
      ) {
        count++;
        sumX += x;
      }
    }
  return { count, x: sumX / Math.max(count, 1) };
}
test("reflection tint attenuates reflected radiance without recoloring the foreground", async () => {
  const { runner, snapshot } = await scene("orthographic");
  const output = createOffscreenOutput(native.device, { width, height });
  const images = [];
  try {
    for (const tint of [
      [1, 1, 1],
      [0, 1, 1],
    ]) {
      const created = await createWebGpuApp({
        deviceContext: native,
        output,
        sourceAssets: runner.app.lowLevel.assets,
        autoStart: false,
        msaaSampleCount: 4,
        tonemap: "aces",
        exposure: 1,
        planarReflection: {
          height: 0,
          strength: 0.6,
          tint,
          resolutionScale: 0.7,
          distortion: 0,
          blurPixels: 0,
        },
      });
      assert.ok(created.ok);
      try {
        assert.ok((await created.app.renderSnapshot(snapshot)).ok);
        images.push(await output.readRgba());
        native.assertHealthy();
      } finally {
        await created.app.dispose();
      }
    }
    assert.ok(redRegion(images[0], width, height).count > 40);
    assert.equal(redRegion(images[1], width, height).count, 0);
    let foreground = 0;
    for (let p = 0; p < width * Math.floor(height * 0.5) * 4; p += 4)
      if (
        images[0][p] > 180 &&
        images[0][p + 1] < 70 &&
        images[0][p + 2] < 70
      ) {
        foreground++;
        for (let c = 0; c < 3; c++)
          assert.ok(Math.abs(images[0][p + c] - images[1][p + c]) <= 1);
      }
    assert.ok(foreground > 40);
    await save("tint-white", images[0]);
    await save("tint-cyan", images[1]);
  } finally {
    output.dispose();
    await disposeApertureApp(runner.app);
  }
  assert.equal(liveResources.size, 0);
});
async function save(label, pixels, w = width, h = height) {
  if (evidence)
    await writeFile(
      path.join(evidence, label + ".png"),
      encodeRenderPng(w, h, pixels),
    );
}
test("ripple frequency changes only distorted receiver pixels and retains closed resources", async () => {
  const { runner, snapshot } = await scene("orthographic");
  const output = createOffscreenOutput(native.device, { width, height });
  const images = [];
  try {
    for (const [distortion, distortionFrequency] of [
      [0.02, 1],
      [0.02, 6],
      [0, 1],
      [0, 6],
    ]) {
      const created = await createWebGpuApp({
        deviceContext: native,
        output,
        sourceAssets: runner.app.lowLevel.assets,
        autoStart: false,
        msaaSampleCount: 4,
        tonemap: "aces",
        exposure: 1,
        planarReflection: {
          height: 0,
          strength: 0.7,
          resolutionScale: 1,
          distortion,
          distortionFrequency,
          blurPixels: 0,
        },
      });
      assert.ok(created.ok);
      try {
        assert.ok((await created.app.renderSnapshot(snapshot)).ok);
        images.push(await output.readRgba());
        native.assertHealthy();
      } finally {
        await created.app.dispose();
      }
    }
    assert.deepEqual(
      images[2],
      images[3],
      "zero amplitude must ignore frequency",
    );
    let receiverChanged = 0,
      foreground = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4;
        const delta = Math.max(
          ...[0, 1, 2].map((c) =>
            Math.abs(images[0][p + c] - images[1][p + c]),
          ),
        );
        if (y >= height * 0.52 && delta > 10) receiverChanged++;
        if (
          y < height * 0.5 &&
          images[0][p] > 180 &&
          images[0][p + 1] < 70 &&
          images[0][p + 2] < 70
        ) {
          foreground++;
          assert.ok(
            delta <= 1,
            "the real foreground marker must not be displaced",
          );
        }
      }
    assert.ok(
      receiverChanged > 40,
      "frequency must affect the reflected marker",
    );
    assert.ok(foreground > 40);
    await save("ripple-frequency-one", images[0]);
    await save("ripple-frequency-six", images[1]);
  } finally {
    output.dispose();
    await disposeApertureApp(runner.app);
  }
  assert.equal(liveResources.size, 0);
});
for (const projection of ["orthographic", "perspective"])
  for (const samples of [1, 4]) {
    test(`real scene reflection follows moved/removed landmarks, masks receiver and clips below water (${projection}, ${samples}x)`, async () => {
      const { runner, snapshot } = await scene(projection);
      const output = createOffscreenOutput(native.device, { width, height });
      let app;
      try {
        const result = await createWebGpuApp({
          deviceContext: native,
          output,
          sourceAssets: runner.app.lowLevel.assets,
          autoStart: false,
          msaaSampleCount: samples,
          tonemap: "aces",
          // Reflections force HDR; invalid exposure must still use the usual
          // fallback of 1. The foreground comparison below checks that value.
          exposure:
            samples === 1
              ? projection === "orthographic"
                ? NaN
                : Infinity
              : 1,
          planarReflection: {
            height: 0,
            strength: 0.6,
            resolutionScale: 0.7,
            distortion: 0,
            blurPixels: 0,
          },
        });
        assert.ok(result.ok);
        app = result.app;
        const draw = async (s) => {
          const report = await app.renderSnapshot(s);
          assert.ok(report.ok, JSON.stringify(report.diagnostics));
          const pixels = await output.readRgba();
          native.assertHealthy();
          return pixels;
        };
        const original = await draw(snapshot);
        await save(`${projection}-${samples}-original`, original);
        const reflected = redRegion(original, width, height);
        assert.ok(
          reflected.count > 40,
          `No reflected red landmark: ${JSON.stringify(reflected)}`,
        );
        const marker = snapshot.meshDraws.find(
          (d) =>
            Math.abs(snapshot.transforms[d.worldTransformOffset + 13] - 1.2) <
            0.01,
        );
        assert.ok(marker, "Marker not extracted");
        const moved = {
          ...snapshot,
          frame: snapshot.frame + 1,
          transforms: snapshot.transforms.slice(),
        };
        moved.transforms[marker.worldTransformOffset + 12] = 1;
        const changed = await draw(moved);
        await save(`${projection}-${samples}-moved`, changed);
        const second = redRegion(changed, width, height);
        assert.ok(
          second.count > 40 && second.x > reflected.x + 30,
          "Reflected landmark did not follow source transform",
        );
        const removed = {
          ...moved,
          frame: moved.frame + 1,
          meshDraws: moved.meshDraws.filter(
            (d) => d.renderId !== marker.renderId,
          ),
          shadowCasterDraws: [],
        };
        const empty = await draw(removed);
        assert.equal(
          redRegion(empty, width, height).count,
          0,
          "Removed landmark persisted in reflection",
        );
        let green = 0;
        for (let p = 0; p < empty.length; p += 4)
          if (
            empty[p + 1] > empty[p] * 1.6 &&
            empty[p + 1] > empty[p + 2] * 1.6
          )
            green++;
        assert.equal(
          green,
          0,
          "Geometry below water leaked through the clip plane",
        );
        // Main object remains identical when reflection is disabled; compare its upper image region.
        const plain = await createWebGpuApp({
          deviceContext: native,
          output,
          sourceAssets: runner.app.lowLevel.assets,
          autoStart: false,
          msaaSampleCount: samples,
          tonemap: "aces",
          exposure: 1,
        });
        assert.ok(plain.ok);
        try {
          await plain.app.renderSnapshot(snapshot);
          const pixels = await output.readRgba();
          let checked = 0,
            changed = 0;
          for (let p = 0; p < width * Math.floor(height * 0.5) * 4; p += 4) {
            if (pixels[p] > 180 && pixels[p + 1] < 70 && pixels[p + 2] < 70) {
              checked++;
              if (
                [0, 1, 2].some(
                  (c) => Math.abs(original[p + c] - pixels[p + c]) > 1,
                )
              )
                changed++;
            }
          }
          assert.ok(checked > 40, "No foreground marker mask");
          assert.equal(
            changed,
            0,
            "Reflection changed foreground object pixels",
          );
        } finally {
          await plain.app.dispose();
        }
        const cameraMoved = {
          ...snapshot,
          frame: 4,
          viewMatrices: snapshot.viewMatrices.slice(),
        };
        const camera = snapshot.views[0];
        cameraMoved.viewMatrices[camera.viewMatrixOffset + 12] -= 1;
        cameraMoved.viewMatrices.set(
          multiplyMat4(
            cameraMoved.viewMatrices.subarray(
              camera.projectionMatrixOffset,
              camera.projectionMatrixOffset + 16,
            ),
            cameraMoved.viewMatrices.subarray(
              camera.viewMatrixOffset,
              camera.viewMatrixOffset + 16,
            ),
          ),
          camera.viewProjectionMatrixOffset,
        );
        const cameraPixels = await draw(cameraMoved);
        const cameraRegion = redRegion(cameraPixels, width, height);
        assert.ok(
          cameraRegion.count > 40 && cameraRegion.x < reflected.x - 15,
          "Reflection did not follow the live camera change",
        );
        await save(`${projection}-${samples}-camera`, cameraPixels);

        const sourceAssets = runner.app.lowLevel.assets;
        const originalMaterial = sourceAssets.get(marker.material).asset;
        sourceAssets.markReady(
          marker.material,
          createUnlitMaterialAsset({
            baseColorFactor: [0.01, 0.01, 1, 1],
          }),
        );
        const bluePixels = await draw({ ...snapshot, frame: 5 });
        assert.equal(
          redRegion(bluePixels, width, height).count,
          0,
          "Old source material persisted in reflection",
        );
        assert.ok(
          redRegion(bluePixels, width, height, 2).count > 40,
          "Updated source material did not reach reflected geometry",
        );
        await save(`${projection}-${samples}-source-update`, bluePixels);
        sourceAssets.markReady(marker.material, originalMaterial);
        for (const [w, h] of [
          [257, 193],
          [width, height],
          [257, 193],
        ]) {
          output.resize(w, h);
          await draw({ ...snapshot, frame: 10 });
          assert.equal((await output.readRgba()).length, w * h * 4);
        }
        if (evidence)
          await writeFile(
            path.join(evidence, `${projection}-${samples}.json`),
            JSON.stringify({
              reflected,
              second,
              green,
              cameraRegion,
              sourceUpdatePassed: true,
              resizePassed: true,
            }),
          );
      } finally {
        await app?.dispose();
        await output.dispose();
        await disposeApertureApp(runner.app);
        assert.equal(
          liveResources.size,
          0,
          "Owned GPU resources leaked after reflection disposal",
        );
      }
    });
  }
