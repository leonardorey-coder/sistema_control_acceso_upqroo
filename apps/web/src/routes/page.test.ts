import { describe, expect, it } from "bun:test";

describe("web scaffold", () => {
  it("has a runnable test surface", () => {
    expect("control-acceso-v2").toContain("v2");
  });
});
