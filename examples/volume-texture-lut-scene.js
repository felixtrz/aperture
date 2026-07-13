// 3D (volume) texture example (parity plan E5). ONE custom-WGSL material samples
// a real `texture_3d<f32>` LUT-like volume: a 4x4x4 texture whose four blue-axis
// (depth) slices carry distinct colors. The fragment shader maps the quad's
// vertical UV to the volume's depth coordinate, so the sampled color walks
// slice 0 → slice 3 top-to-bottom — proving the sampling coordinate selects the
// right slice, with hardware trilinear filtering between slices.
//
// A single custom material is used deliberately (the known multi-distinct-
// custom-material black-render bug); no built-in-material blending is needed.

export const VOLUME_SIZE = 4;

// Distinct, saturated per-slice colors (0-255 RGB), indexed by the blue/depth
// axis: red → green → blue → yellow.
export const sliceColors = [
  [230, 40, 40],
  [40, 210, 60],
  [40, 80, 230],
  [235, 210, 40],
];

export const clearColor = [0.01, 0.014, 0.02, 1];

// Normalized [0,1] screen samples (y grows downward). The quad's top samples the
// first slice (red), the bottom samples the last (yellow).
export const readbackSamples = [
  { id: "slice-top", x: 0.5, y: 0.3 },
  { id: "slice-center", x: 0.5, y: 0.5 },
  { id: "slice-bottom", x: 0.5, y: 0.7 },
];

/**
 * Build the N^3 RGBA volume bytes in WebGPU 3D upload order (red fastest, then
 * green/row, then blue/slice). Every (r, g) texel in slice b takes sliceColors[b].
 */
export function createVolumeTextureBytes(size = VOLUME_SIZE) {
  const bytes = new Uint8Array(size * size * size * 4);

  for (let b = 0; b < size; b += 1) {
    const color = sliceColors[b % sliceColors.length];
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const offset = (b * size * size + g * size + r) * 4;
        bytes[offset] = color[0];
        bytes[offset + 1] = color[1];
        bytes[offset + 2] = color[2];
        bytes[offset + 3] = 255;
      }
    }
  }

  return bytes;
}
