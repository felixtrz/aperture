import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({ mode: "headless", systems: ["bloom-src/**/*.system.ts"], render: { defaultCamera: false, defaultLight: false, bloom: true, exposure: 1.2 } });
