import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { openPaymentLink } from '@/lib/paymentLink';
import { ArrowRight, RefreshCw } from 'lucide-react';

export function UpgradeCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
      <div className="container mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">No worries</h1>
        <p className="text-lg text-gray-600 mb-8">
          You didn't complete checkout — nothing was charged. Whenever you're ready, you can try again.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            onClick={() => openPaymentLink()}
            className="bg-gradient-to-r from-lime-500 to-teal-500 hover:from-lime-600 hover:to-teal-600 text-white rounded-2xl px-6 py-3 text-lg font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Try again
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-2xl px-6 py-3 text-lg font-bold border-2"
          >
            <Link to="/app">
              Back to app
              <ArrowRight className="ml-2 w-5 h-5 inline-block" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
