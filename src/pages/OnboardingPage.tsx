import { useNavigate } from 'react-router-dom';

export function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Onboarding</h1>
        <p className="text-gray-600 mb-6">Coming soon.</p>
        <button
          onClick={() => navigate('/app')}
          className="text-lime-600 hover:text-lime-700 font-medium"
        >
          Go to app →
        </button>
      </div>
    </div>
  );
}
