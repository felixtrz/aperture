import type { StaticInspectionVertex } from "./static-inspection-draw.js";

// A numerical sensitivity policy, not a fit/visual acceptance threshold.
export const projectedBoundsPrecisionPixels = 0.05;
const unitRoundoff = 2 ** -24;
const gamma7 = (7 * unitRoundoff) / (1 - 7 * unitRoundoff);
const minimumNormal = 2 ** -126;
const maximumFloat = (2 - 2 ** -23) * 2 ** 127;

/** Retained VP * (resolved model * source position), matching shader stages. */
export function projectInspectionVertex(
  vertex: StaticInspectionVertex,
  vp: readonly number[],
  target: { readonly width: number; readonly height: number },
) {
  if (
    vertex.local.some((n) => n !== 0 && Math.abs(n) < minimumNormal) ||
    vertex.magnitude.some((n) => n > maximumFloat)
  )
    throw new Error(
      "Subnormal source positions or overflowing Float32 model products are unsupported.",
    );
  const world = [...vertex.world, 1];
  const worldError = [
    ...vertex.magnitude.map((m) => gamma7 * m + 16 * minimumNormal),
    0,
  ];
  const clip: number[] = [],
    error: number[] = [];
  for (let row = 0; row < 4; row++) {
    let value = 0,
      magnitude = 0,
      propagated = 0;
    for (let col = 0; col < 4; col++) {
      const m = vp[col * 4 + row]!;
      value += m * world[col]!;
      magnitude += Math.abs(m * world[col]!);
      propagated += Math.abs(m) * worldError[col]!;
    }
    if (magnitude + propagated > maximumFloat)
      throw new Error("Float32 view-projection products may overflow.");
    clip.push(value);
    error.push(
      propagated + gamma7 * (magnitude + propagated) + 16 * minimumNormal,
    );
  }
  if (![...clip, ...error].every(Number.isFinite))
    throw new Error("Projection or roundoff estimate overflowed.");
  // Do not turn an eye/near-plane crossing into a misleading vertex envelope.
  // Require a resolved sign even allowing Float32 stage-rounding uncertainty.
  const w = clip[3]!,
    lowerW = w - error[3]!;
  if (!(lowerW > 0) || clip[2]! - error[2]! < 0)
    throw new Error(
      "Selected vertex is at/before, or numerically unresolved against, the eye/near plane.",
    );
  const ndc = clip.slice(0, 3).map((v) => v / w) as [number, number, number];
  const pixel = [
    ((ndc[0] + 1) * target.width) / 2,
    ((1 - ndc[1]) * target.height) / 2,
  ] as [number, number];
  const uncertainty = [target.width, target.height].map((size, axis) => {
    // Quotient perturbation bound, then Float32 divide/viewport arithmetic.
    const ratioError =
      (error[axis]! + Math.abs(ndc[axis]!) * error[3]!) / lowerW;
    return (size / 2) * (ratioError + gamma7 * (1 + Math.abs(ndc[axis]!)));
  });
  if (![...ndc, ...pixel, ...uncertainty].every(Number.isFinite))
    throw new Error("Projected coordinates or pixel uncertainty overflowed.");
  const maxPixelUncertainty = Math.max(...uncertainty);
  if (maxPixelUncertainty > projectedBoundsPrecisionPixels)
    throw new Error(
      `Float32 projection uncertainty ${maxPixelUncertainty} px exceeds the ${projectedBoundsPrecisionPixels} px numerical limit.`,
    );
  return {
    ndc,
    pixel,
    maxPixelUncertainty,
    outsideViewport: Math.abs(ndc[0]) > 1 || Math.abs(ndc[1]) > 1,
    beyondFar: ndc[2] > 1,
  };
}
