import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  startGeneratedBrowserApp,
  type GeneratedBrowserApp,
  type StartGeneratedBrowserAppOptions,
} from "@aperture-engine/app/browser";

// This function is never invoked. Repository typecheck enforces the public
// JavaScript/TypeScript authoring boundary while Vitest performs no bootstrap.
async function typedContracts(
  options: StartGeneratedBrowserAppOptions,
  app: GeneratedBrowserApp,
) {
  // @ts-expect-error Initialization returns a Promise, not the browser app.
  void startGeneratedBrowserApp(options).request("camera_get", {});
  await app.request("camera_set_projection", {
    key: "camera.main",
    projection: "orthographic",
    orthographicHeight: 8,
  });
  // @ts-expect-error The semantic request uses explicit degrees, not raw ECS radians.
  await app.request("camera_set_projection", { fovYRadians: 1 });
  // @ts-expect-error Only existing perspective and orthographic modes are supported.
  await app.request("camera_set_projection", { projection: "panoramic" });
  // @ts-expect-error Projection values must be numbers.
  await app.request("camera_set_projection", { near: "1" });
}
void typedContracts;

describe("checked JavaScript browser embedding", () => {
  it("checks the public example and reports the observed omitted app await before any preview", () => {
    const configPath = path.resolve(
      "examples/tsconfig.checked-browser-embedding.json",
    );
    const sourcePath = path.resolve("examples/checked-browser-embedding.js");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(configPath),
    );
    expect(parsed.errors).toEqual([]);
    const host = ts.createCompilerHost(parsed.options);
    const program = ts.createProgram(parsed.fileNames, parsed.options, host);
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        ),
    ).toEqual([]);

    const readFile = host.readFile.bind(host);
    host.readFile = (fileName) => {
      const source = readFile(fileName);
      return path.resolve(fileName) === sourcePath
        ? source?.replace(
            "const app = await startGeneratedBrowserApp(",
            "const app = startGeneratedBrowserApp(",
          )
        : source;
    };
    const incorrect = ts.createProgram(parsed.fileNames, parsed.options, host);
    const errors = ts
      .getPreEmitDiagnostics(incorrect)
      .filter((diagnostic) => diagnostic.file?.fileName === sourcePath);
    expect(
      errors.some(
        (diagnostic) =>
          diagnostic.code === 2339 &&
          ts
            .flattenDiagnosticMessageText(diagnostic.messageText, "\n")
            .includes("ready") &&
          ts
            .flattenDiagnosticMessageText(diagnostic.messageText, "\n")
            .includes("Promise<GeneratedBrowserApp>"),
      ),
    ).toBe(true);
  }, 30000);
});
