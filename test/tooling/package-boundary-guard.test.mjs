import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkPackageBoundaries,
  formatPackageBoundaryViolations,
} from "../../scripts/check-package-boundaries.mjs";

const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe("package boundary guard", () => {
  it("allows WebGPU globals in the webgpu package while headless packages stay clean", () => {
    const root = createTempWorkspace();

    writePackage(root, "simulation", {
      "src/index.ts": 'export const ok = "headless";\n',
    });
    writePackage(root, "render", {
      "src/index.ts": "export interface RenderOnly { readonly id: string; }\n",
    });
    writePackage(root, "webgpu", {
      "src/index.ts":
        "export type BackendDevice = GPUDevice;\nexport const hasGpu = navigator.gpu;\n",
    });

    expect(checkPackageBoundaries({ rootDir: root })).toEqual([]);
  });

  it("reports forbidden WebGPU imports, package dependencies, and browser globals", () => {
    const root = createTempWorkspace();

    writePackage(
      root,
      "simulation",
      {
        "src/index.ts":
          'import type { WebGpuApp } from "@aperture-engine/webgpu";\nexport type Bad = WebGpuApp;\n',
      },
      { dependencies: { "@aperture-engine/webgpu": "workspace:*" } },
    );
    writePackage(root, "render", {
      "src/device.ts": "export type BadDevice = GPUDevice;\n",
    });
    writePackage(root, "runtime", {
      "src/navigator.ts": "export const bad = navigator.gpu;\n",
    });

    const violations = checkPackageBoundaries({ rootDir: root });

    expect(violations.map((violation) => violation.name)).toEqual([
      "@aperture-engine/webgpu",
      "@aperture-engine/webgpu",
      "GPUDevice",
      "navigator.gpu",
    ]);
    expect(formatPackageBoundaryViolations(violations)).toContain(
      "packages/simulation/package.json",
    );
    expect(formatPackageBoundaryViolations(violations)).toContain(
      "packages/runtime/src/navigator.ts",
    );
  });

  it("reports browser globals in any headless package outside its browser entry", () => {
    const root = createTempWorkspace();

    // Browser globals in a headless package root are violations — for EVERY
    // headless package, not just ui.
    writePackage(root, "particles", {
      "src/effects.ts": "export const width = window.innerWidth;\n",
    });
    // The structural browser-entry exemption: src/browser.ts and src/browser/
    // may use browser globals, with zero per-package script edits.
    writePackage(root, "ui", {
      "src/browser.ts": "export const doc = document.title;\n",
      "src/browser/dom-bridge.ts":
        'export const bridge = document.createElement("input");\n',
      "src/index.ts": 'export const ok = "headless";\n',
    });
    // Worker-available APIs (Blob/Response/OffscreenCanvas) are NOT banned:
    // the invariant is the worker import graph, not browser flavor.
    writePackage(root, "render", {
      "src/decode.ts":
        'export const supported = typeof Blob !== "undefined" && typeof OffscreenCanvas === "function" && typeof Response !== "undefined";\n',
    });

    const violations = checkPackageBoundaries({ rootDir: root });

    expect(
      violations.map((violation) => [violation.packageName, violation.name]),
    ).toEqual([["particles", "window"]]);
    expect(formatPackageBoundaryViolations(violations)).toContain(
      "browser entry (src/browser.ts or src/browser/)",
    );
  });

  it("reports Web Audio globals in headless packages", () => {
    const root = createTempWorkspace();

    writePackage(root, "render", {
      "src/bad-audio.ts": "export const ctx = new AudioContext();\n",
    });
    // The render-side ECS AudioListener component must NOT trip the check.
    writePackage(root, "simulation", {
      "src/listener.ts": "export const AudioListener = { tag: true };\n",
    });

    const violations = checkPackageBoundaries({ rootDir: root });

    expect(violations.map((violation) => violation.name)).toEqual([
      "AudioContext",
    ]);
    expect(formatPackageBoundaryViolations(violations)).toContain(
      "browser Web Audio global 'AudioContext'",
    );
  });
});

function createTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aperture-boundary-"));

  tempRoots.push(root);
  return root;
}

function writePackage(root, packageName, files, packageJson = {}) {
  const packageDir = path.join(root, "packages", packageName);

  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: `@aperture-engine/${packageName}`,
        version: "0.0.0",
        ...packageJson,
      },
      null,
      2,
    )}\n`,
  );

  for (const [fileName, contents] of Object.entries(files)) {
    const filePath = path.join(packageDir, fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
}
