"use client";

import { use, useEffect, useState } from "react";
import DashboardLayout from "../../../../components/admin/DashboardLayout";
import ReviewInbox from "../../../../components/admin/reputation/ReviewInbox";
import { Loader2 } from "lucide-react";

export default function ReputationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: restaurantId } = use(params);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/restaurants/${restaurantId}`)
      .then(res => res.json())
      .then(data => {
        setRestaurant(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [restaurantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  const location = restaurant ? `${restaurant.city}, ${restaurant.state}` : undefined;

  return (
    <DashboardLayout restaurantId={restaurantId} restaurantName={restaurant?.name} restaurantLocation={location}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reputation Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and respond to customer reviews from Google, Yelp, and Facebook.
          </p>
        </div>

        <ReviewInbox restaurantId={restaurantId} />
      </div>
    </DashboardLayout>
  );
}
