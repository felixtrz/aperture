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
import { planarReflectionWgsl } from "../packages/webgpu/dist/app/planar-reflection-shader.js";
import { createPlanarReflectionRenderer } from "../packages/webgpu/dist/app/planar-reflection.js";

let native;
const liveResources = new Set();
const evidence = process.env.APERTURE_GPU_EVIDENCE;
const width = 320,
  height = 240;
before(async () => {
  native = await createNodeDevice({ adapter: "software" });
  const resourceCreators = new Map();
  for (const method of ["createTexture", "createBuffer"]) {
    const original = native.device[method].bind(native.device);
    resourceCreators.set(method, (descriptor) => {
      const resource = original(descriptor);
      liveResources.add(resource);
      const destroy = resource.destroy.bind(resource);
      resource.destroy = () => {
        liveResources.delete(resource);
        destroy();
      };
      return resource;
    });
  }
  // The native cache retains bound methods; assignment to that proxy does not
  // replace them. Wrap reads so every allocation is actually observed.
  native = {
    ...native,
    device: new Proxy(native.device, {
      get(target, property) {
        return (
          resourceCreators.get(property) ??
          Reflect.get(target, property, target)
        );
      },
    }),
  };
  if (evidence) await mkdir(evidence, { recursive: true });
});
after(async () => {
  await native?.dispose();
});
async function scene(projection, receiverSize = 12) {
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
              mesh: mesh.plane({ size: [receiverSize, receiverSize] }),
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
    await output.dispose();
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
test("reflection resolves exactly the covered MSAA receiver samples at mixed edges", async () => {
  const device = native.device;
  const size = 8;
  const output = createOffscreenOutput(device, { width: size, height: size });
  const resources = [];
  const texture = (sampleCount, format, usage) => {
    const result = device.createTexture({
      size: [size, size],
      sampleCount,
      format,
      usage,
    });
    resources.push(result);
    return result;
  };
  const depth = texture(4, "depth32float", 0x10 | 0x04);
  const msaa = texture(4, "rgba8unorm", 0x10);
  const source = texture(1, "rgba8unorm", 0x10 | 0x04);
  const reflection = texture(1, "rgba8unorm", 0x10 | 0x04);
  const uniform = device.createBuffer({ size: 176, usage: 0x40 | 0x08 });
  const coverage = device.createBuffer({ size: 16, usage: 0x40 | 0x08 });
  resources.push(uniform, coverage);
  const vertex = `@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
    let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1);
  }`;
  const depthShader = device.createShaderModule({
    code: `${vertex}
    @group(0) @binding(0) var<uniform> covered:vec4u;
    @fragment fn fs(@builtin(sample_index) i:u32)->@builtin(frag_depth) f32 {
      return select(.492,.5,i<covered.x);
    }`,
  });
  const depthPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: depthShader, entryPoint: "vs" },
    fragment: { module: depthShader, entryPoint: "fs", targets: [] },
    depthStencil: {
      format: "depth32float",
      depthWriteEnabled: true,
      depthCompare: "always",
    },
    multisample: { count: 4 },
  });
  const depthGroup = device.createBindGroup({
    layout: depthPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: coverage } }],
  });
  const module = device.createShaderModule({ code: planarReflectionWgsl(4) });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: { module, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
    multisample: { count: 4 },
  });
  // An exact top-down inverse camera: world Y=.5-depth. Nonreceiver samples
  // are only .008 units away, beyond .002 but inside the old .02 workaround.
  const inverse = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0.5, 0, 1];
  const projected = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0.5, 1];
  const data = new Float32Array([
    ...inverse,
    ...projected,
    0,
    1,
    0.002,
    0,
    0,
    1,
    0,
    0,
    1,
    1,
    1,
    1,
  ]);
  device.queue.writeBuffer(uniform, 0, data);
  const group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: device.createSampler({
          minFilter: "linear",
          magFilter: "linear",
        }),
      },
      { binding: 1, resource: source.createView() },
      { binding: 2, resource: depth.createView() },
      { binding: 3, resource: reflection.createView() },
      { binding: 4, resource: { buffer: uniform } },
    ],
  });
  try {
    for (let count = 0; count <= 4; count++) {
      device.queue.writeBuffer(coverage, 0, new Uint32Array([count, 0, 0, 0]));
      const encoder = device.createCommandEncoder();
      for (const [target, color] of [
        [source, [0, 0, 0, 1]],
        [reflection, [1, 1, 1, 1]],
      ]) {
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: target.createView(),
              loadOp: "clear",
              storeOp: "store",
              clearValue: color,
            },
          ],
        });
        pass.end();
      }
      const depthPass = encoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: depth.createView(),
          depthLoadOp: "clear",
          depthStoreOp: "store",
          depthClearValue: 1,
        },
      });
      depthPass.setPipeline(depthPipeline);
      depthPass.setBindGroup(0, depthGroup);
      depthPass.draw(3);
      depthPass.end();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: msaa.createView(),
            resolveTarget: output.acquire().createView(),
            loadOp: "clear",
            storeOp: "discard",
            clearValue: [0, 0, 0, 1],
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      const pixels = await output.readRgba();
      native.assertHealthy();
      for (let p = 0; p < pixels.length; p += 4)
        for (let c = 0; c < 3; c++)
          assert.ok(
            Math.abs(pixels[p + c] - (255 * count) / 4) <= 1,
            `Coverage ${count}/4 resolved to ${pixels[p + c]}`,
          );
    }
  } finally {
    resources.forEach((resource) => resource.destroy());
    await output.dispose();
  }
  assert.equal(liveResources.size, 0);
});
test("reflection composite attachment survives resize, sample changes and recreation", async () => {
  const { runner, snapshot } = await scene("orthographic");
  try {
    for (let enabled = 0; enabled < 2; enabled++) {
      const renderer = createPlanarReflectionRenderer({
        options: { height: 0 },
        device: native.device,
        sourceAssets: runner.app.lowLevel.assets,
        createApp: createWebGpuApp,
      });
      try {
        let lastTarget;
        for (const [samples, w, h] of [
          [4, 320, 240],
          [4, 320, 240],
          [4, 257, 193],
          [1, 257, 193],
          [4, 320, 240],
        ]) {
          await renderer.render(snapshot, w, h, {});
          const color = native.device.createTexture({
            size: [w, h],
            format: "rgba16float",
            usage: 0x04 | 0x10,
          });
          const depth = native.device.createTexture({
            size: [w, h],
            format: "depth32float",
            sampleCount: samples,
            usage: 0x04 | 0x10,
          });
          try {
            const prepared = renderer.effect.prepare({
              device: native.device,
              input: {
                texture: color,
                width: w,
                height: h,
                format: "rgba16float",
                label: "scene",
              },
              depth: {
                texture: depth,
                width: w,
                height: h,
                sampleCount: samples,
                format: "depth32float",
                label: "depth",
              },
              outputFormat: "rgba16float",
              width: w,
              height: h,
              frame: 0,
              passIndex: 0,
              isLast: true,
              label: "test",
            });
            assert.equal(prepared.msaaColorTarget?.sampleCount ?? 1, samples);
            const targets = [...liveResources].filter(
              (resource) =>
                resource.label === "aperture/planar-reflection/msaa-composite",
            );
            assert.equal(targets.length, samples > 1 ? 1 : 0);
            if (samples > 1) {
              assert.equal(targets[0].width, w);
              assert.equal(targets[0].height, h);
              if (lastTarget?.width === w && lastTarget?.height === h)
                assert.equal(targets[0], lastTarget);
            }
            lastTarget = targets[0];
            native.assertHealthy();
          } finally {
            color.destroy();
            depth.destroy();
          }
        }
      } finally {
        await renderer.dispose();
      }
      assert.equal(
        liveResources.size,
        0,
        "Disabling reflection retained resources",
      );
    }
  } finally {
    await disposeApertureApp(runner.app);
  }
});
for (const projection of ["orthographic", "perspective"])
  for (const samples of [1, 4]) {
    test(`tight reflection tolerance preserves coplanar coverage and rejects nearby surfaces (${projection}, ${samples}x)`, async () => {
      const { runner, snapshot } = await scene(projection, 6);
      const output = createOffscreenOutput(native.device, { width, height });
      const draw = async (s, tolerance) => {
        const result = await createWebGpuApp({
          deviceContext: native,
          output,
          sourceAssets: runner.app.lowLevel.assets,
          autoStart: false,
          msaaSampleCount: samples,
          tonemap: "aces",
          exposure: 1,
          ...(tolerance === null
            ? {}
            : {
                planarReflection: {
                  height: 0,
                  surfaceTolerance: tolerance,
                  strength: 0.6,
                  resolutionScale: 1,
                  distortion: 0,
                  blurPixels: 0,
                },
              }),
        });
        assert.ok(result.ok);
        try {
          const report = await result.app.renderSnapshot(s);
          assert.ok(report.ok, JSON.stringify(report.diagnostics));
          const pixels = await output.readRgba();
          native.assertHealthy();
          return pixels;
        } finally {
          await result.app.dispose();
        }
      };
      try {
        const tight = await draw(snapshot, 0.002);
        const wide = await draw(snapshot, 0.02);
        await save(`tight-${projection}-${samples}`, tight);
        await save(`wide-${projection}-${samples}`, wide);
        assert.ok(
          redRegion(tight, width, height).count > 40,
          "Coplanar receiver lost its reflected landmark",
        );
        // The finite plane's interior and partially covered boundary samples
        // must all survive a tight tolerance, matching the generous reference.
        let maximum = 0;
        for (let i = 0; i < tight.length; i++)
          maximum = Math.max(maximum, Math.abs(tight[i] - wide[i]));
        assert.ok(
          maximum <= 1,
          `Coplanar edge/interior coverage changed by ${maximum}`,
        );
        const receiver = snapshot.meshDraws.find(
          (d) =>
            Math.abs(snapshot.transforms[d.worldTransformOffset + 13]) < 0.001,
        );
        assert.ok(receiver);
        const raised = { ...snapshot, transforms: snapshot.transforms.slice() };
        raised.transforms[receiver.worldTransformOffset + 13] = 0.008;
        const rejected = await draw(raised, 0.002);
        const disabled = await draw(raised, null);
        await save(`nearby-${projection}-${samples}`, rejected);
        maximum = 0;
        for (let i = 0; i < rejected.length; i++)
          maximum = Math.max(maximum, Math.abs(rejected[i] - disabled[i]));
        assert.ok(
          maximum <= 1,
          `Surface outside tolerance received a reflection (${maximum})`,
        );
      } finally {
        await output.dispose();
        await disposeApertureApp(runner.app);
      }
      assert.equal(liveResources.size, 0);
    });
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
    await output.dispose();
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
            // Erode the red mask so mixed edge pixels, which also contain
            // receiver samples and must change, are tested separately.
            if (
              [
                -width - 1,
                -width,
                -width + 1,
                -1,
                0,
                1,
                width - 1,
                width,
                width + 1,
              ].every((offset) => {
                const q = p + offset * 4;
                return (
                  pixels[q] > 180 && pixels[q + 1] < 70 && pixels[q + 2] < 70
                );
              })
            ) {
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
