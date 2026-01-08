"use client";

import { use, useState } from "react";
import { Star, Send, CheckCircle, Loader2 } from "lucide-react";

export default function FeedbackPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params);
  const [rating, setRating] = useState(0);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", content: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          ...formData,
          rating
        })
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            Your feedback has been sent directly to the owner. We appreciate you helping us improve.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="text-indigo-600 font-medium hover:underline"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-center text-white">
          <h1 className="text-xl font-bold">How was your experience?</h1>
          <p className="text-indigo-100 text-sm mt-1">We value your feedback.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Rating */}
          <div className="flex flex-col items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Rate your visit</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star 
                    size={32} 
                    className={`${star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} 
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
                <span className={`text-sm font-medium ${
                    rating >= 4 ? "text-green-600" : rating <= 2 ? "text-red-500" : "text-yellow-600"
                }`}>
                    {rating === 5 ? "Excellent! 😍" : 
                     rating === 4 ? "Good! 🙂" :
                     rating === 3 ? "Okay 😐" : 
                     rating === 2 ? "Could be better 😕" : "Terrible 😞"}
                </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {rating > 0 && rating <= 3 ? "What went wrong?" : "What did you like best?"}
              </label>
              <textarea
                required
                className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50 focus:bg-white"
                rows={4}
                placeholder="Tell us about your experience..."
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name (Optional)</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-gray-200 p-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone/Email (Optional)</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-gray-200 p-2.5 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || rating === 0 || !formData.content}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            Submit Feedback
          </button>
        </form>
      </div>
    </div>
  );
}
