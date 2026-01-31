import Stripe from 'stripe';
import { applyCors } from '../_lib/cors';
import { json, methodNotAllowed, serverError } from '../_lib/http';
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
  res: { status: (n: number) => { json: (d: unknown) => void }; setHeader: (n: string, v: string | number | string[]) => void; end: (s?: string) => void }
) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const origin = getOrigin(req);
  const successUrl = `${origin}/app?upgrade=success`;
  const cancelUrl = `${origin}/app?upgrade=cancel`;

  try {
    const stripe = new Stripe(env.stripeSecretKey);
    const stripePriceId = env.stripePriceProMonthly;

    let { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let stripeCustomerId = sub?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;
      await supabaseAdmin.from('subscriptions').upsert(
        {
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      serverError(res);
      return;
    }

    json(res, 200, { url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    serverError(res);
  }
}
