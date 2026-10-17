import type {
  TypeInfo,
  StructInfo,
  ArrayInfo,
  TemplateInfo,
} from "wgsl_reflect";
import type { ShaderBufferLayout, ShaderScalar } from "./artifact.js";

export function reflectBufferLayout(type: TypeInfo): ShaderBufferLayout {
  if (type.isStruct) {
    const structure = type as StructInfo;
    return {
      kind: "struct",
      type: type.name,
      size: type.size,
      align: structure.align,
      fields: structure.members.map((member) => ({
        name: member.name,
        offset: member.offset,
        size: member.size,
        layout: reflectBufferLayout(member.type),
      })),
    };
  }
  if (type.isArray) {
    const array = type as ArrayInfo;
    const element = reflectBufferLayout(array.format);
    if (
      array.count < 0 ||
      !Number.isSafeInteger(array.count) ||
      array.stride < element.size
    )
      throw new Error(
        `Unresolved array layout '${type.getTypeName()}'. Array counts must be build-time constants.`,
      );
    return {
      kind: "array",
      type: type.getTypeName(),
      size: type.size,
      align: element.align,
      stride: array.stride,
      count: array.count,
      element,
    };
  }
  const name = type.name;
  const scalarName =
    name === "atomic" ? (type as TemplateInfo).format?.name : name;
  if (isScalar(scalarName))
    return {
      kind: "scalar",
      type: type.getTypeName(),
      size: type.size,
      align: scalarName === "f16" ? 2 : 4,
      scalar: scalarName,
    };
  // These patterns classify parser-resolved type tokens, never WGSL source.
  const vector = /^vec([234])([fiuh])?$/u.exec(name);
  const matrix = /^mat([234])x([234])([fh])?$/u.exec(name);
  const suffix = vector?.[2] ?? matrix?.[3];
  const scalar =
    suffix === undefined
      ? (type as TemplateInfo).format?.name
      : ({ f: "f32", h: "f16", i: "i32", u: "u32" } as const)[
          suffix as "f" | "h" | "i" | "u"
        ];
  if (!isScalar(scalar))
    throw new Error(`Unsupported host-shareable type '${type.getTypeName()}'.`);
  const scalarSize = scalar === "f16" ? 2 : 4;
  if (vector !== null) {
    const count = Number(vector[1]);
    return {
      kind: "vector",
      type: type.getTypeName(),
      size: type.size,
      align: (count === 2 ? 2 : 4) * scalarSize,
      scalar,
      count,
    };
  }
  if (matrix !== null) {
    const rows = Number(matrix[2]),
      columns = Number(matrix[1]);
    const align = (rows === 2 ? 2 : 4) * scalarSize;
    return {
      kind: "matrix",
      type: type.getTypeName(),
      size: type.size,
      align,
      scalar,
      rows,
      columns,
      stride: Math.ceil((rows * scalarSize) / align) * align,
    };
  }
  throw new Error(`Unsupported host-shareable type '${type.getTypeName()}'.`);
}

function isScalar(name: string | undefined): name is ShaderScalar {
  return name === "f32" || name === "f16" || name === "u32" || name === "i32";
}

/** Uniform address-space rules constrain the authored WGSL; never invent padding
 * that disagrees with the shader. Authors use @align/@size or vec4 wrappers. */
export function validateBufferLayout(
  layout: ShaderBufferLayout,
  uniform: boolean,
  label: string,
): void {
  if (layout.kind === "array") {
    if (uniform && (layout.count === 0 || layout.stride % 16 !== 0))
      throw new Error(
        `${label}: uniform arrays require fixed counts and a stride divisible by 16; use an explicitly padded element struct.`,
      );
    if (layout.element.kind === "array" && layout.element.count === 0)
      throw new Error(`${label}: runtime arrays cannot be nested.`);
    validateBufferLayout(layout.element, uniform, `${label}[]`);
  }
  if (layout.kind === "struct") {
    layout.fields.forEach((field, index) => {
      const child = field.layout;
      if (
        child.kind === "array" &&
        child.count === 0 &&
        (uniform || index !== layout.fields.length - 1)
      )
        throw new Error(
          `${label}.${field.name}: a runtime array must be the last storage field.`,
        );
      if (uniform && (child.kind === "struct" || child.kind === "array")) {
        const requiredAlign = Math.ceil(child.align / 16) * 16;
        if (field.offset % requiredAlign !== 0)
          throw new Error(
            `${label}.${field.name}: uniform member offset ${field.offset} needs alignment ${requiredAlign}; add @align(${requiredAlign}).`,
          );
        const next = layout.fields[index + 1];
        if (
          child.kind === "struct" &&
          next !== undefined &&
          next.offset - field.offset < Math.ceil(child.size / 16) * 16
        )
          throw new Error(
            `${label}.${field.name}: nested uniform structs need 16-byte trailing spacing; add @size.`,
          );
      }
      validateBufferLayout(child, uniform, `${label}.${field.name}`);
    });
  }
}

export function minimumBufferSize(layout: ShaderBufferLayout): number {
  if (layout.kind === "array" && layout.count === 0) return layout.stride;
  if (layout.kind === "struct") {
    const last = layout.fields.at(-1);
    if (
      last !== undefined &&
      last.layout.kind === "array" &&
      last.layout.count === 0
    )
      return last.offset + last.layout.stride;
  }
  return layout.size;
}
