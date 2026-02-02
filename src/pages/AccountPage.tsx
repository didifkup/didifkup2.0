import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { openPaymentLink } from '@/lib/paymentLink';

/** Format ISO date string for display. */
function formatRenewalDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
}

export function AccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const hasAutoRefreshed = useRef(false);

  const isPro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('session_id') || params.has('success')) {
      if (!hasAutoRefreshed.current) {
        hasAutoRefreshed.current = true;
        refreshProfile();
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, location.pathname, refreshProfile, navigate]);
  const renewalDate = formatRenewalDate(profile?.current_period_end ?? null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
      <div className="container mx-auto max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-teal-400 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
        </div>
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Your Account</CardTitle>
            <CardDescription>{user?.email ?? 'Signed in'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Email</p>
              <p className="text-base text-gray-900">{user?.email ?? '—'}</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-600">Plan</p>
                <button
                  type="button"
                  onClick={() => refreshProfile()}
                  className="text-xs text-gray-500 hover:text-gray-700 underline flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh status
                </button>
              </div>
              {isPro ? (
                <p className="text-base text-gray-900">Plan: Pro ✅</p>
              ) : (
                <p className="text-base text-gray-900">Plan: Free</p>
              )}
            </div>

            {isPro && renewalDate && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Renewal</p>
                <p className="text-base text-gray-900">Renews {renewalDate}</p>
              </div>
            )}

            {!isPro && (
              <Button
                type="button"
                onClick={() => openPaymentLink()}
                className="w-full bg-lime-500 hover:bg-lime-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Go Pro
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl font-bold border-2"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
