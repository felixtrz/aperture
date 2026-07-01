import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({ mode: "headless", systems: ["xfade-src/**/*.system.ts"], assets: { soldier: asset.gltf("/models/soldier.glb", { preload: "blocking" }) }, render: { defaultCamera: false, defaultLight: false } });
