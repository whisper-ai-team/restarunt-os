import { useState, useEffect } from 'react';

export interface WorkflowConfig {
    voiceSettings: {
        persona: string;
        language: string;
        speed: number;
    };
    greetingMessage: string;
    endCallMessage: string;
    notifications: {
        customMessage: string;
        promotions: string[];
        emailRecipients: string[];
        phoneNumbers: string[];
    };
}

export function useWorkflowConfig(restaurantId: string) {
    const [config, setConfig] = useState<WorkflowConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchConfig() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/restaurants/${restaurantId}/workflow`);

                if (!response.ok) {
                    throw new Error('Failed to fetch workflow config');
                }

                const data = await response.json();
                setConfig(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        if (restaurantId) {
            fetchConfig();
        }
    }, [restaurantId]);

    const updateConfig = async (updates: Partial<WorkflowConfig>) => {
        try {
            setError(null);

            const response = await fetch(`/api/restaurants/${restaurantId}/workflow`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                throw new Error('Failed to update workflow config');
            }

            const data = await response.json();

            // Refetch to get latest state
            const refreshResponse = await fetch(`/api/restaurants/${restaurantId}/workflow`);
            const refreshedData = await refreshResponse.json();
            setConfig(refreshedData);

            return data;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            throw err;
        }
    };

    return { config, loading, error, updateConfig };
}
