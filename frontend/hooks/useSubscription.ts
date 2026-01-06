import { useState, useEffect } from 'react';

export interface SubscriptionData {
    currentPlan: {
        name: string;
        price: number;
        features: string[];
        billingCycle: string;
    };
    paymentMethod: {
        type: string;
        last4: string;
        expiryMonth: string;
        expiryYear: string;
    } | null;
    nextBillingDate: Date | null;
    nextBillingAmount: number;
    usageStats: {
        minutesUsed: number;
        minutesLimit: number;
    };
    availablePlans: Array<{
        name: string;
        price: number;
        features: string[];
        popular: boolean;
    }>;
}

export function useSubscription(restaurantId: string) {
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSubscription() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/restaurants/${restaurantId}/subscription`);

                if (!response.ok) {
                    throw new Error('Failed to fetch subscription');
                }

                const data = await response.json();
                setSubscription(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        if (restaurantId) {
            fetchSubscription();
        }
    }, [restaurantId]);

    return { subscription, loading, error };
}
