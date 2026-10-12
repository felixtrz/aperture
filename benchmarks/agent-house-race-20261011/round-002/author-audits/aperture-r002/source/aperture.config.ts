import { defineApertureConfig,asset } from '@aperture-engine/app/config';
export default defineApertureConfig({
 mode:'browser',canvas:'#aperture',systems:[],assets:Object.fromEntries(['stucco','stone','asphalt','grass'].map(id=>[id,asset.texture('/textures/'+id+'.png',{preload:'blocking',colorSpace:'srgb',semantic:'base-color'})])),
 render:{cadence:'manual',tonemap:'aces',exposure:1,ssao:{radiusPixels:10,intensity:.55,power:1.2,sampleCount:8},sampleCount:4,pixelRatio:1,maxPixelRatio:1,defaultCamera:false,defaultLight:false,defaultEnvironment:true,clearColor:[0.63,0.75,0.88,1]},
 diagnostics:{level:'warn'}
});
