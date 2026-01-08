"use client";

import React, { useState } from "react";
import { Sparkles, X, ChevronRight, Loader2, Send } from "lucide-react";

interface AIResponderProps {
  review: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AIResponder({ review, onClose, onSuccess }: AIResponderProps) {
  const [tone, setTone] = useState<"Professional" | "Grateful" | "Apologetic">("Professional");
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Select Tone, 2: Review/Edit
  const [posting, setPosting] = useState(false);

  const tones = [
    { id: "Professional", emoji: "👔", label: "Professional", desc: "Respectful and concise." },
    { id: "Grateful", emoji: "❤️", label: "Warm & Grateful", desc: "Enthusiastic appreciation." },
    { id: "Apologetic", emoji: "🙏", label: "Apologetic", desc: "Sincere concern." },
  ];

  const generateDraft = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/generate-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone })
      });
      const data = await res.json();
      setGeneratedDraft(data.reply);
      setStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const publishReply = async () => {
    setPosting(true);
    try {
        await fetch(`/api/reviews/${review.id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: generatedDraft })
        });
        onSuccess();
    } catch (err) {
        console.error(err);
    } finally {
        setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600"/>
            AI Review Responder
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                How would you like to respond to <b>{review.authorName}</b>?
              </p>
              <div className="grid grid-cols-1 gap-3">
                {tones.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id as any)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      tone === t.id 
                        ? "border-indigo-500 bg-indigo-50" 
                        : "border-gray-200 hover:border-indigo-200"
                    }`}
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    <div>
                      <div className={`font-semibold text-sm ${tone === t.id ? "text-indigo-700" : "text-gray-900"}`}>
                        {t.label}
                      </div>
                      <div className="text-xs text-gray-500">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                className="w-full h-40 p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none leading-relaxed resize-none"
                value={generatedDraft}
                onChange={(e) => setGeneratedDraft(e.target.value)}
              />
              <p className="text-xs text-center text-gray-400">
                You can edit this draft before publishing.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            {step === 2 && (
                <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                    Back to Tone
                </button>
            )}
            <div className="ml-auto flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                    Cancel
                </button>
                {step === 1 ? (
                    <button 
                        onClick={generateDraft}
                        disabled={loading}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-70 transition-colors"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        Generate Draft
                    </button>
                ) : (
                    <button 
                        onClick={publishReply}
                        disabled={posting}
                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-70 transition-colors"
                    >
                        {posting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        Publish Reply
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
