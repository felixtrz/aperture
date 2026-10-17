/** Source bytes are authoritative asset data. GPU allocation belongs to rendering. */
export interface SourceBufferAsset {
  readonly kind: "buffer";
  readonly label: string;
  readonly data: Uint8Array<ArrayBuffer>;
}
export function createSourceBufferAsset(
  data: ArrayBufferView,
  label = "Storage buffer",
): SourceBufferAsset {
  if (data.byteLength === 0 || data.byteLength % 4 !== 0)
    throw new Error(
      "Source buffers require a positive byte length divisible by four.",
    );
  return {
    kind: "buffer",
    label,
    data: new Uint8Array(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    ),
  };
}
