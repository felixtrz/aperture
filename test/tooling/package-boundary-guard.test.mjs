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
