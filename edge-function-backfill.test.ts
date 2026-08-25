import { finiteNumber, utcTimestamp } from "./edge-function-backfill.ts";

Deno.test("finiteNumber rejects missing and invalid source values", () => {
  const invalid = [null, undefined, "", "   ", "not-a-number", Infinity, NaN];
  for (const value of invalid) {
    if (finiteNumber(value) !== null) {
      throw new Error(`expected null for ${String(value)}`);
    }
  }
});

Deno.test("finiteNumber preserves valid numeric values including real zero", () => {
  const cases: [unknown, number][] = [[0, 0], ["0", 0], [183.22, 183.22]];
  for (const [input, expected] of cases) {
    if (finiteNumber(input) !== expected) {
      throw new Error(`expected ${expected} for ${String(input)}`);
    }
  }
});

Deno.test("utcTimestamp accepts zoned RID timestamps only", () => {
  const actual = utcTimestamp("2026-08-25T04:15:00Z");
  if (actual !== "2026-08-25T04:15:00.000Z") {
    throw new Error(`unexpected timestamp ${String(actual)}`);
  }
  if (
    utcTimestamp("2026-08-25 04:15:00") !== null ||
    utcTimestamp("bad") !== null
  ) {
    throw new Error("timezone-free or invalid timestamp was accepted");
  }
});
