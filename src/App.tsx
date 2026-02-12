import React, { useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Copy,
  Download,
  Share2,
  Sparkles,
  MessageSquare,
  ArrowRight,
  Check,
  Menu,
  X,
  Zap,
  Heart,
  Brain,
  Users,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { BackgroundFX } from '@/components/BackgroundFX';
import { CopyToast } from '@/components/CopyToast';
import { DidIFkUpMascot } from '@/components/mascot/DidIFkUpMascot';
import { StickersPage } from '@/pages/Stickers';
import { PricingPage } from '@/pages/PricingPage';
import { SignInPage } from '@/pages/SignInPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { UpgradeSuccessPage } from '@/pages/UpgradeSuccessPage';
import { UpgradeCancelPage } from '@/pages/UpgradeCancelPage';
import { AccountPage } from '@/pages/AccountPage';
import { VibeCheckPage } from '@/pages/VibeCheckPage';
import { VibeCheckResultCard } from '@/components/VibeCheckResultCard';
import type { VibecheckResponse } from '@/lib/vibecheck/types';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { openPaymentLink } from '@/lib/paymentLink';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { analyzeSituation } from '@/lib/analyzeApi';
import { LimitError, CooldownError } from '@/lib/analyzeTypes';
import { adaptAnalysisResult, type AdaptedAnalysis } from '@/lib/analyzeAdapter';
import { OffRamp, type OffRampData } from '@/components/OffRamp';
import { shouldShowOffRampToday, setLastShownDate, setSkipOffRamp, getTodayKey } from '@/lib/offrampStorage';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { cn, cardPremium } from '@/lib/utils';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
type Tone = 'nice' | 'real' | 'savage';


/** Legacy shape for demo/example/ShareCard — verdict, summary, reasons, nextMove, followUpTexts */
interface AnalysisResult {
  verdict: RiskLevel;
  summary: string;
  reasons: string[];
  nextMove: string;
  followUpTexts: { soft: string; neutral: string; firm: string };
}

function adaptedToLegacy(a: AdaptedAnalysis): AnalysisResult {
  return {
    verdict: a.verdict,
    summary: a.stabilization ?? a.summary,
    reasons: a.reasons,
    nextMove: a.nextMove,
    followUpTexts: a.followUpTabs,
  };
}

/** Form tone (nice/real/savage) → API tone (soft/neutral/firm) */
function formToneToApi(tone: Tone): 'soft' | 'neutral' | 'firm' {
  return tone === 'nice' ? 'soft' : tone === 'savage' ? 'firm' : 'neutral';
}

const VerdictBadge: React.FC<{ level: RiskLevel; showConfetti?: boolean }> = ({ level, showConfetti = false }) => {
  const config = {
    LOW: { color: 'bg-green-500', icon: CheckCircle, text: 'LOW RISK', shadow: 'shadow-green-500/50' },
    MEDIUM: { color: 'bg-orange-500', icon: AlertTriangle, text: 'MEDIUM RISK', shadow: 'shadow-orange-500/50' },
    HIGH: { color: 'bg-red-500', icon: AlertCircle, text: 'HIGH RISK', shadow: 'shadow-red-500/50' }
  };

  const { color, icon: Icon, text, shadow } = config[level];

  return (
    <div className="relative">
      {showConfetti && (
        <>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2 w-2 h-2 bg-lime-400 rounded-full"
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: Math.cos(i * 45 * Math.PI / 180) * 60,
                y: Math.sin(i * 45 * Math.PI / 180) * 60,
                opacity: [1, 1, 0]
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: [0, 5, -5, 0] }}
        transition={{ type: 'spring', duration: 0.8, bounce: 0.5 }}
        className={`relative ${color} text-white px-8 py-4 rounded-3xl flex items-center gap-3 shadow-2xl ${shadow} text-2xl font-bold`}
      >
        <div className="absolute inset-1 border-2 border-white/30 rounded-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl" />
        <Icon className="w-8 h-8 relative z-10" />
        <span className="relative z-10">{text}</span>
      </motion.div>
    </div>
  );
};

function confidenceToLevel(n: number): RiskLevel {
  if (n <= 0.5) return 'LOW';
  if (n <= 0.8) return 'MEDIUM';
  return 'HIGH';
}

const ConfidenceMeter: React.FC<{ level?: RiskLevel; confidenceNumber?: number }> = ({ level, confidenceNumber }) => {
  const reduceMotion = useReducedMotion();
  const activeLevel = level ?? (confidenceNumber != null ? confidenceToLevel(confidenceNumber) : 'MEDIUM');
  const segments = [
    { label: 'LOW', active: activeLevel === 'LOW', color: 'bg-green-500' },
    { label: 'MED', active: activeLevel === 'MEDIUM', color: 'bg-orange-500' },
    { label: 'HIGH', active: activeLevel === 'HIGH', color: 'bg-red-500' },
  ];

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <p className="text-xs text-gray-500 font-medium">How bad is it really?</p>
      <div className="flex gap-2">
        {segments.map((seg, i) => (
          <motion.div
            key={seg.label}
            className={`h-2 rounded-full ${seg.active ? seg.color : 'bg-gray-200'}`}
            initial={{ width: 0 }}
            animate={{ width: 40 }}
            transition={{ delay: reduceMotion ? 0 : i * 0.1, duration: reduceMotion ? 0 : 0.3 }}
          >
            {seg.active && (
              <motion.div
                className="h-full w-full rounded-full bg-white/40"
                animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.4, 0.8, 0.4] }}
                transition={reduceMotion ? { duration: 0 } : { duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const CommentBubble: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{
      y: -4,
      rotate: [0, -1, 1, -1, 0],
      transition: { rotate: { duration: 0.5 } }
    }}
    className="relative bg-white border-2 border-purple-300 rounded-2xl px-6 py-3 shadow-md hover:shadow-xl transition-shadow cursor-pointer"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent rounded-2xl pointer-events-none" />
    <p className="text-gray-800 font-medium relative z-10">{text}</p>
  </motion.div>
);

const HeroDemoWidget: React.FC = () => {
  const [showResult, setShowResult] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const demoScenario = "I accidentally liked my crush's Instagram from 3 years ago at 2am 😭";
  const demoResult: AnalysisResult = {
    verdict: 'MEDIUM',
    summary: "Awkward? Yes. The end of the world? No.",
    reasons: [
      "It happens to literally everyone",
      "They probably won't even notice the timestamp",
      "You can play it off if they mention it"
    ],
    nextMove: "Do nothing unless they bring it up",
    followUpTexts: {
      soft: "Haha busted — I fell down an IG rabbit hole 😅",
      neutral: "Lol yeah I was scrolling way back",
      firm: "Yeah I was looking at your old posts, sue me"
    }
  };

  const handleRun = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowResult(true);
      setIsAnimating(false);
    }, 1500);
  };

  const handleReset = () => {
    setShowResult(false);
  };

  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="max-w-2xl mx-auto mb-12 content-max-width mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className={cardPremium}>
        <div className="card-premium-shine absolute inset-0 rounded-3xl" />
        <div className="p-6 relative z-10">
          {!showResult ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 bg-purple-50 rounded-2xl rounded-tl-sm p-4 border border-purple-200">
                  <p className="text-gray-800 font-medium">{demoScenario}</p>
                </div>
              </div>
              <motion.div className="flex justify-center relative">
                <Button
                  onClick={handleRun}
                  disabled={isAnimating}
                  className={`btn-cta-primary bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 text-xl px-8 py-6 group ${isAnimating ? 'ring-2 ring-lime-400 ring-offset-2 shadow-lg shadow-lime-500/30' : ''}`}
                >
                  {isAnimating ? (
                    <motion.div
                      animate={reduceMotion ? {} : { rotate: 360 }}
                      transition={{ duration: 1, repeat: reduceMotion ? 0 : Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                      Run the vibe check
                    </>
                  )}
                </Button>
              </motion.div>
              <motion.div
                className="text-center mt-3 flex items-center justify-center gap-2"
                animate={reduceMotion ? {} : { x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: reduceMotion ? 0 : Infinity }}
              >
                <span className="text-sm text-purple-600 font-medium">Try me</span>
                <ArrowRight className="w-4 h-4 text-purple-600" />
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div className="flex justify-center mb-4">
                <VerdictBadge level={demoResult.verdict} showConfetti={true} />
              </div>
              <ConfidenceMeter level={demoResult.verdict} />
              <div className="mx-auto max-w-2xl text-center mt-6 mb-4 space-y-3">
                <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
                  {demoResult.summary}
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                  One grounded read: it happens to everyone. They may not even notice the timestamp.
                </p>
              </div>
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full rounded-2xl font-bold"
              >
                Try again
              </Button>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

const MEME_HEADLINES: Record<RiskLevel, string> = {
  LOW: "YOU'RE GOOD 😮‍💨",
  MEDIUM: 'OK… AWKWARD 😬',
  HIGH: "CHAT… IT'S BAD 💀",
};

function verdictToMascotMood(verdict: RiskLevel): 'low' | 'medium' | 'high' {
  return verdict.toLowerCase() as 'low' | 'medium' | 'high';
}

/** Build SVG string of share card for download (PNG or SVG fallback). */
function buildShareCardSvg(result: AnalysisResult, width: number, height: number): string {
  const headline = MEME_HEADLINES[result.verdict];
  const fill =
    result.verdict === 'LOW' ? '#22c55e' : result.verdict === 'MEDIUM' ? '#f97316' : '#ef4444';
  const pad = 24;
  const w = width - pad * 2;
  const titleY = 56;
  const mascotR = 28;
  const mascotCx = width / 2;
  const mascotCy = titleY + 20 + mascotR;
  const headlineY = mascotCy + mascotR + 22;
  const badgeY = headlineY + 36;
  const summaryY = badgeY + 44;
  const watermarkY = height - 32;

  // Simple mascot circle + face by mood
  const eyeY = mascotCy - 6;
  const eyeOffset = 10;
  const mouthPath =
    result.verdict === 'LOW'
      ? `M ${mascotCx - 14} ${mascotCy + 8} Q ${mascotCx} ${mascotCy + 2} ${mascotCx + 14} ${mascotCy + 8}`
      : result.verdict === 'HIGH'
        ? `M ${mascotCx - 12} ${mascotCy + 4} Q ${mascotCx} ${mascotCy + 14} ${mascotCx + 12} ${mascotCy + 4}`
        : `M ${mascotCx - 10} ${mascotCy + 6} L ${mascotCx + 10} ${mascotCy + 6}`;

  const summaryForSvg = result.summary.length > 80 ? result.summary.slice(0, 77) + '…' : result.summary;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fafafa"/>
      <stop offset="100%" style="stop-color:#f5f5f5"/>
    </linearGradient>
    <linearGradient id="mascot" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#a3e635"/>
      <stop offset="100%" style="stop-color:#2dd4bf"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="${pad}" y="${pad}" width="${w}" height="${height - pad * 2}" rx="16" fill="white" filter="url(#shadow)" stroke="#e5e7eb" stroke-width="1"/>
  <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#6b7280">DidIFkUp Verdict</text>
  <circle cx="${mascotCx}" cy="${mascotCy}" r="${mascotR}" fill="url(#mascot)"/>
  <ellipse cx="${mascotCx}" cy="${mascotCy}" rx="${mascotR}" ry="${mascotR}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
  <circle cx="${mascotCx - eyeOffset}" cy="${eyeY}" r="4" fill="white"/>
  <circle cx="${mascotCx + eyeOffset}" cy="${eyeY}" r="4" fill="white"/>
  <circle cx="${mascotCx - eyeOffset}" cy="${eyeY}" r="2.5" fill="#0f766e"/>
  <circle cx="${mascotCx + eyeOffset}" cy="${eyeY}" r="2.5" fill="#0f766e"/>
  <path d="${mouthPath}" fill="none" stroke="#0f766e" stroke-width="2" stroke-linecap="round"/>
  <text x="${width / 2}" y="${headlineY}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#111">${esc(headline)}</text>
  <rect x="${width / 2 - 52}" y="${badgeY - 18}" width="104" height="36" rx="12" fill="${fill}"/>
  <text x="${width / 2}" y="${badgeY + 2}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="14" fill="white">${result.verdict} RISK</text>
  <text x="${width / 2}" y="${summaryY}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="500" font-size="13" fill="#374151">${esc(summaryForSvg)}</text>
  <text x="${width / 2}" y="${watermarkY}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="600" font-size="12" fill="#9ca3af">didifkup.com</text>
  <circle cx="${width / 2 - 36}" cy="${watermarkY - 2}" r="6" fill="url(#mascot)"/>
</svg>`;
}

async function downloadShareCardAsPng(result: AnalysisResult): Promise<void> {
  const width = 400;
  const height = 520;
  const svgString = buildShareCardSvg(result, width, height);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('toBlob failed'));
              return;
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `didifkup-verdict-${result.verdict.toLowerCase()}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 100);
            resolve();
          },
          'image/png',
          1
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

function downloadShareCardAsSvg(result: AnalysisResult): void {
  const svgString = buildShareCardSvg(result, 400, 520);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `didifkup-verdict-${result.verdict.toLowerCase()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

const ShareCard: React.FC<{ result: AnalysisResult; tone?: Tone }> = ({ result, tone = 'real' }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const memeHeadline = MEME_HEADLINES[result.verdict];
  const mascotMood = verdictToMascotMood(result.verdict);
  const toneLabel = tone !== 'real' ? `\nTone: ${tone.charAt(0).toUpperCase() + tone.slice(1)}` : '';
  const caption = `${memeHeadline}\n\nVerdict: ${result.verdict}\n${result.summary}${toneLabel}\n\n— didifkup.com`;

  const handleCopy = () => {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadShareCardAsPng(result);
    } catch {
      downloadShareCardAsSvg(result);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-200"
    >
      <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Share2 className="w-5 h-5" />
        Share this verdict
      </h4>
      {/* Preview: screenshot-ready, viral layout */}
      <div
        className="bg-white rounded-2xl p-6 mb-4 shadow-xl border-2 border-gray-200 relative overflow-hidden min-h-[320px] flex flex-col items-center"
        style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent pointer-events-none rounded-2xl" />
        <div className="relative z-10 w-full flex flex-col items-center text-center">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">DidIFkUp Verdict</p>
          <div className="flex justify-center mb-3">
            <DidIFkUpMascot mood={mascotMood} className="scale-75" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 leading-tight">
            {memeHeadline}
          </h3>
          <div
            className={cn(
              'text-white px-6 py-2.5 rounded-2xl font-bold text-lg shadow-lg',
              result.verdict === 'LOW' ? 'bg-green-500 shadow-green-500/30' :
                result.verdict === 'MEDIUM' ? 'bg-orange-500 shadow-orange-500/30' :
                  'bg-red-500 shadow-red-500/30'
            )}
          >
            {result.verdict} RISK
          </div>
          <p className="text-gray-700 font-medium mt-4 max-w-md leading-snug">{result.summary}</p>
          {/* Watermark: didifkup.com + logo */}
          <div className="mt-auto pt-6 flex items-center justify-center gap-2 text-gray-400">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-lime-400 to-teal-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-500">didifkup.com</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <CopyToast show={copied} />
          <Button
            onClick={handleCopy}
            variant="outline"
            className="btn-outline-snappy w-full border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50/50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy caption
              </>
            )}
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={downloading}
          className="btn-outline-snappy border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50/30"
        >
          <Download className="w-4 h-4 mr-2" />
          {downloading ? 'Downloading…' : 'Download image'}
        </Button>
      </div>
    </motion.div>
  );
};

interface LandingPageProps {
  onAnalyze?: () => void;
  onSeeExample?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onAnalyze, onSeeExample }) => {
  const exampleRef = React.useRef<HTMLElement | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [mascotMood, setMascotMood] = useState<'idle' | 'loading' | 'low' | 'medium' | 'high'>('idle');
  const { pathname, hash } = useLocation();

  // Deep link: /#example — open example and scroll to it (e.g. "link in bio → see example")
  React.useEffect(() => {
    if (pathname !== '/' || hash !== '#example') return;
    setShowExample(true);
    setMascotMood('low');
    const t = setTimeout(() => {
      exampleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  const handleExampleToggle = () => {
    if (onSeeExample) {
      onSeeExample();
      return;
    }
    if (!showExample) {
      setMascotMood('loading');
      setShowExample(true);
      setTimeout(() => {
        setMascotMood('low');
      }, 400);
      // Scroll after content has a moment to expand so smooth scroll lands on visible example
      setTimeout(() => {
        exampleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setShowExample(false);
      setMascotMood('idle');
    }
  };

  /** Demo result for "See an example" — matches current VibeCheck schema (VibecheckResponse). */
  const landingDemoResult: VibecheckResponse = {
    rank: 'Low',
    score: 22,
    validation: "Your tone matched the conversation. Nothing you said was out of pocket.",
    realityCheck: "They probably didn't read as much into it as you are. Most people don't.",
    nextMove: "Do nothing — you're good. If they don't bring it up, you're in the clear.",
    oneLiner: "You're overthinking this one. Your response was totally normal.",
    requestId: 'demo',
  };

  const landingDemoOverthinking = 100 - landingDemoResult.score;
  const landingDemoMessedUp = landingDemoResult.score;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 relative">
      <BackgroundFX />
      <section className="container mx-auto px-4 section-padding text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="content-max-width mx-auto"
        >
          <div className="flex justify-center mb-8">
            <DidIFkUpMascot mood={mascotMood} onMoodCycle={setMascotMood} />
          </div>
          <h1 className="text-display text-5xl md:text-7xl text-gray-900 mb-6 max-w-4xl mx-auto">
            Did I fk that up…<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-teal-500">
              or am I spiraling for absolutely no reason?
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-gray-700 mb-8 max-w-3xl mx-auto font-medium leading-snug">
            Drop the moment you can't stop replaying.
            <br />
            We'll tell you if it's actually bad — or just your brain being loud.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <Button
              size="lg"
              onClick={() => onAnalyze?.()}
              className="btn-cta-primary bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 text-xl px-8 py-6"
            >
              Run it through the vibe check
              <ArrowRight className="ml-2 w-6 h-6" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleExampleToggle}
              className="btn-outline-snappy text-xl px-8 py-6 border-2 border-gray-300 hover:border-lime-500 hover:bg-lime-50/50"
            >
              See an example
            </Button>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">
            Used for texts, snaps, situationships, and 2am overthinking.
          </p>
        </motion.div>
        <HeroDemoWidget />
      </section>

      <section className="container mx-auto px-4 section-padding relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 content-max-width mx-auto">
          <CommentBubble text="why did this read me so hard 😭" delay={0.1} />
          <CommentBubble text="sending this to everyone I know" delay={0.2} />
          <CommentBubble text="it told me to do nothing and I finally slept" delay={0.3} />
          <CommentBubble text="why is this painfully accurate" delay={0.4} />
        </div>
      </section>

      <section className="container mx-auto px-4 section-padding relative z-10">
        <h2 className="text-section-title text-4xl md:text-5xl text-center mb-12 text-gray-900 content-max-width mx-auto">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 content-max-width mx-auto">
          {[
            { num: '1', title: 'Paste the moment', desc: "Say what happened. No editing. No overthinking." },
            { num: '2', title: 'Get the verdict', desc: "We tell you if it's actually bad — or just anxiety." },
            { num: '3', title: 'Know what to do', desc: "You get the next move. Or permission to chill." }
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
            >
              <motion.div
                whileHover={{ y: -8, rotateZ: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Card className={cn(cardPremium, "p-8 bg-white")}>
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-lime-400 to-teal-400 rounded-2xl flex items-center justify-center text-white text-3xl font-black mb-4 shadow-lg shadow-lime-500/30">
                      {step.num}
                    </div>
                    <h3 className="text-2xl font-bold mb-2 text-gray-900 leading-tight">{step.title}</h3>
                    <p className="text-gray-600 text-lg leading-relaxed">{step.desc}</p>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      <section ref={exampleRef} id="example" className="container mx-auto px-4 section-padding relative z-10">
        <AnimatePresence>
          {showExample && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative max-w-3xl mx-auto"
            >
              <VibeCheckResultCard
                result={landingDemoResult}
                isPro={false}
                overthinkingDisplay={landingDemoOverthinking}
                messedUpDisplay={landingDemoMessedUp}
                showRequestId={false}
                onUnlock={() => openPaymentLink()}
                static
              />
            </motion.section>
          )}
        </AnimatePresence>
      </section>

      <section className="container mx-auto px-4 section-padding relative z-10">
        <h2 className="text-section-title text-4xl md:text-5xl text-center mb-4 text-gray-900">
          Pricing
        </h2>
        <p className="text-center text-xl text-gray-600 mb-12 leading-relaxed">
          If you keep opening this app… you already know 👀
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 content-max-width mx-auto">
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: 'spring' }}
          >
            <Card className={cn(cardPremium, "p-8 bg-white border-gray-300/80 h-full")}>
              <div className="card-premium-shine absolute inset-0 rounded-3xl" />
              <div className="relative z-10">
                <h3 className="text-3xl font-bold mb-4 text-gray-900">Free</h3>
                <p className="text-5xl font-black mb-6 text-gray-900">$0</p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-lg leading-relaxed">
                    <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                    2 checks per day
                  </li>
                  <li className="flex items-center gap-2 text-lg leading-relaxed">
                    <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                    Basic verdicts
                  </li>
                </ul>
                <Button className="btn-outline-snappy w-full py-6 text-lg border-2 border-gray-300 hover:border-lime-500 hover:bg-lime-50/50" variant="outline">
                  Start Free
                </Button>
              </div>
            </Card>
          </motion.div>
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: 'spring' }}
          >
            <Card className={cn(cardPremium, "p-8 border-lime-400/90 shadow-xl shadow-lime-500/15 bg-gradient-to-br from-lime-50 to-teal-50 h-full")}>
              <div className="card-premium-shine absolute inset-0 rounded-3xl" />
              <div className="relative z-10">
                <Badge className="absolute top-4 right-4 bg-lime-500 text-white rounded-xl px-3 py-1">
                  Popular
                </Badge>
                <h3 className="text-3xl font-bold mb-4 text-gray-900">Pro</h3>
                <p className="text-5xl font-black mb-2 text-gray-900">$12</p>
                <p className="text-gray-600 mb-6">/month to stop asking your friends the same question.</p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-lg leading-relaxed">
                    <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                    Unlimited vibe checks
                  </li>
                  <li className="flex items-center gap-2 text-lg leading-relaxed">
                    <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                    Full history (yes, even the embarrassing ones)
                  </li>
                  <li className="flex items-center gap-2 text-lg leading-relaxed">
                    <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                    Follow-up texts you can actually send
                  </li>
                  <li className="flex items-center gap-2 text-lg leading-relaxed">
                    <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                    Skip the overthinking next time
                  </li>
                </ul>
                <Button
                  onClick={() => openPaymentLink()}
                  className="btn-cta-primary w-full bg-lime-500 hover:bg-lime-600 py-6 text-lg shadow-lg shadow-lime-500/25"
                >
                  Go Pro — $12/mo
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

const AppPage: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const { isPro } = useSubscriptionStatus();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AdaptedAnalysis | null>(null);
  const [pendingResult, setPendingResult] = useState<AdaptedAnalysis | null>(null);
  const [showOffRamp, setShowOffRamp] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [spiralMode, setSpiralMode] = useState(false);
  const [mascotMood, setMascotMood] = useState<'idle' | 'loading' | 'low' | 'medium' | 'high'>('idle');
  const [tone, setTone] = useState<Tone>('real');
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const analyzeLock = useRef(false);

  const [happened, setHappened] = useState('');
  const [youDid, setYouDid] = useState('');
  const [theyDid, setTheyDid] = useState('');
  const [relationship, setRelationship] = useState('friend');
  const [context, setContext] = useState('texting');

  const handleAnalyze = async () => {
    if (analyzeLock.current || analyzing) return;
    if (!user?.id) {
      navigate('/signin');
      return;
    }

    analyzeLock.current = true;
    setApiError(null);
    setShowOffRamp(false);
    setPendingResult(null);
    setAnalyzing(true);
    setMascotMood('loading');

    try {
      const apiResult = await analyzeSituation({
        happened: happened.trim(),
        youDid: youDid.trim(),
        theyDid: theyDid.trim(),
        relationship: relationship || null,
        context: context || null,
        tone: formToneToApi(tone),
      });

      const adapted = adaptAnalysisResult(apiResult);
      setMascotMood(adapted.verdict.toLowerCase() as 'low' | 'medium' | 'high');

      if (shouldShowOffRampToday()) {
        setPendingResult(adapted);
        setShowOffRamp(true);
      } else {
        setResult(adapted);
        setPendingResult(null);
      }
    } catch (err) {
      if (err instanceof LimitError) {
        setShowPaywall(true);
      } else if (err instanceof CooldownError) {
        setShowCooldown(true);
      } else {
        setApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
      setResult(null);
    } finally {
      setAnalyzing(false);
      analyzeLock.current = false;
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleOffRampDone = (data: OffRampData) => {
    setLastShownDate(getTodayKey());
    if (data.skipNextTime) setSkipOffRamp(true);
    if (pendingResult) setResult(pendingResult);
    setPendingResult(null);
    setShowOffRamp(false);
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 py-8 relative ${
      spiralMode ? 'bg-gradient-to-b from-purple-50 to-pink-50' : 'bg-gradient-to-b from-amber-50 to-orange-50'
    }`}>
      <BackgroundFX />
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex justify-between items-center mb-8 relative">
          <div className="flex items-center gap-4">
            <DidIFkUpMascot mood={mascotMood} className="scale-75" onMoodCycle={setMascotMood} />
            <div>
              <h1 className="text-display text-3xl md:text-5xl text-gray-900">
                Run it through DidIFkUp.
              </h1>
              <p className="text-lg md:text-xl text-gray-700 font-medium leading-snug">
                Tell me what happened. I'll keep it real.
              </p>
            </div>
          </div>
          {isPro ? (
            <Badge className="bg-lime-500 text-white border-lime-600 text-xs font-bold">
              PRO
            </Badge>
          ) : (
            <motion.div
              className="px-4 py-2 rounded-full font-bold text-sm shadow-lg bg-lime-500 text-white"
            >
              Demo Mode
            </motion.div>
          )}
        </div>
        <div className="flex justify-center mb-8">
          <motion.button
            onClick={() => setSpiralMode(!spiralMode)}
            className={`px-6 py-3 rounded-2xl font-bold text-sm border-2 transition-all ${
              spiralMode
                ? 'bg-purple-500 text-white border-purple-600 shadow-lg shadow-purple-500/30'
                : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Brain className="w-4 h-4 inline mr-2" />
            {spiralMode ? 'Spiral Mode ON' : 'Spiral Mode OFF'}
          </motion.button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          <Card className={cn(cardPremium, "p-8 bg-white")}>
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
                    className="min-h-[100px] rounded-2xl border-2 text-base bg-gray-50 focus:bg-white transition-colors"
                  />
                </motion.div>
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
                    className="min-h-[100px] rounded-2xl border-2 text-base bg-gray-50 focus:bg-white transition-colors"
                  />
                </motion.div>
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
                    className="min-h-[100px] rounded-2xl border-2 text-base bg-gray-50 focus:bg-white transition-colors"
                  />
                </motion.div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-lg font-bold mb-2 text-gray-900">
                    Relationship
                  </label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="rounded-2xl border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="coworker">Coworker</SelectItem>
                      <SelectItem value="boss">Boss</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="stranger">Stranger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-lg font-bold mb-2 text-gray-900">
                    Context
                  </label>
                  <Select value={context} onValueChange={setContext}>
                    <SelectTrigger className="rounded-2xl border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texting">Texting</SelectItem>
                      <SelectItem value="in-person">In-person</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="group-chat">Group chat</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-lg font-bold mb-3 text-gray-900">
                  Tone
                </label>
                <div className="flex gap-2">
                  {(['nice', 'real', 'savage'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={cn(
                        'flex-1 px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all',
                        tone === t
                          ? 'bg-lime-500 text-white border-lime-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-lime-400 hover:bg-lime-50/50'
                      )}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`btn-cta-primary w-full bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 py-6 text-xl ${analyzing ? 'ring-2 ring-lime-400 ring-offset-2 shadow-lg shadow-lime-500/30' : ''}`}
                >
                  {analyzing ? (
                    <motion.div
                      animate={reduceMotion ? {} : { rotate: 360 }}
                      transition={{ duration: 1, repeat: reduceMotion ? 0 : Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="w-6 h-6" />
                    </motion.div>
                  ) : (
                    <>
                      Analyze
                      <ArrowRight className="ml-2 w-6 h-6" />
                    </>
                  )}
                </Button>
              </motion.div>
              <p className="text-xs text-gray-400 text-center">
                {isPro ? 'Unlimited checks' : 'Free: 2 checks per day. Upgrade for unlimited.'}
              </p>
            </div>
          </Card>

          <div className="flex flex-col gap-8">
            {showOffRamp && (
              <OffRamp open={showOffRamp} onDone={handleOffRampDone} />
            )}
            {!showOffRamp && (apiError ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-[600px]"
              >
                <Card className={cn(cardPremium, "p-8 border-red-200/80 shadow-xl bg-white min-h-[600px] flex flex-col items-center justify-center")}>
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10 text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
                    <p className="text-gray-600 mb-6">{apiError}</p>
                    <Button
                      variant="outline"
                      className="rounded-2xl font-bold"
                      onClick={() => setApiError(null)}
                    >
                      Try again
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ) : result ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <Card className={cn(cardPremium, "p-8 border-lime-300/80 shadow-xl bg-white")}>
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10">
                    <p className="text-center text-sm text-purple-600 font-bold mb-4">Ok breathe — here's the real read:</p>
                    <div className="flex justify-center mb-6">
                      <VerdictBadge level={result.verdict} showConfetti={true} />
                    </div>
                    <ConfidenceMeter confidenceNumber={result.confidenceNumber} />
                    <div className="mx-auto max-w-2xl text-center mt-6 mb-6 space-y-3">
                      <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
                        {result.stabilization ?? result.summary}
                      </p>
                      {result.interpretation ? (
                        <p className="text-lg text-gray-700 leading-relaxed">
                          {result.interpretation}
                        </p>
                      ) : null}
                    </div>
                    <div className="bg-lime-100 rounded-2xl p-6 mb-6">
                      <h4 className="font-bold text-xl mb-2 text-gray-900">Next Move:</h4>
                      <p className="text-lg text-gray-800">{result.nextMove}</p>
                    </div>
                    <div className="space-y-4 mb-6">
                      <h4 className="font-bold text-xl text-gray-900">Follow-up texts:</h4>
                      <Tabs defaultValue="neutral" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-gray-100 p-1">
                          <TabsTrigger value="soft" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">Soft</TabsTrigger>
                          <TabsTrigger value="neutral" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">Neutral</TabsTrigger>
                          <TabsTrigger value="firm" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">Firm</TabsTrigger>
                        </TabsList>
                        {Object.entries(result.followUpTabs).map(([key, text]) => (
                          <TabsContent key={key} value={key}>
                            <div className="flex items-center gap-2 bg-gray-100 p-4 rounded-2xl">
                              <p className="flex-1 text-gray-800 leading-relaxed">{text}</p>
                              <div className="relative">
                                <CopyToast show={copiedIndex === key} />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl hover:bg-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2"
                                  onClick={() => handleCopy(text, key)}
                                >
                                  {copiedIndex === key ? (
                                    <Check className="w-4 h-4 text-lime-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>
                    <div className="flex gap-3">
                      <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant="outline"
                          className="btn-outline-snappy w-full py-6 font-bold border-2 hover:border-lime-500 hover:bg-lime-50/50"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Download
                        </Button>
                      </motion.div>
                      <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant="outline"
                          className="btn-outline-snappy w-full py-6 font-bold border-2 hover:border-purple-500 hover:bg-purple-50/50"
                        >
                          <Share2 className="w-5 h-5 mr-2" />
                          Share
                        </Button>
                      </motion.div>
                    </div>
                    <ShareCard result={adaptedToLegacy(result)} tone={tone} />
                  </div>
                </Card>
              </motion.div>
            ) : analyzing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-[600px]"
              >
                <Card className={cn(cardPremium, "p-8 border-lime-300/80 shadow-xl bg-white min-h-[600px]")}>
                  <div className="card-premium-shine absolute inset-0 rounded-3xl" />
                  <div className="relative z-10 space-y-6">
                    <p className="text-center text-sm text-purple-600 font-bold mb-6">Analyzing…</p>
                    <div className="h-10 w-32 mx-auto rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="h-6 w-full max-w-md mx-auto rounded bg-gray-100 animate-pulse" />
                    <div className="h-6 w-[75%] mx-auto rounded bg-gray-100 animate-pulse" />
                    <div className="space-y-3 mt-8">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                    <div className="h-24 rounded-2xl bg-gray-100 animate-pulse mt-6" />
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Card className={cn(cardPremium, "p-12 border-dashed border-gray-300/80 bg-white/60 flex flex-col items-center justify-center min-h-[600px]")}>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-purple-100/20 to-pink-100/20"
                    animate={reduceMotion ? { opacity: 0.4 } : { opacity: [0.3, 0.5, 0.3] }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity }}
                  />
                  <motion.div
                    animate={reduceMotion ? {} : { y: [0, -10, 0] }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 2, repeat: Infinity }}
                    className="relative z-10"
                  >
                    <MessageSquare className="w-24 h-24 text-gray-300 mb-4" />
                  </motion.div>
                  <p className="text-xl text-gray-500 text-center relative z-10">
                    Your analysis will appear here
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <Dialog open={showCooldown} onOpenChange={setShowCooldown}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Already checked</DialogTitle>
            <DialogDescription>
              You already checked this recently.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowCooldown(false);
                setShowOffRamp(true);
              }}
            >
              Do the calm-down flow
            </Button>
            <Button
              type="button"
              className="w-full bg-lime-500 hover:bg-lime-600 text-white"
              onClick={() => {
                setShowCooldown(false);
                openPaymentLink();
              }}
            >
              Go Pro to re-check
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Out of free checks</DialogTitle>
            <DialogDescription>
              You’ve used all 2 free analyses. Upgrade to keep going.
            </DialogDescription>
            <p className="text-sm text-gray-500">
              You’ll be back here right after checkout.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="bg-lime-500 hover:bg-lime-600 text-white"
              onClick={() => {
                setShowPaywall(false);
                openPaymentLink();
              }}
            >
              Go Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const NavLinkItem: React.FC<{
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ to, children, className, onClick }) => (
  <Link to={to} onClick={onClick} className={className}>
    {children}
  </Link>
);

const Navigation: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading, signOut } = useAuth();
  const { isPro, isLoading: subLoading } = useSubscriptionStatus();
  const showProBadge = pathname === '/app' && !subLoading && isPro;

  const isProStatus = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  const closeMenu = () => setMobileMenuOpen(false);

  const handleSignOut = async () => {
    await signOut();
    closeMenu();
    navigate('/', { replace: true });
  };

  const accountStatusEl = authLoading ? (
    <span className="text-gray-400 text-sm">…</span>
  ) : !user ? (
    <NavLinkItem to="/signin" className="text-lg font-bold text-gray-700 hover:text-lime-500 transition-colors" onClick={closeMenu}>
      Sign in
    </NavLinkItem>
  ) : (
    <>
      <NavLinkItem to="/account" className="text-lg font-bold text-gray-700 hover:text-lime-500 transition-colors" onClick={closeMenu}>
        Account
      </NavLinkItem>
      <Badge
        className={cn(
          'text-xs font-bold',
          isProStatus ? 'bg-lime-500 text-white border-lime-600' : 'bg-gray-200 text-gray-700 border-gray-300'
        )}
      >
        {isProStatus ? 'Pro' : 'Free'}
      </Badge>
      <button
        type="button"
        onClick={handleSignOut}
        className="text-lg font-bold text-gray-700 hover:text-lime-500 transition-colors"
      >
        Sign out
      </button>
    </>
  );

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b-2 border-purple-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <NavLinkItem to="/" className="flex items-center gap-2" onClick={closeMenu}>
              <div className="w-10 h-10 bg-gradient-to-br from-lime-400 to-teal-400 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black text-gray-900">DidIFkUp</span>
            </NavLinkItem>
            <div className="hidden md:flex items-center gap-6">
              <NavLinkItem to="/app" className="text-lg font-bold text-gray-700 hover:text-lime-500 transition-colors">
                Try It
              </NavLinkItem>
              <NavLinkItem to="/stickers" className="text-sm font-bold text-gray-600 hover:text-lime-500 transition-colors">
                Stickers
              </NavLinkItem>
              <NavLinkItem to="/pricing" className="text-lg font-bold text-gray-700 hover:text-lime-500 transition-colors">
                Pricing
              </NavLinkItem>
              <NavLinkItem to="/vibecheck" className="text-lg font-bold text-gray-700 hover:text-lime-500 transition-colors">
                VibeCheck
              </NavLinkItem>
              {accountStatusEl}
              {showProBadge && (
                <Badge className="ml-1 bg-lime-500 text-white border-lime-600 text-xs font-bold">
                  PRO
                </Badge>
              )}
            </div>
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t-2 border-purple-200 bg-white"
            >
              <div className="container mx-auto px-4 py-4 space-y-4">
                <NavLinkItem to="/app" className="block w-full text-left text-lg font-bold text-gray-700 py-2" onClick={closeMenu}>
                  Try It
                </NavLinkItem>
                <NavLinkItem to="/stickers" className="block w-full text-left text-sm font-bold text-gray-600 py-2" onClick={closeMenu}>
                  Stickers
                </NavLinkItem>
                <NavLinkItem to="/pricing" className="block w-full text-left text-lg font-bold text-gray-700 py-2" onClick={closeMenu}>
                  Pricing
                </NavLinkItem>
                <NavLinkItem to="/vibecheck" className="block w-full text-left text-lg font-bold text-gray-700 py-2" onClick={closeMenu}>
                  VibeCheck
                </NavLinkItem>
                {authLoading ? (
                  <span className="block text-gray-400 text-sm py-2">…</span>
                ) : !user ? (
                  <NavLinkItem to="/signin" className="block w-full text-left text-lg font-bold text-gray-700 py-2" onClick={closeMenu}>
                    Sign in
                  </NavLinkItem>
                ) : (
                  <>
                    <NavLinkItem to="/account" className="block w-full text-left text-lg font-bold text-gray-700 py-2" onClick={closeMenu}>
                      Account
                    </NavLinkItem>
                    <div className="flex items-center gap-2 py-2">
                      <Badge
                        className={cn(
                          'text-xs font-bold',
                          isProStatus ? 'bg-lime-500 text-white border-lime-600' : 'bg-gray-200 text-gray-700 border-gray-300'
                        )}
                      >
                        {isProStatus ? 'Pro' : 'Free'}
                      </Badge>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="text-lg font-bold text-gray-700 hover:text-lime-500 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Navigation />
    {children}
    <footer className="py-8 text-center">
      <p className="text-sm text-gray-400">
        Yes, you can screenshot this. We expect you to.
      </p>
    </footer>
  </>
);

/** Protects /app: redirects to /signin if not signed in. */
function AppRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ message: 'Please sign in to use the app.' }}
      />
    );
  }

  return <>{children}</>;
}

/** Reusable auth guard: redirects to /auth if not signed in. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ message: 'Please sign in.' }} />;
  }

  return <>{children}</>;
}

/** Wrapper for the landing route: passes onAnalyze so "Analyze what happened" switches to app page. */
function LandingRoute() {
  const navigate = useNavigate();
  return (
    <Layout>
      <LandingPage onAnalyze={() => navigate('/app')} />
    </Layout>
  );
}

export default function DidIFkUpApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Analytics />
        <SpeedInsights />
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/app" element={<Layout><AppRouteGuard><AppPage /></AppRouteGuard></Layout>} />
          <Route path="/stickers" element={<Layout><StickersPage /></Layout>} />
          <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
          <Route path="/vibecheck" element={<Layout><VibeCheckPage /></Layout>} />
          <Route path="/signin" element={<Layout><SignInPage /></Layout>} />
          <Route path="/auth" element={<Layout><SignInPage /></Layout>} />
          <Route path="/signup" element={<Layout><SignUpPage /></Layout>} />
          <Route path="/upgrade/success" element={<Layout><UpgradeSuccessPage /></Layout>} />
          <Route path="/upgrade/cancel" element={<Layout><UpgradeCancelPage /></Layout>} />
          <Route path="/account" element={<Layout><RequireAuth><AccountPage /></RequireAuth></Layout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
