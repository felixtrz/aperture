import { assetHandleKey, } from "@aperture-engine/simulation";
import { createQuadSnapshotBuffers, encodeQuadInstanceFlags, QUAD_INSTANCE_FLOAT_STRIDE, QUAD_INSTANCE_WORD_STRIDE, } from "../rendering/snapshot.js";
export function createMsdfFontAtlasAsset(input) {
    const source = input.source;
    const scaleW = finitePositive(source.common.scaleW, 1);
    const scaleH = finitePositive(source.common.scaleH, 1);
    const fontSize = finitePositive(Math.abs(source.info.size), 1);
    const glyphs = source.chars.map((glyph) => createGlyphFromBmFont(glyph, scaleW, scaleH));
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
export function validateMsdfFontAtlasAsset(asset) {
    const diagnostics = [];
    if (asset.fontSize <= 0 ||
        !Number.isFinite(asset.fontSize) ||
        asset.lineHeight <= 0 ||
        !Number.isFinite(asset.lineHeight)) {
        diagnostics.push({
            code: "msdfFont.invalidFontSize",
            field: "fontSize",
            message: "MSDF font atlas requires finite positive fontSize and lineHeight values.",
        });
    }
    if (asset.scaleW <= 0 ||
        asset.scaleH <= 0 ||
        !Number.isFinite(asset.scaleW) ||
        !Number.isFinite(asset.scaleH)) {
        diagnostics.push({
            code: "msdfFont.invalidAtlasDimensions",
            field: "common.scaleW/common.scaleH",
            message: "MSDF font atlas requires finite positive common.scaleW and common.scaleH dimensions.",
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
    const seenChars = new Set();
    const seenIds = new Set();
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
        if (glyph.x < 0 ||
            glyph.y < 0 ||
            glyph.width < 0 ||
            glyph.height < 0 ||
            glyph.x + glyph.width > asset.scaleW ||
            glyph.y + glyph.height > asset.scaleH) {
            diagnostics.push({
                code: "msdfFont.invalidGlyphBounds",
                field: "chars",
                glyphId: glyph.id,
                char: glyph.char,
                message: `MSDF glyph '${glyph.char}' bounds must fit inside the ${asset.scaleW}x${asset.scaleH} atlas.`,
            });
        }
    }
    if (asset.pageCount !== asset.pageNames.length ||
        asset.pages.length !== asset.pageCount) {
        diagnostics.push({
            code: "msdfFont.pageCountMismatch",
            field: "common.pages",
            message: `MSDF font atlas common.pages declares ${asset.pageCount} page(s), page metadata has ${asset.pageNames.length}, and texture handles provide ${asset.pages.length}.`,
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
export function layoutMsdfText(font, options) {
    const diagnostics = validateMsdfFontAtlasAsset(font).diagnostics.map((diagnostic) => ({
        ...diagnostic,
        sourceCode: diagnostic.code,
    }));
    const fontSize = options.fontSize ?? font.fontSize;
    const lineHeight = options.lineHeight ?? font.lineHeight * (fontSize / font.fontSize);
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
    const draftGlyphs = [];
    const draftLines = [];
    let line = createDraftLine(0, 0, 0);
    for (const token of tokenizeText(options.text)) {
        if (token.kind === "newline") {
            finalizeDraftLine(line, draftLines);
            line = createDraftLine(draftLines.length, token.charIndex + token.value.length, draftGlyphs.length);
            continue;
        }
        if (token.kind === "word" &&
            line.advance > 0 &&
            Number.isFinite(maxWidth)) {
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
                line = createDraftLine(draftLines.length, token.charIndex, draftGlyphs.length);
            }
        }
        const layoutToken = token;
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
    const measuredWidth = draftLines.reduce((width, entry) => Math.max(width, entry.width), 0);
    const availableWidth = Number.isFinite(maxWidth) ? maxWidth : measuredWidth;
    const positionedGlyphs = [];
    for (const draft of draftGlyphs) {
        const draftLine = draftLines[draft.lineIndex];
        const lineOffset = draftLine === undefined
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
export function createMsdfTextQuadSnapshot(options) {
    const floats = new Float32Array(options.layout.glyphs.length * QUAD_INSTANCE_FLOAT_STRIDE);
    const words = new Uint32Array(options.layout.glyphs.length * QUAD_INSTANCE_WORD_STRIDE);
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
export function msdfFontAtlasDependencies(asset) {
    return asset.sampler === undefined || asset.sampler === null
        ? [...asset.pages]
        : [...asset.pages, asset.sampler];
}
function createGlyphFromBmFont(glyph, scaleW, scaleH) {
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
function createGlyphCharMap(font) {
    const map = new Map();
    for (const glyph of font.glyphs) {
        if (!map.has(glyph.char)) {
            map.set(glyph.char, glyph);
        }
    }
    return map;
}
function createKerningMap(font) {
    const map = new Map();
    for (const kerning of font.kernings) {
        map.set(kerningKey(kerning.first, kerning.second), kerning.amount);
    }
    return map;
}
function tokenizeText(text) {
    const tokens = [];
    let currentKind = null;
    let currentValue = "";
    let currentIndex = 0;
    let index = 0;
    for (const char of text) {
        const kind = char === "\n"
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
        }
        else {
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
function appendTokenToLine(options) {
    let localIndex = 0;
    for (const char of options.token.value) {
        appendCharToLine({
            ...options,
            char,
            charIndex: options.token.charIndex + localIndex,
        });
        localIndex += char.length;
    }
    if (options.line.charEnd <
        options.token.charIndex + options.token.value.length) {
        options.line.charEnd = options.token.charIndex + options.token.value.length;
    }
}
function appendCharToLine(options) {
    diagnoseUnsupportedShaping(options.char, options.charIndex, options.diagnostics);
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
    const kerning = options.line.previousGlyphId === null
        ? 0
        : (options.kernings.get(kerningKey(options.line.previousGlyphId, glyph.id)) ?? 0) * options.scale;
    const advance = glyph.xadvance * options.scale + options.letterSpacing + kerning;
    const x = options.line.advance + kerning + glyph.xoffset * options.scale;
    const y = options.line.lineIndex * options.lineHeight + glyph.yoffset * options.scale;
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
function measureToken(options) {
    let advance = 0;
    let previousGlyphId = options.previousGlyphId;
    for (const char of options.token.value) {
        const glyph = options.glyphsByChar.get(char);
        if (glyph === undefined) {
            advance += missingGlyphAdvance(options.font, options.scale);
            continue;
        }
        const kerning = previousGlyphId === null
            ? 0
            : (options.kernings.get(kerningKey(previousGlyphId, glyph.id)) ?? 0) *
                options.scale;
        advance += glyph.xadvance * options.scale + options.letterSpacing + kerning;
        previousGlyphId = glyph.id;
    }
    return { advance };
}
function createDraftLine(lineIndex, charStart, glyphStart) {
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
function finalizeDraftLine(line, lines) {
    lines.push({ ...line });
}
function createGlyphQuadBatches(options) {
    const batches = [];
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
                batches.push(createGlyphBatch(options, baseBatchId, batches.length, currentPage, firstInstance, index));
            }
            currentPage = glyph.page;
            firstInstance = index;
        }
    }
    if (currentPage >= 0) {
        batches.push(createGlyphBatch(options, baseBatchId, batches.length, currentPage, firstInstance, options.layout.glyphs.length));
    }
    return batches;
}
function createGlyphBatch(options, baseBatchId, batchIndex, page, firstInstance, endInstance) {
    const texture = options.font.pages[page] ?? options.font.pages[0];
    const textureKey = texture === undefined
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
function diagnoseUnsupportedShaping(char, charIndex, diagnostics) {
    const code = char.codePointAt(0) ?? 0;
    const needsShaping = (code >= 0x0590 && code <= 0x08ff) ||
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
        message: "M6 MSDF text supports basic left-to-right glyph layout only; complex shaping, bidi, and combining marks are not supported in this slice.",
    });
}
function textAlignOffset(align, availableWidth, lineWidth) {
    switch (align) {
        case "center":
            return Math.max(0, (availableWidth - lineWidth) * 0.5);
        case "right":
            return Math.max(0, availableWidth - lineWidth);
        case "left":
            return 0;
    }
}
function kerningKey(first, second) {
    return `${first}/${second}`;
}
function missingGlyphAdvance(font, scale) {
    return font.fontSize * 0.6 * scale;
}
function stableGlyphId(glyph) {
    return stableStringHash(`${glyph.charIndex}:${glyph.glyphId}:${glyph.lineIndex}:${glyph.x}:${glyph.y}`);
}
function stableStringHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function charFromCodePoint(codePoint) {
    try {
        return String.fromCodePoint(Math.trunc(codePoint));
    }
    catch {
        return "";
    }
}
function printableChar(char) {
    return char === "\n" ? "\\n" : char === "\t" ? "\\t" : char;
}
function finitePositive(value, fallback) {
    return value !== undefined && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}
function finiteNumber(value, fallback) {
    return value !== undefined && Number.isFinite(value) ? value : fallback;
}
//# sourceMappingURL=msdf-font-atlas.js.map