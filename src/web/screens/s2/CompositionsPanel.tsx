import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CompositionCard, PriorCompositionCard } from "./CompositionCard.js";
import { Dial } from "./Dial.js";
import { Field } from "./Field.js";
import { DEFAULT_DIAL_WEIGHT, FINALIST_COUNT, rerankCards, type S2Model } from "./s2Model.js";

export interface CompositionsPanelProps {
  model: S2Model;
  onBack: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const LETTERS = ["A", "B", "C"];

export function CompositionsPanel({ model, onBack }: CompositionsPanelProps) {
  const [weight, setWeight] = useState(DEFAULT_DIAL_WEIGHT);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef(new Map<string, DOMRect>());

  const ordered = useMemo(
    () => rerankCards(model.rankedAll, weight).slice(0, FINALIST_COUNT),
    [model.rankedAll, weight]
  );

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (rail === null) {
      return;
    }
    const reduce = prefersReducedMotion();
    const previous = positionsRef.current;
    const next = new Map<string, DOMRect>();
    const nodes = rail.querySelectorAll<HTMLElement>("[data-card-key]");
    nodes.forEach((node) => {
      const key = node.dataset.cardKey ?? "";
      const rect = node.getBoundingClientRect();
      next.set(key, rect);
      if (reduce) {
        return;
      }
      const before = previous.get(key);
      if (before === undefined) {
        return;
      }
      const delta = before.top - rect.top;
      if (delta === 0) {
        return;
      }
      node.style.transition = "none";
      node.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        node.style.transition = "transform var(--zq-motion-dial) var(--zq-ease-out)";
        node.style.transform = "";
      });
    });
    positionsRef.current = next;
  });

  const handleSelect = useCallback((key: string) => {
    setSelectedKey((current) => (current === key ? null : key));
  }, []);

  return (
    <section className="s2-panel" aria-label="Compositions">
      <header className="s2-panel-header">
        <h2 className="s2-panel-title">Compositions</h2>
        <button type="button" className="s1-tertiary" onClick={onBack}>
          Back to the ledger
        </button>
      </header>
      <div className="s2-panel-scroll">
        <p className="s2-headline">{model.headline}</p>
        {model.field !== null ? (
          <Field field={model.field} selectedKey={selectedKey} />
        ) : (
          <div className="s2-field-empty" role="status">
            <p className="s2-field-title">The field</p>
            <p>{model.emptyReason}</p>
          </div>
        )}
        {model.poolNote !== null && <p className="s2-note">{model.poolNote}</p>}
        <Dial weight={weight} onChange={setWeight} />
        <div className="s2-rail" ref={railRef}>
          <PriorCompositionCard prior={model.prior} />
          {ordered.map((card, index) => (
            <CompositionCard
              key={card.key}
              card={card}
              letter={LETTERS[index] ?? String(index + 1)}
              selected={selectedKey === card.key}
              onSelect={handleSelect}
            />
          ))}
          {ordered.length === 0 && (
            <p className="s2-note">
              No composition could be ranked from this pool{model.excludedCount > 0
                ? ` — ${model.excludedCount} excluded for missing distinctiveness`
                : ""}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
