"use client";

import React from "react";
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
import { useRestaurantMetrics } from "@/hooks";

interface AnalyticsViewProps {
  restaurantId: string;
}

export default function AnalyticsView({ restaurantId }: AnalyticsViewProps) {
  const { metrics, loading, error } = useRestaurantMetrics(restaurantId);

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
