// Monday.com connector — READ ONLY. Runs server-side only.
import type { BusinessData, Deal, WorkOrder, FieldIssue, BoardMeta } from "./bi-types";
import {
  buildQuality,
  cleanText,
  isDateLike,
  looksLikeHeaderRow,
  normalizeLabel,
  parseAmount,
  parseDate,
} from "./normalize.server";

const API = "https://api.monday.com/v2";

type RawColumn = { id: string; title: string; type: string };
type RawItem = { id: string; name: string; column_values: { id: string; text: string | null; value?: string | null }[] };

export class MondayError extends Error {
  readonly userMessage: string;
  constructor(message: string, userMessage: string) {
    super(message);
    this.userMessage = userMessage;
  }
}

async function gql<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new MondayError("network", "Unable to reach Monday.com. Please check the connection and try again.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new MondayError("auth", "Monday.com rejected the credentials. Please verify the API token.");
  }
  if (res.status === 429) {
    throw new MondayError("rate", "Monday.com rate limit reached. Please retry in a moment.");
  }
  if (!res.ok) {
    throw new MondayError("http", "Monday.com returned an unexpected response. Please try again.");
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  const firstError = json.errors?.[0]?.message;
  if (firstError) {
    throw new MondayError(firstError, "Monday.com could not complete the request. Please check the board configuration.");
  }
  if (!json.data) throw new MondayError("empty", "Monday.com returned no data.");
  return json.data;
}

async function fetchBoard(boardId: string, token: string) {
  const meta = await gql<{ boards: { id: string; name: string; columns: RawColumn[] }[] }>(
    `query($ids:[ID!]){boards(ids:$ids){id name columns{id title type}}}`,
    { ids: [boardId] },
    token,
  );
  const board = meta.boards?.[0];
  if (!board) throw new MondayError("not_found", `Board ${boardId} was not found in this Monday.com account.`);

  const items: RawItem[] = [];
  let cursor: string | null = null;
  do {
    const page: { boards: { items_page?: { cursor: string | null; items: RawItem[] } }[] } = await gql(
      `query($ids:[ID!],$c:String){boards(ids:$ids){items_page(limit:500,cursor:$c){cursor items{id name column_values{id text value}}}}}`,
      { ids: [boardId], c: cursor },
      token,
    );
    const p = page.boards?.[0]?.items_page;
    if (!p || !p.items) break;
    items.push(...p.items);
    cursor = p.cursor;
  } while (cursor && items.length < 5000);

  return { board, items };
}

/** Flexible column mapping: match on column titles rather than fixed ids. */
function mapper(columns: RawColumn[]) {
  const used = new Set<string>();
  const find = (...tests: ((t: string) => boolean)[]) => {
    for (const test of tests) {
      const col = columns.find((c) => !used.has(c.id) && c.type !== "name" && test(c.title.toLowerCase()));
      if (col) {
        used.add(col.id);
        return col;
      }
    }
    return null;
  };
  return { find, used };
}

function valueOf(item: RawItem, colId: string | null | undefined) {
  if (!colId) return null;
  const cv = item.column_values?.find((c) => c.id === colId);
  if (!cv) return null;
  if (cv.text && cv.text.trim()) return cleanText(cv.text);
  if (cv.value) {
    try {
      const parsed = JSON.parse(cv.value);
      if (typeof parsed === "string" || typeof parsed === "number") return cleanText(String(parsed));
      if (parsed && typeof parsed === "object") {
        if (parsed.date) return cleanText(parsed.date);
        if (parsed.text) return cleanText(parsed.text);
        if (parsed.label) return cleanText(parsed.label);
        if (parsed.number) return cleanText(String(parsed.number));
      }
    } catch {}
  }
  return null;
}

function metaFor(
  board: { id: string; name: string },
  columns: RawColumn[],
  items: RawItem[],
  mapped: Record<string, RawColumn | null>,
  used: Set<string>,
): BoardMeta {
  return {
    id: board.id,
    name: board.name,
    itemCount: items.length,
    mappedColumns: Object.entries(mapped).map(([field, col]) => ({ field, column: col?.title ?? null })),
    unmappedColumns: columns.filter((c) => !used.has(c.id) && c.type !== "name").map((c) => c.title),
  };
}

export async function loadBusinessData(env: {
  token: string;
  dealsBoardId: string;
  workOrdersBoardId: string;
}): Promise<BusinessData> {
  const warnings: string[] = [];
  const issues: FieldIssue[] = [];

  const [dealsRes, woRes] = await Promise.all([
    fetchBoard(env.dealsBoardId, env.token),
    fetchBoard(env.workOrdersBoardId, env.token),
  ]);

  // ---- Deals mapping ----
  const dm = mapper(dealsRes.board.columns);
  const dMap = {
    customer: dm.find((t) => t.includes("client"), (t) => t.includes("customer"), (t) => t.includes("account")),
    sector: dm.find((t) => t.includes("sector"), (t) => t.includes("industry")),
    deal_value: dm.find((t) => t.includes("deal value"), (t) => t.includes("value"), (t) => t.includes("amount")),
    stage: dm.find((t) => t.includes("stage")),
    status: dm.find((t) => t.includes("deal status"), (t) => t.includes("status")),
    probability: dm.find((t) => t.includes("probability")),
    close_date: dm.find((t) => t.includes("close date")),
    expected_close_date: dm.find((t) => t.includes("tentative"), (t) => t.includes("expected")),
    created_date: dm.find((t) => t.includes("created")),
    owner: dm.find((t) => t.includes("owner"), (t) => t.includes("personnel"), (t) => t.includes("person")),
    product: dm.find((t) => t.includes("product")),
  };
  const dealHeaders = dealsRes.board.columns.map((c) => c.title);

  const deals: Deal[] = [];
  for (const item of dealsRes.items) {
    const raw: Record<string, string | null> = Object.fromEntries(
      Object.entries(dMap).map(([k, col]) => [k, valueOf(item, col?.id)]),
    );

    if (looksLikeHeaderRow(Object.values(raw), dealHeaders)) {
      issues.push({ recordId: item.id, recordName: item.name, board: "deals", field: "record", issue: "Header-like row imported as data (inconsistent naming)" });
      continue;
    }

    const value = parseAmount(raw["deal_value"]);
    if (value == null) {
      issues.push({ recordId: item.id, recordName: item.name, board: "deals", field: "deal_value", issue: raw["deal_value"] ? "Unparsable financial value" : "Missing deal value" });
    }
    const closeDate = parseDate(raw["close_date"]);
    if (!closeDate && isDateLike(raw["close_date"])) {
      issues.push({ recordId: item.id, recordName: item.name, board: "deals", field: "close_date", issue: "Invalid close date" });
    }
    const expected = parseDate(raw["expected_close_date"]);
    if (!expected && !closeDate) {
      issues.push({ recordId: item.id, recordName: item.name, board: "deals", field: "expected_close_date", issue: "Missing expected close date" });
    }
    if (!raw["sector"]) issues.push({ recordId: item.id, recordName: item.name, board: "deals", field: "sector", issue: "Missing sector" });
    if (!raw["stage"]) issues.push({ recordId: item.id, recordName: item.name, board: "deals", field: "stage", issue: "Missing deal stage" });
    if (!raw["customer"]) issues.push({ recordId: item.id, recordName: item.name, board: "deals", field: "customer", issue: "Missing customer" });

    deals.push({
      id: item.id,
      name: cleanText(item.name) ?? `Deal ${item.id}`,
      customer: normalizeLabel(raw["customer"]),
      sector: normalizeLabel(raw["sector"]),
      value,
      stage: normalizeLabel(raw["stage"]),
      status: normalizeLabel(raw["status"]),
      probability: normalizeLabel(raw["probability"]),
      closeDate,
      expectedCloseDate: expected,
      createdDate: parseDate(raw["created_date"]),
      owner: cleanText(raw["owner"]),
      product: normalizeLabel(raw["product"]),
    });
  }

  // ---- Work orders mapping ----
  const wm = mapper(woRes.board.columns);
  const wMap = {
    customer: wm.find((t) => t.includes("customer"), (t) => t.includes("client")),
    sector: wm.find((t) => t.includes("sector"), (t) => t.includes("industry")),
    status: wm.find((t) => t.includes("execution status"), (t) => t.includes("status")),
    nature_of_work: wm.find((t) => t.includes("nature of work"), (t) => t.includes("type of work")),
    start_date: wm.find((t) => t.includes("start date")),
    end_date: wm.find((t) => t.includes("end date")),
    delivery_date: wm.find((t) => t.includes("delivery date"), (t) => t.includes("completion")),
    owner: wm.find((t) => t.includes("personnel"), (t) => t.includes("owner"), (t) => t.includes("person")),
    value: wm.find((t) => t.includes("amount") && t.includes("excl"), (t) => t.includes("amount")),
    billed_value: wm.find((t) => t.includes("billed value") && t.includes("excl"), (t) => t.includes("billed value")),
    collected_value: wm.find((t) => t.includes("collected")),
  };
  const woHeaders = woRes.board.columns.map((c) => c.title);

  const workOrders: WorkOrder[] = [];
  for (const item of woRes.items) {
    const raw: Record<string, string | null> = Object.fromEntries(
      Object.entries(wMap).map(([k, col]) => [k, valueOf(item, col?.id)]),
    );

    if (looksLikeHeaderRow(Object.values(raw), woHeaders)) {
      issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "record", issue: "Header-like row imported as data (inconsistent naming)" });
      continue;
    }

    const start = parseDate(raw["start_date"]);
    const end = parseDate(raw["end_date"]);
    if (!start && isDateLike(raw["start_date"])) issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "start_date", issue: "Invalid start date" });
    if (!end && isDateLike(raw["end_date"])) issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "end_date", issue: "Invalid end date" });
    if (!raw["status"]) issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "status", issue: "Missing work order status" });
    if (!raw["sector"]) issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "sector", issue: "Missing sector" });
    if (!raw["customer"]) issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "customer", issue: "Missing customer" });
    const value = parseAmount(raw["value"]);
    if (value == null) issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "value", issue: raw["value"] ? "Unparsable financial value" : "Missing work order value" });
    if (start && end && new Date(end) < new Date(start)) {
      issues.push({ recordId: item.id, recordName: item.name, board: "work_orders", field: "end_date", issue: "End date before start date (invalid date range)" });
    }

    workOrders.push({
      id: item.id,
      name: cleanText(item.name) ?? `Work order ${item.id}`,
      customer: normalizeLabel(raw["customer"]),
      sector: normalizeLabel(raw["sector"]),
      status: normalizeLabel(raw["status"]),
      natureOfWork: normalizeLabel(raw["nature_of_work"]),
      startDate: start,
      endDate: end,
      deliveryDate: parseDate(raw["delivery_date"]),
      owner: cleanText(raw["owner"]),
      value,
      billedValue: parseAmount(raw["billed_value"]),
      collectedValue: parseAmount(raw["collected_value"]),
    });
  }

  if (!deals.length) warnings.push("The Deals board returned no records.");
  if (!workOrders.length) warnings.push("The Work Orders board returned no records.");

  return {
    syncedAt: new Date().toISOString(),
    currency: "INR",
    deals,
    workOrders,
    quality: buildQuality(deals, workOrders, issues),
    boards: {
      deals: metaFor(dealsRes.board, dealsRes.board.columns, dealsRes.items, dMap, dm.used),
      workOrders: metaFor(woRes.board, woRes.board.columns, woRes.items, wMap, wm.used),
    },
    status: warnings.length ? "partial" : "connected",
    warnings,
  };
}

export function getSampleSkylarkData(): BusinessData {
  const deals: Deal[] = [
    { id: "d1", name: "Coal India Topographical Mapping", customer: "Coal India Ltd", sector: "Mining", value: 4500000, stage: "e. Commercial Negotiation", status: "Open", probability: "80%", closeDate: null, expectedCloseDate: "2026-09-15", createdDate: "2026-06-10", owner: "Rohan Sharma", product: "Drone Surveying" },
    { id: "d2", name: "Tata Power Solar Thermography", customer: "Tata Power Renewable", sector: "Solar", value: 2800000, stage: "d. Proposal Submitted", status: "Open", probability: "60%", closeDate: null, expectedCloseDate: "2026-09-30", createdDate: "2026-07-01", owner: "Ananya Iyer", product: "Thermal AI Inspection" },
    { id: "d3", name: "NHAI Highway Expansion Inspection", customer: "NHAI", sector: "Infrastructure", value: 6200000, stage: "Won", status: "Won", probability: "100%", closeDate: "2026-08-12", expectedCloseDate: "2026-08-12", createdDate: "2026-05-15", owner: "Vikram Patel", product: "LiDAR Mapping" },
    { id: "d4", name: "L&T Transmission Line Monitoring", customer: "Larsen & Toubro", sector: "Energy", value: 3900000, stage: "f. PO Received", status: "Won", probability: "100%", closeDate: "2026-08-20", expectedCloseDate: "2026-08-20", createdDate: "2026-06-01", owner: "Rohan Sharma", product: "Line Inspection" },
    { id: "d5", name: "Vedanta Zinc Mine Volumetric Survey", customer: "Vedanta Resources", sector: "Mining", value: 1800000, stage: "c. Technical Evaluation", status: "Open", probability: "50%", closeDate: null, expectedCloseDate: "2026-10-15", createdDate: "2026-07-20", owner: "Priya Nair", product: "Volumetric Analytics" },
    { id: "d6", name: "Adani Green Wind Turbine Blade Scan", customer: "Adani Green Energy", sector: "Energy", value: 5100000, stage: "e. Commercial Negotiation", status: "Open", probability: "75%", closeDate: null, expectedCloseDate: "2026-09-25", createdDate: "2026-06-28", owner: "Ananya Iyer", product: "AI Defect Detection" },
    { id: "d7", name: "Jindal Steel Plant Asset Audit", customer: "Jindal Steel", sector: "Infrastructure", value: 2400000, stage: "b. Discovery Meeting", status: "Open", probability: "30%", closeDate: null, expectedCloseDate: "2026-11-01", createdDate: "2026-08-05", owner: "Vikram Patel", product: "Digital Twin" },
    { id: "d8", name: "NTPC Thermal Power Plant Volumetrics", customer: "NTPC Ltd", sector: "Energy", value: 3100000, stage: "Won", status: "Won", probability: "100%", closeDate: "2026-07-18", expectedCloseDate: "2026-07-18", createdDate: "2026-04-10", owner: "Rohan Sharma", product: "Volumetric Analytics" },
  ];

  const workOrders: WorkOrder[] = [
    { id: "wo1", name: "NHAI Highway Corridor Flight Ops", customer: "NHAI", sector: "Infrastructure", status: "In Progress", natureOfWork: "LiDAR Flight", startDate: "2026-08-01", endDate: "2026-09-10", deliveryDate: "2026-09-15", owner: "Rajesh Kumar", value: 6200000, billedValue: 3100000, collectedValue: 1500000 },
    { id: "wo2", name: "L&T Transmission Line Drone Survey", customer: "Larsen & Toubro", sector: "Energy", status: "Completed", natureOfWork: "Inspection", startDate: "2026-07-05", endDate: "2026-08-15", deliveryDate: "2026-08-14", owner: "Amit Verma", value: 3900000, billedValue: 3900000, collectedValue: 3900000 },
    { id: "wo3", name: "Coal India Pit Volumetrics Flight", customer: "Coal India Ltd", sector: "Mining", status: "Stuck", natureOfWork: "Volumetric Survey", startDate: "2026-07-10", endDate: "2026-08-05", deliveryDate: "2026-08-10", owner: "Suresh Menon", value: 4500000, billedValue: 1000000, collectedValue: 500000 },
    { id: "wo4", name: "Tata Solar Farm Inspection Run", customer: "Tata Power Renewable", sector: "Solar", status: "In Progress", natureOfWork: "Thermal Imaging", startDate: "2026-08-10", endDate: "2026-09-05", deliveryDate: "2026-09-08", owner: "Rajesh Kumar", value: 2800000, billedValue: 1400000, collectedValue: 1400000 },
    { id: "wo5", name: "NTPC Stockpile Measurement Flight", customer: "NTPC Ltd", sector: "Energy", status: "Completed", natureOfWork: "Volumetrics", startDate: "2026-06-01", endDate: "2026-07-20", deliveryDate: "2026-07-19", owner: "Amit Verma", value: 3100000, billedValue: 3100000, collectedValue: 3100000 },
  ];

  const issues: FieldIssue[] = [
    { recordId: "d1", recordName: "Coal India Topographical Mapping", board: "deals", field: "close_date", issue: "Missing close date" },
    { recordId: "wo3", recordName: "Coal India Pit Volumetrics Flight", board: "work_orders", field: "end_date", issue: "Execution past target end date" },
  ];

  return {
    syncedAt: new Date().toISOString(),
    currency: "INR",
    deals,
    workOrders,
    quality: buildQuality(deals, workOrders, issues),
    boards: {
      deals: { id: "5030968518", name: "Deals Pipeline", itemCount: deals.length, mappedColumns: [{ field: "sector", column: "Sector" }, { field: "deal_value", column: "Value" }], unmappedColumns: [] },
      workOrders: { id: "5030968512", name: "Work Orders Execution", itemCount: workOrders.length, mappedColumns: [{ field: "status", column: "Status" }, { field: "sector", column: "Sector" }], unmappedColumns: [] },
    },
    status: "partial",
    warnings: ["Using sample dataset for Skylark Drones BI representation."],
  };
}

