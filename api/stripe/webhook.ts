import Stripe from 'stripe';
import { env } from '../_lib/env';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const;

async function resolveUserId(
  stripe: Stripe,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();
  if (data?.user_id) return data.user_id as string;
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  if (customer.deleted) return null;
  const uid = (customer as Stripe.Customer).metadata?.supabase_user_id;
  return typeof uid === 'string' ? uid : null;
}

async function upsertSubscription(row: {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  price_id: string | null;
}) {
  await supabaseAdmin.from('subscriptions').upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  if (!customerId || !subscriptionId) return;
  const userId = await resolveUserId(stripe, customerId);
  if (!userId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = sub.items.data[0]?.price?.id ?? null;
  await upsertSubscription({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: sub.status,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    price_id: priceId,
  });
}

async function handleSubscriptionEvent(
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;
  const userId = await resolveUserId(stripe, customerId);
  if (!userId) return;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  await upsertSubscription({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    price_id: priceId,
  });
}

async function handleInvoicePaymentFailed(
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!customerId) return;
  const userId = await resolveUserId(stripe, customerId);
  if (!userId) return;
  let status = 'past_due';
  let stripeSubId: string | null = null;
  let currentPeriodEnd: string | null = null;
  let priceId: string | null = null;
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    stripeSubId = sub.id;
    status = sub.status;
    currentPeriodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;
    priceId = sub.items.data[0]?.price?.id ?? null;
  }
  await upsertSubscription({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubId,
    status,
    current_period_end: currentPeriodEnd,
    price_id: priceId,
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return new Response(JSON.stringify({ error: 'Missing signature' }), {
      status: 400,
    });
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.stripeWebhookSecret
    );
  } catch (err) {
    console.warn('[webhook] Signature verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
    });
  }

  if (!EVENTS.includes(event.type as (typeof EVENTS)[number])) {
    return new Response(null, { status: 200 });
  }

  const stripe = new Stripe(env.stripeSecretKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          stripe,
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(
          stripe,
          event.data.object as Stripe.Subscription
        );
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripe, event.data.object as Stripe.Invoice);
        break;
    }
  } catch (err) {
    console.error('[webhook]', event.type, (err as Error).message);
    return new Response(JSON.stringify({ error: 'Processing failed' }), {
      status: 500,
    });
  }

  return new Response(null, { status: 200 });
}
