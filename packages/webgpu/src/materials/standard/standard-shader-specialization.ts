import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";

const LIGHT_CLASSES = [
  [0, "AMBIENT"],
  [1, "DIRECTIONAL"],
  [2, "POINT"],
  [3, "SPOT"],
  [5, "RECT_AREA"],
] as const;

/** Specializes only generated built-in WGSL; authored shader text is untouched. */
export function applyStandardShaderSpecialization(
  source: string,
  features: StandardTextureShaderFeatures,
): string {
  // Preserve fully composed dynamic WGSL and its existing bindings on all
  // clustered/cookie routes, including direct generator callers with hints.
  if (
    features.clusteredLocalLights === true ||
    features.clusteredLocalLightCookies === true ||
    features.clusteredLocalLightShadowCookies === true ||
    features.clusteredLocalLightArrayCookies === true ||
    features.clusteredLocalLightCubeCookies === true ||
    features.clusteredLocalLightArrayShadows === true ||
    features.clusteredLocalLightPointArrayShadows === true
  )
    return source;
  let code = source;
  if (features.fixedLightStorage !== undefined) {
    // Schlick uses an integer fifth power on [0,1]. Keep the same BRDF while
    // avoiding general pow lowering on the admitted ordinary-light route.
    const original = `fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - saturate(cosTheta), 5.0);
}`;
    const multiplied = `fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {
  let complement = 1.0 - saturate(cosTheta);
  let squared = complement * complement;
  let fifthPower = squared * squared * complement;
  return f0 + (vec3f(1.0) - f0) * fifthPower;
}`;
    if (code.split(original).length !== 2)
      throw new Error("Built-in Fresnel specialization seam must occur once");
    code = code.replace(original, multiplied);
  }
  const mask = features.lightKindMask;
  if (mask !== undefined) {
    if (!Number.isSafeInteger(mask) || mask < 0 || mask > 63)
      throw new Error("Standard light kind mask must be an integer in [0,63]");
    // Without any analytic kind keep the complete lighting/binding fallback.
    // Standard-frame readiness already rejects absent analytic light buffers.
    if ((mask & 47) === 0) return source;
    for (const [kind, name] of LIGHT_CLASSES) {
      if ((mask & (1 << kind)) !== 0) continue;
      const marker = `    if (kind == LIGHT_KIND_${name}) {`;
      let index = code.indexOf(marker);
      while (index >= 0) {
        const opening = code.indexOf("{", index);
        code = code.slice(0, index) + code.slice(blockEnd(code, opening));
        index = code.indexOf(marker);
      }
    }
    if ((mask & (1 << 5)) === 0) {
      // All area-only helpers are unreachable after removing their evaluation.
      // Preserve declaration metadata and GPU resource lifetime contracts;
      // frame resource creation omits unused LTC entries from the auto layout.
      const names = [...code.matchAll(/\bfn ([A-Za-z_]\w*)\(/gu)].map(
        (match) => match[1]!,
      );
      for (const name of names) {
        if (
          /^(?:ltc|areaLight|rectAreaLight|diskAreaLight|sphereAreaLight)/u.test(
            name,
          ) ||
          name === "evaluateAreaLight" ||
          name === "packedAreaLightHalfWidth" ||
          name === "packedAreaLightHalfHeight"
        )
          code = removeFunction(code, name);
      }
    }
  }
  code = specializeKnownLightLayout(code, features);
  code = specializeSingleShadowOwner(code, features);
  const filter = features.fixedDirectionalShadowFilter;
  // These paths intentionally retain their existing general algorithms.
  if (
    filter === undefined ||
    features.shadowMap !== true ||
    features.cascadedShadowMap === true ||
    features.pointShadowMap === true ||
    features.directionalPointShadowMap === true ||
    features.spotShadowMap === true
  )
    return code;
  if (filter !== 0 && filter !== 1 && filter !== 2)
    throw new Error("Standard directional shadow filter must be 0, 1 or 2");
  const functionName = "sampleSpotShadowFactorWithMatrixBaseAndStrength";
  const start = code.indexOf(`fn ${functionName}(`);
  if (start < 0)
    throw new Error("Single-map shadow specialization helper missing");
  const opening = code.indexOf("{", start);
  const end = blockEnd(code, opening);
  const body = code.slice(start, end);
  const dispatch = body.indexOf("  var rawVisibility: f32;");
  const dispatchEnd = body.indexOf("  let visibility = select(", dispatch);
  if (dispatch < 0 || dispatchEnd < 0)
    throw new Error("Single-map shadow specialization dispatch missing");
  const sample =
    filter === 2
      ? "sampleDirectionalShadowPcss(clampedShadowUv, receiverDepth, directionalShadowMatrices[matrixBaseIndex], filterRadiusTexels)"
      : filter === 1
        ? "sampleDirectionalShadowPcfSoft(clampedShadowUv, receiverDepth)"
        : "sampleDirectionalShadowPcf3x3(clampedShadowUv, receiverDepth, filterRadiusTexels)";
  code =
    code.slice(0, start) +
    body.slice(0, dispatch) +
    `  let rawVisibility = ${sample};\n` +
    body.slice(dispatchEnd) +
    code.slice(end);
  // Resolve the filter constant only; all strength/bias/radius calculations,
  // owner selection, projection bounds and invalid-depth fallbacks stay intact.
  code = code.replace(
    "  let filterType = shadowParameters.filterType;",
    `  let filterType = ${filter}u;`,
  );
  if (filter !== 2) {
    code = removeFunction(code, "sampleDirectionalShadowPcss");
    code = removeFunction(code, "sampleDirectionalPcssBilinear");
    const disk = code.indexOf("const DIRECTIONAL_PCSS_DISK:");
    if (disk >= 0) {
      const diskEnd = code.indexOf(");", disk);
      if (diskEnd < 0)
        throw new Error("Directional PCSS disk declaration incomplete");
      code = code.slice(0, disk) + code.slice(diskEnd + 2);
    }
  }
  if (filter !== 1)
    code = removeFunction(code, "sampleDirectionalShadowPcfSoft");
  // PCSS retains its established hard-depth fallback through this helper.
  if (filter === 1)
    code = removeFunction(code, "sampleDirectionalShadowPcf3x3");
  return code;
}

function specializeKnownLightLayout(
  code: string,
  features: StandardTextureShaderFeatures,
): string {
  const layout = features.knownLightKindLayout;
  if (
    layout === undefined ||
    layout.length === 0 ||
    layout.length > 8 ||
    !layout.every((kind) => kind === 0 || kind === 1) ||
    !layout.some((kind) => kind === 0 || kind === 1) ||
    features.clusteredLocalLights === true ||
    features.clusteredLocalLightCookies === true ||
    features.clusteredLocalLightShadowCookies === true ||
    features.clusteredLocalLightArrayCookies === true ||
    features.clusteredLocalLightCubeCookies === true ||
    features.clusteredLocalLightArrayShadows === true ||
    features.clusteredLocalLightPointArrayShadows === true
  )
    return code;
  const mask = layout.reduce<number>((value, kind) => value | (1 << kind), 0);
  if (features.lightKindMask === undefined || features.lightKindMask !== mask)
    return code;

  // Operate only on the generated fs_main loop after extension composition.
  // Owner selection and all other light loops remain dynamic in this variant.
  const main = code.indexOf("fn fs_main(");
  if (main < 0) return code;
  const mainOpening = code.indexOf("{", main);
  const mainEnd = blockEnd(code, mainOpening);
  const marker =
    "  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {";
  const loop = code.indexOf(marker, mainOpening);
  if (loop < 0 || loop >= mainEnd) return code;
  const opening = code.indexOf("{", loop);
  const end = blockEnd(code, opening);
  const body = code.slice(opening + 1, end - 1);
  const terms = new Map<number, string>();
  for (const [kind, name] of LIGHT_CLASSES) {
    if (kind !== 0 && kind !== 1) continue;
    const branch = body.indexOf(`    if (kind == LIGHT_KIND_${name}) {`);
    if (branch < 0) continue;
    const branchOpening = body.indexOf("{", branch);
    const branchEnd = blockEnd(body, branchOpening);
    terms.set(kind, body.slice(branchOpening + 1, branchEnd - 1));
  }
  if (layout.some((kind) => !terms.has(kind))) return code;
  const unrolled = layout
    .map((kind, index) => {
      // This runtime guard both rejects a shorter bound metadata buffer and
      // keeps binding 1 reachable under layout:auto. Do not replace by true.
      const term = terms.get(kind)!.replace(/\blightIndex\b/gu, `${index}u`);
      return `  if (${index}u < lightCount()) {${term}  }`;
    })
    .filter((term) => term.length !== 0)
    .join("\n");
  return code.slice(0, loop) + unrolled + code.slice(end);
}

function specializeSingleShadowOwner(
  code: string,
  features: StandardTextureShaderFeatures,
): string {
  const layout = features.knownLightKindLayout;
  const owner = features.fixedSingleShadowLightIndex;
  if (
    owner === undefined ||
    !Number.isInteger(owner) ||
    owner < -1 ||
    owner > 7 ||
    layout === undefined ||
    layout.length === 0 ||
    layout.length > 8 ||
    !layout.every((kind) => kind === 0 || kind === 1) ||
    owner !== layout.indexOf(1) ||
    features.lightKindMask !==
      layout.reduce<number>((value, kind) => value | (1 << kind), 0) ||
    features.shadowMap !== true ||
    features.cascadedShadowMap === true ||
    features.pointShadowMap === true ||
    features.directionalPointShadowMap === true ||
    features.spotShadowMap === true ||
    features.clusteredLocalLights === true ||
    features.clusteredLocalLightCookies === true ||
    features.clusteredLocalLightShadowCookies === true ||
    features.clusteredLocalLightArrayCookies === true ||
    features.clusteredLocalLightCubeCookies === true ||
    features.clusteredLocalLightArrayShadows === true ||
    features.clusteredLocalLightPointArrayShadows === true
  )
    return code;
  // The ordinary tuple admits only ambient/directional, so the established
  // first-spot fallback is absent. Unsupported spot/mixed routes keep the scan.
  const start = code.indexOf("fn singleShadowLightIndex(");
  if (start < 0) return code;
  const opening = code.indexOf("{", start);
  const end = blockEnd(code, opening);
  const selected =
    owner < 0
      ? ""
      : `\n  if (${owner}u < lightCount()) {\n    return ${owner}u;\n  }`;
  // Preserve the precise established no-owner result: lightCount(), not a
  // fabricated sentinel. A shorter metadata buffer keeps the same fallback.
  return (
    code.slice(0, opening + 1) +
    selected +
    "\n  return lightCount();\n}" +
    code.slice(end)
  );
}

function removeFunction(code: string, name: string): string {
  const index = code.indexOf(`fn ${name}(`);
  if (index < 0) return code;
  const opening = code.indexOf("{", index);
  return code.slice(0, index) + code.slice(blockEnd(code, opening));
}

/** Built-in function/branch bodies can contain line and nested block comments. */
function blockEnd(code: string, opening: number): number {
  let depth = 0;
  let blockCommentDepth = 0;
  let lineComment = false;
  for (let index = opening; index < code.length; index++) {
    const current = code[index],
      next = code[index + 1];
    if (lineComment) {
      if (current === "\n") lineComment = false;
      continue;
    }
    if (blockCommentDepth > 0) {
      if (current === "/" && next === "*") {
        blockCommentDepth++;
        index++;
      } else if (current === "*" && next === "/") {
        blockCommentDepth--;
        index++;
      }
      continue;
    }
    if (current === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }
    if (current === "/" && next === "*") {
      blockCommentDepth++;
      index++;
      continue;
    }
    if (current === "{") depth++;
    else if (current === "}" && --depth === 0) return index + 1;
  }
  throw new Error("Generated standard WGSL block is incomplete");
}
