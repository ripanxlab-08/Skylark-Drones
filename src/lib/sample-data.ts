import type { BusinessData, Deal, WorkOrder, FieldIssue } from "./bi-types";

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
    quality: {
      score: 92,
      categories: [
        { key: "completeness", label: "Completeness", score: 95, detail: "0 missing customer / sector / stage fields" },
        { key: "dates", label: "Valid dates", score: 90, detail: "1 deal missing close date" },
        { key: "financials", label: "Valid financial values", score: 100, detail: "All financial values formatted" },
        { key: "naming", label: "Consistent naming", score: 95, detail: "Normalized sector and customer names" },
        { key: "status", label: "Valid status / stage", score: 90, detail: "1 work order execution past target end date" },
      ],
      issues,
      issueCounts: [
        { label: "Missing close date", count: 1 },
        { label: "Execution past target end date", count: 1 },
      ],
      notes: [
        "Sector, stage and status labels are normalized for whitespace and capitalization.",
        "Using pre-configured Skylark Drones dataset for real-time executive dashboard representation.",
      ],
    },
    boards: {
      deals: { id: "5030968518", name: "Deals Pipeline", itemCount: deals.length, mappedColumns: [{ field: "sector", column: "Sector" }, { field: "deal_value", column: "Value" }], unmappedColumns: [] },
      workOrders: { id: "5030968512", name: "Work Orders Execution", itemCount: workOrders.length, mappedColumns: [{ field: "status", column: "Status" }, { field: "sector", column: "Sector" }], unmappedColumns: [] },
    },
    status: "partial",
    warnings: ["Using sample dataset for Skylark Drones BI representation."],
  };
}
