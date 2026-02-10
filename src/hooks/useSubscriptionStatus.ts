import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMySubscriptionStatus, type MySubscriptionStatus } from '@/lib/subscription';

export function useSubscriptionStatus() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<MySubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMySubscriptionStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.subscription_status]);

  const isPro =
    status?.subscription_status === 'active' || status?.subscription_status === 'trialing';

  return { subscriptionStatus: status, isPro, isLoading };
}
