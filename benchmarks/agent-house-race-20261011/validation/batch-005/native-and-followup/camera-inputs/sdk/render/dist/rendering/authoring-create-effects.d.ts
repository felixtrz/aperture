import { type ComponentInitialData } from "@aperture-engine/simulation";
import { type FogInput, type ProceduralSkyInput, type RuntimeUniformInput, type SkyboxInput, type SpriteInput } from "./authoring-types.js";
import type { Fog, ProceduralSky, RuntimeUniform, Skybox, Sprite } from "./authoring-components.js";
export declare function createSprite(input: SpriteInput): ComponentInitialData<typeof Sprite>;
export declare function createSkybox(input: SkyboxInput): ComponentInitialData<typeof Skybox>;
export declare function createProceduralSky(input?: ProceduralSkyInput): ComponentInitialData<typeof ProceduralSky>;
export declare function createRuntimeUniform(input: RuntimeUniformInput): ComponentInitialData<typeof RuntimeUniform>;
export declare function createFog(input?: FogInput): ComponentInitialData<typeof Fog>;
//# sourceMappingURL=authoring-create-effects.d.ts.map