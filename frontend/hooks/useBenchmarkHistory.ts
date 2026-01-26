import { useEffect, useState } from 'react';

export interface BenchmarkHistoryEntry {
  file: string;
  completedAt: string | null;
  startedAt: string | null;
  suite: string | null;
  models: string[];
}

export interface BenchmarkHistoryResponse {
  reports: BenchmarkHistoryEntry[];
}

export interface BenchmarkHistoryFilters {
  from?: string;
  to?: string;
  limit?: number;
}

export function useBenchmarkHistory(filters: BenchmarkHistoryFilters = {}, refreshKey = 0) {
  const [history, setHistory] = useState<BenchmarkHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.limit) params.set('limit', String(filters.limit));
        const query = params.toString();
        const response = await fetch(`/api/benchmarks/history${query ? `?${query}` : ""}`);
        if (!response.ok) {
          throw new Error('Failed to fetch benchmark history');
        }
        const data = await response.json();
        setHistory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [filters.from, filters.to, filters.limit, refreshKey]);

  return { history, loading, error };
}
