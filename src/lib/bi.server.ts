// Server-only helpers: data cache + Gemini AI service calls.
import type { BusinessData } from "./bi-types";
import { loadBusinessData, getSampleSkylarkData, MondayError } from "./monday.server";

let cache: { data: BusinessData; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getBusinessData(force = false): Promise<BusinessData> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const token = process.env["MONDAY_API_TOKEN"];
  const dealsBoardId = process.env["MONDAY_DEALS_BOARD_ID"];
  const workOrdersBoardId = process.env["MONDAY_WORK_ORDERS_BOARD_ID"];
  if (!token || !dealsBoardId || !workOrdersBoardId) {
    const sample = getSampleSkylarkData();
    cache = { data: sample, at: Date.now() };
    return sample;
  }
  try {
    const data = await loadBusinessData({ token, dealsBoardId, workOrdersBoardId });
    cache = { data, at: Date.now() };
    return data;
  } catch (err) {
    console.warn("Monday.com live fetch failed, falling back to sample data:", err);
    const sample = getSampleSkylarkData();
    sample.warnings = [`Monday API Warning: ${err instanceof Error ? err.message : String(err)}. Displaying sample data.`];
    cache = { data: sample, at: Date.now() };
    return sample;
  }
}

export function toUserError(error: unknown): string {
  if (error instanceof MondayError) return error.userMessage;
  return "Something went wrong while processing Monday.com data. Please try again.";
}

const GUARDRAILS = `You are the Skylark Drones Business Intelligence analyst.
Rules you must never break:
- The JSON snapshot supplied by the system is the ONLY source of numbers. Never invent or estimate figures, customers, deals or dates.
- Never claim a trend, growth or decline: the snapshot contains no historical comparison.
- If the snapshot lacks what is needed, write exactly: "Insufficient data to determine this reliably."
- Amounts are in the snapshot currency (INR) and are masked values from Monday.com. Quote them as given.
- Write for a founder/CEO: short, specific, decision-oriented. Cite the supporting metric with every claim.`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callAI(messages: { role: string; content: string }[], jsonSchema?: object) {
  const key = process.env["GEMINI_API_KEY"] || process.env["AI_GATEWAY_KEY"];
  if (!key) throw new Error("AI is not configured. Please add GEMINI_API_KEY to your .env file.");

  const endpoint =
    process.env["AI_GATEWAY_URL"] ||
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

  const modelsToTry = [
    process.env["AI_MODEL"] || "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
  ].filter((m, i, a) => a.indexOf(m) === i);

  let lastStatus = 0;
  let lastErrorText = "";

  for (let i = 0; i < modelsToTry.length; i++) {
    const selectedModel = modelsToTry[i];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          ...(jsonSchema
            ? { response_format: { type: "json_schema", json_schema: { name: "analysis", strict: true, schema: jsonSchema } } }
            : {}),
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content;
        if (content) return content;
      }

      lastStatus = res.status;
      lastErrorText = await res.text().catch(() => "");

      if (res.status === 429 && i < modelsToTry.length - 1) {
        console.warn(`Model ${selectedModel} hit rate limit (429). Retrying with ${modelsToTry[i + 1]}...`);
        await sleep(800);
      }
    } catch (err) {
      console.warn(`Model ${selectedModel} request failed:`, err);
    }
  }

  if (lastStatus === 429) {
    throw new Error("RATE_LIMIT_429");
  }
  if (lastStatus === 402) throw new Error("AI credits are exhausted. Please check your API quota.");
  throw new Error(`The AI service returned an error (${lastStatus || 500}): ${lastErrorText || "Request failed"}`);
}

export function systemPrompt(snapshot: unknown, extra = "") {
  return `${GUARDRAILS}\n${extra}\n\nDATA SNAPSHOT (deterministically computed from live Monday.com data):\n${JSON.stringify(snapshot)}`;
}

export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["executiveSummary", "insights", "opportunities", "risks", "recommendations", "dataCaveats"],
  properties: {
    executiveSummary: { type: "string" },
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "finding", "metric", "whyItMatters"],
        properties: {
          category: { type: "string", enum: ["Sales", "Operations", "Sector", "Customer", "Cross-functional"] },
          finding: { type: "string" },
          metric: { type: "string" },
          whyItMatters: { type: "string" },
        },
      },
    },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "metric"],
        properties: { title: { type: "string" }, detail: { type: "string" }, metric: { type: "string" } },
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "severity", "detail", "metric"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["High", "Medium", "Low"] },
          detail: { type: "string" },
          metric: { type: "string" },
        },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "reason", "supportingData", "priority"],
        properties: {
          action: { type: "string" },
          reason: { type: "string" },
          supportingData: { type: "string" },
          priority: { type: "string", enum: ["1", "2", "3", "4", "5"] },
        },
      },
    },
    dataCaveats: { type: "array", items: { type: "string" } },
  },
} as const;

export const LEADERSHIP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["executiveSummary", "keyNumbers", "goingWell", "needsAttention", "focusAreas", "dataCaveats"],
  properties: {
    executiveSummary: { type: "string" },
    keyNumbers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "note"],
        properties: { label: { type: "string" }, value: { type: "string" }, note: { type: "string" } },
      },
    },
    goingWell: { type: "array", items: { type: "string" } },
    needsAttention: { type: "array", items: { type: "string" } },
    focusAreas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "why"],
        properties: { action: { type: "string" }, why: { type: "string" } },
      },
    },
    dataCaveats: { type: "array", items: { type: "string" } },
  },
} as const;
