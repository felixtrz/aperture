import { useState } from "react";
import { Badge, MonoTag } from "lumin";
import type { ShowcaseEntry } from "../content/showcases.js";

export interface ShowcaseCardsProps {
  readonly showcases: readonly ShowcaseEntry[];
}

const base = import.meta.env.BASE_URL ?? "/";

function withBase(href: string) {
  if (/^https?:\/\//u.test(href) || !href.startsWith("/")) {
    return href;
  }
  return `${base}${href.slice(1)}`;
}

export function ShowcaseCards({ showcases }: ShowcaseCardsProps) {
  const [activeShowcaseId, setActiveShowcaseId] = useState(
    showcases[0]?.id ?? "",
  );
  const activeShowcase =
    showcases.find((showcase) => showcase.id === activeShowcaseId) ??
    showcases[0];

  if (activeShowcase === undefined) {
    return null;
  }

  return (
    <section className="docs-browser" aria-label="Showcase browser">
      <aside className="docs-browser-sidebar" aria-label="Showcase list">
        <div className="docs-browser-sidebar-header">
          <span>Showcases</span>
          <strong>{showcases.length}</strong>
        </div>
        <div className="docs-browser-list">
          {showcases.map((showcase) => (
            <button
              key={showcase.id}
              className="docs-browser-item"
              data-active={String(showcase.id === activeShowcase.id)}
              type="button"
              onClick={() => setActiveShowcaseId(showcase.id)}
            >
              <span className="docs-browser-item-title">
                <span>{showcase.name}</span>
                <Badge tone={showcase.status === "active" ? "ok" : "warn"} dot>
                  {showcase.status}
                </Badge>
              </span>
              <span className="docs-browser-item-description">
                {showcase.description}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="docs-browser-preview">
        <div className="docs-browser-frame-header">
          <div>
            <h2>{activeShowcase.name}</h2>
            <p>{activeShowcase.description}</p>
          </div>
          <div className="docs-actions">
            <a href={withBase(activeShowcase.href)}>Open</a>
            <a href={activeShowcase.sourceHref}>Source</a>
          </div>
        </div>
        <div className="docs-tag-row">
          {activeShowcase.capabilities.map((capability) => (
            <MonoTag key={capability}>{capability}</MonoTag>
          ))}
        </div>
        <iframe
          allow="fullscreen; gamepad; webgpu"
          className="docs-browser-frame"
          src={withBase(activeShowcase.href)}
          title={`${activeShowcase.name} showcase`}
        />
      </div>
    </section>
  );
}
