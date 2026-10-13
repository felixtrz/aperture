export interface PixelSampleRequest {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly coordinateSpace: "auto" | "normalized" | "pixel";
}
export declare function pixelSampleRequestsFromPayload(payload: unknown): readonly PixelSampleRequest[];
export declare function pixelFromSample(dimensions: {
    readonly width: number;
    readonly height: number;
}, sample: PixelSampleRequest): {
    readonly x: number;
    readonly y: number;
} | null;
export declare function canvasDimensions(canvas: {
    readonly width: number;
    readonly height: number;
}): {
    readonly width: number;
    readonly height: number;
};
export declare function numberFromValue(value: unknown): number | undefined;
//# sourceMappingURL=payloads.d.ts.map