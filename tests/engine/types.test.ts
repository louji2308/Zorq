import { describe, expect, it } from "vitest";
import {
  EngineError,
  candidateComponentSchema,
  parseCandidateComponent,
  validatePool
} from "../../src/server/engine/index.js";
import { makeComponent, makePool } from "./fixtures.js";

function expectEngineError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(EngineError);
  expect((caught as EngineError).code).toBe(code);
  expect((caught as EngineError).message).not.toBe("");
}

describe("candidateComponentSchema", () => {
  it("accepts a valid component", () => {
    const component = makeComponent({ id: "cinema" });
    expect(candidateComponentSchema.parse(component)).toEqual(component);
  });

  it("rejects more than five exemplars", () => {
    const component = makeComponent({
      id: "cinema",
      exemplars: Array.from({ length: 6 }, (_, index) => ({
        id: `ex-${index}`,
        name: `Exemplar ${index}`
      }))
    });
    expectEngineError(() => parseCandidateComponent(component), "INVALID_COMPONENT");
  });

  it("rejects an unknown role", () => {
    const component = { ...makeComponent({ id: "cinema" }), role: "Hub" };
    expectEngineError(() => parseCandidateComponent(component), "INVALID_COMPONENT");
  });

  it("rejects an empty provenance path step", () => {
    const component = makeComponent({ id: "cinema" });
    component.provenancePath.anchorPlace = "";
    expectEngineError(() => parseCandidateComponent(component), "INVALID_COMPONENT");
  });

  it("rejects a provenance path with a missing step", () => {
    const component = makeComponent({ id: "cinema" });
    component.provenancePath = {
      anchorPlace: "anchor",
      qlooSignal: "signal",
      resolvedCategory: "category",
      exemplarSet: "exemplars"
    } as typeof component.provenancePath;
    expectEngineError(() => parseCandidateComponent(component), "INVALID_COMPONENT");
  });

  it("rejects a pool with duplicate component ids", () => {
    expectEngineError(() => validatePool([...makePool(["a"]), ...makePool(["a"])]), "INVALID_COMPONENT");
  });

  it("rejects a non-array pool", () => {
    expectEngineError(() => validatePool({ id: "a" }), "INVALID_COMPONENT");
  });
});
