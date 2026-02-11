import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getStripeEnv } from '../_lib/env.js';

const stripeEnv = getStripeEnv();
const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY, {
  apiVersion: "2025-04.28.basil" as any, // keeps runtime EXACTLY the same
});

function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function mapSubscriptionStatus(status: Stripe.Subscription['status']): 'active' | 'past_due' | 'inactive' {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  return 'inactive';
}

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

async function findProfileId(supabase: any, email: string): Promise<string | null> {
  const profiles = supabase.from('profiles') as any;
  const { data } = await profiles.select('id').eq('email', email.trim()).maybeSingle();
  return data?.id ?? null;
}

async function findProfileIdByCustomerId(supabase: any, customerId: string): Promise<string | null> {
  const profiles = supabase.from('profiles') as any;
  const { data } = await profiles.select('id').eq('stripe_customer_id', customerId).maybeSingle();
  return data?.id ?? null;
}

/** Update profile by id — writes ONLY the canonical subscription fields */
async function updateProfile(
  supabase: any,
  profileId: string,
  updates: {
    subscription_status: 'active' | 'past_due' | 'inactive';
    current_period_end: string | null;
    stripe_customer_id: string;
    stripe_subscription_id: string | null;
  }
): Promise<void> {
  const profiles = supabase.from('profiles') as any;
  await profiles.upsert(
    {
      id: profileId,
      subscription_status: updates.subscription_status,
      current_period_end: updates.current_period_end,
      stripe_customer_id: updates.stripe_customer_id,
      stripe_subscription_id: updates.stripe_subscription_id,
    },
    { onConflict: 'id' }
  );
}

async function resolveProfileId(
  supabase: any,
  customerId: string,
  metadataUserId?: string | null
): Promise<string | null> {
  if (metadataUserId?.trim()) return metadataUserId.trim();
  const email = await getCustomerEmail(customerId);
  if (email) {
    const byEmail = await findProfileId(supabase, email);
    if (byEmail) return byEmail;
  }
  return findProfileIdByCustomerId(supabase, customerId);
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
    event = stripe.webhooks.constructEvent(rawBody, sig, stripeEnv.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[webhook] signature verification failed:', message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
  }

  const supabase: any = createClient(stripeEnv.SUPABASE_URL, stripeEnv.SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (!customerId) break;

        const metadataUserId = (session.metadata as { user_id?: string } | null)?.user_id ?? null;
        const profileId = await resolveProfileId(supabase, customerId, metadataUserId);
        if (!profileId) break;

        let currentPeriodEnd: string | null = null;
        let stripeSubscriptionId: string | null = null;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subId) {
          stripeSubscriptionId = subId;
          const sub = await stripe.subscriptions.retrieve(subId);
          const cpe = (sub as any).current_period_end as number | undefined;
          currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
        }

        await updateProfile(supabase, profileId, {
          subscription_status: 'active',
          current_period_end: currentPeriodEnd,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscriptionId,
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const profileId = await resolveProfileId(supabase, customerId);
        if (!profileId) break;

        let currentPeriodEnd: string | null = null;
        let stripeSubscriptionId: string | null = null;
        const invSub = (invoice as any).subscription;
        const subId = typeof invSub === 'string' ? invSub : invSub?.id;
        if (subId) {
          stripeSubscriptionId = subId;
          const sub = await stripe.subscriptions.retrieve(subId);
          const cpe = (sub as any).current_period_end as number | undefined;
          currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
        }

        await updateProfile(supabase, profileId, {
          subscription_status: 'active',
          current_period_end: currentPeriodEnd,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscriptionId,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        const metadataUserId = (subscription.metadata as { user_id?: string } | null)?.user_id ?? null;
        const profileId = await resolveProfileId(supabase, customerId, metadataUserId);
        if (!profileId) break;

        const status = mapSubscriptionStatus(subscription.status);
        const cpe = (subscription as any).current_period_end as number | undefined;
        const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

        await updateProfile(supabase, profileId, {
          subscription_status: status,
          current_period_end: currentPeriodEnd,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id ?? null,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;

        const metadataUserId = (subscription.metadata as { user_id?: string } | null)?.user_id ?? null;
        const profileId = await resolveProfileId(supabase, customerId, metadataUserId);
        if (!profileId) break;

        await updateProfile(supabase, profileId, {
          subscription_status: 'inactive',
          current_period_end: null,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id ?? null,
        });
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
