import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({ mode: "headless", systems: ["edge/initthrow/**/*.system.ts"], render: { defaultCamera: false, defaultLight: false } });
