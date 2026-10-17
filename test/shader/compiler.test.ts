import { describe, expect, it } from "vitest";
import {
  compileShader,
  generateShaderTypes,
} from "@aperture-engine/shader/compiler";
import { mapShaderDiagnostic, packShaderBuffer } from "@aperture-engine/shader";
import { createShaderModuleLoader } from "../../packages/vite-plugin/src/shaders.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function compile(code: string) {
  return compileShader({
    entry: "entry.wgsl",
    modules: { "entry.wgsl": code },
  });
}

describe("Aperture shader artifacts", () => {
  it("flattens a diamond once, records deterministic hashes and original source locations", () => {
    const modules = {
      "entry.wgsl":
        '// @import "./a.wgsl"\n// @import "./b.wgsl"\n@fragment fn main() -> @location(0) vec4f { return vec4f(a()+b()); }',
      "a.wgsl": '// @import "./shared.wgsl"\nfn a()->f32 {return shared();}',
      "b.wgsl": '// @import "./shared.wgsl"\nfn b()->f32 {return shared();}',
      "shared.wgsl": "fn shared()->f32 {return 0.5;}",
    };
    const artifact = compileShader({ entry: "entry.wgsl", modules });
    expect(artifact).toEqual(
      compileShader({
        entry: "entry.wgsl",
        modules: Object.fromEntries(Object.entries(modules).reverse()),
      }),
    );
    expect(artifact.code.match(/fn shared/gu)).toHaveLength(1);
    expect(
      mapShaderDiagnostic(artifact, {
        message: "broken",
        lineNum: 1,
        linePos: 4,
      }).location,
    ).toEqual({ file: "shared.wgsl", line: 1, column: 4 });
    expect(JSON.parse(JSON.stringify(artifact))).toEqual(artifact);
  });
  it("rejects cycles, missing imports, duplicate names/slots, and library bindings", () => {
    expect(() =>
      compileShader({
        entry: "a",
        modules: { a: '// @import "./b"', b: '// @import "./a"' },
      }),
    ).toThrow(/a -> b -> a/);
    expect(() => compile('// @import "./missing"')).toThrow(/not supplied/);
    expect(() => compile("fn duplicate() {} fn duplicate() {} ")).toThrow(
      /Duplicate WGSL symbol/,
    );
    expect(() =>
      compile(
        "@group(0) @binding(0) var<uniform> a: vec4f; @group(0) @binding(0) var<uniform> b: vec4f;",
      ),
    ).toThrow(/Multiple resources/);
    expect(() =>
      compileShader({
        entry: "a",
        modules: {
          a: '// @import "./b"',
          b: "@group(0) @binding(0) var<uniform> hidden: vec4f;",
        },
      }),
    ).toThrow(/entry module/);
  });
  it("ignores import-like text in nested block comments and preserves raw WGSL", () => {
    const code =
      '/* outer\n/* nested */\n// @import "./missing"\n*/\n@compute @workgroup_size(1) fn main() {}';
    expect(compile(code).code).toBe(code);
  });
  it("reflects storage textures, samplers, overrides and per-entry visibility", () => {
    const artifact = compile(`override steps: u32 = 4u;
      @group(1) @binding(2) var image: texture_storage_2d<rgba8unorm, write>;
      @group(0) @binding(1) var source: texture_2d<f32>;
      @group(0) @binding(2) var linear: sampler;
      @compute @workgroup_size(4) fn calculate() { textureStore(image, vec2i(0), vec4f(f32(steps))); }
      @fragment fn shade() -> @location(0) vec4f { return textureSample(source, linear, vec2f(0.5)); }`);
    expect(artifact.bindings.find((b) => b.name === "image")).toMatchObject({
      kind: "storage-texture",
      access: "write",
      visibility: ["compute"],
      texture: { format: "rgba8unorm", dimension: "2d" },
    });
    expect(
      artifact.bindings.find((b) => b.name === "source")?.visibility,
    ).toEqual(["fragment"]);
    expect(artifact.overrides).toMatchObject([{ name: "steps", type: "u32" }]);
    expect(
      artifact.entryPoints.find((e) => e.stage === "compute")?.workgroupSize,
    ).toEqual([4, 1, 1]);
  });
});

describe("reflected host packing", () => {
  it("packs vec3-plus-scalar, padded matrices and nested arrays at WGSL offsets", () => {
    const artifact = compile(
      `struct Inner { direction: vec3f, weight: f32 }; struct Params { exposure: f32, tint: vec3f, basis: mat3x3f, data: array<Inner,2> }; @group(0) @binding(0) var<uniform> p: Params;`,
    );
    const layout = artifact.bindings[0]!.layout!;
    const bytes = packShaderBuffer(layout, {
      exposure: 2,
      tint: [3, 4, 5],
      basis: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      data: [
        { direction: [10, 11, 12], weight: 13 },
        { direction: [14, 15, 16], weight: 17 },
      ],
    });
    const floats = new Float32Array(bytes.buffer);
    expect(bytes.byteLength).toBe(112);
    expect([...floats.slice(0, 8)]).toEqual([2, 0, 0, 0, 3, 4, 5, 0]);
    expect([...floats.slice(8, 20)]).toEqual([
      1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0,
    ]);
    expect([...floats.slice(20)]).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
    expect(generateShaderTypes(artifact)).toContain('readonly "p"');
  });
  it("distinguishes legal storage arrays from uniform layout violations", () => {
    const storage = compile(
      "@group(0) @binding(0) var<storage,read_write> values: array<f32>;",
    );
    expect(storage.bindings[0]!.minBindingSize).toBe(4);
    expect([
      ...new Float32Array(
        packShaderBuffer(storage.bindings[0]!.layout!, [2, 3, 4]).buffer,
      ),
    ]).toEqual([2, 3, 4]);
    expect(() =>
      compile("@group(0) @binding(0) var<uniform> values: array<f32, 3>;"),
    ).toThrow(/stride divisible by 16/);
    expect(() =>
      compile(
        "struct Inner {x:f32}; struct Outer {x:f32,y:Inner}; @group(0) @binding(0) var<uniform> p:Outer;",
      ),
    ).toThrow(/alignment 16/);
    expect(() =>
      compile(
        "struct Inner {x:f32}; struct Outer {x:Inner,y:f32}; @group(0) @binding(0) var<uniform> p:Outer;",
      ),
    ).toThrow(/trailing spacing/);
  });
  it("honors explicit padding and rejects shape/range mistakes", () => {
    const artifact = compile(
      "struct Slot {@size(16) value: f32}; struct U { data:array<Slot,2> }; @group(0) @binding(0) var<uniform> p:U;",
    );
    const layout = artifact.bindings[0]!.layout!;
    expect([
      ...new Float32Array(
        packShaderBuffer(layout, { data: [{ value: 2 }, { value: 3 }] }).buffer,
      ),
    ]).toEqual([2, 0, 0, 0, 3, 0, 0, 0]);
    expect(() => packShaderBuffer(layout, { data: [{ value: 1 }] })).toThrow(
      /2 values/,
    );
    expect(() => packShaderBuffer(layout, { extra: 1 })).toThrow(
      /not a reflected field/,
    );
    expect(() =>
      packShaderBuffer(layout, { data: [{ value: NaN }, { value: 3 }] }),
    ).toThrow(/finite/);
    const uint = compile("@group(0) @binding(0) var<storage> value:u32;")
      .bindings[0]!.layout!;
    expect(() => packShaderBuffer(uint, -1)).toThrow(/u32/);
  });
  it("packs f16 including round-to-even and signed zero", () => {
    const artifact = compile(
      "enable f16; @group(0) @binding(0) var<storage> values: array<f16,4>;",
    );
    expect(artifact.requiredFeatures).toContain("shader-f16");
    expect([
      ...new Uint16Array(
        packShaderBuffer(artifact.bindings[0]!.layout!, [
          1,
          -0,
          1 + 2 ** -11,
          2 ** -24,
        ]).buffer,
      ),
    ]).toEqual([0x3c00, 0x8000, 0x3c00, 1]);
  });
});

it("Vite emits portable artifacts, watches imported libraries, and reports broken edits", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aperture-wgsl-"));
  try {
    const file = path.join(directory, "effect.wgsl"),
      library = path.join(directory, "library.wgsl");
    await writeFile(
      file,
      '// @import "./library.wgsl"\n@fragment fn main()->@location(0) vec4f {return color();}',
    );
    await writeFile(library, "fn color()->vec4f {return vec4f(1);}");
    const loader = createShaderModuleLoader(),
      watched: string[] = [];
    const code = await loader.load(file + "?aperture", (dependency) =>
      watched.push(dependency),
    );
    expect(code).toContain('"format":"aperture.shader"');
    expect(code).not.toContain("wgsl_reflect.module.js");
    expect(watched).toContain(library);
    expect(loader.affected(library)).toEqual([file + "?aperture"]);
    await writeFile(library, "fn color( ->");
    await expect(loader.load(file + "?aperture")).rejects.toThrow();
    expect(loader.affected(library)).toEqual([file + "?aperture"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("explicit dynamic preparation produces the same portable artifact as Node compilation", async () => {
  const { prepareShader } = await import("@aperture-engine/shader/prepare");
  const options = {
    entry: "nested/../entry.wgsl",
    modules: {
      "entry.wgsl":
        '// @import "./nested/../palette.wgsl"\n@fragment fn main()->@location(0) vec4f{return palette();}',
      "palette.wgsl": "fn palette()->vec4f{return vec4f(0.25,0.5,0.75,1);}",
    },
  };
  expect(await prepareShader(options)).toEqual(compileShader(options));
});
