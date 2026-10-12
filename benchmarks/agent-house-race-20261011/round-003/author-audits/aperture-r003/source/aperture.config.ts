import { defineApertureConfig } from '@aperture-engine/app/config';
export default defineApertureConfig({
 mode:'browser', canvas:'#aperture', systems:['src/systems/*.system.ts'],
 render:{cadence:'manual',defaultCamera:false,defaultLight:false,tonemap:'aces',exposure:1,sampleCount:4,pixelRatio:1,maxPixelRatio:1,geometryInspection:{maxRetainedBytes:96*1024*1024}},
 diagnostics:{level:'warn'}
});
