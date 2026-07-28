/**
 * Generate Aperture's neutral studio Radiance RGBE environment. Keep this in
 * sync with the CLI scaffold generator; the validation suite compares bytes.
 */
export function createStudioNeutralHdr(width = 32, height = 16) {
  const header = Buffer.from(
    `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`,
    "ascii",
  );
  const pixels = Buffer.alloc(width * height * 4);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const base = 0.16 + 0.42 * Math.pow(1 - v, 1.2);
      const key =
        3.4 * Math.exp(-((u - 0.22) ** 2 / 0.007 + (v - 0.28) ** 2 / 0.028));
      const rim =
        1.15 * Math.exp(-((u - 0.72) ** 2 / 0.025 + (v - 0.38) ** 2 / 0.06));
      const ground = 0.08 * Math.exp(-((v - 0.82) ** 2 / 0.08));
      const encoded = encodeRgbe(
        base + key + rim * 0.84 + ground,
        base + key * 0.97 + rim * 0.92 + ground,
        base + key * 0.92 + rim + ground,
      );

      pixels.set(encoded, offset);
      offset += 4;
    }
  }

  return Buffer.concat([header, pixels]);
}

function encodeRgbe(red, green, blue) {
  const maximum = Math.max(red, green, blue);
  if (maximum < 1e-32) {
    return [0, 0, 0, 0];
  }

  const exponent = Math.floor(Math.log2(maximum)) + 1;
  const scale = 256 / 2 ** exponent;
  return [
    byte(red * scale),
    byte(green * scale),
    byte(blue * scale),
    exponent + 128,
  ];
}

function byte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
