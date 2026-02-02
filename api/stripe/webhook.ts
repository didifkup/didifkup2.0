import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} from '../_lib/env';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-04.28.basil' });

/** Read raw body for Stripe signature verification. */
function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Fetch Stripe customer email by customer id. */
async function getCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    const email = (customer as Stripe.Customer).email?.trim();
    return email || null;
  } catch {
    return null;
  }
}

/** Find profile id by email (profiles.email). */
async function findProfileIdByEmail(email: string): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.trim())
    .maybeSingle();
  return data?.id ?? null;
}

/** Update profile subscription fields by profile id. */
async function updateProfile(
  profileId: string,
  updates: {
    stripe_customer_id: string;
    subscription_status: string;
    current_period_end: string | null;
  }
): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await supabase.from('profiles').upsert(
    {
      id: profileId,
      stripe_customer_id: updates.stripe_customer_id,
      subscription_status: updates.subscription_status,
      current_period_end: updates.current_period_end,
    },
    { onConflict: 'id' }
  );
}

async function syncProfileFromCustomer(
  customerId: string,
  subscriptionStatus: string,
  currentPeriodEnd: string | null
): Promise<void> {
  const email = await getCustomerEmail(customerId);
  if (!email) return;
  const profileId = await findProfileIdByEmail(email);
  if (!profileId) return;
  await updateProfile(profileId, {
    stripe_customer_id: customerId,
    subscription_status: subscriptionStatus,
    current_period_end: currentPeriodEnd,
  });
}

function subStatusToProfile(status: Stripe.Subscription['status']): string {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'canceled' || status === 'unpaid') return 'inactive';
  return 'inactive';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    return res.status(400).json({ error: 'Missing Stripe-Signature' });
  }

  let rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[webhook] raw body read error:', err);
    return res.status(400).json({ error: 'Invalid body' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[webhook] signature verification failed:', message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (!customerId) break;

        let currentPeriodEnd: string | null = null;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        }

        await syncProfileFromCustomer(customerId, 'active', currentPeriodEnd);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        let currentPeriodEnd: string | null = null;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        }

        await syncProfileFromCustomer(customerId, 'active', currentPeriodEnd);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        const status = subStatusToProfile(subscription.status);
        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        await syncProfileFromCustomer(customerId, status, currentPeriodEnd);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        await syncProfileFromCustomer(customerId, 'inactive', null);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}
