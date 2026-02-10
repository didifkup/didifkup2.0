import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getStripeEnv } from '../_lib/env.js';

/** Verify Supabase user via REST API. Returns user or null. */
async function verifySupabaseUser(
  accessToken: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ id: string; email?: string } | null> {
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

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-04.28.basil' });
  const successUrl = `${env.SITE_URL}/upgrade/success`;
  const cancelUrl = `${env.SITE_URL}/upgrade/cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: env.STRIPE_PRICE_PRO_MONTHLY,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email ?? undefined,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] Stripe error:', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Checkout failed', message: 'Could not create checkout session' });
  }
}
