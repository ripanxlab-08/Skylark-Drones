// Deterministic business metrics engine. Pure functions, no AI, no I/O.
import type { BusinessData, Deal, Filters, WorkOrder } from "./bi-types";

export const UNKNOWN = "Unspecified";

export function quarterOf(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export function currentQuarter(now = new Date()): string {
  return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
}

export function dealOutcome(d: Deal): "won" | "lost" | "open" {
  const s = (d.status ?? "").toLowerCase();
  const stage = (d.stage ?? "").toLowerCase();
  if (s.includes("won") || stage.includes("won")) return "won";
  if (s.includes("dead") || s.includes("lost") || stage.includes("lost")) return "lost";
  return "open";
}

export function woState(w: WorkOrder): "completed" | "in_progress" | "not_started" | "stalled" | "unknown" {
  const s = (w.status ?? "").toLowerCase();
  if (!s) return "unknown";
  if (s.startsWith("completed")) return "completed";
  if (s.includes("pause") || s.includes("struck") || s.includes("stuck") || s.includes("cancel")) return "stalled";
  if (s.includes("not started") || s.includes("pending")) return "not_started";
  return "in_progress";
}

/** Delayed = not completed and a parsed end date is already in the past. */
export function isDelayed(w: WorkOrder, now = new Date()): boolean {
  const state = woState(w);
  if (state === "completed") return false;
  if (!w.endDate) return false;
  return new Date(w.endDate) < now;
}

export function dealQuarter(d: Deal): string | null {
  return quarterOf(d.closeDate ?? d.expectedCloseDate);
}

export function applyFilters(data: BusinessData, f: Filters) {
  const deals = data.deals.filter(
    (d) =>
      (!f.sector || (d.sector ?? UNKNOWN) === f.sector) &&
      (!f.customer || (d.customer ?? UNKNOWN) === f.customer) &&
      (!f.stage || (d.stage ?? UNKNOWN) === f.stage) &&
      (!f.quarter || dealQuarter(d) === f.quarter),
  );
  const workOrders = data.workOrders.filter(
    (w) =>
      (!f.sector || (w.sector ?? UNKNOWN) === f.sector) &&
      (!f.customer || (w.customer ?? UNKNOWN) === f.customer) &&
      (!f.woStatus || (w.status ?? UNKNOWN) === f.woStatus) &&
      (!f.quarter || quarterOf(w.startDate ?? w.endDate) === f.quarter),
  );
  return { deals, workOrders };
}

const sum = (ns: (number | null)[]) => ns.reduce<number>((s, n) => s + (n ?? 0), 0);

export type SalesMetrics = ReturnType<typeof salesMetrics>;
export function salesMetrics(deals: Deal[]) {
  const open = deals.filter((d) => dealOutcome(d) === "open");
  const won = deals.filter((d) => dealOutcome(d) === "won");
  const lost = deals.filter((d) => dealOutcome(d) === "lost");
  const valued = (ds: Deal[]) => ds.filter((d) => d.value != null);

  const closed = won.length + lost.length;
  return {
    totalDeals: deals.length,
    pipelineValue: sum(valued(open).map((d) => d.value)),
    pipelineValuedCount: valued(open).length,
    pipelineMissingValue: open.length - valued(open).length,
    wonRevenue: sum(valued(won).map((d) => d.value)),
    wonCount: won.length,
    lostCount: lost.length,
    activeDeals: open.length,
    winRate: closed >= 5 ? (won.length / closed) * 100 : null,
    winRateBasis: closed,
    avgDealValue: valued(won).length ? sum(valued(won).map((d) => d.value)) / valued(won).length : null,
    missingCloseDate: open.filter((d) => !d.closeDate && !d.expectedCloseDate).length,
  };
}

export type OpsMetrics = ReturnType<typeof opsMetrics>;
export function opsMetrics(workOrders: WorkOrder[], now = new Date()) {
  const completed = workOrders.filter((w) => woState(w) === "completed");
  const inProgress = workOrders.filter((w) => woState(w) === "in_progress");
  const notStarted = workOrders.filter((w) => woState(w) === "not_started");
  const stalled = workOrders.filter((w) => woState(w) === "stalled");
  const delayed = workOrders.filter((w) => isDelayed(w, now));
  const known = workOrders.filter((w) => woState(w) !== "unknown");

  const durations = workOrders
    .filter((w) => w.startDate && w.endDate && new Date(w.endDate) >= new Date(w.startDate))
    .map((w) => (new Date(w.endDate!).getTime() - new Date(w.startDate!).getTime()) / 86400000);

  const onTimeEligible = completed.filter((w) => w.endDate && w.deliveryDate);
  const onTime = onTimeEligible.filter((w) => new Date(w.deliveryDate!) <= new Date(w.endDate!));

  return {
    total: workOrders.length,
    completed: completed.length,
    inProgress: inProgress.length,
    notStarted: notStarted.length,
    stalled: stalled.length,
    delayed: delayed.length,
    delayedItems: delayed,
    completionRate: known.length >= 5 ? (completed.length / known.length) * 100 : null,
    avgDurationDays: durations.length >= 5 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    durationSample: durations.length,
    onTimeRate: onTimeEligible.length >= 5 ? (onTime.length / onTimeEligible.length) * 100 : null,
    onTimeSample: onTimeEligible.length,
    contractedValue: sum(workOrders.map((w) => w.value)),
    billedValue: sum(workOrders.map((w) => w.billedValue)),
    collectedValue: sum(workOrders.map((w) => w.collectedValue)),
  };
}

export function groupBy<T>(items: T[], key: (t: T) => string | null) {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it) ?? UNKNOWN;
    const arr = m.get(k) ?? [];
    arr.push(it);
    m.set(k, arr);
  }
  return m;
}

export function pipelineBySector(deals: Deal[]) {
  const open = deals.filter((d) => dealOutcome(d) === "open");
  const total = sum(open.map((d) => d.value)) || 1;
  return [...groupBy(open, (d) => d.sector).entries()]
    .map(([sector, ds]) => ({
      sector,
      deals: ds.length,
      value: sum(ds.map((d) => d.value)),
      share: (sum(ds.map((d) => d.value)) / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

export function stageDistribution(deals: Deal[]) {
  const open = deals.filter((d) => dealOutcome(d) === "open");
  const total = open.length || 1;
  return [...groupBy(open, (d) => d.stage).entries()]
    .map(([stage, ds]) => ({
      stage,
      deals: ds.length,
      value: sum(ds.map((d) => d.value)),
      share: (ds.length / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

export function woStatusDistribution(workOrders: WorkOrder[]) {
  const total = workOrders.length || 1;
  return [...groupBy(workOrders, (w) => w.status).entries()]
    .map(([status, ws]) => ({
      status,
      count: ws.length,
      value: sum(ws.map((w) => w.value)),
      share: (ws.length / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Late stage = stage label sorts after "D." in the discovered stage ordering, or mentions negotiation/proposal/po. */
export function isLateStage(d: Deal) {
  const s = (d.stage ?? "").toLowerCase();
  return /^[e-z]\./.test(s) || s.includes("negotiat") || s.includes("proposal") || s.includes("commercial") || s.includes("po ");
}

export function pipelineHealth(deals: Deal[], now = new Date()) {
  const open = deals.filter((d) => dealOutcome(d) === "open");
  const valued = open.filter((d) => d.value != null);
  const sorted = [...valued].map((d) => d.value!).sort((a, b) => a - b);
  const p75 = sorted.length ? (sorted[Math.floor(sorted.length * 0.75)] ?? 0) : 0;
  const late = open.filter(isLateStage);
  const stale = open.filter((d) => {
    const ref = d.expectedCloseDate ?? d.closeDate;
    return ref ? new Date(ref) < now : false;
  });
  return {
    totalPipeline: sum(valued.map((d) => d.value)),
    lateStageValue: sum(late.filter((d) => d.value != null).map((d) => d.value)),
    lateStageCount: late.length,
    earlyStageValue: sum(open.filter((d) => !isLateStage(d) && d.value != null).map((d) => d.value)),
    earlyStageCount: open.length - late.length,
    missingCloseDate: open.filter((d) => !d.closeDate && !d.expectedCloseDate).length,
    highValueThreshold: p75,
    highValue: valued.filter((d) => d.value! >= p75).sort((a, b) => b.value! - a.value!),
    stale,
  };
}

export function sectorPerformance(deals: Deal[], workOrders: WorkOrder[]) {
  const sectors = new Set<string>([
    ...deals.map((d) => d.sector ?? UNKNOWN),
    ...workOrders.map((w) => w.sector ?? UNKNOWN),
  ]);
  return [...sectors]
    .map((sector) => {
      const ds = deals.filter((d) => (d.sector ?? UNKNOWN) === sector);
      const ws = workOrders.filter((w) => (w.sector ?? UNKNOWN) === sector);
      return {
        sector,
        pipelineValue: sum(ds.filter((d) => dealOutcome(d) === "open").map((d) => d.value)),
        dealCount: ds.length,
        wonRevenue: sum(ds.filter((d) => dealOutcome(d) === "won").map((d) => d.value)),
        workOrders: ws.length,
        completed: ws.filter((w) => woState(w) === "completed").length,
        delayed: ws.filter((w) => isDelayed(w)).length,
      };
    })
    .sort((a, b) => b.pipelineValue + b.wonRevenue - (a.pipelineValue + a.wonRevenue));
}

export function customerIntelligence(deals: Deal[], workOrders: WorkOrder[]) {
  const names = new Set<string>([
    ...deals.map((d) => d.customer ?? UNKNOWN),
    ...workOrders.map((w) => w.customer ?? UNKNOWN),
  ]);
  return [...names]
    .map((customer) => {
      const ds = deals.filter((d) => (d.customer ?? UNKNOWN) === customer);
      const ws = workOrders.filter((w) => (w.customer ?? UNKNOWN) === customer);
      return {
        customer,
        pipeline: sum(ds.filter((d) => dealOutcome(d) === "open").map((d) => d.value)),
        wonRevenue: sum(ds.filter((d) => dealOutcome(d) === "won").map((d) => d.value)),
        deals: ds.length,
        workOrders: ws.length,
        delayed: ws.filter((w) => isDelayed(w)).length,
        both: ds.length > 0 && ws.length > 0,
      };
    })
    .sort((a, b) => b.pipeline + b.wonRevenue - (a.pipeline + a.wonRevenue));
}

export function crossBoard(deals: Deal[], workOrders: WorkOrder[]) {
  const customers = customerIntelligence(deals, workOrders);
  const linked = customers.filter((c) => c.both && c.customer !== UNKNOWN);
  return {
    linkAvailable: linked.length > 0,
    linkField: "Customer / client code",
    sharedCustomers: linked.length,
    expansion: customers
      .filter((c) => c.workOrders > 0 && c.pipeline > 0 && c.customer !== UNKNOWN)
      .slice(0, 8),
    riskAccounts: customers
      .filter((c) => c.delayed > 0 && (c.pipeline > 0 || c.wonRevenue > 0) && c.customer !== UNKNOWN)
      .sort((a, b) => b.delayed - a.delayed)
      .slice(0, 8),
  };
}

export type HealthGrade = "Strong" | "Moderate" | "Needs Attention";

export function businessHealth(sales: SalesMetrics, ops: OpsMetrics, dataScore: number) {
  const salesScore =
    (sales.winRate != null && sales.winRate >= 50 ? 1 : 0) +
    (sales.activeDeals >= 20 ? 1 : 0) +
    (sales.missingCloseDate / Math.max(sales.activeDeals, 1) < 0.3 ? 1 : 0);
  const opsScore =
    (ops.completionRate != null && ops.completionRate >= 70 ? 1 : 0) +
    (ops.delayed / Math.max(ops.total, 1) < 0.1 ? 1 : 0) +
    (ops.stalled / Math.max(ops.total, 1) < 0.05 ? 1 : 0);
  const grade = (n: number): HealthGrade => (n >= 3 ? "Strong" : n === 2 ? "Moderate" : "Needs Attention");
  const dataGrade: HealthGrade = dataScore >= 85 ? "Strong" : dataScore >= 65 ? "Moderate" : "Needs Attention";
  return {
    sales: {
      grade: grade(salesScore),
      rule: "Strong when win rate ≥ 50%, ≥ 20 active deals, and under 30% of active deals miss a close date (3 of 3 rules).",
    },
    operations: {
      grade: grade(opsScore),
      rule: "Strong when completion rate ≥ 70%, delayed work orders < 10% of total, and stalled work < 5% (3 of 3 rules).",
    },
    data: {
      grade: dataGrade,
      rule: "Strong at a data health score ≥ 85%, moderate at ≥ 65%.",
    },
  };
}

export function formatCurrency(value: number, currency = "INR", compact = true): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 0,
  }).format(value);
}

/** One deterministic snapshot object handed to the LLM as its only source of numbers. */
export function buildSnapshot(data: BusinessData, filters: Filters) {
  const { deals, workOrders } = applyFilters(data, filters);
  const sales = salesMetrics(deals);
  const ops = opsMetrics(workOrders);
  const health = businessHealth(sales, ops, data.quality.score);
  return {
    generatedAt: new Date().toISOString(),
    currency: data.currency,
    currentQuarter: currentQuarter(),
    activeFilters: filters,
    recordCounts: { deals: deals.length, workOrders: workOrders.length },
    sales: { ...sales, delayedItems: undefined },
    operations: { ...ops, delayedItems: ops.delayedItems.slice(0, 15).map((w) => ({ name: w.name, customer: w.customer, sector: w.sector, status: w.status, endDate: w.endDate })) },
    pipelineBySector: pipelineBySector(deals),
    stageDistribution: stageDistribution(deals),
    workOrderStatus: woStatusDistribution(workOrders),
    pipelineHealth: (() => {
      const h = pipelineHealth(deals);
      return { ...h, highValue: h.highValue.slice(0, 10).map((d) => ({ name: d.name, customer: d.customer, sector: d.sector, value: d.value, stage: d.stage, expectedCloseDate: d.expectedCloseDate })), stale: h.stale.slice(0, 10).map((d) => ({ name: d.name, customer: d.customer, value: d.value, expectedCloseDate: d.expectedCloseDate })) };
    })(),
    sectorPerformance: sectorPerformance(deals, workOrders),
    topCustomers: customerIntelligence(deals, workOrders).slice(0, 12),
    crossBoard: crossBoard(deals, workOrders),
    businessHealth: health,
    dataQuality: {
      score: data.quality.score,
      categories: data.quality.categories,
      topIssues: data.quality.issueCounts.slice(0, 10),
      notes: data.quality.notes,
    },
  };
}
