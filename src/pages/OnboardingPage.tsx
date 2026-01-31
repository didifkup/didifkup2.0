import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Users, Briefcase, Home, Brain, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { ProfilePrefs } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const USE_CASES: { id: ProfilePrefs['useCase']; label: string; icon: React.ReactNode }[] = [
  { id: 'dating', label: 'Dating', icon: <Heart className="w-6 h-6" /> },
  { id: 'friends', label: 'Friends', icon: <Users className="w-6 h-6" /> },
  { id: 'work', label: 'Work', icon: <Briefcase className="w-6 h-6" /> },
  { id: 'family', label: 'Family', icon: <Home className="w-6 h-6" /> },
  { id: 'anxiety', label: 'Anxiety / Overthinking', icon: <Brain className="w-6 h-6" /> },
];

const TONES: { id: NonNullable<ProfilePrefs['tone']>; label: string }[] = [
  { id: 'nice', label: 'Nice — Reassuring & gentle' },
  { id: 'real', label: 'Real — Blunt but fair' },
  { id: 'savage', label: 'Savage — Spicy but not cruel' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, refetchProfile } = useAuth();
  const [screen, setScreen] = useState(0);
  const [useCase, setUseCase] = useState<ProfilePrefs['useCase'] | null>(null);
  const [tone, setTone] = useState<NonNullable<ProfilePrefs['tone']>>('real');
  const [spiralModeDefault, setSpiralModeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) {
    navigate('/signin', { replace: true });
    return null;
  }
  if (profile?.onboarding_completed) {
    navigate('/app', { replace: true });
    return null;
  }

  const handleNext = () => {
    if (screen < 2) setScreen((s) => s + 1);
    else handleComplete();
  };

  const handleBack = () => {
    if (screen > 0) setScreen((s) => s - 1);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const prefs: ProfilePrefs = {
        useCase: useCase ?? undefined,
        tone,
        spiralModeDefault,
      };
      const { error } = await supabase
        .from('profiles')
        .update({
          prefs,
          onboarding_completed: true,
        })
        .eq('id', user.id);
      if (error) throw error;
      await refetchProfile();
      navigate('/app', { replace: true });
    } catch (err) {
      console.error('[onboarding]', err);
    } finally {
      setSaving(false);
    }
  };

  const canNext = screen === 0 ? useCase : true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-teal-400 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-gray-900 text-center mb-2">Quick setup</h1>
        <p className="text-gray-600 text-center mb-8">
          {screen === 0 && 'What brings you here?'}
          {screen === 1 && 'How do you want your verdicts?'}
          {screen === 2 && 'Last thing — optional'}
        </p>

        <AnimatePresence mode="wait">
          {screen === 0 && (
            <motion.div
              key="use-case"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => setUseCase(uc.id)}
                  className={cn(
                    'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left font-bold transition-all',
                    useCase === uc.id
                      ? 'border-lime-500 bg-lime-50 text-lime-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-lime-300'
                  )}
                >
                  <span
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      useCase === uc.id ? 'bg-lime-500 text-white' : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {uc.icon}
                  </span>
                  {uc.label}
                </button>
              ))}
            </motion.div>
          )}

          {screen === 1 && (
            <motion.div
              key="tone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left font-bold transition-all',
                    tone === t.id
                      ? 'border-lime-500 bg-lime-50 text-lime-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-lime-300'
                  )}
                >
                  <span
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm',
                      tone === t.id ? 'bg-lime-500 text-white' : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {t.id.charAt(0).toUpperCase()}
                  </span>
                  {t.label}
                </button>
              ))}
            </motion.div>
          )}

          {screen === 2 && (
            <motion.div
              key="spiral"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => setSpiralModeDefault(!spiralModeDefault)}
                className={cn(
                  'w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 text-left font-bold transition-all',
                  spiralModeDefault
                    ? 'border-purple-500 bg-purple-50 text-purple-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      spiralModeDefault ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    <Brain className="w-5 h-5" />
                  </span>
                  <span>Spiral Mode default ON</span>
                </span>
                <span
                  className={cn(
                    'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors',
                    spiralModeDefault ? 'bg-purple-500' : 'bg-gray-300'
                  )}
                >
                  <motion.span
                    className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow"
                    animate={{ x: spiralModeDefault ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </span>
              </button>
              <p className="text-sm text-gray-500 text-center">
                Purple gradient background when you run checks. You can toggle anytime.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3 mt-8">
          {screen > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="rounded-2xl border-2 px-6 font-bold"
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canNext || saving}
            className="flex-1 bg-lime-500 hover:bg-lime-600 rounded-2xl py-6 font-bold text-lg"
          >
            {saving ? 'Saving…' : screen < 2 ? 'Next' : 'Get started'}
            {!saving && screen < 2 && <ArrowRight className="w-5 h-5 inline ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
