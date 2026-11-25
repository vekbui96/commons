export interface Conversion {
  id: string;
  from: string;
  to: string;
  forward: (x: number) => number;
  backward: (x: number) => number;
}

export const conversions: readonly Conversion[] = [
  { id: "km-mi", from: "km", to: "mi", forward: (x) => x / 1.609344, backward: (x) => x * 1.609344 },
  { id: "m-ft", from: "m", to: "ft", forward: (x) => x / 0.3048, backward: (x) => x * 0.3048 },
  { id: "cm-in", from: "cm", to: "in", forward: (x) => x / 2.54, backward: (x) => x * 2.54 },
  { id: "kg-lb", from: "kg", to: "lb", forward: (x) => x / 0.45359237, backward: (x) => x * 0.45359237 },
  {
    id: "c-f",
    from: "°C",
    to: "°F",
    forward: (x) => (x * 9) / 5 + 32,
    backward: (x) => ((x - 32) * 5) / 9,
  },
];

/** Rounds for display: up to 4 decimals, no trailing zeros. */
export function formatNumber(x: number): string {
  if (!Number.isFinite(x)) return "—";
  return Number(x.toFixed(4)).toString();
}
