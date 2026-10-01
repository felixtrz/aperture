import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Both system and feature own a real interval and asynchronous cleanup work. */
export async function headlessLifecycleFixture(cleanupFails = false): Promise<{
  root: string;
  config: string;
  marker: string;
  badOutput: string;
}> {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "aperture-runner-lifecycle-"),
  );
  const marker = path.join(root, "cleanup.txt");
  const config = path.join(root, "aperture.headless.config.ts");
  const badOutput = path.join(root, "output-is-directory");
  await mkdir(badOutput);
  await mkdir(path.join(root, "src/systems"), { recursive: true });
  await symlink(
    fileURLToPath(new URL("../../node_modules", import.meta.url)),
    path.join(root, "node_modules"),
    "junction",
  );
  await writeFile(
    path.join(root, "package.json"),
    '{"type":"module","private":true}\n',
  );
  await writeFile(
    config,
    `
    import { appendFile } from "node:fs/promises";
    export default {
      mode: "headless",
      systems: ["src/systems/**/*.system.ts"],
      render: { defaultCamera: false, defaultLight: false, defaultEnvironment: false },
      features: [{
        id: "owned-feature-timer",
        installRuntime() {
          const timer = setInterval(() => {}, 1000);
          return async () => {
            clearInterval(timer);
            await appendFile(${JSON.stringify(marker)}, "feature\\n");
            ${cleanupFails ? 'throw new Error("feature cleanup failure");' : ""}
          };
        },
      }],
    };
  `,
  );
  await writeFile(
    path.join(root, "src/systems/timer.system.ts"),
    `
    import { appendFile } from "node:fs/promises";
    import { createSystem } from "@aperture-engine/app/systems";
    export default class TimerSystem extends createSystem() {
      #timer: ReturnType<typeof setInterval> | undefined;
      override init(): void { this.#timer = setInterval(() => {}, 1000); }
      override async destroy(): Promise<void> {
        clearInterval(this.#timer);
        await appendFile(${JSON.stringify(marker)}, "system\\n");
        ${cleanupFails ? 'throw new Error("system cleanup failure");' : ""}
      }
    }
  `,
  );
  return { root, config, marker, badOutput };
}
