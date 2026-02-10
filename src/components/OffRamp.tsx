import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn, cardPremium } from '@/lib/utils';

export type OffRampData = {
  worstMeaning: string;
  friendReply: string;
  vibe: 'calm' | 'direct' | 'kind' | 'space';
  skipNextTime: boolean;
};

const WORST_MEANING_OPTIONS = [
  'They hate me',
  'I embarrassed myself',
  'I ruined the vibe',
  'I look desperate',
  "I'm about to get rejected",
  'Not sure / just spiraling',
] as const;

const VIBE_OPTIONS: { label: string; value: OffRampData['vibe'] }[] = [
  { label: 'Calm', value: 'calm' },
  { label: 'Straight-up', value: 'direct' },
  { label: 'Kind', value: 'kind' },
  { label: 'Give space', value: 'space' },
];

interface OffRampProps {
  open: boolean;
  onDone: (data: OffRampData) => void;
}

export function OffRamp({ open, onDone }: OffRampProps) {
  const [worstMeaning, setWorstMeaning] = useState<string>('');
  const [friendReply, setFriendReply] = useState('');
  const [vibe, setVibe] = useState<OffRampData['vibe']>('calm');
  const [skipNextTime, setSkipNextTime] = useState(false);

  const handleDone = () => {
    onDone({
      worstMeaning: worstMeaning || 'Not sure',
      friendReply,
      vibe,
      skipNextTime,
    });
  };

  if (!open) return null;

  return (
    <Card className={cn(cardPremium, 'p-6 max-w-lg mx-auto bg-white')}>
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">
          Quick off-ramp (10 seconds)
        </h3>
        <p className="text-sm text-gray-500 -mt-2">
          Your brain&apos;s about to freestyle. Let&apos;s slow it down for a sec.
        </p>

        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">
            What&apos;s the loudest story your brain is telling right now?
          </label>
          <p className="text-sm text-gray-500 mb-2">Pick the one that&apos;s yelling the most.</p>
          <div className="flex flex-wrap gap-2">
            {WORST_MEANING_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setWorstMeaning(opt)}
                className={cn(
                  'px-4 py-2.5 rounded-xl font-medium text-sm border-2 transition-all',
                  worstMeaning === opt
                    ? 'bg-lime-500 text-white border-lime-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-lime-400 hover:bg-lime-50/50'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">
            If your friend told you this, what would you say to them?
          </label>
          <Textarea
            value={friendReply}
            onChange={(e) => setFriendReply(e.target.value)}
            placeholder="(optional)"
            className="min-h-[80px] rounded-xl border-2 bg-gray-50 focus:bg-white transition-colors"
          />
        </div>

        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">
            How do you want to come off?
          </label>
          <div className="flex flex-wrap gap-2">
            {VIBE_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => setVibe(value)}
                className={cn(
                  'px-4 py-2.5 rounded-xl font-medium text-sm border-2 transition-all',
                  vibe === value
                    ? 'bg-lime-500 text-white border-lime-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-lime-400 hover:bg-lime-50/50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={skipNextTime}
            onChange={(e) => setSkipNextTime(e.target.checked)}
            className="w-4 h-4 rounded border-2 border-gray-300 text-lime-500 focus:ring-lime-400"
          />
          <span className="text-base font-medium text-gray-800">
            Don&apos;t show this again
          </span>
        </label>

        <Button
          onClick={handleDone}
          className="w-full bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 py-6 text-lg font-bold rounded-xl"
        >
          Show me the real read
        </Button>
      </div>
    </Card>
  );
}
