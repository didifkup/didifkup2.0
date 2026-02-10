import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function UpgradeSuccessPage() {
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuth();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    fetch('/api/billing/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(() => {
        if (!cancelled) refreshProfile();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.access_token, refreshProfile]);

  const handleUnlockPro = async () => {
    const token = session?.access_token;
    if (!token) {
      navigate('/app');
      return;
    }
    setSyncing(true);
    try {
      await fetch('/api/billing/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      await refreshProfile();
    } finally {
      setSyncing(false);
    }
    navigate('/app', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
      <div className="container mx-auto max-w-2xl text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-16 h-16 text-lime-500" aria-hidden />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">You're Pro now</h1>
        <p className="text-lg text-gray-600 mb-6">
          Thanks for upgrading. You've got unlimited checks and full history.
        </p>
        <p className="text-sm text-gray-500 mb-10 max-w-md mx-auto">
          If it doesn't unlock instantly, click below to refresh your status — then we'll take you to the app.
        </p>
        <Button
          onClick={handleUnlockPro}
          disabled={syncing}
          className="bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 text-white rounded-2xl px-6 py-3 text-lg font-bold flex items-center justify-center gap-2 mx-auto"
        >
          <Sparkles className="w-5 h-5" />
          {syncing ? 'Refreshing…' : 'Unlock Pro'}
        </Button>
      </div>
    </div>
  );
}
