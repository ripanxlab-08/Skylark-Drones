// Normalization layer: turns messy Monday.com column text into typed records.
import type { Deal, WorkOrder, FieldIssue, DataQuality } from "./bi-types";

const MISSING = new Set([
  "",
  "-",
  "--",
  "*",
  "n/a",
  "na",
  "n.a.",
  "null",
  "none given",
  "unknown",
  "not available",
  "tbd",
  "#n/a",
]);

export function cleanText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).replace(/\s+/g, " ").trim();
  if (!t || MISSING.has(t.toLowerCase())) return null;
  return t;
}

export function titleCase(v: string): string {
  return v
    .split(" ")
    .map((w) => (w.length > 3 && w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Conservative label normalization: whitespace + capitalization only. */
export function normalizeLabel(raw: string | null | undefined): string | null {
  const t = cleanText(raw);
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === t || t === t.toUpperCase()) return titleCase(lower);
  return t;
}

/** Parse currency/number text: strips symbols, commas, spaces. Returns null when unsafe. */
export function parseAmount(raw: string | null | undefined): number | null {
  const t = cleanText(raw);
  if (!t) return null;
  const cleaned = t.replace(/[₹$€£,\s]/g, "").replace(/^\(|\)$/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Parse dates from mixed formats. Ambiguous D/M vs M/D is resolved as
 * day-first (dataset is India-based); when both parts are <= 12 the value is
 * still parsed but flagged as ambiguous by the caller if needed.
 */
export function parseDate(raw: string | null | undefined): string | null {
  const t = cleanText(raw);
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m && m[1] && m[2] && m[3]) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m && m[1] && m[2] && m[3]) {
    let [a, b, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    if (a > 12 && b <= 12) return iso(y, b, a);
    if (b > 12 && a <= 12) return iso(y, a, b);
    return iso(y, b, a); // day-first default
  }
  m = t.match(/^(\d{1,2})[ -]([A-Za-z]{3,})[ -](\d{2,4})$/);
  if (m && m[1] && m[2] && m[3]) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (mon) return iso(y, mon, +m[1]);
  }
  m = t.match(/^([A-Za-z]{3,})[ -](\d{1,2}),?[ -](\d{2,4})$/);
  if (m && m[1] && m[2] && m[3]) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (mon) return iso(y, mon, +m[2]);
  }
  if (/^\d{10,13}$/.test(t)) {
    const ms = t.length === 13 ? +t : +t * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime()) && /\d{4}/.test(t)) return d.toISOString().slice(0, 10);
  return null;
}

export function isDateLike(raw: string | null | undefined): boolean {
  const t = cleanText(raw);
  if (!t) return false;
  return /\d/.test(t) && (/[/.-]/.test(t) || /[A-Za-z]{3}/.test(t));
}

/** Detects header-like rows that were imported as data. */
export function looksLikeHeaderRow(values: (string | null)[], headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  const hits = values.filter((v) => v && set.has(v.toLowerCase())).length;
  return hits >= 2;
}

export function buildQuality(
  deals: Deal[],
  workOrders: WorkOrder[],
  issues: FieldIssue[],
): DataQuality {
  const count = (b: FieldIssue["board"], field: string) =>
    issues.filter((i) => i.board === b && i.field === field).length;

  const dealTotal = Math.max(deals.length, 1);
  const woTotal = Math.max(workOrders.length, 1);

  const completenessMissing =
    deals.filter((d) => !d.customer || !d.sector || !d.stage).length +
    workOrders.filter((w) => !w.customer || !w.sector || !w.status).length;
  const completeness = pct(1 - completenessMissing / (dealTotal * 3 + woTotal * 3));

  const invalidDates = issues.filter((i) => i.issue.includes("date")).length;
  const validDates = pct(1 - invalidDates / (dealTotal * 2 + woTotal * 2));

  const missingValues =
    deals.filter((d) => d.value == null).length +
    workOrders.filter((w) => w.value == null).length;
  const validFinancials = pct(1 - missingValues / (dealTotal + woTotal));

  const namingIssues = issues.filter((i) => i.issue.includes("naming")).length;
  const naming = pct(1 - namingIssues / (dealTotal + woTotal));

  const missingStatus =
    deals.filter((d) => !d.status).length + workOrders.filter((w) => !w.status).length;
  const validStatus = pct(1 - missingStatus / (dealTotal + woTotal));

  const categories = [
    { key: "completeness", label: "Completeness", score: completeness, detail: `${completenessMissing} missing customer / sector / stage fields across both boards` },
    { key: "dates", label: "Valid dates", score: validDates, detail: `${invalidDates} unparsable date values` },
    { key: "financials", label: "Valid financial values", score: validFinancials, detail: `${missingValues} records without a usable value` },
    { key: "naming", label: "Consistent naming", score: naming, detail: `${namingIssues} records with header-like or inconsistent labels` },
    { key: "status", label: "Valid status / stage", score: validStatus, detail: `${missingStatus} records without a status` },
  ];

  const score = Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length);

  const grouped = new Map<string, number>();
  for (const i of issues) grouped.set(i.issue, (grouped.get(i.issue) ?? 0) + 1);

  return {
    score,
    categories,
    issues: issues.slice(0, 400),
    issueCounts: [...grouped.entries()]
      .map(([label, c]) => ({ label, count: c }))
      .sort((a, b) => b.count - a.count),
    notes: [
      "Sector, stage and status labels are normalized for whitespace and capitalization only — no fuzzy merging of distinct names.",
      "Missing financial values are kept as unavailable and excluded from totals; they are never treated as zero.",
      "Ambiguous numeric dates are parsed day-first (DD/MM/YYYY); values that cannot be parsed safely are marked invalid.",
      `Records flagged: ${count("deals", "deal_value")} deals without a usable value, ${count("work_orders", "status")} work orders without a status.`,
    ],
  };
}

function pct(v: number) {
  return Math.max(0, Math.min(100, Math.round(v * 100)));
}
