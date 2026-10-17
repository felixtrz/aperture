import assert from "node:assert/strict";

// Share real-device behavior checks between the packaged Node qualification
// lane and Vitest's source-instrumented coverage lane. Neither runner mocks GPU.
export function registerStandaloneGpuTests(
  { before, after, test },
  {
    createNodeDevice,
    createOffscreenOutput,
    compileShader,
    createGpuContext,
    renderShaderJob,
    encodeShaderJob,
    decodeShaderJob,
  },
) {
  let native;
  before(async () => {
    native = await createNodeDevice({ adapter: "software" });
  });
  after(async () => {
    await native?.dispose();
  });
  function shader(code, modules = {}) {
    return compileShader({
      entry: "effect.wgsl",
      modules: { "effect.wgsl": code, ...modules },
    });
  }
  const colorShader = shader(
    "struct Tint {color:vec4f}; @group(0) @binding(0) var<uniform> tint:Tint; @fragment fn main()->@location(0) vec4f {return tint.color;}",
  );
  async function withContext(run, options = {}) {
    const output = createOffscreenOutput(native.device, {
      width: 65,
      height: 33,
    });
    const context = createGpuContext({
      device: native.device,
      output,
      ...options,
    });
    try {
      await run(context, output);
      native.assertHealthy();
    } finally {
      await context.dispose();
      await output.dispose();
    }
  }
  const pixel = async (output) => [...(await output.readRgba()).slice(0, 4)];

  test("standalone effect updates named parameters and renders through one graph submission", async () => {
    await withContext(async (context, output) => {
      const effect = await context.effect({
        name: "color",
        shader: colorShader,
        bindings: { tint: { uniform: { color: [0.25, 0.5, 0.75, 1] } } },
      });
      const report = await context.frame();
      assert.equal(report.submittedCommandBuffers, 1);
      assert.deepEqual(report.graph.order, ["color"]);
      assert.deepEqual(await pixel(output), [64, 128, 191, 255]);
      effect.parameters({ tint: { color: [1, 0, 0, 1] } });
      await context.frame();
      assert.deepEqual(await pixel(output), [255, 0, 0, 255]);
      assert.throws(
        () => effect.parameters({ tint: { color: [1, 0] } }),
        /4 values/,
      );
    });
  });

  test("public compute operation feeds a fragment shader without CPU readback", async () => {
    await withContext(async (context, output) => {
      context.resource({
        kind: "buffer",
        id: "values",
        size: 16,
        usage: ["storage", "copy-src"],
      });
      await context.compute({
        name: "simulate",
        shader: shader(
          "@group(0) @binding(0) var<storage,read_write> data:vec4f; @compute @workgroup_size(1) fn main(){data=vec4f(0.2,0.4,0.6,1);}",
        ),
        bindings: { data: { resource: "values" } },
        dispatch: [1],
      });
      await context.effect({
        name: "visualize",
        shader: shader(
          "@group(0) @binding(0) var<storage,read> data:vec4f; @fragment fn main()->@location(0) vec4f{return data;}",
        ),
        bindings: { data: { resource: "values" } },
      });
      const report = await context.frame();
      assert.deepEqual(report.graph.order, ["simulate", "visualize"]);
      assert.equal(report.submittedCommandBuffers, 1);
      assert.deepEqual(await pixel(output), [51, 102, 153, 255]);
      assert.ok(
        Math.abs(
          new Float32Array((await context.readBuffer("values")).buffer)[2] -
            0.6,
        ) < 1e-6,
      );
    });
  });

  test("history feedback resets, resizes and replays a portable capture deterministically", async () => {
    await withContext(
      async (context, output) => {
        context.resource({
          kind: "texture",
          id: "history",
          format: "rgba8unorm",
          usage: ["sampled", "attachment"],
          lifetime: "history",
        });
        await context.effect({
          name: "accumulate",
          shader: shader(
            "@group(0) @binding(0) var previous:texture_2d<f32>; @fragment fn main(@builtin(position) position:vec4f)->@location(0) vec4f {return textureLoad(previous,vec2i(position.xy),0)+vec4f(0.1,0,0,1);}",
          ),
          bindings: { previous: { resource: "history", history: "previous" } },
          targets: [{ resource: "history", history: "current" }],
        });
        await context.effect({
          name: "present",
          shader: shader(
            "@group(0) @binding(0) var current:texture_2d<f32>; @fragment fn main(@builtin(position) position:vec4f)->@location(0) vec4f{return textureLoad(current,vec2i(position.xy),0);}",
          ),
          bindings: { current: { resource: "history", history: "current" } },
        });
        await context.frame({ time: 0 });
        const first = await pixel(output);
        await context.frame({ time: 1 });
        const second = await pixel(output);
        assert.ok(second[0] > first[0] + 20);
        const job = context.capture();
        const replayOutput = createOffscreenOutput(native.device, {
          width: job.width,
          height: job.height,
        });
        let replay;
        try {
          replay = await renderShaderJob(job, {
            device: native.device,
            output: replayOutput,
          });
          assert.deepEqual(await pixel(replayOutput), second);
        } finally {
          await replay?.context.dispose();
          await replayOutput.dispose();
        }
        context.reset();
        await context.frame();
        assert.deepEqual(await pixel(output), first);
        context.resize(17, 9);
        await context.frame();
        assert.deepEqual(await pixel(output), first);
        assert.equal((await output.readRgba()).length, 17 * 9 * 4);
      },
      { record: true },
    );
  });

  test("MRT outputs are real attachments sampled by another pass", async () => {
    await withContext(async (context, output) => {
      for (const id of ["red", "green"])
        context.resource({
          kind: "texture",
          id,
          format: "rgba8unorm",
          usage: ["sampled", "attachment"],
          lifetime: "transient",
        });
      await context.effect({
        name: "mrt",
        shader: shader(
          "struct Colors {@location(0) red:vec4f,@location(1) green:vec4f}; @fragment fn main()->Colors {var c:Colors;c.red=vec4f(1,0,0,1);c.green=vec4f(0,1,0,1);return c;}",
        ),
        targets: [{ resource: "red" }, { resource: "green" }],
      });
      await context.effect({
        name: "combine",
        shader: shader(
          "@group(0) @binding(0) var red:texture_2d<f32>; @group(0) @binding(1) var green:texture_2d<f32>; @fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f {return textureLoad(red,vec2i(p.xy),0)+textureLoad(green,vec2i(p.xy),0);}",
        ),
        bindings: { red: { resource: "red" }, green: { resource: "green" } },
      });
      await context.frame();
      assert.deepEqual(await pixel(output), [255, 255, 0, 255]);
    });
  });

  test("failed imported shader replacement retains the last valid pipeline and pixels", async () => {
    await withContext(async (context, output) => {
      const effect = await context.effect({
        name: "color",
        shader: colorShader,
        bindings: { tint: { uniform: { color: [0, 0, 1, 1] } } },
      });
      await context.frame();
      const first = await pixel(output);
      const broken = shader(
        '// @import "./broken.wgsl"\nstruct Tint {color:vec4f}; @group(0) @binding(0) var<uniform> tint:Tint; @fragment fn main()->@location(0) vec4f {return tint.color*broken();}',
        { "broken.wgsl": "fn broken()->f32 {\nreturn missing();\n}" },
      );
      const result = await effect.replace(broken);
      assert.equal(result.ok, false);
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.location?.file === "broken.wgsl" &&
            diagnostic.location.line === 2,
        ),
      );
      await context.frame();
      assert.deepEqual(await pixel(output), first);
      const changed = shader(
        colorShader.code.replace(
          "return tint.color;",
          "return tint.color * 0.5;",
        ),
      );
      assert.equal((await effect.replace(changed)).ok, true);
      await context.frame();
      assert.deepEqual(await pixel(output), [0, 0, 128, 255]);
    });
  });

  test("resource contract rejects feedback, undeclared bindings, usage and ranges before submission", async () => {
    await withContext(async (context) => {
      context.resource({
        kind: "texture",
        id: "feedback",
        format: "rgba8unorm",
        usage: ["sampled", "attachment"],
      });
      const sample = shader(
        "@group(0) @binding(0) var input:texture_2d<f32>; @fragment fn main()->@location(0) vec4f{return textureLoad(input,vec2i(0),0);}",
      );
      await assert.rejects(
        context.effect({
          name: "bad",
          shader: sample,
          bindings: { input: { resource: "feedback" } },
          targets: [{ resource: "feedback" }],
        }),
        /overlapping/,
      );
      await assert.rejects(
        context.effect({ name: "missing", shader: sample }),
        /Missing named binding/,
      );
      context.resource({
        kind: "buffer",
        id: "buffer",
        size: 64,
        usage: ["storage"],
      });
      await assert.rejects(
        context.effect({
          name: "wrongUsage",
          shader: colorShader,
          bindings: { tint: { resource: "buffer" } },
        }),
        /uniform.*usage/,
      );
      assert.throws(
        () => context.writeBuffer("buffer", new Uint8Array(4)),
        /copy-dst/,
      );
      const data = shader(
        "@group(0) @binding(0) var<storage,read> data:vec4f; @fragment fn main()->@location(0) vec4f{return data;}",
      );
      await assert.rejects(
        context.effect({
          name: "alignment",
          shader: data,
          bindings: { data: { resource: "buffer", offset: 4, size: 16 } },
        }),
        /alignment/,
      );
    });
  });

  test("portable codec replay preserves pass order when an earlier shader changes", async () => {
    await withContext(
      async (context, output) => {
        context.resource({
          kind: "texture",
          id: "layer",
          format: "rgba8unorm",
          usage: ["sampled", "attachment"],
        });
        const first = await context.effect({
          name: "first",
          shader: colorShader,
          bindings: { tint: { uniform: { color: [1, 0, 0, 1] } } },
          targets: [{ resource: "layer" }],
        });
        await context.effect({
          name: "present",
          shader: shader(
            "@group(0) @binding(0) var t:texture_2d<f32>; @fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f{return textureLoad(t,vec2i(p.xy),0);}",
          ),
          bindings: { t: { resource: "layer" } },
        });
        await context.frame();
        first.parameters({ tint: { color: [0, 1, 0, 1] } });
        await context.frame();
        const job = decodeShaderJob(
          JSON.parse(JSON.stringify(encodeShaderJob(context.capture()))),
        );
        const replay = await renderShaderJob(job, {
          device: native.device,
          output,
        });
        try {
          assert.deepEqual(replay.reports[1].graph.order, ["first", "present"]);
          assert.deepEqual(await pixel(output), [0, 255, 0, 255]);
          assert.equal(replay.context.inspect().pipelineCount, 2);
        } finally {
          await replay.context.dispose();
        }
      },
      { record: true },
    );
  });

  test("layout replacement migrates compatible fields and reports removed parameters", async () => {
    await withContext(
      async (context, output) => {
        const original = shader(
          "struct P {color:vec4f, old:f32}; @group(0) @binding(0) var<uniform> p:P; @fragment fn main()->@location(0) vec4f{return p.color+p.old*0;}",
        );
        const next = shader(
          "struct P {color:vec4f, gain:f32}; @group(0) @binding(0) var<uniform> p:P; @fragment fn main()->@location(0) vec4f{return vec4f(p.color.rgb*p.gain,1);}",
        );
        const effect = await context.effect({
          name: "migrate",
          shader: original,
          bindings: { p: { uniform: { color: [1, 0.5, 0, 1], old: 4 } } },
        });
        await context.frame();
        const rejected = await effect.replace(next);
        assert.equal(rejected.ok, false);
        assert.match(rejected.diagnostics.at(-1).message, /gain/);
        const result = await effect.replace(next, { p: { gain: 0.5 } });
        assert.equal(result.ok, true);
        assert.ok(result.diagnostics.some((d) => d.message.includes("p.old")));
        await context.frame();
        assert.deepEqual(await pixel(output), [128, 64, 0, 255]);
        assert.throws(() => context.capture(), /Reset before capturing/);
        context.reset();
        await context.frame();
        assert.equal(context.capture().frames.length, 1);
      },
      { record: true },
    );
  });

  test("compute writes vertex and indirect draw resources in the same submission", async () => {
    await withContext(async (context, output) => {
      context.resource({
        kind: "buffer",
        id: "vertices",
        size: 24,
        usage: ["storage", "vertex"],
      });
      context.resource({
        kind: "buffer",
        id: "args",
        size: 16,
        usage: ["storage", "indirect"],
      });
      await context.compute({
        name: "simulate",
        shader: shader(
          "@group(0) @binding(0) var<storage,read_write> vertices:array<vec2f>; @group(0) @binding(1) var<storage,read_write> args:vec4u; @compute @workgroup_size(1) fn main(){vertices[0]=vec2f(-1,-1);vertices[1]=vec2f(3,-1);vertices[2]=vec2f(-1,3);args=vec4u(3,1,0,0);}",
        ),
        bindings: {
          vertices: { resource: "vertices" },
          args: { resource: "args" },
        },
        dispatch: [1],
      });
      await context.draw({
        name: "draw",
        shader: shader(
          "@vertex fn vs(@location(0) p:vec2f)->@builtin(position) vec4f{return vec4f(p,0,1);} @fragment fn fs()->@location(0) vec4f{return vec4f(0,0.5,1,1);}",
        ),
        vertices: [
          {
            resource: "vertices",
            layout: {
              arrayStride: 8,
              attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x2" },
              ],
            },
          },
        ],
        indirect: { resource: "args" },
      });
      const report = await context.frame();
      assert.equal(report.submittedCommandBuffers, 1);
      assert.deepEqual(await pixel(output), [0, 128, 255, 255]);
    });
  });

  test("storage texture compute, multisample resolve and depth target are real resources", async () => {
    await withContext(async (context, output) => {
      context.resource({
        kind: "texture",
        id: "computed",
        format: "rgba8unorm",
        usage: ["storage", "sampled"],
      });
      context.resource({
        kind: "texture",
        id: "msaa",
        format: "rgba8unorm",
        sampleCount: 4,
        usage: ["attachment"],
      });
      context.resource({
        kind: "texture",
        id: "depth",
        format: "depth32float",
        sampleCount: 4,
        usage: ["attachment"],
      });
      await context.compute({
        name: "fill",
        shader: shader(
          "@group(0) @binding(0) var destination:texture_storage_2d<rgba8unorm,write>; @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3u){textureStore(destination,vec2i(id.xy),vec4f(0.75,0.25,0.5,1));}",
        ),
        bindings: { destination: { resource: "computed" } },
        dispatch: [65, 33],
      });
      await context.effect({
        name: "resolve",
        shader: shader(
          "@group(0) @binding(0) var t:texture_2d<f32>; @fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f{return textureLoad(t,vec2i(p.xy),0);}",
        ),
        bindings: { t: { resource: "computed" } },
        targets: [
          {
            resource: "msaa",
            resolve: { resource: "$output" },
            store: "discard",
          },
        ],
        depth: { resource: "depth" },
      });
      await context.frame();
      assert.deepEqual(await pixel(output), [191, 64, 128, 255]);
    });
  });

  test("captured frame inputs are identical for every pass and resize resets initial buffers", async () => {
    await withContext(
      async (context, output) => {
        context.resource({
          kind: "buffer",
          id: "count",
          size: 16,
          usage: ["storage", "copy-src"],
          data: new Uint8Array(new Float32Array([0, 0, 0, 1]).buffer),
        });
        await context.compute({
          name: "count",
          shader: shader(
            "@group(0) @binding(0) var<storage,read_write> count:vec4f; @compute @workgroup_size(1) fn main(){count.x+=0.1;}",
          ),
          bindings: { count: { resource: "count" } },
          dispatch: [1],
        });
        await context.effect({
          name: "show",
          shader: shader(
            "struct P{value:vec4f}; @group(0) @binding(0) var<uniform> p:P; @group(0) @binding(1) var<storage,read> count:vec4f; @fragment fn main()->@location(0) vec4f{return vec4f(count.x,p.value.yz,1);}",
          ),
          bindings: {
            p: { input: "parameters" },
            count: { resource: "count" },
          },
        });
        const input = { values: { parameters: { value: [0, 0.5, 0.25, 1] } } };
        const pending = context.frame(input);
        input.values.parameters.value[1] = 1;
        await pending;
        assert.deepEqual(await pixel(output), [26, 128, 64, 255]);
        await context.frame(input);
        context.resize(17, 9);
        await context.frame(input);
        const expected = await pixel(output);
        const replay = await renderShaderJob(context.capture(), {
          device: native.device,
          output,
        });
        try {
          assert.deepEqual(await pixel(output), expected);
        } finally {
          await replay.context.dispose();
        }
      },
      { record: true },
    );
  });

  test("external resources wait for declared synchronization and remain borrowed", async () => {
    const buffer = native.device.createBuffer({ size: 16, usage: 0x80 | 0x08 });
    let release;
    const ready = new Promise((resolve) => {
      release = resolve;
    });
    try {
      await withContext(async (context, output) => {
        context.importBuffer({
          id: "external",
          device: native.device,
          buffer,
          usage: ["storage"],
          ready,
        });
        await context.effect({
          name: "external",
          shader: shader(
            "@group(0) @binding(0) var<storage,read> value:vec4f; @fragment fn main()->@location(0) vec4f{return value;}",
          ),
          bindings: { value: { resource: "external" } },
        });
        const frame = context.frame();
        native.device.queue.writeBuffer(
          buffer,
          0,
          new Float32Array([0, 1, 1, 1]),
        );
        release();
        await frame;
        assert.deepEqual(await pixel(output), [0, 255, 255, 255]);
      });
      native.device.queue.writeBuffer(
        buffer,
        0,
        new Float32Array([1, 0, 0, 1]),
      );
      await native.device.queue.onSubmittedWorkDone();
      native.assertHealthy();
    } finally {
      buffer.destroy();
    }
  });

  test("undefined transient contents and discarded attachments fail before submission", async () => {
    await withContext(async (context) => {
      context.resource({
        kind: "texture",
        id: "scratch",
        format: "rgba8unorm",
        lifetime: "transient",
        usage: ["attachment", "sampled"],
      });
      const consume = await context.effect({
        name: "consume",
        shader: shader(
          "@group(0) @binding(0) var source:texture_2d<f32>; @fragment fn main()->@location(0) vec4f{return textureLoad(source,vec2i(0),0);}",
        ),
        bindings: { source: { resource: "scratch" } },
      });
      await assert.rejects(context.frame(), /undefined contents/);
      consume.remove();
      const producer = await context.effect({
        name: "producer",
        shader: colorShader,
        bindings: { tint: { uniform: { color: [1, 0, 0, 1] } } },
        targets: [{ resource: "scratch", store: "discard" }],
      });
      await context.effect({
        name: "consumer",
        shader: shader(
          "@group(0) @binding(0) var source:texture_2d<f32>; @fragment fn main()->@location(0) vec4f{return textureLoad(source,vec2i(0),0);}",
        ),
        bindings: { source: { resource: "scratch" } },
      });
      await assert.rejects(context.frame(), /undefined contents/);
      producer.remove();
    });
  });

  test("failed resize preserves output, every resource and previous pixels", async () => {
    await withContext(
      async (context, output) => {
        context.resource({
          kind: "texture",
          id: "first",
          format: "rgba8unorm",
          usage: ["attachment"],
        });
        context.resource({
          kind: "texture",
          id: "second",
          format: "rgba16float",
          usage: ["attachment"],
        });
        await context.effect({
          name: "color",
          shader: colorShader,
          bindings: { tint: { uniform: { color: [0, 1, 0, 1] } } },
        });
        await context.frame();
        const before = context.inspect().resources;
        assert.throws(() => context.resize(1024, 1024), /memory budget/);
        assert.equal(output.width, 65);
        assert.deepEqual(context.inspect().resources, before);
        await context.frame();
        assert.deepEqual(await pixel(output), [0, 255, 0, 255]);
      },
      { maxBytes: 1024 * 1024 },
    );
  });

  test("failed history allocation leaves shader replacement and captured state unchanged", async () => {
    let rejectTexture = false;
    const device = new Proxy(native.device, {
      get(target, property) {
        if (property === "createTexture")
          return (...args) => {
            if (rejectTexture)
              throw new Error("injected texture allocation failure");
            return target.createTexture(...args);
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const output = createOffscreenOutput(device, { width: 17, height: 9 });
    const context = createGpuContext({ device, output, record: true });
    try {
      context.resource({
        kind: "texture",
        id: "history",
        format: "rgba8unorm",
        usage: ["sampled", "attachment"],
        lifetime: "history",
      });
      const effect = await context.effect({
        name: "color",
        shader: colorShader,
        bindings: { tint: { uniform: { color: [0, 1, 0, 1] } } },
      });
      await context.frame();
      const previous = context.inspect();
      const capture = context.capture();
      const changed = shader(
        "struct Tint {color:vec4f, gain:f32}; @group(0) @binding(0) var<uniform> tint:Tint; @fragment fn main()->@location(0) vec4f{return tint.color*tint.gain;}",
      );
      rejectTexture = true;
      const result = await effect.replace(changed, { tint: { gain: 0.5 } });
      rejectTexture = false;
      assert.equal(result.ok, false);
      assert.match(
        result.diagnostics.at(-1).message,
        /injected texture allocation/,
      );
      assert.deepEqual(context.inspect().operations, previous.operations);
      assert.deepEqual(context.inspect().resources, previous.resources);
      assert.deepEqual(context.capture(), capture);
      await context.frame();
      assert.deepEqual(await pixel(output), [0, 255, 0, 255]);
      native.assertHealthy();
    } finally {
      await context.dispose();
      await output.dispose();
    }
  });

  test("a failed frame retains pending buffer writes for the next portable capture", async () => {
    await withContext(
      async (context, output) => {
        context.resource({
          kind: "buffer",
          id: "color",
          size: 16,
          usage: ["storage", "copy-dst"],
        });
        context.resource({
          kind: "texture",
          id: "uninitialized",
          format: "rgba8unorm",
          usage: ["sampled", "attachment"],
          lifetime: "transient",
        });
        await context.effect({
          name: "color",
          shader: shader(
            "@group(0) @binding(0) var<storage,read> color:vec4f; @fragment fn main()->@location(0) vec4f{return color;}",
          ),
          bindings: { color: { resource: "color" } },
        });
        const invalid = await context.effect({
          name: "invalid",
          shader: shader(
            "@group(0) @binding(0) var source:texture_2d<f32>; @fragment fn main()->@location(0) vec4f{return textureLoad(source,vec2i(0),0);}",
          ),
          bindings: { source: { resource: "uninitialized" } },
        });
        context.writeBuffer(
          "color",
          new Uint8Array(new Float32Array([0, 1, 0, 1]).buffer),
        );
        await assert.rejects(context.frame(), /undefined contents/);
        invalid.remove();
        await context.frame();
        assert.deepEqual(await pixel(output), [0, 255, 0, 255]);
        const replayOutput = createOffscreenOutput(native.device, {
          width: output.width,
          height: output.height,
        });
        let replay;
        try {
          replay = await renderShaderJob(context.capture(), {
            device: native.device,
            output: replayOutput,
          });
          assert.deepEqual(await pixel(replayOutput), await pixel(output));
        } finally {
          await replay?.context.dispose();
          await replayOutput.dispose();
        }
      },
      { record: true },
    );
  });

  test("borrowed textures retain contents and ownership after context resize/disposal", async () => {
    const texture = native.device.createTexture({
      size: [1, 1],
      format: "rgba8unorm",
      usage: 0x04 | 0x02,
    });
    const bytes = new Uint8Array([25, 50, 75, 255]);
    native.device.queue.writeTexture(
      { texture },
      bytes,
      { bytesPerRow: 4 },
      [1, 1],
    );
    await withContext(async (context, output) => {
      context.importTexture({
        id: "external",
        device: native.device,
        texture,
        usage: ["sampled"],
        ready: native.device.queue.onSubmittedWorkDone(),
      });
      await context.effect({
        name: "sample",
        shader: shader(
          "@group(0) @binding(0) var source:texture_2d<f32>; @fragment fn main()->@location(0) vec4f{return textureLoad(source,vec2i(0),0);}",
        ),
        bindings: { source: { resource: "external" } },
      });
      context.resize(33, 17);
      await context.frame();
      assert.deepEqual(await pixel(output), [...bytes]);
    });
    native.device.pushErrorScope("validation");
    native.device.queue.writeTexture(
      { texture },
      bytes,
      { bytesPerRow: 4 },
      [1, 1],
    );
    assert.equal(await native.device.popErrorScope(), null);
    texture.destroy();
  });

  test("read-only depth may be sampled while attached without load/store writes", async () => {
    const output = createOffscreenOutput(native.device, {
      width: 65,
      height: 33,
    });
    const gpu = createGpuContext({ device: native.device, output });
    try {
      gpu.resource({
        kind: "texture",
        id: "depth",
        format: "depth32float",
        usage: ["attachment", "sampled"],
        lifetime: "transient",
      });
      gpu.resource({
        kind: "texture",
        id: "color",
        format: "rgba8unorm",
        usage: ["attachment"],
        lifetime: "transient",
      });
      await gpu.effect({
        name: "depth-writer",
        shader: compileShader({
          entry: "depth.wgsl",
          modules: {
            "depth.wgsl":
              "@fragment fn main()->@location(0) vec4f{return vec4f(1);}",
          },
        }),
        targets: [{ resource: "color" }],
        depth: {
          resource: "depth",
          load: "clear",
          write: true,
          compare: "always",
        },
      });
      await gpu.effect({
        name: "depth-reader",
        shader: compileShader({
          entry: "sample.wgsl",
          modules: {
            "sample.wgsl":
              "@group(0) @binding(0) var depth:texture_depth_2d; @fragment fn main(@builtin(position) pixel:vec4f)->@location(0) vec4f {let d=textureLoad(depth,vec2i(pixel.xy),0);return vec4f(d,1-d,0,1);}",
          },
        }),
        bindings: { depth: { resource: "depth" } },
        depth: { resource: "depth", readOnly: true, compare: "always" },
      });
      const report = await gpu.frame();
      assert.equal(report.submittedCommandBuffers, 1);
      assert.deepEqual(
        [...(await output.readRgba()).slice(0, 4)],
        [0, 255, 0, 255],
      );
      native.assertHealthy();
    } finally {
      await gpu.dispose();
      await output.dispose();
    }
  });
}
