import React from 'react';
import { LoanResponse } from '../types/loan';

interface ResultsSummaryProps {
  data: LoanResponse;
}

export const ResultsSummary: React.FC<ResultsSummaryProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const totalPaid = data.principal + data.totalInterest;
  const yearsToPayoff = Math.floor(data.totalMonths / 12);
  const remainingMonths = data.totalMonths % 12;

  return (
    <div className="results-summary">
      <h3>Loan Summary</h3>

      <div className="summary-grid">
        <div className="summary-item">
          <span className="label">Principal</span>
          <span className="value">{formatCurrency(data.principal)}</span>
        </div>

        <div className="summary-item">
          <span className="label">APR</span>
          <span className="value">{data.apr.toFixed(2)}%</span>
        </div>

        <div className="summary-item">
          <span className="label">Monthly Payment</span>
          <span className="value">{formatCurrency(data.monthlyPayment)}</span>
        </div>

        <div className="summary-item highlight">
          <span className="label">Time to Payoff</span>
          <span className="value">
            {yearsToPayoff > 0 && `${yearsToPayoff} year${yearsToPayoff > 1 ? 's' : ''} `}
            {remainingMonths} month{remainingMonths !== 1 ? 's' : ''}
            <span className="sub"> ({data.totalMonths} total)</span>
          </span>
        </div>

        <div className="summary-item highlight warning">
          <span className="label">Total Interest Paid</span>
          <span className="value">{formatCurrency(data.totalInterest)}</span>
        </div>

        <div className="summary-item highlight">
          <span className="label">Total Amount Paid</span>
          <span className="value">{formatCurrency(totalPaid)}</span>
        </div>
      </div>
    </div>
  );
};
