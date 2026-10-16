const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurWhole = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const huf = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
  // Hungarian leaves four-digit numbers ungrouped, which reads as a typo when
  // prices sit in a column. Group them all so the figures line up.
  useGrouping: "always",
});

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatEur(value: number, whole = false): string {
  return (whole ? eurWhole : eur).format(value);
}

export function formatHuf(value: number): string {
  return huf.format(value);
}

export function formatMoney(value: number, currency: "EUR" | "HUF"): string {
  return currency === "HUF" ? formatHuf(value) : formatEur(value);
}

/** Rounded whole percent. Values here are always shown as magnitudes. */
export function formatPct(value: number): string {
  return `${Math.round(Math.abs(value))}%`;
}

function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Group heading for a transaction date.
 *
 * `reference` is the newest date in the statement, not the system clock, so the
 * demo reads the same tomorrow as it does today.
 */
export function formatDayGroup(date: string, reference: string): string {
  const diff = daysBetween(parseDay(date), parseDay(reference));

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return dayMonth.format(parseDay(date));
}

/** Groups transactions into day buckets, preserving the input order. */
export function groupByDay<T extends { date: string }>(
  items: T[],
  reference: string,
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];

  for (const item of items) {
    const label = formatDayGroup(item.date, reference);
    const last = groups.at(-1);

    if (last?.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return groups;
}
