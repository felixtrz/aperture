import {
  assetHandleKey,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import {
  createQuadSnapshotBuffers,
  encodeQuadInstanceFlags,
  QUAD_INSTANCE_FLOAT_STRIDE,
  QUAD_INSTANCE_WORD_STRIDE,
  type QuadBatchPacket,
  type QuadSnapshotBuffers,
} from "../rendering/snapshot.js";

export interface MsdfBmFontInfo {
  readonly face?: string;
  readonly size: number;
  readonly bold?: number;
  readonly italic?: number;
  readonly charset?: readonly string[];
  readonly unicode?: number;
  readonly stretchH?: number;
  readonly smooth?: number;
  readonly aa?: number;
  readonly padding?: readonly number[];
  readonly spacing?: readonly number[];
  readonly outline?: number;
}

export interface MsdfBmFontCommon {
  readonly lineHeight: number;
  readonly base: number;
  readonly scaleW: number;
  readonly scaleH: number;
  readonly pages: number;
  readonly packed?: number;
  readonly alphaChnl?: number;
  readonly redChnl?: number;
  readonly greenChnl?: number;
  readonly blueChnl?: number;
}

export interface MsdfBmFontGlyph {
  readonly id: number;
  readonly index?: number;
  readonly char?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly xoffset: number;
  readonly yoffset: number;
  readonly xadvance: number;
  readonly page: number;
  readonly chnl?: number;
}

export interface MsdfBmFontKerning {
  readonly first: number;
  readonly second: number;
  readonly amount: number;
}

export interface MsdfBmFontDistanceField {
  readonly fieldType?: string;
  readonly distanceRange: number;
}

export interface MsdfBmFontJson {
  readonly pages: readonly string[];
  readonly chars: readonly MsdfBmFontGlyph[];
  readonly kernings?: readonly MsdfBmFontKerning[];
  readonly info: MsdfBmFontInfo;
  readonly common: MsdfBmFontCommon;
  readonly distanceField?: MsdfBmFontDistanceField;
}

export interface MsdfFontAtlasGlyph {
  readonly id: number;
  readonly char: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly xoffset: number;
  readonly yoffset: number;
  readonly xadvance: number;
  readonly uvRect: readonly [number, number, number, number];
  readonly renderSolid: boolean;
}

export interface MsdfFontKerningPair {
  readonly first: number;
  readonly second: number;
  readonly amount: number;
}

export interface MsdfFontAtlasAsset {
  readonly kind: "msdf-font-atlas";
  readonly label: string;
  readonly pages: readonly TextureHandle[];
  readonly pageNames: readonly string[];
  readonly sampler?: SamplerHandle | null;
  readonly family: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly base: number;
  readonly scaleW: number;
  readonly scaleH: number;
  readonly pageCount: number;
  readonly distanceRange: number;
  readonly glyphs: readonly MsdfFontAtlasGlyph[];
  readonly kernings: readonly MsdfFontKerningPair[];
}

export type MsdfFontAtlasDiagnosticCode =
  | "msdfFont.invalidAtlasDimensions"
  | "msdfFont.invalidDistanceRange"
  | "msdfFont.invalidFontSize"
  | "msdfFont.invalidGlyphBounds"
  | "msdfFont.invalidGlyphPage"
  | "msdfFont.duplicateGlyph"
  | "msdfFont.missingGlyphs"
  | "msdfFont.pageCountMismatch"
  | "msdfFont.texturePageMismatch";

export interface MsdfFontAtlasDiagnostic {
  readonly code: MsdfFontAtlasDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly glyphId?: number;
  readonly char?: string;
}

export interface MsdfFontAtlasValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly MsdfFontAtlasDiagnostic[];
}

export type MsdfTextDiagnosticCode =
  | MsdfFontAtlasDiagnosticCode
  | "msdfText.missingGlyph"
  | "msdfText.unsupportedShaping"
  | "msdfText.invalidFontSize"
  | "msdfText.invalidMaxWidth";

export interface MsdfTextDiagnostic {
  readonly code: MsdfTextDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly char?: string;
  readonly charIndex?: number;
  readonly sourceCode?: MsdfFontAtlasDiagnosticCode;
}

export type MsdfTextAlign = "left" | "center" | "right";

export interface MsdfTextLayoutOptions {
  readonly text: string;
  readonly fontSize?: number;
  readonly lineHeight?: number;
  readonly maxWidth?: number;
  readonly align?: MsdfTextAlign;
  readonly letterSpacing?: number;
  readonly color?: readonly [number, number, number, number];
}

export interface MsdfTextLayoutGlyph {
  readonly char: string;
  readonly charIndex: number;
  readonly glyphId: number;
  readonly page: number;
  readonly lineIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly advance: number;
  readonly uvRect: readonly [number, number, number, number];
  readonly color: readonly [number, number, number, number];
}

export interface MsdfTextLayoutLine {
  readonly lineIndex: number;
  readonly charStart: number;
  readonly charEnd: number;
  readonly glyphStart: number;
  readonly glyphCount: number;
  readonly width: number;
  readonly y: number;
  readonly baseline: number;
}

export interface MsdfTextLayout {
  readonly text: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly align: MsdfTextAlign;
  readonly availableWidth: number;
  readonly width: number;
  readonly height: number;
  readonly glyphs: readonly MsdfTextLayoutGlyph[];
  readonly lines: readonly MsdfTextLayoutLine[];
  readonly diagnostics: readonly MsdfTextDiagnostic[];
}

export interface MsdfTextQuadSnapshot {
  readonly quads: QuadSnapshotBuffers;
  readonly quadBatches: readonly QuadBatchPacket[];
}

export interface CreateMsdfTextQuadSnapshotOptions {
  readonly font: MsdfFontAtlasAsset;
  readonly layout: MsdfTextLayout;
  readonly batchId?: number;
  readonly transformOffset?: number;
  readonly layerMask?: number;
  readonly sortKey?: QuadBatchPacket["sortKey"];
  readonly materialKey?: string;
}

interface DraftGlyph {
  readonly char: string;
  readonly charIndex: number;
  readonly glyph: MsdfFontAtlasGlyph;
  readonly lineIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly advance: number;
}

interface DraftLine {
  lineIndex: number;
  charStart: number;
  charEnd: number;
  glyphStart: number;
  glyphCount: number;
  width: number;
  advance: number;
  y: number;
  previousGlyphId: number | null;
}

export function createMsdfFontAtlasAsset(input: {
  readonly label?: string;
  readonly source: MsdfBmFontJson;
  readonly pages: readonly TextureHandle[];
  readonly sampler?: SamplerHandle | null;
}): MsdfFontAtlasAsset {
  const source = input.source;
  const scaleW = finitePositive(source.common.scaleW, 1);
  const scaleH = finitePositive(source.common.scaleH, 1);
  const fontSize = finitePositive(Math.abs(source.info.size), 1);
  const glyphs = source.chars.map((glyph) =>
    createGlyphFromBmFont(glyph, scaleW, scaleH),
  );

  return {
    kind: "msdf-font-atlas",
    label: input.label ?? source.info.face ?? "MSDF Font Atlas",
    pages: [...input.pages],
    pageNames: [...source.pages],
    ...(input.sampler === undefined ? {} : { sampler: input.sampler }),
    family: source.info.face ?? "unknown",
    fontSize,
    lineHeight: finitePositive(source.common.lineHeight, fontSize),
    base: finiteNumber(source.common.base, fontSize),
    scaleW,
    scaleH,
    pageCount: Math.max(1, Math.trunc(source.common.pages)),
    distanceRange: finitePositive(source.distanceField?.distanceRange, 4),
    glyphs,
    kernings: (source.kernings ?? []).map((kerning) => ({
      first: Math.trunc(kerning.first),
      second: Math.trunc(kerning.second),
      amount: finiteNumber(kerning.amount, 0),
    })),
  };
}

export function validateMsdfFontAtlasAsset(
  asset: MsdfFontAtlasAsset,
): MsdfFontAtlasValidationReport {
  const diagnostics: MsdfFontAtlasDiagnostic[] = [];

  if (
    asset.fontSize <= 0 ||
    !Number.isFinite(asset.fontSize) ||
    asset.lineHeight <= 0 ||
    !Number.isFinite(asset.lineHeight)
  ) {
    diagnostics.push({
      code: "msdfFont.invalidFontSize",
      field: "fontSize",
      message:
        "MSDF font atlas requires finite positive fontSize and lineHeight values.",
    });
  }

  if (
    asset.scaleW <= 0 ||
    asset.scaleH <= 0 ||
    !Number.isFinite(asset.scaleW) ||
    !Number.isFinite(asset.scaleH)
  ) {
    diagnostics.push({
      code: "msdfFont.invalidAtlasDimensions",
      field: "common.scaleW/common.scaleH",
      message:
        "MSDF font atlas requires finite positive common.scaleW and common.scaleH dimensions.",
    });
  }

  if (asset.distanceRange <= 0 || !Number.isFinite(asset.distanceRange)) {
    diagnostics.push({
      code: "msdfFont.invalidDistanceRange",
      field: "distanceField.distanceRange",
      message: "MSDF font atlas distanceRange must be finite and positive.",
    });
  }

  if (asset.glyphs.length === 0) {
    diagnostics.push({
      code: "msdfFont.missingGlyphs",
      field: "chars",
      message: "MSDF font atlas requires at least one glyph record.",
    });
  }

  if (asset.pageNames.length !== asset.pages.length) {
    diagnostics.push({
      code: "msdfFont.texturePageMismatch",
      field: "pages",
      message: `MSDF font atlas declares ${asset.pageNames.length} page name(s) but received ${asset.pages.length} texture handle(s).`,
    });
  }

  const seenChars = new Set<string>();
  const seenIds = new Set<number>();

  for (const glyph of asset.glyphs) {
    if (seenChars.has(glyph.char) || seenIds.has(glyph.id)) {
      diagnostics.push({
        code: "msdfFont.duplicateGlyph",
        field: "chars",
        glyphId: glyph.id,
        char: glyph.char,
        message: `Duplicate MSDF glyph '${glyph.char}' (${glyph.id}) in atlas '${asset.label}'.`,
      });
    }

    seenChars.add(glyph.char);
    seenIds.add(glyph.id);

    if (glyph.page < 0 || glyph.page >= asset.pages.length) {
      diagnostics.push({
        code: "msdfFont.invalidGlyphPage",
        field: "chars.page",
        glyphId: glyph.id,
        char: glyph.char,
        message: `MSDF glyph '${glyph.char}' references page ${glyph.page}, but atlas '${asset.label}' has ${asset.pages.length} texture page(s).`,
      });
    }

    if (
      glyph.x < 0 ||
      glyph.y < 0 ||
      glyph.width < 0 ||
      glyph.height < 0 ||
      glyph.x + glyph.width > asset.scaleW ||
      glyph.y + glyph.height > asset.scaleH
    ) {
      diagnostics.push({
        code: "msdfFont.invalidGlyphBounds",
        field: "chars",
        glyphId: glyph.id,
        char: glyph.char,
        message: `MSDF glyph '${glyph.char}' bounds must fit inside the ${asset.scaleW}x${asset.scaleH} atlas.`,
      });
    }
  }

  if (
    asset.pageCount !== asset.pageNames.length ||
    asset.pages.length !== asset.pageCount
  ) {
    diagnostics.push({
      code: "msdfFont.pageCountMismatch",
      field: "common.pages",
      message: `MSDF font atlas common.pages declares ${asset.pageCount} page(s), page metadata has ${asset.pageNames.length}, and texture handles provide ${asset.pages.length}.`,
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function layoutMsdfText(
  font: MsdfFontAtlasAsset,
  options: MsdfTextLayoutOptions,
): MsdfTextLayout {
  const diagnostics: MsdfTextDiagnostic[] = validateMsdfFontAtlasAsset(
    font,
  ).diagnostics.map((diagnostic) => ({
    ...diagnostic,
    sourceCode: diagnostic.code,
  }));
  const fontSize = options.fontSize ?? font.fontSize;
  const lineHeight =
    options.lineHeight ?? font.lineHeight * (fontSize / font.fontSize);
  const maxWidth = options.maxWidth ?? Number.POSITIVE_INFINITY;
  const align = options.align ?? "left";
  const letterSpacing = options.letterSpacing ?? 0;
  const color = options.color ?? [1, 1, 1, 1];

  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    diagnostics.push({
      code: "msdfText.invalidFontSize",
      field: "fontSize",
      message: "MSDF text layout requires a finite positive fontSize.",
    });
  }

  if (maxWidth <= 0 || Number.isNaN(maxWidth)) {
    diagnostics.push({
      code: "msdfText.invalidMaxWidth",
      field: "maxWidth",
      message: "MSDF text layout maxWidth must be positive when provided.",
    });
  }

  const glyphsByChar = createGlyphCharMap(font);
  const kernings = createKerningMap(font);
  const scale = fontSize / Math.max(font.fontSize, 1);
  const draftGlyphs: DraftGlyph[] = [];
  const draftLines: DraftLine[] = [];
  let line = createDraftLine(0, 0, 0);

  for (const token of tokenizeText(options.text)) {
    if (token.kind === "newline") {
      finalizeDraftLine(line, draftLines);
      line = createDraftLine(
        draftLines.length,
        token.charIndex + token.value.length,
        draftGlyphs.length,
      );
      continue;
    }

    if (
      token.kind === "word" &&
      line.advance > 0 &&
      Number.isFinite(maxWidth)
    ) {
      const measured = measureToken({
        font,
        glyphsByChar,
        kernings,
        token,
        scale,
        letterSpacing,
        previousGlyphId: line.previousGlyphId,
        diagnostics,
      });

      if (line.advance + measured.advance > maxWidth) {
        finalizeDraftLine(line, draftLines);
        line = createDraftLine(
          draftLines.length,
          token.charIndex,
          draftGlyphs.length,
        );
      }
    }

    const layoutToken = token as {
      readonly kind: "word" | "space";
      readonly value: string;
      readonly charIndex: number;
    };

    appendTokenToLine({
      font,
      glyphsByChar,
      kernings,
      token: layoutToken,
      scale,
      line,
      lineHeight,
      letterSpacing,
      glyphs: draftGlyphs,
      diagnostics,
    });
  }

  finalizeDraftLine(line, draftLines);

  if (draftLines.length === 0) {
    draftLines.push(createDraftLine(0, 0, 0));
  }

  const measuredWidth = draftLines.reduce(
    (width, entry) => Math.max(width, entry.width),
    0,
  );
  const availableWidth = Number.isFinite(maxWidth) ? maxWidth : measuredWidth;
  const positionedGlyphs: MsdfTextLayoutGlyph[] = [];

  for (const draft of draftGlyphs) {
    const draftLine = draftLines[draft.lineIndex];
    const lineOffset =
      draftLine === undefined
        ? 0
        : textAlignOffset(align, availableWidth, draftLine.width);

    positionedGlyphs.push({
      char: draft.char,
      charIndex: draft.charIndex,
      glyphId: draft.glyph.id,
      page: draft.glyph.page,
      lineIndex: draft.lineIndex,
      x: draft.x + lineOffset,
      y: draft.y,
      width: draft.width,
      height: draft.height,
      advance: draft.advance,
      uvRect: draft.glyph.uvRect,
      color,
    });
  }

  const lines = draftLines.map((draft) => ({
    lineIndex: draft.lineIndex,
    charStart: draft.charStart,
    charEnd: draft.charEnd,
    glyphStart: draft.glyphStart,
    glyphCount: draft.glyphCount,
    width: draft.width,
    y: draft.lineIndex * lineHeight,
    baseline: draft.lineIndex * lineHeight + font.base * scale,
  }));

  return {
    text: options.text,
    fontSize,
    lineHeight,
    align,
    availableWidth,
    width: measuredWidth,
    height: Math.max(1, draftLines.length) * lineHeight,
    glyphs: positionedGlyphs,
    lines,
    diagnostics,
  };
}

export function createMsdfTextQuadSnapshot(
  options: CreateMsdfTextQuadSnapshotOptions,
): MsdfTextQuadSnapshot {
  const floats = new Float32Array(
    options.layout.glyphs.length * QUAD_INSTANCE_FLOAT_STRIDE,
  );
  const words = new Uint32Array(
    options.layout.glyphs.length * QUAD_INSTANCE_WORD_STRIDE,
  );
  const transformOffset = options.transformOffset ?? 0;
  const flags = encodeQuadInstanceFlags({
    coordinateMode: "screen",
    billboardMode: "none",
    sizeMode: "screen-pixels",
  });

  for (let index = 0; index < options.layout.glyphs.length; index += 1) {
    const glyph = options.layout.glyphs[index];

    if (glyph === undefined) {
      continue;
    }

    const floatOffset = index * QUAD_INSTANCE_FLOAT_STRIDE;
    const wordOffset = index * QUAD_INSTANCE_WORD_STRIDE;

    floats[floatOffset] = glyph.x;
    floats[floatOffset + 1] = glyph.y;
    floats[floatOffset + 2] = 0;
    floats[floatOffset + 3] = glyph.lineIndex;
    floats[floatOffset + 4] = glyph.width;
    floats[floatOffset + 5] = glyph.height;
    floats[floatOffset + 6] = 0;
    floats[floatOffset + 7] = 0;
    floats[floatOffset + 8] = 0;
    floats[floatOffset + 9] = glyph.uvRect[0];
    floats[floatOffset + 10] = glyph.uvRect[1];
    floats[floatOffset + 11] = glyph.uvRect[2];
    floats[floatOffset + 12] = glyph.uvRect[3];
    floats[floatOffset + 13] = glyph.color[0];
    floats[floatOffset + 14] = glyph.color[1];
    floats[floatOffset + 15] = glyph.color[2];
    floats[floatOffset + 16] = glyph.color[3];
    floats[floatOffset + 17] = options.font.distanceRange;
    floats[floatOffset + 18] = options.font.scaleW;
    floats[floatOffset + 19] = options.font.scaleH;
    floats[floatOffset + 20] = 1;

    words[wordOffset] = transformOffset >>> 0;
    words[wordOffset + 1] = 0xffff_ffff;
    words[wordOffset + 2] = glyph.glyphId >>> 0;
    words[wordOffset + 3] = flags;
    words[wordOffset + 4] = stableGlyphId(glyph) >>> 0;
    words[wordOffset + 5] = glyph.charIndex >>> 0;
    words[wordOffset + 6] = glyph.lineIndex >>> 0;
    words[wordOffset + 7] = glyph.page >>> 0;
  }

  return {
    quads: createQuadSnapshotBuffers({
      instanceFloats: floats,
      instanceWords: words,
    }),
    quadBatches: createGlyphQuadBatches(options),
  };
}

export function msdfFontAtlasDependencies(
  asset: MsdfFontAtlasAsset,
): readonly (TextureHandle | SamplerHandle)[] {
  return asset.sampler === undefined || asset.sampler === null
    ? [...asset.pages]
    : [...asset.pages, asset.sampler];
}

function createGlyphFromBmFont(
  glyph: MsdfBmFontGlyph,
  scaleW: number,
  scaleH: number,
): MsdfFontAtlasGlyph {
  const width = finiteNumber(glyph.width, 0);
  const height = finiteNumber(glyph.height, 0);

  return {
    id: Math.trunc(glyph.id),
    char: glyph.char ?? charFromCodePoint(glyph.id),
    page: Math.trunc(glyph.page),
    x: finiteNumber(glyph.x, 0),
    y: finiteNumber(glyph.y, 0),
    width,
    height,
    xoffset: finiteNumber(glyph.xoffset, 0),
    yoffset: finiteNumber(glyph.yoffset, 0),
    xadvance: finiteNumber(glyph.xadvance, width),
    uvRect: [
      finiteNumber(glyph.x, 0) / scaleW,
      finiteNumber(glyph.y, 0) / scaleH,
      width / scaleW,
      height / scaleH,
    ],
    renderSolid: width === 0 || height === 0,
  };
}

function createGlyphCharMap(
  font: MsdfFontAtlasAsset,
): ReadonlyMap<string, MsdfFontAtlasGlyph> {
  const map = new Map<string, MsdfFontAtlasGlyph>();

  for (const glyph of font.glyphs) {
    if (!map.has(glyph.char)) {
      map.set(glyph.char, glyph);
    }
  }

  return map;
}

function createKerningMap(
  font: MsdfFontAtlasAsset,
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();

  for (const kerning of font.kernings) {
    map.set(kerningKey(kerning.first, kerning.second), kerning.amount);
  }

  return map;
}

function tokenizeText(text: string): readonly {
  readonly kind: "word" | "space" | "newline";
  readonly value: string;
  readonly charIndex: number;
}[] {
  const tokens: {
    kind: "word" | "space" | "newline";
    value: string;
    charIndex: number;
  }[] = [];
  let currentKind: "word" | "space" | null = null;
  let currentValue = "";
  let currentIndex = 0;
  let index = 0;

  for (const char of text) {
    const kind =
      char === "\n"
        ? "newline"
        : char === " " || char === "\t"
          ? "space"
          : "word";

    if (kind === "newline") {
      if (currentKind !== null) {
        tokens.push({
          kind: currentKind,
          value: currentValue,
          charIndex: currentIndex,
        });
      }

      tokens.push({ kind, value: char, charIndex: index });
      currentKind = null;
      currentValue = "";
      currentIndex = index + char.length;
      index += char.length;
      continue;
    }

    if (currentKind !== kind) {
      if (currentKind !== null) {
        tokens.push({
          kind: currentKind,
          value: currentValue,
          charIndex: currentIndex,
        });
      }

      currentKind = kind;
      currentValue = char;
      currentIndex = index;
    } else {
      currentValue += char;
    }

    index += char.length;
  }

  if (currentKind !== null) {
    tokens.push({
      kind: currentKind,
      value: currentValue,
      charIndex: currentIndex,
    });
  }

  return tokens;
}

function appendTokenToLine(options: {
  readonly font: MsdfFontAtlasAsset;
  readonly glyphsByChar: ReadonlyMap<string, MsdfFontAtlasGlyph>;
  readonly kernings: ReadonlyMap<string, number>;
  readonly token: {
    readonly kind: "word" | "space";
    readonly value: string;
    readonly charIndex: number;
  };
  readonly scale: number;
  readonly line: DraftLine;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly glyphs: DraftGlyph[];
  readonly diagnostics: MsdfTextDiagnostic[];
}): void {
  let localIndex = 0;

  for (const char of options.token.value) {
    appendCharToLine({
      ...options,
      char,
      charIndex: options.token.charIndex + localIndex,
    });
    localIndex += char.length;
  }

  if (
    options.line.charEnd <
    options.token.charIndex + options.token.value.length
  ) {
    options.line.charEnd = options.token.charIndex + options.token.value.length;
  }
}

function appendCharToLine(options: {
  readonly font: MsdfFontAtlasAsset;
  readonly glyphsByChar: ReadonlyMap<string, MsdfFontAtlasGlyph>;
  readonly kernings: ReadonlyMap<string, number>;
  readonly char: string;
  readonly charIndex: number;
  readonly token: {
    readonly kind: "word" | "space";
    readonly value: string;
    readonly charIndex: number;
  };
  readonly scale: number;
  readonly line: DraftLine;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly glyphs: DraftGlyph[];
  readonly diagnostics: MsdfTextDiagnostic[];
}): void {
  diagnoseUnsupportedShaping(
    options.char,
    options.charIndex,
    options.diagnostics,
  );

  const glyph = options.glyphsByChar.get(options.char);

  if (glyph === undefined) {
    options.diagnostics.push({
      code: "msdfText.missingGlyph",
      char: options.char,
      charIndex: options.charIndex,
      message: `MSDF font '${options.font.label}' has no glyph for '${printableChar(options.char)}'.`,
    });
    options.line.advance += missingGlyphAdvance(options.font, options.scale);
    return;
  }

  const kerning =
    options.line.previousGlyphId === null
      ? 0
      : (options.kernings.get(
          kerningKey(options.line.previousGlyphId, glyph.id),
        ) ?? 0) * options.scale;
  const advance =
    glyph.xadvance * options.scale + options.letterSpacing + kerning;
  const x = options.line.advance + kerning + glyph.xoffset * options.scale;
  const y =
    options.line.lineIndex * options.lineHeight + glyph.yoffset * options.scale;
  const width = glyph.width * options.scale;
  const height = glyph.height * options.scale;

  if (options.token.kind !== "space" && !glyph.renderSolid) {
    options.glyphs.push({
      char: options.char,
      charIndex: options.charIndex,
      glyph,
      lineIndex: options.line.lineIndex,
      x,
      y,
      width,
      height,
      advance,
    });
    options.line.glyphCount += 1;
    options.line.width = Math.max(options.line.width, x + width);
  }

  options.line.advance += advance;
  options.line.previousGlyphId = glyph.id;
}

function measureToken(options: {
  readonly font: MsdfFontAtlasAsset;
  readonly glyphsByChar: ReadonlyMap<string, MsdfFontAtlasGlyph>;
  readonly kernings: ReadonlyMap<string, number>;
  readonly token: { readonly value: string; readonly charIndex: number };
  readonly scale: number;
  readonly letterSpacing: number;
  readonly previousGlyphId: number | null;
  readonly diagnostics: MsdfTextDiagnostic[];
}): { readonly advance: number } {
  let advance = 0;
  let previousGlyphId = options.previousGlyphId;

  for (const char of options.token.value) {
    const glyph = options.glyphsByChar.get(char);

    if (glyph === undefined) {
      advance += missingGlyphAdvance(options.font, options.scale);
      continue;
    }

    const kerning =
      previousGlyphId === null
        ? 0
        : (options.kernings.get(kerningKey(previousGlyphId, glyph.id)) ?? 0) *
          options.scale;

    advance += glyph.xadvance * options.scale + options.letterSpacing + kerning;
    previousGlyphId = glyph.id;
  }

  return { advance };
}

function createDraftLine(
  lineIndex: number,
  charStart: number,
  glyphStart: number,
): DraftLine {
  return {
    lineIndex,
    charStart,
    charEnd: charStart,
    glyphStart,
    glyphCount: 0,
    width: 0,
    advance: 0,
    y: 0,
    previousGlyphId: null,
  };
}

function finalizeDraftLine(line: DraftLine, lines: DraftLine[]): void {
  lines.push({ ...line });
}

function createGlyphQuadBatches(
  options: CreateMsdfTextQuadSnapshotOptions,
): QuadBatchPacket[] {
  const batches: QuadBatchPacket[] = [];
  let currentPage = -1;
  let firstInstance = 0;
  const baseBatchId = options.batchId ?? stableStringHash(options.font.label);

  for (let index = 0; index < options.layout.glyphs.length; index += 1) {
    const glyph = options.layout.glyphs[index];

    if (glyph === undefined) {
      continue;
    }

    if (glyph.page !== currentPage) {
      if (currentPage >= 0) {
        batches.push(
          createGlyphBatch(
            options,
            baseBatchId,
            batches.length,
            currentPage,
            firstInstance,
            index,
          ),
        );
      }

      currentPage = glyph.page;
      firstInstance = index;
    }
  }

  if (currentPage >= 0) {
    batches.push(
      createGlyphBatch(
        options,
        baseBatchId,
        batches.length,
        currentPage,
        firstInstance,
        options.layout.glyphs.length,
      ),
    );
  }

  return batches;
}

function createGlyphBatch(
  options: CreateMsdfTextQuadSnapshotOptions,
  baseBatchId: number,
  batchIndex: number,
  page: number,
  firstInstance: number,
  endInstance: number,
): QuadBatchPacket {
  const texture = options.font.pages[page] ?? options.font.pages[0];
  const textureKey =
    texture === undefined
      ? "texture:__missing_msdf_page__"
      : assetHandleKey(texture);
  const materialKey = options.materialKey ?? `${textureKey}:msdf`;

  return {
    batchId: (baseBatchId + batchIndex) >>> 0,
    kind: "glyph",
    ...(texture === undefined ? {} : { texture }),
    ...(options.font.sampler === undefined || options.font.sampler === null
      ? {}
      : { sampler: options.font.sampler }),
    materialKey,
    pipelineVariant: "msdf-text",
    coordinateMode: "screen",
    billboardMode: "none",
    sizeMode: "screen-pixels",
    blendMode: "alpha",
    firstInstance,
    instanceCount: endInstance - firstInstance,
    layerMask: options.layerMask ?? 1,
    sortKey: options.sortKey ?? {
      queue: "transparent",
      viewId: 0,
      layer: options.layerMask ?? 1,
      order: 0,
      pipelineKey: "msdf-text",
      materialKey,
      meshKey: "glyph-quad",
      depth: 0,
      stableId: (baseBatchId + batchIndex) >>> 0,
    },
  };
}

function diagnoseUnsupportedShaping(
  char: string,
  charIndex: number,
  diagnostics: MsdfTextDiagnostic[],
): void {
  const code = char.codePointAt(0) ?? 0;
  const needsShaping =
    (code >= 0x0590 && code <= 0x08ff) ||
    (code >= 0xfb1d && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff) ||
    (code >= 0x0300 && code <= 0x036f);

  if (!needsShaping) {
    return;
  }

  diagnostics.push({
    code: "msdfText.unsupportedShaping",
    char,
    charIndex,
    message:
      "M6 MSDF text supports basic left-to-right glyph layout only; complex shaping, bidi, and combining marks are not supported in this slice.",
  });
}

function textAlignOffset(
  align: MsdfTextAlign,
  availableWidth: number,
  lineWidth: number,
): number {
  switch (align) {
    case "center":
      return Math.max(0, (availableWidth - lineWidth) * 0.5);
    case "right":
      return Math.max(0, availableWidth - lineWidth);
    case "left":
      return 0;
  }
}

function kerningKey(first: number, second: number): string {
  return `${first}/${second}`;
}

function missingGlyphAdvance(font: MsdfFontAtlasAsset, scale: number): number {
  return font.fontSize * 0.6 * scale;
}

function stableGlyphId(glyph: MsdfTextLayoutGlyph): number {
  return stableStringHash(
    `${glyph.charIndex}:${glyph.glyphId}:${glyph.lineIndex}:${glyph.x}:${glyph.y}`,
  );
}

function stableStringHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function charFromCodePoint(codePoint: number): string {
  try {
    return String.fromCodePoint(Math.trunc(codePoint));
  } catch {
    return "";
  }
}

function printableChar(char: string): string {
  return char === "\n" ? "\\n" : char === "\t" ? "\\t" : char;
}

function finitePositive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
