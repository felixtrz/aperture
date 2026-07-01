import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({ mode: "headless", systems: ["sky-src/**/*.system.ts"], render: { defaultCamera: false, defaultLight: false } });
