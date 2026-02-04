import React, { useMemo, useState, useEffect } from 'react';
import { LoanResponse, CombinedLoanResult } from '../types/loan';

interface PaymentSliderProps {
  data: LoanResponse;
  multiLoanData?: CombinedLoanResult;
  sliderPayment: number;
  onPaymentChange: (payment: number) => void;
}

interface LoanPaymentState {
  [loanId: string]: number;
}

export const PaymentSlider: React.FC<PaymentSliderProps> = ({
  data,
  multiLoanData,
  sliderPayment,
  onPaymentChange,
}) => {
  // Individual loan payment states
  const [loanPayments, setLoanPayments] = useState<LoanPaymentState>({});

  // Initialize loan payments when multiLoanData changes
  useEffect(() => {
    if (multiLoanData) {
      const initialPayments: LoanPaymentState = {};
      multiLoanData.loans.forEach(loan => {
        initialPayments[loan.loanId] = loan.monthlyPayment;
      });
      setLoanPayments(initialPayments);
    }
  }, [multiLoanData]);

  // Calculate total payment from individual sliders
  const totalPayment = useMemo(() => {
    if (!multiLoanData) return sliderPayment;
    return Object.values(loanPayments).reduce((sum, p) => sum + p, 0);
  }, [loanPayments, multiLoanData, sliderPayment]);

  // Update parent when total changes
  useEffect(() => {
    if (multiLoanData && totalPayment !== sliderPayment) {
      onPaymentChange(totalPayment);
    }
  }, [totalPayment, multiLoanData, sliderPayment, onPaymentChange]);

  // Calculate results for individual loans
  const loanResults = useMemo(() => {
    if (!multiLoanData) return null;

    return multiLoanData.loans.map(loan => {
      const payment = loanPayments[loan.loanId] || loan.monthlyPayment;
      const originalPayment = loan.monthlyPayment;
      const paymentChanged = Math.abs(payment - originalPayment) > 0.01;

      // Original results from backend
      const originalMonths = loan.totalMonths;
      const originalInterest = loan.totalInterest;

      // If payment hasn't changed, use original values (no recalculation needed)
      if (!paymentChanged) {
        return {
          loanId: loan.loanId,
          loanName: loan.loanName,
          loanType: loan.loanType,
          principal: loan.principal,
          apr: loan.apr,
          originalPayment,
          newPayment: payment,
          originalMonths,
          newMonths: originalMonths,
          originalInterest,
          newInterest: originalInterest,
          monthsSaved: 0,
          interestSaved: 0,
          minimumPayment: loan.minimumPayment || loan.monthlyPayment,
        };
      }

      // Only recalculate if payment was actually changed
      const monthlyRate = loan.apr / 100 / 12;
      let balance = loan.principal;
      let totalInterest = 0;
      let months = 0;
      const maxMonths = 1200;

      while (balance > 0.01 && months < maxMonths) {
        months++;
        const actualPayment = Math.min(payment, balance);
        balance -= actualPayment;
        const interest = balance * monthlyRate;
        totalInterest += interest;
        balance += interest;
      }

      return {
        loanId: loan.loanId,
        loanName: loan.loanName,
        loanType: loan.loanType,
        principal: loan.principal,
        apr: loan.apr,
        originalPayment,
        newPayment: payment,
        originalMonths,
        newMonths: months,
        originalInterest,
        newInterest: totalInterest,
        monthsSaved: originalMonths - months,
        interestSaved: originalInterest - totalInterest,
        minimumPayment: loan.minimumPayment || loan.monthlyPayment,
      };
    });
  }, [multiLoanData, loanPayments]);

  // Combined savings
  const totalSavings = useMemo(() => {
    if (!loanResults) return { monthsSaved: 0, interestSaved: 0 };

    const interestSaved = loanResults.reduce((sum, l) => sum + l.interestSaved, 0);
    const maxNewMonths = Math.max(...loanResults.map(l => l.newMonths));
    const maxOriginalMonths = Math.max(...loanResults.map(l => l.originalMonths));

    return {
      monthsSaved: maxOriginalMonths - maxNewMonths,
      interestSaved,
    };
  }, [loanResults]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonths = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${months} months`;
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years}y ${remainingMonths}m`;
  };

  const getLoanIcon = (type: string) => {
    switch (type) {
      case 'student-loan': return '🎓';
      case 'credit-card': return '💳';
      case 'personal-loan': return '💰';
      case 'auto-loan': return '🚗';
      case 'mortgage': return '🏠';
      default: return '📋';
    }
  };

  // If we have multiple loans, show individual sliders
  if (multiLoanData && multiLoanData.loans.length > 0 && loanResults) {
    const originalTotal = multiLoanData.totalMonthlyPayment;
    const paymentDiff = totalPayment - originalTotal;

    return (
      <div className="payment-slider-container">
        <h3>What If I Pay More?</h3>
        <p className="slider-description">
          Adjust payments for each loan to see how it affects your payoff
        </p>

        <div className="individual-sliders">
          {loanResults.map((loan, index) => {
            // Use the loan's actual minimum payment, not a calculated bare-minimum
            const minPayment = loan.minimumPayment || loan.originalPayment;
            const maxPayment = loan.principal; // Allow up to full balance
            const currentPayment = loanPayments[loan.loanId] || loan.originalPayment;
            const range = maxPayment - minPayment;
            const percentage = range > 0 ? ((currentPayment - minPayment) / range) * 100 : 0;

            return (
              <div key={loan.loanId} className="loan-slider-item">
                <div className="loan-slider-header">
                  <div className="loan-slider-info">
                    <span className="loan-slider-icon">{getLoanIcon(loan.loanType)}</span>
                    <div className="loan-slider-details">
                      <span className="loan-slider-name">
                        {loan.loanName || `Loan ${index + 1}`}
                      </span>
                      <span className="loan-slider-meta">
                        {formatCurrency(loan.principal)} @ {loan.apr}%
                      </span>
                    </div>
                  </div>
                  <div className="loan-slider-impact">
                    {loan.interestSaved > 0 && (
                      <span className="impact-badge good">
                        Save {formatCurrency(loan.interestSaved)}
                      </span>
                    )}
                    {loan.interestSaved < 0 && (
                      <span className="impact-badge bad">
                        +{formatCurrency(Math.abs(loan.interestSaved))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="loan-slider-control">
                  <div className="slider-track-wrap">
                    <input
                      type="range"
                      min={minPayment}
                      max={maxPayment}
                      step={10}
                      value={currentPayment}
                      onChange={(e) => {
                        setLoanPayments(prev => ({
                          ...prev,
                          [loan.loanId]: Number(e.target.value)
                        }));
                      }}
                      className="allocation-slider"
                    />
                    <div
                      className="slider-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="loan-slider-value">
                    <span className="value-display">{formatCurrency(currentPayment)}</span>
                    <span className="value-suffix">/mo</span>
                  </div>
                </div>

                <div className="loan-slider-stats">
                  <span className="stat-item">
                    <span className="stat-label">Payoff:</span>
                    <span className={`stat-value ${loan.monthsSaved > 0 ? 'good' : ''}`}>
                      {formatMonths(loan.newMonths)}
                      {loan.monthsSaved > 0 && (
                        <span className="stat-diff">(-{formatMonths(loan.monthsSaved)})</span>
                      )}
                    </span>
                  </span>
                  <span className="stat-item">
                    <span className="stat-label">Original:</span>
                    <span className="stat-value muted">{formatCurrency(loan.originalPayment)}/mo</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="slider-comparison">
          <div className="comparison-row">
            <span className="comparison-label">Monthly Payment:</span>
            <span className="comparison-original">{formatCurrency(originalTotal)}</span>
            <span className="comparison-arrow">→</span>
            <span className={`comparison-new ${paymentDiff > 0 ? 'increase' : paymentDiff < 0 ? 'decrease' : ''}`}>
              {formatCurrency(totalPayment)}
              {paymentDiff !== 0 && (
                <span className="diff">
                  ({paymentDiff > 0 ? '+' : ''}{formatCurrency(paymentDiff)})
                </span>
              )}
            </span>
          </div>

          <div className="comparison-row">
            <span className="comparison-label">Time to Pay Off:</span>
            <span className="comparison-original">{formatMonths(Math.max(...loanResults.map(l => l.originalMonths)))}</span>
            <span className="comparison-arrow">→</span>
            <span className={`comparison-new ${totalSavings.monthsSaved > 0 ? 'good' : totalSavings.monthsSaved < 0 ? 'bad' : ''}`}>
              {formatMonths(Math.max(...loanResults.map(l => l.newMonths)))}
              {totalSavings.monthsSaved !== 0 && (
                <span className="diff">
                  ({totalSavings.monthsSaved > 0 ? '-' : '+'}{formatMonths(Math.abs(totalSavings.monthsSaved))})
                </span>
              )}
            </span>
          </div>

          <div className="comparison-row">
            <span className="comparison-label">Total Interest:</span>
            <span className="comparison-original">{formatCurrency(loanResults.reduce((sum, l) => sum + l.originalInterest, 0))}</span>
            <span className="comparison-arrow">→</span>
            <span className={`comparison-new ${totalSavings.interestSaved > 0 ? 'good' : totalSavings.interestSaved < 0 ? 'bad' : ''}`}>
              {formatCurrency(loanResults.reduce((sum, l) => sum + l.newInterest, 0))}
              {totalSavings.interestSaved !== 0 && (
                <span className="diff">
                  ({totalSavings.interestSaved > 0 ? '-' : '+'}{formatCurrency(Math.abs(totalSavings.interestSaved))})
                </span>
              )}
            </span>
          </div>
        </div>

        {totalSavings.interestSaved > 0 && (
          <div className="savings-highlight">
            Pay <strong>{formatCurrency(paymentDiff)}</strong> more per month and save{' '}
            <strong className="savings-amount">{formatCurrency(totalSavings.interestSaved)}</strong> in interest!
          </div>
        )}

        {totalSavings.interestSaved < 0 && (
          <div className="savings-highlight warning">
            Paying less will cost you <strong className="cost-amount">{formatCurrency(Math.abs(totalSavings.interestSaved))}</strong> more in interest
          </div>
        )}
      </div>
    );
  }

  // Fallback: Single slider for combined view (original behavior)
  const monthlyRate = data.apr / 100 / 12;
  const minPayment = Math.ceil(data.principal * monthlyRate) + 1;
  const maxPayment = Math.ceil(data.monthlyPayment * 3);

  const sliderResults = useMemo(() => {
    let balance = data.principal;
    let totalInterest = 0;
    let months = 0;
    const maxMonths = 1200;

    while (balance > 0.01 && months < maxMonths) {
      months++;
      const payment = Math.min(sliderPayment, balance);
      balance -= payment;
      const interest = balance * monthlyRate;
      totalInterest += interest;
      balance += interest;
    }

    return { months, totalInterest };
  }, [data.principal, monthlyRate, sliderPayment]);

  const monthsSaved = data.totalMonths - sliderResults.months;
  const interestSaved = data.totalInterest - sliderResults.totalInterest;
  const paymentDiff = sliderPayment - data.monthlyPayment;

  return (
    <div className="payment-slider-container">
      <h3>What If I Pay More?</h3>
      <p className="slider-description">
        Drag the slider to see how different payments affect your loan
      </p>

      <div className="slider-control">
        <input
          type="range"
          min={minPayment}
          max={maxPayment}
          step={10}
          value={sliderPayment}
          onChange={(e) => onPaymentChange(Number(e.target.value))}
          className="payment-range"
        />
        <div className="slider-labels">
          <span>{formatCurrency(minPayment)}</span>
          <span className="current-value">{formatCurrency(sliderPayment)}</span>
          <span>{formatCurrency(maxPayment)}</span>
        </div>
      </div>

      <div className="slider-comparison">
        <div className="comparison-row">
          <span className="comparison-label">Monthly Payment:</span>
          <span className="comparison-original">{formatCurrency(data.monthlyPayment)}</span>
          <span className="comparison-arrow">→</span>
          <span className={`comparison-new ${paymentDiff > 0 ? 'increase' : paymentDiff < 0 ? 'decrease' : ''}`}>
            {formatCurrency(sliderPayment)}
            {paymentDiff !== 0 && (
              <span className="diff">
                ({paymentDiff > 0 ? '+' : ''}{formatCurrency(paymentDiff)})
              </span>
            )}
          </span>
        </div>

        <div className="comparison-row">
          <span className="comparison-label">Time to Pay Off:</span>
          <span className="comparison-original">{formatMonths(data.totalMonths)}</span>
          <span className="comparison-arrow">→</span>
          <span className={`comparison-new ${monthsSaved > 0 ? 'good' : monthsSaved < 0 ? 'bad' : ''}`}>
            {formatMonths(sliderResults.months)}
            {monthsSaved !== 0 && (
              <span className="diff">
                ({monthsSaved > 0 ? '-' : '+'}{formatMonths(Math.abs(monthsSaved))})
              </span>
            )}
          </span>
        </div>

        <div className="comparison-row">
          <span className="comparison-label">Total Interest:</span>
          <span className="comparison-original">{formatCurrency(data.totalInterest)}</span>
          <span className="comparison-arrow">→</span>
          <span className={`comparison-new ${interestSaved > 0 ? 'good' : interestSaved < 0 ? 'bad' : ''}`}>
            {formatCurrency(sliderResults.totalInterest)}
            {interestSaved !== 0 && (
              <span className="diff">
                ({interestSaved > 0 ? '-' : '+'}{formatCurrency(Math.abs(interestSaved))})
              </span>
            )}
          </span>
        </div>
      </div>

      {interestSaved > 0 && (
        <div className="savings-highlight">
          Pay <strong>{formatCurrency(paymentDiff)}</strong> more per month and save{' '}
          <strong className="savings-amount">{formatCurrency(interestSaved)}</strong> in interest!
        </div>
      )}

      {interestSaved < 0 && (
        <div className="savings-highlight warning">
          Paying less will cost you <strong className="cost-amount">{formatCurrency(Math.abs(interestSaved))}</strong> more in interest
        </div>
      )}
    </div>
  );
};
