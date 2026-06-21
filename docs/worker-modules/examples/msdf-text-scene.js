export const fontTextureId = "msdf-text-fixture-page-0";
export const fontSamplerId = "msdf-text-linear";

export const backgrounds = {
  dark: {
    label: "dark",
    clearColor: [0.015, 0.022, 0.034, 1],
  },
  light: {
    label: "light",
    clearColor: [0.88, 0.9, 0.84, 1],
  },
};

export const textProofs = [
  {
    id: "large-av",
    text: "AV",
    origin: [130, 125],
    fontSize: 96,
    maxWidth: 360,
    batchId: 700,
    colors: {
      dark: [0.94, 0.98, 1, 1],
      light: [0.025, 0.05, 0.11, 1],
    },
  },
  {
    id: "small-wave",
    text: "WAVE",
    origin: [470, 310],
    fontSize: 44,
    maxWidth: 360,
    batchId: 710,
    colors: {
      dark: [0.24, 0.86, 1, 1],
      light: [0.02, 0.13, 0.24, 1],
    },
  },
];

export const readbackSamples = [
  { id: "large-a-fill", x: 0.1698, y: 0.3426 },
  { id: "large-v-fill", x: 0.2323, y: 0.3981 },
  { id: "small-e-fill", x: 0.6, y: 0.626 },
  { id: "background-upper-right", x: 0.87, y: 0.16 },
  { id: "background-lower-right", x: 0.86, y: 0.82 },
];

export function registerMsdfTextScene(aperture, registry) {
  const texture = aperture.createTextureHandle(fontTextureId);
  const sampler = aperture.createSamplerHandle(fontSamplerId);

  registry.register(texture);
  registry.markReady(
    texture,
    aperture.createTextureAsset({
      label: "MsdfTextFixturePage0",
      dimension: "2d",
      width: 128,
      height: 64,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: createFixtureAtlasBytes(),
        bytesPerRow: 128 * 4,
        rowsPerImage: 64,
      },
    }),
  );
  registry.register(sampler);
  registry.markReady(
    sampler,
    aperture.createSamplerAsset({
      label: "MsdfTextLinearSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMaxClamp: 0,
    }),
  );

  const font = aperture.createMsdfFontAtlasAsset({
    label: "Aperture MSDF Fixture",
    source: fixtureFont(),
    pages: [texture],
    sampler,
  });

  return {
    texture,
    sampler,
    font,
    textureKey: aperture.assetHandleKey(texture),
    samplerKey: aperture.assetHandleKey(sampler),
    samples: readbackSamples,
    backgrounds,
    proofs: textProofs,
    glyphCount: textProofs.reduce(
      (total, proof) => total + proof.text.replaceAll(" ", "").length,
      0,
    ),
  };
}

export function createMsdfTextSnapshot(aperture, scene, baseSnapshot, theme) {
  const variant = theme === "light" ? "light" : "dark";
  const transforms = new Float32Array(
    baseSnapshot.transforms.length + textProofs.length * 16,
  );
  const packs = [];
  const diagnostics = [];

  transforms.set(baseSnapshot.transforms);

  for (let index = 0; index < textProofs.length; index += 1) {
    const proof = textProofs[index];
    const transformOffset = baseSnapshot.transforms.length + index * 16;

    transforms.set(screenTransform(proof.origin), transformOffset);

    const layout = aperture.layoutMsdfText(scene.font, {
      text: proof.text,
      fontSize: proof.fontSize,
      maxWidth: proof.maxWidth,
      color: proof.colors[variant],
    });

    diagnostics.push(...layout.diagnostics);
    packs.push(
      aperture.createMsdfTextQuadSnapshot({
        font: scene.font,
        layout,
        batchId: proof.batchId,
        transformOffset,
        materialKey: `msdf-text:${proof.id}`,
        sortKey: aperture.createRenderSortKey({
          queue: "transparent",
          viewId: baseSnapshot.views[0]?.viewId ?? 0,
          layer: 1,
          order: index,
          pipelineKey: "msdf-text",
          materialKey: `msdf-text:${proof.id}`,
          meshKey: "glyph-quad",
          depth: 0,
          stableId: proof.batchId,
        }),
      }),
    );
  }

  const merged = mergeTextPacks(aperture, packs);

  return {
    ...baseSnapshot,
    transforms,
    quads: merged.quads,
    quadBatches: merged.quadBatches,
    diagnostics: [...baseSnapshot.diagnostics, ...diagnostics],
    report: {
      ...baseSnapshot.report,
      quadInstances: merged.instanceCount,
      quadBatches: merged.quadBatches.length,
      diagnostics: baseSnapshot.diagnostics.length + diagnostics.length,
    },
  };
}

export function fixtureFont() {
  return {
    pages: ["msdf-text-fixture.png"],
    info: {
      face: "ApertureFixture",
      size: 32,
    },
    common: {
      lineHeight: 40,
      base: 30,
      scaleW: 128,
      scaleH: 64,
      pages: 1,
    },
    distanceField: {
      fieldType: "msdf",
      distanceRange: 4,
    },
    chars: [
      glyph(32, " ", 0, 32, 0, 0, 0, 0, 10),
      glyph(65, "A", 0, 0, 20, 30, 1, 5, 22),
      glyph(86, "V", 20, 0, 20, 30, 1, 5, 21),
      glyph(87, "W", 40, 0, 28, 30, 0, 5, 30),
      glyph(69, "E", 68, 0, 18, 30, 1, 5, 19),
    ],
    kernings: [
      { first: 65, second: 86, amount: -3 },
      { first: 87, second: 65, amount: -2 },
    ],
  };
}

function mergeTextPacks(aperture, packs) {
  const floatStride = aperture.QUAD_INSTANCE_FLOAT_STRIDE;
  const wordStride = aperture.QUAD_INSTANCE_WORD_STRIDE;
  const instanceCount = packs.reduce(
    (total, pack) => total + pack.quads.instanceFloats.length / floatStride,
    0,
  );
  const floats = new Float32Array(instanceCount * floatStride);
  const words = new Uint32Array(instanceCount * wordStride);
  const quadBatches = [];
  let instanceOffset = 0;

  for (const pack of packs) {
    const packInstances = pack.quads.instanceFloats.length / floatStride;

    floats.set(pack.quads.instanceFloats, instanceOffset * floatStride);
    words.set(pack.quads.instanceWords, instanceOffset * wordStride);
    quadBatches.push(
      ...pack.quadBatches.map((batch) => ({
        ...batch,
        firstInstance: batch.firstInstance + instanceOffset,
      })),
    );
    instanceOffset += packInstances;
  }

  return {
    instanceCount,
    quads: aperture.createQuadSnapshotBuffers({
      instanceFloats: floats,
      instanceWords: words,
    }),
    quadBatches,
  };
}

function createFixtureAtlasBytes() {
  const bytes = new Uint8Array(128 * 64 * 4);

  drawGlyph(bytes, glyph(65, "A", 0, 0, 20, 30, 1, 5, 22), isAStroke);
  drawGlyph(bytes, glyph(86, "V", 20, 0, 20, 30, 1, 5, 21), isVStroke);
  drawGlyph(bytes, glyph(87, "W", 40, 0, 28, 30, 0, 5, 30), isWStroke);
  drawGlyph(bytes, glyph(69, "E", 68, 0, 18, 30, 1, 5, 19), isEStroke);

  for (let index = 3; index < bytes.length; index += 4) {
    bytes[index] = 255;
  }

  return bytes;
}

function drawGlyph(bytes, glyphMetric, predicate) {
  for (let y = 0; y < glyphMetric.height; y += 1) {
    for (let x = 0; x < glyphMetric.width; x += 1) {
      const value = predicate(x, y, glyphMetric.width, glyphMetric.height)
        ? 255
        : 0;
      const target = ((glyphMetric.y + y) * 128 + glyphMetric.x + x) * 4;

      bytes[target] = value;
      bytes[target + 1] = value;
      bytes[target + 2] = value;
    }
  }
}

function isAStroke(x, y, width, height) {
  const center = (width - 1) / 2;
  const spread = (y / Math.max(1, height - 1)) * center;
  const left = Math.abs(x - (center - spread)) <= 2.1;
  const right = Math.abs(x - (center + spread)) <= 2.1;
  const bar =
    y >= Math.floor(height * 0.48) &&
    y <= Math.floor(height * 0.61) &&
    x >= Math.floor(width * 0.24) &&
    x <= Math.ceil(width * 0.76);

  return left || right || bar;
}

function isVStroke(x, y, width, height) {
  const center = (width - 1) / 2;
  const progress = y / Math.max(1, height - 1);
  const left = Math.abs(x - progress * center) <= 2.2;
  const right = Math.abs(x - (width - 1 - progress * center)) <= 2.2;

  return left || right;
}

function isWStroke(x, y, width, height) {
  const half = (width - 1) / 2;
  const progress = y / Math.max(1, height - 1);
  const leftOuter = Math.abs(x - progress * (half * 0.55)) <= 2.1;
  const leftInner = Math.abs(x - (half - progress * (half * 0.45))) <= 2.1;
  const rightInner = Math.abs(x - (half + progress * (half * 0.45))) <= 2.1;
  const rightOuter =
    Math.abs(x - (width - 1 - progress * (half * 0.55))) <= 2.1;

  return leftOuter || leftInner || rightInner || rightOuter;
}

function isEStroke(x, y, width, height) {
  const left = x <= 3;
  const top = y <= 3;
  const middle = Math.abs(y - Math.floor(height * 0.5)) <= 2 && x < width - 2;
  const bottom = y >= height - 4;

  return left || top || middle || bottom;
}

function screenTransform(origin) {
  return new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    origin[0],
    origin[1],
    0,
    1,
  ]);
}

function glyph(id, char, x, y, width, height, xoffset, yoffset, xadvance) {
  return {
    id,
    char,
    x,
    y,
    width,
    height,
    xoffset,
    yoffset,
    xadvance,
    page: 0,
    chnl: 15,
  };
}
