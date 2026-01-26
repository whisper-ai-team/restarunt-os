import { useState, useEffect } from 'react';

export interface CustomerUsageEntry {
  customerPhone: string;
  totalCalls: number;
  totalMinutes: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  tokensPerMinute: number;
  sttAudioMinutes: number;
  ttsCharactersCount: number;
  lastCallAt: string | null;
}

export interface CustomerUsageResponse {
  totalCustomers: number;
  customers: CustomerUsageEntry[];
}

export interface CustomerUsageFilters {
  from?: string;
  to?: string;
  limit?: number;
}

export function useCustomerUsage(restaurantId: string, filters: CustomerUsageFilters = {}) {
  const [usage, setUsage] = useState<CustomerUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        if (filters.limit) params.set("limit", String(filters.limit));
        const query = params.toString();
        const response = await fetch(`/api/restaurants/${restaurantId}/customer-usage${query ? `?${query}` : ""}`);
        if (!response.ok) {
          throw new Error('Failed to fetch customer usage');
        }
        const data = await response.json();
        setUsage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (restaurantId) {
      fetchUsage();
    }
  }, [restaurantId, filters.from, filters.to, filters.limit]);

  return { usage, loading, error };
}
