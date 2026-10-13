import { type ComponentInitialData } from "@aperture-engine/simulation";
import { type CameraInput, type LightCookieInput, type LightInput, type LightShadowSettingsInput } from "./authoring-types.js";
import type { Camera, Light, LightCookie, LightShadowSettings } from "./authoring-components.js";
export declare function createCamera(input?: CameraInput): ComponentInitialData<typeof Camera>;
export declare function createLight(input?: LightInput): ComponentInitialData<typeof Light>;
export declare function createLightCookie(input: LightCookieInput): ComponentInitialData<typeof LightCookie>;
export declare function createLightShadowSettings(input?: LightShadowSettingsInput): ComponentInitialData<typeof LightShadowSettings>;
//# sourceMappingURL=authoring-create-camera-light.d.ts.map