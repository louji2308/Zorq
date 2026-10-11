/*
 * S0 address search — MapTiler forward geocoding with a combobox listbox
 * (Product Spec §7 S0: address/place search, autocomplete; NO Qloo calls).
 *
 * Behaviour:
 *  - typing fetches suggestions after a 300 ms debounce (silent);
 *  - Enter or the search glyph commits: it picks the highlighted (or first)
 *    suggestion, and if nothing could be placed it reports "empty"/"failed" so
 *    the screen can show the spec copy and open map point-pick mode.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { geocode, type GeocodeSuggestion } from "../../lib/geocode.js";

export type GeocodeState = "idle" | "searching" | "empty" | "failed";

const LISTBOX_ID = "s0-address-listbox";
const DEBOUNCE_MS = 300;

export interface AddressSearchProps {
  value: string;
  apiKey: string | null;
  disabled: boolean;
  /** Spec copy shown under the field while a placement failed (aria-live). */
  notice: string | null;
  onTextChange: (text: string) => void;
  onSelect: (suggestion: GeocodeSuggestion) => void;
  onGeocodeState: (state: GeocodeState) => void;
}

function SearchGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15.5 15.5 L21 21" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function AddressSearch({
  value,
  apiKey,
  disabled,
  notice,
  onTextChange,
  onSelect,
  onGeocodeState
}: AddressSearchProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const sequenceRef = useRef(0);
  const pickedRef = useRef<string | null>(null);

  function choose(suggestion: GeocodeSuggestion): void {
    pickedRef.current = suggestion.label;
    sequenceRef.current += 1;
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
    onSelect(suggestion);
  }

  async function searchNow(): Promise<void> {
    const query = value.trim();
    if (apiKey === null || query === "") return;
    const sequence = ++sequenceRef.current;
    onGeocodeState("searching");
    try {
      const results = await geocode(query, { apiKey, limit: 5 });
      if (sequence !== sequenceRef.current) return;
      if (results.length === 0) {
        setSuggestions([]);
        setOpen(false);
        onGeocodeState("empty");
        return;
      }
      setSuggestions(results);
      const pick = highlight >= 0 && highlight < results.length ? results[highlight] : results[0];
      if (pick !== undefined) choose(pick);
    } catch {
      if (sequence !== sequenceRef.current) return;
      setSuggestions([]);
      setOpen(false);
      onGeocodeState("failed");
    }
  }

  useEffect(() => {
    const query = value.trim();
    if (query === pickedRef.current) return;
    if (apiKey === null || query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setHighlight(-1);
      return;
    }
      const timer = window.setTimeout(() => {
      const sequence = ++sequenceRef.current;
      void (async () => {
        try {
          const results = await geocode(query, { apiKey, limit: 5 });
          if (sequence !== sequenceRef.current) return;
          setSuggestions(results);
          setOpen(results.length > 0);
          setHighlight(-1);
          // Report the debounced outcome too: the spec's "we couldn't place
          // that address" fallback must appear without the user pressing Enter.
          onGeocodeState(results.length === 0 ? "empty" : "idle");
        } catch {
          if (sequence !== sequenceRef.current) return;
          setSuggestions([]);
          setOpen(false);
          onGeocodeState("failed");
        }
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, apiKey]);

  const optionId = (index: number): string => `s0-address-option-${index}`;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && suggestions.length > 0) {
        const index = highlight >= 0 ? highlight : 0;
        const pick = suggestions[index];
        if (pick !== undefined) choose(pick);
      } else {
        void searchNow();
      }
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    }
  }

  return (
    <div className="s0-field">
      <div className="s0-label-row">
        <label className="s0-label" htmlFor="s0-address">
          Address
        </label>
      </div>
      <div className="s0-input-shell">
        <button
          type="button"
          className="s0-search-glyph"
          aria-label="Search for this address"
          disabled={disabled}
          onClick={() => void searchNow()}
        >
          <SearchGlyph />
        </button>
        <input
          id="s0-address"
          className="s0-input"
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={
            apiKey === null ? "Address search unavailable in this build" : "Search an address"
          }
          aria-expanded={open}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={open && highlight >= 0 ? optionId(highlight) : undefined}
          aria-describedby="s0-address-notice"
          value={value}
          onChange={(event) => {
            pickedRef.current = null;
            setHighlight(-1);
            onTextChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="s0-suggestions" role="listbox" id={LISTBOX_ID} aria-label="Address suggestions">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="none">
              <button
                type="button"
                id={optionId(index)}
                role="option"
                aria-selected={index === highlight}
                className={`s0-suggestion${index === highlight ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="s0-note" id="s0-address-notice" role="status" aria-live="polite">
        {notice ?? ""}
      </p>
    </div>
  );
}
