import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} from './_lib/env';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-04.28.basil' });

/** Read raw body for Stripe signature verification (do not parse body). */
function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Map Stripe subscription status to pro_status. */
function mapProStatus(status: Stripe.Subscription['status']): string {
  if (status === 'active' || status === 'trialing') return 'pro';
  if (status === 'past_due') return 'past_due';
  return 'free';
}

/** Get customer email from various event sources. */
async function getCustomerEmail(
  event: Stripe.Event
): Promise<string | null> {
  const obj = event.data.object as Record<string, unknown>;

  // checkout.session.completed: session.customer_details.email
  const customerDetails = obj.customer_details as { email?: string } | undefined;
  if (customerDetails?.email?.trim()) return customerDetails.email.trim();

  // invoice: customer_email
  const invoiceEmail = obj.customer_email as string | undefined;
  if (invoiceEmail?.trim()) return invoiceEmail.trim();

  // subscription: fetch customer
  const customerId = typeof obj.customer === 'string' ? obj.customer : (obj.customer as { id?: string })?.id;
  if (!customerId) return null;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    const email = (customer as Stripe.Customer).email?.trim();
    return email || null;
  } catch (err) {
    console.error('[stripe-webhook] getCustomerEmail error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Update profiles by email using Supabase Admin (service role). */
async function updateProfileByEmail(
  customerEmail: string,
  updates: {
    pro_status: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string | null;
    pro_current_period_end?: string | null;
  }
): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const row: Record<string, unknown> = {
    pro_status: updates.pro_status,
    stripe_subscription_id: updates.stripe_subscription_id ?? null,
    pro_current_period_end: updates.pro_current_period_end ?? null,
    subscription_status: updates.pro_status === 'pro' ? 'active' : updates.pro_status === 'past_due' ? 'past_due' : 'inactive',
    current_period_end: updates.pro_current_period_end ?? null,
  };
  if (updates.stripe_customer_id) row.stripe_customer_id = updates.stripe_customer_id;
  row.email = customerEmail.trim();

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', customerEmail.trim())
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from('profiles').update(row).eq('id', existing.id);
    if (error) console.error('[stripe-webhook] update error:', error.message);
    return;
  }

  if (updates.stripe_customer_id) {
    const { data: byCustomer } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', updates.stripe_customer_id)
      .maybeSingle();
    if (byCustomer?.id) {
      const { error } = await supabase.from('profiles').update(row).eq('id', byCustomer.id);
      if (error) console.error('[stripe-webhook] update by customer error:', error.message);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    return res.status(400).json({ error: 'Missing Stripe-Signature' });
  }

  let rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[stripe-webhook] raw body error:', err instanceof Error ? err.message : String(err));
    return res.status(400).json({ error: 'Invalid body' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[stripe-webhook] signature verification failed:', msg);
    return res.status(400).json({ error: `Webhook signature verification failed: ${msg}` });
  }

  try {
    const customerEmail = await getCustomerEmail(event);
    if (!customerEmail) {
      console.warn('[stripe-webhook] no customer email for event', event.type);
      return res.status(200).json({ received: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        let proCurrentPeriodEnd: string | null = null;
        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            proCurrentPeriodEnd = sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null;
          } catch (e) {
            console.warn('[stripe-webhook] subscription retrieve error:', e instanceof Error ? e.message : e);
          }
        }

        await updateProfileByEmail(customerEmail, {
          pro_status: 'pro',
          stripe_customer_id: customerId ?? undefined,
          stripe_subscription_id: subId ?? null,
          pro_current_period_end: proCurrentPeriodEnd,
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

        let proCurrentPeriodEnd: string | null = null;
        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            proCurrentPeriodEnd = sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null;
          } catch (e) {
            console.warn('[stripe-webhook] subscription retrieve error:', e instanceof Error ? e.message : e);
          }
        }

        await updateProfileByEmail(customerEmail, {
          pro_status: 'pro',
          stripe_customer_id: customerId ?? undefined,
          stripe_subscription_id: subId ?? null,
          pro_current_period_end: proCurrentPeriodEnd,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
        const proStatus = mapProStatus(subscription.status);
        const proCurrentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        await updateProfileByEmail(customerEmail, {
          pro_status: proStatus,
          stripe_customer_id: customerId ?? undefined,
          stripe_subscription_id: subscription.id ?? null,
          pro_current_period_end: proCurrentPeriodEnd,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

        await updateProfileByEmail(customerEmail, {
          pro_status: 'free',
          stripe_customer_id: customerId ?? undefined,
          stripe_subscription_id: subscription.id ?? null,
          pro_current_period_end: null,
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}
