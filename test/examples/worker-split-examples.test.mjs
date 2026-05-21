import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  findSampleAssetById,
  getDefaultSampleAsset,
  sampleAssets,
} from "../../examples/glb-viewer-assets.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const workerSplitExamples = [
  {
    html: "examples/spinning-cube.html",
    main: "examples/spinning-cube.main.js",
    worker: "examples/spinning-cube.worker.js",
    legacy: "examples/spinning-cube.js",
  },
  {
    html: "examples/multi-light-shadow.html",
    main: "examples/multi-light-shadow.main.js",
    worker: "examples/multi-light-shadow.worker.js",
    legacy: "examples/multi-light-shadow.js",
  },
  {
    html: "examples/glb-viewer.html",
    main: "examples/glb-viewer.main.js",
    worker: "examples/glb-viewer.worker.js",
    legacy: "examples/glb-viewer.js",
  },
  {
    html: "examples/debug-normal-app.html",
    main: "examples/debug-normal-app.main.js",
    worker: "examples/debug-normal-app.worker.js",
    legacy: "examples/debug-normal-app.js",
  },
  {
    html: "examples/depth-app-overlap.html",
    main: "examples/depth-app-overlap.main.js",
    worker: "examples/depth-app-overlap.worker.js",
    legacy: "examples/depth-app-overlap.js",
  },
  {
    html: "examples/standard-queue-phases.html",
    main: "examples/standard-queue-phases.main.js",
    worker: "examples/standard-queue-phases.worker.js",
    legacy: "examples/standard-queue-phases.js",
  },
  {
    html: "examples/instancing.html",
    main: "examples/instancing.main.js",
    worker: "examples/instancing.worker.js",
    legacy: "examples/instancing.js",
  },
  {
    html: "examples/instance-tint.html",
    main: "examples/instance-tint.main.js",
    worker: "examples/instance-tint.worker.js",
    legacy: "examples/instance-tint.js",
  },
  {
    html: "examples/batching.html",
    main: "examples/batching.main.js",
    worker: "examples/batching.worker.js",
    legacy: "examples/batching.js",
  },
  {
    html: "examples/render-to-texture.html",
    main: "examples/render-to-texture.main.js",
    worker: "examples/render-to-texture.worker.js",
    legacy: "examples/render-to-texture.js",
  },
  {
    html: "examples/gpu-profiler.html",
    main: "examples/gpu-profiler.main.js",
    worker: "examples/gpu-profiler.worker.js",
    legacy: "examples/gpu-profiler.js",
  },
  {
    html: "examples/matcap-app.html",
    main: "examples/matcap-app.main.js",
    worker: "examples/matcap-app.worker.js",
    legacy: "examples/matcap-app.js",
  },
  {
    html: "examples/materials-showcase.html",
    main: "examples/materials-showcase.main.js",
    worker: "examples/materials-showcase.worker.js",
    legacy: "examples/materials-showcase.js",
  },
  {
    html: "examples/point-shadow.html",
    main: "examples/point-shadow.main.js",
    worker: "examples/point-shadow.worker.js",
    legacy: "examples/point-shadow.js",
  },
  {
    html: "examples/spot-shadow.html",
    main: "examples/spot-shadow.main.js",
    worker: "examples/spot-shadow.worker.js",
    legacy: "examples/spot-shadow.js",
  },
  {
    html: "examples/standard-texture-control.html",
    main: "examples/standard-texture-control.main.js",
    worker: "examples/standard-texture-control.worker.js",
    legacy: "examples/standard-texture-control.js",
  },
  {
    html: "examples/standard-gltf-texture.html",
    main: "examples/standard-gltf-texture.main.js",
    worker: "examples/standard-gltf-texture.worker.js",
    legacy: "examples/standard-gltf-texture.js",
  },
];

describe("worker-split examples", () => {
  it("loads main-thread renderer entries from HTML", async () => {
    for (const example of workerSplitExamples) {
      const html = await readWorkspaceFile(example.html);

      expect(html, `${example.html} should load its renderer entry`).toContain(
        `<script type="module" src="./${path.basename(example.main)}"></script>`,
      );
    }
  });

  it("keeps ECS authoring in worker files", async () => {
    for (const example of workerSplitExamples) {
      const [main, worker] = await Promise.all([
        readWorkspaceFile(example.main),
        readWorkspaceFile(example.worker),
      ]);

      expect(
        main,
        `${example.main} should not use the temporary bridge`,
      ).not.toContain("createExampleWebGpuApp");
      expect(main, `${example.main} should not spawn ECS entities`).not.toMatch(
        /\bapp\.spawn\s*\(/,
      );
      expect(main, `${example.main} should render worker snapshots`).toContain(
        "app.renderSnapshot",
      );
      expect(
        worker,
        `${example.worker} should own extraction app setup`,
      ).toContain("createExtractionApp");
      expect(
        worker,
        `${example.worker} should transfer snapshot buffers`,
      ).toContain("renderSnapshotTransferList");
      expect(worker, `${example.worker} should spawn ECS entities`).toMatch(
        /\bapp\.spawn\s*\(/,
      );
    }
  });

  it("keeps legacy module names as thin compatibility entries", async () => {
    for (const example of workerSplitExamples) {
      const legacy = await readWorkspaceFile(example.legacy);

      expect(legacy.trim()).toBe(`import "./${path.basename(example.main)}";`);
    }
  });

  it("keeps the GLB viewer sample catalog shareable for the worker split", async () => {
    const [main, worker, catalog] = await Promise.all([
      readWorkspaceFile("examples/glb-viewer.main.js"),
      readWorkspaceFile("examples/glb-viewer.worker.js"),
      readWorkspaceFile("examples/glb-viewer-assets.js"),
    ]);

    expect(main).toContain('from "./glb-viewer-assets.js";');
    expect(worker).toContain('from "./glb-viewer-assets.js";');
    expect(main).not.toContain("const sampleAssets = [");
    expect(worker).not.toContain("const sampleAssets = [");
    expect(catalog).toContain("export const sampleAssets = [");
    expect(catalog).toContain("export function getDefaultSampleAsset()");
    expect(catalog).toContain("export function findSampleAssetById(assetId)");
    expect(catalog).toContain('id: "cube"');
    expect(catalog).toContain('id: "hierarchy"');
    expect(catalog).toContain("import.meta.url");
  });

  it("keeps the GLB viewer sample catalog URL-backed and uniquely keyed", () => {
    const ids = new Set();

    expect(sampleAssets.length).toBeGreaterThan(30);

    for (const asset of sampleAssets) {
      expect(asset.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(asset.id), `duplicate GLB sample id ${asset.id}`).toBe(
        false,
      );
      expect(asset.label.length).toBeGreaterThan(0);
      expect(asset.source).toBe("sample");
      expect(asset.url).toBeInstanceOf(URL);
      expect(asset.url.pathname).toMatch(/\.(glb|gltf)$/);
      ids.add(asset.id);
    }

    expect(getDefaultSampleAsset().id).toBe("cube");
    expect(findSampleAssetById("cube")).toBe(getDefaultSampleAsset());
    expect(findSampleAssetById("missing-sample")).toBeNull();
  });

  it("keeps the GLB viewer image decode path worker-compatible", async () => {
    const viewer = await readWorkspaceFile("examples/glb-viewer.worker.js");

    expect(viewer).toContain("globalThis.fetch");
    expect(viewer).toContain("globalThis.createImageBitmap");
    expect(viewer).toContain("globalThis.OffscreenCanvas");
    expect(viewer).toContain("createImageDecodeCanvas");
    expect(viewer).toContain("requires OffscreenCanvas or a document canvas");
  });

  it("keeps the no-op simulation worker compatible with renderer bootstrap", async () => {
    const helper = await readWorkspaceFile(
      "examples/noop-simulation-worker.js",
    );

    expect(helper).toContain("start() {}");
    expect(helper).toContain("onSnapshot()");
    expect(helper).toContain("onError()");
    expect(helper).toContain("terminate() {}");
  });
});

async function readWorkspaceFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}
