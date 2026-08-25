import {
  finiteNumber,
  freshestReading,
  utcTimestamp,
} from "./edge-function-poll.ts";

Deno.test("poll finiteNumber rejects missing source values", () => {
  for (const value of [null, undefined, "", " ", "bad", Infinity, NaN]) {
    if (finiteNumber(value) !== null) {
      throw new Error(`expected null for ${String(value)}`);
    }
  }
});

Deno.test("poll utcTimestamp rejects timezone-free timestamps", () => {
  if (utcTimestamp("2026-08-25T04:15:00Z") !== "2026-08-25T04:15:00.000Z") {
    throw new Error("valid RID timestamp was rejected");
  }
  if (utcTimestamp("2026-08-25 04:15:00") !== null) {
    throw new Error("timezone-free timestamp was accepted");
  }
});

Deno.test("freshestReading selects the newest authoritative reading", () => {
  const thaiWater = {
    measured_at: "2026-08-19T10:00:00.000Z",
    wl_msl: 183.22,
    source: "thaiwater_v3" as const,
    raw: {},
  };
  const rid = {
    measured_at: "2026-08-25T04:15:00.000Z",
    wl_msl: 182.14,
    source: "rid_bigdata" as const,
    raw: {},
  };
  if (freshestReading(thaiWater, rid)?.source !== "rid_bigdata") {
    throw new Error("newer RID reading was not selected");
  }
});
