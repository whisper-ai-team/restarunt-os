"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, MapPin, Phone, ArrowUpRight, ArrowDownRight, Clock, AlertCircle, ShoppingBag, Radio } from "lucide-react";
import GlobalDashboardLayout from "@/components/admin/GlobalDashboardLayout";

interface Restaurant {
  id: string;
  name: string;
  phoneNumber: string;
  city: string;
  state: string;
  cuisineType: string;
  isActive: boolean;
  _count: {
    orders: number;
  };
}

// Mock Activity Data
const RECENT_ACTIVITY = [
  { id: 1, type: "order", message: "New order #1203 at Spicy Bites NYC", time: "2 min ago" },
  { id: 2, type: "system", message: "System backup completed successfully", time: "1 hour ago" },
  { id: 3, type: "alert", message: "High call volume detected in Miami region", time: "2 hours ago" },
  { id: 4, type: "restaurant", message: "Bharat Bistro updated business hours", time: "3 hours ago" },
  { id: 5, type: "onboarding", message: "New restaurant 'Sushi Zen' onboarded", time: "5 hours ago" },
];

export default function AdminDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRestaurants();
  }, []);

  async function fetchRestaurants() {
    try {
      const res = await fetch("/api/restaurants");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRestaurants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = restaurants.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.phoneNumber.includes(search)
  );

  const totalOrders = restaurants.reduce((acc, r) => acc + (r._count?.orders || 0), 0);
  const activeCount = restaurants.filter(r => r.isActive).length;

  return (
    <GlobalDashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor restaurant performance and system health.</p>
          </div>
          <Link
            href="/admin/new"
            className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 font-medium text-sm"
          >
            <Plus size={18} />
            Onboard Restaurant
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Total Restaurants" 
            value={restaurants.length} 
            trend="+12%" 
            trendUp={true} 
            icon={<ShoppingBag className="text-indigo-600" size={20} />} 
          />
          <StatCard 
            title="Active Locations" 
            value={activeCount} 
            trend="+5%" 
            trendUp={true}
            icon={<MapPin className="text-green-600" size={20} />} 
          />
          <StatCard 
            title="Total Orders" 
            value={totalOrders} 
            trend="+28%" 
            trendUp={true}
            icon={<ArrowUpRight className="text-blue-600" size={20} />} 
          />
        </div>

        {/* Main Content Areas */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Recent Activity Feed (Right Column on large screens, or below) */}
          <div className="xl:col-span-1 xl:order-last space-y-6">
             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Live Activity</h2>
                  <div className="flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                    Realtime
                  </div>
                </div>
                <div className="space-y-6">
                  {RECENT_ACTIVITY.map((activity) => (
                    <div key={activity.id} className="flex gap-4 items-start relative pl-4 border-l-2 border-gray-100 last:border-0 hover:border-gray-200 transition-colors">
                       <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-200" />
                       <div className="flex-1">
                          <p className="text-sm text-gray-900 font-medium leading-snug">{activity.message}</p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Clock size={12} /> {activity.time}
                          </p>
                       </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-6 py-2 text-sm text-gray-500 hover:text-gray-900 font-medium border-t border-gray-100 transition-colors">
                  View All Activity
                </button>
             </div>

             <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700" />
                <h3 className="font-bold text-lg mb-2 relative z-10">System Status</h3>
                <p className="text-indigo-100 text-sm mb-4 relative z-10">All systems operational. Next maintenance scheduled for Sunday.</p>
                <div className="flex items-center gap-2 text-sm font-medium bg-white/20 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm relative z-10">
                  <Radio size={14} className="animate-pulse" />
                  99.9% Uptime
                </div>
             </div>
          </div>

          {/* Restaurant Grid (Left 2/3) */}
          <div className="xl:col-span-2 space-y-6">
             {/* Toolbar */}
             <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search restaurants..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm text-gray-900 border-none rounded-lg focus:outline-none focus:ring-0 placeholder:text-gray-400 bg-transparent"
                  />
                </div>
                <div className="h-6 w-px bg-gray-200" />
                <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                   Filter
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                   Sort
                </button>
             </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/${r.id}`}
                    className="group bg-white rounded-2xl p-5 border border-gray-200 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 group-hover:bg-indigo-50 flex items-center justify-center text-2xl transition-colors border border-gray-100 group-hover:border-indigo-100">
                        {getCuisineEmoji(r.cuisineType)}
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        r.isActive 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {r.isActive ? "Active" : "Inactive"}
                      </div>
                    </div>
                    
                    <div className="relative z-10">
                        <h3 className="text-base font-bold text-gray-900 mb-1 group-hover:text-indigo-700 transition-colors">{r.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-4 font-medium">
                        <MapPin size={14} className="text-gray-400" /> {r.city}, {r.state}
                        </p>

                        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 mt-2">
                        <div>
                            <p className="text-[10px] section-header-label text-gray-400 uppercase tracking-wider font-semibold">Phone</p>
                            <p className="text-xs font-mono text-gray-600 mt-1">{r.phoneNumber}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] section-header-label text-gray-400 uppercase tracking-wider font-semibold">Orders</p>
                            <p className="text-xs font-bold text-gray-900 mt-1">{r._count?.orders || 0}</p>
                        </div>
                        </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </GlobalDashboardLayout>
  );
}

function StatCard({ title, value, trend, trendUp, icon }: { title: string, value: string | number, trend: string, trendUp: boolean, icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
                {icon}
            </div>
            <span className="text-sm font-medium text-gray-600">{title}</span>
        </div>
        <div className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
          trendUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
    </div>
  );
}

function getCuisineEmoji(type: string) {
  const map: Record<string, string> = {
    Indian: "🍛",
    Mexican: "🌮",
    Italian: "🍕",
    Chinese: "🥡",
    American: "🍔",
    Japanese: "🍱"
  };
  return map[type] || "🍽️";
}
