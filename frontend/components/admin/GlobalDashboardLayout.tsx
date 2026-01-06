"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Bell, 
  Activity,
  Radio,
  LogOut
} from "lucide-react";

const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", name: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", name: "User Management", icon: Users },
    { href: "/admin/settings", name: "System Settings", icon: Settings },
    { href: "/admin/activity", name: "Activity Logs", icon: Activity },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 z-50">
      {/* Brand Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
            <Radio className="text-white" size={18} />
          </div>
          <div>
            <span className="block text-base font-bold text-gray-900 leading-tight">Hayman AI</span>
            <span className="block text-xs text-gray-500">Admin Portal</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-4 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full border border-green-100">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium">System Online</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive 
                  ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon size={18} className={isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button className="flex items-center gap-3 px-3 py-2 w-full text-left text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default function GlobalDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <Sidebar />
      <main className="pl-64">
        {/* Top Header Bar for Global Layout if needed, but we'll keep it clean */}
        <div className="p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
