import { describe, expect, it } from "bun:test";
import { parsePagination } from "../src/shared/pagination";

describe("pagination parser", () => {
  it("defaults to first page with bounded page size", () => {
    expect(parsePagination({})).toEqual({
      page: 1,
      pageSize: 25,
      offset: 0
    });
  });

  it("computes offset for server-side tables", () => {
    expect(parsePagination({ page: "3", pageSize: "40" })).toEqual({
      page: 3,
      pageSize: 40,
      offset: 80
    });
  });
});
