import type { RenderSnapshot } from "@aperture-engine/render";
import { packedLightKindId } from "../../lighting/light-packing.js";
import {
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
} from "../../lighting/local-light-cluster-constants.js";
import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";

const LIGHT_TOKEN_PREFIX = "standard-light-mask-";
const FILTER_TOKEN_PREFIX = "standard-directional-filter-";
const LAYOUT_TOKEN_PREFIX = "standard-light-layout-";
const OWNER_TOKEN_PREFIX = "standard-single-shadow-owner-";
const SMALL_UNIFORM_TOKEN = "standard-small-light-uniforms-v1";
const CLUSTERED_FEATURE_TOKENS = [
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
] as const;

function hasClusteredLightingFeature(tokens: readonly string[]): boolean {
  return CLUSTERED_FEATURE_TOKENS.some((feature) => tokens.includes(feature));
}

export interface StandardLightingSpecializationOptions {
  readonly lightClasses?: boolean;
  /** Opt-in derived ordered layout, capped at eight ambient/directional lights. */
  readonly knownLightLayout?: boolean;
  /** Diagnostic opt-in; derives single-map first owner from the exact known tuple. */
  readonly knownShadowOwner?: boolean;
  readonly directionalFilter?: boolean;
  readonly smallLightUniforms?: boolean;
}

/** Derived renderer state only; never updates ECS or the caller's snapshot. */
export function withStandardLightingSpecializationPipelineKeys(
  snapshot: RenderSnapshot,
  options: StandardLightingSpecializationOptions = {},
): RenderSnapshot {
  let mask = 0;
  let supported = true;
  for (const light of snapshot.lights) {
    const kind = packedLightKindId(light.kind);
    if (!Number.isInteger(kind) || kind < 0 || kind > 5) {
      supported = false;
      break;
    }
    mask |= 1 << kind;
  }
  const filter =
    options.directionalFilter === false
      ? undefined
      : fixedDirectionalFilter(snapshot);
  const tokens = [
    ...(options.lightClasses !== false && supported && (mask & 47) !== 0
      ? [`${LIGHT_TOKEN_PREFIX}${mask}`]
      : []),
    ...(filter === undefined ? [] : [`${FILTER_TOKEN_PREFIX}${filter}`]),
  ];
  // The packer writes every light in this exact order; never sort/filter here.
  const layout =
    options.knownLightLayout === true && options.lightClasses !== false
      ? knownLayout(
          snapshot.lights.map((light) => packedLightKindId(light.kind)),
        )
      : undefined;
  const layoutToken =
    layout === undefined
      ? undefined
      : `${LAYOUT_TOKEN_PREFIX}${layout.length}-${layout.join("_")}`;
  const owner =
    options.knownShadowOwner === true ? layout?.indexOf(1) : undefined;
  const ownerToken =
    owner === undefined
      ? undefined
      : `${OWNER_TOKEN_PREFIX}${owner < 0 ? "none" : owner}`;
  let changed = false;
  const meshDraws = snapshot.meshDraws.map((draw) => {
    const sourceKey = draw.batchKey.pipelineKey;
    if (sourceKey !== "standard" && !sourceKey.startsWith("standard|"))
      return draw;
    if (
      sourceKey === "standard" &&
      tokens.length === 0 &&
      layoutToken === undefined
    )
      return draw;
    // Re-derive on every snapshot, including snapshots previously processed by
    // this helper. Adding/removing a light class or changing the filter changes
    // the ordinary pipeline cache key; numeric light updates keep the key.
    // A bare standard key means the default opaque render state. Spell out
    // that state before adding internal feature tokens so trailing-state
    // parsers do not mistake a feature for alpha/cull/depth/blend settings.
    const sourceParts =
      sourceKey === "standard"
        ? ["standard", "opaque", "back", "less", "none"]
        : sourceKey.split("|");
    const rest = sourceParts
      .slice(1)
      .filter(
        (token) =>
          !token.startsWith(LIGHT_TOKEN_PREFIX) &&
          !token.startsWith(FILTER_TOKEN_PREFIX) &&
          !token.startsWith(LAYOUT_TOKEN_PREFIX) &&
          !token.startsWith(OWNER_TOKEN_PREFIX) &&
          token !== SMALL_UNIFORM_TOKEN,
      );
    // Cluster composition has its own light/shadow/resource reachability.
    // Keep the complete dynamic contract for every decoded cluster/cookie flag.
    const clustered = hasClusteredLightingFeature(rest);
    const activeTokens = clustered
      ? []
      : draw.receivesShadow === false
        ? tokens.filter((token) => !token.startsWith(FILTER_TOKEN_PREFIX))
        : tokens;
    const activeLayout =
      layoutToken !== undefined && !clustered ? [layoutToken] : [];
    const activeOwner =
      ownerToken !== undefined &&
      activeLayout.length !== 0 &&
      !clustered &&
      draw.receivesShadow !== false &&
      rest.includes("shadowMap") &&
      !rest.some(
        (token) =>
          token === "cascadedShadowMap" ||
          token === "pointShadowMap" ||
          token === "directionalPointShadowMap" ||
          token === "spotShadowMap" ||
          token.startsWith("clusteredLocalLight"),
      )
        ? [ownerToken]
        : [];
    const smallUniform =
      options.smallLightUniforms === true &&
      layout?.length === 2 &&
      layout[0] !== layout[1] &&
      activeOwner.length === 1 &&
      filter === 1 &&
      rest.includes("opaque") &&
      !rest.some((token) =>
        /^(?:ibl|clearcoat|transmission|sheen|iridescence|skin|morph)/u.test(
          token,
        ),
      );
    const pipelineKey = [
      "standard",
      ...activeTokens,
      ...activeLayout,
      ...activeOwner,
      ...(smallUniform ? [SMALL_UNIFORM_TOKEN] : []),
      ...rest,
    ].join("|");
    if (pipelineKey === draw.batchKey.pipelineKey) return draw;
    changed = true;
    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey },
    };
  });
  return changed ? { ...snapshot, meshDraws } : snapshot;
}

function fixedDirectionalFilter(
  snapshot: RenderSnapshot,
): 0 | 1 | 2 | undefined {
  // Preserve the dynamic fallback for cascades, spots, arrays, mixed shadow
  // resources and ambiguous ownership. The single-map resolver chooses the
  // first directional light; only specialize when it is the sole owner.
  const [request] = snapshot.shadowRequests;
  const directional = snapshot.lights.filter(
    (light) => light.kind === "directional",
  );
  if (
    snapshot.shadowRequests.length !== 1 ||
    request === undefined ||
    (request.lightKind ?? "directional") !== "directional" ||
    (request.cascadeCount ?? 1) !== 1 ||
    directional.length !== 1 ||
    directional[0]?.lightId !== request.lightId
  )
    return undefined;
  const value = request.shadowType ?? 1;
  if (!Number.isFinite(value)) return undefined;
  return Math.min(2, Math.max(0, Math.round(value))) as 0 | 1 | 2;
}

export function readStandardLightingSpecializationFeatures(
  tokens: readonly string[],
): Pick<
  StandardTextureShaderFeatures,
  | "lightKindMask"
  | "fixedDirectionalShadowFilter"
  | "knownLightKindLayout"
  | "fixedSingleShadowLightIndex"
  | "smallLightUniforms"
> {
  // Ignore stale specialization hints even for callers bypassing the helper.
  if (hasClusteredLightingFeature(tokens)) return {};
  const masks = tokens.filter((token) =>
    /^standard-light-mask-\d+$/u.test(token),
  );
  const filters = tokens.filter((token) =>
    /^standard-directional-filter-[012]$/u.test(token),
  );
  const mask =
    masks.length === 1
      ? Number(masks[0]!.slice(LIGHT_TOKEN_PREFIX.length))
      : undefined;
  const filter =
    filters.length === 1
      ? Number(filters[0]!.slice(FILTER_TOKEN_PREFIX.length))
      : undefined;
  // Prefix counts, not only regex matches, make duplicate/malformed tokens
  // conservative. A count is part of the canonical key and must match the tuple.
  const layouts = tokens.filter((token) =>
    token.startsWith(LAYOUT_TOKEN_PREFIX),
  );
  const match =
    layouts.length === 1
      ? /^standard-light-layout-([1-8])-([01](?:_[01])*)$/u.exec(layouts[0]!)
      : null;
  const layout =
    match !== null && !tokens.includes(CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE)
      ? knownLayout(match[2]!.split("_").map(Number))
      : undefined;
  const layoutMask = layout?.reduce<number>(
    (value, kind) => value | (1 << kind),
    0,
  );
  const matchingLayout =
    layout !== undefined &&
    layout.length === Number(match?.[1]) &&
    mask !== undefined &&
    mask === layoutMask
      ? layout
      : undefined;
  const owners = tokens.filter((token) => token.startsWith(OWNER_TOKEN_PREFIX));
  const ownerMatch =
    owners.length === 1
      ? /^standard-single-shadow-owner-(none|[0-7])$/u.exec(owners[0]!)
      : null;
  const owner =
    ownerMatch === null
      ? undefined
      : ownerMatch[1] === "none"
        ? -1
        : Number(ownerMatch[1]);
  const singleMapRoute =
    tokens.includes("shadowMap") &&
    !tokens.some(
      (token) =>
        token === "cascadedShadowMap" ||
        token === "pointShadowMap" ||
        token === "directionalPointShadowMap" ||
        token === "spotShadowMap" ||
        token.startsWith("clusteredLocalLight"),
    );
  const matchingOwner =
    singleMapRoute &&
    matchingLayout !== undefined &&
    owner === matchingLayout.indexOf(1)
      ? owner
      : undefined;
  return {
    ...(tokens.filter((token) => token === SMALL_UNIFORM_TOKEN).length === 1 &&
    matchingLayout?.length === 2 &&
    matchingLayout[0] !== matchingLayout[1] &&
    matchingOwner !== undefined &&
    filter === 1
      ? { smallLightUniforms: "sun-ambient-v1" as const }
      : {}),
    ...(matchingOwner === undefined
      ? {}
      : { fixedSingleShadowLightIndex: matchingOwner }),
    ...(matchingLayout === undefined
      ? {}
      : { knownLightKindLayout: matchingLayout }),
    ...(mask !== undefined &&
    Number.isSafeInteger(mask) &&
    mask >= 0 &&
    mask <= 63
      ? { lightKindMask: mask }
      : {}),
    ...(filter === undefined
      ? {}
      : { fixedDirectionalShadowFilter: filter as 0 | 1 | 2 }),
  };
}

/** No inferred mask means complete standalone light bindings remain available. */
export function standardShaderUsesAreaLightLtc(pipelineKey: string): boolean {
  const { lightKindMask } = readStandardLightingSpecializationFeatures(
    pipelineKey.split("|"),
  );
  return (
    lightKindMask === undefined ||
    (lightKindMask & 47) === 0 ||
    (lightKindMask & 32) !== 0
  );
}

function knownLayout(kinds: readonly number[]): readonly (0 | 1)[] | undefined {
  if (
    kinds.length === 0 ||
    kinds.length > 8 ||
    !kinds.every((kind) => kind === 0 || kind === 1) ||
    !kinds.some((kind) => kind === 0 || kind === 1)
  )
    return undefined;
  // At least one evaluated term retains a meaningful runtime metadata count
  // guard, including no-shadow materials using the auto bind-group layout.
  return kinds as readonly (0 | 1)[];
}
