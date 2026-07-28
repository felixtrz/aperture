import type { TemplateFile } from "../types.js";

export function textTemplateFile(path: string, contents: string): TemplateFile {
  return { path, contents };
}

export function binaryTemplateFile(path: string, base64: string): TemplateFile {
  return {
    path,
    contents: Buffer.from(base64, "base64"),
  };
}

export function binaryBytesTemplateFile(
  path: string,
  contents: Uint8Array,
): TemplateFile {
  return { path, contents };
}
