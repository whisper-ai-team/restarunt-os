"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Phone, FileText, ShoppingBag, Loader2, Headset, Bell, Search, Moon, User as UserIcon, ChevronRight } from "lucide-react";
import CallPathExplorer from "../../../../components/admin/CallPathExplorer";
import DashboardLayout from "../../../../components/admin/DashboardLayout";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  totalAmount: number;
  items: OrderItem[];
  cloverOrderId?: string;
  paymentUrl?: string;
}

interface Call {
  id: string;
  customerPhone: string;
  status: string;
  duration: number;
  createdAt: string;
  restaurantId: string;
  isTakeoverActive?: boolean;
  order?: Order;
  restaurant: { name: string; id: string };
  transcript?: any[];
}

export default function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
        try {
            const res = await fetch(`/api/calls/${id}`);
            if (res.ok) setCall(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    init();
  }, [id]);

  const handleTakeover = async () => {
    if (!call || !confirm("Take over this call? AI will stop responding immediately.")) return;
    try {
        const res = await fetch(`/api/calls/${call.id}/takeover`, { method: "POST" });
        if (res.ok) setCall({ ...call, isTakeoverActive: true });
    } catch (err) {
        console.error("Takeover failed:", err);
    }
  };

  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4 bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-gray-500 font-medium font-mono text-sm tracking-widest uppercase">Processing Call Path...</p>
    </div>
  );

  if (!call) return (
    <div className="flex flex-col h-screen items-center justify-center p-8 text-center bg-gray-50">
        <div className="w-16 h-16 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
            <FileText className="text-gray-400" size={32} />
        </div>
        <h3 className="text-gray-900 font-bold text-xl">Call Record Not Found</h3>
        <p className="text-gray-500 mt-2 max-w-xs">The record might have been deleted or the ID is incorrect.</p>
        <Link href="/admin" className="mt-8 bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
            Return to Dashboard
        </Link>
    </div>
  );

  return (
    // @ts-ignore - Dashboard layout uses dynamic imports which ts might complain about in this context
    <DashboardLayout restaurantId={call.restaurantId} restaurantName={call.restaurant.name}>
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header / Breadcrumbs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-5">
                        <Link href={`/admin/${call.restaurantId}`} className="w-8 h-8 rounded-full border border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-sm transition-all group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                        </Link>
                        <div className="flex items-center gap-2">
                           <h3 className="text-label inline-flex items-center gap-2">
                              <span className="hover:text-gray-600 cursor-pointer">{call.restaurant.name}</span>
                              <ChevronRight size={10} className="text-gray-300" />
                              <span className="text-gray-300">Call Details</span>
                           </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">Call Analysis</h1>
                        <div className="flex items-center gap-3 px-3 py-1 bg-white border border-gray-100 rounded-xl shadow-sm">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">ID: {call.id.slice(0, 8).toUpperCase()}</span>
                            <div className="w-px h-3 bg-gray-100" />
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                call.status === 'ongoing' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500 font-bold'
                            }`}>
                                {call.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {call.status === 'ongoing' && (
                        <button
                            onClick={handleTakeover}
                            disabled={call.isTakeoverActive}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95 text-[11px] uppercase tracking-widest ${
                                call.isTakeoverActive 
                                    ? "bg-emerald-500 text-white cursor-default shadow-emerald-500/20" 
                                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                            }`}
                        >
                            <Headset size={16} />
                            <span>{call.isTakeoverActive ? "Human Active" : "Take Over"}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    {/* Visual Identity Card */}
                    <div className="card-premium">
                        <h3 className="text-label mb-8">Meta Information</h3>
                        <div className="space-y-8">
                            <div className="flex items-center gap-5 group">
                                 <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600/60 transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-600/20 shrink-0">
                                    <UserIcon size={22} />
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-label mb-1.5 opacity-70">Customer</p>
                                    <p className="text-gray-900 font-black text-lg tracking-tight leading-none truncate overflow-hidden">
                                        {call.customerPhone}
                                    </p>
                                 </div>
                            </div>
                            <div className="flex items-center gap-5 group">
                                 <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600/60 transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-600/20 shrink-0">
                                    <Clock size={22} />
                                 </div>
                                 <div>
                                    <p className="text-label mb-1.5 opacity-70">Runtime</p>
                                    <p className="text-gray-900 font-black text-lg tracking-tight leading-none">
                                        {Math.floor(call.duration / 60)}m {call.duration % 60}s
                                    </p>
                                 </div>
                            </div>
                            <div className="pt-8 border-t border-gray-50 flex flex-col gap-2">
                                <p className="text-label opacity-70">Timestamp</p>
                                <p className="text-gray-900 text-xs font-black tracking-tight bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 w-fit">
                                    {new Date(call.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* POS Integration Status */}
                    {call.order && (
                        <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-emerald-500/5 active:scale-[0.99]">
                            <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ShoppingBag size={120} className="text-emerald-900" />
                            </div>
                            <h3 className="text-emerald-700 text-label mb-8">Linked Transaction</h3>
                            <div className="space-y-6 relative z-10">
                                <div className="flex justify-between items-end border-b border-emerald-500/10 pb-6">
                                    <span className="text-sm text-emerald-700 font-bold">Grand Total</span>
                                    <span className="text-price text-emerald-900">${(call.order.totalAmount / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/60 p-3.5 rounded-2xl border border-white/80 backdrop-blur-md shadow-sm">
                                    <span className="text-[10px] text-emerald-800 font-black uppercase tracking-widest">Status</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">
                                            {call.order.cloverOrderId ? "POS SYNCED" : "LOCAL CACHE"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Advanced Path Explorer */}
                <div className="lg:col-span-2">
                    <div className="card-premium min-h-[600px] !p-8">
                        <div className="mb-10 flex justify-between items-center">
                            <h3 className="text-label">Interaction Timeline</h3>
                            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-indigo-50/50 rounded-full border border-indigo-100/50 ring-4 ring-indigo-50/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)] animate-pulse" />
                                <span className="text-[9px] text-indigo-600 uppercase font-black tracking-widest leading-none">Decision Engine Active</span>
                            </div>
                        </div>
                        
                        {/* Using our high-fidelity explorer */}
                        <CallPathExplorer 
                            transcript={call.transcript || []} 
                            status={call.status}
                            orderData={call.order}
                        />
                    </div>
                </div>
            </div>
        </div>
    </DashboardLayout>
  );
}
