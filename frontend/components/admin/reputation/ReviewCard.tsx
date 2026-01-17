"use client";

import React, { useState } from "react";
import { Star, MessageSquare, CheckCircle, ThumbsUp, Trash2, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import AIResponder from "./AIResponder";

interface Review {
  id: string;
  source: string;
  authorName: string;
  rating: number;
  content: string;
  postedAt: string;
  status: string;
  replyContent?: string;
  replySentAt?: string;
}

interface ReviewCardProps {
  review: Review;
  onUpdate: () => void;
}

export default function ReviewCard({ review, onUpdate }: ReviewCardProps) {
  const [isResponderOpen, setIsResponderOpen] = useState(false);

  // Helper for source icon/color
  const getSourceStyle = (source: string) => {
    switch (source) {
      case "GOOGLE": return { bg: "bg-blue-100", text: "text-blue-600", label: "Google" };
      case "YELP": return { bg: "bg-red-100", text: "text-red-600", label: "Yelp" };
      case "FACEBOOK": return { bg: "bg-indigo-100", text: "text-indigo-600", label: "Facebook" };
      default: return { bg: "bg-gray-100", text: "text-gray-600", label: source };
    }
  };

  const sourceStyle = getSourceStyle(review.source);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${sourceStyle.bg} ${sourceStyle.text}`}>
            {review.authorName.charAt(0)}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">{review.authorName}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`px-1.5 py-0.5 rounded font-medium ${sourceStyle.bg} ${sourceStyle.text}`}>
                {sourceStyle.label}
              </span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(review.postedAt))} ago</span>
            </div>
          </div>
        </div>
        
        {review.status === "ANSWERED" ? (
          <span className="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-600 px-2 py-1 rounded-full uppercase">
            <CheckCircle size={12} /> Replied
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 px-2 py-1 rounded-full uppercase">
            Pending
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            size={14} 
            className={`${star <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} 
          />
        ))}
      </div>

      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        {review.content}
      </p>

      {/* Reply Section */}
      {review.status === "ANSWERED" && review.replyContent ? (
        <div className="bg-gray-50 rounded-lg p-3 text-xs border border-gray-100 mt-3">
          <div className="flex items-center gap-2 mb-1">
            <Reply size={12} className="text-indigo-500 transform rotate-180" />
            <span className="font-semibold text-gray-900">Your Reply</span>
            <span className="text-gray-400">• {formatDistanceToNow(new Date(review.replySentAt || ""))} ago</span>
          </div>
          <p className="text-gray-600">{review.replyContent}</p>
        </div>
      ) : (
        <button 
          onClick={() => setIsResponderOpen(true)}
          className="w-full py-2 rounded-lg border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare size={16} />
          Generate AI Reply
        </button>
      )}

      {isResponderOpen && (
        <AIResponder 
          review={review} 
          onClose={() => setIsResponderOpen(false)}
          onSuccess={() => {
            setIsResponderOpen(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
