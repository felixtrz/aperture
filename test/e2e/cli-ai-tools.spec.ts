import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import { promisify } from "node:util";
import path from "node:path";
import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);
const CLI = path.resolve("packages/cli/dist/bin/aperture.js");
const APP_ROOT = path.resolve("examples/developer-api");
const PORT = 5187;
const CREATED_APP_PORT = 5193;
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

    const consoleLogs = await callMcpTool("browser_console_logs", {
      lines: 10,
    });
    expect(consoleLogs.structuredContent).toMatchObject({
      ok: true,
      logs: expect.any(String),
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

    const referenceBuild = await runCli(["reference", "build"]);
    expect(referenceBuild.stdout).toContain("Built Aperture reference index");

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

    const referenceBuild = await runCli(["reference", "build"], {
      cwd: appRoot,
    });
    expect(referenceBuild.stdout).toContain("Built Aperture reference index");
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

interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
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
