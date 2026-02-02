import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to trigger Stripe Checkout for Pro subscription.
 * - Redirects to /signin if not authenticated
 * - POSTs to /api/stripe/create-checkout-session with Bearer token
 * - Redirects to Stripe Checkout URL on success
 * - Redirects to /signin on 401
 * - Shows window.alert for other errors
 */
export function useGoProCheckout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);

  const goProCheckout = async () => {
    if (!session?.access_token) {
      navigate('/signin', { replace: true, state: { message: 'Please sign in to upgrade to Pro.' } });
      return;
    }

    setIsPending(true);
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
        navigate('/signin', { replace: true, state: { message: 'Your session expired. Please sign in again to upgrade.' } });
        return;
      }

      if (res.ok && typeof data?.url === 'string') {
        window.location.href = data.url;
        return;
      }

      window.alert(data?.message || data?.error || 'Something went wrong. Please try again.');
    } catch (err) {
      window.alert('Could not start checkout. Please check your connection and try again.');
    } finally {
      setIsPending(false);
    }
  };

  return { goProCheckout, isPending };
}
