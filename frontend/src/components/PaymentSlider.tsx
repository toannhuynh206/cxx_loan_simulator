import React, { useMemo } from 'react';
import { LoanResponse } from '../types/loan';

interface PaymentSliderProps {
  data: LoanResponse;
  sliderPayment: number;
  onPaymentChange: (payment: number) => void;
}

export const PaymentSlider: React.FC<PaymentSliderProps> = ({
  data,
  sliderPayment,
  onPaymentChange,
}) => {
  // Calculate minimum payment (must exceed monthly interest on principal)
  const monthlyRate = data.apr / 100 / 12;
  const minPayment = Math.ceil(data.principal * monthlyRate) + 1;
  const maxPayment = Math.ceil(data.monthlyPayment * 3);

  // Simulate loan with slider payment
  const sliderResults = useMemo(() => {
    let balance = data.principal;
    let totalInterest = 0;
    let months = 0;
    const maxMonths = 1200;

    while (balance > 0.01 && months < maxMonths) {
      months++;
      // Payment first, then interest (matching backend algorithm)
      const payment = Math.min(sliderPayment, balance);
      balance -= payment;
      const interest = balance * monthlyRate;
      totalInterest += interest;
      balance += interest;
    }

    return { months, totalInterest };
  }, [data.principal, monthlyRate, sliderPayment]);

  // Calculate differences
  const monthsSaved = data.totalMonths - sliderResults.months;
  const interestSaved = data.totalInterest - sliderResults.totalInterest;
  const paymentDiff = sliderPayment - data.monthlyPayment;

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
