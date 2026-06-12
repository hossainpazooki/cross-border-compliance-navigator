import { NavigationForm, ResultsSummary } from '@features/navigation';
import { useResultsStore } from '@features/navigation/model';
import { Card, CardContent } from '@shared/ui';

export function Navigator() {
  const { analysisComplete, navigationError, isNavigating } = useResultsStore();

  return (
    <div className="space-y-6">
      <NavigationForm />

      {/* Loading State */}
      {isNavigating && (
        <Card variant="bordered">
          <CardContent>
            <div className="flex items-center justify-center gap-3 py-8">
              <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-slate-300">Analyzing cross-border compliance...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {navigationError && (
        <Card variant="bordered" className="border-red-500/50 bg-red-500/10">
          <CardContent>
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-medium text-red-400">Analysis Failed</p>
                <p className="mt-1 text-sm text-red-300">{navigationError}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Check that VITE_API_URL is set correctly in Vercel environment variables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysisComplete && <ResultsSummary />}
    </div>
  );
}
