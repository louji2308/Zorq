/*
 * /run/:id/blueprint — the read-only shareable blueprint (Product Spec §7 S5;
 * Final Design §6.3, "no top-bar tabs"). Renders the same S5 document via
 * BlueprintPanel with the optional ?share= token; unknown run, guard refusal,
 * and expired snapshot each get their own honest state (expired shows the
 * spec line plus a re-run path). No challenge or mutation affordances — a
 * shared snapshot is a decision artifact, not a workspace.
 */
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useRunStore } from "../store/runStore.js";
import { getRun } from "../lib/api.js";
import { useEffect } from "react";
import { BlueprintPanel } from "../screens/s5/BlueprintPanel.js";
import "../screens/s5/s5.css";

export function BlueprintRoute() {
  const params = useParams<{ id: string }>();
  const runId = params.id ?? "";
  const [searchParams] = useSearchParams();
  const share = searchParams.get("share") ?? undefined;
  const run = useRunStore((state) => state.run);

  useEffect(() => {
    if (runId === "") {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const fetched = await getRun(runId);
        if (!cancelled && useRunStore.getState().run?.id !== fetched.id) {
          useRunStore.getState().reset();
          useRunStore.getState().applyState(fetched);
          useRunStore.getState().applyEvidence(fetched.evidence ?? []);
        }
      } catch {
        /* the blueprint fetch below owns the honest error surface */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <div className="s1 is-reading">
      <div className="s1-top">
        <header className="s1-topbar">
          <h1 className="s1-wordmark">
            <Link to="/">Zorq</Link>
          </h1>
          <div className="s1-site-line">
            <span className="s1-site-location">
              {run?.brief?.location ?? "Place Blueprint"}
            </span>
            <span role="status">Read-only snapshot</span>
          </div>
        </header>
      </div>
      <BlueprintPanel run={run} runId={runId} share={share} />
    </div>
  );
}
