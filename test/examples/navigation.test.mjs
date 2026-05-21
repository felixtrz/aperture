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
  'href="/examples/spinning-cube.html"',
];
const readbackHelperImport = 'from "./webgpu-readback.js"';
const expectedImports = {
  "@aperture-engine/core": "/packages/core/dist/index.js",
  "@aperture-engine/render": "/packages/render/dist/index.js",
  "@aperture-engine/runtime": "/packages/runtime/dist/index.js",
  "@aperture-engine/simulation": "/packages/simulation/dist/index.js",
  "@aperture-engine/webgpu": "/packages/webgpu/dist/index.js",
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
