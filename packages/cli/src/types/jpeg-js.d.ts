declare module "jpeg-js" {
  export interface JpegDecodeOptions {
    readonly colorTransform?: boolean;
    readonly maxMemoryUsageInMB?: number;
    readonly useTArray?: boolean;
  }

  export interface JpegRawImageData {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
  }

  export function decode(
    bytes: Uint8Array | Buffer,
    options?: JpegDecodeOptions,
  ): JpegRawImageData;
}
