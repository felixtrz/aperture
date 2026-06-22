import { describe, expect, it } from "vitest";
import {
  assetHandleKey,
  createFontAtlasHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  QUAD_INSTANCE_FLOAT_STRIDE,
  QUAD_INSTANCE_WORD_STRIDE,
  createMsdfFontAtlasAsset,
  createMsdfTextQuadSnapshot,
  createRenderAssetCollections,
  decodeQuadInstanceFlags,
  layoutMsdfText,
  validateMsdfFontAtlasAsset,
  type MsdfBmFontJson,
} from "@aperture-engine/render";

describe("MSDF font atlas and glyph layout core", () => {
  it("normalizes BMFont/MSDF glyph metrics and records atlas dependencies", () => {
    const texture = createTextureHandle("inter-page-0");
    const sampler = createSamplerHandle("linear-clamp");
    const font = createMsdfFontAtlasAsset({
      label: "Inter Test",
      source: fixtureFont(),
      pages: [texture],
      sampler,
    });
    const assets = createRenderAssetCollections();
    const handle = assets.fontAtlases.add(font, {
      handle: createFontAtlasHandle("inter-test"),
    });

    expect(validateMsdfFontAtlasAsset(font)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(font.glyphs.find((glyph) => glyph.char === "A")).toMatchObject({
      id: 65,
      page: 0,
      uvRect: [0, 0, 20 / 128, 30 / 64],
    });
    expect(font.kernings).toContainEqual({ first: 65, second: 86, amount: -3 });
    expect(assetHandleKey(handle)).toBe("font-atlas:inter-test");
    expect(assets.registry.get(handle)?.dependencies).toEqual([
      texture,
      sampler,
    ]);
  });

  it("lays out basic LTR text with kerning, wrapping, and alignment", () => {
    const font = testFont();
    const kerned = layoutMsdfText(font, {
      text: "AV A",
      fontSize: 32,
    });

    expect(kerned.diagnostics).toEqual([]);
    expect(kerned.glyphs.map((glyph) => [glyph.char, glyph.x])).toEqual([
      ["A", 1],
      ["V", 20],
      ["A", 51],
    ]);
    expect(kerned.width).toBe(71);

    const wrapped = layoutMsdfText(font, {
      text: "AV WAVE",
      fontSize: 32,
      maxWidth: 75,
    });

    expect(wrapped.lines).toHaveLength(2);
    expect(wrapped.lines.map((line) => line.glyphCount)).toEqual([2, 4]);
    expect(wrapped.height).toBe(80);

    const lineBreak = layoutMsdfText(font, {
      text: "A\nV",
      fontSize: 32,
    });

    expect(lineBreak.lines).toHaveLength(2);
    expect(
      lineBreak.glyphs.map((glyph) => [glyph.char, glyph.lineIndex]),
    ).toEqual([
      ["A", 0],
      ["V", 1],
    ]);

    const centered = layoutMsdfText(font, {
      text: "AV",
      fontSize: 32,
      maxWidth: 100,
      align: "center",
    });

    expect(centered.glyphs[0]).toMatchObject({ char: "A", x: 31 });
    expect(centered.glyphs[1]).toMatchObject({ char: "V", x: 50 });
  });

  it("reports missing glyphs, unsupported shaping, and atlas mismatch errors", () => {
    const font = testFont();
    const layout = layoutMsdfText(font, {
      text: "A\u05d0",
      fontSize: 32,
    });

    expect(layout.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "msdfText.unsupportedShaping",
      "msdfText.missingGlyph",
    ]);
    expect(layout.diagnostics[1]).toMatchObject({
      char: "\u05d0",
      charIndex: 1,
    });

    const badFont = createMsdfFontAtlasAsset({
      source: {
        ...fixtureFont(),
        common: { ...fixtureFont().common, pages: 2 },
        pages: ["page-0.png", "page-1.png"],
      },
      pages: [createTextureHandle("only-page")],
    });

    expect(
      validateMsdfFontAtlasAsset(badFont).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["msdfFont.texturePageMismatch", "msdfFont.pageCountMismatch"]);
  });

  it("packs stable glyph runs into the shared quad snapshot ABI", () => {
    const font = testFont();
    const layout = layoutMsdfText(font, {
      text: "AV",
      fontSize: 32,
      color: [0.25, 0.5, 1, 0.75],
    });
    const snapshot = createMsdfTextQuadSnapshot({
      font,
      layout,
      batchId: 900,
      transformOffset: 16,
    });

    expect(snapshot.quads.instanceFloatStride).toBe(QUAD_INSTANCE_FLOAT_STRIDE);
    expect(snapshot.quads.instanceWordStride).toBe(QUAD_INSTANCE_WORD_STRIDE);
    expect(snapshot.quads.instanceFloats).toHaveLength(
      2 * QUAD_INSTANCE_FLOAT_STRIDE,
    );
    expect(snapshot.quads.instanceWords).toHaveLength(
      2 * QUAD_INSTANCE_WORD_STRIDE,
    );
    expect(Array.from(snapshot.quads.instanceFloats.slice(0, 17))).toEqual([
      1,
      5,
      0,
      0,
      20,
      30,
      0,
      0,
      0,
      0,
      0,
      20 / 128,
      30 / 64,
      0.25,
      0.5,
      1,
      0.75,
    ]);
    expect(
      decodeQuadInstanceFlags(snapshot.quads.instanceWords[3] ?? 0),
    ).toEqual({
      coordinateMode: "screen",
      billboardMode: "none",
      sizeMode: "screen-pixels",
    });
    expect(snapshot.quadBatches).toEqual([
      expect.objectContaining({
        batchId: 900,
        kind: "glyph",
        texture: font.pages[0],
        sampler: font.sampler,
        pipelineVariant: "msdf-text",
        firstInstance: 0,
        instanceCount: 2,
      }),
    ]);
  });
});

function testFont() {
  return createMsdfFontAtlasAsset({
    source: fixtureFont(),
    pages: [createTextureHandle("inter-page-0")],
    sampler: createSamplerHandle("linear-clamp"),
  });
}

function fixtureFont(): MsdfBmFontJson {
  return {
    pages: ["inter.png"],
    info: {
      face: "Inter",
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

function glyph(
  id: number,
  char: string,
  x: number,
  y: number,
  width: number,
  height: number,
  xoffset: number,
  yoffset: number,
  xadvance: number,
) {
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
