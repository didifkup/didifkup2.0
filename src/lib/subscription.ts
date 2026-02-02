import { supabase } from '@/lib/supabaseClient';

export interface MySubscriptionStatus {
  subscription_status: string | null;
  current_period_end: string | null; // ISO timestamp
  stripe_customer_id: string | null;
}

/**
 * Reads the current user's profile row and returns subscription fields.
 * Returns null if not signed in or no profile row exists.
 */
export async function getMySubscriptionStatus(): Promise<MySubscriptionStatus | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, current_period_end, stripe_customer_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('[subscription] getMySubscriptionStatus error:', error.message);
    return null;
  }

  if (!data) return null;

  return {
    subscription_status: data.subscription_status ?? null,
    current_period_end: data.current_period_end ? String(data.current_period_end) : null,
    stripe_customer_id: data.stripe_customer_id ?? null,
  };
}
