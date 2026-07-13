// C3 (three.js parity plan): a luminance histogram computed TWO ways from the
// SAME input into TWO output buffers — once through the RAW compute path
// (app.addComputePass with a hand-built pipeline + bind group), and once through
// the DATA-DESCRIBED compute-kernel path (app.addComputeKernelPass with a
// ComputeKernelAsset: WGSL + typed bindings, no GPUDevice code). The e2e asserts
// the two readbacks are byte-identical — the data-described dispatch produces the
// same GPU result as the hand-built one. This is the analog of three.js TSL
// `wgslFn` / `computeShader` data-described compute.
//
// Dependency-free (constants + WGSL + seed data) so it imports from BOTH the
// worker (registers the buffers + a tiny backdrop) and the main thread (owns the
// raw pipeline and the data-described kernel dispatch).

// Kept tiny on purpose: the e2e runs under SwiftShader (slow). A single-threaded
// dispatch over a small pixel set into a few bins is enough to prove equality.
export const HISTOGRAM_PIXEL_COUNT = 64;
export const HISTOGRAM_BIN_COUNT = 16;
export const luminanceHistogramCanvasSize = { width: 240, height: 180 };
export const luminanceHistogramClearColor = [0.02, 0.03, 0.05, 1];

// Buffer ids are the graph-resource handles shared across passes. The input is a
// read-only storage buffer both passes sample; each path writes its OWN output.
export const HISTOGRAM_INPUT_BUFFER_ID = "luminance-histogram.pixels";
export const HISTOGRAM_RAW_OUTPUT_BUFFER_ID = "luminance-histogram.raw";
export const HISTOGRAM_KERNEL_OUTPUT_BUFFER_ID = "luminance-histogram.kernel";

export const HISTOGRAM_INPUT_ELEMENT_TYPE = "vec4f";
export const HISTOGRAM_OUTPUT_ELEMENT_TYPE = "u32";

// Rec. 709 luminance weights (kept in sync with the WGSL below).
const LUMA_WEIGHTS = [0.2126, 0.7152, 0.0722];

// Deterministic, varied RGB pixels (xyz = rgb, w unused). Spread across the
// luminance range so several histogram bins are non-zero — a meaningful check,
// not a degenerate one. Pure function of the index so the worker seed and the
// CPU oracle agree exactly.
export function histogramPixels() {
  const data = new Float32Array(HISTOGRAM_PIXEL_COUNT * 4);
  for (let index = 0; index < HISTOGRAM_PIXEL_COUNT; index += 1) {
    const r = ((index * 7) % HISTOGRAM_PIXEL_COUNT) / HISTOGRAM_PIXEL_COUNT;
    const g = ((index * 13) % HISTOGRAM_PIXEL_COUNT) / HISTOGRAM_PIXEL_COUNT;
    const b = ((index * 29) % HISTOGRAM_PIXEL_COUNT) / HISTOGRAM_PIXEL_COUNT;
    data.set([r, g, b, 0], index * 4);
  }
  return data;
}

/** CPU oracle for the histogram (matches the single-threaded WGSL below). */
export function expectedHistogram() {
  const pixels = histogramPixels();
  const bins = new Uint32Array(HISTOGRAM_BIN_COUNT);
  for (let index = 0; index < HISTOGRAM_PIXEL_COUNT; index += 1) {
    const r = pixels[index * 4];
    const g = pixels[index * 4 + 1];
    const b = pixels[index * 4 + 2];
    const luma = Math.min(
      Math.max(
        r * LUMA_WEIGHTS[0] + g * LUMA_WEIGHTS[1] + b * LUMA_WEIGHTS[2],
        0,
      ),
      0.999999,
    );
    const bin = Math.min(
      Math.floor(luma * HISTOGRAM_BIN_COUNT),
      HISTOGRAM_BIN_COUNT - 1,
    );
    bins[bin] += 1;
  }
  return Array.from(bins);
}

// The histogram kernel: single-threaded (dispatch 1), so no atomics and fully
// deterministic under SwiftShader. Bindings are @group(0): 0 = input pixels
// (read), 1 = output histogram (read_write), 2 = params uniform. The SAME source
// drives both the raw path (hand-built pipeline) and the data-described kernel,
// so an identical GPU result isolates the dispatch plumbing under test.
export const histogramComputeWgsl = /* wgsl */ `
struct Params {
  pixelCount: u32,
  binCount: u32,
};

@group(0) @binding(0) var<storage, read> pixels: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> histogram: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;

const LUMA = vec3f(0.2126, 0.7152, 0.0722);

@compute @workgroup_size(1)
fn main() {
  for (var b = 0u; b < params.binCount; b = b + 1u) {
    histogram[b] = 0u;
  }
  for (var i = 0u; i < params.pixelCount; i = i + 1u) {
    let luma = clamp(dot(pixels[i].xyz, LUMA), 0.0, 0.999999);
    let bin = min(u32(luma * f32(params.binCount)), params.binCount - 1u);
    histogram[bin] = histogram[bin] + 1u;
  }
}
`;
