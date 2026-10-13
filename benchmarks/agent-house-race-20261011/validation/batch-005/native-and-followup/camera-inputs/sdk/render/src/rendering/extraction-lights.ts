import {
  identityMat4,
  type AssetRegistry,
  type EcsWorld,
  WorldTransform,
} from "@aperture-engine/simulation";
import { Light, validateLightInput } from "./index.js";
import {
  createStableRenderId,
  type EnvironmentPacket,
  type LightPacket,
  type RenderDiagnostic,
  type ShadowRequestPacket,
} from "./snapshot.js";
import { validateEnvironmentMapAssetState } from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import {
  appendShadowRequest,
  diagnoseUnsupportedShadowRequest,
  readLightCookie,
  readShadowSettings,
  requiresLightTransform,
} from "./extraction-light-settings.js";
import { lightInput, readEnvironmentMapHandle } from "./extraction-inputs.js";
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
