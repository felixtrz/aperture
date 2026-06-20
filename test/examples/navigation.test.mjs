import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseImportMapFromHtml } from "./import-map.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const examplePages = [
  {
    file: "examples/index.html",
    script: "/examples/main.js",
    title: "Aperture Browser Harness",
    canvasLabel: "Aperture WebGPU canvas",
    exampleName: "webgpu clear",
  },
  {
    file: "examples/triangle.html",
    script: "./triangle.main.js",
    title: "Aperture ECS Triangle",
    canvasLabel: "Aperture WebGPU triangle canvas",
    exampleName: "ecs triangle",
  },
  {
    file: "examples/multi-entity.html",
    script: "./multi-entity.main.js",
    title: "Aperture ECS Multi-Entity Scene",
    canvasLabel: "Aperture WebGPU multi-entity canvas",
    exampleName: "ecs multi entity",
  },
  {
    file: "examples/split-screen-multi-camera.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Split-Screen Multi-Camera",
    canvasLabel: "Aperture WebGPU split-screen multi-camera canvas",
    exampleName: "split-screen multi-camera",
  },
  {
    file: "examples/orthographic-camera.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Orthographic Camera",
    canvasLabel: "Aperture WebGPU orthographic camera canvas",
    exampleName: "orthographic camera",
  },
  {
    file: "examples/line-primitives.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Line Primitives",
    canvasLabel: "Aperture WebGPU line primitives canvas",
    exampleName: "line primitives",
  },
  {
    file: "examples/camera-render-layers.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Camera Render Layers",
    canvasLabel: "Aperture WebGPU camera render-layer canvas",
    exampleName: "camera render layers",
  },
  {
    file: "examples/camera-priority-overlay.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Camera Priority Overlay",
    canvasLabel: "Aperture WebGPU camera priority overlay canvas",
    exampleName: "camera priority overlay",
  },
  {
    file: "examples/camera-sub-view-crop.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Camera Sub-View Crop",
    canvasLabel: "Aperture WebGPU camera sub-view crop canvas",
    exampleName: "camera sub-view crop",
  },
  {
    file: "examples/camera-viewport-grid.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Camera Viewport Grid",
    canvasLabel: "Aperture WebGPU camera viewport grid canvas",
    exampleName: "camera viewport grid",
  },
  {
    file: "examples/camera-clear-load-matrix.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Camera Clear Load Matrix",
    canvasLabel: "Aperture WebGPU camera clear load matrix canvas",
    exampleName: "camera clear load matrix",
  },
  {
    file: "examples/camera-picture-in-picture.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Camera Picture In Picture",
    canvasLabel: "Aperture WebGPU camera picture in picture canvas",
    exampleName: "camera picture in picture",
  },
  {
    file: "examples/camera-viewport-resize.html",
    script: "./split-screen-multi-camera.main.js",
    title: "Aperture Camera Viewport Resize",
    canvasLabel: "Aperture WebGPU camera viewport resize canvas",
    exampleName: "camera viewport resize",
  },
  {
    file: "examples/spinning-cube.html",
    script: "./spinning-cube.main.js",
    title: "Aperture ECS Spinning Cube",
    canvasLabel: "Aperture WebGPU spinning cube canvas",
    exampleName: "ecs spinning cube",
  },
];
const expectedHrefs = [
  'href="/"',
  'href="/examples/triangle.html"',
  'href="/examples/multi-entity.html"',
  'href="/examples/split-screen-multi-camera.html"',
  'href="/examples/orthographic-camera.html"',
  'href="/examples/line-primitives.html"',
  'href="/examples/camera-render-layers.html"',
  'href="/examples/camera-priority-overlay.html"',
  'href="/examples/camera-sub-view-crop.html"',
  'href="/examples/camera-viewport-grid.html"',
  'href="/examples/camera-clear-load-matrix.html"',
  'href="/examples/camera-picture-in-picture.html"',
  'href="/examples/camera-viewport-resize.html"',
  'href="/examples/spinning-cube.html"',
];
const readbackHelperImport = 'from "./webgpu-readback.js"';
const expectedImports = {
  "@aperture-engine/render": "/packages/render/dist/index.js",
  "@aperture-engine/runtime": "/packages/runtime/dist/index.js",
  "@aperture-engine/physics": "/packages/physics/dist/index.js",
  "@aperture-engine/math": "/packages/math/dist/index.js",
  "@aperture-engine/simulation": "/packages/simulation/dist/index.js",
  "@aperture-engine/webgpu": "/packages/webgpu/dist/index.js",
  "@aperture-engine/webgpu/test-support":
    "/packages/webgpu/dist/test-support.js",
  elics: "/node_modules/elics/lib/index.js",
  "wgpu-matrix": "/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
  "@preact/signals-core":
    "/node_modules/@preact/signals-core/dist/signals-core.mjs",
};

describe("browser example navigation", () => {
  it("links every example page to the available browser examples", async () => {
    for (const page of examplePages) {
      const html = await readExamplePage(page.file);

      expect(html).toContain('aria-label="Examples"');

      for (const href of expectedHrefs) {
        expect(html, `${page.file} should include ${href}`).toContain(href);
      }
    }
  });

  it("keeps required runtime DOM and module wiring on every page", async () => {
    for (const page of examplePages) {
      const html = await readExamplePage(page.file);

      expect(html, `${page.file} should include the canvas`).toContain(
        'id="aperture-canvas"',
      );
      expect(html, `${page.file} should include example state`).toContain(
        'id="example-state"',
      );
      expect(html, `${page.file} should include status JSON`).toContain(
        'id="example-json"',
      );
      expect(() =>
        parseImportMapFromHtml(html, { file: page.file }),
      ).not.toThrow();
      expect(html, `${page.file} should load styles`).toContain(
        'rel="stylesheet"',
      );
      expect(html, `${page.file} should load its module`).toContain(
        `<script type="module" src="${page.script}"></script>`,
      );
    }
  });

  it("keeps page titles and labels aligned with example identities", async () => {
    for (const page of examplePages) {
      const html = await readExamplePage(page.file);

      expect(html, `${page.file} should include title`).toContain(
        `<title>${page.title}</title>`,
      );
      expect(html, `${page.file} should include canvas label`).toContain(
        `aria-label="${page.canvasLabel}"`,
      );
      expect(html, `${page.file} should include example name`).toContain(
        `<strong id="example-name">${page.exampleName}</strong>`,
      );
    }
  });

  it("keeps manual browser modules wired to the shared WebGPU readback helper", async () => {
    for (const file of ["examples/main.js", "examples/multi-entity.main.js"]) {
      const script = await readExamplePage(file);

      expect(script, `${file} should import readback helper`).toContain(
        readbackHelperImport,
      );
    }

    const helper = await readExamplePage("examples/webgpu-readback.js");

    expect(helper).toContain(
      "export async function initializeWebGpuWithOptionalReadbackUsage",
    );
    expect(helper).toContain(
      "export function copyCurrentTextureReadbackSamples",
    );
  });

  it("keeps example import maps parseable and complete", async () => {
    for (const page of examplePages) {
      const html = await readExamplePage(page.file);
      const importMap = parseImportMapFromHtml(html, { file: page.file });

      expect(importMap.imports, `${page.file} imports`).toEqual(
        expectedImports,
      );
    }
  });

  it("keeps browser example import maps consistent across pages", async () => {
    const [baseline, ...others] = await Promise.all(
      examplePages.map(async (page) => ({
        page,
        importMap: parseImportMapFromHtml(await readExamplePage(page.file), {
          file: page.file,
        }),
      })),
    );

    for (const entry of others) {
      expect(
        entry.importMap.imports,
        `${entry.page.file} imports should match ${baseline.page.file}`,
      ).toEqual(baseline.importMap.imports);
    }
  });

  it("reports actionable import-map parser errors", () => {
    expect(() =>
      parseImportMapFromHtml("<html></html>", { file: "missing.html" }),
    ).toThrow('missing.html is missing a <script type="importmap"> block.');

    expect(() =>
      parseImportMapFromHtml(
        [
          '<script type="importmap">{"imports": {}}</script>',
          '<script type="importmap">{"imports": {}}</script>',
        ].join(""),
        { file: "duplicate.html" },
      ),
    ).toThrow("duplicate.html has multiple import map blocks.");

    expect(() =>
      parseImportMapFromHtml('<script type="importmap">{ bad json }</script>', {
        file: "invalid.html",
      }),
    ).toThrow("invalid.html has invalid import map JSON");

    expect(() =>
      parseImportMapFromHtml(
        '<script type="importmap">{"imports":[]}</script>',
        {
          file: "invalid-imports.html",
        },
      ),
    ).toThrow(
      "invalid-imports.html import map must contain an object 'imports' map.",
    );
  });
});

async function readExamplePage(file) {
  return readFile(path.join(projectRoot, file), "utf8");
}
