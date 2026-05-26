import { describe, expect, it } from "vitest";

import * as app from "@aperture-engine/app";
import * as advanced from "@aperture-engine/app/advanced";
import * as browser from "@aperture-engine/app/browser";
import * as config from "@aperture-engine/app/config";
import * as headless from "@aperture-engine/app/headless";
import * as systems from "@aperture-engine/app/systems";
import * as vite from "@aperture-engine/app/vite";
import * as worker from "@aperture-engine/app/worker";
import * as render from "@aperture-engine/render";
import * as runtime from "@aperture-engine/runtime";
import * as simulation from "@aperture-engine/simulation";

describe("Aperture package entrypoints", () => {
  it("keeps the app root focused on app runtime APIs", () => {
    expect("aperture" in app).toBe(false);
    expect("createApertureSystemManifest" in app).toBe(false);
    expect("createApertureApp" in app).toBe(true);
    expect("defineApertureConfig" in app).toBe(true);
    expect("createApertureHeadlessRunner" in app).toBe(true);
  });

  it("exposes app subpath surfaces explicitly", () => {
    expect("defineApertureConfig" in config).toBe(true);
    expect("createSystem" in systems).toBe(true);
    expect("createApertureApp" in advanced).toBe(true);
    expect("createApertureHeadlessRunner" in headless).toBe(true);
    expect("startGeneratedBrowserApp" in browser).toBe(true);
    expect("startGeneratedSimulationWorker" in worker).toBe(true);
    expect("aperture" in vite).toBe(true);
  });

  it("keeps focused lower-layer package surfaces available", () => {
    expect("createWorld" in simulation).toBe(true);
    expect("extractRenderSnapshot" in render).toBe(true);
    expect("createExtractionApp" in runtime).toBe(true);
  });
});
