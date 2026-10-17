import { createBrowserGpuContext } from "@aperture-engine/gpu/browser";
import { encodeShaderJob } from "@aperture-engine/shader";
import procedural from "./shaders/procedural.wgsl?aperture";
import compute from "./shaders/compute.wgsl?aperture";
import draw from "./shaders/draw.wgsl?aperture";
import history from "./shaders/history.wgsl?aperture";
import present from "./shaders/present.wgsl?aperture";
import mrt from "./shaders/mrt.wgsl?aperture";
import combine from "./shaders/combine.wgsl?aperture";
import { createDemoJob } from "./programs.mjs";
import "./style.css";

const shaders = { procedural, compute, draw, history, present, mrt, combine };
const canvas = document.querySelector("canvas"),
  status = document.querySelector("#status"),
  mode = document.querySelector("#mode");
let device,
  context,
  sculpture,
  frame = 0,
  paused = false,
  chain = Promise.resolve();
const enqueue = (work) => {
  chain = chain.then(work).catch((error) => {
    paused = true;
    status.textContent = error.message;
  });
  return chain;
};
async function setup() {
  await context?.dispose();
  device ??= await (await navigator.gpu.requestAdapter())?.requestDevice();
  if (!device) throw new Error("No WebGPU device is available.");
  context = await createBrowserGpuContext({ canvas, device, record: true });
  sculpture = undefined;
  frame = 0;
  const job = createDemoJob(shaders, mode.value, canvas.width, canvas.height);
  for (const source of job.resources) context.resource(source);
  for (const operation of job.frames[0].operations) {
    const handle = await context[operation.kind](operation);
    if (operation.name === "sculpture") sculpture = handle;
  }
}
async function step() {
  const report = await context.frame({
    time: frame / 30,
    delta: 1 / 30,
    values: { step: { time: frame / 30 } },
  });
  frame++;
  status.textContent = `Frame ${frame} · ${report.graph.order.join(" → ")} · CPU encode ${report.cpuEncodeMs.toFixed(2)} ms`;
}
document.querySelector("#pause").onclick = () => {
  paused = !paused;
  document.querySelector("#pause").textContent = paused ? "Play" : "Pause";
};
document.querySelector("#step").onclick = () => enqueue(step);
document.querySelector("#reset").onclick = () =>
  enqueue(async () => {
    context.reset();
    frame = 0;
    await step();
  });
mode.onchange = () =>
  enqueue(async () => {
    await setup();
    await step();
  });
for (const id of ["deformation", "exposure"])
  document.querySelector(`#${id}`).oninput = () =>
    enqueue(async () => {
      sculpture?.parameters({
        parameters: {
          controls: [
            Number(document.querySelector("#deformation").value),
            Number(document.querySelector("#exposure").value),
            0,
            0,
          ],
        },
      });
      if (paused) await step();
    });
document.querySelector("#capture").onclick = () =>
  enqueue(async () => {
    paused = true;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(encodeShaderJob(context.capture()))], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "capture.json";
    link.click();
    URL.revokeObjectURL(url);
  });
await enqueue(async () => {
  await setup();
  await step();
});
const animate = () => {
  void enqueue(async () => {
    if (!paused) {
      if (frame >= 3600) {
        paused = true;
        status.textContent = "Capture ready. Save or reset to continue.";
      } else await step();
    }
  }).then(() => requestAnimationFrame(animate));
};
if (new URLSearchParams(location.search).has("verify")) {
  paused = true;
  try {
    const { prepareShader } = await import("@aperture-engine/shader/prepare");
    const broken = await prepareShader({
      entry: "main.wgsl",
      modules: {
        "library.wgsl": "fn imported()->vec3f { return 1.0; }",
        "main.wgsl":
          '// @import "./library.wgsl"\n@fragment fn main()->@location(0) vec4f{return vec4f(imported(),1);}',
      },
    });
    const oldHash = context.inspect().operations[0].shader.hash;
    const rejected = await sculpture.replace(broken);
    if (
      rejected.ok ||
      !rejected.diagnostics.some(
        (item) => item.location?.file === "library.wgsl",
      )
    )
      throw new Error(
        "Broken import did not retain its original diagnostic location.",
      );
    await step();
    if (context.inspect().operations[0].shader.hash !== oldHash)
      throw new Error("Broken replacement changed the live shader.");
    document.querySelector("#deformation").value = "1.5";
    document.querySelector("#deformation").dispatchEvent(new Event("input"));
    await chain;
    const modes = [];
    for (const value of ["compute", "history", "mrt", "procedural"]) {
      mode.value = value;
      await setup();
      await step();
      await step();
      const capture = context.capture();
      if (capture.frames.length !== 2)
        throw new Error("Capture lost frame inputs.");
      context.reset();
      frame = 0;
      await step();
      modes.push(value);
    }
    globalThis.__APERTURE_RENDER_STATUS__ = {
      ok: true,
      modes,
      dynamicPrepare: true,
      rejectedImport: rejected.diagnostics,
      lastGoodPreserved: true,
    };
  } catch (error) {
    globalThis.__APERTURE_RENDER_STATUS__ = { ok: false, error: String(error) };
  }
} else requestAnimationFrame(animate);
if (import.meta.hot)
  import.meta.hot.accept(
    "./shaders/procedural.wgsl?aperture",
    async (module) => {
      if (module === undefined) return;
      await enqueue(async () => {
        if (sculpture) {
          const result = await sculpture.replace(module.default);
          if (result.ok) shaders.procedural = module.default;
          if (!result.ok) {
            paused = true;
            status.textContent = result.diagnostics
              .map(
                (item) =>
                  `${item.location?.file ?? "shader"}:${item.location?.line ?? 0} ${item.message}`,
              )
              .join("\n");
          }
        }
      });
    },
  );

window.addEventListener(
  "pagehide",
  () => {
    void context?.dispose().finally(() => device?.destroy());
  },
  { once: true },
);
