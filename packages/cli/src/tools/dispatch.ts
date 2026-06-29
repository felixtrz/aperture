import type { ApertureDevSession } from "../session.js";
import { tailFile } from "../dev/logs.js";
import { numberArg } from "./args.js";
import {
  canvasStatus,
  readGeneratedStatus,
  screenshot,
  waitForWebGpu,
  type AperturePage,
} from "./browser.js";
import {
  inputDrag,
  inputKey,
  inputPointerClick,
  inputPointerMove,
  inputPointerSet,
  releaseAllPointerButtons,
} from "./input.js";
import {
  renderDiagnostics,
  renderExplainEntity,
  renderFrameReport,
  renderPackets,
  renderSnapshotSummary,
} from "./render.js";
import { readPngSamples } from "./png-readback.js";
import { callGeneratedRuntimeTool, listGeneratedSystems } from "./runtime.js";

export async function callBrowserBackedTool(
  page: AperturePage,
  session: ApertureDevSession,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "browser_status":
      return {
        ok: true,
        session: sessionSummary(session),
        page: await readGeneratedStatus(page),
      };
    case "browser_canvas_status":
      return canvasStatus(page);
    case "browser_wait_for_webgpu":
      return waitForWebGpu(page, numberArg(args, "timeoutMs") ?? 30_000);
    case "browser_screenshot":
      return screenshot(page, {
        baseDir: session.appRoot,
        path: args["path"],
        outputPath: args["outputPath"],
        includeData: args["includeData"],
        region: args["region"],
      });
    case "browser_console_logs":
      return {
        ok: true,
        logs: await tailFile(
          session.logs.browser,
          numberArg(args, "lines") ?? 80,
        ),
      };
    case "browser_reload":
      await page.reload({ waitUntil: "domcontentloaded" });
      return { ok: true, page: await readGeneratedStatus(page) };
    case "browser_pick_pixel":
      return browserScreenshotPickPixel(page, args);
    case "ecs_find_entities":
    case "ecs_get_entity":
    case "ecs_snapshot":
    case "ecs_diff":
    case "ecs_set_component_field":
    case "ecs_get_hierarchy":
      return callGeneratedRuntimeTool(page, name, args);
    case "ecs_list_systems":
      return listGeneratedSystems(page);
    case "ecs_query":
    case "ecs_get_component_schema":
    case "ecs_pause":
    case "ecs_resume":
    case "ecs_step":
      return callGeneratedRuntimeTool(page, name, args);
    case "asset_list":
    case "resource_get":
    case "resource_set":
      return callGeneratedRuntimeTool(page, name, args);
    case "physics_summary":
    case "physics_events":
    case "physics_joint_status":
    case "physics_apply_force":
    case "physics_apply_impulse":
    case "physics_set_linear_velocity":
    case "physics_set_angular_velocity":
    case "physics_set_kinematic_target":
    case "physics_break_joint":
    case "physics_sleep_body":
    case "physics_wake_body":
    case "physics_raycast_first":
    case "physics_raycast_all":
    case "physics_overlap_shape":
    case "physics_cast_shape_first":
    case "physics_project_point":
    case "physics_move_character":
    case "physics_debug_geometry":
    case "physics_debug_summary":
      return callGeneratedRuntimeTool(page, name, args);
    case "input_key":
      return inputKey(page, args);
    case "input_pointer_move":
      return inputPointerMove(page, args);
    case "input_pointer_click":
      return inputPointerClick(page, args);
    case "input_pointer_set":
      return inputPointerSet(page, args);
    case "input_drag":
      return inputDrag(page, args);
    case "input_action_set":
    case "input_gamepad_set":
    case "input_get_state":
      return callGeneratedRuntimeTool(page, name, args);
    case "input_reset":
      await releaseAllPointerButtons(page);
      return callGeneratedRuntimeTool(page, name, args);
    case "camera_list":
    case "camera_get":
    case "camera_save":
    case "camera_restore":
    case "camera_create_agent":
    case "camera_set_transform":
    case "camera_look_at":
    case "camera_orbit":
    case "camera_fit_entity":
    case "camera_use_agent_view":
      return callGeneratedRuntimeTool(page, name, args);
    case "render_get_frame_report":
      return renderFrameReport(page, args);
    case "render_get_snapshot_summary":
      return renderSnapshotSummary(page);
    case "render_get_packets":
      return renderPackets(page, args);
    case "render_explain_entity":
      return renderExplainEntity(page, args);
    case "render_get_diagnostics":
      return renderDiagnostics(page);
    case "render_set_post_effect_enabled":
      return callGeneratedRuntimeTool(page, name, args);
    case "render_readback_samples":
      return browserScreenshotReadbackSamples(page, args);
    case "render_pick_entity":
      return callGeneratedRuntimeTool(page, name, args);
    default:
      return unsupportedTool(name, "Unknown Aperture MCP tool.");
  }
}

async function browserScreenshotPickPixel(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const readback = await browserScreenshotReadbackSamples(page, args);
  const result = readback as {
    readonly samples?: readonly unknown[];
    readonly diagnostics?: readonly unknown[];
    readonly ok?: boolean;
  };

  return {
    ok: result.ok === true,
    result: {
      sample: result.samples?.[0] ?? null,
      readback,
    },
    diagnostics: result.diagnostics ?? [],
  };
}

async function browserScreenshotReadbackSamples(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const [png, region] = await Promise.all([
    page.screenshot({ type: "png" }),
    canvasScreenshotRegion(page),
  ]);

  return readPngSamples(png, args, { region });
}

interface CanvasScreenshotRegion {
  readonly source: "canvas";
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

async function canvasScreenshotRegion(
  page: AperturePage,
): Promise<CanvasScreenshotRegion | null> {
  const region = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  if (!isFinitePositiveRegion(region)) {
    return null;
  }

  return {
    source: "canvas",
    left: region.left,
    top: region.top,
    width: region.width,
    height: region.height,
    viewportWidth: region.viewportWidth,
    viewportHeight: region.viewportHeight,
  };
}

function isFinitePositiveRegion(
  value: unknown,
): value is Omit<CanvasScreenshotRegion, "source"> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const left = record["left"];
  const top = record["top"];
  const width = record["width"];
  const height = record["height"];
  const viewportWidth = record["viewportWidth"];
  const viewportHeight = record["viewportHeight"];

  return (
    isFiniteNumber(left) &&
    isFiniteNumber(top) &&
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    isFiniteNumber(viewportWidth) &&
    isFiniteNumber(viewportHeight) &&
    width > 0 &&
    height > 0 &&
    viewportWidth > 0 &&
    viewportHeight > 0
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sessionSummary(session: ApertureDevSession): unknown {
  return {
    protocolVersion: session.protocolVersion,
    appRoot: session.appRoot,
    url: session.url,
    server: session.server,
    browser: session.browser,
    bridge: session.bridge,
  };
}

function unsupportedTool(name: string, message: string): unknown {
  return {
    ok: false,
    diagnostic: {
      code: "aperture.mcp.toolUnsupported",
      tool: name,
      message,
    },
  };
}
