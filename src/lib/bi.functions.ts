import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildSnapshot, formatCurrency } from "./metrics";
import {
  ANALYSIS_SCHEMA,
  LEADERSHIP_SCHEMA,
  callAI,
  getBusinessData,
  systemPrompt,
  toUserError,
} from "./bi.server";

const filtersSchema = z.object({
  sector: z.string().nullable().default(null),
  customer: z.string().nullable().default(null),
  stage: z.string().nullable().default(null),
  woStatus: z.string().nullable().default(null),
  quarter: z.string().nullable().default(null),
});

function generateFallbackAnswer(userQuestion: string, snapshot: any): string {
  const q = userQuestion.toLowerCase();
  const curr = snapshot.currency || "INR";

  if (q.includes("sector") && (q.includes("pipeline") || q.includes("highest") || q.includes("value"))) {
    const sectors = snapshot.pipelineBySector || [];
    if (!sectors.length) return "No sector pipeline data available in the current Monday.com dataset.";
    const top = sectors[0];
    const rest = sectors.slice(1, 5);
    const totalVal = formatCurrency(snapshot.sales?.pipelineValue || 0, curr);
    const topVal = formatCurrency(top.value, curr);

    let text = `**${top.sector}** has the highest pipeline value at **${topVal}**, representing **${top.share.toFixed(1)}%** of total active pipeline (${totalVal}).\n\nNext sectors:\n`;
    rest.forEach((s: any) => {
      text += `- **${s.sector}**: ${formatCurrency(s.value, curr)} (${s.share.toFixed(1)}%)\n`;
    });
    text += `\n**Key takeaway:** Active deal pipeline is heavily concentrated in the **${top.sector}** sector.`;
    return text;
  }

  if (q.includes("risk") || q.includes("account") || q.includes("deal")) {
    const atRisk = snapshot.crossBoard?.riskAccounts || [];
    if (atRisk.length > 0) {
      let text = `**Top Customer Accounts at Risk** (Delayed work orders with active deals/revenue):\n\n`;
      atRisk.slice(0, 4).forEach((acc: any) => {
        text += `- **${acc.customer}**: ${acc.delayed} delayed work order(s) | Active Pipeline: ${formatCurrency(acc.pipeline, curr)}\n`;
      });
      text += `\n**Key takeaway:** Focus operational execution on these priority accounts to protect active revenue.`;
      return text;
    }
  }

  if (q.includes("work order") || q.includes("delay") || q.includes("bottleneck") || q.includes("status")) {
    const statuses = snapshot.workOrderStatus || [];
    const ops = snapshot.operations || {};
    let text = `**Work Order Execution & Delays Summary**:\n\n`;
    text += `- Total Work Orders: **${ops.total || 0}**\n`;
    text += `- Completed: **${ops.completed || 0}**\n`;
    text += `- Delayed / Overdue: **${ops.delayed || 0}**\n`;
    text += `- Stalled / Paused: **${ops.stalled || 0}**\n\n`;
    if (statuses.length > 0) {
      text += `**Status Breakdown:**\n`;
      statuses.slice(0, 5).forEach((s: any) => {
        text += `- **${s.status}**: ${s.count} orders (${s.share.toFixed(1)}%)\n`;
      });
    }
    text += `\n**Key takeaway:** ${ops.delayed > 0 ? `${ops.delayed} work orders require field execution acceleration.` : "Work order operations are progressing smoothly."}`;
    return text;
  }

  if (q.includes("customer") && (q.includes("revenue") || q.includes("highest") || q.includes("top"))) {
    const customers = snapshot.topCustomers || [];
    if (!customers.length) return "No customer data available in current snapshot.";
    const top = customers[0];
    let text = `**${top.customer}** is our highest value account with **${formatCurrency(top.wonRevenue + top.pipeline, curr)}** in combined business (Won Revenue: ${formatCurrency(top.wonRevenue, curr)} | Pipeline: ${formatCurrency(top.pipeline, curr)}).\n\nTop Accounts:\n`;
    customers.slice(1, 5).forEach((c: any) => {
      text += `- **${c.customer}**: Total Value ${formatCurrency(c.wonRevenue + c.pipeline, curr)} (${c.workOrders} work orders)\n`;
    });
    return text;
  }

  if (q.includes("pipeline") || q.includes("current value")) {
    const sales = snapshot.sales || {};
    return `Our current active pipeline value is **${formatCurrency(sales.pipelineValue, curr)}** across **${sales.activeDeals}** open deals.\n\n- Valued Deals: **${sales.pipelineValuedCount}**\n- Unpriced Deals: **${sales.pipelineMissingValue}**\n- Won Revenue: **${formatCurrency(sales.wonRevenue, curr)}** (${sales.wonCount} deals won)\n\n**Key takeaway:** ${sales.pipelineMissingValue > 0 ? `${sales.pipelineMissingValue} open deals currently miss pricing values in Monday.com.` : "All active deals have pricing attached."}`;
  }

  if (q.includes("how many") && q.includes("work order")) {
    const ops = snapshot.operations || {};
    return `We currently have **${ops.total || 0}** total work orders in Monday.com.\n\n- Completed: **${ops.completed || 0}**\n- In Progress: **${ops.inProgress || 0}**\n- Not Started: **${ops.notStarted || 0}**\n- Delayed / Overdue: **${ops.delayed || 0}**`;
  }

  // Executive summary fallback
  const sales = snapshot.sales || {};
  const ops = snapshot.operations || {};
  return `**Skylark Drones Executive Business Summary**:\n\n- **Active Pipeline**: ${formatCurrency(sales.pipelineValue, curr)} (${sales.activeDeals} open deals)\n- **Won Revenue**: ${formatCurrency(sales.wonRevenue, curr)} (${sales.wonCount} deals won)\n- **Work Orders**: ${ops.total} total (${ops.completed} completed, ${ops.delayed} delayed)\n- **Data Health Score**: ${snapshot.dataQuality?.score || 90}%\n\n**Key Action:** Prioritize closing late-stage deals and accelerating ${ops.delayed} delayed work orders.`;
}

export const fetchBusinessData = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ force: z.boolean().default(false) }).parse(data ?? {}))
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, data: await getBusinessData(data.force) };
    } catch (error) {
      return { ok: false as const, error: toUserError(error) };
    }
  });

export const generateAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ filters: filtersSchema }).parse(data))
  .handler(async ({ data }) => {
    try {
      const snapshot = buildSnapshot(await getBusinessData(), data.filters);
      const content = await callAI(
        [
          {
            role: "system",
            content: systemPrompt(
              snapshot,
              "Produce a full business analysis report: a 2-4 sentence executive summary, 4-7 categorised insights, opportunities, risks with severity, 3-5 prioritised recommendations, and honest data caveats.",
            ),
          },
          { role: "user", content: "Generate the business analysis report from the snapshot." },
        ],
        ANALYSIS_SCHEMA as unknown as object,
      );
      return { ok: true as const, report: JSON.parse(content), snapshotAt: snapshot.generatedAt };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : toUserError(error) };
    }
  });

export const generateLeadershipUpdate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ filters: filtersSchema }).parse(data))
  .handler(async ({ data }) => {
    try {
      const snapshot = buildSnapshot(await getBusinessData(), data.filters);
      const content = await callAI(
        [
          {
            role: "system",
            content: systemPrompt(
              snapshot,
              "Write an executive-ready leadership update: snapshot summary, 4-6 key numbers, what is going well, what needs attention, exactly 3 prioritised focus areas, and data caveats.",
            ),
          },
          { role: "user", content: "Generate the leadership update." },
        ],
        LEADERSHIP_SCHEMA as unknown as object,
      );
      return { ok: true as const, report: JSON.parse(content), generatedAt: snapshot.generatedAt };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : toUserError(error) };
    }
  });

export const askAgent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        filters: filtersSchema,
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
          .min(1)
          .max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const snapshot = buildSnapshot(await getBusinessData(), data.filters);
      try {
        const content = await callAI([
          {
            role: "system",
            content: systemPrompt(
              snapshot,
              `You are the Skylark Drones Founder/Executive BI Assistant.
Your goal is to answer founder questions directly, concisely, and accurately based ONLY on the provided live Monday.com JSON snapshot.

RESPONSE RULES:
- Give a direct, punchy answer first with exact numbers/amounts.
- Do NOT output raw markdown header symbols like "###" or raw asterisks "*". Use clean plain text sentences, bullet points (•), or standard bold text (**text**).
- DO NOT add mandatory template sections like "### Key Numbers", "### Insight", "### Risks", "### Recommendation", or "### Data Quality Caveat" unless directly relevant to the user's question.
- Tailor response structure by question type:
  * Simple factual / ranking question: Direct top result + numbers + ranked list of next 3-4 + 1 bold **Key takeaway**.
  * Comparison question: Ranked comparison + concise summary conclusion.
  * Risk question: List high-risk deals/accounts + supporting metrics + 1 short recommendation.
  * Operational question: Identify exact bottleneck/delay + affected sector/customer/work orders.
  * Founder/leadership question: Concise executive summary + top key action.
  * Data quality question: Explain specific missing/null/unpriced fields.
- Keep total length concise (under 200 words). Format amounts cleanly in ₹ Lakhs, ₹ Cr, or formatted INR.
- Never invent metrics, deals, or customers. If snapshot data is missing for a query, state "Insufficient data in Monday.com to determine this reliably."`,
            ),
          },
          ...data.messages,
        ]);
        return { ok: true as const, reply: content };
      } catch (aiErr) {
        if (aiErr instanceof Error && aiErr.message === "RATE_LIMIT_429") {
          const lastUserMsg = [...data.messages].reverse().find((m) => m.role === "user")?.content || "";
          const fallbackReply = generateFallbackAnswer(lastUserMsg, snapshot);
          return { ok: true as const, reply: fallbackReply };
        }
        throw aiErr;
      }
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : toUserError(error) };
    }
  });
