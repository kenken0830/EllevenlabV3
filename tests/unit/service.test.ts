import { describe, expect, it } from "vitest";

import { sanitizeRunName } from "../../src/service.js";

describe("sanitizeRunName", () => {
  it("keeps readable names while removing invalid path characters", () => {
    expect(sanitizeRunName("  demo run:01?  ")).toBe("demo-run01");
  });

  it("falls back when the provided name becomes empty", () => {
    expect(sanitizeRunName("<>:\\|?*")).toMatch(/^run-/);
  });
});
