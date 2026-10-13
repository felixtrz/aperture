import { type SamplerHandle, type TextureHandle } from "@aperture-engine/simulation";
import { type QuadBatchPacket, type QuadSnapshotBuffers } from "../rendering/snapshot.js";
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
export type MsdfFontAtlasDiagnosticCode = "msdfFont.invalidAtlasDimensions" | "msdfFont.invalidDistanceRange" | "msdfFont.invalidFontSize" | "msdfFont.invalidGlyphBounds" | "msdfFont.invalidGlyphPage" | "msdfFont.duplicateGlyph" | "msdfFont.missingGlyphs" | "msdfFont.pageCountMismatch" | "msdfFont.texturePageMismatch";
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
export type MsdfTextDiagnosticCode = MsdfFontAtlasDiagnosticCode | "msdfText.missingGlyph" | "msdfText.unsupportedShaping" | "msdfText.invalidFontSize" | "msdfText.invalidMaxWidth";
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
export declare function createMsdfFontAtlasAsset(input: {
    readonly label?: string;
    readonly source: MsdfBmFontJson;
    readonly pages: readonly TextureHandle[];
    readonly sampler?: SamplerHandle | null;
}): MsdfFontAtlasAsset;
export declare function validateMsdfFontAtlasAsset(asset: MsdfFontAtlasAsset): MsdfFontAtlasValidationReport;
export declare function layoutMsdfText(font: MsdfFontAtlasAsset, options: MsdfTextLayoutOptions): MsdfTextLayout;
export declare function createMsdfTextQuadSnapshot(options: CreateMsdfTextQuadSnapshotOptions): MsdfTextQuadSnapshot;
export declare function msdfFontAtlasDependencies(asset: MsdfFontAtlasAsset): readonly (TextureHandle | SamplerHandle)[];
//# sourceMappingURL=msdf-font-atlas.d.ts.map