import {
  packShaderBuffer,
  validateShaderJob,
  ShaderError,
  type ShaderDiagnostic,
  type ShaderValue,
  type ShaderBufferLayout,
} from "@aperture-engine/shader";
import { withGpuDeviceLock } from "./device-lock.js";
import {
  createFrameGraph,
  type PassWrite,
  type ResourceHandleDescriptor,
} from "./render/graph/frame-graph.js";
import {
  compileFrameGraph,
  type FrameGraphCompileReportJsonValue,
} from "./render/graph/frame-graph-compile.js";
import {
  executeFrameGraph,
  type ExecuteFrameGraphOptions,
  type FrameGraphRenderNodeBoundary,
} from "./render/graph/frame-graph-execute.js";
import { createRenderPassAttachmentPlan } from "./render/passes/render-pass-attachments.js";
import type { RenderPassCommand } from "./render/passes/render-pass-commands.js";
import type { ComputePassCommand } from "./render/passes/compute-pass-commands.js";
import type { WebGpuOutputTarget } from "./gpu/output-target.js";
import {
  GpuResources,
  OUTPUT_RESOURCE,
  type GpuResourceInspection,
  type GpuResourceSource,
  type GpuResourceRef,
  type ImportGpuBufferOptions,
  type ImportGpuTextureOptions,
} from "./resources.js";
import {
  prepareGpuOperation,
  inspectPipelineCache,
  operationCommands,
  type GpuOperation,
  type GpuOperationDescriptor,
  type PreparedOperation,
  type OperationEnvironment,
  type GpuFrameInput,
  type GpuDrawDescriptor,
  type GpuComputeDescriptor,
  type ResolvedGpuFrameInput,
} from "./operations.js";

export interface GpuFrameReport {
  readonly frame: number;
  readonly graph: FrameGraphCompileReportJsonValue;
  readonly submittedCommandBuffers: number;
  readonly cpuEncodeMs: number;
  readonly diagnostics: readonly ShaderDiagnostic[];
}
export interface PortableGpuFrame {
  readonly input: GpuFrameInput;
  readonly operations: readonly GpuOperationDescriptor[];
  readonly writes: readonly {
    readonly resource: string;
    readonly offset: number;
    readonly data: Uint8Array<ArrayBuffer>;
  }[];
}
/** Decoded envelope. CLI/browser adapters use the shared typed-array JSON codec. */
export interface GpuShaderJob {
  readonly format: "aperture.shader-job";
  readonly version: 1;
  readonly width: number;
  readonly height: number;
  readonly resources: readonly GpuResourceSource[];
  readonly frames: readonly PortableGpuFrame[];
}
export interface GpuContextOptions {
  readonly device: GPUDevice;
  readonly output: WebGpuOutputTarget & {
    resize?: (width: number, height: number) => void;
  };
  readonly maxBytes?: number;
  /** Capture is opt-in: record declarative frames for deterministic replay. */
  readonly record?: boolean;
  readonly maxRecordedFrames?: number;
}
export interface GpuContext {
  resource(source: GpuResourceSource): void;
  importBuffer(options: ImportGpuBufferOptions): void;
  importTexture(options: ImportGpuTextureOptions): void;
  effect(descriptor: Omit<GpuDrawDescriptor, "kind">): Promise<GpuOperation>;
  draw(descriptor: Omit<GpuDrawDescriptor, "kind">): Promise<GpuOperation>;
  compute(
    descriptor: Omit<GpuComputeDescriptor, "kind">,
  ): Promise<GpuOperation>;
  frame(input?: GpuFrameInput): Promise<GpuFrameReport>;
  writeBuffer(id: string, data: Uint8Array<ArrayBuffer>, offset?: number): void;
  readBuffer(
    id: string,
    offset?: number,
    size?: number,
  ): Promise<Uint8Array<ArrayBuffer>>;
  resize(width: number, height: number): void;
  reset(): void;
  inspect(): {
    readonly resources: readonly GpuResourceInspection[];
    readonly operations: readonly GpuOperationDescriptor[];
    readonly deviceFeatures: readonly string[];
    readonly pipelineCount: number;
    readonly frame: number;
  };
  capture(): GpuShaderJob;
  dispose(): Promise<void>;
}

/** Borrows a device/output. All operations record into Aperture's existing
 * graph executor, which owns the one command submission for a program frame. */
export function createGpuContext(options: GpuContextOptions): GpuContext {
  const { device, output } = options;
  const resources = new GpuResources(
    device,
    output.width,
    output.height,
    options.maxBytes,
  );
  const environment: OperationEnvironment = {
    device,
    resources,
    outputFormat: output.format as GPUTextureFormat,
  };
  const operations = new Map<string, PreparedOperation>();
  const retired = new Set<PreparedOperation>();
  const pending = new Set<Promise<unknown>>();
  const frames: PortableGpuFrame[] = [];
  let writes: PortableGpuFrame["writes"][number][] = [];
  let inFlight: Promise<GpuFrameReport> | null = null;
  let disposal: Promise<void> | null = null;
  let disposed = false,
    frameIndex = 0;
  let captureInvalid = false;
  const discarded = new Set<string>();
  const loss = observeDeviceLoss(device);
  let width = output.width,
    height = output.height;
  const assertOpen = (): void => {
    if (disposed) throw new Error("GPU context is disposed.");
    if (loss.message !== null)
      throw new Error(`GPU device lost: ${loss.message}`);
  };
  const assertIdle = (): void => {
    assertOpen();
    if (inFlight !== null)
      throw new Error(
        "Await the current frame before changing GPU resources or parameters.",
      );
  };
  const track = <T>(promise: Promise<T>): Promise<T> => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      () => pending.delete(promise),
    );
    return promise;
  };
  const retire = (operation: PreparedOperation): void => {
    retired.add(operation);
  };
  async function add(
    descriptor: GpuOperationDescriptor,
  ): Promise<GpuOperation> {
    assertIdle();
    if (operations.has(descriptor.name))
      throw new Error(
        `Operation '${descriptor.name}' already exists; use replace().`,
      );
    const prepared = await withGpuDeviceLock(device, () =>
      prepareGpuOperation(environment, descriptor),
    );
    if (disposed || operations.has(descriptor.name)) {
      prepared.dispose();
      throw new Error("Context changed while preparing an operation.");
    }
    operations.set(descriptor.name, prepared);
    const current = (): PreparedOperation => {
      assertOpen();
      const value = operations.get(descriptor.name);
      if (value === undefined)
        throw new Error(`Operation '${descriptor.name}' was removed.`);
      return value;
    };
    return {
      name: descriptor.name,
      parameters(values) {
        assertIdle();
        const operation = current();
        operation.descriptor = descriptorWithParameters(
          operation.descriptor,
          values,
        );
      },
      replace(shader, parameters = {}) {
        assertIdle();
        return track(
          (async () => {
            const previous = current();
            const diagnostics: ShaderDiagnostic[] = [];
            let replacement: PreparedOperation | undefined;
            try {
              const candidate = descriptorWithParameters(
                { ...previous.descriptor, shader },
                parameters,
                true,
                diagnostics,
              );
              replacement = await withGpuDeviceLock(device, () =>
                prepareGpuOperation(environment, candidate),
              );
              if (disposed || operations.get(descriptor.name) !== previous) {
                throw new Error("Operation changed during shader replacement.");
              }
              // Await a frame started while compilation was in progress before swapping.
              await inFlight;
              if (disposed || operations.get(descriptor.name) !== previous) {
                throw new Error("Operation changed during shader replacement.");
              }
              if (previous.descriptor.shader.layoutHash !== shader.layoutHash) {
                // Reset is transactional and may fail to allocate. Complete it
                // before publishing the replacement or invalidating capture.
                resources.resetHistory();
                frames.length = 0;
                frameIndex = 0;
                captureInvalid = true;
              }
              operations.set(descriptor.name, replacement);
              replacement = undefined;
              retire(previous);
              return { ok: true, diagnostics };
            } catch (error) {
              replacement?.dispose();
              return {
                ok: false,
                diagnostics: [...diagnostics, ...diagnosticsFromError(error)],
              };
            }
          })(),
        );
      },
      remove() {
        assertIdle();
        const operation = current();
        operations.delete(descriptor.name);
        retire(operation);
      },
    };
  }
  const context: GpuContext = {
    resource(source) {
      assertIdle();
      if (frames.length > 0)
        throw new Error(
          "Add resources before recording frames, or reset first.",
        );
      resources.create(source);
    },
    importBuffer(imported) {
      assertIdle();
      resources.importBuffer(imported);
    },
    importTexture(imported) {
      assertIdle();
      resources.importTexture(imported);
    },
    effect: (descriptor) => track(add({ ...descriptor, kind: "effect" })),
    draw: (descriptor) => track(add({ ...descriptor, kind: "draw" })),
    compute: (descriptor) => track(add({ ...descriptor, kind: "compute" })),
    frame(input = {}) {
      assertIdle();
      const snapshot = structuredClone(input);
      if (pending.size > 0)
        throw new Error(
          "Await operation preparation and readback before starting a frame.",
        );
      const descriptors = options.record
        ? [...operations.values()].map((operation) =>
            structuredClone(operation.descriptor),
          )
        : [];
      const frameWrites = writes;
      if (
        options.record &&
        frames.length >= (options.maxRecordedFrames ?? 4096)
      )
        throw new Error(
          "Capture replay limit reached; capture and reset before more frames.",
        );
      inFlight = withGpuDeviceLock(device, () => render(snapshot))
        .then((report) => {
          if (options.record)
            frames.push({
              input: snapshot,
              operations: descriptors,
              writes: frameWrites,
            });
          // Failed graph preparation leaves the live buffers written. Retain
          // these writes until a completed frame records them for replay.
          writes = [];
          return report;
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    writeBuffer(id, data, offset = 0) {
      assertIdle();
      resources.writeBuffer(id, data, offset);
      if (options.record)
        writes.push({ resource: id, offset, data: data.slice() });
    },
    readBuffer(id, offset, size) {
      assertIdle();
      return track(resources.readBuffer(id, offset, size));
    },
    resize(w, h) {
      assertIdle();
      if (
        ![w, h].every(
          (value) =>
            Number.isSafeInteger(value) &&
            value > 0 &&
            value <= device.limits.maxTextureDimension2D,
        )
      )
        throw new Error("Invalid output dimensions.");
      if (output.resize === undefined) {
        if (output.width !== w || output.height !== h)
          throw new Error(
            "Resize the borrowed output before resizing the context.",
          );
      }
      resources.resize(w, h, () => output.resize?.(w, h), true);
      width = w;
      height = h;
      frames.length = 0;
      frameIndex = 0;
      writes = [];
      captureInvalid = false;
      discarded.clear();
    },
    reset() {
      assertIdle();
      resources.reset();
      frameIndex = 0;
      frames.length = 0;
      writes = [];
      captureInvalid = false;
      discarded.clear();
    },
    inspect() {
      assertOpen();
      return {
        resources: resources.inspect(),
        operations: [...operations.values()].map((operation) =>
          structuredClone(operation.descriptor),
        ),
        deviceFeatures: [...device.features].sort(),
        pipelineCount: inspectPipelineCache(environment),
        frame: frameIndex,
      };
    },
    capture() {
      assertIdle();
      if (captureInvalid)
        throw new Error(
          "Reset before capturing after a layout change or external output resize.",
        );
      if (!options.record || frames.length === 0)
        throw new Error(
          "Portable capture requires record:true and at least one completed frame.",
        );
      const inspection = resources.inspect();
      if (inspection.some((resource) => !resource.owned))
        throw new Error(
          "Portable capture cannot serialize raw imported GPU resources; use declared initial contents and replayable writes.",
        );
      return structuredClone({
        format: "aperture.shader-job",
        version: 1,
        width,
        height,
        resources: inspection.map((resource) => resource.descriptor),
        frames,
      });
    },
    dispose() {
      if (disposal !== null) return disposal;
      disposed = true;
      disposal = (async () => {
        await Promise.allSettled([
          ...pending,
          ...(inFlight === null ? [] : [inFlight]),
        ]);
        try {
          if (loss.message === null) await device.queue.onSubmittedWorkDone();
        } finally {
          for (const operation of [...operations.values(), ...retired])
            operation.dispose();
          operations.clear();
          retired.clear();
          resources.dispose();
          frames.length = 0;
        }
      })();
      return disposal;
    },
  };
  async function render(input: GpuFrameInput): Promise<GpuFrameReport> {
    await resources.synchronize();
    if (loss.message !== null)
      throw new Error(`GPU device lost: ${loss.message}`);
    if (output.width !== width || output.height !== height) {
      resources.resize(output.width, output.height);
      discarded.clear();
      width = output.width;
      height = output.height;
      frameIndex = 0;
      frames.length = 0;
      captureInvalid = true;
    }
    const frame: ResolvedGpuFrameInput = {
      ...input,
      frame: frameIndex,
      width,
      height,
    };
    const started = performance.now();
    const graph = createFrameGraph();
    const boundaries = new Map<string, FrameGraphRenderNodeBoundary>();
    const versions = new Map<string, string>();
    let previous: string | undefined;
    let outputTexture: GPUTexture | undefined;
    const texture = (): GPUTexture =>
      (outputTexture ??= output.acquire() as GPUTexture);
    const resourceDescriptor = (
      ref: GpuResourceRef,
      initial: boolean,
    ): ResourceHandleDescriptor => {
      if (ref.resource === OUTPUT_RESOURCE)
        return {
          kind: "swapchain",
          lifetime: "imported",
          initialized: !initial,
        };
      const source = resources.source(ref.resource);
      if (source.kind !== "texture")
        return { kind: "buffer", lifetime: "persistent" };
      return {
        kind: source.format.startsWith("depth")
          ? "depth-texture"
          : source.lifetime === "history"
            ? "history-texture"
            : "color-texture",
        lifetime: source.lifetime === "transient" ? "transient" : "persistent",
        initialized: !initial || source.lifetime !== "transient",
        format: source.format,
        sampleCount: source.sampleCount ?? 1,
        width: source.width ?? width,
        height: source.height ?? height,
        ...(source.lifetime === "history" ? { history: true } : {}),
      };
    };
    const physicalKeys = (ref: GpuResourceRef): string[] => {
      if (ref.resource === OUTPUT_RESOURCE) return [OUTPUT_RESOURCE];
      const source = resources.source(ref.resource);
      const identity = resources.key({
        resource: ref.resource,
        ...(ref.history === undefined ? {} : { history: ref.history }),
      });
      if (source.kind !== "texture") return [identity];
      return Array.from(
        { length: ref.layerCount ?? 1 },
        (_, index) =>
          `${identity}:mip${ref.mipLevel ?? 0}:layer${(ref.layer ?? 0) + index}`,
      );
    };
    const nextDiscarded = new Set(discarded);
    const read = (ref: GpuResourceRef): string[] =>
      physicalKeys(ref).map((physical) => {
        let handle = versions.get(physical);
        if (handle === undefined) {
          handle = `${physical}:initial`;
          graph.declareResource({
            id: handle,
            descriptor: {
              ...resourceDescriptor(ref, true),
              ...(discarded.has(physical) ? { initialized: false } : {}),
            },
          });
          versions.set(physical, handle);
        }
        return handle;
      });
    device.pushErrorScope("validation");
    let failure: unknown, report: GpuFrameReport | undefined;
    try {
      for (const operation of operations.values()) {
        const descriptor = operation.descriptor;
        const commands = operationCommands(environment, operation, frame);
        const reads = operation.reads.flatMap(read);
        if (descriptor.kind !== "compute") {
          for (const attachment of [
            ...(descriptor.targets ?? [{ resource: OUTPUT_RESOURCE }]),
            ...(descriptor.depth === undefined ? [] : [descriptor.depth]),
          ])
            if ("load" in attachment && attachment.load === "load")
              reads.push(...read(attachment));
        }
        const writes: PassWrite[] = operation.writes.flatMap((ref, index) =>
          physicalKeys(ref).map((physical) => {
            const id = `${descriptor.name}:${index}:${physical}`;
            graph.declareResource({
              id,
              descriptor: resourceDescriptor(ref, false),
            });
            versions.set(physical, id);
            const attachment =
              descriptor.kind === "compute"
                ? undefined
                : [
                    ...(descriptor.targets ?? []),
                    ...(descriptor.depth === undefined
                      ? []
                      : [descriptor.depth]),
                  ].find((target) => physicalKeys(target).includes(physical));
            if (attachment?.store === "discard") nextDiscarded.add(physical);
            else nextDiscarded.delete(physical);
            return {
              handle: id,
              attachment: attachment?.load ?? "clear",
              store: attachment?.store ?? "store",
            };
          }),
        );
        const common = {
          name: descriptor.name,
          reads,
          writes,
          ...(previous === undefined ? {} : { after: previous }),
        };
        if (descriptor.kind === "compute")
          graph.addComputePass({
            ...common,
            commands: commands as readonly ComputePassCommand[],
          });
        else {
          const targets = descriptor.targets ?? [{ resource: OUTPUT_RESOURCE }];
          const attachments = createRenderPassAttachmentPlan({
            colorTargets: targets.map((target) => ({
              view:
                target.resource === OUTPUT_RESOURCE
                  ? texture().createView()
                  : resources.view(target, "attachment"),
              loadOp: target.load ?? "clear",
              storeOp: target.store ?? "store",
              clearColor: target.clear ?? [0, 0, 0, 0],
              ...(target.resolve === undefined
                ? {}
                : {
                    resolveTarget:
                      target.resolve.resource === OUTPUT_RESOURCE
                        ? texture().createView()
                        : resources.view(target.resolve, "attachment"),
                  }),
            })),
            ...(descriptor.depth === undefined
              ? {}
              : {
                  depthTarget: {
                    view: resources.view(descriptor.depth, "attachment"),
                    depthLoadOp: descriptor.depth.load ?? "clear",
                    depthStoreOp: descriptor.depth.store ?? "store",
                    depthClearValue: descriptor.depth.clear ?? 1,
                    depthReadOnly: descriptor.depth.readOnly ?? false,
                  },
                }),
          });
          boundaries.set(descriptor.name, {
            device: device as unknown as ExecuteFrameGraphOptions["device"],
            attachments,
            commands: commands as readonly RenderPassCommand[],
            label: descriptor.name,
            colorTargetSource: "offscreen-target",
          });
          graph.addRenderPass({
            ...common,
            commands: commands as readonly RenderPassCommand[],
          });
        }
        previous = descriptor.name;
      }
      const compiled = compileFrameGraph(graph);
      if (!compiled.ok)
        throw new Error(
          compiled.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join("\n"),
        );
      const execution = executeFrameGraph({
        device: device as unknown as ExecuteFrameGraphOptions["device"],
        queue: device.queue as unknown as ExecuteFrameGraphOptions["queue"],
        compiled,
        resources: {
          resolveAttachment: () => null,
          resolveRenderBoundary: (node) => boundaries.get(node.name) ?? null,
        },
      });
      if (!execution.valid)
        throw new Error(
          `GPU graph execution failed: ${JSON.stringify(execution.diagnostics)}`,
        );
      report = {
        frame: frameIndex,
        graph: compiled.report,
        submittedCommandBuffers: execution.submit?.submitted ?? 0,
        cpuEncodeMs: performance.now() - started,
        diagnostics: [],
      };
    } catch (error) {
      failure = error;
    } finally {
      const validation = await device.popErrorScope();
      if (validation !== null && failure === undefined)
        failure = new Error(validation.message);
    }
    if (failure !== undefined) throw failure;
    discarded.clear();
    for (const key of nextDiscarded) discarded.add(key);
    resources.flipHistory();
    frameIndex++;
    // Previously submitted work retains its resources until the queue completes.
    if (retired.size > 0) {
      await device.queue.onSubmittedWorkDone();
      for (const operation of retired) operation.dispose();
      retired.clear();
    }
    return report!;
  }
  return context;
}

function diagnosticsFromError(error: unknown): readonly ShaderDiagnostic[] {
  return error instanceof ShaderError
    ? error.diagnostics
    : [
        {
          code: "aperture.gpu.operationFailed",
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      ];
}

function descriptorWithParameters(
  descriptor: GpuOperationDescriptor,
  values: Readonly<Record<string, ShaderValue>>,
  migrate = false,
  diagnostics: ShaderDiagnostic[] = [],
): GpuOperationDescriptor {
  const bindings = structuredClone(descriptor.bindings ?? {}) as Record<
    string,
    NonNullable<GpuOperationDescriptor["bindings"]>[string]
  >;
  for (const [name, value] of Object.entries(values)) {
    const contract = descriptor.shader.bindings.find(
      (binding) => binding.name === name,
    );
    if (
      contract?.kind !== "uniform-buffer" ||
      contract.layout === undefined ||
      (bindings[name] !== undefined && "resource" in bindings[name]!)
    )
      throw new Error(`'${name}' is not an inline uniform parameter.`);
    bindings[name] = {
      uniform: migrateValue(
        contract.layout,
        "uniform" in (bindings[name] ?? {})
          ? (bindings[name] as { uniform: ShaderValue }).uniform
          : undefined,
        value,
        name,
        diagnostics,
      ),
    };
  }
  for (const [name, binding] of Object.entries(bindings)) {
    const contract = descriptor.shader.bindings.find(
      (binding) => binding.name === name,
    );
    if (contract === undefined && migrate) {
      delete bindings[name];
      diagnostics.push({
        severity: "warning",
        code: "aperture.shader.parameterRemoved",
        message: `Binding '${name}' was removed by the shader change.`,
      });
      continue;
    }
    if ("uniform" in binding) {
      if (contract?.kind !== "uniform-buffer" || contract.layout === undefined)
        throw new Error(
          `'${name}' is no longer an inline uniform parameter; supply a compatible binding.`,
        );
      const value = migrate
        ? migrateValue(
            contract.layout,
            binding.uniform,
            undefined,
            name,
            diagnostics,
          )
        : binding.uniform;
      packShaderBuffer(contract.layout, value);
      bindings[name] = { uniform: value };
    }
  }
  return { ...descriptor, bindings };
}
function migrateValue(
  layout: ShaderBufferLayout,
  previous: ShaderValue | undefined,
  supplied: ShaderValue | undefined,
  path: string,
  diagnostics: ShaderDiagnostic[],
): ShaderValue {
  if (layout.kind !== "struct") {
    const value = supplied ?? previous;
    if (value === undefined)
      throw new Error(
        `Parameter '${path}' needs a value after the shader change.`,
      );
    packShaderBuffer(layout, value);
    return structuredClone(value);
  }
  const record = (
    value: ShaderValue | undefined,
  ): Readonly<Record<string, ShaderValue>> =>
    value !== undefined && typeof value === "object" && !Array.isArray(value)
      ? (value as Readonly<Record<string, ShaderValue>>)
      : {};
  const old = record(previous),
    next = record(supplied);
  for (const name of Object.keys(next))
    if (!layout.fields.some((field) => field.name === name))
      throw new Error(`Unknown parameter '${path}.${name}'.`);
  for (const name of Object.keys(old))
    if (!layout.fields.some((field) => field.name === name))
      diagnostics.push({
        severity: "warning",
        code: "aperture.shader.parameterRemoved",
        message: `Parameter '${path}.${name}' cannot migrate and was removed.`,
      });
  return Object.fromEntries(
    layout.fields.map((field) => [
      field.name,
      migrateValue(
        field.layout,
        old[field.name],
        next[field.name],
        `${path}.${field.name}`,
        diagnostics,
      ),
    ]),
  );
}

export async function renderShaderJob(
  job: GpuShaderJob,
  options: GpuContextOptions,
): Promise<{
  readonly context: GpuContext;
  readonly reports: readonly GpuFrameReport[];
}> {
  validateShaderJob(job);
  const context = createGpuContext(options),
    reports: GpuFrameReport[] = [];
  const handles = new Map<
    string,
    { descriptor: string; operation: GpuOperation }
  >();
  try {
    for (const resource of job.resources) context.resource(resource);
    for (const frame of job.frames as readonly PortableGpuFrame[]) {
      const previous = [...handles.values()].map((handle) => handle.descriptor);
      const next = frame.operations.map((descriptor) =>
        JSON.stringify(descriptor),
      );
      if (JSON.stringify(previous) !== JSON.stringify(next)) {
        for (const handle of handles.values()) handle.operation.remove();
        handles.clear();
        for (const descriptor of frame.operations) {
          const operation =
            descriptor.kind === "compute"
              ? await context.compute(descriptor)
              : descriptor.kind === "effect"
                ? await context.effect(descriptor)
                : await context.draw(descriptor);
          handles.set(descriptor.name, {
            descriptor: JSON.stringify(descriptor),
            operation,
          });
        }
      }
      for (const write of frame.writes)
        context.writeBuffer(write.resource, write.data, write.offset);
      reports.push(await context.frame(frame.input));
    }
    return { context, reports };
  } catch (error) {
    await context.dispose();
    throw error;
  }
}

const deviceLossStates = new WeakMap<GPUDevice, { message: string | null }>();
function observeDeviceLoss(device: GPUDevice): { message: string | null } {
  let state = deviceLossStates.get(device);
  if (state === undefined) {
    state = { message: null };
    deviceLossStates.set(device, state);
    const target = state;
    void device.lost.then((info) => {
      target.message = info.message || info.reason;
    });
  }
  return state;
}
