import {
  identityMat4,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  WorldTransform,
} from "@aperture-engine/simulation";
import {
  Light,
  LightCookie,
  LightShadowSettings,
  type LightCookieInput,
  type LightShadowSettingsInput,
  validateLightCookieInput,
  validateLightInput,
  validateLightShadowSettingsInput,
} from "./index.js";
import {
  createStableRenderId,
  type EnvironmentPacket,
  type LightPacket,
  type RenderDiagnostic,
  type ShadowRequestPacket,
} from "./snapshot.js";
import {
  validateEnvironmentMapAssetState,
  validateSamplerAssetState,
  validateTextureAssetState,
} from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import {
  lightInput,
  parseSamplerHandle,
  parseTextureHandle,
  readEnvironmentMapHandle,
} from "./extraction-inputs.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";

export function extractLights(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  diagnostics: RenderDiagnostic[],
  environments: EnvironmentPacket[],
  shadowRequests: ShadowRequestPacket[],
): LightPacket[] {
  const query = world.queryManager.registerQuery({
    required: [Light],
  });
  const lights: LightPacket[] = [];

  for (const entity of sortedEntities(query.entities)) {
    const validation = validateLightInput(lightInput(entity));

    if (!validation.valid) {
      for (const lightDiagnostic of validation.diagnostics) {
        diagnostics.push(diagnostic(`render.${lightDiagnostic.code}`, entity));
      }
      continue;
    }

    const kind = (entity.getValue(Light, "kind") ??
      "directional") as LightPacket["kind"];
    const shadowSettings = readShadowSettings(entity, diagnostics);
    const cookie = readLightCookie(entity, assets, kind, diagnostics);

    if (kind === "environment") {
      diagnoseUnsupportedShadowRequest(
        entity,
        kind,
        shadowSettings,
        diagnostics,
      );
      const handle = readEnvironmentMapHandle(entity, diagnostics);

      if (
        handle === undefined ||
        (handle !== null &&
          !validateEnvironmentMapAssetState(
            handle,
            assets,
            entity,
            diagnostics,
          ))
      ) {
        continue;
      }

      environments.push({
        environmentId: createStableRenderId(entityRef(entity)),
        handle,
        color: Array.from(entity.getVectorView(Light, "color")) as [
          number,
          number,
          number,
          number,
        ],
        intensity: entity.getValue(Light, "intensity") ?? 1,
        layerMask: entity.getValue(Light, "layerMask") ?? 1,
      });
      continue;
    }

    const hasWorldTransform = entity.hasComponent(WorldTransform);

    if (!hasWorldTransform && requiresLightTransform(kind)) {
      diagnostics.push(diagnostic("render.lightMissingTransform", entity));
      continue;
    }

    const worldTransformOffset = pushMatrix(
      transforms,
      hasWorldTransform ? readWorldMatrix(entity) : identityMat4(),
    );

    lights.push({
      lightId: createStableRenderId(entityRef(entity)),
      entity: entityRef(entity),
      kind,
      shape: (entity.getValue(Light, "shape") ?? "rect") as
        | "rect"
        | "disk"
        | "sphere",
      color: Array.from(entity.getVectorView(Light, "color")) as [
        number,
        number,
        number,
        number,
      ],
      intensity: entity.getValue(Light, "intensity") ?? 1,
      range: entity.getValue(Light, "range") ?? 10,
      innerConeAngle: entity.getValue(Light, "innerConeAngle") ?? Math.PI / 8,
      outerConeAngle: entity.getValue(Light, "outerConeAngle") ?? Math.PI / 6,
      width: entity.getValue(Light, "width") ?? 2,
      height: entity.getValue(Light, "height") ?? 2,
      ...(cookie === null
        ? {}
        : {
            cookieTexture: cookie.texture,
            cookieSampler: cookie.sampler,
            cookieIntensity: cookie.intensity,
          }),
      worldTransformOffset,
      layerMask: entity.getValue(Light, "layerMask") ?? 1,
    });

    appendShadowRequest(
      entity,
      kind,
      shadowSettings,
      shadowRequests,
      diagnostics,
    );
  }

  return lights;
}

function requiresLightTransform(kind: LightPacket["kind"]): boolean {
  return kind !== "ambient" && kind !== "environment";
}

function readShadowSettings(
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

function readLightCookie(
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

function appendShadowRequest(
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

  shadowRequests.push({
    shadowId: lightId,
    lightId,
    lightKind: kind,
    ...(kind === "directional"
      ? { cascadeCount: settings.cascadeCount ?? 1 }
      : {}),
    casterLayerMask: settings.casterLayerMask ?? -1,
    receiverLayerMask: settings.receiverLayerMask ?? -1,
  });
}

function diagnoseUnsupportedShadowRequest(
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
