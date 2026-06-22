export type ApertureCreateTemplate = "minimal" | "glb-viewer" | "game";

export interface CreateApertureProjectOptions {
  readonly cwd: string;
  readonly name: string;
  readonly force?: boolean;
  readonly template?: ApertureCreateTemplate;
}

export interface CreateApertureProjectReport {
  readonly targetDir: string;
  readonly packageName: string;
  readonly template: ApertureCreateTemplate;
  readonly files: readonly string[];
}

export interface TemplateFile {
  readonly path: string;
  readonly contents: string | Uint8Array;
}
