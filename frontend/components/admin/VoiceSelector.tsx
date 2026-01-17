"use client";

import React, { useState, useEffect } from "react";
import { Mic, Mic2, Check, ArrowRight, Sparkles, Loader2, Play } from "lucide-react";

interface Voice {
  name: string;
  id: string;
  tags: string[];
  description: string;
  gender: string;
  tone: string;
  bestFor?: string;
}

interface VoiceSelectorProps {
  selected: string;
  onChange: (voiceId: string) => void;
}

export default function VoiceSelector({ selected, onChange }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/voices")
      .then(res => res.json())
      .then(data => {
        setVoices(data.voices);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load voices:", err);
        setLoading(false);
      });
  }, []);

  const filteredVoices = voices.filter(v => 
    filter === "all" || v.gender === filter
  );

  const genderCounts = {
    all: voices.length,
    female: voices.filter(v => v.gender === "female").length,
    male: voices.filter(v => v.gender === "male").length,
    neutral: voices.filter(v => v.gender === "neutral").length,
  };

  const colors = {
    female: { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-100", icon: "text-pink-500" },
    male: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", icon: "text-blue-500" },
    neutral: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100", icon: "text-purple-500" },
    default: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", icon: "text-indigo-500" }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-8 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-start space-x-5">
        <div className="w-14 h-14 rounded-2xl bg-white text-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-200">
          <Mic className="text-3xl" strokeWidth={1.5} />
        </div>
        <div className="pt-1">
          <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase mb-1.5">Agent Voice</h2>
          <p className="text-xl text-slate-900 font-bold tracking-tight">Choose a voice that matches your brand</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-3">
        {(["all", "female", "male", "neutral"] as const).map(f => {
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 ring-1 ring-indigo-600/10"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-sm"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`text-[10px] ml-1.5 px-2 py-0.5 rounded-full ${
                isActive ? "bg-white/25 text-white/90" : "bg-slate-100 text-slate-400"
              }`}>
                {genderCounts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredVoices.map(voice => {
          const isSelected = selected === voice.id;
          const theme = colors[voice.gender as keyof typeof colors] || colors.default;

          return (
            <div
              key={voice.id}
              onClick={() => onChange(voice.id)}
              className={`group relative p-6 rounded-2xl transition-all duration-300 cursor-pointer ${
                isSelected
                  ? "bg-white border-2 border-indigo-600 shadow-lg shadow-indigo-100/50 ring-4 ring-indigo-50/60"
                  : "bg-white border border-slate-200 hover:border-indigo-600/40 hover:shadow-lg hover:shadow-indigo-500/10"
              }`}
            >
              {/* Selected Badge */}
              {isSelected && (
                <div className="absolute -top-3 -right-3 bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-md z-10 ring-2 ring-white">
                  <Check size={14} strokeWidth={4} />
                </div>
              )}

              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : `${theme.bg} ${theme.icon} group-hover:bg-indigo-600 group-hover:text-white border ${theme.border} group-hover:border-indigo-600`
                  }`}>
                    <Mic2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-lg leading-tight">{voice.name}</h3>
                    <span className={`inline-flex items-center mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${theme.bg} ${theme.text} ${theme.border}`}>
                      {voice.gender}
                    </span>
                  </div>
                </div>
              </div>

              <p className={`text-sm mb-5 leading-relaxed ${isSelected ? "text-slate-700 font-medium" : "text-slate-600"}`}>
                {voice.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-5">
                {voice.tags.slice(0, 3).map(tag => (
                  <span 
                    key={tag}
                    className={`px-3 py-1 rounded-md text-xs font-semibold border ${
                      isSelected
                       ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                       : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100">
                <div className={`text-xs flex items-center gap-1.5 transition-colors ${
                  isSelected ? "text-indigo-600 font-bold" : "text-slate-400 font-medium group-hover:text-indigo-600"
                }`}>
                  <ArrowRight size={16} />
                  {voice.bestFor || "General use"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredVoices.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p>No voices matching this filter.</p>
        </div>
      )}
    </div>
  );
}
