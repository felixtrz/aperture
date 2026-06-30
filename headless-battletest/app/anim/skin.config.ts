import { asset, defineApertureConfig, signal } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["anim/systems/skin.system.ts"],
  assets: { soldier: asset.gltf("/skin/soldier.glb", { preload: "blocking", label: "Soldier" }) },
  signals: { clips: signal.number(-1), playing: signal.boolean(false) },
  render: { defaultCamera: false, defaultLight: false },
});
