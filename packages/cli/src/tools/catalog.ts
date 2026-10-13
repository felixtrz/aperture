import {
  inputInjectionProperties,
  actionProperties,
  gamepadProperties,
} from "./input-schemas.js";
import { MAX_TOOL_STEP_FRAMES } from "./control-arguments.js";
import { APERTURE_REFERENCE_TOOL_CONTRACT } from "../reference.js";
import {
  entityReferenceSchema,
  entityMutationProperties,
  entityQueryProperties,
  entitySchemaProperties,
  entitySelectorProperties,
  entitySnapshotProperties,
} from "./entity-schemas.js";

export interface SharedMcpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly annotations: { readonly readOnlyHint: boolean };
  readonly _meta: {
    readonly aperture: { readonly targets: readonly string[] };
  };
  readonly inputSchema: {
    readonly type: "object";
    readonly properties?: Record<string, unknown>;
    readonly additionalProperties?: boolean;
    readonly required?: readonly string[];
  };
}

const HEADLESS_ONLY_TOOLS = new Set([
  "render_bundle",
  "session_snapshot_save",
  "session_snapshot_restore",
  "determinism_report",
  "command_dispatch",
  "viewport_pick",
]);
const READ_ONLY_TOOLS = new Set([
  "app_status",
  "app_capabilities",
  "ecs_find_entities",
  "ecs_get_entity",
  "ecs_query",
  "ecs_get_component_schema",
  "ecs_list_systems",
  "ecs_get_hierarchy",
  "asset_list",
  "asset_inspect",
  "resource_get",
  "input_get_state",
  "camera_list",
  "camera_get",
  "render_get_frame_report",
  "logs_read",
  "determinism_report",
  "viewport_pick",
]);

export const APERTURE_MCP_TOOL_CATALOG: readonly SharedMcpToolDefinition[] = [
  tool("app_status", "Read headed/headless session status.", {
    target: targetSchema(),
    waitUntilReady: { type: "boolean" },
    timeoutMs: { type: "number" },
    appRoot: { type: "string" },
  }),
  tool(
    "app_capabilities",
    "Discover supported tools and target routing without starting a session.",
    { target: targetSchema() },
  ),
  tool("app_start", "Start a headed or headless Aperture session.", {
    target: targetSchema(),
    appRoot: { type: "string" },
    config: { type: "string" },
    root: { type: "string" },
    publicDir: { type: "string" },
    seed: { type: "number" },
    assetMode: { enum: ["placeholder", "hybrid", "strict"] },
    allowHttpAssets: { type: "boolean" },
    decoderAssetsDir: { type: "string" },
    determinism: { enum: ["off", "warn", "error"] },
    port: { type: "number" },
    headless: { type: "boolean" },
    gpu: { enum: ["auto", "hardware", "software"] },
  }),
  tool("app_stop", "Stop a headed or headless Aperture session.", {
    target: targetSchema(),
    appRoot: { type: "string" },
  }),
  tool(
    "app_reset",
    "Reload the headed page or reload headless config, systems and dependencies in a fresh native Worker realm, then rebuild state. The old realm is drained, disposed and observed exited before the replacement boots.",
    {
      target: targetSchema(),
      appRoot: { type: "string" },
      seed: { type: "number" },
      waitUntilReady: { type: "boolean" },
      timeoutMs: { type: "number" },
    },
  ),
  tool(
    "ecs_step",
    "Advance authoritative simulation. Set untilQuiescent (headless target only) to step until the render digest stabilizes and queues drain (bounded by maxFrames, default 240); the result then carries a quiescence report.",
    sharedStepSchema(),
  ),
  tool(
    "ecs_find_entities",
    "Find ECS entities using exact keys, name patterns, components, tags and imported-source filters.",
    { ...sharedTargetSchema(), ...entityQueryProperties() },
  ),
  tool(
    "ecs_get_entity",
    "Read one ECS entity summary. Selector precedence: explicit entity/flat reference, piped summaries, key/namePattern, then the latest get result if successful, otherwise the first last-find result. Prefer explicit selectors for reproducible edits.",
    { ...sharedTargetSchema(), ...entitySelectorProperties() },
  ),
  tool(
    "ecs_query",
    "Run the same structured entity query as ecs_find_entities.",
    { ...sharedTargetSchema(), ...entityQueryProperties() },
  ),
  tool(
    "ecs_get_component_schema",
    "Inspect component schemas on active entities, including original field types/enums/defaults and mutation writable/read-only fields derived from the devtools allowlist.",
    { ...sharedTargetSchema(), ...entitySchemaProperties() },
  ),
  tool(
    "ecs_snapshot",
    "Capture an ECS summary snapshot, with optional filters or explicit entity references. The singular tag alias is not supported here; use tags.",
    { ...sharedTargetSchema(), ...entitySnapshotProperties() },
  ),
  tool(
    "ecs_diff",
    "Diff against the previous ECS snapshot and replace that checkpoint with the new snapshot. Requires a prior ecs_snapshot; use the same selection for comparable results.",
    { ...sharedTargetSchema(), ...entitySnapshotProperties() },
  ),
  tool(
    "ecs_list_systems",
    "List systems and schedule metadata.",
    sharedTargetSchema(),
  ),
  tool(
    "ecs_pause",
    "Pause headed simulation or no-op a headless slot.",
    sharedTargetSchema(),
  ),
  tool(
    "ecs_resume",
    "Resume headed simulation or no-op a headless slot.",
    sharedTargetSchema(),
  ),
  tool(
    "ecs_set_component_field",
    "Mutate one allowlisted ECS field. First inspect ecs_get_component_schema mutation.writableFields, then pass the whole field value. Requires the component already on the entity. Uses the same selector precedence as ecs_get_entity; read back after mutation.",
    { ...sharedTargetSchema(), ...entityMutationProperties() },
    ["component", "field", "value"],
  ),
  tool(
    "ecs_get_hierarchy",
    "Read derived ECS hierarchy.",
    sharedTargetSchema(),
  ),
  tool(
    "asset_list",
    "List configured assets and readiness.",
    sharedTargetSchema(),
  ),
  tool("asset_inspect", "Inspect glTF meshes and materials without a GPU.", {
    ...sharedTargetSchema(),
    id: { type: "string" },
  }),
  tool("resource_get", "Read initialized resources.", {
    ...sharedTargetSchema(),
    id: { type: "string" },
  }),
  tool("resource_set", "Patch initialized resources.", {
    ...sharedTargetSchema(),
    id: { type: "string" },
    values: { type: "object" },
  }),
  tool(
    "input_inject",
    "Apply normalized pointer, named actions, or gamepad input. Read input_get_state after stepping to verify queued events.",
    { ...sharedTargetSchema(), ...inputInjectionProperties() },
  ),
  tool(
    "input_action_set",
    "Queue one configured button or axis action; use pressed for buttons, value for axis1d, and x/y for axis2d.",
    { ...sharedTargetSchema(), ...actionProperties() },
    ["action"],
  ),
  tool(
    "input_gamepad_set",
    "Queue a standard gamepad snapshot using left/right {x,y}, axes, or a named button.",
    { ...sharedTargetSchema(), ...gamepadProperties() },
  ),
  tool("input_get_state", "Read generated input state.", sharedTargetSchema()),
  tool("input_reset", "Clear generated input state.", sharedTargetSchema()),
  tool("camera_list", "List ECS cameras.", sharedTargetSchema()),
  tool("camera_get", "Read ECS camera state.", cameraSelectorProperties()),
  tool("camera_save", "Save camera state in the session slot.", {
    ...cameraSelectorProperties(),
    slot: { type: "string", minLength: 1, default: "default" },
  }),
  tool("camera_restore", "Restore camera state in the session slot.", {
    ...cameraSelectorProperties(),
    slot: { type: "string", minLength: 1, default: "default" },
  }),
  tool("camera_create_agent", "Create or reuse an ECS agent camera.", {
    ...sharedTargetSchema(),
    key: { type: "string", minLength: 1, default: "camera.agent" },
    translation: tupleSchema(3),
    lookAt: lookAtSchema(),
  }),
  tool("camera_set_transform", "Set ECS camera transform.", {
    ...cameraSelectorProperties(),
    translation: tupleSchema(3),
    rotation: tupleSchema(4),
    scale: tupleSchema(3),
  }),
  tool(
    "camera_set_projection",
    "Atomically update ECS camera projection; fovYDegrees is in degrees. All fields and Float32 clip planes validate before any mutation.",
    {
      ...sharedTargetSchema(),
      key: { type: "string", minLength: 1 },
      entity: entityReferenceSchema(),
      projection: { enum: ["perspective", "orthographic"] },
      fovYDegrees: {
        type: "number",
        exclusiveMinimum: 0,
        exclusiveMaximum: 180,
      },
      near: { type: "number", exclusiveMinimum: 0 },
      far: { type: "number", exclusiveMinimum: 0 },
      orthographicHeight: { type: "number", exclusiveMinimum: 0 },
    },
  ),
  tool(
    "camera_look_at",
    "Aim ECS camera down -Z at lookAt [x,y,z]. target selects the headed/headless session.",
    {
      ...cameraSelectorProperties(),
      translation: tupleSchema(3),
      lookAt: lookAtSchema(),
    },
  ),
  tool(
    "camera_orbit",
    "Orbit ECS camera around a target.",
    cameraOrbitProperties(),
  ),
  tool(
    "camera_fit_entity",
    "Place a camera at an explicit radius from lookAt or an entity origin. Use key to select the camera when entity selects the subject. For a geometric bounds fit use camera_frame_entities.",
    cameraOrbitProperties(),
  ),
  tool(
    "camera_frame_entities",
    "Frame one or more ECS subjects and their descendant meshes using static world bounds. Uses camera.agent unless key/entity selects another unparented camera. Fits perspective/orthographic projection and clipping planes; returns bounds, selected meshes, distance, and approximation metadata. Reframe after viewport or geometry changes.",
    {
      ...sharedTargetSchema(),
      key: {
        type: "string",
        description: "Camera key (default camera.agent).",
      },
      entity: {
        type: "object",
        properties: {
          index: { type: "integer" },
          generation: { type: "integer" },
        },
        required: ["index", "generation"],
      },
      subjects: {
        type: "array",
        minItems: 1,
        maxItems: 256,
        items: {
          anyOf: [
            {
              type: "object",
              properties: { key: { type: "string", minLength: 1 } },
              required: ["key"],
            },
            {
              type: "object",
              properties: {
                index: { type: "integer", minimum: 0 },
                generation: { type: "integer", minimum: 0 },
              },
              required: ["index", "generation"],
            },
          ],
        },
      },
      includeDescendants: { type: "boolean", default: true },
      padding: {
        type: "number",
        minimum: 1,
        maximum: 100,
        default: 1.1,
        description: "Multiplicative screen-space margin.",
      },
      yawDegrees: { type: "number", default: 35 },
      pitchDegrees: {
        type: "number",
        exclusiveMinimum: -90,
        exclusiveMaximum: 90,
        default: 20,
      },
    },
    ["subjects"],
  ),
  tool(
    "camera_use_agent_view",
    "Promote a camera to primary render view.",
    cameraSelectorProperties(),
  ),
  tool(
    "frame_capture",
    "Capture the current frame as a PNG with metadata. width/height set the render size on the headless target; the headed target captures the live canvas at its natural size (a diagnostic reports any mismatch).",
    {
      target: targetSchema(),
      appRoot: { type: "string" },
      out: { type: "string" },
      bundleOut: { type: "string" },
      includeData: { type: "boolean" },
      width: { type: "number" },
      height: { type: "number" },
      allowPlaceholders: { type: "boolean" },
      waitUntilReady: { type: "boolean" },
      timeoutMs: { type: "number" },
      region: { enum: ["canvas", "viewport"] },
      samples: {
        type: "array",
        maxItems: 256,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            coordinateSpace: { enum: ["auto", "normalized", "pixel"] },
          },
          required: ["x", "y"],
        },
      },
    },
  ),
  tool(
    "render_diagnose",
    "Report output, active lighting, visible material compatibility, and actionable warnings for the current frame.",
    {
      target: targetSchema(),
      appRoot: { type: "string" },
      width: { type: "number" },
      height: { type: "number" },
      allowPlaceholders: { type: "boolean" },
    },
  ),
  tool(
    "render_get_frame_report",
    "Read the detailed latest submitted headed frame report.",
    {
      target: { enum: ["headed"] },
      appRoot: { type: "string" },
      summaryOnly: { type: "boolean" },
    },
  ),
  tool("logs_read", "Read recent headed/headless logs.", {
    target: targetSchema(),
    appRoot: { type: "string" },
    lines: { type: "number" },
  }),
  tool(
    "render_bundle",
    "Export the current headless frame as a render bundle.",
    {
      target: targetSchema(),
      out: { type: "string" },
      width: { type: "number" },
      height: { type: "number" },
      digest: { type: "boolean" },
      includeBundle: { type: "boolean" },
    },
  ),
  tool("session_snapshot_save", "Export a headless SessionSnapshot.", {
    target: targetSchema(),
    out: { type: "string" },
  }),
  tool("session_snapshot_restore", "Restore a headless SessionSnapshot.", {
    target: targetSchema(),
    path: { type: "string" },
  }),
  tool(
    "determinism_report",
    "Read headless determinism diagnostics and digests.",
    {
      target: targetSchema(),
    },
  ),
  tool(
    "command_dispatch",
    "Post an app command onto the headless command bus for systems to drain on the next step. Send `payload` as a structured JSON value (object/array); a JSON-encoded string payload is parsed back into a structured value and reported via a `commandPayloadCoerced` diagnostic.",
    {
      target: targetSchema(),
      channel: { type: "string" },
      payload: {
        description:
          "Structured command payload delivered to systems verbatim. JSON-object/array-shaped strings are parsed before enqueue.",
      },
    },
  ),
  tool(
    "viewport_pick",
    "Report what is at viewport (x, y) in the headless session via deterministic CPU bounds-ray picking against the extracted render snapshot — a machine-checkable viewport query for editor controls and placement checks, not pixel-perfect GPU picking. Coordinates default to pixels against the session render size (top-left origin); returns distance-sorted bounds hits with stable entity ids.",
    {
      target: targetSchema(),
      appRoot: { type: "string" },
      x: { type: "number" },
      y: { type: "number" },
      coordinateSpace: { enum: ["ndc", "pixels"] },
      viewId: { type: "number" },
      layerMask: { type: "number" },
      maxHits: { type: "number" },
    },
  ),
  ...APERTURE_REFERENCE_TOOL_CONTRACT.map((definition) =>
    tool(definition.name, definition.description, definition.properties ?? {}),
  ),
];

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required?: readonly string[],
): SharedMcpToolDefinition {
  return {
    name,
    description,
    annotations: {
      readOnlyHint: READ_ONLY_TOOLS.has(name) || name.startsWith("reference_"),
    },
    _meta: { aperture: { targets: toolTargets(name) } },
    inputSchema: {
      type: "object",
      properties,
      ...(required === undefined ? {} : { required }),
      additionalProperties: name !== "input_inject",
    },
  };
}

function sharedTargetSchema(): Record<string, unknown> {
  return { target: targetSchema(), appRoot: { type: "string" } };
}

function sharedStepSchema(): Record<string, unknown> {
  return {
    target: targetSchema(),
    appRoot: { type: "string" },
    frames: {
      type: "integer",
      minimum: 1,
      maximum: MAX_TOOL_STEP_FRAMES,
      default: 1,
    },
    delta: { type: "number", minimum: 0, default: 1 / 60 },
    time: { type: "number" },
    digest: { type: "boolean" },
    extract: { type: "boolean" },
    untilQuiescent: { type: "boolean" },
    maxFrames: {
      type: "integer",
      minimum: 1,
      maximum: MAX_TOOL_STEP_FRAMES,
      default: 240,
    },
  };
}

function targetSchema(): Record<string, unknown> {
  return { enum: ["headed", "headless"] };
}

function tupleSchema(length: number): Record<string, unknown> {
  return {
    type: "array",
    minItems: length,
    maxItems: length,
    items: { type: "number" },
  };
}
function cameraSelectorProperties(): Record<string, unknown> {
  return {
    ...sharedTargetSchema(),
    key: { type: "string", minLength: 1 },
    entity: entityReferenceSchema(),
    index: { type: "integer", minimum: 0 },
    generation: { type: "integer", minimum: 0 },
  };
}
function lookAtSchema(): Record<string, unknown> {
  return {
    ...tupleSchema(3),
    description:
      "World-space aim point. target is reserved for session routing.",
    default: [0, 0, 0],
  };
}
function cameraOrbitProperties(): Record<string, unknown> {
  return {
    ...cameraSelectorProperties(),
    lookAt: lookAtSchema(),
    radius: { type: "number", minimum: 0.1, default: 5 },
    yawDegrees: { type: "number", default: 35 },
    pitchDegrees: { type: "number", default: 20 },
  };
}
export function toolTargets(name: string): readonly string[] {
  if (name.startsWith("reference_")) return [];
  if (HEADLESS_ONLY_TOOLS.has(name)) return ["headless"];
  if (name === "render_get_frame_report") return ["headed"];
  return ["headed", "headless"];
}
