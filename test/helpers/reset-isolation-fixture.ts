import { defineApertureConfig } from "@aperture-engine/app/config";
import { Name, type Entity } from "@aperture-engine/simulation";

export const resetOptions = {
  seed: 0,
  assetMode: "placeholder" as const,
  root: process.cwd(),
  publicDir: "public",
  allowHttpAssets: false,
  determinism: "off" as const,
};
export const resetRender = {
  defaultCamera: false,
  defaultLight: false,
  defaultEnvironment: false,
};
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
export function entityName(entity: Entity): string | null {
  return entity.getValue(Name, "value");
}
export function resetFeatureFixture(
  onDispose?: (entity: Entity, generation: number) => void | Promise<void>,
) {
  const entities: Entity[] = [];
  const events: string[] = [];
  const config = defineApertureConfig({
    mode: "headless",
    render: resetRender,
    features: [
      {
        id: "reset-isolation-probe",
        installRuntime({ world }) {
          const generation = entities.length + 1;
          const entity = world
            .createEntity()
            .addComponent(Name, { value: `boot-${generation}` });
          entities.push(entity);
          events.push(`boot-${generation}`);
          return async () => {
            events.push(`dispose-${generation}`);
            await onDispose?.(entity, generation);
          };
        },
      },
    ],
  });
  return { config, entities, events };
}
