"use client";

import React, { useState, useEffect } from "react";
import { Mic2, Sparkles, Loader2 } from "lucide-react";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-indigo-400" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "female", "male", "neutral"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 opacity-60">({genderCounts[f]})</span>
          </button>
        ))}
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredVoices.map(voice => (
          <div
            key={voice.id}
            onClick={() => onChange(voice.id)}
            className={`group relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.02] ${
              selected === voice.id
                ? "border-indigo-500 bg-slate-900 shadow-lg shadow-indigo-500/20"
                : "border-slate-800 bg-slate-950 hover:border-slate-700"
            }`}
          >
            {/* Selected Badge */}
            {selected === voice.id && (
              <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                <Sparkles size={12} className="text-white" />
              </div>
            )}

            {/* Voice Icon */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                selected === voice.id ? "bg-indigo-500/20 border border-indigo-500/30" : "bg-slate-800 border border-slate-700"
              }`}>
                <Mic2 className={
                  selected === voice.id ? "text-indigo-400" : "text-slate-400"
                } size={18} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-semibold">{voice.name}</h4>
                  {/* Gender Badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    voice.gender === "female" ? "bg-pink-500/20 text-pink-400" :
                    voice.gender === "male" ? "bg-blue-500/20 text-blue-400" :
                    "bg-purple-500/20 text-purple-400"
                  }`}>
                    {voice.gender}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{voice.description}</p>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {voice.tags.slice(1).map(tag => (
                    <span 
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Best For */}
                {voice.bestFor && (
                  <p className="text-[11px] text-slate-500 mt-2 italic">
                    → {voice.bestFor}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredVoices.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No voices found for this filter
        </div>
      )}
    </div>
  );
}
