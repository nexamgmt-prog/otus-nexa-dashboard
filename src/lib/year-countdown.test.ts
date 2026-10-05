import assert from "node:assert/strict";
import test from "node:test";
import { yearCountdown } from "./year-countdown";

test("counts calendar days in São Paulo and rolls over at local midnight", () => {
  assert.deepEqual(yearCountdown(new Date("2026-10-05T13:00:00Z")), {
    year: 2026, elapsedDays: 278, totalDays: 365, remainingDays: 87,
  });
  assert.equal(yearCountdown(new Date("2027-01-01T01:59:59Z")).remainingDays, 0);
  assert.equal(yearCountdown(new Date("2027-01-01T03:00:00Z")).remainingDays, 364);
});

test("includes leap day in the dot grid", () => {
  assert.deepEqual(yearCountdown(new Date("2028-02-29T15:00:00Z")), {
    year: 2028, elapsedDays: 60, totalDays: 366, remainingDays: 306,
  });
});
