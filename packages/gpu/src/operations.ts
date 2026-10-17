import {
  mapShaderDiagnostic,
  packShaderBuffer,
  ShaderError,
  type ShaderArtifact,
  type ShaderBinding,
  type ShaderDiagnostic,
  type ShaderValue,
} from "@aperture-engine/shader";
import {
  type GpuResources,
  OUTPUT_RESOURCE,
  resourceRangesOverlap,
  type GpuResourceRef,
} from "./resources.js";
import type { RenderPassCommand } from "./render/passes/render-pass-commands.js";
import type { ComputePassCommand } from "./render/passes/compute-pass-commands.js";

export type GpuBindingInput =
  | GpuResourceRef
  | { readonly uniform: ShaderValue }
  | { readonly input: string }
  | { readonly frame: true };
export interface GpuAttachment extends GpuResourceRef {
  readonly load?: "clear" | "load";
  readonly store?: "store" | "discard";
  readonly clear?: readonly [number, number, number, number];
  readonly resolve?: GpuResourceRef;
}
export interface GpuDepthAttachment extends GpuResourceRef {
  readonly load?: "clear" | "load";
  readonly store?: "store" | "discard";
  readonly clear?: number;
  readonly readOnly?: boolean;
  readonly compare?: GPUCompareFunction;
  readonly write?: boolean;
}
interface BaseOperation {
  readonly name: string;
  readonly shader: ShaderArtifact;
  readonly bindings?: Readonly<Record<string, GpuBindingInput>>;
  readonly constants?: Readonly<Record<string, number>>;
}
export interface GpuComputeDescriptor extends BaseOperation {
  readonly kind: "compute";
  readonly entry?: string;
  readonly dispatch: readonly [number, number?, number?] | GpuResourceRef;
}
export interface GpuDrawDescriptor extends BaseOperation {
  readonly kind: "draw" | "effect";
  readonly vertexEntry?: string;
  readonly fragmentEntry?: string;
  readonly targets?: readonly GpuAttachment[];
  readonly depth?: GpuDepthAttachment;
  readonly vertexCount?: number;
  readonly instanceCount?: number;
  readonly vertices?: readonly (GpuResourceRef & {
    readonly layout: GPUVertexBufferLayout;
  })[];
  readonly indices?: GpuResourceRef & {
    readonly format: GPUIndexFormat;
    readonly count: number;
  };
  readonly indirect?: GpuResourceRef;
  readonly primitive?: GPUPrimitiveState;
  readonly blend?: GPUBlendState;
}
export type GpuOperationDescriptor = GpuComputeDescriptor | GpuDrawDescriptor;
export interface GpuFrameInput {
  readonly time?: number;
  readonly delta?: number;
  readonly pointer?: readonly [number, number, number, number];
  readonly values?: Readonly<Record<string, ShaderValue>>;
}
export interface ResolvedGpuFrameInput extends GpuFrameInput {
  readonly frame: number;
  readonly width: number;
  readonly height: number;
}
export interface GpuOperation {
  readonly name: string;
  parameters(values: Readonly<Record<string, ShaderValue>>): void;
  replace(
    shader: ShaderArtifact,
    parameters?: Readonly<Record<string, ShaderValue>>,
  ): Promise<{
    readonly ok: boolean;
    readonly diagnostics: readonly ShaderDiagnostic[];
  }>;
  remove(): void;
}
export interface PreparedOperation {
  descriptor: GpuOperationDescriptor;
  readonly pipeline: GPUComputePipeline | GPURenderPipeline;
  readonly layouts: readonly GPUBindGroupLayout[];
  readonly bindings: readonly ShaderBinding[];
  readonly uniforms: ReadonlyMap<string, GPUBuffer>;
  readonly bindGroups: Map<string, GPUBindGroup[]>;
  readonly reads: readonly GpuResourceRef[];
  readonly writes: readonly GpuResourceRef[];
  readonly sampleCount: number;
  dispose(): void;
}
export interface OperationEnvironment {
  readonly device: GPUDevice;
  readonly resources: GpuResources;
  readonly outputFormat: GPUTextureFormat;
}

interface PipelineEntry {
  readonly pipeline: GPUComputePipeline | GPURenderPipeline;
  readonly layouts: GPUBindGroupLayout[];
  readonly sampleCount: number;
}
const pipelineCaches = new WeakMap<
  OperationEnvironment,
  Map<string, PipelineEntry>
>();
export function inspectPipelineCache(
  environment: OperationEnvironment,
): number {
  return pipelineCaches.get(environment)?.size ?? 0;
}

export const FULLSCREEN_VERTEX_WGSL = `struct ApertureFullscreenVertex { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@vertex fn apertureFullscreen(@builtin(vertex_index) index: u32) -> ApertureFullscreenVertex {
  let positions = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  var out: ApertureFullscreenVertex; out.position=vec4f(positions[index],0,1); out.uv=positions[index]*vec2f(0.5,-0.5)+vec2f(0.5); return out;
}`;
export const FRAME_UNIFORM_WGSL =
  "struct ApertureFrame { resolution:vec2f, time:f32, delta:f32, frame:u32, pointer:vec4f };";

export async function prepareGpuOperation(
  environment: OperationEnvironment,
  descriptor: GpuOperationDescriptor,
): Promise<PreparedOperation> {
  const { device, resources, outputFormat } = environment;
  if (descriptor.name.length === 0)
    throw new Error("A GPU operation requires a name.");
  const artifact = descriptor.shader;
  if (artifact.format !== "aperture.shader" || artifact.version !== 1)
    throw new Error("Expected an Aperture shader artifact version 1.");
  for (const feature of artifact.requiredFeatures)
    if (!device.features.has(feature as GPUFeatureName))
      throw new Error(
        `Shader '${artifact.entry}' requires device feature '${feature}'.`,
      );
  const select = (
    stage: "vertex" | "fragment" | "compute",
    requested?: string,
  ): string => {
    const entry = artifact.entryPoints.find(
      (entry) =>
        entry.stage === stage &&
        (requested === undefined || entry.name === requested),
    );
    if (entry === undefined)
      throw new Error(
        `No ${stage} entry '${requested ?? "default"}' in '${artifact.entry}'.`,
      );
    return entry.name;
  };
  const entries =
    descriptor.kind === "compute"
      ? [select("compute", descriptor.entry)]
      : [
          ...(descriptor.kind === "effect"
            ? []
            : [select("vertex", descriptor.vertexEntry)]),
          select("fragment", descriptor.fragmentEntry),
        ];
  const usedNames = new Set(
    artifact.entryPoints
      .filter((entry) => entries.includes(entry.name))
      .flatMap((entry) => entry.bindings),
  );
  const bindings = artifact.bindings.filter((binding) =>
    usedNames.has(binding.name),
  );
  const reads: GpuResourceRef[] = [],
    writes: GpuResourceRef[] = [];
  const uniforms = new Map<string, GPUBuffer>();
  const inputs = descriptor.bindings ?? {};
  for (const name of Object.keys(inputs))
    if (!bindings.some((binding) => binding.name === name))
      throw new Error(`'${name}' is not used by the selected shader entries.`);
  device.pushErrorScope("validation");
  let failure: unknown;
  let prepared: PreparedOperation | undefined;
  try {
    for (const binding of bindings) {
      const value = inputs[binding.name];
      if (value === undefined)
        throw new Error(`Missing named binding '${binding.name}'.`);
      if (
        binding.group >= device.limits.maxBindGroups ||
        binding.binding >= device.limits.maxBindingsPerBindGroup
      )
        throw new Error(
          `Binding '${binding.name}' exceeds the device's bind-group limits.`,
        );
      if ("resource" in value) {
        resources.binding(binding, value);
        const access = resources.normalizeRef(
          value,
          binding.texture?.dimension,
        );
        if (binding.kind !== "sampler") {
          if (binding.access !== "write") reads.push(access);
          if (
            binding.kind === "storage-buffer" ||
            binding.kind === "storage-texture"
          )
            if (binding.access !== "read") writes.push(access);
        }
      } else {
        if (binding.kind !== "uniform-buffer" || binding.layout === undefined)
          throw new Error(
            `Inline values for '${binding.name}' require a reflected uniform buffer.`,
          );
        const bytes =
          "uniform" in value
            ? packShaderBuffer(binding.layout, value.uniform)
            : null;
        const size =
          bytes?.byteLength ?? Math.ceil(binding.layout.size / 4) * 4;
        if (size > device.limits.maxUniformBufferBindingSize)
          throw new Error(
            `Uniform '${binding.name}' exceeds maxUniformBufferBindingSize.`,
          );
        uniforms.set(
          binding.name,
          device.createBuffer({
            label: `${descriptor.name}:${binding.name}`,
            size,
            usage: 0x40 | 0x08,
          }),
        );
      }
    }
    const bound = bindings.flatMap((binding) => {
      const ref = inputs[binding.name];
      return ref !== undefined &&
        "resource" in ref &&
        binding.kind !== "sampler"
        ? [
            {
              binding,
              ref: resources.normalizeRef(ref, binding.texture?.dimension),
            },
          ]
        : [];
    });
    for (let a = 0; a < bound.length; a++)
      for (let b = a + 1; b < bound.length; b++) {
        const left = bound[a]!,
          right = bound[b]!;
        if (
          (left.binding.access !== "read" || right.binding.access !== "read") &&
          left.ref.resource === right.ref.resource &&
          resourceRangesOverlap(
            left.ref,
            right.ref,
            resources.source(left.ref.resource),
          )
        )
          throw new Error(
            `Pass '${descriptor.name}' aliases writable bindings '${left.binding.name}' and '${right.binding.name}'.`,
          );
      }
    if (descriptor.kind !== "compute") {
      for (const vertex of descriptor.vertices ?? []) {
        resources.buffer(vertex, "vertex");
        reads.push(vertex);
      }
      if (descriptor.indices !== undefined) {
        resources.buffer(descriptor.indices, "index");
        reads.push(descriptor.indices);
      }
      if (descriptor.indirect !== undefined) {
        validateIndirect(
          resources,
          descriptor.indirect,
          descriptor.indices === undefined ? 16 : 20,
        );
        reads.push(descriptor.indirect);
      }
      const attachments: GpuResourceRef[] = [
        ...(descriptor.targets ?? [{ resource: OUTPUT_RESOURCE }]),
        ...(descriptor.depth === undefined ? [] : [descriptor.depth]),
      ];
      const resolved = (descriptor.targets ?? []).flatMap((target) =>
        target.resolve === undefined ? [] : [target.resolve],
      );
      for (const target of [...attachments, ...resolved]) {
        if (target.resource !== OUTPUT_RESOURCE)
          resources.texture(target, "attachment");
        const conflicts = [
          ...(target === descriptor.depth && descriptor.depth?.readOnly === true
            ? []
            : reads),
          ...writes,
          ...attachments.filter((other) => other !== target),
          ...resolved.filter((other) => other !== target),
        ];
        for (const other of conflicts)
          if (
            target.resource === other.resource &&
            (target.resource === OUTPUT_RESOURCE ||
              resourceRangesOverlap(
                target,
                other,
                resources.source(target.resource),
              ))
          )
            throw new Error(
              `Pass '${descriptor.name}' has overlapping read/write attachments for '${target.resource}'. Use disjoint subresources or history ping-pong.`,
            );
      }
      writes.push(
        ...attachments.filter(
          (attachment) =>
            attachment !== descriptor.depth ||
            descriptor.depth?.readOnly !== true,
        ),
        ...resolved,
      );
      if (descriptor.depth?.readOnly === true) reads.push(descriptor.depth);
    } else if (!Array.isArray(descriptor.dispatch)) {
      validateIndirect(resources, descriptor.dispatch as GpuResourceRef, 12);
      reads.push(descriptor.dispatch as GpuResourceRef);
    }
    if (
      descriptor.kind === "compute" &&
      Array.isArray(descriptor.dispatch) &&
      (descriptor.dispatch.length < 1 ||
        descriptor.dispatch.length > 3 ||
        !descriptor.dispatch.every(
          (value) =>
            Number.isSafeInteger(value) &&
            value! > 0 &&
            value! <= device.limits.maxComputeWorkgroupsPerDimension,
        ))
    )
      throw new Error("Compute dispatch exceeds positive workgroup limits.");
    if (descriptor.kind !== "compute") {
      for (const count of [
        descriptor.vertexCount,
        descriptor.instanceCount,
        descriptor.indices?.count,
      ])
        if (
          count !== undefined &&
          (!Number.isSafeInteger(count) || count < 0 || count > 0xffffffff)
        )
          throw new Error("Draw counts must be unsigned 32-bit integers.");
      if (descriptor.indices !== undefined) {
        const range = resources.buffer(descriptor.indices, "index");
        const stride = descriptor.indices.format === "uint16" ? 2 : 4;
        if (
          range.offset % stride ||
          descriptor.indices.count * stride > range.size
        )
          throw new Error(
            "Index range is misaligned or too small for the draw count.",
          );
      }
    }
    let cache = pipelineCaches.get(environment);
    if (cache === undefined) {
      cache = new Map();
      pipelineCaches.set(environment, cache);
    }
    // Include actual source and reflected contracts, not just caller-provided hashes.
    // Parameters and resource identity do not affect the pipeline's layout/state.
    const pipelineKey = JSON.stringify({
      code: artifact.code,
      bindings,
      entries,
      kind: descriptor.kind,
      constants: descriptor.constants,
      ...(descriptor.kind === "compute"
        ? {}
        : {
            vertices: descriptor.vertices?.map((vertex) => vertex.layout),
            primitive: descriptor.primitive,
            blend: descriptor.blend,
            targets: (
              descriptor.targets ?? [{ resource: OUTPUT_RESOURCE }]
            ).map((target) =>
              target.resource === OUTPUT_RESOURCE
                ? [outputFormat, 1]
                : [
                    resources.texture(target).format,
                    resources.texture(target).sampleCount,
                  ],
            ),
            depth:
              descriptor.depth === undefined
                ? undefined
                : [
                    resources.texture(descriptor.depth).format,
                    resources.texture(descriptor.depth).sampleCount,
                    descriptor.depth.write,
                    descriptor.depth.compare,
                  ],
          }),
    });
    let cached = cache.get(pipelineKey);
    if (cached === undefined) {
      const layouts: GPUBindGroupLayout[] = [];
      const maxGroup = Math.max(
        -1,
        ...bindings.map((binding) => binding.group),
      );
      for (let group = 0; group <= maxGroup; group++)
        layouts.push(
          device.createBindGroupLayout({
            label: `${descriptor.name}:group${group}`,
            entries: bindings
              .filter((binding) => binding.group === group)
              .map(bindingLayout),
          }),
        );
      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: layouts,
      });
      const module = device.createShaderModule({
        label: artifact.entry,
        code: artifact.code,
      });
      const messages = (await module.getCompilationInfo()).messages.map(
        (message) => mapShaderDiagnostic(artifact, message),
      );
      if (messages.some((message) => message.severity === "error"))
        throw new ShaderError(messages);
      let pipeline: GPUComputePipeline | GPURenderPipeline;
      let sampleCount = 1;
      if (descriptor.kind === "compute") {
        if (
          Array.isArray(descriptor.dispatch) &&
          !descriptor.dispatch.every(
            (value) =>
              Number.isSafeInteger(value) &&
              value! > 0 &&
              value! <= device.limits.maxComputeWorkgroupsPerDimension,
          )
        )
          throw new Error(
            "Compute dispatch exceeds positive workgroup limits.",
          );
        pipeline = await device.createComputePipelineAsync({
          label: descriptor.name,
          layout: pipelineLayout,
          compute: {
            module,
            entryPoint: entries[0]!,
            ...(descriptor.constants === undefined
              ? {}
              : { constants: descriptor.constants }),
          },
        });
      } else {
        const targets = descriptor.targets ?? [{ resource: OUTPUT_RESOURCE }];
        if (targets.length > device.limits.maxColorAttachments)
          throw new Error(
            "Color attachment count exceeds maxColorAttachments.",
          );
        const samples = targets.map((target) =>
          target.resource === OUTPUT_RESOURCE
            ? 1
            : resources.texture(target).sampleCount,
        );
        if (descriptor.depth !== undefined)
          samples.push(resources.texture(descriptor.depth).sampleCount);
        sampleCount = samples[0] ?? 1;
        if (!samples.every((samples) => samples === sampleCount))
          throw new Error("All attachments need matching sample counts.");
        const fragment = {
          module,
          entryPoint: entries.at(-1)!,
          targets: targets.map(
            (target): GPUColorTargetState => ({
              format:
                target.resource === OUTPUT_RESOURCE
                  ? outputFormat
                  : resources.texture(target).format,
              ...(descriptor.blend === undefined
                ? {}
                : { blend: descriptor.blend }),
            }),
          ),
          ...(descriptor.constants === undefined
            ? {}
            : { constants: descriptor.constants }),
        };
        const vertexModule =
          descriptor.kind === "effect"
            ? device.createShaderModule({ code: FULLSCREEN_VERTEX_WGSL })
            : module;
        pipeline = await device.createRenderPipelineAsync({
          label: descriptor.name,
          layout: pipelineLayout,
          vertex: {
            module: vertexModule,
            entryPoint:
              descriptor.kind === "effect" ? "apertureFullscreen" : entries[0]!,
            buffers: (descriptor.vertices ?? []).map((vertex) => vertex.layout),
            ...(descriptor.constants === undefined
              ? {}
              : { constants: descriptor.constants }),
          },
          fragment,
          primitive: descriptor.primitive ?? { topology: "triangle-list" },
          multisample: { count: sampleCount },
          ...(descriptor.depth === undefined
            ? {}
            : {
                depthStencil: {
                  format: resources.texture(descriptor.depth).format,
                  depthWriteEnabled: descriptor.depth.readOnly
                    ? false
                    : (descriptor.depth.write ?? true),
                  depthCompare: descriptor.depth.compare ?? "less",
                },
              }),
        });
      }
      cached = { pipeline, layouts, sampleCount };
      cache.set(pipelineKey, cached);
      if (cache.size > 128) cache.delete(cache.keys().next().value!);
    }
    const { pipeline, layouts, sampleCount } = cached;
    prepared = {
      descriptor: structuredClone(descriptor),
      pipeline,
      layouts,
      bindings,
      uniforms,
      reads,
      writes,
      sampleCount,
      bindGroups: new Map(),
      dispose() {
        for (const buffer of uniforms.values()) buffer.destroy();
        this.bindGroups.clear();
      },
    };
  } catch (error) {
    failure = error;
  } finally {
    const validation = await device.popErrorScope();
    if (failure === undefined && validation !== null)
      failure = new Error(validation.message);
    if (failure !== undefined) {
      for (const buffer of uniforms.values()) buffer.destroy();
    }
  }
  if (failure !== undefined) throw failure;
  return prepared!;
}

function bindingLayout(binding: ShaderBinding): GPUBindGroupLayoutEntry {
  const visibility = binding.visibility.reduce(
    (flags, stage) => flags | { vertex: 1, fragment: 2, compute: 4 }[stage],
    0,
  );
  const base = { binding: binding.binding, visibility };
  if (binding.kind === "uniform-buffer" || binding.kind === "storage-buffer")
    return {
      ...base,
      buffer: {
        type:
          binding.kind === "uniform-buffer"
            ? "uniform"
            : binding.access === "read"
              ? "read-only-storage"
              : "storage",
        minBindingSize: binding.minBindingSize ?? 0,
      },
    };
  if (binding.kind === "sampler")
    return { ...base, sampler: { type: binding.sampler ?? "filtering" } };
  if (binding.kind === "storage-texture")
    return {
      ...base,
      storageTexture: {
        access:
          binding.access === "read"
            ? "read-only"
            : binding.access === "read_write"
              ? "read-write"
              : "write-only",
        format: binding.texture!.format as GPUTextureFormat,
        viewDimension: binding.texture!.dimension,
      },
    };
  return {
    ...base,
    texture: {
      sampleType: binding.texture!.sampleType,
      viewDimension: binding.texture!.dimension,
      multisampled: binding.texture!.multisampled,
    },
  };
}

export function operationCommands(
  environment: OperationEnvironment,
  operation: PreparedOperation,
  frame: ResolvedGpuFrameInput,
): readonly RenderPassCommand[] | readonly ComputePassCommand[] {
  const descriptor = operation.descriptor;
  for (const binding of operation.bindings) {
    const buffer = operation.uniforms.get(binding.name);
    if (buffer === undefined) continue;
    const input = descriptor.bindings![binding.name]!;
    const value =
      "uniform" in input
        ? input.uniform
        : "input" in input
          ? frame.values?.[input.input]
          : "frame" in input
            ? {
                resolution: [frame.width, frame.height],
                time: frame.time ?? 0,
                delta: frame.delta ?? 0,
                frame: frame.frame,
                pointer: frame.pointer ?? [0, 0, 0, 0],
              }
            : undefined;
    if (value === undefined)
      throw new Error(`Frame input for '${binding.name}' is missing.`);
    environment.device.queue.writeBuffer(
      buffer,
      0,
      packShaderBuffer(binding.layout!, value),
    );
  }
  const key = operation.bindings
    .map((binding) => {
      const ref = descriptor.bindings![binding.name]!;
      return "resource" in ref ? environment.resources.key(ref) : binding.name;
    })
    .join("|");
  let groups = operation.bindGroups.get(key);
  if (groups === undefined) {
    groups = operation.layouts.map((layout, group) =>
      environment.device.createBindGroup({
        layout,
        entries: operation.bindings
          .filter((binding) => binding.group === group)
          .map((binding) => ({
            binding: binding.binding,
            resource: operation.uniforms.has(binding.name)
              ? { buffer: operation.uniforms.get(binding.name)! }
              : environment.resources.binding(
                  binding,
                  descriptor.bindings![binding.name]! as GpuResourceRef,
                ),
          })),
      }),
    );
    operation.bindGroups.set(key, groups);
    // Generation changes cannot accumulate stale texture/buffer references.
    if (operation.bindGroups.size > 4)
      operation.bindGroups.delete(operation.bindGroups.keys().next().value!);
  }
  if (descriptor.kind === "compute") {
    const commands: ComputePassCommand[] = [
      {
        kind: "setComputePipeline",
        pipeline: operation.pipeline,
        pipelineKey: descriptor.shader.hash,
      },
    ];
    groups.forEach((bindGroup, index) =>
      commands.push({
        kind: "setComputeBindGroup",
        bindGroup,
        index,
        resourceKey: key,
      }),
    );
    if (Array.isArray(descriptor.dispatch))
      commands.push({
        kind: "dispatchWorkgroups",
        workgroupCountX: descriptor.dispatch[0]!,
        workgroupCountY: descriptor.dispatch[1] ?? 1,
        workgroupCountZ: descriptor.dispatch[2] ?? 1,
      });
    else {
      const source = environment.resources.buffer(
        descriptor.dispatch as GpuResourceRef,
        "indirect",
      );
      commands.push({
        kind: "dispatchWorkgroupsIndirect",
        resourceKey: key,
        buffer: source.buffer,
        offset: source.offset,
      });
    }
    return commands;
  }
  const commands: RenderPassCommand[] = [
    {
      kind: "setPipeline",
      pipeline: operation.pipeline,
      pipelineKey: descriptor.shader.hash,
      renderId: 0,
    },
  ];
  groups.forEach((bindGroup, index) =>
    commands.push({
      kind: "setBindGroup",
      bindGroup,
      index,
      resourceKey: key,
      renderId: 0,
    }),
  );
  (descriptor.vertices ?? []).forEach((vertex, slot) => {
    const value = environment.resources.buffer(vertex, "vertex");
    commands.push({
      kind: "setVertexBuffer",
      slot,
      resourceKey: vertex.resource,
      buffer: value.buffer,
      offset: value.offset,
      size: value.size,
      renderId: 0,
    });
  });
  if (descriptor.indices !== undefined) {
    const value = environment.resources.buffer(descriptor.indices, "index");
    commands.push({
      kind: "setIndexBuffer",
      buffer: value.buffer,
      format: descriptor.indices.format,
      resourceKey: descriptor.indices.resource,
      offset: value.offset,
      size: value.size,
      renderId: 0,
    });
  }
  if (descriptor.indirect !== undefined) {
    const value = environment.resources.buffer(descriptor.indirect, "indirect");
    if (descriptor.indices !== undefined)
      commands.push({
        kind: "drawIndexedIndirect",
        buffer: value.buffer,
        offset: value.offset,
        resourceKey: descriptor.indirect.resource,
        renderId: 0,
        indexCount: 0,
        instanceCount: 0,
        firstIndex: 0,
        baseVertex: 0,
        firstInstance: 0,
      });
    else
      commands.push({
        kind: "drawIndirect",
        buffer: value.buffer,
        offset: value.offset,
        resourceKey: descriptor.indirect.resource,
        renderId: 0,
        vertexCount: 0,
        instanceCount: 0,
        firstVertex: 0,
        firstInstance: 0,
      });
  } else if (descriptor.indices !== undefined)
    commands.push({
      kind: "drawIndexed",
      renderId: 0,
      indexCount: descriptor.indices.count,
      instanceCount: descriptor.instanceCount ?? 1,
      firstIndex: 0,
      baseVertex: 0,
      firstInstance: 0,
    });
  else
    commands.push({
      kind: "draw",
      renderId: 0,
      vertexCount:
        descriptor.vertexCount ?? (descriptor.kind === "effect" ? 3 : 0),
      instanceCount: descriptor.instanceCount ?? 1,
      firstVertex: 0,
      firstInstance: 0,
    });
  return commands;
}

function validateIndirect(
  resources: GpuResources,
  ref: GpuResourceRef,
  bytes: number,
): void {
  const value = resources.buffer(ref, "indirect");
  if (value.offset % 4 || value.size < bytes)
    throw new Error(
      `Indirect command '${ref.resource}' needs ${bytes} bytes at a four-byte-aligned offset.`,
    );
}
