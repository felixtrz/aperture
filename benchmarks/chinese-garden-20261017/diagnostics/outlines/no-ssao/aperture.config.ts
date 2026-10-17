import {defineApertureConfig} from '@aperture-engine/app/config';
export default defineApertureConfig({mode:'browser',canvas:'#aperture',systems:['src/systems/**/*.system.ts'],render:{cadence:'demand',defaultCamera:false,defaultLight:false,tonemap:'aces',exposure:1,sampleCount:4,maxPixelRatio:1,bloom:{threshold:.9,intensity:.025,radiusPixels:2},ssao:false},diagnostics:{level:'info'}});
