import { describe, expect, it } from "vitest";
import { describeMapUnavailable } from "../../src/web/screens/s1/s1Model.js";

describe("describeMapUnavailable", () => {
  it("keeps the running claim only while the run can still progress", () => {
    expect(describeMapUnavailable("failed", true)).toContain("keeps running");
    expect(describeMapUnavailable("no-key", true)).toContain("keeps running");
  });

  it("says a stopped run is no longer running instead of implying live work", () => {
    const failed = describeMapUnavailable("failed", false);
    const missingKey = describeMapUnavailable("no-key", false);

    expect(failed).toContain("no longer running");
    expect(failed).not.toContain("keeps running");
    expect(missingKey).not.toContain("keeps running");
    expect(missingKey).toContain("every step that completed");
  });

  it("distinguishes a missing key from unreachable tiles", () => {
    expect(describeMapUnavailable("no-key", true)).toContain("no map key");
    expect(describeMapUnavailable("failed", true)).toContain("tiles never arrived");
  });
});
