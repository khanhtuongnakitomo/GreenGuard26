export type Period = "week" | "month" | "year" | "all";

export function getDateRange(period: Period) {
  const now = new Date();
  if (period === "all") return {};

  const start = new Date(now);
  if (period === "week") start.setDate(now.getDate() - 7);
  if (period === "month") start.setMonth(now.getMonth() - 1);
  if (period === "year") start.setFullYear(now.getFullYear() - 1);

  return { start, end: now };
}
