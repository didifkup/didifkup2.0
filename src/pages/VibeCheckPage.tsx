/**
 * VibeCheck V2 — isolated page. POST /api/vibecheck.
 * Dopamine + Pro-conversion: 1.2s analyzing suspense, staggered animations, dominant signal,
 * social proof, paywalled Deep Breakdown, pattern feedback. Reuses existing UI theme.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  MessageSquare,
  Users,
  Heart,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BackgroundFX } from '@/components/BackgroundFX';
import { VibeCheckResultCard } from '@/components/VibeCheckResultCard';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { openPaymentLink } from '@/lib/paymentLink';
import { supabase } from '@/lib/supabaseClient';
import { cn, cardPremium } from '@/lib/utils';
import type { VibecheckInput, VibecheckResponse } from '@/lib/vibecheck/types';

const MAX_CHARS = 2000;
const ANALYZING_DELAY_MS = 1200;
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

  const showMeters = !!(status === 'success' && result && resultsRevealed);
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
              <VibeCheckResultCard
                result={result}
                isPro={isPro}
                overthinkingDisplay={overthinkingDisplay}
                messedUpDisplay={messedUpDisplay}
                patternAvg={patternAvg}
                showRequestId={true}
                static={false}
              />
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
