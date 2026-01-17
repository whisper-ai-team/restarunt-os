"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Phone, 
  Clock, 
  Search,
  Filter,
  ChevronDown,
  CheckCircle,
  Loader2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useCalls } from "@/hooks";

interface CallHistoryViewProps {
  restaurantId: string;
}

export default function CallHistoryView({ restaurantId }: CallHistoryViewProps) {
  const { calls, loading, error } = useCalls(restaurantId);
  const [searchTerm, setSearchTerm] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">Failed to load call history: {error}</p>
      </div>
    );
  }

  const filteredCalls = calls.filter(call => 
    call.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    call.customerPhone?.includes(searchTerm) ||
    call.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Call History</h1>
            <p className="text-sm text-gray-500 mt-1">Review past calls and customer interactions.</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by call ID, customer name, phone..."
              className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="inline-flex items-center justify-between sm:justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <span>All Calls</span>
            </div>
            <ChevronDown size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Calls List */}
      <div className="space-y-3">
        {filteredCalls.length === 0 ? (
           <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
             No calls found.
           </div>
        ) : (
          filteredCalls.map((call) => (
            <Link 
              key={call.id} 
              href={`/admin/calls/${call.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    call.status === 'completed' ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'
                  }`}>
                    <Phone size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{call.customerName || "Unknown Caller"}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">
                        {call.id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{call.customerPhone}</span>
                      <span>•</span>
                      <span>{new Date(call.createdAt).toLocaleString()}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {Math.floor(call.duration / 60)}m {call.duration % 60}s
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                    call.order 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : call.status === 'completed' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {call.order ? <CheckCircle size={14} /> : call.status === 'completed' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {call.order ? `Order: $${call.order.total}` : call.status === 'completed' ? 'Completed' : 'Missed'}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
