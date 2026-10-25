/*
 * S1 Agent Ledger — model + render tests.
 *
 * Fixtures are Zod-parsed against the REAL ledgerEventSchema
 * (src/shared/events.ts), so every field under test is one the server can
 * actually persist and stream. Expansion fields are exactly what the schema
 * carries; `parameters` is defence-in-depth for a future schema and is
 * proven here to be key-redacted before it can reach the DOM. Degraded rows
 * carry shape (dashed circle) AND words — never colour alone (AGENTS §13).
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ledgerEventSchema, type LedgerEvent } from "../../src/shared/events.js";
import { LedgerPanel, LedgerRowExpansion } from "../../src/web/screens/s1/LedgerPanel.js";
import {
  REDACTED,
  describeLedgerRow,
  describeLedgerRows,
  formatDuration,
  redactSensitive,
  type LedgerRowModel
} from "../../src/web/screens/s1/s1Model.js";

function qlooEvent(overrides: Record<string, unknown> = {}): LedgerEvent {
  return ledgerEventSchema.parse({
    kind: "Qloo",
    label: "qloo_insights",
    summary: "ok insights via rest | live | 12 result(s)",
    duration: 1234,
    cacheState: "live",
    resultCount: 12,
    ...overrides
  });
}

function row(sequence: number, event: LedgerEvent): { sequence: number; event: LedgerEvent } {
  return { sequence, event };
}

function model(sequence: number, event: LedgerEvent): LedgerRowModel {
  return describeLedgerRow(row(sequence, event));
}

describe("describeLedgerRow — expansion fields from the real event schema", () => {
  it("projects the schema-carried fields the expansion shows, inventing nothing", () => {
    const projected = model(7, qlooEvent());

    expect(projected).toEqual({
      sequence: 7,
      kind: "Qloo",
      label: "Read local culture signals around the site",
      technicalLabel: "qloo_insights",
      summary: "ok insights via rest | live | 12 result(s)",
      durationLabel: "1.2s",
      cacheLabel: "Live",
      resultCount: 12,
      dashed: false,
      note: null,
      parameters: null
    });
  });

  it("maps live, cached and n/a cache states honestly", () => {
    expect(model(1, qlooEvent({ cacheState: "live" })).cacheLabel).toBe("Live");
    expect(model(1, qlooEvent({ cacheState: "cached" })).cacheLabel).toBe("From cache");
    expect(
      model(
        1,
        ledgerEventSchema.parse({
          kind: "LLM",
          label: "prior:generate",
          summary: "draft",
          duration: 10,
          cacheState: "n/a",
          resultCount: 1
        })
      ).cacheLabel
    ).toBeNull();
  });

  it("renders unmapped technical labels verbatim — interpretation, not invention", () => {
    const projected = model(1, qlooEvent({ label: "qloo_something_new" }));

    expect(projected.label).toBe("qloo_something_new");
    expect(projected.technicalLabel).toBe("qloo_something_new");
  });

  it("maps the known prior and run labels onto plain language", () => {
    const prior = model(
      1,
      ledgerEventSchema.parse({
        kind: "LLM",
        label: "prior:generate",
        summary: "locked",
        duration: 5,
        cacheState: "n/a",
        resultCount: 1
      })
    );
    expect(prior.label).toBe("Wrote the first guess — before any cultural data");

    const planned = model(1, qlooEvent({ kind: "LLM", label: "investigate:turn:1" }));
    expect(planned.label).toBe("Planned the next probe");
  });

  it("flags a degraded Qloo row with a dashed circle AND words", () => {
    const projected = model(3, qlooEvent({ summary: "degraded insights via mcp | cached | 2 result(s)" }));

    expect(projected.dashed).toBe(true);
    expect(projected.note).toBe(
      "Qloo answered partially or late — the row shows exactly what came back."
    );
  });

  it("flags a rate-limited run error with a dashed circle AND words", () => {
    const projected = model(
      4,
      ledgerEventSchema.parse({
        kind: "Qloo",
        label: "run.error",
        summary: "Qloo answered 429 RATE_LIMITED after bounded retries",
        duration: 800,
        cacheState: "n/a",
        resultCount: 0
      })
    );

    expect(projected.dashed).toBe(true);
    expect(projected.note).toBe("Rate limited upstream — the agent could not complete this step.");
  });

  it("passes parameters through redaction before they can render", () => {
    const withParams = {
      ...qlooEvent(),
      parameters: {
        query: "record shop",
        api_key: "secret-marker-should-not-render",
        nested: { token: "abc", keep: 1 }
      }
    } as unknown as LedgerEvent;

    const projected = model(9, withParams);

    expect(projected.parameters).toEqual({
      query: "record shop",
      api_key: REDACTED,
      nested: { token: REDACTED, keep: 1 }
    });
    expect(JSON.stringify(projected.parameters)).not.toContain("secret-marker-should-not-render");
  });

  it("keeps duration formatting deterministic and honest about invalid values", () => {
    expect(formatDuration(0)).toBe("0.0s");
    expect(formatDuration(5123)).toBe("5.1s");
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(model(1, qlooEvent({ duration: -5 })).durationLabel).toBe("—");
  });
});

describe("redactSensitive", () => {
  it("redacts key-like names at any depth and leaves other values intact", () => {
    expect(
      redactSensitive({
        key: "x",
        API_KEY: "y",
        Authorization: "z",
        access_token: "t",
        password: "p",
        keep: "visible",
        list: [{ secret: "s" }, "plain"]
      })
    ).toEqual({
      key: REDACTED,
      API_KEY: REDACTED,
      Authorization: REDACTED,
      access_token: REDACTED,
      password: REDACTED,
      keep: "visible",
      list: [{ secret: REDACTED }, "plain"]
    });
  });

  it("caps runaway depth instead of recursing forever", () => {
    let deep: Record<string, unknown> = { value: "bottom" };
    for (let i = 0; i < 10; i += 1) {
      deep = { child: deep };
    }

    const redacted = redactSensitive(deep) as Record<string, unknown>;
    expect(JSON.stringify(redacted)).toContain(REDACTED);
  });
});

describe("describeLedgerRows", () => {
  it("maps rows in order and preserves the server's sequence ids", () => {
    const rows = describeLedgerRows([
      row(1, qlooEvent()),
      row(2, ledgerEventSchema.parse({ kind: "Compute", label: "measure.compose", summary: "closed", duration: 3, cacheState: "n/a", resultCount: 0 }))
    ]);

    expect(rows.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(rows[1]?.label).toBe("Closed the measurement phase");
  });
});

describe("LedgerPanel rendering", () => {
  const noop = (): void => {};

  it("shows the honest empty state before any call completes", () => {
    const html = renderToStaticMarkup(
      createElement(LedgerPanel, { rows: [], stopVisible: true, stopping: false, onStop: noop })
    );

    expect(html).toContain("What Zorq is doing");
    expect(html).toContain("Nothing has completed yet.");
    expect(html).toContain("Stop and show best so far");
  });

  it("renders real rows with label, kind and duration — expansion gated until clicked", () => {
    const rows = describeLedgerRows([row(7, qlooEvent())]);
    const html = renderToStaticMarkup(
      createElement(LedgerPanel, { rows, stopVisible: true, stopping: false, onStop: noop })
    );

    expect(html).toContain("Read local culture signals around the site");
    expect(html).toContain("Qloo");
    expect(html).toContain("1.2s");
    expect(html).toContain("aria-expanded=\"false\"");
    expect(html).toContain("aria-controls=\"s1-ledger-expansion-7\"");
    expect(html).not.toContain("qloo_insights");
  });

  it("puts the degraded row's words on screen, not just a dashed circle", () => {
    const rows = describeLedgerRows([
      row(4, ledgerEventSchema.parse({
        kind: "Qloo",
        label: "run.error",
        summary: "Qloo answered 429 RATE_LIMITED",
        duration: 800,
        cacheState: "n/a",
        resultCount: 0
      }))
    ]);
    const html = renderToStaticMarkup(
      createElement(LedgerPanel, { rows, stopVisible: true, stopping: false, onStop: noop })
    );

    expect(html).toContain("s1-row is-flagged");
    expect(html).toContain("is-dashed");
    expect(html).toContain("Rate limited upstream");
  });

  it("hides the stop control when the run is no longer active", () => {
    const html = renderToStaticMarkup(
      createElement(LedgerPanel, { rows: [], stopVisible: false, stopping: false, onStop: noop })
    );

    expect(html).not.toContain("Stop and show best so far");
  });

  it("disables the stop control while a stop is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(LedgerPanel, { rows: [], stopVisible: true, stopping: true, onStop: noop })
    );

    expect(html).toContain("Stopping…");
    expect(html).toContain("disabled");
  });

  it("shows an honest retry affordance for a partial run", () => {
    const html = renderToStaticMarkup(
      createElement(LedgerPanel, {
        rows: [],
        stopVisible: false,
        stopping: false,
        onStop: noop,
        recovery: {
          message: "This investigation stopped with partial results. Retry to continue from the same frozen Prior.",
          retrying: false,
          error: null,
          onRetry: noop
        }
      })
    );

    expect(html).toContain("This investigation stopped with partial results.");
    expect(html).toContain("Retry investigation");
    expect(html).not.toContain("disabled");
  });

  it("disables retry while the real retry request is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(LedgerPanel, {
        rows: [],
        stopVisible: false,
        stopping: false,
        onStop: noop,
        recovery: {
          message: "This investigation failed before it could finish. Retry to try the cultural pass again.",
          retrying: true,
          error: null,
          onRetry: noop
        }
      })
    );

    expect(html).toContain("Retrying investigation…");
    expect(html).toContain("disabled");
  });
});

describe("LedgerRowExpansion rendering", () => {
  it("shows every schema-carried field for a live Qloo call", () => {
    const projected = model(7, qlooEvent());
    const html = renderToStaticMarkup(createElement(LedgerRowExpansion, { row: projected }));

    expect(html).toContain("Call");
    expect(html).toContain("qloo_insights");
    expect(html).toContain("ok insights via rest | live | 12 result(s)");
    expect(html).toContain("12");
    expect(html).toContain("Live");
    expect(html).toContain("1.2s");
    expect(html).not.toContain("Parameters (redacted)");
  });

  it("says 'Not recorded' instead of guessing a cache state", () => {
    const projected = model(
      1,
      ledgerEventSchema.parse({
        kind: "LLM",
        label: "prior:generate",
        summary: "locked",
        duration: 5,
        cacheState: "n/a",
        resultCount: 1
      })
    );
    const html = renderToStaticMarkup(createElement(LedgerRowExpansion, { row: projected }));

    expect(html).toContain("Not recorded");
  });

  it("renders redacted parameters as JSON with the secret values gone", () => {
    const withParams = {
      ...qlooEvent(),
      parameters: { query: "wine bar", api_key: "secret-marker-should-not-render" }
    } as unknown as LedgerEvent;
    const html = renderToStaticMarkup(
      createElement(LedgerRowExpansion, { row: model(8, withParams) })
    );

    expect(html).toContain("Parameters (redacted)");
    expect(html).toContain("wine bar");
    expect(html).toContain(REDACTED);
    expect(html).not.toContain("secret-marker-should-not-render");
  });
});
