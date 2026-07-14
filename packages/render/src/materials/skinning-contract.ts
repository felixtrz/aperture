// F3 (three.js parity plan): the opt-in skinning bind contract for custom WGSL
// materials. When a `CustomWgslMaterialAsset` declares `skinned: true`, the
// renderer binds the existing joint palette at `@group(1) @binding(1)` (an
// extra binding in the renderer-owned world-transforms group) plus the
// `JOINTS_0`/`WEIGHTS_0` vertex attributes, and prepends
// `APERTURE_SKINNED_WGSL_HEADER` to the user's WGSL module, so a custom vertex
// entry point calls `apertureSkin(position, normal, joints0, weights0)` to get
// the skinned position + normal without any app-side GPU wiring. See
// docs/AUTHORING.md ("Skinned custom materials") for the contract + versioning.
//
// This mirrors the A1 lit contract (materials/lit-contract.ts): a versioned,
// renderer-prepended WGSL header, a reserved binding that participates in the
// pipeline key ONLY when declared (so non-skinned custom materials keep
// byte-identical keys + layouts), and validation that user code does not
// redeclare the reserved binding or `aperture*` skinning symbols.
//
// Group map (custom WGSL pipelines):
//   group(0) view uniform · group(1) world transforms (@binding 0) + the F3
//   joint palette (@binding 1) · group(2) material bindings · group(3) A1 lit
//   contract.
// The palette rides an extra BINDING inside the existing transforms group
// (@group(1) @binding(1)) rather than a new bind GROUP, because the default
// `maxBindGroups` limit is 4 (indices 0-3) and group(3) is already the A1 lit
// contract — a group(4) would exceed the limit. group(1) @binding(1) is exactly
// where the StandardMaterial skinned path binds `skinJointMatrices`, and it does
// not collide with A1's group(3), so a material can be `skinned` AND
// `lighting: "lit"` at once.
//
// The skinning matrix math (apertureSkinMatrix / apertureSkinPosition /
// apertureSkinDirection) is byte-for-byte the StandardMaterial WGSL
// (packages/webgpu standard-skinning-shader STANDARD_SKINNING_WGSL), rebound
// from the standard `skinJointMatrices` to the custom contract's
// `apertureSkinJointMatrices` (same group(1) binding(1)). The joint palette is
// the SAME renderer-owned buffer the standard skinned path binds (snapshot
// bones -> skinning-joint-buffer). Morph deltas are NOT part of the v1 skinning
// contract (see the deferral note in the header).

/**
 * Version of the group(1) binding(1) skinning contract. Participates in every
 * skinned pipeline key (as `skinned:v<N>`), so a future layout change can never
 * collide with cached pipelines built against an older contract (mirrors the
 * lit contract version).
 */
export const APERTURE_SKINNED_CONTRACT_VERSION = 1;

/** Pipeline-key segment/feature that marks a skinned custom-WGSL pipeline. */
export const APERTURE_SKINNED_PIPELINE_FEATURE = `skinned:v${APERTURE_SKINNED_CONTRACT_VERSION}`;

/**
 * The reserved renderer bind group (the world-transforms group) and the binding
 * INSIDE it that the skinning contract adds for the joint palette. The palette
 * is `@group(1) @binding(1)` — the StandardMaterial skinned convention.
 */
export const APERTURE_SKINNED_BIND_GROUP = 1;
export const APERTURE_SKINNED_BINDING = 1;

/**
 * Vertex-attribute `@location`s the skinning contract reserves for the joint
 * indices (`JOINTS_0`, `vec4u`) and blend weights (`WEIGHTS_0`, `vec4f`). These
 * match the StandardMaterial skinned vertex layout
 * (STANDARD_SKINNING_JOINTS_LOCATION / STANDARD_SKINNING_WEIGHTS_LOCATION), so
 * the renderer's skinned vertex-buffer layout is identical to the standard
 * path's (pinned by test/materials/custom-wgsl-skinning-contract.test.ts).
 */
export const APERTURE_SKINNED_JOINTS_LOCATION = 8;
export const APERTURE_SKINNED_WEIGHTS_LOCATION = 9;

/**
 * The `aperture*` symbols the skinning header declares. A skinned custom
 * material must NOT redeclare any of them (they would be WGSL duplicate
 * definitions); {@link wgslSourceDeclaresSkinnedReservedSymbol} reports the
 * first offending declaration for a structured diagnostic.
 */
export const APERTURE_SKINNED_RESERVED_SYMBOLS = [
  "apertureSkinJointMatrices",
  "apertureSkinIdentityMatrix",
  "apertureSkinMatrix",
  "apertureSkinPosition",
  "apertureSkinDirection",
  "apertureSkin",
  "ApertureSkinnedVertex",
] as const;

/**
 * True when the WGSL source declares the renderer-reserved skinning binding
 * `@group(1) @binding(1)`. Skinned custom materials must NOT declare it — the
 * renderer owns it (the joint palette) and prepends the contract header. A user
 * `@group(1) @binding(0)` (world transforms) is expected and is NOT flagged.
 */
export function wgslSourceDeclaresSkinnedBindGroup(code: string): boolean {
  return /@group\s*\(\s*1\s*\)\s*@binding\s*\(\s*1\s*\)/u.test(code);
}

/**
 * The first reserved skinning symbol the WGSL source redeclares (a `fn`/`struct`
 * definition or a `var` binding of the reserved buffer), or `null` if none.
 * Distinguishes a redeclaration (`fn apertureSkin(...) { ... }`,
 * `struct ApertureSkinnedVertex { ... }`, `var<storage> apertureSkinJointMatrices`)
 * from a legitimate CALL of the helper (`apertureSkin(position, normal, ...)`),
 * which the contract expects.
 */
export function wgslSourceDeclaresSkinnedReservedSymbol(
  code: string,
): string | null {
  const declarationPatterns: readonly {
    readonly symbol: string;
    readonly pattern: RegExp;
  }[] = [
    {
      symbol: "apertureSkinJointMatrices",
      pattern: /\bvar\s*(?:<[^>]*>)?\s*apertureSkinJointMatrices\b/u,
    },
    {
      symbol: "ApertureSkinnedVertex",
      pattern: /\bstruct\s+ApertureSkinnedVertex\b/u,
    },
    {
      symbol: "apertureSkinIdentityMatrix",
      pattern: /\bfn\s+apertureSkinIdentityMatrix\s*\(/u,
    },
    {
      symbol: "apertureSkinMatrix",
      pattern: /\bfn\s+apertureSkinMatrix\s*\(/u,
    },
    {
      symbol: "apertureSkinPosition",
      pattern: /\bfn\s+apertureSkinPosition\s*\(/u,
    },
    {
      symbol: "apertureSkinDirection",
      pattern: /\bfn\s+apertureSkinDirection\s*\(/u,
    },
    { symbol: "apertureSkin", pattern: /\bfn\s+apertureSkin\s*\(/u },
  ];

  for (const { symbol, pattern } of declarationPatterns) {
    if (pattern.test(code)) {
      return symbol;
    }
  }

  return null;
}

/**
 * The WGSL contract header prepended to a skinned material's module. All
 * declarations and helpers are `aperture`-prefixed; user code must not
 * redeclare `@group(1) @binding(1)` or any `aperture*` skinning symbol. The
 * vertex input struct still declares `@location(8) joints0: vec4u` and
 * `@location(9) weights0: vec4f` (the renderer owns the vertex-buffer LAYOUT +
 * the palette binding, not the attribute names) and passes them to the helpers.
 *
 * Math parity: apertureSkinMatrix / apertureSkinPosition / apertureSkinDirection
 * are byte-for-byte the StandardMaterial skinning WGSL (STANDARD_SKINNING_WGSL),
 * rebound to `apertureSkinJointMatrices` at group(1) binding(1).
 *
 * Deferral: morph-target deltas are NOT part of the v1 skinning contract. A
 * morphed custom material is a separate future opt-in; today, author morph via
 * a StandardMaterial or bake the deltas into a storage binding. See the F3
 * status block in docs/THREEJS_PARITY_PLAN.md.
 */
export const APERTURE_SKINNED_WGSL_HEADER = `// === aperture skinning custom-material contract v${APERTURE_SKINNED_CONTRACT_VERSION} (renderer-prepended) ===
// Reserved: @group(${APERTURE_SKINNED_BIND_GROUP}) @binding(${APERTURE_SKINNED_BINDING}) (joint palette) and vertex
// @location(${APERTURE_SKINNED_JOINTS_LOCATION})/@location(${APERTURE_SKINNED_WEIGHTS_LOCATION}) (JOINTS_0 vec4u / WEIGHTS_0 vec4f). Your @group(1) @binding(0)
// world-transforms declaration stays yours. Morph deltas are NOT exposed by this contract (see docs/AUTHORING.md).
@group(${APERTURE_SKINNED_BIND_GROUP}) @binding(${APERTURE_SKINNED_BINDING}) var<storage, read> apertureSkinJointMatrices: array<mat4x4f>;

fn apertureSkinIdentityMatrix() -> mat4x4f {
  return mat4x4f(
    vec4f(1.0, 0.0, 0.0, 0.0),
    vec4f(0.0, 1.0, 0.0, 0.0),
    vec4f(0.0, 0.0, 1.0, 0.0),
    vec4f(0.0, 0.0, 0.0, 1.0),
  );
}

// Blended joint matrix for one vertex (StandardMaterial parity: zero-weight
// vertices fall back to identity so an un-rigged vertex renders in bind pose).
fn apertureSkinMatrix(joints0: vec4u, weights0: vec4f) -> mat4x4f {
  let weightSum = dot(weights0, vec4f(1.0));

  if (weightSum <= 0.0001) {
    return apertureSkinIdentityMatrix();
  }

  let weights = weights0 / weightSum;
  return
    apertureSkinJointMatrices[joints0.x] * weights.x +
    apertureSkinJointMatrices[joints0.y] * weights.y +
    apertureSkinJointMatrices[joints0.z] * weights.z +
    apertureSkinJointMatrices[joints0.w] * weights.w;
}

fn apertureSkinPosition(position: vec3f, joints0: vec4u, weights0: vec4f) -> vec3f {
  return (apertureSkinMatrix(joints0, weights0) * vec4f(position, 1.0)).xyz;
}

fn apertureSkinDirection(direction: vec3f, joints0: vec4u, weights0: vec4f) -> vec3f {
  return (apertureSkinMatrix(joints0, weights0) * vec4f(direction, 0.0)).xyz;
}

struct ApertureSkinnedVertex {
  position: vec3f,
  normal: vec3f,
};

// Convenience: skin an object-space position + normal in one call. The normal
// is renormalized after the linear-blend transform (uniform-scale skeletons);
// for non-uniform scale, use apertureSkinDirection with the inverse-transpose.
fn apertureSkin(position: vec3f, normal: vec3f, joints0: vec4u, weights0: vec4f) -> ApertureSkinnedVertex {
  let skinMatrix = apertureSkinMatrix(joints0, weights0);
  var result: ApertureSkinnedVertex;
  result.position = (skinMatrix * vec4f(position, 1.0)).xyz;
  let skinnedNormal = (skinMatrix * vec4f(normal, 0.0)).xyz;
  let normalLength = length(skinnedNormal);
  result.normal = select(normal, skinnedNormal / normalLength, normalLength > 0.0001);
  return result;
}
// === end aperture skinning contract header ===
`;
