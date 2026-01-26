import { useEffect, useState } from 'react';

export interface BenchmarkModelStats {
  model: string;
  avgLatencyMs?: number;
  avgTokens?: number;
  avgCost?: number | null;
  passRate?: number;
}

export interface BenchmarkReport {
  models: Record<string, BenchmarkModelStats>;
  cases: string[];
  startedAt?: string;
  completedAt?: string;
}

export function useBenchmarkReport(refreshKey = 0) {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/benchmarks/latest');
        if (!response.ok) {
          throw new Error('No benchmark report available');
        }
        const data = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [refreshKey]);

  return { report, loading, error };
}
