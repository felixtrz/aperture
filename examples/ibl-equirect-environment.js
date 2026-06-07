// IBL from a single equirectangular HDR. A small 2:1 equirect is synthesized as
// a valid flat-RGBE .hdr (a bright vertical band at the +Z longitude over a dark
// surround), loaded via loadHdrFromUri (data URL), then passed to the generic
// app environment asset API. The renderer projects it to a cubemap and feeds the
// result into both specular PMREM and diffuse irradiance convolution — i.e. one
// HDR asset auto-derives the whole IBL chain.

const DIFFUSE_KEY = "texture:ibl-equirect-demo:diffuse";
const SPECULAR_KEY = "texture:ibl-equirect-demo:specular-prefilter";
const EQUIRECT_WIDTH = 64;
const EQUIRECT_HEIGHT = 32;
const CUBE_FACE_SIZE = 64;

function floatToRgbe(r, g, b) {
  const v = Math.max(r, g, b);

  if (v < 1e-9) {
    return [0, 0, 0, 0];
  }

  const e = Math.ceil(Math.log2(v));
  const scale = 255 / Math.pow(2, e);
  const clamp = (x) => Math.min(255, Math.max(0, Math.round(x)));

  return [clamp(r * scale), clamp(g * scale), clamp(b * scale), e + 128];
}

function synthesizeEquirectHdr() {
  // Bright band at the centre column (u≈0.5 → +Z longitude); dark elsewhere.
  const rgbe = new Uint8Array(EQUIRECT_WIDTH * EQUIRECT_HEIGHT * 4);

  for (let y = 0; y < EQUIRECT_HEIGHT; y += 1) {
    for (let x = 0; x < EQUIRECT_WIDTH; x += 1) {
      const bright = Math.abs(x - EQUIRECT_WIDTH / 2) <= 2 ? 3.0 : 0.04;
      const [r, g, b, e] = floatToRgbe(bright, bright, bright);
      const offset = (y * EQUIRECT_WIDTH + x) * 4;

      rgbe[offset] = r;
      rgbe[offset + 1] = g;
      rgbe[offset + 2] = b;
      rgbe[offset + 3] = e;
    }
  }

  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${EQUIRECT_HEIGHT} +X ${EQUIRECT_WIDTH}\n`;
  const headerBytes = new TextEncoder().encode(header);
  const hdr = new Uint8Array(headerBytes.length + rgbe.length);

  hdr.set(headerBytes, 0);
  hdr.set(rgbe, headerBytes.length);

  let binary = "";
  for (let i = 0; i < hdr.length; i += 1) {
    binary += String.fromCharCode(hdr[i]);
  }

  return {
    width: EQUIRECT_WIDTH,
    height: EQUIRECT_HEIGHT,
    dataUrl: `data:image/vnd.radiance;base64,${btoa(binary)}`,
  };
}

export async function loadIblEquirectEnvironment(aperture) {
  const synthetic = synthesizeEquirectHdr();
  const loaded = await aperture.loadHdrFromUri(synthetic.dataUrl);

  if (!loaded.ok || loaded.image === null) {
    throw new Error(
      loaded.diagnostics?.[0]?.message ??
        "Could not load the synthesized equirect HDR.",
    );
  }

  return {
    loader: "loadHdrFromUri",
    width: loaded.image.width,
    height: loaded.image.height,
    image: loaded.image,
  };
}

function floatEquirectToRgba8(image) {
  const pixelCount = image.width * image.height;
  const bytes = new Uint8Array(pixelCount * 4);

  for (let i = 0; i < pixelCount; i += 1) {
    bytes[i * 4] = Math.min(
      255,
      Math.max(0, Math.round(image.data[i * 4] * 255)),
    );
    bytes[i * 4 + 1] = Math.min(
      255,
      Math.max(0, Math.round(image.data[i * 4 + 1] * 255)),
    );
    bytes[i * 4 + 2] = Math.min(
      255,
      Math.max(0, Math.round(image.data[i * 4 + 2] * 255)),
    );
    bytes[i * 4 + 3] = 255;
  }

  return bytes;
}

export function createIblEquirectEnvironmentAssetInput(aperture, image) {
  const handle = aperture.createEnvironmentMapHandle("ibl-equirect-demo");

  return {
    handle,
    label: "IBL equirect demo",
    diffuseResourceKey: DIFFUSE_KEY,
    specularResourceKey: SPECULAR_KEY,
    equirectSource: {
      label: "ibl-equirect-demo",
      resourceKey: "texture:ibl-equirect-demo:projected-cube",
      width: image.width,
      height: image.height,
      data: floatEquirectToRgba8(image),
      faceSize: CUBE_FACE_SIZE,
      format: "rgba8unorm",
      mipLevelCount: 4,
    },
    standardMaterialCount: 1,
  };
}
