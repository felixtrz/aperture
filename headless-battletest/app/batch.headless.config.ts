import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({ mode: "headless", systems: ["batch-src/**/*.system.ts"], assets: { blaster: asset.gltf("/models/blaster.glb", { preload: "blocking" }) }, render: { defaultCamera: false, defaultLight: false } });
