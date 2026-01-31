# DidIFkUp — Launch Checklist

Pre-launch checklist for deploying DidIFkUp to production.

---

## 1. Supabase

### Auth provider setup

1. Go to **Authentication → Providers** in Supabase Dashboard.
2. Ensure **Email** is enabled (default).
3. Magic link (OTP) is the sign-in method — no password required.
4. Optionally configure **Email templates** (magic link email) under Authentication → Email Templates.

### Redirect URLs

1. Go to **Authentication → URL Configuration**.
2. Add **Site URL**: `https://your-domain.com` (or Vercel preview URL).
3. Add **Redirect URLs** (one per line):
   - `https://your-domain.com/app`
   - `https://your-domain.com/**`
   - `http://localhost:5173/app` (for local dev)
   - `http://localhost:5173/**`

The app uses `emailRedirectTo: /app` after magic link sign-in.

### RLS verification

1. Go to **Table Editor** and confirm these tables exist:
   - `profiles` — user prefs, onboarding
   - `analyses` — analysis history
   - `subscriptions` — Stripe state (user can SELECT only)
   - `usage_daily` — daily check counts (user can SELECT only)

2. Verify RLS policies:
   - **profiles**: `profiles_select_own`, `profiles_update_own` — authenticated users can read/update own row.
   - **analyses**: `analyses_select_own`, `analyses_insert_own`, `analyses_update_own`, `analyses_delete_own`.
   - **subscriptions**: `subscriptions_select_own` — users read own; service role writes.
   - **usage_daily**: `usage_daily_select_own` — users read own; service role writes.

3. In **SQL Editor**, run a quick check (as authenticated user):

   ```sql
   SELECT * FROM profiles LIMIT 1;
   SELECT * FROM subscriptions LIMIT 1;
   ```

   Ensure no unexpected policy errors.

---

## 2. Running migrations

### Option A: Supabase Dashboard (recommended for first run)

1. **Supabase Dashboard → SQL Editor → New query**.
2. If tables already exist, run `supabase/migrations/0000_reset.sql` first (drops tables, function, trigger, policies).
3. Run `supabase/migrations/0001_init.sql` (creates tables, trigger, RLS).

### Option B: Supabase CLI

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or:

```bash
supabase migration up
```

### Schema summary

- **profiles**: id, email, display_name, onboarding_completed, prefs (jsonb)
- **analyses**: id, user_id, created_at, input, output, model
- **subscriptions**: user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, price_id
- **usage_daily**: user_id, day, checks_used

---

## 3. Stripe

### Product & price creation

1. Go to **Stripe Dashboard → Products**.
2. Create product: **DidIFkUp Pro** (or similar).
3. Add price:
   - **Recurring** — Monthly
   - Amount: **$12** (or desired)
   - Copy the **Price ID** (e.g. `price_1Abc123...`).
4. Set `STRIPE_PRICE_PRO_MONTHLY` in Vercel to this Price ID.

### Webhook setup

1. Go to **Stripe Dashboard → Developers → Webhooks**.
2. **Add endpoint**.
3. **Endpoint URL**: `https://your-domain.com/api/stripe/webhook`
4. **Description**: e.g. `DidIFkUp subscriptions`.
5. **Events to send** — select:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
6. Create endpoint and **Reveal** signing secret.
7. Set `STRIPE_WEBHOOK_SECRET` in Vercel (starts with `whsec_`).

### Local webhook testing

```bash
stripe listen --forward-to localhost:5173/api/stripe/webhook
```

Use the printed webhook signing secret for local `.env` / `STRIPE_WEBHOOK_SECRET`.

---

## 4. Vercel

### Environment variables

Set in **Vercel → Project → Settings → Environment Variables** (apply to Production, Preview, Development as needed):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_URL` | Yes | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server only) |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (sk_live_ or sk_test_) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret (whsec_...) |
| `STRIPE_PRICE_PRO_MONTHLY` | Yes | Stripe Price ID for Pro monthly |

### Deployment steps

1. Connect repo to Vercel (GitHub/GitLab/Bitbucket).
2. **Framework Preset**: Vite (auto-detected).
3. **Build Command**: `npm run build` (default).
4. **Output Directory**: `dist` (default).
5. **Install Command**: `npm install` (default).
6. Add all environment variables above.
7. Deploy (push to main or trigger manually).
8. Ensure custom domain is configured if using one.

### Post-deploy

1. Update Supabase redirect URLs to include production domain.
2. Update Stripe webhook endpoint URL to production domain.
3. Redeploy if env vars were added after first deploy.

---

## 5. Smoke test plan

Run through this flow to validate end-to-end.

### 1) Sign in

1. Open app (production or preview URL).
2. Click **Sign In**.
3. Enter email, request magic link.
4. Check email, click link.
5. **Expected**: Redirect to `/app`.

### 2) Onboarding

1. If first-time user, should redirect to `/onboarding`.
2. Complete screens: use case, tone, spiral mode default.
3. Click **Get started**.
4. **Expected**: Redirect to `/app`, onboarding complete.

### 3) Analyze twice → paywall

1. Run analysis (fill form, click Analyze). **Expected**: Verdict appears.
2. Run analysis again. **Expected**: Second verdict, checks show `0/2`.
3. Try third analysis (or click Analyze again). **Expected**: Paywall modal opens.

### 4) Checkout → Pro

1. In paywall, click **Go Pro — $12/month**.
2. **Expected**: Redirect to Stripe Checkout.
3. Use Stripe test card: `4242 4242 4242 4242`.
4. Complete checkout.
5. **Expected**: Redirect to `/app?upgrade=success`, success toast, checks show **Unlimited**.

### 5) Analyze unlimited

1. Run several analyses.
2. **Expected**: No paywall; checks stay **Unlimited**.

### 6) Webhook updates subscriptions

1. In Stripe Dashboard → Webhooks → select endpoint.
2. Check **Event deliveries** — recent events should be **Delivered** (200).
3. In Supabase → **Table Editor → subscriptions**, find your user row.
4. **Expected**: `status = active`, `stripe_subscription_id` populated, `stripe_customer_id` set.

---

## Quick reference

- **Supabase**: [dashboard.supabase.com](https://dashboard.supabase.com)
- **Stripe**: [dashboard.stripe.com](https://dashboard.stripe.com)
- **Vercel**: [vercel.com/dashboard](https://vercel.com/dashboard)
