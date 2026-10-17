import type {
  ShaderBufferLayout,
  ShaderScalar,
  ShaderValue,
} from "./artifact.js";

/** Matrices use column-major flat arrays; padding is initialized to zero. */
export function packShaderBuffer(
  layout: ShaderBufferLayout,
  value: ShaderValue,
): Uint8Array<ArrayBuffer> {
  const size = valueByteSize(layout, value);
  const bytes = new Uint8Array(Math.ceil(size / 4) * 4);
  write(layout, value, new DataView(bytes.buffer), 0, layout.type);
  return bytes;
}

function valueByteSize(layout: ShaderBufferLayout, value: ShaderValue): number {
  if (layout.kind === "array" && layout.count === 0) {
    if (!Array.isArray(value) || value.length === 0)
      throw new Error("A runtime storage array needs at least one element.");
    return value.length * layout.stride;
  }
  if (layout.kind === "struct") {
    const last = layout.fields.at(-1);
    if (
      last !== undefined &&
      last.layout.kind === "array" &&
      last.layout.count === 0
    ) {
      const record = value as Record<string, ShaderValue>;
      return last.offset + valueByteSize(last.layout, record[last.name]!);
    }
  }
  return layout.size;
}

function write(
  layout: ShaderBufferLayout,
  value: ShaderValue,
  target: DataView,
  offset: number,
  label: string,
): void {
  if (layout.kind === "scalar") {
    writeScalar(target, offset, layout.scalar, value, label);
    return;
  }
  if (layout.kind === "struct") {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new TypeError(`${label} requires named fields.`);
    const record = value as Record<string, ShaderValue>;
    for (const key of Object.keys(record))
      if (!layout.fields.some((field) => field.name === key))
        throw new Error(`${label}.${key} is not a reflected field.`);
    for (const field of layout.fields) {
      if (!(field.name in record))
        throw new Error(`${label}.${field.name} is required.`);
      write(
        field.layout,
        record[field.name]!,
        target,
        offset + field.offset,
        `${label}.${field.name}`,
      );
    }
    return;
  }
  if (!Array.isArray(value)) throw new TypeError(`${label} requires an array.`);
  const count =
    layout.kind === "matrix" ? layout.columns * layout.rows : layout.count;
  if (count !== 0 && value.length !== count)
    throw new RangeError(
      `${label} requires ${count} values, received ${value.length}.`,
    );
  if (layout.kind === "array") {
    value.forEach((item, index) =>
      write(
        layout.element,
        item,
        target,
        offset + index * layout.stride,
        `${label}[${index}]`,
      ),
    );
  } else if (layout.kind === "matrix") {
    const size = layout.scalar === "f16" ? 2 : 4;
    value.forEach((item, index) =>
      writeScalar(
        target,
        offset +
          Math.floor(index / layout.rows) * layout.stride +
          (index % layout.rows) * size,
        layout.scalar,
        item,
        `${label}[${index}]`,
      ),
    );
  } else {
    const size = layout.scalar === "f16" ? 2 : 4;
    value.forEach((item, index) =>
      writeScalar(
        target,
        offset + index * size,
        layout.scalar,
        item,
        `${label}[${index}]`,
      ),
    );
  }
}

function writeScalar(
  target: DataView,
  offset: number,
  scalar: ShaderScalar,
  value: ShaderValue,
  label: string,
): void {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} requires a finite number.`);
  switch (scalar) {
    case "f32":
      if (Math.abs(value) > 3.4028234663852886e38)
        throw new RangeError(`${label} exceeds f32 range.`);
      target.setFloat32(offset, value, true);
      break;
    case "f16":
      if (Math.abs(value) > 65504)
        throw new RangeError(`${label} exceeds f16 range.`);
      target.setUint16(offset, float16(value), true);
      break;
    case "i32":
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)
        throw new RangeError(`${label} requires an i32.`);
      target.setInt32(offset, value, true);
      break;
    case "u32":
      if (!Number.isInteger(value) || value < 0 || value > 4294967295)
        throw new RangeError(`${label} requires a u32.`);
      target.setUint32(offset, value, true);
      break;
  }
}

function float16(value: number): number {
  const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
  const x = Math.abs(value);
  const roundEven = (n: number): number => {
    const floor = Math.floor(n);
    const part = n - floor;
    return floor + (part > 0.5 || (part === 0.5 && floor % 2 !== 0) ? 1 : 0);
  };
  if (x < 2 ** -14) return sign | roundEven(x / 2 ** -24);
  const exponent = Math.floor(Math.log2(x));
  const mantissa = roundEven((x / 2 ** exponent - 1) * 1024);
  return sign | ((exponent + 15) * 1024 + mantissa);
}

/** Generates types from reflected layout rather than trusting handwritten TS. */
export function shaderValueType(layout: ShaderBufferLayout): string {
  if (layout.kind === "scalar") return "number";
  if (layout.kind === "struct")
    return `{ ${layout.fields.map((field) => `readonly ${JSON.stringify(field.name)}: ${shaderValueType(field.layout)}`).join("; ")} }`;
  if (layout.kind === "array")
    return `ReadonlyArray<${shaderValueType(layout.element)}>${layout.count === 0 ? "" : ` & { readonly length: ${layout.count} }`}`;
  return `readonly [${Array.from({ length: layout.kind === "matrix" ? layout.columns * layout.rows : layout.count }, () => "number").join(", ")}]`;
}
