import { asset, defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["hdr/systems/**/*.system.ts"],
  assets: { sky: asset.hdr("/hdri/env.hdr", { label: "Env HDR", preload: "blocking" }) },
  render: { defaultCamera: false, defaultLight: false },
});
// NOTE: drop a real RGBE .hdr at app/public/hdri/env.hdr to run this probe in
// strict asset mode (verified: assetProvenance real:1, loads in pure Node).
