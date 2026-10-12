/* Pure ECMAScript: works in functions.exec without atob, crypto, TextEncoder,
 * Buffer, Node imports, filesystem access or browser globals. No image URL is
 * returned/logged. Hashes the actual returned original PNG transport bytes. */
const pngTransportLimit = 32 * 1024 * 1024;
const sha256Constants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export function sha256Bytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > pngTransportLimit)
    throw new Error("Bounded byte array required");
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  for (let index = 0; index < 8; index++)
    padded[padded.length - 1 - index] =
      Math.floor(bitLength / 2 ** (8 * index)) & 255;
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const rotate = (value, bits) => (value >>> bits) | (value << (32 - bits));
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const at = offset + 4 * index;
      words[index] =
        ((padded[at] << 24) |
          (padded[at + 1] << 16) |
          (padded[at + 2] << 8) |
          padded[at + 3]) >>>
        0;
    }
    for (let index = 16; index < 64; index++) {
      const x = words[index - 15],
        y = words[index - 2];
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3);
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let index = 0; index < 64; index++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (k + s1 + ch + sha256Constants[index] + words[index]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    for (const [index, value] of [a, b, c, d, e, f, g, k].entries())
      h[index] = (h[index] + value) >>> 0;
  }
  return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}

export function inspectLivePngDataUrl(result) {
  if (
    !result ||
    result.detail !== "original" ||
    typeof result.image_url !== "string"
  )
    throw new Error("Actual original tools.view_image result required");
  const url = result.image_url;
  const comma = url.indexOf(",");
  const prefix = url.slice(0, comma);
  const mime =
    prefix === "data:image/png;base64"
      ? "image/png"
      : prefix === "data:application/octet-stream;base64"
        ? "application/octet-stream"
        : null;
  if (!mime)
    throw new Error("Unknown local PNG data URL transport MIME/encoding");
  const encoded = url.slice(comma + 1);
  if (
    encoded.length === 0 ||
    encoded.length > 4 * Math.ceil(pngTransportLimit / 3) ||
    encoded.length % 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  )
    throw new Error("Bounded canonical padded base64 required");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const length = (encoded.length / 4) * 3 - padding;
  if (length < 33 || length > pngTransportLimit)
    throw new Error("Bounded full PNG transport required");
  const bytes = new Uint8Array(length);
  let written = 0;
  for (let index = 0; index < encoded.length; index += 4) {
    const a = alphabet.indexOf(encoded[index]),
      b = alphabet.indexOf(encoded[index + 1]);
    const c =
      encoded[index + 2] === "=" ? 0 : alphabet.indexOf(encoded[index + 2]);
    const d =
      encoded[index + 3] === "=" ? 0 : alphabet.indexOf(encoded[index + 3]);
    if (
      a < 0 ||
      b < 0 ||
      c < 0 ||
      d < 0 ||
      (index === encoded.length - 4 &&
        ((padding === 2 && b & 15) || (padding === 1 && c & 3)))
    )
      throw new Error("Invalid/noncanonical base64 padding");
    const word = (a << 18) | (b << 12) | (c << 6) | d;
    if (written < length) bytes[written++] = word >>> 16;
    if (written < length) bytes[written++] = word >>> 8;
    if (written < length) bytes[written++] = word;
  }
  const expected = [
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  ];
  if (expected.some((byte, index) => bytes[index] !== byte))
    throw new Error("Returned transport is not the source PNG type");
  const u32 = (at) =>
    bytes[at] * 0x1000000 +
    (bytes[at + 1] << 16) +
    (bytes[at + 2] << 8) +
    bytes[at + 3];
  const width = u32(16),
    height = u32(20);
  if (width <= 0 || height <= 0 || width > 16384 || height > 16384)
    throw new Error("Bounded positive returned PNG dimensions required");
  return {
    detail: result.detail,
    dataUrlMime: mime,
    dataUrlCharacters: url.length,
    displayedVia: "image(result.image_url, original)",
    decodedBytes: length,
    decodedSha256: sha256Bytes(bytes),
    pngDimensions: { width, height },
  };
}
