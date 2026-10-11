/*
 * S1 Prior card (Final Design §7.1 "Prior card"): the Prior reveal.
 * Dashed L2 border (the Prior is a reference layer), lock glyph + lock time,
 * heading "Before looking", the component list extracted from the frozen
 * composition, and the always-visible footer "No cultural data used."
 * Collapses to a small "Before looking" tab so it never covers the heat.
 * Renders nothing when the model is null — the route shows the honest
 * loading state instead of a fabricated prior.
 */
import type { PriorCardModel } from "./s1Model.js";

export interface PriorCardProps {
  model: PriorCardModel | null;
  collapsed: boolean;
  onToggle: () => void;
}

function LockGlyph() {
  return (
    <svg
      className="s1-prior-lock"
      width="14"
      height="16"
      viewBox="0 0 14 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 7 V5 a4 4 0 0 1 8 0 V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="1.5" y="7" width="11" height="7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function PriorCard({ model, collapsed, onToggle }: PriorCardProps) {
  if (model === null) {
    return null;
  }
  return (
    <section className="s1-prior" aria-label="Frozen Prior">
      <button
        type="button"
        className="s1-prior-tab"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <LockGlyph />
        <span>{model.heading}</span>
        <span className="s1-prior-tab-hint" aria-hidden="true">
          {collapsed ? "＋" : "−"}
        </span>
      </button>
      {!collapsed && (
        <div className="s1-prior-body">
          <p className="s1-prior-locktime zq-nums">Locked {model.lockedAtLabel}</p>
          {model.components.length > 0 ? (
            <ul className="s1-prior-components">
              {model.components.map((component) => (
                <li key={component.label}>
                  <span className="s1-prior-component-label">{component.label}</span>
                  {component.detail !== null && (
                    <span className="s1-prior-component-detail">{component.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="s1-prior-note">The first guess listed no readable components.</p>
          )}
          <p className="s1-prior-footer">{model.footer}</p>
        </div>
      )}
    </section>
  );
}
