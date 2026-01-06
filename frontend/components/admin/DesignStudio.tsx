"use client";

import React, { useState } from "react";
import { 
  Mic2, 
  Settings2, 
  Play, 
  Save, 
  Workflow, 
  MessageSquare, 
  ShieldCheck,
  Zap,
  Plus,
  Trash2,
  Mail,
  Smartphone
} from "lucide-react";

interface DesignStudioProps {
  restaurant: any;
  onSave: (data: any) => void;
}

export default function DesignStudio({ restaurant, onSave }: DesignStudioProps) {
  const [aiName, setAiName] = useState(restaurant.aiName || "Hayman");
  const [voice, setVoice] = useState(restaurant.voiceSelection || "alloy");
  const [guidelines, setGuidelines] = useState(restaurant.agentGuidelines || "");
  const [greeting, setGreeting] = useState(restaurant.greeting || "");

  const handleSave = () => {
    onSave({
      aiName,
      voiceSelection: voice,
      agentGuidelines: guidelines,
      greeting
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Design Studio</h2>
          <p className="text-slate-400">Configure your agent's personality and conversation flow.</p>
        </div>
        <button 
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
        >
          <Save size={18} />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Personality & Greetings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agent Voice & Name */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
                <Mic2 className="text-indigo-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">Agent Identity</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Agent Name</label>
                <input 
                  type="text" 
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                  placeholder="e.g. Hayman AI"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Voice Persona</label>
                <select 
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                >
                  <option value="alloy">Alloy (Neutral)</option>
                  <option value="shimmer">Shimmer (Professional)</option>
                  <option value="echo">Echo (Helpful)</option>
                  <option value="fable">Fable (Friendly)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Call Flow Visualization */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                <Workflow className="text-emerald-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">Conversation Flow</h3>
            </div>

            <div className="space-y-12 relative">
              {/* Vertical line connector */}
              <div className="absolute left-5 top-8 bottom-8 w-px bg-slate-800"></div>

              {/* Step 1: Greeting */}
              <div className="relative pl-12 flex flex-col gap-4 group">
                <div className="absolute left-3 top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-slate-950 z-10"></div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Step 1</span>
                    <h4 className="text-md font-semibold text-white">Greeting Message</h4>
                  </div>
                  <textarea 
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all italic"
                    placeholder="Hello! Welcome to Bharat Bistro. How can I assist you today?"
                  />
                </div>
              </div>

              {/* Step 2: Knowledge Base */}
              <div className="relative pl-12 flex flex-col gap-4">
                <div className="absolute left-3 top-0 w-4 h-4 rounded-full bg-slate-700 border-4 border-slate-950 z-10"></div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 2</span>
                    <h4 className="text-md font-semibold text-white">Guidelines & Rules</h4>
                    <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/20">Advanced</span>
                  </div>
                  <textarea 
                    value={guidelines}
                    onChange={(e) => setGuidelines(e.target.value)}
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Provide specific rules for the agent, e.g. Do not offer discounts unless asked..."
                  />
                  <p className="mt-2 text-xs text-slate-500 italic flex items-center gap-1.5">
                    <ShieldCheck size={12} />
                    These rules govern how the AI handles edge cases and specific customer queries.
                  </p>
                </div>
              </div>

              {/* Step 3: Fulfillment */}
              <div className="relative pl-12 flex flex-col gap-4 opacity-50 select-none">
                <div className="absolute left-3 top-0 w-4 h-4 rounded-full bg-amber-500 border-4 border-slate-950 z-10"></div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Step 3</span>
                    <h4 className="text-md font-semibold text-white">Clover Fulfillment</h4>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-slate-500 text-sm">
                    Orders are automatically synchronized with your Clover POS upon confirmation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Notifications & Promotions */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
                <Smartphone className="text-indigo-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-300">Email Alerts</span>
                  <div className="w-10 h-5 bg-indigo-600 rounded-full flex items-center px-1">
                    <div className="w-3.5 h-3.5 bg-white rounded-full ml-auto"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail size={14} />
                  manager@restaurant.com
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors opacity-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-300">SMS Alerts</span>
                  <div className="w-10 h-5 bg-slate-800 rounded-full flex items-center px-1 cursor-not-allowed">
                    <div className="w-3.5 h-3.5 bg-slate-600 rounded-full"></div>
                  </div>
                </div>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter bg-indigo-500/10 px-1.5 py-0.5 rounded">Vetting Pending...</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-2xl p-6 shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
            <Zap className="absolute -right-4 -bottom-4 text-indigo-500/20 w-32 h-32 group-hover:scale-110 transition-transform duration-700" />
            <h4 className="text-lg font-bold text-white mb-2">Pro Insights</h4>
            <p className="text-indigo-100 text-sm leading-relaxed mb-4">
              Your AI handles an average of 142 calls per week, saving your staff 4.5 hours of phone time.
            </p>
            <button className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors">
              View Growth Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
