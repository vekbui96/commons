import { describe, expect, it } from "vitest";
import { conversions, formatNumber } from "./convert";

describe("units conversions", () => {
  it.each(conversions.map((c) => [c.id, c] as const))("%s round-trips", (_, c) => {
    for (const x of [-40, 0, 1, 12.5, 1000]) expect(c.backward(c.forward(x))).toBeCloseTo(x, 9);
  });

  it("uses exact factors", () => {
    const byId = Object.fromEntries(conversions.map((c) => [c.id, c]));
    expect(byId["km-mi"]!.backward(1)).toBe(1.609344);
    expect(byId["c-f"]!.forward(100)).toBe(212);
    expect(byId["c-f"]!.forward(-40)).toBe(-40);
  });

  it("formats to at most 4 decimals and shows a dash for non-numbers", () => {
    expect(formatNumber(0.621371192)).toBe("0.6214");
    expect(formatNumber(2)).toBe("2");
    expect(formatNumber(NaN)).toBe("—");
  });
});
