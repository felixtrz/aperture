import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { expect, it } from "vitest";
import { writeApertureGeneratedActionTypes } from "@aperture-engine/vite-plugin";

const TMP_BASE = fileURLToPath(new URL("../../tmp/vitest", import.meta.url));

it("compiles a real consumer against refreshed action and signal augmentations", async () => {
  await mkdir(TMP_BASE, { recursive: true });
  const root = await mkdtemp(path.join(TMP_BASE, "codegen-consumer-"));
  try {
    await writeFile(path.join(root, "package.json"), '{"type":"module"}');
    await writeFile(
      path.join(root, "aperture.config.ts"),
      'export { default } from "./shared.ts";',
    );
    const consumer = path.join(root, "consumer.ts");
    for (const phase of ["before", "after"] as const) {
      const before = phase === "before";
      await writeFile(
        path.join(root, "shared.ts"),
        `export default {
        input: { actions: { control: { kind: "${before ? "button" : "axis2d"}" } } },
        signals: { score: { kind: "${before ? "number" : "string"}" } }
      };`,
      );
      const generated = await writeApertureGeneratedActionTypes({ root });
      await writeFile(
        consumer,
        `
        import type { InputActions, SignalStore } from "@aperture-engine/app/systems";
        declare const actions: InputActions;
        declare const signals: SignalStore;
        const value: ${before ? "boolean" : "number"} = ${before ? "actions.control.pressed()" : "actions.control.x.value"};
        const score: ${before ? "number" : "string"} = signals.score.value;
        signals.score.value = ${before ? "42" : '"updated"'};
        // @ts-expect-error generated signal values are not any or unknown
        signals.score.value = ${before ? '"wrong"' : "42"};
        // @ts-expect-error generated actions have kind-specific members
        ${before ? "actions.control.x.value" : "actions.control.pressed()"};
        // @ts-expect-error missing actions remain checked under noUncheckedIndexedAccess
        actions.missing.pressed();
        // @ts-expect-error missing signals remain checked under noUncheckedIndexedAccess
        signals.missing.value;
        void value; void score;
      `,
      );
      // No source aliases or hand-authored augmentations: resolve the real
      // package declarations exactly as a consumer using the emitted file does.
      const program = ts.createProgram([consumer, generated], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        noUncheckedIndexedAccess: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      });
      const diagnostics = ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      expect(diagnostics, phase).toEqual([]);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
