import { fixtureFont } from "./msdf-text-scene.js";

export const uiHudTextureId = "ui-hud-icon";
export const uiHudFontTextureId = "ui-hud-font-page-0";
export const uiHudSamplerId = "ui-hud-linear";
export const uiHudFontId = "ui-hud-font";

export const uiHudClearColor = [0.018, 0.022, 0.03, 1];

export const uiHudReadbackSamples = [
  { id: "panel-fill", x: 110 / 960, y: 110 / 540 },
  { id: "stack-top", x: 160 / 960, y: 160 / 540 },
  { id: "image-fill", x: 190 / 960, y: 220 / 540 },
  { id: "text-fill", x: 306 / 960, y: 178 / 540 },
  { id: "clipped-outside", x: 500 / 960, y: 250 / 540 },
  { id: "background", x: 820 / 960, y: 90 / 540 },
];

export function registerUiHudScene(aperture, registry) {
  const texture = aperture.createTextureHandle(uiHudTextureId);
  const fontTexture = aperture.createTextureHandle(uiHudFontTextureId);
  const sampler = aperture.createSamplerHandle(uiHudSamplerId);
  const font = aperture.createFontAtlasHandle(uiHudFontId);

  registry.register(texture);
  registry.markReady(
    texture,
    aperture.createTextureAsset({
      label: "UiHudIcon",
      dimension: "2d",
      width: 32,
      height: 32,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: createIconBytes(),
        bytesPerRow: 32 * 4,
        rowsPerImage: 32,
      },
    }),
  );
  registry.register(fontTexture);
  registry.markReady(
    fontTexture,
    aperture.createTextureAsset({
      label: "UiHudFontPage0",
      dimension: "2d",
      width: 128,
      height: 64,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: createFontAtlasBytes(),
        bytesPerRow: 128 * 4,
        rowsPerImage: 64,
      },
    }),
  );
  registry.register(sampler);
  registry.markReady(
    sampler,
    aperture.createSamplerAsset({
      label: "UiHudLinearSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMaxClamp: 0,
    }),
  );
  registry.register(font);
  registry.markReady(
    font,
    aperture.createMsdfFontAtlasAsset({
      label: "UiHudFont",
      source: fixtureFont(),
      pages: [fontTexture],
      sampler,
    }),
  );

  return {
    texture,
    sampler,
    font,
    textureKey: aperture.assetHandleKey(texture),
    samplerKey: aperture.assetHandleKey(sampler),
    fontKey: aperture.assetHandleKey(font),
    expected: {
      uiNodes: 6,
      uiHitRegions: 1,
      drawCalls: 5,
      textGlyphs: 2,
    },
    readbackSamples: uiHudReadbackSamples,
  };
}

function createIconBytes() {
  const bytes = new Uint8Array(32 * 32 * 4);

  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const offset = (y * 32 + x) * 4;
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;

      bytes[offset] = checker ? 35 : 18;
      bytes[offset + 1] = checker ? 225 : 155;
      bytes[offset + 2] = checker ? 245 : 205;
      bytes[offset + 3] = 255;
    }
  }

  return bytes;
}

function createFontAtlasBytes() {
  const source = fixtureFont();
  const bytes = new Uint8Array(128 * 64 * 4);

  for (const glyph of source.chars) {
    if (glyph.width <= 0 || glyph.height <= 0) {
      continue;
    }

    for (let y = 0; y < glyph.height; y += 1) {
      for (let x = 0; x < glyph.width; x += 1) {
        const offset = ((glyph.y + y) * 128 + glyph.x + x) * 4;

        bytes[offset] = 255;
        bytes[offset + 1] = 255;
        bytes[offset + 2] = 255;
        bytes[offset + 3] = 255;
      }
    }
  }

  return bytes;
}
