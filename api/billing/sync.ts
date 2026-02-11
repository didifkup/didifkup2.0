import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getStripeEnv } from '../_lib/env.js';
import { setCorsHeaders, handleOptions } from '../_lib/cors.js';

/** Verify Supabase user via Auth REST API. Returns user with id and email or null. */
async function verifySupabaseUser(
  accessToken: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ id: string; email: string | undefined } | null> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseKey,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? { id: user.id, email: user.email } : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  const env = getStripeEnv();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }
  const accessToken = auth.slice(7).trim();
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token' });
  }

  const user = await verifySupabaseUser(
    accessToken,
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let subscriptionStatus: 'active' | 'past_due' | 'inactive' = 'inactive';
  let currentPeriodEnd: string | null = null;

  if (user.email?.trim()) {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-04.28.basil" as any, // keeps runtime EXACTLY the same
    });
    const customers = await stripe.customers.list({
      email: user.email.trim(),
      limit: 1,
    });
    const customer = customers.data[0];

    if (customer) {
      stripeCustomerId = customer.id;
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 10,
      });
      const activeSub = subs.data.find(
        (s) => s.status === 'active' || s.status === 'trialing'
      );
      const pastDueSub = subs.data.find((s) => s.status === 'past_due');
      const sub = activeSub ?? pastDueSub ?? subs.data[0];

      if (sub) {
        if (sub.status === 'active' || sub.status === 'trialing') {
          subscriptionStatus = 'active';
        } else if (sub.status === 'past_due') {
          subscriptionStatus = 'past_due';
        }
        stripeSubscriptionId = sub.id;
        const subAny = sub as any;
        const periodEnd = subAny.current_period_end;
        currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
      }
    }
  }

  const row: Record<string, unknown> = {
    id: user.id,
    subscription_status: subscriptionStatus,
    current_period_end: currentPeriodEnd,
  };
  if (stripeCustomerId != null) row.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId != null) row.stripe_subscription_id = stripeSubscriptionId;

  await supabase.from('profiles').upsert(row, { onConflict: 'id' });

  return res.status(200).json({ status: subscriptionStatus });
}
