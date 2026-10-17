import { expect, it } from "vitest";
import { compileShader } from "@aperture-engine/shader/compiler";
import {
  decodeShaderJob,
  encodeShaderJob,
  shaderJobRequiredFeatures,
  validateShaderJob,
} from "@aperture-engine/shader";
const shader = compileShader({
  entry: "shader.wgsl",
  modules: { "shader.wgsl": "@compute @workgroup_size(1) fn main(){}" },
});
function job() {
  return {
    format: "aperture.shader-job",
    version: 1,
    width: 65,
    height: 33,
    resources: [
      {
        kind: "buffer",
        id: "b",
        size: 4,
        usage: ["storage"],
        data: new Uint8Array([0, 1, 128, 255]),
      },
    ],
    frames: [
      {
        input: { time: 0 },
        operations: [{ kind: "compute", name: "step", shader, dispatch: [1] }],
        writes: [],
      },
    ],
  };
}
it("preserves exact resource bytes and required features in the shared codec", () => {
  const original = job();
  const decoded = decodeShaderJob(
    JSON.parse(JSON.stringify(encodeShaderJob(original))),
  );
  expect(decoded).toEqual(original);
  expect(shaderJobRequiredFeatures(decoded)).toEqual([]);
});
it("rejects host state, callbacks, cyclic captures and module URLs", () => {
  const original = job();
  expect(() => validateShaderJob({ ...original, callback: () => {} })).toThrow(
    /host state/,
  );
  expect(() => validateShaderJob({ ...original, object: new Map() })).toThrow(
    /GPU\/host objects/,
  );
  expect(() =>
    validateShaderJob({
      ...original,
      frames: [
        {
          ...original.frames[0],
          operations: [
            {
              kind: "effect",
              name: "url",
              shader: "https://example.com/app.js",
            },
          ],
        },
      ],
    }),
  ).toThrow(/embedded shader artifact/);
  expect(() =>
    validateShaderJob({
      ...original,
      frames: [
        {
          ...original.frames[0],
          operations: [
            { ...original.frames[0]!.operations[0], encode: "callback" },
          ],
        },
      ],
    }),
  ).toThrow(/callbacks/);
  const cyclic: Record<string, unknown> = { ...original };
  cyclic["self"] = cyclic;
  expect(() => validateShaderJob(cyclic)).toThrow(/cycles/);
});
it("rejects duplicate resource/pass ids and unsupported versions before rendering", () => {
  const original = job();
  expect(() => validateShaderJob({ ...original, version: 2 })).toThrow(
    /version 1/,
  );
  expect(() =>
    validateShaderJob({
      ...original,
      resources: [...original.resources, ...original.resources],
    }),
  ).toThrow(/duplicate resource/);
  expect(() =>
    validateShaderJob({
      ...original,
      frames: [
        {
          ...original.frames[0],
          operations: [
            ...original.frames[0]!.operations,
            ...original.frames[0]!.operations,
          ],
        },
      ],
    }),
  ).toThrow(/unique/);
  expect(() => decodeShaderJob(original)).toThrow(/codec/);
});
it("hoists module directives before imported declarations with original locations", () => {
  const artifact = compileShader({
    entry: "entry.wgsl",
    modules: {
      "entry.wgsl":
        '// @import "./library.wgsl"\nenable f16; @compute @workgroup_size(1) fn main(){let value = half();}',
      "library.wgsl": "fn half()->f16{return 1h;}",
    },
  });
  expect(artifact.code.startsWith("enable f16 ;\n")).toBe(true);
  expect(artifact.sourceMap[0]).toEqual({ file: "entry.wgsl", line: 2 });
  expect(artifact.requiredFeatures).toContain("shader-f16");
  expect(artifact.entryPoints[0]?.name).toBe("main");
});
