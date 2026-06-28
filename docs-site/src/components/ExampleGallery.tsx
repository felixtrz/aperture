import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Badge, Input, MonoTag } from "lumin";
import { useMessages } from "../i18n/react.js";

export interface ExampleEntry {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly file: string;
  readonly href: string;
  readonly localDevUrl: string;
  readonly sourceFiles: readonly string[];
  readonly internal?: boolean;
}

export interface ExampleGalleryProps {
  readonly examples: readonly ExampleEntry[];
  readonly categories: readonly string[];
}

const base = import.meta.env.BASE_URL ?? "/";
const defaultExampleId = "spinning-cube";

function withBase(href: string) {
  if (/^https?:\/\//u.test(href) || !href.startsWith("/")) {
    return href;
  }
  return `${base}${href.slice(1)}`;
}

export function ExampleGallery({
  examples: allExamples,
  categories,
}: ExampleGalleryProps) {
  // Internal conformance fixtures (render-target / MSAA / multi-camera
  // permutations) stay in the manifest for tooling but are kept out of the
  // public gallery so it reads as a curated showcase.
  const m = useMessages();
  const examples = useMemo(
    () => allExamples.filter((example) => example.internal !== true),
    [allExamples],
  );
  const categoryLabel = (value: string) =>
    value === "All" ? m.examples.all : (m.examples.categories[value] ?? value);
  const defaultExample =
    examples.find((example) => example.id === defaultExampleId) ?? examples[0];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activeExampleId, setActiveExampleId] = useState(
    defaultExample?.id ?? "",
  );
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
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
  const activeExample =
    visibleExamples.find((example) => example.id === activeExampleId) ??
    visibleExamples[0] ??
    examples.find((example) => example.id === activeExampleId) ??
    examples[0];

  useEffect(() => {
    const firstVisibleExample = visibleExamples[0];
    if (
      firstVisibleExample !== undefined &&
      !visibleExamples.some((example) => example.id === activeExampleId)
    ) {
      setActiveExampleId(firstVisibleExample.id);
    }
  }, [activeExampleId, visibleExamples]);

  useEffect(() => {
    if (activeExample === undefined) {
      return;
    }

    activeItemRef.current?.scrollIntoView({ block: "start" });
  }, [activeExample]);

  if (activeExample === undefined) {
    return null;
  }

  return (
    <div className="example-gallery">
      <section className="example-controls" aria-label="Example controls">
        <form
          className="api-reference-search-form example-search-form"
          onSubmit={(event) => event.preventDefault()}
        >
          <Input
            aria-label={m.examples.searchLabel}
            placeholder={m.examples.searchPlaceholder}
            value={query}
            onChange={handleQueryChange}
          />
        </form>
        <div className="example-filters" aria-label="Example categories">
          {["All", ...categories].map((item) => (
            <button
              key={item}
              className="example-filter"
              data-active={String(item === category)}
              type="button"
              onClick={() => setCategory(item)}
            >
              {categoryLabel(item)}
            </button>
          ))}
        </div>
      </section>

      <section className="docs-browser" aria-label="Example browser">
        <aside className="docs-browser-sidebar" aria-label="Example list">
          <div className="docs-browser-sidebar-header">
            <span>{m.examples.sidebarTitle}</span>
            <strong>
              {visibleExamples.length}/{examples.length}
            </strong>
          </div>
          <div className="docs-browser-list">
            {visibleExamples.map((example) => {
              const isActive = example.id === activeExample.id;

              return (
                <button
                  key={example.id}
                  ref={isActive ? activeItemRef : undefined}
                  className="docs-browser-item"
                  data-active={String(isActive)}
                  type="button"
                  onClick={() => setActiveExampleId(example.id)}
                >
                  <span className="docs-browser-item-title">
                    <span>{example.title}</span>
                    <Badge tone="mcp">{categoryLabel(example.category)}</Badge>
                  </span>
                  <span className="docs-browser-item-description">
                    {example.file}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="docs-browser-preview">
          <div className="docs-browser-frame-header">
            <div>
              <h2>{activeExample.title}</h2>
              <p>
                <code>{activeExample.file}</code>
              </p>
            </div>
            <div className="docs-actions">
              <a href={withBase(activeExample.href)}>{m.examples.open}</a>
              <a href={activeExample.localDevUrl}>{m.examples.local}</a>
              <a
                href={`https://github.com/felixtrz/aperture/tree/main/${activeExample.sourceFiles[0]}`}
              >
                {m.examples.source}
              </a>
            </div>
          </div>
          <div className="docs-tag-row">
            {activeExample.sourceFiles.map((source) => (
              <MonoTag key={source}>{source}</MonoTag>
            ))}
          </div>
          <iframe
            allow="fullscreen; gamepad; webgpu"
            className="docs-browser-frame"
            src={withBase(activeExample.href)}
            title={`${activeExample.title} example`}
          />
        </div>
      </section>
    </div>
  );
}
