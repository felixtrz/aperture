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
} from "./input.js";
import {
  renderDiagnostics,
  renderExplainEntity,
  renderFrameReport,
  renderPackets,
  renderSnapshotSummary,
} from "./render.js";
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
      return callGeneratedRuntimeTool(page, name, args);
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
      return callGeneratedRuntimeTool(page, name, args);
    case "input_key":
      return inputKey(page, args);
    case "input_pointer_move":
      return inputPointerMove(page, args);
    case "input_pointer_click":
      return inputPointerClick(page, args);
    case "input_drag":
      return inputDrag(page, args);
    case "input_action_set":
    case "input_gamepad_set":
    case "input_get_state":
      return callGeneratedRuntimeTool(page, name, args);
    case "input_reset":
      await page.mouse.up();
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
    case "render_pick_entity":
      return callGeneratedRuntimeTool(page, name, args);
    default:
      return unsupportedTool(name, "Unknown Aperture MCP tool.");
  }
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
