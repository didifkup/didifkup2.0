import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type MascotMood = 'idle' | 'loading' | 'low' | 'medium' | 'high';

const TOOLTIP_LINES = [
  'be honest…',
  'ok breathe',
  'this is recoverable',
  "nah that's crazy",
  "you're fine 😭",
];

const MOOD_CYCLE: MascotMood[] = ['idle', 'low', 'medium', 'high', 'idle'];

function getNextMood(current: MascotMood): MascotMood {
  const i = MOOD_CYCLE.indexOf(current);
  return MOOD_CYCLE[(i + 1) % MOOD_CYCLE.length];
}

function pickRandomLine(): string {
  return TOOLTIP_LINES[Math.floor(Math.random() * TOOLTIP_LINES.length)];
}

export type MascotVariant = 'default' | 'wink' | 'cry' | 'clown' | 'halo';

export interface DidIFkUpMascotProps {
  mood?: MascotMood;
  variant?: MascotVariant;
  className?: string;
  /** Called when user clicks to cycle mood; parent can sync state. */
  onMoodCycle?: (nextMood: MascotMood) => void;
}

export const DidIFkUpMascot: React.FC<DidIFkUpMascotProps> = ({
  mood = 'idle',
  variant = 'default',
  className = '',
  onMoodCycle,
}) => {
  const reduceMotion = useReducedMotion();
  const bodyControls = useAnimation();
  const [blink, setBlink] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tooltipLine, setTooltipLine] = useState(TOOLTIP_LINES[0]);

  // Blink interval
  useEffect(() => {
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  // Pick new tooltip line when hover starts
  const handlePointerEnter = useCallback(() => {
    setHovered(true);
    setTooltipLine(pickRandomLine());
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
  }, []);

  // Mood-based body animation (no rotation)
  useEffect(() => {
    if (reduceMotion) {
      bodyControls.start({ x: 0, y: 0, scale: 1 });
      return;
    }
    switch (mood) {
      case 'idle':
        bodyControls.start({
          y: [0, -6, 0],
          scale: [1, 1.03, 1],
          transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
        });
        break;
      case 'loading':
        bodyControls.start({
          x: [0, -3, 3, -2, 0],
          y: [0, -2, 0],
          scale: [1, 1.02, 1],
          transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
        });
        break;
      case 'low':
        bodyControls.start({
          y: [0, -12, 0],
          scale: [1, 1.05, 1],
          transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
        });
        break;
      case 'medium':
        bodyControls.start({
          x: [0, -4, 4, -3, 0],
          transition: { duration: 0.5, ease: 'easeOut' },
        });
        break;
      case 'high':
        bodyControls.start({
          x: [0, -5, 5, -4, 4, -3, 0],
          y: [0, -4, 0],
          scale: [1, 1.04, 1],
          transition: { duration: 0.4, repeat: Infinity, repeatDelay: 0.2, ease: 'easeOut' },
        });
        break;
      default:
        bodyControls.start({ x: 0, y: 0, scale: 1 });
    }
  }, [mood, bodyControls, reduceMotion]);

  const handleClick = () => {
    const next = getNextMood(mood);
    onMoodCycle?.(next);
  };

  return (
    <div
      className={cn('relative inline-flex flex-col items-center', className)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Tooltip bubble above mascot */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 px-3 py-2 rounded-xl bg-white/95 border-2 border-lime-200 shadow-lg text-sm font-medium text-gray-800 whitespace-nowrap"
          >
            {tooltipLine}
            {/* speech nub */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"
              style={{ filter: 'drop-shadow(0 1px 0 rgba(34, 197, 94, 0.3))' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleClick}
        animate={bodyControls}
        whileHover={{ scale: reduceMotion ? 1 : 1.08 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="relative w-32 h-32 cursor-pointer touch-manipulation rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2"
        aria-label="Mascot — click to change mood"
      >
        {/* Soft shadow (sticker-like) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        />

        {/* Base body: layered gradient (sticker/toy feel) */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-lime-400 via-lime-300 to-teal-400" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/45 from-0% via-white/15 via-25% to-transparent to-65%" />
        </div>

        {/* Glossy highlight */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(155deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 25%, transparent 50%)',
          }}
        />

        {/* Blush cheeks (hide for clown — nose replaces) */}
        {variant !== 'clown' && (
          <>
            <div
              className="absolute top-[42%] left-[18%] w-5 h-3 rounded-full opacity-60 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, #f9a8a8 0%, transparent 70%)' }}
            />
            <div
              className="absolute top-[42%] right-[18%] w-5 h-3 rounded-full opacity-60 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, #f9a8a8 0%, transparent 70%)' }}
            />
          </>
        )}

        {/* Halo (variant halo) */}
        {variant === 'halo' && (
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full pointer-events-none border-4 border-amber-300/90"
            style={{ boxShadow: '0 0 12px rgba(251, 191, 36, 0.6)' }}
          />
        )}

        {/* Face container */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          {/* Eyes — variant overrides */}
          {variant === 'wink' && (
            <div className="flex gap-5 justify-center mb-1.5">
              <motion.div
                className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                style={{ transform: 'rotate(-2deg)' }}
                animate={{ scaleY: 0.08 }}
                transition={{ duration: 0.12 }}
              >
                <div className="w-2 h-2 rounded-full bg-teal-800/90" />
              </motion.div>
              <motion.div
                className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                style={{ transform: 'rotate(2deg)' }}
              >
                <div className="w-2 h-2 rounded-full bg-teal-800/90" />
              </motion.div>
            </div>
          )}
          {variant === 'cry' && (
            <>
              <div className="flex gap-5 justify-center mb-1.5">
                <motion.div
                  className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                  style={{ transform: 'rotate(-2deg)' }}
                  animate={{ scaleY: blink ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="w-2 h-2 rounded-full bg-teal-800/90" />
                </motion.div>
                <motion.div
                  className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                  style={{ transform: 'rotate(2deg)' }}
                  animate={{ scaleY: blink ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="w-2 h-2 rounded-full bg-teal-800/90" />
                </motion.div>
              </div>
              <motion.div
                className="absolute top-[38%] left-[22%] w-1.5 h-3 rounded-b-full bg-sky-300/80"
                style={{ transform: 'rotate(-15deg)' }}
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <motion.div
                className="absolute top-[38%] right-[22%] w-1.5 h-3 rounded-b-full bg-sky-300/80"
                style={{ transform: 'rotate(15deg)' }}
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
              />
            </>
          )}
          {variant === 'clown' && (
            <>
              <div className="flex gap-5 justify-center mb-1.5">
                <motion.div
                  className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                  style={{ transform: 'rotate(-2deg)' }}
                  animate={{ scaleY: blink ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="w-2 h-2 rounded-full bg-teal-800/90" />
                </motion.div>
                <motion.div
                  className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                  style={{ transform: 'rotate(2deg)' }}
                  animate={{ scaleY: blink ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="w-2 h-2 rounded-full bg-teal-800/90" />
                </motion.div>
              </div>
              <div
                className="absolute top-[48%] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 border-2 border-red-600 pointer-events-none"
                style={{ marginTop: 2 }}
              />
            </>
          )}
          {/* Eyes — mood-dependent (when variant is default) */}
          {variant === 'default' && mood === 'medium' && (
            <>
              {/* Side-eye */}
              <div className="flex gap-5 justify-center mb-1.5">
                <motion.div
                  className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                  style={{ transform: 'rotate(-2deg)' }}
                  animate={{ scaleY: blink ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="absolute w-2 h-2 rounded-full bg-teal-800/90" style={{ right: 2, top: '50%', transform: 'translateY(-50%)' }} />
                </motion.div>
                <motion.div
                  className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                  style={{ transform: 'rotate(2deg)' }}
                  animate={{ scaleY: blink ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="absolute w-2 h-2 rounded-full bg-teal-800/90" style={{ right: 2, top: '50%', transform: 'translateY(-50%)' }} />
                </motion.div>
              </div>
              {/* Sweat drop */}
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-[28%] right-[22%] w-2.5 h-3 rounded-b-full bg-sky-300/90"
                style={{ transform: 'rotate(-25deg)' }}
              />
            </>
          )}
          {variant === 'default' && mood === 'high' && (
            <>
              {/* Wide eyes + tiny "!" */}
              <div className="flex gap-4 justify-center mb-1.5 items-center">
                <motion.div
                  className="relative w-5 h-5 rounded-full bg-white flex items-center justify-center border-2 border-teal-700/30"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-800" />
                </motion.div>
                <motion.div
                  className="relative w-5 h-5 rounded-full bg-white flex items-center justify-center border-2 border-teal-700/30"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.3, repeat: Infinity, delay: 0.1 }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-800" />
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-1 right-[18%] text-red-500 font-black text-lg leading-none"
              >
                !
              </motion.div>
            </>
          )}
          {variant === 'default' && (mood === 'idle' || mood === 'loading' || mood === 'low') && (
            <div className="flex gap-5 justify-center mb-1.5">
              <motion.div
                className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                style={{ transform: 'rotate(-2deg)' }}
                animate={{ scaleY: blink ? 0.08 : 1 }}
                transition={{ duration: 0.12 }}
              >
                <div className="w-2 h-2 rounded-full bg-teal-800/90" />
              </motion.div>
              <motion.div
                className="relative w-4 h-4 rounded-full bg-white flex items-center justify-center"
                style={{ transform: 'rotate(2deg)' }}
                animate={{ scaleY: blink ? 0.08 : 1 }}
                transition={{ duration: 0.12 }}
              >
                <div className="w-2 h-2 rounded-full bg-teal-800/90" />
              </motion.div>
            </div>
          )}

          {/* Sparkle for low (happy) */}
          {variant === 'default' && mood === 'low' && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-[22%] right-[20%] w-3 h-3 text-amber-200"
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
              </svg>
            </motion.div>
          )}

          {/* Sparkles orbit for loading */}
          {variant === 'default' && mood === 'loading' && !reduceMotion && (
            <>
              {/* Orbit: circle approx with x/y keyframes; r ~ 20px */}
              {[
                { delay: 0, x: [20, 14, 0, -14, -20, -14, 0, 14, 20], y: [0, 14, 20, 14, 0, -14, -20, -14, 0] },
                { delay: 0.66, x: [20, 14, 0, -14, -20, -14, 0, 14, 20], y: [0, 14, 20, 14, 0, -14, -20, -14, 0] },
                { delay: 1.33, x: [20, 14, 0, -14, -20, -14, 0, 14, 20], y: [0, 14, 20, 14, 0, -14, -20, -14, 0] },
              ].map(({ delay }, i) => (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-white/90 -ml-0.75 -mt-0.75"
                  animate={{ x: [20, 14, 0, -14, -20, -14, 0, 14, 20], y: [0, 14, 20, 14, 0, -14, -20, -14, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', delay: delay }}
                />
              ))}
            </>
          )}

          {/* Mouth by variant (wink, cry, clown, halo) */}
          {variant === 'wink' && (
            <svg className="w-8 h-4 mt-0.5" viewBox="0 0 32 16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M 4 10 Q 16 2 28 10" />
            </svg>
          )}
          {variant === 'cry' && (
            <svg className="w-8 h-4 mt-0.5" viewBox="0 0 32 16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinecap="round">
              <path d="M 4 6 Q 16 14 28 6" />
            </svg>
          )}
          {variant === 'clown' && (
            <svg className="w-8 h-4 mt-0.5" viewBox="0 0 32 16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M 4 10 Q 16 2 28 10" />
            </svg>
          )}
          {variant === 'halo' && (
            <svg className="w-7 h-3 mt-0.5" viewBox="0 0 28 12" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinecap="round">
              <path d="M 4 8 Q 14 4 24 8" />
            </svg>
          )}
          {/* Mouth by mood (default variant) */}
          {variant === 'default' && mood === 'idle' && (
            <svg className="w-7 h-3 mt-0.5" viewBox="0 0 28 12" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinecap="round">
              <path d="M 4 8 Q 14 4 24 8" />
            </svg>
          )}
          {variant === 'default' && mood === 'loading' && (
            <svg className="w-6 h-2.5 mt-1" viewBox="0 0 24 10" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M 2 6 L 22 6" />
            </svg>
          )}
          {variant === 'default' && mood === 'low' && (
            <motion.svg
              className="w-8 h-4 mt-0.5"
              viewBox="0 0 32 16"
              fill="none"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="2.2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.25 }}
            >
              <path d="M 4 10 Q 16 2 28 10" />
            </motion.svg>
          )}
          {variant === 'default' && mood === 'medium' && (
            <svg className="w-7 h-2 mt-1" viewBox="0 0 28 8" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M 2 5 L 26 5" />
            </svg>
          )}
          {variant === 'default' && mood === 'high' && (
            <motion.svg
              className="w-8 h-4 mt-0.5"
              viewBox="0 0 32 16"
              fill="none"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M 4 6 Q 16 14 28 6" />
            </motion.svg>
          )}
        </div>
      </motion.button>
    </div>
  );
};
