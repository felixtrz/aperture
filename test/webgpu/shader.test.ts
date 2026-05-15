import { describe, expect, it } from "vitest";

import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderModuleLike,
} from "../../src/index.js";

const WGSL = `
@vertex
fn vs_main() -> @builtin(position) vec4f {
  return vec4f(0, 0, 0, 1);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1, 1, 1, 1);
}
`;

describe("WebGPU shader module creation diagnostics", () => {
  it("creates shader modules with expected entry points", async () => {
    const created: unknown[] = [];
    const module: WebGpuShaderModuleLike = {};
    const device: WebGpuShaderDeviceLike = {
      createShaderModule: (descriptor) => {
        created.push(descriptor);
        return module;
      },
    };

    await expect(
      createWebGpuShaderModule({
        device,
        descriptor: {
          label: "unlit",
          code: WGSL,
          entryPoints: ["vs_main", "fs_main"],
        },
      }),
    ).resolves.toEqual({ ok: true, module, diagnostics: [] });
    expect(created).toEqual([{ label: "unlit", code: WGSL }]);
  });

  it("returns warning diagnostics without failing", async () => {
    const module: WebGpuShaderModuleLike = {
      compilationInfo: async () => ({
        messages: [
          {
            type: "warning",
            message: "unused binding",
            lineNum: 3,
            linePos: 5,
          },
        ],
      }),
    };

    const result = await createWebGpuShaderModule({
      device: { createShaderModule: () => module },
      descriptor: { code: WGSL, entryPoints: ["vs_main"] },
    });

    expect(result).toMatchObject({ ok: true });
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        message: "unused binding",
        line: 3,
        column: 5,
      },
    ]);
  });

  it("returns error diagnostics as a compilation failure", async () => {
    const module: WebGpuShaderModuleLike = {
      compilationInfo: async () => ({
        messages: [
          {
            type: "error",
            message: "unknown identifier",
            lineNum: 4,
            linePos: 9,
          },
        ],
      }),
    };

    const result = await createWebGpuShaderModule({
      device: { createShaderModule: () => module },
      descriptor: { code: WGSL, entryPoints: ["fs_main"] },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "compilation-error",
    });
    expect(result.diagnostics).toEqual([
      {
        severity: "error",
        message: "unknown identifier",
        line: 4,
        column: 9,
      },
    ]);
  });

  it("reports missing device support and missing entry points", async () => {
    await expect(
      createWebGpuShaderModule({
        device: {},
        descriptor: { code: WGSL },
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "create-shader-module-unavailable",
    });

    const result = await createWebGpuShaderModule({
      device: {
        createShaderModule: () => {
          throw new Error("not reached");
        },
      },
      descriptor: { code: WGSL, entryPoints: ["missing_main"] },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "missing-entry-point",
    });
    expect(result.diagnostics.map((diagnostic) => diagnostic.severity)).toEqual(
      ["error"],
    );
  });
});
