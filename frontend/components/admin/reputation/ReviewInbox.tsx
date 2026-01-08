"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Filter, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import ReviewCard from "./ReviewCard";

interface ReviewInboxProps {
  restaurantId: string;
}

export default function ReviewInbox({ restaurantId }: ReviewInboxProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("ALL"); // ALL, GOOGLE, YELP, FACEBOOK

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/reviews?source=${filter}`);
      if (res.ok) {
        setReviews(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, filter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/restaurants/${restaurantId}/reviews/sync`, { method: "POST" });
      await fetchReviews();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const tabs = [
    { id: "ALL", label: "All Reviews" },
    { id: "GOOGLE", label: "Google" },
    { id: "YELP", label: "Yelp" },
    { id: "FACEBOOK", label: "Facebook" },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                filter === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync Reviews"}
        </button>
      </div>

      {/* Stats/Summary (Optional - could go here) */}

      {/* Reviews List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 border-dashed">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Search size={20} className="text-gray-400" />
          </div>
          <h3 className="text-gray-900 font-semibold">No reviews found</h3>
          <p className="text-gray-500 text-sm mt-1">
            Try syncing to fetch the latest reviews from Google & Yelp.
          </p>
          <button
            onClick={handleSync}
            className="mt-4 text-indigo-600 font-medium text-sm hover:underline"
          >
            Sync now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {reviews.map((review) => (
            <ReviewCard 
                key={review.id} 
                review={review} 
                onUpdate={fetchReviews} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
