import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DidIFkUpMascot, type MascotMood, type MascotVariant } from '@/components/mascot/DidIFkUpMascot';
import { CopyToast } from '@/components/CopyToast';
import { cn, cardPremium } from '@/lib/utils';

const WATERMARK_TEXT = 'didifkup.com';
const SIZE = 160;

type StickerDef = { id: string; label: string; mood: MascotMood; variant: MascotVariant };

const STICKERS: StickerDef[] = [
  { id: 'idle', label: 'Idle', mood: 'idle', variant: 'default' },
  { id: 'low', label: 'Low', mood: 'low', variant: 'default' },
  { id: 'medium', label: 'Medium', mood: 'medium', variant: 'default' },
  { id: 'high', label: 'High', mood: 'high', variant: 'default' },
  { id: 'wink', label: 'Wink', mood: 'idle', variant: 'wink' },
  { id: 'crying', label: 'Crying', mood: 'idle', variant: 'cry' },
  { id: 'clown', label: 'Clown', mood: 'idle', variant: 'clown' },
  { id: 'halo', label: 'Halo', mood: 'idle', variant: 'halo' },
];

/** Build SVG string for a sticker (mascot + watermark) for download. */
function buildStickerSvg(
  mood: MascotMood,
  variant: MascotVariant,
  label: string,
  size: number
): string {
  const cx = size / 2;
  const r = size * 0.38;
  const eyeY = cx - r * 0.25;
  const eyeOffset = r * 0.35;
  const eyeR = r * 0.12;
  const pupilR = r * 0.08;

  // Mouth by mood/variant
  const mouthPath =
    variant === 'wink' || variant === 'clown' || variant === 'halo'
      ? `M ${cx - r * 0.5} ${cx + r * 0.25} Q ${cx} ${cx + r * 0.05} ${cx + r * 0.5} ${cx + r * 0.25}`
      : variant === 'cry'
        ? `M ${cx - r * 0.4} ${cx + r * 0.15} Q ${cx} ${cx + r * 0.45} ${cx + r * 0.4} ${cx + r * 0.15}`
        : mood === 'low'
          ? `M ${cx - r * 0.5} ${cx + r * 0.28} Q ${cx} ${cx + r * 0.08} ${cx + r * 0.5} ${cx + r * 0.28}`
          : mood === 'high'
            ? `M ${cx - r * 0.4} ${cx + r * 0.12} Q ${cx} ${cx + r * 0.38} ${cx + r * 0.4} ${cx + r * 0.12}`
            : `M ${cx - r * 0.45} ${cx + r * 0.2} L ${cx + r * 0.45} ${cx + r * 0.2}`;

  const leftEyeClosed = variant === 'wink';
  const haloEl =
    variant === 'halo'
      ? `<ellipse cx="${cx}" cy="${cx - r * 1.15}" rx="${r * 0.6}" ry="${r * 0.2}" fill="none" stroke="#fbbf24" stroke-width="3" opacity="0.9"/>`
      : '';
  const noseEl =
    variant === 'clown'
      ? `<circle cx="${cx}" cy="${cx + r * 0.05}" r="${r * 0.18}" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>`
      : '';
  const tearEls =
    variant === 'cry'
      ? `<path d="M ${cx - r * 0.5} ${eyeY + r * 0.2} Q ${cx - r * 0.45} ${eyeY + r * 0.5} ${cx - r * 0.35} ${eyeY + r * 0.35}" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
         <path d="M ${cx + r * 0.5} ${eyeY + r * 0.2} Q ${cx + r * 0.45} ${eyeY + r * 0.5} ${cx + r * 0.35} ${eyeY + r * 0.35}" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg-${label}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#a3e635"/>
      <stop offset="100%" style="stop-color:#2dd4bf"/>
    </linearGradient>
    <filter id="shadow-${label}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.15"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="transparent"/>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="url(#bg-${label})" filter="url(#shadow-${label})"/>
  <ellipse cx="${cx}" cy="${cx}" rx="${r}" ry="${r}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
  ${haloEl}
  <circle cx="${cx - eyeOffset}" cy="${eyeY}" r="${eyeR}" fill="white"/>
  <circle cx="${cx + eyeOffset}" cy="${eyeY}" r="${eyeR}" fill="white"/>
  ${leftEyeClosed ? '' : `<circle cx="${cx - eyeOffset}" cy="${eyeY}" r="${pupilR}" fill="#0f766e"/>`}
  <circle cx="${cx + eyeOffset}" cy="${eyeY}" r="${pupilR}" fill="#0f766e"/>
  ${noseEl}
  <path d="${mouthPath}" fill="none" stroke="#0f766e" stroke-width="2.5" stroke-linecap="round"/>
  ${tearEls}
  <text x="${size - 6}" y="${size - 6}" text-anchor="end" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="rgba(0,0,0,0.35)">${WATERMARK_TEXT}</text>
</svg>`;
}

function downloadStickerSvg(sticker: StickerDef): void {
  const svg = buildStickerSvg(sticker.mood, sticker.variant, sticker.label, SIZE);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `didifkup-sticker-${sticker.id}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export const StickersPage: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(WATERMARK_TEXT);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 relative">
      <div className="container mx-auto px-4 py-12 relative z-10">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-black text-gray-900 text-center mb-2"
        >
          DidIFkUp Sticker Pack
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center text-gray-600 mb-10"
        >
          Download or copy the watermark for each sticker.
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {STICKERS.map((sticker, i) => (
            <motion.div
              key={sticker.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={cn(cardPremium, 'p-4 bg-white overflow-visible')}>
                <div className="card-premium-shine absolute inset-0 rounded-2xl" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative w-[140px] h-[140px] flex items-center justify-center mb-4">
                    <DidIFkUpMascot
                      mood={sticker.mood}
                      variant={sticker.variant}
                      className="scale-[0.875] pointer-events-none"
                    />
                    {/* Tiny watermark in corner */}
                    <span
                      className="absolute bottom-0 right-0 text-[10px] font-semibold text-gray-400/80"
                      aria-hidden
                    >
                      {WATERMARK_TEXT}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-3 capitalize">{sticker.label}</p>
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <div className="relative flex-1">
                      <CopyToast show={copiedId === sticker.id} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-2 border-gray-200 hover:border-lime-500 hover:bg-lime-50/50 rounded-xl"
                        onClick={() => handleCopy(sticker.id)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy text
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-2 border-gray-200 hover:border-lime-500 hover:bg-lime-50/50 rounded-xl"
                      onClick={() => downloadStickerSvg(sticker)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download SVG
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
