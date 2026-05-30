import type { AssetRegistry, Entity } from "@aperture-engine/simulation";
import {
  LightCookie,
  LightShadowSettings,
  type LightCookieInput,
  type LightShadowSettingsInput,
  validateLightCookieInput,
  validateLightShadowSettingsInput,
} from "./index.js";
import {
  createStableRenderId,
  type LightPacket,
  type RenderDiagnostic,
  type ShadowRequestPacket,
} from "./snapshot.js";
import {
  validateSamplerAssetState,
  validateTextureAssetState,
} from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { parseSamplerHandle, parseTextureHandle } from "./extraction-inputs.js";

export function requiresLightTransform(kind: LightPacket["kind"]): boolean {
  return kind !== "ambient" && kind !== "environment";
}

export function readShadowSettings(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): LightShadowSettingsInput | null {
  if (!entity.hasComponent(LightShadowSettings)) {
    return null;
  }

  const settings: LightShadowSettingsInput = {
    enabled: entity.getValue(LightShadowSettings, "enabled") ?? false,
    mapSize: entity.getValue(LightShadowSettings, "mapSize") ?? 1024,
    bias: entity.getValue(LightShadowSettings, "bias") ?? 0,
    normalBias: entity.getValue(LightShadowSettings, "normalBias") ?? 0,
    cascadeCount: entity.getValue(LightShadowSettings, "cascadeCount") ?? 1,
    casterLayerMask:
      entity.getValue(LightShadowSettings, "casterLayerMask") ?? -1,
    receiverLayerMask:
      entity.getValue(LightShadowSettings, "receiverLayerMask") ?? -1,
    shadowType: entity.getValue(LightShadowSettings, "shadowType") ?? 1,
    strength: entity.getValue(LightShadowSettings, "strength") ?? 1,
    filterRadius: entity.getValue(LightShadowSettings, "filterRadius") ?? 1,
    slopeBias: entity.getValue(LightShadowSettings, "slopeBias") ?? 0,
  };
  const validation = validateLightShadowSettingsInput(settings);

  if (!validation.valid) {
    for (const shadowDiagnostic of validation.diagnostics) {
      diagnostics.push(diagnostic(`render.${shadowDiagnostic.code}`, entity));
    }
    return null;
  }

  return settings;
}

export function readLightCookie(
  entity: Entity,
  assets: AssetRegistry,
  kind: LightPacket["kind"],
  diagnostics: RenderDiagnostic[],
): LightCookieInput | null {
  if (!entity.hasComponent(LightCookie)) {
    return null;
  }

  if (kind !== "point" && kind !== "spot") {
    diagnostics.push(
      diagnostic(`render.lightCookieUnsupportedKind.${kind}`, entity),
    );
    return null;
  }

  const texture = parseTextureHandle(
    entity.getValue(LightCookie, "textureId") ?? "",
  );
  const samplerId = entity.getValue(LightCookie, "samplerId") ?? "";
  const sampler = samplerId.length === 0 ? null : parseSamplerHandle(samplerId);
  const intensity = entity.getValue(LightCookie, "intensity") ?? 1;

  if (texture === null) {
    diagnostics.push(diagnostic("render.lightCookie.missingTexture", entity));
    return null;
  }

  const input: LightCookieInput = {
    texture,
    sampler,
    intensity,
  };
  const validation = validateLightCookieInput(input);

  if (!validation.valid) {
    for (const cookieDiagnostic of validation.diagnostics) {
      diagnostics.push(diagnostic(`render.${cookieDiagnostic.code}`, entity));
    }
    return null;
  }

  if (!validateTextureAssetState(texture, assets, entity, diagnostics)) {
    return null;
  }

  if (
    sampler !== null &&
    !validateSamplerAssetState(sampler, assets, entity, diagnostics)
  ) {
    return null;
  }

  return input;
}

export function appendShadowRequest(
  entity: Entity,
  kind: LightPacket["kind"],
  settings: LightShadowSettingsInput | null,
  shadowRequests: ShadowRequestPacket[],
  diagnostics: RenderDiagnostic[],
): void {
  if (settings?.enabled !== true) {
    return;
  }

  if (kind !== "directional" && kind !== "point" && kind !== "spot") {
    diagnoseUnsupportedShadowRequest(entity, kind, settings, diagnostics);
    return;
  }

  const lightId = createStableRenderId(entityRef(entity));
  // Only attach authored shadow params when they differ from the renderer
  // defaults, so default-authored lights keep the prior minimal packet shape
  // (and round-trip identically through the packed worker codec).
  const shadowType = settings.shadowType ?? 1;
  const strength = settings.strength ?? 1;
  const filterRadius = settings.filterRadius ?? 1;
  const slopeBias = settings.slopeBias ?? 0;

  shadowRequests.push({
    shadowId: lightId,
    lightId,
    lightKind: kind,
    ...(kind === "directional"
      ? { cascadeCount: settings.cascadeCount ?? 1 }
      : {}),
    casterLayerMask: settings.casterLayerMask ?? -1,
    receiverLayerMask: settings.receiverLayerMask ?? -1,
    ...(shadowType === 1 ? {} : { shadowType }),
    ...(strength === 1 ? {} : { strength }),
    ...(filterRadius === 1 ? {} : { filterRadius }),
    ...(slopeBias === 0 ? {} : { slopeBias }),
  });
}

export function diagnoseUnsupportedShadowRequest(
  entity: Entity,
  kind: LightPacket["kind"],
  settings: LightShadowSettingsInput | null,
  diagnostics: RenderDiagnostic[],
): void {
  if (settings?.enabled === true) {
    diagnostics.push(
      diagnostic(`render.shadowUnsupportedLightKind.${kind}`, entity),
    );
  }
}
