import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export function SignUpPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailConfirmMessage, setEmailConfirmMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/app', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailConfirmMessage(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      console.log('[SignUp] result', { data, error });
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        console.log('[SignUp] success, session present');
        navigate('/app', { replace: true });
        return;
      }
      setEmailConfirmMessage('Check your email to confirm your account, then come back and sign in.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      console.log('[SignUp] error', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-teal-400 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
        </div>
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Sign up</CardTitle>
            <CardDescription>Create an account with email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">At least 6 characters</p>
              </div>
              <Button
                type="submit"
                className="w-full bg-lime-500 hover:bg-lime-600 text-white rounded-xl py-3 font-bold"
                disabled={loading}
              >
                {loading ? 'Creating account…' : 'Sign up'}
              </Button>
              {error && (
                <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>
              )}
              {emailConfirmMessage && (
                <p className="text-sm text-lime-700 bg-lime-50 border border-lime-200 rounded-xl p-4 mt-2" role="status">
                  {emailConfirmMessage}
                </p>
              )}
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/signin" className="text-lime-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
