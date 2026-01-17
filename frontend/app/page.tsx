"use client";

import React from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Bot, 
  Zap, 
  ShieldCheck,
  Mic2,
  PhoneCall,
  Radio,
  ChevronRight,
  CheckCircle,
  BarChart3
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 sticky top-0 bg-white/80 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
              <Radio className="text-white" size={18} />
            </div>
            <span className="text-base font-semibold text-gray-900">Hayman AI Voice AI</span>
          </div>
          
          <div className="flex items-center gap-4">
              <Link href="/admin" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Sign In
              </Link>
              <Link href="/admin/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Get Started
              </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24">
        <div className="text-center space-y-8 max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium">
            <Bot size={14} /> Powered by Enterprise AI
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
            24/7 AI Phone Agent<br />for Your Restaurant
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Never miss another call. Our voice AI handles orders, answers questions, and syncs with your Clover POS — automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/admin/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm">
              Deploy Your AI Agent
              <ArrowRight size={18} />
            </Link>
            <Link href="/admin" className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                    <Zap size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sub-Second Response</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Lightning-fast AI that processes natural language faster than a human, ensuring smooth conversations.
                </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600 mb-4">
                    <ShieldCheck size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">POS Integration</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Bi-directional sync with Clover. Orders appear in your kitchen instantly as the AI completes calls.
                </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 mb-4">
                    <BarChart3 size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                    Real-time dashboards show call metrics, conversion rates, and revenue insights to optimize operations.
                </p>
            </div>
        </div>

        {/* Stats Section */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-12 border border-indigo-100">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Trusted by Restaurants Nationwide</h2>
            <p className="text-gray-600">Join hundreds of restaurants automating their phone operations</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">99.8%</div>
              <div className="text-sm text-gray-600">Uptime Guarantee</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">10k+</div>
              <div className="text-sm text-gray-600">Calls Handled Daily</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">$2M+</div>
              <div className="text-sm text-gray-600">Orders Processed</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                          <Radio className="text-white" size={16} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">Hayman AI Voice AI</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-500">
                      <span>© 2026 All rights reserved</span>
                      <span className="hidden md:block">•</span>
                      <span>Powered by Clover, Twilio & OpenAI</span>
                  </div>
              </div>
          </div>
      </footer>
    </div>
  );
}
