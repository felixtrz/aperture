/* global document, Worker */
import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import config from "./aperture-config.mjs";

const canvas = document.querySelector("canvas");
const app = await startGeneratedBrowserApp({
  config,
  workerEntry: new Worker(new URL("./aperture-worker.mjs", import.meta.url), {
    type: "module",
  }),
});

globalThis.__AGENT_BENCHMARK__ = {
  engine: "aperture",
  canvas,
  ready: app.ready,
  async setCamera(camera) {
    await app.request("camera_look_at", {
      key: "camera.main",
      translation: camera.position,
      lookAt: camera.target,
    });
    const response = await app.requestRaw("camera_set_projection", {
      key: "camera.main",
      fovYDegrees: camera.fovYDegrees,
      near: camera.near,
      far: camera.far,
    });
    if (!response.ok) throw new Error(JSON.stringify(response.diagnostics));
  },
  async renderFrame(frame) {
    await app.renderFrame({
      deltaSeconds: frame.deltaSeconds,
      timeSeconds: frame.timeSeconds,
    });
  },
  async inspectGeometry() {
    const snapshot = app.inspectRenderedGeometry({
      maxBytes: 64 * 1024 * 1024,
      maxVertices: 2_000_000,
      maxIndices: 6_000_000,
      maxInstances: 100_000,
      maxMeshes: 4096,
      maxDraws: 10_000,
    });
    if (snapshot.status !== "complete")
      throw new Error(
        `Geometry inspection incomplete: ${JSON.stringify(snapshot.omissions)}`,
      );
    const meshByKey = new Map(snapshot.meshes.map((mesh) => [mesh.key, mesh]));
    return {
      meshes: snapshot.draws.map((draw, i) => {
        const mesh = meshByKey.get(draw.meshKey);
        const indices = Uint32Array.from(
          { length: draw.indexed ? draw.indexCount : draw.vertexCount },
          (_, j) =>
            draw.indexed
              ? mesh.indices[draw.firstIndex + j] + draw.baseVertex
              : draw.firstVertex + j,
        );
        const instances = [];
        for (let offset = 0; offset < draw.worldMatrices.length; offset += 16)
          instances.push(
            new Float32Array(draw.worldMatrices.slice(offset, offset + 16)),
          );
        return {
          id: `submitted-${i}`,
          positions: new Float32Array(mesh.positions),
          normals: new Float32Array(mesh.normals),
          indices,
          instances,
          worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        };
      }),
    };
  },
  async dispose() {
    await app.dispose();
  },
};
