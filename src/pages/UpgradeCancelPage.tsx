import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGoProCheckout } from '@/hooks/useGoProCheckout';
import { ArrowLeft, Sparkles } from 'lucide-react';

export function UpgradeCancelPage() {
  const navigate = useNavigate();
  const { handleGoPro, goProLoading, goProError } = useGoProCheckout();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-lime-400 to-teal-400 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          No worries — nothing was charged.
        </h1>
        <p className="text-gray-600 mb-8">
          You can upgrade anytime if you want unlimited checks.
        </p>
        <div className="space-y-4">
          <Button
            onClick={handleGoPro}
            disabled={goProLoading}
            className="w-full bg-lime-500 hover:bg-lime-600 text-white rounded-2xl py-6 text-lg font-bold"
          >
            {goProLoading ? 'Redirecting to checkout…' : 'Try again'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/app')}
            className="w-full rounded-2xl py-6 text-lg font-bold border-2"
          >
            <ArrowLeft className="w-5 h-5 mr-2 inline" />
            Go back to app
          </Button>
        </div>
        {goProError && (
          <p className="mt-4 text-sm text-red-600 font-medium">{goProError}</p>
        )}
      </div>
    </div>
  );
}
