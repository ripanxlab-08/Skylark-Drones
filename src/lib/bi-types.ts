// Shared, browser-safe types for the BI layer.

export type FieldIssue = {
  recordId: string;
  recordName: string;
  board: "deals" | "work_orders";
  field: string;
  issue: string;
};

export type Deal = {
  id: string;
  name: string;
  customer: string | null;
  sector: string | null;
  value: number | null;
  stage: string | null;
  status: string | null;
  probability: string | null;
  closeDate: string | null; // ISO yyyy-mm-dd
  expectedCloseDate: string | null;
  createdDate: string | null;
  owner: string | null;
  product: string | null;
};

export type WorkOrder = {
  id: string;
  name: string;
  customer: string | null;
  sector: string | null;
  status: string | null;
  natureOfWork: string | null;
  startDate: string | null;
  endDate: string | null;
  deliveryDate: string | null;
  owner: string | null;
  value: number | null;
  billedValue: number | null;
  collectedValue: number | null;
};

export type DataQuality = {
  score: number;
  categories: { key: string; label: string; score: number; detail: string }[];
  issues: FieldIssue[];
  issueCounts: { label: string; count: number }[];
  notes: string[];
};

export type BoardMeta = {
  id: string;
  name: string;
  itemCount: number;
  mappedColumns: { field: string; column: string | null }[];
  unmappedColumns: string[];
};

export type BusinessData = {
  syncedAt: string;
  currency: string;
  deals: Deal[];
  workOrders: WorkOrder[];
  quality: DataQuality;
  boards: { deals: BoardMeta; workOrders: BoardMeta };
  status: "connected" | "partial";
  warnings: string[];
};

export type Filters = {
  sector: string | null;
  customer: string | null;
  stage: string | null;
  woStatus: string | null;
  quarter: string | null; // e.g. "2026-Q1"
};

export const emptyFilters: Filters = {
  sector: null,
  customer: null,
  stage: null,
  woStatus: null,
  quarter: null,
};
