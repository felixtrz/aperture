import { describe, expect, it } from "vitest";
import path from "node:path";
import { PassThrough } from "node:stream";
import { runApertureMcpServer } from "../../packages/cli/src/mcp.js";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  createGeneratedEntityToolBridge,
  type GeneratedComponentSchemaReport,
} from "@aperture-engine/app/headless-tools";
import { listMutableComponentFields } from "@aperture-engine/app/entity-lookup";
import { AppEntitySource, material, mesh } from "@aperture-engine/app/systems";
import { Camera } from "@aperture-engine/render";
import {
  EcsType,
  LocalTransform,
  WorldTransform,
  defineComponent,
} from "@aperture-engine/simulation";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";

async function harness() {
  const app = await createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    }),
    systems: [],
  });
  const camera = app.context.spawn.camera({ key: "camera.main" });
  const target = app.context.spawn.mesh({
    key: "target",
    name: "Primary subject",
    tags: ["editable", "hero"],
    mesh: mesh.box({ size: 1 }),
    material: material.standard(),
  });
  target.addComponent(AppEntitySource, {
    kind: "gltf",
    assetId: "model",
    gltfNodeIndex: 2,
    gltfNodePath: "nodes[2]",
  });
  const bridge = createGeneratedEntityToolBridge(app.lowLevel.world);
  return { app, camera, target, bridge };
}
function schemas(result: unknown): GeneratedComponentSchemaReport {
  return result as GeneratedComponentSchemaReport;
}
function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

describe("machine-readable entity editing affordances", () => {
  it("reports writable fields from the existing allowlist without changing original schema metadata", async () => {
    const { app, bridge } = await harness();
    try {
      const allowlist = listMutableComponentFields();
      const report = schemas(
        bridge.call("ecs_get_component_schema", {}).result,
      );
      for (const schema of report.schemas) {
        const fields = Object.keys(schema.fields).sort();
        const allowed = Object.hasOwn(allowlist, schema.id)
          ? allowlist[schema.id]!
          : [];
        expect(schema.mutation).toEqual({
          tool: "ecs_set_component_field",
          supported: allowed.some((field) => fields.includes(field)),
          writableFields: fields.filter((field) => allowed.includes(field)),
          readOnlyFields: fields.filter((field) => !allowed.includes(field)),
          fieldPathSyntax: "literal-top-level-field",
        });
      }
      const camera = report.schemas.find((schema) => schema.id === Camera.id)!;
      expect(camera.fields).toEqual(Camera.schema);
      expect(camera.fields["projection"]).toEqual({
        type: "Enum",
        enum: { Perspective: "perspective", Orthographic: "orthographic" },
        default: "perspective",
      });
      expect(camera.mutation.writableFields).toHaveLength(10);
      expect(camera.mutation.readOnlyFields).toContain("autoAspect");
      expect(camera.mutation.readOnlyFields).toContain("projection");
      const transform = report.schemas.find(
        (schema) => schema.id === LocalTransform.id,
      )!;
      expect(transform.fields).toEqual(LocalTransform.schema);
      expect(transform.mutation.writableFields).toEqual([
        "rotation",
        "scale",
        "translation",
      ]);
      expect(
        report.schemas.find((schema) => schema.id === WorldTransform.id)
          ?.mutation.supported,
      ).toBe(false);
    } finally {
      await app.dispose();
    }
  });

  it("marks custom components read-only and preserves nested defaults and enum maps", async () => {
    const { app, target, bridge } = await harness();
    try {
      const Custom = defineComponent(
        "test.editingAffordance.custom",
        {
          mode: {
            type: EcsType.Enum,
            enum: { Warm: "warm", Cold: "cold" },
            default: "warm",
          },
          settings: {
            type: EcsType.Object,
            default: { offset: [1, 2, 3], nested: { enabled: true } },
          },
        },
        "Custom test metadata.",
      );
      app.lowLevel.world.registerComponent(Custom);
      target.addComponent(Custom);
      const report = schemas(
        bridge.call("ecs_get_component_schema", { component: Custom.id })
          .result,
      );
      expect(report.schemas).toEqual([
        {
          id: Custom.id,
          description: "Custom test metadata.",
          fields: Custom.schema,
          mutation: {
            tool: "ecs_set_component_field",
            supported: false,
            writableFields: [],
            readOnlyFields: ["mode", "settings"],
            fieldPathSyntax: "literal-top-level-field",
          },
        },
      ]);
      expect(
        bridge.call("ecs_set_component_field", {
          key: "target",
          component: Custom.id,
          field: "mode",
          value: "cold",
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [
          { code: "aperture.entityLookup.componentMutationUnsupported" },
        ],
      });
      expect(target.getValue(Custom, "mode")).toBe("warm");
    } finally {
      await app.dispose();
    }
  });

  it("does not infer mutable fields from Object.prototype names", async () => {
    const { app, target, bridge } = await harness();
    try {
      const Custom = defineComponent("toString", {
        value: { type: EcsType.String, default: "safe" },
      });
      app.lowLevel.world.registerComponent(Custom);
      target.addComponent(Custom);
      expect(
        schemas(
          bridge.call("ecs_get_component_schema", { component: Custom.id })
            .result,
        ).schemas[0]?.mutation,
      ).toMatchObject({
        supported: false,
        writableFields: [],
        readOnlyFields: ["value"],
      });
    } finally {
      await app.dispose();
    }
  });

  it("lets an agent discover a valid transform edit while readonly/nested paths remain rejected", async () => {
    const { app, camera, target, bridge } = await harness();
    try {
      const schema = schemas(
        bridge.call("ecs_get_component_schema", {
          component: LocalTransform.id,
        }).result,
      ).schemas[0]!;
      const field = schema.mutation.writableFields.find(
        (name) => name === "translation",
      )!;
      expect(
        bridge.call(schema.mutation.tool, {
          key: "target",
          component: schema.id,
          field,
          value: [2, 3, 4],
        }).ok,
      ).toBe(true);
      expect(bridge.call("ecs_get_entity", { key: "target" })).toMatchObject({
        result: { summary: { localTransform: { translation: [2, 3, 4] } } },
      });
      for (const badField of ["translation.x", "translation[0]"])
        expect(
          bridge.call("ecs_set_component_field", {
            key: "target",
            component: LocalTransform.id,
            field: badField,
            value: 99,
          }),
        ).toMatchObject({
          ok: false,
          diagnostics: [
            { code: "aperture.entityLookup.componentFieldUnsupported" },
          ],
        });
      expect([...target.getVectorView(LocalTransform, "translation")]).toEqual([
        2, 3, 4,
      ]);
      expect(
        bridge.call("ecs_set_component_field", {
          key: "camera.main",
          component: Camera.id,
          field: "autoAspect",
          value: false,
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [
          { code: "aperture.entityLookup.componentFieldUnsupported" },
        ],
      });
      expect(camera.getValue(Camera, "autoAspect")).toBe(true);
    } finally {
      await app.dispose();
    }
  });

  it("does not turn report data into mutation authority", async () => {
    const { app, camera, bridge } = await harness();
    try {
      const schema = schemas(
        bridge.call("ecs_get_component_schema", { id: Camera.id }).result,
      ).schemas[0]!;
      (schema.mutation.writableFields as string[]).push("autoAspect");
      expect(
        bridge.call("ecs_set_component_field", {
          key: "camera.main",
          component: Camera.id,
          field: "autoAspect",
          value: false,
        }).ok,
      ).toBe(false);
      expect(camera.getValue(Camera, "autoAspect")).toBe(true);
      expect(
        schemas(
          bridge.call("ecs_get_component_schema", { id: Camera.id }).result,
        ).schemas[0]?.mutation.writableFields,
      ).not.toContain("autoAspect");
    } finally {
      await app.dispose();
    }
  });

  it("publishes complete canonical query/edit arguments without inventing nested-field editing", () => {
    const tools = new ApertureMcpSessionManager({
      cwd: process.cwd(),
    }).toolDefinitions();
    const byName = (name: string) => tools.find((tool) => tool.name === name)!;
    const query = byName("ecs_find_entities").inputSchema;
    expect(query.properties).toHaveProperty("key");
    expect(query.properties).toHaveProperty("namePattern");
    expect(query.properties).toHaveProperty("withComponents");
    expect(query.properties).toHaveProperty("tag");
    expect(record(query.properties?.["limit"])["default"]).toBe(50);
    expect(
      record(record(query.properties?.["source"])["properties"])[
        "gltfNodePath"
      ],
    ).toMatchObject({ type: "string" });
    expect(
      record(record(query.properties?.["query"])["properties"]),
    ).toHaveProperty("tags");
    expect(byName("ecs_query").inputSchema).toEqual(query);
    const edit = byName("ecs_set_component_field").inputSchema;
    expect(edit.required).toEqual(["component", "field", "value"]);
    expect(edit.properties).toHaveProperty("entity");
    expect(edit.properties).toHaveProperty("key");
    expect(edit.properties).toHaveProperty("summaries");
    expect(record(edit.properties?.["field"])["description"]).toContain(
      "Dot paths",
    );
    expect(edit.additionalProperties).toBe(true);
    const snapshot = byName("ecs_snapshot").inputSchema;
    expect(snapshot.properties).not.toHaveProperty("tag");
    expect(snapshot.properties).toHaveProperty("entities");
    expect(snapshot.properties).toHaveProperty("label");
    expect(
      record(record(snapshot.properties?.["query"])["properties"]),
    ).not.toHaveProperty("label");
    expect(byName("ecs_diff").inputSchema).toEqual(snapshot);
  });

  it("matches published nested query/source semantics and snapshot outer labels", async () => {
    const { app, bridge } = await harness();
    try {
      expect(
        bridge.call("ecs_query", {
          key: "missing",
          query: {
            key: "target",
            namePattern: "^Primary",
            tag: "editable",
            tags: ["hero"],
            withComponents: [LocalTransform.id],
            source: {
              assetId: "model",
              gltfNodeIndex: 2,
              gltfNodePath: "nodes[2]",
            },
            limit: 1.9,
          },
        }),
      ).toMatchObject({
        ok: true,
        result: { summaries: [{ key: "target" }], total: 1 },
      });
      expect(
        bridge.call("ecs_query", { source: { gltfNodePath: "nodes.*" } }),
      ).toMatchObject({ result: { summaries: [] } });
      expect(
        bridge.call("ecs_query", { key: "target", limit: 0 }),
      ).toMatchObject({ result: { summaries: [], total: 1 } });
      expect(
        bridge.call("ecs_snapshot", {
          label: "outer",
          query: { key: "target", label: "ignored nested label" },
        }),
      ).toMatchObject({
        result: { label: "outer", summaries: [{ key: "target" }] },
      });
    } finally {
      await app.dispose();
    }
  });
  it("preserves runtime schema availability and component/id alias precedence", async () => {
    const { app, target, bridge } = await harness();
    try {
      expect(
        bridge.call("ecs_get_component_schema", { component: "not.present" }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.devtools.componentSchemaNotFound" }],
      });
      expect(
        schemas(
          bridge.call("ecs_get_component_schema", { id: Camera.id }).result,
        ).schemas,
      ).toHaveLength(1);
      const all = schemas(
        bridge.call("ecs_get_component_schema", {
          component: "",
          id: Camera.id,
        }).result,
      );
      expect(all.schemas.length).toBeGreaterThan(1);
      const Later = defineComponent("test.editingAffordance.later", {
        amount: { type: EcsType.Float32, default: 2 },
      });
      app.lowLevel.world.registerComponent(Later);
      expect(
        schemas(
          bridge.call("ecs_get_component_schema", {}).result,
        ).schemas.some((schema) => schema.id === Later.id),
      ).toBe(false);
      target.addComponent(Later);
      expect(
        schemas(
          bridge.call("ecs_get_component_schema", { component: Later.id })
            .result,
        ).schemas[0],
      ).toMatchObject({
        id: Later.id,
        fields: Later.schema,
        mutation: {
          supported: false,
          writableFields: [],
          readOnlyFields: ["amount"],
        },
      });
    } finally {
      await app.dispose();
    }
  });

  it("keeps numeric/quaternion validation in the existing write path", async () => {
    const { app, camera, target, bridge } = await harness();
    try {
      const cameraSchema = schemas(
        bridge.call("ecs_get_component_schema", { component: Camera.id })
          .result,
      ).schemas[0]!;
      expect(cameraSchema.mutation.writableFields).toContain("near");
      expect(
        bridge.call("ecs_set_component_field", {
          key: "camera.main",
          component: Camera.id,
          field: "near",
          value: -1,
        }).ok,
      ).toBe(false);
      expect(camera.getValue(Camera, "near")).toBeCloseTo(0.1);
      expect(
        bridge.call("ecs_set_component_field", {
          key: "target",
          component: LocalTransform.id,
          field: "rotation",
          value: [0, 0, 0, 0],
        }).ok,
      ).toBe(false);
      expect([...target.getVectorView(LocalTransform, "rotation")]).toEqual([
        0, 0, 0, 1,
      ]);
      expect(
        bridge.call("ecs_set_component_field", {
          key: "target",
          component: LocalTransform.id,
          field: "scale",
          value: [-2, 0, 3],
        }).ok,
      ).toBe(true);
      expect([...target.getVectorView(LocalTransform, "scale")]).toEqual([
        -2, 0, 3,
      ]);
    } finally {
      await app.dispose();
    }
  });

  it("carries schemas and editing affordances through the JSON-RPC MCP surface", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks: string[] = [];
    stdout.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    const done = runApertureMcpServer({ cwd: process.cwd(), stdin, stdout });
    const calls = [
      {
        name: "app_start",
        arguments: {
          target: "headless",
          config: path.resolve(
            "test/fixtures/headless-procedural/aperture.headless.config.ts",
          ),
        },
      },
      {
        name: "ecs_get_component_schema",
        arguments: { target: "headless", component: LocalTransform.id },
      },
      {
        name: "ecs_set_component_field",
        arguments: {
          target: "headless",
          key: "cube",
          component: LocalTransform.id,
          field: "translation",
          value: [2, 3, 4],
        },
      },
      {
        name: "ecs_get_entity",
        arguments: { target: "headless", key: "cube" },
      },
      {
        name: "ecs_get_component_schema",
        arguments: { target: "headless", component: Camera.id },
      },
      {
        name: "ecs_set_component_field",
        arguments: {
          target: "headless",
          key: "camera.main",
          component: Camera.id,
          field: "autoAspect",
          value: false,
        },
      },
      { name: "app_stop", arguments: { target: "headless" } },
    ];
    const requests = [
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      ...calls.map((params, index) => ({
        jsonrpc: "2.0",
        id: index + 2,
        method: "tools/call",
        params,
      })),
    ];
    stdin.end(
      requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
    );
    await done;
    const responses = chunks
      .join("")
      .trim()
      .split("\n")
      .map(
        (line) =>
          JSON.parse(line) as {
            error?: unknown;
            result: {
              isError?: boolean;
              tools?: readonly { name: string; inputSchema: unknown }[];
              structuredContent?: unknown;
            };
          },
      );
    expect(responses).toHaveLength(requests.length);
    expect(responses.every((response) => response.error === undefined)).toBe(
      true,
    );
    expect(
      responses[0]!.result.tools?.find(
        (tool) => tool.name === "ecs_set_component_field",
      )?.inputSchema,
    ).toMatchObject({ required: ["component", "field", "value"] });
    expect(responses[2]!.result.structuredContent).toMatchObject({
      ok: true,
      result: {
        schemas: [
          {
            id: LocalTransform.id,
            mutation: { writableFields: ["rotation", "scale", "translation"] },
          },
        ],
      },
    });
    expect(responses[4]!.result.structuredContent).toMatchObject({
      ok: true,
      result: { summary: { localTransform: { translation: [2, 3, 4] } } },
    });
    expect(responses[5]!.result.structuredContent).toMatchObject({
      result: {
        schemas: [
          {
            mutation: {
              readOnlyFields: expect.arrayContaining(["autoAspect"]),
            },
          },
        ],
      },
    });
    expect(responses[6]!.result).toMatchObject({
      structuredContent: {
        ok: false,
        diagnostics: [
          { code: "aperture.entityLookup.componentFieldUnsupported" },
        ],
      },
    });
  }, 60_000);
  it("matches documented selector history after a failed latest get", async () => {
    const { app, bridge } = await harness();
    try {
      expect(bridge.call("ecs_get_entity", { key: "target" }).ok).toBe(true);
      expect(bridge.call("ecs_find_entities", { key: "camera.main" }).ok).toBe(
        true,
      );
      expect(bridge.call("ecs_get_entity", { key: "missing" }).ok).toBe(false);
      expect(bridge.call("ecs_get_entity", {})).toMatchObject({
        ok: true,
        result: { summary: { key: "camera.main" } },
      });
    } finally {
      await app.dispose();
    }
  });
});
