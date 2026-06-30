import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({ mode: "headless", systems: ["edge/throwing/none/**/*.system.ts"], assets: { bad: asset.gltf("/bad/corrupt.glb", { preload: "blocking" }) }, render: { defaultCamera: false, defaultLight: false } });
