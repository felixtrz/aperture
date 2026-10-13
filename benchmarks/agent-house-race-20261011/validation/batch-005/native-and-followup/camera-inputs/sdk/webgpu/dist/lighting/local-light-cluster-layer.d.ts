import type { LightPacket } from "@aperture-engine/render";
export declare function normalizeLayerMask(layerMask: number | undefined): number | null;
export declare function lightMatchesLayer(light: Pick<LightPacket, "layerMask">, layerMask: number | null): boolean;
//# sourceMappingURL=local-light-cluster-layer.d.ts.map