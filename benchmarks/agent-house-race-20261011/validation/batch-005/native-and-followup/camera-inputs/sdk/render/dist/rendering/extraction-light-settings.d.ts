import type { AssetRegistry, Entity } from "@aperture-engine/simulation";
import { type LightCookieInput, type LightShadowSettingsInput } from "./index.js";
import { type LightPacket, type RenderDiagnostic, type ShadowRequestPacket } from "./snapshot.js";
export declare function requiresLightTransform(kind: LightPacket["kind"]): boolean;
export declare function readShadowSettings(entity: Entity, diagnostics: RenderDiagnostic[]): LightShadowSettingsInput | null;
export declare function readLightCookie(entity: Entity, assets: AssetRegistry, kind: LightPacket["kind"], diagnostics: RenderDiagnostic[]): LightCookieInput | null;
export declare function appendShadowRequest(entity: Entity, kind: LightPacket["kind"], settings: LightShadowSettingsInput | null, shadowRequests: ShadowRequestPacket[], diagnostics: RenderDiagnostic[]): void;
export declare function diagnoseUnsupportedShadowRequest(entity: Entity, kind: LightPacket["kind"], settings: LightShadowSettingsInput | null, diagnostics: RenderDiagnostic[]): void;
//# sourceMappingURL=extraction-light-settings.d.ts.map