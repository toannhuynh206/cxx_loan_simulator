import { useState, useMemo, useEffect, useRef } from 'react';
import { LoanInput } from './components/LoanInput';
import { AmortizationChart } from './components/AmortizationChart';
import { ResultsSummary } from './components/ResultsSummary';
import { PaymentBreakdownChart } from './components/PaymentBreakdownChart';
import { AmortizationTable } from './components/AmortizationTable';
import { ThemeToggle } from './components/ThemeToggle';
import { DebtPayoffStrategy } from './components/DebtPayoffStrategy';
import { PaymentScenarios } from './components/PaymentScenarios';
import { HowItWorks } from './components/HowItWorks';
import { MobileApp } from './components/MobileApp';
import { useMobileLayout } from './hooks/useMobileLayout';
import { calculateMultipleLoans, calculateCascade } from './services/loanApi';
import { LoanEntry, LoanResponse, MonthlyEvent, CombinedLoanResult } from './types/loan';
import { PayoffStrategyType } from './types/payoffStrategy';
import Logo from './assets/logo.svg';
import './App.css';

type MobileResultsTab = 'overview' | 'balance' | 'schedule' | 'more';

function App() {
  const isMobile = useMobileLayout();
  const [multiLoanData, setMultiLoanData] = useState<CombinedLoanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'combined' | 'per-loan'>('per-loan');
  const [activeView, setActiveView] = useState<'calculator' | 'how-it-works'>('calculator');
  const [mobileResultsTab, setMobileResultsTab] = useState<MobileResultsTab>('overview');
  const resultsTabRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to results tab bar on mobile after calculation
  useEffect(() => {
    if (multiLoanData && window.innerWidth <= 768) {
      setTimeout(() => {
        resultsTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [multiLoanData]);

  // Reset all state to initial values
  const handleReset = () => {
    localStorage.removeItem('loanscope_form');
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
      setMobileResultsTab('overview'); // Reset to first tab on new calculation
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

  // Mobile: render dedicated iPhone layout
  if (isMobile) {
    return (
      <MobileApp
        multiLoanData={multiLoanData}
        loanData={loanData}
        isLoading={isLoading}
        error={error}
        resetKey={resetKey}
        onCalculate={handleCalculate}
        onReset={handleReset}
      />
    );
  }

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

      <nav className="app-tab-nav">
        <button
          className={`app-tab ${activeView === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveView('calculator')}
        >
          Calculator
        </button>
        <button
          className={`app-tab ${activeView === 'how-it-works' ? 'active' : ''}`}
          onClick={() => setActiveView('how-it-works')}
        >
          How It Works
        </button>
      </nav>

      <main>
        {activeView === 'calculator' && (
          <>
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
                {/* Mobile-only results tab bar */}
                <div className="mobile-results-tabs" ref={resultsTabRef}>
                  <button
                    className={`mobile-results-tab ${mobileResultsTab === 'overview' ? 'active' : ''}`}
                    onClick={() => { setMobileResultsTab('overview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    <span className="mobile-tab-icon">📊</span>
                    <span>Overview</span>
                  </button>
                  <button
                    className={`mobile-results-tab ${mobileResultsTab === 'balance' ? 'active' : ''}`}
                    onClick={() => { setMobileResultsTab('balance'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    <span className="mobile-tab-icon">📈</span>
                    <span>Balance</span>
                  </button>
                  <button
                    className={`mobile-results-tab ${mobileResultsTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => { setMobileResultsTab('schedule'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    <span className="mobile-tab-icon">📋</span>
                    <span>Schedule</span>
                  </button>
                  <button
                    className={`mobile-results-tab ${mobileResultsTab === 'more' ? 'active' : ''}`}
                    onClick={() => { setMobileResultsTab('more'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    <span className="mobile-tab-icon">✦</span>
                    <span>More</span>
                  </button>
                </div>

                {/* Overview tab: Summary + Breakdown */}
                <div className={`mobile-tab-panel ${mobileResultsTab === 'overview' ? 'active' : ''}`} data-tab="overview">
                  <section className="card summary-section">
                    <ResultsSummary data={loanData} />
                  </section>
                  <section className="card breakdown-section">
                    <PaymentBreakdownChart data={loanData} />
                  </section>
                </div>

                {/* Balance tab: Chart */}
                <div className={`mobile-tab-panel ${mobileResultsTab === 'balance' ? 'active' : ''}`} data-tab="balance">
                  <section className="card chart-section">
                    <AmortizationChart data={loanData} multiLoanData={multiLoanData} viewMode={viewMode} onViewModeChange={setViewMode} />
                  </section>
                </div>

                {/* Schedule tab: Table */}
                <div className={`mobile-tab-panel ${mobileResultsTab === 'schedule' ? 'active' : ''}`} data-tab="schedule">
                  <section className="card table-section">
                    <AmortizationTable data={loanData} multiLoanData={multiLoanData} viewMode={viewMode} onViewModeChange={setViewMode} />
                  </section>
                </div>

                {/* More tab: Scenarios + Strategy */}
                <div className={`mobile-tab-panel ${mobileResultsTab === 'more' ? 'active' : ''}`} data-tab="more">
                  <section className="card scenarios-section">
                    <PaymentScenarios multiLoanData={multiLoanData!} />
                  </section>
                  {multiLoanData && multiLoanData.loans.length > 1 && (
                    <section className="card strategy-section">
                      <DebtPayoffStrategy loanData={multiLoanData} />
                    </section>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeView === 'how-it-works' && (
          <section className="card how-it-works-section">
            <HowItWorks loanData={multiLoanData} />
          </section>
        )}
      </main>

      <footer>
        <p>LoanScope — Strategize your path to financial freedom</p>
      </footer>

      {/* Floating Action Buttons */}
      <div className="fab-container">
        <div className="fab-nav-pill">
          <button
            className={`fab-nav-btn ${activeView === 'calculator' ? 'active' : ''}`}
            onClick={() => { setActiveView('calculator'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            title="Calculator"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="8" y1="10" x2="10" y2="10" />
              <line x1="14" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="10" y2="14" />
              <line x1="14" y1="14" x2="16" y2="14" />
              <line x1="8" y1="18" x2="10" y2="18" />
              <line x1="14" y1="18" x2="16" y2="18" />
            </svg>
            <span>Calculator</span>
          </button>
          <button
            className={`fab-nav-btn ${activeView === 'how-it-works' ? 'active' : ''}`}
            onClick={() => { setActiveView('how-it-works'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            title="How It Works"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth="2.5" />
            </svg>
            <span>How It Works</span>
          </button>
        </div>
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
