import Stripe from 'stripe';
import { applyCors } from '../_lib/cors';
import { json, methodNotAllowed } from '../_lib/http';
import { requireUser } from '../_lib/requireUser';
import { supabaseAdmin } from '../_lib/supabaseAdmin';
import { env } from '../_lib/env';

function getOrigin(req: { headers?: Record<string, string | string[] | undefined> }): string {
  const origin = req.headers?.origin ?? req.headers?.Origin;
  const originStr = Array.isArray(origin) ? origin[0] : origin;
  if (originStr && typeof originStr === 'string') {
    try {
      new URL(originStr);
      return originStr;
    } catch {}
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  return 'http://localhost:5173';
}

export default async function handler(
  req: { method?: string; headers?: Record<string, string | string[] | undefined> },
  res: {
    status: (n: number) => { json: (d: unknown) => void };
    setHeader: (n: string, v: string | number | string[]) => void;
    end: (s?: string) => void;
  }
) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const origin = getOrigin(req);
  const successUrl = `${origin}/upgrade/success`;
  const cancelUrl = `${origin}/upgrade/cancel`;

  try {
    const stripe = new Stripe(env.stripeSecretKey);
    const priceId = env.stripeProPriceId;

    let { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, status')
      .eq('user_id', user.id)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('[create-checkout-session] subscriptions fetch:', subError.message);
      return json(res, 500, { error: 'Failed to load subscription' });
    }

    if (sub?.status === 'active') {
      console.info('[create-checkout-session] user already Pro, skipping', user.id);
      return json(res, 400, { error: 'Already subscribed' });
    }

    let stripeCustomerId = sub?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          metadata: { supabase_user_id: user.id },
        });
        stripeCustomerId = customer.id;
        const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert(
          {
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (upsertError) {
          console.error('[create-checkout-session] upsert customer:', upsertError.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create Stripe customer';
        console.error('[create-checkout-session] Stripe customer:', msg);
        return json(res, 500, { error: msg });
      }
    }

    const idempotencyKey = `checkout-${user.id}-${Math.floor(Date.now() / 10000)}`;
    let session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: stripeCustomerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
        { idempotencyKey }
      );
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
      const code = stripeErr && typeof stripeErr === 'object' && 'code' in stripeErr ? stripeErr.code : null;
      console.error('[create-checkout-session] Stripe session create:', msg, { code, userId: user.id });
      const userMsg =
        code === 'resource_missing' || msg.toLowerCase().includes('expired')
          ? 'Checkout session expired. Please try again.'
          : msg;
      return json(res, 500, { error: userMsg });
    }

    if (!session.url) {
      return json(res, 500, { error: 'Stripe did not return a checkout URL' });
    }

    return json(res, 200, { url: session.url });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'An error occurred creating the checkout session';
    console.error('[create-checkout-session] unexpected:', msg);
    return json(res, 500, { error: msg });
  }
}
