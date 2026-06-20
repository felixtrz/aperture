import { Badge, Card, MonoTag } from "lumin";

export interface ApiSymbol {
  readonly name: string;
  readonly kind: string;
}

export interface ApiEntry {
  readonly subpath: string;
  readonly importPath: string;
  readonly sourcePath: string;
  readonly symbols: readonly ApiSymbol[];
}

export interface ApiPackage {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly entries: readonly ApiEntry[];
}

export interface ApiPackageListProps {
  readonly packages: readonly ApiPackage[];
}

const prioritySymbols = new Set([
  "createSystem",
  "defineComponent",
  "saveScene",
  "createWebGpuApp",
]);

function visibleSymbols(symbols: readonly ApiSymbol[]): readonly ApiSymbol[] {
  return [...symbols]
    .sort((left, right) => {
      const leftPriority = prioritySymbols.has(left.name) ? 0 : 1;
      const rightPriority = prioritySymbols.has(right.name) ? 0 : 1;
      return (
        leftPriority - rightPriority || left.name.localeCompare(right.name)
      );
    })
    .slice(0, 32);
}

export function ApiPackageList({ packages }: ApiPackageListProps) {
  return (
    <div className="docs-card-list">
      {packages.map((packageEntry) => (
        <Card
          key={packageEntry.name}
          title={
            <span className="docs-card-title">
              <span>{packageEntry.name}</span>
              <Badge tone="accent">{packageEntry.entries.length} exports</Badge>
            </span>
          }
          footer={packageEntry.path}
        >
          <p>{packageEntry.description}</p>
          {packageEntry.entries.map((entry) => (
            <div className="api-entry" key={entry.importPath}>
              <strong>{entry.importPath}</strong>
              <p>
                <code>{entry.sourcePath}</code>
              </p>
              <div className="api-symbols">
                {visibleSymbols(entry.symbols).map((symbol) => (
                  <MonoTag key={`${entry.importPath}:${symbol.name}`}>
                    {symbol.name}
                  </MonoTag>
                ))}
                {entry.symbols.length > 32 ? (
                  <MonoTag>+{entry.symbols.length - 32} more</MonoTag>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
