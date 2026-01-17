"use client";

import React from "react";
import { 
  PhoneIncoming, 
  Bot, 
  User, 
  Zap, 
  ShoppingCart, 
  PhoneOff,
  Play,
  FileText,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal
} from "lucide-react";

interface CallPathExplorerProps {
  transcript: any[];
  status: string;
  orderData?: any;
}

export default function CallPathExplorer({ transcript, status, orderData }: CallPathExplorerProps): React.JSX.Element {
  // Convert our flat transcript into a structured timeline
  const timeline: any[] = [];

  // 1. Always start with the incoming call event
  timeline.push({ 
    type: "event", 
    icon: PhoneIncoming, 
    label: "Incoming Call", 
    time: "0:00", 
    details: "Connection established with Voice AI Agent.", 
    color: "text-emerald-400", 
    bg: "bg-emerald-500/10" 
  });

  // 2. Map transcripts to bubbles
  transcript.forEach((msg, idx) => {
    const time = msg.time ? new Date(msg.time).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }) : "";
    
    timeline.push({
      type: msg.role === 'user' ? 'user' : 'agent',
      icon: msg.role === 'user' ? User : Bot,
      label: msg.role === 'user' ? 'Customer' : 'AI Agent',
      time,
      content: msg.text,
      status: msg.role === 'assistant' && idx === transcript.length - 1 && status === 'ongoing' ? "LIVE" : null,
      module: msg.role === 'assistant' ? (idx === 0 ? "GREETING" : "DIALOGUE") : null
    });

    // Heuristic: If user said something that looks like an order, add an intent marker
    if (msg.role === 'user' && (msg.text.toLowerCase().includes("order") || msg.text.toLowerCase().includes("want"))) {
        timeline.push({
            type: "intent",
            icon: Zap,
            label: "INTENT DETECTED",
            time,
            details: "Order Interest",
            confidence: "94%",
            color: "text-amber-400",
            bg: "bg-amber-500/10"
        });
    }
  });

  // 3. Add POS event if order exists
  if (orderData) {
      timeline.push({
          type: "pos",
          icon: ShoppingCart,
          label: "POS INTEGRATION",
          time: "Synced",
          details: `Order Created #${orderData.cloverOrderId || orderData.id.slice(-4).toUpperCase()}`,
          color: "text-indigo-400",
          bg: "bg-indigo-500/10"
      });
  }

  // 4. End event if not ongoing
  if (status !== 'ongoing') {
      timeline.push({ 
        type: "event", 
        icon: PhoneOff, 
        label: "Call Ended", 
        time: "--:--", 
        details: status === 'ORDER_PLACED' ? "Order Confirmed" : "Normal termination", 
        color: "text-slate-500", 
        bg: "bg-slate-800/50" 
      });
  }

  return (
    <div className="space-y-10">
      {/* Premium Audio Player Header */}
      <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-5 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between shadow-sm gap-8 ring-4 ring-indigo-50/10">
         <div className="flex items-center gap-5 lg:gap-8 flex-1 w-full">
            <button className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 shrink-0 group">
                <Play fill="currentColor" size={24} className="ml-1 group-hover:scale-110 transition-transform" />
            </button>
            <div className="flex-1 space-y-3">
                <div className="flex gap-1.5 h-10 lg:h-12 items-center cursor-pointer group">
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(i => {
                        const heights = ["h-3", "h-6", "h-10", "h-5", "h-8", "h-3", "h-9", "h-5"];
                        return (
                            <div key={i} className={`w-1.5 lg:w-2 bg-indigo-200 rounded-full group-hover:bg-indigo-400 transition-all opacity-40 group-hover:opacity-100 ${heights[i % heights.length]}`} />
                        );
                    })}
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Digital Recording</span>
                        <div className="w-1 h-1 rounded-full bg-indigo-200" />
                        <span className="text-[10px] font-black font-mono text-gray-400">02:15 / 05:00</span>
                    </div>
                </div>
            </div>
         </div>
         <div className="flex gap-3 w-full lg:w-auto">
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2.5 px-5 py-3 bg-white hover:bg-gray-50 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-gray-100 shadow-sm active:scale-95">
                <FileText size={16} className="text-gray-400" /> Full Log
            </button>
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2.5 px-5 py-3 bg-white text-rose-600 border border-rose-100 hover:bg-rose-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">
                <AlertCircle size={16} className="text-rose-400" /> Report Issue
            </button>
         </div>
      </div>

      {/* Timeline Explorer */}
      <div className="relative pl-8 lg:pl-12 space-y-10 pb-16">
        {/* Continuous vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-100"></div>

        {transcript.length === 0 && status !== 'ongoing' && (
             <div className="relative mb-10 ml-0 animate-in fade-in duration-500">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 z-10 shadow-sm">
                        <AlertCircle size={20} className="text-amber-500" />
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 max-w-lg shadow-sm">
                        <p className="text-xs font-black text-amber-900 uppercase tracking-widest mb-1.5">No Transcript Captured</p>
                        <p className="text-sm text-amber-800/70 leading-relaxed font-medium">Digital transcription was not logged for this session. You can still listen to the binary audio recording in the player above.</p>
                    </div>
                </div>
             </div>
        )}

        {timeline.map((step, i) => (
          <div key={i} className="relative group animate-in fade-in slide-in-from-left-4 duration-700" style={{ animationDelay: `${i * 100}ms` }}>
            {/* Timeline Icon */}
            <div className="absolute -left-9 lg:-left-12 top-0">
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-2xl border flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 ring-4 ring-white ${
                    step.type === 'agent' ? "bg-indigo-600 text-white border-transparent shadow-indigo-600/20" :
                    step.type === 'user' ? "bg-white text-gray-500 border-gray-100" :
                    step.type === 'intent' ? "bg-amber-500 text-white border-transparent shadow-amber-500/20" :
                    step.type === 'pos' ? "bg-emerald-500 text-white border-transparent shadow-emerald-500/20" :
                    "bg-white text-gray-300 border-gray-100"
                }`}>
                    {step.type === 'intent' ? <Zap size={18} fill="currentColor" /> : <step.icon size={18} />}
                </div>
            </div>

            {/* Content Segment */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <span className="text-label">{step.label}</span>
                <span className="text-[10px] font-black font-mono text-gray-300 ml-auto bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{step.time}</span>
              </div>

              {step.content && (
                <div className={`px-6 py-5 rounded-3xl max-w-3xl text-sm leading-relaxed border transition-all duration-200 group-hover:shadow-md ${
                    step.type === 'agent' 
                        ? "bg-white border-indigo-100/50 text-gray-800 shadow-sm shadow-indigo-500/5 ring-1 ring-indigo-50/30 italic font-medium" 
                        : "bg-gray-50/50 border-gray-100 text-gray-600 font-medium"
                }`}>
                  <p className="opacity-90 leading-loose">"{step.content}"</p>
                </div>
              )}

              {step.type === 'intent' && (
                  <div className="flex flex-col gap-3 p-5 bg-amber-50/50 border border-amber-100 rounded-3xl w-fit max-w-full shadow-sm">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{step.label}</span>
                        <span className="px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black rounded-full uppercase shadow-sm">CONFIDENCE: {step.confidence}</span>
                    </div>
                    <button className="flex items-center gap-3 px-5 py-2.5 bg-white border border-amber-200 rounded-xl text-[10px] font-black text-amber-700 uppercase tracking-wider shadow-sm hover:bg-amber-100 hover:border-amber-300 transition-all active:scale-95">
                        <ShoppingCart size={14} className="text-amber-500" />
                        {step.details}
                    </button>
                  </div>
              )}

              {step.details && step.type !== 'intent' && (
                 <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl border ${step.bg ? step.bg.replace('/10', '/30').replace('slate-800', 'indigo-50/30').replace('bg-', 'bg-') : 'bg-gray-50'} ${step.color ? step.color.replace('slate-400', 'indigo-600').replace('text-emerald-400', 'text-emerald-600') : 'text-gray-600'} border-gray-100 text-[10px] font-black uppercase tracking-widest w-fit shadow-sm ring-4 ring-white`}>
                    {step.type === 'pos' ? <ShoppingCart size={14} /> : step.type === 'event' ? <step.icon size={14} /> : <Zap size={14} fill="currentColor" />}
                    {step.details}
                 </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
