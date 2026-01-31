import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface HistoryItem {
  id: string;
  created_at: string;
  output: {
    verdict: 'LOW' | 'MEDIUM' | 'HIGH';
    summary: string;
    reasons: string[];
    nextMove: string;
    followUpTexts: { soft: string; neutral: string; firm: string };
  };
}

export interface UseHistoryState {
  items: HistoryItem[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useHistory(userId: string | undefined): UseHistoryState {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('id, created_at, output')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        setItems([]);
        return;
      }
      setItems((data ?? []) as HistoryItem[]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { items, loading, refetch: fetchHistory };
}
