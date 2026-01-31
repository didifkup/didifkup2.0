import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

export function useGoProCheckout() {
  const { session, user } = useAuth();
  const { isPro } = useSubscription(user?.id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const handleGoPro = async () => {
    if (!session?.access_token) {
      navigate('/signin');
      return;
    }
    if (isPro) {
      navigate('/app');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        navigate('/signin');
        return;
      }
      if (res.status === 400 && data?.error === 'Already subscribed') {
        navigate('/app');
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? data?.message ?? 'Checkout failed. Try again.');
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  return { handleGoPro, goProLoading: loading, goProError: error, clearGoProError: () => setError(null) };
}
