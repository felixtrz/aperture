import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
 mode:"browser",canvas:"#aperture",systems:["src/systems/**/*.system.ts"],
 render:{cadence:"manual",tonemap:"aces",exposure:1,sampleCount:4,pixelRatio:1,maxPixelRatio:1,
 defaultCamera:false,defaultLight:false,defaultEnvironment:true,
 clearColor:[0.55,0.68,0.8,1],geometryInspection:{maxRetainedBytes:64*1024*1024},
 ssao:{radiusPixels:5,intensity:0.55,power:1.1,sampleCount:8}},
 diagnostics:{level:"warn"}
});
