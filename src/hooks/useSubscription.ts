import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface SubscriptionState {
  status: string | null;
  isPro: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useSubscription(userId: string | undefined): SubscriptionState {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSub = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        setStatus(null);
        return;
      }
      setStatus(data?.status ?? null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    fetchSub();
  }, [userId, fetchSub]);

  return {
    status,
    isPro: status === 'active',
    loading,
    refetch: fetchSub,
  };
}
