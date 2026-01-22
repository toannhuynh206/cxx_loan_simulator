import { useState, useEffect, useMemo } from 'react';
import { LoanForm } from './components/LoanForm';
import { AmortizationChart } from './components/AmortizationChart';
import { ResultsSummary } from './components/ResultsSummary';
import { PaymentSlider } from './components/PaymentSlider';
import { PaymentBreakdownChart } from './components/PaymentBreakdownChart';
import { AmortizationTable } from './components/AmortizationTable';
import { ThemeToggle } from './components/ThemeToggle';
import { calculateLoan } from './services/loanApi';
import { LoanRequest, LoanResponse, MonthlyEvent } from './types/loan';
import './App.css';

function App() {
  const [loanData, setLoanData] = useState<LoanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliderPayment, setSliderPayment] = useState<number>(0);

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

  const handleSubmit = async (request: LoanRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await calculateLoan(request);
      setLoanData(response);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate loan. Please try again.';
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(axiosError.response?.data?.error || errorMessage);
      } else {
        setError(errorMessage);
      }
      setLoanData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <h1>LoanScope</h1>
          <p>Visualize every payment, track your progress, and discover exactly how much you can save.</p>
        </div>
        <ThemeToggle />
      </header>

      <main>
        <section className="card input-section">
          <LoanForm onSubmit={handleSubmit} isLoading={isLoading} />
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
        <p>LoanScope — Your complete loan visualization tool</p>
      </footer>
    </div>
  );
}

export default App;
