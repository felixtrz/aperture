import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({ mode: "headless", systems: ["nodeanim-src/**/*.system.ts"], assets: { spincube: asset.gltf("/models/spincube.gltf", { preload: "blocking" }) }, render: { defaultCamera: false, defaultLight: false } });
