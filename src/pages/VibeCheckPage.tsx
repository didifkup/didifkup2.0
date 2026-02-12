/**
 * VibeCheck V2 — isolated page. POST /api/vibecheck.
 * Dopamine + Pro-conversion: 1.2s analyzing suspense, staggered animations, dominant signal,
 * social proof, paywalled Deep Breakdown, pattern feedback. Reuses existing UI theme.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Users,
  Heart,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BackgroundFX } from '@/components/BackgroundFX';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { openPaymentLink } from '@/lib/paymentLink';
import { supabase } from '@/lib/supabaseClient';
import { cn, cardPremium } from '@/lib/utils';
import type { VibecheckInput, VibecheckResponse } from '@/lib/vibecheck/types';

const MAX_CHARS = 2000;
const ANALYZING_DELAY_MS = 1200;
const STAGGER_CARD = 0.1;
const STAGGER_COUNT = 0.25;
const STAGGER_BAR = 0.2;
const STAGGER_CONFIDENCE = 0.15;
const STAGGER_EXPLAINER = 0.2;

type Status = 'idle' | 'loading' | 'analyzing' | 'success' | 'error';

/** Derive metrics from API score (0–100). Higher score = less overthinking, more "messed up" signal. */
function deriveMetrics(score: number) {
  const overthinkingPct = Math.round(100 - score);
  const messedUpPct = Math.round(score);
  return { overthinkingPct, messedUpPct };
}

/** Count-up hook: animates from 0 to target once per resultKey. */
function useCountUp(target: number, enabled: boolean, delayMs: number, resultKey: string | undefined) {
  const [display, setDisplay] = useState(0);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !resultKey) return;
    if (lastKey.current === resultKey) return;
    lastKey.current = resultKey;
    setDisplay(0);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start - delayMs;
      if (elapsed < 0) {
        requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / 600);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const v = Math.round(eased * target);
      setDisplay(v);
      if (v < target) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [enabled, target, delayMs, resultKey]);
  return display;
}

function VibecheckVerdictBadge({ rank }: { rank: string }) {
  const reduceMotion = useReducedMotion();
  const config =
    rank === 'Low'
      ? { color: 'bg-green-500', icon: CheckCircle, text: 'LOW', shadow: 'shadow-green-500/50' }
      : rank === 'High'
        ? { color: 'bg-red-500', icon: AlertCircle, text: 'HIGH', shadow: 'shadow-red-500/50' }
        : { color: 'bg-orange-500', icon: AlertTriangle, text: 'MEDIUM', shadow: 'shadow-orange-500/50' };
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: 1, rotate: reduceMotion ? 0 : [0, 5, -5, 0] }}
      transition={{ type: 'spring', duration: 0.8, bounce: 0.5 }}
      className={cn(
        'relative text-white px-8 py-4 rounded-3xl flex items-center gap-3 shadow-2xl',
        config.color,
        config.shadow
      )}
    >
      <div className="absolute inset-1 border-2 border-white/30 rounded-3xl" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl" />
      <Icon className="w-8 h-8 relative z-10" />
      <span className="relative z-10 text-2xl font-bold">{config.text}</span>
    </motion.div>
  );
}

/** Animated dots for "Analyzing..." */
function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

export function VibeCheckPage() {
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { isPro } = useSubscriptionStatus();
  const [happened, setHappened] = useState('');
  const [youDid, setYouDid] = useState('');
  const [theyDid, setTheyDid] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<VibecheckResponse | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [patternAvg, setPatternAvg] = useState<number | null>(null);
  const [resultsRevealed, setResultsRevealed] = useState(false);

  const overthinkingPct = result ? deriveMetrics(result.score).overthinkingPct : 0;
  const messedUpPct = result ? deriveMetrics(result.score).messedUpPct : 0;
  const dominantOverthinking = overthinkingPct >= messedUpPct;

  const showMeters = status === 'success' && result && resultsRevealed;
  const countUpDelayMs = 400;
  const overthinkingDisplay = useCountUp(overthinkingPct, showMeters, countUpDelayMs, result?.requestId);
  const messedUpDisplay = useCountUp(messedUpPct, showMeters, countUpDelayMs, result?.requestId);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const accessToken = session?.access_token;
      if (cancelled || !accessToken) return;
      fetch('/api/vibecheck/pattern', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.avgOverthinking != null) setPatternAvg(data.avgOverthinking);
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setResultsRevealed(false);
    setStatus('loading');

    const payload: VibecheckInput = { happened, youDid, theyDid };
    let res: Response;
    try {
      res = await fetch('/api/vibecheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      setStatus('error');
      setError({ message: err instanceof Error ? err.message : 'Network error' });
      return;
    }

    const data = await res.json().catch(() => ({}));
    const requestId = data?.requestId ?? null;

    if (!res.ok) {
      setStatus('error');
      setError({
        message: data?.error?.message ?? `Request failed (${res.status})`,
        requestId: requestId ?? undefined,
      });
      return;
    }

    const vibeResult = data as VibecheckResponse;
    setResult(vibeResult);
    setStatus('analyzing');

    const timer = setTimeout(() => {
      setStatus('success');
      setResultsRevealed(true);

      const { overthinkingPct: op, messedUpPct: mp } = deriveMetrics(vibeResult.score);
      if (user?.id) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          const accessToken = session?.access_token;
          if (accessToken) {
            fetch('/api/vibecheck/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ overthinkingPct: op, messedUpPct: mp }),
            }).catch(() => {});
          }
        });
      }
    }, ANALYZING_DELAY_MS);

    return () => clearTimeout(timer);
  }

  return (
    <div className="min-h-screen transition-colors duration-500 py-8 relative bg-gradient-to-b from-amber-50 to-orange-50">
      <BackgroundFX />
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex justify-between items-center mb-8 relative">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-display text-3xl md:text-5xl text-gray-900">
                Run it through the vibe check.
              </h1>
              <p className="text-lg md:text-xl text-gray-700 font-medium leading-snug">
                What happened, what you did, what they did.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          <Card className={cn(cardPremium, 'p-8 bg-white')}>
            <div className="card-premium-shine absolute inset-0 rounded-3xl" />
            <div className="space-y-6 relative z-10">
              <div>
                <label className="flex items-center gap-2 text-base font-bold mb-3 text-gray-900">
                  <MessageSquare className="w-4 h-4 text-purple-500" />
                  What happened?
                </label>
                <motion.div whileFocus={{ scale: 1.01 }}>
                  <Textarea
                    value={happened}
                    onChange={(e) => setHappened(e.target.value)}
                    placeholder="e.g. I left them on read for 3 days and now they're being weird..."
                    maxLength={MAX_CHARS}
                    className="min-h-[100px] rounded-2xl border-2 text-base bg-gray-50 focus:bg-white transition-colors"
                  />
                </motion.div>
                <p className="text-xs text-gray-400 mt-1">{happened.length}/{MAX_CHARS}</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-base font-bold mb-3 text-gray-900">
                  <Users className="w-4 h-4 text-blue-500" />
                  What did you say or do?
                </label>
                <motion.div whileFocus={{ scale: 1.01 }}>
                  <Textarea
                    value={youDid}
                    onChange={(e) => setYouDid(e.target.value)}
                    placeholder="e.g. I sent 'sorry I've been busy' with no emoji"
                    maxLength={MAX_CHARS}
                    className="min-h-[100px] rounded-2xl border-2 text-base bg-gray-50 focus:bg-white transition-colors"
                  />
                </motion.div>
                <p className="text-xs text-gray-400 mt-1">{youDid.length}/{MAX_CHARS}</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-base font-bold mb-3 text-gray-900">
                  <Heart className="w-4 h-4 text-pink-500" />
                  What did they say or do?
                </label>
                <motion.div whileFocus={{ scale: 1.01 }}>
                  <Textarea
                    value={theyDid}
                    onChange={(e) => setTheyDid(e.target.value)}
                    placeholder="e.g. They just replied 'np' and nothing else"
                    maxLength={MAX_CHARS}
                    className="min-h-[100px] rounded-2xl border-2 text-base bg-gray-50 focus:bg-white transition-colors"
                  />
                </motion.div>
                <p className="text-xs text-gray-400 mt-1">{theyDid.length}/{MAX_CHARS}</p>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={status === 'loading'}
                  className={cn(
                    'btn-cta-primary w-full bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 py-6 text-xl',
                    status === 'loading' && 'ring-2 ring-lime-400 ring-offset-2 shadow-lg shadow-lime-500/30'
                  )}
                >
                  {status === 'loading' ? (
                    <motion.div
                      animate={reduceMotion ? {} : { rotate: 360 }}
                      transition={{ duration: 1, repeat: reduceMotion ? 0 : Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="w-6 h-6" />
                    </motion.div>
                  ) : (
                    <>
                      Run vibe check
                      <ArrowRight className="ml-2 w-6 h-6" />
                    </>
                  )}
                </Button>
              </motion.div>
              <p className="text-xs text-gray-400 text-center">
                {user ? (isPro ? 'Pro: full breakdown unlocked' : 'Sign in for pattern insights') : 'No sign-in required. Results on the right.'}
              </p>
            </div>
          </Card>

          <div className="flex flex-col gap-8">
            {status === 'error' && error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[600px]">
                <Card
                  className={cn(
                    cardPremium,
                    'p-8 border-red-200/80 shadow-xl bg-white min-h-[600px] flex flex-col items-center justify-center'
                  )}
                >
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10 text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
                    <p className="text-gray-600 mb-2">{error.message}</p>
                    {error.requestId && (
                      <p className="text-xs text-muted-foreground mb-6">Request ID: {error.requestId}</p>
                    )}
                    <Button
                      variant="outline"
                      className="rounded-2xl font-bold"
                      onClick={() => setError(null)}
                    >
                      Try again
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {status === 'analyzing' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[600px]">
                <Card className={cn(cardPremium, 'p-8 border-lime-300/80 shadow-xl bg-white min-h-[600px] flex flex-col items-center justify-center')}>
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10 text-center">
                    <p className="text-sm text-purple-600 font-bold">
                      Analyzing Emotional Risk…
                      <AnimatedDots />
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}

            {status === 'success' && result && resultsRevealed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <Card className={cn(cardPremium, 'p-8 border-lime-300/80 shadow-xl bg-white')}>
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10 space-y-6">
                    <p className="text-center text-sm text-purple-600 font-bold mb-4">
                      Ok breathe — here&apos;s the real read:
                    </p>
                    <div className="flex justify-center mb-4">
                      <VibecheckVerdictBadge rank={result.rank} />
                    </div>

                    {/* Meter cards — stagger in */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: STAGGER_CARD, duration: 0.3 }}
                      className="grid grid-cols-2 gap-4"
                    >
                      <motion.div
                        className={cn(
                          'rounded-2xl border-2 p-4 bg-white transition-all',
                          dominantOverthinking
                            ? 'border-purple-300 shadow-md shadow-purple-500/20'
                            : 'border-gray-200'
                        )}
                        initial={reduceMotion ? false : { boxShadow: '0 0 0 0 rgba(168, 85, 247, 0)' }}
                        animate={
                          reduceMotion
                            ? {}
                            : dominantOverthinking
                              ? { boxShadow: ['0 0 0 0 rgba(168, 85, 247, 0)', '0 0 0 6px rgba(168, 85, 247, 0.15)', '0 0 0 0 rgba(168, 85, 247, 0)'] }
                              : {}
                        }
                        transition={{ duration: 0.8, repeat: 0 }}
                      >
                        <p className="text-xs font-medium text-gray-500 mb-1">Overthinking</p>
                        <p className="text-2xl font-bold text-gray-900">{overthinkingDisplay}%</p>
                        <motion.div
                          className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: STAGGER_CARD + STAGGER_BAR, duration: 0.5, origin: 'left' }}
                        >
                          <div
                            className="h-full rounded-full bg-purple-400 transition-[width] duration-500"
                            style={{ width: `${overthinkingDisplay}%` }}
                          />
                        </motion.div>
                      </motion.div>
                      <motion.div
                        className={cn(
                          'rounded-2xl border-2 p-4 bg-white transition-all',
                          !dominantOverthinking
                            ? 'border-orange-300 shadow-md shadow-orange-500/20'
                            : 'border-gray-200'
                        )}
                        initial={reduceMotion ? false : { boxShadow: '0 0 0 0 rgba(249, 115, 22, 0)' }}
                        animate={
                          reduceMotion
                            ? {}
                            : !dominantOverthinking
                              ? { boxShadow: ['0 0 0 0 rgba(249, 115, 22, 0)', '0 0 0 6px rgba(249, 115, 22, 0.15)', '0 0 0 0 rgba(249, 115, 22, 0)'] }
                              : {}
                        }
                        transition={{ duration: 0.8, repeat: 0 }}
                      >
                        <p className="text-xs font-medium text-gray-500 mb-1">Messed up</p>
                        <p className="text-2xl font-bold text-gray-900">{messedUpDisplay}%</p>
                        <motion.div
                          className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: STAGGER_CARD + STAGGER_BAR + 0.05, duration: 0.5, origin: 'left' }}
                        >
                          <div
                            className="h-full rounded-full bg-orange-400 transition-[width] duration-500"
                            style={{ width: `${messedUpDisplay}%` }}
                          />
                        </motion.div>
                      </motion.div>
                    </motion.div>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: STAGGER_CARD + STAGGER_CONFIDENCE }}
                      className="text-center text-xs text-gray-500 font-medium"
                    >
                      Score: {result.score}/100
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: STAGGER_CARD + STAGGER_EXPLAINER }}
                      className="mx-auto max-w-2xl text-center space-y-2"
                    >
                      <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
                        {result.oneLiner}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Compared to 12,482 similar scenarios.
                      </p>
                    </motion.div>

                    <div className="bg-lime-100 rounded-2xl p-6">
                      <h4 className="font-bold text-xl mb-2 text-gray-900">Next Move:</h4>
                      <p className="text-lg text-gray-800">{result.nextMove}</p>
                    </div>

                    {/* Deep Breakdown — Pro full, Free blurred + CTA */}
                    <div className="rounded-2xl border-2 border-gray-200 overflow-hidden relative">
                      <h4 className="font-bold text-lg text-gray-900 p-4 pb-2">Deep Breakdown</h4>
                      {isPro ? (
                        <div className="p-4 pt-0 space-y-3 text-gray-700">
                          <p><span className="font-medium">Pattern breakdown:</span> {result.validation}</p>
                          <p><span className="font-medium">Reality check:</span> {result.realityCheck}</p>
                          <p><span className="font-medium">What to say next:</span> {result.nextMove}</p>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 pt-0 space-y-3 text-gray-500 blur-sm select-none pointer-events-none">
                            <p>Pattern breakdown — your situation in context…</p>
                            <p>What to say next (exact text) — suggested reply…</p>
                            <p>Risk if you double text — when to wait…</p>
                          </div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px]">
                            <Lock className="w-10 h-10 text-gray-400 mb-3" />
                            <p className="text-sm font-medium text-gray-700 mb-3">Unlock Pro for the full breakdown</p>
                            <Button
                              className="bg-lime-500 hover:bg-lime-600 text-white rounded-2xl font-bold px-6"
                              onClick={() => openPaymentLink()}
                            >
                              Unlock Pro ($12/mo)
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {patternAvg != null && (
                      <p className="text-sm text-muted-foreground">
                        Your pattern: you overthink ~{patternAvg}% of situations.
                      </p>
                    )}

                    {result.requestId && (
                      <p className="text-xs text-muted-foreground text-center">
                        Request ID: {result.requestId}
                      </p>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {status === 'loading' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[600px]">
                <Card className={cn(cardPremium, 'p-8 border-lime-300/80 shadow-xl bg-white min-h-[600px]')}>
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10 space-y-6">
                    <p className="text-center text-sm text-purple-600 font-bold mb-6">Analyzing…</p>
                    <div className="h-10 w-32 mx-auto rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="h-6 w-full max-w-md mx-auto rounded bg-gray-100 animate-pulse" />
                    <div className="h-6 w-[75%] mx-auto rounded bg-gray-100 animate-pulse" />
                    <div className="space-y-3 mt-8">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-16 rounded-2xl bg-gray-100 animate-pulse"
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                    <div className="h-24 rounded-2xl bg-gray-100 animate-pulse mt-6" />
                  </div>
                </Card>
              </motion.div>
            )}

            {status === 'idle' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Card
                  className={cn(
                    cardPremium,
                    'p-12 border-dashed border-gray-300/80 bg-white/60 flex flex-col items-center justify-center min-h-[600px]'
                  )}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-purple-100/20 to-pink-100/20"
                    animate={
                      reduceMotion ? { opacity: 0.4 } : { opacity: [0.3, 0.5, 0.3] }
                    }
                    transition={reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity }}
                  />
                  <motion.div
                    animate={reduceMotion ? {} : { y: [0, -10, 0] }}
                    transition={
                      reduceMotion ? { duration: 0 } : { duration: 2, repeat: Infinity }
                    }
                    className="relative z-10"
                  >
                    <MessageSquare className="w-24 h-24 text-gray-300 mb-4" />
                  </motion.div>
                  <p className="text-xl text-gray-500 text-center relative z-10">
                    Your analysis will appear here
                  </p>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
