import { World } from "elics";
import type {
  AnyComponent,
  Component,
  DataType,
  Entity,
  TypedSchema,
  WorldOptions,
} from "elics";

export { Types as EcsType, createComponent as defineComponent } from "elics";
export type {
  ComponentInitialData,
  DataType,
  Entity,
  TypedSchema,
  WorldOptions,
} from "elics";

export type EcsWorld = World;
export type EcsEntity = Entity;
export type AnyEcsComponent = AnyComponent;
export type EcsComponent<
  Schema extends TypedSchema<DataType> = TypedSchema<DataType>,
> = Component<Schema>;

export function createWorld(options: Partial<WorldOptions> = {}): EcsWorld {
  return new World(options);
}
