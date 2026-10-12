import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { requireValue } from "./contract.mjs";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export async function writeImmutable(path, bytes) {
  const file = await open(path, "wx", 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Checks surviving native canvas bytes; does not score image quality. */
export function inspectPng(bytes, { width, height }) {
  requireValue(
    Buffer.isBuffer(bytes) &&
      bytes.length <= 32 * 1024 * 1024 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "Invalid PNG signature/size",
  );
  let offset = 8,
    header,
    ended = false;
  const compressed = [];
  while (offset < bytes.length) {
    requireValue(offset + 12 <= bytes.length, "Truncated PNG chunk");
    const size = bytes.readUInt32BE(offset),
      end = offset + size + 12;
    requireValue(
      size <= bytes.length && end <= bytes.length,
      "Truncated PNG payload",
    );
    const type = bytes.toString("ascii", offset + 4, offset + 8),
      data = bytes.subarray(offset + 8, end - 4);
    requireValue(
      crc32(bytes.subarray(offset + 4, end - 4)) ===
        bytes.readUInt32BE(end - 4),
      "Invalid PNG CRC",
    );
    if (!header) requireValue(type === "IHDR", "PNG header must be first");
    if (type === "IHDR") {
      requireValue(!header && size === 13, "Invalid PNG header");
      header = data;
    }
    if (type === "IDAT") compressed.push(data);
    if (type === "IEND") {
      requireValue(size === 0 && end === bytes.length, "Trailing PNG data");
      ended = true;
      break;
    }
    offset = end;
  }
  requireValue(ended && header && compressed.length > 0, "Incomplete PNG");
  requireValue(
    header.readUInt32BE(0) === width &&
      header.readUInt32BE(4) === height &&
      header[8] === 8 &&
      [2, 6].includes(header[9]) &&
      header[10] === 0 &&
      header[11] === 0 &&
      header[12] === 0,
    "Unexpected PNG dimensions/format",
  );
  const channels = header[9] === 6 ? 4 : 3,
    stride = width * channels;
  const raw = inflateSync(Buffer.concat(compressed), {
    maxOutputLength: height * (stride + 1),
  });
  requireValue(
    raw.length === height * (stride + 1),
    "PNG decompression size differs",
  );
  let previous = Buffer.alloc(stride),
    first,
    visiblePixels = 0,
    nonuniformPixels = 0;
  const min = [255, 255, 255],
    max = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1),
      filter = raw[start],
      row = Buffer.alloc(stride);
    requireValue(filter <= 4, "Invalid PNG filter");
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0,
        up = previous[i],
        upperLeft = i >= channels ? previous[i - channels] : 0;
      let prediction = 0;
      if (filter === 1) prediction = left;
      if (filter === 2) prediction = up;
      if (filter === 3) prediction = Math.floor((left + up) / 2);
      if (filter === 4) {
        const p = left + up - upperLeft,
          a = Math.abs(p - left),
          b = Math.abs(p - up),
          c = Math.abs(p - upperLeft);
        prediction = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      }
      row[i] = (raw[start + i + 1] + prediction) & 255;
    }
    for (let i = 0; i < stride; i += channels) {
      if (channels === 4 && row[i + 3] === 0) continue;
      visiblePixels++;
      first ??= row.subarray(i, i + 3);
      if ([0, 1, 2].some((axis) => row[i + axis] !== first[axis]))
        nonuniformPixels++;
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], row[i + axis]);
        max[axis] = Math.max(max[axis], row[i + axis]);
      }
    }
    previous = row;
  }
  requireValue(
    visiblePixels > (width * height) / 2 &&
      nonuniformPixels >= Math.min(1024, (width * height) / 8) &&
      max.some((value, axis) => value - min[axis] >= 8),
    "Blank/transparent/uniform native canvas image",
  );
  return {
    width,
    height,
    visiblePixels,
    nonuniformPixels,
    channelMinimum: min,
    channelMaximum: max,
    blankCheck: "passed",
  };
}

export async function readBoundedBody(request, limit) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    requireValue(bytes <= limit, "Artifact exceeds bounded request limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
