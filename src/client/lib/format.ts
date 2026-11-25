/** A local calendar day as YYYY-MM-DD. */
export function localDay(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function dayLabel(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** The message of a failed server call, without framework noise. */
export function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "That didn't work.";
  try {
    const issues = JSON.parse(error.message) as { message?: string }[];
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
  } catch {
    // Not a validation error.
  }
  return error.message || "That didn't work.";
}
