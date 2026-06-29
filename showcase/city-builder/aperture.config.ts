import { createCityBuilderConfig } from "./aperture.shared-config.ts";

export default createCityBuilderConfig({
  mode: "browser",
  baseUrl: import.meta.env.BASE_URL,
  canvas: "#aperture",
});
