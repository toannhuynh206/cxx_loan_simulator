import { useState, useEffect, useMemo } from 'react';
import { LoanInput } from './components/LoanInput';
import { AmortizationChart } from './components/AmortizationChart';
import { ResultsSummary } from './components/ResultsSummary';
import { PaymentSlider } from './components/PaymentSlider';
import { PaymentBreakdownChart } from './components/PaymentBreakdownChart';
import { AmortizationTable } from './components/AmortizationTable';
import { ThemeToggle } from './components/ThemeToggle';
import { calculateMultipleLoans } from './services/loanApi';
import { LoanEntry, LoanResponse, MonthlyEvent, CombinedLoanResult } from './types/loan';
import Logo from './assets/logo.svg';
import './App.css';

function App() {
  const [multiLoanData, setMultiLoanData] = useState<CombinedLoanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliderPayment, setSliderPayment] = useState<number>(0);

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
      let totalEndBalance = 0;

      for (const loan of multiLoanData.loans) {
        const event = loan.events.find(e => e.month === month);
        if (event) {
          totalStartBalance += event.startBalance;
          totalInterest += event.interest;
          totalPayment += event.payment;
          totalEndBalance += event.endBalance;
        }
      }

      if (totalStartBalance > 0.01 || month === 1) {
        combinedEvents.push({
          month,
          startBalance: totalStartBalance,
          interest: totalInterest,
          payment: totalPayment,
          endBalance: totalEndBalance,
        });
      }
    }

    // Calculate weighted average APR
    const weightedApr = multiLoanData.loans.reduce(
      (sum, loan) => sum + (loan.apr * loan.principal), 0
    ) / multiLoanData.totalPrincipal;

    return {
      principal: multiLoanData.totalPrincipal,
      apr: weightedApr,
      monthlyPayment: multiLoanData.totalMonthlyPayment,
      events: combinedEvents,
      totalMonths: combinedEvents.length,
      totalInterest: multiLoanData.totalInterest,
    };
  }, [multiLoanData]);

  // Reset slider when loan data changes
  useEffect(() => {
    if (loanData) {
      setSliderPayment(loanData.monthlyPayment);
    }
  }, [loanData]);

  // Recalculate loan data based on slider payment
  const displayData = useMemo((): LoanResponse | null => {
    if (!loanData) return null;
    if (sliderPayment === loanData.monthlyPayment) return loanData;

    // Recalculate with slider payment
    const events: MonthlyEvent[] = [];
    let balance = loanData.principal;
    let totalInterest = 0;
    const monthlyRate = loanData.apr / 100 / 12;
    let month = 0;
    const maxMonths = 1200;

    while (balance > 0.01 && month < maxMonths) {
      month++;
      const startBalance = balance;

      // Payment first, then interest (matching backend algorithm)
      const payment = Math.min(sliderPayment, balance);
      balance -= payment;

      const interest = balance * monthlyRate;
      totalInterest += interest;
      balance += interest;

      events.push({
        month,
        startBalance,
        interest,
        payment,
        endBalance: Math.max(0, balance),
      });
    }

    return {
      principal: loanData.principal,
      apr: loanData.apr,
      monthlyPayment: sliderPayment,
      events,
      totalMonths: month,
      totalInterest,
    };
  }, [loanData, sliderPayment]);

  const handleCalculate = async (loans: LoanEntry[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await calculateMultipleLoans(loans);
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
          <LoanInput onCalculate={handleCalculate} isLoading={isLoading} />
        </section>

        {error && (
          <section className="error-section">
            <p className="error-message">{error}</p>
          </section>
        )}

        {loanData && displayData && (
          <>
            <section className="card summary-section">
              <ResultsSummary data={displayData} />
            </section>

            <section className="card breakdown-section">
              <PaymentBreakdownChart data={displayData} />
            </section>

            <section className="card slider-section">
              <PaymentSlider
                data={loanData}
                sliderPayment={sliderPayment}
                onPaymentChange={setSliderPayment}
              />
            </section>

            <section className="card chart-section">
              <AmortizationChart data={displayData} />
            </section>

            <section className="card table-section">
              <AmortizationTable data={displayData} />
            </section>
          </>
        )}
      </main>

      <footer>
        <p>LoanScope — Strategize your path to financial freedom</p>
      </footer>
    </div>
  );
}

export default App;
