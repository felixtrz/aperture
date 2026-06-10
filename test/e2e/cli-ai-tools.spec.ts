import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import { promisify } from "node:util";
import path from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";

const execFileAsync = promisify(execFile);
const CLI = path.resolve("packages/cli/dist/bin/aperture.js");
const APP_ROOT = path.resolve("examples/developer-api");
const PORT = 5187;
const CREATED_APP_PORT = 5193;
const TEMPLATE_APP_PORT = 5201;
const WORKER_FAILURE_PORT = 5196;
const WEBGPU_UNAVAILABLE_PORT = 5197;
const MCP_TOOL_TIMEOUT_MS = 60_000;

test.setTimeout(420_000);

test("Aperture CLI manages a browser session and exposes browser/ECS tools over MCP", async () => {
  await runCli(["dev", "down"], { allowFailure: true });

  try {
    const up = await runCli([
      "dev",
      "up",
      "--port",
      String(PORT),
      "--headless",
    ]);
    expect(up.stdout).toContain("Started Aperture dev session");
    expect(up.stdout).toContain(`http://127.0.0.1:${PORT}/`);

    const status = await runCli(["dev", "status"]);
    expect(status.stdout).toContain("Daemon: running");
    expect(status.stdout).toContain("Server: running");
    expect(status.stdout).toContain("Browser: running");
    expect(status.stdout).toContain(`Bridge: ws://127.0.0.1:${PORT}/`);
    expect(status.stdout).toContain("(available)");

    const reused = await runCli([
      "dev",
      "up",
      "--port",
      String(PORT),
      "--headless",
    ]);
    expect(reused.stdout).toContain("Reusing Aperture dev session");
    expect(reused.stdout).toContain(`http://127.0.0.1:${PORT}/`);

    const browserReady = await callMcpTool("browser_wait_for_webgpu", {
      timeoutMs: 30_000,
    });
    expect(browserReady.structuredContent).toMatchObject({
      ok: true,
      page: {
        managed: true,
        status: {
          status: "running",
          webgpuOk: true,
        },
      },
    });

    const browserStatus = await callMcpTool("browser_status", {});
    expect(browserStatus.structuredContent).toMatchObject({
      ok: true,
      session: {
        url: `http://127.0.0.1:${PORT}/`,
      },
      page: {
        managed: true,
      },
    });

    const canvasStatus = await callMcpTool("browser_canvas_status", {});
    expect(canvasStatus.structuredContent).toMatchObject({
      ok: true,
      status: {
        canvas: {
          width: expect.any(Number),
          height: expect.any(Number),
          displayWidth: expect.any(Number),
          displayHeight: expect.any(Number),
          pixelRatio: expect.any(Number),
        },
        renderTarget: {
          width: expect.any(Number),
          height: expect.any(Number),
        },
      },
    });

    const cliBrowserStatus = JSON.parse(
      (await runCli(["tool", "browser_status"])).stdout,
    ) as unknown;
    expect(cliBrowserStatus).toMatchObject({
      ok: true,
      session: {
        url: `http://127.0.0.1:${PORT}/`,
      },
      page: {
        managed: true,
      },
    });

    const cliCanvasStatus = JSON.parse(
      (await runCli(["tool", "browser_canvas_status"])).stdout,
    ) as unknown;
    expect(cliCanvasStatus).toMatchObject({
      ok: true,
      status: {
        canvas: {
          pixelRatio: expect.any(Number),
        },
      },
    });

    const cliAssets = JSON.parse(
      (await runCli(["tool", "asset_list"])).stdout,
    ) as unknown;
    expect(cliAssets).toMatchObject({
      ok: true,
      result: {
        assets: expect.arrayContaining([
          expect.objectContaining({
            id: "robot",
            kind: "gltf",
            ready: true,
          }),
        ]),
      },
    });

    const cliRenderFrame = JSON.parse(
      (await runCli(["tool", "render_get_frame_report"])).stdout,
    ) as unknown;
    expect(cliRenderFrame).toMatchObject({
      ok: true,
      report: {
        lastFrame: expect.any(Object),
      },
    });

    const cliInput = JSON.parse(
      (
        await runCli([
          "tool",
          "input_key",
          "--json",
          JSON.stringify({ key: "Enter", action: "press" }),
        ])
      ).stdout,
    ) as unknown;
    expect(cliInput).toMatchObject({
      ok: true,
    });

    const consoleLogs = await callMcpTool("browser_console_logs", {
      lines: 10,
    });
    expect(consoleLogs.structuredContent).toMatchObject({
      ok: true,
      logs: expect.any(String),
    });

    await withManagedPage(APP_ROOT, async (page) => {
      await page.evaluate(() => {
        delete (globalThis as unknown as Record<string, unknown>)[
          "__APERTURE_MCP_RUNTIME__"
        ];
      });
    });
    const missingRuntime = await callMcpTool("ecs_find_entities", {
      key: "level.crate.primary",
    });
    expect(missingRuntime.structuredContent).toMatchObject({
      ok: false,
      result: null,
      diagnostics: [
        {
          code: "aperture.devtools.runtimeMissing",
        },
      ],
    });

    const reload = await callMcpTool("browser_reload", {});
    expect(reload.structuredContent).toMatchObject({
      ok: true,
      page: {
        managed: true,
      },
    });
    await callMcpTool("browser_wait_for_webgpu", {
      timeoutMs: 30_000,
    });

    const screenshot = await callMcpTool("browser_screenshot", {});
    expect(screenshot.structuredContent).toMatchObject({
      ok: true,
      mimeType: "image/png",
      encoding: "base64",
    });
    expect(
      (screenshot.structuredContent as { readonly data?: string }).data
        ?.length ?? 0,
    ).toBeGreaterThan(1000);

    const pickedPixel = await callMcpTool("browser_pick_pixel", {
      x: 0.5,
      y: 0.5,
    });
    expect(pickedPixel.structuredContent).toMatchObject({
      ok: true,
      result: {
        sample: {
          pixel: {
            r: expect.any(Number),
            g: expect.any(Number),
            b: expect.any(Number),
            a: expect.any(Number),
          },
        },
      },
    });

    const find = await callMcpTool("ecs_find_entities", {
      key: "level.crate.primary",
      limit: 5,
    });
    expect(find.structuredContent).toMatchObject({
      ok: true,
      result: {
        total: 1,
        summaries: [
          expect.objectContaining({
            key: "level.crate.primary",
          }),
        ],
      },
    });
    const primaryEntity = firstEntityRef(find.structuredContent);

    const taggedFind = await callMcpTool("ecs_find_entities", {
      tags: ["interactive"],
      limit: 5,
    });
    expect(taggedFind.structuredContent).toMatchObject({
      ok: true,
      result: {
        summaries: expect.arrayContaining([
          expect.objectContaining({
            key: "level.crate.primary",
            tags: expect.arrayContaining(["interactive", "crate"]),
          }),
        ]),
      },
    });

    const namedFind = await callMcpTool("ecs_find_entities", {
      namePattern: "^crate$",
      limit: 5,
    });
    expect(namedFind.structuredContent).toMatchObject({
      ok: true,
      result: {
        summaries: expect.arrayContaining([
          expect.objectContaining({
            key: "level.crate.primary",
            name: "crate",
          }),
        ]),
      },
    });

    const componentFind = await callMcpTool("ecs_find_entities", {
      withComponents: ["aperture.app.entityTags"],
      limit: 5,
    });
    expect(componentFind.structuredContent).toMatchObject({
      ok: true,
      result: {
        summaries: expect.arrayContaining([
          expect.objectContaining({
            key: "level.crate.primary",
            componentIds: expect.arrayContaining(["aperture.app.entityTags"]),
          }),
        ]),
      },
    });

    const sourceFind = await callMcpTool("ecs_find_entities", {
      source: { assetId: "robot" },
      withComponents: ["aperture.render.mesh", "aperture.render.material"],
      limit: 5,
    });
    expect(sourceFind.structuredContent).toMatchObject({
      ok: true,
      result: {
        summaries: expect.arrayContaining([
          expect.objectContaining({
            componentIds: expect.arrayContaining([
              "aperture.render.mesh",
              "aperture.render.material",
            ]),
            source: expect.objectContaining({
              assetId: "robot",
            }),
          }),
        ]),
      },
    });

    const get = await callMcpTool("ecs_get_entity", {
      entity: primaryEntity,
    });
    expect(get.structuredContent).toMatchObject({
      ok: true,
      result: {
        summary: {
          key: "level.crate.primary",
        },
      },
    });

    const query = await callMcpTool("ecs_query", {
      withComponents: ["aperture.render.mesh"],
      limit: 10,
    });
    expect(query.structuredContent).toMatchObject({
      ok: true,
      result: {
        total: expect.any(Number),
        summaries: expect.arrayContaining([
          expect.objectContaining({
            componentIds: expect.arrayContaining(["aperture.render.mesh"]),
          }),
        ]),
      },
    });

    const snapshot = await callMcpTool("ecs_snapshot", {
      key: "level.robot",
      label: "e2e-before",
    });
    expect(snapshot.structuredContent).toMatchObject({
      ok: true,
      result: {
        label: "e2e-before",
        summaries: expect.any(Array),
      },
    });

    const robotFind = await callMcpTool("ecs_find_entities", {
      key: "level.robot",
      limit: 1,
    });
    const debugEntity = firstEntityRef(robotFind.structuredContent);
    const mutation = await callMcpTool("ecs_set_component_field", {
      entity: debugEntity,
      component: "aperture.metadata.debug",
      field: "note",
      value: "updated by cli ai tools e2e",
    });
    expect(mutation.structuredContent).toMatchObject({
      ok: true,
      result: {
        component: "aperture.metadata.debug",
        field: "note",
      },
    });

    const unsupportedComponentMutation = await callMcpTool(
      "ecs_set_component_field",
      {
        entity: debugEntity,
        component: "aperture.render.mesh",
        field: "handle",
        value: "unsafe",
      },
    );
    expect(unsupportedComponentMutation.structuredContent).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.entityLookup.componentMutationUnsupported",
        }),
      ],
    });

    const unsupportedFieldMutation = await callMcpTool(
      "ecs_set_component_field",
      {
        entity: debugEntity,
        component: "aperture.metadata.debug",
        field: "missing",
        value: "unsafe",
      },
    );
    expect(unsupportedFieldMutation.structuredContent).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.entityLookup.componentFieldUnsupported",
        }),
      ],
    });

    const diff = await callMcpTool("ecs_diff", {
      key: "level.robot",
      label: "e2e-after",
    });
    expect(diff.structuredContent).toMatchObject({
      ok: true,
      result: {
        counts: expect.any(Object),
      },
    });

    const schema = await callMcpTool("ecs_get_component_schema", {
      component: "aperture.transform.local",
    });
    expect(schema.structuredContent).toMatchObject({
      ok: true,
      result: {
        schemas: [
          expect.objectContaining({
            id: "aperture.transform.local",
            fields: expect.objectContaining({
              translation: expect.any(Object),
              rotation: expect.any(Object),
              scale: expect.any(Object),
            }),
          }),
        ],
      },
    });

    const pause = await callMcpTool("ecs_pause", {});
    expect(pause.structuredContent).toMatchObject({
      ok: true,
      result: {
        paused: true,
      },
    });

    const step = await callMcpTool("ecs_step", { delta: 0.016 });
    expect(step.structuredContent).toMatchObject({
      ok: true,
      result: {
        paused: true,
        frame: expect.any(Number),
      },
    });

    const resume = await callMcpTool("ecs_resume", {});
    expect(resume.structuredContent).toMatchObject({
      ok: true,
      result: {
        paused: false,
      },
    });

    const pointer = await callMcpTool("input_pointer_move", {
      x: 0.25,
      y: 0.5,
    });
    expect(pointer.structuredContent).toMatchObject({
      ok: true,
      point: {
        x: expect.any(Number),
        y: expect.any(Number),
      },
    });

    const pointerClick = await callMcpTool("input_pointer_click", {
      x: 0.5,
      y: 0.5,
    });
    expect(pointerClick.structuredContent).toMatchObject({
      ok: true,
      point: {
        x: expect.any(Number),
        y: expect.any(Number),
      },
    });

    const drag = await callMcpTool("input_drag", {
      from: { x: 0.4, y: 0.5 },
      to: { x: 0.6, y: 0.5 },
    });
    expect(drag.structuredContent).toMatchObject({
      ok: true,
      from: {
        x: expect.any(Number),
        y: expect.any(Number),
      },
      to: {
        x: expect.any(Number),
        y: expect.any(Number),
      },
    });

    const inputReset = await callMcpTool("input_reset", {});
    expect(inputReset.structuredContent).toMatchObject({
      ok: true,
    });

    const key = await callMcpTool("input_key", {
      key: "Enter",
      action: "press",
    });
    expect(
      (
        key.structuredContent as {
          readonly page?: {
            readonly status?: { readonly forwardedInputEvents?: number };
          };
        }
      ).page?.status?.forwardedInputEvents ?? 0,
    ).toBeGreaterThan(0);

    const actionSet = await callMcpTool("input_action_set", {
      action: "select",
      pressed: true,
    });
    expect(actionSet.structuredContent).toMatchObject({
      ok: true,
      result: {
        action: "select",
        pressed: true,
        value: 1,
      },
    });

    const actionRelease = await callMcpTool("input_action_set", {
      action: "select",
      pressed: false,
    });
    expect(actionRelease.structuredContent).toMatchObject({
      ok: true,
      result: {
        action: "select",
        pressed: false,
        value: 0,
      },
    });

    const gamepadButton = await callMcpTool("input_gamepad_set", {
      button: "south",
      pressed: true,
    });
    expect(gamepadButton.structuredContent).toMatchObject({
      ok: true,
      result: {
        input: {
          gamepads: {
            primaryIndex: 0,
            devices: [
              expect.objectContaining({
                buttons: expect.objectContaining({
                  south: expect.objectContaining({ pressed: true }),
                }),
              }),
            ],
          },
        },
      },
    });

    const gamepadStick = await callMcpTool("input_gamepad_set", {
      leftStick: { x: 0.5, y: -0.25 },
    });
    expect(gamepadStick.structuredContent).toMatchObject({
      ok: true,
      result: {
        input: {
          gamepads: {
            devices: [
              expect.objectContaining({
                axes: {
                  leftStick: [0.5, -0.25],
                  rightStick: [0, 0],
                },
              }),
            ],
          },
        },
      },
    });

    await callMcpTool("ecs_pause", {});
    await callMcpTool("input_gamepad_set", {
      button: "south",
      pressed: true,
    });
    const pausedInput = await callMcpTool("input_get_state", {});
    expect(pausedInput.structuredContent).toMatchObject({
      ok: true,
      result: {
        gamepads: {
          devices: [
            expect.objectContaining({
              buttons: expect.objectContaining({
                south: expect.objectContaining({ down: true }),
              }),
            }),
          ],
        },
      },
    });
    await callMcpTool("ecs_step", { delta: 0.016 });
    const steppedInput = await callMcpTool("input_get_state", {});
    expect(steppedInput.structuredContent).toMatchObject({
      ok: true,
      result: {
        gamepads: {
          devices: [
            expect.objectContaining({
              buttons: expect.objectContaining({
                south: expect.objectContaining({
                  pressed: true,
                  down: false,
                }),
              }),
            }),
          ],
        },
      },
    });
    await callMcpTool("ecs_resume", {});

    const hierarchy = await callMcpTool("ecs_get_hierarchy", {});
    expect(hierarchy.structuredContent).toMatchObject({
      ok: true,
      result: {
        total: expect.any(Number),
        roots: expect.arrayContaining([
          expect.objectContaining({
            key: "level.crate.primary",
          }),
        ]),
      },
    });

    const systems = await callMcpTool("ecs_list_systems", {});
    expect(systems.structuredContent).toMatchObject({
      ok: true,
      systems: expect.arrayContaining([
        expect.objectContaining({
          moduleUrl: expect.stringContaining("setup.system.ts"),
        }),
      ]),
    });

    const cameraList = await callMcpTool("camera_list", {});
    expect(cameraList.structuredContent).toMatchObject({
      ok: true,
      result: expect.arrayContaining([
        expect.objectContaining({
          camera: expect.any(Object),
        }),
      ]),
    });

    const agentCameraKey = "camera.agent.e2e";
    const agentCamera = await callMcpTool("camera_create_agent", {
      key: agentCameraKey,
      translation: [0, 2, 6],
      lookAt: [0, 0, 0],
    });
    expect(agentCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
      },
    });

    const cameraGet = await callMcpTool("camera_get", {
      key: agentCameraKey,
    });
    expect(cameraGet.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
      },
    });

    const movedCamera = await callMcpTool("camera_set_transform", {
      key: agentCameraKey,
      translation: [0, 2.5, 5],
    });
    expect(movedCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
        localTransform: {
          translation: [0, 2.5, 5],
        },
      },
    });

    const lookAtCamera = await callMcpTool("camera_look_at", {
      key: agentCameraKey,
      translation: [0, 2.5, 5],
      target: [0, 0.5, 0],
    });
    expect(lookAtCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
      },
    });

    const savedCamera = await callMcpTool("camera_save", {
      key: agentCameraKey,
      slot: "e2e",
    });
    expect(savedCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        slot: "e2e",
      },
    });

    const orbitedCamera = await callMcpTool("camera_orbit", {
      key: agentCameraKey,
      target: [0, 0.5, 0],
      radius: 4,
      yawDegrees: 45,
      pitchDegrees: 25,
    });
    expect(orbitedCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
        localTransform: {
          translation: expect.any(Array),
        },
      },
    });

    const fitCamera = await callMcpTool("camera_fit_entity", {
      key: agentCameraKey,
      entity: primaryEntity,
      radius: 4,
    });
    expect(fitCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
      },
    });

    const invalidFitCamera = await callMcpTool("camera_fit_entity", {
      key: agentCameraKey,
      entity: { index: 999_999, generation: 1 },
    });
    expect(invalidFitCamera.structuredContent).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.camera.targetNotFound",
        }),
      ],
    });

    const agentView = await callMcpTool("camera_use_agent_view", {
      key: agentCameraKey,
    });
    expect(agentView.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
        camera: expect.objectContaining({
          priority: 10000,
          renderTargetId: "",
        }),
      },
    });

    const restoredCamera = await callMcpTool("camera_restore", {
      key: agentCameraKey,
      slot: "e2e",
    });
    expect(restoredCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: agentCameraKey,
      },
    });

    const frame = await callMcpTool("render_get_frame_report", {});
    expect(frame.structuredContent).toMatchObject({
      ok: true,
      report: {
        lastFrame: {
          counts: {
            views: expect.any(Number),
            meshDraws: expect.any(Number),
          },
        },
      },
    });

    const renderSummary = await callMcpTool("render_get_snapshot_summary", {});
    expect(renderSummary.structuredContent).toMatchObject({
      ok: true,
      summary: {
        snapshots: expect.any(Number),
        counts: {
          views: expect.any(Number),
        },
      },
    });

    const packets = await callMcpTool("render_get_packets", {});
    expect(packets.structuredContent).toMatchObject({
      ok: true,
      packets: {
        counts: expect.any(Object),
      },
    });

    const filteredPackets = await callMcpTool("render_get_packets", {
      families: [
        "views",
        "meshDraws",
        "lights",
        "environments",
        "shadows",
        "bounds",
      ],
    });
    expect(filteredPackets.structuredContent).toMatchObject({
      ok: true,
      packets: {
        families: {
          views: {
            family: "views",
            counts: expect.any(Object),
          },
          meshDraws: {
            family: "meshDraws",
            counts: expect.any(Object),
          },
          lights: {
            family: "lights",
            counts: expect.any(Object),
          },
          environments: {
            family: "environments",
            counts: expect.any(Object),
          },
          shadows: {
            family: "shadowRequests",
            counts: expect.any(Object),
          },
          bounds: {
            family: "bounds",
            counts: expect.any(Object),
          },
        },
      },
    });

    const renderExplain = await callMcpTool("render_explain_entity", {
      key: "level.crate.primary",
    });
    expect(renderExplain.structuredContent).toMatchObject({
      ok: true,
      report: {
        entity: expect.objectContaining({
          key: "level.crate.primary",
        }),
        rendered: true,
      },
    });

    const renderDiagnostics = await callMcpTool("render_get_diagnostics", {});
    expect(renderDiagnostics.structuredContent).toMatchObject({
      ok: true,
      diagnostics: {
        app: expect.any(Object),
      },
    });

    const readback = await callMcpTool("render_readback_samples", {
      samples: [
        { id: "center", x: 0.5, y: 0.5 },
        { id: "top-left", x: 0.05, y: 0.05 },
      ],
    });
    expect(readback.structuredContent).toMatchObject({
      ok: true,
      result: {
        samples: expect.arrayContaining([
          expect.objectContaining({
            id: "center",
            pixel: {
              r: expect.any(Number),
              g: expect.any(Number),
              b: expect.any(Number),
              a: expect.any(Number),
            },
          }),
        ]),
      },
    });

    const pickedEntity = await callMcpTool("render_pick_entity", {
      x: 0.5,
      y: 0.5,
    });
    expect(pickedEntity.structuredContent).toMatchObject({
      result: {
        x: expect.any(Number),
        y: expect.any(Number),
        pick: expect.any(Object),
      },
      diagnostics: expect.any(Array),
    });

    const logs = await runCli(["dev", "logs", "--lines", "5"]);
    expect(logs.stdout).toContain("browser.log");

    const referenceBuild = await runCli(["reference", "warmup"]);
    expect(referenceBuild.stdout).toContain("Warmed Aperture reference corpus");

    const referenceSearch = await runCli([
      "reference",
      "search",
      "SpinCrateSystem",
      "--limit",
      "3",
    ]);
    expect(referenceSearch.stdout).toContain("spin-crate.system.ts");

    const mcpReferenceSearch = await callMcpTool("reference_search", {
      query: "SpinCrateSystem",
      limit: 3,
    });
    expect(mcpReferenceSearch.structuredContent).toMatchObject({
      total: expect.any(Number),
      results: expect.arrayContaining([
        expect.objectContaining({
          file: expect.stringContaining("spin-crate.system.ts"),
        }),
      ]),
    });

    const apiLookup = await callMcpTool("reference_api_lookup", {
      symbol: "createSystem",
      limit: 3,
    });
    expect(apiLookup.structuredContent).toMatchObject({
      results: expect.any(Array),
    });

    const fileContent = await callMcpTool("reference_file_content", {
      file: "src/systems/spin-crate.system.ts",
    });
    expect(fileContent.structuredContent).toMatchObject({
      ok: true,
      entry: {
        file: "src/systems/spin-crate.system.ts",
      },
    });

    const exampleSearch = await callMcpTool("reference_find_examples", {
      query: "developer api",
      limit: 3,
    });
    expect(exampleSearch.structuredContent).toMatchObject({
      results: expect.any(Array),
    });

    const referenceComponents = await callMcpTool(
      "reference_list_components",
      {},
    );
    expect(referenceComponents.structuredContent).toMatchObject({
      ok: true,
      components: expect.any(Array),
    });

    const referenceSystems = await callMcpTool("reference_list_systems", {});
    expect(referenceSystems.structuredContent).toMatchObject({
      ok: true,
      systems: expect.arrayContaining(["SpinCrateSystem"]),
    });

    const dependents = await callMcpTool("reference_find_dependents", {
      symbol: "LocalTransform",
      limit: 3,
    });
    expect(dependents.structuredContent).toMatchObject({
      results: expect.any(Array),
    });

    const diagnosticExplanation = await callMcpTool(
      "reference_explain_diagnostic",
      {
        code: "aperture.system.invalidPriority",
        limit: 3,
      },
    );
    expect(diagnosticExplanation.structuredContent).toMatchObject({
      results: expect.any(Array),
    });

    await killManagedBrowser(APP_ROOT);
    const crashedBrowserStatus = await callMcpTool("browser_status", {});
    expect(crashedBrowserStatus.structuredContent).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.mcp.browserConnectFailed",
      },
    });

    const restarted = await runCli([
      "dev",
      "up",
      "--port",
      String(PORT),
      "--headless",
    ]);
    expect(restarted.stdout).toContain("Started Aperture dev session");
    const restartedReady = await callMcpTool("browser_wait_for_webgpu", {
      timeoutMs: 30_000,
    });
    expect(restartedReady.structuredContent).toMatchObject({
      ok: true,
      page: {
        status: {
          status: "running",
          webgpuOk: true,
        },
      },
    });
  } finally {
    await runCli(["dev", "down"], { allowFailure: true });
    await rm(path.join(APP_ROOT, ".aperture"), {
      force: true,
      recursive: true,
    });
  }
});

test("aperture create produces an installable app that works with CLI AI tools", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-created-app-"));
  const appRoot = path.join(root, "starter");

  try {
    await runCli(["create", "starter"], { cwd: root });
    const agentNotesPath = path.join(appRoot, "AGENTS.md");
    const agentNote = "E2E user-owned adapter note.";
    await writeFile(
      agentNotesPath,
      `${await readFile(agentNotesPath, "utf8")}\n${agentNote}\n`,
      "utf8",
    );
    const adapterSync = await runCli(["adapter", "sync"], { cwd: appRoot });
    expect(adapterSync.stdout).toContain("Synced Aperture adapter files");
    expect(adapterSync.stdout).toContain("Conflicted: 0");
    expect(await readFile(agentNotesPath, "utf8")).toContain(agentNote);
    const mcpJson = JSON.parse(
      await readFile(path.join(appRoot, ".mcp.json"), "utf8"),
    ) as {
      readonly mcpServers?: {
        readonly aperture?: { readonly command?: string };
      };
    };
    expect(mcpJson.mcpServers?.aperture?.command).toBe("pnpm");

    const adapterResync = await runCli(["adapter", "sync"], { cwd: appRoot });
    expect(adapterResync.stdout).toContain("Changed: 0");
    expect(adapterResync.stdout).toContain("Conflicted: 0");

    await writeFile(
      path.join(root, "pnpm-workspace.yaml"),
      [
        "packages:",
        '  - "starter"',
        `  - ${JSON.stringify(path.resolve("packages/*"))}`,
        "",
      ].join("\n"),
      "utf8",
    );
    // The created app depends on @aperture-engine/* by semver; they are
    // unpublished, so the temp workspace must link them from packages/*.
    await writeFile(
      path.join(root, ".npmrc"),
      "link-workspace-packages=true\n",
      "utf8",
    );
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "aperture-created-app-e2e",
          version: "0.0.0",
          private: true,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await runPnpm(
      ["install", "--filter", "starter", "--ignore-scripts"],
      root,
      120_000,
    );
    await runPnpm(["run", "typecheck"], appRoot, 60_000);
    await runPnpm(["run", "build"], appRoot, 60_000);

    await runCli(["dev", "down"], { cwd: appRoot, allowFailure: true });
    const portBlocker = net.createServer();
    await listenOnPort(portBlocker, "127.0.0.1", CREATED_APP_PORT);
    let up: CommandResult;
    try {
      up = await runCli(
        [
          "dev",
          "up",
          "--port",
          String(CREATED_APP_PORT),
          "--no-strict-port",
          "--headless",
        ],
        { cwd: appRoot },
      );
    } finally {
      await closeServer(portBlocker);
    }
    expect(up.stdout).toContain("Started Aperture dev session");
    expect(portFromDevUpOutput(up.stdout)).toBeGreaterThan(CREATED_APP_PORT);

    const ready = await callMcpTool(
      "browser_wait_for_webgpu",
      { timeoutMs: 30_000 },
      { cwd: appRoot },
    );
    expect(ready.structuredContent).toMatchObject({
      ok: true,
      page: {
        managed: true,
        status: {
          status: "running",
          webgpuOk: true,
        },
      },
    });

    const generatedBrowserStatus = await callMcpTool(
      "browser_status",
      {},
      { cwd: appRoot },
    );
    expect(generatedBrowserStatus.structuredContent).toMatchObject({
      ok: true,
      page: {
        managed: true,
      },
    });

    const generatedScreenshot = await callMcpTool(
      "browser_screenshot",
      {},
      { cwd: appRoot },
    );
    expect(generatedScreenshot.structuredContent).toMatchObject({
      ok: true,
      mimeType: "image/png",
    });
    expect(
      (generatedScreenshot.structuredContent as { readonly data?: string }).data
        ?.length ?? 0,
    ).toBeGreaterThan(1000);

    const entity = await callMcpTool(
      "ecs_find_entities",
      { key: "starter.cube" },
      { cwd: appRoot },
    );
    expect(entity.structuredContent).toMatchObject({
      ok: true,
      result: {
        total: 1,
        summaries: [
          expect.objectContaining({
            key: "starter.cube",
          }),
        ],
      },
    });
    const generatedEntity = firstEntityRef(entity.structuredContent);

    const generatedGet = await callMcpTool(
      "ecs_get_entity",
      { entity: generatedEntity },
      { cwd: appRoot },
    );
    expect(generatedGet.structuredContent).toMatchObject({
      ok: true,
      result: {
        summary: {
          key: "starter.cube",
        },
      },
    });

    const generatedSchema = await callMcpTool(
      "ecs_get_component_schema",
      { component: "aperture.transform.local" },
      { cwd: appRoot },
    );
    expect(generatedSchema.structuredContent).toMatchObject({
      ok: true,
      result: {
        schemas: expect.arrayContaining([
          expect.objectContaining({
            id: "aperture.transform.local",
          }),
        ]),
      },
    });

    const generatedSnapshot = await callMcpTool(
      "ecs_snapshot",
      { key: "starter.cube", label: "generated-before" },
      { cwd: appRoot },
    );
    expect(generatedSnapshot.structuredContent).toMatchObject({
      ok: true,
      result: {
        label: "generated-before",
      },
    });

    const generatedDiff = await callMcpTool(
      "ecs_diff",
      { key: "starter.cube", label: "generated-after" },
      { cwd: appRoot },
    );
    expect(generatedDiff.structuredContent).toMatchObject({
      ok: true,
      result: {
        counts: expect.any(Object),
      },
    });

    const generatedHierarchy = await callMcpTool(
      "ecs_get_hierarchy",
      {},
      { cwd: appRoot },
    );
    expect(generatedHierarchy.structuredContent).toMatchObject({
      ok: true,
      result: {
        roots: expect.arrayContaining([
          expect.objectContaining({
            key: "starter.cube",
          }),
        ]),
      },
    });

    const generatedSystems = await callMcpTool(
      "ecs_list_systems",
      {},
      { cwd: appRoot },
    );
    expect(generatedSystems.structuredContent).toMatchObject({
      ok: true,
      systems: expect.arrayContaining([
        expect.objectContaining({
          moduleUrl: expect.stringContaining("setup.system.ts"),
        }),
      ]),
    });

    const generatedAssets = await callMcpTool(
      "asset_list",
      {},
      { cwd: appRoot },
    );
    expect(generatedAssets.structuredContent).toMatchObject({
      ok: true,
      result: {
        assets: expect.any(Array),
      },
    });

    const pointer = await callMcpTool(
      "input_pointer_click",
      { x: 0.5, y: 0.5 },
      { cwd: appRoot },
    );
    expect(pointer.structuredContent).toMatchObject({
      ok: true,
      point: {
        x: expect.any(Number),
        y: expect.any(Number),
      },
    });

    const generatedKey = await callMcpTool(
      "input_key",
      { key: "Enter", action: "press" },
      { cwd: appRoot },
    );
    expect(generatedKey.structuredContent).toMatchObject({
      ok: true,
    });

    const action = await callMcpTool(
      "input_action_set",
      { action: "select", pressed: true },
      { cwd: appRoot },
    );
    expect(action.structuredContent).toMatchObject({
      ok: true,
      result: {
        action: "select",
        pressed: true,
      },
    });

    const inputReset = await callMcpTool("input_reset", {}, { cwd: appRoot });
    expect(inputReset.structuredContent).toMatchObject({
      ok: true,
    });

    const camera = await callMcpTool(
      "camera_create_agent",
      { key: "camera.agent.generated", lookAt: [0, 0.5, 0] },
      { cwd: appRoot },
    );
    expect(camera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: "camera.agent.generated",
      },
    });

    const savedCamera = await callMcpTool(
      "camera_save",
      { key: "camera.agent.generated", slot: "generated" },
      { cwd: appRoot },
    );
    expect(savedCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        slot: "generated",
      },
    });

    const fitCamera = await callMcpTool(
      "camera_fit_entity",
      { key: "camera.agent.generated", entity: generatedEntity, radius: 4 },
      { cwd: appRoot },
    );
    expect(fitCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: "camera.agent.generated",
      },
    });

    const agentView = await callMcpTool(
      "camera_use_agent_view",
      { key: "camera.agent.generated" },
      { cwd: appRoot },
    );
    expect(agentView.structuredContent).toMatchObject({
      ok: true,
      result: {
        camera: expect.objectContaining({
          priority: 10000,
        }),
      },
    });

    const restoredCamera = await callMcpTool(
      "camera_restore",
      { key: "camera.agent.generated", slot: "generated" },
      { cwd: appRoot },
    );
    expect(restoredCamera.structuredContent).toMatchObject({
      ok: true,
      result: {
        key: "camera.agent.generated",
      },
    });

    const frame = await callMcpTool(
      "render_get_frame_report",
      {},
      { cwd: appRoot },
    );
    expect(frame.structuredContent).toMatchObject({
      ok: true,
      report: {
        lastFrame: expect.any(Object),
      },
    });

    const packets = await callMcpTool(
      "render_get_packets",
      { family: "meshDraws" },
      { cwd: appRoot },
    );
    expect(packets.structuredContent).toMatchObject({
      ok: true,
      packets: {
        families: {
          meshDraws: {
            family: "meshDraws",
          },
        },
      },
    });

    const explain = await callMcpTool(
      "render_explain_entity",
      { key: "starter.cube" },
      { cwd: appRoot },
    );
    expect(explain.structuredContent).toMatchObject({
      ok: true,
      report: {
        entity: expect.objectContaining({
          key: "starter.cube",
        }),
      },
    });

    const diagnostics = await callMcpTool(
      "render_get_diagnostics",
      {},
      { cwd: appRoot },
    );
    expect(diagnostics.structuredContent).toMatchObject({
      ok: true,
      diagnostics: {
        app: expect.any(Object),
      },
    });

    const readback = await callMcpTool(
      "render_readback_samples",
      { samples: [{ id: "center", x: 0.5, y: 0.5 }] },
      { cwd: appRoot },
    );
    expect(readback.structuredContent).toMatchObject({
      ok: true,
      result: {
        samples: [
          expect.objectContaining({
            id: "center",
            pixel: expect.any(Object),
          }),
        ],
      },
    });

    const pick = await callMcpTool(
      "render_pick_entity",
      { x: 0.5, y: 0.5 },
      { cwd: appRoot },
    );
    expect(pick.structuredContent).toMatchObject({
      result: {
        pick: expect.any(Object),
      },
    });

    const referenceBuild = await runCli(["reference", "warmup"], {
      cwd: appRoot,
    });
    expect(referenceBuild.stdout).toContain("Warmed Aperture reference corpus");
    const referenceSearch = await runCli(
      ["reference", "search", "Starter Cube", "--limit", "3"],
      { cwd: appRoot },
    );
    expect(referenceSearch.stdout).toContain("setup.system.ts");

    const mcpReferenceSearch = await callMcpTool(
      "reference_search",
      { query: "Starter Cube", limit: 3 },
      { cwd: appRoot },
    );
    expect(mcpReferenceSearch.structuredContent).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          file: "src/systems/setup.system.ts",
        }),
      ]),
    });

    await runCli(["dev", "down"], { cwd: appRoot, allowFailure: true });
    const setupSystemPath = path.join(appRoot, "src/systems/setup.system.ts");
    const originalSetupSystem = await readFile(setupSystemPath, "utf8");
    try {
      await writeFile(
        setupSystemPath,
        [
          'throw new Error("worker startup failure e2e");',
          originalSetupSystem,
        ].join("\n"),
        "utf8",
      );
      const workerFailureUp = await runCli(
        ["dev", "up", "--port", String(WORKER_FAILURE_PORT), "--headless"],
        { cwd: appRoot },
      );
      expect(workerFailureUp.stdout).toContain("Started Aperture dev session");

      const workerFailure = await callMcpTool(
        "browser_wait_for_webgpu",
        { timeoutMs: 5_000 },
        { cwd: appRoot },
      );
      expect(workerFailure.structuredContent).toMatchObject({
        ok: false,
        diagnostic: {
          code: "aperture.mcp.workerError",
        },
        page: {
          status: {
            status: "worker-error",
          },
        },
      });

      const workerFailureDiagnostics = await callMcpTool(
        "render_get_diagnostics",
        {},
        { cwd: appRoot },
      );
      expect(workerFailureDiagnostics.structuredContent).toMatchObject({
        ok: true,
        diagnostics: {
          failure: {
            status: "failed",
            diagnostics: expect.arrayContaining([
              expect.objectContaining({
                code: "simulation-worker.transport-error",
              }),
            ]),
          },
        },
      });
    } finally {
      await runCli(["dev", "down"], { cwd: appRoot, allowFailure: true });
      await writeFile(setupSystemPath, originalSetupSystem, "utf8");
    }

    await disableWebGpuInIndexHtml(appRoot);
    const webgpuUnavailableUp = await runCli(
      ["dev", "up", "--port", String(WEBGPU_UNAVAILABLE_PORT), "--headless"],
      { cwd: appRoot },
    );
    expect(webgpuUnavailableUp.stdout).toContain(
      "Started Aperture dev session",
    );

    const webgpuUnavailable = await callMcpTool(
      "browser_wait_for_webgpu",
      { timeoutMs: 5_000 },
      { cwd: appRoot },
    );
    expect(webgpuUnavailable.structuredContent).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.mcp.webgpuUnavailable",
      },
      page: {
        status: {
          status: "webgpu-failed",
          webgpuOk: false,
        },
      },
    });

    const unavailableDiagnostics = await callMcpTool(
      "render_get_diagnostics",
      {},
      { cwd: appRoot },
    );
    expect(unavailableDiagnostics.structuredContent).toMatchObject({
      ok: true,
      diagnostics: {
        app: {
          reason: "navigator-gpu-unavailable",
        },
      },
    });
  } finally {
    await runCli(["dev", "down"], { cwd: appRoot, allowFailure: true });
    await rm(root, { force: true, recursive: true });
  }
});

test("aperture create templates typecheck, build, and pass browser smoke checks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-templates-e2e-"));
  const templates = [
    {
      name: "minimal",
      template: "minimal",
      key: "starter.cube",
      assetId: undefined,
      port: TEMPLATE_APP_PORT,
    },
    {
      name: "viewer",
      template: "glb-viewer",
      key: "viewer.sampleCube",
      assetId: "sampleCube",
      port: TEMPLATE_APP_PORT + 1,
    },
    {
      name: "game",
      template: "game",
      key: "player",
      assetId: "goal",
      port: TEMPLATE_APP_PORT + 2,
    },
  ] as const;

  try {
    for (const template of templates) {
      await runCli(["create", template.name, "--template", template.template], {
        cwd: root,
      });
    }

    await writeFile(
      path.join(root, ".npmrc"),
      "link-workspace-packages=true\n",
      "utf8",
    );
    await writeFile(
      path.join(root, "pnpm-workspace.yaml"),
      [
        "packages:",
        '  - "minimal"',
        '  - "viewer"',
        '  - "game"',
        `  - ${JSON.stringify(path.resolve("packages/*"))}`,
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "aperture-template-e2e",
          version: "0.0.0",
          private: true,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await runPnpm(
      [
        "install",
        "--filter",
        "minimal",
        "--filter",
        "viewer",
        "--filter",
        "game",
        "--ignore-scripts",
      ],
      root,
      120_000,
    );

    for (const template of templates) {
      const appRoot = path.join(root, template.name);
      await runPnpm(["run", "typecheck"], appRoot, 60_000);
      await runPnpm(["run", "build"], appRoot, 60_000);
    }

    for (const template of templates) {
      const appRoot = path.join(root, template.name);

      try {
        await runCli(["dev", "down"], { cwd: appRoot, allowFailure: true });
        const up = await runCli(
          ["dev", "up", "--port", String(template.port), "--headless"],
          { cwd: appRoot },
        );
        expect(up.stdout).toContain("Started Aperture dev session");

        const ready = await callMcpTool(
          "browser_wait_for_webgpu",
          { timeoutMs: 30_000 },
          { cwd: appRoot },
        );
        expect(ready.structuredContent).toMatchObject({
          ok: true,
          page: {
            status: {
              status: "running",
              webgpuOk: true,
            },
          },
        });

        if (template.name === "minimal") {
          await expectManagedCanvasResize(appRoot, [
            { width: 1024, height: 640 },
            { width: 740, height: 720 },
            { width: 390, height: 844 },
          ]);
        }

        const canvas = await callMcpTool(
          "browser_canvas_status",
          {},
          { cwd: appRoot },
        );
        expect(canvas.structuredContent).toMatchObject({
          ok: true,
          status: {
            canvas: {
              width: expect.any(Number),
              height: expect.any(Number),
              aspect: expect.any(Number),
            },
            renderTarget: {
              width: expect.any(Number),
              height: expect.any(Number),
              msaaSampleCount: 4,
            },
          },
        });

        const entity = await callMcpTool(
          "ecs_find_entities",
          { key: template.key },
          { cwd: appRoot },
        );
        expect(entity.structuredContent).toMatchObject({
          ok: true,
          result: {
            total: 1,
          },
        });

        const frame = await callMcpTool(
          "render_get_frame_report",
          {},
          { cwd: appRoot },
        );
        expect(frame.structuredContent).toMatchObject({
          ok: true,
          report: {
            lastFrame: {
              counts: {
                drawCalls: expect.any(Number),
              },
            },
          },
        });

        if (template.assetId !== undefined) {
          const assets = await callMcpTool("asset_list", {}, { cwd: appRoot });
          expect(assets.structuredContent).toMatchObject({
            ok: true,
            result: {
              assets: expect.arrayContaining([
                expect.objectContaining({
                  id: template.assetId,
                  kind: "gltf",
                  ready: true,
                  error: null,
                }),
              ]),
            },
          });
        }

        if (template.template === "game") {
          await callMcpTool(
            "input_action_set",
            { action: "move", x: 1 },
            { cwd: appRoot },
          );
          await delay(2_600);
          await callMcpTool(
            "input_action_set",
            { action: "move", x: 0 },
            { cwd: appRoot },
          );

          const status = await callMcpTool(
            "browser_status",
            {},
            { cwd: appRoot },
          );
          const signals = generatedSignals(status.structuredContent);

          expect(signals.score).toBe(1);
          expect(signals.goalReached).toBe(true);
          expect(Number(signals.playerX)).toBeGreaterThan(3.5);
        }
      } finally {
        await runCli(["dev", "down"], { cwd: appRoot, allowFailure: true });
      }
    }
  } finally {
    for (const template of templates) {
      await runCli(["dev", "down"], {
        cwd: path.join(root, template.name),
        allowFailure: true,
      });
    }
    await rm(root, { force: true, recursive: true });
  }
});

interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function generatedSignals(content: unknown): Record<string, unknown> {
  const page = (content as { readonly page?: unknown }).page;
  const status = (page as { readonly status?: unknown } | undefined)?.status;
  const summary = (
    status as { readonly lastWorkerSummary?: unknown } | undefined
  )?.lastWorkerSummary;
  const signals = (summary as { readonly signals?: unknown } | undefined)
    ?.signals;

  return typeof signals === "object" && signals !== null
    ? (signals as Record<string, unknown>)
    : {};
}

async function expectManagedCanvasResize(
  cwd: string,
  sizes: readonly { readonly width: number; readonly height: number }[],
): Promise<void> {
  for (const size of sizes) {
    await withManagedPage(cwd, async (page) => {
      await page.setViewportSize(size);
    });

    const deadline = Date.now() + 10_000;
    let lastStatus: ManagedCanvasStatus | null = null;

    while (Date.now() < deadline) {
      lastStatus = await readManagedCanvasStatus(cwd);

      if (
        lastStatus.canvas.displayWidth === size.width &&
        lastStatus.canvas.displayHeight === size.height &&
        lastStatus.renderTarget.width === lastStatus.canvas.width &&
        lastStatus.renderTarget.height === lastStatus.canvas.height
      ) {
        expect(lastStatus.canvas.aspect).toBeCloseTo(
          size.width / size.height,
          5,
        );
        return;
      }

      await delay(100);
    }

    throw new Error(
      `Canvas did not resize to ${size.width}x${size.height}: ${JSON.stringify(
        lastStatus,
      )}`,
    );
  }
}

interface ManagedCanvasStatus {
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly displayWidth: number;
    readonly displayHeight: number;
    readonly aspect: number;
  };
  readonly renderTarget: {
    readonly width: number;
    readonly height: number;
  };
}

async function readManagedCanvasStatus(
  cwd: string,
): Promise<ManagedCanvasStatus> {
  const report = await callMcpTool("browser_canvas_status", {}, { cwd });
  const status = (
    report.structuredContent as {
      readonly status?: {
        readonly canvas?: unknown;
        readonly renderTarget?: unknown;
      };
    }
  ).status;
  const canvas = status?.canvas as ManagedCanvasStatus["canvas"] | undefined;
  const renderTarget = status?.renderTarget as
    | ManagedCanvasStatus["renderTarget"]
    | undefined;

  if (canvas === undefined || renderTarget === undefined) {
    throw new Error(
      `browser_canvas_status did not return canvas and renderTarget: ${JSON.stringify(
        report.structuredContent,
      )}`,
    );
  }

  return { canvas, renderTarget };
}

function firstEntityRef(content: unknown): Record<string, unknown> {
  const result = (
    content as {
      readonly result?: {
        readonly summaries?: readonly {
          readonly entity?: Record<string, unknown>;
        }[];
      };
    }
  ).result;
  const entity = result?.summaries?.[0]?.entity;

  if (entity === undefined) {
    throw new Error(
      `MCP result did not include an entity: ${JSON.stringify(content)}`,
    );
  }

  return entity;
}

async function listenOnPort(
  server: net.Server,
  host: string,
  port: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
}

async function closeServer(server: net.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

function portFromDevUpOutput(stdout: string): number {
  const match = /URL:\s+http:\/\/127\.0\.0\.1:(\d+)\//.exec(stdout);

  if (match === null) {
    throw new Error(`Could not find dev server URL in output:\n${stdout}`);
  }

  return Number(match[1]);
}

async function disableWebGpuInIndexHtml(appRoot: string): Promise<void> {
  const indexPath = path.join(appRoot, "index.html");
  const html = await readFile(indexPath, "utf8");
  const disableScript = [
    "<script>",
    "(() => {",
    "  const disable = (target) => {",
    "    try {",
    "      Object.defineProperty(target, 'gpu', { configurable: true, get: () => undefined });",
    "      return true;",
    "    } catch {",
    "      return false;",
    "    }",
    "  };",
    "  disable(navigator) || disable(Navigator.prototype);",
    "})();",
    "</script>",
  ].join("\n");

  await writeFile(
    indexPath,
    html.replace("</body>", `  ${disableScript}\n</body>`),
    "utf8",
  );
}

async function withManagedPage(
  cwd: string,
  callback: (page: Page) => Promise<void>,
): Promise<void> {
  const session = await readManagedSession(cwd);
  const cdpUrl = session.browser?.cdpUrl;

  if (typeof cdpUrl !== "string" || cdpUrl.length === 0) {
    throw new Error("Managed Aperture session does not expose a CDP URL.");
  }

  const browser = await chromium.connectOverCDP(cdpUrl);

  try {
    const pages = browser.contexts().flatMap((context) => context.pages());
    const page =
      pages.find((candidate) =>
        candidate.url().startsWith(session.url ?? ""),
      ) ?? pages[0];

    if (page === undefined) {
      throw new Error("Managed Aperture browser does not have an open page.");
    }

    await callback(page);
  } finally {
    await browser.close();
  }
}

async function killManagedBrowser(cwd: string): Promise<void> {
  const session = await readManagedSession(cwd);
  const pid = session.browser?.pid;

  if (typeof pid === "number" && Number.isInteger(pid) && pid > 0) {
    process.kill(pid, "SIGTERM");
    await waitForProcessExit(pid, 5_000);
    return;
  }

  const cdpUrl = session.browser?.cdpUrl;

  if (typeof cdpUrl !== "string" || cdpUrl.length === 0) {
    throw new Error("Managed Aperture session cannot identify a browser.");
  }

  const browser = await chromium.connectOverCDP(cdpUrl);

  try {
    const cdp = await browser.newBrowserCDPSession();
    await cdp.send("Browser.close");
  } finally {
    await browser.close().catch(() => undefined);
  }

  await waitForCdpExit(cdpUrl, 5_000);
}

async function readManagedSession(cwd: string): Promise<{
  readonly url?: string;
  readonly browser?: {
    readonly pid?: number | null;
    readonly cdpUrl?: string | null;
  };
}> {
  return JSON.parse(
    await readFile(path.join(cwd, ".aperture/runtime/session.json"), "utf8"),
  ) as {
    readonly url?: string;
    readonly browser?: {
      readonly pid?: number | null;
      readonly cdpUrl?: string | null;
    };
  };
}

async function waitForProcessExit(
  pid: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error(`Process ${pid} did not exit within ${timeoutMs}ms.`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { readonly code?: unknown }).code === "ESRCH"
    ) {
      return false;
    }

    return true;
  }
}

async function waitForCdpExit(
  cdpUrl: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isCdpAlive(cdpUrl))) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error(
    `CDP endpoint ${cdpUrl} did not close within ${timeoutMs}ms.`,
  );
}

async function isCdpAlive(cdpUrl: string): Promise<boolean> {
  try {
    const response = await fetch(new URL("/json/version", cdpUrl));
    await response.body?.cancel();

    return response.ok;
  } catch {
    return false;
  }
}

async function runCli(
  args: readonly string[],
  options: { readonly allowFailure?: boolean; readonly cwd?: string } = {},
): Promise<CommandResult> {
  try {
    return await execFileAsync(process.execPath, [CLI, ...args], {
      cwd: options.cwd ?? APP_ROOT,
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error: unknown) {
    if (options.allowFailure === true) {
      const output = error as {
        readonly stdout?: string;
        readonly stderr?: string;
      };

      return {
        stdout: output.stdout ?? "",
        stderr: output.stderr ?? "",
      };
    }

    throw error;
  }
}

async function runPnpm(
  args: readonly string[],
  cwd: string,
  timeout: number,
): Promise<CommandResult> {
  return execFileAsync("pnpm", args, {
    cwd,
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  options: { readonly cwd?: string } = {},
): Promise<{ readonly structuredContent?: unknown }> {
  const child = spawn(process.execPath, [CLI, "mcp", "stdio"], {
    cwd: options.cwd ?? APP_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  child.stdin.end(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    })}\n`,
  );

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => {
      child.kill("SIGKILL");
    }, 2_000).unref();
  }, MCP_TOOL_TIMEOUT_MS);
  const exitCode = await new Promise<number | null>((resolve) => {
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  if (timedOut) {
    throw new Error(
      `aperture mcp stdio timed out calling ${name} after ${MCP_TOOL_TIMEOUT_MS}ms.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  if (exitCode !== 0) {
    throw new Error(
      `aperture mcp stdio exited with ${exitCode}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }

  const line = stdout.trim().split("\n")[0];
  if (line === undefined || line.length === 0) {
    throw new Error(
      `aperture mcp stdio produced no output.\nstderr:\n${stderr}`,
    );
  }

  const message = JSON.parse(line) as {
    readonly result?: { readonly structuredContent?: unknown };
    readonly error?: unknown;
  };

  if (message.error !== undefined) {
    throw new Error(`MCP tool call failed: ${JSON.stringify(message.error)}`);
  }

  return {
    structuredContent: message.result?.structuredContent,
  };
}
