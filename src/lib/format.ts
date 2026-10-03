const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
});

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

/** Formats a date-only value (YYYY-MM-DD) without timezone shifting. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}
