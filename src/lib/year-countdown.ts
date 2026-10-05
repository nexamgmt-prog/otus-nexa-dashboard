const DAY_MS = 86_400_000;

/** Calendar days remaining after today in the given time zone. */
export function yearCountdown(date: Date, timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => Number(parts.find((item) => item.type === type)?.value);
  const year = part("year");
  const today = Date.UTC(year, part("month") - 1, part("day"));
  const start = Date.UTC(year, 0, 1);
  const nextYear = Date.UTC(year + 1, 0, 1);
  const elapsedDays = Math.round((today - start) / DAY_MS) + 1;
  const totalDays = Math.round((nextYear - start) / DAY_MS);
  return { year, elapsedDays, totalDays, remainingDays: totalDays - elapsedDays };
}
