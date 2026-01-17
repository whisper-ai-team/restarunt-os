import { useState, useEffect } from 'react';

export interface Call {
    id: string;
    restaurantId: string;
    status: string;
    duration: number;
    recordingUrl?: string;
    transcript?: string;
    customerName?: string;
    customerPhone?: string;
    createdAt: string;
    order?: {
        id: string;
        total: number;
        status: string;
    };
}

export function useCalls(restaurantId: string) {
    const [calls, setCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCalls() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/restaurants/${restaurantId}/calls`);

                if (!response.ok) {
                    throw new Error('Failed to fetch calls');
                }

                const data = await response.json();
                setCalls(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        if (restaurantId) {
            fetchCalls();
        }
    }, [restaurantId]);

    return { calls, loading, error };
}
