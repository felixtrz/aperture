import {defineApertureConfig} from '@aperture-engine/app/config';
export default defineApertureConfig({
 mode:'browser',canvas:'#aperture',systems:[],
 render:{cadence:'manual',defaultCamera:false,defaultLight:false,defaultEnvironment:true,pixelRatio:1,maxPixelRatio:1,sampleCount:4,tonemap:'aces',exposure:1,geometryInspection:{maxRetainedBytes:64*1024*1024},ssao:{radiusPixels:4,intensity:0.65,power:1.3,sampleCount:8}},
 diagnostics:{level:'warn'}
});
