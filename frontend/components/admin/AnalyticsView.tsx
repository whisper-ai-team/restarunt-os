"use client";

import React, { useMemo, useState } from "react";
import { 
  Phone, 
  Clock, 
  Timer, 
  TrendingUp, 
  TrendingDown,
  MessageSquare,
  Calendar,
  Loader2
} from "lucide-react";
import { useRestaurantMetrics, useCustomerUsage, useBenchmarkReport, useBenchmarkHistory } from "@/hooks";

interface AnalyticsViewProps {
  restaurantId: string;
}

export default function AnalyticsView({ restaurantId }: AnalyticsViewProps) {
  const { metrics, loading, error } = useRestaurantMetrics(restaurantId);
  const [usageFrom, setUsageFrom] = useState("");
  const [usageTo, setUsageTo] = useState("");
  const [usageLimit, setUsageLimit] = useState(10);
  const [benchmarkFrom, setBenchmarkFrom] = useState("");
  const [benchmarkTo, setBenchmarkTo] = useState("");
  const [benchmarkLimit, setBenchmarkLimit] = useState(10);
  const [benchmarkModelsInput, setBenchmarkModelsInput] = useState("gpt-4o,gpt-4o-mini");
  const [benchmarkSuite, setBenchmarkSuite] = useState("default");
  const [benchmarkTemperature, setBenchmarkTemperature] = useState("0");
  const [benchmarkMaxTokens, setBenchmarkMaxTokens] = useState("256");
  const [benchmarkStatus, setBenchmarkStatus] = useState<string | null>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkRefresh, setBenchmarkRefresh] = useState(0);

  const usageFilters = useMemo(() => ({
    from: usageFrom || undefined,
    to: usageTo || undefined,
    limit: usageLimit
  }), [usageFrom, usageTo, usageLimit]);

  const { usage, loading: usageLoading, error: usageError } = useCustomerUsage(restaurantId, usageFilters);
  const { report, loading: reportLoading, error: reportError } = useBenchmarkReport(benchmarkRefresh);
  const benchmarkHistoryFilters = useMemo(() => ({
    from: benchmarkFrom || undefined,
    to: benchmarkTo || undefined,
    limit: benchmarkLimit
  }), [benchmarkFrom, benchmarkTo, benchmarkLimit]);
  const { history, loading: historyLoading, error: historyError } = useBenchmarkHistory(benchmarkHistoryFilters, benchmarkRefresh);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">Failed to load analytics: {error || 'Unknown error'}</p>
      </div>
    );
  }

  // Static data for features not yet dynamic
  // Use dynamic top items or fallback to empty
  const topItems = metrics.topItems || [];
  const topCustomers = usage?.customers || [];
  const benchmarkModels = report?.models ? Object.values(report.models) : [];
  const historyReports = history?.reports || [];

  const formatPhone = (phone: string) => {
    if (!phone || phone === "Unknown") return "Unknown";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return phone;
    return `***-***-${digits.slice(-4)}`;
  };

  const runBenchmark = async () => {
    setBenchmarkRunning(true);
    setBenchmarkStatus(null);
    try {
      const response = await fetch("/api/benchmarks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: benchmarkModelsInput,
          suite: benchmarkSuite === "ordering" ? "ordering" : "default",
          temperature: benchmarkTemperature ? Number(benchmarkTemperature) : undefined,
          maxTokens: benchmarkMaxTokens ? Number(benchmarkMaxTokens) : undefined
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Benchmark run failed");
      }
      setBenchmarkStatus("Benchmark completed successfully.");
      setBenchmarkRefresh((prev) => prev + 1);
    } catch (err) {
      setBenchmarkStatus(err instanceof Error ? err.message : "Benchmark failed");
    } finally {
      setBenchmarkRunning(false);
    }
  };

  const faqData = [
    { category: "Hours & Location", percentage: 45, color: "bg-amber-500" },
    { category: "Dietary Info", percentage: 30, color: "bg-amber-400" },
    { category: "Reservations", percentage: 25, color: "bg-amber-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-lg border border-gray-200 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of call performance and AI effectiveness.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-gray-900 shadow-sm">Last 7 days</button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-gray-900">Last 30 days</button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-gray-900 flex items-center gap-1">
              Custom <Calendar size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Calls Taken</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{metrics.totalCalls.toLocaleString()}</span>
              </div>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Phone size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-400">Today: {metrics.todayCalls}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Minutes</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{metrics.totalMinutes.toLocaleString()}</span>
                <span className="text-sm text-gray-400 font-medium">min</span>
              </div>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Timer size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-400">Active: {metrics.activeCalls}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Success Rate</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{metrics.successRate}%</span>
              </div>
            </div>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className={`flex items-center font-bold px-1.5 py-0.5 rounded ${
              metrics.successRate >= 70 ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
            }`}>
              {metrics.successRate >= 70 ? '✓' : '!'} {metrics.successRate >= 70 ? 'Excellent' : 'Improving'}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Call Time</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {Math.floor((metrics.totalMinutes / metrics.totalCalls) || 0)}m {Math.round((((metrics.totalMinutes / metrics.totalCalls) || 0) % 1) * 60)}s
                </span>
              </div>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Clock size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-400">Per conversation</span>
          </div>
        </div>
      </div>


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Timings Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">Most Popular Call Timings</h2>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                <span className="text-xs text-gray-500">This Week</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                <span className="text-xs text-gray-500">Last Week</span>
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 h-64 px-2">
            {(metrics.hourlyData || []).map((data: { hour: string; calls: number }, idx: number) => {
              const maxCalls = Math.max(...(metrics.hourlyData || []).map((d: { calls: number }) => d.calls), 1);
              const heightPercent = (data.calls / maxCalls) * 100;
              return (
                <div key={idx} className="w-full flex flex-col justify-end gap-1 group cursor-pointer">
                  <div 
                    className={`w-full bg-indigo-600 rounded-t-sm group-hover:opacity-90 ${heightPercent > 80 ? 'shadow-lg shadow-indigo-500/30' : ''}`}
                    style={{ height: `${heightPercent}%` }}
                  >
                    {data.calls > 0 && (
                      <div className="text-[10px] text-white text-center pt-1 font-bold">{data.calls}</div>
                    )}
                  </div>
                  <span className={`text-[10px] text-center mt-2 ${ heightPercent > 80 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                    {data.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4">FAQ Breakdown</h2>
          <div className="flex-1 flex flex-col justify-center items-center">
            <div className="relative w-40 h-40 rounded-full mb-6" 
              style={{ 
                background: "conic-gradient(#f59e0b 0% 45%, #fbbf24 45% 75%, #fcd34d 75% 100%)" 
              }}>
              <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex items-center justify-center flex-col">
                <span className="text-2xl font-bold text-gray-900">42%</span>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Hours/Loc</span>
              </div>
            </div>
            <div className="w-full space-y-3">
              {faqData.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                    <span className="text-gray-600">{item.category}</span>
                  </div>
                  <span className="font-bold text-gray-900">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Usage */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Top Customers by AI Usage</h2>
            <p className="text-sm text-gray-500 mt-1">Token and minute usage by caller.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <label className="font-semibold">From</label>
              <input
                type="date"
                value={usageFrom}
                onChange={(e) => setUsageFrom(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <label className="font-semibold">To</label>
              <input
                type="date"
                value={usageTo}
                onChange={(e) => setUsageTo(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <label className="font-semibold">Limit</label>
              <select
                value={usageLimit}
                onChange={(e) => setUsageLimit(Number(e.target.value))}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700"
              >
                {[5, 10, 20, 50, 100].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-400">{usage?.totalCustomers ?? 0} customers</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {usageLoading ? (
            <div className="p-6 text-sm text-gray-500">Loading customer usage...</div>
          ) : usageError ? (
            <div className="p-6 text-sm text-red-600">Failed to load customer usage: {usageError}</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 font-semibold">Caller</th>
                  <th className="px-6 py-3 font-semibold text-right">Calls</th>
                  <th className="px-6 py-3 font-semibold text-right">Minutes</th>
                  <th className="px-6 py-3 font-semibold text-right">Tokens</th>
                  <th className="px-6 py-3 font-semibold text-right">Tokens/Min</th>
                  <th className="px-6 py-3 font-semibold text-right">Last Call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topCustomers.length > 0 ? (
                  topCustomers.slice(0, 10).map((customer) => (
                    <tr key={customer.customerPhone} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-600">{formatPhone(customer.customerPhone)}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{customer.totalCalls}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{customer.totalMinutes}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{customer.totalTokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{customer.tokensPerMinute}</td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {customer.lastCallAt ? new Date(customer.lastCallAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 italic">
                      No customer usage data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Benchmark Report */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Model Benchmark Report</h2>
            <p className="text-sm text-gray-500 mt-1">Latest accuracy/latency/cost comparison.</p>
          </div>
          <div className="text-xs text-gray-400">
            {report?.completedAt ? `Last run: ${new Date(report.completedAt).toLocaleString()}` : "No report yet"}
          </div>
        </div>
        <div className="overflow-x-auto">
          {reportLoading ? (
            <div className="p-6 text-sm text-gray-500">Loading benchmark report...</div>
          ) : reportError ? (
            <div className="p-6 text-sm text-gray-500">
              No benchmark report found. Run `node scripts/benchmark_models.js --models ... --out benchmarks/latest.json`.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 font-semibold">Model</th>
                  <th className="px-6 py-3 font-semibold text-right">Pass Rate</th>
                  <th className="px-6 py-3 font-semibold text-right">Avg Latency</th>
                  <th className="px-6 py-3 font-semibold text-right">Avg Tokens</th>
                  <th className="px-6 py-3 font-semibold text-right">Avg Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {benchmarkModels.length > 0 ? (
                  benchmarkModels.map((model) => (
                    <tr key={model.model} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-700">{model.model}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{model.passRate ?? "—"}%</td>
                      <td className="px-6 py-4 text-right text-gray-900">{model.avgLatencyMs ?? "—"} ms</td>
                      <td className="px-6 py-4 text-right text-gray-900">{model.avgTokens ?? "—"}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{model.avgCost ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">
                      No benchmark data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Benchmark Runner */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Run Benchmark</h2>
          <p className="text-sm text-gray-500 mt-1">Trigger a benchmark run from the dashboard.</p>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Models (comma-separated)</label>
              <input
                type="text"
                value={benchmarkModelsInput}
                onChange={(e) => setBenchmarkModelsInput(e.target.value)}
                className="mt-2 w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700"
                placeholder="gpt-4o,gpt-4o-mini"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Suite</label>
              <select
                value={benchmarkSuite}
                onChange={(e) => setBenchmarkSuite(e.target.value)}
                className="mt-2 w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700"
              >
                <option value="default">Default</option>
                <option value="ordering">Ordering Flow</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Temperature</label>
              <input
                type="number"
                step="0.1"
                value={benchmarkTemperature}
                onChange={(e) => setBenchmarkTemperature(e.target.value)}
                className="mt-2 w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Tokens</label>
              <input
                type="number"
                value={benchmarkMaxTokens}
                onChange={(e) => setBenchmarkMaxTokens(e.target.value)}
                className="mt-2 w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700"
              />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex items-center justify-between">
          <button
            onClick={runBenchmark}
            disabled={benchmarkRunning}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${benchmarkRunning ? "bg-gray-200 text-gray-500" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
          >
            {benchmarkRunning ? "Running..." : "Run Benchmark"}
          </button>
          {benchmarkStatus && (
            <span className="text-xs text-gray-500">{benchmarkStatus}</span>
          )}
        </div>
      </div>

      {/* Benchmark History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Benchmark History</h2>
            <p className="text-sm text-gray-500 mt-1">Previous benchmark runs for comparison.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <label className="font-semibold">From</label>
              <input
                type="date"
                value={benchmarkFrom}
                onChange={(e) => setBenchmarkFrom(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <label className="font-semibold">To</label>
              <input
                type="date"
                value={benchmarkTo}
                onChange={(e) => setBenchmarkTo(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <label className="font-semibold">Limit</label>
              <select
                value={benchmarkLimit}
                onChange={(e) => setBenchmarkLimit(Number(e.target.value))}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700"
              >
                {[5, 10, 20, 50].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {historyLoading ? (
            <div className="p-6 text-sm text-gray-500">Loading benchmark history...</div>
          ) : historyError ? (
            <div className="p-6 text-sm text-gray-500">Failed to load benchmark history.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 font-semibold">Suite</th>
                  <th className="px-6 py-3 font-semibold">Models</th>
                  <th className="px-6 py-3 font-semibold text-right">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyReports.length > 0 ? (
                  historyReports.map((entry) => (
                    <tr key={entry.file} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-700">{entry.suite || "default"}</td>
                      <td className="px-6 py-4 text-gray-500">{entry.models?.join(", ") || "—"}</td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {entry.completedAt ? new Date(entry.completedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500 italic">
                      No history available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SMS Stats */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total SMS Sent</h3>
              <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
                <MessageSquare size={24} />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-gray-900">8,492</span>
            </div>
            <div className="flex items-center text-sm mb-6">
              <span className="flex items-center text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">
                <TrendingUp size={14} className="mr-0.5" />
                24%
              </span>
              <span className="text-gray-400 ml-2">vs last period</span>
            </div>
          </div>
          <div className="h-24 w-full flex items-end gap-1 pt-4 border-t border-gray-100">
            {[30, 45, 40, 60, 50, 75, 85].map((height, idx) => (
              <div key={idx} className="bg-teal-500 w-full rounded-t-sm" style={{ height: `${height}%` }}></div>
            ))}
          </div>
        </div>

        {/* Top Ordered Items Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Top Ordered Items (via AI)</h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 font-semibold">Rank</th>
                  <th className="px-6 py-3 font-semibold">Menu Item</th>
                  <th className="px-6 py-3 font-semibold">Category</th>
                  <th className="px-6 py-3 font-semibold text-right">Orders</th>
                  <th className="px-6 py-3 font-semibold text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topItems.length > 0 ? (
                  topItems.map((item) => (
                    <tr key={item.rank} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-400">#{item.rank.toString().padStart(2, '0')}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-gray-500">{item.category}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">{item.orders}</td>
                      <td className="px-6 py-4 text-right">
                        {item.trend === "up" && <TrendingUp size={18} className="text-green-500 inline" />}
                        {item.trend === "down" && <TrendingDown size={18} className="text-red-500 inline" />}
                        {item.trend === "flat" && <div className="w-4 h-0.5 bg-gray-400 inline-block"></div>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">
                      No order data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
