/** Declarative examples shared by browser controls and native parity tests. */
export function createDemoJob(
  shaders,
  mode,
  width = 512,
  height = 320,
  frameCount = 1,
) {
  const resources = [],
    operations = [];
  const texture = (id, lifetime = "transient") =>
    resources.push({
      kind: "texture",
      id,
      format: "rgba8unorm",
      usage: ["sampled", "attachment"],
      lifetime,
    });
  if (mode === "procedural") {
    resources.push({
      kind: "texture",
      id: "grain",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      usage: ["sampled", "copy-dst"],
      data: new Uint8Array([
        255, 128, 32, 255, 64, 192, 255, 255, 255, 224, 128, 255, 128, 255, 192,
        255,
      ]),
    });
    operations.push({
      kind: "effect",
      name: "sculpture",
      shader: shaders.procedural,
      bindings: {
        parameters: { uniform: { tint: [1, 1, 1, 1], controls: [1, 1, 0, 0] } },
        frame: { frame: true },
        image: { resource: "grain" },
      },
    });
  } else if (mode === "compute") {
    resources.push(
      {
        kind: "buffer",
        id: "vertices",
        size: 24,
        usage: ["storage", "vertex"],
      },
      {
        kind: "buffer",
        id: "arguments",
        size: 16,
        usage: ["storage", "indirect"],
      },
    );
    operations.push({
      kind: "compute",
      name: "simulate",
      shader: shaders.compute,
      bindings: {
        vertices: { resource: "vertices" },
        arguments: { resource: "arguments" },
        step: { input: "step" },
      },
      dispatch: [1],
    });
    operations.push({
      kind: "draw",
      name: "draw",
      shader: shaders.draw,
      vertices: [
        {
          resource: "vertices",
          layout: {
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
        },
      ],
      indirect: { resource: "arguments" },
      targets: [{ resource: "$output", clear: [0.018, 0.03, 0.06, 1] }],
    });
  } else if (mode === "history") {
    texture("trail", "history");
    operations.push({
      kind: "effect",
      name: "accumulate",
      shader: shaders.history,
      bindings: {
        previous: { resource: "trail", history: "previous" },
        frame: { frame: true },
      },
      targets: [{ resource: "trail", history: "current" }],
    });
    operations.push({
      kind: "effect",
      name: "present",
      shader: shaders.present,
      bindings: { image: { resource: "trail", history: "current" } },
    });
  } else if (mode === "mrt") {
    texture("warm");
    texture("cool");
    operations.push({
      kind: "effect",
      name: "split",
      shader: shaders.mrt,
      targets: [{ resource: "warm" }, { resource: "cool" }],
    });
    operations.push({
      kind: "effect",
      name: "combine",
      shader: shaders.combine,
      bindings: { warm: { resource: "warm" }, cool: { resource: "cool" } },
    });
  } else throw new Error(`Unknown demo '${mode}'.`);
  return {
    format: "aperture.shader-job",
    version: 1,
    width,
    height,
    resources,
    frames: Array.from({ length: frameCount }, (_, index) => ({
      input: {
        time: index / 30,
        delta: 1 / 30,
        values: { step: { time: index / 30 } },
      },
      operations,
      writes: [],
    })),
  };
}
