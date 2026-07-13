// D3 (three.js parity plan): runtime texture updates (dynamic + video). An
// in-scene "video wall" — ONE dynamic texture atlas (three stacked 64x64
// regions) sampled by ONE screen-space quad, whose regions the MAIN THREAD
// updates every frame by DIFFERENT paths:
//   - scoreboard (top region)    : a 2D canvas uploaded into its sub-rect via
//     `app.updateDynamicTextureFromExternalImage(...)` (copyExternalImageToTexture).
//   - tv (middle region)         : an ANIMATED 2D canvas uploaded the same way — a
//     canvas stands in for a video source (SwiftShader/headless cannot decode
//     video; the import path itself accepts an HTMLVideoElement identically).
//   - ticker (bottom region)     : RAW CPU bytes via `app.updateDynamicTexture(...)`
//     (queue.writeTexture) — a FULL-region write on even frames and a smaller
//     SUB-RECT band on odd frames, exercising both upload paths (AC1).
//
// One texture + one material keeps the frame on the proven single custom-WGSL
// draw path; the sub-rect DESTINATION origins are exactly what a texture atlas
// needs. The ECS worker only authors the quad + registers the texture metadata
// (DOM-free); every DOM/GPU upload happens renderer-side on the main thread.

export const runtimeTextureClearColor = [0.02, 0.03, 0.06, 1];

export const WALL_TEXTURE_ID = "runtime-texture.wall";
// 64 wide, three stacked 64x64 regions. Kept tiny: the e2e runs under
// SwiftShader (slow) and only needs pixels to change between frames.
export const WALL_SIZE = { width: 64, height: 192 };
export const REGION_SIZE = 64;

// Destination sub-rects (origin x,y + w,h) inside the atlas.
export const SCOREBOARD_REGION = { x: 0, y: 0, width: 64, height: 64 };
export const TV_REGION = { x: 0, y: 64, width: 64, height: 64 };
export const TICKER_REGION = { x: 0, y: 128, width: 64, height: 64 };
// A smaller band inside the ticker region for the odd-frame sub-rect write.
export const TICKER_SUBRECT = { x: 8, y: 152, width: 48, height: 16 };

// The quad's screen rect (NDC x,y = lower-left corner; w,h = size), y-up.
export const WALL_NDC = [-0.5, -0.92, 1.0, 1.84];

// Screen rect (normalized, y-down) the quad covers, for the e2e grid scan.
export function wallScreenRect() {
  const [x, y, w, h] = WALL_NDC;
  const left = (x + 1) / 2;
  const right = (x + w + 1) / 2;
  const top = (1 - (y + h)) / 2;
  const bottom = (1 - y) / 2;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function wgslFloat(value) {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

// One screen-space textured quad. The vertex stage maps the unit plane onto the
// fixed NDC rect (referencing the renderer-provided view/world bindings at weight
// 0 so the shared group(0)/group(1) layouts stay intact); the fragment stage
// reads the dynamic atlas with textureLoad (no sampler binding needed).
export function runtimeTextureWallWgsl() {
  const [nx, ny, nw, nh] = WALL_NDC.map(wgslFloat);
  return `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var wallTexture: texture_2d<f32>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let corner = input.position.xy + vec2f(0.5, 0.5);
  let ndc = vec2f(${nx}, ${ny}) + corner * vec2f(${nw}, ${nh});
  let anchor = view.viewProjection *
    worldTransforms[input.instanceIndex] *
    vec4f(0.0, 0.0, 0.0, 1.0);
  var output: VertexOutput;

  output.position = vec4f(ndc, 0.05, 1.0) + anchor * 0.0;
  output.uv = vec2f(input.uv.x, 1.0 - input.uv.y);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(wallTexture));
  let texel = vec2<i32>(clamp(input.uv, vec2f(0.0), vec2f(0.9999)) * dims);

  return textureLoad(wallTexture, texel, 0);
}
`;
}

// Initial full-image RGBA bytes so the wall shows content the moment it realizes
// (before the first main-thread upload lands). Pure function of size + seed.
export function solidRgbaBytes(width, height, rgba) {
  const bytes = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    bytes[index * 4] = rgba[0];
    bytes[index * 4 + 1] = rgba[1];
    bytes[index * 4 + 2] = rgba[2];
    bytes[index * 4 + 3] = rgba[3];
  }
  return bytes;
}
