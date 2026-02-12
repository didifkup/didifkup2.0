/**
 * Shared VibeCheck result card: meters, confidence, explainer, Next Move, Deep Breakdown (Pro/locked).
 * Used by /vibecheck and landing page "See an example". Single source of truth for result UI.
 */
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { openPaymentLink } from '@/lib/paymentLink';
import { cn, cardPremium } from '@/lib/utils';
import type { VibecheckResponse } from '@/lib/vibecheck/types';

export interface VibeCheckResultCardProps {
  result: VibecheckResponse;
  isPro: boolean;
  overthinkingDisplay: number;
  messedUpDisplay: number;
  patternAvg?: number | null;
  showRequestId?: boolean;
  onUnlock?: () => void;
  /** When true, no motion/stagger (e.g. landing example). */
  static?: boolean;
}

function VibecheckVerdictBadge({
  rank,
  animate,
}: {
  rank: string;
  animate: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const config =
    rank === 'Low'
      ? { color: 'bg-green-500', icon: CheckCircle, text: 'LOW', shadow: 'shadow-green-500/50' }
      : rank === 'High'
        ? { color: 'bg-red-500', icon: AlertCircle, text: 'HIGH', shadow: 'shadow-red-500/50' }
        : { color: 'bg-orange-500', icon: AlertTriangle, text: 'MEDIUM', shadow: 'shadow-orange-500/50' };
  const Icon = config.icon;

  const className = cn(
    'relative text-white px-8 py-4 rounded-3xl flex items-center gap-3 shadow-2xl',
    config.color,
    config.shadow
  );

  if (!animate || reduceMotion) {
    return (
      <div className={className}>
        <div className="absolute inset-1 border-2 border-white/30 rounded-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl" />
        <Icon className="w-8 h-8 relative z-10" />
        <span className="relative z-10 text-2xl font-bold">{config.text}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: 1, rotate: [0, 5, -5, 0] }}
      transition={{ type: 'spring', duration: 0.8, bounce: 0.5 }}
      className={className}
    >
      <div className="absolute inset-1 border-2 border-white/30 rounded-3xl" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl" />
      <Icon className="w-8 h-8 relative z-10" />
      <span className="relative z-10 text-2xl font-bold">{config.text}</span>
    </motion.div>
  );
}

export function VibeCheckResultCard({
  result,
  isPro,
  overthinkingDisplay,
  messedUpDisplay,
  patternAvg = null,
  showRequestId = true,
  onUnlock,
  static: staticMode = false,
}: VibeCheckResultCardProps) {
  const dominantOverthinking = overthinkingDisplay >= messedUpDisplay;
  const handleUnlock = onUnlock ?? openPaymentLink;

  const Wrapper = staticMode ? 'div' : motion.div;
  const wrapperProps = staticMode
    ? {}
    : {
        initial: { opacity: 0, scale: 0.98 } as const,
        animate: { opacity: 1, scale: 1 } as const,
        transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
      };

  const meterCardClass = (dominant: boolean) =>
    cn(
      'rounded-2xl border-2 p-4 bg-white transition-all',
      dominant ? 'border-purple-300 shadow-md shadow-purple-500/20' : 'border-gray-200'
    );

  return (
    <Wrapper {...wrapperProps}>
      <Card className={cn(cardPremium, 'p-8 border-lime-300/80 shadow-xl bg-white')}>
        <div className="card-premium-shine absolute inset-0 rounded-3xl" />
        <div className="relative z-10 space-y-6">
          <p className="text-center text-sm text-purple-600 font-bold mb-4">
            Ok breathe — here&apos;s the real read:
          </p>
          <div className="flex justify-center mb-4">
            <VibecheckVerdictBadge rank={result.rank} animate={!staticMode} />
          </div>

          {/* Meter cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className={meterCardClass(dominantOverthinking)}>
              <p className="text-xs font-medium text-gray-500 mb-1">Overthinking</p>
              <p className="text-2xl font-bold text-gray-900">{overthinkingDisplay}%</p>
              <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-400 transition-[width] duration-500"
                  style={{ width: `${overthinkingDisplay}%` }}
                />
              </div>
            </div>
            <div className={meterCardClass(!dominantOverthinking)}>
              <p className="text-xs font-medium text-gray-500 mb-1">Messed up</p>
              <p className="text-2xl font-bold text-gray-900">{messedUpDisplay}%</p>
              <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-400 transition-[width] duration-500"
                  style={{ width: `${messedUpDisplay}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 font-medium">Score: {result.score}/100</p>

          <div className="mx-auto max-w-2xl text-center space-y-2">
            <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
              {result.oneLiner}
            </p>
            <p className="text-xs text-muted-foreground">Compared to 12,482 similar scenarios.</p>
          </div>

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
                    onClick={handleUnlock}
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

          {showRequestId && result.requestId && (
            <p className="text-xs text-muted-foreground text-center">
              Request ID: {result.requestId}
            </p>
          )}
        </div>
      </Card>
    </Wrapper>
  );
}
