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
];

describe("worker-split flagship examples", () => {
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
    const [viewer, catalog] = await Promise.all([
      readWorkspaceFile("examples/glb-viewer.js"),
      readWorkspaceFile("examples/glb-viewer-assets.js"),
    ]);

    expect(viewer).toContain('from "./glb-viewer-assets.js";');
    expect(viewer).not.toContain("const sampleAssets = [");
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
    const viewer = await readWorkspaceFile("examples/glb-viewer.js");

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
