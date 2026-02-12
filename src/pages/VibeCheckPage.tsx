/**
 * VibeCheck V2 — isolated page. POST /api/vibecheck. No imports from old vibecheck/analyze UI.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { VibecheckInput, VibecheckResponse } from '@/lib/vibecheck/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function VibeCheckPage() {
  const [happened, setHappened] = useState('');
  const [youDid, setYouDid] = useState('');
  const [theyDid, setTheyDid] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<VibecheckResponse | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
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

    setResult(data as VibecheckResponse);
    setStatus('success');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">VibeCheck V2</h1>
        <p className="text-gray-600 mb-6">What happened, what you did, what they did.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What happened</label>
            <Textarea
              value={happened}
              onChange={(e) => setHappened(e.target.value)}
              placeholder="Brief context"
              rows={2}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What you did</label>
            <Textarea
              value={youDid}
              onChange={(e) => setYouDid(e.target.value)}
              placeholder="Your part"
              rows={2}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What they did</label>
            <Textarea
              value={theyDid}
              onChange={(e) => setTheyDid(e.target.value)}
              placeholder="Their part"
              rows={2}
              className="w-full"
            />
          </div>
          <Button type="submit" disabled={status === 'loading'} className="w-full">
            {status === 'loading' ? 'Checking…' : 'Run vibe check'}
          </Button>
        </form>

        {status === 'error' && error && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-red-800 font-medium">{error.message}</p>
            {error.requestId && (
              <p className="text-red-600 text-sm mt-1">Request ID: {error.requestId}</p>
            )}
          </div>
        )}

        {status === 'success' && result && (
          <div className="mt-6 p-4 rounded-lg bg-white border border-gray-200 space-y-2">
            <p className="text-sm text-gray-500">Rank: <strong>{result.rank}</strong> · Score: {result.score}</p>
            <p className="text-gray-800">{result.oneLiner}</p>
            <p className="text-sm text-gray-700">{result.validation}</p>
            <p className="text-sm text-gray-700">{result.realityCheck}</p>
            <p className="text-sm text-gray-700"><strong>Next:</strong> {result.nextMove}</p>
            {result.requestId && (
              <p className="text-xs text-gray-400 mt-2">Request ID: {result.requestId}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
