"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Phone, 
  Clock, 
  ShoppingBag, 
  ExternalLink, 
  Loader2,
  TrendingUp,
  Users,
  DollarSign,
  Activity
} from "lucide-react";
import { io } from "socket.io-client";
import DashboardLayout from "../../../components/admin/DashboardLayout";
import SubscriptionView from "../../../components/admin/SubscriptionView";
import CallWorkflowView from "../../../components/admin/CallWorkflowView";
import AnalyticsView from "../../../components/admin/AnalyticsView";
import CallHistoryView from "../../../components/admin/CallHistoryView";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  paymentUrl?: string;
  items: OrderItem[];
  createdAt: string;
}

interface Call {
  id: string;
  customerPhone: string;
  status: string;
  duration: number;
  createdAt: string;
  summary?: string;
  isTakeoverActive?: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  phoneNumber: string;
  city: string;
  state: string;
  cuisineType: string;
}

export default function AdminDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id: restaurantId } = use(params);
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") || "workflow";
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [calls, setCalls] = useState<Call[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [restaurantRes, callsRes, ordersRes, statsRes] = await Promise.all([
                fetch(`/api/restaurants/${restaurantId}`),
                fetch(`/api/restaurants/${restaurantId}/calls`),
                fetch(`/api/restaurants/${restaurantId}/orders`),
                fetch(`/api/restaurants/${restaurantId}/call-metrics`)
            ]);

            if (restaurantRes.ok) setRestaurant(await restaurantRes.json());
            if (callsRes.ok) setCalls(await callsRes.json());
            if (ordersRes.ok) setOrders(await ordersRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
        } catch (err) {
            console.error("Failed to fetch data:", err);
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        fetchData();

        // WebSocket connection for real-time updates
        const socket = io("http://localhost:3001");
        
        socket.on("call:started", (call) => {
            if (call.restaurantId === restaurantId) {
                setCalls(prev => [call, ...prev]);
            }
        });

        socket.on("call:ended", (call) => {
            if (call.restaurantId === restaurantId) {
                setCalls(prev => prev.map(c => c.id === call.id ? call : c));
            }
        });

        socket.on("order:new", (order) => {
            if (order.restaurantId === restaurantId) {
                setOrders(prev => [order, ...prev]);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [restaurantId, fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    const location = restaurant ? `${restaurant.city}, ${restaurant.state}` : undefined;

    return (
        <DashboardLayout restaurantId={restaurantId} restaurantName={restaurant?.name} restaurantLocation={location}>
            {activeTab === "subscription" ? (
                <SubscriptionView restaurantId={restaurantId}  />
            ) : activeTab === "workflow" ? (
                <CallWorkflowView restaurantId={restaurantId} />
            ) : activeTab === "analytics" ? (
                <AnalyticsView restaurantId={restaurantId} />
            ) : activeTab === "history" ? (
                <CallHistoryView restaurantId={restaurantId} />
            ) : (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Call workflow</h1>
                        <p className="text-sm text-gray-500 mt-1">Monitor and manage AI call operations</p>
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Upgrade
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-5 border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                <Phone className="text-blue-600" size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-gray-500">Active Calls</div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.activeCalls || 0}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-5 border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                                <Clock className="text-purple-600" size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-gray-500">Total Calls</div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.totalCalls || 0}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-5 border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                                <TrendingUp className="text-green-600" size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-gray-500">Success Rate</div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.successRate || 0}%</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-5 border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                                <Activity className="text-orange-600" size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-gray-500">Total Minutes</div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.totalMinutes || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Calls */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-5 border-b border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900">Recent Calls</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {calls.slice(0, 5).length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">No calls yet</div>
                            ) : (
                                calls.slice(0, 5).map((call) => (
                                    <div key={call.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-900">{call.customerPhone}</span>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                call.status === 'ONGOING' ? 'bg-blue-50 text-blue-700' :
                                                call.status === 'ORDER_PLACED' ? 'bg-green-50 text-green-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {call.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span>{new Date(call.createdAt).toLocaleString()}</span>
                                            <span>{call.duration}s</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {calls.length > 0 && (
                            <div className="p-4 border-t border-gray-200">
                                <Link href={`/admin/${restaurantId}?tab=history`} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                                    View all calls →
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Pending Orders */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-5 border-b border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900">Pending Orders</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {orders.filter(o => o.status === 'PENDING').length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">No pending orders</div>
                            ) : (
                                orders.filter(o => o.status === 'PENDING').slice(0, 5).map((order) => (
                                    <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-900">{order.customerName}</span>
                                            <span className="text-sm font-bold text-gray-900">${(order.totalAmount / 100).toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                            <span>{order.customerPhone}</span>
                                            <span>•</span>
                                            <span>{order.items.length} items</span>
                                        </div>
                                        {order.paymentUrl && (
                                            <a 
                                                href={order.paymentUrl} 
                                                target="_blank" 
                                                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                            >
                                                Payment Link <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                </div>
            )}
        </DashboardLayout>
    );
}
