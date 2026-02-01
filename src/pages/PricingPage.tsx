import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGoProCheckout } from '@/hooks/useGoProCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Check, ArrowRight, Sparkles } from 'lucide-react';

export function PricingPage() {
  const { session, user } = useAuth();
  const { handleGoPro, goProLoading, goProError } = useGoProCheckout();
  const { isPro } = useSubscription(user?.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Pricing</h1>
        <p className="text-lg text-gray-600 mb-10">
          Upgrade if you start using it every day 👀
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Free */}
          <div className="p-8 bg-white rounded-3xl border-2 border-gray-200 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Free</h2>
            <p className="text-4xl font-black text-gray-900 mb-6">$0</p>
            <ul className="space-y-3 mb-8 text-gray-600">
              <li className="flex items-center gap-2">
                <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                2 checks per day
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                Basic verdicts
              </li>
            </ul>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-2xl py-6 text-lg font-bold border-2"
            >
              <Link to="/app">
                Try the app
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>

          {/* Pro */}
          <div className="p-8 bg-white rounded-3xl border-2 border-lime-400 shadow-xl bg-gradient-to-br from-lime-50/80 to-teal-50/80">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-lime-600 bg-lime-100 px-2 py-1 rounded-lg">
                Popular
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Pro</h2>
            <p className="text-4xl font-black text-gray-900 mb-1">$12</p>
            <p className="text-gray-600 mb-6">/month</p>
            <ul className="space-y-3 mb-8 text-gray-600">
              <li className="flex items-center gap-2">
                <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                Unlimited checks
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                Full history
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-5 h-5 text-lime-500 flex-shrink-0" />
                Follow-up text suggestions
              </li>
            </ul>
            {!session && (
              <p className="text-sm text-amber-700 mb-3 font-medium">
                Sign in required to upgrade
              </p>
            )}
            <Button
              onClick={handleGoPro}
              disabled={goProLoading || isPro}
              className="w-full bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 text-white rounded-2xl py-6 text-lg font-bold shadow-lg flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {goProLoading
                ? 'Redirecting to checkout…'
                : isPro
                  ? 'You\'re Pro'
                  : 'Unlock Pro — $12/mo'}
            </Button>
            {goProError && (
              <p className="mt-3 text-sm text-red-600 font-medium text-center">
                {goProError}
              </p>
            )}
          </div>
        </div>

        <div className="text-center">
          <Button asChild variant="ghost" className="text-gray-600 hover:text-lime-600">
            <Link to="/app">
              Try the app
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
