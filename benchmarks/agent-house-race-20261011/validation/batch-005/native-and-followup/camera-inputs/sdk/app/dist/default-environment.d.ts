import type { ApertureConfig } from "./config.js";
import type { ApertureSystemContext } from "./systems/context.js";
/** Visible sky gradient (linear RGB): soft blue → pale horizon → warm ground. */
export declare const DEFAULT_ENVIRONMENT_SKY_COLORS: {
    readonly top: readonly [0.2423, 0.6172, 0.8308];
    readonly horizon: readonly [0.6584, 0.7084, 0.7913];
    readonly bottom: readonly [0.807, 0.7758, 0.7454];
};
/** Illumination gradient (linear RGB): brighter sky term tuned for lighting. */
export declare const DEFAULT_ENVIRONMENT_IBL_COLORS: {
    readonly top: readonly [0.6902, 0.749, 0.7843];
    readonly horizon: readonly [0.6584, 0.7084, 0.7913];
    readonly bottom: readonly [0.807, 0.7758, 0.7454];
};
/**
 * Scale applied to the illumination gradient before it feeds the irradiance
 * convolution. The convolution stores irradiance/π, so an unscaled ~0.75
 * gradient would contribute ~0.75 × albedo of ambient diffuse — tuned for an
 * IBL-only rig. The default environment is designed to sit UNDER a directional
 * sun (the template/showcase recipe), so it targets the ~0.35–0.45 ambient
 * fill the showcases were tuned around while keeping the sky's tint.
 */
export declare const DEFAULT_ENVIRONMENT_IBL_INTENSITY = 0.55;
export declare const DEFAULT_ENVIRONMENT_ASSET_ID = "environment.default";
export declare const DEFAULT_ENVIRONMENT_SKY_KEY = "sky.default";
export declare const DEFAULT_ENVIRONMENT_LIGHT_KEY = "light.environment.default";
export declare const DEFAULT_ENVIRONMENT_SUN_KEY = "light.sun.default";
/**
 * Illuminance of the soft default sun added when the app authors no analytic
 * lights at all. Matches the showcase/template tuning (the city-builder sun)
 * so a zero-config scene reads directional without washing out under ACES.
 */
export declare const DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE = 2.2;
export interface InstallDefaultEnvironmentOptions {
    readonly config: ApertureConfig;
    readonly context: ApertureSystemContext;
    readonly world: {
        readonly queryManager: {
            registerQuery(config: {
                readonly required: readonly unknown[];
            }): {
                readonly entities: Iterable<unknown>;
            };
        };
    };
}
export declare function installDefaultEnvironment(options: InstallDefaultEnvironmentOptions): boolean;
/**
 * Synthesize the LDR equirect gradient feeding the IBL chain. The projection
 * convention puts the north pole at v=1 (see
 * equirect-to-cube-compute-pipeline.ts), so row 0 is the ground and the last
 * row is the sky.
 */
export declare function defaultEnvironmentEquirectRgba8(width: number, height: number): Uint8Array;
//# sourceMappingURL=default-environment.d.ts.map