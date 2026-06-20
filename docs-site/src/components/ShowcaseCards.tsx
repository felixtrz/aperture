import { Badge, Card, MonoTag } from "lumin";
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
  return (
    <div className="docs-grid">
      {showcases.map((showcase) => (
        <Card
          key={showcase.id}
          title={
            <span className="docs-card-title">
              <span>{showcase.name}</span>
              <Badge tone={showcase.status === "active" ? "ok" : "warn"} dot>
                {showcase.status}
              </Badge>
            </span>
          }
        >
          <p>{showcase.description}</p>
          <div className="docs-tag-row">
            {showcase.capabilities.map((capability) => (
              <MonoTag key={capability}>{capability}</MonoTag>
            ))}
          </div>
          <div className="docs-actions">
            <a href={withBase(showcase.href)}>Open</a>
            <a href={showcase.sourceHref}>Source</a>
          </div>
        </Card>
      ))}
    </div>
  );
}
