import { useState } from "react";
import { Badge, MonoTag } from "lumin";
import type { ShowcaseEntry } from "../content/showcases.js";
import { useMessages } from "../i18n/react.js";

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
  const m = useMessages();
  const [activeShowcaseId, setActiveShowcaseId] = useState(
    showcases[0]?.id ?? "",
  );
  const activeShowcase =
    showcases.find((showcase) => showcase.id === activeShowcaseId) ??
    showcases[0];

  if (activeShowcase === undefined) {
    return null;
  }

  // Localized copy overlays the structural manifest entry; English fields stay
  // as the fallback when a translation is missing.
  const localize = (showcase: ShowcaseEntry) => {
    const copy = m.showcases.items[showcase.id];
    return {
      name: copy?.name ?? showcase.name,
      description: copy?.description ?? showcase.description,
      capabilities: copy?.capabilities ?? showcase.capabilities,
      statusLabel: m.showcases.status[showcase.status] ?? showcase.status,
    };
  };

  const activeCopy = localize(activeShowcase);

  return (
    <section className="docs-browser" aria-label="Showcase browser">
      <aside className="docs-browser-sidebar" aria-label="Showcase list">
        <div className="docs-browser-sidebar-header">
          <span>{m.showcases.sidebarTitle}</span>
          <strong>{showcases.length}</strong>
        </div>
        <div className="docs-browser-list">
          {showcases.map((showcase) => {
            const copy = localize(showcase);
            return (
              <button
                key={showcase.id}
                className="docs-browser-item"
                data-active={String(showcase.id === activeShowcase.id)}
                type="button"
                onClick={() => setActiveShowcaseId(showcase.id)}
              >
                <span className="docs-browser-item-title">
                  <span>{copy.name}</span>
                  <Badge tone={showcase.status === "active" ? "ok" : "warn"} dot>
                    {copy.statusLabel}
                  </Badge>
                </span>
                <span className="docs-browser-item-description">
                  {copy.description}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="docs-browser-preview">
        <div className="docs-browser-frame-header">
          <div>
            <h2>{activeCopy.name}</h2>
            <p>{activeCopy.description}</p>
          </div>
          <div className="docs-actions">
            <a href={withBase(activeShowcase.href)}>{m.showcases.open}</a>
            <a href={activeShowcase.sourceHref}>{m.showcases.source}</a>
          </div>
        </div>
        <div className="docs-tag-row">
          {activeCopy.capabilities.map((capability) => (
            <MonoTag key={capability}>{capability}</MonoTag>
          ))}
        </div>
        <iframe
          allow="fullscreen; gamepad; webgpu"
          className="docs-browser-frame"
          src={withBase(activeShowcase.href)}
          title={`${activeCopy.name} showcase`}
        />
      </div>
    </section>
  );
}
