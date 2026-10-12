import { findDefinedComponent } from "@aperture-engine/simulation";
import {
  findDefinedResource,
  type ApertureSystemModule,
} from "@aperture-engine/app/advanced";
import { ApertureCliError } from "../errors.js";
import {
  cloneRealmValue,
  isRecord,
  type RealmCompatibility,
  type RealmSnapshot,
} from "./realm-protocol.js";

function systemDefinitions(
  systems: readonly ApertureSystemModule[],
): RealmCompatibility["systems"] {
  return systems.map((module, index) => {
    const System = module.default;
    const prototype = System?.prototype as
      | {
          snapshotState?: unknown;
          restoreState?: unknown;
          afterRestore?: unknown;
        }
      | undefined;
    return {
      index,
      name: System?.name ?? `system:${index}`,
      priority: System?.aperture?.schedule.priority ?? null,
      snapshot: typeof prototype?.snapshotState === "function",
      restore: typeof prototype?.restoreState === "function",
      afterRestore: typeof prototype?.afterRestore === "function",
    };
  });
}
export function describeRealmCompatibility(
  snapshot: RealmSnapshot,
  systems: readonly ApertureSystemModule[],
): RealmCompatibility {
  return {
    schema: "aperture.headless-source-compatibility.v1",
    components: [...snapshot.simulation.componentRegistry.ids]
      .sort()
      .map((id) => {
        const component = findDefinedComponent(id);
        if (component === undefined)
          throw mismatch(
            `Component '${id}' is not defined in the loaded source.`,
          );
        return { id, definition: canonical(component.schema) };
      }),
    resources: snapshot.simulation.resources
      .map((entry) => ({
        id: entry.id,
        fields: [...entry.fields].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    systems: systemDefinitions(systems),
  };
}

/** Pure loaded-source checks first; declarations created by init are checked again before restore. */
export function preflightRealmSnapshot(
  snapshot: RealmSnapshot,
  systems: readonly ApertureSystemModule[],
  requireAllDefinitions: boolean,
): "verified" | "legacy-unverified" {
  const metadata = snapshot.headlessExecution;
  if (metadata === undefined) return "legacy-unverified";
  if (
    metadata.schema !== "aperture.headless-execution.v1" ||
    metadata.compatibility?.schema !==
      "aperture.headless-source-compatibility.v1"
  )
    throw mismatch("Unsupported headless source compatibility metadata.");
  const compatibility = metadata.compatibility;
  if (
    !isRecord(metadata.source) ||
    typeof metadata.source.revision !== "string" ||
    !Array.isArray(compatibility.components) ||
    !Array.isArray(compatibility.resources) ||
    !Array.isArray(compatibility.systems) ||
    compatibility.components.some(
      (entry) =>
        !isRecord(entry) ||
        typeof entry.id !== "string" ||
        !("definition" in entry),
    ) ||
    compatibility.resources.some(
      (entry) =>
        !isRecord(entry) ||
        typeof entry.id !== "string" ||
        !Array.isArray(entry.fields) ||
        entry.fields.some(
          (field: unknown) =>
            !isRecord(field) ||
            typeof field["name"] !== "string" ||
            typeof field["kind"] !== "string",
        ),
    )
  )
    throw mismatch("Malformed headless source compatibility metadata.");
  if (
    JSON.stringify(systemDefinitions(systems)) !==
    JSON.stringify(compatibility.systems)
  )
    throw mismatch(
      "System order, name, scheduling or state hooks changed since the snapshot.",
    );
  for (const expected of compatibility.components) {
    const component = findDefinedComponent(expected.id);
    if (component === undefined) {
      if (requireAllDefinitions)
        throw mismatch(
          `Snapshot component '${expected.id}' is no longer defined.`,
        );
      continue;
    }
    if (
      JSON.stringify(canonical(component.schema)) !==
      JSON.stringify(expected.definition)
    )
      throw mismatch(
        `Snapshot component '${expected.id}' has a different field/type/default schema.`,
      );
  }
  for (const expected of compatibility.resources) {
    const descriptor = findDefinedResource(expected.id);
    if (descriptor === undefined) {
      if (requireAllDefinitions)
        throw mismatch(
          `Snapshot resource '${expected.id}' is no longer defined.`,
        );
      continue;
    }
    const fields = Object.entries(descriptor.schema)
      .map(([name, field]) => ({ name, kind: field.kind }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (JSON.stringify(fields) !== JSON.stringify(expected.fields))
      throw mismatch(
        `Snapshot resource '${expected.id}' has different fields or field kinds.`,
      );
  }
  return "verified";
}
function canonical(value: unknown): unknown {
  const detached = cloneRealmValue(value);
  function sorted(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(sorted);
    if (item !== null && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, sorted(entry)]),
      );
    return item;
  }
  return sorted(detached);
}
function mismatch(message: string): ApertureCliError {
  return new ApertureCliError(
    "aperture.headless.snapshotSourceMismatch",
    `${message} Reset to current source without the snapshot, or restore with compatible source; automatic schema/private-state migration is not provided.`,
  );
}
