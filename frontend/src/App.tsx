import { useState, useMemo } from 'react';
import { LoanInput } from './components/LoanInput';
import { AmortizationChart } from './components/AmortizationChart';
import { ResultsSummary } from './components/ResultsSummary';
import { PaymentBreakdownChart } from './components/PaymentBreakdownChart';
import { AmortizationTable } from './components/AmortizationTable';
import { ThemeToggle } from './components/ThemeToggle';
import { DebtPayoffStrategy } from './components/DebtPayoffStrategy';
import { calculateMultipleLoans, calculateCascade } from './services/loanApi';
import { LoanEntry, LoanResponse, MonthlyEvent, CombinedLoanResult } from './types/loan';
import { PayoffStrategyType } from './types/payoffStrategy';
import Logo from './assets/logo.svg';
import './App.css';

function App() {
  const [multiLoanData, setMultiLoanData] = useState<CombinedLoanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'combined' | 'per-loan'>('per-loan');

  // Reset all state to initial values
  const handleReset = () => {
    setMultiLoanData(null);
    setError(null);
    setViewMode('per-loan');
    setResetKey(prev => prev + 1); // Force LoanInput to remount
  };

  // Convert multi-loan data to single LoanResponse for existing components
  const loanData = useMemo((): LoanResponse | null => {
    if (!multiLoanData) return null;

    // Combine all loan events into a unified timeline
    const maxMonths = multiLoanData.totalMonths;
    const combinedEvents: MonthlyEvent[] = [];

    for (let month = 1; month <= maxMonths; month++) {
      let totalStartBalance = 0;
      let totalInterest = 0;
      let totalPayment = 0;
      let totalCashOutflow = 0;
      let totalEndBalance = 0;

      for (const loan of multiLoanData.loans) {
        const event = loan.events.find(e => e.month === month);
        if (event) {
          totalStartBalance += event.startBalance;
          totalInterest += event.interest;
          totalPayment += event.payment;
          // totalPayment on the event includes PMI + escrow for mortgages
          totalCashOutflow += event.totalPayment ?? event.payment;
          totalEndBalance += event.endBalance;
        }
      }

      if (totalStartBalance > 0.01 || month === 1) {
        combinedEvents.push({
          month,
          startBalance: totalStartBalance,
          interest: totalInterest,
          payment: totalPayment,
          totalPayment: totalCashOutflow,
          endBalance: totalEndBalance,
        });
      }
    }

    // Calculate weighted average APR (guard against zero principal)
    const weightedApr = multiLoanData.totalPrincipal > 0
      ? multiLoanData.loans.reduce(
          (sum, loan) => sum + (loan.apr * loan.principal), 0
        ) / multiLoanData.totalPrincipal
      : 0;

    return {
      principal: multiLoanData.totalPrincipal,
      apr: weightedApr,
      monthlyPayment: multiLoanData.totalMonthlyPayment,
      events: combinedEvents,
      totalMonths: combinedEvents.length,
      totalInterest: multiLoanData.totalInterest,
    };
  }, [multiLoanData]);


  const handleCalculate = async (
    loans: LoanEntry[],
    budget: number,
    strategy: PayoffStrategyType,
    mode: 'auto' | 'specify'
  ) => {
    setIsLoading(true);
    setError(null);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const [response] = await Promise.all([
        mode === 'auto'
          ? calculateCascade(loans, budget, strategy)
          : calculateMultipleLoans(loans),
        delay(2500)
      ]);
      setMultiLoanData(response);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate loan. Please try again.';
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(axiosError.response?.data?.error || errorMessage);
      } else {
        setError(errorMessage);
      }
      setMultiLoanData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <div className="header-brand">
            <img src={Logo} alt="LoanScope logo" className="header-logo" />
            <h1>LoanScope</h1>
          </div>
          <p className="header-tagline">
            A tool to <span className="highlight">visualize</span> your loans.
            <span className="tagline-separator"></span>
            <span className="highlight">Strategize</span> your path to financial freedom.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <main>
        <section className="card input-section">
          <LoanInput key={resetKey} onCalculate={handleCalculate} isLoading={isLoading} />
        </section>

        {error && (
          <section className="error-section">
            <p className="error-message">{error}</p>
          </section>
        )}

        {loanData && (
          <>
            <section className="card summary-section">
              <ResultsSummary data={loanData} />
            </section>

            <section className="card breakdown-section">
              <PaymentBreakdownChart data={loanData} />
            </section>

            <section className="card chart-section">
              <AmortizationChart data={loanData} multiLoanData={multiLoanData} viewMode={viewMode} onViewModeChange={setViewMode} />
            </section>

            <section className="card table-section">
              <AmortizationTable data={loanData} multiLoanData={multiLoanData} viewMode={viewMode} onViewModeChange={setViewMode} />
            </section>

            {multiLoanData && multiLoanData.loans.length > 1 && (
              <section className="card strategy-section">
                <DebtPayoffStrategy loanData={multiLoanData} />
              </section>
            )}
          </>
        )}
      </main>

      <footer>
        <p>LoanScope — Strategize your path to financial freedom</p>
      </footer>

      {/* Floating Action Button */}
      <div className="fab-container">
        <button
          className="fab fab--reset"
          onClick={handleReset}
          title="Reset all inputs and results"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}

export default App;
