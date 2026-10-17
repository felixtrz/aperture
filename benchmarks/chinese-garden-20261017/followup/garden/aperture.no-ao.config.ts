import { defineApertureConfig } from '@aperture-engine/app/config';
import original from './aperture.headless.config.ts';
export default defineApertureConfig({...original, render:{...original.render, ssao:false}});
