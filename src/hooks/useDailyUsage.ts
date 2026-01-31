import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FREE_CHECKS_PER_DAY } from '@/lib/constants';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DailyUsageState {
  checksUsed: number;
  remaining: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useDailyUsage(
  userId: string | undefined,
  _isPro: boolean
): DailyUsageState {
  const [checksUsed, setChecksUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!userId) {
      setChecksUsed(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const day = todayISO();
      const { data, error } = await supabase
        .from('usage_daily')
        .select('checks_used')
        .eq('user_id', userId)
        .eq('day', day)
        .single();
      if (error && error.code !== 'PGRST116') {
        setChecksUsed(0);
        return;
      }
      const used = data?.checks_used ?? 0;
      setChecksUsed(used);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setChecksUsed(0);
      setLoading(false);
      return;
    }
    fetchUsage();
  }, [userId, fetchUsage]);

  const remaining = Math.max(0, FREE_CHECKS_PER_DAY - checksUsed);

  return {
    checksUsed,
    remaining,
    loading,
    refetch: fetchUsage,
  };
}
