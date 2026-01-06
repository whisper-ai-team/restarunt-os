"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  BarChart3, 
  Clock, 
  Settings, 
  Workflow,
  CreditCard,
  Home,
  Radio,
  Bell,
  Search,
  Moon,
  Store,
  User as UserIcon,
  ChevronRight,
  Menu,
  X
} from "lucide-react";

interface SidebarProps {
  restaurantId: string;
  restaurantName?: string;
  restaurantLocation?: string;
}

const Sidebar = ({ restaurantId, restaurantName, restaurantLocation, isOpen, onClose }: SidebarProps & { isOpen?: boolean, onClose?: () => void }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "workflow";

  const navItems = [
    { id: "workflow", name: "Call Workflow", icon: Workflow },
    { id: "analytics", name: "Call Analytics", icon: BarChart3 },
    { id: "history", name: "Call History", icon: Clock },
    { id: "subscription", name: "Subscription", icon: CreditCard },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <div className={`w-64 h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-[70] transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        {/* Brand Header */}
        <div className="p-6">
          <div className="flex items-center justify-between lg:block mb-8">
            <Link href="/admin" className="flex items-center gap-3 group transition-transform hover:scale-[1.02] active:scale-95">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center shadow-lg shadow-gray-900/20">
                <span className="text-white font-black text-lg text-center leading-none">H</span>
              </div>
              <span className="text-base font-extrabold text-gray-900 tracking-tight">Hayman AI</span>
            </Link>
            <button onClick={onClose} className="lg:hidden p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 mb-8">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100/50 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse" />
              <span className="text-emerald-600 text-[9px] font-black tracking-widest uppercase">STATUS: ONLINE</span>
            </div>
          </div>
        </div>

        {/* Section Label: Context */}
        <div className="px-6 mb-3">
          <h3 className="text-label">Current Context</h3>
        </div>

        {restaurantName && (
          <div className="px-4 mb-8">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-2xl group transition-all hover:bg-white hover:shadow-sm">
              <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center text-white font-black text-[10px] shadow-sm">
                {restaurantName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-900 truncate">{restaurantName}</div>
                <div className="text-[10px] text-gray-400 font-medium truncate opacity-80">{restaurantLocation || 'Global'}</div>
              </div>
              <div className="text-gray-300 group-hover:text-gray-900 transition-colors cursor-pointer">
                <Settings size={14} />
              </div>
            </div>
          </div>
        )}

        {/* Section Label: Navigation */}
        <div className="px-6 mb-3">
          <h3 className="text-label">Navigation</h3>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          <Link 
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all group mb-2"
          >
            <Store size={18} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
            <span className="text-sm font-bold">All Restaurants</span>
          </Link>

          {navItems.map((item) => {
            const isActive = currentTab === item.id && pathname.includes(restaurantId);
            return (
              <Link
                key={item.id}
                href={`/admin/${restaurantId}?tab=${item.id}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  isActive 
                    ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-500/5 ring-1 ring-indigo-100/50" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <item.icon size={18} className={`${isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-900"} transition-colors`} />
                <span className="text-sm font-bold">{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-1 h-1 rounded-full bg-indigo-600" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile Section */}
        <div className="p-4 border-t border-gray-50 bg-gray-50/30">
          <div className="flex items-center gap-3 px-3 py-2.5 group cursor-pointer hover:bg-gray-50 rounded-2xl transition-all">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-indigo-500/20 shrink-0">
                  AU
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs font-bold text-gray-900 truncate">Admin User</p>
                  <p className="text-[10px] text-gray-400 truncate tracking-tight font-medium">admin@hayman.ai</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-900 transition-colors" />
          </div>
        </div>
      </div>
    </>
  );
};

export default function DashboardLayout({ children, restaurantId, restaurantName, restaurantLocation }: { 
  children: React.ReactNode, 
  restaurantId: string,
  restaurantName?: string,
  restaurantLocation?: string
}) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#fbfbfc]">
      <Sidebar 
        restaurantId={restaurantId} 
        restaurantName={restaurantName} 
        restaurantLocation={restaurantLocation} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="lg:pl-64 flex flex-col min-h-screen transition-all">
        {/* Top Utility Header */}
        <div className="h-14 flex items-center justify-between lg:justify-end px-4 lg:px-8 gap-6 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
           >
              <Menu size={20} />
           </button>
           
           <div className="flex items-center gap-4 lg:gap-6">
             <div className="relative group cursor-pointer text-gray-400 hover:text-gray-900 transition-colors">
                <Search size={18} className="group-hover:scale-110 transition-transform" />
             </div>
             <div className="relative group cursor-pointer text-gray-400 hover:text-gray-900 transition-colors">
                <Bell size={18} className="group-hover:scale-110 transition-transform" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
             </div>
             <div className="relative group cursor-pointer text-gray-400 hover:text-gray-900 transition-colors">
                <Moon size={18} className="group-hover:rotate-12 transition-transform" />
             </div>
           </div>
        </div>
        <div className="p-6 lg:p-10 flex-1 w-full max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
