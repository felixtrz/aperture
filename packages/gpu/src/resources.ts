import type { ShaderBinding } from "@aperture-engine/shader";

export type BufferUse =
  | "uniform"
  | "storage"
  | "vertex"
  | "index"
  | "indirect"
  | "copy-src"
  | "copy-dst";
export type TextureUse =
  | "sampled"
  | "storage"
  | "attachment"
  | "copy-src"
  | "copy-dst";
export interface BufferSource {
  readonly kind: "buffer";
  readonly id: string;
  readonly size: number;
  readonly usage: readonly BufferUse[];
  readonly data?: Uint8Array<ArrayBuffer>;
}
export interface TextureSource {
  readonly kind: "texture";
  readonly id: string;
  /** Omitted dimensions follow the output, including resize. */
  readonly width?: number;
  readonly height?: number;
  readonly layers?: number;
  readonly mipLevelCount?: number;
  readonly sampleCount?: 1 | 4;
  readonly format: GPUTextureFormat;
  readonly usage: readonly TextureUse[];
  readonly lifetime?: "persistent" | "transient" | "history";
  /** Packed top-left texels for mip zero; no browser image objects. */
  readonly data?: Uint8Array<ArrayBuffer>;
}
export interface SamplerSource {
  readonly kind: "sampler";
  readonly id: string;
  readonly descriptor?: GPUSamplerDescriptor;
}
export type GpuResourceSource = BufferSource | TextureSource | SamplerSource;
export interface GpuResourceRef {
  readonly resource: string;
  readonly offset?: number;
  readonly size?: number;
  readonly mipLevel?: number;
  readonly layer?: number;
  readonly layerCount?: number;
  readonly history?: "previous" | "current";
}
export interface ImportGpuBufferOptions {
  readonly id: string;
  readonly device: GPUDevice;
  readonly buffer: GPUBuffer;
  readonly usage: readonly BufferUse[];
  readonly ready: Promise<void>;
}
export interface ImportGpuTextureOptions {
  readonly id: string;
  readonly device: GPUDevice;
  readonly texture: GPUTexture;
  readonly usage: readonly TextureUse[];
  readonly ready: Promise<void>;
}
export interface GpuResourceInspection {
  readonly id: string;
  readonly kind: GpuResourceSource["kind"];
  readonly generation: number;
  readonly owned: boolean;
  readonly bytes: number;
  readonly descriptor: GpuResourceSource;
}
interface ResourceRecord {
  source: GpuResourceSource;
  generation: number;
  owned: boolean;
  bytes: number;
  buffers?: GPUBuffer[];
  textures?: GPUTexture[];
  sampler?: GPUSampler;
  previous: number;
  width?: number;
  height?: number;
  ready?: Promise<void>;
}

const bufferFlags: Record<BufferUse, number> = {
  uniform: 0x40,
  storage: 0x80,
  vertex: 0x20,
  index: 0x10,
  indirect: 0x100,
  "copy-src": 0x04,
  "copy-dst": 0x08,
};
const textureFlags: Record<TextureUse, number> = {
  sampled: 0x04,
  storage: 0x08,
  attachment: 0x10,
  "copy-src": 0x01,
  "copy-dst": 0x02,
};
const texelBytes: Partial<Record<GPUTextureFormat, number>> = {
  r8unorm: 1,
  rg8unorm: 2,
  rgba8unorm: 4,
  "rgba8unorm-srgb": 4,
  bgra8unorm: 4,
  "bgra8unorm-srgb": 4,
  rgba16float: 8,
  rgba32float: 16,
  r32float: 4,
  r32uint: 4,
  r32sint: 4,
  rg32float: 8,
  rg32uint: 8,
  rg32sint: 8,
  rgba32uint: 16,
  rgba32sint: 16,
  depth32float: 4,
  depth24plus: 4,
};
export const OUTPUT_RESOURCE = "$output";

export class GpuResources {
  readonly #records = new Map<string, ResourceRecord>();
  #generation = 0;
  #disposed = false;
  #width: number;
  #height: number;
  constructor(
    readonly device: GPUDevice,
    width: number,
    height: number,
    readonly maxBytes = 512 * 1024 * 1024,
  ) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
      throw new Error("GPU memory budget must be a positive integer.");
    this.#width = width;
    this.#height = height;
  }

  create(source: GpuResourceSource): void {
    this.#assertOpen();
    if (
      source.id.length === 0 ||
      source.id === OUTPUT_RESOURCE ||
      this.#records.has(source.id)
    )
      throw new Error(`Resource '${source.id}' already exists or is reserved.`);
    const record = this.#allocate(structuredClone(source));
    this.#records.set(source.id, record);
  }
  importBuffer(options: ImportGpuBufferOptions): void {
    this.#assertOpen();
    if (options.device !== this.device)
      throw new Error(
        "Imported resources must belong to this context's device.",
      );
    if (this.#records.has(options.id) || options.id === OUTPUT_RESOURCE)
      throw new Error(`Duplicate/reserved resource '${options.id}'.`);
    const expected = flags(options.usage, bufferFlags);
    if ((options.buffer.usage & expected) !== expected)
      throw new Error(`Imported buffer '${options.id}' lacks declared usage.`);
    this.#records.set(options.id, {
      source: {
        kind: "buffer",
        id: options.id,
        size: options.buffer.size,
        usage: [...options.usage],
      },
      generation: ++this.#generation,
      owned: false,
      bytes: 0,
      buffers: [options.buffer],
      previous: 0,
      ready: options.ready,
    });
  }
  importTexture(options: ImportGpuTextureOptions): void {
    this.#assertOpen();
    if (options.device !== this.device)
      throw new Error(
        "Imported resources must belong to this context's device.",
      );
    if (
      this.#records.has(options.id) ||
      options.id === OUTPUT_RESOURCE ||
      options.id.length === 0
    )
      throw new Error(`Duplicate/reserved resource '${options.id}'.`);
    const texture = options.texture;
    if (texture.dimension !== "2d" || ![1, 4].includes(texture.sampleCount))
      throw new Error(
        "Imported textures require a 2D texture with sampleCount 1 or 4.",
      );
    const expected = flags(options.usage, textureFlags);
    if ((texture.usage & expected) !== expected)
      throw new Error(`Imported texture '${options.id}' lacks declared usage.`);
    this.#records.set(options.id, {
      source: {
        kind: "texture",
        id: options.id,
        width: texture.width,
        height: texture.height,
        layers: texture.depthOrArrayLayers,
        mipLevelCount: texture.mipLevelCount,
        sampleCount: texture.sampleCount as 1 | 4,
        format: texture.format,
        usage: [...options.usage],
        lifetime: "persistent",
      },
      generation: ++this.#generation,
      owned: false,
      bytes: 0,
      textures: [texture],
      previous: 0,
      width: texture.width,
      height: texture.height,
      ready: options.ready,
    });
  }
  async synchronize(): Promise<void> {
    await Promise.all(
      [...this.#records.values()].map((resource) => resource.ready),
    );
  }
  inspect(): readonly GpuResourceInspection[] {
    return [...this.#records].map(([id, value]) => ({
      id,
      kind: value.source.kind,
      generation: value.generation,
      owned: value.owned,
      bytes: value.bytes,
      descriptor: structuredClone(value.source),
    }));
  }
  source(id: string): GpuResourceSource {
    return this.#record(id).source;
  }
  key(ref: GpuResourceRef): string {
    const record = this.#record(ref.resource);
    return JSON.stringify([
      ref,
      record.generation,
      record.source.kind === "texture" && record.source.lifetime === "history"
        ? this.#textureIndex(record, ref.history)
        : 0,
    ]);
  }
  buffer(
    ref: GpuResourceRef,
    use?: BufferUse,
  ): { buffer: GPUBuffer; offset: number; size: number } {
    const record = this.#record(ref.resource);
    if (record.source.kind !== "buffer")
      throw new Error(`'${ref.resource}' is not a buffer.`);
    if (use !== undefined && !record.source.usage.includes(use))
      throw new Error(`Buffer '${ref.resource}' requires '${use}' usage.`);
    if (
      ref.history !== undefined ||
      ref.layer !== undefined ||
      ref.layerCount !== undefined ||
      ref.mipLevel !== undefined
    )
      throw new Error("Buffer references cannot select texture subresources.");
    const offset = ref.offset ?? 0,
      size = ref.size ?? record.source.size - offset;
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(size) ||
      offset < 0 ||
      size <= 0 ||
      offset + size > record.source.size
    )
      throw new Error(`Invalid buffer range for '${ref.resource}'.`);
    return { buffer: record.buffers![0]!, offset, size };
  }
  texture(ref: GpuResourceRef, use?: TextureUse): GPUTexture {
    const record = this.#record(ref.resource);
    if (record.source.kind !== "texture")
      throw new Error(`'${ref.resource}' is not a texture.`);
    if (use !== undefined && !record.source.usage.includes(use))
      throw new Error(`Texture '${ref.resource}' requires '${use}' usage.`);
    if (ref.history !== undefined && record.source.lifetime !== "history")
      throw new Error(`Texture '${ref.resource}' is not a history resource.`);
    if (ref.offset !== undefined || ref.size !== undefined)
      throw new Error("Texture references cannot select byte ranges.");
    const texture = record.textures![this.#textureIndex(record, ref.history)]!;
    const mip = ref.mipLevel ?? 0,
      layer = ref.layer ?? 0,
      count = ref.layerCount ?? 1;
    if (
      ![mip, layer, count].every(Number.isSafeInteger) ||
      mip < 0 ||
      mip >= texture.mipLevelCount ||
      layer < 0 ||
      count < 1 ||
      layer + count > texture.depthOrArrayLayers
    )
      throw new Error(`Invalid texture subrange for '${ref.resource}'.`);
    return texture;
  }
  normalizeRef(
    ref: GpuResourceRef,
    dimension?: GPUTextureViewDimension,
  ): GpuResourceRef {
    const source = this.source(ref.resource);
    if (source.kind !== "texture") return ref;
    const layerCount =
      ref.layerCount ??
      (dimension === "cube"
        ? 6
        : dimension === "cube-array" || dimension === "2d-array"
          ? (source.layers ?? 1) - (ref.layer ?? 0)
          : 1);
    return { ...ref, layerCount };
  }
  view(
    ref: GpuResourceRef,
    use: TextureUse,
    dimension: GPUTextureViewDimension = "2d",
  ): GPUTextureView {
    const normalized = this.normalizeRef(ref, dimension);
    const texture = this.texture(normalized, use);
    const layerCount = normalized.layerCount!;
    return texture.createView({
      dimension,
      baseMipLevel: ref.mipLevel ?? 0,
      mipLevelCount: 1,
      baseArrayLayer: ref.layer ?? 0,
      arrayLayerCount: layerCount,
    });
  }
  binding(binding: ShaderBinding, ref: GpuResourceRef): GPUBindingResource {
    if (
      binding.kind === "uniform-buffer" ||
      binding.kind === "storage-buffer"
    ) {
      const value = this.buffer(
        ref,
        binding.kind === "uniform-buffer" ? "uniform" : "storage",
      );
      const align =
        binding.kind === "uniform-buffer"
          ? this.device.limits.minUniformBufferOffsetAlignment
          : this.device.limits.minStorageBufferOffsetAlignment;
      const limit =
        binding.kind === "uniform-buffer"
          ? this.device.limits.maxUniformBufferBindingSize
          : this.device.limits.maxStorageBufferBindingSize;
      if (
        value.offset % align !== 0 ||
        value.size % 4 !== 0 ||
        value.size < (binding.minBindingSize ?? 0) ||
        value.size > limit
      )
        throw new Error(
          `Binding '${binding.name}' has invalid alignment/size; minimum ${binding.minBindingSize}, offset alignment ${align}, maximum ${limit}.`,
        );
      return value;
    }
    if (binding.kind === "sampler") {
      const record = this.#record(ref.resource);
      if (record.sampler === undefined)
        throw new Error(`'${ref.resource}' is not a sampler.`);
      return record.sampler;
    }
    const texture = this.texture(
      ref,
      binding.kind === "storage-texture" ? "storage" : "sampled",
    );
    if (
      binding.texture?.format !== undefined &&
      texture.format !== binding.texture.format
    )
      throw new Error(
        `Storage texture '${binding.name}' requires ${binding.texture.format}.`,
      );
    if (texture.sampleCount > 1 !== binding.texture?.multisampled)
      throw new Error(
        `Texture '${binding.name}' has an incompatible sample count.`,
      );
    return this.view(
      ref,
      binding.kind === "storage-texture" ? "storage" : "sampled",
      binding.texture?.dimension,
    );
  }
  writeBuffer(id: string, data: Uint8Array<ArrayBuffer>, offset = 0): void {
    const target = this.buffer(
      { resource: id, offset, size: data.byteLength },
      "copy-dst",
    );
    if (offset % 4 !== 0 || data.byteLength % 4 !== 0)
      throw new Error("Buffer writes must be aligned to four bytes.");
    this.device.queue.writeBuffer(target.buffer, offset, data);
  }
  async readBuffer(
    id: string,
    offset = 0,
    size?: number,
  ): Promise<Uint8Array<ArrayBuffer>> {
    await this.synchronize();
    const source = this.buffer(
      { resource: id, offset, ...(size === undefined ? {} : { size }) },
      "copy-src",
    );
    if (offset % 4 || source.size % 4)
      throw new Error("Buffer copies require four-byte alignment.");
    const staging = this.device.createBuffer({
      size: source.size,
      usage: 0x01 | 0x08,
    });
    try {
      const encoder = this.device.createCommandEncoder();
      encoder.copyBufferToBuffer(
        source.buffer,
        offset,
        staging,
        0,
        source.size,
      );
      this.device.queue.submit([encoder.finish()]);
      await staging.mapAsync(1);
      return new Uint8Array(staging.getMappedRange().slice(0));
    } finally {
      if (staging.mapState === "mapped") staging.unmap();
      staging.destroy();
    }
  }
  flipHistory(): void {
    for (const record of this.#records.values())
      if (
        record.source.kind === "texture" &&
        record.source.lifetime === "history"
      )
        record.previous = 1 - record.previous;
  }
  resize(
    width: number,
    height: number,
    beforeCommit?: () => void,
    resetAll = false,
  ): void {
    if (!resetAll && width === this.#width && height === this.#height) {
      beforeCommit?.();
      return;
    }
    const oldWidth = this.#width,
      oldHeight = this.#height;
    this.#width = width;
    this.#height = height;
    try {
      this.#replaceAll(
        [...this.#records.values()].filter(
          (record) =>
            record.owned &&
            ((resetAll && record.source.kind !== "sampler") ||
              (record.source.kind === "texture" &&
                (record.source.width === undefined ||
                  record.source.height === undefined ||
                  record.source.lifetime === "history"))),
        ),
        beforeCommit,
      );
    } catch (error) {
      this.#width = oldWidth;
      this.#height = oldHeight;
      throw error;
    }
  }
  reset(): void {
    this.#replaceAll(
      [...this.#records.values()].filter(
        (record) => record.owned && record.source.kind !== "sampler",
      ),
    );
  }
  resetHistory(): void {
    this.#replaceAll(
      [...this.#records.values()].filter(
        (record) =>
          record.owned &&
          record.source.kind === "texture" &&
          record.source.lifetime === "history",
      ),
    );
  }
  #replaceAll(
    records: readonly ResourceRecord[],
    beforeCommit?: () => void,
  ): void {
    const replacements: {
      original: ResourceRecord;
      replacement: ResourceRecord;
    }[] = [];
    try {
      for (const original of records) {
        const replacement = this.#allocate(original.source, original.bytes);
        replacements.push({ original, replacement });
        this.#records.set(original.source.id, replacement);
      }
      beforeCommit?.();
    } catch (error) {
      for (const { original, replacement } of replacements) {
        this.#records.set(original.source.id, original);
        this.#destroy(replacement);
      }
      throw error;
    }
    for (const { original } of replacements) this.#destroy(original);
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const record of this.#records.values()) this.#destroy(record);
    this.#records.clear();
  }
  #destroy(record: ResourceRecord): void {
    if (!record.owned) return;
    record.buffers?.forEach((buffer) => buffer.destroy());
    record.textures?.forEach((texture) => texture.destroy());
  }
  #textureIndex(
    record: ResourceRecord,
    history: GpuResourceRef["history"],
  ): number {
    return record.source.kind === "texture" &&
      record.source.lifetime === "history"
      ? history === "previous"
        ? record.previous
        : 1 - record.previous
      : 0;
  }
  #assertOpen(): void {
    if (this.#disposed) throw new Error("GPU resources are disposed.");
  }
  #record(id: string): ResourceRecord {
    this.#assertOpen();
    const result = this.#records.get(id);
    if (result === undefined) throw new Error(`Unknown resource '${id}'.`);
    return result;
  }
  #allocate(source: GpuResourceSource, replacedBytes = 0): ResourceRecord {
    const record: ResourceRecord = {
      source,
      generation: ++this.#generation,
      owned: true,
      bytes: 0,
      previous: 0,
    };
    if (source.kind === "sampler") {
      record.sampler = this.device.createSampler(source.descriptor);
      return record;
    }
    if (source.kind === "buffer") {
      if (
        !Number.isSafeInteger(source.size) ||
        source.size <= 0 ||
        source.size % 4 ||
        source.size > this.device.limits.maxBufferSize
      )
        throw new Error(`Invalid buffer size for '${source.id}'.`);
      record.bytes = source.size;
      this.#budget(record.bytes, replacedBytes);
      const buffer = this.device.createBuffer({
        label: source.id,
        size: source.size,
        usage: flags(source.usage, bufferFlags),
        mappedAtCreation: source.data !== undefined,
      });
      record.buffers = [buffer];
      if (source.data !== undefined) {
        if (source.data.byteLength > source.size) {
          buffer.destroy();
          throw new Error(`Initial data exceeds buffer '${source.id}'.`);
        }
        new Uint8Array(buffer.getMappedRange()).set(source.data);
        buffer.unmap();
      }
    } else {
      const width = source.width ?? this.#width,
        height = source.height ?? this.#height,
        layers = source.layers ?? 1,
        mips = source.mipLevelCount ?? 1,
        samples = source.sampleCount ?? 1;
      const bytesPerPixel = texelBytes[source.format];
      if (bytesPerPixel === undefined)
        throw new Error(
          `Texture format '${source.format}' has no qualified allocation/readback contract.`,
        );
      if (
        ![width, height, layers, mips].every(
          (value) => Number.isSafeInteger(value) && value > 0,
        ) ||
        width > this.device.limits.maxTextureDimension2D ||
        height > this.device.limits.maxTextureDimension2D ||
        layers > this.device.limits.maxTextureArrayLayers ||
        mips > Math.floor(Math.log2(Math.max(width, height))) + 1
      )
        throw new Error(`Invalid texture dimensions for '${source.id}'.`);
      const copies = source.lifetime === "history" ? 2 : 1;
      for (let mip = 0; mip < mips; mip++)
        record.bytes +=
          Math.max(1, width >> mip) *
          Math.max(1, height >> mip) *
          layers *
          samples *
          bytesPerPixel *
          copies;
      this.#budget(record.bytes, replacedBytes);
      if (
        source.data !== undefined &&
        (samples !== 1 ||
          source.data.byteLength !== width * height * layers * bytesPerPixel ||
          !source.usage.includes("copy-dst"))
      )
        throw new Error(
          `Texture '${source.id}' initial data needs packed mip-zero texels, sampleCount 1, and copy-dst usage.`,
        );
      record.width = width;
      record.height = height;
      record.textures = [];
      try {
        for (let index = 0; index < copies; index++) {
          const texture = this.device.createTexture({
            label: `${source.id}:${index}`,
            size: [width, height, layers],
            format: source.format,
            usage: flags(source.usage, textureFlags),
            mipLevelCount: mips,
            sampleCount: samples,
          });
          record.textures.push(texture);
          if (source.data !== undefined)
            this.device.queue.writeTexture(
              { texture },
              source.data,
              { bytesPerRow: width * bytesPerPixel, rowsPerImage: height },
              [width, height, layers],
            );
        }
      } catch (error) {
        this.#destroy(record);
        throw error;
      }
    }
    return record;
  }
  #budget(bytes: number, replacedBytes: number): void {
    const total = [...this.#records.values()].reduce(
      (sum, resource) => sum + resource.bytes,
      bytes - replacedBytes,
    );
    if (!Number.isSafeInteger(total) || total > this.maxBytes)
      throw new Error(
        `GPU resources exceed the ${this.maxBytes}-byte memory budget.`,
      );
  }
}

function flags<T extends string>(
  usage: readonly T[],
  mapping: Record<T, number>,
): number {
  let result = 0;
  for (const name of usage) {
    if (!(name in mapping))
      throw new Error(`Unknown resource usage '${name}'.`);
    result |= mapping[name];
  }
  if (result === 0) throw new Error("A resource requires at least one usage.");
  return result;
}

export function resourceRangesOverlap(
  a: GpuResourceRef,
  b: GpuResourceRef,
  source: GpuResourceSource,
): boolean {
  if (a.resource !== b.resource) return false;
  if (source.kind === "texture")
    return (
      (source.lifetime !== "history" ||
        (a.history ?? "current") === (b.history ?? "current")) &&
      (a.mipLevel ?? 0) === (b.mipLevel ?? 0) &&
      (a.layer ?? 0) < (b.layer ?? 0) + (b.layerCount ?? 1) &&
      (b.layer ?? 0) < (a.layer ?? 0) + (a.layerCount ?? 1)
    );
  if (source.kind === "buffer")
    return (
      (a.offset ?? 0) <
        (b.offset ?? 0) + (b.size ?? source.size - (b.offset ?? 0)) &&
      (b.offset ?? 0) <
        (a.offset ?? 0) + (a.size ?? source.size - (a.offset ?? 0))
    );
  return true;
}
