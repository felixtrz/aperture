import { createApertureAppConfig } from "./aperture.shared-config.ts";

export default createApertureAppConfig({
  mode: "browser",
  baseUrl: import.meta.env.BASE_URL,
  canvas: "#aperture",
});
