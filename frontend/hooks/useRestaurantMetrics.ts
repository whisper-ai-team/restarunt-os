import { useState, useEffect } from 'react';

export interface CallMetrics {
    totalCalls: number;
    todayCalls: number;
    totalMinutes: number;
    successRate: number;
    activeCalls: number;
    hourlyData: Array<{ hour: string; calls: number }>;
    callDistribution: {
        successful: number;
        noOrder: number;
        abandoned: number;
        failed: number;
    };
    recentCalls: Array<{
        id: string;
        customerName: string;
        timestamp: Date;
        duration: number;
        status: string;
        orderTotal: number | null;
    }>;
    topItems: Array<{
        rank: number;
        name: string;
        category: string;
        orders: number;
        trend: string;
    }>;
    totalRevenue: number;
    averageOrderValue: number;
}

export function useRestaurantMetrics(restaurantId: string) {
    const [metrics, setMetrics] = useState<CallMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMetrics() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/restaurants/${restaurantId}/call-metrics`);

                if (!response.ok) {
                    throw new Error('Failed to fetch metrics');
                }

                const data = await response.json();
                setMetrics(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        if (restaurantId) {
            fetchMetrics();
        }
    }, [restaurantId]);

    return { metrics, loading, error };
}
