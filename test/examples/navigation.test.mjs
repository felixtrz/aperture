import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
    script: "./triangle.js",
    title: "Aperture ECS Triangle",
    canvasLabel: "Aperture WebGPU triangle canvas",
    exampleName: "ecs triangle",
  },
  {
    file: "examples/multi-entity.html",
    script: "./multi-entity.js",
    title: "Aperture ECS Multi-Entity Scene",
    canvasLabel: "Aperture WebGPU multi-entity canvas",
    exampleName: "ecs multi entity",
  },
];
const expectedHrefs = [
  'href="/"',
  'href="/examples/triangle.html"',
  'href="/examples/multi-entity.html"',
];

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
      expect(html, `${page.file} should include an import map`).toContain(
        '<script type="importmap">',
      );
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
});

async function readExamplePage(file) {
  return readFile(path.join(projectRoot, file), "utf8");
}
