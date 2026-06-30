#!/usr/bin/env node
// A drop-in detector for the F1/F2 blank-render false-positive: `aperture
// render` + `isPngBlank` only catch all-BLACK frames, so an all-WHITE (or any
// near-uniform) capture passes CI. This checks for ANY near-uniform frame —
// the check `isPngBlank` should be doing.
//
// Usage: node detect-blank-render.mjs <png> [--min-distinct N] [--max-dominant F]
// Exits 1 (and explains) if the frame is suspiciously uniform.
import path from "node:path";
import { createRequire } from "node:module";

const [, , pngArg, ...rest] = process.argv;
if (!pngArg) {
  console.error("usage: detect-blank-render.mjs <png> [--min-distinct N] [--max-dominant F]");
  process.exit(2);
}
const opt = (flag, def) => {
  const i = rest.indexOf(flag);
  return i >= 0 ? Number(rest[i + 1]) : def;
};
const MIN_DISTINCT = opt("--min-distinct", 8); // a real 3D frame has many colors
const MAX_DOMINANT = opt("--max-dominant", 0.97); // one color shouldn't be ~the whole frame

// Resolve sharp from wherever it's installed (e.g. an app's node_modules).
const require = createRequire(path.resolve("app/package.json"));
let sharp;
try {
  sharp = require("sharp");
} catch {
  const fallback = require.resolve("sharp", {
    paths: ["app/node_modules/.pnpm"],
  });
  sharp = (await import(fallback)).default;
}

const { data, info } = await sharp(pngArg).raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;
const colors = new Map();
for (let i = 0; i < data.length; i += ch) {
  const k = `${data[i]},${data[i + 1]},${data[i + 2]}`;
  colors.set(k, (colors.get(k) ?? 0) + 1);
}
const px = data.length / ch;
const distinct = colors.size;
const [domColor, domCount] = [...colors.entries()].sort((a, b) => b[1] - a[1])[0];
const domFrac = domCount / px;

const blank = distinct < MIN_DISTINCT || domFrac > MAX_DOMINANT;
console.log(JSON.stringify({
  png: pngArg,
  distinctColors: distinct,
  dominantColor: domColor,
  dominantFraction: Number(domFrac.toFixed(4)),
  verdict: blank ? "BLANK/near-uniform (likely a broken capture)" : "ok (has real content)",
}, null, 2));
process.exit(blank ? 1 : 0);
