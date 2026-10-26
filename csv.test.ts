import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("parses quotes, commas, escaped quotes, CRLF and embedded newlines", () => {
    const rows = parseCsv('Name,Notes\r\n"Doe, Jane","said ""hi""\nthere"\r\nBob,ok\r\n');
    expect(rows).toEqual([["Name", "Notes"], ["Doe, Jane", 'said "hi"\nthere'], ["Bob", "ok"]]);
  });
  it("skips blank lines and strips BOM", () => {
    expect(parseCsv("\uFEFFa,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("escapes output and neutralises formula injection", () => {
    const out = toCsv(["a", "b"], [['=cmd|"x"', "x,y"], ["+1", null]]);
    expect(out).toBe("a,b\r\n\"'=cmd|\"\"x\"\"\",\"x,y\"\r\n'+1,");
  });
});
