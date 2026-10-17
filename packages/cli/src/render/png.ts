import { deflateSync } from "node:zlib";

/** Encode straight-alpha sRGB RGBA8 with explicit PNG color metadata. */
export function encodeRenderPng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Buffer {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    rgba.byteLength !== width * height * 4
  )
    throw new RangeError("Invalid RGBA image dimensions.");
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row++)
    scanlines.set(
      rgba.subarray(row * width * 4, (row + 1) * width * 4),
      row * (width * 4 + 1) + 1,
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("sRGB", Buffer.from([0])),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = (value >>> 1) ^ ((value & 1) === 0 ? 0 : 0xedb88320);
  return value >>> 0;
});

function chunk(type: string, payload: Uint8Array): Buffer {
  const result = Buffer.alloc(payload.byteLength + 12);
  result.writeUInt32BE(payload.byteLength);
  result.write(type, 4, "ascii");
  result.set(payload, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, -4))
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
