import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { signInWithMagicLink } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');
    const { error } = await signInWithMagicLink(email);
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={status === 'loading'}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 outline-none transition-colors disabled:opacity-60"
            />
          </div>
          {status === 'success' && (
            <p className="text-sm text-lime-600 font-medium">
              Check your email for the magic link.
            </p>
          )}
          {status === 'error' && (
            <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
          )}
          <Button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-lime-500 hover:bg-lime-600 text-white rounded-xl py-3 font-bold"
          >
            {status === 'loading' ? 'Sending…' : 'Send magic link'}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-6 w-full text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
