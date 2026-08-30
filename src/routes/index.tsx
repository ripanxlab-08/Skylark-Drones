import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SkylarkLogo } from "../components/SkylarkLogo";
import {
  fetchBusinessData,
  generateAnalysis,
  generateLeadershipUpdate,
  askAgent,
} from "../lib/bi.functions";
import type { BusinessData, Filters } from "../lib/bi-types";
import { emptyFilters } from "../lib/bi-types";
import {
  applyFilters,
  salesMetrics,
  opsMetrics,
  pipelineBySector,
  stageDistribution,
  woStatusDistribution,
  pipelineHealth,
  customerIntelligence,
  crossBoard,
  formatCurrency,
} from "../lib/metrics";
import {
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Filter,
  Database,
  ShieldAlert,
  Layers,
  Send,
  Bot,
  User,
  FileText,
  BarChart3,
  Users,
  ChevronRight,
  Info,
  X,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function renderInlineFormatting(str: string) {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (trimmed.startsWith("#")) {
          const cleanHeader = trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "");
          return (
            <div key={i} className="font-bold text-indigo-300 text-xs mt-2.5 mb-1 tracking-wide uppercase">
              {cleanHeader}
            </div>
          );
        }

        if (/^[*•-]\s/.test(trimmed)) {
          const cleanBullet = trimmed.replace(/^[*•-]\s*/, "");
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-indigo-400 font-bold">•</span>
              <div>{renderInlineFormatting(cleanBullet)}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (numMatch && numMatch[1] && numMatch[2]) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-indigo-400 font-semibold">{numMatch[1]}.</span>
              <div>{renderInlineFormatting(numMatch[2])}</div>
            </div>
          );
        }

        return <div key={i}>{renderInlineFormatting(trimmed)}</div>;
      })}
    </div>
  );
}

type Message = { role: "user" | "assistant"; content: string };

function DashboardPage() {
  const [data, setData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  // Tab & AI State
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "ops" | "accounts" | "quality">("overview");
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"analysis" | "leadership" | "chat">("analysis");

  // AI Content State
  const [analysisReport, setAnalysisReport] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [leadershipReport, setLeadershipReport] = useState<any>(null);
  const [leadershipLoading, setLeadershipLoading] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your Skylark Drones AI Business Analyst. Ask me any founder-level question about your revenue, sales pipeline, operations, or accounts.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  async function loadData(force = false) {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchBusinessData({ data: { force } });
      if (res.ok) {
        setData(res.data);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect to data service.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleGenerateAnalysis() {
    setAnalysisLoading(true);
    setAiMode("analysis");
    setAiDrawerOpen(true);
    try {
      const res = await generateAnalysis({ data: { filters } });
      if (res.ok) {
        setAnalysisReport(res.report);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate analysis.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleGenerateLeadership() {
    setLeadershipLoading(true);
    setAiMode("leadership");
    setAiDrawerOpen(true);
    try {
      const res = await generateLeadershipUpdate({ data: { filters } });
      if (res.ok) {
        setLeadershipReport(res.report);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate leadership update.");
    } finally {
      setLeadershipLoading(false);
    }
  }

  async function handleSendChat(customPrompt?: string) {
    const promptToSend = customPrompt || chatInput.trim();
    if (!promptToSend || chatLoading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: promptToSend }];
    setMessages(newMessages);
    if (!customPrompt) setChatInput("");
    setChatLoading(true);
    setAiMode("chat");
    setAiDrawerOpen(true);

    try {
      const res = await askAgent({ data: { filters, messages: newMessages } });
      if (res.ok) {
        setMessages([...newMessages, { role: "assistant", content: res.reply }]);
      } else {
        setMessages([
          ...newMessages,
          { role: "assistant", content: `⚠️ **AI Error**: ${res.error}` },
        ]);
      }
    } catch (e) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `⚠️ **Connection Error**: ${e instanceof Error ? e.message : "Failed to query AI agent."}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-4 flex flex-col items-center">
          <SkylarkLogo size={56} showText={false} />
          <h2 className="text-xl font-bold tracking-wide text-white">Loading Skylark Drones BI Engine...</h2>
          <p className="text-xs text-slate-400">Synchronizing Monday.com board data & metrics</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-6 text-center shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Sync Error</h2>
          <p className="text-sm text-slate-300">{error}</p>
          <button
            onClick={() => loadData(true)}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition shadow-lg shadow-indigo-600/20"
          >
            Retry Data Sync
          </button>
        </div>
      </div>
    );
  }

  const rawData = data!;
  const filtered = applyFilters(rawData, filters);
  const sales = salesMetrics(filtered.deals);
  const ops = opsMetrics(filtered.workOrders);
  const sectorData = pipelineBySector(filtered.deals);
  const stageData = stageDistribution(filtered.deals);
  const woStatusData = woStatusDistribution(filtered.workOrders);
  const healthData = pipelineHealth(filtered.deals);
  const customers = customerIntelligence(filtered.deals, filtered.workOrders);
  const cross = crossBoard(filtered.deals, filtered.workOrders);

  // Filter options
  const sectors = Array.from(
    new Set([
      ...rawData.deals.map((d) => d.sector).filter(Boolean),
      ...rawData.workOrders.map((w) => w.sector).filter(Boolean),
    ]),
  ) as string[];

  const customerList = Array.from(
    new Set([
      ...rawData.deals.map((d) => d.customer).filter(Boolean),
      ...rawData.workOrders.map((w) => w.customer).filter(Boolean),
    ]),
  ) as string[];

  const stages = Array.from(new Set(rawData.deals.map((d) => d.stage).filter(Boolean))) as string[];
  const woStatuses = Array.from(new Set(rawData.workOrders.map((w) => w.status).filter(Boolean))) as string[];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <SkylarkLogo size={40} showText={true} />
            <span className="text-xs text-slate-500 hidden lg:inline-block">
              • Synced at {new Date(rawData.syncedAt).toLocaleTimeString()} ({rawData.currency})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${rawData.status === "connected" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
              />
              <span className="text-slate-300 font-medium capitalize">{rawData.status} Sync</span>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
              Sync Data
            </button>

            <button
              onClick={handleGenerateAnalysis}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Assistant
            </button>
          </div>
        </div>
      </header>

      {/* Warnings Banner */}
      {rawData.warnings && rawData.warnings.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-xs text-amber-300 flex items-center justify-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{rawData.warnings.join(" | ")}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Global Filters Section */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span>Global Business Filters</span>
            </div>
            {Object.values(filters).some((v) => v !== null) && (
              <button
                onClick={() => setFilters(emptyFilters)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
              >
                Reset All Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Sector Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Sector</label>
              <select
                value={filters.sector || ""}
                onChange={(e) => setFilters({ ...filters, sector: e.target.value || null })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Sectors</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Customer</label>
              <select
                value={filters.customer || ""}
                onChange={(e) => setFilters({ ...filters, customer: e.target.value || null })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Customers</option>
                {customerList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Deal Stage</label>
              <select
                value={filters.stage || ""}
                onChange={(e) => setFilters({ ...filters, stage: e.target.value || null })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Stages</option>
                {stages.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* WO Status Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Work Order Status</label>
              <select
                value={filters.woStatus || ""}
                onChange={(e) => setFilters({ ...filters, woStatus: e.target.value || null })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Statuses</option>
                {woStatuses.map((ws) => (
                  <option key={ws} value={ws}>
                    {ws}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Quarter</label>
              <select
                value={filters.quarter || ""}
                onChange={(e) => setFilters({ ...filters, quarter: e.target.value || null })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="">All Quarters</option>
                <option value="2026-Q1">2026-Q1</option>
                <option value="2026-Q2">2026-Q2</option>
                <option value="2026-Q3">2026-Q3</option>
                <option value="2026-Q4">2026-Q4</option>
              </select>
            </div>
          </div>
        </section>

        {/* Executive Key Metric Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: Pipeline Value */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Pipeline Value</span>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(sales.pipelineValue, rawData.currency)}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>{sales.pipelineValuedCount} deals</span>
              {sales.pipelineMissingValue > 0 && (
                <span className="text-amber-400">({sales.pipelineMissingValue} unpriced)</span>
              )}
            </div>
          </div>

          {/* Card 2: Closed Won Revenue */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Won Revenue</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(sales.wonRevenue, rawData.currency)}
            </div>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span>{sales.wonCount} deals won</span>
              {sales.winRate != null && <span>({sales.winRate.toFixed(0)}% win rate)</span>}
            </div>
          </div>

          {/* Card 3: Active Deals */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Active Deals</span>
              <BarChart3 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{sales.activeDeals}</div>
            <div className="text-[11px] text-slate-400">
              {healthData.lateStageCount} in negotiation / late stage
            </div>
          </div>

          {/* Card 4: Ops Work Orders */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Work Orders</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{ops.total}</div>
            <div className="text-[11px] text-slate-400">
              {ops.completed} completed • {ops.inProgress} active
            </div>
          </div>

          {/* Card 5: Operational Delays */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Ops Delays</span>
              <AlertTriangle className={`w-4 h-4 ${ops.delayed > 0 ? "text-amber-400" : "text-slate-500"}`} />
            </div>
            <div className={`text-xl font-bold tracking-tight ${ops.delayed > 0 ? "text-amber-400" : "text-white"}`}>
              {ops.delayed}
            </div>
            <div className="text-[11px] text-slate-400">
              {ops.stalled > 0 ? `${ops.stalled} stalled work orders` : "No stalled orders"}
            </div>
          </div>

          {/* Card 6: Data Health Score */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Data Health</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight flex items-baseline gap-1">
              <span>{rawData.quality.score}%</span>
              <span className="text-xs font-normal text-slate-400">score</span>
            </div>
            <div className="text-[11px] text-purple-400 font-medium">
              {rawData.quality.issues.length} total field issues
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="border-b border-slate-800">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === "overview"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Executive Dashboard
            </button>

            <button
              onClick={() => setActiveTab("sales")}
              className={`pb-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === "sales"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Sales & Pipeline
            </button>

            <button
              onClick={() => setActiveTab("ops")}
              className={`pb-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === "ops"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock className="w-4 h-4" />
              Operations & Delivery
            </button>

            <button
              onClick={() => setActiveTab("accounts")}
              className={`pb-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === "accounts"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Customer Accounts
            </button>

            <button
              onClick={() => setActiveTab("quality")}
              className={`pb-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === "quality"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Data Health ({rawData.quality.score}%)
            </button>
          </nav>
        </section>

        {/* Tab 1: Executive Dashboard Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sector Pipeline Breakdown Card */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center justify-between">
                  <span>Pipeline Value by Sector</span>
                  <span className="text-xs text-slate-400 font-normal">Active Deals</span>
                </h3>

                <div className="space-y-3">
                  {sectorData.map((s) => (
                    <div key={s.sector} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-200">{s.sector}</span>
                        <span className="text-slate-400">
                          {formatCurrency(s.value, rawData.currency)} ({s.share.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(5, s.share))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deal Stage Funnel Card */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center justify-between">
                  <span>Deal Stage Distribution</span>
                  <span className="text-xs text-slate-400 font-normal">Funnel Breakdown</span>
                </h3>

                <div className="space-y-3">
                  {stageData.map((st) => (
                    <div key={st.stage} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-200">{st.stage}</span>
                        <span className="text-slate-400">
                          {st.deals} deals • {formatCurrency(st.value, rawData.currency)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(5, st.share))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions AI Prompt Bar */}
            <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-cyan-950/60 border border-indigo-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Leadership Intelligence Agent</span>
                </div>
                <p className="text-xs text-slate-300">
                  Generate instant executive updates or ask founder questions based on live Monday.com metrics.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleGenerateAnalysis}
                  disabled={analysisLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-indigo-600/20"
                >
                  {analysisLoading ? "Analyzing..." : "Generate Analysis Report"}
                </button>
                <button
                  onClick={handleGenerateLeadership}
                  disabled={leadershipLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  {leadershipLoading ? "Generating..." : "Generate Leadership Update"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Sales & Pipeline */}
        {activeTab === "sales" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-white">High Value Deals & Pipeline Risk</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-medium uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Deal Name</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Sector</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">Expected Close</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {healthData.highValue.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-medium text-slate-100">{d.name}</td>
                        <td className="px-4 py-3 text-slate-300">{d.customer || "Unspecified"}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                            {d.sector || "Unspecified"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-indigo-300">
                          {formatCurrency(d.value || 0, rawData.currency)}
                        </td>
                        <td className="px-4 py-3">{d.stage || "Unspecified"}</td>
                        <td className="px-4 py-3 text-slate-400">{d.expectedCloseDate || "Missing Date"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Operations & Delivery */}
        {activeTab === "ops" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-1">
                <div className="text-xs text-slate-400 font-medium">Work Order Completion Rate</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {ops.completionRate != null ? `${ops.completionRate.toFixed(1)}%` : "N/A"}
                </div>
                <div className="text-xs text-slate-400">{ops.completed} of {ops.total} work orders completed</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-1">
                <div className="text-xs text-slate-400 font-medium">On-Time Delivery Rate</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {ops.onTimeRate != null ? `${ops.onTimeRate.toFixed(1)}%` : "N/A"}
                </div>
                <div className="text-xs text-slate-400">Based on {ops.onTimeSample} orders with delivery dates</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-1">
                <div className="text-xs text-slate-400 font-medium">Contracted Financial Value</div>
                <div className="text-2xl font-bold text-indigo-400">
                  {formatCurrency(ops.contractedValue, rawData.currency)}
                </div>
                <div className="text-xs text-slate-400">
                  Billed: {formatCurrency(ops.billedValue, rawData.currency)} • Collected: {formatCurrency(ops.collectedValue, rawData.currency)}
                </div>
              </div>
            </div>

            {/* Delayed Items Alert Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Delayed & Stalled Work Orders</span>
              </h3>

              {ops.delayedItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No delayed work orders detected! All operations are on schedule.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 font-medium uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Work Order</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Sector</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">End Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {ops.delayedItems.map((w, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-slate-100">{w.name}</td>
                          <td className="px-4 py-3">{w.customer || "Unspecified"}</td>
                          <td className="px-4 py-3">{w.sector || "Unspecified"}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                              {w.status || "Delayed"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-amber-400 font-medium">{w.endDate || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Customer Accounts */}
        {activeTab === "accounts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Account Expansion Opportunities */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white">Expansion Accounts (Active Ops + Pipeline)</h3>
                <div className="space-y-3">
                  {cross.expansion.map((c) => (
                    <div
                      key={c.customer}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-100">{c.customer}</div>
                        <div className="text-xs text-slate-400">
                          {c.workOrders} active work orders • {c.deals} pipeline deals
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-indigo-400">
                          {formatCurrency(c.pipeline, rawData.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">Pipeline</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-Risk Customer Accounts */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white">At-Risk Accounts (Delayed Ops + Revenue)</h3>
                <div className="space-y-3">
                  {cross.riskAccounts.length === 0 ? (
                    <div className="text-xs text-slate-400 py-6 text-center">No accounts currently at risk.</div>
                  ) : (
                    cross.riskAccounts.map((c) => (
                      <div
                        key={c.customer}
                        className="p-3 rounded-xl bg-slate-950 border border-amber-500/20 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-sm text-slate-100">{c.customer}</div>
                          <div className="text-xs text-amber-400">
                            {c.delayed} delayed work orders
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-slate-300">
                            {formatCurrency(c.pipeline + c.wonRevenue, rawData.currency)}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Account Value</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Data Quality Scorecard */}
        {activeTab === "quality" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Data Quality Scorecard</h3>
                  <p className="text-xs text-slate-400">
                    Automated completeness and schema integrity verification across Monday.com boards.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-indigo-400">{rawData.quality.score}%</div>
                  <div className="text-xs text-slate-400 font-medium">Health Score</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                {rawData.quality.categories.map((cat) => (
                  <div key={cat.key} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-200">{cat.label}</span>
                      <span className="text-indigo-400 font-bold">{cat.score}%</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{cat.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Field Issues Log */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-white">Field Issues Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-medium uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Board</th>
                      <th className="px-4 py-3">Record Name</th>
                      <th className="px-4 py-3">Field</th>
                      <th className="px-4 py-3">Issue Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rawData.quality.issues.slice(0, 20).map((iss, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 uppercase text-[10px] font-bold tracking-wider text-slate-400">
                          {iss.board}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-100">{iss.recordName}</td>
                        <td className="px-4 py-3 text-indigo-400">{iss.field}</td>
                        <td className="px-4 py-3 text-amber-300">{iss.issue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating AI Assistant Trigger Button */}
      <button
        onClick={() => setAiDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition flex items-center gap-2 font-semibold text-sm"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
        <span>Ask AI Assistant</span>
      </button>

      {/* AI Assistant Side Drawer */}
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Skylark AI Assistant</h2>
                  <p className="text-xs text-slate-400">Founder & Executive Intelligence Agent</p>
                </div>
              </div>

              <button
                onClick={() => setAiDrawerOpen(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Mode Selector Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-4">
              <button
                onClick={() => setAiMode("analysis")}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  aiMode === "analysis"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Executive Analysis
              </button>
              <button
                onClick={() => setAiMode("leadership")}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  aiMode === "leadership"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Leadership Update
              </button>
              <button
                onClick={() => setAiMode("chat")}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  aiMode === "chat"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Founder Q&A Chat
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Executive Analysis View */}
              {aiMode === "analysis" && (
                <div className="space-y-6 text-xs">
                  {!analysisReport && !analysisLoading && (
                    <div className="text-center py-12 space-y-4">
                      <FileText className="w-12 h-12 text-slate-600 mx-auto" />
                      <p className="text-slate-400">
                        Generate a complete executive analysis report based on active Monday.com metrics.
                      </p>
                      <button
                        onClick={handleGenerateAnalysis}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition"
                      >
                        Generate Report Now
                      </button>
                    </div>
                  )}

                  {analysisLoading && (
                    <div className="text-center py-12 space-y-3">
                      <div className="w-8 h-8 rounded-full border-3 border-indigo-500/30 border-t-indigo-500 animate-spin mx-auto" />
                      <p className="text-slate-400 font-medium">Synthesizing executive report with Gemini AI...</p>
                    </div>
                  )}

                  {analysisReport && (
                    <div className="space-y-6">
                      <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/20 space-y-2">
                        <div className="font-semibold text-indigo-400 uppercase text-[10px] tracking-wider">
                          Executive Summary
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed">{analysisReport.executiveSummary}</p>
                      </div>

                      {/* Insights */}
                      {analysisReport.insights && (
                        <div className="space-y-3">
                          <div className="font-semibold text-slate-300 uppercase text-[10px] tracking-wider">
                            Categorized Insights
                          </div>
                          <div className="grid gap-3">
                            {analysisReport.insights.map((item: any, i: number) => (
                              <div key={i} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                                <div className="flex justify-between font-semibold text-indigo-300">
                                  <span>{item.finding}</span>
                                  <span className="text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded text-indigo-400">
                                    {item.category}
                                  </span>
                                </div>
                                <div className="text-slate-400 text-[11px]">{item.whyItMatters}</div>
                                <div className="text-slate-500 text-[10px] font-mono">Metric: {item.metric}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {analysisReport.recommendations && (
                        <div className="space-y-3">
                          <div className="font-semibold text-slate-300 uppercase text-[10px] tracking-wider">
                            Prioritized Recommendations
                          </div>
                          <div className="space-y-2">
                            {analysisReport.recommendations.map((rec: any, i: number) => (
                              <div key={i} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                                <div className="font-semibold text-emerald-400">
                                  #{rec.priority} - {rec.action}
                                </div>
                                <div className="text-slate-300">{rec.reason}</div>
                                <div className="text-slate-500 text-[10px]">Data: {rec.supportingData}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Leadership Update View */}
              {aiMode === "leadership" && (
                <div className="space-y-6 text-xs">
                  {!leadershipReport && !leadershipLoading && (
                    <div className="text-center py-12 space-y-4">
                      <Sparkles className="w-12 h-12 text-slate-600 mx-auto" />
                      <p className="text-slate-400">
                        Generate an executive-ready leadership update formatted for founders & board members.
                      </p>
                      <button
                        onClick={handleGenerateLeadership}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition"
                      >
                        Generate Leadership Update
                      </button>
                    </div>
                  )}

                  {leadershipLoading && (
                    <div className="text-center py-12 space-y-3">
                      <div className="w-8 h-8 rounded-full border-3 border-indigo-500/30 border-t-indigo-500 animate-spin mx-auto" />
                      <p className="text-slate-400 font-medium">Generating leadership update...</p>
                    </div>
                  )}

                  {leadershipReport && (
                    <div className="space-y-6">
                      <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/20 space-y-2">
                        <div className="font-semibold text-indigo-400 uppercase text-[10px] tracking-wider">
                          Summary
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed">{leadershipReport.executiveSummary}</p>
                      </div>

                      {/* Key Numbers Grid */}
                      {leadershipReport.keyNumbers && (
                        <div className="grid grid-cols-2 gap-3">
                          {leadershipReport.keyNumbers.map((num: any, i: number) => (
                            <div key={i} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400 uppercase">{num.label}</div>
                              <div className="text-lg font-bold text-indigo-300">{num.value}</div>
                              <div className="text-[10px] text-slate-500">{num.note}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Founder Q&A Chat View */}
              {aiMode === "chat" && (
                <div className="flex flex-col h-full space-y-4">
                  {/* Quick Prompts */}
                  <div className="flex flex-wrap gap-2 pb-2">
                    <button
                      onClick={() => handleSendChat("Which sectors have the highest pipeline value?")}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                    >
                      💡 Sector Pipeline Breakdown
                    </button>
                    <button
                      onClick={() => handleSendChat("What customer accounts are at risk right now?")}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                    >
                      ⚠️ Accounts at Risk
                    </button>
                    <button
                      onClick={() => handleSendChat("Summarize our operational delays and bottlenecks.")}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                    >
                      ⏱️ Operations Bottlenecks
                    </button>
                    <button
                      onClick={() => handleSendChat("What is our current pipeline value?")}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                    >
                      📊 Current Pipeline
                    </button>
                    <button
                      onClick={() => handleSendChat("How many active work orders do we have?")}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                    >
                      📋 Work Orders Status
                    </button>
                  </div>

                  {/* Messages List */}
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {messages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-3 text-xs ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {m.role === "assistant" && (
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] p-3 rounded-2xl text-slate-200 leading-relaxed ${
                            m.role === "user"
                              ? "bg-indigo-600 text-white rounded-br-none"
                              : "bg-slate-950 border border-slate-800 rounded-bl-none"
                          }`}
                        >
                          <FormattedMessage text={m.content} />
                        </div>
                        {m.role === "user" && (
                          <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 border border-slate-700">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-3 text-xs items-center text-slate-400">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 animate-pulse">
                          <Bot className="w-4 h-4" />
                        </div>
                        <span>Thinking...</span>
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChat();
                    }}
                    className="flex gap-2 pt-2 border-t border-slate-800"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a founder question..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition shadow-md shadow-indigo-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
