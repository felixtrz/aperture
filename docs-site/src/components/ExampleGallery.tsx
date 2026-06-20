import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Badge, Card, Input, MonoTag } from "lumin";

export interface ExampleEntry {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly file: string;
  readonly href: string;
  readonly localDevUrl: string;
  readonly sourceFiles: readonly string[];
}

export interface ExampleGalleryProps {
  readonly examples: readonly ExampleEntry[];
  readonly categories: readonly string[];
}

export function ExampleGallery({ examples, categories }: ExampleGalleryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
  };
  const normalizedQuery = query.trim().toLowerCase();
  const visibleExamples = useMemo(
    () =>
      examples.filter((example) => {
        if (category !== "All" && example.category !== category) {
          return false;
        }
        if (normalizedQuery.length === 0) {
          return true;
        }
        return [
          example.title,
          example.id,
          example.category,
          ...example.sourceFiles,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [category, examples, normalizedQuery],
  );

  return (
    <section>
      <div className="example-toolbar">
        <Input
          aria-label="Search examples"
          placeholder="Search examples"
          value={query}
          onChange={handleQueryChange}
        />
        <div className="example-filters" aria-label="Example categories">
          {["All", ...categories].map((item) => (
            <button
              key={item}
              className="example-filter"
              data-active={String(item === category)}
              type="button"
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <p className="example-count">
        {visibleExamples.length} of {examples.length} examples
      </p>
      <div className="docs-grid">
        {visibleExamples.map((example) => (
          <Card
            key={example.id}
            title={
              <span className="docs-card-title">
                <span>{example.title}</span>
                <Badge tone="mcp">{example.category}</Badge>
              </span>
            }
          >
            <p>
              Runnable example route for <code>{example.file}</code>. Use the
              examples dev server for live WebGPU execution.
            </p>
            <div className="docs-tag-row">
              {example.sourceFiles.map((source) => (
                <MonoTag key={source}>{source}</MonoTag>
              ))}
            </div>
            <div className="docs-actions">
              <a href={example.localDevUrl}>Run locally</a>
              <a
                href={`https://github.com/felixtrz/aperture/tree/main/${example.sourceFiles[0]}`}
              >
                Source
              </a>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
